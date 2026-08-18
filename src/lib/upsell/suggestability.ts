/**
 * Upsell "¿Algo más?" — espejo de los cinco filtros de `UpsellResolver` del POS
 * (`avoqado-android/app/src/main/java/com/avoqado/pos/pos/domain/UpsellResolver.kt:54-70`,
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
 *
 * 🟡 Ronda final de correcciones (2026-08-17) — honestidad, no "EXACTO": de
 * los cinco, `SIN_EXISTENCIAS` está en el código pero NUNCA dispara hoy en la
 * práctica. Ver el comentario junto al `if (product.isOutOfStock)` abajo para
 * el porqué. La rama se queda a propósito (se encenderá sola el día que el
 * dato llegue), pero llamar a esto "espejo EXACTO" sin esa salvedad era
 * decirle al siguiente lector que las cinco ramas están vivas cuando sólo
 * cuatro lo están.
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
  modifierGroups?: Array<{ group?: { id?: string; required?: boolean } }>
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
  // 🔴 Esta rama NUNCA dispara hoy — dicho con la verdad, no con optimismo.
  // `isOutOfStock` no existe como columna de `Product` en `avoqado-server`
  // (verificado en `prisma/schema.prisma`) ni se calcula en NINGÚN endpoint de
  // productos del dashboard, con o sin `includeRecipe` — es un valor que el POS
  // (Android/iOS) calcula localmente contra el carrito en el momento de cobrar
  // (`UpsellResolver.kt`/`UpsellResolver.swift`), no algo que el catálogo del
  // dashboard pueda traer. Por eso `product.isOutOfStock` llega `undefined`
  // siempre desde `CreateRuleDialog`/`RuleRow` (`Upsell.tsx`), nunca `true`. Se
  // deja la rama de todos modos: el día que algún consumidor sí traiga el dato,
  // se enciende sola sin tocar este archivo, y mientras tanto sigue siendo fiel
  // al ORDEN real de `UpsellResolver.kt` (VETADO → DESACTIVADO → SIN_EXISTENCIAS
  // → POR_PESO), que es lo que garantiza que si dos motivos aplicaran a la vez,
  // gane el mismo que gana en el POS.
  if (product.isOutOfStock) return { blocked: true, reason: 'SIN_EXISTENCIAS', label: LABELS.SIN_EXISTENCIAS, resolvable: false }
  if (product.soldByWeight) return { blocked: true, reason: 'POR_PESO', label: LABELS.POR_PESO, resolvable: false }

  if ((product.modifierGroups ?? []).some(g => g.group?.required)) {
    return { blocked: true, reason: 'PIDE_OPCIONES', label: LABELS.PIDE_OPCIONES, resolvable: true }
  }

  return ok
}

/**
 * ¿La selección de la regla resuelve TODOS los grupos obligatorios del
 * producto? Espejo EXACTO de `UpsellRule.coversAllRequiredGroups` en
 * `avoqado-android/.../UpsellResolver.kt` y de `isSubset` en
 * `avoqado-ios/.../UpsellResolver.swift` — el mismo check que hace
 * `validateAndResolveModifiers` en el server. Vacío en ambos lados (sin
 * obligatorios) es verdad por vacuidad.
 *
 * 🔴 Ronda final de correcciones (2026-08-17): `RuleRow` (`Upsell.tsx`)
 * preguntaba "¿la regla trae ALGUNA selección?" (`suggestedModifiers.length >
 * 0`) en vez de "¿cubre TODAS?". Un producto con 2 grupos obligatorios y una
 * regla que sólo resolvió 1 pasaba esa pregunta — el badge de "pide opciones"
 * desaparecía y la fila se veía sana, mientras el POS seguía descartando la
 * tarjeta porque `coversAllRequiredGroups` (allá) sí exige el subconjunto
 * completo. Esta función cierra esa brecha con la pregunta ESTRICTA.
 */
export function coversAllRequiredGroups(
  product: ProductLike,
  // `modifierId` es opcional en el TIPO a propósito: esta función no lo usa,
  // pero la forma real que viaja por la app (`UpsellSuggestedModifierSelection`,
  // `rule.suggestedModifiers`) siempre lo trae — declararlo aquí evita que TS
  // rechace ese valor real (o un literal de test con la forma completa) por
  // "propiedad desconocida".
  suggestedModifiers: Array<{ groupId: string; modifierId?: string }> | null | undefined,
): boolean {
  const requiredGroupIds = (product.modifierGroups ?? [])
    .filter(g => g.group?.required && g.group.id)
    .map(g => g.group!.id as string)
  if (requiredGroupIds.length === 0) return true

  const resolvedGroupIds = new Set((suggestedModifiers ?? []).map(m => m.groupId))
  return requiredGroupIds.every(id => resolvedGroupIds.has(id))
}
