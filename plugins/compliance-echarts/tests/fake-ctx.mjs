// A stand-in for the slice of the Cordis context this plugin uses: a webserver
// with a real listener and the same exact-route matching, tool and skill
// registries that record what was registered, effect collection, and the index
// injection table.
import { createServer } from 'node:http'
import { createRequire } from 'node:module'

// The REAL schema validator, not a stand-in. A registry that accepts any schema
// is what let `output: { type: ['string', 'null'] }` reach a boot and take the
// whole plugin tree down with it: the harness enforces a JSON Schema subset at
// `ctx.tools.register`, so a fake that skips it tests a contract the product
// does not have.
//
// Resolved through the CLI's dependency graph, the way these plugins resolve
// harness packages at runtime — `plugins/` is not a workspace member and has no
// node_modules of its own. That makes `pnpm run build` a precondition here.
const harnessRequire = createRequire(new URL('../../../apps/cli/package.json', import.meta.url))
const { assertSupportedJsonSchema } = harnessRequire('@deepseek-ai/dsh-tools')

/**
 * Build the fake context and start its listener.
 * @returns the ctx plus the handles a test needs to inspect it.
 */
export async function createFakeCtx() {
  const exact = new Map()
  const tools = new Map()
  const skills = new Map()
  const effects = []
  const listeners = new Map()
  const logs = []
  const services = new Map()

  const server = createServer((req, res) => {
    const route = exact.get(new URL(req.url, 'http://x').pathname)
    if (route === undefined) {
      res.writeHead(404)
      res.end()
      return
    }
    Promise.resolve(route.handler(req, res)).catch((error) => {
      logs.push(['error', String(error)])
      if (!res.headersSent) { res.writeHead(500); res.end() }
    })
  })
  await new Promise((resolve) => { server.listen(0, '127.0.0.1', resolve) })

  const ctx = {
    logger: {
      info: (...args) => { logs.push(['info', args.map(String).join(' ')]) },
      warn: (...args) => { logs.push(['warn', args.map(String).join(' ')]) },
      error: (...args) => { logs.push(['error', args.map(String).join(' ')]) },
    },
    webServer: {
      port: server.address().port,
      register(route) {
        if (route.kind !== 'exact') throw new Error(`fake-ctx serves only exact routes, got ${route.kind}`)
        exact.set(route.path, route)
        return () => { exact.delete(route.path) }
      },
    },
    tools: {
      register(definition) {
        if (tools.has(definition.name)) throw new Error(`duplicate tool ${definition.name}`)
        // What the harness itself does at this point, so a schema the product
        // would refuse fails in the smoke instead of at a user's boot.
        if (definition.output?.schema === undefined) {
          throw new TypeError(`tool "${definition.name}" must declare output { schema, render }`)
        }
        assertSupportedJsonSchema(definition.output.schema)
        tools.set(definition.name, definition)
        return () => { tools.delete(definition.name) }
      },
    },
    skills: {
      register(skill) {
        if (skills.has(skill.name)) throw new Error(`duplicate skill ${skill.name}`)
        skills.set(skill.name, skill)
        return () => { skills.delete(skill.name) }
      },
    },
    get(name) {
      if (name === 'skills') return ctx.skills
      return services.get(name)
    },
    effect(setup, label) {
      // The real ctx.effect runs the setup immediately and keeps the disposer;
      // so does this, so a registration that throws throws here.
      effects.push({ label, dispose: setup() })
    },
    on(event, listener) {
      const bucket = listeners.get(event) ?? []
      bucket.push(listener)
      listeners.set(event, bucket)
      return () => { listeners.set(event, bucket.filter(entry => entry !== listener)) }
    },
  }

  return {
    ctx,
    origin: `http://127.0.0.1:${String(server.address().port)}`,
    tools,
    skills,
    logs,
    effects,
    /** Run one event's listeners the way the host does. */
    emit(event, payload) {
      for (const listener of listeners.get(event) ?? []) listener(payload)
    },
    /** Dispose every effect, newest first, as fiber teardown would. */
    disposeAll() {
      for (const effect of [...effects].reverse()) effect.dispose?.()
      effects.length = 0
    },
    async close() {
      await new Promise((resolve) => { server.close(resolve) })
    },
  }
}
