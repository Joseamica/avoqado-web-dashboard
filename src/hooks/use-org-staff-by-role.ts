/**
 * Hook: returns the organization's staff filtered by a given role.
 *
 * Reuses `getOrganizationTeam` (already in the services layer) and filters
 * client-side — the team list is small enough that server-side filtering
 * would be over-engineering. Consumers are the SupervisorSelect / PromoterSelect
 * dropdowns in the SIM custody UI (plan §2.5).
 */
import { useQuery } from '@tanstack/react-query'
import { getOrganizationTeam, type OrganizationTeamMember } from '@/services/organization.service'

export interface OrgStaffOption {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
}

export function useOrgStaffByRole(orgId: string | undefined, role: 'MANAGER' | 'WAITER' | 'ADMIN' | 'OWNER') {
  return useQuery<OrgStaffOption[]>({
    queryKey: ['org-staff-by-role', orgId, role],
    queryFn: async () => {
      if (!orgId) return []
      const members = await getOrganizationTeam(orgId)
      return members.filter((m: OrganizationTeamMember) => m.venues.some(v => v.role === role)).map(
        (m): OrgStaffOption => ({
          id: m.id,
          firstName: m.firstName,
          lastName: m.lastName,
          fullName: `${m.firstName} ${m.lastName}`.trim(),
          email: m.email,
        }),
      )
    },
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  })
}
