/**
 * The host surface this plugin depends on, declared structurally.
 *
 * `@deepseek-ai/cordis` is not resolvable from a `plugins/` package under pnpm's
 * strict layout, so its `Context` type cannot be imported. Declaring exactly the
 * members used keeps the whole dependency on the harness readable in one place.
 */

/** The credential service (`ctx.credentials`), used to resolve provider keys. */
export interface CredentialsFacade {
  resolve: (ref: string) => Promise<{ readonly value: string } | undefined>
}

/** The subset of the Cordis plugin context this plugin uses. */
export interface HostContext {
  /** Register a disposer-returning effect, so unload releases every backend. */
  effect: (setup: () => (() => void) | Promise<() => void>, label?: string) => unknown
  /** Publish a service for other plugins to inject. */
  provide: (name: string, value: unknown) => void
  /** Read an optional service without asserting its presence. */
  get: <T>(name: string) => T | undefined
  /** Fiber-named logger; format string with arguments, or a single `Error`. */
  readonly logger: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}
