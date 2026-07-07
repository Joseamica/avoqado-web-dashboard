import api from '@/api'

/**
 * Cash Out (PlayTelecom promoter same-day commission) API client.
 * Backend: /api/v1/dashboard/cash-out/* — gated by SERIALIZED_INVENTORY + cash-out:* perms.
 * Amounts are PESOS (1:1), as strings to preserve Decimal precision.
 */

const BASE = (venueId: string) => `/api/v1/dashboard/cash-out/venues/${venueId}`
const ORG_BASE = (orgId: string) => `/api/v1/dashboard/organizations/${orgId}/cash-out`

export type CashOutSaleType = 'LINEA_NUEVA' | 'PORTABILIDAD'
export type CashOutWithdrawalStatus = 'REQUESTED' | 'REPORTED' | 'PAID' | 'FAILED'

export interface CashOutRate {
  id?: string
  saleType: CashOutSaleType
  minCount: number
  maxCount: number | null // null = open-ended top tier
  amount: number // pesos
}

export interface CashOutWithdrawal {
  id: string
  folio: string
  staffId: string
  promoterName?: string // resolved display name (falls back to staffId)
  status: CashOutWithdrawalStatus
  grossAmount: string // pesos
  netAmount: string // pesos
  clabe: string | null
  businessDate: string // yyyy-MM-dd (or ISO)
  createdAt: string
  reportedAt: string | null
  paidAt: string | null
}

export interface DispersionRow {
  withdrawalId: string
  folio: string
  promoterId: string
  promoterName: string
  clabe: string | null
  netAmount: string // pesos
}

export interface DispersionReport {
  venueId: string
  rows: DispersionRow[]
  totalNet: string // pesos
  count: number
}

// The org-wide report aggregates across all the org's venues, so it is keyed by
// orgId and (unlike the per-venue report) has no venueId.
export type OrgDispersionReport = Omit<DispersionReport, 'venueId'> & { orgId: string }

const unwrap = <T>(payload: unknown): T => {
  if (payload && typeof payload === 'object' && 'data' in (payload as Record<string, unknown>)) {
    return (payload as { data: T }).data
  }
  return payload as T
}

export const cashOutService = {
  // --- Config: escalated rate table ---
  getRates: async (venueId: string): Promise<CashOutRate[]> => {
    const res = await api.get(`${BASE(venueId)}/commission-rates`)
    return unwrap<CashOutRate[]>(res.data) ?? []
  },
  saveRates: async (venueId: string, rates: CashOutRate[]): Promise<CashOutRate[]> => {
    const res = await api.put(`${BASE(venueId)}/commission-rates`, { rates })
    return unwrap<CashOutRate[]>(res.data) ?? []
  },

  // --- Config: active-days calendar ---
  getActiveDays: async (venueId: string, from?: string, to?: string): Promise<string[]> => {
    const res = await api.get(`${BASE(venueId)}/active-days`, { params: { from, to } })
    return unwrap<string[]>(res.data) ?? []
  },
  saveActiveDays: async (venueId: string, days: string[]): Promise<string[]> => {
    const res = await api.put(`${BASE(venueId)}/active-days`, { days })
    return unwrap<string[]>(res.data) ?? []
  },

  // --- Saldo + withdrawals ---
  getSaldo: async (venueId: string, staffId: string): Promise<{ venueId: string; staffId: string; saldo: string }> => {
    const res = await api.get(`${BASE(venueId)}/promoters/${staffId}/saldo`)
    return unwrap(res.data)
  },
  withdraw: async (venueId: string, staffId: string): Promise<{ id: string; folio: string; grossAmount: string; netAmount: string; entries: number }> => {
    const res = await api.post(`${BASE(venueId)}/promoters/${staffId}/withdraw`)
    return unwrap(res.data)
  },
  listWithdrawals: async (venueId: string, params?: { status?: CashOutWithdrawalStatus; businessDate?: string }): Promise<CashOutWithdrawal[]> => {
    const res = await api.get(`${BASE(venueId)}/withdrawals`, { params })
    return unwrap<CashOutWithdrawal[]>(res.data) ?? []
  },

  // --- Finanzas dispersion report (corte: marks REQUESTED -> REPORTED) ---
  generateReport: async (venueId: string, businessDate?: string): Promise<DispersionReport> => {
    const res = await api.post(`${BASE(venueId)}/report`, businessDate ? { businessDate } : {})
    return unwrap<DispersionReport>(res.data)
  },

  // --- Org-level (organization-wide cash-out config/reporting) ---
  getOrgRates: async (orgId: string): Promise<CashOutRate[]> => {
    const res = await api.get(`${ORG_BASE(orgId)}/commission-rates`)
    return unwrap<CashOutRate[]>(res.data) ?? []
  },
  saveOrgRates: async (orgId: string, rates: CashOutRate[]): Promise<CashOutRate[]> => {
    const res = await api.put(`${ORG_BASE(orgId)}/commission-rates`, { rates })
    return unwrap<CashOutRate[]>(res.data) ?? []
  },
  getOrgActiveDays: async (orgId: string, from?: string, to?: string): Promise<string[]> => {
    const res = await api.get(`${ORG_BASE(orgId)}/active-days`, { params: { from, to } })
    return unwrap<string[]>(res.data) ?? []
  },
  saveOrgActiveDays: async (orgId: string, days: string[]): Promise<string[]> => {
    const res = await api.put(`${ORG_BASE(orgId)}/active-days`, { days })
    return unwrap<string[]>(res.data) ?? []
  },
  listOrgWithdrawals: async (
    orgId: string,
    params?: { status?: CashOutWithdrawalStatus; businessDate?: string },
  ): Promise<Array<CashOutWithdrawal & { venueName?: string }>> => {
    const res = await api.get(`${ORG_BASE(orgId)}/withdrawals`, { params })
    return unwrap<Array<CashOutWithdrawal & { venueName?: string }>>(res.data) ?? []
  },
  generateOrgReport: async (orgId: string, businessDate?: string): Promise<OrgDispersionReport> => {
    const res = await api.post(`${ORG_BASE(orgId)}/report`, businessDate ? { businessDate } : {})
    return unwrap<OrgDispersionReport>(res.data)
  },
}
