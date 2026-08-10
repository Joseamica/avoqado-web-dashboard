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

export type CatalogItemKind = 'RETAIL_PRODUCT' | 'PREPARED_DISH'
export type CatalogItemStatus = 'ACTIVE' | 'RETIRED'
export type CatalogReferenceStatus = 'ACTIVE' | 'RETIRED'

export interface CatalogReference {
  id: string
  name: string
  status: CatalogReferenceStatus
  revision: number
  parent?: { id: string; name: string; status: CatalogReferenceStatus } | null
}

export interface CatalogItemSummary {
  id: string
  sku: string
  name: string
  kind: CatalogItemKind
  status: CatalogItemStatus
  revision: number
  bindingSummary: { total: number }
}

export interface CatalogOrganizationValueInput {
  kind: 'SALE_PRICE' | 'PURCHASE_COST'
  amount: string
  currency: string
  expectedRuleRevision?: number
}

export interface CatalogItemCommand {
  sku: string
  kind: CatalogItemKind
  name: string
  description: string
  imageUrl: string
  brandId: string
  manufacturerId: string
  familyId: string
  presentationLabel: string
  unit: string
  taxRate: string
  satProductKey: string
  satUnitKey: string
  objetoImp: string
  productType: string
  iepsMode: string
  iepsRate: string | null
  iepsQuota: string | null
  iepsQuotaUnit: string | null
  businessTypes: string[]
  organizationValues: CatalogOrganizationValueInput[]
}

export interface CatalogItemDetail extends CatalogItemSummary, CatalogItemCommand {
  organizationId: string
  brand: CatalogReference
  manufacturer: CatalogReference
  family: CatalogReference & { parent: CatalogReference }
  organizationValues: Array<CatalogOrganizationValueInput & { id: string; revision: number; active: boolean }>
  createdById: string
  updatedById: string
  createdAt: string
  updatedAt: string
  validation: { state: string; summary: string | null }
}

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
}

export interface CatalogImportFinding {
  sheet?: string
  sourceSheet?: string
  row?: number
  sourceRow?: number
  column?: string | null
  code: string
  message: string
  rejectedValue?: string | null
}

export interface CatalogImportPreview {
  importBatchId: string
  canConfirm: boolean
  previewToken: string | null
  targetHash: string
  expiresAt: string | null
  errors: CatalogImportFinding[]
  errorCount: number
  errorsTruncated: boolean
  blockingReasons: Array<{ code: string; message: string }>
}

export interface CatalogImportResult {
  importBatchId: string
  state: 'APPLIED'
  appliedItemIds: string[]
}

export type CatalogBindingDecision =
  | { decision: 'LINK'; productId: string }
  | { decision: 'CREATE'; create: { categoryId: string; localSku: string; initialPrice: string } }
  | { decision: 'SKIP' }

export interface CatalogBindingPreviewLine {
  catalogItemId: string
  venueId: string
  proposal: 'LINK' | 'CREATE' | 'SKIP'
  decision: CatalogBindingDecision | null
  status: 'READY' | 'CONFLICT' | 'INVALID'
  errorCode: string | null
  candidates: Array<{ id: string; sku: string; name: string }>
  readiness: 'NOT_REQUIRED' | 'READY' | 'MISSING_RECIPE' | 'INVALID' | 'STALE'
}

export interface CatalogBindingPreview {
  bindingBatchId: string | null
  previewToken: string | null
  targetHash: string
  expiresAt: string | null
  canConfirm: boolean
  lines: CatalogBindingPreviewLine[]
}

export interface CatalogBindingResult {
  bindingBatchId: string
  state: 'APPLIED'
  lines: Array<{
    catalogItemId: string
    venueId: string
    decision: 'LINK' | 'CREATE' | 'SKIP'
    status: 'APPLIED' | 'SKIPPED'
    productId: string | null
    bindingId: string | null
  }>
}

export type CatalogPublicationOperation = 'CATALOG_FIELDS_PUBLISH' | 'CATALOG_FIELDS_REVERSION' | 'CATALOG_PRODUCT_ACTIVATION'
export type CatalogPublicationDecision = 'PUBLISH_CORPORATE' | 'APPROVE_LOCAL_OVERRIDE' | 'UNDECIDED'

export interface CatalogPublicationPreviewField {
  field: string
  before: unknown
  proposed: unknown
  after: unknown
  decision: CatalogPublicationDecision
  overrideId: string | null
}

export interface CatalogPublicationPreview {
  publicationBatchId: string
  operation: CatalogPublicationOperation
  previewToken: string
  targetHash: string
  expiresAt: string
  canConfirm: boolean
  lines: Array<{
    catalogItemId: string
    venueId: string
    productId: string
    bindingId: string
    status: string
    fieldMask: string[]
    canonicalTargetHash: string
    diagnosticCode: string | null
    diagnostic: string | null
    fields: CatalogPublicationPreviewField[]
  }>
}

export interface CatalogPublicationResult {
  publicationBatchId: string
  operation: CatalogPublicationOperation
  state: 'PREVIEWED' | 'IN_PROGRESS' | 'APPLIED' | 'FAILED' | 'EXPIRED' | 'SUPERSEDED'
  expiresAt?: string
  retryAfterSeconds?: number
  lines: Array<Record<string, unknown>>
}

export interface CatalogPublicationListItem {
  publicationBatchId: string
  operation: CatalogPublicationOperation
  state: string
  previewExpiresAt: string | null
  appliedAt: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  failureCode: string | null
  failureMessage: string | null
  lineCount: number
}

export interface CatalogAuditLog {
  id: string
  action: string
  entity: string
  entityId: string | null
  createdAt: string
  staff: { firstName: string; lastName: string } | null
  venue: { id: string; name: string } | null
  actorType?: 'HUMAN' | 'SERVICE' | null
  servicePrincipalId?: string | null
}

export interface CatalogAuditPage {
  logs: CatalogAuditLog[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}
