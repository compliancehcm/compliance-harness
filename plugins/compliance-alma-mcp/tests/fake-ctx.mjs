// A stand-in for the slice of the Cordis context this plugin uses: a webserver
// with a real listener and the same route-matching rules, an in-memory
// credential store with the seam's record semantics, effect collection, and a
// ctx.plugin that records what would have been mounted.
import { createServer } from 'node:http'

export async function createFakeCtx() {
  const exact = new Map()
  const prefixes = new Map()
  const records = new Map()
  const effects = []
  const listeners = new Map()
  const mounted = []
  const logs = []
  let writeQueue = Promise.resolve()

  const match = (pathname) => {
    const hit = exact.get(pathname)
    if (hit !== undefined) return hit
    let best
    for (const [prefix, route] of prefixes) {
      if (pathname !== prefix && !pathname.startsWith(`${prefix}/`)) continue
      if (best === undefined || prefix.length > best.path.length) best = route
    }
    return best
  }

  const server = createServer((req, res) => {
    const route = match(new URL(req.url, 'http://x').pathname)
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
      info: (...args) => { logs.push(['info', args.join(' ')]) },
      warn: (...args) => { logs.push(['warn', args.map(String).join(' ')]) },
      error: (...args) => { logs.push(['error', args.map(String).join(' ')]) },
    },
    webServer: {
      port: server.address().port,
      register(route) {
        const table = route.kind === 'exact' ? exact : prefixes
        if (table.has(route.path)) throw new Error(`duplicate ${route.kind} route ${route.path}`)
        table.set(route.path, route)
        return () => { table.delete(route.path) }
      },
    },
    credentials: {
      async resolve(ref) {
        const value = process.env[ref]
        return value === undefined || value === '' ? undefined : { value, source: 'environment' }
      },
      async readRecord(key) { return records.get(key) },
      async deleteRecord(key) { records.delete(key) },
      async modifyRecord(key, mutate) {
        // Serialized, like the real store's cross-process exclusion.
        const run = writeQueue.then(async () => {
          const next = await mutate(records.get(key))
          if (next === undefined) return records.get(key)
          records.set(key, next)
          return next
        })
        writeQueue = run.then(() => undefined, () => undefined)
        return run
      },
      async listRecords() { return [...records.keys()].map(key => ({ key, kind: records.get(key).kind })) },
    },
    effect(callback, label) {
      const disposer = callback()
      effects.push({ label, disposer })
      return () => { disposer?.() }
    },
    on(event, listener) {
      const bucket = listeners.get(event) ?? []
      bucket.push(listener)
      listeners.set(event, bucket)
      return () => { listeners.set(event, bucket.filter(entry => entry !== listener)) }
    },
    plugin(plugin, config) {
      const entry = { plugin, config, disposed: false }
      mounted.push(entry)
      // A plain, NON-thenable fiber behind a thenable handle: resolving a
      // thenable that resolves to itself loops forever.
      const fiber = { dispose: async () => { entry.disposed = true } }
      return { ...fiber, then: (resolve) => { resolve(fiber) } }
    },
  }

  return {
    ctx,
    origin: `http://127.0.0.1:${server.address().port}`,
    records,
    mounted,
    logs,
    effects,
    emit(event, ...args) { for (const listener of listeners.get(event) ?? []) listener(...args) },
    async close() {
      for (const { disposer } of effects.reverse()) await disposer?.()
      await new Promise((resolve) => { server.close(resolve) })
    },
  }
}
