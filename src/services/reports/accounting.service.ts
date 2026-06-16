/**
 * Accounting (Capa A) Report Service — Resumen del negocio + Bancos y cajas.
 *
 * API client for the two read-model accounting sections:
 *   GET /api/v1/dashboard/venues/:venueId/accounting/business-summary
 *   GET /api/v1/dashboard/venues/:venueId/accounting/banks
 *
 * The backend returns each object directly (no { success, data } envelope) with
 * ALL money fields in INTEGER CENTS — divide by 100 (or use Currency(x, true)) to display.
 */
import api from '@/api'

export interface BusinessSummaryResponse {
  venueId: string
  venueName: string
  currency: 'MXN'
  timezone: string
  period: { from: string; to: string }
  taxRateAssumed: number
  revenue: {
    grossSalesCents: number
    refundsCents: number
    netRevenueCents: number
    taxableBaseCents: number
    ivaCents: number
  }
  invoicing: {
    stampedCount: number
    stampedTotalCents: number
    nominativeCount: number
    globalCount: number
    invoicedApproxCents: number
    uninvoicedApproxCents: number
    invoicedPct: number
  }
  collection: { cashCents: number; electronicCents: number; cashPct: number }
  costs: { processingFeesCents: number }
  result: { netAfterFeesCents: number }
  tips: { totalCents: number }
  reconciliation: { statements: number; lineCount: number; matchedCount: number }
  metrics: { salesCount: number; refundCount: number; averageTicketCents: number }
}

export type AccountKind = 'cash' | 'bank'

export interface BankAccountBucket {
  key: string
  kind: AccountKind
  methods: string[]
  inflowCents: number
  count: number
}

export interface BankAndCashResponse {
  venueId: string
  venueName: string
  currency: 'MXN'
  timezone: string
  period: { from: string; to: string }
  accounts: BankAccountBucket[]
  totals: {
    cashInflowCents: number
    electronicInflowCents: number
    feesCents: number
    netToBankCents: number
  }
  reconciliation: { statements: number; lineCount: number; matchedCount: number }
}

/** Resumen del negocio (portada de Contabilidad) para el periodo [from, to] (zona del local). */
export async function fetchBusinessSummary(venueId: string, from: string, to: string): Promise<BusinessSummaryResponse> {
  const res = await api.get<BusinessSummaryResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/business-summary`, {
    params: { from, to },
  })
  return res.data
}

/** Bancos y cajas — cuentas de dinero del local para el periodo [from, to] (zona del local). */
export async function fetchBankAndCash(venueId: string, from: string, to: string): Promise<BankAndCashResponse> {
  const res = await api.get<BankAndCashResponse>(`/api/v1/dashboard/venues/${venueId}/accounting/banks`, {
    params: { from, to },
  })
  return res.data
}

export const accountingKeys = {
  all: ['accounting'] as const,
  businessSummary: (venueId: string | null, from: string, to: string) =>
    [...accountingKeys.all, 'businessSummary', venueId, from, to] as const,
  banks: (venueId: string | null, from: string, to: string) => [...accountingKeys.all, 'banks', venueId, from, to] as const,
}
