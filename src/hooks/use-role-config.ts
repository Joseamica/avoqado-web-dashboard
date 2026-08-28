import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import { useAuth } from '@/context/AuthContext'
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
} from '@/types'
import { useMemo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { deriveBusinessCategory, getSectorRoleDisplayNames } from '@/config/sector-terminology'

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
  // El venue sale de `useCurrentVenue`, NO de `activeVenue`: ese hook prioriza el slug de la
  // URL justamente porque `activeVenue` se queda desfasado al cambiar de sucursal.
  const { venue: currentVenue, venueId } = useCurrentVenue()
  const { user } = useAuth()
  const { i18n } = useTranslation()
  const queryClient = useQueryClient()

  // Fallback: when venueId is null (org pages without venue slug in URL),
  // use the first venue the user has access to. This ensures role display
  // names load correctly on /organizations/:orgId/* pages.
  const effectiveVenueId = venueId || user?.venues?.[0]?.id || null

  // Fetch role configs
  const {
    data: configData,
    isLoading,
    error,
  } = useQuery({
    queryKey: roleConfigQueryKey(effectiveVenueId),
    queryFn: () => roleConfigService.getRoleConfigs(effectiveVenueId!),
    enabled: !!effectiveVenueId,
    staleTime: 5 * 60 * 1000, // 5 minutes - configs don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  })

  const configs = useMemo(() => configData?.configs ?? [], [configData?.configs])

  // Update configs mutation
  const updateMutation = useMutation({
    mutationFn: (updates: RoleConfigInput[]) =>
      roleConfigService.updateRoleConfigs(effectiveVenueId!, updates),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleConfigQueryKey(effectiveVenueId) })
    },
  })

  // Reset configs mutation
  const resetMutation = useMutation({
    mutationFn: () => roleConfigService.resetRoleConfigs(effectiveVenueId!),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: roleConfigQueryKey(effectiveVenueId) })
    },
  })

  /**
   * Nombres por defecto SEGUN EL GIRO del negocio.
   *
   * 🔴 Antes se pasaba `DEFAULT_ROLE_DISPLAY_NAMES` (lista fija con vocabulario de restaurante),
   * asi que una estetica veia «Mesero» y una tienda tambien — aunque `sector-terminology.ts`
   * ya tenia la palabra correcta para cada giro. Este es el escalon de en medio de la cadena
   * que el propio archivo documenta: override del venue > GIRO > FOOD_SERVICE.
   *
   * `DEFAULT_ROLE_DISPLAY_NAMES` sigue existiendo para quien no tiene un venue activo.
   */
  const sectorRoleNames = useMemo(
    () => getSectorRoleDisplayNames(deriveBusinessCategory(currentVenue?.type), i18n.language),
    [currentVenue?.type, i18n.language]
  )

  /**
   * Get the display name for a role.
   * Uses custom config if available, falls back to default.
   */
  const getDisplayName = useCallback(
    (role: StaffRole | string): string => {
      return getRoleDisplayNameFromConfig(role, configs, sectorRoleNames)
    },
    [configs, sectorRoleNames]
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
