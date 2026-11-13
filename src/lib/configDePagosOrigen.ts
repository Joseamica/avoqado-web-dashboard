/**
 * ¿La configuración de pagos que leyó la pantalla es del negocio o la HEREDÓ de su organización? (encargo e12dc4, 13-nov-2026)
 *
 * El SERVIDOR devuelve la de la organización cuando el negocio no tiene propia. Desde el 13-nov lo dice con
 * `configSource: 'venue' | 'organization'`. Con un SERVIDOR anterior (sin el campo) se reconoce por la forma de la fila:
 * la de la organización trae `organizationId` y no trae `venueId`.
 *
 * Por qué importa: la heredada NO se edita desde el negocio (el PUT apunta a una fila que no es suya y falla) ni se borra
 * desde ahí. Lo que sí se puede es CREAR la propia del negocio, partiendo de las cuentas heredadas para no perder ninguna
 * posición; desde ese momento el negocio deja de seguir los cambios de su organización (el candado de posiciones lo
 * confirma en el SERVIDOR).
 */
export type ConfigSource = 'venue' | 'organization'

interface ConfigConOrigen {
  configSource?: ConfigSource | null
  venueId?: string | null
  organizationId?: string | null
}

export function esHeredadaDeLaOrganizacion(config: ConfigConOrigen | null | undefined): boolean {
  if (!config) return false
  if (config.configSource) return config.configSource === 'organization'
  return !!config.organizationId && !config.venueId
}

interface CuentasDeConfig {
  primaryAccountId?: string | null
  secondaryAccountId?: string | null
  tertiaryAccountId?: string | null
}

/**
 * Las tres posiciones de la heredada con UNA cambiada: lo que se manda al crear la propia del negocio desde un diálogo que
 * sólo toca una posición (asignar una cuenta a un slot). Sin esto el negocio nacería con las otras posiciones vacías.
 */
export function cuentasParaConfigPropia(
  heredada: CuentasDeConfig,
  posicion: 'PRIMARY' | 'SECONDARY' | 'TERTIARY',
  cuentaId: string,
): { primaryAccountId: string; secondaryAccountId?: string; tertiaryAccountId?: string } {
  const cuentas = {
    PRIMARY: heredada.primaryAccountId ?? null,
    SECONDARY: heredada.secondaryAccountId ?? null,
    TERTIARY: heredada.tertiaryAccountId ?? null,
  }
  // Una cuenta no ocupa dos posiciones (el SERVIDOR lo rechaza): si ya estaba en otra, esa otra queda vacía.
  for (const p of ['PRIMARY', 'SECONDARY', 'TERTIARY'] as const) if (cuentas[p] === cuentaId) cuentas[p] = null
  cuentas[posicion] = cuentaId
  if (!cuentas.PRIMARY) throw new Error('La configuración propia del negocio necesita una cuenta principal')
  return {
    primaryAccountId: cuentas.PRIMARY,
    ...(cuentas.SECONDARY ? { secondaryAccountId: cuentas.SECONDARY } : {}),
    ...(cuentas.TERTIARY ? { tertiaryAccountId: cuentas.TERTIARY } : {}),
  }
}
