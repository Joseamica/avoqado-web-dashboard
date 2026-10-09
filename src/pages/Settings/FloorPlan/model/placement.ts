import { clamp, placeTable, tableSizeCells } from './floorGeometry'
import type { TableShape, ToolId } from './types'

/** Tamaño (en cuadros) con que nace cada pieza de la paleta que no es mesa ni pared. */
export const NEW_ELEMENT_SIZE = { BAR_COUNTER: { w: 8, h: 2 }, SERVICE_AREA: { w: 8, h: 6 }, DOOR: { w: 3, h: 1 } } as const

/** Personas con que nace una mesa nueva: la larga es de 6, las demás de 4. */
export const newTableCapacity = (shape: TableShape) => (shape === 'RECTANGLE' ? 6 : 4)

/** Caja aproximada de un letrero recién puesto (su texto por defecto, «Terraza», a 1.4 cuadros de alto). */
const LABEL_BOX = { w: 6, h: 1.6 }

/**
 * Dónde queda la pieza de una herramienta si se hace clic en (x, y), ya imantada y dentro del lienzo. La usan el clic
 * (lo que se crea) y la vista previa bajo el puntero, así que lo que se ve antes del clic es lo que queda.
 * - `table`: centro de la mesa (`x`, `y`) y su tamaño sin girar.
 * - `box`: esquina de arriba a la izquierda de la caja (barra, cocina, puerta, letrero).
 */
export type Placement = { kind: 'table'; shape: TableShape; capacity: number; x: number; y: number; w: number; h: number } | { kind: 'box'; x: number; y: number; w: number; h: number }

export function placementOf(tool: ToolId, x: number, y: number, cols: number, rows: number): Placement | null {
  if (tool === 'select' || tool === 'WALL') return null
  if (tool.startsWith('table:')) {
    const shape = tool.slice(6) as TableShape
    const capacity = newTableCapacity(shape)
    return { kind: 'table', shape, capacity, ...placeTable(x, y, shape, capacity, 0, cols, rows), ...tableSizeCells(shape, capacity) }
  }
  if (tool === 'LABEL') return { kind: 'box', x: clamp(x, 0, cols - 1), y: clamp(y, 0, rows - 1), ...LABEL_BOX }
  const { w, h } = NEW_ELEMENT_SIZE[tool as keyof typeof NEW_ELEMENT_SIZE]
  return { kind: 'box', x: clamp(Math.round(x - w / 2), 0, cols - w), y: clamp(Math.round(y - h / 2), 0, rows - h), w, h }
}
