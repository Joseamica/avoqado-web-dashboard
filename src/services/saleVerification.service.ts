/**
 * Sale Verification Service
 *
 * Service for fetching sale verification data for the Sales Report dashboard.
 * Includes staff and payment details for proof-of-sale images.
 */

import api from '@/api'

// ============================================================
// Types
// ============================================================

export type SaleVerificationStatus = 'PENDING' | 'COMPLETED' | 'FAILED'

export interface ScannedProduct {
  barcode: string
  format: string
  productName?: string | null
  productId?: string | null
  hasInventory: boolean
  quantity: number
}

export interface SaleVerificationStaff {
  id: string
  firstName: string
  lastName: string
  email: string
  photoUrl?: string | null
}

export interface SaleVerificationPayment {
  id: string
  amount: number
  status: string
  createdAt: string
  order?: {
    id: string
    orderNumber: string
    total: number
    tags?: string[]
  } | null
}

export interface SaleVerification {
  id: string
  venueId: string
  paymentId: string
  staffId: string
  photos: string[]
  scannedProducts: ScannedProduct[]
  status: SaleVerificationStatus
  inventoryDeducted: boolean
  deviceId: string | null
  notes: string | null
  createdAt: string
  updatedAt: string
  /** True if this payment has an associated sale verification record */
  hasVerification: boolean
  staff: SaleVerificationStaff | null
  payment: SaleVerificationPayment | null
}

export interface SaleVerificationPagination {
  pageSize: number
  pageNumber: number
  totalCount: number
  totalPages: number
}

export interface ListSaleVerificationsResponse {
  success: boolean
  data: SaleVerification[]
  pagination: SaleVerificationPagination
}

export interface SaleVerificationSummary {
  totalRevenue: number
  totalCount: number
  conciliatedCount: number
  pendingCount: number
  completedCount: number
  failedCount: number
  avgAmount: number
  /** Count of payments without any sale verification */
  withoutVerificationCount: number
}

export interface DailySalesData {
  date: string
  revenue: number
  count: number
}

export interface StaffWithVerifications {
  id: string
  firstName: string
  lastName: string
  verificationCount: number
}

// ============================================================
// Query Parameters
// ============================================================

export interface ListSaleVerificationsParams {
  pageSize?: number
  pageNumber?: number
  status?: SaleVerificationStatus
  staffId?: string
  fromDate?: string
  toDate?: string
  search?: string
}

export interface SummaryParams {
  fromDate?: string
  toDate?: string
}

export interface DailyDataParams {
  fromDate?: string
  toDate?: string
}

// ============================================================
// API Functions
// ============================================================

/**
 * List sale verifications with staff and payment details
 */
export async function listSaleVerifications(
  venueId: string,
  params: ListSaleVerificationsParams = {},
): Promise<ListSaleVerificationsResponse> {
  const queryParams = new URLSearchParams()

  if (params.pageSize) queryParams.set('pageSize', params.pageSize.toString())
  if (params.pageNumber) queryParams.set('pageNumber', params.pageNumber.toString())
  if (params.status) queryParams.set('status', params.status)
  if (params.staffId) queryParams.set('staffId', params.staffId)
  if (params.fromDate) queryParams.set('fromDate', params.fromDate)
  if (params.toDate) queryParams.set('toDate', params.toDate)
  if (params.search) queryParams.set('search', params.search)

  const url = `/api/v1/dashboard/venues/${venueId}/sale-verifications?${queryParams.toString()}`
  const response = await api.get(url)

  return {
    success: response.data.success,
    data: response.data.data,
    pagination: response.data.pagination,
  }
}

/**
 * Get summary statistics for sale verifications
 */
export async function getSaleVerificationsSummary(
  venueId: string,
  params: SummaryParams = {},
): Promise<SaleVerificationSummary> {
  const queryParams = new URLSearchParams()

  if (params.fromDate) queryParams.set('fromDate', params.fromDate)
  if (params.toDate) queryParams.set('toDate', params.toDate)

  const url = `/api/v1/dashboard/venues/${venueId}/sale-verifications/summary?${queryParams.toString()}`
  const response = await api.get(url)

  return response.data.data
}

/**
 * Get daily sales data for charts
 */
export async function getDailySalesData(
  venueId: string,
  params: DailyDataParams = {},
): Promise<DailySalesData[]> {
  const queryParams = new URLSearchParams()

  if (params.fromDate) queryParams.set('fromDate', params.fromDate)
  if (params.toDate) queryParams.set('toDate', params.toDate)

  const url = `/api/v1/dashboard/venues/${venueId}/sale-verifications/daily?${queryParams.toString()}`
  const response = await api.get(url)

  return response.data.data
}

/**
 * Get staff list with verification counts for filter dropdown
 */
export async function getStaffWithVerifications(venueId: string): Promise<StaffWithVerifications[]> {
  const url = `/api/v1/dashboard/venues/${venueId}/sale-verifications/staff`
  const response = await api.get(url)

  return response.data.data
}
