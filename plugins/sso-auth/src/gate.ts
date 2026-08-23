/**
 * The gate: the authorization decision and the `/auth/*` endpoints, behind the
 * interface the proxy consumes.
 *
 * Discovery is lazy and memoized rather than performed at boot, so an identity
 * provider that is briefly unreachable delays logins instead of preventing the
 * harness from starting — and so a provider that comes back needs no restart.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import { readCookie, sessionCookie, SESSION_COOKIE } from './edge.ts'
import { checkClaims, decodeClaims, toPrincipal } from './claims.ts'
import { redirectUri } from './config.ts'
import type { SsoConfig } from './config.ts'
import {
  authorizationUrl, discover, exchangeCode, logoutUrl, OidcError, refresh, createPkce,
} from './oidc.ts'
import type { ClientIdentity, ProviderMetadata, TokenSet } from './oidc.ts'
import { deniedPage, errorPage, livenessScript, loginPage } from './pages.ts'
import { randomId, safeEqual } from './sessions.ts'
import type { Session, SessionStore } from './sessions.ts'
import type { Authorization, ProxyGate } from './proxy.ts'

/** How early a token is renewed before it expires. */
const RENEWAL_SKEW_MS = 30_000

/** How often the injected script asks whether the session is still alive. */
const LIVENESS_POLL_MS = 30_000

/** Paths the gate owns; everything else is forwarded once authorized. */
const AUTH_PREFIX = '/auth/'

/** What the gate needs from its host. */
export interface GateDeps {
  readonly config: SsoConfig
  readonly sessions: SessionStore
  /** Resolves the client secret, or undefined for a public client. */
  readonly resolveSecret: () => Promise<string | undefined>
  readonly logger: Pick<Console, 'info' | 'warn'>
}

/** Read a URL's pathname and query without needing an absolute base. */
function parseTarget(req: IncomingMessage): URL {
  return new URL(req.url ?? '/', 'http://gate.invalid')
}

/**
 * Keep a post-login destination that cannot be used to bounce a user off-site.
 *
 * An attacker-supplied `returnTo` is the classic open-redirect in a login flow,
 * so only a same-site absolute path survives.
 */
function safeReturnTo(candidate: string | null): string {
  if (candidate === null || !candidate.startsWith('/') || candidate.startsWith('//')) return '/'
  return candidate
}

/** The gate implementation. */
export class SsoGate implements ProxyGate {
  private metadata: Promise<ProviderMetadata> | undefined
  readonly htmlEpilogue = livenessScript(LIVENESS_POLL_MS)

  constructor(private readonly deps: GateDeps) {}

  /** Discover once, and retry on the next attempt if discovery failed. */
  private async provider(): Promise<ProviderMetadata> {
    this.metadata ??= discover(this.deps.config.issuer).catch((error: unknown) => {
      this.metadata = undefined
      throw error
    })
    return this.metadata
  }

  /** Assemble the client identity, resolving the secret per use. */
  private async client(): Promise<ClientIdentity> {
    const secret = await this.deps.resolveSecret()
    return {
      clientId: this.deps.config.clientId,
      ...secret !== undefined && { clientSecret: secret },
      redirectUri: redirectUri(this.deps.config),
    }
  }

  challengePage(returnTo: string): { location: string } {
    return { location: `/auth/login?returnTo=${encodeURIComponent(safeReturnTo(returnTo))}` }
  }

  denyPage(reason: string): string {
    return deniedPage(reason)
  }

  /**
   * Decide one forwarded request.
   * @param req - the inbound request.
   * @returns whether to forward, challenge, or deny.
   */
  async authorize(req: IncomingMessage): Promise<Authorization> {
    const found = this.deps.sessions.touch(readCookie({ headers: req.headers }, SESSION_COOKIE))
    if (typeof found === 'string') return { kind: 'challenge', reason: found }
    if (!this.deps.sessions.needsRenewal(found, RENEWAL_SKEW_MS)) return { kind: 'allow' }
    return await this.renew(found)
  }

  /** Renew a session whose access token is expiring, or end it. */
  private async renew(session: Session): Promise<Authorization> {
    const token = session.refreshToken
    if (token === undefined) {
      // Without a refresh token the access token's expiry is the session's
      // ceiling; ending it here is what makes that visible as a re-login rather
      // than as calls that quietly start failing upstream.
      this.deps.sessions.drop(session.id)
      return { kind: 'challenge', reason: 'access token expired and no refresh token was granted' }
    }
    try {
      const renewed = await refresh(await this.provider(), await this.client(), token)
      this.deps.sessions.renewed(session, renewed)
      return { kind: 'allow' }
    } catch (error) {
      this.deps.sessions.drop(session.id)
      this.deps.logger.warn(`sso-auth: refresh failed for ${session.principal.subject}: ${String(error)}`)
      return { kind: 'challenge', reason: 'refresh rejected by the provider' }
    }
  }

  /**
   * Answer the gate's own endpoints.
   * @param req - the inbound request.
   * @param res - the response to complete when this gate owns the request.
   * @returns whether the request was answered here.
   */
  async handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const target = parseTarget(req)
    if (!target.pathname.startsWith(AUTH_PREFIX)) return false
    switch (target.pathname) {
      case '/auth/login': return await this.login(target, res)
      case '/auth/callback': return await this.callback(target, res)
      case '/auth/logout': return await this.logout(req, res)
      case '/auth/status': return this.status(req, res)
      default: return false
    }
  }

  /** Start a login: register the attempt, then redirect to the provider. */
  private async login(target: URL, res: ServerResponse): Promise<true> {
    const returnTo = safeReturnTo(target.searchParams.get('returnTo'))
    // A GET straight to /auth/login (a bookmark, or the challenge redirect)
    // shows the interstitial rather than bouncing, so the user sees where they
    // are being sent before leaving.
    if (target.searchParams.get('go') !== '1') {
      const href = `/auth/login?go=1&returnTo=${encodeURIComponent(returnTo)}`
      sendHtml(res, 200, loginPage(href))
      return true
    }
    try {
      const metadata = await this.provider()
      const client = await this.client()
      const pkce = createPkce()
      const state = randomId()
      const nonce = randomId()
      this.deps.sessions.beginLogin({ state, nonce, codeVerifier: pkce.verifier, returnTo })
      const location = authorizationUrl(metadata, client, {
        scopes: this.deps.config.scopes,
        state,
        nonce,
        challenge: pkce.challenge,
      })
      res.writeHead(302, { location, 'cache-control': 'no-store' })
      res.end()
    } catch (error) {
      this.deps.logger.warn(`sso-auth: login could not start: ${String(error)}`)
      sendHtml(res, 502, errorPage(
        'The identity provider could not be reached.',
        error instanceof OidcError ? error.message : undefined,
      ))
    }
    return true
  }

  /** Complete a login: validate the callback, exchange, check claims, open a session. */
  private async callback(target: URL, res: ServerResponse): Promise<true> {
    const providerError = target.searchParams.get('error')
    if (providerError !== null) {
      sendHtml(res, 400, errorPage(
        'The identity provider refused the sign-in.',
        `${providerError}: ${target.searchParams.get('error_description') ?? 'no description given'}`,
      ))
      return true
    }
    const pending = this.deps.sessions.consumeLogin(target.searchParams.get('state') ?? undefined)
    const code = target.searchParams.get('code')
    if (pending === undefined || code === null) {
      // An unknown state is a replayed, expired, or forged callback. All three
      // are indistinguishable from here and none may open a session.
      sendHtml(res, 400, errorPage('This sign-in link is no longer valid. Start again.'))
      return true
    }

    let tokens: TokenSet
    try {
      tokens = await exchangeCode(await this.provider(), await this.client(), {
        code,
        verifier: pending.codeVerifier,
      })
    } catch (error) {
      this.deps.logger.warn(`sso-auth: code exchange failed: ${String(error)}`)
      sendHtml(res, 502, errorPage(
        'The sign-in could not be completed.',
        error instanceof OidcError ? error.message : undefined,
      ))
      return true
    }

    if (tokens.idToken === undefined) {
      sendHtml(res, 502, errorPage('The provider returned no id_token, so the user cannot be identified.'))
      return true
    }
    const claims = decodeClaims(tokens.idToken)
    if (claims === undefined) {
      sendHtml(res, 502, errorPage('The provider returned an unreadable id_token.'))
      return true
    }
    const claimedNonce = claims['nonce']
    if (typeof claimedNonce !== 'string' || !safeEqual(claimedNonce, pending.nonce)) {
      // The nonce binds this token to this browser's login attempt; without the
      // check, a token obtained elsewhere could be replayed into this callback.
      sendHtml(res, 400, errorPage('The sign-in response did not match this attempt. Start again.'))
      return true
    }
    const principal = toPrincipal(claims)
    if (principal === undefined) {
      sendHtml(res, 502, errorPage('The id_token carries no subject, so the user cannot be identified.'))
      return true
    }
    const verdict = checkClaims(claims, this.deps.config.require)
    if (!verdict.ok) {
      this.deps.logger.info(`sso-auth: denied ${principal.subject}: ${verdict.reason}`)
      sendHtml(res, 403, deniedPage(verdict.reason))
      return true
    }

    const session = this.deps.sessions.create(principal, {
      expiresInSeconds: tokens.expiresInSeconds,
      ...tokens.refreshToken !== undefined && { refreshToken: tokens.refreshToken },
      idToken: tokens.idToken,
    })
    this.deps.logger.info(`sso-auth: signed in ${principal.email ?? principal.subject}`)
    res.writeHead(302, {
      location: pending.returnTo,
      'set-cookie': sessionCookie(session.id, {
        secure: this.deps.config.publicUrl.startsWith('https:'),
        maxAgeSeconds: Math.floor(this.deps.config.sessionTtlMs / 1000),
      }),
      'cache-control': 'no-store',
    })
    res.end()
    return true
  }

  /** End the local session, then the provider's if it supports logout. */
  private async logout(req: IncomingMessage, res: ServerResponse): Promise<true> {
    const id = readCookie({ headers: req.headers }, SESSION_COOKIE)
    const session = id === undefined ? undefined : this.deps.sessions.touch(id)
    const idToken = typeof session === 'string' || session === undefined
      ? undefined
      : session.idToken
    if (id !== undefined) this.deps.sessions.drop(id)

    const cleared = sessionCookie('', {
      secure: this.deps.config.publicUrl.startsWith('https:'),
      maxAgeSeconds: 0,
    })
    let location = '/'
    try {
      location = logoutUrl(await this.provider(), await this.client(), {
        returnTo: this.deps.config.publicUrl,
        ...idToken !== undefined && { idToken },
      }) ?? '/'
    } catch (error) {
      // The local session is already gone, which is the part that matters; a
      // provider that cannot be reached must not turn logout into an error page.
      this.deps.logger.warn(`sso-auth: provider logout unavailable: ${String(error)}`)
    }
    res.writeHead(302, { location, 'set-cookie': cleared, 'cache-control': 'no-store' })
    res.end()
    return true
  }

  /** Report whether the caller still holds a session; the liveness poll reads this. */
  private status(req: IncomingMessage, res: ServerResponse): true {
    const found = this.deps.sessions.touch(readCookie({ headers: req.headers }, SESSION_COOKIE))
    const authenticated = typeof found !== 'string'
    const body = JSON.stringify(authenticated
      ? { authenticated: true, subject: found.principal.subject, name: found.principal.name ?? null }
      : { authenticated: false })
    res.writeHead(200, {
      'content-type': 'application/json; charset=utf-8',
      'content-length': String(Buffer.byteLength(body)),
      'cache-control': 'no-store',
    })
    res.end(body)
    return true
  }
}

/** Send an HTML document with no-store caching. */
function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'content-length': String(Buffer.byteLength(html)),
    'cache-control': 'no-store',
  })
  res.end(html)
}
