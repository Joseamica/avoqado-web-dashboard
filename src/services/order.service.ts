import api from '@/api'
import { Order } from '@/types'

export interface OrderFilters {
  status?: string
  type?: string
  tableId?: string
  staffId?: string
  search?: string
}

export const getOrders = async (
  venueId: string,
  pagination: { pageIndex: number; pageSize: number },
  filters?: OrderFilters
) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/orders`, {
    params: {
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(filters?.status && filters.status !== 'all' && { status: filters.status }),
      ...(filters?.type && filters.type !== 'all' && { type: filters.type }),
      ...(filters?.tableId && filters.tableId !== 'all' && { tableId: filters.tableId }),
      ...(filters?.staffId && filters.staffId !== 'all' && { staffId: filters.staffId }),
      ...(filters?.search && { search: filters.search }),
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
