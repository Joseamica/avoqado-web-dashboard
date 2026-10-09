import { describe, expect, it } from 'vitest'
import { overlappingTables } from '../overlap'
import type { DraftTable } from '../types'

const t = (key: string, x: number, y: number, extra: Partial<DraftTable> = {}): DraftTable => ({
  key, number: key, capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x, y, legacy: null, hasOpenOrder: false, ...extra,
})

describe('overlappingTables (H4: mesas viejas de la PAX encimadas)', () => {
  it('dos cuadradas una sobre otra se marcan; una tercera lejos, no', () => {
    expect([...overlappingTables([t('a', 10, 10), t('b', 12, 10), t('c', 30, 10)])].sort()).toEqual(['a', 'b'])
  })

  it('pegadas lado a lado (como se juntan para un grupo grande) NO cuentan como encimadas', () => {
    expect(overlappingTables([t('a', 10, 10), t('b', 14, 10)]).size).toBe(0)
  })

  it('dos mesas a 45° cuyas cajas se tocan pero los rombos no, no se marcan', () => {
    // Cuadradas de 4 giradas 45°: rombos de 5.66 de ancho. Con 5 de separación en cada eje sus cajas se enciman, los rombos no.
    expect(overlappingTables([t('a', 10, 10, { rotation: 45 }), t('b', 15, 15, { rotation: 45 })]).size).toBe(0)
  })

  it('una redonda encima de una larga sí se marca (el caso M4/M13 de la prueba real)', () => {
    expect(overlappingTables([t('m4', 20, 8, { shape: 'ROUND' }), t('m13', 24, 10, { shape: 'RECTANGLE', capacity: 8 })]).size).toBe(2)
  })

  it('las mesas sin lugar no cuentan', () => {
    expect(overlappingTables([t('a', 10, 10), t('b', 0, 0, { x: null, y: null })]).size).toBe(0)
  })
})
