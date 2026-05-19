import { describe, it, expect } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PROVIDER_DEVICE_COMPATIBILITY as dashboardCatalog } from '../providerDeviceCompatibility'

/**
 * Pin sync between dashboard and backend canonical constant.
 *
 * Source of truth: avoqado-server/src/lib/providerDeviceCompatibility.ts
 * Mirror:          avoqado-web-dashboard/src/lib/providerDeviceCompatibility.ts
 *
 * Failure mode this catches: the dashboard form lets an admin pick a
 * provider+venue combo that the backend then rejects with HTTP 409
 * IncompatibleDeviceError (Task 10/11/12). The dashboard would 4xx silently
 * after the fact; this test catches the drift at PR time.
 *
 * The source path is resolved relative to this test file. If the
 * avoqado-server sibling repo is not present on the dev machine the test is
 * SKIPPED rather than failed — solo dashboard devs aren't blocked. CI runs
 * with both repos checked out side-by-side so the assertion actually fires.
 *
 * Spec ref: §3.1 point 4 (TPV runtime auto-filter mirrors this same map on
 * device via BuildConfig.SUPPORTED_PROCESSOR — different enum, same intent).
 */
describe('PROVIDER_DEVICE_COMPATIBILITY sync with avoqado-server', () => {
  it('matches backend definition (manual sync — update both when adding a provider)', () => {
    const backendPath = path.resolve(
      __dirname,
      '../../../../avoqado-server/src/lib/providerDeviceCompatibility.ts',
    )

    if (!fs.existsSync(backendPath)) {
       
      console.warn(
        `[sync test SKIPPED] avoqado-server sibling not found at ${backendPath}. ` +
          `Solo dashboard dev — test will run in CI with both repos checked out.`,
      )
      return
    }

    const source = fs.readFileSync(backendPath, 'utf-8')
    const match = source.match(
      /PROVIDER_DEVICE_COMPATIBILITY[^=]*=\s*({[\s\S]+?\n})/,
    )
    expect(
      match,
      'failed to locate PROVIDER_DEVICE_COMPATIBILITY in backend source — file shape changed?',
    ).not.toBeNull()

    // Sanitize the captured object literal so it parses as JSON:
    //   - strip comments
    //   - strip trailing commas
    //   - quote bare keys
    //   - convert single quotes to double quotes
    const literal = match![1]
      .replace(/\/\/[^\n]*/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/,(\s*[}\]])/g, '$1')
      .replace(/([{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":')
      .replace(/'/g, '"')

    let backendCatalog: Record<string, string[]>
    try {
      backendCatalog = JSON.parse(literal)
    } catch (err) {
      throw new Error(
        `Failed to parse backend PROVIDER_DEVICE_COMPATIBILITY literal. ` +
          `If the backend started using computed keys, spreads, or other ` +
          `non-trivial syntax, this test needs to be updated to compare a ` +
          `known subset instead. Parse error: ${(err as Error).message}`,
      )
    }

    expect(dashboardCatalog).toEqual(backendCatalog)
  })
})
