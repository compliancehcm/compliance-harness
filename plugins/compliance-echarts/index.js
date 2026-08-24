/**
 * Apache ECharts charts in the conversation, node half.
 *
 * Three contributions, one row:
 *
 *   src/tool.js   the `render_chart` tool — an ECharts `option` in, a chart on
 *                 that call's card out. It draws nothing; the option lives in the
 *                 call arguments, which the session log already keeps, so the
 *                 browser rebuilds the chart on reload and on replay.
 *   src/skill.js  the `echarts-charts` skill, so the model decides which chart
 *                 form answers the question before it writes an option it cannot
 *                 see the result of.
 *   src/asset.js  one route serving the vendored ECharts UMD bundle, fetched by
 *                 the browser only when a conversation actually has a chart.
 *
 * The client half (`./client`) owns the card: it claims the `tool.call.toolview`
 * slot under this tool's wire name, so a chart replaces the generic tool row.
 * A surface without that view — the CLI, ACP, the trajectory panel — falls back
 * to the generic card the tool's own `presentCall` describes.
 *
 * @module
 */
import { resolveConfig } from './src/config.js'
import { assetHandler, loadBundle } from './src/asset.js'
import { chartTool } from './src/tool.js'
import { chartSkill } from './src/skill.js'

export const name = 'echarts-charts'
export const inject = ['tools', 'webServer']

/** Global the client half reads to learn the tool name and where the bundle lives. */
const CONFIG_GLOBAL = '__ECHARTS_CHARTS__'

/**
 * Mount the tool, the skill, and the bundle route.
 * @param ctx - the harness context.
 * @param rawConfig - the row's `config` block, of unknown shape at this boundary.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)
  // Read now, not on first request: a missing vendored bundle is a broken
  // install, and it must fail at boot rather than as a 500 the first time a user
  // asks for a chart.
  const bundle = loadBundle()

  ctx.effect(
    () => ctx.webServer.register({ kind: 'exact', path: config.assetPath, handler: assetHandler(bundle) }),
    'echarts: bundle route',
  )

  ctx.effect(() => ctx.tools.register(chartTool(config)), 'echarts: render_chart tool')

  if (config.registerSkill) {
    // `skills` is injected optionally rather than declared: a composition without
    // the skill registry still gets a working tool, and the tool's own
    // description carries the essential guidance.
    const skills = ctx.get('skills')
    if (skills === undefined) {
      ctx.logger.warn('echarts-charts: no skill registry in this composition; '
        + 'the echarts-charts skill is not available')
    } else {
      ctx.effect(() => skills.register(chartSkill()), 'echarts: charting skill')
    }
  }

  ctx.on('webserver/index-inject', (table) => {
    table.push({ kind: 'global', name: CONFIG_GLOBAL, value: { assetPath: config.assetPath, toolName: config.toolName } })
  })

  ctx.logger.info('echarts-charts: %s renders charts; bundle at %s', config.toolName, config.assetPath)
}
