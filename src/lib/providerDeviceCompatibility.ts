/**
 * Provider ↔ Device-brand compatibility — dashboard mirror.
 *
 * MIRROR of avoqado-server/src/lib/providerDeviceCompatibility.ts
 *
 * Used by `<DeviceCompatibilityBanner>` (Task 17) to surface AngelPay-on-PAX
 * / Blumon-on-Nexgo footguns *before* an operator clicks Create, so the
 * server-side `IncompatibleDeviceError` (HTTP 409) added in Task 10/11/12 is
 * the safety net — not the primary UX.
 *
 * Drift between this constant and the backend is a real bug (operator gets
 * a banner that lies, or no banner at all). A dedicated cross-repo sync test
 * (Task 20) asserts the two maps are byte-equivalent, gated to run in CI
 * with both repos checked out side-by-side. Keep this updated in lockstep.
 *
 * Providers NOT in this map are unconstrained (e.g. STRIPE, B4BIT — they
 * don't care which hardware runs the TPV); the banner renders nothing in
 * that case.
 *
 * Spec ref: §3.1, §4.4.
 */
export const PROVIDER_DEVICE_COMPATIBILITY: Record<string, string[]> = {
  BLUMON: ['PAX'],
  ANGELPAY: ['NEXGO'],
}

/**
 * Cheap predicate — returns the compatible brand list for a provider, or
 * `null` if the provider is unconstrained. Callers should render nothing
 * when this is null.
 */
export function getCompatibleBrandsFor(providerCode: string): string[] | null {
  const list = PROVIDER_DEVICE_COMPATIBILITY[providerCode]
  return list && list.length > 0 ? list : null
}
