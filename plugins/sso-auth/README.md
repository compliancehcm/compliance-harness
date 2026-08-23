# @compliance/dsh-sso-auth

An OAuth2/OIDC single-sign-on gate for the dsh Web UI. Provider-agnostic:
Keycloak is only a set of configuration values.

## Why this is a proxy and not a middleware

`ctx.webServer` has no request-interception seam. Its whole public surface is
four registries — `register(route)`, `registerUpgrade(route)`,
`registerFallback(handler)`, `tapIndex(transform)` — and dispatch is a fixed
match order (exact table → longest prefix → fallback → 404) that awaits exactly
one handler. Concretely, from inside the existing listener:

- `register({kind: 'prefix', path: '/api'})` throws, because a duplicate
  `(kind, path)` is a hard error and `/api` already belongs to
  `packages/client/connection`.
- `registerFallback` throws, because `frontend-static` holds the seat as a child
  plugin of `web-runtime`, which an overlay cannot detach.
- `tapIndex` cannot help: its signature is `(html: string) => string`, with no
  request, so it cannot vary a response by cookie.

So this plugin binds the public port itself and forwards to the harness
webserver, which the overlay moves to an OS-assigned loopback port. Everything
the browser can reach — the app shell, `/api`, `/plugins/**` bundles, the SSE
stream, both WebSocket downlinks — crosses the gate, because the gate is the
only listener the browser can reach.

The architecturally correct alternative is a `registerGuard()` list in
`packages/host/webserver`, consulted at the top of `handle()` and in the
`'upgrade'` listener. That is an in-repo change to a repo package; this plugin
deliberately needs none.

## Layout

`index.ts` is the whole host half; there is no browser half. The login pages are
server-rendered, and the session is an `HttpOnly` cookie that the existing API
clients already send — both callers omit `credentials`, so fetch's `same-origin`
default carries it, and the WebSocket downlinks can carry a cookie but never a
header.

| File | Role |
|---|---|
| `index.ts` | Plugin body: config, session sweep, proxy lifecycle |
| `src/host.ts` | The harness surface used, declared structurally |
| `src/config.ts` | Configuration and its load-time validation |
| `src/edge.ts` | Public-edge cross-site checks, cookie read/write |
| `src/proxy.ts` | The forwarding listener |
| `src/gate.ts` | The decision and the `/auth/*` endpoints |
| `src/oidc.ts` | Discovery, PKCE, code exchange, refresh, logout URL |
| `src/claims.ts` | Payload decoding and the claim requirement |
| `src/sessions.ts` | Opaque-id sessions, expiry, pending logins |
| `src/pages.ts` | Server-rendered pages and the liveness script |

Sources sit at the package root and under `src/`, never under `lib/`, which the
repository `.gitignore` ignores at any depth.

`@deepseek-ai/cordis` and `@deepseek-ai/schemastery` are not resolvable from a
`plugins/` package under pnpm's strict layout. Hence `src/host.ts` instead of an
imported `Context`, and hand-written validation instead of a schemastery
`Config`. Both are deliberate consequences of living outside the workspace.

Because the host half is TypeScript, this plugin requires the source launch
(`pnpm dsh …`), which runs under tsx. An installed `dsh` binary running plain
Node cannot import `index.ts`.

## Configuration

Every field is validated at load, and an **unknown field is rejected** rather
than ignored — in a gate, a silently dropped setting reads as a setting that
took effect. See `../sso-auth.overlay.yml` for the annotated template.

| Field | Required | Meaning |
|---|---|---|
| `issuer` | yes | OIDC issuer; discovery hangs off `/.well-known/openid-configuration` |
| `clientId` | yes | OAuth client id |
| `clientSecretEnv` | no | **Name** of the env var / credential reference holding the secret. Omit for a public PKCE client. A value that looks like a secret rather than a variable name is refused |
| `publicUrl` | yes | The origin browsers use. `publicUrl + /auth/callback` must be registered on the provider's client, exactly |
| `host` | no | Public bind host; `127.0.0.1` (default) or `0.0.0.0` |
| `port` | no | Public bind port; default 3080. `--port` overrides it |
| `scopes` | no | Default `openid profile email`; `openid` is always added |
| `require` | no | `{claimPath, anyOf}`. Omit to admit any authenticated user |
| `sessionTtlMinutes` | no | Absolute session lifetime, default 480 |
| `idleTimeoutMinutes` | no | Idle lifetime, default 60 |

The secret resolves through `ctx.credentials` first, then the launch
environment — the same order as the harness's own `apiKeyEnv` references. A
`clientSecretEnv` that resolves to nothing is a load failure, not a silent
downgrade to a public client, because the provider would otherwise answer an
opaque `invalid_client`.

## Endpoints it owns

| Path | Purpose |
|---|---|
| `/auth/login` | Interstitial; `?go=1` redirects to the provider |
| `/auth/callback` | Code exchange, claim check, session cookie |
| `/auth/logout` | Drops the session, then RP-initiated provider logout |
| `/auth/status` | `{authenticated, subject, name}`; the liveness poll reads it |

## Design notes worth knowing before changing this

**The cross-site check is load-bearing.** The harness trust fence requires any
`Origin` to equal `Host`, and pins the configuration plane (`settings.*`,
`credentials.*`, …) to loopback same-origin. A proxy must rewrite `Host` to the
internal authority for that pin to pass, which would neutralise the fence's
cross-site defence — so the proxy makes that decision itself first
(`src/edge.ts`), then normalises. Deleting those checks breaks no test elsewhere
and silently reopens the config plane to cross-site requests.

**No JWT signature verification, on purpose.** Tokens are fetched by this process
directly from the token endpoint over TLS and never leave it; the browser holds
only an opaque session id. Authenticity rests on that channel, which is the same
judgement the vendored provider flows already make. If a token ever starts
arriving from the browser, `src/claims.ts` becomes wrong and JWKS verification
becomes mandatory.

**Upgraded sockets need explicit bookkeeping.** Node stops tracking a socket once
`'upgrade'` fires, so `closeAllConnections()` does not reach it and `close()`
never completes while one is open — verified on node 24. `src/proxy.ts` tracks
hijacked pairs and destroys them on close; without that, unloading the plugin
hangs.

**The OIDC callback is cross-site, by construction.** It returns from the
provider's origin, so browsers send `Sec-Fetch-Site: cross-site` on it. A blanket
cross-site refusal therefore refuses every login — which it did, until the rule
became "refuse cross-site unless it is a top-level GET/HEAD navigation". Such a
request cannot set headers, cannot read the response, and cannot reach a
state-changing endpoint, which is precisely why `SameSite=Lax` admits it; a
cross-site navigation with any other method is still refused.

**The authorization claim is searched in both tokens.** Keycloak puts
`realm_access` and `resource_access` in the ACCESS token and ships an id_token
with no role claim at all, so requiring the id_token would mean asking every
deployment to add a protocol mapper before the gate works. Both tokens arrive in
the same token-endpoint response over the same TLS channel from the same issuer,
so provenance — not location — is what makes the claim trustworthy. Identity
still comes from the id_token alone. A denial names both tokens and what each
held, because "the claim is absent" and "it holds the wrong value" need different
fixes.

Note for Keycloak specifically: a **client** role lives at
`resource_access.<clientId>.roles`, a **realm** role at `realm_access.roles`.
Getting this wrong denies every user with a message that says the claim is absent.

**Documents redirect, everything else 401s.** A browser navigation
(`Sec-Fetch-Mode: navigate`, or an `Accept` asking for HTML) gets a 302 to the
login page; an XHR gets 401. Redirecting an XHR would hand the SPA a login
document where it expects JSON, surfacing as a parse error instead of "you are
logged out". A plain `curl` sends neither signal and therefore gets 401.

**A liveness poller is injected into HTML responses.** The client stack turns
every non-2xx into an untyped `transport failure … HTTP <n>` and then reconnects
forever with only a console warning, so an expired session would present as a
silently empty, endlessly reconnecting app. One poll of `/auth/status` plus a
reload turns that into a redirect to the login page. HTML is the only content
type buffered for rewriting; a compressed or non-HTML response streams untouched,
which is what keeps SSE and the WebSocket downlinks unbuffered.

## Model Experience

None. This package gates browser access; nothing here reaches a model request.

#### KV Cache effect

None; it neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- **A local process can bypass the gate.** The harness webserver still listens on
  loopback, and anything on this machine may talk to it directly. This is
  inherent to gating in front of a listener instead of inside it. It is largely
  outside the threat model — a local process running as this user can already
  launch `dsh`, read `$DSH_HOME/.credentials.yaml`, and use the same shell access
  the agent has — but it is a real hole and closing it needs the `registerGuard`
  seam described above.
- **Only the Web UI is gated.** The CLI, headless, ACP, and SDK surfaces do not
  go through the webserver and are unaffected; their trust model remains "whoever
  can spawn the process".
- **No TLS.** Beyond loopback this belongs behind a TLS terminator, with
  `publicUrl` set to the external https origin so the session cookie becomes
  `Secure`.
- **Sessions are process-local.** A restart requires re-login. A durable store
  would have to protect refresh tokens at rest, and the obvious location is
  readable by the very agent being gated.
- **One provider at a time.** The configuration names a single issuer; multiple
  identity providers would need the config to become a list and the login page to
  offer a choice.
- **No authorization beyond the claim filter.** Every admitted user shares the
  same sessions, workspaces, and filesystem access — this gates *entry*, it does
  not make the harness multi-tenant.
