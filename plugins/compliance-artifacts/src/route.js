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
 *   GET  &lt;routePath&gt;/index                               every manifest, as JSON
 *   POST &lt;routePath&gt;/archive                             archive one, or restore it
 *
 * The index cannot collide with a document address even though a session could
 * legally be named `index`: a document address is exactly three segments and
 * the index is one.
 *
 * @module
 */
import { listAllArtifacts, readMeta, readVersion, setArchived } from './store.js'

/** Address of the gallery's index, under the configured prefix. */
export const INDEX_SEGMENT = 'index'

/** Address of the archive action, under the configured prefix. */
export const ARCHIVE_SEGMENT = 'archive'

/** Cap on the archive request body; it carries two ids and a boolean. */
const MAX_ARCHIVE_BODY_BYTES = 4096

/**
 * Whether a state-changing request came from the page this harness serves.
 *
 * The document route is a plain `webServer` route, so it sits outside the
 * `/api` transport's Host/Origin fence and has to carry its own. Two checks,
 * and both matter: a cross-site form POST always sends `Origin`, and requiring
 * a JSON content type means anything else needs a preflight the browser will
 * not get past.
 *
 * @param req - the request.
 * @returns undefined when it may proceed, or the refusal reason.
 */
function crossSiteRefusal(req) {
  const type = req.headers['content-type']
  if (typeof type !== 'string' || !type.toLowerCase().startsWith('application/json')) {
    return 'expected content-type: application/json'
  }
  const origin = req.headers['origin']
  if (origin === undefined) return undefined
  let originHost
  try {
    originHost = new URL(origin).host
  } catch {
    return 'malformed origin'
  }
  return originHost === req.headers['host'] ? undefined : 'cross-site request refused'
}

/**
 * Read a bounded JSON request body.
 * @param req - the request.
 * @returns the parsed value, or undefined when it is too large or not JSON.
 */
async function readJsonBody(req) {
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_ARCHIVE_BODY_BYTES) return undefined
    chunks.push(chunk)
  }
  try {
    const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined
  } catch {
    return undefined
  }
}

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

    const pathname = new URL(req.url, 'http://artifact.invalid').pathname
    const archivePath = `${config.routePath}/${ARCHIVE_SEGMENT}`

    if (pathname === archivePath) {
      if (req.method !== 'POST') {
        res.writeHead(405, { ...headers, allow: 'POST' })
        res.end()
        return
      }
      const refusal = crossSiteRefusal(req)
      if (refusal !== undefined) {
        res.writeHead(403, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
        res.end(refusal)
        return
      }
      const body = await readJsonBody(req)
      if (body === undefined || typeof body.sessionId !== 'string' || typeof body.artifactId !== 'string'
        || typeof body.archived !== 'boolean') {
        res.writeHead(400, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
        res.end('expected { sessionId, artifactId, archived }')
        return
      }
      let meta
      try {
        meta = await setArchived(config, body.sessionId, body.artifactId, body.archived)
      } catch {
        // An illegal id arrives here as a store error, and is a 404 for the
        // same reason a document request is: the distinction would tell a
        // prober which ids are well-formed.
        meta = undefined
      }
      if (meta === undefined) {
        res.writeHead(404, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
        res.end('not found')
        return
      }
      const payload = Buffer.from(`${JSON.stringify({
        sessionId: meta.sessionId,
        artifactId: meta.artifactId,
        archivedAt: meta.archivedAt ?? null,
      })}\n`, 'utf8')
      res.writeHead(200, {
        ...headers,
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(payload.byteLength),
        'cache-control': 'private, no-store',
      })
      res.end(payload)
      return
    }

    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { ...headers, allow: 'GET, HEAD' })
      res.end()
      return
    }

    if (pathname === `${config.routePath}/${INDEX_SEGMENT}`) {
      let body
      try {
        // The manifests only. The pages themselves are what the gallery's
        // frames fetch, one per visible card, so the index stays small however
        // many artifacts a person has accumulated.
        body = Buffer.from(`${JSON.stringify({ artifacts: await listAllArtifacts(config) })}\n`, 'utf8')
      } catch {
        res.writeHead(500, { ...headers, 'content-type': 'text/plain; charset=utf-8' })
        res.end(req.method === 'HEAD' ? undefined : 'artifact index unavailable')
        return
      }
      res.writeHead(200, {
        ...headers,
        'content-type': 'application/json; charset=utf-8',
        'content-length': String(body.byteLength),
        // The list changes whenever a tool call lands; a held copy would show
        // the person a gallery missing what they just made.
        'cache-control': 'private, no-store',
      })
      res.end(req.method === 'HEAD' ? undefined : body)
      return
    }

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
