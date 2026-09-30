/**
 * The design system's token sheets, re-targeted for the two places they run.
 *
 * `design-system/tokens/*.css` is kept byte-for-byte as the design system ships
 * it, so an upgrade is a folder swap. Its selectors, though, are written for a
 * standalone page: `:root` for the default palette and `[data-theme="…"]` on
 * `<html>` for the other four. Neither fits as-is:
 *
 *   - the Web client declares its own tokens on `body` and flips dark mode with
 *     `body[data-ds-dark-theme]`, so the default palette has to live on `body`
 *     at a weight above upstream's, and "escuro" has to follow THAT attribute;
 *   - an artifact is a standalone page, but it follows the viewer's colour
 *     scheme (or a theme the embedder names), not an attribute nobody sets.
 *
 * So the sheets are parsed into top-level blocks once and re-emitted per target.
 * The parser is deliberately small: the token files are flat rule lists plus
 * one `@import` and one `@font-face`, and anything else fails loud here rather
 * than silently leaking into a page.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The design system's token directory (verbatim copy of the DS). */
export const TOKENS_DIR = fileURLToPath(new URL('../design-system/tokens/', import.meta.url))

/** Token files in the order `design-system/styles.css` imports them. */
export const TOKEN_FILES = Object.freeze([
  'typography.css', 'colors.css', 'themes.css', 'spacing.css', 'radius-elevation.css',
])

/** The default palette's id; it is `:root` in the DS, not a `[data-theme]`. */
export const DEFAULT_THEME = 'padrao'

/** The dark palette the Web client's built-in dark mode maps to. */
export const DARK_THEME = 'escuro'

/**
 * Every theme the design system ships, in its own order. `builtin` themes ride
 * the Web client's Light/Dark/System preference; the others are registered as
 * extra themes by the client half. Labels are the DS's own (pt-BR).
 */
export const THEMES = Object.freeze([
  Object.freeze({ id: 'padrao', label: 'Padrão', colorScheme: 'light', builtin: true }),
  Object.freeze({ id: 'escuro', label: 'Escuro', colorScheme: 'dark', builtin: true }),
  Object.freeze({ id: 'compliance-light', label: 'Compliance Light', colorScheme: 'light', builtin: false }),
  Object.freeze({ id: 'alma-dark', label: 'Alma RH Dark', colorScheme: 'dark', builtin: false }),
  Object.freeze({ id: 'netsuite-redwood', label: 'NetSuite Redwood', colorScheme: 'light', builtin: false }),
])

/** Look a theme up by id. */
export function themeById(id) {
  return THEMES.find(theme => theme.id === id)
}

/**
 * Split a stylesheet into its top-level statements.
 * @param css - stylesheet text.
 * @param file - file name, for error messages.
 * @returns `{ prelude, body }` blocks and `{ statement }` at-rules, in order.
 * @throws {Error} on an unbalanced brace.
 */
export function parseTopLevel(css, file = 'stylesheet') {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, '')
  /** First `{` or `;` from `from` that is outside quotes and parentheses. */
  const nextDelimiter = (from, char) => {
    let quote = null
    let parens = 0
    for (let k = from; k < text.length; k++) {
      const c = text[k]
      if (quote !== null) { if (c === quote) quote = null; continue }
      if (c === '"' || c === "'") quote = c
      else if (c === '(') parens++
      else if (c === ')') parens--
      else if (parens === 0 && c === char) return k
    }
    return -1
  }
  const items = []
  let i = 0
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++
    if (i >= text.length) break
    const brace = nextDelimiter(i, '{')
    const semi = nextDelimiter(i, ';')
    if (semi !== -1 && (brace === -1 || semi < brace)) {
      items.push({ statement: text.slice(i, semi + 1).trim() })
      i = semi + 1
      continue
    }
    if (brace === -1) throw new Error(`${file}: trailing text without a block: ${JSON.stringify(text.slice(i, i + 40))}`)
    let depth = 0
    let j = brace
    for (; j < text.length; j++) {
      if (text[j] === '{') depth++
      else if (text[j] === '}' && --depth === 0) break
    }
    if (depth !== 0) throw new Error(`${file}: unbalanced braces`)
    items.push({ prelude: text.slice(i, brace).trim(), body: text.slice(brace + 1, j).trim() })
    i = j + 1
  }
  return items
}

/**
 * Read and classify every token file.
 * @param dir - the token directory (overridable for tests).
 * @returns the classified pieces of the design system's token layer.
 */
export function loadTokens(dir = TOKENS_DIR) {
  /** Declarations of the default palette and every non-colour scale. */
  const root = []
  /** Declarations per `[data-theme]` id. */
  const themes = new Map()
  /** `@font-face` bodies (the Redwood theme's Oracle Sans). */
  const fontFaces = []
  /** `@keyframes` blocks, kept whole. */
  const keyframes = []
  for (const file of TOKEN_FILES) {
    const css = readFileSync(`${dir}${file}`, 'utf8')
    for (const item of parseTopLevel(css, file)) {
      if ('statement' in item) {
        // The DS's one statement is its Google Fonts @import. The client loads
        // its fonts from this plugin instead: a closed network cannot reach
        // Google, and an artifact must not need a second origin to look right.
        if (/^@import\b/.test(item.statement)) continue
        throw new Error(`${file}: unexpected top-level statement ${JSON.stringify(item.statement)}`)
      }
      const { prelude, body } = item
      if (prelude === ':root') { root.push(body); continue }
      const theme = /^\[data-theme="([a-z0-9-]+)"\]$/.exec(prelude)
      if (theme !== null) { themes.set(theme[1], body); continue }
      if (prelude === '@font-face') { fontFaces.push(body); continue }
      if (/^@keyframes\s/.test(prelude)) { keyframes.push(`${prelude}{${body}}`); continue }
      throw new Error(`${file}: unexpected selector ${JSON.stringify(prelude)}`)
    }
  }
  for (const theme of THEMES) {
    if (theme.id === DEFAULT_THEME) continue
    if (!themes.has(theme.id)) throw new Error(`themes.css: the "${theme.id}" theme is missing`)
  }
  for (const id of themes.keys()) {
    if (themeById(id) === undefined) throw new Error(`themes.css: unknown theme "${id}" — add it to THEMES`)
  }
  return { root: root.join(';\n'), themes, fontFaces, keyframes }
}

/**
 * Parse `--name: value` declarations out of a block body.
 * @param body - a block body.
 * @returns name → value.
 */
function declarations(body) {
  const out = new Map()
  for (const part of body.split(';')) {
    const match = /^\s*(--[\w-]+)\s*:\s*([\s\S]+?)\s*$/.exec(part)
    if (match !== null) out.set(match[1], match[2])
  }
  return out
}

/**
 * The resolved key colours of every theme, for swatches in the theme picker
 * (a picker cannot show another theme's colours through `var()`: only one
 * theme is active on the document at a time). Layered exactly like the app:
 * default, then escuro for dark themes, then the theme's own block.
 * @param tokens - the result of {@link loadTokens}.
 * @returns theme id → `{ background, card, primary, accent }`.
 */
export function themeSwatches(tokens) {
  const root = declarations(tokens.root)
  const out = {}
  for (const theme of THEMES) {
    const merged = new Map(root)
    if (theme.colorScheme === 'dark' && theme.id !== DARK_THEME) {
      for (const [k, v] of declarations(tokens.themes.get(DARK_THEME))) merged.set(k, v)
    }
    if (theme.id !== DEFAULT_THEME) {
      for (const [k, v] of declarations(tokens.themes.get(theme.id))) merged.set(k, v)
    }
    out[theme.id] = {
      background: merged.get('--background'),
      card: merged.get('--card'),
      primary: merged.get('--primary'),
      accent: merged.get('--accent'),
    }
  }
  return out
}

/**
 * Rewrite the `src` of the DS's own `@font-face` (Oracle Sans) to a new URL.
 * @param body - an `@font-face` body.
 * @param url - the replacement URL.
 * @returns the rewritten body.
 */
function withFontUrl(body, url) {
  return body.replace(/url\((['"]?)[^'")]+\1\)/, `url("${url}")`)
}

/** The `@font-face` for Inter, variable weight, latin subset (covers pt-BR). */
export function interFontFace(url) {
  return `@font-face{font-family:'Inter';font-style:normal;font-display:swap;font-weight:100 900;src:url("${url}") format('woff2');unicode-range:U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD}`
}

/**
 * The token layer for the Web client.
 *
 * The default palette lands on `html body` — (0,0,2), enough to beat the
 * `body` it shares with ui-theme's sheets — and "escuro" on
 * `html body[data-ds-dark-theme]`, so the app's own Dark (and System, when the
 * OS is dark) IS the design system's dark theme. The three extra themes key off
 * `html[data-compliance-theme]`, which the client half sets, and come after the
 * dark block so an extra dark theme (alma-dark) wins where both match while
 * inheriting escuro for what it does not re-declare.
 * @param tokens - the result of {@link loadTokens}.
 * @param urls - `{ inter, oracleSans, redwoodStripe }` asset URLs.
 * @returns stylesheet text.
 */
export function appTokenCss(tokens, urls) {
  const parts = [interFontFace(urls.inter)]
  for (const face of tokens.fontFaces) parts.push(`@font-face{${withFontUrl(face, urls.oracleSans)}}`)
  parts.push(`html body{${tokens.root};--compliance-redwood-stripe:url("${urls.redwoodStripe}")}`)
  parts.push(`html body[data-ds-dark-theme]{${tokens.themes.get(DARK_THEME)}}`)
  for (const theme of THEMES) {
    if (theme.builtin) continue
    parts.push(`html[data-compliance-theme="${theme.id}"] body{${tokens.themes.get(theme.id)}}`)
  }
  return parts.join('\n')
}

/**
 * The token layer for an artifact document, on `:root`.
 *
 * Without a theme the page follows its own `prefers-color-scheme` — which, in a
 * frame, is the embedder's `color-scheme`, so it tracks the app's Light/Dark.
 * With one, the palette is fixed: the default, then escuro under a dark theme
 * (as in the app), then the theme's own block.
 * @param tokens - the result of {@link loadTokens}.
 * @param themeId - a {@link THEMES} id, or undefined to follow the scheme.
 * @param fonts - `{ inter, oracleSans }` URLs (data: URIs for an artifact).
 * @returns stylesheet text.
 */
export function artifactTokenCss(tokens, themeId, fonts) {
  const theme = themeId === undefined ? undefined : themeById(themeId)
  const parts = [interFontFace(fonts.inter)]
  // Oracle Sans is 127 KB; only the one theme that uses it pays for it.
  if (theme?.id === 'netsuite-redwood' && fonts.oracleSans !== undefined) {
    for (const face of tokens.fontFaces) parts.push(`@font-face{${withFontUrl(face, fonts.oracleSans)}}`)
  }
  parts.push(`:root{${tokens.root}}`)
  if (theme === undefined) {
    parts.push(`@media (prefers-color-scheme: dark){:root{${tokens.themes.get(DARK_THEME)}}}`)
  } else if (theme.id !== DEFAULT_THEME) {
    const scheme = theme.colorScheme
    if (scheme === 'dark' && theme.id !== DARK_THEME) parts.push(`:root{${tokens.themes.get(DARK_THEME)}}`)
    parts.push(`:root{${tokens.themes.get(theme.id)};color-scheme:${scheme}}`)
  } else {
    parts.push(':root{color-scheme:light}')
  }
  parts.push(...tokens.keyframes)
  return parts.join('\n')
}
