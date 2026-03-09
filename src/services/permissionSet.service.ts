import api from '@/api'

export interface PermissionSet {
  id: string
  venueId: string
  name: string
  description: string | null
  permissions: string[]
  color: string | null
  createdBy: string | null
  createdAt: string
  updatedAt: string
  _count: { staffVenues: number }
}

export interface CreatePermissionSetRequest {
  name: string
  description?: string
  permissions: string[]
  color?: string
}

export interface UpdatePermissionSetRequest {
  name?: string
  description?: string | null
  permissions?: string[]
  color?: string | null
}

export interface DuplicatePermissionSetRequest {
  name: string
}

export const permissionSetService = {
  async getAll(venueId: string): Promise<{ success: boolean; data: PermissionSet[] }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/permission-sets`)
    return response.data
  },

  async getById(venueId: string, id: string): Promise<{ success: boolean; data: PermissionSet }> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/permission-sets/${id}`)
    return response.data
  },

  async create(
    venueId: string,
    data: CreatePermissionSetRequest,
  ): Promise<{ success: boolean; data: PermissionSet }> {
    const response = await api.post(`/api/v1/dashboard/venues/${venueId}/permission-sets`, data)
    return response.data
  },

  async update(
    venueId: string,
    id: string,
    data: UpdatePermissionSetRequest,
  ): Promise<{ success: boolean; data: PermissionSet }> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/permission-sets/${id}`, data)
    return response.data
  },

  async remove(
    venueId: string,
    id: string,
  ): Promise<{ success: boolean; data: { deleted: boolean; affectedStaff: number } }> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/permission-sets/${id}`)
    return response.data
  },

  async duplicate(
    venueId: string,
    id: string,
    data: DuplicatePermissionSetRequest,
  ): Promise<{ success: boolean; data: PermissionSet }> {
    const response = await api.post(
      `/api/v1/dashboard/venues/${venueId}/permission-sets/${id}/duplicate`,
      data,
    )
    return response.data
  },

  async assignToStaff(
    venueId: string,
    teamMemberId: string,
    permissionSetId: string | null,
  ): Promise<{ success: boolean; data: { permissionSetId: string | null; permissionSetName: string | null } }> {
    const response = await api.put(
      `/api/v1/dashboard/venues/${venueId}/team/${teamMemberId}/permission-set`,
      { permissionSetId },
    )
    return response.data
  },
}

export default permissionSetService
