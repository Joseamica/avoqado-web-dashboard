import { describe, it, expect } from 'vitest'
import {
  seleccionAlAbrir,
  productosNuevos,
  idsQueYaNoExisten,
  precioQueSePublica,
  precioGuia,
  erroresDePrecios,
  type ProductoDelCanal,
} from './productosDelCanal'

const p = (id: string, sku: string, createdAt = '2026-01-01T00:00:00Z'): ProductoDelCanal => ({
  id,
  sku,
  name: sku,
  price: 65,
  active: true,
  createdAt,
  categoryId: 'c1',
})

describe('precios', () => {
  it('guía Rappi con markup', () => expect(precioGuia('RAPPI', 65, 20)).toBe(78))
  it('Rappi redondea mitad hacia arriba', () => {
    expect(precioQueSePublica('RAPPI', 79.5)).toBe(80)
    expect(precioQueSePublica('RAPPI', 79.49)).toBe(79)
  })
  it('otros conservan 2 decimales', () => expect(precioQueSePublica('UBER_EATS', 79.5)).toBe(79.5))
  it('erroresDePrecios', () => expect(erroresDePrecios({ a: -5, b: 79.5, c: undefined, d: NaN })).toEqual(['a', 'd']))
})

describe('seleccionAlAbrir', () => {
  const prods = [p('p1', 'LATTE'), p('p2', 'TE')]
  it('lista vieja por códigos + overrides', () => {
    const r = seleccionAlAbrir({ productos: ['LATTE', 'NADIE'], precios: { overrides: { LATTE: 79, 'MOD-X': 5 } } }, prods)
    expect(r).toEqual({ lista: ['p1'], precios: { p1: 79 }, codigosSinProducto: ['NADIE'] })
  })
  it('con productoIds gana, usa porProducto', () => {
    const r = seleccionAlAbrir(
      { productoIds: ['p2'], productos: ['LATTE'], precios: { porProducto: { p2: 50 }, overrides: { LATTE: 1 } } },
      prods,
    )
    expect(r).toEqual({ lista: ['p2'], precios: { p2: 50 }, codigosSinProducto: [] })
  })
  it('sin nada: lista null', () => {
    expect(seleccionAlAbrir(null, prods)).toEqual({ lista: null, precios: {}, codigosSinProducto: [] })
  })
})

describe('productosNuevos / idsQueYaNoExisten', () => {
  const prods = [p('p1', 'A', '2026-02-01T00:00:00Z'), p('p2', 'B', '2026-02-02T00:00:00Z'), p('p3', 'C', '2025-12-01T00:00:00Z')]
  const desde = '2026-01-15T00:00:00Z'
  it('lista null o sin conectadoEn: ninguno', () => {
    expect(productosNuevos(prods, null, [], desde)).toEqual([])
    expect(productosNuevos(prods, [], [], null)).toEqual([])
  })
  it('fuera de lista, no revisado y posterior', () => {
    expect(productosNuevos(prods, ['p1'], ['p9'], desde).map(x => x.id)).toEqual(['p2'])
    expect(productosNuevos(prods, ['p1'], ['p2'], desde)).toEqual([])
  })
  it('ids que ya no existen', () => {
    expect(idsQueYaNoExisten(['p1', 'viejo'], prods)).toEqual(['viejo'])
    expect(idsQueYaNoExisten(null, prods)).toEqual([])
  })
})
