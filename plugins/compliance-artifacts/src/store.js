/**
 * Where an artifact's HTML lives, and how a version becomes the next one.
 *
 * On disk, not in the call arguments. `compliance-echarts` puts its whole option
 * inline and says so — the data "stays in the conversation for every later turn".
 * For a chart option that is a fair trade; for a page of tens of kilobytes WITH
 * a version history it is not, because every later request would re-send the
 * whole page. What travels in the arguments here is the receipt.
 *
 * Layout, one directory per artifact:
 *
 *   &lt;root&gt;/&lt;sessionId&gt;/&lt;artifactId&gt;/meta.json   title, current version, history
 *   &lt;root&gt;/&lt;sessionId&gt;/&lt;artifactId&gt;/v1.html
 *   &lt;root&gt;/&lt;sessionId&gt;/&lt;artifactId&gt;/v2.html     …
 *
 * Versions are immutable once written: an update adds a file, never rewrites
 * one, so a URL the user already opened keeps showing what they saw.
 *
 * @module
 */
import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { randomUUID } from 'node:crypto'

/**
 * Id grammar for both path segments.
 *
 * This is the path-traversal fence: both ids become directory names, and both
 * arrive from outside — the artifact id from the model, the session id from a
 * URL. Anything with a dot or a separator is refused rather than normalized,
 * because a normalizing fence has to be right about every encoding and a
 * rejecting one only has to be right about the grammar.
 */
const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/

/** Raised when a store operation cannot proceed. */
export class ArtifactStoreError extends Error {
  /**
   * @param message - what failed, already prefixed with the plugin name.
   */
  constructor(message) {
    super(message)
    this.name = 'ArtifactStoreError'
  }
}

/**
 * Check one id against the path grammar.
 * @param value - the candidate id.
 * @param label - what it is, for the message.
 * @returns the id unchanged.
 * @throws {ArtifactStoreError} when it is not a legal segment.
 */
export function requireId(value, label) {
  if (typeof value !== 'string' || !ID_PATTERN.test(value)) {
    throw new ArtifactStoreError(
      `artifacts: ${label} must be 1-64 characters of letters, digits, underscore or hyphen, got ${JSON.stringify(value)}`,
    )
  }
  return value
}

/**
 * Build a fresh artifact id.
 * @returns a new id, legal as a path segment.
 */
export function newArtifactId() {
  return randomUUID().replaceAll('-', '').slice(0, 16)
}

/**
 * The directory holding one artifact's versions.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @returns an absolute directory path.
 */
function artifactDir(config, sessionId, artifactId) {
  return join(config.root, requireId(sessionId, 'session id'), requireId(artifactId, 'artifact id'))
}

/**
 * Read one artifact's manifest.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @returns the manifest, or undefined when the artifact does not exist.
 * @throws {ArtifactStoreError} when an id is illegal or the manifest is unreadable.
 */
export async function readMeta(config, sessionId, artifactId) {
  const path = join(artifactDir(config, sessionId, artifactId), 'meta.json')
  let text
  try {
    text = await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new ArtifactStoreError(`artifacts: cannot read ${path}: ${error.message}`)
  }
  try {
    return JSON.parse(text)
  } catch (error) {
    throw new ArtifactStoreError(`artifacts: ${path} is not valid JSON: ${error.message}`)
  }
}

/**
 * Read one version's HTML.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @param version - the version number.
 * @returns the HTML, or undefined when that version does not exist.
 * @throws {ArtifactStoreError} when an id is illegal or the version is not a positive integer.
 */
export async function readVersion(config, sessionId, artifactId, version) {
  if (!Number.isInteger(version) || version <= 0) {
    throw new ArtifactStoreError(`artifacts: version must be a positive whole number, got ${JSON.stringify(version)}`)
  }
  const path = join(artifactDir(config, sessionId, artifactId), `v${String(version)}.html`)
  try {
    return await readFile(path, 'utf8')
  } catch (error) {
    if (error.code === 'ENOENT') return undefined
    throw new ArtifactStoreError(`artifacts: cannot read ${path}: ${error.message}`)
  }
}

/**
 * Write the next version of an artifact, creating it when it is new.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @param html - the complete document.
 * @param title - the artifact title.
 * @returns the written version number and the manifest.
 * @throws {ArtifactStoreError} when the version cap is reached or the write fails.
 */
export async function writeVersion(config, sessionId, artifactId, html, title) {
  const dir = artifactDir(config, sessionId, artifactId)
  const previous = await readMeta(config, sessionId, artifactId)
  const version = previous === undefined ? 1 : previous.version + 1

  if (version > config.maxVersions) {
    throw new ArtifactStoreError(
      `artifacts: ${artifactId} is at version ${String(previous.version)}, the configured maximum `
      + `(maxVersions: ${String(config.maxVersions)}). Create a new artifact instead of extending this one.`,
    )
  }

  await mkdir(dir, { recursive: true })
  // The version file first: a manifest naming a version whose file is missing
  // would serve a 404 from a link the model already reported as written.
  await writeFile(join(dir, `v${String(version)}.html`), html, 'utf8')

  const meta = {
    artifactId,
    sessionId,
    title,
    version,
    createdAt: previous?.createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    // Carried across an update on purpose: a new version is not a reason to
    // put an artifact the person archived back in their gallery. Unarchiving
    // is their action, not the model's.
    ...typeof previous?.archivedAt === 'string' && { archivedAt: previous.archivedAt },
    history: [...previous?.history ?? [], { version, title, at: new Date().toISOString(), bytes: Buffer.byteLength(html, 'utf8') }],
  }
  await writeFile(join(dir, 'meta.json'), `${JSON.stringify(meta, null, 2)}\n`, 'utf8')
  return { version, meta }
}

/**
 * List the artifacts of one session, newest first.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @returns the manifests, empty when the session has none.
 * @throws {ArtifactStoreError} when the session id is illegal.
 */
export async function listArtifacts(config, sessionId) {
  const dir = join(config.root, requireId(sessionId, 'session id'))
  let entries
  try {
    entries = await readdir(dir, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw new ArtifactStoreError(`artifacts: cannot list ${dir}: ${error.message}`)
  }
  const metas = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const meta = await readMeta(config, sessionId, entry.name)
    if (meta !== undefined) metas.push(meta)
  }
  return metas.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
}

/**
 * Every artifact in the store, newest first, across all sessions.
 *
 * The per-session listing above answers "what did THIS conversation produce";
 * this one answers "where did I put that dashboard", which is a question about
 * the person rather than about a session. Scoping is by store root and nothing
 * else: under tenancy `root` derives from the user's own `DSH_HOME` inside
 * their jail, so a user's store already contains exactly their artifacts.
 *
 * A directory that is not a legal id, or holds no readable manifest, is
 * skipped rather than failing the listing: one damaged artifact must not cost
 * the person the index of all the others.
 *
 * @param config - the validated plugin configuration.
 * @returns the manifests, newest updated first; empty when nothing was created.
 */
export async function listAllArtifacts(config) {
  let sessions
  try {
    sessions = await readdir(config.root, { withFileTypes: true })
  } catch (error) {
    if (error.code === 'ENOENT') return []
    throw new ArtifactStoreError(`artifacts: cannot list ${config.root}: ${error.message}`)
  }
  const metas = []
  for (const session of sessions) {
    if (!session.isDirectory() || !ID_PATTERN.test(session.name)) continue
    let entries
    try {
      entries = await readdir(join(config.root, session.name), { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || !ID_PATTERN.test(entry.name)) continue
      let meta
      try {
        meta = await readMeta(config, session.name, entry.name)
      } catch {
        continue
      }
      if (meta !== undefined) metas.push(meta)
    }
  }
  return metas.sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)))
}

/**
 * Archive an artifact, or bring it back.
 *
 * A flag in the manifest, never a deletion. The conversation that produced an
 * artifact carries a card pointing at it, so removing the files would turn a
 * settled turn's button into a 404 — a gallery tidy-up must not rewrite
 * history. Every version stays on disk and every URL keeps working; what
 * changes is whether the gallery lists it by default.
 *
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @param archived - true to archive, false to restore.
 * @returns the manifest after the write, or undefined when the artifact does not exist.
 * @throws {ArtifactStoreError} when an id is illegal or the write fails.
 */
export async function setArchived(config, sessionId, artifactId, archived) {
  const meta = await readMeta(config, sessionId, artifactId)
  if (meta === undefined) return undefined
  const next = { ...meta }
  if (archived) next.archivedAt = new Date().toISOString()
  else delete next.archivedAt
  const path = join(artifactDir(config, sessionId, artifactId), 'meta.json')
  try {
    await writeFile(path, `${JSON.stringify(next, null, 2)}\n`, 'utf8')
  } catch (error) {
    throw new ArtifactStoreError(`artifacts: cannot write ${path}: ${error.message}`)
  }
  return next
}
