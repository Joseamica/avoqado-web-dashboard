import { describe, expect, it } from 'vitest'
import { editorReducer, initEditorState, type EditorState } from '../editorReducer'
import type { DraftElement, DraftTable, EditorDoc } from '../types'

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
