/**
 * The session store: opaque ids in the browser, tokens only here.
 *
 * The browser never receives a token. It receives a random opaque id, and every
 * token stays in this process — which is what lets the plugin skip id_token
 * signature verification entirely: a token that never leaves the trusted side
 * cannot arrive from an attacker.
 *
 * Sessions live in memory only. A restart therefore requires re-login, which is
 * the honest behaviour for a gate whose whole purpose is to be re-checked; a
 * durable store would have to protect refresh tokens at rest, and
 * `$DSH_HOME/.credentials.yaml` is readable by the very agent being gated.
 */

import { randomBytes, timingSafeEqual } from 'node:crypto'

/** The authenticated principal, projected from the token payload. */
export interface Principal {
  /** The `sub` claim: the issuer's stable identifier for this user. */
  readonly subject: string
  /** Display name, when the issuer supplied one. */
  readonly name?: string
  /** Email, when the issuer supplied one. */
  readonly email?: string
}

/** One live session. */
export interface Session {
  readonly id: string
  readonly principal: Principal
  /**
   * Whether this session satisfied the administrative claim requirement.
   *
   * Decided once, at login, from the tokens the provider issued then. Keeping it
   * on the session is what makes later requests gateable at all: the claims
   * themselves are not retained, and re-reading them per request would mean a
   * token introspection round trip on every call.
   *
   * The consequence is worth stating: revoking someone's admin role in the
   * identity provider does not demote a session already open. It takes effect on
   * their next login, or when the session hits its absolute TTL.
   */
  readonly admin: boolean
  /** Refresh token, when the issuer granted one; absent disables renewal. */
  refreshToken?: string
  /** The id_token, retained only as the `id_token_hint` for RP-initiated logout. */
  idToken?: string
  /** When the access token expires and renewal should be attempted. */
  accessExpiresAt: number
  /** Absolute deadline: re-authentication is required past this, no renewal. */
  readonly absoluteDeadline: number
  /** Last time this session was used, for the idle timeout. */
  lastSeenAt: number
}

/** Why a session lookup failed, so the caller can log the difference. */
export type SessionRejection = 'unknown' | 'expired' | 'idle'

/** A pending login: the state the callback must match against. */
export interface PendingLogin {
  readonly state: string
  readonly nonce: string
  readonly codeVerifier: string
  /** Where to send the browser after a successful login. */
  readonly returnTo: string
  readonly createdAt: number
}

/** How long an unfinished login attempt stays valid. */
const PENDING_TTL_MS = 10 * 60_000

/** Bytes of entropy per generated id. 32 bytes is 256 bits, unguessable. */
const ID_BYTES = 32

/** Generate a URL-safe random identifier. */
export function randomId(): string {
  return randomBytes(ID_BYTES).toString('base64url')
}

/**
 * Compare two ids without leaking their divergence point through timing.
 * @param left - first value.
 * @param right - second value.
 * @returns whether the values are equal.
 */
export function safeEqual(left: string, right: string): boolean {
  const a = Buffer.from(left)
  const b = Buffer.from(right)
  // timingSafeEqual throws on a length mismatch, which itself leaks length; the
  // early return is unavoidable, and length is not the secret here.
  if (a.length !== b.length) return false
  return timingSafeEqual(a, b)
}

/** The clock the store reads, injected so expiry is testable without waiting. */
export type Clock = () => number

/** In-memory sessions and pending logins, with expiry and a sweep. */
export class SessionStore {
  private readonly sessions = new Map<string, Session>()
  private readonly pending = new Map<string, PendingLogin>()

  constructor(
    private readonly sessionTtlMs: number,
    private readonly idleTimeoutMs: number,
    private readonly now: Clock = Date.now,
  ) {}

  /**
   * Open a session for an authenticated principal.
   * @param principal - the identified user.
   * @param tokens - access-token lifetime and the optional refresh token.
   * @returns the new session.
   */
  create(
    principal: Principal,
    tokens: {
      readonly expiresInSeconds: number
      readonly refreshToken?: string
      readonly idToken?: string
      readonly admin?: boolean
    },
  ): Session {
    const at = this.now()
    const session: Session = {
      id: randomId(),
      principal,
      admin: tokens.admin ?? false,
      ...tokens.refreshToken !== undefined && { refreshToken: tokens.refreshToken },
      ...tokens.idToken !== undefined && { idToken: tokens.idToken },
      accessExpiresAt: at + tokens.expiresInSeconds * 1000,
      absoluteDeadline: at + this.sessionTtlMs,
      lastSeenAt: at,
    }
    this.sessions.set(session.id, session)
    return session
  }

  /**
   * Look up a session and mark it used.
   * @param id - the opaque id from the cookie, or undefined when absent.
   * @returns the live session, or why it was refused.
   */
  touch(id: string | undefined): Session | SessionRejection {
    if (id === undefined) return 'unknown'
    const session = this.sessions.get(id)
    if (session === undefined) return 'unknown'
    const at = this.now()
    if (at >= session.absoluteDeadline) {
      this.sessions.delete(id)
      return 'expired'
    }
    if (at - session.lastSeenAt >= this.idleTimeoutMs) {
      this.sessions.delete(id)
      return 'idle'
    }
    session.lastSeenAt = at
    return session
  }

  /**
   * Look up a session without marking it used.
   *
   * `touch` doubles as the idle-timer reset, which is right for a request the
   * user made and wrong for an internal lookup: routing a request should not by
   * itself keep a session alive.
   *
   * @param id - the opaque id from the cookie.
   * @returns the live session, or undefined when absent or expired.
   */
  peek(id: string | undefined): Session | undefined {
    if (id === undefined) return undefined
    const session = this.sessions.get(id)
    if (session === undefined) return undefined
    const at = this.now()
    if (at >= session.absoluteDeadline || at - session.lastSeenAt >= this.idleTimeoutMs) return undefined
    return session
  }

  /** Record the outcome of a token renewal on a live session. */
  renewed(
    session: Session,
    tokens: { readonly expiresInSeconds: number; readonly refreshToken?: string },
  ): void {
    session.accessExpiresAt = this.now() + tokens.expiresInSeconds * 1000
    if (tokens.refreshToken !== undefined) session.refreshToken = tokens.refreshToken
  }

  /** Whether a session's access token is due for renewal. */
  needsRenewal(session: Session, skewMs: number): boolean {
    return this.now() + skewMs >= session.accessExpiresAt
  }

  /** Drop a session, e.g. on logout or a failed renewal. @returns its refresh token, if any. */
  drop(id: string): string | undefined {
    const session = this.sessions.get(id)
    this.sessions.delete(id)
    return session?.refreshToken
  }

  /** Register a login attempt. @returns the state key it is filed under. */
  beginLogin(login: Omit<PendingLogin, 'createdAt'>): void {
    this.pending.set(login.state, { ...login, createdAt: this.now() })
  }

  /**
   * Consume a login attempt, which may happen at most once.
   * @param state - the `state` value the callback carried.
   * @returns the attempt, or undefined when unknown, replayed, or expired.
   */
  consumeLogin(state: string | undefined): PendingLogin | undefined {
    if (state === undefined) return undefined
    const found = this.pending.get(state)
    if (found === undefined) return undefined
    this.pending.delete(state)
    if (this.now() - found.createdAt >= PENDING_TTL_MS) return undefined
    return found
  }

  /** Drop everything expired. Called on a timer so an idle process does not grow. */
  sweep(): void {
    const at = this.now()
    for (const [id, session] of this.sessions) {
      if (at >= session.absoluteDeadline || at - session.lastSeenAt >= this.idleTimeoutMs) {
        this.sessions.delete(id)
      }
    }
    for (const [state, login] of this.pending) {
      if (at - login.createdAt >= PENDING_TTL_MS) this.pending.delete(state)
    }
  }

  /** Live session count, for the status endpoint and tests. */
  get size(): number {
    return this.sessions.size
  }
}
