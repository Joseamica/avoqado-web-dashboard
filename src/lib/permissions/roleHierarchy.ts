import { StaffRole } from '@/types'

// Re-export PERMISSION_CATEGORIES from single source of truth
// This prevents duplicate definitions that can get out of sync
export { PERMISSION_CATEGORIES } from './defaultPermissions'

/**
 * Role hierarchy levels (higher number = more permissions)
 * Used for determining which roles can modify other roles
 *
 * ⚠️ CRITICAL: This must match the backend hierarchy in:
 * `avoqado-server/src/lib/permissions.ts`
 */
export const ROLE_HIERARCHY: Record<StaffRole, number> = {
  [StaffRole.VIEWER]: 1,
  [StaffRole.HOST]: 2,
  [StaffRole.KITCHEN]: 3,
  [StaffRole.WAITER]: 4,
  [StaffRole.CASHIER]: 5,
  [StaffRole.MANAGER]: 6,
  [StaffRole.ADMIN]: 7,
  [StaffRole.OWNER]: 8,
  [StaffRole.SUPERADMIN]: 9,
}

/**
 * Defines which roles can modify permissions for which other roles
 *
 * Rules:
 * - OWNER can modify: OWNER, ADMIN, MANAGER, CASHIER, WAITER, KITCHEN, HOST, VIEWER
 * - ADMIN can modify: ADMIN, MANAGER, CASHIER, WAITER, KITCHEN, HOST, VIEWER (NOT OWNER)
 * - Both can modify their own role permissions (with self-lockout protection)
 *
 * ⚠️ CRITICAL: This must match the backend in:
 * `avoqado-server/src/lib/permissions.ts`
 */
export const MODIFIABLE_ROLES_BY_LEVEL: Record<StaffRole, StaffRole[]> = {
  [StaffRole.SUPERADMIN]: [
    StaffRole.SUPERADMIN,
    StaffRole.OWNER,
    StaffRole.ADMIN,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
    StaffRole.HOST,
    StaffRole.VIEWER,
  ],
  [StaffRole.OWNER]: [
    StaffRole.OWNER,
    StaffRole.ADMIN,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
    StaffRole.HOST,
    StaffRole.VIEWER,
  ],
  [StaffRole.ADMIN]: [
    StaffRole.ADMIN,
    StaffRole.MANAGER,
    StaffRole.CASHIER,
    StaffRole.WAITER,
    StaffRole.KITCHEN,
    StaffRole.HOST,
    StaffRole.VIEWER,
  ],
  [StaffRole.MANAGER]: [],
  [StaffRole.CASHIER]: [],
  [StaffRole.WAITER]: [],
  [StaffRole.KITCHEN]: [],
  [StaffRole.HOST]: [],
  [StaffRole.VIEWER]: [],
}

/**
 * Critical permissions that should NOT be removed from a user's own role
 * Prevents self-lockout scenarios
 *
 * Example: ADMIN removing 'settings:manage' from ADMIN role would lock themselves out
 *
 * ⚠️ CRITICAL: This must match the backend in:
 * `avoqado-server/src/lib/permissions.ts`
 */
export const CRITICAL_PERMISSIONS = ['settings:manage', 'settings:read', 'teams:read', 'teams:update']

/**
 * Check if a role can modify permissions for another role
 *
 * @param modifierRole The role attempting to modify permissions
 * @param targetRole The role being modified
 * @returns true if modifierRole can modify targetRole
 */
export function canModifyRole(modifierRole: StaffRole, targetRole: StaffRole): boolean {
  const modifiableRoles = MODIFIABLE_ROLES_BY_LEVEL[modifierRole] || []
  return modifiableRoles.includes(targetRole)
}

/**
 * Check if a permission is critical (should not be removed from own role)
 *
 * @param permission Permission string (e.g., "settings:manage")
 * @returns true if permission is critical
 */
export function isCriticalPermission(permission: string): boolean {
  return CRITICAL_PERMISSIONS.includes(permission)
}

/**
 * Get the numeric hierarchy level of a role
 *
 * @param role StaffRole
 * @returns Numeric level (1-9, higher = more permissions)
 */
export function getRoleHierarchyLevel(role: StaffRole): number {
  return ROLE_HIERARCHY[role] || 0
}

/**
 * Get modifiable roles for a user based on their role
 *
 * @param userRole User's role
 * @returns Array of roles the user can modify
 */
export function getModifiableRoles(userRole: StaffRole): StaffRole[] {
  return MODIFIABLE_ROLES_BY_LEVEL[userRole] || []
}

/**
 * Get user-friendly role name for display
 *
 * @param role StaffRole
 * @returns Formatted role name
 */
export function getRoleDisplayName(role: StaffRole | null | undefined): string {
  if (!role) return ''
  return role.charAt(0) + role.slice(1).toLowerCase()
}
