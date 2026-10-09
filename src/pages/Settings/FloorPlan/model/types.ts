// Plano de mesas — contrato con el servidor (spec docs/superpowers/specs/2026-10-08-plano-de-mesas-dashboard-design.md §5).
export type FloorShape = 'WIDE' | 'SQUARE' | 'TALL'
export type TableShape = 'SQUARE' | 'ROUND' | 'RECTANGLE'
export type FloorElementType = 'WALL' | 'BAR_COUNTER' | 'SERVICE_AREA' | 'LABEL' | 'DOOR'

export interface FloorPlanAreaDto {
  id: string
  name: string
  floorShape: FloorShape | null
  sortOrder: number
  externalId: string | null
}
export interface FloorPlanTableDto {
  id: string
  number: string
  capacity: number
  shape: TableShape
  rotation: number
  positionX: number | null
  positionY: number | null
  areaId: string | null
  hasOpenOrder: boolean
}
export interface FloorPlanElementDto {
  id: string
  type: FloorElementType
  areaId: string | null
  positionX: number
  positionY: number
  width: number | null
  height: number | null
  rotation: number
  endX: number | null
  endY: number | null
  label: string | null
  color: string | null
}
export interface FloorPlanDto {
  fingerprint: string
  areas: FloorPlanAreaDto[]
  tables: FloorPlanTableDto[]
  elements: FloorPlanElementDto[]
  limits: { areas: number; tables: number; elements: number }
  overLimit: boolean
}
export interface PublishFloorPlanResult extends FloorPlanDto {
  publicationId: string
  replayed: boolean
}
export interface PublishFloorPlanBody {
  saveId: string
  baseFingerprint: string
  areas: Array<{ id?: string; clientId?: string; name: string; floorShape: FloorShape; sortOrder: number }>
  tables: Array<{
    id?: string
    clientId?: string
    number: string
    capacity: number
    shape: TableShape
    rotation: number
    positionX: number | null
    positionY: number | null
    areaRef: string | null
  }>
  elements: Array<{
    id?: string
    clientId?: string
    type: FloorElementType
    areaRef: string
    positionX: number
    positionY: number
    width: number | null
    height: number | null
    rotation: number
    endX: number | null
    endY: number | null
    label: string | null
    color: string | null
  }>
}

// Borrador del editor: posiciones en CUADROS de la cuadrícula de su área (spec §4.3), no normalizadas.
export interface DraftArea {
  key: string
  id?: string
  name: string
  floorShape: FloorShape
  sortOrder: number
  /** Viene de SoftRestaurant: renombrarla puede revertirse en la siguiente sincronización. */
  external: boolean
}
export interface DraftTable {
  key: string
  id?: string
  number: string
  capacity: number
  shape: TableShape
  rotation: number
  /** null = sin área («Sin acomodar»). */
  areaKey: string | null
  /** Centro en cuadros; null = en el área pero sin acomodar. */
  x: number | null
  y: number | null
  /** Posición vieja de una mesa sin área (la dibujó la PAX en su lienzo global). Se conserva tal cual al guardar. */
  legacy: { nx: number; ny: number } | null
  hasOpenOrder: boolean
}
export interface DraftElement {
  key: string
  id?: string
  type: FloorElementType
  /** '' = elemento viejo sin área cuando el local todavía no tiene áreas. */
  areaKey: string
  x: number
  y: number
  w: number | null
  h: number | null
  rotation: number
  x2: number | null
  y2: number | null
  label: string | null
  color: string | null
}
export interface EditorDoc {
  areas: DraftArea[]
  tables: DraftTable[]
  elements: DraftElement[]
}
export type ToolId =
  'select' | 'table:SQUARE' | 'table:ROUND' | 'table:RECTANGLE' | 'WALL' | 'BAR_COUNTER' | 'SERVICE_AREA' | 'DOOR' | 'LABEL'
