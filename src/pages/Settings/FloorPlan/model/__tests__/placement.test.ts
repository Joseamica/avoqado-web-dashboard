import { describe, expect, it } from 'vitest'
import { placeTable, tableSizeCells } from '../floorGeometry'
import { NEW_ELEMENT_SIZE, newTableCapacity, placementOf } from '../placement'

describe('placementOf (lo que se ve bajo el puntero = lo que se crea)', () => {
  it('sin pieza en la mano (seleccionar o pared) no hay vista previa', () => {
    expect(placementOf('select', 10, 10, 40, 25)).toBeNull()
    expect(placementOf('WALL', 10, 10, 40, 25)).toBeNull()
  })

  it('una mesa cae donde la pone placeTable, con las personas con que nace', () => {
    expect(newTableCapacity('RECTANGLE')).toBe(6)
    expect(newTableCapacity('SQUARE')).toBe(4)
    const p = placementOf('table:RECTANGLE', 39, 24, 40, 25)
    expect(p).toEqual({ kind: 'table', shape: 'RECTANGLE', capacity: 6, ...placeTable(39, 24, 'RECTANGLE', 6, 0, 40, 25), ...tableSizeCells('RECTANGLE', 6) })
  })

  it('barra, cocina y puerta: su caja centrada en el puntero y metida al lienzo', () => {
    expect(placementOf('BAR_COUNTER', 20, 10, 40, 25)).toEqual({ kind: 'box', x: 16, y: 9, ...NEW_ELEMENT_SIZE.BAR_COUNTER })
    expect(placementOf('SERVICE_AREA', 39, 24, 40, 25)).toEqual({ kind: 'box', x: 32, y: 19, w: 8, h: 6 })
    expect(placementOf('DOOR', 0, 0, 40, 25)).toEqual({ kind: 'box', x: 0, y: 0, w: 3, h: 1 })
  })

  it('el letrero empieza en el puntero, sin salirse', () => {
    expect(placementOf('LABEL', 45, 30, 40, 25)).toMatchObject({ kind: 'box', x: 39, y: 24 })
  })
})
