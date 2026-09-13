/**
 * Plugin configuration and its validation, including the artifact's own CSP.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, at load: every problem is collected and
 * reported in one throw, because a half-understood configuration would surface
 * later as a page that silently fails to load a library.
 *
 * @module
 */
import { join } from 'node:path'
import { tmpdir } from 'node:os'

/**
 * Script and style origins the artifact document may load.
 *
 * This is the deployment's egress decision as much as a code one: the USER's
 * browser must reach these hosts, so on a closed corporate network the page
 * breaks. Kept short on purpose — every entry is a host trusted to execute code
 * inside the artifact frame.
 */
const DEFAULT_CDNS = [
  'https://cdn.jsdelivr.net',
  'https://cdnjs.cloudflare.com',
  'https://unpkg.com',
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com',
  'https://fonts.gstatic.com',
]

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  routePath: '/artifacts',
  createToolName: 'create_artifact',
  updateToolName: 'update_artifact',
  maxHtmlBytes: 524_288,
  maxVersions: 50,
  registerSkill: true,
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS = new Set([
  'routePath', 'createToolName', 'updateToolName',
  'maxHtmlBytes', 'maxVersions', 'registerSkill', 'root', 'allowedOrigins',
])

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class ArtifactsConfigError extends Error {
  /**
   * @param problems - every problem found, in the order they were found.
   */
  constructor(problems) {
    super(`artifacts: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'ArtifactsConfigError'
  }
}

/**
 * The directory artifacts are written under when the row names none.
 *
 * `DSH_HOME` rather than the session workspace: an artifact is a product of the
 * conversation, not a file of the user's project, and writing into the project
 * would put generated pages into their repository.
 * @returns an absolute directory path.
 */
function defaultRoot() {
  const home = process.env['DSH_HOME']
  return home === undefined || home.trim() === ''
    ? join(tmpdir(), 'dsh-artifacts')
    : join(home, 'artifacts')
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
 * Read an optional snake_case tool name.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the value, or the default when absent or invalid.
 */
function optionalToolName(raw, key, problems) {
  const value = raw[key]
  if (value === undefined) return DEFAULTS[key]
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_]{0,63}$/.test(value)) {
    problems.push(`${key} must be snake_case, starting with a letter, at most 64 characters`)
    return DEFAULTS[key]
  }
  return value
}

/**
 * Validate the optional CDN allowlist.
 * @param raw - the raw config object.
 * @param problems - collector for validation problems.
 * @returns the origins, defaulted when absent.
 */
function resolveOrigins(raw, problems) {
  const value = raw['allowedOrigins']
  if (value === undefined) return [...DEFAULT_CDNS]
  if (!Array.isArray(value)) {
    problems.push('allowedOrigins must be an array of https origins')
    return [...DEFAULT_CDNS]
  }
  const origins = []
  for (const entry of value) {
    // An origin only — no path, no trailing slash. A CSP source with a path
    // silently matches differently from one without, so reject the ambiguity
    // rather than normalize it.
    if (typeof entry !== 'string' || !/^https:\/\/[a-z0-9.-]+(:\d+)?$/i.test(entry)) {
      problems.push(`allowedOrigins entry ${JSON.stringify(entry)} must be an https origin with no path, e.g. https://cdn.jsdelivr.net`)
      continue
    }
    origins.push(entry)
  }
  return origins
}

/**
 * Build the artifact document's Content-Security-Policy.
 *
 * This policy governs the ARTIFACT frame only — it is a response header on the
 * artifact route, never on the app document. Serving it from a real URL rather
 * than through `srcdoc` is what makes that separation possible: a `srcdoc` frame
 * inherits the embedder's policy, so the allowlist would have to be granted to
 * the whole application.
 *
 * `'unsafe-inline'` and `'unsafe-eval'` are unavoidable here: the model writes
 * inline `<script>` and inline styles, and the Tailwind play CDN compiles at
 * runtime. They are safe only because the frame is sandboxed WITHOUT
 * `allow-same-origin`, so the document has an opaque origin and reaches no
 * cookie, no storage and no session of the app that embeds it.
 * @param origins - the validated allowlist.
 * @returns the header value.
 */
export function contentSecurityPolicy(origins) {
  const sources = origins.join(' ')
  return [
    "default-src 'none'",
    `script-src 'unsafe-inline' 'unsafe-eval' ${sources}`,
    `style-src 'unsafe-inline' ${sources}`,
    `font-src data: ${sources}`,
    `img-src data: blob: ${sources}`,
    // The artifact presents data it was given; it has no business calling
    // anything, and this is what keeps a generated page from exfiltrating what
    // it was shown.
    "connect-src 'none'",
    "frame-ancestors 'self'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join('; ')
}

/**
 * Validate a raw config value into a complete configuration.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {ArtifactsConfigError} listing every problem found.
 */
export function resolveConfig(input = {}) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new ArtifactsConfigError(['config must be an object'])
  }
  const raw = input
  const problems = []

  const routePathRaw = raw['routePath']
  let routePath = DEFAULTS.routePath
  if (routePathRaw !== undefined) {
    if (typeof routePathRaw !== 'string' || !/^\/[A-Za-z0-9._~/-]*[A-Za-z0-9._~-]$/.test(routePathRaw)) {
      problems.push('routePath must be an absolute path with no trailing slash, e.g. /artifacts')
    } else {
      routePath = routePathRaw
    }
  }

  const rootRaw = raw['root']
  let root = defaultRoot()
  if (rootRaw !== undefined) {
    if (typeof rootRaw !== 'string' || rootRaw.trim() === '') {
      problems.push('root must be a non-empty absolute path')
    } else {
      root = rootRaw
    }
  }

  const createToolName = optionalToolName(raw, 'createToolName', problems)
  const updateToolName = optionalToolName(raw, 'updateToolName', problems)
  const maxHtmlBytes = optionalPositiveInteger(raw, 'maxHtmlBytes', problems)
  const maxVersions = optionalPositiveInteger(raw, 'maxVersions', problems)
  const registerSkill = optionalBoolean(raw, 'registerSkill', problems)
  const allowedOrigins = resolveOrigins(raw, problems)

  if (createToolName === updateToolName) {
    // The client half keys one toolview per name; two rows sharing a name would
    // make the second registration throw at slot level, far from the cause.
    problems.push('createToolName and updateToolName must differ')
  }

  for (const key of Object.keys(raw)) {
    // An ignored key reads as "the setting I wrote took effect", so an unknown
    // one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new ArtifactsConfigError(problems)

  return {
    routePath, root, createToolName, updateToolName,
    maxHtmlBytes, maxVersions, registerSkill, allowedOrigins,
    csp: contentSecurityPolicy(allowedOrigins),
  }
}
