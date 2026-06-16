import api from '@/api'

export interface VenueActivityLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  data: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  staff: { id: string; firstName: string; lastName: string } | null
  venueName: string
}

export interface VenueActivityLogFilters {
  page?: number
  pageSize?: number
  staffId?: string
  action?: string
  entity?: string
  search?: string
  startDate?: string
  endDate?: string
}

export interface VenueActivityLogResponse {
  logs: VenueActivityLogEntry[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export async function getVenueActivityLog(
  venueId: string,
  filters?: VenueActivityLogFilters,
): Promise<VenueActivityLogResponse> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.staffId) params.set('staffId', filters.staffId)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.entity) params.set('entity', filters.entity)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/activity-log?${params.toString()}`)
  return response.data.data
}

export async function getVenueActivityLogActions(venueId: string): Promise<string[]> {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/activity-log/actions`)
  return response.data.data
}
