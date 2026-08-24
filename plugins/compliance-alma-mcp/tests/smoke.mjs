// A runnable smoke test for the whole plugin: an OAuth login, a real MCP session
// over the relay, a refresh, a 401 retry, a revoked grant, and a disconnect —
// against a stand-in ALMA that advertises the shape the real one does.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-alma-mcp/tests/smoke.mjs
//
// It needs `pnpm run build` to have run, because it mounts the built
// `@deepseek-ai/dsh-mcp-client` the way a per-user backend does.
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { startFakeAlma } from './fake-alma.mjs'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, name, inject } from '../index.js'
import { RELAY_HEADER } from '../src/relay.js'
import { resolveConfig } from '../src/config.js'

/** The repository root, three levels up from this file. */
const REPO_ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')

// The MCP SDK is a dependency of the CLI, not of this package — resolved the
// same way src/mcp.js resolves the client itself.
const cliRequire = createRequire(`${REPO_ROOT}/apps/cli/package.json`)
const { Client } = await import(pathToFileURL(cliRequire.resolve('@modelcontextprotocol/sdk/client/index.js')).href)
const { StreamableHTTPClientTransport } = await import(
  pathToFileURL(cliRequire.resolve('@modelcontextprotocol/sdk/client/streamableHttp.js')).href)

const results = []
const check = (label, fn) => { try { fn(); results.push(['PASS', label]) } catch (error) { results.push(['FAIL', `${label}: ${error.message}`]) } }

const alma = await startFakeAlma({ accessTokenTtlSeconds: 3600 })
const harness = await createFakeCtx()
const { ctx } = harness

assert.equal(name, 'alma-mcp')
assert.deepEqual(inject, ['webServer', 'credentials'])

await apply(ctx, {
  mcpUrl: alma.mcpUrl,
  publicUrl: harness.origin,
  serverName: 'alma',
  resolveMcpClientFrom: `${REPO_ROOT}/apps/cli`,
  refreshSkewSeconds: 120,
  toolCallTimeoutMs: 300_000,
})

const get = (path, init = {}) => fetch(`${harness.origin}${path}`, { redirect: 'manual', ...init })

// ── not connected yet ────────────────────────────────────────────────────────
const before = await (await get('/alma/status', { headers: { accept: 'application/json' } })).json()
check('status starts disconnected', () => { assert.equal(before.connected, false) })
check('no mcp client mounted before a grant', () => { assert.equal(harness.mounted.length, 0) })

const relayUnauthorized = await get('/alma/mcp', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
check('relay refuses a caller with no nonce', () => { assert.equal(relayUnauthorized.status, 403) })

// ── the login ────────────────────────────────────────────────────────────────
const connect = await get('/alma/connect?returnTo=%2Fsessions%2Fabc')
check('connect redirects to the authorization server', () => {
  assert.equal(connect.status, 302)
  const location = new URL(connect.headers.get('location'))
  assert.equal(location.origin, alma.origin)
  assert.equal(location.pathname, '/authorize')
  assert.equal(location.searchParams.get('code_challenge_method'), 'S256')
  assert.equal(location.searchParams.get('resource'), `${alma.origin}/mcp`)
  assert.equal(location.searchParams.get('redirect_uri'), `${harness.origin}/alma/callback`)
  assert.equal(location.searchParams.get('scope'), 'openid profile')
})
check('the workspace registered itself dynamically', () => { assert.equal(alma.state.clients.size, 1) })

const authorized = await fetch(connect.headers.get('location'), { redirect: 'manual' })
const callbackUrl = new URL(authorized.headers.get('location'))
const callback = await get(`${callbackUrl.pathname}${callbackUrl.search}`)
check('callback returns the human to where they started', () => {
  assert.equal(callback.status, 302)
  assert.equal(callback.headers.get('location'), '/sessions/abc')
})

const after = await (await get('/alma/status', { headers: { accept: 'application/json' } })).json()
check('status reports connected with a scope', () => {
  assert.equal(after.connected, true)
  assert.equal(after.scope, 'openid profile')
  assert.ok(typeof after.expiresAt === 'number')
})
check('the grant is a grant record under the plugin key', () => {
  const record = harness.records.get('alma-mcp/alma')
  assert.equal(record.kind, 'grant')
  assert.equal(record.payload.accessToken, 'access-1')
  assert.ok(record.payload.refreshToken)
})

// ── the mounted client ───────────────────────────────────────────────────────
check('one mcp-client mounted at the relay, with the nonce', () => {
  assert.equal(harness.mounted.length, 1)
  const config = harness.mounted[0].config
  assert.equal(config.serverName, 'alma')
  assert.equal(config.transport, 'streamable-http')
  assert.equal(config.url, `http://127.0.0.1:${ctx.webServer.port}/alma/mcp`)
  assert.ok(config.headers[RELAY_HEADER])
  // The cap the SDK answers -32001 against reaches the mounted row, rather than
  // silently staying at the SDK's own 60s default.
  assert.equal(config.toolCallTimeoutMs, 300_000)
})
check('the mounted module is the real mcp-client plugin', () => {
  assert.equal(harness.mounted[0].plugin.name, 'mcp-client')
})
check('the client half learns the routes from the boot global', () => {
  const table = []
  harness.emit('webserver/index-inject', table)
  assert.deepEqual(table[0], {
    kind: 'global',
    name: '__ALMA_ROUTES__',
    value: {
      connect: '/alma/connect',
      callback: '/alma/callback',
      status: '/alma/status',
      disconnect: '/alma/disconnect',
      relay: '/alma/mcp',
    },
  })
})

// ── a real MCP session over the relay ────────────────────────────────────────
const nonce = harness.mounted[0].config.headers[RELAY_HEADER]
const client = new Client({ name: 'relay-probe', version: '0.0.1' })
const transport = new StreamableHTTPClientTransport(
  new URL(`${harness.origin}/alma/mcp`),
  { requestInit: { headers: { [RELAY_HEADER]: nonce } } },
)
await client.connect(transport)
const tools = await client.listTools()
check('an MCP client speaks to ALMA through the relay', () => {
  assert.deepEqual(tools.tools.map(tool => tool.name), ['consultar_colaborador'])
})
const called = await client.callTool({ name: 'consultar_colaborador', arguments: { nome: 'Ana' } })
check('a tool call reaches ALMA', () => {
  assert.equal(called.content[0].text, 'Ana Souza — analista de RH')
  assert.equal(alma.state.toolCalls, 1)
})

// ── refresh on a stale token ─────────────────────────────────────────────────
const record = harness.records.get('alma-mcp/alma')
harness.records.set('alma-mcp/alma', { ...record, payload: { ...record.payload, expiresAt: Date.now() + 1_000 } })
const refreshesBefore = alma.state.refreshes
await client.listTools()
check('a token inside the skew window is refreshed before the call', () => {
  assert.equal(alma.state.refreshes, refreshesBefore + 1)
  assert.equal(harness.records.get('alma-mcp/alma').payload.accessToken, 'access-2')
})
check('refreshing did not remount the client', () => { assert.equal(harness.mounted.length, 1) })

// ── a 401 on a token that looked fresh ───────────────────────────────────────
alma.state.rejectNextBearer = true
const refreshesBefore401 = alma.state.refreshes
const afterRetry = await client.listTools()
check('a 401 forces one refresh and one retry', () => {
  assert.equal(alma.state.refreshes, refreshesBefore401 + 1)
  assert.deepEqual(afterRetry.tools.map(tool => tool.name), ['consultar_colaborador'])
})

// ── a dead refresh token ─────────────────────────────────────────────────────
const live = harness.records.get('alma-mcp/alma')
harness.records.set('alma-mcp/alma', {
  ...live,
  payload: { ...live.payload, refreshToken: 'revoked', expiresAt: Date.now() - 1000 },
})
const refusedRelay = await get('/alma/mcp', {
  method: 'POST',
  headers: { 'content-type': 'application/json', accept: 'application/json, text/event-stream', [RELAY_HEADER]: nonce },
  body: JSON.stringify({ jsonrpc: '2.0', id: 9, method: 'tools/list' }),
})
check('a revoked grant answers 401 and is forgotten, registration kept', () => {
  assert.equal(refusedRelay.status, 401)
  const kept = harness.records.get('alma-mcp/alma')
  assert.equal(kept.payload.accessToken, undefined)
  assert.equal(kept.payload.refreshToken, undefined)
  assert.ok(kept.payload.clientId)
})
check('a dead grant takes its tools with it', () => { assert.equal(harness.mounted[0].disposed, true) })

// ── disconnect ───────────────────────────────────────────────────────────────
await get('/alma/connect')
const secondAuthorize = await fetch((await get('/alma/connect')).headers.get('location'), { redirect: 'manual' })
const secondCallback = new URL(secondAuthorize.headers.get('location'))
await get(`${secondCallback.pathname}${secondCallback.search}`)
check('a second login reuses the registered client and remounts', () => {
  assert.equal(alma.state.clients.size, 1)
  assert.equal(harness.mounted.length, 2)
  assert.equal(harness.mounted[1].disposed, false)
})

const disconnected = await get('/alma/disconnect', { method: 'POST', headers: { accept: 'application/json' } })
check('disconnect forgets the tokens but keeps the registration', () => {
  assert.equal(disconnected.status, 200)
  const kept = harness.records.get('alma-mcp/alma')
  assert.equal(kept.payload.accessToken, undefined)
  assert.ok(kept.payload.clientId)
})
const getDisconnect = await get('/alma/disconnect')
check('disconnect is POST-only', () => { assert.equal(getDisconnect.status, 405) })
check('disconnect disposed the live client', () => { assert.equal(harness.mounted[1].disposed, true) })

// ── an off-site returnTo, last: a login here disturbs no token count above ────
const hostile = await get('/alma/connect?returnTo=https://evil.example/steal')
const hostileAuthorized = await fetch(hostile.headers.get('location'), { redirect: 'manual' })
const hostileCallback = new URL(hostileAuthorized.headers.get('location'))
const hostileLanded = await get(`${hostileCallback.pathname}${hostileCallback.search}`)
check('an off-site returnTo is refused, not followed', () => {
  assert.equal(hostileLanded.status, 302)
  assert.equal(hostileLanded.headers.get('location'), '/')
})

// ── config validation ────────────────────────────────────────────────────────
check('an unknown field is rejected', () => {
  assert.throws(() => resolveConfig({
    mcpUrl: 'https://x/mcp', publicUrl: 'https://y', resolveMcpClientFrom: '/a', bogus: 1,
  }), /unknown field "bogus"/)
})
check('every missing required field is reported at once', () => {
  assert.throws(() => resolveConfig({}), (error) =>
    /mcpUrl is required/.test(error.message)
    && /publicUrl is required/.test(error.message)
    && /resolveMcpClientFrom is required/.test(error.message))
})
check('a secret value in place of a variable name is rejected', () => {
  assert.throws(() => resolveConfig({
    mcpUrl: 'https://x/mcp', publicUrl: 'https://y', resolveMcpClientFrom: '/a',
    clientId: 'c', clientSecretEnv: 'sh-secret-value',
  }), /clientSecretEnv must be an environment-variable name/)
})

await transport.close().catch(() => {})
await harness.close()
await alma.close()

for (const [verdict, label] of results) console.log(`${verdict}  ${label}`)
const failed = results.filter(([verdict]) => verdict === 'FAIL')
console.log(`\n${String(results.length - failed.length)}/${String(results.length)} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
