# Compliance AI harness image

The dsh web UI with this deployment's five plugins already composed: the SSO
gate (`plugins/sso-auth`), per-user tenancy (`plugins/compliance-tenancy`), the
brand occupants (`plugins/compliance-brand`), the sidebar user menu
(`plugins/compliance-user-menu`) and the ALMA MCP connection
(`plugins/compliance-alma-mcp`).

| File | Role |
|---|---|
| `Dockerfile` | Two stages: install + `pnpm run build` + link the plugin packages into the `web` profile; then a runtime stage with bubblewrap |
| `entrypoint.sh` | Renders the loader overlays from the environment, then starts the gateway |
| `../../.github/workflows/docker-image.yml` | Builds and publishes to `ghcr.io/<owner>/<repo>/compliance-ai` |

## What is inside, and why it is large

The image carries the whole repository with its dev dependencies, because both
halves of this deployment need different launches:

- The **gateway** plugins are TypeScript with `main: index.ts`, so the gateway
  process is the tsx source launch (`apps/cli/src/bin.ts`). A pruned production
  tree cannot run it.
- The **per-user backends** run the built CLI (`apps/cli/lib/bin.js`) under plain
  node, because tsx resolves workspace imports against the process cwd — which
  inside a jail is the user's own empty workspace. So `pnpm run build` runs at
  image build time and its output ships in the image.

The gateway's own dsh home (`/opt/compliance-ai/gateway-home`) is baked in: it
holds the `web` profile whose `node_modules` links make the overlay rows
resolvable by package specifier. Do not mount a volume over it.

## Build

Context is the repository root:

```sh
docker build -f deploy/docker/Dockerfile \
  --build-arg DSH_CLIENT_COMMIT_HASH="$(git rev-parse HEAD)" \
  -t compliance-ai .
```

`DSH_CLIENT_COMMIT_HASH` is required because `.dockerignore` excludes `.git`,
and the client build stamps the commit into its artifacts.

## Run

```sh
docker run -d --name compliance-ai \
  -p 3080:3080 \
  --cap-add SYS_ADMIN --security-opt apparmor=unconfined \
  -v compliance-ai-users:/var/lib/compliance-ai/users \
  -e SSO_ISSUER=https://sso.compliancehcm.com.br/realms/ComplianceHCM \
  -e SSO_CLIENT_ID=compliance-ai-harness \
  -e SSO_CLIENT_SECRET="$SSO_CLIENT_SECRET" \
  -e SSO_PUBLIC_URL=https://ai.example.com \
  -e DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
  ghcr.io/<owner>/<repo>/compliance-ai:latest
```

`SSO_PUBLIC_URL` + `/auth/callback` must be registered as a redirect URI on the
provider's client, exactly.

### The confinement privilege is not optional

Tenancy wraps every backend in bubblewrap, and it **probes that wrapper at boot**
rather than per login: on a host where an unprivileged user namespace cannot be
created, the container exits with `unprivileged user namespaces are probably
unavailable on this host` instead of serving users unconfined.

Docker's default profile withholds exactly that. `--cap-add SYS_ADMIN
--security-opt apparmor=unconfined` is the narrow form; `--privileged` also
works. Under Kubernetes the equivalent is a `securityContext` with
`capabilities.add: [SYS_ADMIN]` and the container's AppArmor profile set to
`unconfined`.

Setting `COMPLIANCE_CONFINEMENT=none` starts anyway and prints a warning — every
user's agent can then read every other user's files, so it is for a single-user
demo only.

## Environment

Required:

| Variable | Meaning |
|---|---|
| `SSO_ISSUER` | OIDC issuer; discovery hangs off `/.well-known/openid-configuration` |
| `SSO_CLIENT_ID` | OAuth client id registered on that issuer |
| `SSO_PUBLIC_URL` | The origin browsers use |

Optional, with the image's defaults:

| Variable | Default | Meaning |
|---|---|---|
| `SSO_CLIENT_SECRET` | — | Set for a confidential client; unset means a public PKCE client. The overlay names the variable, never the value |
| `SSO_BIND_HOST` / `SSO_PORT` | `0.0.0.0` / `3080` | Public bind |
| `SSO_SCOPES` | `openid profile email` | Space- or comma-separated |
| `SSO_REQUIRE_CLAIM_PATH` | `resource_access.<clientId>.roles` | Claim holding entry roles |
| `SSO_REQUIRE_ROLES` | `dsh-access` | Any one admits. **Empty admits every authenticated user** |
| `SSO_ADMIN_CLAIM_PATH` | `resource_access.<clientId>.roles` | Claim holding admin roles |
| `SSO_ADMIN_ROLES` | `dsh-admin` | Any one grants the configuration plane. Empty means nobody is an administrator |
| `SSO_SESSION_TTL_MINUTES` / `SSO_IDLE_TIMEOUT_MINUTES` | `480` / `60` | Session lifetimes |
| `COMPLIANCE_USERS_ROOT` | `/var/lib/compliance-ai/users` | One directory per user; the volume |
| `COMPLIANCE_CONFINEMENT` | `bwrap` | `bwrap` or `none` |
| `COMPLIANCE_MAX_BACKENDS` | `12` | Concurrent backends; beyond it a user waits |
| `COMPLIANCE_IDLE_REAP_MINUTES` | `15` | Idle backend stop |
| `COMPLIANCE_PORT_RANGE_START` / `_END` | `31000` / `31200` | Loopback ports for backends |
| `COMPLIANCE_FORWARD_CREDENTIALS` | `DEEPSEEK_API_KEY` | Variables handed to each backend |
| `COMPLIANCE_TENANCY` | `on` | `off` runs one shared harness with the gate in front — no per-user isolation |
| `ALMA_ENABLED` | `on` | `off` composes no ALMA connection at all |
| `ALMA_MCP_URL` | `https://mcp.compliancehcm.com.br/mcp` | ALMA's MCP endpoint |
| `ALMA_SERVER_NAME` | `alma` | Tool namespace; the model sees `mcp__alma__*` |
| `ALMA_SCOPES` | `openid profile` | Scopes requested from ALMA |
| `ALMA_REFRESH_SKEW_SECONDS` | `120` | Renew this long before an access token expires |
| `ALMA_TOOL_CALL_TIMEOUT_MS` | `300000` | How long one ALMA tool call may take before the MCP SDK answers `-32001 Request timed out` |
| `ALMA_CLIENT_ID` | — | Pin one pre-registered OAuth client; unset means each workspace registers itself dynamically |
| `ALMA_CLIENT_SECRET` | — | That client's secret, for a confidential pinned client. Appended to `COMPLIANCE_FORWARD_CREDENTIALS` automatically, because the plugin resolves it in the backend |

Provider credentials (`DEEPSEEK_API_KEY`, optionally `DEEPSEEK_BASE_URL`) are
read from the gateway's environment and forwarded per the table above.

## ALMA needs no redirect URI registered anywhere

The ALMA plugin registers itself with ALMA's authorization server dynamically
(RFC 7591) and declares `SSO_PUBLIC_URL` + `/alma/callback` as its own redirect
URI in that registration — so unlike `SSO_PUBLIC_URL/auth/callback`, this one is
not configured on the Keycloak client and needs nothing from an administrator.
`ALMA_CLIENT_ID` pins a pre-registered client instead, and then that client must
accept exactly `SSO_PUBLIC_URL/alma/callback`.

Nobody is signed into ALMA by being signed into the harness: each user connects
once, from the settings panel's **Connect ALMA** action or by opening
`/alma/connect`. Until then their workspace simply has no ALMA tools. See
`plugins/compliance-alma-mcp/README.md`.

## Overlays are generated, not copied

`entrypoint.sh` writes `/run/compliance-ai/*.overlay.yml` at start rather than
copying `plugins/*.overlay.yml`, because the committed overlays carry one
machine's absolute paths (`/home/lucas/...`) and one realm's issuer. The
generated pair is the same composition with the image's paths and the
container's environment.

The ALMA overlay is the exception to the location, not to the rule: it is
rendered into `$COMPLIANCE_HARNESS_ROOT/.compliance-render/` because a bwrap
backend binds only the node root, the harness root and the user's own tree — a
`--patch` under `/run` would not exist inside the jail. Its directory must be
writable at container start; `ALMA_ENABLED=off` is the way out on a read-only
image tree.

**This is a drift surface.** When a row id, config field or overlay file changes
under `plugins/`, the heredocs in `entrypoint.sh` must change with it — nothing
gates that today. The role overlays (`role-user`, `role-admin`) and the brand and
user-menu overlays are referenced by path from `/app/plugins/`, so those need no
mirroring.

## Known limitations

- **One machine.** The backend pool is process-local, so two replicas each keep
  their own backends, ports and idle timers. Scale up, not out.
- **The image is a full source checkout**, dev dependencies included — a few
  gigabytes. Trimming it means giving the gateway plugins a build step so an
  installed CLI can load them.
- **The provider credential is readable inside a backend.** Unchanged from the
  host deployment; see `plugins/compliance-tenancy/README.md` for the threat
  model.
- **No health check.** A `HEALTHCHECK` would have to pick an endpoint the gate
  answers before login; not yet chosen.
