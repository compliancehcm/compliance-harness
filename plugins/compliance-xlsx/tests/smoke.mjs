// A runnable smoke test for the whole plugin: configuration and its theme, the
// tool's acceptances and rejections, the skill's frontmatter, the presenters'
// tolerance of malformed logged arguments, and — when openpyxl is installed — a
// real build whose result is REOPENED and inspected: sheet names, number
// formats, the totals formula, frozen panes, the autofilter and the chart.
//
// Reopening matters. Asserting that a file exists would pass for a workbook with
// every format wrong, which is exactly the failure this plugin exists to prevent.
//
// Not a vitest suite: `plugins/` is outside `vitest.config.ts`'s include globs
// (`packages/*/*/tests`), deliberately, because these packages are this
// deployment's layer rather than the shipped harness. Run it by hand:
//
//   node plugins/compliance-xlsx/tests/smoke.mjs
//
// It needs no build, no network and no API key.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { spawnSync } from 'node:child_process'
import { createFakeCtx } from './fake-ctx.mjs'
import { apply, inject, name } from '../index.js'
import { resolveConfig, XlsxConfigError } from '../src/config.js'
import { xlsxTool } from '../src/tool.js'
import { xlsxSkill } from '../src/skill.js'

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
const openpyxlReady = spawnSync('python3', ['-c', 'import openpyxl'], { stdio: 'ignore' }).status === 0
const pandasReady = spawnSync('python3', ['-c', 'import pandas'], { stdio: 'ignore' }).status === 0

const workspace = mkdtempSync(join(tmpdir(), 'xlsx-smoke-'))

// ---------------------------------------------------------------- configuration

await check('config applies every default, theme included', () => {
  const config = resolveConfig()
  assert.equal(config.toolName, 'write_xlsx')
  assert.equal(config.theme.headerFill, 'FF1F3864')
  assert.equal(config.theme.fontName, 'Calibri')
  assert.equal(config.maxSheets, 12)
})

await check('config rejects an unknown field', () => {
  assert.throws(() => resolveConfig({ nope: 1 }), XlsxConfigError)
})

await check('config rejects an unknown theme field', () => {
  assert.throws(() => resolveConfig({ theme: { headerColour: 'FF000000' } }), /unknown theme field/)
})

await check('config rejects a colour that is not ARGB', () => {
  assert.throws(() => resolveConfig({ theme: { headerFill: '#1F3864' } }), /must be an ARGB colour/)
})

await check('config accepts a theme override and uppercases it', () => {
  const config = resolveConfig({ theme: { headerFill: 'ffabcdef' } })
  assert.equal(config.theme.headerFill, 'FFABCDEF')
  assert.equal(config.theme.totalsFill, 'FFD9E2F3', 'unspecified theme keys keep their default')
})

await check('config rejects more rows than a worksheet can hold', () => {
  assert.throws(() => resolveConfig({ maxRows: 2_000_000 }), /worksheet limit/)
})

// ------------------------------------------------------------------- validation

const config = resolveConfig()
const tool = xlsxTool(createFakeCtx().ctx, config)
const SHEET = { name: 'Resumo', columns: [{ key: 'a' }], rows: [{ a: 1 }] }

await check('the tool is named from the config', () => {
  assert.equal(tool.name, 'write_xlsx')
  assert.deepEqual(tool.parameters.required, ['path', 'sheets'])
  assert.equal(tool.parameters.additionalProperties, false)
})

await check('a path that is not .xlsx is rejected', async () => {
  await assert.rejects(tool.execute({ path: 'out.csv', sheets: [SHEET] }, {}), /must end in \.xlsx/)
})

await check('a sheet with neither rows nor source is rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ name: 'R', columns: [{ key: 'a' }] }] }, {}),
    /needs either rows or source/,
  )
})

await check('a sheet with both rows and source is rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ ...SHEET, source: 'x.csv' }] }, {}),
    /pass exactly one/,
  )
})

await check('an unknown column type is rejected and names the valid ones', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ name: 'R', columns: [{ key: 'a', type: 'money' }], rows: [] }] }, {}),
    /must be one of text, number, integer, currency, percent, date, month/,
  )
})

await check('a sheet name Excel cannot hold is rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ ...SHEET, name: 'a/b' }] }, {}),
    /must not contain/,
  )
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ ...SHEET, name: 'x'.repeat(32) }] }, {}),
    /Excel allows 31/,
  )
})

await check('two sheets with the same name, in any case, are rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [SHEET, { ...SHEET, name: 'resumo' }] }, {}),
    /two sheets are named/,
  )
})

await check('totals naming a column that does not exist are rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ ...SHEET, totals: ['zzz'] }] }, {}),
    /which is not a column/,
  )
})

await check('a chart naming a column that does not exist is rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ ...SHEET, chart: { type: 'bar', categories: 'a', series: ['zzz'] } }] }, {}),
    /chart\.series names/,
  )
})

await check('duplicate column keys are rejected', async () => {
  await assert.rejects(
    tool.execute({ path: 'o.xlsx', sheets: [{ name: 'R', columns: [{ key: 'a' }, { key: 'a' }], rows: [] }] }, {}),
    /two columns keyed/,
  )
})

// ------------------------------------------------------------------- presenters

await check('the presenters tolerate arguments a rejected call left in the log', () => {
  for (const args of [undefined, null, 42, {}, { path: 7 }, { sheets: 'nope' }]) {
    const call = tool.presentCall(args)
    assert.equal(call.card, 'generic')
    assert.ok(typeof call.title === 'string' && call.title !== '')
    assert.ok(Array.isArray(call.locations))
    const settled = tool.presentResult(args, { content: [] })
    assert.ok(typeof settled.title === 'string' && settled.title !== '')
  }
})

await check('the card carries the produced file as a location', () => {
  // This is what puts the workbook in the Web deliverables row; without it the
  // user is told about a file instead of handed one.
  const call = tool.presentCall({ path: 'resumo.xlsx', description: 'Vendas' })
  assert.equal(call.title, 'Vendas')
  assert.deepEqual(call.locations, [{ path: 'resumo.xlsx' }])
  assert.deepEqual(tool.presentCall({ path: 'resumo.xlsx' }).title, 'resumo.xlsx')
})

// ------------------------------------------------------------------------ skill

await check('the skill parses and its frontmatter does not reach the model', () => {
  const skill = xlsxSkill()
  assert.equal(skill.name, 'xlsx-workbook')
  assert.equal(skill.source, 'bundled')
  assert.equal(skill.resourceBase.kind, 'directory')
  assert.ok(!skill.content.startsWith('---'), 'the frontmatter must not reach the model twice')
  assert.ok(skill.content.includes('write_xlsx'))
})

// ------------------------------------------------------------------------- boot

await check('apply registers the tool and the skill, and both withdraw on dispose', async () => {
  const harness = createFakeCtx()
  await apply(harness.ctx, {})
  assert.equal(name, 'xlsx-workbook')
  assert.deepEqual(inject, ['tools', 'subprocess'])
  assert.deepEqual([...harness.tools.keys()], ['write_xlsx'])
  assert.deepEqual([...harness.skills.keys()], ['xlsx-workbook'])
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
  assert.deepEqual([...harness.tools.keys()], ['write_xlsx'])
  assert.ok(harness.logs.some(([level, text]) => level === 'warn' && text.includes('no skill registry')))
})

// -------------------------------------------------------------------- end to end

if (openpyxlReady) {
  const harness = createFakeCtx()
  const live = xlsxTool(harness.ctx, config)
  const exec = { agent: { session: { header: { cwd: workspace } } } }

  /**
   * Reopen a written workbook through openpyxl and return the facts as JSON.
   * @param file - the workbook file name inside the temporary workspace.
   * @param formulas - true keeps formulas as text instead of evaluating to None.
   * @returns the inspected facts.
   */
  const reopen = (file, formulas = false) => {
    const script = `
import json, sys
from openpyxl import load_workbook
wb = load_workbook(sys.argv[1], data_only=False)
out = {"sheets": wb.sheetnames, "detail": {}}
for title in wb.sheetnames:
    ws = wb[title]
    out["detail"][title] = {
        "maxRow": ws.max_row,
        "maxColumn": ws.max_column,
        "freeze": ws.freeze_panes,
        "autofilter": ws.auto_filter.ref,
        "charts": len(ws._charts),
        "header": [ws.cell(row=1, column=c).value for c in range(1, ws.max_column + 1)],
        "headerFill": ws.cell(row=1, column=1).fill.fgColor.rgb,
        "headerBold": ws.cell(row=1, column=1).font.bold,
        "formats": [ws.cell(row=2, column=c).number_format for c in range(1, ws.max_column + 1)],
        "values": [[ws.cell(row=r, column=c).value for c in range(1, ws.max_column + 1)]
                   for r in range(2, ws.max_row + 1)],
    }
json.dump(out, sys.stdout, default=str)
`
    const run = spawnSync('python3', ['-c', script, join(workspace, file)], { encoding: 'utf8' })
    assert.equal(run.status, 0, `reopening ${file} failed: ${run.stderr}`)
    return JSON.parse(run.stdout)
  }

  await check('e2e: inline rows produce a themed, frozen, filtered sheet', async () => {
    const value = await live.execute({
      path: 'basico.xlsx',
      description: 'Vendas',
      sheets: [{
        name: 'Resumo',
        columns: [
          { key: 'mes', label: 'Competência', type: 'month' },
          { key: 'cnpj', label: 'CNPJ', type: 'text' },
          { key: 'valor', label: 'Valor', type: 'currency' },
          { key: 'margem', label: 'Margem', type: 'percent' },
        ],
        rows: [
          { mes: '01/2026', cnpj: '00123456000199', valor: 1234.56, margem: 0.15 },
          { mes: '02/2026', cnpj: '00987654000111', valor: 70, margem: 0.4 },
        ],
      }],
    }, exec)

    assert.equal(value.path, join(workspace, 'basico.xlsx'))
    assert.deepEqual(value.sheets, [{ name: 'Resumo', rowCount: 2, columnCount: 4 }])

    const book = reopen('basico.xlsx')
    assert.deepEqual(book.sheets, ['Resumo'])
    const sheet = book.detail.Resumo
    assert.deepEqual(sheet.header, ['Competência', 'CNPJ', 'Valor', 'Margem'])
    assert.equal(sheet.headerFill, 'FF1F3864', 'the theme header colour must reach the file')
    assert.equal(sheet.headerBold, true)
    assert.equal(sheet.freeze, 'A2')
    assert.equal(sheet.autofilter, 'A1:D3')
    assert.deepEqual(sheet.formats, ['MM/YYYY', '@', 'R$ #,##0.00', '0.0%'])
  })

  await check('e2e: an identifier keeps its leading zeros as text', () => {
    const sheet = reopen('basico.xlsx').detail.Resumo
    assert.equal(sheet.values[0][1], '00123456000199', 'a CNPJ read as a number would lose its zeros')
  })

  await check('e2e: totals are a SUBTOTAL formula, not a constant', async () => {
    await live.execute({
      path: 'totais.xlsx',
      sheets: [{
        name: 'Resumo',
        columns: [{ key: 'filial', type: 'text' }, { key: 'valor', type: 'currency' }],
        rows: [{ filial: 'SP', valor: 100 }, { filial: 'RJ', valor: 50 }],
        totals: ['valor'],
      }],
    }, exec)
    const sheet = reopen('totais.xlsx').detail.Resumo
    assert.equal(sheet.maxRow, 4, 'header, two rows, totals')
    assert.equal(sheet.values[2][0], 'Total')
    assert.equal(sheet.values[2][1], '=SUBTOTAL(109,B2:B3)', 'the total must follow the autofilter')
  })

  await check('e2e: a chart is anchored on the sheet', async () => {
    await live.execute({
      path: 'grafico.xlsx',
      sheets: [{
        name: 'Resumo',
        columns: [{ key: 'mes', type: 'month' }, { key: 'valor', type: 'currency' }],
        rows: [{ mes: '01/2026', valor: 100 }, { mes: '02/2026', valor: 50 }],
        chart: { type: 'column', categories: 'mes', series: ['valor'], title: 'Vendas' },
      }],
    }, exec)
    assert.equal(reopen('grafico.xlsx').detail.Resumo.charts, 1)
  })

  await check('e2e: several sheets keep their tab order', async () => {
    await live.execute({
      path: 'abas.xlsx',
      sheets: [
        { name: 'Resumo', columns: [{ key: 'a' }], rows: [{ a: 'x' }] },
        { name: 'Detalhe', columns: [{ key: 'b' }], rows: [{ b: 'y' }] },
      ],
    }, exec)
    assert.deepEqual(reopen('abas.xlsx').sheets, ['Resumo', 'Detalhe'])
  })

  await check('e2e: the decimal comma of an exported file becomes a number', async () => {
    await live.execute({
      path: 'virgula.xlsx',
      sheets: [{
        name: 'Resumo',
        columns: [{ key: 'valor', type: 'currency' }],
        rows: [{ valor: '1.234,56' }],
      }],
    }, exec)
    assert.equal(reopen('virgula.xlsx').detail.Resumo.values[0][0], 1234.56)
  })

  await check('e2e: a flag turns the header freeze off', async () => {
    await live.execute({
      path: 'livre.xlsx',
      sheets: [{ name: 'R', columns: [{ key: 'a' }], rows: [{ a: 1 }], freezeHeader: false, autofilter: false }],
    }, exec)
    const sheet = reopen('livre.xlsx').detail.R
    assert.equal(sheet.freeze, null)
    assert.equal(sheet.autofilter, null)
  })

  await check('e2e: the theme override reaches the file', async () => {
    const themed = xlsxTool(harness.ctx, resolveConfig({ theme: { headerFill: 'FF7030A0' } }))
    await themed.execute({
      path: 'tema.xlsx',
      sheets: [{ name: 'R', columns: [{ key: 'a' }], rows: [{ a: 1 }] }],
    }, exec)
    assert.equal(reopen('tema.xlsx').detail.R.headerFill, 'FF7030A0')
  })

  await check('e2e: a python failure surfaces as a tool error, not a silent empty file', async () => {
    await assert.rejects(
      live.execute({
        path: join('sem-tal-pasta', 'x.xlsx'),
        sheets: [{ name: 'R', columns: [{ key: 'a' }], rows: [{ a: 1 }] }],
      }, exec),
      /write_xlsx:/,
    )
    assert.equal(existsSync(join(workspace, 'sem-tal-pasta', 'x.xlsx')), false)
  })

  if (pandasReady) {
    await check('e2e: a sheet reads its rows from a source file', async () => {
      writeFileSync(join(workspace, 'dados.csv'), 'filial,valor\nSP,100\nRJ,50\nMG,25\n', 'utf8')
      const value = await live.execute({
        path: 'daorigem.xlsx',
        sheets: [{
          name: 'Resumo',
          source: 'dados.csv',
          columns: [{ key: 'filial', type: 'text' }, { key: 'valor', type: 'currency' }],
          totals: ['valor'],
        }],
      }, exec)
      assert.deepEqual(value.sheets, [{ name: 'Resumo', rowCount: 3, columnCount: 2 }])
      const sheet = reopen('daorigem.xlsx').detail.Resumo
      assert.equal(sheet.values[0][0], 'SP')
      assert.equal(sheet.values[2][1], 25)
    })
  } else {
    results.push(['SKIP', 'e2e: source files need pandas, which is not installed on this host'])
  }
} else {
  results.push(['SKIP', 'end-to-end checks: python3 with openpyxl is not installed on this host'])
}

rmSync(workspace, { recursive: true, force: true })

for (const [status, label] of results) console.log(`${status}  ${label}`)
const failed = results.filter(([status]) => status === 'FAIL').length
console.log(`\n${String(results.length - failed)} ok, ${String(failed)} failed`)
process.exit(failed === 0 ? 0 : 1)
