/**
 * Tabular analysis with pandas, node half.
 *
 * Two contributions, one row:
 *
 *   src/tool.js   the `run_pandas` tool — tabular files and a Python snippet in,
 *                 a bounded description of the resulting frame out. The frame
 *                 itself never enters the conversation; a large result leaves
 *                 through the call's `output` path instead.
 *   src/skill.js  the `pandas-analysis` skill, so the model inspects an
 *                 unfamiliar file before computing over it and knows the
 *                 Brazilian data shapes that a default read gets wrong.
 *
 * There is no client half: the tool's result is text, and the generic card its
 * own `presentCall`/`presentResult` describe is the right card for it.
 *
 * The interpreter is resolved at apply, not on first use: a deployment without
 * Python is a broken install, and it must say so at boot rather than as a failed
 * tool call the first time someone asks a data question.
 *
 * @module
 */
import { resolveConfig } from './src/config.js'
import { pandasTool } from './src/tool.js'
import { pandasSkill } from './src/skill.js'

export const name = 'pandas-analysis'
export const inject = ['tools', 'subprocess']

/**
 * Mount the tool and the skill.
 * @param ctx - the harness context.
 * @param rawConfig - the row's `config` block, of unknown shape at this boundary.
 * @returns nothing; it awaits the interpreter check before registering.
 * @throws {Error} when the configured interpreter cannot be resolved.
 */
export async function apply(ctx, rawConfig) {
  const config = resolveConfig(rawConfig)

  let executable
  try {
    executable = await ctx.subprocess.resolveExecutable(config.pythonBin)
  } catch (cause) {
    throw new Error(
      `pandas-analysis: cannot resolve the Python interpreter ${JSON.stringify(config.pythonBin)}. `
      + 'Install Python with pandas, or set pythonBin on this row.',
      { cause },
    )
  }

  ctx.effect(() => ctx.tools.register(pandasTool(ctx, config)), 'pandas: run_pandas tool')

  if (config.registerSkill) {
    // `skills` is read optionally rather than declared in `inject`: a composition
    // without the skill registry still gets a working tool, and the tool's own
    // description carries the essential guidance.
    const skills = ctx.get('skills')
    if (skills === undefined) {
      ctx.logger.warn('pandas-analysis: no skill registry in this composition; '
        + 'the pandas-analysis skill is not available')
    } else {
      ctx.effect(() => skills.register(pandasSkill()), 'pandas: analysis skill')
    }
  }

  ctx.logger.info('pandas-analysis: %s runs pandas through %s', config.toolName, executable)
}
