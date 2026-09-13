/**
 * Plugin configuration and its validation, including the workbook theme.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, at load: every problem is collected and
 * reported in one throw, because a half-understood configuration would surface
 * later as a rejected tool call rather than as a boot error.
 *
 * The theme lives here rather than in a shared package because no shared one
 * exists yet: `plugins/compliance-brand` owns the Web client's brand slots
 * (a logo as a CSS mask), not a document palette. When the HTML plugin lands it
 * needs the same colours, and THAT is the change that should extract a single
 * source — not this one, which would be extracting for a second consumer that
 * does not exist.
 *
 * @module
 */

/** The Compliance workbook look. Every value is an ARGB or a font name openpyxl understands. */
const DEFAULT_THEME = {
  fontName: 'Calibri',
  fontSize: 11,
  headerFill: 'FF1F3864',
  headerFont: 'FFFFFFFF',
  totalsFill: 'FFD9E2F3',
  bandFill: 'FFF2F5FB',
  borderColor: 'FFBFBFBF',
}

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  pythonBin: 'python3',
  toolName: 'write_xlsx',
  timeoutMs: 120_000,
  graceMs: 5_000,
  maxSheets: 12,
  maxRows: 100_000,
  maxColumns: 64,
  maxOutputBytes: 32_768,
  registerSkill: true,
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS = new Set([
  'pythonBin', 'toolName', 'timeoutMs', 'graceMs',
  'maxSheets', 'maxRows', 'maxColumns', 'maxOutputBytes', 'registerSkill', 'theme',
])

/** Every theme key, with the check each value must pass. */
const THEME_FIELDS = {
  fontName: value => typeof value === 'string' && value.trim() !== '',
  fontSize: value => typeof value === 'number' && Number.isInteger(value) && value > 0 && value <= 72,
  headerFill: value => typeof value === 'string' && /^FF[0-9A-F]{6}$/i.test(value),
  headerFont: value => typeof value === 'string' && /^FF[0-9A-F]{6}$/i.test(value),
  totalsFill: value => typeof value === 'string' && /^FF[0-9A-F]{6}$/i.test(value),
  bandFill: value => typeof value === 'string' && /^FF[0-9A-F]{6}$/i.test(value),
  borderColor: value => typeof value === 'string' && /^FF[0-9A-F]{6}$/i.test(value),
}

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class XlsxConfigError extends Error {
  /**
   * @param problems - every problem found, in the order they were found.
   */
  constructor(problems) {
    super(`xlsx-workbook: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'XlsxConfigError'
  }
}

/**
 * Read an optional positive whole number.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the value, or the default when absent or invalid.
 */
function optionalPositiveInteger(raw, key, problems) {
  const value = raw[key]
  if (value === undefined) return DEFAULTS[key]
  if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
    problems.push(`${key} must be a positive whole number`)
    return DEFAULTS[key]
  }
  return value
}

/**
 * Read an optional boolean.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the value, or the default when absent or invalid.
 */
function optionalBoolean(raw, key, problems) {
  const value = raw[key]
  if (value === undefined) return DEFAULTS[key]
  if (typeof value !== 'boolean') {
    problems.push(`${key} must be a boolean`)
    return DEFAULTS[key]
  }
  return value
}

/**
 * Validate the optional `theme` override onto the default look.
 * @param raw - the raw config object.
 * @param problems - collector for validation problems.
 * @returns the complete theme.
 */
function resolveTheme(raw, problems) {
  const input = raw['theme']
  if (input === undefined) return { ...DEFAULT_THEME }
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    problems.push('theme must be an object')
    return { ...DEFAULT_THEME }
  }
  const theme = { ...DEFAULT_THEME }
  for (const [key, value] of Object.entries(input)) {
    const accepts = THEME_FIELDS[key]
    if (accepts === undefined) {
      problems.push(`unknown theme field ${JSON.stringify(key)}`)
      continue
    }
    if (!accepts(value)) {
      const expected = key === 'fontName'
        ? 'a non-empty string'
        : key === 'fontSize' ? 'a whole number of points between 1 and 72' : 'an ARGB colour like FF1F3864'
      problems.push(`theme.${key} must be ${expected}`)
      continue
    }
    theme[key] = typeof value === 'string' && key !== 'fontName' ? value.toUpperCase() : value
  }
  return theme
}

/**
 * Validate a raw config value into a complete configuration.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {XlsxConfigError} listing every problem found.
 */
export function resolveConfig(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new XlsxConfigError(['config must be an object'])
  }
  const raw = input
  const problems = []

  const pythonBinRaw = raw['pythonBin']
  let pythonBin = DEFAULTS.pythonBin
  if (pythonBinRaw !== undefined) {
    if (typeof pythonBinRaw !== 'string' || pythonBinRaw.trim() === '') {
      problems.push('pythonBin must be a non-empty string')
    } else {
      pythonBin = pythonBinRaw
    }
  }

  const toolNameRaw = raw['toolName']
  let toolName = DEFAULTS.toolName
  if (toolNameRaw !== undefined) {
    if (typeof toolNameRaw !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(toolNameRaw)) {
      problems.push('toolName must be snake_case, starting with a letter, at most 64 characters')
    } else {
      toolName = toolNameRaw
    }
  }

  const timeoutMs = optionalPositiveInteger(raw, 'timeoutMs', problems)
  const graceMs = optionalPositiveInteger(raw, 'graceMs', problems)
  const maxSheets = optionalPositiveInteger(raw, 'maxSheets', problems)
  const maxRows = optionalPositiveInteger(raw, 'maxRows', problems)
  const maxColumns = optionalPositiveInteger(raw, 'maxColumns', problems)
  const maxOutputBytes = optionalPositiveInteger(raw, 'maxOutputBytes', problems)
  const registerSkill = optionalBoolean(raw, 'registerSkill', problems)
  const theme = resolveTheme(raw, problems)

  if (graceMs > timeoutMs) problems.push('graceMs must not exceed timeoutMs')
  // The format itself, not a preference: a worksheet cannot hold more.
  if (maxRows > 1_048_575) problems.push('maxRows must not exceed 1048575, the worksheet limit minus the header')
  if (maxColumns > 16_384) problems.push('maxColumns must not exceed 16384, the worksheet limit')

  for (const key of Object.keys(raw)) {
    // An ignored key reads as "the setting I wrote took effect", so an unknown
    // one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new XlsxConfigError(problems)

  return {
    pythonBin, toolName, timeoutMs, graceMs,
    maxSheets, maxRows, maxColumns, maxOutputBytes, registerSkill, theme,
  }
}
