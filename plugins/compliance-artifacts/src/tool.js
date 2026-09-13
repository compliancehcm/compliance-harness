/**
 * `create_artifact` and `update_artifact`: an interactive page in, a receipt out.
 *
 * `@deepseek-ai/dsh-tools` is not resolvable from a `plugins/` package, so these
 * are raw registrations rather than `defineTool` ones: `parameters` is plain
 * JSON Schema and this module owns argument validation, which is the documented
 * contract for tools registered directly.
 *
 * **Why the receipt is in `presentationMeta` and not only in the arguments.**
 * The ECharts card reads `block.argsRaw`, which works because its whole subject
 * is in the arguments. Here the arguments hold the HTML, which is exactly what
 * must not be re-read, and there is a second reason: with backward pagination a
 * settled node's `call` is `null` when the window cut left the `tool/call`
 * outside it, so an args-only card silently degrades to the generic row and the
 * user loses the button that opens the page. `tool/result.meta` travels with the
 * result node itself, is never cropped, and — unlike the arguments — is NOT
 * model-visible, since `deriveMessages` projects only `data.message`.
 *
 * @module
 */
import { newArtifactId, readMeta, readVersion, requireId, writeVersion } from './store.js'

/**
 * The session the call belongs to.
 *
 * Artifacts are stored per session, so a call outside one has nowhere to write.
 * @param exec - the execution context.
 * @returns the session id.
 * @throws {Error} when there is no session.
 */
function sessionIdOf(exec) {
  const id = exec?.agent?.session?.id
  if (typeof id !== 'string' || id === '') {
    throw new Error('artifacts: this tool needs a session; it cannot run outside one')
  }
  return requireId(id, 'session id')
}

/**
 * Check one HTML document against the byte cap.
 * @param html - the candidate document.
 * @param config - the validated plugin configuration.
 * @param field - the argument name, for the message.
 * @returns the document unchanged.
 * @throws {Error} when it is absent, empty, or over the cap.
 */
function requireHtml(html, config, field) {
  if (typeof html !== 'string' || html.trim() === '') throw new Error(`${field} must be a non-empty string`)
  const bytes = Buffer.byteLength(html, 'utf8')
  if (bytes > config.maxHtmlBytes) {
    throw new Error(
      `${field} is ${String(bytes)} bytes; the limit is ${String(config.maxHtmlBytes)}. `
      + 'Split the page, or move bulk data out of it.',
    )
  }
  return html
}

/**
 * Check a title.
 * @param title - the candidate title.
 * @returns the trimmed title.
 * @throws {Error} when it is absent or too long.
 */
function requireTitle(title) {
  if (typeof title !== 'string' || title.trim() === '') throw new Error('title must be a non-empty string')
  const trimmed = title.trim()
  if (trimmed.length > 120) throw new Error(`title is ${String(trimmed.length)} characters; at most 120 are allowed`)
  return trimmed
}

/**
 * The URL the frame loads for one artifact's current version.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @returns an app-relative URL.
 */
function latestUrl(config, sessionId, artifactId) {
  return `${config.routePath}/${sessionId}/${artifactId}/latest`
}

/**
 * The receipt both tools return and persist.
 * @param config - the validated plugin configuration.
 * @param sessionId - the owning session.
 * @param artifactId - the artifact.
 * @param version - the version just written.
 * @param title - the artifact title.
 * @returns the canonical value.
 */
function receipt(config, sessionId, artifactId, version, title) {
  return {
    artifactId,
    sessionId,
    version,
    title,
    url: latestUrl(config, sessionId, artifactId),
  }
}

/** The output schema both tools share. */
function receiptSchema() {
  return {
    type: 'object',
    additionalProperties: false,
    properties: {
      artifactId: { type: 'string', description: 'Stable id; pass it to the update tool.' },
      sessionId: { type: 'string', description: 'Session the artifact belongs to.' },
      version: { type: 'integer', description: 'Version just written.' },
      title: { type: 'string', description: 'Artifact title.' },
      url: { type: 'string', description: 'Where the page is served.' },
    },
  }
}

/**
 * The card title, tolerant of anything the log may hold.
 *
 * Presenters run on live streaming AND on session-log replay, including over
 * arguments a rejected call kept verbatim, so they must not throw: a display
 * path that throws takes the replay down with it.
 * @param args - the logged arguments, of unknown shape.
 * @returns a title that is always a non-empty string.
 */
function safeTitle(args) {
  const title = typeof args === 'object' && args !== null ? args['title'] : undefined
  return typeof title === 'string' && title.trim() !== '' ? title.trim() : 'Artifact'
}

/**
 * Build the `create_artifact` definition.
 * @param ctx - the harness context, for logging.
 * @param config - the validated plugin configuration.
 * @returns the definition to hand to `ctx.tools.register`.
 */
export function createArtifactTool(ctx, config) {
  return {
    name: config.createToolName,
    description: 'Create an interactive HTML page shown to the user in a panel beside the conversation. '
      + 'Use it when the answer is something to explore rather than to read: a dashboard, a calculator, '
      + 'a comparison the user can filter, a diagram, a small tool. The page may load React, Tailwind and '
      + 'charting libraries from the allowed CDNs, and runs sandboxed with no access to the app around it. '
      + 'You never see the result, so it must be right the first time — load the `artifacts` skill before '
      + `the first one. To change a page you already made, call ${config.updateToolName} instead of creating a second.`,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Short title shown on the card and the panel tab.' },
        html: {
          type: 'string',
          description: 'The complete HTML document, starting at <!DOCTYPE html>. Inline your own CSS and JS; '
            + 'external libraries must come from the allowed CDNs.',
        },
      },
      required: ['title', 'html'],
      additionalProperties: false,
    },
    output: {
      schema: receiptSchema(),
      /**
       * Model-facing content: the receipt, never the page.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns one text block.
       */
      render(_args, value) {
        return [{
          type: 'text',
          text: `Artifact "${value.title}" is open beside the conversation (id ${value.artifactId}, `
            + `version ${String(value.version)}). The user can see it; describe what it does rather than `
            + `repeating its code, and call ${config.updateToolName} with this id to change it.`,
        }]
      },
      /**
       * Durable facts the card needs on replay.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns the replayable receipt.
       */
      presentationMeta(_args, value) {
        return { ...value }
      },
    },
    /**
     * Write version 1 of a new artifact.
     * @param args - the model-supplied arguments, already schema-checked.
     * @param exec - the execution context.
     * @returns the canonical value.
     * @throws {Error} when the arguments are invalid or the write fails.
     */
    async execute(args, exec) {
      const sessionId = sessionIdOf(exec)
      const title = requireTitle(args['title'])
      const html = requireHtml(args['html'], config, 'html')
      const artifactId = newArtifactId()
      const { version } = await writeVersion(config, sessionId, artifactId, html, title)
      ctx.logger.info('artifacts: created %s v%d (%s)', artifactId, version, title)
      return receipt(config, sessionId, artifactId, version, title)
    },
    /**
     * The pending card.
     * @param args - the logged arguments, of unknown shape.
     * @returns a generic render intent.
     */
    presentCall(args) {
      return { card: 'generic', title: safeTitle(args) }
    },
    /**
     * The settled card.
     * @param args - the logged arguments, of unknown shape.
     * @param result - the normalized outcome.
     * @returns a generic render intent.
     */
    presentResult(args, result) {
      return { card: 'generic', title: safeTitle(args), content: result.content }
    },
  }
}

/**
 * Apply one unique-substring replacement.
 * @param html - the current document.
 * @param oldStr - the text to replace.
 * @param newStr - the replacement.
 * @returns the new document.
 * @throws {Error} when the target is absent or not unique.
 */
export function applyPatch(html, oldStr, newStr) {
  const first = html.indexOf(oldStr)
  if (first === -1) {
    throw new Error('old_str does not appear in the current version; read the artifact again or send full html')
  }
  if (html.indexOf(oldStr, first + 1) !== -1) {
    // Replacing the first of several would silently edit the wrong place, and
    // the model cannot see the result to notice.
    throw new Error('old_str appears more than once; extend it with surrounding lines until it is unique')
  }
  return `${html.slice(0, first)}${newStr}${html.slice(first + oldStr.length)}`
}

/**
 * Build the `update_artifact` definition.
 * @param ctx - the harness context, for logging.
 * @param config - the validated plugin configuration.
 * @returns the definition to hand to `ctx.tools.register`.
 */
export function updateArtifactTool(ctx, config) {
  return {
    name: config.updateToolName,
    description: 'Change an artifact you already created, as a new version. Prefer old_str/new_str for a '
      + 'local change — a colour, a label, one function — because resending the whole page costs its bytes '
      + 'again and risks losing parts of it. Send `html` only for a rewrite. Earlier versions are kept.',
    parameters: {
      type: 'object',
      properties: {
        artifact_id: { type: 'string', description: 'The id the create call returned.' },
        old_str: {
          type: 'string',
          description: 'Exact text to replace in the current version. Must appear exactly once — include '
            + 'surrounding lines until it does.',
        },
        new_str: { type: 'string', description: 'Replacement for old_str. Empty string deletes it.' },
        html: { type: 'string', description: 'A complete replacement document. Use instead of old_str/new_str.' },
        title: { type: 'string', description: 'New title. Omit to keep the current one.' },
      },
      required: ['artifact_id'],
      additionalProperties: false,
    },
    output: {
      schema: receiptSchema(),
      /**
       * Model-facing content: the receipt, never the page.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns one text block.
       */
      render(_args, value) {
        return [{
          type: 'text',
          text: `Artifact "${value.title}" is now at version ${String(value.version)}; the panel shows it. `
            + 'Say what changed, not what the page contains.',
        }]
      },
      /**
       * Durable facts the card needs on replay.
       * @param _args - the validated arguments, unused.
       * @param value - the canonical value.
       * @returns the replayable receipt.
       */
      presentationMeta(_args, value) {
        return { ...value }
      },
    },
    /**
     * Write the next version of an existing artifact.
     * @param args - the model-supplied arguments, already schema-checked.
     * @param exec - the execution context.
     * @returns the canonical value.
     * @throws {Error} when the arguments are invalid or the artifact is unknown.
     */
    async execute(args, exec) {
      const sessionId = sessionIdOf(exec)
      const artifactId = requireId(args['artifact_id'], 'artifact id')

      const meta = await readMeta(config, sessionId, artifactId)
      if (meta === undefined) {
        throw new Error(`artifacts: no artifact ${artifactId} in this session; create one first`)
      }

      const hasPatch = args['old_str'] !== undefined
      const hasHtml = args['html'] !== undefined
      if (hasPatch && hasHtml) throw new Error('pass either old_str/new_str or html, not both')

      const title = args['title'] === undefined ? meta.title : requireTitle(args['title'])

      let html
      if (hasPatch) {
        if (typeof args['old_str'] !== 'string' || args['old_str'] === '') {
          throw new Error('old_str must be a non-empty string')
        }
        if (typeof args['new_str'] !== 'string') throw new Error('new_str must be a string when old_str is given')
        const current = await readVersion(config, sessionId, artifactId, meta.version)
        if (current === undefined) {
          throw new Error(`artifacts: version ${String(meta.version)} of ${artifactId} is missing from disk`)
        }
        html = requireHtml(applyPatch(current, args['old_str'], args['new_str']), config, 'the patched document')
      } else if (hasHtml) {
        html = requireHtml(args['html'], config, 'html')
      } else if (args['title'] === undefined) {
        throw new Error('nothing to change: pass old_str/new_str, html, or title')
      } else {
        // A title-only update still becomes a version, so the panel and the
        // history agree on what the page was called at each point.
        const current = await readVersion(config, sessionId, artifactId, meta.version)
        if (current === undefined) {
          throw new Error(`artifacts: version ${String(meta.version)} of ${artifactId} is missing from disk`)
        }
        html = current
      }

      const { version } = await writeVersion(config, sessionId, artifactId, html, title)
      ctx.logger.info('artifacts: updated %s to v%d', artifactId, version)
      return receipt(config, sessionId, artifactId, version, title)
    },
    /**
     * The pending card.
     * @param args - the logged arguments, of unknown shape.
     * @returns a generic render intent.
     */
    presentCall(args) {
      return { card: 'generic', title: safeTitle(args) }
    },
    /**
     * The settled card.
     * @param args - the logged arguments, of unknown shape.
     * @param result - the normalized outcome.
     * @returns a generic render intent.
     */
    presentResult(args, result) {
      return { card: 'generic', title: safeTitle(args), content: result.content }
    },
  }
}
