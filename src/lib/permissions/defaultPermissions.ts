import { StaffRole } from '@/types'

/**
 * Default permissions matrix by role
 *
 * Permission format: "resource:action"
 * Examples:
 *   - "tpv:read" = Can view TPV terminals
 *   - "tpv:create" = Can create TPV terminals
 *   - "analytics:export" = Can export analytics data
 *   - "*:*" = All permissions (wildcard)
 *
 * Permission hierarchy:
 *   SUPERADMIN > OWNER > ADMIN > MANAGER > CASHIER/WAITER/KITCHEN/HOST > VIEWER
 */
export const DEFAULT_PERMISSIONS: Record<StaffRole, string[]> = {
  /**
   * VIEWER: Read-only access to most features
   * Use case: Accountants, external consultants, observers
   */
  [StaffRole.VIEWER]: [
    'home:read',
    'analytics:read',
    'menu:read',
    'orders:read',
    'payments:read',
    'shifts:read',
    'reviews:read',
    'teams:read',
  ],

  /**
   * HOST: Seating and reservations management
   * Use case: Front desk staff, greeters
   */
  [StaffRole.HOST]: [
    'home:read',
    'menu:read',
    'orders:read',
    'tables:read',
    'tables:update',
    'reservations:read',
    'reservations:create',
    'reservations:update',
    'teams:read',
  ],

  /**
   * KITCHEN: Kitchen operations only
   * Use case: Cooks, kitchen staff
   */
  [StaffRole.KITCHEN]: [
    'home:read',
    'orders:read',
    'orders:update',
    'menu:read',
  ],

  /**
   * WAITER: Order and table management
   * Use case: Waiters, servers
   */
  [StaffRole.WAITER]: [
    'home:read',
    'menu:read',
    'menu:create',
    'menu:update',
    'orders:read',
    'orders:create',
    'orders:update',
    'payments:read',
    'payments:create',
    'shifts:read',
    'tables:read',
    'tables:update',
    'reviews:read',
    'teams:read',
    'tpv:read', // Can view TPV terminals (but not create/edit/command)
  ],

  /**
   * CASHIER: Payment processing
   * Use case: Cashiers, payment processors
   */
  [StaffRole.CASHIER]: [
    'home:read',
    'menu:read',
    'orders:read',
    'orders:update',
    'payments:read',
    'payments:create',
    'payments:refund',
    'shifts:read',
    'reviews:read',
    'teams:read',
  ],

  /**
   * MANAGER: Operational management
   * Use case: Shift managers, floor managers
   */
  [StaffRole.MANAGER]: [
    'home:read',
    'analytics:read',
    'analytics:export',
    'menu:read',
    'menu:create',
    'menu:update',
    'menu:delete',
    'orders:read',
    'orders:create',
    'orders:update',
    'orders:cancel',
    'payments:read',
    'payments:create',
    'payments:refund',
    'shifts:read',
    'shifts:create',
    'shifts:update',
    'shifts:delete',
    'shifts:close',
    'tpv:read',
    'tpv:create',
    'tpv:update',
    'tpv:command',
    'reviews:read',
    'reviews:respond',
    'teams:read',
    'teams:update',
  ],

  /**
   * ADMIN: Full venue management
   * Use case: Venue administrators
   */
  [StaffRole.ADMIN]: [
    '*:*', // All permissions
  ],

  /**
   * OWNER: Full organization access
   * Use case: Business owners
   */
  [StaffRole.OWNER]: [
    '*:*', // All permissions
  ],

  /**
   * SUPERADMIN: System-wide access
   * Use case: Avoqado platform administrators
   */
  [StaffRole.SUPERADMIN]: [
    '*:*', // All permissions
  ],
}

/**
 * Check if a role has permission by default
 * @param role User's role
 * @param permission Permission to check (format: "resource:action")
 * @returns true if role has permission
 */
export function hasDefaultPermission(role: StaffRole, permission: string): boolean {
  const rolePermissions = DEFAULT_PERMISSIONS[role] || []

  // Check for wildcard (all permissions)
  if (rolePermissions.includes('*:*')) return true

  // Check exact permission
  if (rolePermissions.includes(permission)) return true

  // Check wildcard permissions (e.g., 'tpv:*' matches 'tpv:create')
  const [resource, action] = permission.split(':')
  if (rolePermissions.includes(`${resource}:*`)) return true
  if (rolePermissions.includes(`*:${action}`)) return true

  return false
}

/**
 * Permission categories for documentation and UI
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
} as const
