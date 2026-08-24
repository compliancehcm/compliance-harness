# @compliance/dsh-alma-mcp

ALMA — the Compliance HCM assistant — reached as MCP tools inside each user's
workspace. The model sees them as `mcp__alma__*`, beside its own tools.

This plugin is not an MCP bridge. `@deepseek-ai/dsh-mcp-client` already is one,
and it is what ends up talking to ALMA; this plugin exists because ALMA's MCP
endpoint is an OAuth-protected resource and that client cannot authorize itself.

## What the endpoint demands

```
POST https://mcp.compliancehcm.com.br/mcp        → 401
www-authenticate: Bearer resource_metadata=".../oauth-protected-resource/mcp"
```

Its metadata, at the time of writing:

| Field | Value |
|---|---|
| `authorization_servers` | `https://mcp.compliancehcm.com.br/` |
| `grant_types_supported` | `authorization_code`, `refresh_token` |
| `code_challenge_methods_supported` | `S256` |
| `registration_endpoint` | `/register` (RFC 7591 dynamic registration) |
| `scopes_supported` | `openid`, `profile` |

There is **no machine grant**. No `client_credentials`, no long-lived service
token: every ALMA token begins in a browser, as a specific person. That single
fact decides everything below — the plugin has to hold a conversation with a
human, and it has to hold the result per user.

## Layout

| File | Role |
|---|---|
| `index.js` | Host half: validates the row, registers the routes, mounts the client |
| `src/config.js` | Configuration and its validation, at load, all problems at once |
| `src/oauth.js` | Discovery (RFC 9728), registration (RFC 7591), PKCE (RFC 7636), `resource` (RFC 8707), code exchange, refresh |
| `src/tokens.js` | The grant, as a `grant` record in `ctx.credentials` |
| `src/authorizer.js` | The single owner of "what token do we send right now" |
| `src/relay.js` | The authenticating loopback hop the MCP client talks to |
| `src/mcp.js` | Mounts one `@deepseek-ai/dsh-mcp-client` instance over that relay |
| `client.js` | Browser half: one action in the settings panel, nothing more |

## How a request flows

```
browser ──SSO──► gateway ──proxy──► the user's own backend
                                      │
                  GET  /alma/connect ─┤ register (once) + PKCE → 302 to ALMA
                  GET  /alma/callback ┤ code → tokens → record → back to the app
                  GET  /alma/status ──┤ page, or JSON for the browser half
                  POST /alma/disconnect
                                      │
                  prefix /alma/mcp ───┤ inject the current bearer,
                                      │ refresh when stale, retry once on 401
                                      ▼
                            https://mcp.compliancehcm.com.br/mcp
                                      ▲
              one mcp-client instance ┘ url: http://127.0.0.1:<port>/alma/mcp
```

## Why a relay instead of a header

`@deepseek-ai/dsh-mcp-client` takes `headers` as **static** strings, resolved
once when its row activates. An ALMA access token lives about an hour.

Remounting the client on every refresh would work — the tool names are a pure
function of `serverName`, so they would come back identical — but it would
unregister and re-register every tool once an hour, and it still could not answer
a `401` on a token that looked fresh. Pointing the client at a loopback route
instead makes the header it holds static (the relay nonce) and the token dynamic,
one decision per request. The relay adds no listener: it is a route on the
harness's own `ctx.webServer`.

**The nonce is not decoration.** Under this deployment the gateway proxies the
public origin into the signed-in user's backend, so `/alma/mcp` is reachable from
that user's browser too. A request without the per-process nonce is refused with
`403` rather than served as that user.

## Why the routes are HTTP and not RPC

The SSO gate judges every request. `plugins/sso-auth/src/policy.ts` fences the
RPC plane to administrators and admits any authenticated user on a path that is
not an API method — so a plain route reaches an ordinary user without widening
that fence, and needs no entry in `ADMIN_METHODS` or `USER_SETTINGS_NAMESPACES`.
The pages are server-rendered for the same reason the gate's are: they must work
before, and independently of, the application bundle.

## Why the client is mounted lazily

The mcp-client row is mounted by this plugin once a grant exists — not inserted
by the overlay. Inserted, it would connect at boot, be refused by an endpoint
nobody has authorized yet, and burn its reconnect budget (ten consecutive
failures) within a minute, long before the user reached the connect page. It is
mounted when a login lands and disposed when the workspace disconnects.

`plugins/` is not a pnpm workspace member and has no `node_modules`, so the
package cannot be imported by specifier from here. `resolveMcpClientFrom` names a
directory whose dependency graph declares it — `apps/cli` does — and resolution
goes through that, which is also what keeps this plugin from pinning a second
copy of the harness's own version. The built entry is tried first and the
TypeScript source subpath second, which is the difference between the built CLI
launch a per-user backend uses and the tsx source launch of a dev run.

## Where the token lives

In `ctx.credentials`, as a `grant` record under `alma-mcp/alma`. Under tenancy
that store is the user's own `$DSH_HOME/.credentials.yaml`, inside the only
writable tree of their jail — so isolation between users is the one the tenancy
plugin already provides, not a second scheme.

`modifyRecord` is the only write path, and its exclusion holds **across
processes**: that is what makes a refresh-token rotation safe, since two
processes rotating one refresh token would otherwise lose whichever wrote first.

Signing out forgets the tokens but keeps `clientId`. The registration identifies
this workspace as an OAuth client, not the human, so deleting it would make every
sign-out cost a new dynamic registration on ALMA's side.

## Configuration

| Field | Required | Description |
|---|---|---|
| `mcpUrl` | yes | ALMA's MCP endpoint |
| `publicUrl` | yes | The origin browsers reach. `${publicUrl}/alma/callback` is the redirect URI, so this must be the public one — under this deployment, `SSO_PUBLIC_URL` |
| `resolveMcpClientFrom` | yes | Directory to resolve `@deepseek-ai/dsh-mcp-client` from (`/app/apps/cli`) |
| `serverName` | no | Tool namespace; `[A-Za-z0-9_-]{1,32}`, default `alma` |
| `basePath` | no | Where the four routes and the relay live, default `/alma` |
| `scopes` | no | Requested scopes, default `["openid", "profile"]` |
| `clientId` | no | Pin a pre-registered client instead of registering dynamically |
| `clientSecretEnv` | no | Name of the variable holding that client's secret — never the secret. Requires `clientId` |
| `clientName` | no | `client_name` sent at registration |
| `refreshSkewSeconds` | no | Renew this long before the stated expiry, default 120 |
| `failOnStartupError` | no | Fail the boot when a workspace that IS connected cannot mount its tools, default false |

An unknown field is a rejection, not a warning: a silently ignored key reads as
"the setting I wrote took effect".

Environment knobs in the image (`deploy/docker/entrypoint.sh` renders the row):
`ALMA_ENABLED`, `ALMA_MCP_URL`, `ALMA_SERVER_NAME`, `ALMA_SCOPES`,
`ALMA_REFRESH_SKEW_SECONDS`, `ALMA_CLIENT_ID`, `ALMA_CLIENT_SECRET`. A pinned
confidential client also gets `ALMA_CLIENT_SECRET` appended to
`COMPLIANCE_FORWARD_CREDENTIALS`, because the plugin resolves it from the
**backend's** environment.

That overlay is rendered into `$COMPLIANCE_HARNESS_ROOT/.compliance-render/`
rather than `/run/compliance-ai`: a bwrap backend binds only the node root, the
harness root and the user's own tree, so a path under `/run` is simply absent
inside it.

## Endpoints it owns

| Path | Method | Answer |
|---|---|---|
| `/alma/connect` | GET | 302 to ALMA's `/authorize` with a fresh PKCE pair. `?returnTo=<path>` records where to land afterwards; only a same-origin path survives |
| `/alma/callback` | GET | Exchanges the code, stores the grant, mounts the tools, 302 **back to where the human started** — the destination comes from the remembered attempt, never from the callback's own query, which the authorization server does not sign |
| `/alma/status` | GET | The status page, or JSON when `Accept: application/json` |
| `/alma/disconnect` | POST | Forgets the tokens, unmounts the tools. POST-only, so no embedded image can sign a workspace out |
| `/alma/mcp` | prefix | The relay. Nonce required |

## Verifying it

```sh
pnpm run build                                   # the built mcp-client is what a backend mounts
node plugins/compliance-alma-mcp/tests/smoke.mjs
```

The smoke test stands up a fake ALMA advertising the same metadata the real one
does, runs the whole login, then drives a real MCP client through the relay —
`initialize`, `tools/list`, `tools/call` — and exercises the refresh, the 401
retry, a revoked refresh token and the disconnect. It is not a vitest suite:
`plugins/` sits outside the repository's test globs on purpose.

Against the real endpoint, discovery alone is safe to check without registering
anything:

```sh
curl -sS https://mcp.compliancehcm.com.br/.well-known/oauth-protected-resource/mcp
```

## Model Experience

### The ALMA tools

#### What the model sees

Whatever ALMA advertises, under `mcp__alma__<rawName>`, with ALMA's own
descriptions and input schemas — `@deepseek-ai/dsh-mcp-client` owns that
projection, and this plugin adds nothing to it. Before a workspace connects,
there are no such tools at all.

#### Token effect

The advertised schemas are paid for on every request while the tools are
registered. Connecting adds them mid-session; disconnecting removes them.

#### KV Cache effect

Prefix-stable while the tool set is unchanged. A refresh does **not** disturb it
— that is the point of the relay. Connecting or disconnecting changes the tool
definitions and invalidates reuse from the first changed token, which is
unavoidable: it is a change in what the model can do.

## Known Limitations and Deferred Work

- **The login is not resumable.** An attempt lives in the process that started
  it, in memory, for ten minutes. Reloading the page mid-login starts over.
- **Nothing is revoked.** Disconnecting forgets the local tokens; ALMA is not
  told, because the credential seam has no place to declare a provider-side
  revoke.
- **Tools only.** MCP resources and prompts have no consumer in the harness, so
  they are not bridged — that limit is mcp-client's, not this plugin's.
- **The relay buffers request bodies** (4 MiB cap) and streams responses. An MCP
  frame is orders of magnitude smaller, but a future streaming-upload MCP method
  would need the request half streamed too.
- **Egress from the jail is unconfined by design** (`--unshare-net` is
  deliberately absent, so the backend can reach the model provider). The relay
  does not narrow that: a workspace could reach ALMA without going through it.
  What the nonce protects is the *authorization*, not the route.
- **One ALMA per workspace.** The row is a singleton by construction; a second
  instance would collide on `serverName` and on its route paths.
