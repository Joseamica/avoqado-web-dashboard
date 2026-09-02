import { execFileSync } from 'node:child_process'
import { dirname, resolve } from 'node:path'

/**
 * Locate the Server authority without assuming the Dashboard checkout itself is
 * the workspace root. An explicit release/worktree pairing always wins; normal
 * worktrees derive the canonical checkout from Git's common directory.
 */
export function resolveAvoqadoServerRoot(dashboardRoot, environment = process.env) {
  const explicit = environment.AVOQADO_SERVER_ROOT?.trim()
  if (explicit) return resolve(dashboardRoot, explicit)

  try {
    const commonDirectory = execFileSync('git', ['rev-parse', '--path-format=absolute', '--git-common-dir'], {
      cwd: dashboardRoot,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim()
    const dashboardCheckout = dirname(commonDirectory)
    return resolve(dirname(dashboardCheckout), 'avoqado-server')
  } catch {
    // Frozen CI snapshots may not contain Git metadata. Their caller can pair a
    // Server explicitly through AVOQADO_SERVER_ROOT; this is the legacy fallback.
    return resolve(dashboardRoot, '..', 'avoqado-server')
  }
}

export function parseMarkedServerJson(output, marker) {
  const markerIndex = output.lastIndexOf(marker)
  if (markerIndex < 0) throw new Error(`Server authority output is missing marker ${marker}`)
  const jsonLine = output
    .slice(markerIndex + marker.length)
    .split(/\r?\n/u, 1)[0]
    .trim()
  if (!jsonLine) throw new Error(`Server authority marker ${marker} has no JSON payload`)
  return JSON.parse(jsonLine)
}
