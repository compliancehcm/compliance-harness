// Every role's backend must leave its default agent preset usable.
//
// Since dsh 0.2.3 the agent's tools live inside an agent preset, and the preset
// registry refuses a preset whose child rows did not all activate
// (`agent-preset/invalid`). A role overlay that disables a row some preset tool
// injects therefore breaks every session of that role, old and new, with no
// error anywhere but a toast. That is how disabling `cordis-host-runner` (the
// provider of `cordisInspect`, which `tool-cordis` needs) took every ordinary
// user's sessions down in production.
//
// This boots the built CLI once per role with the overlays tenancy applies that
// change the composition (hardening + the role overlay), signs in with the
// printed launch token, and asks `agentPresets/list` for the default preset.
// It also checks which browser halves each role is served (CLIENT_ROWS).
//
// Needs a prior `pnpm run build` (backends run `apps/cli/lib/bin.js`).
// Run: node plugins/compliance-tenancy/tests/role-presets.mjs

import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')
const CLI = join(ROOT, 'apps/cli/lib/bin.js')
const HARDENING = join(ROOT, 'plugins/compliance-hardening.overlay.yml')
const ROLES = {
  user: join(ROOT, 'plugins/compliance-tenancy/role-user.overlay.yml'),
  admin: join(ROOT, 'plugins/compliance-tenancy/role-admin.overlay.yml'),
}
/**
 * Browser halves each role must (true) or must not (false) be served. These are
 * product decisions: ordinary users get no Trajectory tab, no "…" view menu, no
 * terminal and no Plugins page; administrators manage plugins from the UI.
 */
const CLIENT_ROWS = {
  user: {
    '@deepseek-ai/dsh-client-ui-trajectory': false,
    '@deepseek-ai/dsh-client-ui-entry-customization': false,
    '@deepseek-ai/dsh-client-ui-sidebar-terminal': false,
    '@deepseek-ai/dsh-client-ui-plugin-manager': false,
  },
  admin: {
    '@deepseek-ai/dsh-client-ui-plugin-manager': true,
  },
}
/**
 * Never served to anyone: the personal DeepSeek account launcher registers
 * `settings.launcher`, which replaces the whole sidebar footer row, so the
 * signed-in user's name (compliance-user-menu) turns into "··· Mais". A
 * personal account sign-in would also change whose billing requests use.
 */
for (const rows of Object.values(CLIENT_ROWS)) {
  rows['@deepseek-ai/dsh-client-ui-settings-account'] = false
  rows['@deepseek-ai/dsh-client-ui-account-notifications'] = false
}
const BOOT_TIMEOUT_MS = 90_000
/** Preset rows settle after boot; a row still pending after this is genuinely missing a service. */
const SETTLE_TIMEOUT_MS = 30_000

if (!existsSync(CLI)) {
  console.error(`role-presets: ${CLI} is missing; run \`pnpm run build\` first.`)
  process.exit(2)
}

/** Boot one backend and resolve its launch URL from stdout. */
function boot(role, home) {
  for (const dir of ['home', 'workspace', 'tmp', 'agents']) mkdirSync(join(home, dir), { recursive: true })
  const child = spawn(process.execPath, [
    CLI, '--profile', 'web', '--patch', HARDENING, '--patch', ROLES[role], '--port', '0', '--no-open',
  ], {
    cwd: join(home, 'workspace'),
    env: {
      PATH: process.env.PATH,
      HOME: join(home, 'workspace'),
      DSH_HOME: join(home, 'home'),
      TMPDIR: join(home, 'tmp'),
      DSH_AGENTS_HOME: join(home, 'agents'),
      DSH_PERMISSION_MODE: 'workspace-write',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let output = ''
  const url = new Promise((resolveUrl, reject) => {
    const timer = setTimeout(() => reject(new Error(`${role}: no launch URL within ${BOOT_TIMEOUT_MS} ms\n${output}`)), BOOT_TIMEOUT_MS)
    const onData = (chunk) => {
      output += chunk
      const match = /dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[\w-]+)/.exec(output)
      if (match !== null) { clearTimeout(timer); resolveUrl(new URL(match[1])) }
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', code => { clearTimeout(timer); reject(new Error(`${role}: backend exited (${code})\n${output}`)) })
  })
  return { child, url, output: () => output }
}

/** Exchange the launch token for the browser-session cookie. */
async function signIn(launch) {
  const res = await fetch(launch, { redirect: 'manual', headers: { accept: 'text/html' } })
  const cookie = res.headers.getSetCookie().map(c => c.split(';', 1)[0]).find(c => c.startsWith('dsh-auth-'))
  if (cookie === undefined) throw new Error(`sign-in returned ${res.status} without a dsh-auth cookie`)
  return cookie
}

/** Call one unary Remote endpoint the way the web client does. */
async function remote(origin, cookie, method, args = {}) {
  const res = await fetch(`${origin}/api/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: 'role-presets', method, payload: { args } }),
  })
  if (!res.ok) throw new Error(`${method}: HTTP ${res.status} ${await res.text()}`)
  const envelope = await res.json()
  if (envelope.result?.ok !== true) throw new Error(`${method}: ${JSON.stringify(envelope.result)}`)
  return envelope.result.value
}

/** The default preset once it has settled, or the last broken reading. */
async function defaultPreset(origin, cookie) {
  const deadline = Date.now() + SETTLE_TIMEOUT_MS
  let preset
  while (true) {
    const roster = await remote(origin, cookie, 'agentPresets/list')
    preset = roster.presets.find(p => p.isDefault)
    if (preset === undefined) throw new Error(`no default preset in ${JSON.stringify(roster)}`)
    if (preset.broken === undefined || Date.now() > deadline) return preset
    await new Promise(r => setTimeout(r, 500))
  }
}

let failed = false
for (const role of Object.keys(ROLES)) {
  const home = mkdtempSync(join(tmpdir(), `role-presets-${role}-`))
  const backend = boot(role, home)
  try {
    const launch = await backend.url
    const cookie = await signIn(launch)
    const preset = await defaultPreset(launch.origin, cookie)
    if (preset.broken === undefined) {
      console.log(`ok   ${role}: default preset ${preset.id} is usable`)
    } else {
      failed = true
      console.error(`FAIL ${role}: default preset ${preset.id} is broken: ${preset.broken}`)
    }
    // The served index carries the boot roster; a browser half appears there as
    // `<package>/client.js` in the plugin bundle URLs.
    const index = await (await fetch(new URL('/', launch), { headers: { cookie } })).text()
    for (const [pkg, wanted] of Object.entries(CLIENT_ROWS[role])) {
      const served = index.includes(`${pkg}/client`)
      if (served === wanted) {
        console.log(`ok   ${role}: ${pkg} ${wanted ? 'served' : 'not served'}`)
      } else {
        failed = true
        console.error(`FAIL ${role}: ${pkg} should ${wanted ? '' : 'not '}be served`)
      }
    }
  } catch (error) {
    failed = true
    console.error(`FAIL ${role}: ${error instanceof Error ? error.message : String(error)}`)
  } finally {
    backend.child.kill('SIGTERM')
    await new Promise(r => backend.child.once('exit', r).once('error', r))
    rmSync(home, { recursive: true, force: true })
  }
}
process.exit(failed ? 1 : 0)
