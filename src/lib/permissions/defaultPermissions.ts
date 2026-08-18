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
    'catalog-venue:read',
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
    'referral:read',
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
    // Alta de cliente desde recepción / reservas (founder, 2026-08-16). Espejo del server.
    // Editar y borrar el directorio SE QUEDA en MANAGER+.
    'customers:create',
    'loyalty:read',
    'referral:read',
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
    'area-tickets:issue',
    'area-tickets:deliver',
    'scale:use',
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
    'area-tickets:issue',
    'scale:use',
    'shifts:read',
    'tables:read',
    'tables:update',
    'reviews:read',
    'teams:read',
    'tpv:read', // Can view TPV terminals (but not create/edit/command)
    'customers:read',
    // Alta de cliente en el cobro (founder, 2026-08-16). Espejo del server: sin esto la
    // venta queda anónima. Editar/borrar el directorio se queda en MANAGER+.
    'customers:create',
    'loyalty:read',
    'referral:read',
    'discounts:read',
    'discounts:apply',
    // Paquetes y membresías (founder, 2026-08-16): el mostrador VENDE y CANJEA; el
    // CATÁLOGO (create/update/delete) se queda en MANAGER+. Espejo del server.
    'creditPacks:read',
    'creditPacks:sell',
    'creditPacks:redeem',
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
    'area-tickets:checkout',
    'shifts:read',
    'reviews:read',
    'teams:read',
    'customers:read',
    // Alta de cliente en el cobro (founder, 2026-08-16). Espejo del server: sin esto la
    // venta queda anónima. Editar/borrar el directorio se queda en MANAGER+.
    'customers:create',
    'loyalty:read',
    'loyalty:redeem', // Can redeem points at POS
    'referral:read',
    'discounts:read',
    'discounts:apply',
    'coupons:read', // Can validate coupons at POS
    // Paquetes y membresías (founder, 2026-08-16): en gym/estética/spa el paquete ES la
    // venta principal. El mostrador VENDE y CANJEA; el CATÁLOGO se queda en MANAGER+.
    'creditPacks:read',
    'creditPacks:sell',
    'creditPacks:redeem',
    'commissions:view_own', // Can view their own commissions
  ],

  /**
   * MANAGER: Operational management
   * Use case: Shift managers, floor managers
   */
  [StaffRole.MANAGER]: [
    'home:read',
    'catalog-venue:read',
    'catalog-venue:request-override',
    'analytics:read',
    'analytics:export',
    'reports:read',
    'reports:export',
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
    // Fusionar cuentas — MANAGER+; WAITER queda a un PIN de distancia.
    // Espejo de DEFAULT_PERMISSIONS[MANAGER] en avoqado-server/src/lib/permissions.ts.
    // ADMIN/OWNER/SUPERADMIN ya lo cubren con '*:*'.
    'orders:merge',
    'area-tickets:issue',
    'area-tickets:checkout',
    'area-tickets:cancel',
    'area-tickets:deliver',
    'area-tickets:configure',
    // Confirmar cobro en caja externa (ruta EXTERNAL): afirmación sobre dinero que
    // alguien con autoridad hace a mano — trabajo de gerencia, no de cajero.
    // Espejo EXACTO de `DEFAULT_PERMISSIONS[MANAGER]` en avoqado-server/src/lib/permissions.ts;
    // omitirlo aquí hace que el editor de roles guarde un PermissionSet que se lo REVOCA.
    'area-tickets:confirm-external',
    'scale:use',
    'scale:configure',
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
    'inventory-transfers:read',
    'inventory-transfers:request',
    'inventory-transfers:approve',
    'inventory-transfers:dispatch',
    'inventory-transfers:receive',
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
    // Referral Program (MANAGER: read + override existing customer; void/configure/export are ADMIN+)
    'referral:read',
    'referral:override-existing-customer',
    // Promotions (Discounts & Coupons)
    'discounts:read',
    'discounts:create',
    'discounts:update',
    'discounts:delete',
    'discounts:apply',
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
    'catalog-venue:read',
    'catalog-venue:request-override',
  ],

  /**
   * OWNER: Full organization access
   * Use case: Business owners
   */
  [StaffRole.OWNER]: [
    '*:*', // All permissions
    'catalog-venue:read',
    'catalog-venue:request-override',
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
 * Categorías de permisos para la pantalla de roles.
 *
 * 🔴 YA NO SE ESCRIBE AQUÍ. Vive en `generated/permissionCatalog.generated.ts`,
 * derivado de `INDIVIDUAL_PERMISSIONS_BY_RESOURCE` de avoqado-server con
 * `node scripts/regenerar-catalogo-permisos.mjs`.
 *
 * Esta lista era una copia a mano con un `⚠️ CRITICAL: must match the backend`
 * encima, y no cuadraba: el servidor exponía 233 permisos individuales y aquí
 * había 170. Los 63 que faltaban no se podían otorgar desde la pantalla de roles
 * — para el admin no existían, ni siquiera armando un rol personalizado. Se
 * re-exporta desde aquí para no tocar a los consumidores que ya la importan.
 */
export { PERMISSION_CATEGORIES } from './generated/permissionCatalog.generated'
export type { PermissionCategoryKey } from './generated/permissionCatalog.generated'
