/**
 * The authenticating loopback relay.
 *
 * `@deepseek-ai/dsh-mcp-client` accepts only STATIC headers, resolved once when
 * its row activates, while an ALMA access token lives about an hour. Rather than
 * remount the client on every refresh — which would unregister and re-register
 * every tool, and still could not react to a 401 — the client is pointed at this
 * route on the harness's own loopback port. The header it holds is static (the
 * relay nonce); the token varies inside here, per request.
 *
 * The route is registered on the existing `ctx.webServer`, so this adds no
 * listener and no port. Under this deployment the gateway proxies the public
 * origin to the signed-in user's own backend, which means the path is reachable
 * by that user's browser too — hence the nonce: a request without it is refused
 * rather than served as that user.
 *
 * @module
 */

import { Readable } from 'node:stream'

/** Header carrying the per-process relay nonce. */
export const RELAY_HEADER = 'x-alma-relay'

/** Largest MCP request body forwarded; a JSON-RPC frame is orders of magnitude smaller. */
const MAX_BODY_BYTES = 4 * 1024 * 1024

/** Request headers forwarded verbatim; everything else is this hop's own business. */
const FORWARDED_REQUEST_HEADERS = [
  'content-type',
  'accept',
  'mcp-session-id',
  'mcp-protocol-version',
  'last-event-id',
]

/** Response headers forwarded back; the Streamable HTTP transport reads all three. */
const FORWARDED_RESPONSE_HEADERS = ['content-type', 'mcp-session-id', 'cache-control']

/**
 * Read a request body into memory, refusing one that is implausibly large.
 * @param req - the incoming request.
 * @returns the body bytes, or undefined when the method carries none.
 */
async function readBody(req) {
  if (req.method === 'GET' || req.method === 'HEAD' || req.method === 'DELETE') return undefined
  const chunks = []
  let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > MAX_BODY_BYTES) throw new Error('alma-mcp: MCP request body is too large to relay')
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * Answer with a JSON error of this hop's own making.
 * @param res - the response to end.
 * @param status - HTTP status.
 * @param message - the reason, safe to show in a log.
 */
function fail(res, status, message) {
  const payload = JSON.stringify({ error: message })
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/**
 * Create the relay handler.
 * @param ctx - plugin context, for its logger.
 * @param config - the validated row configuration.
 * @param authorizer - the token owner.
 * @param nonce - the per-process value a caller must present.
 * @returns the route handler.
 */
export function createRelay(ctx, config, authorizer, nonce) {
  /**
   * Forward one request upstream with the given bearer token.
   * @param req - the incoming request.
   * @param body - the already-read request body, if any.
   * @param token - the access token to send.
   * @param signal - abort signal tied to the client hanging up.
   * @returns the upstream response.
   */
  async function forward(req, body, token, signal) {
    const headers = { authorization: `Bearer ${token}` }
    for (const name of FORWARDED_REQUEST_HEADERS) {
      const value = req.headers[name]
      if (typeof value === 'string') headers[name] = value
    }
    return fetch(config.mcpUrl, {
      method: req.method,
      headers,
      ...body !== undefined && body.length > 0 ? { body } : {},
      signal,
    })
  }

  return async function handle(req, res) {
    if (req.headers[RELAY_HEADER] !== nonce) {
      // Not the mounted MCP client. Nothing else has business speaking MCP as
      // this user, so this is refused rather than authorized.
      fail(res, 403, 'this endpoint is reserved for the workspace\'s own ALMA connection')
      return
    }

    let body
    try {
      body = await readBody(req)
    } catch (error) {
      fail(res, 413, error instanceof Error ? error.message : String(error))
      return
    }

    let token = await authorizer.bearer()
    if (token === undefined) {
      fail(res, 401, `ALMA is not connected for this workspace; open ${config.routes.connect} to sign in`)
      return
    }

    const controller = new AbortController()
    const onClose = () => { controller.abort() }
    req.on('close', onClose)

    try {
      let upstream = await forward(req, body, token, controller.signal)
      if (upstream.status === 401) {
        // The token was refused although it looked fresh — a rotation on their
        // side, or a clock we cannot see. One forced refresh, one retry; a
        // second 401 is a real refusal and travels back as itself.
        await upstream.body?.cancel()
        token = await authorizer.bearer({ force: true })
        if (token === undefined) {
          fail(res, 401, `ALMA refused this workspace's authorization; open ${config.routes.connect} to sign in again`)
          return
        }
        upstream = await forward(req, body, token, controller.signal)
      }

      const headers = {}
      for (const name of FORWARDED_RESPONSE_HEADERS) {
        const value = upstream.headers.get(name)
        if (value !== null) headers[name] = value
      }
      res.writeHead(upstream.status, headers)
      if (upstream.body === null) {
        res.end()
        return
      }
      // Piped rather than buffered: a Streamable HTTP response may be an SSE
      // stream that stays open for the life of the MCP session.
      await new Promise((resolve, reject) => {
        const stream = Readable.fromWeb(upstream.body)
        stream.on('error', reject)
        res.on('close', resolve)
        stream.pipe(res).on('finish', resolve)
      })
    } catch (error) {
      if (controller.signal.aborted) return
      ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      if (!res.headersSent) fail(res, 502, 'the ALMA MCP endpoint could not be reached')
      else res.destroy()
    } finally {
      req.off('close', onClose)
    }
  }
}
