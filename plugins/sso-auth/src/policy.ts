/**
 * The administrative fence over the harness RPC surface.
 *
 * Every unary Remote call is `POST /api/<namespace>/<method>` (the endpoint is
 * the path; the host refuses a body whose `method` disagrees with it — see
 * `endpointFromPath` and the `method !== endpoint` check in
 * `packages/client/connection/src/rpc-host.ts`). A backend treats every caller
 * this proxy forwards as its owner, so nothing on the harness side stops an
 * ordinary user from calling the configuration plane: this file is the fence,
 * and hiding the matching UI (`plugins/compliance-tenancy/role-user.overlay.yml`)
 * is cosmetics.
 *
 * Endpoint names here must be real ones. Until 2026-11 this file matched the
 * retired flat `credentials.set` form and so refused almost nothing; the smoke
 * `tests/policy.mjs` now checks every name below against upstream's endpoint
 * table, so a rename fails a test instead of silently opening the fence.
 *
 * Streams travel over the `/api/remote.mux` WebSocket, which this proxy does not
 * inspect. The stream methods an ordinary user's backend serves are read-only
 * `watch`/`follow`s, which is why that is acceptable. The one interactive stream,
 * `terminal/attach`, is kept out by composition instead: the user role disables
 * the terminal controller (`plugins/compliance-tenancy/role-user.overlay.yml`).
 * Any other mutating stream method would need a frame-level fence.
 */

/** What the policy decided about one request. */
export type PolicyVerdict =
  | { readonly kind: 'allow' }
  | { readonly kind: 'refuse'; readonly reason: string }

/**
 * Remote namespaces reserved for administrators, matched on the namespace so a
 * method added upstream cannot slip in.
 */
export const ADMIN_NAMESPACES: ReadonlySet<string> = new Set([
  // The platform's provider credentials, in every direction.
  'credentials',
  // Runtime plugin code, the plugin manager, its inventory and its sources:
  // installing packages and switching bundles in the backend's profile.
  'dynamicCordisRunner', 'pluginInventory', 'pluginManager', 'pluginMarket', 'pluginRegistryProbe',
  // Agent presets and permission presets carry shell-level trust; choosing one
  // is an administrative act.
  'agentPresets', 'permissionPresets',
  // A personal DeepSeek account would change whose billing a request uses
  // (`ctx.deepseekAuth`), and connector accounts are per-backend OAuth grants
  // that cannot complete behind this proxy anyway.
  'account', 'connectorAccounts',
  // Publishing a session to an outside relay, host computer use, and the
  // Claude Code bridge: none belongs to an ordinary user of this platform.
  'liveshareShares', 'cuaAccess', 'claudeCodeMods',
  // The interactive terminal. The user role also drops the host controller, so
  // its streams (`terminal/attach`, over the uninspected mux) do not exist there;
  // this refuses the unary half should a composition ever mount it again.
  'terminal',
])

/** Single endpoints reserved for administrators inside otherwise open namespaces. */
export const ADMIN_ENDPOINTS: ReadonlySet<string> = new Set([
  // A host-side GET to a caller-chosen baseURL — an SSRF probe as much as a
  // model lister — and the provider editor's inventory.
  'llm/discoverModels', 'llm/listConfigurableProviders',
  // Hands `settings.yaml` to the platform's document opener.
  'settings/openSettingsDocument',
  // A native dialog and a native opener on the host machine, outside any
  // confinement. `directoryPicker/list` and `createDirectory` stay open: the
  // in-browser workspace picker needs them, and the backend's namespace bounds
  // what they can see.
  'directoryPicker/pick', 'session/openWorkspacePath',
])

/**
 * Settings namespaces an ordinary user may write. They are row ids: Appearance
 * (`ui-theme`, which also holds the font choice), Language (`locale`) and the
 * composer (`ui-conversation`). Everything else — `shell`, `agent-loop`,
 * `mcp-client`, `llm-pi-ai`, … — is configuration and is refused.
 */
export const USER_SETTINGS_NAMESPACES: ReadonlySet<string> = new Set(['ui-theme', 'locale', 'ui-conversation'])

/** Settings writes whose first argument `ns` names the namespace written. */
export const SETTINGS_WRITES: ReadonlySet<string> = new Set(['settings/update', 'settings/replace', 'settings/mutate'])

/** `session/create`, whose `request.agentPreset` is a back door around `agentPresets`. */
export const SESSION_CREATE = 'session/create'

/** Endpoints whose body must be inspected before the request can be judged. */
const BODY_INSPECTED: ReadonlySet<string> = new Set([...SETTINGS_WRITES, SESSION_CREATE])

/** Largest body this policy will buffer; the inspected calls are all tiny. */
export const MAX_INSPECTED_BODY_BYTES = 256 * 1024

/** The `/api` prefix, matching the harness's own `API_PATH`. */
const API_PREFIX = '/api/'

/**
 * The `<namespace>/<method>` endpoint of an `/api` request, or undefined when the
 * path is not a unary Remote call (the stream WebSocket, exact Fetch routes such
 * as file reads, the frontend).
 * @param pathname - the request pathname, already normalized by WHATWG URL
 *   parsing exactly as the host normalizes it.
 * @returns the endpoint, or undefined.
 */
export function apiMethodOf(pathname: string): string | undefined {
  if (!pathname.startsWith(API_PREFIX)) return undefined
  const rest = pathname.slice(API_PREFIX.length)
  return rest === '' ? undefined : rest
}

/**
 * Whether this request needs its body buffered before a verdict is possible.
 * Everything else is decided from the path alone and keeps streaming.
 * @param method - the `/api` endpoint.
 * @returns whether the caller must supply the body.
 */
export function needsBodyToJudge(method: string | undefined): boolean {
  return method !== undefined && BODY_INSPECTED.has(method)
}

/** The named arguments of a Remote call envelope: `{ payload: { args } }`. */
function argsOf(body: unknown): Record<string, unknown> | undefined {
  if (typeof body !== 'object' || body === null) return undefined
  const payload = (body as { payload?: unknown }).payload
  if (typeof payload !== 'object' || payload === null) return undefined
  const args = (payload as { args?: unknown }).args
  return typeof args === 'object' && args !== null && !Array.isArray(args)
    ? args as Record<string, unknown>
    : undefined
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

  const endpoint = apiMethodOf(pathname)
  if (endpoint === undefined) return { kind: 'allow' }

  const namespace = endpoint.split('/', 1)[0]
  if (ADMIN_NAMESPACES.has(namespace)) {
    return { kind: 'refuse', reason: `${namespace} is administrator-only` }
  }
  if (ADMIN_ENDPOINTS.has(endpoint)) {
    return { kind: 'refuse', reason: `${endpoint} is administrator-only` }
  }

  if (SETTINGS_WRITES.has(endpoint)) {
    const ns = argsOf(body)?.['ns']
    if (typeof ns !== 'string') {
      return { kind: 'refuse', reason: `${endpoint} named no settings namespace` }
    }
    return USER_SETTINGS_NAMESPACES.has(ns)
      ? { kind: 'allow' }
      : { kind: 'refuse', reason: `settings namespace ${ns} is administrator-only` }
  }

  if (endpoint === SESSION_CREATE) {
    const request = argsOf(body)?.['request']
    const preset = typeof request === 'object' && request !== null
      ? (request as { agentPreset?: unknown }).agentPreset
      : undefined
    // A preset is a different toolset carrying shell-level trust.
    return preset === undefined
      ? { kind: 'allow' }
      : { kind: 'refuse', reason: `choosing agent preset ${String(preset)} is administrator-only` }
  }

  return { kind: 'allow' }
}
