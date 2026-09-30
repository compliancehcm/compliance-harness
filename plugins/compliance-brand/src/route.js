/**
 * The asset route: fonts and SVGs the Web client stylesheet references.
 *
 * Served by the harness itself rather than inlined into index.html, so the
 * 48 KB Inter and the 127 KB Oracle Sans are fetched once and cached, instead of
 * riding every boot document. Every URL the stylesheet emits carries
 * `?v=<content hash>`, which is what makes `immutable` safe: a new file is a new
 * URL.
 *
 *   GET <ASSET_ROUTE>/<name>   one of the names in the design system's asset table
 *
 * @module
 */

/**
 * Build the asset route handler.
 * @param designSystem - the loaded design system.
 * @param routePath - the route prefix.
 * @returns a node http handler.
 */
export function assetHandler(designSystem, routePath) {
  return function handle(req, res) {
    const headers = { 'x-content-type-options': 'nosniff' }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, allow: 'GET, HEAD', 'content-type': 'text/plain; charset=utf-8' })
      res.end('method not allowed')
      return
    }
    const { pathname } = new URL(req.url ?? '/', 'http://localhost')
    const name = pathname.startsWith(`${routePath}/`) ? pathname.slice(routePath.length + 1) : ''
    const asset = designSystem.assets.get(name)
    if (asset === undefined) {
      res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      res.end(req.method === 'HEAD' ? undefined : 'not found')
      return
    }
    res.writeHead(200, {
      ...headers,
      'content-type': asset.type,
      'content-length': String(asset.body.byteLength),
      'cache-control': 'public, max-age=31536000, immutable',
      // Fonts are always fetched in CORS mode; same-origin today, but a font
      // requested from a sandboxed (opaque-origin) frame would otherwise fail.
      'access-control-allow-origin': '*',
      etag: `"${asset.version}"`,
    })
    res.end(req.method === 'HEAD' ? undefined : asset.body)
  }
}
