/**
 * La tabla de comparación de planes sale del MISMO mapa que decide el acceso (`includes`). Estas pruebas
 * impiden las dos formas de mentir: omitir una función que el plan sí da (la tarjeta de Premium mostraba
 * 6 de 12) o palomear una que no da.
 */
import { describe, expect, it } from 'vitest'
import { PLAN_TIERS } from '../plan-catalog'
import { PLAN_COMPARISON, TIERS_COMPARADOS, valorDeCelda } from '../plan-comparison'

const fila = (key: string) => PLAN_COMPARISON.flatMap(c => c.rows).find(r => r.key === key)!

describe('tabla de comparación de planes', () => {
  it('🔴 cada función de Free, Pro y Premium aparece en alguna fila', () => {
    const enTabla = new Set(PLAN_COMPARISON.flatMap(c => c.rows.flatMap(r => r.codes ?? [])))
    const faltan = PLAN_TIERS.filter(t => TIERS_COMPARADOS.includes(t.id as never))
      .flatMap(t => t.includes)
      .filter(code => !enTabla.has(code))
    expect(faltan).toEqual([])
  })

  it('las palomitas siguen al catálogo: CFDI sólo Premium, lealtad desde Pro, chatbot en todos', () => {
    expect(TIERS_COMPARADOS.map(t => valorDeCelda(fila('cfdi'), t))).toEqual([false, false, true])
    expect(TIERS_COMPARADOS.map(t => valorDeCelda(fila('loyalty'), t))).toEqual([false, true, true])
    expect(TIERS_COMPARADOS.map(t => valorDeCelda(fila('chatbot'), t))).toEqual([true, true, true])
    expect(TIERS_COMPARADOS.map(t => valorDeCelda(fila('scale'), t))).toEqual([false, false, true])
  })

  it('las filas sin código usan su valor escrito (usuarios)', () => {
    expect(valorDeCelda(fila('seats'), 'FREE')).toBe('upTo2')
    expect(valorDeCelda(fila('seats'), 'PREMIUM')).toBe('unlimited')
  })

  it('no hay filas repetidas (cada llave de texto es única)', () => {
    const keys = PLAN_COMPARISON.flatMap(c => c.rows.map(r => r.key))
    expect(new Set(keys).size).toBe(keys.length)
  })
})

import { esComun, novedadesDelPlan } from '../plan-comparison'

describe('resúmenes de la tabla', () => {
  it('las filas que todos los planes tienen igual se marcan como comunes', () => {
    expect(esComun(fila('pos'))).toBe(true)
    expect(esComun(fila('cfdi'))).toBe(false)
  })

  it('Pro agrega sobre Free y Premium sobre Pro, sin repetir lo de abajo', () => {
    const pro = novedadesDelPlan('PRO').flatMap(c => c.filas.map(f => f.key))
    const premium = novedadesDelPlan('PREMIUM').flatMap(c => c.filas.map(f => f.key))
    expect(pro).toEqual(expect.arrayContaining(['loyalty', 'reservations', 'seats']))
    expect(pro).not.toContain('cfdi')
    expect(premium).toEqual(expect.arrayContaining(['cfdi', 'commissions', 'delivery']))
    expect(premium).not.toContain('loyalty')
    expect(premium).not.toContain('seats')
  })
})
