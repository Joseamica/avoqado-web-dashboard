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
/**
 * 🔴 El DATO ya no vive aquí: se GENERA de avoqado-server.
 *
 * Esta tabla estaba escrita a mano y había derivado a 68 entradas contra 180 del servidor —
 * 112 de menos. Entre las que faltaban estaban `tpv-payments:pay-later`, `discounts:apply` y
 * `coupons:redeem`, o sea justo las que el editor de roles necesita para avisar "este
 * permiso viene INCLUIDO en aquél". Sin ellas la pantalla dejaba desmarcar algo que el
 * backend repone en silencio: mentía.
 *
 * Se regenera con `npm run permissions:deps`, y `npm run check:permissions` truena si el
 * servidor se movió. Para AGREGAR una dependencia, edítala en
 * `avoqado-server/src/lib/permissions.ts` — aquí llega sola.
 *
 * Las FUNCIONES de abajo siguen escritas a mano a propósito: generar lógica es frágil,
 * generar una tabla que ya vive en el servidor es justo lo contrario.
 */
export { PERMISSION_DEPENDENCIES } from './generated/permissionDependencies.generated'
import { PERMISSION_DEPENDENCIES } from './generated/permissionDependencies.generated'

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
