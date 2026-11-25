// The administrative fence, judged against the endpoint names the harness really
// sends. Run with plain `node plugins/sso-auth/tests/policy.mjs`.
//
// The fence matched retired flat names (`credentials.set`) for two months and
// refused almost nothing, with every other test green. The first checks here
// tie each name the policy holds to upstream's own endpoint table, so the next
// rename fails this file instead of reopening the configuration plane.
import assert from 'node:assert/strict'
import { VIEWER_ENDPOINT_CLASSES } from '../../../packages/experimental/liveshare/src/endpoint-classification.ts'
import {
  ADMIN_ENDPOINTS, ADMIN_NAMESPACES, SESSION_CREATE, SETTINGS_WRITES, apiMethodOf, judge, needsBodyToJudge,
} from '../src/policy.ts'

let passed = 0
let failed = 0
async function check(name, fn) {
  try {
    await fn()
    passed += 1
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed += 1
    console.log(`FAIL  ${name}: ${error instanceof Error ? error.message : String(error)}`)
  }
}

const endpoints = new Set(Object.keys(VIEWER_ENDPOINT_CLASSES))
const namespaces = new Set([...endpoints].map(endpoint => endpoint.split('/', 1)[0]))
const user = { admin: false, label: 'user@example' }
const admin = { admin: true, label: 'admin@example' }
const envelope = (method, args) => ({ type: 'client-request', rpcId: 'r1', method, payload: { args } })

await check('every refused namespace exists upstream', () => {
  const missing = [...ADMIN_NAMESPACES].filter(ns => !namespaces.has(ns))
  assert.deepEqual(missing, [], `renamed or removed upstream: ${missing.join(', ')}`)
})

await check('every refused or inspected endpoint exists upstream', () => {
  const named = [...ADMIN_ENDPOINTS, ...SETTINGS_WRITES, SESSION_CREATE]
  const missing = named.filter(endpoint => !endpoints.has(endpoint))
  assert.deepEqual(missing, [], `renamed or removed upstream: ${missing.join(', ')}`)
})

await check('the configuration plane is refused to an ordinary user, by its real names', () => {
  for (const endpoint of [
    'credentials/set', 'credentials/describe', 'credentials/unset',
    'llm/discoverModels', 'llm/listConfigurableProviders', 'settings/openSettingsDocument',
    'agentPresets/select', 'permissionPresets/set', 'pluginManager/installBundle', 'pluginMarket/setIndexes',
    'dynamicCordisRunner/getClientCode', 'account/startSignIn', 'connectorAccounts/start',
    'liveshareShares/create', 'cuaAccess/requestPermission', 'directoryPicker/pick', 'session/openWorkspacePath',
  ]) {
    assert.ok(endpoints.has(endpoint), `${endpoint} is not a real endpoint`)
    assert.equal(judge(`/api/${endpoint}`, user).kind, 'refuse', endpoint)
  }
})

await check('an administrator is never refused', () => {
  assert.equal(judge('/api/credentials/set', admin).kind, 'allow')
  assert.equal(judge('/api/settings/update', admin, envelope('settings/update', { ns: 'shell' })).kind, 'allow')
})

await check('what an ordinary user needs stays open', () => {
  for (const endpoint of [
    'session/prompt', 'session/list', 'session/modelCatalog', 'session/selectModel', 'workspace/create',
    'directoryPicker/list', 'directoryPicker/createDirectory', 'llm/listProviders', 'settings/describe',
    'terminal/create', 'mcpManager/restart',
  ]) {
    assert.ok(endpoints.has(endpoint), `${endpoint} is not a real endpoint`)
    assert.equal(judge(`/api/${endpoint}`, user).kind, 'allow', endpoint)
  }
})

await check('settings writes are judged by the namespace in payload.args.ns', () => {
  for (const method of SETTINGS_WRITES) {
    assert.ok(needsBodyToJudge(method), method)
    assert.equal(judge(`/api/${method}`, user, envelope(method, { ns: 'ui-theme', patch: {} })).kind, 'allow')
    assert.equal(judge(`/api/${method}`, user, envelope(method, { ns: 'locale', patch: {} })).kind, 'allow')
    assert.equal(judge(`/api/${method}`, user, envelope(method, { ns: 'shell', patch: {} })).kind, 'refuse')
    assert.equal(judge(`/api/${method}`, user, envelope(method, { ns: 'mcp-client', patch: {} })).kind, 'refuse')
    assert.equal(judge(`/api/${method}`, user, envelope(method, {})).kind, 'refuse', 'no namespace')
    assert.equal(judge(`/api/${method}`, user, undefined).kind, 'refuse', 'no body')
  }
})

await check('the retired flat envelope cannot smuggle a namespace past the check', () => {
  // The old policy read `payload.ns`; the host reads `payload.args.ns`. A body
  // carrying both must be judged on what the host will act on.
  const body = { type: 'client-request', rpcId: 'r1', method: 'settings/update', payload: { ns: 'ui-theme', args: { ns: 'shell', patch: {} } } }
  assert.equal(judge('/api/settings/update', user, body).kind, 'refuse')
})

await check('session/create may not name an agent preset', () => {
  assert.ok(needsBodyToJudge(SESSION_CREATE))
  assert.equal(judge('/api/session/create', user, envelope('session/create', { request: {} })).kind, 'allow')
  assert.equal(judge('/api/session/create', user, envelope('session/create', { request: { agentPreset: 'ptc' } })).kind, 'refuse')
})

await check('only unary /api paths are judged; streams and pages pass', () => {
  assert.equal(apiMethodOf('/api/remote.mux'), 'remote.mux')
  assert.equal(judge('/api/remote.mux', user).kind, 'allow')
  assert.equal(apiMethodOf('/'), undefined)
  assert.equal(apiMethodOf('/api/'), undefined)
  assert.equal(needsBodyToJudge('session/prompt'), false)
})

console.log(`\n${passed} passed, ${failed} failed`)
if (failed > 0) process.exitCode = 1
