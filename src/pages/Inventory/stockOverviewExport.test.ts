import { describe, expect, it } from 'vitest'
import es from '@/locales/es/inventory.json'
import en from '@/locales/en/inventory.json'
import { physicalRowsToExport, recipeRowsToExport } from './stockOverviewExport'
import type { InventoryProduct, StockOverviewRow } from './types/stock-overview'

const t = ((key: string) => {
  const raw = key.split('.').reduce<any>((o, k) => o?.[k], es)
  if (typeof raw !== 'string') throw new Error(`Falta la llave ${key}`)
  return raw
}) as never

const fila = (over: Partial<StockOverviewRow>): StockOverviewRow => ({
  id: 'p1',
  kind: 'product',
  name: 'Vestido Charlotte · S',
  sku: 'VESTIDO-REICH-S',
  unitLabel: null,
  stock: 2,
  minStock: null,
  cost: 1500,
  price: 5550,
  confirmedStock: null,
  source: {} as InventoryProduct,
  ...over,
})

describe('physicalRowsToExport', () => {
  it('lleva lo que se ve en la tabla, con números que Excel puede sumar', () => {
    expect(physicalRowsToExport([fila({ minStock: 1 })], t, unit => unit)).toEqual([
      { Artículo: 'Vestido Charlotte · S', Tipo: 'Producto', SKU: 'VESTIDO-REICH-S', Disponible: 2, Unidad: '', Mínimo: 1, Precio: 5550 },
    ])
  })

  it('nunca lleva el costo: la tabla no lo enseña', () => {
    const [row] = physicalRowsToExport([fila({ cost: 1500 })], t, unit => unit)
    expect(Object.values(row)).not.toContain(1500)
    expect(Object.keys(row).join()).not.toMatch(/cost/i)
  })

  it('un ingrediente lleva su unidad, y lo que no aplica queda vacío en vez de inventarse un 0', () => {
    const ingrediente = fila({ kind: 'ingredient', name: 'Leche', sku: null, unitLabel: 'LITER', stock: 3.5, minStock: null, price: null })
    expect(physicalRowsToExport([ingrediente], t, unit => (unit === 'LITER' ? 'L' : unit))).toEqual([
      { Artículo: 'Leche', Tipo: 'Ingrediente', SKU: '', Disponible: 3.5, Unidad: 'L', Mínimo: '', Precio: '' },
    ])
  })

  it('un mínimo de 0 es un dato y se conserva', () => {
    expect(physicalRowsToExport([fila({ minStock: 0 })], t, unit => unit)[0].Mínimo).toBe(0)
  })
})

describe('recipeRowsToExport', () => {
  it('lleva lo que se ve en la pestaña de recetas', () => {
    const receta = { id: 'r1', name: 'Latte', sku: 'LAT', price: '65.50', trackInventory: true, inventoryMethod: 'RECIPE', availableQuantity: '12' } as InventoryProduct
    expect(recipeRowsToExport([receta], t)).toEqual([{ Artículo: 'Latte', SKU: 'LAT', 'Disponible (teórico)': 12, Precio: 65.5 }])
  })

  it('sin SKU ni cantidad no truena', () => {
    const receta = { id: 'r1', name: 'Latte', price: 65, trackInventory: true, availableQuantity: null } as InventoryProduct
    expect(recipeRowsToExport([receta], t)).toEqual([{ Artículo: 'Latte', SKU: '', 'Disponible (teórico)': 0, Precio: 65 }])
  })
})

describe('traducciones', () => {
  it('es y en traen las mismas llaves', () => {
    const llaves = (o: Record<string, unknown>, base = ''): string[] =>
      Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' && v ? llaves(v as Record<string, unknown>, `${base}${k}.`) : [`${base}${k}`]))
    expect(llaves(en.stockExport)).toEqual(llaves(es.stockExport))
    expect(llaves(en.stockImport)).toEqual(llaves(es.stockImport))
  })
})
