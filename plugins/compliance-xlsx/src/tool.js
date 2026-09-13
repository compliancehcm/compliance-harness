/**
 * The `write_xlsx` tool: a declarative workbook in, a formatted `.xlsx` on disk
 * out, and a deliverable chip in the conversation.
 *
 * `@deepseek-ai/dsh-tools` is not resolvable from a `plugins/` package, so this
 * is a raw registration rather than a `defineTool` one: `parameters` is plain
 * JSON Schema and this module owns argument validation, which is the documented
 * contract for tools registered directly.
 *
 * Declarative rather than a Python snippet, unlike `run_pandas`: the spreadsheet
 * is the deliverable, so its look belongs to this plugin's theme and not to
 * whatever formatting the model improvises per call. It is the same trade as the
 * ECharts plugin's "one option in, one chart out".
 *
 * Rows reach a sheet inline OR through `source`, a file written by `run_pandas`.
 * The second path exists because inline rows are model output: a ten-thousand-row
 * sheet emitted as JSON costs those tokens on this turn and on every later one.
 *
 * @module
 */
import { fileURLToPath } from 'node:url'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { runPython } from './python.js'

/** The bundled builder, resolved from this file rather than from any cwd. */
const BUILDER = fileURLToPath(new URL('../py/write_xlsx.py', import.meta.url))

/** Column types the builder knows, and what each one formats as. */
const COLUMN_TYPES = ['text', 'number', 'integer', 'currency', 'percent', 'date', 'month']

/** Chart kinds the builder knows. */
const CHART_TYPES = ['bar', 'column', 'hbar', 'line', 'pie']

/** Characters Excel forbids in a sheet name, plus the length cap it enforces. */
const FORBIDDEN_SHEET_CHARS = /[:\\/?*[\]]/

/**
 * JSON Schema the model sees for the arguments.
 * @param config - the validated plugin configuration.
 * @returns the parameters schema.
 */
function parametersSchema(config) {
  return {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Destination path ending in .xlsx, absolute or relative to the session directory.',
      },
      sheets: {
        type: 'array',
        minItems: 1,
        maxItems: config.maxSheets,
        description: 'The sheets, in tab order.',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Tab name, at most 31 characters, without : \\ / ? * [ ].' },
            columns: {
              type: 'array',
              minItems: 1,
              maxItems: config.maxColumns,
              description: 'The columns, in order. Every row is read through these.',
              items: {
                type: 'object',
                properties: {
                  key: { type: 'string', description: 'Key to read from each row object.' },
                  label: { type: 'string', description: 'Header text. Defaults to the key.' },
                  type: {
                    type: 'string',
                    enum: COLUMN_TYPES,
                    description: 'Cell formatting. `currency` is R$, `percent` expects a fraction '
                      + '(0.15 shows as 15,0%), `month` is the MM/YYYY competência, `text` keeps '
                      + 'leading zeros — use it for CPF, CNPJ and any other identifier.',
                  },
                  width: { type: 'integer', description: 'Column width. Omit to size it from the content.' },
                },
                required: ['key'],
                additionalProperties: false,
              },
            },
            rows: {
              type: 'array',
              description: 'Row objects keyed by the columns\' `key`. Use this only for small tables; '
                + 'for anything large pass `source` instead so the rows never enter the conversation.',
              items: { type: 'object' },
            },
            source: {
              type: 'string',
              description: 'Path to a .csv, .tsv, .parquet or .json file holding the rows — typically one '
                + 'written by run_pandas\' `output`. Preferred over `rows` for real datasets.',
            },
            totals: {
              type: 'array',
              items: { type: 'string' },
              description: 'Column keys to total in a footer row, as a SUBTOTAL formula that follows filtering.',
            },
            chart: {
              type: 'object',
              description: 'An optional chart anchored beside the data.',
              properties: {
                type: { type: 'string', enum: CHART_TYPES },
                categories: { type: 'string', description: 'Column key supplying the category axis.' },
                series: { type: 'array', items: { type: 'string' }, description: 'Column keys to plot.' },
                title: { type: 'string' },
              },
              required: ['type', 'categories', 'series'],
              additionalProperties: false,
            },
            freezeHeader: { type: 'boolean', description: 'Freeze the header row. Default true.' },
            autofilter: { type: 'boolean', description: 'Add an autofilter over the data. Default true.' },
            banded: { type: 'boolean', description: 'Shade alternate rows. Default true.' },
          },
          required: ['name', 'columns'],
          additionalProperties: false,
        },
      },
      description: {
        type: 'string',
        description: 'One line on what this workbook is, shown on the card.',
      },
    },
    required: ['path', 'sheets'],
    additionalProperties: false,
  }
}

/**
 * Validate one sheet and fill its defaults.
 * @param sheet - the model-supplied sheet, of unknown shape.
 * @param index - its position, for messages.
 * @param config - the validated plugin configuration.
 * @returns the checked sheet.
 * @throws {Error} naming the first problem found.
 */
function validateSheet(sheet, index, config) {
  const at = `sheets[${String(index)}]`
  if (typeof sheet !== 'object' || sheet === null || Array.isArray(sheet)) throw new Error(`${at} must be an object`)

  const name = sheet['name']
  if (typeof name !== 'string' || name.trim() === '') throw new Error(`${at}.name must be a non-empty string`)
  if (name.length > 31) throw new Error(`${at}.name is ${String(name.length)} characters; Excel allows 31`)
  if (FORBIDDEN_SHEET_CHARS.test(name)) throw new Error(`${at}.name must not contain : \\ / ? * [ ]`)

  const columns = sheet['columns']
  if (!Array.isArray(columns) || columns.length === 0) throw new Error(`${at}.columns must be a non-empty array`)
  if (columns.length > config.maxColumns) {
    throw new Error(`${at}.columns holds ${String(columns.length)}; at most ${String(config.maxColumns)} are allowed`)
  }

  const keys = new Set()
  const checkedColumns = columns.map((column, columnIndex) => {
    const columnAt = `${at}.columns[${String(columnIndex)}]`
    if (typeof column !== 'object' || column === null || Array.isArray(column)) {
      throw new Error(`${columnAt} must be an object`)
    }
    const key = column['key']
    if (typeof key !== 'string' || key.trim() === '') throw new Error(`${columnAt}.key must be a non-empty string`)
    if (keys.has(key)) throw new Error(`${at} has two columns keyed ${JSON.stringify(key)}`)
    keys.add(key)
    const type = column['type'] ?? 'text'
    if (!COLUMN_TYPES.includes(type)) {
      throw new Error(`${columnAt}.type must be one of ${COLUMN_TYPES.join(', ')}, got ${JSON.stringify(type)}`)
    }
    const label = column['label'] ?? key
    if (typeof label !== 'string') throw new Error(`${columnAt}.label must be a string`)
    const width = column['width']
    if (width !== undefined && (typeof width !== 'number' || !Number.isInteger(width) || width <= 0)) {
      throw new Error(`${columnAt}.width must be a positive whole number`)
    }
    return { key, label, type, ...width === undefined ? {} : { width } }
  })

  const rows = sheet['rows']
  const source = sheet['source']
  if (rows === undefined && source === undefined) throw new Error(`${at} needs either rows or source`)
  if (rows !== undefined && source !== undefined) {
    // Both would mean one of them silently loses, and the caller could not tell
    // which from the result.
    throw new Error(`${at} has both rows and source; pass exactly one`)
  }
  if (rows !== undefined) {
    if (!Array.isArray(rows)) throw new Error(`${at}.rows must be an array`)
    if (rows.length > config.maxRows) {
      throw new Error(`${at}.rows holds ${String(rows.length)}; at most ${String(config.maxRows)} are allowed`)
    }
    for (const [rowIndex, row] of rows.entries()) {
      if (typeof row !== 'object' || row === null || Array.isArray(row)) {
        throw new Error(`${at}.rows[${String(rowIndex)}] must be an object`)
      }
    }
  }
  if (source !== undefined && (typeof source !== 'string' || source.trim() === '')) {
    throw new Error(`${at}.source must be a non-empty string`)
  }

  const totals = sheet['totals']
  if (totals !== undefined) {
    if (!Array.isArray(totals)) throw new Error(`${at}.totals must be an array of column keys`)
    for (const key of totals) {
      if (!keys.has(key)) throw new Error(`${at}.totals names ${JSON.stringify(key)}, which is not a column`)
    }
  }

  const chart = sheet['chart']
  if (chart !== undefined) {
    if (typeof chart !== 'object' || chart === null || Array.isArray(chart)) {
      throw new Error(`${at}.chart must be an object`)
    }
    if (!CHART_TYPES.includes(chart['type'])) {
      throw new Error(`${at}.chart.type must be one of ${CHART_TYPES.join(', ')}`)
    }
    if (!keys.has(chart['categories'])) {
      throw new Error(`${at}.chart.categories names ${JSON.stringify(chart['categories'])}, which is not a column`)
    }
    const series = chart['series']
    if (!Array.isArray(series) || series.length === 0) throw new Error(`${at}.chart.series must be a non-empty array`)
    for (const key of series) {
      if (!keys.has(key)) throw new Error(`${at}.chart.series names ${JSON.stringify(key)}, which is not a column`)
    }
  }

  for (const flag of ['freezeHeader', 'autofilter', 'banded']) {
    const value = sheet[flag]
    if (value !== undefined && typeof value !== 'boolean') throw new Error(`${at}.${flag} must be a boolean`)
  }

  return {
    name,
    columns: checkedColumns,
    ...rows === undefined ? {} : { rows },
    ...source === undefined ? {} : { source: source.trim() },
    ...totals === undefined ? {} : { totals },
    ...chart === undefined ? {} : { chart },
    freezeHeader: sheet['freezeHeader'] ?? true,
    autofilter: sheet['autofilter'] ?? true,
    banded: sheet['banded'] ?? true,
  }
}

/**
 * Validate the model-supplied arguments.
 * @param args - the model-supplied arguments, of unknown shape.
 * @param config - the validated plugin configuration.
 * @returns the checked destination and sheets.
 * @throws {Error} naming the first problem found.
 */
function validate(args, config) {
  const path = args['path']
  if (typeof path !== 'string' || path.trim() === '') throw new Error('path must be a non-empty string')
  if (!path.trim().toLowerCase().endsWith('.xlsx')) throw new Error('path must end in .xlsx')

  const sheets = args['sheets']
  if (!Array.isArray(sheets) || sheets.length === 0) throw new Error('sheets must be a non-empty array')
  if (sheets.length > config.maxSheets) {
    throw new Error(`sheets holds ${String(sheets.length)}; at most ${String(config.maxSheets)} are allowed`)
  }

  const names = new Set()
  const checked = sheets.map((sheet, index) => {
    const validated = validateSheet(sheet, index, config)
    // Excel compares tab names case-insensitively, and a duplicate would
    // silently become "Resumo1" rather than failing.
    const lower = validated.name.toLowerCase()
    if (names.has(lower)) throw new Error(`two sheets are named ${JSON.stringify(validated.name)}`)
    names.add(lower)
    return validated
  })

  return { path: path.trim(), sheets: checked }
}

/**
 * The card title, tolerant of anything the log may hold.
 *
 * The presenters run on live streaming AND on session-log replay, including over
 * arguments a rejected call kept verbatim, so they must not throw: a display
 * path that throws takes the replay down with it.
 * @param args - the logged arguments, of unknown shape.
 * @returns a title that is always a non-empty string.
 */
function safeTitle(args) {
  if (typeof args === 'object' && args !== null) {
    const description = args['description']
    if (typeof description === 'string' && description.trim() !== '') return description.trim()
    const path = args['path']
    if (typeof path === 'string' && path.trim() !== '') return path.trim()
  }
  return 'Spreadsheet'
}

/**
 * The produced file, for the card's `locations`.
 *
 * This is what puts the workbook in the Web deliverables row: that row reads the
 * mutation tools' own locations, never the closing prose, so a file omitted here
 * is a file the user has to be told about in words instead of being handed.
 * @param args - the logged arguments, of unknown shape.
 * @returns the locations, possibly empty.
 */
function safeLocations(args) {
  const path = typeof args === 'object' && args !== null ? args['path'] : undefined
  return typeof path === 'string' && path.trim() !== '' ? [{ path: path.trim() }] : []
}

/**
 * Build the tool definition for one validated configuration.
 *
 * `ctx` arrives by closure rather than off the definition, because a registered
 * tool object carries no context of its own and `execute` needs `ctx.subprocess`.
 * @param ctx - the harness context; `ctx.subprocess` must be present.
 * @param config - the validated plugin configuration.
 * @returns the definition to hand to `ctx.tools.register`.
 */
export function xlsxTool(ctx, config) {
  return {
    name: config.toolName,
    description: 'Write a formatted Excel workbook the user can open and send on: multiple sheets, a styled '
      + 'header, frozen panes, autofilter, Brazilian number and date formats, a totals row and an optional '
      + 'chart. Describe the sheets and this tool builds them — do not write a spreadsheet by hand through a '
      + 'shell. Pass a sheet\'s `source` (a file written by run_pandas) rather than inline `rows` for anything '
      + 'beyond a small table, so the data never enters the conversation. Load the `xlsx-workbook` skill '
      + 'before the first workbook of a conversation.',
    parameters: parametersSchema(config),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          path: { type: 'string', description: 'Absolute path the workbook was written to.' },
          sheets: { type: 'array', description: 'Per sheet: its name, row count and column count.' },
        },
      },
      /**
       * Model-facing content: a receipt, not the data.
       *
       * The rows already cost their bytes once — inline in the arguments, or not
       * at all when they came from a file — and the model cannot see the
       * rendered workbook either way.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns one text block.
       */
      render(_args, value) {
        const sheets = value.sheets
          .map(sheet => `${sheet.name} (${String(sheet.rowCount)} rows x ${String(sheet.columnCount)} columns)`)
          .join(', ')
        return [{
          type: 'text',
          text: `Workbook written to ${value.path}: ${sheets}. `
            + 'The user has it as a file; say what it contains, do not repeat the rows.',
        }]
      },
    },
    /**
     * Build the workbook.
     * @param args - the model-supplied arguments, already schema-checked.
     * @param exec - the execution context, carrying the session and the abort signal.
     * @returns the canonical value.
     * @throws {Error} when the arguments are invalid or the workbook cannot be written.
     */
    async execute(args, exec) {
      const checked = validate(args, config)
      const cwd = exec?.agent?.session?.header?.cwd ?? process.cwd()
      const absolute = path => (isAbsolute(path) ? path : resolvePath(cwd, path))

      return await runPython(ctx, {
        label: config.toolName,
        pythonBin: config.pythonBin,
        script: BUILDER,
        cwd,
        timeoutMs: config.timeoutMs,
        graceMs: config.graceMs,
        maxOutputBytes: config.maxOutputBytes,
        signal: exec?.signal,
        request: {
          path: absolute(checked.path),
          theme: config.theme,
          limits: { maxRows: config.maxRows },
          sheets: checked.sheets.map(sheet => ({
            ...sheet,
            ...sheet.source === undefined ? {} : { source: absolute(sheet.source) },
          })),
        },
      })
    },
    /**
     * The pending card.
     * @param args - the logged arguments, of unknown shape.
     * @returns a generic render intent.
     */
    presentCall(args) {
      return { card: 'generic', title: safeTitle(args), locations: safeLocations(args) }
    },
    /**
     * The settled card.
     * @param args - the logged arguments, of unknown shape.
     * @param result - the normalized outcome.
     * @returns a generic render intent.
     */
    presentResult(args, result) {
      return { card: 'generic', title: safeTitle(args), content: result.content, locations: safeLocations(args) }
    },
  }
}
