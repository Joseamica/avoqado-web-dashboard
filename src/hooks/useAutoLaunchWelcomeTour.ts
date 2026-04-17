import { useEffect, useRef } from 'react'
import { useAuth } from '@/context/AuthContext'
import { useInventoryWelcomeTour } from '@/hooks/useInventoryWelcomeTour'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { StaffRole } from '@/types'

/**
 * Auto-launches the inventory welcome tour the first time an OWNER or ADMIN
 * lands on any `/inventory/*` route.
 *
 * State is persisted via `StaffOnboardingState` on the backend (keys
 * `inventory-welcome-auto-launched` and `tour-banner::inventory-welcome`),
 * so the tour fires exactly once per staff member regardless of device.
 *
 * Rules:
 *  - Only fires for OWNER / ADMIN (SUPERADMIN, MANAGER, and below are ignored).
 *  - Fires AT MOST ONCE per (venueId, staffId) — persisted server-side.
 *  - Respects banner dismissal: if the staff dismissed the welcome banner on
 *    a prior visit we treat that as an explicit "don't show me the intro"
 *    and skip the auto-launch.
 *  - Small delay so the page has time to paint before the overlay appears.
 *
 * Implementation note: the trigger effect uses a ref-based one-shot flag and
 * deliberately does NOT return a cleanup that cancels the timer. Because
 * `setAutoLaunched(true)` triggers an optimistic cache update, the effect
 * would re-run with `autoLaunched === true` and the cleanup would cancel the
 * pending timer before it fires. The unmount cleanup lives in a separate
 * effect keyed to `[]`.
 */
export function useAutoLaunchWelcomeTour() {
  const { user, staffInfo } = useAuth()
  const { start: startWelcomeTour } = useInventoryWelcomeTour()

  const {
    value: autoLaunched,
    isLoaded: autoLaunchedLoaded,
    setValue: setAutoLaunched,
  } = useOnboardingKey<boolean>('inventory-welcome-auto-launched', false)

  const { value: bannerDismissed, isLoaded: bannerLoaded } = useOnboardingKey<boolean>(
    'tour-banner::inventory-welcome',
    false,
  )

  const didFireRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (didFireRef.current) return
    if (!autoLaunchedLoaded || !bannerLoaded) return

    const role = staffInfo?.role
    const eligible = role === StaffRole.OWNER || role === StaffRole.ADMIN
    if (!eligible) return

    if (autoLaunched || bannerDismissed) return
    if (!user?.id) return

    didFireRef.current = true
    setAutoLaunched(true)

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      startWelcomeTour()
    }, 1200)

    // NOTE: intentionally no cleanup — see docstring.
  }, [
    autoLaunched,
    autoLaunchedLoaded,
    bannerDismissed,
    bannerLoaded,
    staffInfo?.role,
    user?.id,
    startWelcomeTour,
    setAutoLaunched,
  ])

  // Unmount-only cleanup so we don't leak a pending timer on route change.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])
}
