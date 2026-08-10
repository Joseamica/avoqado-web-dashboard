/**
 * Client mirror of the master-catalog access contract.
 *
 * Every name here matches `avoqado-server/src/types/master-catalog.ts` exactly.
 * A rename on either side must happen on both in the same change — a mismatch
 * does not fail the build, it silently denies (or worse, silently grants).
 */

export type GovernanceMode = 'OFF' | 'ADVISORY' | 'ENFORCED'

export type MasterCatalogOrgRole = 'OWNER' | 'ADMIN' | 'VIEWER' | 'MEMBER'

export interface MasterCatalogModuleConfigV1 {
  schemaVersion: 1
  catalogCoreEnabled: boolean
  identifiersEnabled: boolean
  regionalPricingEnabled: boolean
  governanceMode: GovernanceMode
}

export type MasterCatalogAccessReasonCode =
  | 'ACCESSIBLE'
  | 'ENTITLEMENT_MISSING'
  | 'ENTITLEMENT_INACTIVE'
  | 'MODULE_MISSING'
  | 'MODULE_INACTIVE'
  | 'CONFIG_MISSING'
  | 'CONFIG_INVALID'
  | 'GATE_DISABLED'
  | 'ROLE_DENIED'
  | 'DEPENDENCY_UNAVAILABLE'

export interface MasterCatalogAccess {
  organizationId: string
  orgRole: MasterCatalogOrgRole | null
  entitlementActive: boolean
  moduleActive: boolean
  config: MasterCatalogModuleConfigV1 | null
  reasonCode: MasterCatalogAccessReasonCode
  canRead: boolean
  canMutateContent: boolean
  canConfigureControlPlane: boolean
}

/**
 * The only way this module ever produces an access object without a server
 * verdict. Every field is off, so a caller that forgets to read `canRead` and
 * checks something else still gets a denial.
 */
export function deniedAccess(organizationId: string, reasonCode: MasterCatalogAccessReasonCode): MasterCatalogAccess {
  return {
    organizationId,
    orgRole: null,
    entitlementActive: false,
    moduleActive: false,
    config: null,
    reasonCode,
    canRead: false,
    canMutateContent: false,
    canConfigureControlPlane: false,
  }
}

/**
 * Auth-status membership entry.
 *
 * Task 12's server half adds `user.organizationMemberships`; until it ships,
 * the field is absent and every consumer here must treat that as "hidden".
 * Declared locally on purpose: `src/types.ts` is owned by that other half.
 */
export interface MasterCatalogMembership {
  organizationId: string
  organizationName?: string
  role?: MasterCatalogOrgRole
  masterCatalogVisible: boolean
}

const MASTER_CATALOG_ORG_ROLES = new Set<MasterCatalogOrgRole>(['OWNER', 'ADMIN', 'VIEWER', 'MEMBER'])

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * Reads the visibility hint out of an arbitrary auth payload.
 *
 * Fails closed on every shape that is not exactly what we expect: missing
 * field, wrong type, unknown organization, or a truthy-but-not-`true` flag
 * such as the string `'true'`.
 */
export function findMasterCatalogMembership(user: unknown, organizationId: string | null | undefined): MasterCatalogMembership | null {
  if (!organizationId || !isRecord(user)) return null

  const memberships = user.organizationMemberships
  if (!Array.isArray(memberships)) return null

  for (const entry of memberships) {
    if (!isRecord(entry)) continue
    if (entry.organizationId !== organizationId) continue
    if (entry.masterCatalogVisible !== true) return null

    if (typeof entry.role !== 'string' || !MASTER_CATALOG_ORG_ROLES.has(entry.role as MasterCatalogOrgRole)) return null

    return {
      organizationId,
      organizationName: typeof entry.organizationName === 'string' ? entry.organizationName : undefined,
      role: entry.role as MasterCatalogOrgRole,
      masterCatalogVisible: true,
    }
  }

  return null
}

export function getMasterCatalogOrganizationLinks(user: unknown): Array<{ organizationId: string; organizationName: string }> {
  if (!isRecord(user) || !Array.isArray(user.organizationMemberships)) return []

  const seen = new Set<string>()
  const links: Array<{ organizationId: string; organizationName: string }> = []
  for (const candidate of user.organizationMemberships) {
    if (!isRecord(candidate) || typeof candidate.organizationId !== 'string' || seen.has(candidate.organizationId)) continue
    const membership = findMasterCatalogMembership(user, candidate.organizationId)
    if (!membership) continue
    seen.add(candidate.organizationId)
    links.push({
      organizationId: candidate.organizationId,
      organizationName: membership.organizationName || candidate.organizationId,
    })
  }
  return links
}
