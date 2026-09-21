/**
 * The `run_pandas` tool: tabular files and a snippet in, a bounded description
 * of the resulting frame out.
 *
 * `@deepseek-ai/dsh-tools` is not resolvable from a `plugins/` package, so this
 * is a raw registration rather than a `defineTool` one: `parameters` is plain
 * JSON Schema and this module owns argument validation, which is the documented
 * contract for tools registered directly.
 *
 * The result is deliberately a DESCRIPTION — shape, columns, dtypes, a head
 * preview — and not the frame. A tool that returned every row would put the
 * whole dataset in the conversation, where it is re-sent on every later turn;
 * `output` exists so a large result leaves as a file instead.
 *
 * @module
 */
import { fileURLToPath } from 'node:url'
import { isAbsolute, resolve as resolvePath } from 'node:path'
import { runPython } from './python.js'

/** The bundled runner, resolved from this file rather than from any cwd. */
const RUNNER = fileURLToPath(new URL('../py/runner.py', import.meta.url))

/** Python identifiers this plugin refuses as frame names, because the runner defines them. */
const RESERVED_NAMES = new Set(['pd', 'result'])

/** Frame-name grammar: a plain lowercase Python identifier. */
const NAME_PATTERN = /^[a-z_][a-z0-9_]{0,31}$/

/**
 * JSON Schema the model sees for the arguments.
 * @param config - the validated plugin configuration.
 * @returns the parameters schema.
 */
function parametersSchema(config) {
  return {
    type: 'object',
    properties: {
      sources: {
        type: 'array',
        minItems: 1,
        maxItems: config.maxSources,
        description: 'The tabular files to load, in order. Each becomes a DataFrame in the snippet. '
          + 'Supported: .csv, .tsv, .txt, .parquet, .json, .xlsx, .xlsm, .xls.',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'File path, absolute or relative to the session directory.' },
            name: {
              type: 'string',
              description: 'Variable name the frame gets in the snippet. Defaults to `df` for the first '
                + 'source and `df2`, `df3`, … for the rest.',
            },
          },
          required: ['path'],
          additionalProperties: false,
        },
      },
      code: {
        type: 'string',
        description: 'Python operating on the loaded frames. `pd` is pandas. Assign the answer to `result`; '
          + 'without it the first source\'s frame is reported, so reassigning `df` also works. '
          + 'Anything you print is captured and returned to you.',
      },
      output: {
        type: 'string',
        description: 'Optional path to write the result to, by extension: .csv, .tsv, .parquet, .json. '
          + 'Use it when the result is large or feeds write_xlsx, instead of reading rows back through here.',
      },
      description: {
        type: 'string',
        description: 'One line on what this call answers, shown on the card.',
      },
    },
    required: ['sources', 'code'],
    additionalProperties: false,
  }
}

/**
 * Validate the model-supplied arguments and fill the defaults.
 * @param args - the model-supplied arguments, of unknown shape.
 * @param config - the validated plugin configuration.
 * @returns the checked sources, code, and output.
 * @throws {Error} naming the first problem found.
 */
function validate(args, config) {
  const sources = args['sources']
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error('sources must be a non-empty array')
  }
  if (sources.length > config.maxSources) {
    throw new Error(`sources holds ${String(sources.length)} entries; at most ${String(config.maxSources)} are allowed`)
  }

  const checked = []
  const seen = new Set()
  for (const [index, source] of sources.entries()) {
    if (typeof source !== 'object' || source === null || Array.isArray(source)) {
      throw new Error(`sources[${String(index)}] must be an object`)
    }
    const path = source['path']
    if (typeof path !== 'string' || path.trim() === '') {
      throw new Error(`sources[${String(index)}].path must be a non-empty string`)
    }
    const rawName = source['name']
    const name = rawName === undefined ? (index === 0 ? 'df' : `df${String(index + 1)}`) : rawName
    if (typeof name !== 'string' || !NAME_PATTERN.test(name)) {
      throw new Error(`sources[${String(index)}].name must be a lowercase Python identifier, got ${JSON.stringify(rawName)}`)
    }
    if (RESERVED_NAMES.has(name)) {
      throw new Error(`sources[${String(index)}].name must not be ${JSON.stringify(name)}: the runner defines it`)
    }
    if (seen.has(name)) throw new Error(`two sources share the name ${JSON.stringify(name)}`)
    seen.add(name)
    checked.push({ path: path.trim(), name })
  }

  const code = args['code']
  if (typeof code !== 'string' || code.trim() === '') throw new Error('code must be a non-empty string')
  const codeBytes = Buffer.byteLength(code, 'utf8')
  if (codeBytes > config.maxCodeBytes) {
    throw new Error(`code is ${String(codeBytes)} bytes; at most ${String(config.maxCodeBytes)} are allowed`)
  }

  const outputRaw = args['output']
  if (outputRaw !== undefined && (typeof outputRaw !== 'string' || outputRaw.trim() === '')) {
    throw new Error('output must be a non-empty string when present')
  }

  return { sources: checked, code, output: outputRaw?.trim() }
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
  const description = typeof args === 'object' && args !== null ? args['description'] : undefined
  if (typeof description === 'string' && description.trim() !== '') return description.trim()
  return 'Analyze data'
}

/**
 * Every file path in the arguments, for the card's `locations`.
 *
 * Pure and log-tolerant for the same reason as the title.
 * @param args - the logged arguments, of unknown shape.
 * @returns the locations, possibly empty.
 */
function safeLocations(args) {
  if (typeof args !== 'object' || args === null) return []
  const paths = []
  const sources = args['sources']
  if (Array.isArray(sources)) {
    for (const source of sources) {
      const path = typeof source === 'object' && source !== null ? source['path'] : undefined
      if (typeof path === 'string' && path.trim() !== '') paths.push({ path: path.trim() })
    }
  }
  const output = args['output']
  if (typeof output === 'string' && output.trim() !== '') paths.push({ path: output.trim() })
  return paths
}

/**
 * Render the model-facing text: the shape, the dtypes, the preview, the prints.
 * @param value - the canonical value.
 * @param config - the validated plugin configuration.
 * @returns the text block.
 */
function renderText(value, config) {
  const lines = [`${String(value.rowCount)} rows x ${String(value.columnCount)} columns`]
  lines.push(Object.entries(value.dtypes).map(([name, dtype]) => `${name}: ${dtype}`).join(', '))

  if (value.preview.rows.length > 0) {
    const header = value.preview.columns.join(' | ')
    lines.push('', header, value.preview.columns.map(() => '---').join(' | '))
    for (const row of value.preview.rows) {
      lines.push(row.map(cell => (cell === null ? '' : String(cell))).join(' | '))
    }
    if (value.previewTruncated) {
      lines.push(`… ${String(value.rowCount - value.preview.rows.length)} more rows not shown `
        + `(preview is capped at ${String(config.maxPreviewRows)})`)
    }
  }

  if (value.stdout.trim() !== '') lines.push('', 'Printed output:', value.stdout.trimEnd())
  if (value.output !== null) lines.push('', `Result written to ${value.output}`)

  return lines.join('\n')
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
export function pandasTool(ctx, config) {
  return {
    name: config.toolName,
    description: 'Analyze tabular files with pandas: load one or more of them, run a Python snippet over the '
      + 'frames, and get back the resulting frame\'s shape, column types and a head preview — not every row. '
      + 'Use it for reading, cleaning, joining, grouping and aggregating data files rather than writing the '
      + 'same code through a shell. Load the `pandas-analysis` skill before the first call of a conversation. '
      + 'For a result that is large or destined for a spreadsheet, pass `output` and hand that file on rather '
      + 'than reading rows back through the conversation.',
    parameters: parametersSchema(config),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          rowCount: { type: 'integer', description: 'Rows in the result frame.' },
          columnCount: { type: 'integer', description: 'Columns in the result frame.' },
          columns: { type: 'array', items: { type: 'string' }, description: 'Result column names, in order.' },
          dtypes: { type: 'object', description: 'Result column name to pandas dtype.' },
          preview: { type: 'object', description: 'Head of the result: its columns and rows.' },
          previewTruncated: { type: 'boolean', description: 'True when rows were withheld from the preview.' },
          stdout: { type: 'string', description: 'Whatever the snippet printed.' },
          // `oneOf`, not `type: ['string', 'null']`: the harness enforces a JSON
          // Schema subset on an output schema in which `type` is a single string,
          // and a type array fails the whole plugin tree at boot.
          output: {
            oneOf: [{ type: 'string' }, { type: 'null' }],
            description: 'Path the result was written to, or null.',
          },
        },
      },
      /**
       * Model-facing content.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns one text block.
       */
      render(_args, value) {
        return [{ type: 'text', text: renderText(value, config) }]
      },
    },
    /**
     * Load the sources, run the snippet, and describe the result.
     * @param args - the model-supplied arguments, already schema-checked.
     * @param exec - the execution context, carrying the session and the abort signal.
     * @returns the canonical value.
     * @throws {Error} when the arguments are invalid or the analysis fails.
     */
    async execute(args, exec) {
      const checked = validate(args, config)
      // Relative paths are the session's, the same identity `tool-bash` gives a
      // relative `workdir`; without a session (a bare composition) the child's
      // own cwd stands in.
      const cwd = exec?.agent?.session?.header?.cwd ?? process.cwd()
      const absolute = source => (isAbsolute(source.path) ? source.path : resolvePath(cwd, source.path))

      const value = await runPython(ctx, {
        label: config.toolName,
        pythonBin: config.pythonBin,
        script: RUNNER,
        cwd,
        timeoutMs: config.timeoutMs,
        graceMs: config.graceMs,
        maxOutputBytes: config.maxOutputBytes,
        signal: exec?.signal,
        request: {
          sources: checked.sources.map(source => ({ path: absolute(source), name: source.name })),
          code: checked.code,
          output: checked.output === undefined
            ? null
            : (isAbsolute(checked.output) ? checked.output : resolvePath(cwd, checked.output)),
          maxPreviewRows: config.maxPreviewRows,
        },
      })
      return value
    },
    /**
     * The pending card.
     * @param args - the logged arguments, of unknown shape.
     * @returns a generic render intent.
     */
    presentCall(args) {
      return { card: 'generic', title: safeTitle(args), kind: 'read', locations: safeLocations(args) }
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
