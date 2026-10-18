import type { User } from '@/types'

/**
 * ¿Esta persona es DUEÑA de la organización? La misma regla que el servidor (`requireOrgOwner` /
 * `esDuenoDeEstaOrganizacionOSuperadmin`): un superadmin, o una membresía de ORGANIZACIÓN con rol
 * OWNER (`user.organizationMemberships`, que el servidor arma sólo con filas activas).
 *
 * Ser OWNER de una sucursal de la org NO basta — eso es lo que mira `OrganizationLayout` para dejar
 * entrar a la página, y por eso no sirve para las acciones que el servidor reserva al dueño de la
 * organización (migrar una terminal, cambiarle el comercio, borrarla de fábrica). Una sesión de un
 * servidor viejo sin `organizationMemberships` falla cerrado.
 */
export function isOrganizationOwner(
  user: Pick<User, 'role' | 'organizationMemberships'> | null | undefined,
  organizationId: string | null | undefined,
): boolean {
  if (user?.role === 'SUPERADMIN') return true
  if (!organizationId) return false
  return !!user?.organizationMemberships?.some(m => m.organizationId === organizationId && m.role === 'OWNER')
}
