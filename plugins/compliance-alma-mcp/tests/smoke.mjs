// A runnable smoke test for the whole plugin: tools mounted at boot, a real MCP
// session over the relay carrying the user's SSO token, the cache, a 401 that
// forces a renewal, a session that ended and came back — against a stand-in
// ALMA and the REAL token broker from `plugins/sso-auth`, so the contract
// between the two plugins is exercised rather than restated.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-alma-mcp/tests/smoke.mjs
//
// It needs `pnpm run build` to have run, because it mounts the built
// `@deepseek-ai/dsh-mcp-client` the way a per-user backend does, and Node 24,
// whose type stripping loads the broker's TypeScript source as it is.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { createBroker } from '../../sso-auth/src/broker.ts'
import { startFakeAlma } from './fake-alma.mjs'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, name, inject } from '../index.js'
import { RELAY_HEADER } from '../src/relay.js'
import { resolveConfig } from '../src/config.js'
import { TOKEN_KEY_ENV, TOKEN_URL_ENV } from '../src/sso-token.js'
import { readFileSync } from 'node:fs'

/** The repository root, three levels up from this file. */
const REPO_ROOT = new URL('../../../', import.meta.url).pathname.replace(/\/$/, '')

// From the package that DECLARES the SDK, not from `apps/cli`: pnpm's strict
// layout does not hoist an undeclared dependency into reach, so resolving it
// from apps/cli works only on a machine with the SDK in an ancestor
// `node_modules`. `@modelcontextprotocol/client` is the SDK's current entry —
// see `packages/mcp/mcp-client/src/connection.ts`.
const sdkRequire = createRequire(`${REPO_ROOT}/packages/mcp/mcp-client/package.json`)
const { Client, StreamableHTTPClientTransport } = await import(
  pathToFileURL(sdkRequire.resolve('@modelcontextprotocol/client')).href)

const results = []
const check = (label, fn) => { try { fn(); results.push(['PASS', label]) } catch (error) { results.push(['FAIL', `${label}: ${error.message}`]) } }

const alma = await startFakeAlma()

// ── the gateway side: one user, one session, the real broker in front ───────
const BACKEND_KEY = 'key-for-ana'
const gateway = {
  /** The session's current token, or undefined once the human signed out. */
  session: { accessToken: 'sso-1', expiresAt: Date.now() + 3_600_000 },
  /** What the broker was asked, in order. */
  requests: [],
  /** The next token a renewal mints. */
  issued: 1,
}
const issue = () => {
  gateway.issued += 1
  const accessToken = `sso-${String(gateway.issued)}`
  alma.state.acceptedTokens.add(accessToken)
  gateway.session = { accessToken, expiresAt: Date.now() + 3_600_000 }
}
alma.state.acceptedTokens.add('sso-1')
const broker = createBroker({
  identify: key => (key === BACKEND_KEY ? 'ana' : undefined),
  accessTokenFor: async (subject, options) => {
    gateway.requests.push({ subject, force: options.force === true })
    if (gateway.session === undefined) return undefined
    if (options.force === true) issue()
    return gateway.session
  },
  logger: { info: () => {} },
})
const brokerServer = createServer((req, res) => { void broker(req, res) })
await new Promise((resolve) => { brokerServer.listen(0, '127.0.0.1', resolve) })
const brokerUrl = `http://127.0.0.1:${String(brokerServer.address().port)}/_compliance/sso-token`

const brokerGet = await fetch(brokerUrl)
check('the broker is POST-only', () => { assert.equal(brokerGet.status, 405) })
const brokerStranger = await fetch(brokerUrl, { method: 'POST', headers: { authorization: 'Bearer someone-else' } })
check('the broker refuses a key no backend holds', () => {
  assert.equal(brokerStranger.status, 401)
  assert.equal(gateway.requests.length, 0)
})

// ── the backend side: what tenancy would have put in its environment ────────
process.env[TOKEN_URL_ENV] = brokerUrl
process.env[TOKEN_KEY_ENV] = BACKEND_KEY

const harness = await createFakeCtx()
const { ctx } = harness

assert.equal(name, 'alma-mcp')
assert.deepEqual(inject, ['webServer'])

await apply(ctx, {
  mcpUrl: alma.mcpUrl,
  serverName: 'alma',
  resolveMcpClientFrom: `${REPO_ROOT}/apps/cli`,
  refreshSkewSeconds: 30,
  toolCallTimeoutMs: 300_000,
})

const get = (path, init = {}) => fetch(`${harness.origin}${path}`, { redirect: 'manual', ...init })

// ── mounted at boot ──────────────────────────────────────────────────────────
check('one mcp-client mounted at boot, at the relay, with the nonce', () => {
  assert.equal(harness.mounted.length, 1)
  const config = harness.mounted[0].config
  assert.equal(config.serverName, 'alma')
  assert.equal(config.transport, 'streamable-http')
  assert.equal(config.url, `http://127.0.0.1:${ctx.webServer.port}/alma/mcp`)
  assert.ok(config.headers[RELAY_HEADER])
  assert.equal(config.toolCallTimeoutMs, 300_000)
})
check('the mounted client never gives up reconnecting', () => {
  assert.equal(harness.mounted[0].config.reconnect.maxAttempts, Number.MAX_SAFE_INTEGER)
})
check('the mounted module is the real mcp-client plugin', () => {
  assert.equal(harness.mounted[0].plugin.name, 'mcp-client')
})

check('the alma-hcm skill is registered with the mounted tools', () => {
  assert.equal(harness.skills.length, 1)
  const [skill] = harness.skills
  assert.equal(skill.name, 'alma-hcm')
  assert.match(skill.description, /^Guia operacional das ferramentas MCP de HCM da Alma/)
  assert.equal(skill.resourceBase.kind, 'directory')
})
check('the skill body is ALMA\'s guide verbatim, behind a note naming this harness\'s tool prefix', () => {
  const [skill] = harness.skills
  const file = readFileSync(skill.path, 'utf8')
  const body = file.slice(file.indexOf('\n---\n', 4) + 5).trim()
  assert.ok(skill.content.endsWith(body), 'the guide itself is not edited')
  assert.ok(skill.content.startsWith('> **Neste harness.**'))
  assert.match(skill.content.slice(0, skill.content.indexOf(body)), /`mcp__alma__get_empresas`/)
})

const relayUnauthorized = await get('/alma/mcp', { method: 'POST', body: '{}', headers: { 'content-type': 'application/json' } })
check('relay refuses a caller with no nonce', () => { assert.equal(relayUnauthorized.status, 403) })
check('a refused caller cost no token request', () => { assert.equal(gateway.requests.length, 0) })

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
check('a tool call reaches ALMA carrying the SSO token', () => {
  assert.equal(called.content[0].text, 'Ana Souza — analista de RH')
  assert.equal(alma.state.toolCalls, 1)
  assert.ok(alma.state.presented.every(token => token === 'sso-1'))
})
check('the token was asked for once, for the right user, and then cached', () => {
  assert.deepEqual(gateway.requests, [{ subject: 'ana', force: false }])
})

const status = await (await get('/alma/status')).json()
check('status reports the mounted client and the token, never the token itself', () => {
  assert.equal(status.mounted, true)
  assert.equal(status.source, 'sso')
  assert.equal(status.hasToken, true)
  assert.ok(!JSON.stringify(status).includes('sso-1'))
})

// ── a 401 on a token that looked fresh ───────────────────────────────────────
alma.state.acceptedTokens.delete('sso-1')
const afterRetry = await client.listTools()
check('a 401 forces one renewal and one retry with the new token', () => {
  assert.deepEqual(afterRetry.tools.map(tool => tool.name), ['consultar_colaborador'])
  assert.deepEqual(gateway.requests.at(-1), { subject: 'ana', force: true })
  assert.equal(alma.state.presented.at(-1), 'sso-2')
})

// ── the human signed out ─────────────────────────────────────────────────────
gateway.session = undefined
alma.state.acceptedTokens.delete('sso-2')
let signedOutError
try {
  await client.callTool({ name: 'consultar_colaborador', arguments: { nome: 'Ana' } })
} catch (error) {
  signedOutError = error
}
check('with no live session the call fails with a reason, not a hang', () => {
  assert.ok(signedOutError !== undefined)
})
check('the tools stay mounted for when the human comes back', () => {
  assert.equal(harness.mounted[0].disposed, false)
})
const signedOutStatus = await (await get('/alma/status')).json()
check('status says the user must sign in again', () => {
  assert.equal(signedOutStatus.hasToken, false)
  assert.match(signedOutStatus.error, /sign in again/)
})

// ── the human signed back in ─────────────────────────────────────────────────
issue()
const asked = gateway.requests.length
const burst = await Promise.all([client.listTools(), client.listTools(), client.listTools()])
check('after signing in again the same tools work, with no remount', () => {
  assert.ok(burst.every(result => result.tools.length === 1))
  assert.equal(harness.mounted.length, 1)
  assert.equal(alma.state.presented.at(-1), gateway.session.accessToken)
})
check('a burst of requests with no cached token asks the broker once', () => {
  assert.equal(gateway.requests.length, asked + 1)
})

await transport.close().catch(() => {})
await harness.close()

// ── a process with no broker ─────────────────────────────────────────────────
delete process.env[TOKEN_URL_ENV]
delete process.env[TOKEN_KEY_ENV]
const shared = await createFakeCtx()
await apply(shared.ctx, { mcpUrl: alma.mcpUrl, resolveMcpClientFrom: `${REPO_ROOT}/apps/cli` })
check('without a broker nothing is mounted and the log says why', () => {
  assert.equal(shared.mounted.length, 0)
  assert.ok(shared.logs.some(([level, line]) => level === 'warn' && line.includes(TOKEN_URL_ENV)))
})
const sharedStatus = await (await fetch(`${shared.origin}/alma/status`)).json()
check('the status route still answers without a broker', () => {
  assert.equal(sharedStatus.mounted, false)
  assert.equal(sharedStatus.source, 'none')
})
check('without a broker there are no tools, so there is no guide to them either', () => {
  assert.equal(shared.skills.length, 0)
})
await shared.close()

process.env[TOKEN_URL_ENV] = brokerUrl
process.env[TOKEN_KEY_ENV] = BACKEND_KEY
const noRegistry = await createFakeCtx({ withSkills: false })
await apply(noRegistry.ctx, { mcpUrl: alma.mcpUrl, resolveMcpClientFrom: `${REPO_ROOT}/apps/cli` })
check('a composition without a skill registry still mounts the tools and says why the skill is missing', () => {
  assert.equal(noRegistry.mounted.length, 1)
  assert.ok(noRegistry.logs.some(([level, line]) => level === 'warn' && line.includes('alma-hcm')))
})
await noRegistry.close()
const optedOut = await createFakeCtx()
await apply(optedOut.ctx, { mcpUrl: alma.mcpUrl, resolveMcpClientFrom: `${REPO_ROOT}/apps/cli`, registerSkill: false })
check('registerSkill: false keeps the tools and drops the skill', () => {
  assert.equal(optedOut.mounted.length, 1)
  assert.equal(optedOut.skills.length, 0)
})
await optedOut.close()
delete process.env[TOKEN_URL_ENV]
delete process.env[TOKEN_KEY_ENV]

const strict = await createFakeCtx()
let strictError
try {
  await apply(strict.ctx, { mcpUrl: alma.mcpUrl, resolveMcpClientFrom: '/a', failOnStartupError: true })
} catch (error) {
  strictError = error
}
check('failOnStartupError turns a missing broker into a boot failure', () => {
  assert.match(String(strictError), new RegExp(TOKEN_URL_ENV))
})
await strict.close()

// ── config validation ────────────────────────────────────────────────────────
check('an unknown field is rejected', () => {
  assert.throws(() => resolveConfig({ mcpUrl: 'https://x/mcp', resolveMcpClientFrom: '/a', bogus: 1 }), /unknown field "bogus"/)
})
check('the retired OAuth fields are rejected rather than silently ignored', () => {
  assert.throws(() => resolveConfig({
    mcpUrl: 'https://x/mcp', resolveMcpClientFrom: '/a', publicUrl: 'https://y', clientId: 'c',
  }), error => /unknown field "publicUrl"/.test(error.message) && /unknown field "clientId"/.test(error.message))
})
check('every missing required field is reported at once', () => {
  assert.throws(() => resolveConfig({}), error =>
    /mcpUrl is required/.test(error.message) && /resolveMcpClientFrom is required/.test(error.message))
})

await new Promise((resolve) => { brokerServer.close(resolve) })
await alma.close()

for (const [verdict, label] of results) console.log(`${verdict}  ${label}`)
const failed = results.filter(([verdict]) => verdict === 'FAIL')
console.log(`\n${String(results.length - failed.length)}/${String(results.length)} checks passed`)
process.exit(failed.length === 0 ? 0 : 1)
