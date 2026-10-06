/**
 * Plugin configuration and its validation.
 *
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package, so the
 * Loader cannot validate this row's `config` against a declared schema. The
 * validation therefore happens here, and it happens at load: every problem is
 * collected and reported in one throw, because a security gate that boots with a
 * half-understood configuration is worse than one that refuses to boot.
 */

/** The claim requirement a caller must satisfy after authenticating. */
export interface ClaimRequirement {
  /** Dot path into the token payload, e.g. `realm_access.roles`. */
  readonly claimPath: string
  /**
   * Accepted values. The claim matches when it equals one of these, or — when
   * the claim is an array, as Keycloak's role claims are — when it contains one.
   */
  readonly anyOf: readonly string[]
}

/**
 * Where the user's GREMP_ID (Grupo de Empresas) comes from: an attribute of the
 * Keycloak Organization the user signed in as a member of.
 *
 * Keycloak maps organization membership into the `organization` claim only when
 * the `organization` scope is requested, and carries the organization's
 * attributes in it only when the scope's *Organization Membership* mapper has
 * *Add organization attributes* enabled.
 */
export interface GrempIdSource {
  /** Name of the organization attribute holding the GREMP_ID, e.g. `gremp_id`. */
  readonly organizationAttribute: string
  /**
   * Whether a login without a resolvable GREMP_ID is refused. A user outside
   * every organization, or in several with different values, is then denied
   * instead of entering with no tenant.
   */
  readonly required: boolean
}

/** Validated plugin configuration. */
export interface SsoConfig {
  /** OIDC issuer, e.g. `https://keycloak.example/realms/dsh`. Discovery hangs off it. */
  readonly issuer: string
  /** OAuth client id registered at the issuer. */
  readonly clientId: string
  /**
   * Name of the environment variable or credential reference holding the client
   * secret. Absent selects a public client, which is PKCE-only.
   */
  readonly clientSecretEnv?: string
  /** Public origin browsers reach, and the base of the redirect URI. */
  readonly publicUrl: string
  /** Public listen host. Defaults to loopback; widening it is a deliberate act. */
  readonly host: string
  /** Public listen port. */
  readonly port: number
  /**
   * Scopes requested; `openid` is always included, and `organization` too when
   * {@link SsoConfig.grempId} is set and no organization scope was written.
   */
  readonly scopes: readonly string[]
  /** Claim requirement, or absent to admit any authenticated user. */
  readonly require?: ClaimRequirement
  /**
   * Claim requirement that grants administrative access. Absent means nobody is
   * an administrator, which is the safe default: the privileged surface is then
   * refused for everyone rather than open to everyone.
   */
  readonly admin?: ClaimRequirement
  /** Where the GREMP_ID comes from, or absent to not resolve one. */
  readonly grempId?: GrempIdSource
  /** Absolute session lifetime, after which re-authentication is required. */
  readonly sessionTtlMs: number
  /** Idle lifetime, after which an untouched session is dropped. */
  readonly idleTimeoutMs: number
}

/** Defaults for every field a deployment may omit. */
const DEFAULTS = {
  host: '127.0.0.1',
  port: 3080,
  scopes: ['openid', 'profile', 'email'],
  sessionTtlMinutes: 480,
  idleTimeoutMinutes: 60,
} as const

/** Raised when the row's config cannot be understood. Lists every problem at once. */
export class SsoConfigError extends Error {
  constructor(problems: readonly string[]) {
    super(`sso-auth: invalid configuration:\n${problems.map(problem => `  - ${problem}`).join('\n')}`)
    this.name = 'SsoConfigError'
  }
}

/** Read a field as a non-empty string, recording a problem when it is not. */
function requireString(raw: Record<string, unknown>, key: string, problems: string[]): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} is required and must be a non-empty string`)
    return ''
  }
  return value.trim()
}

/** Read an http/https origin, dropping a trailing slash so joins stay unambiguous. */
function requireOrigin(raw: Record<string, unknown>, key: string, problems: string[]): string {
  const value = requireString(raw, key, problems)
  if (value === '') return ''
  let parsed: URL
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

/** Read a positive-minutes field as milliseconds, defaulting when absent. */
function readMinutes(
  raw: Record<string, unknown>,
  key: string,
  fallbackMinutes: number,
  problems: string[],
): number {
  const value = raw[key]
  if (value === undefined) return fallbackMinutes * 60_000
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) {
    problems.push(`${key} must be a positive number of minutes`)
    return fallbackMinutes * 60_000
  }
  return value * 60_000
}

/** Read an optional claim requirement stored under `key`. */
function readRequirement(
  raw: Record<string, unknown>,
  key: string,
  problems: string[],
): ClaimRequirement | undefined {
  const value = raw[key]
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    problems.push(`${key} must be an object with claimPath and anyOf`)
    return undefined
  }
  const record = value as Record<string, unknown>
  const claimPath = requireString(record, 'claimPath', problems)
  const anyOf = record['anyOf']
  if (!Array.isArray(anyOf) || anyOf.length === 0 || anyOf.some(entry => typeof entry !== 'string')) {
    problems.push(`${key}.anyOf must be a non-empty array of strings`)
    return undefined
  }
  if (claimPath === '') return undefined
  return { claimPath, anyOf: anyOf as readonly string[] }
}

/** The organization attribute read when `grempId` names none. */
const DEFAULT_GREMP_ATTRIBUTE = 'gremp_id'

/** Every field the `grempId` block understands. */
const KNOWN_GREMP_FIELDS: ReadonlySet<string> = new Set(['organizationAttribute', 'required'])

/** Read the optional `grempId` block. */
function readGrempId(raw: Record<string, unknown>, problems: string[]): GrempIdSource | undefined {
  const value = raw['grempId']
  if (value === undefined) return undefined
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    problems.push('grempId must be an object with organizationAttribute and required')
    return undefined
  }
  const record = value as Record<string, unknown>
  for (const key of Object.keys(record)) {
    if (!KNOWN_GREMP_FIELDS.has(key)) problems.push(`unknown field grempId.${key}`)
  }
  let organizationAttribute = DEFAULT_GREMP_ATTRIBUTE
  if (record['organizationAttribute'] !== undefined) {
    organizationAttribute = requireString(record, 'organizationAttribute', problems)
  }
  const requiredRaw = record['required']
  if (requiredRaw !== undefined && typeof requiredRaw !== 'boolean') {
    problems.push('grempId.required must be true or false')
  }
  // Absent means required: writing the block says the tenant matters, and a
  // session without one is the failure that has to be loud.
  return { organizationAttribute, required: requiredRaw !== false }
}

/**
 * Keycloak's three spellings of the organization scope. They may not be mixed —
 * Keycloak rejects the authorization request — so mixing them is refused here,
 * at load, rather than as an opaque `invalid_scope` on every login.
 */
function organizationScopeKind(scope: string): 'single' | 'all' | 'alias' | undefined {
  if (scope === 'organization') return 'single'
  if (scope === 'organization:*') return 'all'
  if (scope.startsWith('organization:') && scope.length > 'organization:'.length) return 'alias'
  return undefined
}

/** Every field this plugin understands; anything else is a rejection. */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  'issuer', 'clientId', 'clientSecretEnv', 'publicUrl', 'host', 'port',
  'scopes', 'require', 'admin', 'grempId', 'sessionTtlMinutes', 'idleTimeoutMinutes',
])

/**
 * Validate a raw config value into a complete {@link SsoConfig}.
 * @param input - the row's `config` block, of unknown shape at this boundary.
 * @returns the validated configuration with every default applied.
 * @throws {SsoConfigError} listing every problem found.
 */
export function resolveConfig(input: unknown): SsoConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new SsoConfigError(['config must be an object'])
  }
  const raw = input as Record<string, unknown>
  const problems: string[] = []

  const issuer = requireOrigin(raw, 'issuer', problems)
  const clientId = requireString(raw, 'clientId', problems)
  const publicUrl = requireOrigin(raw, 'publicUrl', problems)

  const secretEnvRaw = raw['clientSecretEnv']
  let clientSecretEnv: string | undefined
  if (secretEnvRaw !== undefined) {
    if (typeof secretEnvRaw !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/.test(secretEnvRaw)) {
      problems.push('clientSecretEnv must be an environment-variable name, not a secret value')
    } else {
      clientSecretEnv = secretEnvRaw
    }
  }

  const hostRaw = raw['host']
  let host: string = DEFAULTS.host
  if (hostRaw !== undefined) {
    if (hostRaw !== '127.0.0.1' && hostRaw !== '0.0.0.0') {
      problems.push(`host must be 127.0.0.1 or 0.0.0.0, got ${JSON.stringify(hostRaw)}`)
    } else {
      host = hostRaw
    }
  }

  const portRaw = raw['port']
  let port: number = DEFAULTS.port
  if (portRaw !== undefined) {
    if (typeof portRaw !== 'number' || !Number.isInteger(portRaw) || portRaw < 0 || portRaw > 65535) {
      problems.push('port must be an integer between 0 and 65535')
    } else {
      port = portRaw
    }
  }

  const scopesRaw = raw['scopes']
  let scopes: readonly string[] = DEFAULTS.scopes
  if (scopesRaw !== undefined) {
    if (!Array.isArray(scopesRaw) || scopesRaw.some(entry => typeof entry !== 'string')) {
      problems.push('scopes must be an array of strings')
    } else {
      scopes = scopesRaw as readonly string[]
    }
  }
  if (!scopes.includes('openid')) scopes = ['openid', ...scopes]

  const requirement = readRequirement(raw, 'require', problems)
  const adminRequirement = readRequirement(raw, 'admin', problems)
  const grempId = readGrempId(raw, problems)

  const organizationKinds = new Set(scopes.map(organizationScopeKind).filter(kind => kind !== undefined))
  if (organizationKinds.size > 1) {
    problems.push(
      'scopes mixes organization scope formats (organization, organization:*, organization:<alias>), '
      + 'which Keycloak rejects; keep one',
    )
  }
  // The plain scope, not `organization:*`: a member of several organizations is
  // then asked to pick one at login, which is what makes the GREMP_ID single.
  if (grempId !== undefined && organizationKinds.size === 0) scopes = [...scopes, 'organization']
  const sessionTtlMs = readMinutes(raw, 'sessionTtlMinutes', DEFAULTS.sessionTtlMinutes, problems)
  const idleTimeoutMs = readMinutes(raw, 'idleTimeoutMinutes', DEFAULTS.idleTimeoutMinutes, problems)

  for (const key of Object.keys(raw)) {
    // An ignored key in a security gate reads as "the setting I wrote took
    // effect", so an unknown one is a rejection rather than a warning.
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new SsoConfigError(problems)

  return {
    issuer,
    clientId,
    ...clientSecretEnv !== undefined && { clientSecretEnv },
    publicUrl,
    host,
    port,
    scopes,
    ...requirement !== undefined && { require: requirement },
    ...adminRequirement !== undefined && { admin: adminRequirement },
    ...grempId !== undefined && { grempId },
    sessionTtlMs,
    idleTimeoutMs,
  }
}

/** The redirect URI derived from `publicUrl`; must match the IdP client exactly. */
export function redirectUri(config: SsoConfig): string {
  return `${config.publicUrl}/auth/callback`
}
