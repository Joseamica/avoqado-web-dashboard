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
