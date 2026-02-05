/**
 * useAccess Hook
 *
 * Unified hook for checking user permissions and feature access.
 * Fetches access data from the backend and provides helper functions.
 *
 * This hook replaces:
 * - usePermissions (for core permissions)
 * - useWhiteLabelAccess (for feature access)
 *
 * Benefits:
 * - Single source of truth (backend)
 * - Request-level caching via React Query
 * - Automatic refresh on venue change
 * - Type-safe access checks
 *
 * @example
 * ```tsx
 * const { can, canFeature, role, isLoading } = useAccess()
 *
 * // Check core permission
 * if (can('tpv:read')) { ... }
 *
 * // Check white-label feature access
 * if (canFeature('STORES_ANALYSIS')) { ... }
 * ```
 */
import { useCallback, useMemo } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useCurrentVenue } from './use-current-venue'
import accessService, { UserAccess, FeatureAccessResult } from '@/services/access.service'
import type { StaffRole } from '@/types'

/**
 * Query key for access data
 */
export const accessQueryKey = (venueId: string | null) => ['user-access', venueId]

/**
 * Return type for useAccess hook
 */
export interface UseAccessReturn {
  /** User's access data (null while loading) */
  access: UserAccess | null

  /** User's role in the current venue */
  role: StaffRole | null

  /** Whether white-label is enabled for this venue */
  isWhiteLabelEnabled: boolean

  /** List of enabled feature codes */
  enabledFeatures: string[]

  /** Loading state */
  isLoading: boolean

  /** Error state */
  error: Error | null

  /**
   * Check if user has a specific core permission
   * @param permission - Permission to check (e.g., 'tpv:read')
   * @returns true if user has permission
   */
  can: (permission: string) => boolean

  /**
   * Check if user has ANY of the specified permissions
   * @param permissions - Array of permissions to check
   * @returns true if user has at least one
   */
  canAny: (permissions: string[]) => boolean

  /**
   * Check if user has ALL of the specified permissions
   * @param permissions - Array of permissions to check
   * @returns true if user has all
   */
  canAll: (permissions: string[]) => boolean

  /**
   * Check if user can access a white-label feature
   * @param featureCode - Feature code (e.g., 'STORES_ANALYSIS')
   * @returns true if user can access the feature
   */
  canFeature: (featureCode: string) => boolean

  /**
   * Get detailed access result for a feature
   * @param featureCode - Feature code
   * @returns FeatureAccessResult with allowed status and reason
   */
  getFeatureAccess: (featureCode: string) => FeatureAccessResult | null

  /**
   * Get the data scope for a feature
   * @param featureCode - Feature code
   * @returns DataScope or 'venue' as default
   */
  getDataScope: (featureCode: string) => 'venue' | 'user-venues' | 'organization'

  /**
   * Manually refresh access data
   */
  refresh: () => void
}

/**
 * Hook to check user permissions and feature access
 */
export function useAccess(): UseAccessReturn {
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  // Fetch access data from backend
  const {
    data: access,
    isLoading,
    error,
  } = useQuery({
    queryKey: accessQueryKey(venueId),
    queryFn: () => accessService.getAccess(venueId!),
    enabled: !!venueId,
    staleTime: 5 * 60 * 1000, // 5 minutes - permissions don't change often
    gcTime: 30 * 60 * 1000, // 30 minutes cache
    retry: 1, // Only retry once on failure
  })

  // Extract commonly used values
  const role = access?.role ?? null
  const isWhiteLabelEnabled = access?.whiteLabelEnabled ?? false
  const enabledFeatures = access?.enabledFeatures ?? []
  const corePermissions = useMemo(() => access?.corePermissions ?? [], [access?.corePermissions])

  /**
   * Check if user has a specific permission
   */
  const can = useCallback(
    (permission: string): boolean => {
      if (!access) return false

      // SUPERADMIN always has all permissions
      if (access.role === 'SUPERADMIN') return true

      // Check for wildcard
      if (corePermissions.includes('*:*')) return true

      // Check exact permission
      if (corePermissions.includes(permission)) return true

      // Check wildcard patterns
      const [resource, action] = permission.split(':')
      if (corePermissions.includes(`${resource}:*`)) return true
      if (corePermissions.includes(`*:${action}`)) return true

      return false
    },
    [access, corePermissions]
  )

  /**
   * Check if user has ANY of the permissions
   */
  const canAny = useCallback(
    (permissions: string[]): boolean => {
      return permissions.some(p => can(p))
    },
    [can]
  )

  /**
   * Check if user has ALL of the permissions
   */
  const canAll = useCallback(
    (permissions: string[]): boolean => {
      return permissions.every(p => can(p))
    },
    [can]
  )

  /**
   * Check if user can access a white-label feature
   */
  const canFeature = useCallback(
    (featureCode: string): boolean => {
      if (!access) return false

      // SUPERADMIN always has access
      if (access.role === 'SUPERADMIN') return true

      // If white-label is not enabled, all features are accessible (normal mode)
      if (!isWhiteLabelEnabled) return true

      // Check if feature is enabled and user has access
      const featureAccess = access.featureAccess[featureCode]
      return featureAccess?.allowed ?? false
    },
    [access, isWhiteLabelEnabled]
  )

  /**
   * Get detailed feature access result
   */
  const getFeatureAccess = useCallback(
    (featureCode: string): FeatureAccessResult | null => {
      if (!access || !isWhiteLabelEnabled) return null
      return access.featureAccess[featureCode] ?? null
    },
    [access, isWhiteLabelEnabled]
  )

  /**
   * Get data scope for a feature
   */
  const getDataScope = useCallback(
    (featureCode: string): 'venue' | 'user-venues' | 'organization' => {
      if (!access || !isWhiteLabelEnabled) return 'venue'
      return access.featureAccess[featureCode]?.dataScope ?? 'venue'
    },
    [access, isWhiteLabelEnabled]
  )

  /**
   * Refresh access data
   */
  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: accessQueryKey(venueId) })
  }, [queryClient, venueId])

  return {
    access: access ?? null,
    role,
    isWhiteLabelEnabled,
    enabledFeatures,
    isLoading,
    error: error as Error | null,
    can,
    canAny,
    canAll,
    canFeature,
    getFeatureAccess,
    getDataScope,
    refresh,
  }
}

export default useAccess

// ============================================================================
// Utility Functions (moved from use-white-label-access.ts)
// ============================================================================

import type { EnabledFeature, FeatureAccess } from '@/types/white-label'
import { FEATURE_REGISTRY } from '@/config/feature-registry'

/**
 * Get the features accessible to a specific role
 * Useful for showing access preview when inviting team members
 */
export function getAccessibleFeaturesForRole(
  enabledFeatures: EnabledFeature[],
  role: StaffRole
): { accessible: EnabledFeature[]; inaccessible: EnabledFeature[] } {
  // SUPERADMIN can access everything
  if (role === 'SUPERADMIN') {
    return { accessible: enabledFeatures, inaccessible: [] }
  }

  const accessible: EnabledFeature[] = []
  const inaccessible: EnabledFeature[] = []

  for (const feature of enabledFeatures) {
    // Get access config from feature or registry default
    let access: FeatureAccess | undefined = feature.access
    if (!access) {
      const registryDef = FEATURE_REGISTRY[feature.code]
      access = registryDef?.defaultAccess
    }

    // Default access if none configured
    if (!access) {
      access = {
        allowedRoles: ['OWNER', 'ADMIN', 'MANAGER'] as StaffRole[],
        dataScope: 'user-venues',
      }
    }

    if (access.allowedRoles.includes(role)) {
      accessible.push(feature)
    } else {
      inaccessible.push(feature)
    }
  }

  return { accessible, inaccessible }
}
