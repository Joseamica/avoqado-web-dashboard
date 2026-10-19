import { describe, expect, it } from 'vitest'
import type { ItemSalesMetrics } from '@/services/reports/salesByItem.service'
import { agruparVentasPorFamilia } from '../salesByItemFamilies'

const item = (p: Partial<ItemSalesMetrics> & { productName: string }): ItemSalesMetrics => ({
  productId: p.productName,
  productSku: null,
  categoryName: 'Ropa',
  unit: 'c/u',
  itemsSold: 1,
  unitsSold: 1,
  grossSales: 100,
  discounts: 0,
  netSales: 100,
  ...p,
})

const orden = { field: 'grossSales', direction: 'desc' } as const

describe('agruparVentasPorFamilia', () => {
  it('sin familias devuelve los mismos item en el mismo orden (y sólo artículos)', () => {
    const a = item({ productName: 'Café', grossSales: 300, netSales: 300 })
    const b = item({ productName: 'Pan', grossSales: 200, netSales: 200 })
    const c = item({ productName: 'Té', grossSales: 100, netSales: 100 })
    const filas = agruparVentasPorFamilia([a, b, c], orden)
    expect(filas.map(f => f.tipo)).toEqual(['articulo', 'articulo', 'articulo'])
    expect(filas.map(f => (f.tipo === 'articulo' ? f.item : null))).toEqual([a, b, c])
    // el orden lo pone `orden`, con el mismo comparador de hoy
    const asc = agruparVentasPorFamilia([a, b, c], { field: 'productName', direction: 'asc' })
    expect(asc.map(f => (f.tipo === 'articulo' ? f.item.productName : ''))).toEqual(['Café', 'Pan', 'Té'])
  })

  it('suma una familia (dos variantes de g1) y fusiona sus promociones por nombre', () => {
    const v1 = item({
      productName: 'Playera · Chica',
      productGroupId: 'g1',
      productGroupName: 'Playera',
      itemsSold: 2,
      unitsSold: 3,
      grossSales: 300,
      discounts: 30,
      netSales: 270,
      promotions: [{ name: '2x1', unitsSold: 2, netSales: 100 }],
      promotionName: '2x1',
    })
    const v2 = item({
      productName: 'Playera · Grande',
      productGroupId: 'g1',
      productGroupName: 'Playera',
      itemsSold: 1,
      unitsSold: 1,
      grossSales: 120,
      discounts: 20,
      netSales: 100,
      promotions: [
        { name: '2x1', unitsSold: 1, netSales: 40 },
        { name: 'Verano', unitsSold: 1, netSales: 60 },
      ],
      promotionName: null,
    })
    const suelto = item({ productName: 'Gorra', grossSales: 50, netSales: 50 })

    const filas = agruparVentasPorFamilia([v1, v2, suelto], orden)
    expect(filas).toHaveLength(2)
    const fam = filas[0]
    if (fam.tipo !== 'familia') throw new Error('se esperaba una familia')
    expect(fam.groupId).toBe('g1')
    expect(fam.nombre).toBe('Playera')
    expect(fam.metricas).toMatchObject({ itemsSold: 3, unitsSold: 4, grossSales: 420, discounts: 50, netSales: 370 })
    expect(fam.metricas.promotions).toEqual([
      { name: '2x1', unitsSold: 3, netSales: 140 },
      { name: 'Verano', unitsSold: 1, netSales: 60 },
    ])
    expect(fam.variantes).toEqual([v1, v2])
    expect(filas[1]).toEqual({ tipo: 'articulo', item: suelto })
  })

  it('el orden aplica a familias y sueltos juntos, y a las variantes por dentro', () => {
    const chica = item({ productName: 'Playera · Chica', productGroupId: 'g1', productGroupName: 'Playera', grossSales: 100, netSales: 100 })
    const grande = item({ productName: 'Playera · Grande', productGroupId: 'g1', productGroupName: 'Playera', grossSales: 250, netSales: 250 })
    const gorra = item({ productName: 'Gorra', grossSales: 300, netSales: 300 })
    const cinto = item({ productName: 'Cinto', grossSales: 20, netSales: 20 })

    // familia = 350 > gorra 300 > cinto 20
    const filas = agruparVentasPorFamilia([chica, gorra, cinto, grande], orden)
    expect(filas.map(f => (f.tipo === 'familia' ? f.nombre : f.item.productName))).toEqual(['Playera', 'Gorra', 'Cinto'])
    const fam = filas[0]
    if (fam.tipo !== 'familia') throw new Error('se esperaba una familia')
    expect(fam.variantes.map(v => v.productName)).toEqual(['Playera · Grande', 'Playera · Chica'])

    // por nombre ascendente: Cinto, Gorra, Playera
    const porNombre = agruparVentasPorFamilia([chica, gorra, cinto, grande], { field: 'productName', direction: 'asc' })
    expect(porNombre.map(f => (f.tipo === 'familia' ? f.nombre : f.item.productName))).toEqual(['Cinto', 'Gorra', 'Playera'])
  })
})
