import { describe, expect, it } from 'vitest'
import { docToPayload, dtoToDoc, planContent, sameContent } from '../planMapping'
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

describe('mapeo — ronda 1', () => {
  it('normaliza puertas y barras viejas giradas: 90/270 intercambian lados en el mismo centro, lo demás vuelve a 0', () => {
    const base = { areaId: 'a1', positionX: 0.25, positionY: 0.4, width: 0.075, height: 0.04, endX: null, endY: null, label: null, color: null }
    const d = dtoToDoc({
      ...dto,
      elements: [
        { ...base, id: 'd90', type: 'DOOR', rotation: 90 },
        { ...base, id: 'd270', type: 'DOOR', rotation: 270 },
        { ...base, id: 'b45', type: 'BAR_COUNTER', rotation: 45 },
      ],
    })
    // 3×1 con esquina en (10, 10): centro (11.5, 10.5)
    expect(d.elements[0]).toMatchObject({ x: 11, y: 9, w: 1, h: 3, rotation: 0 })
    expect(d.elements[1]).toMatchObject({ x: 11, y: 9, w: 1, h: 3, rotation: 180 })
    expect(d.elements[2]).toMatchObject({ x: 10, y: 10, w: 3, h: 1, rotation: 0 })
  })

  it('sin áreas, guardar con elementos viejos truena en vez de mandarlos a archivar', () => {
    const doc = dtoToDoc({ ...dto, areas: [], tables: [] })
    expect(doc.elements).toHaveLength(2)
    expect(() => docToPayload(doc, 's', dto.fingerprint)).toThrow('docToPayload: hay elementos sin área')
  })
})

describe('mapeo — ola final', () => {
  // R31: una mesa de SoftRestaurant con capacity 0 («sin dato») viaja tal cual: el servidor ya acepta 0–99.
  it('0 personas se conserva de ida y de vuelta', () => {
    const conCero = { ...dto, tables: [{ ...dto.tables[0], capacity: 0 }] }
    const doc = dtoToDoc(conCero)
    expect(doc.tables[0].capacity).toBe(0)
    expect(docToPayload(doc, 's', dto.fingerprint).tables[0]).toMatchObject({ id: 't1', capacity: 0 })
  })
})

describe('planContent — ronda m-a', () => {
  const same = (a: ReturnType<typeof dtoToDoc>, b: ReturnType<typeof dtoToDoc>) => sameContent(planContent(a), planContent(b))

  it('la marca de cuenta abierta y el orden de mesas y elementos no cuentan: no viajan o no importan', () => {
    const base = dtoToDoc(dto)
    const otro = dtoToDoc(dto)
    otro.tables = [...otro.tables].reverse().map(t => ({ ...t, hasOpenOrder: !t.hasOpenOrder }))
    otro.elements = [...otro.elements].reverse()
    expect(same(base, otro)).toBe(true)
  })

  it('cualquier campo que viaja en el PUT sí cuenta (y el orden de las áreas, que es su sortOrder)', () => {
    const base = dtoToDoc(dto)
    const movida = dtoToDoc(dto)
    movida.tables[0] = { ...movida.tables[0], x: (movida.tables[0].x as number) + 1 }
    expect(same(base, movida)).toBe(false)
    const renombrada = dtoToDoc(dto)
    renombrada.tables[0] = { ...renombrada.tables[0], number: '7' }
    expect(same(base, renombrada)).toBe(false)
    const areas = dtoToDoc(dto)
    areas.areas = [...areas.areas].reverse()
    expect(same(base, areas)).toBe(false)
    const sinMesa = dtoToDoc(dto)
    sinMesa.tables = sinMesa.tables.slice(1)
    expect(same(base, sinMesa)).toBe(false)
  })

  it('compara también un plano con elementos viejos sin área (sin tronar como docToPayload)', () => {
    const sinAreas = { ...dto, areas: [], tables: [] }
    expect(same(dtoToDoc(sinAreas), dtoToDoc(sinAreas))).toBe(true)
  })
})
