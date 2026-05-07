/**
 * Cross-page platform welcome tour state.
 *
 * Persisted to sessionStorage so it survives in-app navigations between
 * pages (which destroy the driver.js instance) but not full reloads —
 * the tour resets if the user refreshes the browser, which we treat as
 * an explicit "I'm done with this".
 */

const STATE_KEY = 'avoqado-platform-tour-state'

export interface PlatformTourState {
  /** True while the tour is in progress */
  active: boolean
  /** Index into the tour's filtered pages array */
  pageIndex: number
}

export function getPlatformTourState(): PlatformTourState | null {
  try {
    const raw = sessionStorage.getItem(STATE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PlatformTourState
    if (typeof parsed?.active !== 'boolean') return null
    if (typeof parsed?.pageIndex !== 'number') return null
    return parsed
  } catch {
    return null
  }
}

export function setPlatformTourState(state: PlatformTourState): void {
  try {
    sessionStorage.setItem(STATE_KEY, JSON.stringify(state))
  } catch {
    /* private mode / quota */
  }
}

export function clearPlatformTourState(): void {
  try {
    sessionStorage.removeItem(STATE_KEY)
  } catch {
    /* noop */
  }
}
