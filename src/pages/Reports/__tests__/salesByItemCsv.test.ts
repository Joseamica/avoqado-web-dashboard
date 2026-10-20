import { describe, expect, it } from 'vitest'
import type { ItemSalesMetrics } from '@/services/reports/salesByItem.service'
import { csvDeVentas, type EncabezadosCsv } from '../salesByItemCsv'

const encabezados: EncabezadosCsv = {
  primera: 'Artículo',
  producto: { sku: 'SKU', categoria: 'Categoría', promocion: 'Dentro de promoción' },
  unidad: 'Unidad',
  articulos: 'Artículos vendidos',
  unidades: 'Unidades vendidas',
  brutas: 'Ventas brutas',
  descuentos: 'Descuentos',
  familia: 'Familia',
  total: 'Total',
}

const totales = { itemsSold: 16, unitsSold: 19, grossSales: 1450.5, discounts: 50, netSales: 1400.5 }

const filas: ItemSalesMetrics[] = [
  {
    productId: 'p1',
    productName: 'Café americano',
    productSku: 'CAF-1',
    categoryName: 'Bebidas',
    unit: 'c/u',
    itemsSold: 12,
    unitsSold: 15,
    grossSales: 1350,
    discounts: 50,
    netSales: 1300,
    promotions: [{ name: 'Combo desayuno', unitsSold: 3, netSales: 240 }],
  },
  {
    productId: 'p2',
    productName: 'Pan dulce',
    productSku: null,
    categoryName: null,
    unit: 'c/u',
    itemsSold: 4,
    unitsSold: 4,
    grossSales: 100.5,
    discounts: 0,
    netSales: 100.5,
  },
]

describe('csvDeVentas', () => {
  it('sin familias, la salida es byte por byte la que armaba handleExportCSV antes de moverlo', () => {
    // Salida real del handleExportCSV de SalesByItem.tsx (con BOM) para estos dos renglones, copiada ANTES de mover el código.
    const deHoy =
      '\uFEFF' +
      '"Artículo","SKU","Categoría","Dentro de promoción","Unidad","Artículos vendidos","Unidades vendidas","Ventas brutas","Descuentos"\n' +
      '"Café americano","CAF-1","Bebidas","Combo desayuno (3)","c/u","12","15","1350.00","50.00"\n' +
      '"Pan dulce","","","","c/u","4","4","100.50","0.00"\n' +
      '"Total","","","","","16","19","1450.50","50.00"'
    expect(csvDeVentas(filas, totales, encabezados, false)).toBe(deHoy)
  })

  it('sin columnas de producto (Mostrar por distinto de ninguno) tampoco cambia', () => {
    const sinProducto: EncabezadosCsv = { ...encabezados, primera: 'Categoría', producto: undefined }
    const csv = csvDeVentas(filas, totales, sinProducto, false)
    expect(csv).toBe(
      '\uFEFF' +
        '"Categoría","Unidad","Artículos vendidos","Unidades vendidas","Ventas brutas","Descuentos"\n' +
        '"Café americano","c/u","12","15","1350.00","50.00"\n' +
        '"Pan dulce","c/u","4","4","100.50","0.00"\n' +
        '"Total","","16","19","1450.50","50.00"',
    )
  })

  it('con familias, el encabezado trae «Familia» y cada renglón su productGroupName (sigue plano)', () => {
    const conFamilia: ItemSalesMetrics[] = [
      { ...filas[0], productName: 'Playera · Chica', productGroupId: 'g1', productGroupName: 'Playera' },
      { ...filas[1], productName: 'Gorra' },
    ]
    const lineas = csvDeVentas(conFamilia, totales, encabezados, true).split('\n')
    expect(lineas).toHaveLength(4)
    expect(lineas[0]).toBe(
      '\uFEFF"Artículo","SKU","Categoría","Dentro de promoción","Unidad","Artículos vendidos","Unidades vendidas","Ventas brutas","Descuentos","Familia"',
    )
    expect(lineas[1]).toBe('"Playera · Chica","CAF-1","Bebidas","Combo desayuno (3)","c/u","12","15","1350.00","50.00","Playera"')
    expect(lineas[2]).toBe('"Gorra","","","","c/u","4","4","100.50","0.00",""')
    expect(lineas[3]).toBe('"Total","","","","","16","19","1450.50","50.00",""')
  })

  it('una comilla en un nombre se duplica y no parte el renglón', () => {
    const conComillas = [{ ...filas[0], productName: 'Playera "Clásica" · S', productGroupId: 'g1', productGroupName: 'Playera "Clásica"' }]
    const lineas = csvDeVentas(conComillas, totales, encabezados, true).split('\n')
    expect(lineas[1].startsWith('"Playera ""Clásica"" · S",')).toBe(true)
    expect(lineas[1].endsWith(',"Playera ""Clásica"""')).toBe(true)
  })
})
