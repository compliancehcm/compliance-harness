/**
 * ALMA (Compliance HCM) as MCP tools, host half.
 *
 * ALMA's MCP endpoint is an OAuth-protected resource whose authorization server
 * offers `authorization_code` and `refresh_token` and nothing else: every token
 * begins in a browser, per user. This plugin owns that conversation and the
 * lifetime around it, and lets `@deepseek-ai/dsh-mcp-client` own MCP itself.
 *
 * Three parts, in the order a request meets them:
 *
 *   src/routes.js   `/alma/connect`, `/alma/callback`, `/alma/status`,
 *                   `/alma/disconnect` — registered on the harness's own
 *                   webserver. Under this deployment the SSO gate proxies the
 *                   public origin to the signed-in user's backend, so these
 *                   land in the right user's process, and its policy admits any
 *                   authenticated user on a non-RPC path.
 *   src/relay.js    `/alma/mcp` — a loopback hop that injects the current
 *                   bearer, refreshes on demand and retries once on a 401.
 *   src/mcp.js      one mcp-client instance pointed at that relay, mounted only
 *                   while a grant exists.
 *
 * The relay exists because mcp-client accepts only static headers. Remounting it
 * on every refresh would work, but it would unregister and re-register every
 * tool each hour and still could not answer a 401.
 *
 * There is no browser half doing any of this: the pages are server-rendered, and
 * `client.js` only adds the entry point that opens them.
 */

import { randomUUID } from 'node:crypto'
import { resolveConfig } from './src/config.js'
import { createAuthorizer } from './src/authorizer.js'
import { createConnection } from './src/mcp.js'
import { createRelay } from './src/relay.js'
import { createRoutes } from './src/routes.js'

/** Cordis plugin name; also the scope of the credential record this plugin owns. */
export const name = 'alma-mcp'

/** Required services: the route registry and the store the grant lives in. */
export const inject = ['webServer', 'credentials']

/** How often abandoned login attempts are forgotten. */
const SWEEP_INTERVAL_MS = 60_000

/** Global the client half reads to learn where these routes live. */
const ROUTES_GLOBAL = '__ALMA_ROUTES__'

/**
 * Mount the ALMA connection.
 *
 * @param ctx - plugin context carrying `webServer` and `credentials`.
 * @param rawConfig - the row's `config` block, validated here so a bad row fails
 * the boot rather than a later tool call.
 * @returns startup readiness: with a grant already stored, this resolves after
 * the tools are registered, so the first turn sees them.
 */
export async function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)

  // Per process, and never persisted: it authenticates the mounted client to
  // its own relay, and a restart mints a new one because both halves restart
  // together.
  const nonce = randomUUID()

  // The two know each other in one direction only: a dead grant takes its tools
  // with it, while the connection never reaches back into authorization.
  const connection = createConnection(ctx, config, nonce)
  const authorizer = createAuthorizer(ctx, config, () => connection.release())
  const relay = createRelay(ctx, config, authorizer, nonce)

  ctx.effect(() => {
    const disposers = [
      ...createRoutes(ctx, config, authorizer, connection).map(route => ctx.webServer.register(route)),
      ctx.webServer.register({ kind: 'prefix', path: config.routes.relay, handler: relay }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'alma-mcp: routes')

  ctx.effect(() => {
    const timer = setInterval(() => { authorizer.sweep() }, SWEEP_INTERVAL_MS)
    // An unref'd timer must not be the reason a shutting-down process lingers.
    timer.unref()
    return () => { clearInterval(timer) }
  }, 'alma-mcp: attempt sweep')

  // The client half is a separate bundle with no view of this config, so the
  // paths travel to it as a boot global rather than being written twice.
  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: ROUTES_GLOBAL, value: config.routes })
  })

  ctx.effect(() => () => { void connection.release() }, 'alma-mcp: mcp client')

  // Mount at boot only for a workspace that already authorized: mounting
  // unconditionally would connect, be refused, and burn the client's reconnect
  // budget before the user ever reached the connect page.
  const status = await authorizer.status()
  if (!status.connected) {
    ctx.logger.info('alma-mcp: ALMA is not connected yet; open %s to sign in', config.routes.connect)
    return
  }
  try {
    await connection.ensure()
  } catch (error) {
    if (config.failOnStartupError) throw error
    ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
    ctx.logger.warn('alma-mcp: starting without ALMA tools; %s reports the reason', config.routes.status)
  }
}
