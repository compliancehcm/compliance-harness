/**
 * The backend pool: one per user, bounded, reaped when idle.
 *
 * A Node backend costs a few hundred megabytes, so "one process per user" only
 * works with a ceiling and a reaper. Both are load-bearing rather than tidy: at
 * tens of concurrent users an unbounded pool is an out-of-memory kill of the
 * gateway, which takes every other user down with it.
 */

import type { RunningBackend } from './backend.ts'

/** A pool entry, which may still be starting. */
interface Entry {
  /** Resolves when the backend is serving; rejects if it never does. */
  readonly starting: Promise<RunningBackend>
  /** Set once `starting` resolves, so the reaper can read liveness cheaply. */
  running?: RunningBackend
}

/** What a caller gets when asking for a user's backend. */
export type Acquisition =
  | { readonly kind: 'ready'; readonly backend: RunningBackend }
  | { readonly kind: 'at-capacity'; readonly active: number; readonly max: number }
  | { readonly kind: 'failed'; readonly reason: string }

/** How the pool starts a backend for a user. */
export type Starter = (key: string, port: number) => Promise<RunningBackend>

/** Pool configuration. */
export interface PoolOptions {
  readonly portRange: readonly [number, number]
  readonly maxBackends: number
  readonly idleReapMs: number
  readonly starter: Starter
  readonly logger: Pick<Console, 'info' | 'warn'>
}

/** One backend per user key, with port allocation, a cap, and idle reaping. */
export class BackendPool {
  private readonly entries = new Map<string, Entry>()
  private readonly ports = new Map<string, number>()

  constructor(private readonly options: PoolOptions) {}

  /**
   * Get this user's backend, starting one if needed.
   *
   * Concurrent callers for the same user share one start: the first browser
   * request and the three that follow it milliseconds later must not each spawn
   * a harness.
   *
   * @param key - the user's stable key.
   * @returns the backend, or why it could not be had.
   */
  async acquire(key: string): Promise<Acquisition> {
    const existing = this.entries.get(key)
    if (existing !== undefined) {
      try {
        const backend = await existing.starting
        backend.lastUsedAt = Date.now()
        return { kind: 'ready', backend }
      } catch (error) {
        // A failed start is not cached: the next request should try again, since
        // the cause is usually transient (a port taken, a slow disk).
        this.entries.delete(key)
        this.releasePort(key)
        return { kind: 'failed', reason: String(error) }
      }
    }

    if (this.entries.size >= this.options.maxBackends) {
      return { kind: 'at-capacity', active: this.entries.size, max: this.options.maxBackends }
    }

    const port = this.allocatePort(key)
    if (port === undefined) {
      return { kind: 'failed', reason: 'no free port in the configured range' }
    }

    const entry: Entry = { starting: this.options.starter(key, port) }
    this.entries.set(key, entry)
    try {
      const backend = await entry.starting
      entry.running = backend
      this.options.logger.info(
        `compliance-tenancy: backend for ${key} ready on port ${String(port)} (pid ${String(backend.pid)})`,
      )
      return { kind: 'ready', backend }
    } catch (error) {
      this.entries.delete(key)
      this.releasePort(key)
      this.options.logger.warn(`compliance-tenancy: backend for ${key} failed to start: ${String(error)}`)
      return { kind: 'failed', reason: String(error) }
    }
  }

  /** Lowest free port in the range, or undefined when the range is exhausted. */
  private allocatePort(key: string): number | undefined {
    const [from, to] = this.options.portRange
    const taken = new Set(this.ports.values())
    for (let port = from; port <= to; port++) {
      if (!taken.has(port)) {
        this.ports.set(key, port)
        return port
      }
    }
    return undefined
  }

  private releasePort(key: string): void {
    this.ports.delete(key)
  }

  /**
   * Stop backends that have been idle too long.
   *
   * A backend holding a live upgraded connection is never idle, however long
   * ago its last request was: the browser is sitting on an open event stream and
   * reaping it would look like the application dying.
   *
   * @returns the keys reaped.
   */
  async reapIdle(): Promise<readonly string[]> {
    const now = Date.now()
    const reaped: string[] = []
    for (const [key, entry] of [...this.entries]) {
      const backend = entry.running
      if (backend === undefined) continue
      if (backend.liveSockets > 0) continue
      if (now - backend.lastUsedAt < this.options.idleReapMs) continue
      this.entries.delete(key)
      this.releasePort(key)
      await backend.stop()
      reaped.push(key)
    }
    if (reaped.length > 0) {
      this.options.logger.info(`compliance-tenancy: reaped idle backends: ${reaped.join(', ')}`)
    }
    return reaped
  }

  /** Stop everything, for gateway shutdown. */
  async stopAll(): Promise<void> {
    const entries = [...this.entries.values()]
    this.entries.clear()
    this.ports.clear()
    await Promise.all(entries.map(async (entry) => {
      try {
        const backend = entry.running ?? await entry.starting
        await backend.stop()
      } catch {
        // A backend that never started has nothing to stop, and a shutdown path
        // must not fail on it.
      }
    }))
  }

  /**
   * The running backend for a key, if it is up.
   *
   * Used by the socket tracker: a long-lived connection must mark its backend
   * live for as long as it is open, and the tracker holds only the key.
   */
  lookup(key: string): RunningBackend | undefined {
    return this.entries.get(key)?.running
  }

  /** How many backends exist right now, starting ones included. */
  get size(): number {
    return this.entries.size
  }
}
