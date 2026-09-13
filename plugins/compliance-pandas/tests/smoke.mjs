// A runnable smoke test for the whole plugin: configuration, the tool's
// acceptances and rejections, the skill's frontmatter, the presenters' tolerance
// of malformed logged arguments, and — when pandas is installed — a real
// end-to-end run of the bundled runner over a temporary CSV.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-pandas/tests/smoke.mjs
//
// It needs no build, no network and no API key. The end-to-end checks self-skip
// when python3 or pandas is missing, so the file still reports on a bare host.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, inject, name } from '../index.js'
import { resolveConfig, PandasConfigError } from '../src/config.js'
import { pandasTool } from '../src/tool.js'
import { pandasSkill } from '../src/skill.js'

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

/** Whether this host can run the end-to-end checks. */
const pandasReady = spawnSync('python3', ['-c', 'import pandas'], { stdio: 'ignore' }).status === 0

const workspace = mkdtempSync(join(tmpdir(), 'pandas-smoke-'))
const CSV = join(workspace, 'vendas.csv')
writeFileSync(CSV, 'mes,filial,valor\n01/2026,SP,100\n01/2026,RJ,50\n02/2026,SP,70\n', 'utf8')

// ---------------------------------------------------------------- configuration

await check('config applies every default', () => {
  const config = resolveConfig()
  assert.equal(config.pythonBin, 'python3')
  assert.equal(config.toolName, 'run_pandas')
  assert.equal(config.maxPreviewRows, 20)
  assert.equal(config.registerSkill, true)
})

await check('config rejects an unknown field', () => {
  assert.throws(() => resolveConfig({ nope: 1 }), PandasConfigError)
})

await check('config rejects a non-integer limit and names it', () => {
  assert.throws(() => resolveConfig({ maxSources: 2.5 }), /maxSources must be a positive whole number/)
})

await check('config rejects a grace period longer than the timeout', () => {
  assert.throws(() => resolveConfig({ timeoutMs: 1000, graceMs: 2000 }), /graceMs must not exceed timeoutMs/)
})

await check('config rejects a tool name that is not snake_case', () => {
  assert.throws(() => resolveConfig({ toolName: 'Run Pandas' }), /toolName must be snake_case/)
})

await check('config reports every problem at once', () => {
  try {
    resolveConfig({ toolName: 'X', maxSources: 0, nope: true })
    assert.fail('expected a throw')
  } catch (error) {
    assert.equal((error.message.match(/\n {2}- /g) ?? []).length, 3)
  }
})

// ------------------------------------------------------------------- validation

const config = resolveConfig()
const tool = pandasTool(createFakeCtx().ctx, config)

await check('the tool is named from the config', () => {
  assert.equal(tool.name, 'run_pandas')
  assert.equal(tool.parameters.required.join(','), 'sources,code')
  assert.equal(tool.parameters.additionalProperties, false)
})

await check('an empty sources list is rejected', async () => {
  await assert.rejects(tool.execute({ sources: [], code: 'result = df' }, {}), /non-empty array/)
})

await check('more sources than the limit are rejected', async () => {
  const sources = Array.from({ length: 5 }, (_, index) => ({ path: `f${String(index)}.csv` }))
  await assert.rejects(tool.execute({ sources, code: 'result = df' }, {}), /at most 4 are allowed/)
})

await check('a reserved frame name is rejected', async () => {
  await assert.rejects(
    tool.execute({ sources: [{ path: 'a.csv', name: 'pd' }], code: 'result = pd' }, {}),
    /the runner defines it/,
  )
})

await check('two sources sharing a name are rejected', async () => {
  await assert.rejects(
    tool.execute({ sources: [{ path: 'a.csv', name: 'x' }, { path: 'b.csv', name: 'x' }], code: 'result = x' }, {}),
    /share the name/,
  )
})

await check('a name that is not a python identifier is rejected', async () => {
  await assert.rejects(
    tool.execute({ sources: [{ path: 'a.csv', name: '2df' }], code: 'result = df' }, {}),
    /lowercase Python identifier/,
  )
})

await check('an empty snippet is rejected', async () => {
  await assert.rejects(tool.execute({ sources: [{ path: 'a.csv' }], code: '   ' }, {}), /code must be a non-empty string/)
})

await check('a snippet over the byte cap is rejected', async () => {
  const code = 'x'.repeat(config.maxCodeBytes + 1)
  await assert.rejects(tool.execute({ sources: [{ path: 'a.csv' }], code }, {}), /at most 16384 are allowed/)
})

// ------------------------------------------------------------------- presenters

await check('the presenters tolerate arguments a rejected call left in the log', () => {
  for (const args of [undefined, null, 42, {}, { sources: 'nope' }, { sources: [null, { path: 7 }] }]) {
    const call = tool.presentCall(args)
    assert.equal(call.card, 'generic')
    assert.ok(typeof call.title === 'string' && call.title !== '')
    assert.ok(Array.isArray(call.locations))
    const settled = tool.presentResult(args, { content: [] })
    assert.ok(typeof settled.title === 'string' && settled.title !== '')
  }
})

await check('the card carries every path as a location', () => {
  const args = { sources: [{ path: 'a.csv' }, { path: 'b.parquet' }], output: 'out.csv', description: 'Totais' }
  const call = tool.presentCall(args)
  assert.equal(call.title, 'Totais')
  assert.deepEqual(call.locations.map(location => location.path), ['a.csv', 'b.parquet', 'out.csv'])
})

// ------------------------------------------------------------------------ skill

await check('the skill parses and its frontmatter does not reach the model', () => {
  const skill = pandasSkill()
  assert.equal(skill.name, 'pandas-analysis')
  assert.equal(skill.source, 'bundled')
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(skill.description.length > 0)
  assert.ok(!skill.content.startsWith('---'), 'the frontmatter must not reach the model twice')
  assert.ok(skill.content.includes('run_pandas'))
})

// ------------------------------------------------------------------------- boot

await check('apply registers the tool and the skill, and both withdraw on dispose', async () => {
  const harness = createFakeCtx()
  await apply(harness.ctx, {})
  assert.equal(name, 'pandas-analysis')
  assert.deepEqual(inject, ['tools', 'subprocess'])
  assert.deepEqual([...harness.tools.keys()], ['run_pandas'])
  assert.deepEqual([...harness.skills.keys()], ['pandas-analysis'])
  harness.disposeAll()
  assert.deepEqual([...harness.tools.keys()], [])
  assert.deepEqual([...harness.skills.keys()], [])
})

await check('apply fails at boot when the interpreter cannot be resolved', async () => {
  const harness = createFakeCtx({ pythonAvailable: false })
  await assert.rejects(apply(harness.ctx, {}), /cannot resolve the Python interpreter/)
  assert.deepEqual([...harness.tools.keys()], [], 'nothing must register when the interpreter is missing')
})

await check('a composition without the skill registry still gets the tool', async () => {
  const harness = createFakeCtx({ skillsAvailable: false })
  await apply(harness.ctx, {})
  assert.deepEqual([...harness.tools.keys()], ['run_pandas'])
  assert.ok(harness.logs.some(([level, text]) => level === 'warn' && text.includes('no skill registry')))
})

await check('registerSkill false leaves the skill out', async () => {
  const harness = createFakeCtx()
  await apply(harness.ctx, { registerSkill: false })
  assert.deepEqual([...harness.skills.keys()], [])
})

// -------------------------------------------------------------------- end to end

if (pandasReady) {
  const harness = createFakeCtx()
  const live = pandasTool(harness.ctx, config)
  const exec = { agent: { session: { header: { cwd: workspace } } } }

  await check('e2e: a groupby reports shape, dtypes and a preview', async () => {
    const value = await live.execute({
      sources: [{ path: 'vendas.csv' }],
      code: 'result = df.groupby("mes", as_index=False)["valor"].sum()',
    }, exec)
    assert.equal(value.rowCount, 2)
    assert.equal(value.columnCount, 2)
    assert.deepEqual(value.columns, ['mes', 'valor'])
    assert.equal(value.previewTruncated, false)
    assert.deepEqual(value.preview.rows, [['01/2026', 150], ['02/2026', 70]])
    assert.equal(value.output, null)
  })

  await check('e2e: the snippet\'s prints come back', async () => {
    const value = await live.execute({
      sources: [{ path: 'vendas.csv' }],
      code: 'print("linhas:", len(df))\nresult = df',
    }, exec)
    assert.ok(value.stdout.includes('linhas: 3'))
  })

  await check('e2e: a missing `result` falls back to the first frame', async () => {
    const value = await live.execute({
      sources: [{ path: 'vendas.csv' }],
      code: 'df = df[df["valor"] > 60]',
    }, exec)
    assert.equal(value.rowCount, 2)
  })

  await check('e2e: output writes the file and reports its path', async () => {
    const value = await live.execute({
      sources: [{ path: 'vendas.csv' }],
      code: 'result = df.groupby("filial", as_index=False)["valor"].sum()',
      output: 'resumo.csv',
    }, exec)
    assert.equal(value.output, join(workspace, 'resumo.csv'))
    assert.ok(readFileSync(join(workspace, 'resumo.csv'), 'utf8').startsWith('filial,valor'))
  })

  await check('e2e: a scalar result is reported as one cell', async () => {
    const value = await live.execute({
      sources: [{ path: 'vendas.csv' }],
      code: 'result = int(df["valor"].sum())',
    }, exec)
    assert.equal(value.rowCount, 1)
    assert.deepEqual(value.preview.rows, [[220]])
  })

  await check('e2e: a failing snippet surfaces the python error, not an exit code', async () => {
    await assert.rejects(
      live.execute({ sources: [{ path: 'vendas.csv' }], code: 'result = df["nao_existe"]' }, exec),
      /KeyError/,
    )
  })

  await check('e2e: an unreadable extension names the supported ones', async () => {
    writeFileSync(join(workspace, 'x.bin'), 'nope', 'utf8')
    await assert.rejects(
      live.execute({ sources: [{ path: 'x.bin' }], code: 'result = df' }, exec),
      /unsupported extension/,
    )
  })

  await check('e2e: the model-facing render carries the preview, not every row', () => {
    const text = live.output.render({}, {
      rowCount: 500,
      columnCount: 2,
      columns: ['mes', 'valor'],
      dtypes: { mes: 'object', valor: 'int64' },
      preview: { columns: ['mes', 'valor'], rows: [['01/2026', 150]] },
      previewTruncated: true,
      stdout: '',
      output: null,
    })[0].text
    assert.ok(text.includes('500 rows x 2 columns'))
    assert.ok(text.includes('499 more rows not shown'))
  })
} else {
  results.push(['SKIP', 'end-to-end checks: python3 with pandas is not installed on this host'])
}

rmSync(workspace, { recursive: true, force: true })

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} ok, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
