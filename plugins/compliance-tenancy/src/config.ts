/**
 * Tenancy configuration and its validation.
 *
 * Validated here rather than by a schema, for the same reason as `sso-auth`:
 * `@deepseek-ai/schemastery` is not resolvable from a `plugins/` package. Every
 * problem is collected and thrown at once, and an unknown field is a rejection —
 * in a plugin that decides who is isolated from whom, a silently ignored setting
 * reads as a setting that took effect.
 */

import type { Confinement } from './confine.ts'

/** Validated tenancy configuration. */
export interface TenancyConfig {
  /** Root directory holding one subdirectory per user. */
  readonly usersRoot: string
  /** The harness checkout or install, mounted read-only into every backend. */
  readonly harnessRoot: string
  /** How a backend process is confined. */
  readonly confinement: Confinement
  /** Inclusive port range backends are allocated from. */
  readonly portRange: readonly [number, number]
  /** Most backends alive at once; beyond it a user waits. */
  readonly maxBackends: number
  /** Idle time after which a backend is stopped. */
  readonly idleReapMs: number
  /** Credential references handed to every backend. */
  readonly forwardCredentials: readonly string[]
  /** `--patch` overlays for an ordinary user's backend. */
  readonly userPatches: readonly string[]
  /** `--patch` overlays for an administrator's backend. */
  readonly adminPatches: readonly string[]
  /**
   * Absolute directories of this deployment's own plugin packages, linked into
   * every user's profile so the overlays above can name them.
   */
  readonly pluginPackages: readonly string[]
}

/** Defaults for every omitted field. */
const DEFAULTS = {
  confinement: 'bwrap',
  portRange: [31000, 31200],
  maxBackends: 12,
  idleReapMinutes: 15,
} as const

/** Raised when the row's config cannot be understood. */
export class TenancyConfigError extends Error {
  constructor(problems: readonly string[]) {
    super(`compliance-tenancy: invalid configuration:\n${problems.map(p => `  - ${p}`).join('\n')}`)
    this.name = 'TenancyConfigError'
  }
}

/** Read a required absolute path. */
function requireAbsolutePath(raw: Record<string, unknown>, key: string, problems: string[]): string {
  const value = raw[key]
  if (typeof value !== 'string' || value.trim() === '') {
    problems.push(`${key} is required and must be a non-empty string`)
    return ''
  }
  const trimmed = value.trim()
  if (!trimmed.startsWith('/')) {
    problems.push(`${key} must be an absolute path, got ${JSON.stringify(trimmed)}`)
    return ''
  }
  return trimmed.replace(/\/+$/, '')
}

/** Read a string array, defaulting to empty. */
function readStrings(raw: Record<string, unknown>, key: string, problems: string[]): readonly string[] {
  const value = raw[key]
  if (value === undefined) return []
  if (!Array.isArray(value) || value.some(entry => typeof entry !== 'string')) {
    problems.push(`${key} must be an array of strings`)
    return []
  }
  return value as readonly string[]
}

/** Every field this plugin understands. */
const KNOWN_FIELDS: ReadonlySet<string> = new Set([
  'usersRoot', 'harnessRoot', 'confinement', 'portRange', 'maxBackends',
  'idleReapMinutes', 'forwardCredentials', 'userPatches', 'adminPatches',
  'pluginPackages',
])

/**
 * Validate a raw config value.
 * @param input - the row's `config` block.
 * @returns the validated configuration.
 * @throws {TenancyConfigError} listing every problem.
 */
export function resolveConfig(input: unknown): TenancyConfig {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) {
    throw new TenancyConfigError(['config must be an object'])
  }
  const raw = input as Record<string, unknown>
  const problems: string[] = []

  const usersRoot = requireAbsolutePath(raw, 'usersRoot', problems)
  const harnessRoot = requireAbsolutePath(raw, 'harnessRoot', problems)

  const confinementRaw = raw['confinement']
  let confinement: Confinement = DEFAULTS.confinement
  if (confinementRaw !== undefined) {
    if (confinementRaw !== 'bwrap' && confinementRaw !== 'none') {
      problems.push(`confinement must be 'bwrap' or 'none', got ${JSON.stringify(confinementRaw)}`)
    } else {
      confinement = confinementRaw
    }
  }

  const rangeRaw = raw['portRange']
  let portRange: readonly [number, number] = DEFAULTS.portRange
  if (rangeRaw !== undefined) {
    const valid = Array.isArray(rangeRaw) && rangeRaw.length === 2
      && rangeRaw.every(entry => typeof entry === 'number' && Number.isInteger(entry)
        && entry > 0 && entry < 65536)
      && (rangeRaw[0] as number) <= (rangeRaw[1] as number)
    if (!valid) problems.push('portRange must be [from, to] with from <= to, both valid ports')
    else portRange = [rangeRaw[0] as number, rangeRaw[1] as number]
  }

  const maxRaw = raw['maxBackends']
  let maxBackends: number = DEFAULTS.maxBackends
  if (maxRaw !== undefined) {
    if (typeof maxRaw !== 'number' || !Number.isInteger(maxRaw) || maxRaw < 1) {
      problems.push('maxBackends must be a positive integer')
    } else {
      maxBackends = maxRaw
    }
  }

  const idleRaw = raw['idleReapMinutes']
  let idleReapMs = DEFAULTS.idleReapMinutes * 60_000
  if (idleRaw !== undefined) {
    if (typeof idleRaw !== 'number' || !Number.isFinite(idleRaw) || idleRaw <= 0) {
      problems.push('idleReapMinutes must be a positive number')
    } else {
      idleReapMs = idleRaw * 60_000
    }
  }

  const forwardCredentials = readStrings(raw, 'forwardCredentials', problems)
  for (const name of forwardCredentials) {
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
      problems.push(`forwardCredentials entry ${JSON.stringify(name)} must be a credential reference name, not a value`)
    }
  }

  const userPatches = readStrings(raw, 'userPatches', problems)
  const adminPatches = readStrings(raw, 'adminPatches', problems)
  const pluginPackages = readStrings(raw, 'pluginPackages', problems)

  if (portRange[1] - portRange[0] + 1 < maxBackends) {
    // Caught here rather than as a per-user "no free port" failure much later,
    // which would look like a bug instead of a configuration mistake.
    problems.push(
      `portRange holds ${String(portRange[1] - portRange[0] + 1)} ports but maxBackends is ${String(maxBackends)}`,
    )
  }

  for (const key of Object.keys(raw)) {
    if (!KNOWN_FIELDS.has(key)) problems.push(`unknown field ${JSON.stringify(key)}`)
  }

  if (problems.length > 0) throw new TenancyConfigError(problems)

  return {
    usersRoot,
    harnessRoot,
    confinement,
    portRange,
    maxBackends,
    idleReapMs,
    forwardCredentials,
    userPatches,
    adminPatches,
    pluginPackages,
  }
}
