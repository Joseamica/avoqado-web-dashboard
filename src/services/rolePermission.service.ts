import api from '@/api'
import { StaffRole } from '@/types'

// Role Permission interfaces
export interface RolePermission {
  role: StaffRole
  /**
   * Lo que este venue AGREGA sobre los permisos de fábrica del rol. Es ADITIVO a propósito:
   * gracias a eso, cuando la plataforma le suma permisos nuevos a un rol, los venues que ya
   * habían personalizado también los reciben en vez de quedarse congelados.
   */
  permissions: string[]
  /**
   * Lo que este venue QUITA. Va aparte porque un solo campo no podía decir las dos cosas, y
   * por eso quitar un permiso NUNCA funcionaba: el backend sumaba lo que la pantalla creía
   * estar reemplazando. Ver `getEffectiveRolePermissions` en avoqado-server.
   * Opcional: un backend viejo no lo manda.
   */
  deniedPermissions?: string[]
  isCustom: boolean
  modifiedBy: {
    id: string
    firstName: string
    lastName: string
    email: string
  } | null
  modifiedAt: string | null
  staffCount?: number
}

export interface RoleHierarchyInfo {
  hierarchy: Record<StaffRole, number>
  modifiableRoles: Record<StaffRole, StaffRole[]>
  criticalPermissions: string[]
  defaultPermissions: Record<StaffRole, string[]>
  userRole: StaffRole
}

export interface UpdateRolePermissionsRequest {
  permissions: string[]
  /** Ver `RolePermission.deniedPermissions`. Opcional: el servidor lo trata como `[]`. */
  deniedPermissions?: string[]
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
    /**
     * Lo que el admin QUITÓ. Sin esto, desmarcar una casilla no hacía nada: el campo
     * `permissions` es aditivo en el backend, así que la pantalla creía estar reemplazando
     * la lista y el backend la sumaba a los permisos de fábrica. Ver el KDoc del tipo.
     */
    deniedPermissions: string[] = [],
  ): Promise<RolePermissionResponse> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/role-permissions/${role}`, {
      permissions,
      deniedPermissions,
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
