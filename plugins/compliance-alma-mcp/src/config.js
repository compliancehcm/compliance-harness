/**
 * Plugin configuration and its validation.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, at load: every problem is collected and
 * reported in one throw, because a half-understood configuration would fail
 * later as an opaque OAuth or MCP error instead of as a boot error.
 *
 * @module
 */

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  serverName: 'alma',
  basePath: '/alma',
  scopes: ['openid', 'profile'],
  clientName: 'Compliance AI harness',
  refreshSkewSeconds: 120,
  failOnStartupError: false,
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS = new Set([
  'mcpUrl', 'publicUrl', 'serverName', 'basePath', 'resolveMcpClientFrom',
  'scopes', 'clientId', 'clientSecretEnv', 'clientName', 'refreshSkewSeconds',
  'failOnStartupError',
])

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class AlmaConfigError extends Error {
  /**
   * @param problems - every problem found, in the order they were found.
   */
  constructor(problems) {
    super(`alma-mcp: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'AlmaConfigError'
  }
}

/**
 * Read a field as a non-empty string, recording a problem when it is not.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the trimmed value, or the empty string when invalid.
 */
function requireString(raw, key, problems) {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} is required and must be a non-empty string`)
    return ''
  }
  return value.trim()
}

/**
 * Read an absolute http/https URL, dropping trailing slashes so joins stay unambiguous.
 * @param raw - the raw config object.
 * @param key - the field to read.
 * @param problems - collector for validation problems.
 * @returns the normalized URL, or the empty string when invalid.
 */
function requireUrl(raw, key, problems) {
  const value = requireString(raw, key, problems)
  if (value === '') return ''
  let parsed
  try {
    parsed = new URL(value)
  } catch {
    problems.push(`${key} must be an absolute URL, got ${JSON.stringify(value)}`)
    return ''
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    problems.push(`${key} must be http or https, got ${parsed.protocol}`)
    return ''
  }
  return value.replace(/\/+$/, '')
}

/**
 * Validate a raw config value into a complete configuration.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {AlmaConfigError} listing every problem found.
 */
export function resolveConfig(input) {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new AlmaConfigError(['config must be an object'])
  }
  const raw = input
  const problems = []

  const mcpUrl = requireUrl(raw, 'mcpUrl', problems)
  const publicUrl = requireUrl(raw, 'publicUrl', problems)
  const resolveMcpClientFrom = requireString(raw, 'resolveMcpClientFrom', problems)

  const serverNameRaw = raw['serverName']
  let serverName = DEFAULTS.serverName
  if (serverNameRaw !== undefined) {
    // The same grammar mcp-client enforces on its own `serverName`; rejecting
    // it here names the field instead of failing inside the mounted row.
    if (typeof serverNameRaw !== 'string' || !/^[A-Za-z0-9_-]{1,32}$/.test(serverNameRaw)) {
      problems.push('serverName must match [A-Za-z0-9_-]{1,32}')
    } else {
      serverName = serverNameRaw
    }
  }

  const basePathRaw = raw['basePath']
  let basePath = DEFAULTS.basePath
  if (basePathRaw !== undefined) {
    if (typeof basePathRaw !== 'string' || !/^\/[A-Za-z0-9._~/-]*[A-Za-z0-9._~-]$/.test(basePathRaw)) {
      problems.push('basePath must be an absolute path with no trailing slash, e.g. /alma')
    } else {
      basePath = basePathRaw
    }
  }

  const scopesRaw = raw['scopes']
  let scopes = DEFAULTS.scopes
  if (scopesRaw !== undefined) {
    if (!Array.isArray(scopesRaw) || scopesRaw.length === 0 || scopesRaw.some(entry => typeof entry !== 'string')) {
      problems.push('scopes must be a non-empty array of strings')
    } else {
      scopes = scopesRaw
    }
  }

  const clientIdRaw = raw['clientId']
  let clientId
  if (clientIdRaw !== undefined) {
    if (typeof clientIdRaw !== 'string' || clientIdRaw.trim() === '') {
      problems.push('clientId, when given, must be a non-empty string')
    } else {
      clientId = clientIdRaw.trim()
    }
  }

  const secretEnvRaw = raw['clientSecretEnv']
  let clientSecretEnv
  if (secretEnvRaw !== undefined) {
    if (typeof secretEnvRaw !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(secretEnvRaw)) {
      problems.push('clientSecretEnv must be an environment-variable name, not a secret value')
    } else {
      clientSecretEnv = secretEnvRaw
    }
  }
  if (clientSecretEnv !== undefined && clientId === undefined) {
    problems.push('clientSecretEnv without clientId: a secret belongs to a pinned client registration')
  }

  const clientNameRaw = raw['clientName']
  let clientName = DEFAULTS.clientName
  if (clientNameRaw !== undefined) {
    if (typeof clientNameRaw !== 'string' || clientNameRaw.trim() === '') {
      problems.push('clientName, when given, must be a non-empty string')
    } else {
      clientName = clientNameRaw.trim()
    }
  }

  const skewRaw = raw['refreshSkewSeconds']
  let refreshSkewSeconds = DEFAULTS.refreshSkewSeconds
  if (skewRaw !== undefined) {
    if (typeof skewRaw !== 'number' || !Number.isFinite(skewRaw) || skewRaw < 0) {
      problems.push('refreshSkewSeconds must be a non-negative number of seconds')
    } else {
      refreshSkewSeconds = skewRaw
    }
  }

  const failRaw = raw['failOnStartupError']
  let failOnStartupError = DEFAULTS.failOnStartupError
  if (failRaw !== undefined) {
    if (typeof failRaw !== 'boolean') {
      problems.push('failOnStartupError must be a boolean')
    } else {
      failOnStartupError = failRaw
    }
  }

  for (const key of Object.keys(raw)) {
    // An ignored key reads as "the setting I wrote took effect", so an unknown
    // one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new AlmaConfigError(problems)

  return {
    mcpUrl,
    publicUrl,
    resolveMcpClientFrom,
    serverName,
    basePath,
    scopes,
    ...clientId !== undefined && { clientId },
    ...clientSecretEnv !== undefined && { clientSecretEnv },
    clientName,
    refreshSkewSeconds,
    failOnStartupError,
    routes: {
      connect: `${basePath}/connect`,
      callback: `${basePath}/callback`,
      status: `${basePath}/status`,
      disconnect: `${basePath}/disconnect`,
      relay: `${basePath}/mcp`,
    },
    redirectUri: `${publicUrl}${basePath}/callback`,
  }
}
