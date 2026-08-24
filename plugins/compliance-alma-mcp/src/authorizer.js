/**
 * The plugin's single owner of "what token do we send to ALMA right now".
 *
 * Everything that needs authorization — the connect and callback routes, the
 * relay, the status page — goes through one authorizer, so the client
 * registration, the discovery cache, the pending PKCE attempts and the refresh
 * are decided in one place instead of three.
 *
 * @module
 */

import { discover, exchangeCode, refreshTokens, registerClient, RefreshRejectedError, startAuthorization } from './oauth.js'
import { accessTokenIsFresh, forgetTokens, modifyGrant, readGrant } from './tokens.js'

/** How long an unfinished login attempt is remembered. */
const ATTEMPT_TTL_MS = 10 * 60_000

/**
 * Create the authorizer for one plugin instance.
 * @param ctx - plugin context carrying `ctx.credentials` and `ctx.logger`.
 * @param config - the validated row configuration.
 * @param onGrantLost - called after a grant is discovered dead, so its tools go
 * away with it instead of staying registered and failing every call.
 * @returns the authorizer.
 */
export function createAuthorizer(ctx, config, onGrantLost = async () => {}) {
  /** Pending login attempts, keyed by the `state` the server will echo back. */
  const attempts = new Map()
  /** Memoized discovery; cleared on failure so a later attempt rediscovers. */
  let discovery
  /** The last authorization problem worth showing on the status page. */
  let lastError

  /**
   * Discover the authorization server once per process.
   * @returns `{ resource, metadata }` for the configured MCP endpoint.
   */
  async function discovered() {
    if (discovery === undefined) {
      discovery = discover(config.mcpUrl).catch((error) => {
        discovery = undefined
        throw error
      })
    }
    return discovery
  }

  /**
   * The client identity to authorize as: the pinned one, the registered one, or
   * a fresh dynamic registration persisted for next time.
   * @param metadata - the authorization server's metadata.
   * @returns `{ clientId, clientSecret? }`.
   */
  async function clientIdentity(metadata) {
    if (config.clientId !== undefined) {
      if (config.clientSecretEnv === undefined) return { clientId: config.clientId }
      const resolved = await ctx.credentials.resolve(config.clientSecretEnv)
      if (resolved === undefined) {
        throw new Error(
          `alma-mcp: clientSecretEnv names ${config.clientSecretEnv}, which is not configured in this environment`,
        )
      }
      return { clientId: config.clientId, clientSecret: resolved.value }
    }
    const stored = await readGrant(ctx)
    if (stored !== undefined && typeof stored.clientId === 'string' && stored.clientId !== '') {
      return {
        clientId: stored.clientId,
        ...typeof stored.clientSecret === 'string' && { clientSecret: stored.clientSecret },
      }
    }
    const registered = await registerClient(metadata, {
      redirectUri: config.redirectUri,
      clientName: config.clientName,
      scopes: config.scopes,
    })
    ctx.logger.info('alma-mcp: registered this workspace with ALMA as client %s', registered.clientId)
    await modifyGrant(ctx, async current => ({ ...current, ...registered }))
    return registered
  }

  /**
   * Begin a login: the URL the human must open, with its attempt remembered.
   * @param returnTo - same-origin path to land on afterwards; the caller has
   * already refused anything that is not one.
   * @returns the absolute authorization URL.
   */
  async function beginConnect(returnTo) {
    const { metadata, resource } = await discovered()
    const identity = await clientIdentity(metadata)
    const started = startAuthorization(metadata, {
      clientId: identity.clientId,
      redirectUri: config.redirectUri,
      scopes: config.scopes,
      resource,
    })
    attempts.set(started.state, { verifier: started.verifier, returnTo, startedAt: Date.now() })
    return started.url
  }

  /**
   * Finish a login: trade the code for tokens and store the grant.
   * @param params - the `code` and `state` the authorization server sent back.
   * @returns where the human asked to be returned to, as recorded when the
   * attempt began — never read from the callback's own query, which the
   * authorization server does not sign.
   */
  async function completeConnect(params) {
    const attempt = attempts.get(params.state)
    if (attempt === undefined) {
      // Either the attempt expired, or this callback belongs to a login this
      // process never started — a cross-site attempt included. Both are the
      // same answer: start again from this workspace.
      throw new Error('alma-mcp: this login attempt is unknown or has expired; start again')
    }
    attempts.delete(params.state)
    const { metadata, resource } = await discovered()
    const identity = await clientIdentity(metadata)
    const tokens = await exchangeCode(metadata, {
      ...identity,
      code: params.code,
      verifier: attempt.verifier,
      redirectUri: config.redirectUri,
      resource,
    })
    await modifyGrant(ctx, async current => ({
      ...current,
      clientId: identity.clientId,
      ...identity.clientSecret !== undefined && { clientSecret: identity.clientSecret },
      ...tokens,
      connectedAt: Date.now(),
    }))
    lastError = undefined
    ctx.logger.info('alma-mcp: connected to ALMA at %s', config.mcpUrl)
    return attempt.returnTo
  }

  /**
   * The access token to send right now, refreshing when it is stale or refused.
   *
   * The refresh happens inside `modifyGrant`, whose exclusion holds across
   * processes: a second caller entering while the first is refreshing sees the
   * already-refreshed grant and declines to write.
   *
   * @param options - `force: true` after a 401, to refresh a token that looked fresh.
   * @returns the bearer token, or undefined while nothing is authorized.
   */
  async function bearer(options = {}) {
    const grant = await readGrant(ctx)
    if (grant === undefined || typeof grant.accessToken !== 'string' || grant.accessToken === '') return undefined
    if (!options.force && accessTokenIsFresh(grant, config.refreshSkewSeconds)) return grant.accessToken
    if (typeof grant.refreshToken !== 'string' || grant.refreshToken === '') {
      // Nothing to refresh with: the stale token is still the best answer, and
      // ALMA's own 401 is a truer verdict than this clock.
      return grant.accessToken
    }
    const { metadata, resource } = await discovered()
    const staleToken = grant.accessToken
    try {
      const written = await modifyGrant(ctx, async (current) => {
        if (current === undefined || typeof current.refreshToken !== 'string') return undefined
        // Someone else refreshed while this call waited for the write.
        if (current.accessToken !== staleToken && accessTokenIsFresh(current, config.refreshSkewSeconds)) {
          return undefined
        }
        const tokens = await refreshTokens(metadata, {
          clientId: current.clientId,
          ...typeof current.clientSecret === 'string' && { clientSecret: current.clientSecret },
          refreshToken: current.refreshToken,
          resource,
        })
        return { ...current, ...tokens, refreshedAt: Date.now() }
      })
      lastError = undefined
      return written !== undefined && typeof written.accessToken === 'string' ? written.accessToken : undefined
    } catch (error) {
      if (error instanceof RefreshRejectedError) {
        // The grant is dead; keeping it would make every later call fail with a
        // 401 that looks like an outage instead of like a sign-out.
        await forgetTokens(ctx)
        lastError = error.message
        ctx.logger.warn('alma-mcp: %s — the workspace must connect to ALMA again', error.message)
        await onGrantLost()
        return undefined
      }
      lastError = error instanceof Error ? error.message : String(error)
      ctx.logger.warn(error instanceof Error ? error : new Error(String(error)))
      return staleToken
    }
  }

  /**
   * Forget the grant, locally. The authorization server is not told: the
   * credential seam has no place for a provider-side revoke.
   */
  async function disconnect() {
    attempts.clear()
    await forgetTokens(ctx)
    lastError = undefined
  }

  /**
   * What the status page and the client half report.
   * @returns presence, expiry, scope and the last authorization problem.
   */
  async function status() {
    const grant = await readGrant(ctx)
    const connected = grant !== undefined && typeof grant.accessToken === 'string' && grant.accessToken !== ''
    return {
      connected,
      ...connected && typeof grant.expiresAt === 'number' && { expiresAt: grant.expiresAt },
      ...connected && typeof grant.scope === 'string' && { scope: grant.scope },
      ...grant !== undefined && typeof grant.clientId === 'string' && { clientId: grant.clientId },
      ...lastError !== undefined && { error: lastError },
    }
  }

  /** Drop login attempts nobody finished, so an abandoned tab is not remembered forever. */
  function sweep() {
    const deadline = Date.now() - ATTEMPT_TTL_MS
    for (const [state, attempt] of attempts) {
      if (attempt.startedAt < deadline) attempts.delete(state)
    }
  }

  return { beginConnect, completeConnect, bearer, disconnect, status, sweep }
}
