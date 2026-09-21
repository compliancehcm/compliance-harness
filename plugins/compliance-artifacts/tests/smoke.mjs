// A runnable smoke test for the whole plugin: configuration and the CSP it
// builds, the store's versioning, the two tools' acceptances and rejections, the
// route served over a real HTTP listener, the skill's frontmatter, and the
// client half materialized through a fake module loader.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-artifacts/tests/smoke.mjs
//
// It needs the harness built (`pnpm run build`), because the fake tool registry
// runs the REAL schema validator out of `@deepseek-ai/dsh-tools` rather than a
// stand-in. It needs no network and no API key. What it CANNOT reach is whether
// the sandboxed frame actually executes scripts and loads an allowed CDN in a
// real browser — that is `tests/browser.mjs`.
import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, inject, name } from '../index.js'
import { resolveConfig, ArtifactsConfigError, contentSecurityPolicy } from '../src/config.js'
import { writeVersion, readMeta, readVersion, listArtifacts, listAllArtifacts, newArtifactId, ArtifactStoreError } from '../src/store.js'
import { applyPatch } from '../src/tool.js'
import { parseArtifactPath } from '../src/route.js'
import { artifactsSkill } from '../src/skill.js'

const results = []
/**
 * Record one check.
 * @param label - what is being established.
 * @param fn - the check; a throw is a failure.
 */
const check = async (label, fn) => {
  try {
    await fn()
    results.push(['PASS', label])
  } catch (error) {
    results.push(['FAIL', `${label}: ${error.message}`])
  }
}

const root = mkdtempSync(join(tmpdir(), 'artifacts-smoke-'))
const config = resolveConfig({ root })
const SESSION = 'session0001'
const PAGE = '<!DOCTYPE html><html><body><h1>Oi</h1><style>background: #fff</style></body></html>'

// ---------------------------------------------------------------- configuration

await check('config applies every default', () => {
  const resolved = resolveConfig()
  assert.equal(resolved.routePath, '/artifacts')
  assert.equal(resolved.createToolName, 'create_artifact')
  assert.equal(resolved.updateToolName, 'update_artifact')
  assert.ok(resolved.root.length > 0)
})

await check('config rejects an unknown field', () => {
  assert.throws(() => resolveConfig({ nope: 1 }), ArtifactsConfigError)
})

await check('config rejects two tools sharing a name', () => {
  assert.throws(() => resolveConfig({ createToolName: 'x_art', updateToolName: 'x_art' }), /must differ/)
})

await check('config rejects a CDN entry that is not a bare https origin', () => {
  assert.throws(() => resolveConfig({ allowedOrigins: ['https://cdn.example.com/lib'] }), /must be an https origin/)
  assert.throws(() => resolveConfig({ allowedOrigins: ['http://cdn.example.com'] }), /must be an https origin/)
})

await check('the CSP denies by default and never allows network calls', () => {
  const policy = contentSecurityPolicy(['https://cdn.example.com'])
  assert.ok(policy.startsWith("default-src 'none'"))
  assert.ok(policy.includes("connect-src 'none'"), 'an artifact must not be able to phone home')
  assert.ok(policy.includes("frame-ancestors 'self'"))
  assert.ok(policy.includes('script-src'))
  assert.ok(policy.includes('https://cdn.example.com'))
})

await check('a trimmed allowlist reaches the policy', () => {
  const resolved = resolveConfig({ allowedOrigins: ['https://cdn.jsdelivr.net'] })
  assert.ok(resolved.csp.includes('https://cdn.jsdelivr.net'))
  assert.ok(!resolved.csp.includes('unpkg.com'), 'a trimmed list must not keep the defaults')
})

// ------------------------------------------------------------------------ store

const artifactId = newArtifactId()

await check('the store writes v1 and a manifest', async () => {
  const { version, meta } = await writeVersion(config, SESSION, artifactId, PAGE, 'Primeira')
  assert.equal(version, 1)
  assert.equal(meta.title, 'Primeira')
  assert.equal(meta.history.length, 1)
  assert.ok(existsSync(join(root, SESSION, artifactId, 'v1.html')))
})

await check('an update adds a version and PRESERVES the earlier one', async () => {
  const { version } = await writeVersion(config, SESSION, artifactId, '<!DOCTYPE html><p>dois</p>', 'Segunda')
  assert.equal(version, 2)
  assert.equal(await readVersion(config, SESSION, artifactId, 1), PAGE, 'v1 must survive an update')
  assert.equal(await readVersion(config, SESSION, artifactId, 2), '<!DOCTYPE html><p>dois</p>')
  const meta = await readMeta(config, SESSION, artifactId)
  assert.equal(meta.version, 2)
  assert.equal(meta.history.length, 2)
})

await check('an unknown artifact reads as undefined, not as a throw', async () => {
  assert.equal(await readMeta(config, SESSION, 'naoexiste'), undefined)
  assert.equal(await readVersion(config, SESSION, artifactId, 99), undefined)
})

await check('a traversing id is refused by the path grammar', async () => {
  for (const bad of ['..', '../..', 'a/b', '.hidden', 'a b']) {
    await assert.rejects(readMeta(config, SESSION, bad), ArtifactStoreError, `expected ${bad} to be refused`)
  }
})

await check('the version cap is enforced and names the way out', async () => {
  const capped = resolveConfig({ root, maxVersions: 2 })
  await assert.rejects(
    writeVersion(capped, SESSION, artifactId, '<p>tres</p>', 'Terceira'),
    /Create a new artifact/,
  )
})

await check('listing a session returns its artifacts', async () => {
  const listed = await listArtifacts(config, SESSION)
  assert.equal(listed.length, 1)
  assert.equal(listed[0].artifactId, artifactId)
  assert.deepEqual(await listArtifacts(config, 'sessionvazia'), [])
})

await check('the gallery listing spans sessions and skips what it cannot read', async () => {
  const other = 'outrasessao'
  await writeVersion(config, other, 'segundoartefato', '<p>outro</p>', 'De outra conversa')
  // A directory that is not a legal id, and one with no manifest: the index of
  // every other artifact must survive both.
  mkdirSync(join(root, 'nao..legal'), { recursive: true })
  mkdirSync(join(root, other, 'semmanifesto'), { recursive: true })

  const all = await listAllArtifacts(config)
  assert.deepEqual(
    all.map(meta => meta.artifactId).sort(),
    [artifactId, 'segundoartefato'].sort(),
  )
  // Newest first, which is the order the gallery shows without sorting again.
  assert.ok(all[0].updatedAt >= all[1].updatedAt)
})

await check('an empty store lists nothing rather than failing', async () => {
  assert.deepEqual(await listAllArtifacts(resolveConfig({ root: join(root, 'naoexiste') })), [])
})

// ------------------------------------------------------------------------ patch

await check('a patch replaces a unique substring', () => {
  assert.equal(applyPatch('a-b-c', 'b', 'X'), 'a-X-c')
  assert.equal(applyPatch('a-b-c', '-b-', ''), 'ac')
})

await check('a patch whose target is absent fails loud', () => {
  assert.throws(() => applyPatch('abc', 'zzz', 'x'), /does not appear/)
})

await check('a patch whose target is ambiguous fails rather than guessing', () => {
  // Replacing the first of several would silently edit the wrong place, and the
  // model cannot see the result to notice.
  assert.throws(() => applyPatch('x-y-x', 'x', 'Z'), /more than once/)
})

// ------------------------------------------------------------------------ route

await check('the route path parser accepts both selectors and refuses the rest', () => {
  assert.deepEqual(parseArtifactPath('/artifacts', '/artifacts/s1/a1/latest'), { sessionId: 's1', artifactId: 'a1', version: 'latest' })
  assert.deepEqual(parseArtifactPath('/artifacts', '/artifacts/s1/a1/v3'), { sessionId: 's1', artifactId: 'a1', version: 3 })
  for (const bad of ['/artifacts', '/artifacts/s1', '/artifacts/s1/a1', '/artifacts/s1/a1/v0', '/artifacts/s1/a1/x', '/other/s1/a1/v1']) {
    assert.equal(parseArtifactPath('/artifacts', bad), undefined, `expected ${bad} to be refused`)
  }
})

// ------------------------------------------------------------------------ skill

await check('the skill parses and its frontmatter does not reach the model', () => {
  const skill = artifactsSkill()
  assert.equal(skill.name, 'artifacts')
  assert.equal(skill.source, 'bundled')
  assert.ok(!skill.content.startsWith('---'), 'the frontmatter must not reach the model twice')
  assert.ok(skill.content.includes('create_artifact'))
  assert.ok(skill.content.includes('connect-src') || skill.content.includes('fetch'),
    'the skill must warn that the page cannot call the network')
})

// ------------------------------------------------------------------- boot + e2e

const harness = await createFakeCtx()
try {
  await check('apply registers both tools, the route and the skill', async () => {
    apply(harness.ctx, { root })
    assert.equal(name, 'artifacts')
    assert.deepEqual(inject, ['tools', 'webServer'])
    assert.deepEqual([...harness.tools.keys()], ['create_artifact', 'update_artifact'])
    assert.deepEqual([...harness.skills.keys()], ['artifacts'])
  })

  await check('the boot global carries the route and both tool names', () => {
    const table = []
    harness.emit('webserver/index-inject', table)
    assert.equal(table.length, 1)
    assert.equal(table[0].kind, 'global')
    assert.equal(table[0].name, '__COMPLIANCE_ARTIFACTS__')
    assert.deepEqual(table[0].value, {
      routePath: '/artifacts',
      createToolName: 'create_artifact',
      updateToolName: 'update_artifact',
    })
  })

  const create = harness.tools.get('create_artifact')
  const update = harness.tools.get('update_artifact')
  const exec = { agent: { session: { id: SESSION } } }
  let created

  await check('create writes v1 and returns a receipt, never the page', async () => {
    created = await create.execute({ title: 'Painel', html: PAGE }, exec)
    assert.equal(created.version, 1)
    assert.equal(created.sessionId, SESSION)
    assert.equal(created.url, `/artifacts/${SESSION}/${created.artifactId}/latest`)
    const text = create.output.render({}, created)[0].text
    assert.ok(!text.includes('<!DOCTYPE'), 'the page must not travel back to the model')
    assert.ok(text.includes(created.artifactId))
  })

  await check('presentationMeta carries the receipt so the card survives a window cut', () => {
    // With backward pagination a settled node's `call` is null, so an args-only
    // card would lose its open button on older messages.
    const meta = create.output.presentationMeta({ title: 'Painel', html: PAGE }, created)
    assert.equal(meta.artifactId, created.artifactId)
    assert.equal(meta.sessionId, SESSION)
    assert.equal(meta.version, 1)
    assert.equal(meta.title, 'Painel')
  })

  await check('a call outside a session is refused', async () => {
    await assert.rejects(create.execute({ title: 'x', html: PAGE }, {}), /needs a session/)
  })

  await check('an oversized page is refused and names the limit', async () => {
    const big = resolveConfig({ root, maxHtmlBytes: 64 })
    const small = await createFakeCtx()
    apply(small.ctx, { root, maxHtmlBytes: 64 })
    await assert.rejects(
      small.tools.get('create_artifact').execute({ title: 'x', html: PAGE }, exec),
      /the limit is 64/,
    )
    await small.close()
    assert.equal(big.maxHtmlBytes, 64)
  })

  await check('update by patch bumps the version and keeps the old one', async () => {
    const updated = await update.execute({
      artifact_id: created.artifactId,
      old_str: 'background: #fff',
      new_str: 'background: #0b1220',
    }, exec)
    assert.equal(updated.version, 2)
    assert.equal(updated.title, 'Painel', 'an omitted title keeps the current one')
    const current = await readVersion(config, SESSION, created.artifactId, 2)
    assert.ok(current.includes('#0b1220'))
    const first = await readVersion(config, SESSION, created.artifactId, 1)
    assert.ok(first.includes('#fff'), 'v1 must still say what it said')
  })

  await check('update refuses both forms at once, and an empty change', async () => {
    await assert.rejects(
      update.execute({ artifact_id: created.artifactId, old_str: 'a', new_str: 'b', html: PAGE }, exec),
      /not both/,
    )
    await assert.rejects(update.execute({ artifact_id: created.artifactId }, exec), /nothing to change/)
  })

  await check('update of an unknown artifact names the fix', async () => {
    await assert.rejects(update.execute({ artifact_id: 'naoexiste', html: PAGE }, exec), /create one first/)
  })

  await check('a title-only update still becomes a version', async () => {
    const renamed = await update.execute({ artifact_id: created.artifactId, title: 'Painel revisado' }, exec)
    assert.equal(renamed.version, 3)
    assert.equal(renamed.title, 'Painel revisado')
  })

  // ---- the route over a real listener

  await check('the route serves the latest version with the artifact CSP', async () => {
    const response = await fetch(`${harness.origin}/artifacts/${SESSION}/${created.artifactId}/latest`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'text/html; charset=utf-8')
    assert.equal(response.headers.get('x-artifact-version'), '3')
    const csp = response.headers.get('content-security-policy')
    assert.ok(csp.includes("default-src 'none'"))
    assert.ok(csp.includes("connect-src 'none'"))
    assert.ok(csp.includes('https://cdn.jsdelivr.net'))
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    assert.ok((await response.text()).includes('#0b1220'))
  })

  await check('a numbered version is served and cached immutably', async () => {
    const response = await fetch(`${harness.origin}/artifacts/${SESSION}/${created.artifactId}/v1`)
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('cache-control'), 'private, max-age=31536000, immutable')
    assert.ok((await response.text()).includes('#fff'))
  })

  await check('an unknown artifact and a traversing path are both 404, with the CSP still set', async () => {
    for (const path of [
      `/artifacts/${SESSION}/naoexiste/latest`,
      `/artifacts/${SESSION}/..%2F..%2Fetc/latest`,
      '/artifacts/x/y',
      '/artifacts',
    ]) {
      const response = await fetch(`${harness.origin}${path}`)
      assert.equal(response.status, 404, `expected 404 for ${path}`)
      assert.ok(response.headers.get('content-security-policy') !== null, `expected the CSP on ${path}`)
    }
  })

  await check('the index serves every manifest as JSON, and never the pages', async () => {
    const response = await fetch(`${harness.origin}/artifacts/index`)
    assert.equal(response.status, 200)
    assert.match(response.headers.get('content-type') ?? '', /application\/json/)
    // The gallery must never be served from a cache: an artifact made in the
    // conversation behind it has to appear the next time it is opened.
    assert.equal(response.headers.get('cache-control'), 'private, no-store')
    const body = await response.json()
    assert.ok(Array.isArray(body.artifacts))
    assert.ok(body.artifacts.some(meta => meta.artifactId === created.artifactId))
    // The manifest, not the document: the index stays small however many
    // artifacts a person has.
    assert.equal(JSON.stringify(body).includes('<html'), false)
  })

  await check('a write method is refused', async () => {
    const response = await fetch(`${harness.origin}/artifacts/${SESSION}/${created.artifactId}/latest`, { method: 'POST' })
    assert.equal(response.status, 405)
    assert.equal(response.headers.get('allow'), 'GET, HEAD')
  })

  await check('everything withdraws on dispose, route included', async () => {
    harness.disposeAll()
    assert.deepEqual([...harness.tools.keys()], [])
    assert.deepEqual([...harness.skills.keys()], [])
    const response = await fetch(`${harness.origin}/artifacts/${SESSION}/${created.artifactId}/latest`)
    assert.equal(response.status, 404, 'the route must be gone after teardown')
  })
} finally {
  await harness.close()
}

await check('a composition without the skill registry still gets the tools', async () => {
  const bare = await createFakeCtx({ skillsAvailable: false })
  apply(bare.ctx, { root })
  assert.deepEqual([...bare.tools.keys()], ['create_artifact', 'update_artifact'])
  assert.ok(bare.logs.some(([level, text]) => level === 'warn' && text.includes('no skill registry')))
  await bare.close()
})

// ----------------------------------------------------------------- client half

await check('the client half registers under its package name and exports the plugin surface', () => {
  const loaded = []
  globalThis.window = { __ModuleLoader__: { load: (registration) => { loaded.push(registration) } } }
  try {
    // Executing the bundle must only REGISTER the factory; every side effect
    // belongs inside it.
    new Function(readFileSync(new URL('../client.js', import.meta.url), 'utf8'))()
    assert.equal(loaded.length, 1)
    assert.equal(loaded[0].id, '@compliance/dsh-artifacts', 'the id must equal the package name')

    const stub = { jsx: () => null, jsxs: () => null }
    const exportsOf = loaded[0].factory((specifier) => {
      if (specifier === 'react/jsx-runtime') return stub
      if (specifier === 'react') return { useCallback: fn => fn }
      if (specifier === '@deepseek-ai/dsh-client-ui-primitives') {
        return { Button: () => null, IconFullscreenOutline16: () => null, IconWarningOutline16: () => null }
      }
      throw new Error(`the shell baseline does not carry ${specifier}`)
    })
    assert.equal(typeof exportsOf.apply, 'function')
    assert.deepEqual(exportsOf.inject, ['slots'])
    globalThis.__CLIENT_TEST__ = exportsOf.__test__
  } finally {
    delete globalThis.window
  }
})

await check('the client address round-trips and refuses a foreign one', () => {
  const { parseAddress, addressOf } = globalThis.__CLIENT_TEST__
  assert.deepEqual(parseAddress(addressOf('s1', 'a1')), { sessionId: 's1', artifactId: 'a1' })
  for (const bad of ['dsh-resource://file/session/s1/x', 'dsh-resource://artifact/s1', 'nope', undefined, null]) {
    assert.equal(parseAddress(bad), null, `expected ${String(bad)} to be refused`)
  }
})

await check('the card reads the receipt from the result meta, not from the arguments', () => {
  const { receiptOf } = globalThis.__CLIENT_TEST__
  const settled = { kind: 'tool-result', isError: false, call: null, meta: { artifactId: 'a1', sessionId: 's1', version: 4, title: 'Painel' } }
  // `call: null` is the backward-pagination case: an args-only card would have
  // nothing to read here.
  assert.deepEqual(receiptOf(settled), { artifactId: 'a1', sessionId: 's1', version: 4, title: 'Painel' })
  assert.equal(receiptOf({ argsRaw: '{"title":"x"}' }), null, 'a running call has no receipt yet')
  assert.equal(receiptOf({ kind: 'tool-result', isError: true, meta: {} }), null)
  assert.equal(receiptOf({ kind: 'tool-result', isError: false, meta: null }), null)
})

await check('the pending title tolerates half-streamed arguments', () => {
  const { pendingTitle } = globalThis.__CLIENT_TEST__
  assert.equal(pendingTitle({ argsRaw: '{"title":"Painel"}' }), 'Painel')
  assert.equal(pendingTitle({ argsRaw: '{"title":"Pai' }), 'Artefato', 'a partial parse must not throw')
  for (const block of [undefined, null, 42, {}, { argsRaw: '' }, { kind: 'tool-result', call: null }]) {
    assert.equal(typeof pendingTitle(block), 'string')
  }
})

await check('the gallery filter matches by name, by id and by day', () => {
  const { filterArtifacts } = globalThis.__CLIENT_TEST__
  const made = (id, title, updatedAt) => ({ artifactId: id, sessionId: 's', title, updatedAt, version: 1 })
  // Local days, written the way the date inputs produce them.
  const day = (offsetDays) => {
    const at = new Date()
    at.setDate(at.getDate() + offsetDays)
    return at.toISOString()
  }
  const all = [made('aaa', 'Dashboard de turnover', day(0)), made('bbb', 'Relatório de férias', day(-10))]

  assert.deepEqual(filterArtifacts(all, { text: 'turnover' }).map(m => m.artifactId), ['aaa'])
  assert.deepEqual(filterArtifacts(all, { text: 'TURN' }).map(m => m.artifactId), ['aaa'])
  assert.deepEqual(filterArtifacts(all, { text: 'bbb' }).map(m => m.artifactId), ['bbb'])
  assert.deepEqual(filterArtifacts(all, { text: 'nada disso' }), [])
  assert.deepEqual(filterArtifacts(all, {}).length, 2)

  const today = globalThis.__CLIENT_TEST__.localDay(day(0))
  assert.deepEqual(filterArtifacts(all, { from: today }).map(m => m.artifactId), ['aaa'])
  assert.deepEqual(filterArtifacts(all, { to: today }).map(m => m.artifactId).sort(), ['aaa', 'bbb'])
  assert.deepEqual(filterArtifacts(all, { from: today, to: today }).map(m => m.artifactId), ['aaa'])
  // An unreadable instant is dropped by a date filter rather than crashing it.
  assert.deepEqual(filterArtifacts([made('ccc', 'Sem data', 'nao-e-uma-data')], { from: today }), [])
})

await check('the gallery open state is shared and notifies its subscribers', () => {
  const { gallery } = globalThis.__CLIENT_TEST__
  const seen = []
  const stop = gallery.subscribe(() => { seen.push(gallery.snapshot()) })
  gallery.set(true)
  // Setting the value it already holds must not wake the subscribers.
  gallery.set(true)
  gallery.set(false)
  stop()
  gallery.set(true)
  gallery.set(false)
  assert.deepEqual(seen, [true, false])
})

await check('the failure reader tolerates anything the log may hold', () => {
  const { failureOf } = globalThis.__CLIENT_TEST__
  assert.equal(failureOf({ kind: 'tool-result', isError: true, content: [{ text: 'estourou' }] }), 'estourou')
  assert.equal(failureOf({ kind: 'tool-result', isError: true, content: 'nope' }), 'A geração do artefato falhou.')
  for (const block of [undefined, null, {}, { argsRaw: 'x' }]) assert.equal(failureOf(block), null)
})

rmSync(root, { recursive: true, force: true })

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} ok, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
