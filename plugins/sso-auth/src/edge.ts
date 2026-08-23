/**
 * The public-edge request checks, and the cookie helpers they work with.
 *
 * This file carries the responsibility the harness trust fence
 * (`packages/client/connection/src/api-request-trust.ts`) can no longer
 * discharge once traffic arrives through a proxy: the fence compares `Origin`
 * against `Host`, and the proxy must rewrite `Host` to the internal authority
 * for the downstream loopback pin to pass. So the cross-site decision moves
 * here, ahead of that rewrite. Removing these checks would not fail a test
 * elsewhere — it would silently reopen the whole configuration plane
 * (`settings.*`, `credentials.*`) to cross-site requests.
 */

/** The request fields the edge checks read. */
export interface EdgeRequest {
  readonly method?: string | undefined
  readonly url?: string | undefined
  readonly headers: Readonly<Record<string, string | string[] | undefined>>
}

/** Why a request was refused at the edge, for the response and the log. */
export type EdgeRefusal =
  | { readonly kind: 'cross-site'; readonly detail: string }
  | { readonly kind: 'origin-mismatch'; readonly detail: string }

/** Read one header as a single string, collapsing the array form node may hand us. */
export function header(request: EdgeRequest, name: string): string | undefined {
  const value = request.headers[name]
  if (value === undefined) return undefined
  return Array.isArray(value) ? value[0] : value
}

/**
 * Refuse a request whose provenance says it came from another site.
 *
 * Two independent signals, because neither is universally present: modern
 * browsers send `Sec-Fetch-Site`, and anything with a body-bearing cross-origin
 * request sends `Origin`. A request with neither is a same-origin navigation or
 * a non-browser client, and is left to the session check.
 *
 * @param request - the inbound request.
 * @param publicAuthority - the `host:port` browsers were told to use.
 * @returns the refusal, or undefined when the request may proceed.
 */
export function checkEdge(request: EdgeRequest, publicAuthority: string): EdgeRefusal | undefined {
  const fetchSite = header(request, 'sec-fetch-site')
  if (fetchSite === 'cross-site') {
    return { kind: 'cross-site', detail: 'sec-fetch-site: cross-site' }
  }
  const origin = header(request, 'origin')
  if (origin !== undefined && origin !== 'null') {
    let parsed: URL
    try {
      parsed = new URL(origin)
    } catch {
      return { kind: 'origin-mismatch', detail: `unparsable Origin ${JSON.stringify(origin)}` }
    }
    if (parsed.host !== publicAuthority) {
      return {
        kind: 'origin-mismatch',
        detail: `Origin ${parsed.host} does not match ${publicAuthority}`,
      }
    }
  }
  return undefined
}

/** Name of the session cookie. */
export const SESSION_COOKIE = 'dsh_sso'

/**
 * Read one cookie value from a Cookie header.
 * @param request - the inbound request.
 * @param name - cookie name.
 * @returns the value, or undefined when the cookie is absent.
 */
export function readCookie(request: EdgeRequest, name: string): string | undefined {
  const raw = header(request, 'cookie')
  if (raw === undefined) return undefined
  for (const part of raw.split(';')) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    if (part.slice(0, eq).trim() !== name) continue
    return decodeURIComponent(part.slice(eq + 1).trim())
  }
  return undefined
}

/**
 * Build a `Set-Cookie` value for the session.
 *
 * `HttpOnly` keeps the id away from page scripts, `SameSite=Lax` stops a
 * cross-site POST from riding the session while still surviving the top-level
 * redirect back from the identity provider, and `Secure` is attached only for an
 * https public origin because a `Secure` cookie is silently dropped over http,
 * which would make loopback development fail in a way that looks like a broken
 * login rather than a cookie policy.
 *
 * @param value - the opaque session id, or empty to clear.
 * @param options - secure flag and lifetime; `maxAgeSeconds: 0` clears.
 * @returns the header value.
 */
export function sessionCookie(
  value: string,
  options: { readonly secure: boolean; readonly maxAgeSeconds: number },
): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(value)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${String(options.maxAgeSeconds)}`,
  ]
  if (options.secure) parts.push('Secure')
  return parts.join('; ')
}
