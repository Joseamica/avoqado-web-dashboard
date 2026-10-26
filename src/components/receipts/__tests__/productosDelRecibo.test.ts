import { describe, expect, it } from 'vitest'
import { productosDelRecibo } from '@/components/receipts/productosDelRecibo'

// D8 (26-oct): el generador de la terminal (avoqado-server digitalReceipt.tpv.service.ts) guarda los productos en `items`,
// fuera de `order`, con `productName`/`unitPrice`/`total`. ~1,600 recibos de una semana no enseñaban qué se compró.
describe('productosDelRecibo', () => {
  it('recibo de la terminal: toma `items` y lo traduce al formato del visor', () => {
    const productos = productosDelRecibo({
      order: { items: undefined } as never,
      items: [
        {
          productName: 'Latte',
          quantity: 2,
          unitPrice: 55,
          total: 110,
          modifiers: [{ name: 'Leche de avena', quantity: 1, price: 10 }],
        },
      ],
    })
    expect(productos).toEqual([
      { name: 'Latte', quantity: 2, price: 55, totalPrice: 110, weightKg: null, modifiers: [{ name: 'Leche de avena', price: 10, quantity: 1 }] },
    ])
  })

  it('recibo del panel: conserva `order.items` tal cual', () => {
    const delPanel = [{ name: 'Gorra', quantity: 1, price: 400, totalPrice: 400, modifiers: [] }]
    expect(productosDelRecibo({ order: { items: delPanel } as never, items: [{ productName: 'Otro', quantity: 1, unitPrice: 1, total: 1 }] })).toBe(
      delPanel,
    )
  })

  it('sin productos (una liga de monto fijo): lista vacía', () => {
    expect(productosDelRecibo({ order: { items: [] } as never })).toEqual([])
    expect(productosDelRecibo({})).toEqual([])
  })

  it('un producto de la terminal sin nombre ni modificadores no rompe el visor', () => {
    expect(productosDelRecibo({ items: [{ quantity: 1, unitPrice: 20, total: 20 }] })).toEqual([
      { name: 'Producto', quantity: 1, price: 20, totalPrice: 20, weightKg: null, modifiers: [] },
    ])
  })

  it('Codex D8 #1/#2: conserva el peso y la cantidad del extra', () => {
    const [p] = productosDelRecibo({
      items: [{ productName: 'Queso Oaxaca', quantity: 1, unitPrice: 100, total: 50, weightKg: 0.5, modifiers: [{ name: 'Extra', quantity: 2, price: 10 }] }],
    })
    expect(p).toMatchObject({ weightKg: 0.5, price: 100, totalPrice: 50, modifiers: [{ name: 'Extra', quantity: 2, price: 10 }] })
  })
})
