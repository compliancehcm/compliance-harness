// The part a Node smoke test cannot reach: a real browser, real canvas, real boot.
//
// Establishes four things the rest of the suite can only assume:
//
//   1. Web boot with this plugin composed raises no console error — which means
//      the hand-written client half's `apply` really ran, its `tool.call.toolview`
//      registration was accepted, and its optional `theme` injection resolved.
//   2. The ECharts bundle is NOT fetched at boot. That is the entire reason the
//      library sits behind a route instead of in a client bundle, and it is the
//      one property a refactor would silently break.
//   3. Every option skeleton in SKILL.md actually draws. The skill teaches the
//      model options nobody would otherwise execute; a typo in one of them would
//      surface as a blank card in production.
//   4. `getDataURL` yields a PNG and `setTheme` is accepted on a live instance —
//      the two ECharts APIs the card depends on.
//
// Run it against a harness that already has the plugin composed:
//
//   pnpm dsh --profile web --patch plugins/compliance-echarts.overlay.yml --port 31777 --no-open &
//   node plugins/compliance-echarts/tests/browser.mjs http://127.0.0.1:31777
//
// Playwright is a dependency of `apps/web`, not of this package, and is resolved
// from there — the same way `compliance-alma-mcp` resolves the MCP client it does
// not own.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ORIGIN = process.argv[2] ?? process.env.ECHARTS_TEST_ORIGIN ?? 'http://127.0.0.1:31777'
const SKILL = fileURLToPath(new URL('../skills/echarts-charts/SKILL.md', import.meta.url))
const WEB_APP = fileURLToPath(new URL('../../../apps/web/package.json', import.meta.url))

const webRequire = createRequire(WEB_APP)
const playwright = await import(pathToFileURL(webRequire.resolve('playwright')).href)
const { chromium } = playwright.default ?? playwright

/**
 * Paths only the SSO gateway answers. Pointed at a per-user backend directly
 * (bypassing the gate, which is how you test without a browser session), the
 * user-menu plugin's poll of `/auth/status` 404s. That failure is a property of
 * the origin under test, not of web boot, so it is named here rather than
 * allowed to fail this suite.
 */
const GATEWAY_ONLY_PATHS = new Set(['/auth/status'])

const results = []
/**
 * Record one check.
 * @param label - what is being established.
 * @param ok - whether it holds.
 * @param detail - appended to the label on failure.
 */
const check = (label, ok, detail = '') => { results.push([ok ? 'PASS' : 'FAIL', label + (ok ? '' : `: ${detail}`)]) }

const browser = await chromium.launch()
const page = await browser.newPage()
const consoleErrors = []
const requested = []
const failedResponses = []
page.on('console', (message) => {
  if (message.type() !== 'error') return
  const source = message.location().url
  if (source !== '' && GATEWAY_ONLY_PATHS.has(new URL(source).pathname)) return
  consoleErrors.push(message.text())
})
page.on('pageerror', (error) => { consoleErrors.push(`pageerror: ${error.message}`) })
page.on('request', (request) => { requested.push(new URL(request.url()).pathname) })
page.on('response', (response) => {
  if (response.status() >= 400) failedResponses.push(`${String(response.status())} ${new URL(response.url()).pathname}`)
})

// Not networkidle: the app holds a streaming connection open, so it never settles.
await page.goto(ORIGIN, { waitUntil: 'load' })
await page.waitForFunction(() => document.body.innerHTML.length > 500, null, { timeout: 30_000 })
await page.waitForTimeout(3000)

check('web boot produced no console error', consoleErrors.length === 0, consoleErrors.join(' | '))
check(
  'no request this plugin owns failed',
  failedResponses.every(entry => !entry.includes('echarts')),
  failedResponses.join(' | '),
)
check(
  'the plugin client bundle was fetched at boot',
  requested.includes('/plugins/@compliance/dsh-echarts/client.js'),
  requested.filter(path => path.includes('echarts')).join(','),
)
check('the ECharts bundle was NOT fetched at boot', !requested.includes('/echarts/echarts.min.js'), 'it was fetched')

// Every JSON fence must parse; only the ones carrying `series` are chart
// skeletons the browser can draw (others illustrate one setting, such as the
// legend/grid pairing).
const fences = [...readFileSync(SKILL, 'utf8').matchAll(/```json\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]))
const options = fences.filter(option => option.series !== undefined)
check(`every JSON fence in SKILL.md parses (${String(fences.length)})`, fences.length >= 7)
check(`SKILL.md carries drawable option skeletons (${String(options.length)})`, options.length >= 5)

const report = await page.evaluate(async ({ options }) => {
  // Loaded exactly the way the card loads it: a classic script from the route.
  await new Promise((resolve, reject) => {
    const el = document.createElement('script')
    el.src = '/echarts/echarts.min.js'
    el.addEventListener('load', resolve, { once: true })
    el.addEventListener('error', () => reject(new Error('bundle failed to load')), { once: true })
    document.head.append(el)
  })
  const host = document.createElement('div')
  host.style.width = '600px'
  host.style.height = '320px'
  document.body.append(host)
  const out = { version: window.echarts.version, drawn: [], failed: [], png: null, themed: null }
  for (const [index, option] of options.entries()) {
    const chart = window.echarts.init(host, 'default', { renderer: 'canvas' })
    try {
      chart.setOption({ backgroundColor: 'transparent', ...option })
      const canvas = host.querySelector('canvas')
      if (canvas === null || canvas.width === 0) throw new Error('no canvas painted')
      out.drawn.push(index)
      if (index === 0) {
        out.png = chart.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: 'transparent' }).slice(0, 22)
        chart.setTheme('dark')
        out.themed = typeof chart.getOption === 'function'
      }
    } catch (error) {
      out.failed.push({ index, message: String(error.message ?? error) })
    } finally {
      chart.dispose()
    }
  }
  return out
}, { options })

check('the bundle loads on demand and reports its version', report.version.startsWith('6.'), report.version)
check(
  `every skill skeleton draws a canvas (${String(report.drawn.length)}/${String(options.length)})`,
  report.failed.length === 0,
  JSON.stringify(report.failed),
)
check('getDataURL yields a PNG data URI', report.png === 'data:image/png;base64,', String(report.png))
check('setTheme is accepted on a live instance', report.themed === true)

await browser.close()

for (const [status, label] of results) process.stdout.write(`${status}  ${label}\n`)
const failed = results.filter(([status]) => status === 'FAIL').length
process.stdout.write(`\n${String(results.length - failed)}/${String(results.length)} browser checks passed\n`)
process.exitCode = failed === 0 ? 0 : 1
