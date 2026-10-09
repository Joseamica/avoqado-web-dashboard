import type { FloorShape, TableShape } from './types'

// Reglas de dibujo del plano (spec §4.3). Android, iOS y la PAX las copiarán por valor en su fase:
// si cambias una, cambia también la prueba que las fija.

export const round6 = (n: number) => Math.round(n * 1e6) / 1e6
export const clamp = (v: number, min: number, max: number) => Math.min(Math.max(v, min), max)

/** Cuadrícula de cada forma de área. El lado largo mide 40 cuadros. */
export function gridOf(shape: FloorShape | null): { cols: number; rows: number } {
  switch (shape ?? 'WIDE') {
    case 'SQUARE':
      return { cols: 40, rows: 40 }
    case 'TALL':
      return { cols: 25, rows: 40 }
    default:
      return { cols: 40, rows: 25 }
  }
}

/** Tamaño de una mesa en cuadros: lo deciden su forma y sus personas, nunca se estira a mano. */
export function tableSizeCells(shape: TableShape, capacity: number): { w: number; h: number } {
  const band = capacity <= 2 ? 0 : capacity <= 4 ? 1 : capacity <= 6 ? 2 : 3
  if (shape === 'RECTANGLE') return { w: band === 2 ? 8 : band === 3 ? Math.min(2 + capacity, 14) : 6, h: band === 0 ? 3 : 4 }
  const side = [3, 4, 5, 6][band]
  return { w: side, h: side }
}

/** Caja que ocupa una pieza girada (para que no se salga del lienzo). */
export function rotatedExtent(w: number, h: number, rotation: number): { w: number; h: number } {
  const r = (rotation * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return { w: round6(w * c + h * s), h: round6(w * s + h * c) }
}

/**
 * Dónde va el punto de «cuenta abierta», como desplazamiento desde el centro de la mesa: siempre en la esquina de
 * ARRIBA A LA DERECHA tal como se ve, sin importar el giro (antes giraba con la mesa y a 90° quedaba abajo).
 * En una mesa cuadrada o larga es la esquina (metida 0.45 cuadros) que, ya girada, queda más arriba a la derecha; en
 * una redonda, siempre el mismo lugar del borde, por dentro.
 */
export function openOrderDot(shape: TableShape, capacity: number, rotation: number): { dx: number; dy: number } {
  const { w, h } = tableSizeCells(shape, capacity)
  const inset = 0.45
  // Redonda: sobre el radio a 45° (arriba a la derecha), metido para que quede DENTRO del círculo.
  if (shape === 'ROUND') {
    const d = round6((w / 2 - inset) * Math.SQRT1_2)
    return { dx: d, dy: -d }
  }
  const r = (rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  let best = { dx: 0, dy: 0, score: -Infinity }
  for (const [sx, sy] of [[1, -1], [-1, -1], [-1, 1], [1, 1]]) {
    const lx = sx * (w / 2 - inset)
    const ly = sy * (h / 2 - inset)
    const dx = round6(lx * cos - ly * sin)
    const dy = round6(lx * sin + ly * cos)
    const score = round6(dx - dy)
    // Empate (una mesa a 45°: dos esquinas igual de «arriba a la derecha»): gana la de más arriba.
    if (score > best.score + 1e-6 || (Math.abs(score - best.score) <= 1e-6 && dy < best.dy)) best = { dx, dy, score }
  }
  return { dx: best.dx, dy: best.dy }
}

/** Centro imantado para que los BORDES de la pieza caigan en la cuadrícula. */
export function snapCenter(center: number, size: number): number {
  return round6(Math.round(center - size / 2) + size / 2)
}

/** Centro final de una mesa puesta en (x, y): imantada y dentro del lienzo. */
export function placeTable(x: number, y: number, shape: TableShape, capacity: number, rotation: number, cols: number, rows: number) {
  const { w, h } = tableSizeCells(shape, capacity)
  const e = rotatedExtent(w, h, rotation)
  return { x: clamp(snapCenter(x, e.w), e.w / 2, cols - e.w / 2), y: clamp(snapCenter(y, e.h), e.h / 2, rows - e.h / 2) }
}

/** Número de mesa que se lee como entero EXACTO: hasta 15 cifras `Number` no redondea (2^53 tiene 16). */
const SMALL_INTEGER = /^\d{1,15}$/
/** «M13», «Mesa 4», «T-2»: un prefijo que termina en algo que no es cifra, y un entero chico al final. */
const PREFIXED = /^(.*\D)(\d{1,15})$/

/**
 * El prefijo con que se numeran las mesas del local: el de más mesas, si al menos dos lo comparten y le gana a los
 * números sin prefijo. Si no, '' (números solos, como hasta ahora: «Barra» y «T1» no bastan para inventar un «T2»).
 * Pasada en vivo (9-oct): en un local con M1…M13, la mesa nueva salía «1».
 */
function numberingPrefix(taken: ReadonlySet<string>): string {
  const count = new Map<string, number>()
  for (const n of taken) {
    const prefix = SMALL_INTEGER.test(n) ? '' : PREFIXED.exec(n)?.[1]
    if (prefix !== undefined) count.set(prefix, (count.get(prefix) ?? 0) + 1)
  }
  let best = ''
  for (const [prefix, c] of count) if (prefix && c >= 2 && c > (count.get(best) ?? 0)) best = prefix
  return best
}

/**
 * El siguiente número libre después del mayor, con el prefijo con que el local numera sus mesas («M14» tras «M13»).
 * Los identificadores largos («9007199254740992») no cuentan: convertirlos con `Number` redondea, `+1` no cambiaba
 * nada y el ciclo no terminaba (Codex P2-6). Entre los `n + 1` siguientes siempre hay uno libre (sólo hay `n` mesas),
 * así que la búsqueda está acotada.
 */
export function nextTableNumber(numbers: readonly string[]): string {
  const taken = new Set(numbers.map(n => n.trim()))
  const prefix = numberingPrefix(taken)
  let max = 0
  for (const n of taken) {
    const m = prefix ? PREFIXED.exec(n) : null
    const digits = prefix ? (m?.[1] === prefix ? m[2] : undefined) : SMALL_INTEGER.test(n) ? n : undefined
    if (digits !== undefined) max = Math.max(max, Number(digits))
  }
  for (let i = 1; i <= taken.size; i++) if (!taken.has(`${prefix}${max + i}`)) return `${prefix}${max + i}`
  return `${prefix}${max + taken.size + 1}`
}

export function nextTableNumbers(numbers: readonly string[], count: number): string[] {
  const all = [...numbers]
  const out: string[] = []
  for (let i = 0; i < count; i++) {
    const n = nextTableNumber(all)
    all.push(n)
    out.push(n)
  }
  return out
}

/** Final de una pared imantado a 0/45/90°… y a la cuadrícula. */
export function snapWallEnd(x1: number, y1: number, x2: number, y2: number): { x: number; y: number } {
  const len = Math.hypot(x2 - x1, y2 - y1)
  if (len < 0.5) return { x: x1, y: y1 }
  const step = Math.PI / 4
  const angle = Math.round(Math.atan2(y2 - y1, x2 - x1) / step) * step
  const cos = round6(Math.cos(angle))
  const sin = round6(Math.sin(angle))
  if (cos === 0 || sin === 0) return { x: x1 + Math.round(cos * len), y: y1 + Math.round(sin * len) }
  const k = Math.round(Math.abs(cos) * len)
  return { x: x1 + Math.sign(cos) * k, y: y1 + Math.sign(sin) * k }
}

/**
 * Final de una pared ya imantado, metido al lienzo SIN cambiar su ángulo: si se pasa de la orilla, se recorre hacia
 * atrás sobre su propia línea (una diagonal sigue a 45°). Recortar cada eje por separado la torcía (10,20 → 18,28 en
 * un área de 40 × 25 quedaba en 18,25: 32°). El principio ya debe estar dentro.
 */
export function clampWallEnd(x1: number, y1: number, x2: number, y2: number, cols: number, rows: number): { x: number; y: number } {
  const dx = x2 - x1
  const dy = y2 - y1
  // Cuánto del tramo cabe en cada eje (1 = todo); un eje que no avanza no limita.
  const fit = (from: number, d: number, size: number) => (d > 0 ? (size - from) / d : d < 0 ? -from / d : Infinity)
  const t = Math.max(0, Math.min(1, fit(x1, dx, cols), fit(y1, dy, rows)))
  return { x: clamp(round6(x1 + dx * t), 0, cols), y: clamp(round6(y1 + dy * t), 0, rows) }
}

export interface Box {
  cx: number
  cy: number
  w: number
  h: number
}
export interface GuideLine {
  x1: number
  y1: number
  x2: number
  y2: number
}

/** Si la pieza que se arrastra queda casi alineada con otra (bordes o centro), la alinea y dibuja la guía. */
export function alignmentGuides(moving: Box, others: readonly Box[], threshold = 0.5): { dx: number; dy: number; lines: GuideLine[] } {
  const xs = (b: Box) => [b.cx - b.w / 2, b.cx, b.cx + b.w / 2]
  const ys = (b: Box) => [b.cy - b.h / 2, b.cy, b.cy + b.h / 2]
  let bestX: { d: number; at: number; other: Box } | null = null
  let bestY: { d: number; at: number; other: Box } | null = null
  for (const o of others) {
    for (const m of xs(moving))
      for (const v of xs(o))
        if (Math.abs(v - m) <= threshold && (!bestX || Math.abs(v - m) < Math.abs(bestX.d))) bestX = { d: v - m, at: v, other: o }
    for (const m of ys(moving))
      for (const v of ys(o))
        if (Math.abs(v - m) <= threshold && (!bestY || Math.abs(v - m) < Math.abs(bestY.d))) bestY = { d: v - m, at: v, other: o }
  }
  const dx = round6(bestX?.d ?? 0)
  const dy = round6(bestY?.d ?? 0)
  const lines: GuideLine[] = []
  if (bestX) {
    const o = bestX.other
    lines.push({
      x1: bestX.at,
      y1: Math.min(moving.cy + dy - moving.h / 2, o.cy - o.h / 2),
      x2: bestX.at,
      y2: Math.max(moving.cy + dy + moving.h / 2, o.cy + o.h / 2),
    })
  }
  if (bestY) {
    const o = bestY.other
    lines.push({
      x1: Math.min(moving.cx + dx - moving.w / 2, o.cx - o.w / 2),
      y1: bestY.at,
      x2: Math.max(moving.cx + dx + moving.w / 2, o.cx + o.w / 2),
      y2: bestY.at,
    })
  }
  return { dx, dy, lines }
}

/** Centros para N mesas nuevas en filas desde la esquina; las que no caben salen null («Sin acomodar»). */
export function quickStartLayout(
  count: number,
  capacity: number,
  tableShape: TableShape,
  floorShape: FloorShape,
): Array<{ x: number; y: number } | null> {
  const { cols, rows } = gridOf(floorShape)
  const { w, h } = tableSizeCells(tableShape, capacity)
  const margin = 2
  const gap = 3
  const perRow = Math.max(1, Math.floor((cols - 2 * margin + gap) / (w + gap)))
  const out: Array<{ x: number; y: number } | null> = []
  for (let i = 0; i < count; i++) {
    const x = margin + (i % perRow) * (w + gap) + w / 2
    const y = margin + Math.floor(i / perRow) * (h + gap) + h / 2
    out.push(y + h / 2 <= rows - margin / 2 ? { x, y } : null)
  }
  return out
}

export interface ViewBox {
  x: number
  y: number
  w: number
  h: number
}

/** Vista inicial: el área completa con 2 cuadros de margen. */
export function fitView(cols: number, rows: number): ViewBox {
  return { x: -2, y: -2, w: cols + 4, h: rows + 4 }
}

/** Zoom alrededor de un punto, entre 25 % y 400 % de la vista completa. */
export function zoomAround(view: ViewBox, at: { x: number; y: number }, factor: number, bounds: { cols: number; rows: number }): ViewBox {
  const full = bounds.cols + 4
  const w = clamp(view.w * factor, full / 4, full * 4)
  const k = w / view.w
  return { x: round6(at.x - (at.x - view.x) * k), y: round6(at.y - (at.y - view.y) * k), w: round6(w), h: round6(view.h * k) }
}
