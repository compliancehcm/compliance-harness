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

/** One named payload to search for the required claim. */
export interface ClaimSource {
  /** Which token this is, for the diagnostic message. */
  readonly label: string
  readonly claims: TokenClaims
}

/**
 * Check the requirement against several tokens, reporting which one satisfied it.
 *
 * Role claims are not reliably in the id_token: Keycloak puts `realm_access` and
 * `resource_access` in the ACCESS token by default and the id_token carries no
 * role claim at all, so requiring the id_token would mean asking every
 * deployment to add a protocol mapper before the gate works.
 *
 * Searching both is sound because both tokens arrive in the same token-endpoint
 * response, over the same TLS channel, from the same issuer — which endpoint
 * answered, not
 * location, is what makes a claim trustworthy here. Identity still comes from
 * the id_token alone; only the authorization claim is searched more widely.
 *
 * @param sources - the tokens to search, in preference order.
 * @param requirement - the configured requirement, or undefined to admit anyone.
 * @returns the verdict, naming the satisfying token or listing what was found.
 */
export function checkClaimsAcross(
  sources: readonly ClaimSource[],
  requirement: ClaimRequirement | undefined,
): ClaimVerdict & { readonly matchedIn?: string } {
  if (requirement === undefined) return { ok: true }
  const reasons: string[] = []
  for (const source of sources) {
    const verdict = checkClaims(source.claims, requirement)
    if (verdict.ok) return { ok: true, matchedIn: source.label }
    reasons.push(`${source.label}: ${verdict.reason}`)
  }
  return { ok: false, reason: reasons.join('; ') }
}

/** The claim Keycloak's Organization Membership mapper writes. */
export const ORGANIZATION_CLAIM = 'organization'

/** The outcome of resolving the GREMP_ID. */
export type GrempIdVerdict =
  | {
    readonly ok: true
    readonly grempId: string
    /** Alias of the organization that carried it. */
    readonly organization: string
    /** Which token carried it. */
    readonly matchedIn: string
  }
  | { readonly ok: false; readonly reason: string }

/**
 * Read one organization attribute value as a GREMP_ID.
 *
 * Keycloak organization attributes are multivalued, so the value arrives as
 * `["7"]`; a hand-written mapper may emit `"7"` or `7`. A single value in any of
 * those shapes is accepted. Several values, or anything else, are not: it is
 * better to refuse than to guess which client the account belongs to.
 */
function grempValue(raw: unknown): string | undefined {
  const value = Array.isArray(raw) ? (raw.length === 1 ? raw[0] : undefined) : raw
  if (typeof value === 'number' && Number.isSafeInteger(value)) return String(value)
  if (typeof value === 'string' && value.trim() !== '') return value.trim()
  return undefined
}

/** Resolve the GREMP_ID out of one payload's `organization` claim. */
function grempIdIn(
  claims: TokenClaims,
  attribute: string,
): { readonly grempId: string; readonly organization: string } | { readonly reason: string } {
  const claim = claims[ORGANIZATION_CLAIM]
  if (claim === undefined) {
    return {
      reason: `the ${ORGANIZATION_CLAIM} claim is absent (is the organization scope granted to the client, `
        + 'and is the user a member of an organization?)',
    }
  }
  if (Array.isArray(claim)) {
    // The mapper's default shape: aliases only, no attributes.
    return {
      reason: `the ${ORGANIZATION_CLAIM} claim lists only aliases (${JSON.stringify(claim)}); enable `
        + '"Add organization attributes" on the Organization Membership mapper',
    }
  }
  if (typeof claim !== 'object' || claim === null) {
    return { reason: `the ${ORGANIZATION_CLAIM} claim holds ${JSON.stringify(claim)}` }
  }

  const found: { organization: string; grempId: string }[] = []
  const missing: string[] = []
  for (const [organization, details] of Object.entries(claim as Record<string, unknown>)) {
    const raw = typeof details === 'object' && details !== null && !Array.isArray(details)
      ? (details as Record<string, unknown>)[attribute]
      : undefined
    const grempId = grempValue(raw)
    if (grempId === undefined) {
      missing.push(raw === undefined
        ? `organization ${JSON.stringify(organization)} has no ${attribute} attribute`
        : `organization ${JSON.stringify(organization)} holds ${JSON.stringify(raw)} in ${attribute}`)
    } else {
      found.push({ organization, grempId })
    }
  }

  const distinct = new Set(found.map(entry => entry.grempId))
  if (distinct.size === 1) return found[0]
  if (distinct.size > 1) {
    // Only reachable with `organization:*` or several `organization:<alias>`
    // scopes; the plain `organization` scope makes Keycloak ask the user to
    // pick one organization at login.
    return {
      reason: `the user is in several organizations with different ${attribute} values (`
        + `${found.map(entry => `${entry.organization}: ${entry.grempId}`).join(', ')}); `
        + 'request the plain organization scope so Keycloak asks which one',
    }
  }
  if (missing.length === 0) return { reason: `the ${ORGANIZATION_CLAIM} claim names no organization` }
  return { reason: missing.join(', ') }
}

/**
 * Resolve the user's GREMP_ID from Keycloak's `organization` claim.
 *
 * With the *Add organization attributes* option, the Organization Membership
 * mapper writes `{"organization": {"<alias>": {"<attribute>": ["<value>"]}}}`.
 * The claim lands in the id_token and the access_token by default; both are
 * searched for the reason {@link checkClaimsAcross} gives, id_token first.
 *
 * @param sources - the tokens to search, in preference order.
 * @param attribute - the organization attribute holding the GREMP_ID.
 * @returns the GREMP_ID and its organization, or why none could be resolved.
 */
export function resolveGrempId(sources: readonly ClaimSource[], attribute: string): GrempIdVerdict {
  const reasons: string[] = []
  for (const source of sources) {
    const result = grempIdIn(source.claims, attribute)
    if ('grempId' in result) return { ok: true, ...result, matchedIn: source.label }
    reasons.push(`${source.label}: ${result.reason}`)
  }
  return { ok: false, reason: `no GREMP_ID — ${reasons.join('; ')}` }
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
