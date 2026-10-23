/**
 * The one browser-facing route: `/alma/status`, for diagnosis.
 *
 * There is nothing to connect or disconnect any more — the token is the SSO
 * login's — so what remains is a read of the plugin's state. It is an HTTP
 * route rather than an RPC method because the SSO gate fences the RPC plane to
 * administrators and admits any authenticated user on a plain path.
 *
 * @module
 */

/**
 * Create the status route.
 * @param config - the validated row configuration, for its route paths.
 * @param tokens - the token source, or undefined when no broker is configured.
 * @param connection - the mounted client's lifecycle.
 * @returns the route registration.
 */
export function createStatusRoute(config, tokens, connection) {
  return {
    kind: 'exact',
    path: config.routes.status,
    handler: (req, res) => {
      const body = JSON.stringify({
        mounted: connection.mounted(),
        serverName: config.serverName,
        ...tokens === undefined
          ? { source: 'none', error: 'no SSO token broker in this environment' }
          : tokens.status(),
      })
      res.writeHead(200, {
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(Buffer.byteLength(body)),
        'cache-control': 'no-store',
      })
      res.end(body)
    },
  }
}
