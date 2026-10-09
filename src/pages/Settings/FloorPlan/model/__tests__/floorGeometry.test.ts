import { describe, expect, it } from 'vitest'
import {
  alignmentGuides,
  clampWallEnd,
  fitView,
  gridOf,
  nextTableNumber,
  nextTableNumbers,
  openOrderDot,
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

  // R31: 0 personas = «sin dato» (lo trae la sincronización de SoftRestaurant): se dibuja con la medida más chica.
  it('una mesa con 0 personas se dibuja como una de 2', () => {
    for (const shape of ['SQUARE', 'ROUND', 'RECTANGLE'] as const) expect(tableSizeCells(shape, 0)).toEqual(tableSizeCells(shape, 2))
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
  // Codex P2-6: con una mesa «9007199254740992», `+1` no cambia el número y el `while` no terminaba (pestaña congelada).
  it('un número enorme no congela la búsqueda: sigue entre los números chicos', () => {
    expect(nextTableNumber(['1', '9007199254740992'])).toBe('2')
    expect(nextTableNumber(['99999999999999999999', '3'])).toBe('4')
    expect(nextTableNumbers(['9007199254740993', '9007199254740992'], 2)).toEqual(['1', '2'])
    // Hasta 15 cifras el número se lee exacto y se sigue de él.
    expect(nextTableNumber(['999999999999999'])).toBe('1000000000000000')
  })
  it('la búsqueda da como mucho una vuelta por mesa (+1): siempre hay un libre', () => {
    const many = Array.from({ length: 500 }, (_, i) => String(i + 1))
    expect(nextTableNumber(many)).toBe('501')
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
  it('una diagonal que se pasa de la orilla se recorta sobre su propia línea: sigue a 45°', () => {
    // Área ancha 40 × 25. Recortar cada eje por separado daba (18, 25): 32°.
    const raw = snapWallEnd(10, 20, 20, 25)
    expect(raw).toEqual({ x: 18, y: 28 })
    expect(clampWallEnd(10, 20, raw.x, raw.y, 40, 25)).toEqual({ x: 15, y: 25 })
    expect(clampWallEnd(3, 3, -2, -2, 40, 25)).toEqual({ x: 0, y: 0 })
  })
  it('una pared recta sólo se recorta en su eje', () => {
    expect(clampWallEnd(5, 5, 50, 5, 40, 25)).toEqual({ x: 40, y: 5 })
    expect(clampWallEnd(5, 5, 5, -3, 40, 25)).toEqual({ x: 5, y: 0 })
  })
  it('una pared que ya cabe no cambia', () => {
    expect(clampWallEnd(2, 2, 6, 6, 40, 25)).toEqual({ x: 6, y: 6 })
    expect(clampWallEnd(2, 2, 2, 20, 40, 25)).toEqual({ x: 2, y: 20 })
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

describe('openOrderDot — el punto de cuenta abierta no gira con la mesa (H3)', () => {
  it.each([0, 90, 180, 270])('mesa larga a %i°: siempre en la esquina de arriba a la derecha de lo que se ve', rotation => {
    const { w, h } = tableSizeCells('RECTANGLE', 6)
    const e = rotatedExtent(w, h, rotation)
    const dot = openOrderDot('RECTANGLE', 6, rotation)
    expect(dot.dx).toBeCloseTo(e.w / 2 - 0.45, 5)
    expect(dot.dy).toBeCloseTo(-(e.h / 2 - 0.45), 5)
  })

  it('a 45° queda en la punta de arriba (la más arriba de las dos de la derecha), dentro de la mesa', () => {
    const dot = openOrderDot('SQUARE', 4, 45)
    expect(dot.dx).toBeCloseTo(0, 5)
    expect(dot.dy).toBeLessThan(0)
    expect(Math.abs(dot.dy)).toBeLessThan(Math.SQRT2 * 2)
  })

  it('la redonda lo tiene siempre en el mismo lugar, arriba a la derecha y DENTRO del círculo (M7)', () => {
    expect(openOrderDot('ROUND', 4, 135)).toEqual(openOrderDot('ROUND', 4, 0))
    for (const capacity of [2, 4, 6, 8]) {
      const r = tableSizeCells('ROUND', capacity).w / 2
      const dot = openOrderDot('ROUND', capacity, 0)
      expect(dot.dx).toBeGreaterThan(0)
      expect(dot.dy).toBeCloseTo(-dot.dx, 6)
      expect(Math.hypot(dot.dx, dot.dy) + 0.38).toBeLessThanOrEqual(r)
    }
  })
})
