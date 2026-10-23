/**
 * The plugin's single owner of "what token do we send to ALMA right now": the
 * signed-in user's own SSO access token, obtained from the gateway.
 *
 * ALMA accepts the token Keycloak issued at the SSO login, so there is no second
 * authorization here — no registration, no consent page, no grant of our own.
 * The gateway holds the session and renews it; this backend asks for the token
 * when it needs one, through the token broker the tenancy service told it about
 * at launch.
 *
 * The token is cached in memory until shortly before the expiry the gateway
 * reported, so most MCP requests cost no broker round trip. Nothing is written
 * to disk: a backend restart simply asks again.
 *
 * @module
 */

/** Variable carrying the broker URL; set by `@compliance/dsh-tenancy` on each backend. */
export const TOKEN_URL_ENV = 'COMPLIANCE_SSO_TOKEN_URL'

/** Variable carrying this backend's broker key; set alongside {@link TOKEN_URL_ENV}. */
export const TOKEN_KEY_ENV = 'COMPLIANCE_SSO_TOKEN_KEY'

/** How long to wait on the broker, which is a loopback hop in the same machine. */
const BROKER_TIMEOUT_MS = 10_000

/**
 * Read the broker's address and this backend's key from the environment.
 * @param env - the environment to read, `process.env` by default.
 * @returns `{ url, key }`, or undefined when this process was not started by
 * the tenancy service — a shared harness has no single user to ask for.
 */
export function readBroker(env = process.env) {
  const url = env[TOKEN_URL_ENV]
  const key = env[TOKEN_KEY_ENV]
  if (typeof url !== 'string' || url === '' || typeof key !== 'string' || key === '') return undefined
  return { url, key }
}

/**
 * Create the token source for one plugin instance.
 * @param ctx - plugin context, for its logger.
 * @param config - the validated row configuration.
 * @param broker - `{ url, key }` from {@link readBroker}.
 * @returns `{ bearer, status }`.
 */
export function createTokenSource(ctx, config, broker) {
  /** `{ accessToken, expiresAt }` as the gateway last answered. */
  let cached
  /** In-flight broker requests, one per kind, so a burst of MCP requests asks once. */
  const inFlight = new Map()
  /** The last problem worth showing on the status route. */
  let lastError

  /**
   * Ask the gateway for the user's token.
   * @param force - renew even a token the gateway considers fresh.
   * @returns the token, or undefined when the user has no live session.
   */
  async function request(force) {
    const url = force ? `${broker.url}?force=1` : broker.url
    let response
    try {
      response = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${broker.key}` },
        signal: AbortSignal.timeout(BROKER_TIMEOUT_MS),
      })
    } catch (error) {
      lastError = `the SSO token broker could not be reached: ${error instanceof Error ? error.message : String(error)}`
      ctx.logger.warn('alma-mcp: %s', lastError)
      return undefined
    }
    if (response.status === 401) {
      await response.body?.cancel()
      // The human signed out, idled out, or the session hit its deadline. The
      // next sign-in makes the next request work again; nothing to remount.
      cached = undefined
      lastError = 'no live SSO session for this user; they must sign in again'
      return undefined
    }
    if (!response.ok) {
      await response.body?.cancel()
      lastError = `the SSO token broker answered HTTP ${String(response.status)}`
      ctx.logger.warn('alma-mcp: %s', lastError)
      return undefined
    }
    const body = await response.json()
    if (typeof body?.accessToken !== 'string' || body.accessToken === '' || typeof body.expiresAt !== 'number') {
      lastError = 'the SSO token broker answered without a token'
      ctx.logger.warn('alma-mcp: %s', lastError)
      return undefined
    }
    cached = { accessToken: body.accessToken, expiresAt: body.expiresAt }
    lastError = undefined
    return cached.accessToken
  }

  /**
   * The access token to send right now.
   * @param options - `force: true` after ALMA refused a token that looked fresh.
   * @returns the bearer token, or undefined while the user has no live session.
   */
  async function bearer(options = {}) {
    const force = options.force === true
    if (!force && cached !== undefined && cached.expiresAt - config.refreshSkewSeconds * 1000 > Date.now()) {
      return cached.accessToken
    }
    const kind = force ? 'force' : 'plain'
    let pending = inFlight.get(kind)
    if (pending === undefined) {
      pending = request(force).finally(() => { inFlight.delete(kind) })
      inFlight.set(kind, pending)
    }
    return await pending
  }

  /**
   * What the status route reports. The token itself is never part of it.
   * @returns whether a token is held, until when, and the last problem.
   */
  function status() {
    return {
      source: 'sso',
      hasToken: cached !== undefined && cached.expiresAt > Date.now(),
      ...cached !== undefined && { expiresAt: cached.expiresAt },
      ...lastError !== undefined && { error: lastError },
    }
  }

  return { bearer, status }
}
