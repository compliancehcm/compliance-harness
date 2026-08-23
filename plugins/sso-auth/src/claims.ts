/**
 * Token payload reading and the authorization decision over it.
 *
 * The payload is decoded, never verified. That is sound here and only here: the
 * token is fetched by this process directly from the issuer's token endpoint
 * over TLS, so its authenticity rests on that channel rather than on a
 * signature. The same judgement is already made by the vendored provider flows
 * (`pi-ai`'s `openai-codex.js` decodes its id_token with `atob`). If a token ever
 * starts arriving from the browser, this file becomes wrong and JWKS
 * verification becomes mandatory.
 */

import type { ClaimRequirement } from './config.ts'
import type { Principal } from './sessions.ts'

/** A decoded token payload. */
export type TokenClaims = Readonly<Record<string, unknown>>

/**
 * Decode the payload of a compact JWS without verifying it.
 * @param token - the compact serialization (`header.payload.signature`).
 * @returns the payload object, or undefined when it is not a decodable JWT.
 */
export function decodeClaims(token: string): TokenClaims | undefined {
  const parts = token.split('.')
  if (parts.length !== 3) return undefined
  try {
    const json: unknown = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'))
    if (typeof json !== 'object' || json === null || Array.isArray(json)) return undefined
    return json as TokenClaims
  } catch {
    // A payload that is not base64url JSON is not a token we can read; the
    // caller reports it as a failed login rather than crashing the request.
    return undefined
  }
}

/**
 * Read a dot path out of a claims object.
 * @param claims - the decoded payload.
 * @param path - dot-separated path, e.g. `realm_access.roles`.
 * @returns the value at that path, or undefined when any segment is missing.
 */
export function readClaimPath(claims: TokenClaims, path: string): unknown {
  let current: unknown = claims
  for (const segment of path.split('.')) {
    if (typeof current !== 'object' || current === null || Array.isArray(current)) return undefined
    current = (current as Record<string, unknown>)[segment]
    if (current === undefined) return undefined
  }
  return current
}

/** The outcome of checking a claim requirement. */
export type ClaimVerdict =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: string }

/**
 * Check a claim requirement against a payload.
 *
 * A string claim must equal an accepted value; an array claim must contain one.
 * Keycloak realm and client roles arrive as arrays, and single-valued claims
 * such as `hd` or a custom tenant marker arrive as strings, so both shapes are
 * first-class rather than one being a special case.
 *
 * @param claims - the decoded payload.
 * @param requirement - the configured requirement, or undefined to admit anyone.
 * @returns the verdict, carrying a human-readable reason on refusal.
 */
export function checkClaims(
  claims: TokenClaims,
  requirement: ClaimRequirement | undefined,
): ClaimVerdict {
  if (requirement === undefined) return { ok: true }
  const value = readClaimPath(claims, requirement.claimPath)
  const accepted = new Set(requirement.anyOf)
  if (typeof value === 'string' && accepted.has(value)) return { ok: true }
  if (Array.isArray(value) && value.some(entry => typeof entry === 'string' && accepted.has(entry))) {
    return { ok: true }
  }
  const present = value === undefined
    ? 'the claim is absent'
    : `it holds ${JSON.stringify(value)}`
  return {
    ok: false,
    reason: `${requirement.claimPath} must contain one of ${requirement.anyOf.join(', ')}, but ${present}`,
  }
}

/**
 * Project a principal out of a payload.
 * @param claims - the decoded payload.
 * @returns the principal, or undefined when `sub` is missing, which makes the
 * token unusable as an identity regardless of what else it carries.
 */
export function toPrincipal(claims: TokenClaims): Principal | undefined {
  const subject = claims['sub']
  if (typeof subject !== 'string' || subject === '') return undefined
  const name = claims['name'] ?? claims['preferred_username']
  const email = claims['email']
  return {
    subject,
    ...typeof name === 'string' && { name },
    ...typeof email === 'string' && { email },
  }
}
