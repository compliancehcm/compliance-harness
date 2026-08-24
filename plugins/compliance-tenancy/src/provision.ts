/**
 * One user's directories, created on first sight and never shared.
 *
 * Almost all of the data separation this plugin promises is a consequence of one
 * fact: nearly everything the harness keeps per user is already keyed to
 * `$DSH_HOME`, resolved from the environment before boot
 * (`packages/util/home-paths/src/index.ts`). Sessions and the sidebar list come
 * from `$DSH_HOME/sessions`, the workspace registry from
 * `$DSH_HOME/storages/workspace.json`, settings and theme from
 * `$DSH_HOME/settings.yaml`, and every writer lock is a sibling of the file it
 * guards. Give each user their own home and those separate themselves.
 *
 * Two things are NOT keyed to it and are set explicitly in `confine.ts`:
 * `~/.agents/skills` (shared unless `DSH_AGENTS_HOME` is set) and the temp roots
 * the sandbox makes writable (shared unless `TMPDIR` is).
 */

import { mkdirSync, readFileSync, readlinkSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname } from 'node:path'
import type { UserPaths } from './confine.ts'

/** Directory mode: owner-only, matching what the harness uses for its own state. */
const DIR_MODE = 0o700

/**
 * Turn an identity provider subject into a directory name.
 *
 * A `sub` is opaque and provider-chosen: Keycloak issues UUIDs, but other
 * issuers use emails or arbitrary strings, and any of those can carry `/`, `..`
 * or characters a filesystem refuses. Hashing sidesteps every one of those
 * without needing an escaping scheme to be right — and it keeps the directory
 * name from being personally identifying, which matters for a folder that will
 * sit on disk indefinitely.
 *
 * @param subject - the `sub` claim.
 * @returns a stable, filesystem-safe directory name.
 */
export function userDirName(subject: string): string {
  return createHash('sha256').update(subject).digest('hex').slice(0, 32)
}

/**
 * Create (idempotently) one user's directories.
 * @param usersRoot - the configured root holding every user's tree.
 * @param subject - the `sub` claim identifying the user.
 * @returns the resolved paths.
 */
export function provision(usersRoot: string, subject: string): UserPaths {
  const root = `${usersRoot}/${userDirName(subject)}`
  const state = `${root}/.state`
  const paths: UserPaths = {
    root,
    workspace: `${root}/workspace`,
    state,
    home: `${state}/harness`,
    tmp: `${state}/tmp`,
    agents: `${state}/agents`,
  }
  for (const dir of [root, paths.workspace, state, paths.home, paths.tmp, paths.agents]) {
    mkdirSync(dir, { recursive: true, mode: DIR_MODE })
  }
  writeIdentityNote(paths, subject)
  return paths
}

/**
 * Record which subject owns a directory whose name is a hash.
 *
 * Without this an operator looking at the users root sees only hex names and has
 * no way back to a person — for support, for a deletion request, or for reading
 * a log. It is written inside the user's own tree, so it is visible to that user
 * and to nobody else.
 */
function writeIdentityNote(paths: UserPaths, subject: string): void {
  writeFileSync(
    `${paths.state}/OWNER`,
    `subject: ${subject}\n`,
    { mode: 0o600 },
  )
}

/**
 * Link this deployment's own plugins into a user's profile.
 *
 * A backend resolves a row's package name from its own profile directory. The
 * launcher heals that directory itself — `healProfilesModuleFallback` walks the
 * CLI's dependency closure and symlinks each package — but our plugins are not
 * in that closure, so nothing links them and a row naming one fails to import.
 * Linking them here is the same mechanism applied to the same directory.
 *
 * The link targets live in the read-only harness mount, so a user can follow the
 * symlink to read plugin code and cannot modify it.
 *
 * @param paths - the user's directories.
 * @param pluginDirs - absolute directories of packages to link.
 */
export function linkPlugins(paths: UserPaths, pluginDirs: readonly string[]): void {
  if (pluginDirs.length === 0) return
  const modules = `${paths.home}/profiles/web/node_modules`
  for (const dir of pluginDirs) {
    let manifest: { name?: unknown }
    try {
      manifest = JSON.parse(readFileSync(`${dir}/package.json`, 'utf8')) as { name?: unknown }
    } catch (error) {
      throw new Error(`compliance-tenancy: cannot read ${dir}/package.json to link it`, { cause: error })
    }
    const name = manifest.name
    if (typeof name !== 'string' || name === '') {
      throw new Error(`compliance-tenancy: ${dir}/package.json has no name`)
    }
    const target = `${modules}/${name}`
    mkdirSync(dirname(target), { recursive: true, mode: DIR_MODE })
    try {
      symlinkSync(dir, target, 'dir')
    } catch (error) {
      // An existing link is the steady state: provisioning runs on every backend
      // start. Only a link pointing somewhere else is worth repairing.
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
      if (readlinkSync(target) !== dir) {
        rmSync(target, { recursive: true, force: true })
        symlinkSync(dir, target, 'dir')
      }
    }
  }
}

/**
 * Write the per-user harness patch layer.
 *
 * `$DSH_HOME/cordis.patch.yml` outranks the profile's own layer
 * (`apps/cli/reference/README.md`), which makes it the right place for values
 * that belong to this user's backend rather than to the shared profile. It is
 * rewritten on every provision so a changed gateway configuration reaches
 * existing users on their next backend start.
 *
 * @param paths - the user's directories.
 * @param rows - patch rows to write, already YAML-shaped.
 */
export function writeHomePatch(paths: UserPaths, rows: readonly string[]): void {
  const body = rows.length === 0
    ? '[]\n'
    : `# Written by compliance-tenancy on every backend start. Edits are lost.\n${rows.join('\n')}\n`
  writeFileSync(`${paths.home}/cordis.patch.yml`, body, { mode: 0o600 })
}
