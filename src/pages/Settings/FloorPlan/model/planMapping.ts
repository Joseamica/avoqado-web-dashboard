import { normalizeRectElement } from './editorReducer'
import { clamp, gridOf, round6 } from './floorGeometry'
import type { DraftArea, EditorDoc, FloorPlanDto, PublishFloorPlanBody } from './types'

/** Plano del servidor (normalizado 0–1) → borrador del editor (cuadros de cada área). */
export function dtoToDoc(dto: FloorPlanDto): EditorDoc {
  const areas: DraftArea[] = [...dto.areas]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name, 'es'))
    .map((a, i) => ({ key: a.id, id: a.id, name: a.name, floorShape: a.floorShape ?? 'WIDE', sortOrder: i, external: a.externalId !== null }))
  const grids = new Map(areas.map(a => [a.key, gridOf(a.floorShape)]))
  const firstKey = areas[0]?.key ?? ''

  const tables = dto.tables.map(t => {
    const g = t.areaId ? grids.get(t.areaId) : undefined
    const placed = !!g && t.positionX !== null && t.positionY !== null
    return {
      key: t.id,
      id: t.id,
      number: t.number,
      capacity: t.capacity,
      shape: t.shape,
      rotation: t.rotation,
      areaKey: g ? (t.areaId as string) : null,
      x: placed ? round6((t.positionX as number) * g!.cols) : null,
      y: placed ? round6((t.positionY as number) * g!.rows) : null,
      legacy: !g && t.positionX !== null && t.positionY !== null ? { nx: t.positionX, ny: t.positionY } : null,
      hasOpenOrder: t.hasOpenOrder,
    }
  })

  const elements = dto.elements.map(e => {
    const areaKey = e.areaId && grids.has(e.areaId) ? e.areaId : firstKey
    const g = grids.get(areaKey) ?? gridOf('WIDE')
    const sx = (v: number | null) => (v === null ? null : round6(v * g.cols))
    const sy = (v: number | null) => (v === null ? null : round6(v * g.rows))
    // Barras, zonas y puertas viejas giradas 90/270 se guardan como lados intercambiados (ver normalizeRectElement).
    return normalizeRectElement({
      key: e.id,
      id: e.id,
      type: e.type,
      areaKey,
      x: round6(e.positionX * g.cols),
      y: round6(e.positionY * g.rows),
      w: sx(e.width),
      h: sy(e.height),
      rotation: e.rotation,
      x2: sx(e.endX),
      y2: sy(e.endY),
      label: e.label,
      color: e.color,
    })
  })
  return { areas, tables, elements }
}

/** Borrador → cuerpo del PUT (el plano COMPLETO deseado). */
export function docToPayload(doc: EditorDoc, saveId: string, baseFingerprint: string): PublishFloorPlanBody {
  const byKey = new Map(doc.areas.map(a => [a.key, a]))
  const ref = (key: string) => {
    const a = byKey.get(key) as DraftArea
    return a.id ?? a.key
  }
  const n = (v: number, total: number) => round6(clamp(v / total, 0, 1))
  // El servidor archiva lo que el plano omite: un elemento sin área nunca se descarta en silencio.
  // (El editor apaga Guardar mientras haya elementos sin área; un plano sin áreas y sin ellos sí se guarda.)
  if (doc.elements.some(e => !byKey.has(e.areaKey))) throw new Error('docToPayload: hay elementos sin área')
  return {
    saveId,
    baseFingerprint,
    areas: doc.areas.map((a, i) => ({ ...(a.id ? { id: a.id } : { clientId: a.key }), name: a.name.trim(), floorShape: a.floorShape, sortOrder: i })),
    tables: doc.tables.map(t => {
      const area = t.areaKey !== null ? byKey.get(t.areaKey) : undefined
      const g = area ? gridOf(area.floorShape) : null
      const position =
        g && t.x !== null && t.y !== null
          ? { positionX: n(t.x, g.cols), positionY: n(t.y, g.rows) }
          : !area && t.legacy
            ? { positionX: t.legacy.nx, positionY: t.legacy.ny }
            : { positionX: null, positionY: null }
      return {
        ...(t.id ? { id: t.id } : { clientId: t.key }),
        number: t.number.trim(),
        capacity: t.capacity,
        shape: t.shape,
        rotation: t.rotation,
        ...position,
        areaRef: area ? ref(area.key) : null,
      }
    }),
    elements: doc.elements.map(e => {
      const g = gridOf((byKey.get(e.areaKey) as DraftArea).floorShape)
      return {
        ...(e.id ? { id: e.id } : { clientId: e.key }),
        type: e.type,
        areaRef: ref(e.areaKey),
        positionX: n(e.x, g.cols),
        positionY: n(e.y, g.rows),
        width: e.w === null ? null : n(e.w, g.cols),
        height: e.h === null ? null : n(e.h, g.rows),
        rotation: e.rotation,
        endX: e.x2 === null ? null : n(e.x2, g.cols),
        endY: e.y2 === null ? null : n(e.y2, g.rows),
        label: e.label,
        color: e.color,
      }
    }),
  }
}
