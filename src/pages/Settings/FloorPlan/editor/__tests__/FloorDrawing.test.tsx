import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { FloorDrawing } from '../FloorDrawing'
import type { DraftArea, DraftElement, DraftTable } from '../../model/types'

const area: DraftArea = { key: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false }
const t = (number: string, extra: Partial<DraftTable> = {}): DraftTable => ({
  key: `t${number}`, number, capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x: 10, y: 10, legacy: null, hasOpenOrder: false, ...extra,
})
const wall: DraftElement = { key: 'w1', type: 'WALL', areaKey: 'a1', x: 0, y: 0, w: null, h: null, rotation: 0, x2: 10, y2: 0, label: null, color: null }
const kitchen: DraftElement = { key: 'k1', type: 'SERVICE_AREA', areaKey: 'a1', x: 30, y: 1, w: 8, h: 6, rotation: 0, x2: null, y2: null, label: 'Cocina', color: null }
const door = (extra: Partial<DraftElement>): DraftElement => ({
  key: 'd1', type: 'DOOR', areaKey: 'a1', x: 5, y: 4, w: 3, h: 1, rotation: 0, x2: null, y2: null, label: null, color: null, ...extra,
})

const draw = (props: Partial<Parameters<typeof FloorDrawing>[0]> = {}) =>
  render(<svg><FloorDrawing area={area} tables={[t('1'), t('2', { x: null, y: null }), t('3', { shape: 'ROUND', rotation: 45, x: 20 })]} elements={[wall, kitchen]} {...props} /></svg>)

/** Puntos (x, y) por los que pasa un trazo `M … L … A …` (los extremos de cada tramo). */
function pathPoints(d: string): Array<{ x: number; y: number }> {
  const tokens = d.trim().split(/[\s,]+/)
  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < tokens.length; ) {
    const cmd = tokens[i++]
    if (cmd === 'M' || cmd === 'L') {
      points.push({ x: Number(tokens[i]), y: Number(tokens[i + 1]) })
      i += 2
    } else if (cmd === 'A') {
      points.push({ x: Number(tokens[i + 5]), y: Number(tokens[i + 6]) })
      i += 7
    } else throw new Error(`comando inesperado: ${cmd}`)
  }
  return points
}

describe('FloorDrawing', () => {
  it('dibuja sólo las mesas acomodadas, con su número', () => {
    draw()
    expect(screen.getByTestId('floor-table-1')).toBeInTheDocument()
    expect(screen.queryByTestId('floor-table-2')).not.toBeInTheDocument()
    expect(screen.getByTestId('floor-table-3')).toHaveAttribute('transform', 'rotate(45 20 10)')
  })

  it('dibuja paredes y áreas de servicio con su nombre', () => {
    draw()
    expect(screen.getByTestId('floor-element-w1').tagName).toBe('line')
    expect(screen.getByText('Cocina')).toBeInTheDocument()
  })

  it('el arrastre en curso mueve sólo lo arrastrado', () => {
    draw({ ghost: { keys: new Set(['t1']), dx: 3, dy: 0 } })
    expect(screen.getByTestId('floor-table-1').getAttribute('transform')).toBe('rotate(0 13 10)')
  })

  it('marca la mesa con cuenta abierta', () => {
    draw({ tables: [t('7', { hasOpenOrder: true })] })
    expect(screen.getByTestId('floor-open-order-7')).toBeInTheDocument()
  })

  it('H3: el punto de cuenta abierta de una mesa girada 90° sigue arriba a la derecha (no gira con ella)', () => {
    // Larga de 6 (8 × 4) parada: se ve de 4 de ancho y 8 de alto con centro en (10, 10).
    draw({ tables: [t('9', { shape: 'RECTANGLE', capacity: 6, rotation: 90, hasOpenOrder: true })] })
    const dot = screen.getByTestId('floor-open-order-9')
    // El punto vive en el grupo contra-girado: sus coordenadas ya son las de la pantalla.
    expect(dot.parentElement?.getAttribute('transform')).toBe('rotate(-90 10 10)')
    expect(Number(dot.getAttribute('cx'))).toBeCloseTo(10 + 2 - 0.45, 5)
    expect(Number(dot.getAttribute('cy'))).toBeCloseTo(10 - 4 + 0.45, 5)
  })

  it('la puerta parada (más alta que ancha) dibuja su abatimiento hacia un lado, sin girar', () => {
    draw({ tables: [], elements: [door({ w: 1, h: 3 })] })
    const g = screen.getByTestId('floor-element-d1')
    expect(g).toHaveAttribute('transform', 'rotate(0 5.5 5.5)')
    const rect = g.querySelector('rect')
    expect(rect).toHaveAttribute('width', '1')
    expect(rect).toHaveAttribute('height', '3')
    const path = g.querySelector('path')
    expect(path).not.toBeNull()
    const pts = pathPoints(path?.getAttribute('d') ?? '')
    // Bisagra arriba a la izquierda; la hoja abierta sale a lo ancho y el arco cierra sobre el claro (el lado izquierdo).
    expect(pts).toEqual([
      { x: 5, y: 4 },
      { x: 8, y: 4 },
      { x: 5, y: 7 },
    ])
    for (const p of pts) {
      expect(p.x).toBeGreaterThanOrEqual(5)
      expect(p.x).toBeLessThanOrEqual(5 + 3)
    }
  })

  it('la puerta acostada a 180° se voltea con el giro (abre hacia el otro lado)', () => {
    draw({ tables: [], elements: [door({ x: 10, y: 2, w: 3, h: 1, rotation: 180 })] })
    const g = screen.getByTestId('floor-element-d1')
    expect(g).toHaveAttribute('transform', 'rotate(180 11.5 2.5)')
    expect(g.querySelector('path')).toHaveAttribute('d', 'M 10 3 L 10 0 A 3 3 0 0 1 13 3')
  })

  it('en la vista del mesero, libre y ocupada usan colores del tema que sí existen', () => {
    // `fill-success/20` y `stroke-success` no se generan: el @theme no registra --color-success (sólo --success).
    draw({ tables: [t('1'), t('4', { x: 20 })], elements: [], busyKeys: new Set(['t4']) })
    const free = screen.getByTestId('floor-table-1').querySelector('rect')
    const busy = screen.getByTestId('floor-table-4').querySelector('rect')
    expect(free?.getAttribute('class')).toContain('fill-(--success)/20')
    expect(free?.getAttribute('class')).toContain('stroke-(--success)')
    expect(busy?.getAttribute('class')).toContain('fill-destructive/20')
    expect(busy?.getAttribute('class')).toContain('stroke-destructive')
  })

  it('el nombre de una barra parada cabe a lo ancho de la barra', () => {
    const bar: DraftElement = { key: 'b1', type: 'BAR_COUNTER', areaKey: 'a1', x: 2, y: 2, w: 2, h: 10, rotation: 0, x2: null, y2: null, label: 'Barra', color: null }
    draw({ tables: [], elements: [bar] })
    const fontSize = Number(screen.getByText('Barra').getAttribute('font-size'))
    // ~0.6 em por letra: 5 letras deben caber en 2 cuadros de ancho.
    expect(fontSize * 0.6 * 'Barra'.length).toBeLessThanOrEqual(2)
  })
})
