/**
 * ImpersonationScreenRing
 *
 * Full-viewport, pointer-events-none overlay that draws a subtle 2-3px amber
 * ring around the screen edge while an impersonation session is active. Acts
 * as a peripheral-vision reminder that complements the sticky banner — the
 * superadmin can never drift into "I forgot I was impersonating" territory.
 *
 * Spec: docs/superpowers/specs/2026-04-20-superadmin-impersonation-design.md §5.5
 */
import { useImpersonation } from '@/hooks/use-impersonation'

export function ImpersonationScreenRing() {
  const { isImpersonating, isInCriticalZone, isInWarningZone } = useImpersonation()

  if (!isImpersonating) return null

  const color = isInCriticalZone
    ? 'ring-red-500/70'
    : isInWarningZone
      ? 'ring-amber-500/60'
      : 'ring-amber-400/50'

  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none fixed inset-0 z-[9999] ring-4 ring-inset ${color} transition-[--tw-ring-color] duration-500`}
    />
  )
}
