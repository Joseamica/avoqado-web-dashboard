import { rotatedExtent, tableSizeCells } from './floorGeometry'
import type { DraftTable } from './types'

type Pt = { x: number; y: number }

/** Lo que se encima menos de esto (un cuarto de cuadro) cuenta como «pegadas», no como encimadas: juntar mesas es normal. */
const TOLERANCE = 0.25

/** Contorno de la mesa ya girada: rectángulo (4 esquinas) o, la redonda, un polígono de 16 lados. */
function outline(t: DraftTable): Pt[] {
  const { w, h } = tableSizeCells(t.shape, t.capacity)
  const cx = t.x as number
  const cy = t.y as number
  if (t.shape === 'ROUND') {
    return Array.from({ length: 16 }, (_, i) => {
      const a = (i * Math.PI) / 8
      return { x: cx + (w / 2) * Math.cos(a), y: cy + (w / 2) * Math.sin(a) }
    })
  }
  const r = (t.rotation * Math.PI) / 180
  const cos = Math.cos(r)
  const sin = Math.sin(r)
  return [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ].map(([sx, sy]) => {
    const lx = (sx * w) / 2
    const ly = (sy * h) / 2
    return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos }
  })
}

function project(poly: Pt[], axis: Pt): [number, number] {
  let min = Infinity
  let max = -Infinity
  for (const p of poly) {
    const v = p.x * axis.x + p.y * axis.y
    if (v < min) min = v
    if (v > max) max = v
  }
  return [min, max]
}

/** Separación por ejes (SAT): dos contornos convexos se enciman si en NINGÚN eje hay hueco (con la tolerancia). */
function overlaps(a: Pt[], b: Pt[]): boolean {
  for (const poly of [a, b]) {
    for (let i = 0; i < poly.length; i++) {
      const p = poly[i]
      const q = poly[(i + 1) % poly.length]
      const len = Math.hypot(q.x - p.x, q.y - p.y) || 1
      const axis = { x: -(q.y - p.y) / len, y: (q.x - p.x) / len }
      const [minA, maxA] = project(a, axis)
      const [minB, maxB] = project(b, axis)
      if (Math.min(maxA, maxB) - Math.max(minA, minB) <= TOLERANCE) return false
    }
  }
  return true
}

/**
 * Mesas acomodadas que se enciman con otra (H4: las mesas viejas de la PAX pueden caer unas sobre otras). Devuelve sus
 * claves. Primero descarta por caja (barato); sólo las que se tocan por caja pasan a la prueba exacta.
 */
export function overlappingTables(tables: readonly DraftTable[]): Set<string> {
  const placed = tables
    .filter(t => t.x !== null && t.y !== null)
    .map(t => {
      const s = tableSizeCells(t.shape, t.capacity)
      const e = rotatedExtent(s.w, s.h, t.rotation)
      return { t, minX: (t.x as number) - e.w / 2, maxX: (t.x as number) + e.w / 2, minY: (t.y as number) - e.h / 2, maxY: (t.y as number) + e.h / 2 }
    })
    .sort((a, b) => a.minX - b.minX)
  const hit = new Set<string>()
  const shapes = new Map<string, Pt[]>()
  const shapeOf = (t: DraftTable) => shapes.get(t.key) ?? (shapes.set(t.key, outline(t)), shapes.get(t.key) as Pt[])
  for (let i = 0; i < placed.length; i++) {
    const a = placed[i]
    for (let j = i + 1; j < placed.length; j++) {
      const b = placed[j]
      if (b.minX >= a.maxX - TOLERANCE) break // ordenadas por su orilla izquierda: ninguna más adelante alcanza a `a`
      if (Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY) <= TOLERANCE) continue
      if (overlaps(shapeOf(a.t), shapeOf(b.t))) {
        hit.add(a.t.key)
        hit.add(b.t.key)
      }
    }
  }
  return hit
}
