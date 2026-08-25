/**
 * Plugin configuration and its validation.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, at load: every problem is collected and
 * reported in one throw, because a half-understood configuration would surface
 * later as a rejected tool call or a 404 on the asset route instead of as a boot
 * error.
 *
 * @module
 */

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  assetPath: '/echarts/echarts.min.js',
  toolName: 'render_chart',
  maxOptionBytes: 262_144,
  maxSeries: 12,
  defaultHeight: 320,
  minHeight: 160,
  maxHeight: 720,
  registerSkill: true,
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS = new Set([
  'assetPath', 'toolName', 'maxOptionBytes', 'maxSeries',
  'defaultHeight', 'minHeight', 'maxHeight', 'registerSkill',
])

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class EchartsConfigError extends Error {
  /**
   * @param problems - every problem found, in the order they were found.
   */
  constructor(problems) {
    super(`echarts-charts: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'EchartsConfigError'
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
 * Validate a raw config value into a complete configuration.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {EchartsConfigError} listing every problem found.
 */
export function resolveConfig(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new EchartsConfigError(['config must be an object'])
  }
  const raw = input
  const problems = []

  const assetPathRaw = raw['assetPath']
  let assetPath = DEFAULTS.assetPath
  if (assetPathRaw !== undefined) {
    // An absolute path with no trailing slash, the same grammar the webserver's
    // exact routes assume. It must also not collide with the RPC plane, which
    // the SSO gate fences to administrators.
    if (typeof assetPathRaw !== 'string' || !/^\/[A-Za-z0-9._~/-]*[A-Za-z0-9._~-]$/.test(assetPathRaw)) {
      problems.push('assetPath must be an absolute path with no trailing slash, e.g. /echarts/echarts.min.js')
    } else {
      assetPath = assetPathRaw
    }
  }

  const toolNameRaw = raw['toolName']
  let toolName = DEFAULTS.toolName
  if (toolNameRaw !== undefined) {
    // The wire tool name is also the client's `tool.call.toolview` key, so the
    // two halves must agree; the client half reads it from the boot global this
    // config feeds rather than repeating the literal.
    if (typeof toolNameRaw !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(toolNameRaw)) {
      problems.push('toolName must be snake_case, starting with a letter, at most 64 characters')
    } else {
      toolName = toolNameRaw
    }
  }

  const maxOptionBytes = optionalPositiveInteger(raw, 'maxOptionBytes', problems)
  const maxSeries = optionalPositiveInteger(raw, 'maxSeries', problems)
  const minHeight = optionalPositiveInteger(raw, 'minHeight', problems)
  const maxHeight = optionalPositiveInteger(raw, 'maxHeight', problems)
  const defaultHeight = optionalPositiveInteger(raw, 'defaultHeight', problems)
  const registerSkill = optionalBoolean(raw, 'registerSkill', problems)

  if (minHeight > maxHeight) problems.push('minHeight must not exceed maxHeight')
  if (defaultHeight < minHeight || defaultHeight > maxHeight) {
    problems.push('defaultHeight must lie within [minHeight, maxHeight]')
  }

  for (const key of Object.keys(raw)) {
    // An ignored key reads as "the setting I wrote took effect", so an unknown
    // one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new EchartsConfigError(problems)

  return {
    assetPath, toolName, maxOptionBytes, maxSeries,
    defaultHeight, minHeight, maxHeight, registerSkill,
  }
}
