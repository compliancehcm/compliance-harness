/**
 * Compliance AI tenancy: one confined harness per authenticated user.
 *
 * This plugin provides the `tenancy` service that `sso-auth` consults. The
 * split is deliberate: authenticating a caller and deciding which harness that
 * caller gets are different concerns, and `sso-auth` stays useful on its own
 * (one shared harness behind a login) when this plugin is absent.
 *
 * What it does per user: create their directories, write their harness patch
 * layer, start a `dsh` backend confined by the OS to their own tree, and route
 * to it. What separates their data is mostly not code here — it is that each
 * backend gets its own `$DSH_HOME`, which is where the harness already keeps
 * sessions, workspaces, settings and credentials.
 */

import { mkdirSync } from 'node:fs'
import { resolveConfig } from './src/config.ts'
import { confinementProblem, launchSpec, resolveHarnessPaths } from './src/confine.ts'
import { linkPlugins, provision, userDirName, writeHomePatch } from './src/provision.ts'
import { startBackend } from './src/backend.ts'
import { BackendPool } from './src/pool.ts'
import type { Acquisition } from './src/pool.ts'
import type { CredentialsFacade, HostContext } from './src/host.ts'

/** Cordis plugin name. */
export const name = 'compliance-tenancy'

/** How often idle backends are reaped. */
const REAP_INTERVAL_MS = 60_000

/** What a caller must tell the service about the user. */
export interface TenantRequest {
  /** The `sub` claim — the stable per-user key. */
  readonly subject: string
  /** Whether this user reaches the administrative composition. */
  readonly admin: boolean
}

/** Where a request should be sent, or why it cannot be. */
export type TenantTarget =
  | { readonly kind: 'ready'; readonly host: string; readonly port: number }
  | { readonly kind: 'at-capacity'; readonly active: number; readonly max: number }
  | { readonly kind: 'failed'; readonly reason: string }

/** The service `sso-auth` injects. */
export interface TenancyService {
  /** Resolve (starting if needed) the backend that serves this user. */
  target: (request: TenantRequest) => Promise<TenantTarget>
  /** Note that a user opened or closed a long-lived connection. */
  trackSocket: (subject: string, delta: 1 | -1) => void
}

/**
 * Mount the tenancy service.
 * @param ctx - plugin context.
 * @param rawConfig - the row's `config` block, validated here.
 */
export async function apply(ctx: HostContext, rawConfig: unknown): Promise<void> {
  const config = resolveConfig(rawConfig)

  const problem = confinementProblem(config.confinement)
  if (problem !== undefined) {
    // Refusing to boot is the point. A tenancy plugin that starts without
    // working confinement would give every user a harness with the whole
    // machine readable, while the operator believes the opposite.
    throw new Error(
      `compliance-tenancy: confinement '${config.confinement}' is unusable: ${problem}. `
      + "Fix the host, or set confinement: 'none' to acknowledge running unconfined.",
    )
  }
  if (config.confinement === 'none') {
    ctx.logger.warn(
      'compliance-tenancy: confinement is DISABLED; every user\'s agent can read the whole machine',
    )
  }

  const harness = resolveHarnessPaths(config.harnessRoot)
  mkdirSync(config.usersRoot, { recursive: true, mode: 0o700 })

  // Administrative standing travels with each request, but the pool's starter
  // receives only a key, so the last-seen role per user is kept here. A change
  // takes effect on that user's next backend start — which is also the only
  // moment the composition it selects could differ.
  const admins = new Set<string>()

  const pool = new BackendPool({
    portRange: config.portRange,
    maxBackends: config.maxBackends,
    idleReapMs: config.idleReapMs,
    logger: ctx.logger as unknown as Pick<Console, 'info' | 'warn'>,
    starter: async (key, port) => {
      const paths = provision(config.usersRoot, key)
      writeHomePatch(paths, [])
      linkPlugins(paths, config.pluginPackages)
      const spec = launchSpec(paths, harness, {
        port,
        confinement: config.confinement,
        env: await backendCredentials(ctx, config.forwardCredentials),
        patches: admins.has(key) ? config.adminPatches : config.userPatches,
      })
      return await startBackend(spec, port, `${paths.root}/backend.log`)
    },
  })

  ctx.effect(() => {
    const timer = setInterval(() => { void pool.reapIdle() }, REAP_INTERVAL_MS)
    timer.unref()
    return () => { clearInterval(timer) }
  }, 'compliance-tenancy: idle reap')

  ctx.effect(() => () => { void pool.stopAll() }, 'compliance-tenancy: backend pool')

  const service: TenancyService = {
    target: async (request) => {
      const key = request.subject
      if (request.admin) admins.add(key)
      else admins.delete(key)
      return describe(await pool.acquire(key))
    },
    trackSocket: (subject, delta) => {
      const backend = pool.lookup(subject)
      if (backend === undefined) return
      // Clamped at zero: a close event can outlive its backend's restart, and a
      // negative count would make the reaper treat a genuinely idle backend as
      // permanently busy.
      backend.liveSockets = Math.max(0, backend.liveSockets + delta)
      backend.lastUsedAt = Date.now()
    },
  }

  ctx.provide('tenancy', service)
  ctx.logger.info(
    'compliance-tenancy: %s users root, confinement %s, up to %s backends on ports %s-%s',
    config.usersRoot, config.confinement, String(config.maxBackends),
    String(config.portRange[0]), String(config.portRange[1]),
  )
  await Promise.resolve()
}

/** Project a pool acquisition into the service's answer. */
function describe(acquisition: Acquisition): TenantTarget {
  switch (acquisition.kind) {
    case 'ready':
      return { kind: 'ready', host: '127.0.0.1', port: acquisition.backend.port }
    case 'at-capacity':
      return { kind: 'at-capacity', active: acquisition.active, max: acquisition.max }
    case 'failed':
      return { kind: 'failed', reason: acquisition.reason }
  }
}

/**
 * The credentials a backend is given.
 *
 * Each backend needs a provider credential to be useful, and it cannot have the
 * gateway's own environment (which carries the client secret and the gateway's
 * `DSH_*` values). So the forwarded set is named explicitly in configuration —
 * nothing is inherited by accident.
 *
 * Note what this means: a determined user can read these out of their own
 * backend's environment. That is an abuse and cost risk on the platform's
 * provider account, not a path to another user's data; the README says so
 * plainly and names the fix.
 */
async function backendCredentials(
  ctx: HostContext,
  names: readonly string[],
): Promise<Record<string, string>> {
  // Resolved through the credential store first, then the launch environment —
  // the same order the harness uses for its own `apiKeyEnv` references. Reading
  // only `process.env` would miss the usual case entirely, since the managed
  // store in `$DSH_HOME/.credentials.yaml` is deliberately never materialized
  // into the environment.
  const credentials = ctx.get<CredentialsFacade>('credentials')
  const env: Record<string, string> = {}
  for (const name of names) {
    const stored = credentials === undefined ? undefined : await credentials.resolve(name)
    const value = stored?.value ?? process.env[name]
    if (value !== undefined && value !== '') env[name] = value
    else ctx.logger.warn(`compliance-tenancy: forwardCredentials names ${name}, which resolves to nothing`)
  }
  return env
}

export { userDirName }
