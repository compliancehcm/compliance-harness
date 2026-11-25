/**
 * Strict stand-ins for the Web client packages a plugin's `client.js` requires.
 *
 * A plugin smoke cannot load the real client packages (they are browser bundles),
 * so it stubs them. A stub that answers every name hides the one failure that
 * matters on an upstream sync: an export the plugin destructures was renamed or
 * removed, the destructure yields `undefined`, and React throws the first time
 * that element renders. That is how the dsh 0.2.3 icon rename
 * (`IconCloseOutline16` → `IconCloseOutlineRegular`) reached master with every
 * smoke green.
 *
 * So the stub here knows the package's real value exports, read from its emitted
 * declarations, and refuses any other name. The declarations come from
 * `pnpm run build`, which the plugin lane already runs before the smokes.
 */

import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')

/** Where each stubbed package's declaration entry lives. */
const DECLARATIONS = {
  '@deepseek-ai/dsh-client-ui-primitives': 'packages/client/ui-primitives/lib/types/index.d.ts',
}

/** Collect the value (non-type) export names of a declaration file, following `export *`. */
function collectValueExports(file, seen = new Set()) {
  const names = new Set()
  if (seen.has(file)) return names
  seen.add(file)
  const text = readFileSync(file, 'utf8')

  for (const match of text.matchAll(/^export\s+\{([^}]*)\}/gm)) {
    for (const part of match[1].split(',')) {
      const entry = part.trim()
      if (entry === '' || entry.startsWith('type ')) continue
      const alias = entry.split(/\s+as\s+/).pop().trim()
      names.add(alias)
    }
  }
  for (const match of text.matchAll(/^export\s+declare\s+(?:const|function|class|let|var|enum)\s+([A-Za-z_$][\w$]*)/gm)) {
    names.add(match[1])
  }
  for (const match of text.matchAll(/^export\s+\*\s+from\s+'([^']+)'/gm)) {
    const target = join(dirname(file), match[1].replace(/\.tsx?$/, '.d.ts'))
    for (const name of collectValueExports(target, seen)) names.add(name)
  }
  return names
}

/**
 * The real value export names of a client package.
 * @param {string} specifier - the package name the plugin requires.
 * @returns {Set<string>} its value exports.
 */
export function clientExportNames(specifier) {
  const relative = DECLARATIONS[specifier]
  if (relative === undefined) throw new Error(`client-exports: no declaration entry for ${specifier}`)
  const entry = join(repoRoot, relative)
  if (!existsSync(entry)) {
    throw new Error(`client-exports: ${relative} is missing — run \`pnpm run build\` before the plugin smokes`)
  }
  return collectValueExports(entry)
}

/**
 * A stand-in module that returns `make(name)` for real exports and throws for any
 * other name, so a destructure of a removed export fails the smoke.
 * @param {string} specifier - the package name the plugin requires.
 * @param {(name: string) => unknown} [make] - builds each export's stand-in.
 * @returns {object} the strict module stub.
 */
export function strictClientModule(specifier, make = () => () => null) {
  const names = clientExportNames(specifier)
  return new Proxy({}, {
    get(_target, name) {
      if (typeof name !== 'string') return undefined
      if (!names.has(name)) {
        throw new Error(`${specifier} has no export ${JSON.stringify(name)} — renamed or removed upstream?`)
      }
      return make(name)
    },
  })
}
