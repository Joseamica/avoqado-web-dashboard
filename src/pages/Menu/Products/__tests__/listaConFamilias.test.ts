import { describe, expect, it } from 'vitest'
import { filasConFamilias, rangoDePrecio } from '../listaConFamilias'

const p = (id: string, name: string, price: number, extra: object = {}) => ({ id, name, price, imageUrl: null, active: true, ...extra }) as never
const v = (id: string, talla: string, price: number, pos: number) =>
  p(id, `Playera · ${talla}`, price, {
    productGroupId: 'g1',
    productGroupName: 'Playera',
    productGroupImageUrl: null,
    variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  })

describe('filasConFamilias', () => {
  it('🔴 sin familias devuelve la MISMA lista (mismos objetos, mismo orden)', () => {
    const lista = [p('a', 'Agua', 20), p('b', 'Café', 40)]
    const r = filasConFamilias(lista)
    expect(r).toHaveLength(2)
    expect(r[0]).toBe(lista[0])
    expect(r[1]).toBe(lista[1])
  })

  it('una familia es UNA fila con su precio mínimo, en el lugar de su primera variante', () => {
    const r = filasConFamilias([p('a', 'Agua', 20), v('v2', 'M', 249, 1), v('v1', 'S', 199, 0)]) as Array<{
      id: string
      name: string
      price: number
      __familia?: { variantes: Array<{ id: string }> }
    }>
    expect(r.map(x => x.id)).toEqual(['a', 'familia:g1'])
    expect(r[1]).toMatchObject({ name: 'Playera', price: 199 })
    expect(r[1].__familia?.variantes.map(x => x.id)).toEqual(['v1', 'v2'])
    expect(rangoDePrecio(r[1].__familia as never)).toEqual({ min: 199, max: 249 })
  })
})
