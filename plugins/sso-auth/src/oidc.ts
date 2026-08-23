/**
 * The OIDC client: discovery, PKCE, the authorization-code exchange, refresh,
 * and the RP-initiated logout URL.
 *
 * Nothing here is Keycloak-specific. Every endpoint comes from the issuer's
 * discovery document, so changing provider is a change of configuration.
 */

import { createHash, randomBytes } from 'node:crypto'

/** The endpoints this plugin needs from the issuer's discovery document. */
export interface ProviderMetadata {
  readonly issuer: string
  readonly authorizationEndpoint: string
  readonly tokenEndpoint: string
  /** Absent on a provider that does not implement RP-initiated logout. */
  readonly endSessionEndpoint?: string
}

/** One PKCE pair. */
export interface Pkce {
  readonly verifier: string
  readonly challenge: string
}

/** The token set returned by the token endpoint. */
export interface TokenSet {
  readonly accessToken: string
  /** Absent when the provider issues no id_token, which makes the login unusable. */
  readonly idToken?: string
  readonly refreshToken?: string
  readonly expiresInSeconds: number
}

/** Raised when the provider answers in a way that cannot be used. */
export class OidcError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(detail === undefined ? message : `${message}: ${detail}`)
    this.name = 'OidcError'
  }
}

/** How long to wait on any single provider call. */
const PROVIDER_TIMEOUT_MS = 10_000

/** Default access-token lifetime when the provider omits `expires_in`. */
const DEFAULT_EXPIRES_IN_SECONDS = 300

/** Generate a PKCE verifier and its S256 challenge. */
export function createPkce(): Pkce {
  const verifier = randomBytes(32).toString('base64url')
  const challenge = createHash('sha256').update(verifier).digest('base64url')
  return { verifier, challenge }
}

/** Read a required string field out of a provider JSON response. */
function requiredString(body: Record<string, unknown>, key: string, what: string): string {
  const value = body[key]
  if (typeof value !== 'string' || value === '') {
    throw new OidcError(`${what} is missing ${key}`)
  }
  return value
}

/** Fetch JSON with a timeout, failing loud on a non-2xx or unparsable body. */
async function fetchJson(
  url: string,
  init: RequestInit,
  what: string,
): Promise<Record<string, unknown>> {
  let response: Response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS) })
  } catch (error) {
    throw new OidcError(`${what} could not be reached`, String(error))
  }
  const text = await response.text()
  if (!response.ok) {
    // The provider's own error body is the most useful diagnostic there is for
    // a misconfigured client, so it is carried through rather than swallowed.
    throw new OidcError(`${what} failed with HTTP ${String(response.status)}`, text.slice(0, 500))
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    throw new OidcError(`${what} did not return JSON`, text.slice(0, 200))
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new OidcError(`${what} did not return a JSON object`)
  }
  return parsed as Record<string, unknown>
}

/**
 * Fetch and validate the issuer's discovery document.
 * @param issuer - the issuer URL, without a trailing slash.
 * @returns the endpoints this plugin uses.
 * @throws {OidcError} when the document is unreachable or incomplete.
 */
export async function discover(issuer: string): Promise<ProviderMetadata> {
  const url = `${issuer}/.well-known/openid-configuration`
  const body = await fetchJson(url, { method: 'GET' }, `OIDC discovery at ${url}`)

  const declared = requiredString(body, 'issuer', 'the discovery document')
  if (declared.replace(/\/+$/, '') !== issuer) {
    // A discovery document that names a different issuer than the one we asked
    // is either a misconfiguration or a redirect to somewhere unintended;
    // either way the tokens it mints would not be the ones we expect.
    throw new OidcError('discovery issuer mismatch', `configured ${issuer}, document says ${declared}`)
  }
  const endSession = body['end_session_endpoint']
  return {
    issuer,
    authorizationEndpoint: requiredString(body, 'authorization_endpoint', 'the discovery document'),
    tokenEndpoint: requiredString(body, 'token_endpoint', 'the discovery document'),
    ...typeof endSession === 'string' && { endSessionEndpoint: endSession },
  }
}

/** Everything needed to address the provider as a client. */
export interface ClientIdentity {
  readonly clientId: string
  /** Resolved secret for a confidential client, or undefined for a public one. */
  readonly clientSecret?: string
  readonly redirectUri: string
}

/**
 * Build the URL the browser is redirected to in order to authenticate.
 * @param metadata - the discovered endpoints.
 * @param client - client id and redirect URI.
 * @param params - the per-attempt values that must come back unchanged.
 * @returns the absolute authorization URL.
 */
export function authorizationUrl(
  metadata: ProviderMetadata,
  client: ClientIdentity,
  params: {
    readonly scopes: readonly string[]
    readonly state: string
    readonly nonce: string
    readonly challenge: string
  },
): string {
  const url = new URL(metadata.authorizationEndpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', client.clientId)
  url.searchParams.set('redirect_uri', client.redirectUri)
  url.searchParams.set('scope', params.scopes.join(' '))
  url.searchParams.set('state', params.state)
  url.searchParams.set('nonce', params.nonce)
  url.searchParams.set('code_challenge', params.challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  return url.toString()
}

/** Shape a token-endpoint response into a {@link TokenSet}. */
function toTokenSet(body: Record<string, unknown>): TokenSet {
  const expiresIn = body['expires_in']
  const idToken = body['id_token']
  const refreshToken = body['refresh_token']
  return {
    accessToken: requiredString(body, 'access_token', 'the token response'),
    ...typeof idToken === 'string' && { idToken },
    ...typeof refreshToken === 'string' && { refreshToken },
    expiresInSeconds: typeof expiresIn === 'number' && expiresIn > 0
      ? expiresIn
      : DEFAULT_EXPIRES_IN_SECONDS,
  }
}

/** Add client authentication to a token-endpoint request body. */
function withClientAuth(form: URLSearchParams, client: ClientIdentity): URLSearchParams {
  form.set('client_id', client.clientId)
  // A public client authenticates with PKCE alone; a confidential one adds its
  // secret. `client_secret_post` is used rather than Basic because every
  // OIDC provider accepts it and it keeps the secret out of a header that
  // proxies habitually log.
  if (client.clientSecret !== undefined) form.set('client_secret', client.clientSecret)
  return form
}

/**
 * Exchange an authorization code for tokens.
 * @param metadata - the discovered endpoints.
 * @param client - client identity, including the redirect URI used in the request.
 * @param params - the code and the PKCE verifier it was issued against.
 * @returns the token set.
 * @throws {OidcError} when the provider refuses or answers unusably.
 */
export async function exchangeCode(
  metadata: ProviderMetadata,
  client: ClientIdentity,
  params: { readonly code: string; readonly verifier: string },
): Promise<TokenSet> {
  const form = withClientAuth(new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: client.redirectUri,
    code_verifier: params.verifier,
  }), client)
  const body = await fetchJson(metadata.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }, 'the token exchange')
  return toTokenSet(body)
}

/**
 * Renew a token set from a refresh token.
 * @param metadata - the discovered endpoints.
 * @param client - client identity.
 * @param refreshToken - the refresh token held for this session.
 * @returns the renewed token set.
 * @throws {OidcError} when the provider refuses, which ends the session.
 */
export async function refresh(
  metadata: ProviderMetadata,
  client: ClientIdentity,
  refreshToken: string,
): Promise<TokenSet> {
  const form = withClientAuth(new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
  }), client)
  const body = await fetchJson(metadata.tokenEndpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form.toString(),
  }, 'the token refresh')
  return toTokenSet(body)
}

/**
 * Build the provider logout URL, so signing out ends the IdP session too.
 *
 * Without this, "log out" would only forget the local session and the next
 * login would silently succeed against the still-open provider session, which
 * reads as the logout not having worked.
 *
 * @param metadata - the discovered endpoints.
 * @param client - client identity.
 * @param params - where to return afterwards, and the id_token if one is held.
 * @returns the logout URL, or undefined when the provider offers none.
 */
export function logoutUrl(
  metadata: ProviderMetadata,
  client: ClientIdentity,
  params: { readonly returnTo: string; readonly idToken?: string },
): string | undefined {
  if (metadata.endSessionEndpoint === undefined) return undefined
  const url = new URL(metadata.endSessionEndpoint)
  url.searchParams.set('client_id', client.clientId)
  url.searchParams.set('post_logout_redirect_uri', params.returnTo)
  if (params.idToken !== undefined) url.searchParams.set('id_token_hint', params.idToken)
  return url.toString()
}
