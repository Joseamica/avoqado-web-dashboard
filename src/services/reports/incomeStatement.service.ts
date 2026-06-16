/**
 * Income Statement (Capa A) Report Service
 *
 * API client for the venue income-statement tablero ("¿Cuánto gané?").
 * Calls GET /api/v1/dashboard/venues/:venueId/accounting/income-statement.
 * The backend returns the object directly (no { success, data } envelope) with
 * ALL money fields in INTEGER CENTS — divide by 100 (or use Currency(x, true)) for display.
 */
import api from '@/api'

export interface IncomeStatementResponse {
  venueId: string
  venueName: string
  currency: 'MXN'
  timezone: string
  period: { from: string; to: string } // YYYY-MM-DD
  taxRateAssumed: number // e.g. 0.16
  revenue: {
    grossSalesCents: number
    refundsCents: number
    netRevenueCents: number
    taxableBaseCents: number
    ivaCents: number
  }
  tips: { totalCents: number }
  metrics: {
    salesCount: number
    refundCount: number
    averageTicketCents: number
  }
}

/**
 * Fetch the income statement for a venue over a date range.
 * @param from YYYY-MM-DD (venue timezone, inclusive)
 * @param to   YYYY-MM-DD (venue timezone, inclusive)
 */
export async function fetchIncomeStatement(venueId: string, from: string, to: string): Promise<IncomeStatementResponse> {
  const res = await api.get<IncomeStatementResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/income-statement`, {
    params: { from, to },
  })
  return res.data
}

export const incomeStatementKeys = {
  all: ['incomeStatement'] as const,
  report: (venueId: string | null, from: string, to: string) => [...incomeStatementKeys.all, venueId, from, to] as const,
}
