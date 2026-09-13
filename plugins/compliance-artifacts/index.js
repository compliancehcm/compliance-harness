/**
 * Interactive HTML artifacts, node half.
 *
 * Four contributions, one row:
 *
 *   src/tool.js   `create_artifact` and `update_artifact` — a page in, a receipt
 *                 out. The page goes to disk; only the receipt enters the
 *                 conversation, and only the receipt is model-visible.
 *   src/store.js  the versioned directory behind them. A version is immutable
 *                 once written, so a URL the user already opened keeps showing
 *                 what they saw.
 *   src/route.js  one prefix route serving the document with its OWN CSP, which
 *                 is the whole reason it is a URL and not a `srcdoc` string.
 *   src/skill.js  the `artifacts` skill, so the model knows what the sandbox
 *                 silently refuses before it writes a page it cannot see.
 *
 * The client half (`./client`) owns both surfaces: the card that claims each
 * tool's `tool.call.toolview`, and the right-Sidebar tab whose body is the
 * sandboxed frame. A surface without that half — the CLI, ACP — still gets
 * working tools and the generic card the tools' own `presentCall` describes.
 *
 * @module
 */
import { resolveConfig } from './src/config.js'
import { artifactHandler } from './src/route.js'
import { createArtifactTool, updateArtifactTool } from './src/tool.js'
import { artifactsSkill } from './src/skill.js'

export const name = 'artifacts'
export const inject = ['tools', 'webServer']

/** Global the client half reads to learn the route and the two tool names. */
const CONFIG_GLOBAL = '__COMPLIANCE_ARTIFACTS__'

/**
 * Mount the two tools, the route, and the skill.
 * @param ctx - the harness context.
 * @param rawConfig - the row's `config` block, of unknown shape at this boundary.
 */
export function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)

  ctx.effect(
    () => ctx.webServer.register({ kind: 'prefix', path: config.routePath, handler: artifactHandler(config) }),
    'artifacts: document route',
  )

  ctx.effect(() => ctx.tools.register(createArtifactTool(ctx, config)), 'artifacts: create tool')
  ctx.effect(() => ctx.tools.register(updateArtifactTool(ctx, config)), 'artifacts: update tool')

  if (config.registerSkill) {
    // `skills` is read optionally rather than declared in `inject`: a composition
    // without the skill registry still gets working tools, and their own
    // descriptions carry the essential guidance.
    const skills = ctx.get('skills')
    if (skills === undefined) {
      ctx.logger.warn('artifacts: no skill registry in this composition; the artifacts skill is not available')
    } else {
      ctx.effect(() => skills.register(artifactsSkill()), 'artifacts: authoring skill')
    }
  }

  ctx.on('webserver/index-inject', (table) => {
    table.push({
      kind: 'global',
      name: CONFIG_GLOBAL,
      value: {
        routePath: config.routePath,
        createToolName: config.createToolName,
        updateToolName: config.updateToolName,
      },
    })
  })

  ctx.logger.info('artifacts: %s and %s serve documents from %s under %s',
    config.createToolName, config.updateToolName, config.root, config.routePath)
}
