/**
 * The server-rendered pages and the injected liveness script.
 *
 * These are plain documents with inline CSS on purpose: they must render before
 * — and independently of — the application bundle, which is itself behind the
 * gate. Anything they referenced by URL would be a second gated request.
 */
import { readFileSync } from 'node:fs'

/** Escape text for HTML text content and quoted attribute values. */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * The two assets the pages carry, inlined as data URIs so the pages stay
 * self-contained (see the module note): the Inter face of the Compliance HCM
 * design system, and the white Compliance Soluções wordmark for the brand panel.
 * Read once, at import. Copies of `plugins/compliance-brand` files, because this
 * plugin runs in the gateway process, where the brand plugin is not composed.
 */
const INTER_WOFF2 = readFileSync(new URL('../assets/inter-latin-wght-normal.woff2', import.meta.url)).toString('base64')
const LOGO_PNG = readFileSync(new URL('../assets/logo-compliance-branco.png', import.meta.url)).toString('base64')

/**
 * Shared chrome: the Compliance HCM design system's login layout — the navy
 * brand panel on the left, the content column on the right — with its tokens
 * (the default palette, and "escuro" under `prefers-color-scheme: dark`).
 * Values are the design system's own (`tokens/colors.css`, `themes.css`); the
 * panel folds away below 760px.
 */
function page(title: string, body: string): string {
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(title)} · Compliance AI</title>
<style>
  @font-face { font-family: 'Inter'; font-style: normal; font-display: swap; font-weight: 100 900;
               src: url(data:font/woff2;base64,${INTER_WOFF2}) format('woff2'); }
  :root { color-scheme: light dark;
          --background: #f4f6fb; --foreground: #101a33; --card: #ffffff; --border: #e0e5f0; --muted: #eef1f8;
          --muted-foreground: #5b6784; --secondary-foreground: #3c4a6b; --heading: #2b4587;
          --primary: #2b4587; --primary-hover: #3a56a0; --primary-foreground: #ffffff; --primary-muted-foreground: #9db0e0;
          --panel: #2b4587; --panel-border: rgba(255,255,255,.12); --panel-muted: #8fa3d9;
          --accent: #f5a623; --accent-strong: #b45309;
          --danger-soft-bg: #fff1f3; --danger-soft-border: #fecdd3; --danger-soft-fg: #be123c;
          --font: 'Inter', 'Segoe UI', system-ui, sans-serif; }
  @media (prefers-color-scheme: dark) {
    :root { --background: #0a1226; --foreground: #eef1f8; --card: #131e3b; --border: #22305a; --muted: #1a2647;
            --muted-foreground: #98a5c6; --secondary-foreground: #c7d2ef; --heading: #aebbe3;
            --primary: #7d95d8; --primary-hover: #9db0e0; --primary-foreground: #0a1226;
            --panel: #101a33; --accent-strong: #f5a623;
            --danger-soft-bg: #2d1119; --danger-soft-border: #5c2130; --danger-soft-fg: #fda4af; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; min-height: 100vh; display: flex; background: var(--background); color: var(--foreground);
         font: 15px/1.5 var(--font); -webkit-font-smoothing: antialiased; }
  .brand { flex: 0 0 46%; background: var(--panel); color: #ffffff; display: flex; flex-direction: column;
           justify-content: space-between; padding: 56px clamp(28px, 4vw, 64px) 44px; }
  .brand img { width: 238px; max-width: 100%; height: auto; display: block; }
  .brand .product { margin-top: 14px; font-size: 14px; font-weight: 500; color: var(--primary-muted-foreground); }
  .brand .rule { width: 64px; height: 4px; border-radius: 999px; background: var(--accent); margin-top: 28px; }
  .brand footer { font-size: 13px; color: var(--panel-muted); }
  main { flex: 1; min-width: 0; display: flex; align-items: center; justify-content: center; padding: 48px 40px; }
  .content { width: 100%; max-width: 460px; }
  .eyebrow { font-size: 13px; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; color: var(--accent-strong); }
  h1 { margin: 12px 0 0; font-size: 30px; line-height: 1.2; font-weight: 700; letter-spacing: -.02em; color: var(--heading); }
  p { margin: 10px 0 0; color: var(--muted-foreground); }
  .actions { margin-top: 28px; }
  a.button { display: flex; align-items: center; justify-content: center; gap: 8px; width: 100%;
             background: var(--primary); color: var(--primary-foreground); text-decoration: none;
             padding: 11px 18px; border-radius: 8px; font-weight: 600; font-size: 14px; }
  a.button:hover { background: var(--primary-hover); }
  a.button svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .detail { margin: 18px 0 0; padding: 10px 12px; background: var(--danger-soft-bg); border: 1px solid var(--danger-soft-border);
            border-radius: 8px; color: var(--danger-soft-fg); font-size: 13px; word-break: break-word; }
  .note { margin: 18px 0 0; padding: 10px 12px; background: var(--muted); border-radius: 8px; color: var(--secondary-foreground); font-size: 13px; }
  code { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; font-size: .87em; background: var(--muted);
         border-radius: 6px; padding: 1px 5px; }
  @media (max-width: 760px) {
    body { flex-direction: column; }
    .brand { flex: none; padding: 24px 24px 20px; }
    .brand .rule, .brand footer { display: none; }
    .brand img { width: 180px; }
    main { padding: 32px 24px; align-items: flex-start; }
  }
</style>
</head>
<body>
<aside class="brand" aria-label="Compliance Soluções">
  <header>
    <img src="data:image/png;base64,${LOGO_PNG}" alt="Compliance Soluções">
    <div class="product">Compliance AI</div>
    <div class="rule" aria-hidden="true"></div>
  </header>
  <footer>© ${String(new Date().getFullYear())} Compliance Soluções · Todos os direitos reservados</footer>
</aside>
<main><div class="content">${body}</div></main>
</body>
</html>
`
}

/** The SSO glyph the design system's Icon registry draws (`components/core/Icon.jsx`, "sso"). */
const SSO_ICON = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 18v3"/></svg>'

/** The page offering a sign-in, shown when no session exists. */
export function loginPage(loginHref: string): string {
  return page('Entrar', `
  <div class="eyebrow">Bem-vindo(a)</div>
  <h1>Acesse sua conta</h1>
  <p>Este espaço é protegido pelo login único (SSO) da sua empresa.</p>
  <div class="actions"><a class="button" href="${escapeHtml(loginHref)}">${SSO_ICON}Entrar com SSO da empresa</a></div>`)
}

/** The page shown when authentication succeeded but authorization did not. */
export function deniedPage(reason: string): string {
  return page('Acesso negado', `
  <div class="eyebrow">Acesso negado</div>
  <h1>Sua conta não tem acesso</h1>
  <p>O login foi feito, mas sua conta não tem permissão para usar este espaço.</p>
  <div class="detail">${escapeHtml(reason)}</div>
  <div class="note">Peça a um administrador a permissão necessária e entre novamente.</div>`)
}

/** The page shown when the login itself failed. */
export function errorPage(summary: string, detail?: string): string {
  return page('Falha no login', `
  <div class="eyebrow">Falha no login</div>
  <h1>Não foi possível entrar</h1>
  <p>${escapeHtml(summary)}</p>
  ${detail === undefined ? '' : `<div class="detail">${escapeHtml(detail)}</div>`}
  <div class="actions"><a class="button" href="/">Tentar novamente</a></div>`)
}

/**
 * The page shown when the platform has no capacity for this user yet.
 *
 * It refreshes itself, because the condition it reports is temporary by
 * definition: a backend is reaped after a few minutes idle, so waiting is the
 * correct action rather than an error to report and stop at.
 */
export function waitingPage(message: string): string {
  return page('Preparando seu espaço', `
  <div class="eyebrow">Um momento</div>
  <h1>Preparando seu espaço</h1>
  <p>${escapeHtml(message)}</p>
  <div class="note">Esta página se atualiza sozinha; não é preciso fazer nada.</div>
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
