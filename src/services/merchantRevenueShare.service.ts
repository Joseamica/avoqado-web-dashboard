/**
 * MerchantRevenueShare API client — revenue-share configurable por merchant.
 * Spec: docs/superpowers/specs/2026-05-22-revenue-share-fee-model-design.md
 */
import api from '@/api'

// ===== TYPES =====

export type CardRates = { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }

export interface MerchantRevenueShare {
  id: string
  merchantAccountId: string
  /** `null` = venta directa (sin agregador). */
  aggregatorPrice: CardRates | null
  aggregatorPriceIncludesTax: boolean
  /** Decimal llega como string desde la API. Convertir a Number en UI. */
  avoqadoShareOfProviderMargin: string
  avoqadoShareOfAggregatorMargin: string | null
  taxRate: string
  active: boolean
  notes: string | null
  createdAt: string
  updatedAt: string
  merchantAccount?: {
    id: string
    externalMerchantId: string
    alias: string | null
    displayName: string | null
    providerId: string
    aggregatorId: string | null
  }
}

export interface CreateMerchantRevenueShareInput {
  merchantAccountId: string
  aggregatorPrice?: CardRates | null
  aggregatorPriceIncludesTax?: boolean
  /** 0..1 (50% = 0.5). Default backend = 0.5. */
  avoqadoShareOfProviderMargin?: number
  avoqadoShareOfAggregatorMargin?: number | null
  taxRate?: number
  active?: boolean
  notes?: string
}

export type UpdateMerchantRevenueShareInput = Partial<Omit<CreateMerchantRevenueShareInput, 'merchantAccountId'>>

export interface MerchantRevenueRow {
  merchantAccountId: string
  merchantLabel: string
  providerCode: string
  hasAggregator: boolean
  hasShareConfig: boolean
  txCount: number
  volume: number
  providerNet: number
  avoqadoNet: number
  aggregatorNet: number
}

export interface RevenueShareReport {
  data: MerchantRevenueRow[]
  meta: {
    count: number
    totals: {
      txCount: number
      volume: number
      providerNet: number
      avoqadoNet: number
      aggregatorNet: number
    }
  }
}

// ===== API =====

const BASE = '/api/v1/dashboard/superadmin/merchant-revenue-shares'

export const merchantRevenueShareAPI = {
  getAll: async (filters?: { active?: boolean }): Promise<MerchantRevenueShare[]> => {
    const params = new URLSearchParams()
    if (filters?.active !== undefined) params.set('active', String(filters.active))
    const { data } = await api.get(`${BASE}?${params}`)
    return data.data
  },

  getByMerchant: async (merchantAccountId: string): Promise<MerchantRevenueShare | null> => {
    const { data } = await api.get(`${BASE}/by-merchant`, { params: { merchantAccountId } })
    return data.data
  },

  getById: async (id: string): Promise<MerchantRevenueShare | null> => {
    const { data } = await api.get(`${BASE}/${id}`)
    return data.data
  },

  create: async (input: CreateMerchantRevenueShareInput): Promise<MerchantRevenueShare> => {
    const { data } = await api.post(BASE, input)
    return data.data
  },

  update: async (id: string, input: UpdateMerchantRevenueShareInput): Promise<MerchantRevenueShare> => {
    const { data } = await api.put(`${BASE}/${id}`, input)
    return data.data
  },

  remove: async (id: string): Promise<void> => {
    await api.delete(`${BASE}/${id}`)
  },

  /** Reporte de revenue-share por merchant en el periodo dado. */
  getReport: async (filters: { from: Date; to: Date; venueId?: string }): Promise<RevenueShareReport> => {
    const params = new URLSearchParams({
      from: filters.from.toISOString(),
      to: filters.to.toISOString(),
    })
    if (filters.venueId) params.set('venueId', filters.venueId)
    const { data } = await api.get(`${BASE}/report?${params}`)
    return { data: data.data, meta: data.meta }
  },
}
