import { describe, expect, it } from 'vitest'
import {
  alignmentGuides,
  fitView,
  gridOf,
  nextTableNumber,
  nextTableNumbers,
  placeTable,
  quickStartLayout,
  rotatedExtent,
  snapWallEnd,
  tableSizeCells,
  zoomAround,
} from '../floorGeometry'

describe('reglas de dibujo (spec §4.3)', () => {
  it('cada forma de área tiene su cuadrícula; null es ANCHO', () => {
    expect(gridOf('WIDE')).toEqual({ cols: 40, rows: 25 })
    expect(gridOf('SQUARE')).toEqual({ cols: 40, rows: 40 })
    expect(gridOf('TALL')).toEqual({ cols: 25, rows: 40 })
    expect(gridOf(null)).toEqual({ cols: 40, rows: 25 })
  })

  it.each([
    ['SQUARE', 2, 3, 3],
    ['SQUARE', 4, 4, 4],
    ['SQUARE', 6, 5, 5],
    ['SQUARE', 10, 6, 6],
    ['ROUND', 2, 3, 3],
    ['ROUND', 4, 4, 4],
    ['ROUND', 5, 5, 5],
    ['ROUND', 8, 6, 6],
    ['RECTANGLE', 2, 6, 3],
    ['RECTANGLE', 4, 6, 4],
    ['RECTANGLE', 6, 8, 4],
    ['RECTANGLE', 8, 10, 4],
    ['RECTANGLE', 20, 14, 4],
  ] as const)('mesa %s de %i personas mide %i×%i cuadros', (shape, capacity, w, h) => {
    expect(tableSizeCells(shape, capacity)).toEqual({ w, h })
  })

  it('girar 90° intercambia ancho y alto; 45° ocupa más', () => {
    expect(rotatedExtent(6, 4, 90)).toEqual({ w: 4, h: 6 })
    expect(rotatedExtent(4, 4, 45).w).toBeCloseTo(5.656854, 5)
  })
})

describe('placeTable', () => {
  it('imanta los bordes a la cuadrícula y no deja salir la mesa del lienzo', () => {
    expect(placeTable(10.3, 7.8, 'SQUARE', 4, 0, 40, 25)).toEqual({ x: 10, y: 8 }) // 4×4: bordes en 8 y 12
    expect(placeTable(10.3, 7.8, 'SQUARE', 2, 0, 40, 25)).toEqual({ x: 10.5, y: 7.5 }) // 3×3: bordes en 9 y 12
    expect(placeTable(39, 24, 'RECTANGLE', 8, 0, 40, 25)).toEqual({ x: 35, y: 23 }) // 10×4 pegada a la orilla
  })
})

describe('números de mesa', () => {
  it('toma el siguiente número libre', () => {
    expect(nextTableNumber([])).toBe('1')
    expect(nextTableNumber(['1', '2', '7'])).toBe('8')
    expect(nextTableNumber(['Barra', 'T1'])).toBe('1')
  })
  it('reparte varios seguidos sin repetir', () => {
    expect(nextTableNumbers(['3'], 3)).toEqual(['4', '5', '6'])
  })
})

describe('paredes', () => {
  it('se imantan a recto y diagonal', () => {
    expect(snapWallEnd(0, 0, 10, 1)).toEqual({ x: 10, y: 0 })
    expect(snapWallEnd(0, 0, 5, 4.6)).toEqual({ x: 5, y: 5 })
    expect(snapWallEnd(3, 3, 3, -4)).toEqual({ x: 3, y: -4 })
  })
  it('un clic sin moverse no hace pared', () => {
    expect(snapWallEnd(2, 2, 2.2, 2.1)).toEqual({ x: 2, y: 2 })
  })
})

describe('guías de alineación', () => {
  it('alinea bordes cercanos y dibuja la guía', () => {
    const r = alignmentGuides({ cx: 10.5, cy: 20, w: 4, h: 4 }, [{ cx: 10, cy: 5, w: 4, h: 4 }])
    expect(r.dx).toBe(-0.5)
    expect(r.dy).toBe(0)
    expect(r.lines).toEqual([{ x1: 8, y1: 3, x2: 8, y2: 22 }])
  })
  it('sin vecinos cerca no mueve nada', () => {
    expect(alignmentGuides({ cx: 30, cy: 20, w: 3, h: 3 }, [{ cx: 5, cy: 5, w: 4, h: 4 }])).toEqual({ dx: 0, dy: 0, lines: [] })
  })
})

describe('arranque rápido', () => {
  it('acomoda las mesas en filas desde la esquina', () => {
    const p = quickStartLayout(8, 4, 'SQUARE', 'WIDE')
    expect(p).toHaveLength(8)
    expect(p[0]).toEqual({ x: 4, y: 4 })
    expect(p[1]).toEqual({ x: 11, y: 4 })
    expect(p[5]).toEqual({ x: 4, y: 11 })
    expect(p.every(Boolean)).toBe(true)
  })
  it('las que ya no caben quedan sin acomodar (null)', () => {
    const p = quickStartLayout(20, 4, 'SQUARE', 'WIDE')
    expect(p.filter(Boolean)).toHaveLength(15)
    expect(p[19]).toBeNull()
  })
})

describe('zoom', () => {
  it('acerca alrededor del punto y respeta los topes', () => {
    const v = fitView(40, 25)
    const z = zoomAround(v, { x: 18, y: 10.5 }, 0.5, { cols: 40, rows: 25 })
    expect(z.w).toBe(22)
    expect(z.x + z.w / 2).toBeCloseTo(18 - (18 - (v.x + v.w / 2)) * 0.5, 5)
    expect(zoomAround(v, { x: 0, y: 0 }, 0.0001, { cols: 40, rows: 25 }).w).toBe(11)
  })
})
