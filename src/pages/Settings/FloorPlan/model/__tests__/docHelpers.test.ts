import { describe, expect, it } from 'vitest'
import { duplicateNumbers, keysToRenumber } from '../docHelpers'
import type { DraftTable } from '../types'

const t = (key: string, number: string, hasOpenOrder = false): DraftTable => ({
  key, number, capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x: 10, y: 10, legacy: null, hasOpenOrder,
})

describe('duplicateNumbers', () => {
  it('agrupa las mesas con el mismo número (sin espacios); las únicas no salen', () => {
    expect(duplicateNumbers([t('a', '5'), t('b', ' 5 '), t('c', '6')])).toEqual([{ number: '5', keys: ['a', 'b'] }])
    expect(duplicateNumbers([t('a', '1'), t('b', '2')])).toEqual([])
  })
})

describe('keysToRenumber', () => {
  it('de cada grupo repetido, las que NO tienen cuenta abierta («la nueva»); sin cuentas, todas', () => {
    const tables = [t('a', '2', true), t('b', '2'), t('c', '3'), t('d', '3')]
    expect(keysToRenumber(duplicateNumbers(tables), tables)).toEqual(['b', 'c', 'd'])
  })
  // m3 de 15-D: con todas en cuenta abierta, «Ver la nueva» no seleccionaba nada.
  it('si TODAS las del grupo tienen cuenta abierta, cae a todas las del grupo', () => {
    const tables = [t('a', '2', true), t('b', '2', true)]
    expect(keysToRenumber(duplicateNumbers(tables), tables)).toEqual(['a', 'b'])
  })
})
