/**
 * The host surface this plugin depends on, declared structurally.
 *
 * `@deepseek-ai/cordis` is not resolvable from a `plugins/` package under pnpm's
 * strict layout, so importing its `Context` type is not an option. Declaring
 * exactly the members used here is not a workaround but a narrower contract: it
 * states the plugin's whole dependency on the harness in one readable place, and
 * a harness change that breaks it shows up as a type error against this file
 * rather than as a runtime surprise.
 */

/** The webserver service (`ctx.webServer`), of which only the bound port is read. */
export interface WebServerFacade {
  /** The listening port, including the port the OS assigned when configured with 0. */
  readonly port: number
}

/** The Web invocation service (`ctx.webStartup`) published by the web-startup row. */
export interface WebStartupFacade {
  readonly host?: string
  readonly port?: number
}

/** The credential service (`ctx.credentials`), used to resolve a secret by reference. */
export interface CredentialsFacade {
  resolve: (ref: string) => Promise<{ readonly value: string } | undefined>
}

/** The subset of the Cordis plugin context this plugin uses. */
export interface HostContext {
  /** The webserver whose port the proxy forwards to. Required. */
  readonly webServer: WebServerFacade
  /**
   * Register a disposer-returning effect. Every resource this plugin owns —
   * the listener, the sweep timer — is registered here so unload releases it.
   */
  effect: (setup: () => (() => void) | Promise<() => void>, label?: string) => unknown
  /** Read an optional service without asserting its presence. */
  get: <T>(name: string) => T | undefined
  /**
   * Fiber-named logger. Each method takes a format string with arguments, or a
   * single `Error` — the facade unwraps `cause` and aggregate members itself
   * (`vendor/cordis/src/logger.ts:141-150`), so errors are passed whole.
   */
  readonly logger: {
    info: (...args: unknown[]) => void
    warn: (...args: unknown[]) => void
    error: (...args: unknown[]) => void
  }
}
