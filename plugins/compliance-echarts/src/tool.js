/**
 * The `render_chart` tool: one Apache ECharts `option` in, one chart in the
 * conversation out.
 *
 * The tool does no drawing. Everything it needs to draw lives in the call's
 * ARGUMENTS, which the session log already keeps, so the browser half rebuilds
 * the chart from the log on reload and on replay without this plugin persisting
 * anything of its own. That is also why `execute` is pure and why `chartId` is
 * derived from the arguments instead of being a fresh uuid: a replayed call must
 * produce the same canonical value it produced live.
 *
 * `@deepseek-ai/dsh-tools` is not resolvable from a `plugins/` package, so this
 * is a raw registration rather than a `defineTool` one: `parameters` is plain
 * JSON Schema and this module owns argument validation, which is the documented
 * contract for tools registered directly.
 *
 * @module
 */
import { createHash } from 'node:crypto'

/** JSON Schema the model sees for the arguments. */
function parametersSchema() {
  return {
    type: 'object',
    properties: {
      option: {
        type: 'object',
        description: 'The Apache ECharts option object. Must contain `series` or `dataset`. '
          + 'It travels as JSON, so every value must be JSON: no functions, no dates, no undefined.',
      },
      title: {
        type: 'string',
        description: 'Short chart title shown on the card. Prefer this over option.title.',
      },
      caption: {
        type: 'string',
        description: 'One line under the chart: the reading, the source, or the caveat.',
      },
      height: {
        type: 'integer',
        description: 'Card height in pixels. Raise it for many categories or a scrolling legend.',
      },
    },
    required: ['option'],
    additionalProperties: false,
  }
}

/**
 * Count the series in an option, accepting both shapes ECharts accepts.
 * @param option - the validated option object.
 * @returns the series as an array, empty when the option carries none.
 */
function seriesOf(option) {
  const series = option['series']
  if (Array.isArray(series)) return series
  if (typeof series === 'object' && series !== null) return [series]
  return []
}

/**
 * Count the data points the option carries, across series and dataset.
 * @param option - the validated option object.
 * @returns the total number of points, for the one-line summary.
 */
function pointCountOf(option) {
  let points = 0
  for (const entry of seriesOf(option)) {
    if (typeof entry !== 'object' || entry === null) continue
    const data = entry['data']
    if (Array.isArray(data)) points += data.length
  }
  const dataset = option['dataset']
  const datasets = Array.isArray(dataset) ? dataset : dataset === undefined ? [] : [dataset]
  for (const entry of datasets) {
    if (typeof entry !== 'object' || entry === null) continue
    const source = entry['source']
    if (Array.isArray(source)) points += source.length
  }
  return points
}

/**
 * Validate the model's arguments beyond what the JSON Schema expresses.
 *
 * Every rejection names the field and what would be accepted, because the model
 * reads the error and retries: a rejection that only says "invalid" costs a
 * whole extra turn.
 * @param args - the model-supplied arguments.
 * @param config - the validated plugin configuration.
 * @returns the normalized arguments the canonical value is derived from.
 * @throws {Error} on the first problem that makes the chart unrenderable.
 */
function validate(args, config) {
  if (typeof args !== 'object' || args === null) throw new Error('arguments must be an object')
  const option = args['option']
  if (typeof option !== 'object' || option === null || Array.isArray(option)) {
    throw new Error('option must be an ECharts option object')
  }
  const series = seriesOf(option)
  if (series.length === 0 && option['dataset'] === undefined) {
    throw new Error('option must carry `series` (or a `dataset` the series read from); '
      + 'load the `echarts-charts` skill for the option skeleton of each chart type')
  }
  if (series.length > config.maxSeries) {
    throw new Error(`option has ${String(series.length)} series; at most ${String(config.maxSeries)} `
      + 'stay legible on a conversation card — aggregate, or split into several charts')
  }

  let encoded
  try {
    encoded = JSON.stringify(option)
  } catch {
    // A cycle is the only way a parsed-JSON argument fails to re-encode.
    throw new Error('option is not encodable as JSON')
  }
  if (encoded === undefined) throw new Error('option is not encodable as JSON')
  if (encoded.length > config.maxOptionBytes) {
    throw new Error(`option is ${String(encoded.length)} bytes; the limit is ${String(config.maxOptionBytes)}. `
      + 'Aggregate the series (bucket by week or month) or chart a subset — the option stays in the '
      + 'conversation for every later turn, so a huge one costs context forever')
  }

  // ECharts 6 anchors a legend to the BOTTOM by default (`legend: {}` resolves to
  // `{ left: 'center', bottom: 15 }`), so a legend with no stated side lands
  // inside the plot, over the bars and the category labels. The option cannot be
  // repaired here without guessing the intent, and the model never sees the
  // result — so it is rejected with the fix named.
  const legend = option['legend']
  if (typeof legend === 'object' && legend !== null && !Array.isArray(legend)
    && legend['top'] === undefined && legend['bottom'] === undefined) {
    throw new Error('legend has no `top` or `bottom`: this ECharts version anchors it to the bottom, '
      + 'inside the plot area, on top of the bars. Use `legend: { top: 0 }` with `grid.top` at least 32, '
      + 'or `legend: { bottom: 0 }` with `grid.bottom` at least 40 — or drop the legend entirely for a '
      + 'single series. The `echarts-charts` skill has the details')
  }

  const height = args['height']
  if (height !== undefined && (height < config.minHeight || height > config.maxHeight)) {
    throw new Error(`height must lie within [${String(config.minHeight)}, ${String(config.maxHeight)}]`)
  }

  const title = typeof args['title'] === 'string' ? args['title'].trim() : ''
  return {
    encoded,
    seriesCount: series.length,
    pointCount: pointCountOf(option),
    height: height ?? config.defaultHeight,
    title: title === '' ? 'Chart' : title,
  }
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
  const title = typeof args === 'object' && args !== null ? args['title'] : undefined
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : 'Chart'
}

/**
 * Build the tool definition for one validated configuration.
 * @param config - the validated plugin configuration.
 * @returns the definition to hand to `ctx.tools.register`.
 */
export function chartTool(config) {
  return {
    name: config.toolName,
    description: 'Render a chart in the conversation from an Apache ECharts option object. '
      + 'Use it when a shape, trend, comparison, or distribution is the answer — not for three numbers, '
      + 'which belong in the prose. The user sees the chart; you do not, so the option must be right the '
      + 'first time: load the `echarts-charts` skill to pick the chart type and get the option skeleton. '
      + 'Data goes inline in the option and stays in the conversation for every later turn, so aggregate '
      + 'before charting rather than passing thousands of raw points.',
    parameters: parametersSchema(),
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          chartId: { type: 'string', description: 'Stable id of this chart, derived from the option.' },
          seriesCount: { type: 'integer', description: 'Series the option carries.' },
          pointCount: { type: 'integer', description: 'Data points across series and dataset.' },
          height: { type: 'integer', description: 'Card height in pixels the chart was given.' },
        },
      },
      /**
       * Model-facing content: a receipt, not the option.
       *
       * The option already cost its bytes once, in the arguments; repeating it
       * here would double that cost on every subsequent request for no gain,
       * since the model cannot see the rendered result either way.
       * @param args - the validated arguments.
       * @param value - the canonical value.
       * @returns one text block.
       */
      render(args, value) {
        const series = `${String(value.seriesCount)} series`
        const points = `${String(value.pointCount)} point${value.pointCount === 1 ? '' : 's'}`
        return [{
          type: 'text',
          text: `Chart shown to the user: ${safeTitle(args)} (${series}, ${points}). `
            + 'Describe what it shows in your reply; do not repeat the numbers as a table.',
        }]
      },
    },
    /**
     * Derive the canonical value from the arguments alone.
     * @param args - the model-supplied arguments, already schema-checked.
     * @returns the canonical value.
     * @throws {Error} when the option cannot produce a chart.
     */
    async execute(args) {
      const checked = validate(args, config)
      return {
        // Derived, not random: a replayed call must yield the value it yielded live.
        chartId: createHash('sha256').update(checked.encoded).digest('hex').slice(0, 16),
        seriesCount: checked.seriesCount,
        pointCount: checked.pointCount,
        height: checked.height,
      }
    },
    /**
     * The pending card, for surfaces without this plugin's own chart view.
     * @param args - the logged arguments, of unknown shape.
     * @returns a generic render intent.
     */
    presentCall(args) {
      return { card: 'generic', title: safeTitle(args) }
    },
    /**
     * The settled card, for surfaces without this plugin's own chart view.
     * @param args - the logged arguments, of unknown shape.
     * @param result - the normalized outcome.
     * @returns a generic render intent.
     */
    presentResult(args, result) {
      return { card: 'generic', title: safeTitle(args), content: result.content }
    },
  }
}
