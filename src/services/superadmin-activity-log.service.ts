import api from '@/api'

export interface SuperadminActivityLogEntry {
  id: string
  action: string
  entity: string | null
  entityId: string | null
  data: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
  staff: { id: string; firstName: string; lastName: string } | null
  venueId: string | null
  venueName: string
  organizationName: string | null
}

export interface SuperadminActivityLogResponse {
  logs: SuperadminActivityLogEntry[]
  pagination: { page: number; pageSize: number; total: number; totalPages: number }
}

export interface SuperadminActivityLogFilters {
  page?: number
  pageSize?: number
  organizationId?: string
  venueId?: string
  staffId?: string
  action?: string
  entity?: string
  search?: string
  startDate?: string
  endDate?: string
}

export async function getSuperadminActivityLogs(
  filters?: SuperadminActivityLogFilters,
): Promise<SuperadminActivityLogResponse> {
  const params = new URLSearchParams()
  if (filters?.page) params.set('page', String(filters.page))
  if (filters?.pageSize) params.set('pageSize', String(filters.pageSize))
  if (filters?.organizationId) params.set('organizationId', filters.organizationId)
  if (filters?.venueId) params.set('venueId', filters.venueId)
  if (filters?.staffId) params.set('staffId', filters.staffId)
  if (filters?.action) params.set('action', filters.action)
  if (filters?.entity) params.set('entity', filters.entity)
  if (filters?.search) params.set('search', filters.search)
  if (filters?.startDate) params.set('startDate', filters.startDate)
  if (filters?.endDate) params.set('endDate', filters.endDate)

  const response = await api.get(`/api/v1/superadmin/activity-log?${params.toString()}`)
  return response.data.data
}

export async function getSuperadminActivityLogActions(): Promise<string[]> {
  const response = await api.get('/api/v1/superadmin/activity-log/actions')
  return response.data.data
}

export async function getSuperadminActivityLogEntities(): Promise<string[]> {
  const response = await api.get('/api/v1/superadmin/activity-log/entities')
  return response.data.data
}
