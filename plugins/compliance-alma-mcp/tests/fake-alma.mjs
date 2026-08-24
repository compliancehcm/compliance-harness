// A stand-in for ALMA's MCP endpoint: an OAuth-protected resource with the same
// advertised shape the real one has (DCR + PKCE S256, authorization_code and
// refresh_token, no machine grant), plus a Streamable HTTP MCP endpoint that
// refuses anything but a live bearer.
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'

export async function startFakeAlma(options = {}) {
  const state = {
    clients: new Map(),
    codes: new Map(),
    tokens: new Map(),
    refreshTokens: new Map(),
    issued: 0,
    refreshes: 0,
    accessTokenTtlSeconds: options.accessTokenTtlSeconds ?? 3600,
    rejectNextBearer: false,
    toolCalls: 0,
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const json = (status, body, headers = {}) => {
      const payload = JSON.stringify(body)
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(payload)
    }
    const readBody = async () => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      return Buffer.concat(chunks).toString('utf8')
    }
    const origin = `http://127.0.0.1:${server.address().port}`

    if (url.pathname === '/.well-known/oauth-protected-resource/mcp') {
      return json(200, {
        resource: `${origin}/mcp`,
        authorization_servers: [`${origin}/`],
        scopes_supported: ['openid', 'profile'],
        bearer_methods_supported: ['header'],
      })
    }
    if (url.pathname === '/.well-known/oauth-authorization-server') {
      return json(200, {
        issuer: `${origin}/`,
        authorization_endpoint: `${origin}/authorize`,
        token_endpoint: `${origin}/token`,
        registration_endpoint: `${origin}/register`,
        scopes_supported: ['openid', 'profile'],
        response_types_supported: ['code'],
        grant_types_supported: ['authorization_code', 'refresh_token'],
        code_challenge_methods_supported: ['S256'],
      })
    }
    if (url.pathname === '/register' && req.method === 'POST') {
      const body = JSON.parse(await readBody())
      const clientId = `client-${String(state.clients.size + 1)}`
      state.clients.set(clientId, body)
      return json(201, { client_id: clientId, redirect_uris: body.redirect_uris })
    }
    if (url.pathname === '/authorize') {
      const clientId = url.searchParams.get('client_id')
      const redirect = url.searchParams.get('redirect_uri')
      const challenge = url.searchParams.get('code_challenge')
      const stateParam = url.searchParams.get('state')
      if (url.searchParams.get('code_challenge_method') !== 'S256') return json(400, { error: 'need S256' })
      if (url.searchParams.get('resource') !== `${origin}/mcp`) return json(400, { error: 'need resource' })
      const code = `code-${String(state.codes.size + 1)}`
      state.codes.set(code, { clientId, challenge, redirect })
      const location = new URL(redirect)
      location.searchParams.set('code', code)
      location.searchParams.set('state', stateParam)
      res.writeHead(302, { location: location.toString() })
      return res.end()
    }
    if (url.pathname === '/token' && req.method === 'POST') {
      const params = new URLSearchParams(await readBody())
      const grantType = params.get('grant_type')
      const mint = () => {
        state.issued += 1
        const access = `access-${String(state.issued)}`
        const refresh = `refresh-${String(state.issued)}`
        state.tokens.set(access, true)
        state.refreshTokens.set(refresh, true)
        return json(200, {
          access_token: access,
          refresh_token: refresh,
          token_type: 'Bearer',
          expires_in: state.accessTokenTtlSeconds,
          scope: 'openid profile',
        })
      }
      if (grantType === 'authorization_code') {
        const entry = state.codes.get(params.get('code'))
        if (entry === undefined) return json(400, { error: 'invalid_grant', error_description: 'unknown code' })
        state.codes.delete(params.get('code'))
        const verifier = params.get('code_verifier') ?? ''
        const digest = createHash('sha256').update(verifier).digest('base64')
          .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
        if (digest !== entry.challenge) return json(400, { error: 'invalid_grant', error_description: 'PKCE mismatch' })
        return mint()
      }
      if (grantType === 'refresh_token') {
        const refresh = params.get('refresh_token')
        if (!state.refreshTokens.has(refresh)) {
          return json(400, { error: 'invalid_grant', error_description: 'refresh token revoked' })
        }
        state.refreshTokens.delete(refresh)
        state.refreshes += 1
        return mint()
      }
      return json(400, { error: 'unsupported_grant_type' })
    }
    if (url.pathname === '/mcp') {
      const auth = req.headers['authorization'] ?? ''
      const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
      if (!state.tokens.has(token) || state.rejectNextBearer) {
        state.rejectNextBearer = false
        state.tokens.delete(token)
        return json(401, { error: 'invalid_token' }, {
          'www-authenticate': `Bearer resource_metadata="${origin}/.well-known/oauth-protected-resource/mcp"`,
        })
      }
      if (req.method === 'GET' || req.method === 'DELETE') {
        res.writeHead(405)
        return res.end()
      }
      const message = JSON.parse(await readBody())
      if (message.method === 'initialize') {
        return json(200, {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2025-06-18',
            capabilities: { tools: { listChanged: false } },
            serverInfo: { name: 'fake-alma', version: '0.0.1' },
          },
        }, { 'mcp-session-id': 'fake-session' })
      }
      if (message.method === 'notifications/initialized') {
        res.writeHead(202)
        return res.end()
      }
      if (message.method === 'tools/list') {
        return json(200, {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            tools: [{
              name: 'consultar_colaborador',
              description: 'Consulta um colaborador no Compliance HCM.',
              inputSchema: { type: 'object', properties: { nome: { type: 'string' } }, required: ['nome'] },
            }],
          },
        })
      }
      if (message.method === 'tools/call') {
        state.toolCalls += 1
        return json(200, {
          jsonrpc: '2.0',
          id: message.id,
          result: { content: [{ type: 'text', text: 'Ana Souza — analista de RH' }] },
        })
      }
      return json(200, { jsonrpc: '2.0', id: message.id ?? null, error: { code: -32601, message: 'no such method' } })
    }
    res.writeHead(404)
    res.end()
  })

  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  return {
    state,
    origin: `http://127.0.0.1:${port}`,
    mcpUrl: `http://127.0.0.1:${port}/mcp`,
    close: () => new Promise((resolve) => { server.close(resolve) }),
  }
}
