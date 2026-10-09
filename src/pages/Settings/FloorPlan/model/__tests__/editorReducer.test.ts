import { describe, expect, it } from 'vitest'
import { clampMoveDelta, editorReducer, initEditorState, normalizeRectElement, type EditorState } from '../editorReducer'
import { docToPayload, dtoToDoc } from '../planMapping'
import type { DraftElement, DraftTable, EditorDoc, FloorPlanDto, FloorShape, PublishFloorPlanBody } from '../types'

const table = (key: string, extra: Partial<DraftTable> = {}): DraftTable => ({
  key, id: key, number: key.replace('t', ''), capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'a1', x: 10, y: 10, legacy: null, hasOpenOrder: false, ...extra,
})
const wall: DraftElement = { key: 'w1', id: 'w1', type: 'WALL', areaKey: 'a1', x: 0, y: 0, w: null, h: null, rotation: 0, x2: 10, y2: 0, label: null, color: null }
const doc = (): EditorDoc => ({
  areas: [{ key: 'a1', id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false }],
  tables: [table('t1'), table('t2', { x: 30 })],
  elements: [wall],
})
const run = (s: EditorState, ...actions: Parameters<typeof editorReducer>[1][]) => actions.reduce(editorReducer, s)

describe('editorReducer', () => {
  it('mover un grupo se detiene en la orilla sin separarlo', () => {
    const s = run(initEditorState(doc()), { type: 'MOVE', keys: ['t1', 't2'], dx: 20, dy: 0 })
    // t2 (centro 30, mitad 2) sólo puede avanzar 8 → el grupo avanza 8
    expect(s.doc.tables.map(t => t.x)).toEqual([18, 38])
    expect(s.dirty).toBe(true)
  })

  it('deshacer y rehacer', () => {
    const moved = run(initEditorState(doc()), { type: 'MOVE', keys: ['t1'], dx: 2, dy: 0 })
    const undone = editorReducer(moved, { type: 'UNDO' })
    expect(undone.doc.tables[0].x).toBe(10)
    expect(editorReducer(undone, { type: 'REDO' }).doc.tables[0].x).toBe(12)
  })

  it('no quita una mesa con cuenta abierta', () => {
    const start = initEditorState({ ...doc(), tables: [table('t1', { hasOpenOrder: true }), table('t2', { x: 30 })] })
    const s = editorReducer(start, { type: 'REMOVE', keys: ['t1', 't2'] })
    expect(s.doc.tables.map(t => t.key)).toEqual(['t1'])
  })

  it('cambiar la forma del área mete todo al lienzo nuevo', () => {
    const start = initEditorState({ ...doc(), tables: [table('t1', { x: 38, y: 20 })], elements: [{ ...wall, x2: 39 }] })
    const s = editorReducer(start, { type: 'UPDATE_AREA', key: 'a1', patch: { floorShape: 'TALL' } }) // 25 × 40
    expect(s.doc.tables[0]).toMatchObject({ x: 23, y: 20 })
    expect(s.doc.elements[0].x2).toBe(25)
  })

  it('girar suma 45° y vuelve a meter la mesa al lienzo', () => {
    const start = initEditorState({ ...doc(), tables: [table('t1', { shape: 'RECTANGLE', capacity: 8, x: 3, y: 12 })] })
    const s = editorReducer(start, { type: 'ROTATE', keys: ['t1'] })
    expect(s.doc.tables[0].rotation).toBe(45)
    expect(s.doc.tables[0].x).toBeCloseTo(4.949747, 5) // 10×4 girada 45° ocupa 9.9 de ancho
  })

  it('copiar crea mesas nuevas sin id, con su número y desplazadas', () => {
    const s = editorReducer(initEditorState(doc()), { type: 'DUPLICATE', clones: [{ sourceKey: 't1', key: 'tmp-1', number: '3' }] })
    // Índice en vez de `.at(-1)`: el tsconfig del dashboard usa lib ES2020 (mismo criterio que spinner.tsx).
    expect(s.doc.tables[s.doc.tables.length - 1]).toMatchObject({ key: 'tmp-1', id: undefined, number: '3', x: 12, y: 12, hasOpenOrder: false })
    expect(s.selection).toEqual(['tmp-1'])
  })

  it('una área nueva adopta los elementos viejos sin área', () => {
    const start = initEditorState({ areas: [], tables: [], elements: [{ ...wall, areaKey: '' }] })
    const s = editorReducer(start, { type: 'ADD_AREA', area: { key: 'tmp-a', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false }, tables: [] })
    expect(s.doc.elements[0].areaKey).toBe('tmp-a')
    expect(s.activeAreaKey).toBe('tmp-a')
  })

  it('no borra un área que todavía tiene mesas', () => {
    const start = initEditorState(doc())
    expect(editorReducer(start, { type: 'REMOVE_AREA', key: 'a1' })).toBe(start)
  })

  it('poner una mesa desde la bandeja la imanta y la mete al área', () => {
    const start = initEditorState({ ...doc(), tables: [table('t9', { areaKey: null, x: null, y: null })] })
    const s = editorReducer(start, { type: 'PLACE_TABLE', key: 't9', areaKey: 'a1', x: 39.4, y: 0.2 })
    expect(s.doc.tables[0]).toMatchObject({ areaKey: 'a1', x: 38, y: 2, legacy: null })
  })
})

const rect = (key: string, type: DraftElement['type'], extra: Partial<DraftElement> = {}): DraftElement => ({
  key, id: key, type, areaKey: 'a1', x: 0, y: 0, w: 1, h: 1, rotation: 0, x2: null, y2: null, label: null, color: null, ...extra,
})
const oneArea = (floorShape: FloorShape, tables: DraftTable[], elements: DraftElement[]): EditorDoc => ({
  areas: [{ key: 'a1', id: 'a1', name: 'Salón', floorShape, sortOrder: 0, external: false }],
  tables,
  elements,
})
/** Lo que el servidor devolvería tras guardar ese cuerpo (lo nuevo toma su clientId como id). */
const echo = (body: PublishFloorPlanBody): FloorPlanDto => ({
  fingerprint: 'f',
  overLimit: false,
  limits: { areas: 30, tables: 500, elements: 1500 },
  areas: body.areas.map(a => ({ id: (a.id ?? a.clientId) as string, name: a.name, floorShape: a.floorShape, sortOrder: a.sortOrder, externalId: null })),
  tables: body.tables.map(t => ({
    id: (t.id ?? t.clientId) as string, number: t.number, capacity: t.capacity, shape: t.shape, rotation: t.rotation,
    positionX: t.positionX, positionY: t.positionY, areaId: t.areaRef, hasOpenOrder: false,
  })),
  elements: body.elements.map(e => ({
    id: (e.id ?? e.clientId) as string, type: e.type, areaId: e.areaRef, positionX: e.positionX, positionY: e.positionY,
    width: e.width, height: e.height, rotation: e.rotation, endX: e.endX, endY: e.endY, label: e.label, color: e.color,
  })),
})

describe('editorReducer — piezas que no se deforman ni se salen (ronda 1)', () => {
  it('girar una puerta 3×1 pegada a la orilla izquierda intercambia lados en el mismo centro: H0 → V0 → H180 → V180 → H0', () => {
    let s = initEditorState(oneArea('WIDE', [], [rect('d1', 'DOOR', { x: 0, y: 10, w: 3, h: 1 })]))
    const seen: number[][] = []
    for (let i = 0; i < 4; i++) {
      s = editorReducer(s, { type: 'ROTATE', keys: ['d1'] })
      const d = s.doc.elements[0]
      expect(d.x).toBeGreaterThanOrEqual(0)
      expect(d.x + (d.w as number) / 2).toBe(1.5)
      expect(d.y + (d.h as number) / 2).toBe(10.5)
      seen.push([d.w as number, d.h as number, d.rotation, d.x, d.y])
    }
    expect(seen).toEqual([
      [1, 3, 0, 1, 9],
      [3, 1, 180, 0, 10],
      [1, 3, 180, 1, 9],
      [3, 1, 0, 0, 10],
    ])
  })

  it('una barra vertical 8×2 pegada a la orilla izquierda no se mueve al guardar y volver a leer', () => {
    const start = initEditorState(oneArea('WIDE', [], [rect('b1', 'BAR_COUNTER', { x: 10, y: 5, w: 8, h: 2 })]))
    const s = run(start, { type: 'ROTATE', keys: ['b1'] }, { type: 'MOVE', keys: ['b1'], dx: -50, dy: 0 })
    const before = s.doc.elements[0]
    expect(before).toMatchObject({ x: 0, y: 2, w: 2, h: 8, rotation: 0 })
    const after = dtoToDoc(echo(docToPayload(s.doc, 's', 'f'))).elements[0]
    expect(after).toMatchObject({ x: before.x, y: before.y, w: before.w, h: before.h, rotation: before.rotation })
  })

  it('una barra de 30 cuadros en un área ancha no gira (parada no cabría en 25)', () => {
    const start = initEditorState(oneArea('WIDE', [], [rect('b1', 'BAR_COUNTER', { x: 5, y: 10, w: 30, h: 2 })]))
    expect(editorReducer(start, { type: 'ROTATE', keys: ['b1'] })).toBe(start)
  })

  it('el área nueva de arranque rápido (alta) adopta lo viejo de la PAX en el mismo lugar relativo', () => {
    const legacy = dtoToDoc({
      fingerprint: 'f',
      overLimit: false,
      limits: { areas: 30, tables: 500, elements: 1500 },
      areas: [],
      tables: [],
      elements: [
        { id: 'l1', type: 'LABEL', areaId: null, positionX: 0.875, positionY: 0.5, width: null, height: null, rotation: 0, endX: null, endY: null, label: 'Caja', color: null },
        { id: 'w1', type: 'WALL', areaId: null, positionX: 0.1, positionY: 0.1, width: null, height: null, rotation: 0, endX: 0.9, endY: 0.9, label: null, color: null },
      ],
    })
    const s = editorReducer(initEditorState(legacy), {
      type: 'ADD_AREA',
      area: { key: 'tmp-a', name: 'Salón', floorShape: 'TALL', sortOrder: 0, external: false },
      tables: [],
    })
    const body = docToPayload(s.doc, 's', 'f')
    expect(body.elements.find(e => e.id === 'l1')).toMatchObject({ areaRef: 'tmp-a', positionX: 0.875, positionY: 0.5 })
    expect(body.elements.find(e => e.id === 'w1')).toMatchObject({ areaRef: 'tmp-a', positionX: 0.1, positionY: 0.1, endX: 0.9, endY: 0.9 })
  })

  it('cambiar las personas vuelve a imantar la mesa: 4×4 con centro en 10 → 5×5 con centro en 10.5', () => {
    const s = editorReducer(initEditorState(doc()), { type: 'UPDATE_TABLE', key: 't1', patch: { capacity: 6 } })
    expect(s.doc.tables[0]).toMatchObject({ x: 10.5, y: 10.5 })
  })

  it('una pared en diagonal que ya no cabe se acorta sin doblarse (cuadrada → ancha)', () => {
    const start = initEditorState(oneArea('SQUARE', [], [{ ...wall, x: 5, y: 5, x2: 35, y2: 35 }]))
    const w = editorReducer(start, { type: 'UPDATE_AREA', key: 'a1', patch: { floorShape: 'WIDE' } }).doc.elements[0]
    const dx = (w.x2 as number) - w.x
    const dy = (w.y2 as number) - w.y
    expect(dx).toBeGreaterThan(0)
    expect(dy).toBe(dx) // sigue a 45°
    for (const v of [w.x, w.x2 as number]) expect(v >= 0 && v <= 40).toBe(true)
    for (const v of [w.y, w.y2 as number]) expect(v >= 0 && v <= 25).toBe(true)
  })

  it('copiar una pared de 10 pegada a la orilla derecha conserva sus 10 cuadros', () => {
    const start = initEditorState(oneArea('WIDE', [], [{ ...wall, x: 30, y: 5, x2: 40, y2: 5 }]))
    const s = editorReducer(start, { type: 'DUPLICATE', clones: [{ sourceKey: 'w1', key: 'tmp-w' }] })
    expect(s.doc.elements[1]).toMatchObject({ key: 'tmp-w', x: 30, y: 7, x2: 40, y2: 7 })
  })

  it('copiar una mesa de la bandeja no copia su posición vieja', () => {
    const start = initEditorState({ ...doc(), tables: [table('t9', { areaKey: null, x: null, y: null, legacy: { nx: 0.3, ny: 0.6 } })] })
    const s = editorReducer(start, { type: 'DUPLICATE', clones: [{ sourceKey: 't9', key: 'tmp-9', number: '10' }] })
    expect(s.doc.tables[1]).toMatchObject({ key: 'tmp-9', legacy: null, x: null, y: null })
  })
})

describe('editorReducer — ronda 1 de la tarea 10', () => {
  it('clampMoveDelta recorta el arrastre igual que MOVE: la vista previa del lienzo es lo que queda al soltar', () => {
    const d = doc()
    // t1: centro 10, mitad 2 → sólo puede ir 8 a la izquierda; con t2 (centro 30) el grupo sólo avanza 8 a la derecha.
    expect(clampMoveDelta(d, new Set(['t1']), -20, 0)).toEqual({ dx: -8, dy: 0 })
    expect(clampMoveDelta(d, new Set(['t1', 't2']), 20, 3)).toEqual({ dx: 8, dy: 3 })
    const s = editorReducer(initEditorState(d), { type: 'MOVE', keys: ['t1', 't2'], dx: 20, dy: 3 })
    expect(s.doc.tables.map(t => [t.x, t.y])).toEqual([
      [18, 13],
      [38, 13],
    ])
  })

  it('barras y zonas de servicio no guardan 180 (su nombre nunca sale de cabeza); la puerta sí', () => {
    expect(normalizeRectElement(rect('b1', 'BAR_COUNTER', { x: 4, y: 4, w: 6, h: 2, rotation: 180 }))).toMatchObject({ x: 4, y: 4, w: 6, h: 2, rotation: 0 })
    expect(normalizeRectElement(rect('k1', 'SERVICE_AREA', { w: 5, h: 5, rotation: 180 })).rotation).toBe(0)
    expect(normalizeRectElement(rect('d1', 'DOOR', { w: 3, h: 1, rotation: 180 })).rotation).toBe(180)
  })
})

describe('editorReducer — ronda 1 de la tarea 11', () => {
  it('cambiar una pieza que ya no existe no deja un paso de deshacer (el inspector guarda al desmontarse)', () => {
    const start = initEditorState(doc())
    expect(editorReducer(start, { type: 'UPDATE_TABLE', key: 'nope', patch: { number: '9' } })).toBe(start)
    expect(editorReducer(start, { type: 'UPDATE_ELEMENT', key: 'nope', patch: { label: 'x' } })).toBe(start)
  })
})

describe('editorReducer — pulido (tarea 15-D)', () => {
  it('una flecha sostenida (burst) es un solo paso de deshacer; soltarla y volver a apretar es otro', () => {
    const s = run(
      initEditorState(doc()),
      { type: 'MOVE', keys: ['t1'], dx: 1, dy: 0 },
      { type: 'MOVE', keys: ['t1'], dx: 1, dy: 0, burst: true },
      { type: 'MOVE', keys: ['t1'], dx: 1, dy: 0, burst: true },
    )
    expect(s.doc.tables[0].x).toBe(13)
    expect(s.past).toHaveLength(1)
    const again = run(s, { type: 'MOVE', keys: ['t1'], dx: 1, dy: 0 })
    expect(again.past).toHaveLength(2)
    expect(editorReducer(s, { type: 'UNDO' }).doc.tables[0].x).toBe(10)
  })

  it('una ráfaga de OTRA selección no se suma a la anterior', () => {
    const s = run(initEditorState(doc()), { type: 'MOVE', keys: ['t1'], dx: 1, dy: 0 }, { type: 'MOVE', keys: ['t2'], dx: 1, dy: 0, burst: true })
    expect(s.past).toHaveLength(2)
  })

  it('cambios que no cambian nada no dejan pasos vacíos: barra cuadrada girada, la misma forma, piezas que no existen', () => {
    const start = initEditorState(oneArea('WIDE', [table('t1')], [rect('k1', 'SERVICE_AREA', { x: 4, y: 4, w: 6, h: 6 })]))
    expect(editorReducer(start, { type: 'ROTATE', keys: ['k1'] })).toBe(start)
    expect(editorReducer(start, { type: 'UPDATE_TABLE', key: 't1', patch: { shape: 'SQUARE' } })).toBe(start)
    expect(editorReducer(start, { type: 'UPDATE_ELEMENT', key: 'k1', patch: { w: 6 } })).toBe(start)
    expect(editorReducer(start, { type: 'UPDATE_AREA', key: 'a1', patch: { floorShape: 'WIDE' } })).toBe(start)
    expect(editorReducer(start, { type: 'MOVE', keys: ['nope'], dx: 2, dy: 0 })).toBe(start)
    expect(editorReducer(start, { type: 'ROTATE', keys: ['nope'] })).toBe(start)
  })

  it('deshacer abre la pestaña donde se hizo el cambio; rehacer, la que quedó después', () => {
    const two: EditorDoc = {
      areas: [
        { key: 'a1', id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false },
        { key: 'a2', id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, external: false },
      ],
      tables: [table('t1'), table('t2', { areaKey: 'a2' })],
      elements: [],
    }
    let s = run(initEditorState(two), { type: 'MOVE', keys: ['t1'], dx: 2, dy: 0 }, { type: 'SET_ACTIVE_AREA', key: 'a2' })
    s = editorReducer(s, { type: 'UNDO' })
    expect(s.activeAreaKey).toBe('a1')
    s = editorReducer({ ...s, activeAreaKey: 'a2' }, { type: 'REDO' })
    expect(s.activeAreaKey).toBe('a1')
    // Un área nueva: deshacer vuelve a la que estaba abierta; rehacer abre la nueva.
    let n = editorReducer(initEditorState(two), { type: 'ADD_AREA', area: { key: 'tmp-a', name: 'Patio', floorShape: 'WIDE', sortOrder: 2, external: false }, tables: [] })
    expect(n.activeAreaKey).toBe('tmp-a')
    n = editorReducer(n, { type: 'UNDO' })
    expect(n.activeAreaKey).toBe('a1')
    n = editorReducer(n, { type: 'REDO' })
    expect(n.activeAreaKey).toBe('tmp-a')
  })

  it('RESTORE_TABLES regresa las mesas que faltan, en su área y seleccionadas; las que ya están no se duplican', () => {
    const removed = editorReducer(initEditorState(doc()), { type: 'REMOVE', keys: ['t2'] })
    const s = editorReducer(removed, { type: 'RESTORE_TABLES', tables: [table('t1'), table('t2', { x: 30, hasOpenOrder: true })] })
    expect(s.doc.tables.map(t => t.key)).toEqual(['t1', 't2'])
    expect(s.doc.tables[1]).toMatchObject({ x: 30, y: 10, areaKey: 'a1', hasOpenOrder: true })
    expect(s.selection).toEqual(['t2'])
    expect(editorReducer(s, { type: 'RESTORE_TABLES', tables: [table('t2')] })).toBe(s)
    // Si su área ya no existe en el borrador, vuelve «Sin acomodar».
    const lost = editorReducer(removed, { type: 'RESTORE_TABLES', tables: [table('t2', { areaKey: 'gone' })] })
    expect(lost.doc.tables[1]).toMatchObject({ areaKey: null, x: null, y: null })
  })
})

describe('editorReducer — ronda de arreglo 1 (15-D)', () => {
  const two: EditorDoc = {
    areas: [
      { key: 'a1', id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false },
      { key: 'a2', id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, external: false },
    ],
    tables: [table('t1'), table('t2', { areaKey: 'a2' })],
    elements: [],
  }

  it('I2: deshacer que cambia de pestaña no deja seleccionada una pieza de la otra área', () => {
    const s = run(initEditorState(two), { type: 'MOVE', keys: ['t1'], dx: 2, dy: 0 }, { type: 'SET_ACTIVE_AREA', key: 'a2' }, { type: 'SELECT', keys: ['t2'] })
    const undone = editorReducer(s, { type: 'UNDO' })
    expect(undone.activeAreaKey).toBe('a1')
    expect(undone.selection).toEqual([])
    const redone = editorReducer({ ...undone, activeAreaKey: 'a2', selection: ['t2'] }, { type: 'REDO' })
    expect(redone.activeAreaKey).toBe('a1')
    expect(redone.selection).toEqual([])
  })

  it('I2: regresar mesas de dos áreas selecciona sólo las de la pestaña que se abre', () => {
    const empty = { ...two, tables: [] }
    const s = editorReducer(initEditorState(empty), { type: 'RESTORE_TABLES', tables: two.tables })
    expect(s.activeAreaKey).toBe('a1')
    expect(s.selection).toEqual(['t1'])
  })

  it('M3: MARK_OPEN_ORDERS marca la mesa en el borrador y en el historial, sin crear un paso', () => {
    const removed = editorReducer(initEditorState(two), { type: 'REMOVE', keys: ['t2'] })
    const marked = editorReducer(removed, { type: 'MARK_OPEN_ORDERS', keys: ['t2'] })
    expect(marked.past).toHaveLength(1)
    expect(editorReducer(marked, { type: 'UNDO' }).doc.tables.find(t => t.key === 't2')?.hasOpenOrder).toBe(true)
    expect(editorReducer(marked, { type: 'MARK_OPEN_ORDERS', keys: ['t2'] })).toBe(marked)
  })

  it('REVEAL abre la pestaña de la pieza y la selecciona', () => {
    const s = editorReducer(initEditorState(two), { type: 'REVEAL', keys: ['t2'] })
    expect(s.activeAreaKey).toBe('a2')
    expect(s.selection).toEqual(['t2'])
  })
})

describe('editorReducer — ola final', () => {
  const two: EditorDoc = {
    areas: [
      { key: 'a1', id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0, external: false },
      { key: 'a2', id: 'a2', name: 'Terraza', floorShape: 'WIDE', sortOrder: 1, external: false },
    ],
    tables: [table('t1'), table('t2', { x: 30 })],
    elements: [wall],
  }

  // Codex P1-1: la mesa se iba a Terraza pero el lienzo seguía en Salón con ella seleccionada; Shift+clic y Supr
  // borraban también la que ya no se veía.
  it('D1: cambiar de área desde el inspector abre la pestaña de destino con la mesa seleccionada, y nada de otra área', () => {
    const s = run(initEditorState(two), { type: 'SELECT', keys: ['t1', 'w1'] }, { type: 'UPDATE_TABLE', key: 't1', patch: { areaKey: 'a2' } })
    expect(s.doc.tables[0].areaKey).toBe('a2')
    expect(s.activeAreaKey).toBe('a2')
    expect(s.selection).toEqual(['t1'])
    // Deshacer la regresa a Salón y abre Salón.
    const undone = editorReducer(s, { type: 'UNDO' })
    expect(undone.activeAreaKey).toBe('a1')
    expect(undone.selection).toEqual(['t1'])
  })

  it('D1: mandarla a «Sin acomodar» deja la pestaña abierta (la bandeja sale en todas) y la mesa seleccionada', () => {
    const s = run(initEditorState(two), { type: 'SELECT', keys: ['t1'] }, { type: 'UPDATE_TABLE', key: 't1', patch: { areaKey: null } })
    expect(s.activeAreaKey).toBe('a1')
    expect(s.selection).toEqual(['t1'])
  })

  it('D1: otro cambio de la mesa (personas) no cambia de pestaña ni de selección', () => {
    const s = run(initEditorState(two), { type: 'SELECT', keys: ['t1', 'w1'] }, { type: 'UPDATE_TABLE', key: 't1', patch: { capacity: 6 } })
    expect(s.activeAreaKey).toBe('a1')
    expect(s.selection).toEqual(['t1', 'w1'])
  })
})
