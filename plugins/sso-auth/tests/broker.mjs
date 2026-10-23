// A runnable smoke test for the gate's token-broker side: which session a
// backend's request resolves to, when the token is renewed first, that
// concurrent renewals of one session spend its refresh token once, and that a
// refused renewal ends the session — against a stand-in OIDC provider.
//
// The broker's HTTP contract is exercised end to end by
// plugins/compliance-alma-mcp/tests/smoke.mjs, which mounts it in front of the
// ALMA plugin; this file covers the gate behind it.
//
// The sources use TypeScript parameter properties, which Node's type stripping
// does not accept, so the transform mode is required:
//
//   node --experimental-transform-types plugins/sso-auth/tests/broker.mjs
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { resolveConfig } from '../src/config.ts'
import { SsoGate } from '../src/gate.ts'
import { SessionStore } from '../src/sessions.ts'

const results = []
const check = async (label, fn) => {
  try { await fn(); results.push(['PASS', label]) } catch (error) { results.push(['FAIL', `${label}: ${error.message}`]) }
}

// ── a provider that rotates refresh tokens, like Keycloak ────────────────────
const provider = { refreshes: 0, live: new Set(['refresh-1', 'refresh-b']), issued: 1, delayMs: 0 }
const server = createServer(async (req, res) => {
  const origin = `http://127.0.0.1:${String(server.address().port)}`
  const json = (status, body) => {
    res.writeHead(status, { 'content-type': 'application/json' })
    res.end(JSON.stringify(body))
  }
  if (req.url === '/.well-known/openid-configuration') {
    return json(200, { issuer: origin, authorization_endpoint: `${origin}/auth`, token_endpoint: `${origin}/token` })
  }
  if (req.url === '/token' && req.method === 'POST') {
    const chunks = []
    for await (const chunk of req) chunks.push(chunk)
    const form = new URLSearchParams(Buffer.concat(chunks).toString('utf8'))
    const presented = form.get('refresh_token')
    if (provider.delayMs > 0) await new Promise(resolve => setTimeout(resolve, provider.delayMs))
    if (!provider.live.has(presented)) return json(400, { error: 'invalid_grant' })
    // Rotation: the presented refresh token dies the moment it is used, which
    // is what makes a second concurrent renewal of the same session fatal.
    provider.live.delete(presented)
    provider.refreshes += 1
    provider.issued += 1
    const next = `refresh-${String(provider.issued)}`
    provider.live.add(next)
    return json(200, { access_token: `access-${String(provider.issued)}`, refresh_token: next, expires_in: 300 })
  }
  res.writeHead(404)
  res.end()
})
await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
const issuer = `http://127.0.0.1:${String(server.address().port)}`

const logs = []
const config = resolveConfig({ issuer, clientId: 'compliance-ai-harness', publicUrl: 'http://127.0.0.1:3080' })
const sessions = new SessionStore(config.sessionTtlMs, config.idleTimeoutMs)
const gate = new SsoGate({
  config,
  sessions,
  resolveSecret: async () => undefined,
  logger: { info: line => logs.push(line), warn: line => logs.push(line) },
})

const ana = sessions.create({ subject: 'ana' }, { accessToken: 'access-1', expiresInSeconds: 3600, refreshToken: 'refresh-1' })

await check('a fresh token is handed out as it is, with no renewal', async () => {
  const token = await gate.accessTokenFor('ana')
  assert.equal(token.accessToken, 'access-1')
  assert.equal(token.expiresAt, ana.accessExpiresAt)
  assert.equal(provider.refreshes, 0)
})

await check('a user with no session gets nothing', async () => {
  assert.equal(await gate.accessTokenFor('bob'), undefined)
})

await check('reading the token does not count as the user being active', async () => {
  const before = ana.lastSeenAt
  await new Promise(resolve => setTimeout(resolve, 5))
  await gate.accessTokenFor('ana')
  assert.equal(ana.lastSeenAt, before)
})

provider.delayMs = 50
await check('concurrent forced renewals of one session spend its refresh token once', async () => {
  const [first, second, third] = await Promise.all([
    gate.accessTokenFor('ana', { force: true }),
    gate.accessTokenFor('ana', { force: true }),
    gate.accessTokenFor('ana', { force: true }),
  ])
  assert.equal(provider.refreshes, 1)
  assert.equal(first.accessToken, 'access-2')
  assert.equal(second.accessToken, 'access-2')
  assert.equal(third.accessToken, 'access-2')
  assert.equal(ana.refreshToken, 'refresh-2')
})
provider.delayMs = 0

await check('a token inside the broker margin is renewed before it is handed out', async () => {
  ana.accessExpiresAt = Date.now() + 10_000
  const token = await gate.accessTokenFor('ana')
  assert.equal(provider.refreshes, 2)
  assert.equal(token.accessToken, 'access-3')
  assert.ok(token.expiresAt > Date.now() + 60_000)
})

await check('the most recently used of a user\'s sessions is the one asked', async () => {
  const other = sessions.create({ subject: 'ana' }, { accessToken: 'access-b', expiresInSeconds: 3600, refreshToken: 'refresh-b' })
  other.lastSeenAt = ana.lastSeenAt + 1
  assert.equal((await gate.accessTokenFor('ana')).accessToken, 'access-b')
  sessions.drop(other.id)
  assert.equal((await gate.accessTokenFor('ana')).accessToken, 'access-3')
})

await check('a renewal the provider refuses ends the session and hands out nothing', async () => {
  provider.live.clear()
  assert.equal(await gate.accessTokenFor('ana', { force: true }), undefined)
  assert.equal(sessions.size, 0)
  assert.ok(logs.some(line => line.includes('refresh failed for ana')))
})

await check('a session without a refresh token ends at its access token\'s expiry', async () => {
  const short = sessions.create({ subject: 'carla' }, { accessToken: 'access-c', expiresInSeconds: 10 })
  assert.equal(await gate.accessTokenFor('carla'), undefined)
  assert.equal(sessions.peek(short.id), undefined)
})

await new Promise((resolve) => { server.close(resolve) })

for (const [verdict, label] of results) console.log(`${verdict}  ${label}`)
const failed = results.filter(([verdict]) => verdict === 'FAIL')
console.log(`\n${String(results.length - failed.length)}/${String(results.length)} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
