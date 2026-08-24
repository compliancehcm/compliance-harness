# @compliance/dsh-tenancy

One OS-confined dsh backend per authenticated user. Provides the `tenancy`
service that `plugins/sso-auth` routes through: `sso-auth` decides *who* is
calling, this plugin decides *which harness* they get.

## Why a process per user

Because the agent is the problem, not the UI. It has `bash`, filesystem tools
and a subprocess capability that run as the launching OS user, so scoping a
session list would be decoration: any user could ask their agent to read another
user's files.

The harness's own sandbox does not close this. It is a **write** fence — its
Linux profiles grant `readOnly: ['/']`
(`packages/sandbox/sandbox-local/src/profiles.ts`) — and its root is the
**client-supplied** session cwd (`session.create` takes `payload.cwd` and the
host `mkdir -p`s it). A user can also escalate a session to
`danger-full-access` from the UI, with no operator ceiling.

So each user gets their own process, and the process is wrapped in bubblewrap.
That wrapper is inherited and cannot be dropped from inside, which is what makes
the escalation moot for path confinement.

## What separates the data

Almost none of it is code here. Nearly everything the harness keeps per user is
already keyed to `$DSH_HOME`, resolved from the environment before boot:

| Concern | Where it lives |
|---|---|
| Session logs and the sidebar list | `$DSH_HOME/sessions`, enumerated by `sessionPersistence.list()` |
| Workspace registry | `$DSH_HOME/storages/workspace.json` |
| Settings, theme, model choice, permission mode | `$DSH_HOME/settings.yaml` |
| Credentials, agent presets, skills, attachments | `$DSH_HOME/…` |
| Every writer lock | a `<file>.lock` sibling, so distinct homes never contend |
| Profile composition | `$DSH_HOME/profiles/**` — and the launcher heals its `node_modules` by symlink, so there is **no `pnpm install` per user** |

Two things are *not* keyed to it, and are set explicitly per backend:
`DSH_AGENTS_HOME` (otherwise `~/.agents`, shared) and `TMPDIR` (otherwise the
shared `/tmp`, which the sandbox makes writable).

### What the user sees, and what the platform keeps

```
<usersRoot>/<sha256(sub)>/
├── workspace/     ← HOME and the process cwd. Empty. The user's own space.
└── .state/        ← the platform's; hidden from the picker by default
    ├── harness/       $DSH_HOME: sessions, settings, credentials, profiles
    ├── tmp/           $TMPDIR
    ├── agents/        $DSH_AGENTS_HOME
    ├── OWNER          which subject owns this hashed directory
    └── backend.log
```

`HOME` points at `workspace/`, not at the user's root, and that distinction is
the whole reason the picker is usable: the browse picker lists `homedir()` by
default (`packages/host/directory-picker-browse/src/index.ts:218`). Pointing it
at the root — which the first version did — opened the dialog onto the harness's
own plumbing, so "create a workspace" showed sessions, settings and a log file
instead of somewhere blank to put work.

Nothing else on the machine exists in the namespace, so the picker cannot leave
the user's tree even by typing a path.

## Layout

| File | Role |
|---|---|
| `index.ts` | Config, the `tenancy` service, the reap timer, teardown |
| `src/confine.ts` | The bubblewrap argv and the installation paths |
| `src/provision.ts` | Per-user directories, the plugin links, the home patch layer |
| `src/backend.ts` | One backend: spawn, readiness, stop |
| `src/pool.ts` | Port allocation, the concurrency cap, idle reaping |
| `src/config.ts` | Configuration and its load-time validation |
| `role-user.overlay.yml` | The reduced composition |
| `role-admin.overlay.yml` | The administrative composition |

Backends run the **built** `apps/cli/lib/bin.js` under plain node, not the tsx
source launch: tsx resolves workspace imports against the process cwd, which
inside the jail is the user's workspace and has no `node_modules`. So
`pnpm run build` is a prerequisite, and a missing build fails at boot with that
sentence rather than per login.

## Roles

The overlays are the cosmetic half — they remove the buttons. The fence is the
gateway's request policy (`plugins/sso-auth/src/policy.ts`), which refuses the
endpoints behind them. Omitting a client row does not remove an RPC.

`role-user.overlay.yml` drops Models, plugin configuration, the Loader
inventory, agent presets, permission presets, and both halves of the dynamic
Cordis runner — that last one both because it evaluates plugin code defined at
runtime and because leaving it mounted would have it poll endpoints the gateway
refuses, filling the console with its own failures.

`role-admin.overlay.yml` keeps the shipped composition. It still replaces the
native directory chooser: an administrator's backend is confined exactly like
everyone else's, because tenancy is a boundary rather than a trust level, and a
native dialog would open on the host outside that boundary.

## Verified

Against the live Keycloak realm, with the real launch specification:

- Another user's file: `No such file or directory`. Listing the users root from
  inside a backend shows only that user's own directory.
- The host's `~/.dsh/.credentials.yaml` and `~/.ssh`: invisible.
- The harness checkout: readable, `Read-only file system` on write.
- `/tmp`: private and empty per backend.
- The workspace picker offers only the user's own folder.

## Model Experience

None directly — but note that every backend it starts runs a complete agent, and
the composition it selects decides which tools that agent has.

#### KV Cache effect

None; this package assembles no provider request.

## Rough edges to know about

- **"Open configuration file" is still shown and will refuse.** The action is a
  `settings.action` list entry registered by `ui-settings-general`, which cannot
  be disabled (it declares the settings shell), and a list slot's entries cannot
  be shadowed. So a non-admin sees the button and gets the panel's error state
  when they use it. Honest, but not pretty.
- **A patch targeting a row id that does not exist is silently ignored.** That is
  how `ui-permission-presets` (the package name) instead of `ui-permission` (the
  row id) left the Permission control visible while looking disabled. When
  editing the overlays, check every id against
  `packages/bundle/web-app/cordis.patch.yml`.

## Known Limitations and Deferred Work

- **The provider credential is readable inside a backend.** Each backend needs
  one to be useful, and `forwardCredentials` puts it in that process's
  environment. `scrubbedParentEnv()`
  (`packages/subprocess/subprocess/src/index.ts:44`) keeps `*KEY*` out of the
  agent's shell children, but the process's own environment is inside the jail
  with the user. That is an abuse and cost risk on the platform's provider
  account, **not** a path to another user's data. Closing it means the gateway
  also fronting the model endpoint (`DEEPSEEK_BASE_URL` → gateway, which injects
  the real key), which is not built.
- **Network egress is not confined.** The namespace is not unshared, because a
  backend must reach the model provider. `web_fetch` is documented as an SSRF
  primitive that must not be enabled where it can reach internal targets.
- **Roles are decided at login and cached for the session.** Revoking someone's
  admin role in the identity provider does not demote a session already open,
  and their backend keeps the composition it started with until it is reaped.
- **Idle reaping stops a workspace, not a session.** Data is on disk, so the next
  visit restarts the backend and the session list returns — but anything in
  flight is lost, and a running agent turn is not a reason to stay alive today.
- **One machine.** The pool is process-local, so two gateways would each keep
  their own backends and their own port allocations. Beyond the low hundreds of
  users, this shape stops being the answer.
- **No per-user quota.** Disk under a user's root is unbounded, and nothing caps
  what one user's agent can spend against the shared provider account.
