/**
 * The stored ALMA grant.
 *
 * It lives in `ctx.credentials` as a `grant` record rather than in a file of
 * this plugin's own, for two reasons: under tenancy that store is already the
 * per-user one inside the jail's single writable tree, and `modifyRecord` is a
 * read-modify-write whose exclusion holds ACROSS processes — which is exactly
 * what a refresh-token rotation needs, since two processes rotating one refresh
 * token concurrently would otherwise lose whichever wrote first.
 *
 * The payload is opaque to the seam; this module is the only thing that reads or
 * writes its shape.
 *
 * @module
 */

/**
 * Record address: `<owner>/<id>`, where the owner is this plugin's registered
 * name. Both segments must match `[a-z][a-z0-9-]*`.
 */
export const RECORD_KEY = 'alma-mcp/alma'

/**
 * Read the stored grant.
 *
 * A record of another kind, or one whose payload is not an object, is reported
 * as absent: it was not written by this module, and guessing at it would be
 * worse than asking the user to connect again.
 *
 * @param ctx - plugin context carrying `ctx.credentials`.
 * @returns the grant payload, or undefined while nothing usable is stored.
 */
export async function readGrant(ctx) {
  const record = await ctx.credentials.readRecord(RECORD_KEY)
  if (record === undefined) return undefined
  if (record.kind !== 'grant' || typeof record.payload !== 'object' || record.payload === null) {
    ctx.logger.warn('alma-mcp: the stored credential record is not an ALMA grant; treating it as absent')
    return undefined
  }
  return record.payload
}

/**
 * Read-decide-replace the stored grant under the store's exclusive write.
 * @param ctx - plugin context carrying `ctx.credentials`.
 * @param mutate - receives the current payload (or undefined) and returns the replacement, or undefined to leave it untouched.
 * @returns the payload after the write, or undefined when nothing is stored.
 */
export async function modifyGrant(ctx, mutate) {
  const written = await ctx.credentials.modifyRecord(RECORD_KEY, async (current) => {
    const payload = current !== undefined && current.kind === 'grant'
      && typeof current.payload === 'object' && current.payload !== null
      ? current.payload
      : undefined
    const next = await mutate(payload)
    return next === undefined ? undefined : { kind: 'grant', payload: next }
  })
  return written !== undefined && written.kind === 'grant' ? written.payload : undefined
}

/**
 * Forget the tokens while keeping the client registration.
 *
 * Local only: the authorization server is not told, because the seam has no
 * place for a provider-side revoke. The `clientId` deliberately survives —
 * it identifies this workspace as an OAuth client, not the human, so deleting
 * the whole record would make every sign-out cost a new dynamic registration
 * on ALMA's side.
 *
 * @param ctx - plugin context carrying `ctx.credentials`.
 */
export async function forgetTokens(ctx) {
  await ctx.credentials.modifyRecord(RECORD_KEY, async (current) => {
    if (current === undefined || current.kind !== 'grant'
      || typeof current.payload !== 'object' || current.payload === null) {
      return undefined
    }
    const { accessToken, refreshToken, expiresAt, scope, connectedAt, refreshedAt, ...kept } = current.payload
    return { kind: 'grant', payload: kept }
  })
}

/**
 * Whether an access token is still usable, given the configured skew.
 * @param grant - the stored grant, or undefined.
 * @param skewSeconds - how long before real expiry a token counts as expired.
 * @returns true when the access token can be sent as-is.
 */
export function accessTokenIsFresh(grant, skewSeconds) {
  if (grant === undefined || typeof grant.accessToken !== 'string' || grant.accessToken === '') return false
  // A token with no stated lifetime is used until the server rejects it: the
  // relay's 401 retry is what recovers from that, so guessing an expiry here
  // would only refresh a working token needlessly.
  if (typeof grant.expiresAt !== 'number') return true
  return grant.expiresAt - skewSeconds * 1000 > Date.now()
}
