import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import roleConfigService, {
  getRoleDisplayNameFromConfig,
  getRoleColorFromConfig,
  isRoleActiveInConfig,
  getSortedRolesFromConfig,
} from '@/services/role-config.service'
import {
  RoleConfig,
  RoleConfigInput,
  StaffRole,
  DEFAULT_ROLE_DISPLAY_NAMES,
} from '@/types'
import { useCallback, useMemo } from 'react'

/**
 * Query key for role configs
 */
export const roleConfigQueryKey = (venueId: string | null) => ['role-config', venueId]

/**
 * Hook for managing custom role display names per venue.
 *
 * Provides:
 * - Fetched role configs with caching
 * - Helper functions to get display names, colors, etc.
 * - Mutations for updating and resetting configs
 *
 * @example
 * ```tsx
 * const { getDisplayName, configs, isLoading } = useRoleConfig()
 *
 * // Get custom display name for a role
 * const name = getDisplayName(StaffRole.CASHIER) // "Promotor" (if customized)
 * ```
 */
export function useRoleConfig() {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  // Fetch role configs
  const {
    data: configData,
    isLoading,
    error,
  } = useQuery({
    queryKey: roleConfigQueryKey(venueId),
    queryFn: () => roleConfigService.getRoleConfigs(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes - configs don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  })

  const configs = configData?.configs ?? []

  // Update configs mutation
  const updateMutation = useMutation({
    mutationFn: (updates: RoleConfigInput[]) =>
      roleConfigService.updateRoleConfigs(venueId!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleConfigQueryKey(venueId) })
    },
  })

  // Reset configs mutation
  const resetMutation = useMutation({
    mutationFn: () => roleConfigService.resetRoleConfigs(venueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleConfigQueryKey(venueId) })
    },
  })

  /**
   * Get the display name for a role.
   * Uses custom config if available, falls back to default.
   */
  const getDisplayName = useCallback(
    (role: StaffRole | string): string => {
      return getRoleDisplayNameFromConfig(role, configs, DEFAULT_ROLE_DISPLAY_NAMES)
    },
    [configs]
  )

  /**
   * Get the custom color for a role (if set).
   * Returns null if no custom color is configured.
   */
  const getColor = useCallback(
    (role: StaffRole | string): string | null => {
      return getRoleColorFromConfig(role, configs)
    },
    [configs]
  )

  /**
   * Check if a role is active (visible) in the venue's config.
   * Hidden roles shouldn't appear in role selectors.
   */
  const isRoleActive = useCallback(
    (role: StaffRole | string): boolean => {
      return isRoleActiveInConfig(role, configs)
    },
    [configs]
  )

  /**
   * Get all roles sorted by their sortOrder.
   */
  const sortedConfigs = useMemo(() => {
    return getSortedRolesFromConfig(configs)
  }, [configs])

  /**
   * Get only active roles sorted by sortOrder.
   * Use this for role selectors to exclude hidden roles.
   */
  const activeRoles = useMemo(() => {
    return sortedConfigs.filter((c) => c.isActive)
  }, [sortedConfigs])

  /**
   * Get config for a specific role.
   */
  const getConfig = useCallback(
    (role: StaffRole | string): RoleConfig | undefined => {
      return configs.find((c) => c.role === role)
    },
    [configs]
  )

  return {
    // Data
    configs,
    sortedConfigs,
    activeRoles,
    isLoading,
    error,

    // Getters
    getDisplayName,
    getColor,
    isRoleActive,
    getConfig,

    // Mutations
    updateConfigs: updateMutation.mutate,
    updateConfigsAsync: updateMutation.mutateAsync,
    isUpdating: updateMutation.isPending,
    updateError: updateMutation.error,

    resetConfigs: resetMutation.mutate,
    resetConfigsAsync: resetMutation.mutateAsync,
    isResetting: resetMutation.isPending,
    resetError: resetMutation.error,
  }
}

export default useRoleConfig
