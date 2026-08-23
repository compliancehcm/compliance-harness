/**
 * The administrative fence over the harness RPC surface.
 *
 * This exists because the harness's own protection does not survive a proxy.
 * `PRIVILEGED_METHODS` (`packages/client/connection/src/index.ts:89-119`) keeps
 * `settings.*`, `credentials.*`, `llm.discoverModels` and the preset-authoring
 * methods loopback-only, and enforces it by re-running the host trust fence with
 * an empty trusted-host list. Our proxy forwards from `127.0.0.1`, so every
 * authenticated user passes that pin unconditionally. Without this file, letting
 * a user in at all hands them the whole configuration plane.
 *
 * Hiding the matching UI is not a substitute: omitting a client row removes the
 * button, not the endpoint. This is the fence; the UI is cosmetics.
 */

/** What the policy decided about one request. */
export type PolicyVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'refuse'; readonly reason: string }

/** Flat apiproxy methods (`POST /api/<method>`) reserved for administrators. */
const ADMIN_METHODS: ReadonlySet<string> = new Set([
  // The platform's provider credentials, in every direction.
  'credentials.describe', 'credentials.set', 'credentials.unset',
  // Provider inventory, and a host-side GET to a caller-chosen baseURL — which
  // is an SSRF probe as much as a model lister.
  'llm.providers', 'llm.discoverModels',
  // Hands `settings.yaml` to the platform's document opener.
  'settings.openDocument',
  // Agent presets carry the same trust as shell access, and `read`/`copy`/
  // `openDocument` expose or clone their composition.
  'agentPreset.read', 'agentPreset.copy', 'agentPreset.openDocument', 'agentPreset.remove',
  // Host filesystem outside the session flow. `listDirectory`/`createDirectory`
  // are not even covered by the harness's own pin.
  'host.pickDirectory', 'host.openPath', 'host.listDirectory', 'host.createDirectory',
])

/**
 * Typert Remote namespaces (`POST /api/<ns>/<method>`) reserved for
 * administrators, matched on the namespace so a new method cannot slip in.
 *
 * `dynamicCordisRunner` approves and evaluates dynamically defined plugin code —
 * the most dangerous namespace on the wire, and it ships in the web composition.
 */
const ADMIN_NAMESPACES: ReadonlySet<string> = new Set(['dynamicCordisRunner', 'pluginInventory'])

/**
 * Settings namespaces an ordinary user may read and write.
 *
 * `settings.*` cannot be refused wholesale: Appearance, Language and the
 * composer's Enter behaviour all persist through the same four methods. So the
 * decision is per namespace, and the namespace is in the request body.
 */
const USER_SETTINGS_NAMESPACES: ReadonlySet<string> = new Set([
  'ui-theme', 'locale', 'ui-conversation', 'ui-onboarding',
])

/** The four settings methods whose body names a namespace. */
const SETTINGS_METHODS: ReadonlySet<string> = new Set([
  'settings.describe', 'settings.update', 'settings.replace', 'settings.mutate',
])

/** Methods whose body must be inspected before the request can be judged. */
const BODY_INSPECTED: ReadonlySet<string> = new Set([...SETTINGS_METHODS, 'session.create'])

/** Largest body this policy will buffer; the inspected calls are all tiny. */
export const MAX_INSPECTED_BODY_BYTES = 256 * 1024

/** The `/api` prefix, matching the harness's own `API_PATH`. */
const API_PREFIX = '/api/'

/**
 * The method segment of an `/api` request, or undefined when the path is not an
 * RPC call (the event streams, `respond`, `session.export`, the frontend).
 */
export function apiMethodOf(pathname: string): string | undefined {
  if (!pathname.startsWith(API_PREFIX)) return undefined
  const rest = pathname.slice(API_PREFIX.length)
  if (rest === '' || rest === 'respond' || rest.startsWith('events.')) return undefined
  return rest
}

/**
 * Whether this request needs its body buffered before a verdict is possible.
 * Everything else is decided from the path alone and keeps streaming.
 * @param method - the `/api` method segment.
 * @returns whether the caller must supply the body.
 */
export function needsBodyToJudge(method: string | undefined): boolean {
  return method !== undefined && BODY_INSPECTED.has(method)
}

/** Read the `ns` a settings call addresses, from its JSON envelope. */
function settingsNamespaceOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = (body as { payload?: unknown }).payload
  const source = typeof payload === 'object' && payload !== null ? payload : body
  const ns = (source as { ns?: unknown; namespace?: unknown }).ns
    ?? (source as { namespace?: unknown }).namespace
  return typeof ns === 'string' ? ns : undefined
}

/** Read the `agentPreset` a session-create call names, if any. */
function requestedPresetOf(body: unknown): string | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = (body as { payload?: unknown }).payload
  const source = typeof payload === 'object' && payload !== null ? payload : body
  const preset = (source as { agentPreset?: unknown }).agentPreset
  return typeof preset === 'string' ? preset : undefined
}

/** What the policy knows about the caller. */
export interface PolicySubject {
  readonly admin: boolean
  /** Display name or subject, for the log line only. */
  readonly label: string
}

/**
 * Judge one request.
 *
 * @param pathname - the request pathname.
 * @param subject - the authenticated caller.
 * @param body - the parsed JSON body, when {@link needsBodyToJudge} asked for it.
 * @returns allow, or refuse with a reason worth logging.
 */
export function judge(
  pathname: string,
  subject: PolicySubject,
  body?: unknown,
): PolicyVerdict {
  if (subject.admin) return { kind: 'allow' }

  const method = apiMethodOf(pathname)
  if (method === undefined) return { kind: 'allow' }

  const slash = method.indexOf('/')
  if (slash !== -1) {
    const namespace = method.slice(0, slash)
    return ADMIN_NAMESPACES.has(namespace)
      ? { kind: 'refuse', reason: `${namespace} is administrator-only` }
      : { kind: 'allow' }
  }

  if (ADMIN_METHODS.has(method)) {
    return { kind: 'refuse', reason: `${method} is administrator-only` }
  }

  if (SETTINGS_METHODS.has(method)) {
    const ns = settingsNamespaceOf(body)
    if (ns === undefined) {
      // `settings.describe` legitimately carries no namespace: it answers for
      // every registered one at once. Refusing it would leave Appearance and
      // Language unable to read their own values, so it is allowed and the
      // reading of other namespaces' values is accepted — they are redacted of
      // secrets by the host before they are serialized.
      return method === 'settings.describe'
        ? { kind: 'allow' }
        : { kind: 'refuse', reason: `${method} named no settings namespace` }
    }
    return USER_SETTINGS_NAMESPACES.has(ns)
      ? { kind: 'allow' }
      : { kind: 'refuse', reason: `settings namespace ${ns} is administrator-only` }
  }

  if (method === 'session.create') {
    const preset = requestedPresetOf(body)
    // `session.create` carries an `agentPreset` field, which is the back door
    // around any gate on `agentPreset.select`: a preset is a different toolset
    // and carries shell-level trust.
    return preset === undefined
      ? { kind: 'allow' }
      : { kind: 'refuse', reason: `choosing agent preset ${preset} is administrator-only` }
  }

  return { kind: 'allow' }
}
