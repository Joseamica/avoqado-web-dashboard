import api from '@/api'
import { RoleConfig, RoleConfigInput, RoleConfigResponse } from '@/types'

/**
 * Service for managing custom role display names per venue.
 *
 * This allows venues to customize how roles are displayed in the UI
 * (e.g., CASHIER → "Promotor" for events businesses) without
 * changing the underlying permission system.
 */
export const roleConfigService = {
  /**
   * Get all role configurations for a venue.
   * Returns all 9 roles with their current display settings.
   *
   * @permission role-config:read (MANAGER+)
   */
  async getRoleConfigs(venueId: string): Promise<RoleConfigResponse> {
    const response = await api.get(`/api/v1/dashboard/venues/${venueId}/role-config`)
    return response.data
  },

  /**
   * Update role configurations (bulk upsert).
   * Only send configs that need to be changed.
   *
   * @permission role-config:update (ADMIN+)
   */
  async updateRoleConfigs(
    venueId: string,
    configs: RoleConfigInput[]
  ): Promise<RoleConfigResponse> {
    const response = await api.put(`/api/v1/dashboard/venues/${venueId}/role-config`, {
      configs,
    })
    return response.data
  },

  /**
   * Reset all role configurations to defaults.
   * Removes all custom display names.
   *
   * @permission role-config:update (ADMIN+)
   */
  async resetRoleConfigs(venueId: string): Promise<RoleConfigResponse> {
    const response = await api.delete(`/api/v1/dashboard/venues/${venueId}/role-config`)
    return response.data
  },
}

/**
 * Helper function to get a role's display name from configs.
 * Falls back to default if no custom config exists.
 */
export function getRoleDisplayNameFromConfig(
  role: string,
  configs: RoleConfig[],
  defaultNames: Record<string, string>
): string {
  const config = configs.find((c) => c.role === role)
  return config?.displayName || defaultNames[role] || role
}

/**
 * Helper function to get a role's color from configs.
 * Returns null if no custom color is set.
 */
export function getRoleColorFromConfig(
  role: string,
  configs: RoleConfig[]
): string | null {
  const config = configs.find((c) => c.role === role)
  return config?.color || null
}

/**
 * Helper function to check if a role is active (visible) in configs.
 * Defaults to true if no config exists.
 */
export function isRoleActiveInConfig(
  role: string,
  configs: RoleConfig[]
): boolean {
  const config = configs.find((c) => c.role === role)
  return config?.isActive ?? true
}

/**
 * Helper function to get roles sorted by sortOrder from configs.
 */
export function getSortedRolesFromConfig(configs: RoleConfig[]): RoleConfig[] {
  return [...configs].sort((a, b) => a.sortOrder - b.sortOrder)
}

export default roleConfigService
