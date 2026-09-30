/**
 * The Compliance HCM design system as one loaded object: the Web client's
 * stylesheet, the artifact stylesheet per theme, the React components script,
 * and the static assets the route serves.
 *
 * Everything is read from disk once, at apply. The object is also what the
 * `complianceDesignSystem` service hands to other plugins (compliance-artifacts),
 * so the design system has exactly one owner and one copy.
 *
 * @module
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { THEMES, appTokenCss, artifactTokenCss, loadTokens, themeById, themeSwatches } from './tokens.js'

const PLUGIN_DIR = fileURLToPath(new URL('../', import.meta.url))

/** URL prefix of the asset route. */
export const ASSET_ROUTE = '/_compliance-brand'

/** localStorage key the client half and the pre-paint script share. */
export const THEME_STORAGE_KEY = 'compliance-brand.theme'

/**
 * Served assets: published name → source file and media type. The Oracle
 * files are third-party brand assets the design system uses ONLY for the
 * `netsuite-redwood` comparison theme.
 */
const ASSET_SOURCES = Object.freeze({
  'inter.woff2': { file: 'fonts/inter-latin-wght-normal.woff2', type: 'font/woff2' },
  'oracle-sans.woff2': { file: 'design-system/assets/OracleBrandVF_Tb_W_WghtWdth.woff2', type: 'font/woff2' },
  'favicon.svg': { file: 'design-system/assets/favicon.svg', type: 'image/svg+xml' },
  'redwood-stripe.svg': { file: 'design-system/assets/redwood-stripe.svg', type: 'image/svg+xml' },
  'redwood-band.svg': { file: 'design-system/assets/redwood-band.svg', type: 'image/svg+xml' },
})

/** Short content hash, used as a cache-busting query and as the service version. */
function hash(...buffers) {
  const h = createHash('sha256')
  for (const buffer of buffers) h.update(buffer)
  return h.digest('hex').slice(0, 12)
}

/**
 * Refuse text that would close the element it is inlined into.
 * @param text - stylesheet or script text.
 * @param tag - `style` or `script`.
 * @param what - label for the error.
 * @returns the text, unchanged.
 */
function inlineSafe(text, tag, what) {
  if (new RegExp(`</${tag}`, 'i').test(text)) throw new Error(`compliance-brand: ${what} contains </${tag}`)
  return text
}

/**
 * Load the design system.
 * @param dir - plugin directory (overridable for tests).
 * @returns the loaded design system.
 */
export function loadDesignSystem(dir = PLUGIN_DIR) {
  const read = (file) => readFileSync(`${dir}${file}`)
  const tokens = loadTokens(`${dir}design-system/tokens/`)

  /** name → { body, type, version } */
  const assets = new Map()
  for (const [name, { file, type }] of Object.entries(ASSET_SOURCES)) {
    const body = read(file)
    assets.set(name, { body, type, version: hash(body) })
  }
  const assetUrl = (name) => `${ASSET_ROUTE}/${name}?v=${assets.get(name).version}`
  const dataUri = (name) => `data:${assets.get(name).type};base64,${assets.get(name).body.toString('base64')}`

  const appCss = read('theme/app.css').toString('utf8')
  const componentsCss = read('theme/artifact-components.css').toString('utf8')
  const componentsJs = inlineSafe(read('theme/ds-components.js').toString('utf8'), 'script', 'ds-components.js')

  const appStylesheet = inlineSafe([
    appTokenCss(tokens, {
      inter: assetUrl('inter.woff2'),
      oracleSans: assetUrl('oracle-sans.woff2'),
      redwoodStripe: assetUrl('redwood-stripe.svg'),
    }),
    appCss,
  ].join('\n'), 'style', 'the app stylesheet')

  const version = hash(appStylesheet, componentsCss, componentsJs)
  const artifactSheets = new Map()

  /**
   * The full stylesheet an artifact document is served with. Font faces stay
   * outside the layer; everything else sits in `@layer compliance-ds`, so an
   * unlayered rule the page writes itself always wins.
   * @param themeId - a theme id, or undefined to follow `prefers-color-scheme`.
   * @returns stylesheet text, memoized per theme.
   */
  function artifactStylesheet(themeId) {
    const key = themeId !== undefined && themeById(themeId) !== undefined ? themeId : ''
    let sheet = artifactSheets.get(key)
    if (sheet === undefined) {
      const lines = artifactTokenCss(tokens, key === '' ? undefined : key, {
        inter: dataUri('inter.woff2'),
        oracleSans: dataUri('oracle-sans.woff2'),
      }).split('\n')
      const faces = lines.filter(line => line.startsWith('@font-face'))
      const rest = lines.filter(line => !line.startsWith('@font-face'))
      sheet = inlineSafe(
        `${faces.join('\n')}\n@layer compliance-ds{\n${rest.join('\n')}\n${componentsCss}\n}`,
        'style', 'the artifact stylesheet')
      artifactSheets.set(key, sheet)
    }
    return sheet
  }

  const swatches = themeSwatches(tokens)

  return Object.freeze({
    version,
    themes: THEMES.map(({ id, label, colorScheme, builtin }) => ({ id, label, colorScheme, builtin, swatch: swatches[id] })),
    assets,
    assetUrl,
    appStylesheet,
    artifactStylesheet,
    componentsScript: () => componentsJs,
  })
}

/**
 * The pre-paint body script: re-apply a saved extra theme before first paint.
 *
 * ui-theme's own boot script only knows Light/Dark/System, so on a reload with
 * an extra theme saved the page would paint the built-in palette until the
 * client half re-selects the theme. This runs right after that script and sets
 * the same attribute the client half does. Storage access is guarded: a
 * blocked localStorage THROWS, it does not return null.
 * @param themes - the design system's themes.
 * @returns script text.
 */
export function prePaintScript(themes) {
  const extras = Object.fromEntries(themes.filter(t => !t.builtin).map(t => [t.id, t.colorScheme]))
  return `(() => {
  try {
    const saved = JSON.parse(localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)}) || 'null')
    const schemes = ${JSON.stringify(extras)}
    const id = saved && saved.theme
    if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(schemes, id)) return
    document.documentElement.dataset.complianceTheme = id
    document.documentElement.style.colorScheme = schemes[id]
    document.body.toggleAttribute('data-ds-dark-theme', schemes[id] === 'dark')
  } catch {}
})()`
}
