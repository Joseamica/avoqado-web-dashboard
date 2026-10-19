import { describe, expect, it } from 'vitest'
import { familiaDeProducto, filasDeExistencias, sumaDe, sumarExistencias } from '../stockFamilies'
import { productToStockOverviewRow, rawMaterialToStockOverviewRow } from '../types/stock-overview'

const producto = (id: string, name: string, stock: number, extra: object = {}) =>
  productToStockOverviewRow({
    id,
    name,
    sku: `SKU-${id}`,
    price: 100,
    cost: 40,
    trackInventory: true,
    inventoryMethod: 'QUANTITY',
    availableQuantity: stock,
    inventory: { minimumStock: 2 },
    ...extra,
  })
const variante = (id: string, talla: string, pos: number, stock: number) =>
  producto(id, `Playera · ${talla}`, stock, {
    productGroupId: 'g1',
    productGroupName: 'Playera',
    variantOptions: [{ name: 'Talla', value: talla, namePosition: 0, valuePosition: pos }],
  })
const harina = rawMaterialToStockOverviewRow({ id: 'r1', name: 'Harina', sku: 'HAR', unit: 'KILOGRAM', currentStock: 12, reorderPoint: 5, costPerUnit: 9 } as never)

describe('filasDeExistencias', () => {
  it('🔴 sin familias devuelve la MISMA lista (mismos objetos, mismo orden)', () => {
    const lista = [producto('a', 'Agua', 10), harina, producto('b', 'Café', 4)]
    const filas = filasDeExistencias(lista, familiaDeProducto, sumarExistencias)
    expect(filas).toBe(lista)
    filas.forEach((f, i) => expect(f).toBe(lista[i]))
  })

  it('dos variantes + un suelto + un ingrediente ⇒ UNA fila de familia con la suma; el suelto y el ingrediente quedan igual', () => {
    const m = variante('v2', 'M', 1, 3)
    const agua = producto('a', 'Agua', 10)
    const s = variante('v1', 'S', 0, 4)
    const filas = filasDeExistencias([m, agua, s, harina], familiaDeProducto, sumarExistencias)

    expect(filas).toHaveLength(3)
    // la familia va en el lugar de su primera variante; el suelto y el ingrediente, los mismos objetos
    expect(filas[0]).toMatchObject({ id: 'familia:g1', name: 'Playera', stock: 7, minStock: 4, sku: null, price: null })
    expect(filas[1]).toBe(agua)
    expect(filas[2]).toBe(harina)
    // sus variantes, en el orden de la opción (S antes que M) y sin copiar
    expect(filas[0].__familia?.variantes).toEqual([s, m])
    expect(filas[0].__familia?.variantes[0]).toBe(s)
  })

  it('sumaDe redondea a milésimas (existencias por peso) y da null si ninguna fila tiene el dato', () => {
    expect(sumaDe([{ n: 0.1 }, { n: 0.2 }], r => r.n)).toBe(0.3)
    expect(sumaDe([{ n: null }, { n: null }], r => r.n)).toBeNull()
    expect(sumaDe([{ n: null }, { n: 5 }], r => r.n)).toBe(5)
  })
})
