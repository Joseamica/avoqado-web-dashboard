/**
 * SIM Custody Service
 *
 * Client for the /dashboard/organizations/:orgId/sim-custody endpoints.
 * See avoqado-server plan §1.4 for the contract; all bulk calls return
 * { summary, results[] } with partial-success semantics.
 */
import api from '@/api'
import { v4 as uuidv4 } from 'uuid'

// ==========================================
// TYPES (mirror the backend registry in sim-custody-error-codes.ts)
// ==========================================

export type SimCustodyErrorCode =
  | 'NOT_FOUND'
  | 'ALREADY_ASSIGNED'
  | 'NOT_IN_YOUR_CUSTODY'
  | 'HAS_DOWNSTREAM_CUSTODY'
  | 'VERSION_CONFLICT'
  | 'ALREADY_ACCEPTED'
  | 'ALREADY_REJECTED'
  | 'SIM_SOLD'
  | 'SIM_NOT_ACCEPTED'
  | 'CATEGORY_NOT_FOUND'
  | 'CATEGORY_MISMATCH'
  | 'INVALID_STATE'
  | 'REASON_REQUIRED'
  | 'TENANT_MISMATCH'
  | 'IDEMPOTENCY_KEY_REUSED_WITH_DIFFERENT_BODY'

export type SimCustodyCollectionReason = 'STAFF_TERMINATED' | 'DAMAGED_SIM'

export type SimCustodyState =
  | 'ADMIN_HELD'
  | 'SUPERVISOR_HELD'
  | 'PROMOTER_PENDING'
  | 'PROMOTER_HELD'
  | 'PROMOTER_REJECTED'
  | 'SOLD'

export interface BulkRow {
  serialNumber: string
  status: 'ok' | 'error'
  event?: string
  eventId?: string
  code?: SimCustodyErrorCode
  message?: string
}

export interface BulkResponse {
  summary: { total: number; succeeded: number; failed: number }
  results: BulkRow[]
}

export interface AssignToSupervisorRow {
  serialNumber: string
  categoryId?: string | null
}

export interface AssignToSupervisorInput {
  supervisorStaffId: string
  fallbackCategoryId?: string | null
  rows: AssignToSupervisorRow[]
}

export interface AssignToPromoterInput {
  promoterStaffId: string
  serialNumbers: string[]
}

export interface CollectInput {
  serialNumber: string
  reason: SimCustodyCollectionReason
}

export interface CustodyEvent {
  id: string
  serializedItemId: string
  serialNumber: string
  eventType: string
  fromState: SimCustodyState | null
  toState: SimCustodyState
  fromStaffId: string | null
  toStaffId: string | null
  actorStaffId: string
  reason: SimCustodyCollectionReason | null
  idempotencyRequestId: string | null
  createdAt: string
}

// ==========================================
// CLIENT
// ==========================================

const base = (orgId: string) => `/api/v1/dashboard/organizations/${orgId}/sim-custody`

/**
 * Admin → Supervisor bulk assignment.
 * Partial-success: HTTP 200 always; check summary.failed for per-row errors.
 */
export async function assignSimsToSupervisor(orgId: string, body: AssignToSupervisorInput): Promise<BulkResponse> {
  const { data } = await api.post(`${base(orgId)}/assign-to-supervisor`, body, {
    headers: { 'Idempotency-Key': uuidv4() },
  })
  return data
}

/**
 * Supervisor → Promoter bulk assignment. Only the owning supervisor may transition.
 */
export async function assignSimsToPromoter(orgId: string, body: AssignToPromoterInput): Promise<BulkResponse> {
  const { data } = await api.post(`${base(orgId)}/assign-to-promoter`, body, {
    headers: { 'Idempotency-Key': uuidv4() },
  })
  return data
}

/**
 * OWNER/SUPERADMIN bypass: asigna directo Admin → Promotor sin pasar por
 * Supervisor. Solo se expone en UI cuando el actor tiene el permiso
 * `sim-custody:assign-to-promoter-direct`.
 */
export async function assignSimsToPromoterDirect(orgId: string, body: AssignToPromoterInput): Promise<BulkResponse> {
  const { data } = await api.post(`${base(orgId)}/assign-to-promoter-direct`, body, {
    headers: { 'Idempotency-Key': uuidv4() },
  })
  return data
}

export async function collectFromPromoter(orgId: string, body: CollectInput): Promise<{ custodyState: SimCustodyState }> {
  const { data } = await api.post(`${base(orgId)}/collect-from-promoter`, body)
  return data
}

export async function collectFromSupervisor(orgId: string, body: CollectInput): Promise<{ custodyState: SimCustodyState }> {
  const { data } = await api.post(`${base(orgId)}/collect-from-supervisor`, body)
  return data
}

/** Timeline events for a single SIM, powering the SimTimelineDrawer. */
export async function getSimCustodyEvents(orgId: string, serialNumber: string): Promise<{ serialNumber: string; events: CustodyEvent[] }> {
  const { data } = await api.get(`${base(orgId)}/events`, { params: { serialNumber } })
  return data
}
