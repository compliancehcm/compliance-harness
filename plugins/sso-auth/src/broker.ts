/**
 * The token broker: how a user's own backend obtains that user's SSO access
 * token, so ALMA can be called as them without a second login.
 *
 * A backend cannot read the session it was started for — sessions live in this
 * process, and the backend is a separate, confined one. And pushing the token
 * along with each proxied request would not be enough: Keycloak access tokens
 * last minutes, while an agent run can go on long after the browser's last
 * request. So the backend pulls, at the moment it needs a token, and the gate
 * renews the session first when the token is close to expiry.
 *
 * The route lives on this process's own loopback webserver — the harness port
 * the proxy forwards to, which under tenancy is reached by nothing else. A
 * caller authenticates with the per-backend key the tenancy service minted when
 * it started that backend; the key names the user, so no caller can ask for
 * someone else's token by naming them.
 */

import type { IncomingMessage, ServerResponse } from 'node:http'
import type { BrokeredToken } from './gate.ts'

/** What the broker needs to know: whose backend is asking, and their token. */
export interface BrokerDeps {
  /** The subject whose backend holds this key, or undefined for an unknown key. */
  readonly identify: (key: string) => string | undefined
  /** The user's current access token, renewed when needed. */
  readonly accessTokenFor: (subject: string, options: { readonly force?: boolean }) => Promise<BrokeredToken | undefined>
  readonly logger: Pick<Console, 'info'>
}

/** Answer with a JSON body that must never be cached by anything in between. */
function sendJson(res: ServerResponse, status: number, value: unknown): void {
  const body = JSON.stringify(value)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': String(Buffer.byteLength(body)),
    'cache-control': 'no-store',
  })
  res.end(body)
}

/**
 * Create the broker's route handler.
 *
 * `POST <path>` with `Authorization: Bearer <backend key>` answers
 * `{ accessToken, expiresAt }`. `?force=1` renews even a token that looks fresh,
 * for a backend whose token the resource server has just refused.
 *
 * @param deps - the key lookup and the token source.
 * @returns the handler.
 */
export function createBroker(deps: BrokerDeps): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    // POST-only, so a token is never the answer to a request a browser can be
    // made to send by an <img> or a link.
    if (req.method !== 'POST') {
      res.writeHead(405, { allow: 'POST' })
      res.end()
      return
    }
    const header = req.headers.authorization ?? ''
    const key = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
    const subject = key === '' ? undefined : deps.identify(key)
    if (subject === undefined) {
      sendJson(res, 401, { error: 'unknown backend key' })
      return
    }
    const force = new URL(req.url ?? '/', 'http://broker.invalid').searchParams.get('force') === '1'
    const token = await deps.accessTokenFor(subject, { force })
    if (token === undefined) {
      // Logged out, idled out, past the absolute deadline, or refused renewal:
      // all of them mean the human has to sign in again, which the backend
      // reports to the model as an authorization failure.
      deps.logger.info(`sso-auth: no live session to broker a token for ${subject}`)
      sendJson(res, 401, { error: 'no live SSO session for this user; sign in again' })
      return
    }
    sendJson(res, 200, token)
  }
}
