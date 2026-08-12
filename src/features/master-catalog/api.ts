import api from '@/api'
import type {
  CatalogAuditPage,
  CatalogBindingDecision,
  CatalogBindingPreview,
  CatalogBindingResult,
  CatalogImportPreview,
  CatalogImportResult,
  CatalogItemCommand,
  CatalogItemDetail,
  CatalogItemStatus,
  CatalogItemSummary,
  CatalogPublicationListItem,
  CatalogPublicationOperation,
  CatalogPublicationPreview,
  CatalogPublicationResult,
  CatalogReference,
  CursorPage,
  GovernanceMode,
  MasterCatalogAccess,
  MasterCatalogAccessReasonCode,
  MasterCatalogModuleConfigV1,
} from './types'

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

function catalogBaseUrl(organizationId: string): string {
  return `/api/v1/dashboard/organizations/${encodeURIComponent(organizationId)}/master-catalog`
}

function queryString(values: Record<string, string | number | undefined>): string {
  const query = new URLSearchParams()
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value))
  })
  const rendered = query.toString()
  return rendered ? `?${rendered}` : ''
}

function unwrap<T>(response: unknown): T {
  if (!isRecord(response) || !isRecord(response.data) || response.data.success !== true || !('data' in response.data)) {
    throw new Error('CATALOG_RESPONSE_INVALID')
  }
  return response.data.data as T
}

export async function listCatalogItems(
  organizationId: string,
  input: { cursor?: string; pageSize?: number; status?: CatalogItemStatus } = {},
): Promise<CursorPage<CatalogItemSummary>> {
  return unwrap(
    await api.get(
      `${catalogBaseUrl(organizationId)}/items${queryString({ cursor: input.cursor, pageSize: input.pageSize, status: input.status })}`,
    ),
  )
}

export async function getCatalogItem(organizationId: string, catalogItemId: string): Promise<CatalogItemDetail> {
  return unwrap(await api.get(`${catalogBaseUrl(organizationId)}/items/${encodeURIComponent(catalogItemId)}`))
}

/**
 * The command endpoints answer with `{ detail, auditEnvelope }`, not the item
 * itself. Returning the envelope made `result.id` undefined at every call site,
 * so a successful create redirected to `/items/undefined` and rendered an error
 * over a row that had just been written.
 */
function commandDetail(payload: unknown): CatalogItemDetail {
  if (isRecord(payload) && isRecord(payload.detail)) return payload.detail as unknown as CatalogItemDetail
  return payload as CatalogItemDetail
}

export async function createCatalogItem(organizationId: string, input: CatalogItemCommand): Promise<CatalogItemDetail> {
  return commandDetail(unwrap(await api.post(`${catalogBaseUrl(organizationId)}/items`, input)))
}

export async function updateCatalogItem(
  organizationId: string,
  catalogItemId: string,
  input: CatalogItemCommand & { expectedRevision: number; organizationValueDeactivations: unknown[] },
): Promise<CatalogItemDetail> {
  return commandDetail(unwrap(await api.patch(`${catalogBaseUrl(organizationId)}/items/${encodeURIComponent(catalogItemId)}`, input)))
}

export async function listCatalogReferences(
  organizationId: string,
  kind: 'brands' | 'manufacturers' | 'families',
  input: { cursor?: string; pageSize?: number; status?: CatalogItemStatus } = {},
): Promise<CursorPage<CatalogReference>> {
  return unwrap(
    await api.get(
      `${catalogBaseUrl(organizationId)}/catalogs/${kind}${queryString({ cursor: input.cursor, pageSize: input.pageSize, status: input.status })}`,
    ),
  )
}

export async function previewCatalogImport(organizationId: string, file: File): Promise<CatalogImportPreview> {
  const body = new FormData()
  body.append('file', file)
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/imports/preview`, body))
}

export async function confirmCatalogImport(
  organizationId: string,
  input: { importBatchId: string; previewToken: string; confirm: true; idempotencyKey: string },
): Promise<CatalogImportResult> {
  const { importBatchId, ...body } = input
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/imports/${encodeURIComponent(importBatchId)}/confirm`, body))
}

export function catalogImportErrorsUrl(organizationId: string, importBatchId: string): string {
  return `${catalogBaseUrl(organizationId)}/imports/${encodeURIComponent(importBatchId)}/errors.xlsx`
}

export function catalogExportUrl(organizationId: string, businessType?: string): string {
  const path = businessType ? '/exports/catalog-by-business-type.xlsx' : '/exports/catalog-master.xlsx'
  return `${catalogBaseUrl(organizationId)}${path}${queryString({ businessType })}`
}

export function catalogImportTemplateUrl(organizationId: string): string {
  return `${catalogBaseUrl(organizationId)}/templates/catalog-master-import-v1.xlsx`
}

export async function previewCatalogBindings(
  organizationId: string,
  lines: Array<{ catalogItemId: string; venueId: string; decision?: CatalogBindingDecision }>,
): Promise<CatalogBindingPreview> {
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/bindings/preview`, { lines }))
}

export async function confirmCatalogBindings(
  organizationId: string,
  input: { bindingBatchId: string; previewToken: string; confirm: true; idempotencyKey: string },
): Promise<CatalogBindingResult> {
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/bindings/confirm`, input))
}

export async function listCatalogPublications(
  organizationId: string,
  input: { cursor?: string; pageSize?: number; operation?: CatalogPublicationOperation; state?: string } = {},
): Promise<CursorPage<CatalogPublicationListItem>> {
  return unwrap(
    await api.get(
      `${catalogBaseUrl(organizationId)}/publications${queryString({
        cursor: input.cursor,
        pageSize: input.pageSize,
        operation: input.operation,
        state: input.state,
      })}`,
    ),
  )
}

export async function previewCatalogPublication(
  organizationId: string,
  input: {
    operation: CatalogPublicationOperation
    idempotencyKey: string
    targets: Array<{
      catalogItemId: string
      venueId: string
      productId: string
      decisions?: Array<
        | { field: string; decision: 'PUBLISH_CORPORATE' | 'UNDECIDED' }
        | { field: string; decision: 'APPROVE_LOCAL_OVERRIDE'; overrideId: string }
      >
    }>
  },
): Promise<CatalogPublicationPreview> {
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/publications/preview`, input))
}

export async function confirmCatalogPublication(
  organizationId: string,
  input: { publicationBatchId: string; previewToken: string; confirm: true; idempotencyKey: string },
): Promise<CatalogPublicationResult> {
  const { publicationBatchId, ...body } = input
  return unwrap(await api.post(`${catalogBaseUrl(organizationId)}/publications/${encodeURIComponent(publicationBatchId)}/confirm`, body))
}

export async function recoverCatalogPublication(
  organizationId: string,
  operation: CatalogPublicationOperation,
  idempotencyKey: string,
): Promise<CatalogPublicationResult> {
  return unwrap(
    await api.get(
      `${catalogBaseUrl(organizationId)}/publications/by-idempotency-key/${encodeURIComponent(operation)}/${encodeURIComponent(idempotencyKey)}`,
    ),
  )
}

export async function listCatalogAuditActions(organizationId: string): Promise<string[]> {
  return unwrap(await api.get(`${catalogBaseUrl(organizationId)}/audit/actions`))
}

export async function listCatalogAudit(
  organizationId: string,
  input: { page?: number; pageSize?: number; action?: string; search?: string } = {},
): Promise<CatalogAuditPage> {
  return unwrap(
    await api.get(
      `${catalogBaseUrl(organizationId)}/audit${queryString({ page: input.page, pageSize: input.pageSize, action: input.action, search: input.search })}`,
    ),
  )
}

export function newCatalogIdempotencyKey(prefix: string): string {
  const random = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
  return `${prefix}-${random}`
}
