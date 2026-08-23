/**
 * The authenticating reverse proxy.
 *
 * It binds the public port and forwards to the harness webserver on loopback.
 * Everything the browser can reach crosses this listener — the app shell, `/api`,
 * `/plugins/**` bundles, the SSE stream and both WebSocket downlinks — which is
 * the whole reason the gate lives in front of the webserver rather than inside
 * it: `ctx.webServer` exposes no interception seam (see the README).
 *
 * The authorization decision arrives by injection rather than being made here,
 * so the forwarding behaviour can be exercised against a stub before any
 * identity provider exists, and so a proxy bug stays distinguishable from an
 * OIDC bug.
 */

import { createServer, request as httpRequest } from 'node:http'
import type { IncomingHttpHeaders, IncomingMessage, Server, ServerResponse } from 'node:http'
import { connect } from 'node:net'
import type { Duplex } from 'node:stream'
import { checkEdge, header } from './edge.ts'
import type { EdgeRequest } from './edge.ts'

/** What the gate decided about one request. */
export type Authorization =
  /** Forward it. */
  | { readonly kind: 'allow' }
  /** No usable session: challenge the caller. */
  | { readonly kind: 'challenge'; readonly reason: string }
  /** Authenticated but not permitted; a re-login would not help. */
  | { readonly kind: 'deny'; readonly reason: string }

/** The gate the proxy consults. */
export interface ProxyGate {
  /**
   * Handle a request the gate owns (its own `/auth/*` endpoints).
   * @returns whether the gate answered it; false forwards to the decision path.
   */
  handle: (req: IncomingMessage, res: ServerResponse) => Promise<boolean>
  /**
   * Whether this request cannot be judged without its body.
   *
   * Buffering is opt-in per request because it costs latency and memory, and
   * because the bodies that matter (a settings write, a session create) are
   * tiny while the ones that are not (image attachments, prompts) are not.
   * Returning false keeps the request streaming end to end.
   */
  needsBody?: (req: IncomingMessage) => boolean
  /** Decide one forwarded request; `body` arrives only when `needsBody` asked. */
  authorize: (req: IncomingMessage, body?: Buffer) => Promise<Authorization>
  /** Render the page shown to an unauthenticated document request. */
  challengePage: (returnTo: string) => { readonly location: string }
  /** Render the page shown to a denied caller. */
  denyPage: (reason: string) => string
  /**
   * Script injected before `</body>` of every forwarded HTML document, or
   * undefined to forward HTML untouched.
   */
  readonly htmlEpilogue?: string
}

/** Everything the proxy needs to run. */
export interface ProxyOptions {
  /** Public listen address. */
  readonly listen: { readonly host: string; readonly port: number }
  /** The authority browsers were told to use, for the cross-site check. */
  readonly publicAuthority: string
  /** Where the harness webserver listens. */
  readonly target: { readonly host: string; readonly port: number }
  readonly gate: ProxyGate
  readonly logger: Pick<Console, 'warn'>
  /** Cap on a buffered body; a larger one is refused rather than judged blind. */
  readonly maxInspectedBodyBytes: number
}

/** A running proxy. */
export interface RunningProxy {
  /** The bound port, resolved even when 0 was requested. */
  readonly port: number
  close: () => Promise<void>
}

/** Hop-by-hop headers that must not be forwarded (RFC 9110 §7.6.1). */
const HOP_BY_HOP: ReadonlySet<string> = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade',
])

/** Answer a request with a plain-text status. */
function respondText(res: ServerResponse, status: number, body: string): void {
  res.writeHead(status, {
    'content-type': 'text/plain; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    // A challenge must never be cached, or a stale 401 outlives the login.
    'cache-control': 'no-store',
  })
  res.end(body)
}

/** Answer a request with an HTML document. */
export function respondHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': String(Buffer.byteLength(html)),
    'cache-control': 'no-store',
  })
  res.end(html)
}

/**
 * Whether this request is a browser asking for a page, as opposed to a fetch.
 *
 * The distinction decides the shape of the refusal: a navigation is redirected
 * so the user lands on the login page, while a programmatic call gets 401 —
 * redirecting the latter would hand the SPA a login document where it expects
 * JSON, which surfaces as a parse error rather than as "you are logged out".
 */
function isDocumentRequest(req: IncomingMessage, edge: EdgeRequest): boolean {
  if (req.method !== 'GET' && req.method !== 'HEAD') return false
  const mode = header(edge, 'sec-fetch-mode')
  if (mode !== undefined) return mode === 'navigate'
  return (header(edge, 'accept') ?? '').includes('text/html')
}

/** Copy inbound headers for forwarding, normalizing provenance. */
function forwardHeaders(headers: IncomingHttpHeaders, targetAuthority: string): IncomingHttpHeaders {
  const out: IncomingHttpHeaders = {}
  for (const [name, value] of Object.entries(headers)) {
    if (HOP_BY_HOP.has(name) || value === undefined) continue
    out[name] = value
  }
  // The downstream trust fence requires Host to be loopback and any Origin to
  // equal it. The public-edge check above has already made the cross-site
  // decision, so both are normalized to the internal authority here.
  out['host'] = targetAuthority
  delete out['origin']
  return out
}

/** Inject the epilogue before the final `</body>`, or append when absent. */
export function injectEpilogue(html: string, epilogue: string): string {
  const index = html.lastIndexOf('</body>')
  if (index === -1) return html + epilogue
  return html.slice(0, index) + epilogue + html.slice(index)
}

/** Whether a forwarded response is an HTML document this proxy may rewrite. */
function isRewritableHtml(headers: IncomingHttpHeaders): boolean {
  const type = headers['content-type']
  if (typeof type !== 'string' || !type.includes('text/html')) return false
  // A compressed body would have to be decoded to be rewritten; leaving it
  // alone costs only the liveness poller on that response, while decoding
  // wrongly would corrupt the page.
  return headers['content-encoding'] === undefined
}

/**
 * Start the proxy.
 * @param options - listen address, target, gate, and logger.
 * @returns the running proxy, with its resolved port.
 */
export async function startProxy(options: ProxyOptions): Promise<RunningProxy> {
  const { gate, logger, publicAuthority, target } = options
  const targetAuthority = `${target.host}:${String(target.port)}`

  // Every socket this proxy takes ownership of during an upgrade. Node stops
  // tracking a socket once 'upgrade' is emitted, so `closeAllConnections()`
  // does not reach it and `close()` never completes while one is open —
  // verified against node 24, where an outstanding upgraded socket alone keeps
  // the close callback from firing. Unloading the plugin would hang, so the
  // pairs are tracked here and destroyed explicitly.
  const hijacked = new Set<Duplex>()
  const own = (socket: Duplex): void => {
    hijacked.add(socket)
    socket.once('close', () => hijacked.delete(socket))
  }

  /**
   * Read a whole request body, refusing past the cap.
   *
   * The cap matters: without it, a caller could make the gate hold an arbitrary
   * amount of memory just by claiming to write a setting. Refusing is the only
   * safe answer, because judging a truncated body would be judging the wrong
   * request.
   */
  const readBody = (req: IncomingMessage, limit: number): Promise<Buffer | 'too-large'> =>
    new Promise((resolve, reject) => {
      const chunks: Buffer[] = []
      let size = 0
      req.on('data', (chunk: Buffer) => {
        size += chunk.length
        if (size > limit) {
          req.destroy()
          resolve('too-large')
          return
        }
        chunks.push(chunk)
      })
      req.on('end', () => resolve(Buffer.concat(chunks)))
      req.on('error', reject)
    })

  const forward = (req: IncomingMessage, res: ServerResponse, body?: Buffer): void => {
    const headers = forwardHeaders(req.headers, targetAuthority)
    // A buffered body has already left the socket, so its length is now known
    // exactly — restate it rather than forwarding a stale or chunked header.
    if (body !== undefined) {
      delete headers['content-length']
      headers['content-length'] = String(body.length)
    }
    const upstream = httpRequest({
      host: target.host,
      port: target.port,
      method: req.method,
      path: req.url,
      headers,
    }, (upstreamRes) => {
      const status = upstreamRes.statusCode ?? 502
      const epilogue = gate.htmlEpilogue
      if (epilogue === undefined || !isRewritableHtml(upstreamRes.headers)) {
        // Streaming path: everything that is not a rewritable document, which
        // is what keeps SSE and bundle responses unbuffered.
        const headers = { ...upstreamRes.headers }
        delete headers['connection']
        res.writeHead(status, headers)
        upstreamRes.pipe(res)
        return
      }
      const chunks: Buffer[] = []
      upstreamRes.on('data', (chunk: Buffer) => chunks.push(chunk))
      upstreamRes.on('end', () => {
        const body = injectEpilogue(Buffer.concat(chunks).toString('utf8'), epilogue)
        const headers = { ...upstreamRes.headers }
        delete headers['connection']
        delete headers['content-length']
        res.writeHead(status, { ...headers, 'content-length': String(Buffer.byteLength(body)) })
        res.end(body)
      })
      upstreamRes.on('error', (error) => {
        logger.warn(`sso-auth: upstream response failed: ${String(error)}`)
        res.destroy()
      })
    })
    upstream.on('error', (error) => {
      logger.warn(`sso-auth: upstream request failed: ${String(error)}`)
      if (!res.headersSent) respondText(res, 502, 'upstream unavailable')
      else res.destroy()
    })
    if (body === undefined) req.pipe(upstream)
    else upstream.end(body)
  }

  const server = createServer((req, res) => {
    void (async () => {
      const edge: EdgeRequest = { method: req.method, url: req.url, headers: req.headers }
      const refusal = checkEdge(edge, publicAuthority)
      if (refusal !== undefined) {
        logger.warn(`sso-auth: refused at edge (${refusal.kind}): ${refusal.detail}`)
        respondText(res, 403, 'forbidden')
        return
      }
      if (await gate.handle(req, res)) return

      let body: Buffer | undefined
      if (gate.needsBody?.(req) === true) {
        const read = await readBody(req, options.maxInspectedBodyBytes)
        if (read === 'too-large') {
          respondText(res, 413, 'request body too large to authorize')
          return
        }
        body = read
      }

      const decision = await gate.authorize(req, body)
      if (decision.kind === 'allow') {
        forward(req, res, body)
        return
      }
      if (decision.kind === 'deny') {
        // A denied navigation gets the explanatory page; a denied XHR gets plain
        // text, because handing the SPA an HTML document where it expects JSON
        // surfaces as a parse error instead of as a refusal.
        if (isDocumentRequest(req, edge)) respondHtml(res, 403, gate.denyPage(decision.reason))
        else respondText(res, 403, decision.reason)
        return
      }
      if (isDocumentRequest(req, edge)) {
        const { location } = gate.challengePage(req.url ?? '/')
        res.writeHead(302, { location, 'cache-control': 'no-store' })
        res.end()
        return
      }
      respondText(res, 401, 'authentication required')
    })().catch((error: unknown) => {
      logger.warn(`sso-auth: request handling failed: ${String(error)}`)
      if (!res.headersSent) respondText(res, 500, 'internal error')
      else res.destroy()
    })
  })

  server.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    void (async () => {
      const edge: EdgeRequest = { method: req.method, url: req.url, headers: req.headers }
      if (checkEdge(edge, publicAuthority) !== undefined) { socket.destroy(); return }
      const decision = await gate.authorize(req)
      if (decision.kind !== 'allow') {
        // A rejected upgrade gets a status line rather than a silent close, so
        // the browser's console names the cause instead of "connection failed".
        socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n')
        return
      }
      const headers = forwardHeaders(req.headers, targetAuthority)
      own(socket)
      const upstream = connect(target.port, target.host, () => {
        const lines = [`${req.method ?? 'GET'} ${req.url ?? '/'} HTTP/1.1`]
        for (const [name, value] of Object.entries(headers)) {
          for (const entry of Array.isArray(value) ? value : [value]) {
            if (entry !== undefined) lines.push(`${name}: ${String(entry)}`)
          }
        }
        // The upgrade headers are hop-by-hop, so forwardHeaders dropped them;
        // an upgrade without them is just a GET, so they are restated here.
        lines.push('Connection: Upgrade')
        const upgrade = header(edge, 'upgrade')
        if (upgrade !== undefined) lines.push(`Upgrade: ${upgrade}`)
        upstream.write(`${lines.join('\r\n')}\r\n\r\n`)
        if (head.length > 0) upstream.write(head)
        own(upstream)
        upstream.pipe(socket)
        socket.pipe(upstream)
      })
      const drop = (error: unknown): void => {
        logger.warn(`sso-auth: upgrade proxy failed: ${String(error)}`)
        socket.destroy()
        upstream.destroy()
      }
      upstream.on('error', drop)
      socket.on('error', drop)
    })().catch((error: unknown) => {
      logger.warn(`sso-auth: upgrade handling failed: ${String(error)}`)
      socket.destroy()
    })
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(options.listen.port, options.listen.host, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : options.listen.port

  return {
    port,
    close: () => closeServer(server, hijacked),
  }
}

/**
 * Close a listener and every connection it holds, tracked or hijacked.
 *
 * `close()` alone waits for in-flight responses to end, and a proxied SSE
 * response never ends on its own — the same reason the harness webserver pairs
 * `close()` with `closeAllConnections()`. Upgraded sockets need the third step:
 * they are no longer server-tracked, so nothing but an explicit destroy reaches
 * them.
 */
function closeServer(server: Server, hijacked: Set<Duplex>): Promise<void> {
  return new Promise<void>((resolve) => {
    server.close(() => resolve())
    for (const socket of hijacked) socket.destroy()
    hijacked.clear()
    server.closeAllConnections()
  })
}
