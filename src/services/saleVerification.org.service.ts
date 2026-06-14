/**
 * Org-Scoped Sale Verification Service (PlayTelecom / Walmart)
 *
 * Client for the org-level "Ventas" view that lets back-office approve
 * or reject SIM-sale documentation across all venues in the org.
 *
 * Backend endpoints: /api/v1/dashboard/organizations/:orgId/sale-verifications/*
 */

import api from '@/api'
import type { SaleVerificationRejectionReason, SaleVerificationStatus } from './saleVerification.service'

// ============================================================
// Types
// ============================================================

export type PaymentMethod = 'CASH' | 'CREDIT_CARD' | 'DEBIT_CARD' | 'DIGITAL_WALLET' | 'BANK_TRANSFER' | 'CRYPTOCURRENCY' | 'OTHER'

export type SaleType = 'LINEA_NUEVA' | 'PORTABILIDAD' | 'ESIM'

export type PaymentForm = 'CASH' | 'CARD' | 'OTHER' | 'NONE'

export const SALE_TYPE_LABELS: Record<SaleType, string> = {
  LINEA_NUEVA: 'Línea nueva',
  PORTABILIDAD: 'Portabilidad',
  ESIM: 'eSIM',
}

export const PAYMENT_FORM_LABELS: Record<PaymentForm, string> = {
  CASH: 'Efectivo',
  CARD: 'Tarjeta',
  OTHER: 'Otro',
  NONE: 'No aplica',
}

export interface OrgSaleVenue {
  id: string
  name: string
  city: string | null
  slug: string
}

export interface OrgSaleStaff {
  id: string
  firstName: string
  lastName: string
  email: string | null
  photoUrl: string | null
}

export interface OrgSaleReviewer {
  id: string
  firstName: string
  lastName: string
}

export interface OrgSalePayment {
  id: string
  amount: number
  method: PaymentMethod
  paymentForm: PaymentForm
  status: string
  createdAt: string
}

export interface OrgSaleCategory {
  id: string
  name: string
}

export interface OrgSaleRegisteredFromVenue {
  id: string
  name: string
  slug: string
}

export interface OrgSaleTerminal {
  id: string
  name: string
  serialNumber: string
}

export interface OrgSaleRow {
  id: string
  paymentId: string
  status: SaleVerificationStatus
  isPortabilidad: boolean
  saleType: SaleType
  photos: string[]
  serialNumbers: string[]
  reviewedById: string | null
  reviewedAt: string | null
  reviewNotes: string | null
  rejectionReasons: SaleVerificationRejectionReason[]
  createdAt: string
  updatedAt: string
  venue: OrgSaleVenue
  staff: OrgSaleStaff | null
  reviewedBy: OrgSaleReviewer | null
  payment: OrgSalePayment | null
  category: OrgSaleCategory | null
  registeredFromVenue: OrgSaleRegisteredFromVenue | null
  /** TPV terminal that captured the sale (resolved from deviceId). Null if no match. */
  terminal: OrgSaleTerminal | null
}

export interface OrgSalePagination {
  pageSize: number
  pageNumber: number
  totalCount: number
  totalPages: number
}

export interface OrgSaleListResponse {
  success: boolean
  data: OrgSaleRow[]
  pagination: OrgSalePagination
}

export interface OrgSalesSummary {
  totalRevenue: number
  /**
   * Revenue from CONFIRMED sales only (SaleVerification.status=COMPLETED).
   * Optional for backwards compat with backends that don't return it yet.
   */
  confirmedRevenue?: number
  totalCount: number
  completedCount: number
  pendingCount: number
  failedCount: number
  withoutVerificationCount: number
}

export interface SalesByMonthRow {
  month: string
  count: number
  revenue: number
}

export interface SalesBySimTypeRow {
  month: string
  byCategory: Record<string, number>
  total: number
}

export interface SalesByWeekRow {
  week: string
  count: number
  revenue: number
}

export interface SalesByCityRow {
  city: string
  byMonth: Record<string, number>
  total: number
}

export interface SalesBySupervisorRow {
  supervisorId: string | null
  supervisorName: string
  byWeek: Record<string, number>
  /** Month buckets ("2026-03"). Optional for backwards compat with older backends. */
  byMonth?: Record<string, number>
  total: number
}

export interface SalesByStoreRow {
  venueId: string
  venueName: string
  byWeek: Record<string, number>
  /** Month buckets ("2026-03"). Optional for backwards compat with older backends. */
  byMonth?: Record<string, number>
  total: number
}

export interface SalesByPromoterRow {
  staffId: string | null
  promoterName: string
  byMonth: Record<string, number>
  total: number
}

export interface PromoterDailyRow {
  staffId: string | null
  promoterName: string
  /** Confirmed (COMPLETED) sales per day key ("YYYY-MM-DD"). */
  byDay: Record<string, number>
  /** Confirmed total for the current month (sum of byDay). Excludes toReview. */
  total: number
  /** FAILED sales the promoter must fix on the TPV ("Pendientes de revisar"). NOT in total. */
  toReview: number
}

export interface PromoterDailyResult {
  /** Current month "YYYY-MM". */
  month: string
  /** Ordered day keys of the current month, day 1 → today (venue tz). */
  days: string[]
  rows: PromoterDailyRow[]
}

// ============================================================
// Query Parameters
// ============================================================

export interface ListOrgSalesParams {
  pageSize?: number
  pageNumber?: number
  status?: SaleVerificationStatus
  staffId?: string
  venueId?: string
  categoryId?: string
  isPortabilidad?: boolean
  paymentMethod?: PaymentMethod
  fromDate?: string
  toDate?: string
  search?: string
}

export interface RangeParams {
  fromDate?: string
  toDate?: string
}

// ============================================================
// API Functions
// ============================================================

function buildQuery(params: object): string {
  const q = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
  }
  const s = q.toString()
  return s ? `?${s}` : ''
}

export async function listOrgSaleVerifications(orgId: string, params: ListOrgSalesParams = {}): Promise<OrgSaleListResponse> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications${buildQuery(params)}`
  const response = await api.get(url)
  return { success: response.data.success, data: response.data.data, pagination: response.data.pagination }
}

export async function getOrgSalesSummary(orgId: string, params: RangeParams = {}): Promise<OrgSalesSummary> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/summary${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesByMonth(orgId: string, params: RangeParams = {}): Promise<SalesByMonthRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-month${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesBySimType(orgId: string, params: RangeParams = {}): Promise<SalesBySimTypeRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-sim-type${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesByWeek(orgId: string, params: RangeParams = {}): Promise<SalesByWeekRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-week${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesByCity(orgId: string, params: RangeParams = {}): Promise<SalesByCityRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-city${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesBySupervisor(orgId: string, params: RangeParams = {}): Promise<SalesBySupervisorRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-supervisor${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesByStore(orgId: string, params: RangeParams = {}): Promise<SalesByStoreRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-store${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesByPromoter(orgId: string, params: RangeParams = {}): Promise<SalesByPromoterRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-promoter${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

/**
 * "Ventas Totales por Promotor por día" — current month only. Per promoter:
 * confirmed sales per day, monthly total, and a `toReview` count of FAILED
 * sales the promoter must fix on the TPV. Always current month (no range).
 */
export async function getSalesByPromoterDaily(orgId: string): Promise<PromoterDailyResult> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-promoter-daily`
  const response = await api.get(url)
  return response.data.data
}

export interface ReviewOrgSaleParams {
  decision: 'APPROVE' | 'REJECT'
  /** Required when decision = REJECT (unless reviewNotes is provided). */
  rejectionReasons?: SaleVerificationRejectionReason[]
  /** Free-text feedback shown to the promoter on TPV. */
  reviewNotes?: string
}

/**
 * Approve or reject a sale verification at org scope.
 * Backend emits `sale-verification.reviewed` socket event to the promoter
 * so the TPV refreshes the "Mis Ventas" screen in real time.
 */
export async function reviewOrgSaleVerification(orgId: string, saleVerificationId: string, params: ReviewOrgSaleParams): Promise<unknown> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleVerificationId}/review`
  const response = await api.patch(url, params)
  return response.data.data
}

/**
 * Reopen an approved (COMPLETED) sale verification — flips it back to PENDING
 * so the back-office can re-evaluate. OWNER-only (gated by the backend
 * `sale-verifications:reopen` permission). The reason is mandatory (min 5
 * chars) and is recorded in server logs for audit. SIM/payment/commission
 * state is NOT touched by the backend — only the verification status moves.
 */
export async function reopenOrgSaleVerification(
  orgId: string,
  saleVerificationId: string,
  params: { reason: string },
): Promise<unknown> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleVerificationId}/reopen`
  const response = await api.post(url, params)
  return response.data.data
}

export interface EditOrgSaleParams {
  /** Payment.amount (MXN). */
  amount?: number
  /** Maps to Payment.method on the backend. */
  paymentForm?: 'CASH' | 'CARD' | 'OTHER'
  /** Tipo de venta: true = Portabilidad, false = Línea nueva. */
  isPortabilidad?: boolean
  status?: SaleVerificationStatus
  /** Mandatory, min 5 chars — recorded in the audit log. */
  reason: string
}

/**
 * Edit/correct a sale at org scope (OWNER-only, `sale-verifications:edit`).
 * Returns the updated verification; callers should invalidate the list +
 * summary queries.
 */
export async function editOrgSaleVerification(
  orgId: string,
  saleVerificationId: string,
  params: EditOrgSaleParams,
): Promise<unknown> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/${saleVerificationId}`
  const response = await api.patch(url, params)
  return response.data.data
}
