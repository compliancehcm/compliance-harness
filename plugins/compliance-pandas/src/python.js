/**
 * One JSON request in, one JSON envelope out, over a bundled Python script.
 *
 * `ctx.subprocess` rather than `ctx.shell`: the argv is fixed by this plugin —
 * the interpreter and a script that ships beside this file — so there is no
 * command line for a shell to interpret, and nothing the model supplies reaches
 * argv. The request travels on stdin as `{ data }`, which the seam writes and
 * closes for us, so no stream plumbing is needed here.
 *
 * The child speaks a strict envelope: exactly one JSON object on stdout,
 * `{ ok: true, ... }` or `{ ok: false, error }`. It exits 0 for BOTH, so a
 * non-zero exit means the interpreter itself failed — a missing module, a syntax
 * error in the shipped script, a kill — and is reported with stderr attached
 * rather than being confused with an analysis error the model can fix.
 *
 * This module is duplicated in `plugins/compliance-xlsx/`. Packages under
 * `plugins/` are copied one directory at a time by the tenancy plugin and are
 * not npm-linked to one another, so a shared helper package would have to be
 * installed and copied as a third unit for the two to import it by path.
 * Duplicating sixty lines is the cheaper trade at this size; extract it if a
 * third Python-backed plugin appears.
 *
 * @module
 */

/** Bytes of child stderr kept for diagnostics when the interpreter itself fails. */
const STDERR_MAX_BYTES = 8_192

/**
 * Raised when the interpreter could not produce an envelope at all.
 *
 * Distinct from an `ok: false` envelope, which is the analysis failing and is
 * reported to the model as a tool error it can act on.
 */
export class PythonRunnerError extends Error {
  /**
   * @param message - what failed, already prefixed with the plugin name.
   * @param options - standard error options, carrying `cause` when one exists.
   */
  constructor(message, options) {
    super(message, options)
    this.name = 'PythonRunnerError'
  }
}

/**
 * Run one bundled script and decode its envelope.
 * @param ctx - the harness context; `ctx.subprocess` must be present.
 * @param options - the interpreter, the script, the request, and the bounds.
 * @returns the decoded `ok: true` envelope, without the `ok` flag.
 * @throws {PythonRunnerError} when the interpreter fails, times out, or the envelope is unreadable.
 * @throws {Error} carrying the child's own message when the envelope reports `ok: false`.
 */
export async function runPython(ctx, options) {
  const { label, pythonBin, script, request, cwd, timeoutMs, graceMs, maxOutputBytes, signal } = options

  // One controller for both deadlines: the caller's abort and our own timeout.
  // The seam only reacts to the signal, so the timeout has to arrive as one.
  const controller = new AbortController()
  let timedOut = false
  const onOuterAbort = () => { controller.abort(signal?.reason) }
  signal?.addEventListener('abort', onOuterAbort, { once: true })
  const timer = setTimeout(() => {
    timedOut = true
    controller.abort(new Error(`${label}: timed out`))
  }, timeoutMs)

  try {
    const handle = ctx.subprocess.spawn({
      argv: [pythonBin, script],
      cwd,
      stdio: {
        stdin: { data: JSON.stringify(request) },
        stdout: { maxBytes: maxOutputBytes },
        stderr: { maxBytes: STDERR_MAX_BYTES },
      },
      graceMs,
      signal: controller.signal,
    })

    const outcome = await handle.done
    const stdout = handle.collected.stdout?.readFrom(0)
    const stderr = handle.collected.stderr?.readFrom(0)

    if (timedOut) {
      throw new PythonRunnerError(`${label}: python did not finish within ${String(timeoutMs)} ms`)
    }
    if (outcome.exitCode !== 0) {
      const how = outcome.signal === null ? `exit code ${String(outcome.exitCode)}` : `signal ${outcome.signal}`
      const detail = stderr?.text.trim() ?? ''
      throw new PythonRunnerError(
        `${label}: ${pythonBin} failed with ${how}${detail === '' ? '' : `\n${detail}`}`,
      )
    }
    if (stdout === undefined || stdout.text.trim() === '') {
      throw new PythonRunnerError(`${label}: ${pythonBin} produced no result envelope`)
    }
    // A lossy read means the envelope's head slid out of the in-memory window,
    // so what remains is a fragment that would fail to parse with a misleading
    // message. Name the real cause instead.
    if (stdout.lossy) {
      throw new PythonRunnerError(
        `${label}: the result exceeded maxOutputBytes (${String(maxOutputBytes)}); narrow the result or raise the limit`,
      )
    }

    let envelope
    try {
      envelope = JSON.parse(stdout.text)
    } catch (cause) {
      throw new PythonRunnerError(`${label}: the result envelope is not JSON`, { cause })
    }
    if (typeof envelope !== 'object' || envelope === null || Array.isArray(envelope)) {
      throw new PythonRunnerError(`${label}: the result envelope is not an object`)
    }
    if (envelope.ok !== true) {
      // The analysis itself failed. This is the model's to fix, so it travels as
      // an ordinary tool error carrying the child's own message.
      const message = typeof envelope.error === 'string' ? envelope.error : 'unknown error'
      throw new Error(`${label}: ${message}`)
    }
    const { ok: _ok, ...value } = envelope
    return value
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onOuterAbort)
  }
}
