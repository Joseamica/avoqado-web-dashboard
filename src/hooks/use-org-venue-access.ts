/**
 * Hooks: venue "staff carry-over" access grants (org-scoped, OWNER-gated).
 *
 * - `useOrgVenueAccessCandidates` loads the people the OWNER can grant access to
 *   at a destination venue. Pass the terminal's current venue as `sourceVenueId`
 *   so the backend flags who was using the terminal there (pre-selects role +
 *   suggests a PIN).
 * - `useGrantOrgVenueAccess` grants role + PIN to one or more people and
 *   invalidates the org terminals/team caches so downstream lists refresh
 *   (e.g. the destination's NO_STAFF_PIN migration blocker clears).
 *
 * See `organizationDashboard.service.ts` (VENUE STAFF ACCESS section) for the
 * exact API contracts.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchOrgVenueAccessCandidates,
  grantOrgVenueAccess,
  type OrgVenueAccessCandidate,
  type OrgVenueAccessGrant,
  type OrgVenueAccessGrantResult,
} from '@/services/organizationDashboard.service'

export function useOrgVenueAccessCandidates(
  orgId: string | undefined,
  destVenueId: string | undefined,
  sourceVenueId?: string,
) {
  return useQuery<OrgVenueAccessCandidate[]>({
    queryKey: ['org-venue-access-candidates', orgId, destVenueId, sourceVenueId ?? null],
    queryFn: () => fetchOrgVenueAccessCandidates(orgId!, destVenueId!, sourceVenueId),
    enabled: Boolean(orgId) && Boolean(destVenueId),
    staleTime: 60 * 1000,
  })
}

export function useGrantOrgVenueAccess() {
  const queryClient = useQueryClient()
  return useMutation<
    OrgVenueAccessGrantResult[],
    unknown,
    { orgId: string; venueId: string; grants: OrgVenueAccessGrant[] }
  >({
    mutationFn: ({ orgId, venueId, grants }) => grantOrgVenueAccess(orgId, venueId, grants),
    onSuccess: () => {
      // The grant changes who can log into the destination venue — refresh the
      // terminals list (NO_STAFF_PIN blocker), team lists and candidate lists.
      queryClient.invalidateQueries({ queryKey: ['org-terminals'] })
      queryClient.invalidateQueries({ queryKey: ['org-staff-by-role'] })
      queryClient.invalidateQueries({ queryKey: ['org-venue-access-candidates'] })
    },
  })
}
