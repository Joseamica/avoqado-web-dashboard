import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { usePlatformWelcomeTour } from '@/hooks/usePlatformWelcomeTour'
import { useOnboardingKey } from '@/hooks/useOnboardingState'
import { getPlatformTourState } from '@/lib/platform-tour-state'
import { StaffRole } from '@/types'

/**
 * Mounted ONCE in dashboard.tsx (the parent layout for all venue routes).
 *
 * Two responsibilities:
 *   1. Resume an in-progress tour across page navigations (the orchestrator
 *      hook itself watches `location.pathname` and re-mounts driver.js on
 *      each matching page — mounting it here ensures it stays alive across
 *      the route changes the tour itself triggers).
 *   2. Auto-launch the tour the first time an OWNER/ADMIN/SUPERADMIN lands
 *      on Home for a given venue. Persisted via `StaffOnboardingState` under
 *      `platform-welcome-completed` so it fires exactly once per (venue, staff).
 *
 * Note: white-label venues are NOT skipped — admins of white-label venues
 * also need the platform overview.
 */
export function useAutoLaunchPlatformWelcomeTour(): { start: () => void; cancel: () => void } {
  const { user, staffInfo } = useAuth()
  const { fullBasePath } = useCurrentVenue()
  const { start, cancel } = usePlatformWelcomeTour()
  const location = useLocation()

  const { value: completed, isLoaded, setValue: setCompleted } = useOnboardingKey<boolean>(
    'platform-welcome-completed',
    false,
  )

  const didFireRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (didFireRef.current) return
    if (!isLoaded) return
    if (completed) return
    if (!user?.id) return

    // Don't auto-launch in the middle of a deep link (e.g. /payments/:id) —
    // only on Home or the venue root. The resume effect will pick up if a
    // tour is already active.
    const onHome = location.pathname === `${fullBasePath}/home` || location.pathname === fullBasePath || location.pathname === `${fullBasePath}/`
    if (!onHome) return

    // If a tour is already active in this session (mid-flow), don't start a
    // new one — the resume effect handles it.
    if (getPlatformTourState()?.active) return

    const role = staffInfo?.role
    const eligible = role === StaffRole.OWNER || role === StaffRole.ADMIN || role === StaffRole.SUPERADMIN
    if (!eligible) return

    didFireRef.current = true
    // Mark "running" optimistically — if the tour is canceled the user can
    // re-run via the manual replay button. We only mark `completed` on full
    // completion (handled inside the orchestrator).
    setCompleted(false)

    timerRef.current = setTimeout(() => {
      timerRef.current = null
      start()
    }, 1200)
  }, [isLoaded, completed, user?.id, staffInfo?.role, location.pathname, fullBasePath, start, setCompleted])

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [])

  return { start, cancel }
}
