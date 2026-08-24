/**
 * The OS confinement wrapper for one user's backend.
 *
 * Everything else in this plugin arranges data separation; this file is what
 * makes it a boundary rather than a convention. Without it, a user could simply
 * ask their agent to read another user's directory and the agent would comply:
 * the harness's own sandbox is a *write* fence whose reads are unrestricted by
 * design (`packages/sandbox/sandbox-local/src/profiles.ts` grants
 * `readOnly: ['/']`), and whose root is the client-supplied session cwd.
 *
 * Wrapping the whole backend process instead of trusting that inner fence has a
 * second effect worth knowing: a bubblewrap namespace is inherited and cannot be
 * dropped by the process inside it, so a user escalating their session to
 * `danger-full-access` — which the UI allows, with no operator ceiling — still
 * cannot leave their directory.
 */

import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { dirname } from 'node:path'

/**
 * Where one user's confined backend lives on disk.
 *
 * The layout separates what the USER sees from what the PLATFORM keeps. The
 * first version of this pointed `HOME` at the user's root, which made the
 * workspace picker open onto the harness's own plumbing — sessions, settings,
 * credentials, a backend log — instead of onto somewhere blank to put work. So
 * `workspace` is `HOME` and the process cwd, and everything else lives in a
 * sibling `.state` the picker does not show by default.
 */
export interface UserPaths {
  /** The user's root: the only writable tree inside the jail. */
  readonly root: string
  /** `HOME` and the process cwd. Starts empty; the user creates folders here. */
  readonly workspace: string
  /** Platform state, beside `workspace` rather than inside it. */
  readonly state: string
  /** `$DSH_HOME`: sessions, settings, credentials, presets, profiles. */
  readonly home: string
  /** `$TMPDIR`, so the sandbox's writable temp root is per user, not shared. */
  readonly tmp: string
  /** `$DSH_AGENTS_HOME`, which is otherwise `~/.agents` and shared. */
  readonly agents: string
}

/** What the wrapper needs to know about the installation. */
export interface HarnessPaths {
  /** The checkout or install root, mounted read-only. */
  readonly harnessRoot: string
  /** The built CLI entry, run by plain node — no tsx inside the jail. */
  readonly cliEntry: string
  /** The Node installation directory, mounted read-only. */
  readonly nodeRoot: string
  /** The node binary to exec. */
  readonly nodeBin: string
}

/** System trees a Node process needs to read; absent ones are skipped. */
const SYSTEM_READ_ONLY: readonly string[] = [
  '/usr', '/bin', '/sbin', '/lib', '/lib32', '/lib64', '/etc',
]

/**
 * Resolve the installation paths from the running gateway.
 *
 * The backend deliberately runs the **built** `lib/bin.js` rather than the tsx
 * source launch: tsx resolves workspace paths against the process cwd, which
 * inside the jail is the user's workspace and has no `node_modules`, so the
 * source launch fails on the first workspace import. Built artifacts also boot
 * faster and are the shape a deployment actually ships.
 *
 * @param harnessRoot - the checkout root.
 * @returns the resolved paths.
 * @throws when the CLI has not been built.
 */
export function resolveHarnessPaths(harnessRoot: string): HarnessPaths {
  const cliEntry = `${harnessRoot}/apps/cli/lib/bin.js`
  if (!existsSync(cliEntry)) {
    throw new Error(
      `compliance-tenancy: ${cliEntry} is missing, so no backend can start. `
      + 'Run `pnpm run build` — backends run built artifacts, not the tsx source launch.',
    )
  }
  const nodeBin = process.execPath
  return { harnessRoot, cliEntry, nodeRoot: dirname(dirname(nodeBin)), nodeBin }
}

/** How the backend process should be confined. */
export type Confinement = 'bwrap' | 'none'

/** One backend's launch specification. */
export interface LaunchSpec {
  readonly command: string
  readonly args: readonly string[]
  readonly env: Record<string, string>
  readonly cwd: string
}

/** Environment the backend gets, and nothing else. */
function backendEnv(
  paths: UserPaths,
  harness: HarnessPaths,
  extra: Readonly<Record<string, string>>,
): Record<string, string> {
  return {
    PATH: `${harness.nodeRoot}/bin:/usr/bin:/bin`,
    // HOME is the workspace area, not the user's root: it is what the browse
    // picker lists by default, so it must be the blank place work goes rather
    // than the directory holding the harness's own state.
    HOME: paths.workspace,
    DSH_HOME: paths.home,
    TMPDIR: paths.tmp,
    DSH_AGENTS_HOME: paths.agents,
    // The inner sandbox stays on as a second layer. It is redundant against the
    // outer namespace for path confinement, but it is what makes the harness's
    // own approval and escalation flow behave as the UI describes.
    DSH_PERMISSION_MODE: 'workspace-write',
    ...extra,
  }
}

/**
 * Build the launch specification for one user's backend.
 *
 * @param paths - the user's directories.
 * @param harness - the installation paths.
 * @param options - port, confinement mode, extra environment, extra `--patch` overlays.
 * @returns the command, arguments, environment and cwd to spawn.
 */
export function launchSpec(
  paths: UserPaths,
  harness: HarnessPaths,
  options: {
    readonly port: number
    readonly confinement: Confinement
    readonly env: Readonly<Record<string, string>>
    readonly patches: readonly string[]
  },
): LaunchSpec {
  const env = backendEnv(paths, harness, options.env)
  const dshArgs = [
    harness.cliEntry,
    '--profile', 'web',
    ...options.patches.flatMap(patch => ['--patch', patch]),
    '--port', String(options.port),
    '--no-open',
  ]

  if (options.confinement === 'none') {
    return { command: harness.nodeBin, args: dshArgs, env, cwd: paths.workspace }
  }

  const args: string[] = []
  for (const tree of SYSTEM_READ_ONLY) {
    // A bind of a missing path makes bwrap fail outright, and the set of system
    // trees differs between distributions, so presence is checked rather than
    // assumed.
    if (existsSync(tree)) args.push('--ro-bind', tree, tree)
  }
  args.push(
    '--ro-bind', harness.nodeRoot, harness.nodeRoot,
    '--ro-bind', harness.harnessRoot, harness.harnessRoot,
    // The one writable tree. Everything the user's harness owns lives here.
    '--bind', paths.root, paths.root,
    // A private /tmp: the harness's own sandbox grants write to `/tmp` and
    // `os.tmpdir()` under workspace-write, which would otherwise be a shared
    // channel between users.
    '--tmpfs', '/tmp',
    '--proc', '/proc',
    '--dev', '/dev',
    '--unshare-pid', '--unshare-ipc', '--unshare-uts',
    // Network is deliberately NOT unshared: the backend must reach the model
    // provider. Egress is therefore unconfined — see the README's threat model.
    '--die-with-parent',
    '--chdir', paths.workspace,
    '--',
    harness.nodeBin, ...dshArgs,
  )
  return { command: 'bwrap', args, env, cwd: paths.workspace }
}

/**
 * Prove the configured confinement actually works, before any user logs in.
 *
 * A functional probe rather than a version check: bubblewrap can be installed
 * and still be unable to create a user namespace — a hardened kernel, a
 * container without the capability, `kernel.unprivileged_userns_clone=0`. Left
 * unprobed, that fails once per login instead of once at boot, and every failure
 * looks like a broken backend rather than a misconfigured host.
 *
 * @param confinement - the configured mode.
 * @returns a human-readable problem, or undefined when usable.
 */
export function confinementProblem(confinement: Confinement): string | undefined {
  if (confinement === 'none') return undefined
  // The probe binds the same system trees a backend gets and runs the exec'd
  // binary from inside them, because binding less than the command needs makes
  // bwrap exit 1 and look exactly like an unavailable namespace.
  const binds = SYSTEM_READ_ONLY.filter(tree => existsSync(tree))
    .flatMap(tree => ['--ro-bind', tree, tree])
  const probe = spawnSync('bwrap', [
    ...binds,
    '--proc', '/proc', '--dev', '/dev', '--unshare-pid',
    '--', '/usr/bin/env', 'true',
  ], { timeout: 10_000, stdio: 'ignore' })
  if (probe.error !== undefined) {
    const code = (probe.error as NodeJS.ErrnoException).code
    return code === 'ENOENT'
      ? 'bwrap is not installed (try: sudo apt install bubblewrap)'
      : `bwrap could not be run: ${probe.error.message}`
  }
  if (probe.status !== 0) {
    return `bwrap exited ${String(probe.status)} on a trivial sandbox; `
      + 'unprivileged user namespaces are probably unavailable on this host'
  }
  return undefined
}
