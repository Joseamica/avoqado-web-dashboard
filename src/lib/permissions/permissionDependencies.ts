/**
 * Permission Dependencies System
 *
 * This file defines implicit permissions that are automatically granted when a user has a base permission.
 * This prevents breaking UI/queries when components need data from multiple resources.
 *
 * Example:
 * - User has "orders:read" permission
 * - OrderId page needs to display product names, payment info, customer details
 * - Instead of requiring 4 separate permissions, orders:read implicitly includes:
 *   - products:read (to show product names)
 *   - payments:read (to show payment summary)
 *   - customers:read (to show customer info)
 *
 * Approach inspired by GitHub, Linear, and Notion's permission systems.
 */

/**
 * Maps base permissions to their implicit dependencies.
 * When a user has the key permission, they automatically get all permissions in the array.
 */
export const PERMISSION_DEPENDENCIES: Record<string, string[]> = {
  // ===========================
  // ORDERS - Viewing and Managing
  // ===========================
  'orders:read': [
    'orders:read',
    'products:read',    // Need to see what products are in the order
    'payments:read',    // Need to see payment status/method (basic info)
    // Note: Full payment details (amounts, refunds) still require explicit payments:read
  ],
  'orders:create': [
    'orders:read',      // Inherit read capabilities
    'orders:create',
    'products:read',    // Need to select products
    'menu:read',        // Need to browse menu
    'inventory:read',   // Need to check stock availability
  ],
  'orders:update': [
    'orders:read',
    'orders:update',
    'products:read',
    'inventory:read',   // May need to update stock when modifying order
  ],
  'orders:cancel': [
    'orders:read',
    'orders:cancel',
    'payments:read',    // Need to see if refund is needed
  ],

  // ===========================
  // MENU - Products and Categories
  // ===========================
  'menu:read': [
    'menu:read',
    // Note: Categories and modifiers are part of menu system, no separate permission needed
  ],
  'menu:create': [
    'menu:read',        // Need to see existing menu structure
    'menu:create',
  ],
  'menu:update': [
    'menu:read',
    'menu:update',
  ],
  'menu:delete': [
    'menu:read',
    'menu:delete',
  ],

  // ===========================
  // PAYMENTS
  // ===========================
  'payments:read': [
    'payments:read',
    'orders:read',      // Payments are tied to orders
  ],
  'payments:create': [
    'payments:read',
    'payments:create',
    'orders:read',      // Need to see order being paid
  ],
  'payments:refund': [
    'payments:read',
    'payments:refund',
    'orders:read',      // Need to see original order
  ],

  // ===========================
  // SHIFTS
  // ===========================
  'shifts:read': [
    'shifts:read',
    'teams:read',       // Need to see team members in shift
    'payments:read',    // Need to see shift revenue
  ],
  'shifts:create': [
    'shifts:read',
    'shifts:create',
    'teams:read',       // Need to assign team members
  ],
  'shifts:update': [
    'shifts:read',
    'shifts:update',
    'teams:read',
  ],
  'shifts:close': [
    'shifts:read',
    'shifts:close',
    'payments:read',    // Need to see all payments to close shift
    'orders:read',      // Need to see all orders in shift
  ],

  // ===========================
  // INVENTORY
  // ===========================
  'inventory:read': [
    'inventory:read',
    'products:read',    // Inventory items are linked to products
  ],
  'inventory:create': [
    'inventory:read',
    'inventory:create',
    'products:read',
  ],
  'inventory:update': [
    'inventory:read',
    'inventory:update',
    'products:read',
  ],
  'inventory:adjust': [
    'inventory:read',
    'inventory:adjust',
    'products:read',
  ],
  'inventory:delete': [
    'inventory:read',
    'inventory:delete',
    'products:read',
  ],

  // ===========================
  // TEAMS - Staff Management
  // ===========================
  'teams:read': [
    'teams:read',
    // Note: Team member details are part of teams system
  ],
  'teams:create': [
    'teams:read',
    'teams:create',
  ],
  'teams:update': [
    'teams:read',
    'teams:update',
  ],
  'teams:delete': [
    'teams:read',
    'teams:delete',
  ],
  'teams:invite': [
    'teams:read',
    'teams:invite',
  ],

  // ===========================
  // TPV (Point of Sale)
  // ===========================
  'tpv:read': [
    'tpv:read',
    'orders:read',      // TPV creates orders
    'products:read',    // Need to see products to sell
    'payments:read',    // Need to process payments
  ],
  'tpv:create': [
    'tpv:read',
    'tpv:create',
    'orders:create',    // TPV creates orders
    'payments:create',  // TPV processes payments
  ],
  'tpv:command': [
    'tpv:read',
    'tpv:command',
    'orders:read',
  ],
  'tpv:delete': [
    'tpv:read',
    'tpv:delete',
  ],

  // ===========================
  // REVIEWS
  // ===========================
  'reviews:read': [
    'reviews:read',
    'orders:read',      // Reviews are linked to orders
  ],
  'reviews:respond': [
    'reviews:read',
    'reviews:respond',
  ],

  // ===========================
  // ANALYTICS
  // ===========================
  'analytics:read': [
    'analytics:read',
    'orders:read',      // Analytics show order data
    'payments:read',    // Analytics show payment data
    'products:read',    // Analytics show product performance
  ],
  'analytics:export': [
    'analytics:read',
    'analytics:export',
    'orders:read',
    'payments:read',
  ],

  // ===========================
  // VENUES - Settings
  // ===========================
  'venues:read': [
    'venues:read',
    // Venue settings are standalone
  ],
  'venues:update': [
    'venues:read',
    'venues:update',
  ],

  // ===========================
  // HOME - Dashboard
  // ===========================
  'home:read': [
    'home:read',
    'orders:read',      // Dashboard shows order stats
    'payments:read',    // Dashboard shows payment stats
    'analytics:read',   // Dashboard uses analytics data
  ],

  // ===========================
  // TABLES - Restaurant Tables
  // ===========================
  'tables:read': [
    'tables:read',
    'orders:read',      // Tables show active orders
  ],
  'tables:update': [
    'tables:read',
    'tables:update',
  ],

  // ===========================
  // RESERVATIONS
  // ===========================
  'reservations:read': [
    'reservations:read',
    'tables:read',      // Reservations are for tables
  ],
  'reservations:create': [
    'reservations:read',
    'reservations:create',
    'tables:read',
  ],
  'reservations:update': [
    'reservations:read',
    'reservations:update',
  ],
  'reservations:cancel': [
    'reservations:read',
    'reservations:cancel',
    'tables:read',      // Need to see table when canceling
  ],

  // ===========================
  // SETTINGS
  // ===========================
  'settings:read': [
    'settings:read',
  ],
  'settings:manage': [
    'settings:read',
    'settings:manage',
  ],

  // ===========================
  // ORG-LEVEL MANAGEMENT
  // ===========================
  'goals:org-manage': [
    'goals:org-manage',
    'commissions:read',
  ],
  'commissions:org-manage': [
    'commissions:org-manage',
    'commissions:read',
    'teams:read',
  ],
  'inventory:org-manage': [
    'inventory:org-manage',
    'inventory:read',
    'serialized-inventory:create',
  ],
}

/**
 * Resolves a list of permissions to include all implicit dependencies.
 *
 * @param permissions - Array of explicit permissions the user has
 * @returns Set of all permissions including implicit dependencies
 *
 * @example
 * ```typescript
 * const userPermissions = ['orders:read', 'orders:create']
 * const resolved = resolvePermissions(userPermissions)
 * // resolved contains: orders:read, orders:create, products:read,
 * //                    payments:read, menu:read, inventory:read
 * ```
 */
export function resolvePermissions(permissions: string[]): Set<string> {
  const resolved = new Set<string>()

  // Handle wildcard permission
  if (permissions.includes('*:*')) {
    resolved.add('*:*')
    return resolved
  }

  for (const permission of permissions) {
    // Add the base permission
    resolved.add(permission)

    // Add implicit dependencies
    const dependencies = PERMISSION_DEPENDENCIES[permission]
    if (dependencies) {
      dependencies.forEach(dep => {
        // Avoid infinite loops - don't resolve dependencies of dependencies
        resolved.add(dep)
      })
    }
  }

  return resolved
}

/**
 * Checks if a permission is implicitly granted by another permission.
 *
 * @param hasPermission - The permission the user has
 * @param needsPermission - The permission being checked
 * @returns true if needsPermission is implicitly granted by hasPermission
 *
 * @example
 * ```typescript
 * isImplicitlyGranted('orders:read', 'products:read') // true
 * isImplicitlyGranted('orders:read', 'orders:delete') // false
 * ```
 */
export function isImplicitlyGranted(hasPermission: string, needsPermission: string): boolean {
  const dependencies = PERMISSION_DEPENDENCIES[hasPermission]
  return dependencies?.includes(needsPermission) ?? false
}

/**
 * Gets the list of implicit permissions for a given base permission.
 * Useful for documentation and debugging.
 *
 * @param permission - The base permission
 * @returns Array of permissions implicitly granted, or empty array if none
 */
export function getImplicitPermissions(permission: string): string[] {
  return PERMISSION_DEPENDENCIES[permission] ?? []
}
