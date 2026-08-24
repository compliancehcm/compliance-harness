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

/** A backend that is up and answering. */
export interface RunningBackend {
  readonly port: number
  readonly pid: number
  /** When it last served a request; the reaper reads this. */
  lastUsedAt: number
  /** Live upgraded connections, which must keep a backend from being reaped. */
  liveSockets: number
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

  let exit: string | undefined
  child.on('exit', (code, signal) => {
    exit = `exit code ${String(code)}${signal === null ? '' : ` (signal ${signal})`}`
  })
  child.on('error', (error) => { exit = error.message })

  const pid = child.pid
  if (pid === undefined) throw new BackendStartError('the backend could not be spawned', exit)

  try {
    await waitUntilServing(port, () => exit)
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
