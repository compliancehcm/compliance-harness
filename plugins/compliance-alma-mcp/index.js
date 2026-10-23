/**
 * ALMA (Compliance HCM) as MCP tools, host half.
 *
 * ALMA's MCP endpoint accepts the access token Keycloak issues at the Compliance
 * SSO login, so the user who is signed in to this app is already signed in to
 * ALMA: no second login. This plugin carries that token to ALMA and lets
 * `@deepseek-ai/dsh-mcp-client` own MCP itself.
 *
 * Three parts, in the order a request meets them:
 *
 *   src/sso-token.js  the token: asked of the gateway's token broker, which
 *                     holds the user's SSO session and renews it, and cached
 *                     here until shortly before it expires.
 *   src/relay.js      `/alma/mcp` — a loopback hop that injects that token,
 *                     and on a 401 forces one renewal and retries once.
 *   src/mcp.js        one mcp-client instance pointed at the relay.
 *
 * The relay exists because mcp-client accepts only static headers. Remounting it
 * on every renewal would work, but it would unregister and re-register every
 * tool each time and still could not answer a 401.
 *
 * The broker exists only under `@compliance/dsh-tenancy`, which tells each
 * per-user backend where it is and gives it a key that names its user. In a
 * process without one — a shared harness, where "the user's token" has no
 * answer — the tools are not mounted.
 */

import { randomUUID } from 'node:crypto'
import { resolveConfig } from './src/config.js'
import { createConnection } from './src/mcp.js'
import { createRelay } from './src/relay.js'
import { createStatusRoute } from './src/routes.js'
import { almaSkill } from './src/skill.js'
import { createTokenSource, readBroker, TOKEN_URL_ENV } from './src/sso-token.js'

/** Cordis plugin name. */
export const name = 'alma-mcp'

/** Required service: the route registry the relay and the status route live on. */
export const inject = ['webServer']

/**
 * Mount the ALMA connection.
 *
 * @param ctx - plugin context carrying `webServer`.
 * @param rawConfig - the row's `config` block, validated here so a bad row fails
 * the boot rather than a later tool call.
 * @returns startup readiness: this resolves after the tools are registered, so
 * the first turn sees them.
 */
export async function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)

  const broker = readBroker()
  // Per process, and never persisted: it authenticates the mounted client to
  // its own relay, and a restart mints a new one because both halves restart
  // together.
  const nonce = randomUUID()
  const connection = createConnection(ctx, config, nonce)

  if (broker === undefined) {
    ctx.effect(
      () => ctx.webServer.register(createStatusRoute(config, undefined, connection)),
      'alma-mcp: status route',
    )
    const reason = `alma-mcp: ${TOKEN_URL_ENV} is not set, so there is no SSO token broker to authorize ALMA with; `
      + 'the broker exists only in a backend started by compliance-tenancy. ALMA tools are not mounted.'
    if (config.failOnStartupError) throw new Error(reason)
    ctx.logger.warn(reason)
    return
  }

  const tokens = createTokenSource(ctx, config, broker)
  const relay = createRelay(ctx, config, tokens, nonce)

  ctx.effect(() => {
    const disposers = [
      ctx.webServer.register(createStatusRoute(config, tokens, connection)),
      ctx.webServer.register({ kind: 'prefix', path: config.routes.relay, handler: relay }),
    ]
    return () => { for (const dispose of disposers) dispose() }
  }, 'alma-mcp: routes')

  ctx.effect(() => () => { void connection.release() }, 'alma-mcp: mcp client')

  // ALMA's own guide to its tools — ID resolution, export over pagination,
  // homonym disambiguation, payroll arithmetic. Only where the tools can exist:
  // a guide to tools the model cannot see would only mislead it. Optional, as in
  // the other compliance plugins: a composition without the skill registry
  // still gets the tools.
  if (config.registerSkill) {
    const skills = ctx.get('skills')
    if (skills === undefined) {
      ctx.logger.warn('alma-mcp: no skill registry in this composition; the alma-hcm skill is not available')
    } else {
      const skill = almaSkill(config.serverName)
      ctx.effect(() => skills.register(skill), 'alma-mcp: alma-hcm skill')
    }
  }

  // Mounted at boot: a backend is started by its user's first request through
  // the gate, so a live session — and with it a token — exists by construction.
  try {
    await connection.ensure()
  } catch (error) {
    if (config.failOnStartupError) throw error
    ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
    ctx.logger.warn('alma-mcp: starting without ALMA tools; %s reports the reason', config.routes.status)
  }
}
