import api from '@/api'

/**
 * Cash Closeout Service (Cortes de Caja)
 *
 * API client for cash register closeouts.
 * Enables businesses to track expected vs actual cash when depositing/storing.
 */

export type DepositMethod = 'BANK_DEPOSIT' | 'SAFE' | 'OWNER_WITHDRAWAL' | 'NEXT_SHIFT'

export interface CashExpected {
  expectedAmount: number
  periodStart: string
  transactionCount: number
  daysSinceLastCloseout: number
  hasCloseouts: boolean
}

export interface CashCloseout {
  id: string
  venueId: string
  periodStart: string
  periodEnd: string
  expectedAmount: number
  actualAmount: number
  variance: number
  variancePercent: number | null
  depositMethod: DepositMethod
  bankReference: string | null
  notes: string | null
  closedBy: {
    id: string
    firstName: string
    lastName: string
  }
  createdAt: string
  updatedAt: string
}

export interface CreateCloseoutParams {
  actualAmount: number
  depositMethod: DepositMethod
  bankReference?: string
  notes?: string
}

/**
 * Get expected cash amount since last closeout
 */
export async function getExpectedCash(venueId: string): Promise<CashExpected> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/cash-closeouts/expected`, {
    withCredentials: true,
  })
  return res.data.data
}

/**
 * Create a new cash closeout
 */
export async function createCashCloseout(
  venueId: string,
  data: CreateCloseoutParams,
): Promise<{ success: boolean; data: CashCloseout; message: string }> {
  const res = await api.post(`/api/v1/dashboard/venues/${venueId}/cash-closeouts`, data, {
    withCredentials: true,
  })
  return res.data
}

/**
 * Get closeout history with pagination
 */
export async function getCloseoutHistory(
  venueId: string,
  page: number = 1,
  pageSize: number = 10,
): Promise<{
  success: boolean
  data: CashCloseout[]
  pagination: {
    page: number
    pageSize: number
    total: number
    totalPages: number
  }
}> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/cash-closeouts`, {
    params: { page, pageSize },
    withCredentials: true,
  })
  return res.data
}

/**
 * Get a single closeout by ID
 */
export async function getCloseoutById(
  venueId: string,
  closeoutId: string,
): Promise<{ success: boolean; data: CashCloseout }> {
  const res = await api.get(`/api/v1/dashboard/venues/${venueId}/cash-closeouts/${closeoutId}`, {
    withCredentials: true,
  })
  return res.data
}
