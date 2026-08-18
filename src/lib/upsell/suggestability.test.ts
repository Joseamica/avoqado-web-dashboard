import { describe, it, expect } from 'vitest'
import { suggestabilityOf } from './suggestability'

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
