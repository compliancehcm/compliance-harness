// A runnable smoke test for the brand plugin: the design system's token layer
// re-targeted for the app and for artifacts, the committed components script,
// the asset route over a real HTTP listener, the index injections, the service,
// the skill, and the client half's theme handling through a fake module loader.
//
// Not a vitest suite (`plugins/` is outside the include globs). Run it by hand:
//
//   node plugins/compliance-brand/tests/smoke.mjs
//
// Unlike compliance-artifacts' smoke it needs no harness build: nothing here
// resolves a harness package.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { apply, inject, name, SERVICE_NAME } from '../index.js'
import { ASSET_ROUTE, THEME_STORAGE_KEY, loadDesignSystem, prePaintScript } from '../src/design-system.js'
import { THEMES, loadTokens, parseTopLevel, themeSwatches } from '../src/tokens.js'
import { designSystemSkill } from '../src/skill.js'
import { buildComponents } from '../scripts/build-components.mjs'

const results = []
const check = async (label, fn) => {
  try {
    await fn()
    results.push(['PASS', label])
  } catch (error) {
    results.push(['FAIL', `${label}: ${error.message}`])
  }
}

// ------------------------------------------------------------------ tokens

const tokens = loadTokens()
const designSystem = loadDesignSystem()

await check('the parser splits blocks and statements and refuses an unbalanced sheet', () => {
  const items = parseTopLevel("@import url('x');\n/* c */ :root{--a:1}\n@keyframes k{from{a:b}to{a:c}}")
  assert.deepEqual(items.map(i => i.statement ?? i.prelude), ["@import url('x');", ':root', '@keyframes k'])
  assert.throws(() => parseTopLevel(':root{--a:1'), /unbalanced/)
})

await check('every design-system theme is found, and nothing unknown', () => {
  for (const theme of THEMES) {
    if (theme.id === 'padrao') continue
    assert.ok(tokens.themes.has(theme.id), `missing ${theme.id}`)
  }
  assert.equal(tokens.themes.size, THEMES.length - 1)
})

await check('the app sheet maps the palette onto body, escuro onto the dark attribute, extras onto the html attribute', () => {
  const css = designSystem.appStylesheet
  assert.match(css, /html body\{[^}]*--primary:#2b4587/)
  assert.match(css, /html body\[data-ds-dark-theme\]\{[^}]*--primary:#7d95d8/)
  for (const id of ['compliance-light', 'alma-dark', 'netsuite-redwood']) {
    assert.ok(css.includes(`html[data-compliance-theme="${id}"] body{`), id)
  }
  // Extra themes come after the dark block, so alma-dark wins where both match.
  assert.ok(css.indexOf('[data-compliance-theme="alma-dark"]') > css.indexOf('html body[data-ds-dark-theme]{'))
  assert.ok(css.includes('--dsw-alias-label-primary: var(--foreground)'), 'the bridge is included')
})

await check('the app sheet makes no third-party request and cannot close its <style>', () => {
  const css = designSystem.appStylesheet
  assert.ok(!css.includes('fonts.googleapis'))
  assert.ok(!/@import/.test(css))
  assert.ok(!/<\/style/i.test(css))
  assert.ok(css.includes(`url("${ASSET_ROUTE}/inter.woff2?v=`))
  assert.ok(css.includes(`url("${ASSET_ROUTE}/oracle-sans.woff2?v=`))
  assert.ok(!css.includes('../assets/'), 'the DS-relative asset path is rewritten')
})

await check('the bridge sheet itself carries no raw hex colour', () => {
  const bridge = readFileSync(new URL('../theme/app.css', import.meta.url), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  assert.doesNotMatch(bridge, /#[0-9a-fA-F]{3,8}\b/)
})

await check('the artifact sheet follows the scheme by default and fixes a named theme', () => {
  const auto = designSystem.artifactStylesheet(undefined)
  assert.match(auto, /^@font-face\{font-family:'Inter'/)
  assert.ok(auto.includes('@layer compliance-ds{'))
  assert.ok(auto.includes('@media (prefers-color-scheme: dark){:root{'))
  assert.ok(auto.includes('.ds-btn'), 'the component classes ride along')
  assert.ok(!auto.includes("'Oracle Sans';font-weight"), 'no 127 KB font outside Redwood')
  const alma = designSystem.artifactStylesheet('alma-dark')
  assert.ok(alma.includes('--primary:#22c55e') && alma.includes('color-scheme:dark'))
  // An unknown id is the default, never an error and never echoed.
  assert.equal(designSystem.artifactStylesheet('nope'), auto)
  assert.ok(!/<\/style/i.test(designSystem.artifactStylesheet('netsuite-redwood')))
})

await check('swatches resolve every theme to literal colours', () => {
  const swatches = themeSwatches(tokens)
  for (const theme of THEMES) {
    for (const key of ['background', 'card', 'primary', 'accent']) {
      assert.match(swatches[theme.id][key] ?? '', /^#[0-9a-f]{6}$/i, `${theme.id}.${key}`)
    }
  }
  assert.equal(swatches['alma-dark'].primary, '#22c55e')
  assert.equal(swatches.escuro.background, '#0a1226')
})

await check('the committed components script is current with the design-system bundle', () => {
  const bundle = readFileSync(new URL('../design-system/_ds_bundle.js', import.meta.url), 'utf8')
  const committed = readFileSync(new URL('../theme/ds-components.js', import.meta.url), 'utf8')
  assert.equal(buildComponents(bundle), committed, 'run scripts/build-components.mjs')
  assert.ok(!committed.includes('ui_kits/'), 'the demo portal is cut out')
  assert.ok(!/<\/script/i.test(committed))
})

await check('the components script defines every component against a global React', () => {
  const sandbox = { React: { createElement: () => null, useState: v => [v, () => {}], useEffect() {}, Fragment: 'F' } }
  sandbox.window = sandbox
  new Function('window', 'React', designSystem.componentsScript())(sandbox, sandbox.React)
  assert.deepEqual(sandbox.window.ComplianceDS.__errors, [])
  for (const component of ['Button', 'Card', 'StatCard', 'DataTable', 'Badge', 'Modal', 'Sidebar']) {
    assert.equal(typeof sandbox.window.ComplianceDS[component], 'function', component)
  }
})

// ------------------------------------------------------------------ plugin, host half

function fakeCtx(options = {}) {
  const prefixes = []
  const listeners = new Map()
  const effects = []
  const provided = new Map()
  const taps = []
  const logs = []
  const skills = new Map()
  const server = createServer((req, res) => {
    const { pathname } = new URL(req.url, 'http://x')
    const route = prefixes.find(r => pathname === r.path || pathname.startsWith(`${r.path}/`))
    if (route === undefined) { res.writeHead(404); res.end(); return }
    route.handler(req, res)
  })
  const ctx = {
    logger: { info: (...a) => logs.push(['info', a.join(' ')]), warn: (...a) => logs.push(['warn', a.join(' ')]) },
    webServer: {
      register(route) { prefixes.push(route); return () => prefixes.splice(prefixes.indexOf(route), 1) },
      tapIndex(fn) { taps.push(fn); return () => taps.splice(taps.indexOf(fn), 1) },
    },
    on(event, fn) { listeners.set(event, [...listeners.get(event) ?? [], fn]) },
    effect(setup, label) { effects.push({ label, dispose: setup() }) },
    provide(key, value) { provided.set(key, value) },
    get(key) {
      if (key === 'skills') return options.skills === false ? undefined : { register: s => { skills.set(s.name, s); return () => skills.delete(s.name) } }
      return provided.get(key)
    },
  }
  return { ctx, server, listeners, effects, provided, taps, logs, skills }
}

const host = fakeCtx()
await new Promise(resolve => host.server.listen(0, '127.0.0.1', resolve))
const origin = `http://127.0.0.1:${host.server.address().port}`

await check('the plugin surface', () => {
  assert.equal(name, 'compliance-brand')
  assert.deepEqual(inject, ['webServer'])
  apply(host.ctx)
})

await check('the service is the loaded design system', () => {
  const service = host.provided.get(SERVICE_NAME)
  assert.equal(typeof service.artifactStylesheet, 'function')
  assert.equal(typeof service.componentsScript, 'function')
  assert.equal(service.themes.length, 5)
  assert.match(service.version, /^[0-9a-f]{12}$/)
})

await check('index injections: config global, stylesheet, favicon, then the pre-paint script', () => {
  const table = []
  for (const fn of host.listeners.get('webserver/index-inject')) fn(table)
  assert.deepEqual(table.map(row => row.kind), ['global', 'style', 'html', 'script'])
  assert.equal(table[0].name, '__COMPLIANCE_BRAND__')
  assert.equal(table[0].value.storageKey, THEME_STORAGE_KEY)
  assert.ok(table[0].value.themes.every(t => t.swatch !== undefined))
  assert.match(table[2].html, /<link rel="icon" type="image\/svg\+xml" href="\/_compliance-brand\/favicon\.svg\?v=/)
  assert.equal(table[3].placement, 'body')
})

await check('the tab title is rewritten', () => {
  assert.equal(host.taps.length, 1)
  assert.equal(host.taps[0]('<head><title>DSH Local Build</title></head>'), '<head><title>Compliance AI</title></head>')
})

await check('the pre-paint script applies a saved extra theme and ignores anything else', () => {
  const run = (stored, { throws = false } = {}) => {
    const dataset = {}
    const attrs = new Set()
    const doc = {
      documentElement: { dataset, style: {} },
      body: { toggleAttribute: (n, on) => { if (on) attrs.add(n); else attrs.delete(n) } },
    }
    const storage = { getItem: () => { if (throws) throw new Error('blocked'); return stored } }
    new Function('document', 'localStorage', prePaintScript(designSystem.themes))(doc, storage)
    return { theme: dataset.complianceTheme, dark: attrs.has('data-ds-dark-theme'), scheme: doc.documentElement.style.colorScheme }
  }
  assert.deepEqual(run(JSON.stringify({ theme: 'alma-dark', base: 'light' })), { theme: 'alma-dark', dark: true, scheme: 'dark' })
  assert.deepEqual(run(JSON.stringify({ theme: 'netsuite-redwood', base: 'system' })), { theme: 'netsuite-redwood', dark: false, scheme: 'light' })
  assert.deepEqual(run(JSON.stringify({ theme: 'escuro' })), { theme: undefined, dark: false, scheme: undefined })
  assert.deepEqual(run('{not json'), { theme: undefined, dark: false, scheme: undefined })
  assert.deepEqual(run(null, { throws: true }), { theme: undefined, dark: false, scheme: undefined })
})

await check('the asset route serves fonts and SVGs, immutable, and 404s the rest', async () => {
  const font = await fetch(`${origin}${designSystem.assetUrl('inter.woff2')}`)
  assert.equal(font.status, 200)
  assert.equal(font.headers.get('content-type'), 'font/woff2')
  assert.equal(font.headers.get('cache-control'), 'public, max-age=31536000, immutable')
  assert.equal(font.headers.get('access-control-allow-origin'), '*')
  assert.equal((await font.arrayBuffer()).byteLength, designSystem.assets.get('inter.woff2').body.byteLength)
  const svg = await fetch(`${origin}${ASSET_ROUTE}/favicon.svg`)
  assert.equal(svg.headers.get('content-type'), 'image/svg+xml')
  for (const path of ['/', '/../index.js', '/design-system/readme.md', '/tokens.css']) {
    assert.equal((await fetch(`${origin}${ASSET_ROUTE}${path}`)).status, 404, path)
  }
  assert.equal((await fetch(`${origin}${ASSET_ROUTE}/inter.woff2`, { method: 'POST' })).status, 405)
})

await check('the design-system skill registers with the design-system folder as its resource base', () => {
  const skill = host.skills.get('compliance-design-system')
  assert.ok(skill !== undefined)
  assert.equal(skill.source, 'bundled')
  assert.match(skill.resourceBase.path, /design-system\/$/)
  assert.ok(skill.content.includes('.ds-card'))
  assert.deepEqual(designSystemSkill().name, 'compliance-design-system')
})

await check('without a skill registry the plugin still applies, and says so', () => {
  const bare = fakeCtx({ skills: false })
  apply(bare.ctx)
  assert.ok(bare.logs.some(([level, text]) => level === 'warn' && text.includes('no skill registry')))
  assert.ok(bare.provided.has(SERVICE_NAME))
})

await new Promise(resolve => host.server.close(resolve))

// ------------------------------------------------------------------ client half

/** A minimal ui-theme service: register, setTheme, getTheme, theme/change. */
function fakeTheme(initial = 'light') {
  const themes = new Set(['light', 'dark'])
  const listeners = []
  let preference = initial
  const snapshot = () => ({ preference, active: { colorScheme: preference === 'dark' ? 'dark' : 'light' } })
  return {
    registered: themes,
    listeners,
    service: {
      register(def) { themes.add(def.id); return () => themes.delete(def.id) },
      setTheme(id) {
        if (id !== 'system' && !themes.has(id)) throw new Error(`theme "${id}" is not registered`)
        if (preference === id) return
        preference = id
        for (const fn of listeners) fn(snapshot())
      },
      getTheme: snapshot,
    },
    /** What ui-theme's own boot adoption does: set a built-in preference behind the plugin's back. */
    adopt(id) { preference = id; for (const fn of listeners) fn(snapshot()) },
  }
}

function loadClient({ stored } = {}) {
  const loaded = []
  const storage = new Map(stored === undefined ? [] : [[THEME_STORAGE_KEY, JSON.stringify(stored)]])
  const dataset = {}
  globalThis.window = {
    __ModuleLoader__: { load: r => loaded.push(r) },
    __COMPLIANCE_BRAND__: { themes: designSystem.themes, storageKey: THEME_STORAGE_KEY },
  }
  globalThis.document = { documentElement: { dataset } }
  globalThis.localStorage = {
    getItem: k => storage.get(k) ?? null,
    setItem: (k, v) => storage.set(k, v),
    removeItem: k => storage.delete(k),
  }
  new Function(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))()
  const stub = { jsx: () => null, jsxs: () => null }
  const exportsOf = loaded[0].factory((specifier) => {
    if (specifier === 'react/jsx-runtime') return stub
    if (specifier === 'react') return { useSyncExternalStore: (_s, get) => get() }
    throw new Error(`the shell baseline does not carry ${specifier}`)
  })
  const registrations = []
  const effects = []
  const slots = {
    inject: (_name, fn) => { const out = fn(); if (out && typeof out.next === 'function') for (const r of out) registrations.push(r) },
    register: (options) => { registrations.push(options.name); return options.name },
  }
  return { loaded, exportsOf, storage, dataset, registrations, effects, slots }
}

function mount(client, theme) {
  const on = []
  const scoped = {
    get: () => theme.service,
    effect: (setup) => { client.effects.push(setup()) },
    on: (_event, fn) => { theme.listeners.push(fn); on.push(fn) },
    slots: client.slots,
  }
  client.exportsOf.apply({ slots: client.slots, inject: (_names, fn) => fn(scoped) })
  return scoped
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

await check('the client registers under its package name and keeps the three brand slots', () => {
  const client = loadClient()
  assert.equal(client.loaded[0].id, '@compliance/dsh-client-ui-brand')
  assert.deepEqual(client.exportsOf.inject, ['slots'])
  const theme = fakeTheme()
  mount(client, theme)
  for (const slot of ['sidebar.brand.mark', 'sidebar.brand.name', 'conversation.hero.brand.mark', 'settings.general.item']) {
    assert.ok(client.registrations.includes(slot), slot)
  }
  for (const id of ['compliance-light', 'alma-dark', 'netsuite-redwood']) assert.ok(theme.registered.has(id), id)
})

await check('a saved extra theme is re-selected at mount and survives the boot adoption', async () => {
  const client = loadClient({ stored: { theme: 'alma-dark', base: 'light' } })
  const theme = fakeTheme('light')
  mount(client, theme)
  assert.equal(theme.service.getTheme().preference, 'alma-dark')
  assert.equal(client.dataset.complianceTheme, 'alma-dark')
  theme.adopt('light')
  await settle()
  assert.equal(theme.service.getTheme().preference, 'alma-dark', 're-asserted')
  assert.equal(client.dataset.complianceTheme, 'alma-dark')
})

await check('picking another built-in in the Appearance row hands the palette back', () => {
  const client = loadClient({ stored: { theme: 'netsuite-redwood', base: 'light' } })
  const theme = fakeTheme('light')
  mount(client, theme)
  theme.service.setTheme('dark')
  assert.equal(client.dataset.complianceTheme, undefined)
  assert.equal(client.storage.has(THEME_STORAGE_KEY), false)
})

await check('a stale saved id is dropped rather than thrown', () => {
  const client = loadClient({ stored: { theme: 'tema-que-sumiu', base: 'light' } })
  const theme = fakeTheme('light')
  mount(client, theme)
  assert.equal(theme.service.getTheme().preference, 'light')
  assert.equal(client.dataset.complianceTheme, undefined)
})

await check('withdrawing the theme scope clears the palette attribute', () => {
  const client = loadClient({ stored: { theme: 'compliance-light', base: 'system' } })
  const theme = fakeTheme('system')
  mount(client, theme)
  assert.equal(client.dataset.complianceTheme, 'compliance-light')
  for (const dispose of client.effects.reverse()) if (typeof dispose === 'function') dispose()
  assert.equal(client.dataset.complianceTheme, undefined)
})

delete globalThis.window
delete globalThis.document
delete globalThis.localStorage

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} ok, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
