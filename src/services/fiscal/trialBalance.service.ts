/**
 * Balanza de comprobación service — read-model sobre pólizas. Gated PREMIUM (CFDI).
 *   GET /api/v1/dashboard/venues/:venueId/accounting/trial-balance?period=YYYY-MM
 * Money en CENTAVOS enteros. Saldos en NETO con signo (+ = deudor, − = acreedor).
 */
import api from '@/api'

export interface TrialBalanceRow {
  code: string
  name: string
  type: string
  nature: string
  saldoInicialCents: number
  debeCents: number
  haberCents: number
  saldoFinalCents: number
}

export interface TrialBalanceResponse {
  needsFiscalSetup: boolean
  organizationId: string | null
  rfc: string | null
  period: string
  rows: TrialBalanceRow[]
  totals: {
    debeCents: number
    haberCents: number
    saldoInicialDeudorCents: number
    saldoInicialAcreedorCents: number
    saldoFinalDeudorCents: number
    saldoFinalAcreedorCents: number
  }
  balanced: { movements: boolean; balances: boolean }
}

export async function getTrialBalance(venueId: string, period?: string): Promise<TrialBalanceResponse> {
  const res = await api.get<TrialBalanceResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/trial-balance`, {
    params: period ? { period } : {},
  })
  return res.data
}

export const trialBalanceKeys = {
  all: ['trialBalance'] as const,
  byPeriod: (venueId: string | null, period: string) => [...trialBalanceKeys.all, venueId, period] as const,
}
