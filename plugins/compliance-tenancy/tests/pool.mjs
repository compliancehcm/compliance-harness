// The backend pool, with a fake starter: reuse, role-change restarts, and their ordering.
//
// A user's composition (ordinary or administrative) is fixed when the backend
// starts. Admin standing is decided at login, and an open tab keeps the backend
// from ever going idle, so without a restart on a role change a user granted
// `dsh-admin` kept the ordinary composition (no Plugins page), and one whose
// role was revoked kept the administrative one, until the pod restarted.
//
// Run: node --experimental-transform-types plugins/compliance-tenancy/tests/pool.mjs

import assert from 'node:assert/strict'
import { BackendPool } from '../src/pool.ts'
import { RoleStanding } from '../src/standing.ts'

let passed = 0
let failed = 0
async function check(name, fn) {
  try {
    await fn()
    passed++
    console.log(`PASS  ${name}`)
  } catch (error) {
    failed++
    console.log(`FAIL  ${name}\n\n${error instanceof Error ? error.message : String(error)}\n`)
  }
}

/** A pool whose starter records every start and stop, in order. */
function fakePool() {
  const events = []
  let pid = 100
  const pool = new BackendPool({
    portRange: [31000, 31010],
    maxBackends: 4,
    idleReapMs: 60_000,
    logger: { info() {}, warn() {} },
    starter: async (key, port, variant) => {
      const id = ++pid
      events.push(`start ${key} ${variant} ${port} #${id}`)
      await new Promise(r => setTimeout(r, 5))
      return {
        port, pid: id, lastUsedAt: Date.now(), liveSockets: 0,
        stop: async () => {
          await new Promise(r => setTimeout(r, 5))
          events.push(`stop ${key} #${id}`)
        },
      }
    },
  })
  return { pool, events }
}

const pidOf = acquisition => {
  assert.equal(acquisition.kind, 'ready', JSON.stringify(acquisition))
  return acquisition.backend.pid
}

await check('the same role reuses the running backend', async () => {
  const { pool, events } = fakePool()
  const first = pidOf(await pool.acquire('alice', 'user'))
  const again = pidOf(await pool.acquire('alice', 'user'))
  assert.equal(again, first)
  assert.deepEqual(events, ['start alice user 31000 #101'])
})

await check('a role change stops the old backend before starting the new one', async () => {
  const { pool, events } = fakePool()
  const user = pidOf(await pool.acquire('alice', 'user'))
  const admin = pidOf(await pool.acquire('alice', 'admin'))
  assert.notEqual(admin, user)
  assert.deepEqual(events, [
    'start alice user 31000 #101',
    'stop alice #101',
    // The port was released only after the old process stopped, so the new
    // backend can take it without racing the old listener.
    'start alice admin 31000 #102',
  ])
  assert.equal(pool.size, 1)
})

await check('a revoked admin is moved back to the ordinary composition', async () => {
  const { pool, events } = fakePool()
  await pool.acquire('alice', 'admin')
  await pool.acquire('alice', 'user')
  assert.deepEqual(events.map(e => e.replace(/ \d+ #/, ' #')), [
    'start alice admin #101', 'stop alice #101', 'start alice user #102',
  ])
})

await check('concurrent requests after a role change share one restart', async () => {
  const { pool, events } = fakePool()
  await pool.acquire('alice', 'user')
  const pids = await Promise.all([1, 2, 3, 4].map(() => pool.acquire('alice', 'admin').then(pidOf)))
  assert.equal(new Set(pids).size, 1, `one backend for all: ${pids.join(',')}`)
  assert.deepEqual(events, ['start alice user 31000 #101', 'stop alice #101', 'start alice admin 31000 #102'])
})

await check('a role change for one user leaves the others alone', async () => {
  const { pool, events } = fakePool()
  const bob = pidOf(await pool.acquire('bob', 'user'))
  await pool.acquire('alice', 'user')
  await pool.acquire('alice', 'admin')
  assert.equal(pidOf(await pool.acquire('bob', 'user')), bob)
  assert.ok(!events.some(e => e.startsWith('stop bob')), events.join('\n'))
})

await check('the newest login decides the standing; an older session cannot flip it back', () => {
  const standing = new RoleStanding()
  // A tab opened before the role grant (t=100) and a fresh login after it (t=200).
  assert.equal(standing.resolve('alice', false, 100), false)
  assert.equal(standing.resolve('alice', true, 200), true)
  // The old tab keeps making requests: the backend must stay administrative.
  assert.equal(standing.resolve('alice', false, 100), true)
  assert.equal(standing.resolve('alice', true, 200), true)
  // A later login after the role is revoked wins in turn.
  assert.equal(standing.resolve('alice', false, 300), false)
  assert.equal(standing.resolve('alice', true, 200), false)
  // Other users are independent.
  assert.equal(standing.resolve('bob', true, 50), true)
})

console.log(`\n${String(passed)} passed, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
