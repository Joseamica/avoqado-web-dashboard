import type { GiftCardSettingsView } from '@/types/giftCard'

/** Qué enseña la página de tarjetas de regalo. Pura, para poder probarla sin pintar nada. */
export type VistaDeTarjetas = 'cargando' | 'cartel' | 'prender' | 'lista'

/**
 * - Con tarjetas vendidas (de cualquier estado) o con la función prendida ⇒ la lista. Bajar de plan o apagar NUNCA esconde
 *   saldos ni historial (spec §6; R9: sólo vender y prender son de Pro). `hasCards` lo manda C3 (`EXISTS`, decisión 1 del
 *   coordinador); si alguna vez faltara, `!== false` lo toma como «puede tener»: la lista, nunca el cartel.
 * - Nunca usadas: con el plan COMPROBADO sin la función ⇒ el cartel de Pro; con el plan ⇒ la invitación a prenderlas.
 *   Si el plan no se pudo comprobar, no se adivina el cartel (el gate es fail-open): la invitación.
 * - Si los ajustes fallaron, la lista igual se ve (no depende de ellos); el aviso de error va arriba con «Reintentar».
 */
export function decidirVista(p: {
  settings: GiftCardSettingsView | undefined
  settingsLoading: boolean
  tierLoading: boolean
  tierResolved: boolean
  hasAccess: boolean
}): VistaDeTarjetas {
  if (p.settingsLoading) return 'cargando'
  const s = p.settings
  if (!s) return 'lista'
  if (s.enabled || s.hasCards !== false) return 'lista'
  if (p.tierLoading) return 'cargando'
  if (p.tierResolved && !p.hasAccess) return 'cartel'
  return 'prender'
}

/**
 * Entrada «Tarjetas de regalo» del hub de Ajustes (D6 r1, M1): con `giftCards:read` y fuera de marca blanca, igual que el
 * menú lateral en la fase 1a. La ruta no cambia (el permiso del server protege los datos).
 */
export function verTarjetasEnAjustes(p: { puedeLeer: boolean; marcaBlanca: boolean }): boolean {
  return p.puedeLeer && !p.marcaBlanca
}
