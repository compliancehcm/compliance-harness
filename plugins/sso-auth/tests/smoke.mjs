// A runnable smoke test for the sso-auth plugin's pure halves: the config
// validation and the claim decisions over decoded payloads, including the
// GREMP_ID read out of Keycloak's `organization` claim.
//
// Not a vitest suite (`plugins/` is outside the include globs). Run it by hand:
//
//   node plugins/sso-auth/tests/smoke.mjs
//
// Node strips the TypeScript itself, so no build is needed. Only modules free of
// non-erasable syntax are imported here: `sessions.ts` uses constructor
// parameter properties, which type stripping refuses.
import assert from 'node:assert/strict'
import { checkClaimsAcross, resolveGrempId, toPrincipal } from '../src/claims.ts'
import { resolveConfig, SsoConfigError } from '../src/config.ts'

const results = []
const check = async (label, fn) => {
  try {
    await fn()
    results.push(['PASS', label])
  } catch (error) {
    results.push(['FAIL', `${label}: ${error.message}`])
  }
}

const BASE = {
  issuer: 'https://sso.example.com/realms/Example',
  clientId: 'compliance-ai-harness',
  publicUrl: 'https://ai.example.com',
}

/** The Organization Membership mapper's output with attributes enabled. */
const organization = (entries) => ({ sub: 'user-1', organization: entries })

// ------------------------------------------------------------------ config

await check('without grempId nothing changes: no organization scope, no grempId field', () => {
  const config = resolveConfig(BASE)
  assert.deepEqual(config.scopes, ['openid', 'profile', 'email'])
  assert.equal(config.grempId, undefined)
})

await check('an empty grempId block reads gremp_id, is required, and requests the organization scope', () => {
  const config = resolveConfig({ ...BASE, grempId: {} })
  assert.deepEqual(config.grempId, { organizationAttribute: 'gremp_id', required: true })
  assert.deepEqual(config.scopes, ['openid', 'profile', 'email', 'organization'])
})

await check('grempId honours a custom attribute and required: false', () => {
  const config = resolveConfig({ ...BASE, grempId: { organizationAttribute: 'grupo', required: false } })
  assert.deepEqual(config.grempId, { organizationAttribute: 'grupo', required: false })
})

await check('an organization scope already written is kept, not doubled', () => {
  for (const scope of ['organization', 'organization:*', 'organization:acme']) {
    const config = resolveConfig({ ...BASE, scopes: ['openid', scope], grempId: {} })
    assert.deepEqual(config.scopes, ['openid', scope])
  }
})

await check('mixed organization scope formats are refused at load', () => {
  assert.throws(
    () => resolveConfig({ ...BASE, scopes: ['openid', 'organization', 'organization:acme'] }),
    /mixes organization scope formats/,
  )
  assert.throws(
    () => resolveConfig({ ...BASE, scopes: ['openid', 'organization:*', 'organization:acme'] }),
    /mixes organization scope formats/,
  )
  // Several aliases are one format, and Keycloak accepts them.
  resolveConfig({ ...BASE, scopes: ['openid', 'organization:a', 'organization:b'] })
})

await check('a malformed grempId block is refused, unknown fields included', () => {
  assert.throws(() => resolveConfig({ ...BASE, grempId: 'gremp_id' }), SsoConfigError)
  assert.throws(() => resolveConfig({ ...BASE, grempId: { required: 'yes' } }), /grempId.required/)
  assert.throws(() => resolveConfig({ ...BASE, grempId: { claimPath: 'gremp_id' } }), /unknown field grempId.claimPath/)
  assert.throws(() => resolveConfig({ ...BASE, grempId: { organizationAttribute: '' } }), /organizationAttribute/)
})

// ------------------------------------------------------------------ GREMP_ID

await check('the GREMP_ID is read from the organization attribute, multivalued as Keycloak sends it', () => {
  const verdict = resolveGrempId(
    [{ label: 'id_token', claims: organization({ acme: { id: 'uuid-1', gremp_id: ['42'] } }) }],
    'gremp_id',
  )
  assert.deepEqual(verdict, { ok: true, grempId: '42', organization: 'acme', matchedIn: 'id_token' })
})

await check('a plain string or integer attribute is accepted, trimmed', () => {
  for (const value of [' 42 ', 42, [42]]) {
    const verdict = resolveGrempId([{ label: 'id_token', claims: organization({ acme: { gremp_id: value } }) }], 'gremp_id')
    assert.equal(verdict.ok && verdict.grempId, '42')
  }
})

await check('the access token is searched when the id_token lacks the claim', () => {
  const verdict = resolveGrempId([
    { label: 'id_token', claims: { sub: 'user-1' } },
    { label: 'access_token', claims: organization({ acme: { gremp_id: ['7'] } }) },
  ], 'gremp_id')
  assert.equal(verdict.ok && verdict.matchedIn, 'access_token')
})

await check('an absent claim says to grant the organization scope', () => {
  const verdict = resolveGrempId([{ label: 'id_token', claims: { sub: 'user-1' } }], 'gremp_id')
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /organization claim is absent/)
})

await check('an aliases-only claim says to enable organization attributes on the mapper', () => {
  const verdict = resolveGrempId([{ label: 'id_token', claims: organization(['acme']) }], 'gremp_id')
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /Add organization attributes/)
})

await check('an organization without the attribute, or with several values, is named in the refusal', () => {
  const missing = resolveGrempId([{ label: 'id_token', claims: organization({ acme: { other: ['1'] } }) }], 'gremp_id')
  assert.equal(missing.ok, false)
  assert.match(missing.reason, /"acme" has no gremp_id attribute/)
  const several = resolveGrempId([{ label: 'id_token', claims: organization({ acme: { gremp_id: ['1', '2'] } }) }], 'gremp_id')
  assert.equal(several.ok, false)
  assert.match(several.reason, /"acme" holds \["1","2"\] in gremp_id/)
})

await check('several organizations with different GREMP_IDs are refused as ambiguous', () => {
  const verdict = resolveGrempId([{
    label: 'id_token',
    claims: organization({ acme: { gremp_id: ['1'] }, globex: { gremp_id: ['2'] } }),
  }], 'gremp_id')
  assert.equal(verdict.ok, false)
  assert.match(verdict.reason, /several organizations with different gremp_id values \(acme: 1, globex: 2\)/)
})

await check('several organizations sharing one GREMP_ID resolve to it', () => {
  const verdict = resolveGrempId([{
    label: 'id_token',
    claims: organization({ acme: { gremp_id: ['1'] }, other: { name: ['x'] }, again: { gremp_id: ['1'] } }),
  }], 'gremp_id')
  assert.deepEqual(verdict, { ok: true, grempId: '1', organization: 'acme', matchedIn: 'id_token' })
})

// ------------------------------------------------------------------ existing claim rules

await check('the role requirement and the principal projection are unchanged', () => {
  const claims = { sub: 'user-1', email: 'a@b.c', resource_access: { app: { roles: ['dsh-access'] } } }
  assert.equal(checkClaimsAcross([{ label: 'id_token', claims }], { claimPath: 'resource_access.app.roles', anyOf: ['dsh-access'] }).ok, true)
  assert.deepEqual(toPrincipal(claims), { subject: 'user-1', email: 'a@b.c' })
})

// ------------------------------------------------------------------ report

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} passed, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
