import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import type { NewAreaRequest } from './NewAreaDialog'
import type { EditorAction } from '../model/editorReducer'
import { gridOf, nextTableNumber, nextTableNumbers, placeTable, quickStartLayout } from '../model/floorGeometry'
import type { PlanLimits } from '../model/limits'
import { placementOf } from '../model/placement'
import type { DraftArea, DraftTable, EditorDoc, TableShape, ToolId } from '../model/types'

const newKey = () => `tmp-${crypto.randomUUID()}`

export interface EditorActionsInput {
  doc: EditorDoc
  activeArea: DraftArea | null
  allNumbers: string[]
  /** Aplica al borrador; `false` si no se pudo (hay un guardado en curso). */
  edit: (action: EditorAction) => boolean
  /** Aviso al usuario (ver `notify` del editor: también le pasa el Esc al editor). */
  notify: (opts: { title: string; variant?: 'default' | 'destructive' }) => void
  room: PlanLimits
  limits: PlanLimits
  /** Lo que la mesa tenía en el plano guardado: de ahí se regresan las mesas tras un 422 (H2). */
  savedTables: DraftTable[]
}

/**
 * Las acciones del editor que arman piezas nuevas o quitan/regresan las de antes. Viven aquí para que el editor quede
 * en el modal y su estado (R25). Ninguna pasa los topes del plano (`limits`, que el servidor exige): al llegar, lo dicen.
 */
export function useEditorActions({ doc, activeArea, allNumbers, edit, notify, room, limits, savedTables }: EditorActionsInput) {
  const { t } = useTranslation('floorPlan')
  const full = useCallback((kind: keyof PlanLimits) => notify({ title: t(`limits.${kind}`, { max: limits[kind] }) }), [limits, notify, t])

  const placeTool = useCallback(
    (toolId: ToolId, x: number, y: number) => {
      if (!activeArea) return
      const { cols, rows } = gridOf(activeArea.floorShape)
      // La misma cuenta que la vista previa bajo el puntero (FloorCanvas): lo que se vio es lo que queda.
      const at = placementOf(toolId, x, y, cols, rows)
      if (!at) return
      if (at.kind === 'table') {
        if (room.tables <= 0) return full('tables')
        edit({
          type: 'ADD_TABLE',
          table: {
            key: newKey(),
            number: nextTableNumber(allNumbers),
            capacity: at.capacity,
            shape: at.shape,
            rotation: 0,
            areaKey: activeArea.key,
            x: at.x,
            y: at.y,
            legacy: null,
            hasOpenOrder: false,
          },
        })
        return
      }
      if (room.elements <= 0) return full('elements')
      if (toolId === 'LABEL') {
        edit({
          type: 'ADD_ELEMENT',
          element: {
            key: newKey(),
            type: 'LABEL',
            areaKey: activeArea.key,
            x: at.x,
            y: at.y,
            w: null,
            h: null,
            rotation: 0,
            x2: null,
            y2: null,
            label: t('elementDefaults.LABEL'),
            color: null,
          },
        })
        return
      }
      const type = toolId as 'BAR_COUNTER' | 'SERVICE_AREA' | 'DOOR'
      edit({
        type: 'ADD_ELEMENT',
        element: {
          key: newKey(),
          type,
          areaKey: activeArea.key,
          x: at.x,
          y: at.y,
          w: at.w,
          h: at.h,
          rotation: 0,
          x2: null,
          y2: null,
          label: type === 'DOOR' ? null : t(`elementDefaults.${type}`),
          color: null,
        },
      })
    },
    [activeArea, allNumbers, edit, full, room, t],
  )

  const createWall = useCallback(
    (x1: number, y1: number, x2: number, y2: number) => {
      if (!activeArea) return
      if (room.elements <= 0) return full('elements')
      edit({
        type: 'ADD_ELEMENT',
        element: { key: newKey(), type: 'WALL', areaKey: activeArea.key, x: x1, y: y1, w: null, h: null, rotation: 0, x2, y2, label: null, color: null },
      })
    },
    [activeArea, edit, full, room],
  )

  const duplicate = useCallback(
    (keys: string[]) => {
      const tableKeys = new Set(doc.tables.map(x => x.key))
      const copies = keys.filter(k => tableKeys.has(k)).length
      if (copies > room.tables) return full('tables')
      if (keys.length - copies > room.elements) return full('elements')
      const numbers = [...allNumbers]
      const clones = keys.map(sourceKey => {
        const number = tableKeys.has(sourceKey) ? nextTableNumber(numbers) : undefined
        if (number) numbers.push(number)
        return { sourceKey, key: newKey(), number }
      })
      edit({ type: 'DUPLICATE', clones })
    },
    [allNumbers, doc.tables, edit, full, room],
  )

  const remove = useCallback(
    (keys: string[]) => {
      // Durante un guardado `edit` no aplica nada: tampoco se avisa de algo que no pasó.
      const applied = edit({ type: 'REMOVE', keys })
      if (applied && doc.tables.some(x => keys.includes(x.key) && x.hasOpenOrder)) notify({ title: t('inspector.removeBlocked') })
    },
    [doc.tables, edit, notify, t],
  )

  /** Crea el área (y, si se pidió, sus mesas o las que no tenían área). `false` si no se aplicó. */
  const createArea = useCallback(
    (req: NewAreaRequest): boolean => {
      if (room.areas <= 0) {
        full('areas')
        return false
      }
      const key = newKey()
      const g = gridOf(req.floorShape)
      const tableShape: TableShape = req.capacity <= 4 ? 'SQUARE' : 'RECTANGLE'
      const adopted = req.adopt ? doc.tables.filter(x => x.areaKey === null) : []
      const count = Math.max(0, Math.min(req.count, room.tables))
      const slots = quickStartLayout(count + adopted.filter(a => !a.legacy).length, req.capacity, tableShape, req.floorShape)
      let slot = 0
      const created: DraftTable[] = nextTableNumbers(allNumbers, count).map(number => {
        const p = slots[slot++]
        return { key: newKey(), number, capacity: req.capacity, shape: tableShape, rotation: 0, areaKey: key, x: p?.x ?? null, y: p?.y ?? null, legacy: null, hasOpenOrder: false }
      })
      const moved: DraftTable[] = adopted.map(a => {
        if (a.legacy) return { ...a, areaKey: key, legacy: null, ...placeTable(a.legacy.nx * g.cols, a.legacy.ny * g.rows, a.shape, a.capacity, a.rotation, g.cols, g.rows) }
        const p = slots[slot++]
        return { ...a, areaKey: key, ...(p ? placeTable(p.x, p.y, a.shape, a.capacity, a.rotation, g.cols, g.rows) : { x: null, y: null }) }
      })
      return edit({
        type: 'ADD_AREA',
        area: { key, name: req.name, floorShape: req.floorShape, sortOrder: doc.areas.length, external: false },
        tables: [...created, ...moved],
      })
    },
    [allNumbers, doc.areas.length, doc.tables, edit, full, room],
  )

  /**
   * H2: tras un 422 de cuenta abierta, las mesas que el servidor nombró vuelven al borrador tal como estaban en el plano
   * guardado (su área, su lugar y su giro), marcadas con su cuenta abierta y seleccionadas: así se ven en el lienzo. Es
   * un paso de deshacer. No pasa el tope de mesas (lo que no cabe se queda en el aviso). Devuelve los números que siguen
   * pendientes (no cupieron o no están en el plano guardado); los que ya están en el borrador cuentan como resueltos.
   * Si el número ya lo usa OTRA mesa del borrador, igual se regresa (el servidor no deja quitarla) y el aviso de números
   * repetidos dice cuál cambiar.
   */
  const restoreTables = useCallback(
    (numbers: string[]): string[] => {
      const wanted = new Set(numbers.map(n => n.trim()))
      const present = new Set(doc.tables.map(x => x.key))
      const matching = savedTables.filter(x => wanted.has(x.number.trim()))
      const missing = matching.filter(x => !present.has(x.key))
      const back = missing.slice(0, Math.max(0, room.tables)).map(x => ({ ...x, hasOpenOrder: true }))
      if (back.length < missing.length) full('tables')
      if (back.length && !edit({ type: 'RESTORE_TABLES', tables: back })) return numbers
      const resolved = new Set([...back, ...matching.filter(x => present.has(x.key))].map(x => x.number.trim()))
      return numbers.filter(n => !resolved.has(n.trim()))
    },
    [doc.tables, edit, full, room, savedTables],
  )

  return { placeTool, createWall, duplicate, remove, createArea, restoreTables }
}

/** Las mesas del plano guardado que se pueden regresar al borrador (para enseñar o no el botón del aviso). */
export function restorableNumbers(numbers: string[], doc: EditorDoc, savedTables: DraftTable[]): string[] {
  const present = new Set(doc.tables.map(x => x.key))
  const wanted = new Set(numbers.map(n => n.trim()))
  return savedTables.filter(x => wanted.has(x.number.trim()) && !present.has(x.key)).map(x => x.number)
}
