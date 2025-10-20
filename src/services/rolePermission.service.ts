import api from '@/api'
import { StaffRole } from '@/types'

// Role Permission interfaces
export interface RolePermission {
  role: StaffRole
  permissions: string[]
  isCustom: boolean
  modifiedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  modifiedAt: string | null
}

export interface RoleHierarchyInfo {
  hierarchy: Record<StaffRole, number>
  modifiableRoles: Record<StaffRole, StaffRole[]>
  criticalPermissions: string[]
  defaultPermissions: Record<StaffRole, string[]>
  userRole: StaffRole
  modifiableRoles: StaffRole[]
}

export interface UpdateRolePermissionsRequest {
  permissions: string[]
}

export interface RolePermissionResponse {
  success: boolean
  message?: string
  data: RolePermission
}

export interface AllRolePermissionsResponse {
  success: boolean
  data: RolePermission[]
}

export interface RoleHierarchyResponse {
  success: boolean
  data: RoleHierarchyInfo
}

// Role Permission Management Service
export const rolePermissionService = {
  /**
   * Get all role permissions for a venue
   * Returns both custom and default permissions for each role
   */
  async getAllRolePermissions(venueId: string): Promise<AllRolePermissionsResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/role-permissions`)
    return response.data
  },

  /**
   * Get permissions for a specific role
   */
  async getRolePermissions(venueId: string, role: StaffRole): Promise<RolePermissionResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/role-permissions/${role}`)
    return response.data
  },

  /**
   * Update permissions for a specific role
   * Includes hierarchy and self-lockout validation on backend
   */
  async updateRolePermissions(
    venueId: string,
    role: StaffRole,
    permissions: string[],
  ): Promise<RolePermissionResponse> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/role-permissions/${role}`, {
      permissions,
    })
    return response.data
  },

  /**
   * Delete custom permissions for a role (revert to defaults)
   */
  async deleteRolePermissions(venueId: string, role: StaffRole): Promise<RolePermissionResponse> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/role-permissions/${role}`)
    return response.data
  },

  /**
   * Get role hierarchy information
   * Returns which roles can modify which other roles, critical permissions, etc.
   */
  async getRoleHierarchyInfo(): Promise<RoleHierarchyResponse> {
    const response = await api.get('/api/v1/dashboard/role-permissions/hierarchy')
    return response.data
  },
}

export default rolePermissionService
