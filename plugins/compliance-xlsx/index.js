/**
 * Formatted spreadsheets as deliverables, node half.
 *
 * Two contributions, one row:
 *
 *   src/tool.js   the `write_xlsx` tool — a declarative workbook in, a formatted
 *                 `.xlsx` on disk out. Its card carries the produced path as a
 *                 `location`, which is what puts the file in the Web
 *                 deliverables row instead of leaving the user to find it.
 *   src/skill.js  the `xlsx-workbook` skill, so the model picks the right column
 *                 type before writing a workbook it cannot see the result of.
 *
 * There is no client half: the generic card the tool's own presenters describe,
 * plus the deliverable chip, is the right presentation for a produced file.
 *
 * The interpreter is resolved at apply, not on first use: a deployment without
 * Python and openpyxl is a broken install, and it must say so at boot rather
 * than as a failed tool call at the end of a long piece of analysis.
 *
 * @module
 */
import { resolveConfig } from './src/config.js'
import { xlsxTool } from './src/tool.js'
import { xlsxSkill } from './src/skill.js'

export const name = 'xlsx-workbook'
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
      `xlsx-workbook: cannot resolve the Python interpreter ${JSON.stringify(config.pythonBin)}. `
      + 'Install Python with openpyxl, or set pythonBin on this row.',
      { cause },
    )
  }

  ctx.effect(() => ctx.tools.register(xlsxTool(ctx, config)), 'xlsx: write_xlsx tool')

  if (config.registerSkill) {
    // `skills` is read optionally rather than declared in `inject`: a composition
    // without the skill registry still gets a working tool, and the tool's own
    // description carries the essential guidance.
    const skills = ctx.get('skills')
    if (skills === undefined) {
      ctx.logger.warn('xlsx-workbook: no skill registry in this composition; '
        + 'the xlsx-workbook skill is not available')
    } else {
      ctx.effect(() => skills.register(xlsxSkill()), 'xlsx: workbook skill')
    }
  }

  ctx.logger.info('xlsx-workbook: %s writes workbooks through %s', config.toolName, executable)
}
