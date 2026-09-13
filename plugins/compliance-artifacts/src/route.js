/**
 * The route that serves an artifact document to the browser.
 *
 * A real URL rather than `srcdoc`, for one reason: only a response can carry the
 * artifact's own `Content-Security-Policy`. A `srcdoc` frame inherits the
 * embedder's policy, so the CDN allowlist would have to be granted to the whole
 * application instead of to the generated page.
 *
 * The existing path does not work here. `/api/file` already serves workspace
 * HTML, under `sandbox; default-src 'none'` — every script dead, which an e2e
 * test pins. That endpoint is deliberately not a delivery channel for an
 * interactive page.
 *
 * Addresses:
 *
 *   GET &lt;routePath&gt;/&lt;sessionId&gt;/&lt;artifactId&gt;/latest   the current version
 *   GET &lt;routePath&gt;/&lt;sessionId&gt;/&lt;artifactId&gt;/v&lt;N&gt;      one immutable version
 *
 * @module
 */
import { readMeta, readVersion } from './store.js'

/** Header set every artifact response carries, whatever its status. */
function baseHeaders(config) {
  return {
    'content-security-policy': config.csp,
    'x-content-type-options': 'nosniff',
    // The frame is sandboxed by the embedder; this is the second lock, so a
    // document opened directly in a tab is inert rather than same-origin.
    'x-frame-options': 'SAMEORIGIN',
    // Per-user content behind an authenticating proxy: never a shared cache.
    'referrer-policy': 'no-referrer',
  }
}

/**
 * Split a request pathname into its artifact coordinates.
 *
 * Returns undefined rather than throwing for anything unrecognized: a stray
 * request under the prefix is a 404, not a server error.
 * @param routePath - the configured prefix.
 * @param pathname - the request pathname.
 * @returns the coordinates, or undefined when the shape does not match.
 */
export function parseArtifactPath(routePath, pathname) {
  if (!pathname.startsWith(`${routePath}/`)) return undefined
  const rest = pathname.slice(routePath.length + 1)
  const parts = rest.split('/')
  if (parts.length !== 3) return undefined
  const [sessionId, artifactId, selector] = parts
  if (sessionId === '' || artifactId === '') return undefined
  if (selector === 'latest') return { sessionId, artifactId, version: 'latest' }
  const match = /^v([1-9][0-9]{0,4})$/.exec(selector)
  if (match === null) return undefined
  return { sessionId, artifactId, version: Number(match[1]) }
}

/**
 * Build the artifact route handler.
 * @param config - the validated plugin configuration.
 * @returns a node http handler.
 */
export function artifactHandler(config) {
  /**
   * Serve one artifact document.
   * @param req - the request.
   * @param res - the response.
   * @returns nothing; it owns the response lifecycle.
   */
  return async function handle(req, res) {
    const headers = baseHeaders(config)

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, allow: 'GET, HEAD' })
      res.end()
      return
    }

    const pathname = new URL(req.url, 'http://artifact.invalid').pathname
    const coordinates = parseArtifactPath(config.routePath, pathname)
    if (coordinates === undefined) {
      res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      res.end(req.method === 'HEAD' ? undefined : 'not found')
      return
    }

    let html
    let version
    try {
      const meta = await readMeta(config, coordinates.sessionId, coordinates.artifactId)
      if (meta === undefined) {
        res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
        res.end(req.method === 'HEAD' ? undefined : 'not found')
        return
      }
      version = coordinates.version === 'latest' ? meta.version : coordinates.version
      html = await readVersion(config, coordinates.sessionId, coordinates.artifactId, version)
    } catch {
      // An illegal id reaches here as a store error. It is a 404 and not a 400:
      // the distinction would tell a prober which ids are well-formed.
      res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      res.end(req.method === 'HEAD' ? undefined : 'not found')
      return
    }

    if (html === undefined) {
      res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
      res.end(req.method === 'HEAD' ? undefined : 'not found')
      return
    }

    const body = Buffer.from(html, 'utf8')
    res.writeHead(200, {
      ...headers,
      'content-type': 'text/html; charset=utf-8',
      'content-length': String(body.byteLength),
      // A numbered version never changes, so it caches forever; `latest` moves
      // with every update and must not be held.
      'cache-control': coordinates.version === 'latest'
        ? 'private, no-store'
        : 'private, max-age=31536000, immutable',
      'x-artifact-version': String(version),
    })
    res.end(req.method === 'HEAD' ? undefined : body)
  }
}
