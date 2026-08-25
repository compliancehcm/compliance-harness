/**
 * The one route this plugin serves: the vendored Apache ECharts UMD bundle.
 *
 * It is an HTTP route rather than a second client-module package because a
 * client-module row is NOT lazy in the sense that matters here — web boot calls
 * `loader.create()` for every row in the boot graph and then requires each one to
 * have activated, so a package whose bundle is a megabyte of ECharts would cost
 * that megabyte at every boot, for every session, chart or no chart. Behind a
 * route the bundle is fetched by the browser only when a conversation actually
 * contains a chart.
 *
 * A route also reaches an ordinary user: the SSO gate admits any authenticated
 * user on a path that is not an RPC method, while the RPC plane stays fenced to
 * administrators.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { gzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'

/** The vendored bundle; see vendor/README.md for its provenance. */
const BUNDLE_PATH = fileURLToPath(new URL('../vendor/echarts.min.js', import.meta.url))

/**
 * Read the bundle once and precompute everything the route answers with.
 *
 * Read at apply rather than per request: a missing vendored file is a broken
 * install, and it must fail at boot rather than as a 500 the first time a user
 * asks for a chart.
 * @returns the immutable response body in both encodings, plus its validators.
 * @throws {Error} when the vendored bundle cannot be read.
 */
export function loadBundle() {
  let raw
  try {
    raw = readFileSync(BUNDLE_PATH)
  } catch (cause) {
    throw new Error(`echarts-charts: cannot read the vendored bundle at ${BUNDLE_PATH}`, { cause })
  }
  // Strong ETag over the exact bytes: the bundle is immutable for a given
  // vendored version, so a refreshed vendor file invalidates every cache by
  // content rather than by a version string this module would have to know.
  const etag = `"${createHash('sha256').update(raw).digest('base64url').slice(0, 27)}"`
  return { raw, gzip: gzipSync(raw, { level: 9 }), etag }
}

/** One year: the ETag is content-derived, so a stale cache cannot serve the wrong bytes. */
const MAX_AGE_SECONDS = 31_536_000

/**
 * Build the route handler for a loaded bundle.
 * @param bundle - the result of {@link loadBundle}.
 * @returns the handler, answering GET and HEAD and 304 on a matching validator.
 */
export function assetHandler(bundle) {
  return (req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405, { allow: 'GET, HEAD' })
      res.end()
      return
    }
    const headers = {
      'content-type': 'text/javascript; charset=utf-8',
      'cache-control': `public, max-age=${String(MAX_AGE_SECONDS)}, immutable`,
      etag: bundle.etag,
      vary: 'accept-encoding',
      // The bundle is a script served from the same origin as the app; nothing
      // about it should be sniffed into another type.
      'x-content-type-options': 'nosniff',
    }
    if (req.headers['if-none-match'] === bundle.etag) {
      res.writeHead(304, headers)
      res.end()
      return
    }
    const accepts = String(req.headers['accept-encoding'] ?? '')
    const gzipped = /\bgzip\b/.test(accepts)
    const body = gzipped ? bundle.gzip : bundle.raw
    if (gzipped) headers['content-encoding'] = 'gzip'
    headers['content-length'] = String(body.byteLength)
    res.writeHead(200, headers)
    if (req.method === 'HEAD') {
      res.end()
      return
    }
    res.end(body)
  }
}
