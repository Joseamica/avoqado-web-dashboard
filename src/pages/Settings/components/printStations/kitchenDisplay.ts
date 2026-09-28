import type { PrintStation } from '@/services/printStations.service'

/**
 * A dónde llega la comanda de una estación, con la regla de la caja (spec 2026-09-27 §5, `KitchenDeliveryPolicy`):
 *  - con impresora propia, sale en esa impresora;
 *  - con pantalla EFECTIVA (casilla prendida Y plan que la incluye), aparece en la pantalla;
 *  - sin impresora ni pantalla, la caja la imprime en su impresora de cocina (hallazgo H4: así funciona hoy).
 */
export type DestinoDeComanda = 'PAPEL' | 'PANTALLA' | 'AMBAS' | 'PAPEL_DE_LA_CAJA'

export function destinoDeComanda(station: Pick<PrintStation, 'printerId'>, pantallaEfectiva: boolean): DestinoDeComanda {
  const tieneImpresora = station.printerId != null
  if (tieneImpresora && pantallaEfectiva) return 'AMBAS'
  if (tieneImpresora) return 'PAPEL'
  if (pantallaEfectiva) return 'PANTALLA'
  return 'PAPEL_DE_LA_CAJA'
}

/**
 * Destino de un plan del simulador (`previewRouting`). La pantalla cuenta sólo si su casilla está prendida Y el negocio
 * tiene el plan: es el `hasKitchenDisplay` EFECTIVO que el servidor manda a la caja en print-config.
 */
export function destinoDelPlan(
  plan: { stationId: string | null },
  estaciones: PrintStation[],
  tieneAccesoPro: boolean,
): DestinoDeComanda | null {
  if (!plan.stationId) return null
  const estacion = estaciones.find(s => s.id === plan.stationId)
  return estacion ? destinoDeComanda(estacion, estacion.hasKitchenDisplay && tieneAccesoPro) : null
}

/** Qué ve y qué puede hacer quien mira la casilla «Pantalla» de UNA estación. */
export type EstadoDeCasilla =
  | { tipo: 'OCULTA' }
  | { tipo: 'SOLO_LECTURA' }
  | { tipo: 'REQUIERE_PRO' }
  | { tipo: 'SOLO_APAGAR'; motivo: 'PLAN' | 'LANZAMIENTO' }
  | { tipo: 'EDITABLE'; soloAvoqado: boolean }

export interface EntradaDeCasilla {
  /** `kitchenDisplayOpenToClients` del servidor (puerta de lanzamiento de la fase 3.6). */
  abiertaAClientes: boolean
  esSuperadmin: boolean
  /** `can('printers:manage')` — el permiso que pide la ruta de la casilla (decisión D-B). */
  puedeConfigurar: boolean
  /** `useTierFeatureAccess('KITCHEN_DISPLAY').hasAccess` — plan Pro o superior (decisión D-A). */
  tieneAccesoPro: boolean
  /** `station.hasKitchenDisplay` tal como está guardado. */
  prendida: boolean
}

/**
 * Espejo EN PANTALLA de lo que el servidor deja hacer (`setKitchenDisplay`, fase 3.1): prender pasa por la puerta de
 * lanzamiento y por el plan; apagar siempre se puede. El servidor sigue siendo la autoridad (403 con código); esto sólo
 * evita ofrecer lo que va a rechazar.
 *  - Antes del lanzamiento el cliente no ve la casilla, salvo una estación que Avoqado prendió como prueba: ésa la puede
 *    APAGAR quien configura impresoras, para que nunca quede atorada.
 *  - Sin `printers:manage` sólo se mira.
 *  - Sin Pro no se prende; una ya prendida (bajó de plan) se puede apagar.
 */
export function estadoDeCasilla(e: EntradaDeCasilla): EstadoDeCasilla {
  if (e.esSuperadmin) return { tipo: 'EDITABLE', soloAvoqado: !e.abiertaAClientes }
  if (!e.abiertaAClientes) {
    return e.prendida && e.puedeConfigurar ? { tipo: 'SOLO_APAGAR', motivo: 'LANZAMIENTO' } : { tipo: 'OCULTA' }
  }
  if (!e.puedeConfigurar) return { tipo: 'SOLO_LECTURA' }
  if (!e.tieneAccesoPro) return e.prendida ? { tipo: 'SOLO_APAGAR', motivo: 'PLAN' } : { tipo: 'REQUIERE_PRO' }
  return { tipo: 'EDITABLE', soloAvoqado: false }
}

/** Códigos con que el servidor rechaza PRENDER una pantalla (fase 3.1, `assertPuedePrenderPantalla`). */
export const RECHAZO_NO_LANZADA = 'KITCHEN_DISPLAY_NOT_RELEASED'
export const RECHAZO_REQUIERE_PRO = 'KITCHEN_DISPLAY_REQUIRES_PRO'

/** `code` de un error de axios (el manejador global del servidor responde `{ message, code }`), o null. */
export function codigoDeRechazo(error: unknown): string | null {
  const code = (error as { response?: { data?: { code?: unknown } } } | undefined)?.response?.data?.code
  return typeof code === 'string' ? code : null
}
