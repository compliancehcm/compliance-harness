/**
 * Plugin configuration and its validation.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, at load: every problem is collected and
 * reported in one throw, because a half-understood configuration would surface
 * later as a rejected tool call rather than as a boot error.
 *
 * @module
 */

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  pythonBin: 'python3',
  toolName: 'run_pandas',
  timeoutMs: 120_000,
  graceMs: 5_000,
  maxSources: 4,
  maxCodeBytes: 16_384,
  maxPreviewRows: 20,
  maxOutputBytes: 32_768,
  registerSkill: true,
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS = new Set([
  'pythonBin', 'toolName', 'timeoutMs', 'graceMs',
  'maxSources', 'maxCodeBytes', 'maxPreviewRows', 'maxOutputBytes', 'registerSkill',
])

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class PandasConfigError extends Error {
  /**
   * @param problems - every problem found, in the order they were found.
   */
  constructor(problems) {
    super(`pandas-analysis: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'PandasConfigError'
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
 * Read an optional non-empty string.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the value, or the default when absent or invalid.
 */
function optionalString(raw, key, problems) {
  const value = raw[key]
  if (value === undefined) return DEFAULTS[key]
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} must be a non-empty string`)
    return DEFAULTS[key]
  }
  return value
}

/**
 * Validate a raw config value into a complete configuration.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {PandasConfigError} listing every problem found.
 */
export function resolveConfig(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new PandasConfigError(['config must be an object'])
  }
  const raw = input
  const problems = []

  const pythonBin = optionalString(raw, 'pythonBin', problems)

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
  const maxSources = optionalPositiveInteger(raw, 'maxSources', problems)
  const maxCodeBytes = optionalPositiveInteger(raw, 'maxCodeBytes', problems)
  const maxPreviewRows = optionalPositiveInteger(raw, 'maxPreviewRows', problems)
  const maxOutputBytes = optionalPositiveInteger(raw, 'maxOutputBytes', problems)
  const registerSkill = optionalBoolean(raw, 'registerSkill', problems)

  if (graceMs > timeoutMs) problems.push('graceMs must not exceed timeoutMs')

  for (const key of Object.keys(raw)) {
    // An ignored key reads as "the setting I wrote took effect", so an unknown
    // one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new PandasConfigError(problems)

  return {
    pythonBin, toolName, timeoutMs, graceMs,
    maxSources, maxCodeBytes, maxPreviewRows, maxOutputBytes, registerSkill,
  }
}
