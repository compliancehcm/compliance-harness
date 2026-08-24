/**
 * The OAuth 2.1 half of the plugin: discovery, dynamic client registration,
 * PKCE, code exchange and refresh.
 *
 * Hand-written rather than delegated to the MCP SDK's `auth()` helper because
 * the SDK's `OAuthClientProvider` assumes it owns the transport's whole
 * authorization lifecycle, while here the transport is a loopback relay and the
 * conversation with the human happens on this deployment's own gated origin.
 * What is not hand-written is the protocol shape: this follows RFC 9728 for
 * discovery, RFC 7591 for registration, RFC 7636 for PKCE and RFC 8707 for the
 * `resource` parameter the MCP specification requires.
 *
 * ALMA's authorization server (as of writing) advertises
 * `grant_types_supported: ["authorization_code", "refresh_token"]` — there is no
 * machine grant, so every token here begins in a browser.
 *
 * @module
 */

import { createHash, randomBytes } from 'node:crypto'

/** How long any single discovery, registration or token request may take. */
const REQUEST_TIMEOUT_MS = 15_000

/** Raised when the authorization server refused a refresh for good (`invalid_grant`). */
export class RefreshRejectedError extends Error {
  /**
   * @param detail - the server's own description, for the log and the status page.
   */
  constructor(detail) {
    super(`alma-mcp: the authorization server refused the refresh token: ${detail}`)
    this.name = 'RefreshRejectedError'
  }
}

/**
 * Base64url without padding — the encoding PKCE and every token here use.
 * @param buffer - bytes to encode.
 * @returns the base64url text.
 */
function base64url(buffer) {
  return buffer.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

/**
 * Flatten an error and its causes into one line.
 *
 * `fetch` reports every transport problem as the same bare "fetch failed" and
 * puts the fact in `cause` — a DNS failure, a missing CA, a refused connection.
 * A message that drops the chain says only "could not reach", which is exactly
 * the message that cannot be acted on; the first version of this file did that,
 * and a jail with no `/etc/resolv.conf` read as an ALMA outage.
 *
 * @param error - the thrown value.
 * @returns the message chain, outermost first.
 */
function describeChain(error) {
  const parts = []
  let current = error
  while (current !== undefined && current !== null && parts.length < 5) {
    const message = current instanceof Error ? current.message : String(current)
    const code = current instanceof Error && typeof current.code === 'string' ? ` (${current.code})` : ''
    if (message !== '' && !parts.includes(message)) parts.push(`${message}${code}`)
    current = current instanceof Error ? current.cause : undefined
  }
  return parts.join(' ← ')
}

/**
 * One JSON request, with a timeout and an error that carries the server's words.
 * @param url - absolute URL to call.
 * @param init - fetch init; `method` defaults to GET.
 * @param what - what this call was for, named in the error message.
 * @returns the parsed JSON body.
 */
async function requestJson(url, init, what) {
  let response
  try {
    response = await fetch(url, { ...init, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) })
  } catch (error) {
    throw new Error(`alma-mcp: ${what} could not reach ${url}: ${describeChain(error)}`, { cause: error })
  }
  const text = await response.text()
  let body
  try {
    body = text === '' ? {} : JSON.parse(text)
  } catch {
    body = undefined
  }
  if (!response.ok) {
    const detail = body !== undefined && typeof body === 'object' && body !== null
      ? `${String(body.error ?? response.status)}: ${String(body.error_description ?? text.slice(0, 300))}`
      : `${String(response.status)} ${text.slice(0, 300)}`
    const error = new Error(`alma-mcp: ${what} failed — ${detail}`)
    error.oauthError = body !== undefined && typeof body === 'object' && body !== null ? body.error : undefined
    throw error
  }
  if (body === undefined) throw new Error(`alma-mcp: ${what} returned a body that is not JSON`)
  return body
}

/**
 * Candidate metadata URLs for a document type, path-aware then root, as RFC 9728
 * and RFC 8414 prescribe for an issuer or resource carrying a path.
 * @param base - the resource or issuer URL.
 * @param wellKnown - the well-known document name.
 * @returns candidate URLs, most specific first.
 */
function metadataCandidates(base, wellKnown) {
  const url = new URL(base)
  const path = url.pathname.replace(/\/+$/, '')
  const candidates = []
  if (path !== '') candidates.push(`${url.origin}/.well-known/${wellKnown}${path}`)
  candidates.push(`${url.origin}/.well-known/${wellKnown}`)
  return candidates
}

/**
 * Try each candidate in order, returning the first that answers with JSON.
 * @param candidates - URLs to try.
 * @param what - what this discovery was for, named in the error message.
 * @returns the first document found.
 */
async function firstMetadata(candidates, what) {
  const failures = []
  for (const candidate of candidates) {
    try {
      return await requestJson(candidate, {}, what)
    } catch (error) {
      failures.push(`${candidate}: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  throw new Error(`alma-mcp: ${what} found no metadata document:\n${failures.map(line => `  - ${line}`).join('\n')}`)
}

/**
 * Discover the MCP endpoint's protected-resource metadata and, through it, its
 * authorization server.
 *
 * @param mcpUrl - the MCP endpoint the tools live behind.
 * @returns `{ resource, metadata }` — the canonical resource identifier for the
 * `resource` parameter, and the authorization server's own metadata.
 */
export async function discover(mcpUrl) {
  const protectedResource = await firstMetadata(
    metadataCandidates(mcpUrl, 'oauth-protected-resource'),
    'protected-resource discovery')
  const servers = Array.isArray(protectedResource.authorization_servers)
    ? protectedResource.authorization_servers.filter(entry => typeof entry === 'string')
    : []
  const issuer = servers[0]
  if (issuer === undefined) {
    throw new Error(`alma-mcp: ${mcpUrl} advertises no authorization server, so no token can be obtained for it`)
  }
  const metadata = await firstMetadata([
    ...metadataCandidates(issuer, 'oauth-authorization-server'),
    ...metadataCandidates(issuer, 'openid-configuration'),
  ], 'authorization-server discovery')
  for (const field of ['authorization_endpoint', 'token_endpoint']) {
    if (typeof metadata[field] !== 'string') {
      throw new Error(`alma-mcp: the authorization server metadata at ${issuer} declares no ${field}`)
    }
  }
  const resource = typeof protectedResource.resource === 'string' ? protectedResource.resource : mcpUrl
  return { resource, metadata }
}

/**
 * Register this deployment as a client, dynamically (RFC 7591).
 *
 * Registration is per store rather than per process: the resulting `client_id`
 * is written into the grant record, so a user registers once and every later
 * login reuses it. A deployment that would rather pin one pre-registered client
 * sets `clientId` in the row's config and never reaches this path.
 *
 * @param metadata - the authorization server's metadata.
 * @param options - `redirectUri`, `clientName` and requested `scopes`.
 * @returns `{ clientId, clientSecret }`; the secret is absent for a public client.
 */
export async function registerClient(metadata, options) {
  if (typeof metadata.registration_endpoint !== 'string') {
    throw new Error(
      'alma-mcp: the authorization server offers no dynamic registration, so a clientId must be set on the row',
    )
  }
  const body = await requestJson(metadata.registration_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      client_name: options.clientName,
      redirect_uris: [options.redirectUri],
      grant_types: ['authorization_code', 'refresh_token'],
      response_types: ['code'],
      token_endpoint_auth_method: 'client_secret_post',
      scope: options.scopes.join(' '),
    }),
  }, 'dynamic client registration')
  if (typeof body.client_id !== 'string' || body.client_id === '') {
    throw new Error('alma-mcp: dynamic client registration returned no client_id')
  }
  return {
    clientId: body.client_id,
    ...typeof body.client_secret === 'string' && body.client_secret !== ''
      ? { clientSecret: body.client_secret }
      : {},
  }
}

/**
 * Start an authorization: a fresh PKCE pair, a fresh `state`, and the URL the
 * human must open.
 * @param metadata - the authorization server's metadata.
 * @param options - `clientId`, `redirectUri`, `scopes` and the `resource` being asked for.
 * @returns `{ url, state, verifier }` — the last two are the attempt's secret half.
 */
export function startAuthorization(metadata, options) {
  const verifier = base64url(randomBytes(32))
  const challenge = base64url(createHash('sha256').update(verifier).digest())
  const state = base64url(randomBytes(24))
  const url = new URL(metadata.authorization_endpoint)
  url.searchParams.set('response_type', 'code')
  url.searchParams.set('client_id', options.clientId)
  url.searchParams.set('redirect_uri', options.redirectUri)
  url.searchParams.set('scope', options.scopes.join(' '))
  url.searchParams.set('state', state)
  url.searchParams.set('code_challenge', challenge)
  url.searchParams.set('code_challenge_method', 'S256')
  // RFC 8707: the MCP specification requires the resource the token is for, so
  // an audience-restricted token cannot be replayed at another server.
  url.searchParams.set('resource', options.resource)
  return { url: url.toString(), state, verifier }
}

/**
 * Client authentication on a token request: the secret in the body when there is
 * one, nothing when the client is public and PKCE carries the proof.
 * @param params - the request body being built.
 * @param options - `clientId` and optional `clientSecret`.
 */
function authenticateClient(params, options) {
  params.set('client_id', options.clientId)
  if (options.clientSecret !== undefined && options.clientSecret !== '') {
    params.set('client_secret', options.clientSecret)
  }
}

/**
 * Normalize a token response into the shape the grant record stores.
 * @param body - the token endpoint's JSON body.
 * @param previousRefreshToken - the refresh token in hand, kept when the server rotates nothing.
 * @returns the token set, with an absolute expiry in epoch milliseconds.
 */
function tokenSet(body, previousRefreshToken) {
  if (typeof body.access_token !== 'string' || body.access_token === '') {
    throw new Error('alma-mcp: the token endpoint returned no access_token')
  }
  const refreshToken = typeof body.refresh_token === 'string' && body.refresh_token !== ''
    ? body.refresh_token
    : previousRefreshToken
  return {
    accessToken: body.access_token,
    ...refreshToken !== undefined && { refreshToken },
    ...typeof body.expires_in === 'number' && Number.isFinite(body.expires_in)
      ? { expiresAt: Date.now() + body.expires_in * 1000 }
      : {},
    ...typeof body.scope === 'string' && { scope: body.scope },
  }
}

/**
 * Exchange an authorization code for tokens.
 * @param metadata - the authorization server's metadata.
 * @param options - `code`, `verifier`, `redirectUri`, `clientId`, optional `clientSecret`, and `resource`.
 * @returns the token set.
 */
export async function exchangeCode(metadata, options) {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code: options.code,
    redirect_uri: options.redirectUri,
    code_verifier: options.verifier,
    resource: options.resource,
  })
  authenticateClient(params, options)
  const body = await requestJson(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  }, 'authorization code exchange')
  return tokenSet(body, undefined)
}

/**
 * Refresh an access token.
 * @param metadata - the authorization server's metadata.
 * @param options - `refreshToken`, `clientId`, optional `clientSecret`, and `resource`.
 * @returns the token set, carrying the rotated refresh token when the server sent one.
 * @throws {RefreshRejectedError} when the server refused the refresh token for good.
 */
export async function refreshTokens(metadata, options) {
  const params = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: options.refreshToken,
    resource: options.resource,
  })
  authenticateClient(params, options)
  let body
  try {
    body = await requestJson(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }, 'token refresh')
  } catch (error) {
    // `invalid_grant` is the one refusal that will never succeed on a retry:
    // the grant is gone, and the user has to authorize again. Telling those two
    // cases apart is what lets the caller forget a dead grant instead of
    // retrying it until the reconnect budget runs out.
    if (error instanceof Error && error.oauthError === 'invalid_grant') {
      throw new RefreshRejectedError(error.message)
    }
    throw error
  }
  return tokenSet(body, options.refreshToken)
}
