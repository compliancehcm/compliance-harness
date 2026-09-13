// A stand-in for the slice of the Cordis context this plugin uses: tool and
// skill registries that record what was registered, a subprocess seam that runs
// the real interpreter, effect collection, and a log.
//
// The subprocess half is real rather than mocked: it spawns the configured
// binary with the same argv, stdin and collect modes the harness seam documents,
// so the smoke exercises the actual runner script and the actual envelope. The
// stdin `{ data }` mode and the offset-based collected readers are reproduced
// because `src/python.js` depends on both.
import { spawn } from 'node:child_process'

/**
 * Build the fake context.
 * @param options - `pythonAvailable` false makes resolveExecutable reject.
 * @returns the ctx plus the handles a test needs to inspect it.
 */
export function createFakeCtx(options = {}) {
  const tools = new Map()
  const skills = new Map()
  const effects = []
  const logs = []
  const spawned = []

  const collector = (stream, maxBytes) => {
    let text = ''
    let dropped = 0
    stream?.setEncoding('utf8')
    stream?.on('data', (chunk) => {
      text += chunk
      if (text.length > maxBytes) {
        dropped += text.length - maxBytes
        text = text.slice(-maxBytes)
      }
    })
    return {
      readFrom(fromByte) {
        return { text, nextOffset: fromByte + text.length, lossy: dropped > 0 }
      },
    }
  }

  const ctx = {
    logger: {
      info: (...args) => { logs.push(['info', args.map(String).join(' ')]) },
      warn: (...args) => { logs.push(['warn', args.map(String).join(' ')]) },
      error: (...args) => { logs.push(['error', args.map(String).join(' ')]) },
    },
    subprocess: {
      async resolveExecutable(command) {
        if (options.pythonAvailable === false) throw new Error(`not found: ${command}`)
        return command
      },
      spawn(spec) {
        spawned.push(spec)
        const child = spawn(spec.argv[0], spec.argv.slice(1), { cwd: spec.cwd, stdio: ['pipe', 'pipe', 'pipe'] })
        const stdout = collector(child.stdout, spec.stdio.stdout.maxBytes)
        const stderr = collector(child.stderr, spec.stdio.stderr.maxBytes)
        if (typeof spec.stdio.stdin === 'object') {
          child.stdin.end(spec.stdio.stdin.data)
        } else {
          child.stdin.end()
        }
        const onAbort = () => { child.kill('SIGKILL') }
        spec.signal?.addEventListener('abort', onAbort, { once: true })
        const done = new Promise((resolve, reject) => {
          child.on('error', reject)
          child.on('close', (exitCode, signal) => {
            spec.signal?.removeEventListener('abort', onAbort)
            resolve({ exitCode, signal })
          })
        })
        return { collected: { stdout, stderr }, done, terminate: () => { child.kill() } }
      },
    },
    tools: {
      register(definition) {
        if (tools.has(definition.name)) throw new Error(`duplicate tool ${definition.name}`)
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
    get(serviceName) {
      if (serviceName === 'skills') return options.skillsAvailable === false ? undefined : ctx.skills
      return undefined
    },
    effect(setup, label) {
      // The real ctx.effect runs the setup immediately and keeps the disposer;
      // so does this, so a registration that throws throws here.
      effects.push({ label, dispose: setup() })
    },
  }

  return {
    ctx,
    tools,
    skills,
    logs,
    effects,
    spawned,
    /** Dispose every effect, newest first, as fiber teardown would. */
    disposeAll() {
      for (const effect of [...effects].reverse()) effect.dispose?.()
      effects.length = 0
    },
  }
}
