import { describe, expect, it } from 'vitest'
import {
  alignmentGuides,
  clampWallEnd,
  fitView,
  gridOf,
  MIN_TABLE_SIDE,
  customSizeCells,
  nextTableNumber,
  nextTableNumbers,
  openOrderDot,
  placeTable,
  quickStartLayout,
  rotatedExtent,
  sizeFits,
  snapWallEnd,
  tableSize,
  tableSizeCells,
  withFittedSize,
  zoomAround,
} from '../floorGeometry'
import type { TableShape } from '../types'

/** Una mesa automática (sin tamaño propio), como la miden `placeTable` y `openOrderDot`. */
const auto = (shape: TableShape, capacity: number, rotation = 0) => ({ shape, capacity, rotation, w: null, h: null })
const propia = (shape: TableShape, w: number | null, h: number | null, rotation = 0) => ({ shape, capacity: 4, rotation, w, h })

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
    expect(placeTable(10.3, 7.8, auto('SQUARE', 4), 40, 25)).toEqual({ x: 10, y: 8 }) // 4×4: bordes en 8 y 12
    expect(placeTable(10.3, 7.8, auto('SQUARE', 2), 40, 25)).toEqual({ x: 10.5, y: 7.5 }) // 3×3: bordes en 9 y 12
    expect(placeTable(39, 24, auto('RECTANGLE', 8), 40, 25)).toEqual({ x: 35, y: 23 }) // 10×4 pegada a la orilla
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

// Pasada en vivo (9-oct): en un local con M1…M13 la mesa nueva salía «1» y había que renombrarla a mano.
describe('números de mesa con el prefijo del local', () => {
  it('sigue el prefijo que comparten las mesas del local', () => {
    expect(nextTableNumber(['M1', 'M3', 'M4', 'M13', 'M9'])).toBe('M14')
    expect(nextTableNumber(['Mesa 1', 'Mesa 2'])).toBe('Mesa 3')
    expect(nextTableNumber(['T-1', 'T-2', 'Barra'])).toBe('T-3')
    expect(nextTableNumbers(['M1', 'M2'], 2)).toEqual(['M3', 'M4'])
  })
  it('gana el patrón con más mesas; empatados, los números solos', () => {
    expect(nextTableNumber(['M1', 'M2', '1'])).toBe('M3')
    expect(nextTableNumber(['M1', 'M2', 'B1', 'B2', 'B3'])).toBe('B4')
    expect(nextTableNumber(['M1', 'M2', '1', '2'])).toBe('3')
  })
  it('una sola mesa con prefijo no inventa el patrón', () => {
    expect(nextTableNumber(['T1', '4'])).toBe('5')
  })
  it('salta los ocupados y no confunde un prefijo con otro que lo contiene', () => {
    expect(nextTableNumber(['M1', 'M2', 'MM9', 'M3'])).toBe('M4')
    expect(nextTableNumber(['M1', 'M2', 'M3 '])).toBe('M4')
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
    const dot = openOrderDot(auto('RECTANGLE', 6, rotation))
    expect(dot.dx).toBeCloseTo(e.w / 2 - 0.45, 5)
    expect(dot.dy).toBeCloseTo(-(e.h / 2 - 0.45), 5)
  })

  it('a 45° queda en la punta de arriba (la más arriba de las dos de la derecha), dentro de la mesa', () => {
    const dot = openOrderDot(auto('SQUARE', 4, 45))
    expect(dot.dx).toBeCloseTo(0, 5)
    expect(dot.dy).toBeLessThan(0)
    expect(Math.abs(dot.dy)).toBeLessThan(Math.SQRT2 * 2)
  })

  it('la redonda lo tiene siempre en el mismo lugar, arriba a la derecha y DENTRO del círculo (M7)', () => {
    expect(openOrderDot(auto('ROUND', 4, 135))).toEqual(openOrderDot(auto('ROUND', 4)))
    for (const capacity of [2, 4, 6, 8]) {
      const r = tableSizeCells('ROUND', capacity).w / 2
      const dot = openOrderDot(auto('ROUND', capacity))
      expect(dot.dx).toBeGreaterThan(0)
      expect(dot.dy).toBeCloseTo(-dot.dx, 6)
      expect(Math.hypot(dot.dx, dot.dy) + 0.38).toBeLessThanOrEqual(r)
    }
  })
})

describe('tamaño libre de la mesa (spec 2026-10-12)', () => {
  // LA conversión 0–1 → cuadros. El caso 0.05 × 0.08 en un área larga es el MISMO en Android, iOS y el MCP.
  it('customSizeCells: floor(x + 0.5), de 2 al lado de su eje; redonda y cuadrada, el menor; sin los dos, null', () => {
    expect(customSizeCells('RECTANGLE', 0.05, 0.08, 25, 40)).toEqual({ w: 2, h: 3 }) // 1.25 → 1 → mínimo 2; 3.2 → 3
    expect(customSizeCells('RECTANGLE', 0.075, 0.16, 40, 25)).toEqual({ w: 3, h: 4 }) // 3.0000000000000004 → 3
    expect(customSizeCells('ROUND', 0.15, 0.16, 40, 25)).toEqual({ w: 4, h: 4 }) // 6 × 4 → el menor
    expect(customSizeCells('RECTANGLE', 0.01, 1.5, 40, 25)).toEqual({ w: 2, h: 25 }) // fuera de rango: a [2, eje]
    expect(customSizeCells('RECTANGLE', 0.075, null, 40, 25)).toBeNull()
    expect(customSizeCells('RECTANGLE', undefined, undefined, 40, 25)).toBeNull()
  })

  it('sizeFits: vale TAL CUAL sólo si son enteros de 2 al lado de su eje, un solo lado en redonda/cuadrada, y girada cabe', () => {
    expect(sizeFits(propia('RECTANGLE', null, null), 40, 25)).toBe(true)
    expect(sizeFits(propia('RECTANGLE', 30, 5, 45), 40, 25)).toBe(true) // 35 × 0.707 = 24.7 ≤ 25
    expect(sizeFits(propia('RECTANGLE', 30, 6, 45), 40, 25)).toBe(false) // el «+ Alto» de la auditoría: 25.5 > 25
    expect(sizeFits(propia('RECTANGLE', 1, 4), 40, 25)).toBe(false)
    expect(sizeFits(propia('RECTANGLE', 41, 4), 40, 25)).toBe(false)
    expect(sizeFits(propia('RECTANGLE', 3.5, 4), 40, 25)).toBe(false)
    expect(sizeFits(propia('ROUND', 5, 4), 40, 25)).toBe(false)
  })

  it('tableSize: el propio si trae los dos lados; si no, el automático; redonda y cuadrada usan el lado menor', () => {
    expect(tableSize(propia('RECTANGLE', null, null))).toEqual({ w: 6, h: 4 })
    expect(tableSize(propia('RECTANGLE', 3, null))).toEqual({ w: 6, h: 4 })
    expect(tableSize(propia('RECTANGLE', 3, 2))).toEqual({ w: 3, h: 2 })
    expect(tableSize(propia('ROUND', 6, 4))).toEqual({ w: 4, h: 4 })
    expect(tableSize(propia('SQUARE', 5, 5))).toEqual({ w: 5, h: 5 })
  })

  it('withFittedSize: sin tamaño propio, o si ya cabe, devuelve la MISMA mesa', () => {
    const a = propia('RECTANGLE', null, null)
    const b = propia('RECTANGLE', 3, 2)
    expect(withFittedSize(a, 40, 25)).toBe(a)
    expect(withFittedSize(b, 40, 25)).toBe(b)
  })

  it.each([
    ['larga más chica que 2', propia('RECTANGLE', 1, 0.4), 40, 25, { w: MIN_TABLE_SIDE, h: MIN_TABLE_SIDE }],
    ['larga más grande que el área: cada lado a su eje', propia('RECTANGLE', 50, 30), 40, 25, { w: 40, h: 25 }],
    // Auditoría: primero por eje (h=40 no cabe en 25 filas aunque girada se vea acostada) y así se guarda tal cual.
    ['4 × 40 girada 90° que viene de un área cuadrada, en una ancha', propia('RECTANGLE', 4, 40, 90), 40, 25, { w: 4, h: 25 }],
    // Por eje cabe (40 ≤ 40, 4 ≤ 25) pero girada mide 40 de alto: se achica ENTERA en proporción (× 0.625).
    ['larga de 40 girada 90° en un área ancha', propia('RECTANGLE', 40, 4, 90), 40, 25, { w: 25, h: 2 }],
    ['cuadrada con lados distintos', propia('SQUARE', 6, 4), 40, 25, { w: 4, h: 4 }],
    ['redonda más ancha que un área larga', propia('ROUND', 30, 30), 25, 40, { w: 25, h: 25 }],
    ['cuadrada de 25 girada 45° en un área larga', propia('SQUARE', 25, 25, 45), 25, 40, { w: 17, h: 17 }],
    // Codex, ronda 2: la proporción (× 0.7014) daba 28 × 2 (el 1.4 sube al mínimo 2) y girada medía 25.248711 de alto.
    // Con el lado corto fijo en 2 se achica el largo hasta que quepa: 27 × 0.866 + 2 × 0.5 = 24.38 ≤ 25.
    ['larga de 40 × 2 girada 60° en un área ancha: el mínimo 2 no la saca', propia('RECTANGLE', 40, 2, 60), 40, 25, { w: 27, h: 2 }],
  ] as const)('withFittedSize: %s', (_, t, cols, rows, esperado) => {
    const r = withFittedSize(t, cols, rows)
    expect(r).toMatchObject(esperado)
    // Lo que devuelve SIEMPRE vale tal cual en esa área (de 2 al lado de su eje y, girada, dentro).
    expect(sizeFits(r, cols, rows)).toBe(true)
  })

  it('placeTable y el punto de cuenta abierta usan el tamaño propio', () => {
    expect(placeTable(10.3, 7.8, propia('RECTANGLE', 3, 2), 40, 25)).toEqual({ x: 10.5, y: 8 }) // 3×2: bordes en 9-12 y 7-9
    expect(openOrderDot(propia('RECTANGLE', 3, 2))).toEqual({ dx: 1.05, dy: -0.55 })
  })
})
