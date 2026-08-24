/**
 * The mounted MCP client: one `@deepseek-ai/dsh-mcp-client` instance pointed at
 * the relay.
 *
 * The row is mounted programmatically rather than inserted by the overlay
 * because it must appear only once a grant exists. Inserted unconditionally, it
 * would connect at boot, be refused, exhaust its reconnect budget within a
 * minute, and then never come back for the user who signs into ALMA ten minutes
 * later.
 *
 * `plugins/` is not a workspace member and has no `node_modules`, so the package
 * cannot be imported by specifier from here. It is resolved from a directory the
 * row names — `apps/cli`, which declares it as a real dependency — which is also
 * what keeps this plugin from pinning a second copy of the harness's own
 * version.
 *
 * @module
 */

import { createRequire } from 'node:module'
import { resolve as resolvePath } from 'node:path'
import { pathToFileURL } from 'node:url'
import { RELAY_HEADER } from './relay.js'

/** Package holding the MCP bridge this plugin mounts. */
const MCP_CLIENT_PACKAGE = '@deepseek-ai/dsh-mcp-client'

/**
 * Load the mcp-client plugin module from the configured resolution root.
 *
 * The built entry is tried first, then the TypeScript source subpath, which only
 * loads under the tsx source launch — the two ways this repository runs.
 *
 * @param from - directory whose dependency resolution is used.
 * @returns the plugin module namespace.
 */
async function loadMcpClient(from) {
  const require = createRequire(pathToFileURL(resolvePath(from, 'package.json')))
  const attempts = []
  for (const specifier of [MCP_CLIENT_PACKAGE, `${MCP_CLIENT_PACKAGE}/src/index.ts`]) {
    try {
      return await import(pathToFileURL(require.resolve(specifier)).href)
    } catch (error) {
      attempts.push(`${specifier}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(
    `alma-mcp: could not load ${MCP_CLIENT_PACKAGE} from ${from}. The built entry is emitted by \`pnpm run build\`; `
    + `check resolveMcpClientFrom on the row.\n${attempts.map(line => `  - ${line}`).join('\n')}`,
  )
}

/**
 * Create the mounted connection's lifecycle.
 *
 * @param ctx - plugin context; its `webServer` port is where the relay listens.
 * @param config - the validated row configuration.
 * @param nonce - the relay nonce this client presents.
 * @returns `{ ensure, release, mounted }`.
 */
export function createConnection(ctx, config, nonce) {
  let loaded
  let fiber

  /**
   * Mount the client if it is not mounted already; idempotent.
   * @returns nothing; resolves once discovery has settled.
   */
  async function ensure() {
    if (fiber !== undefined) return
    loaded ??= loadMcpClient(config.resolveMcpClientFrom)
    const plugin = await loaded
    const relayUrl = `http://127.0.0.1:${String(ctx.webServer.port)}${config.routes.relay}`
    // Marked before the await so two concurrent callers — a callback landing
    // while boot is still mounting — cannot mount two instances and collide on
    // the serverName reservation.
    const pending = ctx.plugin(plugin, {
      serverName: config.serverName,
      transport: 'streamable-http',
      url: relayUrl,
      headers: { [RELAY_HEADER]: nonce },
      failOnStartupError: false,
    })
    fiber = pending
    await pending
    ctx.logger.info('alma-mcp: ALMA tools mounted as mcp__%s__*', config.serverName)
  }

  /**
   * Unmount the client, taking its tools with it; idempotent.
   * @returns nothing.
   */
  async function release() {
    const current = fiber
    if (current === undefined) return
    fiber = undefined
    await current.dispose()
  }

  /**
   * Whether the client is mounted right now.
   * @returns true while a fiber is live.
   */
  function mounted() {
    return fiber !== undefined
  }

  return { ensure, release, mounted }
}
