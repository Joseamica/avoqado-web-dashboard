import api from '@/api'
import type { AmountFilter } from '@/components/filters'
import type { PaymentsSummaryData } from '@/pages/Payment/paymentSummary'

/**
 * Filtros del listado de pagos (los que viajan al servidor desde siempre).
 */
export interface PaymentListFilters {
  merchantAccountIds?: string[]
  methods?: string[]
  sources?: string[]
  staffIds?: string[]
  search?: string
  startDate?: string
  endDate?: string
}

/**
 * Los filtros que la pantalla aplicaba en el navegador sobre 10,000 filas y que ahora
 * viajan al resumen (2026-09-01): rangos de subtotal/propina/total, internacional y marca.
 */
export interface PaymentClientFilters {
  subtotal?: AmountFilter | null
  tip?: AmountFilter | null
  total?: AmountFilter | null
  international?: string[]
  cardBrands?: string[]
}

export interface PaymentFilterOptions {
  merchantAccounts: Array<{ id: string; displayName: string | null; externalMerchantId: string }>
  methods: string[]
  sources: string[]
  waiters: Array<{ id: string; firstName: string; lastName: string }>
  cardBrands: string[]
}

export function listFilterParams(filters: PaymentListFilters): Record<string, string> {
  return {
    ...(filters.merchantAccountIds &&
      filters.merchantAccountIds.length > 0 && { merchantAccountIds: filters.merchantAccountIds.join(',') }),
    ...(filters.methods && filters.methods.length > 0 && { methods: filters.methods.join(',') }),
    ...(filters.sources && filters.sources.length > 0 && { sources: filters.sources.join(',') }),
    ...(filters.staffIds && filters.staffIds.length > 0 && { staffIds: filters.staffIds.join(',') }),
    ...(filters.search && { search: filters.search }),
    ...(filters.startDate && { startDate: filters.startDate }),
    ...(filters.endDate && { endDate: filters.endDate }),
  }
}

/** `subtotalOp=gt&subtotalValue=100` … a partir de un `AmountFilter`. Sin filtro no manda nada. */
export function amountFilterParams(prefix: string, filter: AmountFilter | null | undefined): Record<string, string> {
  if (!filter) return {}
  const out: Record<string, string> = { [`${prefix}Op`]: filter.operator }
  if (filter.value !== undefined && filter.value !== null) out[`${prefix}Value`] = String(filter.value)
  if (filter.value2 !== undefined && filter.value2 !== null) out[`${prefix}Value2`] = String(filter.value2)
  return out
}

export function clientFilterParams(client: PaymentClientFilters): Record<string, string> {
  return {
    ...amountFilterParams('subtotal', client.subtotal),
    ...amountFilterParams('tip', client.tip),
    ...amountFilterParams('total', client.total),
    ...(client.international && client.international.length > 0 && { international: client.international.join(',') }),
    ...(client.cardBrands && client.cardBrands.length > 0 && { cardBrands: client.cardBrands.join(',') }),
  }
}

export const getPaymentsSummary = async (venueId: string, filters: PaymentListFilters, client: PaymentClientFilters) => {
  const response = await api.get<{ success: boolean; data: PaymentsSummaryData }>(`/api/v1/dashboard/venues/${venueId}/payments/summary`, {
    params: { ...listFilterParams(filters), ...clientFilterParams(client) },
  })
  return response.data.data
}

export const getPaymentFilterOptions = async (venueId: string) => {
  const response = await api.get<{ success: boolean; data: PaymentFilterOptions }>(
    `/api/v1/dashboard/venues/${venueId}/payments/filter-options`,
  )
  return response.data.data
}
