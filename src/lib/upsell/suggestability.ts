/**
 * Upsell "¿Algo más?" — espejo EXACTO de los cinco filtros de `UpsellResolver`
 * del POS (`avoqado-android/app/src/main/java/com/avoqado/pos/pos/domain/UpsellResolver.kt:54-70`,
 * portado igual en iOS).
 *
 * 🔴 Existe porque el dashboard sólo conocía UNO de los cinco (el veto
 * `upsellEnabled`) y dejaba crear reglas que el POS descartaba en silencio —
 * y encima pedía los productos con `includeModifiers:false`, así que ni
 * siquiera tenía el dato de los otros. Si el POS agrega o quita un filtro,
 * este archivo cambia en el MISMO trabajo.
 *
 * 🟠 Ronda 1 de correcciones (2026-08-16): se agregó `DESACTIVADO`
 * (`product.active === false`, `UpsellResolver.kt:56`) — el selector dejaba
 * elegir un producto desactivado del catálogo y esa regla nunca le llegaba al
 * POS (el server también filtra `active: true` al servir las reglas activas),
 * en silencio: el mismo reclamo que originó esta tarea, sólo que en el quinto
 * lugar en vez del primero.
 *
 * El ORDEN de los `if` de abajo no es arbitrario — espeja línea por línea el
 * `when` real de `UpsellResolver` (VETADO → DESACTIVADO → SIN_EXISTENCIAS →
 * POR_PESO → PIDE_OPCIONES). Si dos motivos aplicaran a la vez, debe ganar el
 * mismo que gana en el POS.
 */

export type SuggestabilityReason = 'VETADO' | 'DESACTIVADO' | 'POR_PESO' | 'SIN_EXISTENCIAS' | 'PIDE_OPCIONES' | null

interface ProductLike {
  upsellEnabled?: boolean | null
  /**
   * 🔴 Se compara con `=== false` a propósito: `undefined` (el consumidor no pidió
   * el campo) NO bloquea. Copiar el `!== true` de `upsellEnabled` aquí dejaría
   * TODO el catálogo marcado como desactivado en cuanto una query omita el select.
   */
  active?: boolean | null
  soldByWeight?: boolean | null
  isOutOfStock?: boolean | null
  modifierGroups?: Array<{ group?: { required?: boolean } }>
}

const LABELS: Record<Exclude<SuggestabilityReason, null>, string> = {
  VETADO: 'Vetado en su ficha',
  DESACTIVADO: 'Desactivado en el catálogo',
  POR_PESO: 'Se vende por peso',
  SIN_EXISTENCIAS: 'Sin existencias',
  PIDE_OPCIONES: 'Pide elegir opciones',
}

export function suggestabilityOf(product: ProductLike): {
  blocked: boolean
  reason: SuggestabilityReason
  label: string | null
  /** Sólo PIDE_OPCIONES se arregla desde aquí, eligiendo las opciones. */
  resolvable: boolean
} {
  const ok = { blocked: false as const, reason: null, label: null, resolvable: false }

  // El veto del dueño gana sobre todo: es su decisión explícita en la ficha.
  if (product.upsellEnabled !== true) return { blocked: true, reason: 'VETADO', label: LABELS.VETADO, resolvable: false }
  // Un producto apagado en el catálogo es tan definitivo como el veto: el POS
  // ya lo descarta, así que aquí tiene que descartarse igual o el dashboard
  // dejaría crear reglas que nunca se disparan.
  if (product.active === false) return { blocked: true, reason: 'DESACTIVADO', label: LABELS.DESACTIVADO, resolvable: false }
  if (product.isOutOfStock) return { blocked: true, reason: 'SIN_EXISTENCIAS', label: LABELS.SIN_EXISTENCIAS, resolvable: false }
  if (product.soldByWeight) return { blocked: true, reason: 'POR_PESO', label: LABELS.POR_PESO, resolvable: false }

  if ((product.modifierGroups ?? []).some(g => g.group?.required)) {
    return { blocked: true, reason: 'PIDE_OPCIONES', label: LABELS.PIDE_OPCIONES, resolvable: true }
  }

  return ok
}
