/**
 * SSO gate for the dsh Web UI, host half.
 *
 * The plugin binds the public port and forwards to the harness webserver, which
 * the accompanying overlay moves to an OS-assigned loopback port. The gate is in
 * front of the listener rather than inside it because `ctx.webServer` exposes no
 * request-interception seam — see README.md for that analysis and for what this
 * design does and does not protect.
 *
 * There is no browser half: the login pages are server-rendered, and the session
 * travels as an HttpOnly cookie that the existing API clients already send.
 */

import { resolveConfig } from './src/config.ts'
import { SsoGate } from './src/gate.ts'
import { SessionStore } from './src/sessions.ts'
import { startProxy } from './src/proxy.ts'
import type { HostContext, WebStartupFacade } from './src/host.ts'

/** Cordis plugin name. */
export const name = 'sso-auth'

/**
 * Required service. `webStartup` is deliberately absent: it is optional, and the
 * row that supplies it does not exist under `dsh --help`, where nothing binds.
 */
export const inject = ['webServer']

/** How often expired sessions and abandoned login attempts are swept. */
const SWEEP_INTERVAL_MS = 60_000

/**
 * Mount the gate.
 *
 * The listener is bound inside `apply` rather than inside `ctx.effect` so that a
 * bind failure fails the boot. Registering it as an async effect instead makes
 * the rejection invisible: the harness keeps running, its webserver keeps
 * serving on the loopback port, and nothing is gated — a security plugin that
 * fails open in silence. Verified: with the public port already taken, the async
 * form logged nothing and left the tree serving.
 *
 * @param ctx - plugin context carrying the webserver whose port is proxied.
 * @param rawConfig - the row's `config` block, validated here.
 */
export async function apply(ctx: HostContext, rawConfig: unknown): Promise<void> {
  const config = resolveConfig(rawConfig)

  // `--port`/`--host` reach the app through webStartup. The overlay pins the
  // harness webserver to an OS-assigned loopback port, which removes its own
  // read of these values, so the flags are honoured here instead — otherwise
  // `dsh web --port 8080` would silently keep serving on the configured port.
  const startup = ctx.get<WebStartupFacade>('webStartup')
  const listen = {
    host: startup?.host ?? config.host,
    port: startup?.port ?? config.port,
  }

  const sessions = new SessionStore(config.sessionTtlMs, config.idleTimeoutMs)

  ctx.effect(() => {
    const timer = setInterval(() => { sessions.sweep() }, SWEEP_INTERVAL_MS)
    // An unref'd timer must not be the reason a shutting-down process lingers.
    timer.unref()
    return () => { clearInterval(timer) }
  }, 'sso-auth: session sweep')

  const gate = new SsoGate({
    config,
    sessions,
    resolveSecret: () => resolveClientSecret(ctx, config.clientSecretEnv),
    logger: ctx.logger as unknown as Pick<Console, 'info' | 'warn'>,
  })

  let proxy
  try {
    proxy = await startProxy({
      listen,
      publicAuthority: new URL(config.publicUrl).host,
      target: { host: '127.0.0.1', port: ctx.webServer.port },
      gate,
      logger: ctx.logger as unknown as Pick<Console, 'warn'>,
    })
  } catch (error) {
    throw new Error(
      `sso-auth: could not bind the public address ${listen.host}:${String(listen.port)}, so nothing would be `
      + 'gated; refusing to start. Free the port or set a different one on the sso-auth row.',
      { cause: error },
    )
  }
  ctx.effect(() => () => { void proxy.close() }, 'sso-auth: authenticating proxy')

  // The overlay silences the harness's own URL line, because that URL is the
  // internal ungated port and printing it hands every operator the bypass. The
  // gated URL therefore has to be printed here, and on stdout rather than
  // through ctx.logger: the shipped composition mounts no console exporter, so
  // a logger line is invisible and the operator would be left with no URL at
  // all. `console.log` is what the harness itself uses for this line.
  console.log(`dsh web: http://${listen.host}:${String(proxy.port)} (SSO gate; issuer ${config.issuer})`)
  ctx.logger.info(
    'sso-auth: gating %s → internal 127.0.0.1:%s',
    `http://${listen.host}:${String(proxy.port)}`, String(ctx.webServer.port),
  )
}

/**
 * Resolve the client secret from the credential store, then the environment.
 *
 * The order matches the harness convention for `apiKeyEnv`-style references
 * (`packages/web/web-search-deepseek/src/index.ts`): the managed store first, the
 * launch environment as the fallback, and no secret at all for a public client.
 *
 * @param ctx - plugin context, whose credential service is optional.
 * @param ref - the configured environment-variable name, if any.
 * @returns the secret, or undefined for a public PKCE-only client.
 */
async function resolveClientSecret(ctx: HostContext, ref: string | undefined): Promise<string | undefined> {
  if (ref === undefined) return undefined
  const credentials = ctx.get<{ resolve: (name: string) => Promise<{ value: string } | undefined> }>('credentials')
  if (credentials !== undefined) {
    const found = await credentials.resolve(ref)
    if (found !== undefined) return found.value
  }
  const fromEnv = process.env[ref]
  if (fromEnv !== undefined && fromEnv !== '') return fromEnv
  // Failing here rather than falling back to a public-client request makes the
  // cause obvious: a confidential client without its secret is refused by the
  // provider with an opaque invalid_client, which is much harder to diagnose.
  throw new Error(`sso-auth: clientSecretEnv ${ref} is configured but holds no value`)
}
