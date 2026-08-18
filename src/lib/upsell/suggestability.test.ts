import { describe, it, expect } from 'vitest'
import { suggestabilityOf, coversAllRequiredGroups } from './suggestability'

const req = (required: boolean) => ({ group: { required } })

describe('suggestabilityOf — espejo EXACTO de los 5 filtros del POS', () => {
  it('producto normal → se puede sugerir', () => {
    expect(suggestabilityOf({ upsellEnabled: true, modifierGroups: [] })).toMatchObject({ blocked: false, reason: null })
  })

  it('sólo grupos OPCIONALES → se puede sugerir', () => {
    expect(suggestabilityOf({ upsellEnabled: true, modifierGroups: [req(false)] })).toMatchObject({ blocked: false })
  })

  it('vetado en su ficha → bloqueado y NO resoluble', () => {
    expect(suggestabilityOf({ upsellEnabled: false })).toMatchObject({
      blocked: true, reason: 'VETADO', resolvable: false,
    })
  })

  it('por peso → bloqueado y NO resoluble', () => {
    expect(suggestabilityOf({ upsellEnabled: true, soldByWeight: true })).toMatchObject({
      blocked: true, reason: 'POR_PESO', resolvable: false,
    })
  })

  it('sin existencias → bloqueado y NO resoluble', () => {
    expect(suggestabilityOf({ upsellEnabled: true, isOutOfStock: true })).toMatchObject({
      blocked: true, reason: 'SIN_EXISTENCIAS', resolvable: false,
    })
  })

  // 🔴 El caso del founder: éste SÍ se arregla eligiendo el tamaño.
  it('pide opciones obligatorias → bloqueado pero RESOLUBLE', () => {
    expect(suggestabilityOf({ upsellEnabled: true, modifierGroups: [req(true)] })).toMatchObject({
      blocked: true, reason: 'PIDE_OPCIONES', resolvable: true,
    })
  })

  it('el motivo se muestra en español, no un código', () => {
    expect(suggestabilityOf({ upsellEnabled: true, soldByWeight: true }).label).toBe('Se vende por peso')
    expect(suggestabilityOf({ upsellEnabled: false }).label).toBe('Vetado en su ficha')
  })

  it('el VETO gana sobre lo demás: es la decisión explícita del dueño', () => {
    expect(suggestabilityOf({ upsellEnabled: false, soldByWeight: true }).reason).toBe('VETADO')
  })

  it('desactivado en el catálogo → bloqueado y NO resoluble', () => {
    expect(suggestabilityOf({ upsellEnabled: true, active: false })).toMatchObject({
      blocked: true, reason: 'DESACTIVADO', label: 'Desactivado en el catálogo', resolvable: false,
    })
  })

  it('DESACTIVADO gana sobre por peso y sin existencias', () => {
    expect(suggestabilityOf({ upsellEnabled: true, active: false, soldByWeight: true, isOutOfStock: true }).reason).toBe('DESACTIVADO')
  })

  // El orden acordado con el POS: el veto del dueño sigue por encima de todo.
  it('el VETO gana incluso sobre DESACTIVADO', () => {
    expect(suggestabilityOf({ upsellEnabled: false, active: false }).reason).toBe('VETADO')
  })

  // 🔴 La trampa: si un consumidor no pide `active`, llega undefined. Eso NO es
  // "desactivado" — si lo tratáramos como tal, el catálogo entero se bloquearía.
  it('active ausente (undefined) NO bloquea', () => {
    expect(suggestabilityOf({ upsellEnabled: true, modifierGroups: [] })).toMatchObject({ blocked: false, reason: null })
  })

  // El orden real de UpsellResolver.kt: isOutOfStock (línea 59) se evalúa ANTES
  // que soldByWeight (línea 65). Ninguno de los dos aplica hoy en la práctica
  // (isOutOfStock siempre llega undefined desde el dashboard), pero el helper
  // debe seguir siendo un espejo fiel del orden real por si algún día sí llega.
  it('sin existencias gana sobre por peso cuando ambos aplican (mismo orden que UpsellResolver)', () => {
    expect(suggestabilityOf({ upsellEnabled: true, isOutOfStock: true, soldByWeight: true }).reason).toBe('SIN_EXISTENCIAS')
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// coversAllRequiredGroups — Ronda final de correcciones (2026-08-17)
//
// Espejo de `UpsellRule.coversAllRequiredGroups` (Android) / `isSubset` (iOS).
// `RuleRow` (Upsell.tsx) preguntaba "¿trae ALGUNA selección?" — esta es la
// pregunta ESTRICTA que en verdad decide si el POS pinta la tarjeta.
// ═══════════════════════════════════════════════════════════════════════════

const grupo = (id: string, required: boolean) => ({ group: { id, required } })

describe('coversAllRequiredGroups — espejo EXACTO de UpsellResolver (Android/iOS)', () => {
  it('sin grupos obligatorios → true por vacuidad, sin selección', () => {
    expect(coversAllRequiredGroups({ modifierGroups: [] }, null)).toBe(true)
    expect(coversAllRequiredGroups({}, undefined)).toBe(true)
  })

  it('sólo grupos OPCIONALES → true sin elegir nada', () => {
    expect(coversAllRequiredGroups({ modifierGroups: [grupo('g_op', false)] }, [])).toBe(true)
  })

  it('un grupo obligatorio, selección vacía → false', () => {
    expect(coversAllRequiredGroups({ modifierGroups: [grupo('g_tam', true)] }, [])).toBe(false)
    expect(coversAllRequiredGroups({ modifierGroups: [grupo('g_tam', true)] }, null)).toBe(false)
  })

  it('un grupo obligatorio, resuelto → true', () => {
    expect(coversAllRequiredGroups({ modifierGroups: [grupo('g_tam', true)] }, [{ groupId: 'g_tam', modifierId: 'm_gr' }])).toBe(true)
  })

  // 🔴 El caso que motiva la tarea: 2 obligatorios, sólo 1 resuelto. La cuenta
  // vieja (`suggestedModifiers.length > 0`) daba TRUE aquí — mentira por
  // omisión, el POS descarta la tarjeta de todos modos.
  it('🔴 DOS grupos obligatorios, sólo UNO resuelto → false (la cuenta vieja decía true)', () => {
    const product = { modifierGroups: [grupo('g_tam', true), grupo('g_sabor', true)] }
    expect(coversAllRequiredGroups(product, [{ groupId: 'g_tam', modifierId: 'm_gr' }])).toBe(false)
  })

  it('DOS grupos obligatorios, AMBOS resueltos → true', () => {
    const product = { modifierGroups: [grupo('g_tam', true), grupo('g_sabor', true)] }
    expect(
      coversAllRequiredGroups(product, [
        { groupId: 'g_tam', modifierId: 'm_gr' },
        { groupId: 'g_sabor', modifierId: 'm_ch' },
      ]),
    ).toBe(true)
  })

  it('una selección para un grupo AJENO no cuenta como resuelto', () => {
    expect(coversAllRequiredGroups({ modifierGroups: [grupo('g_tam', true)] }, [{ groupId: 'g_otro', modifierId: 'm_x' }])).toBe(false)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 🔴 P2 (2026-08-17): fail-CLOSED, no fail-open. Antes, `g.group.id` vivía
  // DENTRO del predicado del filtro (`g.group?.required && g.group.id`): un
  // grupo obligatorio SIN id se caía del conjunto exigido y la función
  // respondía "sí cubre" — al revés de Android/iOS, donde el id no es
  // opcional. Con el bug presente, el primer test de abajo daba `true`.
  // ─────────────────────────────────────────────────────────────────────────

  it('🔴 un grupo OBLIGATORIO sin id NUNCA cuenta como cubierto (fail-closed, como el POS)', () => {
    const productoConIdCorrupto = { modifierGroups: [{ group: { required: true } }] } // sin `id`
    expect(coversAllRequiredGroups(productoConIdCorrupto, [])).toBe(false)
    // Ni siquiera con selecciones de sobra: no hay id contra el cuál resolverlo.
    expect(coversAllRequiredGroups(productoConIdCorrupto, [{ groupId: 'g_tam', modifierId: 'm_gr' }])).toBe(false)
  })

  it('🔴 un grupo obligatorio SIN id junto a uno CON id, ambos resueltos → sigue false', () => {
    // El grupo sano no debe "tapar" al corrupto: basta que UNO no se pueda
    // verificar para que la respuesta completa sea "no cubre".
    const producto = { modifierGroups: [{ group: { required: true } }, grupo('g_sabor', true)] }
    expect(coversAllRequiredGroups(producto, [{ groupId: 'g_sabor', modifierId: 'm_ch' }])).toBe(false)
  })

  it('un grupo obligatorio con id VACÍO ("") también bloquea, no sólo undefined', () => {
    const producto = { modifierGroups: [{ group: { id: '', required: true } }] }
    expect(coversAllRequiredGroups(producto, [])).toBe(false)
  })
})
