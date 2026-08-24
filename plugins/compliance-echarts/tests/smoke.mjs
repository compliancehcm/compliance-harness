// A runnable smoke test for the whole plugin: configuration, the tool's
// acceptances and rejections, the asset route's caching and method handling, the
// skill's frontmatter, the vendored bundle's own evaluation, and the client
// half's registration.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-echarts/tests/smoke.mjs
//
// It needs no build, no network and no API key.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createContext, runInContext } from 'node:vm'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, inject, name } from '../index.js'
import { resolveConfig, EchartsConfigError } from '../src/config.js'
import { chartTool } from '../src/tool.js'
import { chartSkill } from '../src/skill.js'

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

const BAR = {
  title: 'Faltas por mês',
  option: {
    xAxis: { type: 'category', data: ['Jan', 'Fev'] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', name: 'Faltas', data: [12, 8] }],
  },
}

// ── plugin metadata ─────────────────────────────────────────────────────────

await check('the plugin declares its name and the services it needs', () => {
  assert.equal(name, 'echarts-charts')
  assert.deepEqual(inject, ['tools', 'webServer'])
})

// ── configuration ───────────────────────────────────────────────────────────

await check('an omitted config resolves to the documented defaults', () => {
  const config = resolveConfig()
  assert.equal(config.toolName, 'render_chart')
  assert.equal(config.assetPath, '/echarts/echarts.min.js')
  assert.equal(config.defaultHeight, 320)
  assert.equal(config.registerSkill, true)
})

await check('every configuration problem is reported at once', () => {
  let error
  try {
    resolveConfig({ minHeight: 900, toolName: 'Render Chart', nope: 1 })
  } catch (thrown) {
    error = thrown
  }
  assert.ok(error instanceof EchartsConfigError, 'a bad config must throw EchartsConfigError')
  for (const fragment of ['minHeight must not exceed maxHeight', 'toolName must be snake_case', 'unknown field "nope"']) {
    assert.ok(error.message.includes(fragment), `expected ${fragment} in:\n${error.message}`)
  }
})

await check('a relative assetPath is rejected', () => {
  assert.throws(() => resolveConfig({ assetPath: 'echarts.js' }), EchartsConfigError)
})

// ── the tool ────────────────────────────────────────────────────────────────

const tool = chartTool(resolveConfig())

await check('a valid bar chart yields a canonical value derived from the option', async () => {
  const value = await tool.execute(BAR)
  assert.deepEqual(value, { chartId: value.chartId, seriesCount: 1, pointCount: 2, height: 320 })
  assert.match(value.chartId, /^[0-9a-f]{16}$/)
  // Derived, not random: the same option must replay to the same value.
  assert.equal((await tool.execute(BAR)).chartId, value.chartId)
  assert.notEqual((await tool.execute({ option: { series: [{ type: 'bar', data: [1] }] } })).chartId, value.chartId)
})

await check('a dataset without inline series data is accepted', async () => {
  const value = await tool.execute({
    option: { dataset: { source: [['mes', 'v'], ['Jan', 1], ['Fev', 2]] }, series: [{ type: 'bar' }] },
  })
  assert.equal(value.pointCount, 3)
})

await check('an option with nothing to draw is rejected, naming the skill', async () => {
  await assert.rejects(tool.execute({ option: { xAxis: {} } }), /series.*dataset.*echarts-charts/s)
})

await check('a non-object option is rejected', async () => {
  for (const option of [null, 'bar', 42, []]) {
    await assert.rejects(tool.execute({ option }), /option must be an ECharts option object/)
  }
})

await check('too many series is rejected with the limit named', async () => {
  const option = { series: Array.from({ length: 13 }, () => ({ type: 'bar', data: [1] })) }
  await assert.rejects(tool.execute({ option }), /13 series; at most 12/)
})

await check('an option over the byte limit is rejected', async () => {
  const option = { series: [{ type: 'line', data: Array.from({ length: 60_000 }, (_, index) => index) }] }
  await assert.rejects(tool.execute({ option }), /the limit is 262144/)
})

await check('an out-of-range height is rejected', async () => {
  await assert.rejects(tool.execute({ ...BAR, height: 5000 }), /height must lie within \[160, 720\]/)
  await assert.rejects(tool.execute({ ...BAR, height: 10 }), /height must lie within/)
})

await check('a configured height range is what the tool enforces', async () => {
  const strict = chartTool(resolveConfig({ minHeight: 200, defaultHeight: 200, maxHeight: 400 }))
  assert.equal((await strict.execute(BAR)).height, 200)
  await assert.rejects(strict.execute({ ...BAR, height: 500 }), /\[200, 400\]/)
})

await check('the model-facing result is a receipt, not the option', async () => {
  const value = await tool.execute(BAR)
  const [block] = tool.output.render(BAR, value)
  assert.equal(block.type, 'text')
  assert.ok(block.text.includes('Faltas por mês'))
  assert.ok(block.text.includes('1 series'))
  assert.ok(!block.text.includes('xAxis'), 'the option must not be echoed back into the context')
})

await check('the presenters never throw, whatever the log holds', () => {
  for (const args of [null, undefined, 'not json', {}, { title: 42 }, BAR]) {
    assert.equal(tool.presentCall(args).card, 'generic')
    assert.equal(tool.presentResult(args, { content: [], isError: false }).card, 'generic')
  }
  assert.equal(tool.presentCall(null).title, 'Chart')
  assert.equal(tool.presentCall(BAR).title, 'Faltas por mês')
})

// ── the skill ───────────────────────────────────────────────────────────────

await check('the skill parses into a valid registration', () => {
  const skill = chartSkill()
  assert.equal(skill.name, 'echarts-charts')
  assert.match(skill.name, /^[a-z0-9]+(-[a-z0-9]+)*$/)
  assert.ok(skill.description.length > 40, 'the description is what routes the model to the skill')
  assert.equal(skill.source, 'bundled')
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(!skill.content.startsWith('---'), 'the frontmatter must not reach the model twice')
  // The body has to actually teach the two things the tool cannot: which form to
  // pick, and that the option is JSON.
  for (const fragment of ['scatter', 'heatmap', 'stack', 'containLabel', 'JSON']) {
    assert.ok(skill.content.includes(fragment), `expected the skill body to cover ${fragment}`)
  }
})

await check('a legend with no stated side is rejected, naming the fix', async () => {
  const option = { legend: {}, series: [{ type: 'bar', data: [1, 2] }] }
  await assert.rejects(tool.execute({ option }), /legend has no `top` or `bottom`/)
  // An explicit side on either edge is accepted.
  await tool.execute({ option: { legend: { top: 0 }, series: [{ type: 'bar', data: [1] }] } })
  await tool.execute({ option: { legend: { bottom: 0 }, series: [{ type: 'bar', data: [1] }] } })
  // No legend at all stays fine — a single series does not need one.
  await tool.execute({ option: { series: [{ type: 'bar', data: [1] }] } })
})

await check('every skill skeleton positions its legend and reserves the space', () => {
  const body = chartSkill().content
  const fences = [...body.matchAll(/```json\n([\s\S]*?)```/g)].map(match => JSON.parse(match[1]))
  assert.ok(fences.length >= 7, `expected the skill to carry skeletons, found ${String(fences.length)}`)
  for (const [index, option] of fences.entries()) {
    const legend = option.legend
    if (legend === undefined) continue
    const where = `skeleton ${String(index)}`
    // The defect this guards: a legend with no side lands on the plot, and a
    // side that `grid` does not reserve lands on the axis labels.
    assert.ok(legend.top !== undefined || legend.bottom !== undefined, `${where}: legend has no top/bottom`)
    const grid = option.grid ?? {}
    if (legend.top !== undefined) {
      assert.ok((grid.top ?? 0) >= 24, `${where}: legend at top but grid.top is ${String(grid.top)}`)
    } else {
      assert.ok((grid.bottom ?? 0) >= 32, `${where}: legend at bottom but grid.bottom is ${String(grid.bottom)}`)
    }
  }
})

await check('the skill teaches the magnitude rule the legend fix exposes', () => {
  const body = chartSkill().content
  for (const fragment of ['order of magnitude', 'yAxisIndex', 'variation instead of the levels']) {
    assert.ok(body.includes(fragment), `expected the skill body to cover ${fragment}`)
  }
})

// ── the vendored bundle ─────────────────────────────────────────────────────

await check('the vendored UMD bundle evaluates and publishes a usable echarts', () => {
  const source = readFileSync(new URL('../vendor/echarts.min.js', import.meta.url), 'utf8')
  // A browser-like global with no CJS wrapper, which is how the asset route
  // serves it: the UMD then takes its global branch.
  const sandbox = createContext({})
  sandbox.window = sandbox
  sandbox.self = sandbox
  runInContext(source, sandbox)
  assert.equal(typeof sandbox.echarts, 'object')
  assert.equal(typeof sandbox.echarts.init, 'function')
  assert.match(sandbox.echarts.version, /^6\./)
})

// ── the client half ─────────────────────────────────────────────────────────

await check('the client half registers the chart view under the tool name', () => {
  const registered = []
  const declared = []
  const sandbox = createContext({})
  sandbox.window = sandbox
  sandbox.globalThis = sandbox
  sandbox.matchMedia = undefined
  sandbox.__ModuleLoader__ = { load: (handoff) => { sandbox.handoff = handoff } }
  sandbox.__ECHARTS_CHARTS__ = { assetPath: '/e.js', toolName: 'draw_chart' }
  runInContext(readFileSync(new URL('../client.js', import.meta.url), 'utf8'), sandbox)
  assert.equal(sandbox.handoff.id, '@compliance/dsh-echarts')

  const stubs = {
    'react/jsx-runtime': { jsx: () => null, jsxs: () => null },
    react: { useState: () => [null, () => {}], useEffect: () => {}, useRef: () => ({}), useMemo: () => null, Fragment: 'fragment' },
    '@deepseek-ai/dsh-client-ui-primitives': new Proxy({}, { get: () => () => null }),
  }
  const half = sandbox.handoff.factory((specifier) => {
    const stub = stubs[specifier]
    if (stub === undefined) throw new Error(`unexpected require(${JSON.stringify(specifier)})`)
    return stub
  })
  // Spread and JSON: values built inside the vm carry that context's prototypes,
  // which deepStrictEqual compares. Only their content is under test here.
  assert.deepEqual([...half.inject], ['slots'])

  half.apply({
    get: () => undefined,
    on: () => () => {},
    effect: () => {},
    inject: (deps, callback) => { declared.push(deps); callback({ get: () => undefined, on: () => () => {}, effect: () => {} }) },
    slots: {
      inject: (key, effect) => { declared.push(key); [...effect()] },
      register: (options) => { registered.push(options); return () => {} },
    },
  })
  assert.ok(declared.includes('tool.call.toolview'))
  assert.deepEqual([...declared.find(Array.isArray)], ['theme'])
  // The key is the configured wire name, read from the host half's boot global —
  // the two halves must never disagree about which tool this view claims.
  assert.deepEqual(JSON.parse(JSON.stringify(registered)), [{ name: 'tool.call.toolview', key: 'draw_chart' }])
})

// ── the assembled plugin ────────────────────────────────────────────────────

const harness = await createFakeCtx()

await check('apply registers the tool, the skill and the asset route', () => {
  apply(harness.ctx, { assetPath: '/charts/echarts.js' })
  assert.deepEqual([...harness.tools.keys()], ['render_chart'])
  assert.deepEqual([...harness.skills.keys()], ['echarts-charts'])
})

await check('the boot global carries the tool name and the asset path', () => {
  const table = []
  harness.emit('webserver/index-inject', table)
  assert.deepEqual(table, [{
    kind: 'global',
    name: '__ECHARTS_CHARTS__',
    value: { assetPath: '/charts/echarts.js', toolName: 'render_chart' },
  }])
})

await check('the route serves the bundle gzipped, with an immutable content ETag', async () => {
  const response = await fetch(`${harness.origin}/charts/echarts.js`)
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type'), /javascript/)
  assert.match(response.headers.get('cache-control'), /immutable/)
  const etag = response.headers.get('etag')
  assert.ok(etag !== null && etag.startsWith('"'))
  const body = await response.text()
  assert.ok(body.includes('echarts'), 'the served body is the bundle')

  const revalidated = await fetch(`${harness.origin}/charts/echarts.js`, { headers: { 'if-none-match': etag } })
  assert.equal(revalidated.status, 304)

  const head = await fetch(`${harness.origin}/charts/echarts.js`, { method: 'HEAD' })
  assert.equal(head.status, 200)
  assert.equal(await head.text(), '')

  const posted = await fetch(`${harness.origin}/charts/echarts.js`, { method: 'POST' })
  assert.equal(posted.status, 405)
})

await check('disposal withdraws every contribution', () => {
  harness.disposeAll()
  assert.deepEqual([...harness.tools.keys()], [])
  assert.deepEqual([...harness.skills.keys()], [])
})

await check('registerSkill false leaves the skill registry untouched', () => {
  apply(harness.ctx, { registerSkill: false })
  assert.deepEqual([...harness.tools.keys()], ['render_chart'])
  assert.deepEqual([...harness.skills.keys()], [])
  harness.disposeAll()
})

await harness.close()

for (const [status, label] of results) process.stdout.write(`${status}  ${label}\n`)
const failed = results.filter(([status]) => status === 'FAIL').length
process.stdout.write(`\n${String(results.length - failed)}/${String(results.length)} checks passed\n`)
process.exitCode = failed === 0 ? 0 : 1
