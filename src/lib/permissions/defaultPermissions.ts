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
    'customers:read',
    'loyalty:read',
    'discounts:read',
    'coupons:read',
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
    'reservations:cancel',
    'teams:read',
    'customers:read',
    'loyalty:read',
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
   * - Can VIEW menu (read-only) to take orders
   * - Cannot create/edit menu items (MANAGER+ only)
   */
  [StaffRole.WAITER]: [
    'home:read',
    'menu:read', // Read-only access to menus, categories, products, modifiers
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
    'customers:read',
    'loyalty:read',
    'commissions:view_own', // Can view their own commissions
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
    'customers:read',
    'loyalty:read',
    'loyalty:redeem', // Can redeem points at POS
    'coupons:read', // Can validate coupons at POS
    'commissions:view_own', // Can view their own commissions
  ],

  /**
   * MANAGER: Operational management
   * Use case: Shift managers, floor managers
   */
  [StaffRole.MANAGER]: [
    'home:read',
    'analytics:read',
    'analytics:export',
    'settlements:read',
    'settlements:simulate',
    'menu:read',
    'menu:create',
    'menu:update',
    'menu:delete',
    'menu:import',
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
    'tpv:delete',
    'tpv:command',
    'inventory:read',
    'inventory:create',
    'inventory:update',
    'inventory:delete',
    'inventory:adjust',
    'reviews:read',
    'reviews:respond',
    'teams:read',
    'teams:create',
    'teams:update',
    'teams:delete',
    'teams:invite',
    'venues:read', // Can view venue settings (but not edit)
    // Customer & Loyalty Management
    'customers:read',
    'customers:create',
    'customers:update',
    'customers:delete',
    'customers:settle-balance', // Can mark pending balances as paid
    'customer-groups:read',
    'customer-groups:create',
    'customer-groups:update',
    'customer-groups:delete',
    'loyalty:read',
    'loyalty:update',
    'loyalty:redeem',
    'loyalty:adjust',
    // Promotions (Discounts & Coupons)
    'discounts:read',
    'discounts:create',
    'discounts:update',
    'discounts:delete',
    'coupons:read',
    'coupons:create',
    'coupons:update',
    'coupons:delete',
    // TPV Settings (can view, but not modify by default)
    'tpv-settings:read',
    // Billing (read-only for MANAGER)
    'billing:read',
    'billing:subscriptions:read',
    'billing:history:read',
    'billing:payment-methods:read',
    'billing:tokens:read',
    // Commission Management (read + approve for MANAGER)
    'commissions:read',
    'commissions:view_own',
    'commissions:approve',
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
  SETTLEMENTS: {
    label: 'Settlements',
    permissions: ['settlements:read', 'settlements:simulate'],
  },
  MENU: {
    label: 'Menu Management',
    permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'menu:import'],
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
  CUSTOMERS: {
    label: 'Customer Management',
    permissions: ['customers:read', 'customers:create', 'customers:update', 'customers:delete', 'customers:settle-balance'],
  },
  CUSTOMER_GROUPS: {
    label: 'Customer Groups',
    permissions: ['customer-groups:read', 'customer-groups:create', 'customer-groups:update', 'customer-groups:delete'],
  },
  LOYALTY: {
    label: 'Loyalty Program',
    permissions: ['loyalty:read', 'loyalty:create', 'loyalty:update', 'loyalty:delete', 'loyalty:redeem', 'loyalty:adjust'],
  },
  DISCOUNTS: {
    label: 'Discounts',
    permissions: ['discounts:read', 'discounts:create', 'discounts:update', 'discounts:delete'],
  },
  COUPONS: {
    label: 'Coupons',
    permissions: ['coupons:read', 'coupons:create', 'coupons:update', 'coupons:delete'],
  },
  TPV_SETTINGS: {
    label: 'TPV Settings',
    permissions: ['tpv-settings:read', 'tpv-settings:update'],
  },
  BILLING: {
    label: 'Billing & Subscriptions',
    permissions: [
      'billing:read',
      'billing:subscriptions:read',
      'billing:subscriptions:manage',
      'billing:history:read',
      'billing:payment-methods:read',
      'billing:payment-methods:manage',
      'billing:tokens:read',
      'billing:tokens:purchase',
    ],
  },
  COMMISSIONS: {
    label: 'Commission Management',
    permissions: [
      'commissions:read',
      'commissions:create',
      'commissions:update',
      'commissions:delete',
      'commissions:approve',
      'commissions:process_payout',
      'commissions:view_own',
    ],
  },
  // ===========================
  // TPV-SPECIFIC PERMISSIONS (Granular TPV Features)
  // ===========================
  TPV_TERMINAL: {
    label: 'Terminal Configuration',
    permissions: ['tpv-terminal:settings'],
  },
  TPV_ORDERS: {
    label: 'TPV Orders (Advanced)',
    permissions: ['tpv-orders:comp', 'tpv-orders:void', 'tpv-orders:discount'],
  },
  TPV_PAYMENTS: {
    label: 'TPV Payments (Advanced)',
    permissions: ['tpv-payments:send-receipt'],
  },
  TPV_SHIFTS: {
    label: 'TPV Shifts',
    permissions: ['tpv-shifts:create', 'tpv-shifts:close'],
  },
  TPV_TABLES: {
    label: 'TPV Tables',
    permissions: ['tpv-tables:assign', 'tpv-tables:write', 'tpv-tables:delete'],
  },
  TPV_FLOOR_ELEMENTS: {
    label: 'Floor Elements',
    permissions: ['tpv-floor-elements:read', 'tpv-floor-elements:write', 'tpv-floor-elements:delete'],
  },
  TPV_CUSTOMERS: {
    label: 'TPV Customers',
    permissions: ['tpv-customers:read', 'tpv-customers:create'],
  },
  TPV_TIME_ENTRIES: {
    label: 'Time Clock',
    permissions: ['tpv-time-entries:read', 'tpv-time-entries:write'],
  },
  TPV_REPORTS: {
    label: 'TPV Reports',
    permissions: ['tpv-reports:read', 'tpv-reports:export', 'tpv-reports:pay-later-aging'],
  },
  TPV_PRODUCTS: {
    label: 'TPV Products (Scan & Go)',
    permissions: ['tpv-products:read', 'tpv-products:write'],
  },
  TPV_FACTORY_RESET: {
    label: 'Factory Reset (CRITICAL)',
    permissions: ['tpv-factory-reset:execute'],
  },
} as const
