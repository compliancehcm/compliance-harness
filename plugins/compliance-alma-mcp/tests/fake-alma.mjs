// A stand-in for ALMA's MCP endpoint: a Streamable HTTP MCP server that accepts
// a bearer only while it is in `state.acceptedTokens` — the set of SSO access
// tokens the test's fake gateway has issued and not yet revoked.
import { createServer } from 'node:http'

export async function startFakeAlma() {
  const state = {
    acceptedTokens: new Set(),
    /** Every bearer presented, in order, for asserting what the relay sent. */
    presented: [],
    rejectNextBearer: false,
    toolCalls: 0,
  }

  const server = createServer(async (req, res) => {
    const url = new URL(req.url, `http://${req.headers.host}`)
    const json = (status, body, headers = {}) => {
      res.writeHead(status, { 'content-type': 'application/json', ...headers })
      res.end(JSON.stringify(body))
    }
    const readBody = async () => {
      const chunks = []
      for await (const chunk of req) chunks.push(chunk)
      return Buffer.concat(chunks).toString('utf8')
    }

    if (url.pathname !== '/mcp') {
      res.writeHead(404)
      return res.end()
    }
    const auth = req.headers['authorization'] ?? ''
    const token = auth.startsWith('Bearer ') ? auth.slice(7) : ''
    state.presented.push(token)
    if (!state.acceptedTokens.has(token) || state.rejectNextBearer) {
      state.rejectNextBearer = false
      return json(401, { error: 'invalid_token' }, { 'www-authenticate': 'Bearer error="invalid_token"' })
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
  })

  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })
  const port = server.address().port
  return {
    state,
    mcpUrl: `http://127.0.0.1:${port}/mcp`,
    close: () => new Promise((resolve) => { server.close(resolve) }),
  }
}
