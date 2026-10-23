/**
 * The `alma-hcm` skill, contributed as an embedded runtime skill.
 *
 * Same shape as compliance-artifacts' and compliance-brand's own skills: the
 * body is the real `skills/alma-hcm/SKILL.md`, read at apply, and the
 * frontmatter parser is strict single-line `key: value` because `yaml` is not
 * resolvable from a `plugins/` package.
 *
 * `SKILL.md` is ALMA's own guide, written by the system that manages the MCP
 * server, and is kept verbatim so a new version can be dropped in as is. What
 * only this harness knows — the tool-name prefix, that authorization is the SSO
 * login — is a short note prepended at registration instead of an edit to it.
 *
 * @module
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

/** The skill bundle directory, which is also the skill's resource base. */
const SKILL_DIR = fileURLToPath(new URL('../skills/alma-hcm/', import.meta.url))

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
  if (match === null) throw new Error('alma-hcm skill: SKILL.md has no `---` frontmatter block')
  const fields = {}
  for (const line of match[1].split(/\r?\n/)) {
    if (line.trim() === '') continue
    const pair = /^([A-Za-z][A-Za-z0-9]*): (.+)$/.exec(line)
    if (pair === null) {
      throw new Error(`alma-hcm skill: frontmatter line is not \`key: value\`: ${JSON.stringify(line)}`)
    }
    const [, key, value] = pair
    if (!KNOWN_KEYS.has(key)) throw new Error(`alma-hcm skill: unexpected frontmatter key ${JSON.stringify(key)}`)
    if (key in fields) throw new Error(`alma-hcm skill: duplicate frontmatter key ${JSON.stringify(key)}`)
    fields[key] = value.trim()
  }
  for (const required of ['name', 'description']) {
    if (fields[required] === undefined) throw new Error(`alma-hcm skill: frontmatter is missing ${required}`)
  }
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(fields.name)) {
    throw new Error(`alma-hcm skill: name must be kebab-case, got ${JSON.stringify(fields.name)}`)
  }
  return { fields, body: match[2].trim() }
}

/**
 * What the guide cannot know about this harness, in the guide's own language.
 * @param serverName - the row's `serverName`, which prefixes every tool name.
 * @returns the note, as Markdown.
 */
export function harnessNote(serverName) {
  const prefix = `mcp__${serverName}__`
  return [
    '> **Neste harness.** As tools deste guia aparecem com o prefixo `' + prefix + '`:',
    '> `get_empresas` é `' + prefix + 'get_empresas`, `get_holerite` é `' + prefix + 'get_holerite`, e assim por diante.',
    '> A autenticação é o próprio login SSO do usuário, enviado automaticamente — não há login separado da Alma.',
    '> Se uma tool responder que não há sessão SSO ou que o token foi invalidado (inclusive depois de',
    '> `alterar_gremp_id_padrao`), peça para o usuário sair e entrar de novo no Compliance AI.',
  ].join('\n')
}

/**
 * Read the skill file and build the registration for `ctx.skills.register`.
 * @param serverName - the row's `serverName`, for the harness note.
 * @returns the runtime skill registration.
 * @throws {Error} when the skill file is missing or malformed.
 */
export function almaSkill(serverName) {
  const path = `${SKILL_DIR}SKILL.md`
  let text
  try {
    text = readFileSync(path, 'utf8')
  } catch (cause) {
    throw new Error(`alma-mcp: cannot read the skill body at ${path}`, { cause })
  }
  const { fields, body } = parseSkillFile(text)
  if (body === '') throw new Error('alma-hcm skill: SKILL.md has an empty body')
  return {
    name: fields.name,
    description: fields.description,
    ...fields.whenToUse === undefined ? {} : { whenToUse: fields.whenToUse },
    source: 'bundled',
    content: `${harnessNote(serverName)}\n\n${body}`,
    path,
    resourceBase: { kind: 'directory', path: SKILL_DIR },
  }
}
