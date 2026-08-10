import api from '@/api'
import type { GovernanceMode, MasterCatalogAccess, MasterCatalogAccessReasonCode, MasterCatalogModuleConfigV1 } from './types'

/**
 * Server route: `src/routes/dashboard.routes.ts` mounts the organization
 * master-catalog router at `/organizations/:orgId/master-catalog`, under the
 * `/api/v1/dashboard` prefix.
 */
export function masterCatalogAccessUrl(organizationId: string): string {
  return `/api/v1/dashboard/organizations/${organizationId}/master-catalog/access`
}

const REASON_CODES: readonly MasterCatalogAccessReasonCode[] = [
  'ACCESSIBLE',
  'ENTITLEMENT_MISSING',
  'ENTITLEMENT_INACTIVE',
  'MODULE_MISSING',
  'MODULE_INACTIVE',
  'CONFIG_MISSING',
  'CONFIG_INVALID',
  'GATE_DISABLED',
  'ROLE_DENIED',
  'DEPENDENCY_UNAVAILABLE',
]

const GOVERNANCE_MODES: readonly GovernanceMode[] = ['OFF', 'ADVISORY', 'ENFORCED']
const ORG_ROLES = ['OWNER', 'ADMIN', 'VIEWER', 'MEMBER'] as const

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseConfig(value: unknown): MasterCatalogModuleConfigV1 | null | undefined {
  if (value === null) return null
  if (!isRecord(value)) return undefined

  const { schemaVersion, catalogCoreEnabled, identifiersEnabled, regionalPricingEnabled, governanceMode } = value
  if (schemaVersion !== 1) return undefined
  if (typeof catalogCoreEnabled !== 'boolean') return undefined
  if (typeof identifiersEnabled !== 'boolean') return undefined
  if (typeof regionalPricingEnabled !== 'boolean') return undefined
  if (!GOVERNANCE_MODES.includes(governanceMode as GovernanceMode)) return undefined

  return {
    schemaVersion: 1,
    catalogCoreEnabled,
    identifiersEnabled,
    regionalPricingEnabled,
    governanceMode: governanceMode as GovernanceMode,
  }
}

/**
 * Validates the access payload against the exact server contract.
 *
 * Returns `null` for anything unrecognized — a partial or renamed payload is
 * treated as "we could not determine access", never as a permissive default.
 * The organization is re-checked here so a mis-routed or cached response for a
 * different tenant can never unlock this one.
 */
export function parseMasterCatalogAccessPayload(body: unknown, expectedOrganizationId: string): MasterCatalogAccess | null {
  if (!isRecord(body) || body.success !== true) return null

  const data = body.data
  if (!isRecord(data)) return null
  if (data.organizationId !== expectedOrganizationId) return null

  const { orgRole, entitlementActive, moduleActive, reasonCode, canRead, canMutateContent, canConfigureControlPlane } = data

  if (orgRole !== null && !ORG_ROLES.includes(orgRole as (typeof ORG_ROLES)[number])) return null
  if (typeof entitlementActive !== 'boolean') return null
  if (typeof moduleActive !== 'boolean') return null
  if (!REASON_CODES.includes(reasonCode as MasterCatalogAccessReasonCode)) return null
  if (typeof canRead !== 'boolean') return null
  if (typeof canMutateContent !== 'boolean') return null
  if (typeof canConfigureControlPlane !== 'boolean') return null

  const config = parseConfig(data.config)
  if (config === undefined) return null

  return {
    organizationId: expectedOrganizationId,
    orgRole: orgRole as MasterCatalogAccess['orgRole'],
    entitlementActive,
    moduleActive,
    config,
    reasonCode: reasonCode as MasterCatalogAccessReasonCode,
    canRead,
    canMutateContent,
    canConfigureControlPlane,
  }
}

/**
 * Revalidates master-catalog access against the server.
 *
 * Resolves to `null` when the response cannot be trusted; callers must read
 * that as a denial, not as an empty success.
 */
export async function fetchMasterCatalogAccess(organizationId: string): Promise<MasterCatalogAccess | null> {
  const response = await api.get(masterCatalogAccessUrl(organizationId))
  return parseMasterCatalogAccessPayload(response?.data, organizationId)
}
