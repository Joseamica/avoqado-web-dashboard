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
/**
 * 🔴 El DATO ya no vive aquí: se GENERA de avoqado-server.
 *
 * Era la tercera copia a mano de la familia, y la que más se notaba: no alimenta una
 * pantalla, gobierna qué ve cada rol en TODO el dashboard. Había derivado en las DOS
 * direcciones — el MANAGER no veía 70 opciones que sí podía usar, y al ADMIN se le pintaban
 * 27 botones que el servidor rechazaba.
 *
 * Se regenera con `npm run permissions:defaults`; `npm run check:permissions` truena si el
 * servidor se movió. Para cambiar los permisos de un rol, edítalos en
 * `avoqado-server/src/lib/permissions.ts` — aquí llegan solos.
 */
export { DEFAULT_PERMISSIONS } from './generated/defaultPermissions.generated'
import { DEFAULT_PERMISSIONS } from './generated/defaultPermissions.generated'

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
