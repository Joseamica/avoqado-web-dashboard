import { describe, expect, it } from 'vitest'
import { docToPayload, dtoToDoc } from '../planMapping'
import type { FloorPlanDto } from '../types'

const dto: FloorPlanDto = {
  fingerprint: '0123456789abcdef',
  overLimit: false,
  limits: { areas: 30, tables: 500, elements: 1500 },
  areas: [
    { id: 'a2', name: 'Terraza', floorShape: 'TALL', sortOrder: 1, externalId: null },
    { id: 'a1', name: 'Salón', floorShape: null, sortOrder: 0, externalId: 'sr-1' },
  ],
  tables: [
    { id: 't1', number: '1', capacity: 4, shape: 'SQUARE', rotation: 0, positionX: 0.25, positionY: 0.4, areaId: 'a1', hasOpenOrder: false },
    { id: 't2', number: '2', capacity: 2, shape: 'ROUND', rotation: 45, positionX: 0.5, positionY: 0.5, areaId: null, hasOpenOrder: true },
    { id: 't3', number: '3', capacity: 6, shape: 'RECTANGLE', rotation: 0, positionX: null, positionY: null, areaId: 'a2', hasOpenOrder: false },
  ],
  elements: [
    { id: 'e1', type: 'WALL', areaId: 'a1', positionX: 0, positionY: 0, width: null, height: null, rotation: 0, endX: 1, endY: 0, label: null, color: null },
    { id: 'e2', type: 'LABEL', areaId: null, positionX: 0.1, positionY: 0.9, width: null, height: null, rotation: 0, endX: null, endY: null, label: 'VIP', color: null },
  ],
}

describe('dtoToDoc', () => {
  const doc = dtoToDoc(dto)

  it('ordena las áreas y convierte posiciones a cuadros de SU área', () => {
    expect(doc.areas.map(a => [a.key, a.floorShape, a.sortOrder, a.external])).toEqual([['a1', 'WIDE', 0, true], ['a2', 'TALL', 1, false]])
    expect(doc.tables[0]).toMatchObject({ key: 't1', areaKey: 'a1', x: 10, y: 10, legacy: null })
  })

  it('una mesa sin área va a «Sin acomodar» conservando su posición vieja', () => {
    expect(doc.tables[1]).toMatchObject({ areaKey: null, x: null, y: null, legacy: { nx: 0.5, ny: 0.5 }, hasOpenOrder: true })
  })

  it('una mesa del área sin posición queda sin acomodar en esa área', () => {
    expect(doc.tables[2]).toMatchObject({ areaKey: 'a2', x: null, y: null })
  })

  it('un elemento viejo sin área cae en la primera área', () => {
    expect(doc.elements[1]).toMatchObject({ areaKey: 'a1', x: 4, y: 22.5 })
  })
})

describe('docToPayload', () => {
  it('ida y vuelta conserva las posiciones (la huella no cambia si no se tocó nada)', () => {
    const body = docToPayload(dtoToDoc(dto), 'save-1', dto.fingerprint)
    expect(body).toMatchObject({ saveId: 'save-1', baseFingerprint: dto.fingerprint })
    expect(body.areas).toEqual([
      { id: 'a1', name: 'Salón', floorShape: 'WIDE', sortOrder: 0 },
      { id: 'a2', name: 'Terraza', floorShape: 'TALL', sortOrder: 1 },
    ])
    expect(body.tables.find(t => t.id === 't1')).toMatchObject({ positionX: 0.25, positionY: 0.4, areaRef: 'a1' })
    expect(body.tables.find(t => t.id === 't2')).toMatchObject({ positionX: 0.5, positionY: 0.5, areaRef: null })
    expect(body.tables.find(t => t.id === 't3')).toMatchObject({ positionX: null, positionY: null, areaRef: 'a2' })
    expect(body.elements.find(e => e.id === 'e1')).toMatchObject({ positionX: 0, endX: 1, endY: 0, areaRef: 'a1' })
  })

  it('lo nuevo viaja con clientId y referencia áreas nuevas por su clave', () => {
    const doc = dtoToDoc({ ...dto, areas: [], tables: [], elements: [] })
    doc.areas.push({ key: 'tmp-a', name: ' Barra ', floorShape: 'SQUARE', sortOrder: 0, external: false })
    doc.tables.push({ key: 'tmp-t', number: '9', capacity: 4, shape: 'SQUARE', rotation: 0, areaKey: 'tmp-a', x: 20, y: 20, legacy: null, hasOpenOrder: false })
    const body = docToPayload(doc, 's', dto.fingerprint)
    expect(body.areas).toEqual([{ clientId: 'tmp-a', name: 'Barra', floorShape: 'SQUARE', sortOrder: 0 }])
    expect(body.tables).toEqual([expect.objectContaining({ clientId: 'tmp-t', areaRef: 'tmp-a', positionX: 0.5, positionY: 0.5 })])
  })
})
