// Refresh — or merely verify — the vendored Apache ECharts build.
//
// `plugins/` is not a pnpm workspace member, so this package cannot depend on
// `echarts` and let the installer place it. The dist file is committed instead,
// and this script is how it gets there, so that "which upstream bytes are these"
// has an answer that is not "someone downloaded it once".
//
//   node plugins/compliance-echarts/scripts/vendor-echarts.mjs          # verify
//   node plugins/compliance-echarts/scripts/vendor-echarts.mjs 6.1.0    # refresh
//
// Verify mode is the default because it is the one a check can run: it hashes the
// committed file and compares it with the sha256 recorded in vendor/README.md,
// touching neither the network nor the working tree.
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { copyFileSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const VENDOR_DIR = fileURLToPath(new URL('../vendor/', import.meta.url))
/** The three upstream files this package redistributes. */
const FILES = ['dist/echarts.min.js', 'LICENSE', 'NOTICE']

/** @returns the sha256 of the committed bundle, hex. */
function committedHash() {
  return createHash('sha256').update(readFileSync(join(VENDOR_DIR, 'echarts.min.js'))).digest('hex')
}

/**
 * The sha256 vendor/README.md claims for the committed bundle.
 * @returns the recorded hex digest.
 * @throws {Error} when the table row is missing, because an unrecorded vendored
 * file is exactly the state this script exists to prevent.
 */
function recordedHash() {
  const readme = readFileSync(join(VENDOR_DIR, 'README.md'), 'utf8')
  const match = /^\| sha256 \| `([0-9a-f]{64})` \|$/m.exec(readme)
  if (match === null) throw new Error('vendor/README.md has no `| sha256 | `<digest>` |` row')
  return match[1]
}

/**
 * Download one version through `npm pack` and copy its files into vendor/.
 * @param version - exact version to fetch, no range syntax.
 */
function refresh(version) {
  if (!/^\d+\.\d+\.\d+$/.test(version)) {
    throw new Error(`expected an exact version like 6.1.0, got ${JSON.stringify(version)}`)
  }
  const work = mkdtempSync(join(tmpdir(), 'vendor-echarts-'))
  try {
    execFileSync('npm', ['pack', `echarts@${version}`], { cwd: work, stdio: ['ignore', 'ignore', 'inherit'] })
    execFileSync('tar', ['-xzf', `echarts-${version}.tgz`], { cwd: work, stdio: ['ignore', 'ignore', 'inherit'] })
    for (const file of FILES) {
      copyFileSync(join(work, 'package', file), join(VENDOR_DIR, file.replace('dist/', '')))
    }
  } finally {
    rmSync(work, { recursive: true, force: true })
  }
  process.stdout.write(`vendored echarts ${version}\n  sha256 ${committedHash()}\n`
    + '  record it in vendor/README.md, ../README.md, and THIRD_PARTY_NOTICES.md\n')
}

const [version] = process.argv.slice(2)
if (version !== undefined) {
  refresh(version)
} else {
  const actual = committedHash()
  const expected = recordedHash()
  if (actual !== expected) {
    process.stderr.write(`vendored echarts.min.js does not match vendor/README.md\n  recorded ${expected}\n  actual   ${actual}\n`)
    process.exitCode = 1
  } else {
    process.stdout.write(`vendored echarts.min.js matches vendor/README.md (${actual})\n`)
  }
}
