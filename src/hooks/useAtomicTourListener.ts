import { useEffect, useRef } from 'react'

/**
 * Cross-component "launch this section's atomic tour" mechanism.
 *
 * Two entry points converge here:
 *
 *   1. `InventorySetupChecklist` — clicks "Hacerlo" on a step. It sets the
 *      sessionStorage flag and navigates to the target page. The target
 *      page's atomic tour hook is not yet mounted, so we use a flag that
 *      survives the navigation.
 *
 *   2. `useInventoryWelcomeTour` orchestrator — user is already on the
 *      target page (the welcome tour navigated them there). Here we also
 *      dispatch a DOM event so the hook picks it up immediately without
 *      waiting for remount.
 *
 * Each atomic tour hook calls `useAtomicTourListener(name, start)` which:
 *   - On mount: checks sessionStorage and fires `start()` if the flag matches.
 *   - Subscribes to the shared event and fires `start()` while mounted.
 */

const STORAGE_KEY = 'avoqado-tour-autostart'
const EVENT_NAME = 'avoqado-tour-autostart-check'
const COMPLETED_EVENT = 'avoqado-tour-completed'

export type AtomicTourName =
  | 'category'
  | 'ingredient'
  | 'product'
  | 'recipe'
  | 'purchase-order'
  | 'stock-adjustment'
  | 'history'

/**
 * Call from launcher code (checklist, welcome tour) to queue an atomic tour.
 * If the target page is already mounted, the listener fires immediately via
 * the DOM event. Otherwise the next mount of that page's tour hook will
 * pick the flag up and fire.
 */
export function requestAtomicTour(name: AtomicTourName): void {
  try {
    sessionStorage.setItem(STORAGE_KEY, name)
  } catch {
    /* quota / private mode */
  }
  window.dispatchEvent(new Event(EVENT_NAME))
}

/**
 * Dispatched by each atomic tour when the user CLICKS THROUGH TO THE LAST
 * STEP (i.e. actually finished the walkthrough). Not dispatched if the user
 * closes the tour early via the X.
 *
 * The inventory welcome tour orchestrator listens for this event and marks
 * the matching checklist step as done. That way "Hacerlo" only counts when
 * the user has actually seen the whole tour — clicking Hacerlo and closing
 * immediately does NOT mark the step complete.
 */
export function notifyAtomicTourCompleted(name: AtomicTourName): void {
  window.dispatchEvent(new CustomEvent(COMPLETED_EVENT, { detail: { name } }))
}

/**
 * Subscribe to "atomic tour completed" events. Mount once (e.g. in the
 * welcome tour orchestrator) to react when any atomic tour finishes.
 */
export function useAtomicTourCompletionListener(handler: (name: AtomicTourName) => void): void {
  useEffect(() => {
    const wrapped = (event: Event) => {
      const detail = (event as CustomEvent<{ name: AtomicTourName }>).detail
      if (detail?.name) handler(detail.name)
    }
    window.addEventListener(COMPLETED_EVENT, wrapped)
    return () => window.removeEventListener(COMPLETED_EVENT, wrapped)
  }, [handler])
}

/**
 * Clears the autostart flag. Useful for the launcher to cancel a pending
 * request if the user navigates away before the atomic tour starts.
 */
export function clearPendingAtomicTour(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* noop */
  }
}

/**
 * Hook: mount in each atomic tour hook so it auto-starts when requested.
 *
 * @param name  the atomic tour's identifier (e.g. 'category')
 * @param start the `start()` function returned by the tour hook
 * @param delay ms delay before calling start, so the page has time to settle
 */
export function useAtomicTourListener(
  name: AtomicTourName,
  start: () => void,
  delay = 350,
): void {
  // Keep the latest `start` without invalidating the effect. Otherwise a
  // parent re-render would drop this hook's deps, run cleanup (which clears
  // the pending setTimeout), and — because the sessionStorage flag was
  // already consumed — the tour would never fire. This used to silently
  // swallow `requestAtomicTour` calls.
  const startRef = useRef(start)
  useEffect(() => {
    startRef.current = start
  }, [start])

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null

    const fireIfMatching = () => {
      let pending: string | null = null
      try {
        pending = sessionStorage.getItem(STORAGE_KEY)
      } catch {
        return
      }
      if (pending !== name) return

      // DO NOT remove the flag here — we wait until the setTimeout actually
      // fires. Otherwise React 18 StrictMode's mount→unmount→mount cycle
      // would: (1) consume the flag on first mount, (2) cleanup cancels the
      // scheduled start, (3) second mount sees no flag → tour never runs.
      // A page navigation followed by mount has the same shape.

      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        timer = null
        // Consume flag now so subsequent mounts of sibling hooks (e.g. other
        // atomic tours listening for their own names) don't re-trigger.
        try {
          if (sessionStorage.getItem(STORAGE_KEY) === name) {
            sessionStorage.removeItem(STORAGE_KEY)
          }
        } catch {
          /* noop */
        }
        startRef.current()
      }, delay)
    }

    fireIfMatching()
    window.addEventListener(EVENT_NAME, fireIfMatching)

    return () => {
      window.removeEventListener(EVENT_NAME, fireIfMatching)
      if (timer) clearTimeout(timer)
    }
  }, [name, delay])
}
