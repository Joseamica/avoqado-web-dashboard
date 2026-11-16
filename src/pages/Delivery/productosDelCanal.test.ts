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
  it('Rappi: el ruido de float no baja el .5', () => {
    expect(precioGuia('RAPPI', 50, 15)).toBe(58)
    expect(precioQueSePublica('RAPPI', 57.49999999999999)).toBe(58)
  })
  it('Uber da lo mismo que la cuenta del servidor', () => {
    expect(precioGuia('UBER_EATS', 50, 15)).toBe(Math.round(50 * 1.15 * 100) / 100)
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
  it('sin lista pero con overrides: lista null y precios por id', () => {
    const r = seleccionAlAbrir({ precios: { overrides: { LATTE: 79, 'MOD-X': 5, DESCONOCIDO: 9 } } }, prods)
    expect(r).toEqual({ lista: null, precios: { p1: 79 }, codigosSinProducto: [] })
  })
  it('sin nada: lista null', () => {
    expect(seleccionAlAbrir(null, prods)).toEqual({ lista: null, precios: {}, codigosSinProducto: [] })
  })

  // 🔴 Igual que el SERVIDOR (Codex impl r1 #1): con `porProducto` mandan SÓLO esos precios (la `overrides` es su copia por
  // código); sin él, los de `overrides` cuyo código es de un producto recibido, empiece o no con `MOD-`.
  it('reúso de código: porProducto {p1:79} y copia {LATTE:79}; p1 ahora es Z y p2 tomó LATTE ⇒ sólo {p1:79}', () => {
    const ahora = [p('p1', 'Z'), p('p2', 'LATTE')]
    const precios = { porProducto: { p1: 79 }, overrides: { LATTE: 79 } }
    expect(seleccionAlAbrir({ precios }, ahora).precios).toEqual({ p1: 79 })
    expect(seleccionAlAbrir({ productoIds: ['p1', 'p2'], precios }, ahora).precios).toEqual({ p1: 79 })
  })

  it('un producto cuyo código empieza con MOD- conserva su precio (lista vieja, con o sin lista)', () => {
    const conMod = [p('pM', 'MOD-raro'), p('p2', 'TE')]
    const precios = { overrides: { 'MOD-raro': 79, 'MOD-x1': 5 } }
    expect(seleccionAlAbrir({ productos: ['MOD-raro', 'TE'], precios }, conMod)).toEqual({
      lista: ['pM', 'p2'],
      precios: { pM: 79 },
      codigosSinProducto: [],
    })
    expect(seleccionAlAbrir({ precios }, conMod).precios).toEqual({ pM: 79 })
  })

  it('lista por id sin porProducto: los precios por código de productos recibidos, como los convierte el SERVIDOR', () => {
    expect(seleccionAlAbrir({ productoIds: ['p1'], precios: { overrides: { LATTE: 60, NADIE: 3 } } }, prods).precios).toEqual({ p1: 60 })
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
