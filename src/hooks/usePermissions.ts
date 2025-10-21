import { useMemo } from 'react'
import { useAuth } from '@/context/AuthContext'
import { DEFAULT_PERMISSIONS } from '@/lib/permissions/defaultPermissions'
import { resolvePermissions } from '@/lib/permissions/permissionDependencies'
import { StaffRole } from '@/types'

/**
 * Hook for checking user permissions
 *
 * Combines:
 * 1. Default permissions based on role
 * 2. Custom permissions from StaffVenue.permissions (if any)
 * 3. Implicit permissions from dependencies (e.g., orders:read includes products:read)
 *
 * @example
 * const { can, canAny, canAll } = usePermissions()
 *
 * if (can('tpv:create')) {
 *   return <CreateButton />
 * }
 */
export function usePermissions() {
  const { user, activeVenue } = useAuth()

  const allPermissions = useMemo(() => {
    if (!user) return []

    // Get default permissions for the user's role
    const defaultPermissions = DEFAULT_PERMISSIONS[user.role as StaffRole] || []

    // Get custom permissions from the current venue (if any)
    // StaffVenue.permissions is stored as JSON array: ["tpv:create", "analytics:export", ...]
    let customPermissions: string[] = []

    if (activeVenue) {
      const venueStaff = user.venues?.find(v => v.id === activeVenue.id)
      if (venueStaff && Array.isArray(venueStaff.permissions)) {
        customPermissions = venueStaff.permissions as string[]
      }
    }

    // OVERRIDE MODE for wildcard roles:
    // If role has wildcard (*:*) in defaults AND custom permissions exist,
    // use ONLY custom permissions (complete override, not merge)
    // This allows removing permissions from high-level roles (OWNER/ADMIN/SUPERADMIN)
    const hasWildcardDefaults = defaultPermissions.includes('*:*')
    const hasCustomPermissions = customPermissions.length > 0

    let basePermissions: string[]

    if (hasWildcardDefaults && hasCustomPermissions) {
      // Override mode: custom permissions replace defaults entirely
      basePermissions = customPermissions
    } else {
      // MERGE MODE for non-wildcard roles:
      // Merge permissions: default + custom
      // Custom permissions can add new permissions on top of defaults
      basePermissions = [...new Set([...defaultPermissions, ...customPermissions])]
    }

    // RESOLVE IMPLICIT DEPENDENCIES:
    // Expand base permissions to include their implicit dependencies
    // Example: 'orders:read' automatically includes 'products:read', 'payments:read', etc.
    const resolvedSet = resolvePermissions(basePermissions)
    return Array.from(resolvedSet)
  }, [user, activeVenue])

  /**
   * Check if user has a specific permission
   *
   * @param permission Permission string (format: "resource:action")
   * @returns true if user has permission
   *
   * @example
   * can('tpv:create') // → true/false
   * can('analytics:export') // → true/false
   */
  const can = (permission: string): boolean => {
    if (!user) return false

    // Superusers have all permissions
    if (allPermissions.includes('*:*')) return true

    // Check exact permission
    if (allPermissions.includes(permission)) return true

    // Check wildcard permissions (e.g., 'tpv:*' matches 'tpv:create')
    const [resource, action] = permission.split(':')
    if (allPermissions.includes(`${resource}:*`)) return true
    if (allPermissions.includes(`*:${action}`)) return true

    return false
  }

  /**
   * Check if user can perform ANY of the specified actions
   *
   * @param permissions Array of permission strings
   * @returns true if user has at least one permission
   *
   * @example
   * canAny(['tpv:create', 'tpv:update']) // → true if has either
   */
  const canAny = (permissions: string[]): boolean => {
    return permissions.some(p => can(p))
  }

  /**
   * Check if user can perform ALL of the specified actions
   *
   * @param permissions Array of permission strings
   * @returns true if user has all permissions
   *
   * @example
   * canAll(['tpv:read', 'tpv:create']) // → true only if has both
   */
  const canAll = (permissions: string[]): boolean => {
    return permissions.every(p => can(p))
  }

  /**
   * Check if user cannot perform an action
   *
   * @param permission Permission string
   * @returns true if user does NOT have permission
   *
   * @example
   * cannot('tpv:delete') // → true if NO permission
   */
  const cannot = (permission: string): boolean => {
    return !can(permission)
  }

  return {
    can,
    canAny,
    canAll,
    cannot,
    permissions: allPermissions,
    role: user?.role as StaffRole,
  }
}
