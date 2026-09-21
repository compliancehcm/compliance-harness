/**
 * One user's backend process: start it, know when it is usable, stop it cleanly.
 */

import { spawn } from 'node:child_process'
import type { ChildProcess } from 'node:child_process'
import { createWriteStream } from 'node:fs'
import type { LaunchSpec } from './confine.ts'

/** How long to wait for a backend to answer before giving up on it. */
const READY_TIMEOUT_MS = 60_000

/** How often to poll a starting backend. */
const READY_POLL_MS = 250

/** How long a stopping backend gets before SIGKILL. */
const STOP_GRACE_MS = 5_000

/**
 * How long to wait for the backend to print its authenticated URL, once it is
 * already serving. The print follows the listen by microseconds; this only has
 * to be longer than the gap, not longer than a boot.
 */
const TOKEN_TIMEOUT_MS = 10_000

/**
 * The launch token in the URL `dsh web` prints
 * (`packages/bundle/web-app/src/index.ts`). It is minted per process and never
 * written anywhere else, so reading stdout is the only way to learn it.
 */
const TOKEN_PATTERN = /https?:\/\/\S*[?&]token=([A-Za-z0-9_-]+)/u

/** A backend that is up and answering. */
export interface RunningBackend {
  readonly port: number
  readonly pid: number
  /** When it last served a request; the reaper reads this. */
  lastUsedAt: number
  /** Live upgraded connections, which must keep a backend from being reaped. */
  liveSockets: number
  /**
   * The backend's own browser-session cookie, for the gateway to replay on
   * every proxied request. Undefined when the backend asked for none — a
   * composition without `client-connection`'s browser authentication.
   */
  readonly cookie?: string
  stop: () => Promise<void>
}

/** Why a backend could not be started. */
export class BackendStartError extends Error {
  constructor(message: string, readonly detail?: string) {
    super(detail === undefined ? message : `${message}: ${detail}`)
    this.name = 'BackendStartError'
  }
}

/** Poll the backend's own HTTP surface until it answers. */
async function waitUntilServing(port: number, exited: () => string | undefined): Promise<void> {
  const deadline = Date.now() + READY_TIMEOUT_MS
  for (;;) {
    const gone = exited()
    // Checking the child first turns "it crashed on boot" into its own error
    // rather than a 60-second timeout that says nothing about the cause.
    if (gone !== undefined) throw new BackendStartError('the backend exited during startup', gone)
    try {
      const response = await fetch(`http://127.0.0.1:${String(port)}/`, {
        signal: AbortSignal.timeout(2_000),
        redirect: 'manual',
      })
      // Any answer proves the listener is up; the status is the harness's
      // business, not a readiness signal.
      if (response.status > 0) return
    } catch {
      // Not listening yet. The deadline below is the only thing that gives up.
    }
    if (Date.now() > deadline) {
      throw new BackendStartError(`the backend did not answer on port ${String(port)} within 60s`)
    }
    await new Promise(resolve => setTimeout(resolve, READY_POLL_MS))
  }
}

/**
 * Watch a backend's stdout for the launch token in the URL it prints.
 *
 * The stream is teed rather than diverted: the log file must still receive
 * every byte, because it is the only diagnosis a failed boot leaves behind.
 * Only the head of the output is scanned — the token is printed once, at boot,
 * and holding a growing buffer for the life of a backend would be a leak.
 *
 * @param stdout - the child's stdout, or undefined when it has none.
 * @returns the token, or undefined when the output ends without one.
 */
function watchForToken(stdout: NodeJS.ReadableStream | null): Promise<string | undefined> {
  if (stdout === null) return Promise.resolve(undefined)
  return new Promise<string | undefined>((resolve) => {
    let head = ''
    let settled = false
    const finish = (token: string | undefined): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      stdout.off('data', onData)
      stdout.off('end', onEnd)
      resolve(token)
    }
    const onData = (chunk: Buffer | string): void => {
      head += typeof chunk === 'string' ? chunk : chunk.toString('utf8')
      const found = TOKEN_PATTERN.exec(head)
      if (found !== null) finish(found[1])
      // The token line is short and early; past this much output it is not
      // coming, and the buffer stops growing.
      else if (head.length > 64 * 1024) finish(undefined)
    }
    const onEnd = (): void => { finish(undefined) }
    const timer = setTimeout(() => { finish(undefined) }, TOKEN_TIMEOUT_MS)
    // The handle must not hold the gateway open on its own.
    timer.unref?.()
    stdout.on('data', onData)
    stdout.on('end', onEnd)
  })
}

/**
 * Trade the launch token for the backend's browser-session cookie.
 *
 * The gateway holds this cookie instead of the browser: `forwardHeaders`
 * rewrites Host to the backend's own loopback authority, and the cookie the
 * backend mints is bound to exactly that authority — so a cookie that reached
 * the browser would be signed for an audience the browser never talks to, and
 * would break the moment the backend came back on a different port.
 *
 * @param port - the backend's loopback port.
 * @param token - the launch token it printed.
 * @returns the `name=value` pairs to replay, joined for a Cookie header.
 * @throws {BackendStartError} when the backend does not answer with a cookie.
 */
async function mintSessionCookie(port: number, token: string): Promise<string> {
  const url = `http://127.0.0.1:${String(port)}/?token=${encodeURIComponent(token)}`
  let response: Response
  try {
    response = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
  } catch (error) {
    throw new BackendStartError('the backend refused its own launch token', String(error))
  }
  const cookies = response.headers.getSetCookie()
  if (cookies.length === 0) {
    throw new BackendStartError(
      'the backend answered its launch token without a session cookie',
      `status ${String(response.status)}`,
    )
  }
  // Only the crumb, never the attributes: this header travels gateway → backend
  // over loopback, where Path, Max-Age and SameSite mean nothing.
  return cookies.map(cookie => cookie.split(';', 1)[0].trim()).filter(pair => pair !== '').join('; ')
}

/**
 * Start one backend and wait until it serves.
 *
 * @param spec - the launch specification from `confine.ts`.
 * @param port - the port it was told to bind.
 * @param logPath - where its stdout and stderr are appended.
 * @returns the running backend.
 * @throws {BackendStartError} when it exits or never answers.
 */
export async function startBackend(
  spec: LaunchSpec,
  port: number,
  logPath: string,
): Promise<RunningBackend> {
  const child: ChildProcess = spawn(spec.command, [...spec.args], {
    cwd: spec.cwd,
    // The environment is replaced, not extended: the gateway's own environment
    // holds the platform's credentials and its DSH_* values, and inheriting
    // those would both leak them into the jail and point the backend at the
    // gateway's own harness home.
    env: spec.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: false,
  })

  // A backend's own output is the only diagnosis available when it fails to
  // boot, and it must not be interleaved into the gateway's stdout, which is a
  // protocol surface for the operator.
  const log = createWriteStream(logPath, { flags: 'a' })
  child.stdout?.pipe(log)
  child.stderr?.pipe(log)

  // Armed before the first byte can arrive: the URL is printed within
  // microseconds of the listen, which is well before `waitUntilServing`
  // returns, so a watcher attached afterwards would have missed it.
  const token = watchForToken(child.stdout)

  let exit: string | undefined
  child.on('exit', (code, signal) => {
    exit = `exit code ${String(code)}${signal === null ? '' : ` (signal ${signal})`}`
  })
  child.on('error', (error) => { exit = error.message })

  const pid = child.pid
  if (pid === undefined) throw new BackendStartError('the backend could not be spawned', exit)

  let cookie: string | undefined
  try {
    await waitUntilServing(port, () => exit)
    const launchToken = await token
    // No token means the backend asked for no browser authentication, which is
    // a composition without `client-connection` — not a failure. A token that
    // cannot be exchanged IS a failure: the gate would proxy every request into
    // an unconditional 401 and the user would see a wall with no cause on it.
    if (launchToken !== undefined) cookie = await mintSessionCookie(port, launchToken)
  } catch (error) {
    child.kill('SIGKILL')
    log.end()
    throw error
  }

  return {
    port,
    pid,
    lastUsedAt: Date.now(),
    liveSockets: 0,
    ...cookie !== undefined && { cookie },
    stop: () => stopChild(child, log),
  }
}

/** Stop a child, escalating to SIGKILL if it does not go. */
function stopChild(child: ChildProcess, log: ReturnType<typeof createWriteStream>): Promise<void> {
  return new Promise<void>((resolve) => {
    if (child.exitCode !== null || child.signalCode !== null) {
      log.end()
      resolve()
      return
    }
    const forced = setTimeout(() => { child.kill('SIGKILL') }, STOP_GRACE_MS)
    child.once('exit', () => {
      clearTimeout(forced)
      log.end()
      resolve()
    })
    child.kill('SIGTERM')
  })
}
