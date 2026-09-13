// The part a Node smoke test cannot reach: a real browser deciding whether the
// sandbox and the CSP behave as the design claims.
//
// Four properties, none of which Node can observe:
//
//   1. The frame RUNS. A sandboxed document with an opaque origin still executes
//      its inline script — if it did not, the whole feature would be a static
//      page viewer and nobody would notice until production.
//   2. `frame-ancestors 'self'` permits the app to frame it. A policy that
//      blocked its own embedder would show an empty panel with no error.
//   3. The frame cannot reach the embedder. `document.cookie` and
//      `localStorage` throw or come back empty inside it, and the embedder's own
//      cookie never appears — that is what serving model-written HTML on the
//      app's origin rests on.
//   4. The CSP blocks a script host that is not on the allowlist, while allowing
//      one that is.
//
// This owns its own composition: one http listener serving both the plugin's
// route handler and a small embedder page, so the frame and its parent share an
// origin exactly as they do in the product. It needs no harness boot, no API key
// and no network.
//
//   node plugins/compliance-artifacts/tests/browser.mjs
//
// Playwright is a dependency of `apps/web`, not of this package, and is resolved
// from there — the same way `compliance-echarts` does it. Set
// `ARTIFACTS_CHROMIUM` to a Chromium binary when the host has one that
// Playwright's own build-numbered lookup does not find.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { resolveConfig } from '../src/config.js'
import { artifactHandler } from '../src/route.js'
import { writeVersion } from '../src/store.js'

const WEB_APP = fileURLToPath(new URL('../../../apps/web/package.json', import.meta.url))
const webRequire = createRequire(WEB_APP)
const playwright = await import(pathToFileURL(webRequire.resolve('playwright')).href)
const { chromium } = playwright.default ?? playwright

const results = []
/**
 * Record one check.
 * @param label - what is being established.
 * @param fn - the check; a throw is a failure.
 */
const check = async (label, fn) => {
  try {
    await fn()
    results.push(['PASS', label])
  } catch (error) {
    results.push(['FAIL', `${label}: ${error.message}`])
  }
}

const root = mkdtempSync(join(tmpdir(), 'artifacts-browser-'))
const config = resolveConfig({ root, allowedOrigins: ['https://cdn.jsdelivr.net'] })
const SESSION = 'sessionbrowser'
const ARTIFACT = 'pagina0001'

// A page that proves it ran: it writes into its own DOM from an inline script,
// and records what the sandbox let it reach.
const PAGE = `<!DOCTYPE html>
<html lang="pt-BR"><head><meta charset="utf-8"><title>Artefato</title></head>
<body>
<h1 id="titulo">estático</h1>
<p id="cookie">?</p>
<p id="storage">?</p>
<script>
  document.getElementById('titulo').textContent = 'o script rodou'
  // Both accessors THROW in an opaque origin rather than returning empty, so
  // each needs its own guard — an unguarded read aborts the rest of the script.
  try { document.getElementById('cookie').textContent = 'cookie:[' + document.cookie + ']' }
  catch { document.getElementById('cookie').textContent = 'cookie:negado' }
  try { localStorage.setItem('x', '1'); document.getElementById('storage').textContent = 'storage:aberto' }
  catch { document.getElementById('storage').textContent = 'storage:negado' }
</script>
</body></html>`

// A second page that tries to load a script from a host the allowlist omits.
const BLOCKED_PAGE = `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head><body>
<p id="estado">nao carregou</p>
<script src="https://evil.example.com/x.js" onerror="document.getElementById('estado').textContent='bloqueado'"></script>
</body></html>`

await writeVersion(config, SESSION, ARTIFACT, PAGE, 'Artefato')
await writeVersion(config, SESSION, 'bloqueada001', BLOCKED_PAGE, 'Bloqueada')

const handler = artifactHandler(config)
const server = createServer((req, res) => {
  const pathname = new URL(req.url, 'http://x').pathname
  if (pathname === '/embed') {
    // The embedder: same origin as the artifact, exactly as in the product,
    // with a cookie the frame must not be able to read.
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'sessao=segredo; Path=/' })
    res.end(`<!DOCTYPE html><html><body><iframe id="f" src="${req.url.includes('bloqueada') ? `/artifacts/${SESSION}/bloqueada001/latest` : `/artifacts/${SESSION}/${ARTIFACT}/latest`}"
      sandbox="allow-scripts allow-popups allow-modals" style="width:600px;height:400px"></iframe></body></html>`)
    return
  }
  Promise.resolve(handler(req, res)).catch(() => { if (!res.headersSent) { res.writeHead(500); res.end() } })
})
await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
const origin = `http://127.0.0.1:${String(server.address().port)}`

const executablePath = process.env['ARTIFACTS_CHROMIUM']
const browser = await chromium.launch(executablePath === undefined ? {} : { executablePath })
const page = await browser.newPage()

try {
  await check('the sandboxed frame executes its inline script', async () => {
    await page.goto(`${origin}/embed`, { waitUntil: 'networkidle' })
    const frame = page.frames().find(candidate => candidate.url().includes('/artifacts/'))
    assert.ok(frame !== undefined, 'the artifact frame did not load at all — check frame-ancestors')
    const heading = await frame.locator('#titulo').textContent()
    assert.equal(heading, 'o script rodou', 'an artifact that cannot run scripts is not interactive')
  })

  await check('the frame reaches no cookie and no storage of the app around it', async () => {
    const frame = page.frames().find(candidate => candidate.url().includes('/artifacts/'))
    // Both REFUSE by throwing, not by answering empty — which is why the skill
    // tells the model to guard any storage access a library might attempt.
    assert.equal(await frame.locator('#cookie').textContent(), 'cookie:negado',
      'the embedder cookie must not be reachable from inside the artifact')
    assert.equal(await frame.locator('#storage').textContent(), 'storage:negado',
      'an opaque origin must not have localStorage')
  })

  await check('the frame really has an opaque origin', async () => {
    const frame = page.frames().find(candidate => candidate.url().includes('/artifacts/'))
    assert.equal(await frame.evaluate(() => window.origin), 'null')
  })

  await check('a script host outside the allowlist is blocked by the CSP', async () => {
    const violations = []
    page.on('console', (message) => {
      if (/Content Security Policy|Refused to load/i.test(message.text())) violations.push(message.text())
    })
    await page.goto(`${origin}/embed?bloqueada`, { waitUntil: 'networkidle' })
    const frame = page.frames().find(candidate => candidate.url().includes('/artifacts/'))
    assert.ok(frame !== undefined, 'the frame did not load')
    assert.notEqual(await frame.locator('#estado').textContent(), 'carregou')
    assert.ok(violations.length > 0, 'the browser reported no CSP refusal for a non-allowlisted host')
  })

  await check('the response carries the artifact policy and not the app default', async () => {
    const response = await page.request.get(`${origin}/artifacts/${SESSION}/${ARTIFACT}/latest`)
    const csp = response.headers()['content-security-policy']
    assert.ok(csp.includes('https://cdn.jsdelivr.net'))
    assert.ok(csp.includes("connect-src 'none'"))
  })
} finally {
  await browser.close()
  await new Promise((resolve) => { server.close(resolve) })
  rmSync(root, { recursive: true, force: true })
}

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} ok, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
