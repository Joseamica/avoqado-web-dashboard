import { StaffRole } from '@/types'

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
 * Permission categories for organizing the UI
 * Groups related permissions together in the permission grid
 */
export const PERMISSION_CATEGORIES = {
  HOME: {
    label: 'Home Dashboard',
    permissions: ['home:read'],
  },
  ANALYTICS: {
    label: 'Analytics',
    permissions: ['analytics:read', 'analytics:export'],
  },
  MENU: {
    label: 'Menu Management',
    permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete'],
  },
  ORDERS: {
    label: 'Orders',
    permissions: ['orders:read', 'orders:create', 'orders:update', 'orders:cancel'],
  },
  PAYMENTS: {
    label: 'Payments',
    permissions: ['payments:read', 'payments:create', 'payments:refund'],
  },
  SHIFTS: {
    label: 'Shifts',
    permissions: ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:close'],
  },
  TPV: {
    label: 'TPV Management',
    permissions: ['tpv:read', 'tpv:create', 'tpv:update', 'tpv:delete', 'tpv:command'],
  },
  INVENTORY: {
    label: 'Inventory',
    permissions: ['inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:adjust'],
  },
  REVIEWS: {
    label: 'Reviews',
    permissions: ['reviews:read', 'reviews:respond'],
  },
  TEAMS: {
    label: 'Team Management',
    permissions: ['teams:read', 'teams:create', 'teams:update', 'teams:delete', 'teams:invite'],
  },
  TABLES: {
    label: 'Table Management',
    permissions: ['tables:read', 'tables:update'],
  },
  RESERVATIONS: {
    label: 'Reservations',
    permissions: ['reservations:read', 'reservations:create', 'reservations:update', 'reservations:cancel'],
  },
  SETTINGS: {
    label: 'Settings',
    permissions: ['settings:read', 'settings:manage'],
  },
  VENUES: {
    label: 'Venue Settings',
    permissions: ['venues:read', 'venues:update'],
  },
} as const

/**
 * Get all unique permissions across all categories
 */
export function getAllPermissions(): string[] {
  const permissions = new Set<string>()
  Object.values(PERMISSION_CATEGORIES).forEach(category => {
    category.permissions.forEach(p => permissions.add(p))
  })
  return Array.from(permissions).sort()
}

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
