/**
 * Hook: returns the organization's staff filtered by one or more roles.
 *
 * Reuses `getOrganizationTeam` (already in the services layer) and filters
 * client-side — the team list is small enough that server-side filtering
 * would be over-engineering. It has NO consumers today: both SIM custody
 * dropdowns moved to the dedicated lookups below. Kept only for a future
 * OWNER-only screen that genuinely needs the whole team.
 *
 * Accepts a single role or an array of roles. The PlayTelecom "Promoter"
 * business concept maps to BOTH `WAITER` and `CASHIER` — see
 * `avoqado-server/src/services/promoters/promoters.service.ts` and
 * `src/lib/permissions.ts` for the backend-side rule. Prefer the
 * `useOrgPromoters` wrapper when you mean "promoters" so the rule stays in
 * one place.
 *
 * 🔴 `getOrganizationTeam` requires OWNER — this hook returns an EMPTY list for
 * anybody else (the 403 is swallowed by the query). Never use it to feed a
 * dropdown whose action is available below OWNER. The two SIM custody dropdowns
 * have dedicated, org-staff-accessible endpoints instead:
 *   - Promotores  → `useOrgPromoters`
 *   - Supervisores → `useOrgSupervisors`
 */
import { useQuery } from '@tanstack/react-query'
import {
  getOrganizationTeam,
  getOrganizationPromoters,
  getOrganizationSupervisors,
  type OrganizationTeamMember,
} from '@/services/organization.service'

type StaffRoleId = 'MANAGER' | 'WAITER' | 'CASHIER' | 'ADMIN' | 'OWNER'

export interface OrgStaffOption {
  id: string
  firstName: string
  lastName: string
  fullName: string
  email: string
  // Org-internal identifier (white-label orgs). Null when unset.
  employeeCode: string | null
}

export function useOrgStaffByRole(orgId: string | undefined, role: StaffRoleId | StaffRoleId[]) {
  const rolesKey = Array.isArray(role) ? [...role].sort().join(',') : role

  return useQuery<OrgStaffOption[]>({
    queryKey: ['org-staff-by-role', orgId, rolesKey],
    queryFn: async () => {
      if (!orgId) return []
      const members = await getOrganizationTeam(orgId)
      const allowed = new Set<StaffRoleId>(Array.isArray(role) ? role : [role])
      return members.filter((m: OrganizationTeamMember) => m.venues.some(v => allowed.has(v.role as StaffRoleId))).map(toOption)
    },
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * A "Promoter" in the PlayTelecom SIM custody flow is any staff assigned to
 * a venue with role `WAITER` or `CASHIER`. This is enforced server-side in
 * `promoters.service.ts` and `permissions.ts` — keep this hook in sync if
 * the backend rule changes.
 *
 * Backed by the dedicated `/organizations/:orgId/promoters` endpoint which
 * is accessible to any staff member of the org (including the MANAGER / Supervisor
 * that actually uses this dropdown). The `/team` endpoint used by
 * `useOrgStaffByRole` requires OWNER and would return 403 for the Supervisor,
 * leaving the dropdown silently empty — the bug this hook fixes.
 */
export function useOrgPromoters(orgId: string | undefined) {
  return useQuery<OrgStaffOption[]>({
    queryKey: ['org-promoters', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const members = await getOrganizationPromoters(orgId)
      return members.map(toOption)
    },
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  })
}

/**
 * A "Supervisor" in the SIM custody chain is any staff with role `MANAGER`
 * active in a venue of the org — the exact predicate the backend validates the
 * target against (`custody.service.ts#reassignSupervisor`), so this dropdown can
 * never offer someone the service rejects with `SUPERVISOR_NOT_FOUND`.
 *
 * Backed by the dedicated `/organizations/:orgId/supervisors` endpoint, readable
 * by any staff member of the org. `useOrgStaffByRole(orgId, 'MANAGER')` — which
 * this replaces — went through the OWNER-only `/team` endpoint, so an ADMIN
 * (who DOES hold `sim-custody:assign-to-supervisor` and
 * `sim-custody:reassign-supervisor`) got a silently empty dropdown. Same bug
 * `useOrgPromoters` fixed one level down the chain.
 */
export function useOrgSupervisors(orgId: string | undefined) {
  return useQuery<OrgStaffOption[]>({
    queryKey: ['org-supervisors', orgId],
    queryFn: async () => {
      if (!orgId) return []
      const members = await getOrganizationSupervisors(orgId)
      return members.map(toOption)
    },
    enabled: Boolean(orgId),
    staleTime: 5 * 60 * 1000,
  })
}

function toOption(m: OrganizationTeamMember): OrgStaffOption {
  return {
    id: m.id,
    firstName: m.firstName,
    lastName: m.lastName,
    fullName: `${m.firstName} ${m.lastName}`.trim(),
    email: m.email,
    employeeCode: m.employeeCode ?? null,
  }
}
