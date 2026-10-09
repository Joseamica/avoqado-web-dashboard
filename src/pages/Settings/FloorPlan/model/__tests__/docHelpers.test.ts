import { describe, expect, it } from 'vitest'
import { duplicateNumbers } from '../docHelpers'
import type { DraftTable } from '../types'

const t = (key: string, number: string): DraftTable => ({
  key, number, capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x: 10, y: 10, legacy: null, hasOpenOrder: false,
})

describe('duplicateNumbers', () => {
  it('agrupa las mesas con el mismo número (sin espacios); las únicas no salen', () => {
    expect(duplicateNumbers([t('a', '5'), t('b', ' 5 '), t('c', '6')])).toEqual([{ number: '5', keys: ['a', 'b'] }])
    expect(duplicateNumbers([t('a', '1'), t('b', '2')])).toEqual([])
  })
})
