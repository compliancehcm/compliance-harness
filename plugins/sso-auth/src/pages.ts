/**
 * The server-rendered pages and the injected liveness script.
 *
 * These are plain documents with inline CSS on purpose: they must render before
 * — and independently of — the application bundle, which is itself behind the
 * gate. Anything they referenced by URL would be a second gated request.
 */

/** Escape text for HTML text content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Shared chrome: theme-aware tokens, centred card, no external asset. */
function page(title: string, body: string): string {
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
  a.button { display: inline-block; background: var(--accent); color: #fff; text-decoration: none;
             padding: 9px 18px; border-radius: 8px; font-weight: 600; }
  .detail { margin: 14px 0 0; padding: 12px; background: var(--bg); border: 1px solid var(--line);
            border-radius: 8px; color: var(--fg); font-size: 0.9rem; word-break: break-word; }
</style>
</head>
<body><main class="card">${body}</main></body>
</html>
`
}

/** The page offering a sign-in, shown when no session exists. */
export function loginPage(loginHref: string): string {
  return page('Sign in', `
  <h1>Sign in required</h1>
  <p>This workspace is protected by single sign-on.</p>
  <a class="button" href="${escapeHtml(loginHref)}">Continue to sign in</a>`)
}

/** The page shown when authentication succeeded but authorization did not. */
export function deniedPage(reason: string): string {
  return page('Access denied', `
  <h1>Access denied</h1>
  <p>You signed in successfully, but your account is not permitted to use this workspace.</p>
  <div class="detail">${escapeHtml(reason)}</div>
  <p class="detail">Ask an administrator to grant the required role, then sign in again.</p>`)
}

/** The page shown when the login itself failed. */
export function errorPage(summary: string, detail?: string): string {
  return page('Sign-in failed', `
  <h1>Sign-in failed</h1>
  <p>${escapeHtml(summary)}</p>
  ${detail === undefined ? '' : `<div class="detail">${escapeHtml(detail)}</div>`}
  <p><a class="button" href="/">Try again</a></p>`)
}

/**
 * The page shown when the platform has no capacity for this user yet.
 *
 * It refreshes itself, because the condition it reports is temporary by
 * definition: a backend is reaped after a few minutes idle, so waiting is the
 * correct action rather than an error to report and stop at.
 */
export function waitingPage(message: string): string {
  return page('Starting your workspace', `
  <h1>Starting your workspace</h1>
  <p>${escapeHtml(message)}</p>
  <div class="detail">This page refreshes itself; no action is needed.</div>
  <script>setTimeout(function(){ location.reload() }, 5000)</script>`)
}

/**
 * The script appended to every forwarded HTML document.
 *
 * It exists because the application cannot tell a lost session from a lost
 * network: the client stack turns every non-2xx into an untyped
 * `transport failure … HTTP <n>` error and then reconnects forever with only a
 * console warning, so an expired session would otherwise present as a
 * permanently empty app. Polling one cheap endpoint and reloading turns that
 * into a redirect to the login page.
 *
 * @param intervalMs - poll period.
 * @returns the script tag to inject.
 */
export function livenessScript(intervalMs: number): string {
  return `<script>(function(){
  var interval = ${String(intervalMs)};
  function check(){
    fetch('/auth/status', { credentials: 'same-origin', cache: 'no-store' })
      .then(function(r){ return r.ok ? r.json() : { authenticated: false } })
      .then(function(s){ if (!s.authenticated) location.reload() })
      .catch(function(){ /* offline: the next tick decides, a reload here would fight a flaky link */ })
  }
  setInterval(check, interval)
  document.addEventListener('visibilitychange', function(){ if (!document.hidden) check() })
})()</script>`
}
