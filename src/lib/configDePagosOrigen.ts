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

/**
 * Todo lo que LEE la configuración de pagos de un negocio, por clave de TanStack (Codex r2/r3 del encargo e12dc4: cada
 * escritor invalidaba una parte distinta y «Resumen de Ventas» o los márgenes se quedaban con la cuenta anterior hasta
 * 30 min). Cada pantalla que crea, cambia o borra la configuración llama ESTA función al guardar. Una lectura nueva de la
 * configuración se agrega aquí, no en cada escritor.
 *
 * Con `venueId` refresca sólo ese negocio; sin él (el escritor no sabe cuál o tocó varios), todos.
 */
export const LECTURAS_DE_CONFIG_DE_PAGOS = [
  'venue-payment-config',
  'venue-payment-config-for-angelpay-approval',
  'venue-cost-structures',
  'venue-pricing-structures',
  'payment-readiness',
  'venueMerchantAccounts',
  'venueSettlementInfo',
  'fiscal-add-merchant-accounts',
  'merchantRoutingRules',
] as const
/** Éstas van por cuenta (merchant) o son listas de todos: siempre se refrescan enteras. */
const LECTURAS_POR_CUENTA = [
  'venue-payment-config-by-merchant',
  'venue-configs-by-merchant',
  'merchant-account-configs',
  'all-venue-configs',
  // El asistente de pagos (por negocio u organización). Ojo: al reabrirlo llena su formulario con la caché antes de que
  // llegue la lectura nueva; esto la marca vieja, pero el llenado temprano es un pendiente aparte (Codex r5, pizarrón).
  'payment-setup-summary',
] as const

export function refrescarLecturasDeConfigDePagos(
  queryClient: { invalidateQueries: (filtro: { queryKey: readonly unknown[] }) => unknown },
  venueId?: string | null,
): void {
  for (const clave of LECTURAS_DE_CONFIG_DE_PAGOS) queryClient.invalidateQueries({ queryKey: venueId ? [clave, venueId] : [clave] })
  for (const clave of LECTURAS_POR_CUENTA) queryClient.invalidateQueries({ queryKey: [clave] })
}
