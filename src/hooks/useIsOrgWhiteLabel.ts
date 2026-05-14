import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'

// Detect whether a given organization is "white-label" — i.e. at least one of
// its venues has the WHITE_LABEL_DASHBOARD module enabled. Org-level pages
// (`/organizations/:orgId/...`) don't have an active venue context, so the
// existing `useWhiteLabelConfig` (which reads `activeVenue.modules`) isn't
// reliable — the active venue may belong to a different org than the URL.
//
// This hook scopes the check to venues that actually belong to the URL org.
// Used by team/users pages to conditionally expose white-label-only fields
// like `employeeCode` (PlayTelecom internal IDs).
export function useIsOrgWhiteLabel(orgId: string | undefined): boolean {
  const { allVenues } = useAuth()

  return useMemo(() => {
    if (!orgId) return false
    return allVenues.some(
      v => v.organizationId === orgId && v.modules?.some(m => m.module.code === 'WHITE_LABEL_DASHBOARD' && m.enabled),
    )
  }, [allVenues, orgId])
}
