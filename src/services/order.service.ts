import api from '@/api'
import { Order } from '@/types'

export interface OrderFilters {
  // Multi-select filter arrays (sent as comma-separated strings to backend)
  statuses?: string[]
  types?: string[]
  tableIds?: string[]
  staffIds?: string[]
  search?: string
  startDate?: string
  endDate?: string
}

export const getOrders = async (venueId: string, pagination: { pageIndex: number; pageSize: number }, filters?: OrderFilters) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/orders`, {
    params: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(filters?.statuses && filters.statuses.length > 0 && { statuses: filters.statuses.join(',') }),
      ...(filters?.types && filters.types.length > 0 && { types: filters.types.join(',') }),
      ...(filters?.tableIds && filters.tableIds.length > 0 && { tableIds: filters.tableIds.join(',') }),
      ...(filters?.staffIds && filters.staffIds.length > 0 && { staffIds: filters.staffIds.join(',') }),
      ...(filters?.search && { search: filters.search }),
      ...(filters?.startDate && { startDate: filters.startDate }),
      ...(filters?.endDate && { endDate: filters.endDate }),
    },
  })
  return response.data
}

export const getOrder = async (venueId: string, orderId: string) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}`)
  return response.data
}

export const updateOrder = async (venueId: string, orderId: string, updatedOrder: Partial<Order>) => {
  const response = await api.put(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}`, updatedOrder)
  return response.data
}

export const deleteOrder = async (venueId: string, orderId: string) => {
  const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/orders/${orderId}`)
  return response.data
}

// ─── Resumen y opciones de filtro (2026-09-01) ─────────────────────────────────
// La pantalla pedía el listado con pageSize 10000 para contar pestañas y sumar tarjetas
// en el navegador; ahora lo contesta el servidor con un GROUP BY.

import type { AmountFilter } from '@/components/filters'
import type { OrdersSummaryData } from '@/pages/Order/orderSummary'

export interface OrderClientFilters {
  total?: AmountFilter | null
  tip?: AmountFilter | null
}

export interface OrderFilterOptions {
  statuses: string[]
  types: string[]
  hasFastSales: boolean
  tables: Array<{ id: string; number: string }>
  waiters: Array<{ id: string; firstName: string; lastName: string }>
}

function orderListFilterParams(filters?: OrderFilters): Record<string, string> {
  return {
    ...(filters?.statuses && filters.statuses.length > 0 && { statuses: filters.statuses.join(',') }),
    ...(filters?.types && filters.types.length > 0 && { types: filters.types.join(',') }),
    ...(filters?.tableIds && filters.tableIds.length > 0 && { tableIds: filters.tableIds.join(',') }),
    ...(filters?.staffIds && filters.staffIds.length > 0 && { staffIds: filters.staffIds.join(',') }),
    ...(filters?.search && { search: filters.search }),
    ...(filters?.startDate && { startDate: filters.startDate }),
    ...(filters?.endDate && { endDate: filters.endDate }),
  }
}

function orderAmountFilterParams(prefix: string, filter: AmountFilter | null | undefined): Record<string, string> {
  if (!filter) return {}
  const out: Record<string, string> = { [`${prefix}Op`]: filter.operator }
  if (filter.value !== undefined && filter.value !== null) out[`${prefix}Value`] = String(filter.value)
  if (filter.value2 !== undefined && filter.value2 !== null) out[`${prefix}Value2`] = String(filter.value2)
  return out
}

export const getOrdersSummary = async (venueId: string, filters: OrderFilters, client: OrderClientFilters) => {
  const response = await api.get<{ success: boolean; data: OrdersSummaryData }>(`/api/v1/dashboard/venues/${venueId}/orders/summary`, {
    params: {
      ...orderListFilterParams(filters),
      ...orderAmountFilterParams('total', client.total),
      ...orderAmountFilterParams('tip', client.tip),
    },
  })
  return response.data.data
}

export const getOrderFilterOptions = async (venueId: string) => {
  const response = await api.get<{ success: boolean; data: OrderFilterOptions }>(
    `/api/v1/dashboard/venues/${venueId}/orders/filter-options`,
  )
  return response.data.data
}
