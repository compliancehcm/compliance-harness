/**
 * The `compliance-design-system` skill, contributed as an embedded runtime skill.
 *
 * Same shape as compliance-artifacts' own skill (`src/skill.js` there): the body
 * is the real `skills/compliance-design-system/SKILL.md`, read at apply, and the
 * frontmatter parser is strict single-line `key: value` because `yaml` is not
 * resolvable from a `plugins/` package.
 *
 * The resource base is the design-system folder itself, not the skill folder:
 * the skill body is the digest, and the model reads the design system's own
 * files (`components/**\/*.prompt.md`, `*.d.ts`, `readme.md`) by path when a
 * page needs more than the digest says.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const SKILL_FILE = fileURLToPath(new URL('../skills/compliance-design-system/SKILL.md', import.meta.url))
const RESOURCE_DIR = fileURLToPath(new URL('../design-system/', import.meta.url))

/** Keys this module reads out of the frontmatter; every other key is a rejection. */
const KNOWN_KEYS = new Set(['name', 'description', 'whenToUse'])

/**
 * Split a skill file into its frontmatter fields and its body.
 * @param text - the whole `SKILL.md`.
 * @returns the parsed fields and the body after the closing fence.
 * @throws {Error} when the frontmatter is missing or not understood.
 */
export function parseSkillFile(text) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/.exec(text)
  if (match === null) throw new Error('design-system skill: SKILL.md has no `---` frontmatter block')
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === '') continue
    const pair = /^([A-Za-z][A-Za-z0-9]*): (.+)$/.exec(line)
    if (pair === null) {
      throw new Error(`design-system skill: frontmatter line is not \`key: value\`: ${JSON.stringify(line)}`)
    }
    const [, key, value] = pair
    if (!KNOWN_KEYS.has(key)) throw new Error(`design-system skill: unexpected frontmatter key ${JSON.stringify(key)}`)
    if (key in fields) throw new Error(`design-system skill: duplicate frontmatter key ${JSON.stringify(key)}`)
    fields[key] = value.trim()
  }
  for (const required of ['name', 'description']) {
    if (fields[required] === undefined) throw new Error(`design-system skill: frontmatter is missing ${required}`)
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) {
    throw new Error(`design-system skill: name must be kebab-case, got ${JSON.stringify(fields.name)}`)
  }
  return { fields, body: match[2].trim() }
}

/**
 * Read the skill file and build the registration for `ctx.skills.register`.
 * @returns the runtime skill registration.
 * @throws {Error} when the skill file is missing or malformed.
 */
export function designSystemSkill() {
  let text
  try {
    text = readFileSync(SKILL_FILE, 'utf8')
  } catch (cause) {
    throw new Error(`compliance-brand: cannot read the skill body at ${SKILL_FILE}`, { cause })
  }
  const { fields, body } = parseSkillFile(text)
  if (body === '') throw new Error('design-system skill: SKILL.md has an empty body')
  return {
    name: fields.name,
    description: fields.description,
    ...fields.whenToUse === undefined ? {} : { whenToUse: fields.whenToUse },
    source: 'bundled',
    content: body,
    path: SKILL_FILE,
    resourceBase: { kind: 'directory', path: RESOURCE_DIR },
  }
}
