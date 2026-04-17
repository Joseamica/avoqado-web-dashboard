/**
 * Hook: returns the organization's staff filtered by one or more roles.
 *
 * Reuses `getOrganizationTeam` (already in the services layer) and filters
 * client-side — the team list is small enough that server-side filtering
 * would be over-engineering. Consumers are the SupervisorSelect / PromoterSelect
 * dropdowns in the SIM custody UI (plan §2.5).
 *
 * Accepts a single role or an array of roles. The PlayTelecom "Promoter"
 * business concept maps to BOTH `WAITER` and `CASHIER` — see
 * `avoqado-server/src/services/promoters/promoters.service.ts` and
 * `src/lib/permissions.ts` for the backend-side rule. Prefer the
 * `useOrgPromoters` wrapper when you mean "promoters" so the rule stays in
 * one place.
 */
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationTeam, type OrganizationTeamMember } from '@/services/organization.service'

type StaffRoleId = 'MANAGER' | 'WAITER' | 'CASHIER' | 'ADMIN' | 'OWNER'

export interface OrgStaffOption {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
}

export function useOrgStaffByRole(
  orgId: string | undefined,
  role: StaffRoleId | StaffRoleId[],
) {
  const rolesKey = Array.isArray(role) ? [...role].sort().join(',') : role

  return useQuery<OrgStaffOption[]>({
    queryKey: ['org-staff-by-role', orgId, rolesKey],
    queryFn: async () => {
      if (!orgId) return []
      const members = await getOrganizationTeam(orgId)
      const allowed = new Set<StaffRoleId>(Array.isArray(role) ? role : [role])
      return members
        .filter((m: OrganizationTeamMember) => m.venues.some(v => allowed.has(v.role as StaffRoleId)))
        .map(
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

/**
 * A "Promoter" in the PlayTelecom SIM custody flow is any staff assigned to
 * a venue with role `WAITER` or `CASHIER`. This is enforced server-side in
 * `promoters.service.ts` and `permissions.ts` — keep this wrapper in sync if
 * the backend rule changes.
 */
export function useOrgPromoters(orgId: string | undefined) {
  const roles = useMemo<StaffRoleId[]>(() => ['WAITER', 'CASHIER'], [])
  return useOrgStaffByRole(orgId, roles)
}
