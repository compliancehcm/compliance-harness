/**
 * The four browser-facing routes and their server-rendered pages.
 *
 * These are HTTP routes rather than RPC methods on purpose: the SSO gate judges
 * every request, and its policy admits any authenticated user on a path that is
 * not an API method while fencing the RPC plane to administrators. A route
 * therefore reaches an ordinary user's browser without widening that fence, and
 * the pages render before — and independently of — the application bundle.
 *
 * @module
 */

/**
 * Escape text for HTML text content and quoted attribute values.
 * @param value - untrusted text.
 * @returns the escaped text.
 */
function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Shared chrome: theme-aware tokens, centred card, no external asset — the same
 * shape the SSO gate's own pages use, so the two do not look like two products.
 * @param title - document title.
 * @param body - inner HTML of the card.
 * @returns the whole document.
 */
function page(title, body) {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)}</title>
<style>
  :root { color-scheme: light dark; --bg: #f7f7f8; --fg: #18181b; --muted: #6b7280; --card: #ffffff; --line: #e4e4e7; --accent: #2563eb; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #111113; --fg: #f4f4f5; --muted: #a1a1aa; --card: #1c1c1f; --line: #2e2e33; --accent: #60a5fa; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px;
         background: var(--bg); color: var(--fg);
         font: 15px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; }
  .card { width: 100%; max-width: 26rem; background: var(--card); border: 1px solid var(--line);
          border-radius: 12px; padding: 28px; }
  h1 { margin: 0 0 6px; font-size: 1.15rem; letter-spacing: -0.01em; }
  p { margin: 0 0 18px; color: var(--muted); }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: 0.87em;
         background: var(--bg); border: 1px solid var(--line); border-radius: 5px; padding: 1px 5px; }
  a.button, button.button { display: inline-block; background: var(--accent); color: #fff; text-decoration: none;
             border: 0; padding: 9px 18px; border-radius: 8px; font: inherit; font-weight: 600; cursor: pointer; }
  button.secondary { background: transparent; color: var(--fg); border: 1px solid var(--line); }
  .detail { margin: 14px 0 0; padding: 12px; background: var(--bg); border: 1px solid var(--line);
            border-radius: 8px; color: var(--fg); font-size: 0.9rem; word-break: break-word; }
  form { display: inline; }
</style>
</head>
<body><main class="card">${body}</main></body>
</html>
`
}

/**
 * The status page: what is connected, and the one action that changes it.
 * @param config - the validated row configuration, for its route paths.
 * @param status - what the authorizer reports.
 * @returns the whole document.
 */
function statusPage(config, status) {
  if (!status.connected) {
    return page('ALMA', `
  <h1>ALMA is not connected</h1>
  <p>Connect this workspace to ALMA to give the assistant your Compliance HCM tools.</p>
  <a class="button" href="${escapeHtml(config.routes.connect)}">Connect ALMA</a>
  ${status.error === undefined ? '' : `<div class="detail">${escapeHtml(status.error)}</div>`}`)
  }
  const expiry = status.expiresAt === undefined
    ? 'no stated expiry'
    : `access renews around ${new Date(status.expiresAt).toISOString().replace('T', ' ').slice(0, 16)} UTC`
  return page('ALMA', `
  <h1>ALMA is connected</h1>
  <p>The assistant can use your Compliance HCM tools in this workspace.</p>
  <div class="detail">${escapeHtml(expiry)}${status.scope === undefined ? '' : `<br>scope: ${escapeHtml(status.scope)}`}</div>
  <p class="detail">Tools appear as <code>mcp__${escapeHtml(config.serverName)}__*</code>.</p>
  <form method="post" action="${escapeHtml(config.routes.disconnect)}">
    <button class="button secondary" type="submit">Disconnect</button>
  </form>`)
}

/**
 * The page shown when a login could not be completed.
 * @param config - the validated row configuration, for its route paths.
 * @param detail - what went wrong, in the server's own words.
 * @returns the whole document.
 */
function errorPage(config, detail) {
  return page('ALMA', `
  <h1>Could not connect to ALMA</h1>
  <p>The authorization did not complete.</p>
  <div class="detail">${escapeHtml(detail)}</div>
  <p><a class="button" href="${escapeHtml(config.routes.connect)}">Try again</a></p>`)
}

/**
 * Send one HTML document.
 * @param res - the response to end.
 * @param status - HTTP status.
 * @param html - the document.
 */
function sendHtml(res, status, html) {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(html),
  })
  res.end(html)
}

/**
 * Send one JSON document.
 * @param res - the response to end.
 * @param status - HTTP status.
 * @param value - the body, serialized here.
 */
function sendJson(res, status, value) {
  const payload = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(payload),
  })
  res.end(payload)
}

/**
 * Keep a post-login destination that cannot bounce the human off-site.
 *
 * An attacker-supplied `returnTo` is the classic open redirect in a login flow,
 * so only a same-site absolute path survives — the same rule the SSO gate
 * applies to its own (`plugins/sso-auth/src/gate.ts`).
 *
 * @param candidate - the requested destination, or null.
 * @returns a safe same-origin path.
 */
function safeReturnTo(candidate) {
  if (candidate === null || !candidate.startsWith('/') || candidate.startsWith('//')) return '/'
  return candidate
}

/**
 * Whether this caller asked for JSON — the client half does, a browser does not.
 * @param req - the incoming request.
 * @returns true when JSON is the better answer.
 */
function wantsJson(req) {
  const accept = req.headers['accept']
  return typeof accept === 'string' && accept.includes('application/json')
}

/**
 * Build the browser-facing route table.
 *
 * @param ctx - plugin context, for its logger.
 * @param config - the validated row configuration.
 * @param authorizer - the token owner.
 * @param connection - `{ ensure, release }`: the mounted MCP client's lifecycle,
 * driven from here so the tools appear the moment a login lands and go away the
 * moment it is undone.
 * @returns route registrations for `ctx.webServer.register`.
 */
export function createRoutes(ctx, config, authorizer, connection) {
  /**
   * Start a login and send the browser to the authorization server.
   * @param req - the incoming request.
   * @param res - the response to end.
   */
  async function connect(req, res) {
    const asked = new URL(req.url ?? '/', `http://${req.headers['host'] ?? 'localhost'}`)
    try {
      const url = await authorizer.beginConnect(safeReturnTo(asked.searchParams.get('returnTo')))
      res.writeHead(302, { location: url, 'cache-control': 'no-store' })
      res.end()
    } catch (error) {
      ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      sendHtml(res, 502, errorPage(config, error instanceof Error ? error.message : String(error)))
    }
  }

  /**
   * Finish a login: store the grant, mount the tools, show the status page.
   * @param req - the incoming request.
   * @param res - the response to end.
   */
  async function callback(req, res) {
    const url = new URL(req.url ?? '/', `http://${req.headers['host'] ?? 'localhost'}`)
    const error = url.searchParams.get('error')
    if (error !== null) {
      const description = url.searchParams.get('error_description') ?? error
      sendHtml(res, 400, errorPage(config, description))
      return
    }
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    if (code === null || state === null) {
      sendHtml(res, 400, errorPage(config, 'the authorization server sent no code'))
      return
    }
    try {
      // Straight back to where the human was. A success page would be a
      // dead end: the tools are already there, and the only thing the status
      // page could add is the sentence "it worked".
      const returnTo = await authorizer.completeConnect({ code, state })
      await connection.ensure()
      res.writeHead(302, { location: returnTo, 'cache-control': 'no-store' })
      res.end()
    } catch (failure) {
      ctx.logger.warn(failure instanceof Error ? failure : new Error(String(failure)))
      sendHtml(res, 502, errorPage(config, failure instanceof Error ? failure.message : String(failure)))
    }
  }

  /**
   * Report what is connected, as a page or as JSON for the client half.
   * @param req - the incoming request.
   * @param res - the response to end.
   */
  async function status(req, res) {
    const current = await authorizer.status()
    if (wantsJson(req)) {
      sendJson(res, 200, { ...current, connectPath: config.routes.connect, disconnectPath: config.routes.disconnect })
      return
    }
    sendHtml(res, 200, statusPage(config, current))
  }

  /**
   * Forget the grant and take the tools away with it.
   * @param req - the incoming request.
   * @param res - the response to end.
   */
  async function disconnect(req, res) {
    if (req.method !== 'POST') {
      // A GET that signs the workspace out could be triggered by any embedded
      // image; the state-changing verb is the guard.
      sendJson(res, 405, { error: 'disconnect requires POST' })
      return
    }
    await authorizer.disconnect()
    await connection.release()
    ctx.logger.info('alma-mcp: disconnected from ALMA')
    if (wantsJson(req)) {
      sendJson(res, 200, { connected: false, connectPath: config.routes.connect })
      return
    }
    res.writeHead(302, { location: config.routes.status, 'cache-control': 'no-store' })
    res.end()
  }

  return [
    { kind: 'exact', path: config.routes.connect, handler: connect },
    { kind: 'exact', path: config.routes.callback, handler: callback },
    { kind: 'exact', path: config.routes.status, handler: status },
    { kind: 'exact', path: config.routes.disconnect, handler: disconnect },
  ]
}
