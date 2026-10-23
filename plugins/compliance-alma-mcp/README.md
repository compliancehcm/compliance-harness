# @compliance/dsh-alma-mcp

ALMA — the Compliance HCM assistant — reached as MCP tools inside each user's
workspace. The model sees them as `mcp__alma__*`, beside its own tools.

This plugin is not an MCP bridge. `@deepseek-ai/dsh-mcp-client` already is one,
and it is what ends up talking to ALMA; this plugin exists to put the right
`Authorization` header on every request it makes.

## Whose token

ALMA's MCP endpoint accepts the access token Keycloak issues at the Compliance
SSO login. So the header is `Authorization: Bearer <the signed-in user's SSO
access token>` — the same token `plugins/sso-auth` obtained when the human
signed in to this app. There is no second login, no client registration, no
consent page and no grant stored by this plugin.

The token lives in the gateway, in the user's SSO session; this plugin runs in
the user's own backend, a separate and confined process. It gets the token by
asking:

```
backend (this plugin)                         gateway (sso-auth + tenancy)
  relay needs a token ── POST $COMPLIANCE_SSO_TOKEN_URL ──► token broker
                          Authorization: Bearer $COMPLIANCE_SSO_TOKEN_KEY
                                                │ key → subject   (tenancy)
                                                │ subject → latest live session
                                                │ renew first if < 60s left
                      ◄── { accessToken, expiresAt } ──┘
```

Both variables are set on each backend by `@compliance/dsh-tenancy` when it
starts it. The key is minted per backend and names its user, so a backend can
only ever obtain its own user's token. Pushing the token along with each proxied
browser request would not do: Keycloak access tokens live minutes, and an agent
run can call ALMA long after the browser's last request.

## Layout

| File | Role |
|---|---|
| `index.js` | Host half: validates the row, registers the routes, mounts the client at boot |
| `src/config.js` | Configuration and its validation, at load, all problems at once |
| `src/sso-token.js` | The single owner of "what token do we send right now": asks the broker, caches until shortly before expiry |
| `src/relay.js` | The authenticating loopback hop the MCP client talks to |
| `src/routes.js` | `/alma/status`, for diagnosis |
| `src/mcp.js` | Mounts one `@deepseek-ai/dsh-mcp-client` instance over that relay |

There is no browser half: nothing is left for a human to click.

## How a request flows

```
one mcp-client instance ── url: http://127.0.0.1:<port>/alma/mcp
                                      │
                  prefix /alma/mcp ───┤ check the relay nonce,
                                      │ inject the user's SSO token,
                                      │ on 401: force one renewal, retry once
                                      ▼
                            https://mcp.compliancehcm.com.br/mcp
```

## Why a relay instead of a header

`@deepseek-ai/dsh-mcp-client` takes `headers` as **static** strings, resolved
once when its row activates, while an SSO access token lives minutes.

Remounting the client on every renewal would work — the tool names are a pure
function of `serverName`, so they would come back identical — but it would
unregister and re-register every tool each time, and it still could not answer
a `401` on a token that looked fresh. Pointing the client at a loopback route
instead makes the header it holds static (the relay nonce) and the token dynamic,
one decision per request. The relay adds no listener: it is a route on the
harness's own `ctx.webServer`.

**The nonce is not decoration.** Under this deployment the gateway proxies the
public origin into the signed-in user's backend, so `/alma/mcp` is reachable from
that user's browser too. A request without the per-process nonce is refused with
`403` rather than served as that user.

## When the session ends

Signing out, idling out (60 minutes without the app open, by default) or reaching
the session's absolute deadline ends the SSO session, and with it the token. The
broker then answers `401`, and so does the relay — **without** reaching ALMA —
with a reason the model receives as the tool call's error: the user must sign in
again. The tools stay registered; the next call after the user signs back in
works, with nothing remounted.

The mounted client is given a reconnect policy with no ceiling (`maxAttempts`
unbounded, backoff capped at 60s). mcp-client's default gives up after ten
failures and unregisters the tools until the plugin reloads, which would turn a
lunch break into a backend that had lost ALMA for good. While there is no
session a retry costs one loopback request.

Reading the token is not activity: an agent calling ALMA does not keep a
session alive whose browser tab was closed.

## Configuration

| Field | Required | Description |
|---|---|---|
| `mcpUrl` | yes | ALMA's MCP endpoint |
| `resolveMcpClientFrom` | yes | Directory to resolve `@deepseek-ai/dsh-mcp-client` from (`/app/apps/cli`) |
| `serverName` | no | Tool namespace; `[A-Za-z0-9_-]{1,32}`, default `alma` |
| `basePath` | no | Where the status route and the relay live, default `/alma` |
| `refreshSkewSeconds` | no | Ask the broker again this long before the cached token's expiry, default 30. Keep it under 60: the gateway renews a token with less than 60s left before handing it out, so a larger value would make every request ask again |
| `toolCallTimeoutMs` | no | Cap on one ALMA tool call, default 60000 |
| `failOnStartupError` | no | Fail the boot when the tools cannot be mounted — including when there is no broker — default false |

An unknown field is a rejection, not a warning: a silently ignored key reads as
"the setting I wrote took effect". That includes the fields of the OAuth flow
this plugin used to run (`publicUrl`, `scopes`, `clientId`, `clientSecretEnv`,
`clientName`).

From the environment, set by `@compliance/dsh-tenancy` rather than by hand:

| Variable | Meaning |
|---|---|
| `COMPLIANCE_SSO_TOKEN_URL` | The broker, on the gateway's loopback webserver |
| `COMPLIANCE_SSO_TOKEN_KEY` | This backend's key, which names its user |

Without them — any process tenancy did not start, such as a shared harness with
`COMPLIANCE_TENANCY=off` — the plugin mounts no tools and logs why; the
entrypoint does not compose it there at all.

Environment knobs in the image (`deploy/docker/entrypoint.sh` renders the row):
`ALMA_ENABLED`, `ALMA_MCP_URL`, `ALMA_SERVER_NAME`, `ALMA_REFRESH_SKEW_SECONDS`,
`ALMA_TOOL_CALL_TIMEOUT_MS`.

That overlay is rendered into `$COMPLIANCE_HARNESS_ROOT/.compliance-render/`
rather than `/run/compliance-ai`: a bwrap backend binds only the node root, the
harness root and the user's own tree, so a path under `/run` is simply absent
inside it.

## What ALMA must accept

The tokens are Keycloak's, for the `compliance-ai-harness` client (the SSO
row's `clientId`). ALMA has to accept that issuer and whatever audience those
tokens carry; if it validates `aud`, add an audience mapper to that client in
Keycloak. When ALMA refuses a token the gateway has just renewed — which no
expiry explains — the backend logs ALMA's `www-authenticate` header, which
names the mismatch.

## Endpoints it owns

| Path | Method | Answer |
|---|---|---|
| `/alma/status` | GET | JSON: whether the client is mounted, whether a token is held and until when, and the last problem. Never the token |
| `/alma/mcp` | prefix | The relay. Nonce required |

## Verifying it

```sh
pnpm run build                                   # the built mcp-client is what a backend mounts
node plugins/compliance-alma-mcp/tests/smoke.mjs
```

The smoke test puts the **real** token broker from `plugins/sso-auth` in front of
a fake gateway session and a fake ALMA, mounts the plugin, then drives a real MCP
client through the relay — `initialize`, `tools/list`, `tools/call` — and
exercises the token cache, the forced renewal on a 401, a session that ends and
comes back, a burst of requests sharing one broker call, and a process with no
broker. The gate's side (which session, when it renews, renewals deduplicated)
is `plugins/sso-auth/tests/broker.mjs`.

## Model Experience

### The ALMA tools

#### What the model sees

Whatever ALMA advertises, under `mcp__alma__<rawName>`, with ALMA's own
descriptions and input schemas — `@deepseek-ai/dsh-mcp-client` owns that
projection, and this plugin adds nothing to it. While the user has no live SSO
session, a call fails with an error saying they must sign in again.

#### Token effect

The advertised schemas are paid for on every request while the tools are
registered, which is the life of the backend.

#### KV Cache effect

Prefix-stable while the tool set is unchanged. A token renewal does **not**
disturb it — that is the point of the relay — and neither does a session that
ends and comes back, since the tools stay registered throughout.

## When a call takes too long

`MCP error -32001: Request timed out` is the MCP SDK's `RequestTimeout`, raised
when the cap on **that request** elapses. Three different caps can produce it,
and only the first is settable here:

| The request | Its cap | Settable |
|---|---|---|
| `tools/call` | `toolCallTimeoutMs` (this row → mcp-client → the SDK's per-request `timeout`) | yes |
| `initialize` and `tools/list` | the SDK's own 60s default | **no** — mcp-client's documented limitation, so a timeout during *connect* is not this field |
| anything, while the server streams progress | — | **no** — mcp-client does not set the SDK's `resetTimeoutOnProgress`, so progress notifications do not extend the cap |

So: a slow *tool* is `toolCallTimeoutMs`; a slow *handshake* is not fixable from
this side today. The relay adds no cap of its own — it aborts only when the
caller hangs up — so nothing between here and ALMA shortens the window.

## Known Limitations and Deferred Work

- **The agent can reach the user's SSO token.** The broker key is in the
  backend's environment, and the agent's shell runs in the same jail as the
  backend, so a prompt-injected agent could ask the broker for the token and
  use it beyond ALMA, wherever Compliance accepts that issuer's tokens. The
  OAuth grant this replaced had the same exposure, but it was valid for ALMA
  alone. Narrowing it means a token scoped to ALMA — Keycloak token exchange,
  or a dedicated audience — rather than the login's own token.
- **No session, no ALMA.** The token is the human's session. Closing the app for
  longer than the idle timeout, or signing out, makes running agents' ALMA calls
  fail until the user signs in again.
- **Tools only.** MCP resources and prompts have no consumer in the harness, so
  they are not bridged — that limit is mcp-client's, not this plugin's.
- **The relay buffers request bodies** (4 MiB cap) and streams responses. An MCP
  frame is orders of magnitude smaller, but a future streaming-upload MCP method
  would need the request half streamed too.
- **Egress from the jail is unconfined by design** (`--unshare-net` is
  deliberately absent, so the backend can reach the model provider). The relay
  does not narrow that: a workspace could reach ALMA without going through it.
  What the nonce protects is the *authorization*, not the route.
- **A slow handshake cannot be waited out.** `initialize` and the paginated
  `tools/list` use the MCP SDK's flat 60-second default because mcp-client
  exposes no connection or discovery timeout, and this plugin cannot reach past
  it. Making that configurable belongs upstream, in
  `packages/mcp/mcp-client`, together with `resetTimeoutOnProgress` so a server
  that reports progress can hold a long call open.
- **One ALMA per workspace.** The row is a singleton by construction; a second
  instance would collide on `serverName` and on its route paths.
