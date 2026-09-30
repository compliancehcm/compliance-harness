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

/** The marker a page puts where it wants the design system's React components. */
const COMPONENTS_MARKER = /<script\b[^>]*\btype\s*=\s*["']text\/compliance-ds["'][^>]*>\s*<\/script>/i

/**
 * Serve-time design system: put the Compliance HCM stylesheet into the page,
 * and the React components where the page asks for them.
 *
 * At serve time rather than at write time, on purpose. The stored version stays
 * exactly what the model wrote, so an `old_str` patch keeps matching; a page
 * written before a design-system upgrade picks the upgrade up; and the model
 * never spends output on a stylesheet it did not author. It is inline rather
 * than a `<link>` because the frame's origin is opaque: a same-host stylesheet
 * would need `'self'` in the CSP and a font would need CORS, while
 * `style-src 'unsafe-inline'` and `font-src data:` are already granted.
 *
 * The stylesheet goes FIRST in `<head>` and inside a cascade layer (the service
 * builds it that way), so every rule the page writes itself wins.
 * @param html - the stored document.
 * @param designSystem - the `complianceDesignSystem` service.
 * @param themeId - a theme the embedder asked for, or undefined to follow the scheme.
 * @returns the document to send.
 */
export function withDesignSystem(html, designSystem, themeId) {
  const known = themeId !== undefined && designSystem.themes.some(theme => theme.id === themeId)
  const style = `<style data-compliance-ds="${designSystem.version}">\n${designSystem.artifactStylesheet(known ? themeId : undefined)}\n</style>`
  let out
  const head = /<head\b[^>]*>/i.exec(html)
  if (head !== null) {
    const at = head.index + head[0].length
    out = html.slice(0, at) + style + html.slice(at)
  } else {
    const root = /<html\b[^>]*>/i.exec(html)
    const doctype = /^\s*<!doctype[^>]*>/i.exec(html)
    const at = root !== null ? root.index + root[0].length : doctype !== null ? doctype[0].length : 0
    out = `${html.slice(0, at)}<head>${style}</head>${html.slice(at)}`
  }
  const script = designSystem.componentsScript()
  if (script !== undefined && COMPONENTS_MARKER.test(out)) {
    // A replacer function, not a string: `$&`-style patterns in the bundle
    // must not be expanded.
    out = out.replace(COMPONENTS_MARKER, () => `<script data-compliance-ds-components>\n${script}\n</script>`)
  }
  return out
}

/**
 * Build the artifact route handler.
 * @param config - the validated plugin configuration.
 * @param designSystem - holder whose `current` is the `complianceDesignSystem`
 *   service while one is composed; read per request, since the service can
 *   arrive or leave after the route is mounted.
 * @returns a node http handler.
 */
export function artifactHandler(config, designSystem = { current: undefined }) {
  /**
   * Serve one artifact document.
   * @param req - the request.
   * @param res - the response.
   * @returns nothing; it owns the response lifecycle.
   */
  return async function handle(req, res) {
    const headers = baseHeaders(config)

    const url = new URL(req.url, 'http://artifact.invalid')
    const pathname = url.pathname
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

    const service = config.designSystem ? designSystem.current : undefined
    if (service !== undefined) {
      try {
        html = withDesignSystem(html, service, url.searchParams.get('theme') ?? undefined)
      } catch {
        // A broken design system must not take the page down with it: the
        // document still works unstyled.
      }
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
