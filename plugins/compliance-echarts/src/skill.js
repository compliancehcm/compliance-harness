/**
 * The charting skill, contributed as an embedded runtime skill.
 *
 * `ctx.skills.register` rather than a `dsh-skill-filesystem` row with a custom
 * root: the skill belongs to this plugin, so it should install and withdraw with
 * it, and one embedded registration needs neither a second provider name nor a
 * watcher over a directory that only ever changes when the plugin is upgraded.
 *
 * The body is the real `skills/echarts-charts/SKILL.md`, read at apply, so the
 * skill is edited as a Markdown file and not as a JavaScript string.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The skill bundle directory, which is also the skill's resource base. */
const SKILL_DIR = fileURLToPath(new URL('../skills/echarts-charts/', import.meta.url))

/** Keys this module reads out of the frontmatter; every other key is a rejection. */
const KNOWN_KEYS = new Set(['name', 'description', 'whenToUse'])

/**
 * Split a skill file into its frontmatter fields and its body.
 *
 * Deliberately a strict single-line-scalar parser rather than a YAML one: `yaml`
 * is not resolvable from a `plugins/` package, and the alternative to strictness
 * would be silently accepting a field the harness's own filesystem provider
 * would reject. Anything richer than `key: value` fails loud here, at load.
 * @param text - the whole `SKILL.md`.
 * @returns the parsed fields and the body after the closing fence.
 * @throws {Error} when the frontmatter is missing or not understood.
 */
function parseSkillFile(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error('echarts-charts skill: SKILL.md has no `---` frontmatter block')
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === '') continue
    const pair = /^([A-Za-z][A-Za-z0-9]*): (.+)$/.exec(line)
    if (pair === null) {
      throw new Error(`echarts-charts skill: frontmatter line is not \`key: value\`: ${JSON.stringify(line)}`)
    }
    const [, key, value] = pair
    if (!KNOWN_KEYS.has(key)) throw new Error(`echarts-charts skill: unexpected frontmatter key ${JSON.stringify(key)}`)
    if (key in fields) throw new Error(`echarts-charts skill: duplicate frontmatter key ${JSON.stringify(key)}`)
    fields[key] = value.trim()
  }
  for (const required of ['name', 'description']) {
    if (fields[required] === undefined) throw new Error(`echarts-charts skill: frontmatter is missing ${required}`)
  }
  // The registry's own grammar. Checked here so a typo names itself instead of
  // dropping the skill out of the catalog with a warning nobody reads.
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) {
    throw new Error(`echarts-charts skill: name must be kebab-case, got ${JSON.stringify(fields.name)}`)
  }
  return { fields, body: match[2].trim() }
}

/**
 * Read the skill file and build the registration for `ctx.skills.register`.
 *
 * `invocation` is omitted on purpose: the registry then permits both surfaces, so
 * the model can load the skill and a user can invoke it by name.
 * @returns the runtime skill registration.
 * @throws {Error} when the skill file is missing or malformed.
 */
export function chartSkill() {
  const path = `${SKILL_DIR}SKILL.md`
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (cause) {
    throw new Error(`echarts-charts: cannot read the skill body at ${path}`, { cause })
  }
  const { fields, body } = parseSkillFile(text)
  if (body === '') throw new Error('echarts-charts skill: SKILL.md has an empty body')
  return {
    name: fields.name,
    description: fields.description,
    ...fields.whenToUse === undefined ? {} : { whenToUse: fields.whenToUse },
    source: 'bundled',
    content: body,
    path,
    resourceBase: { kind: 'directory', path: SKILL_DIR },
  }
}
