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

// D15 (28-oct): el recibo de UNA parte de una venta dividida (`ticketTotals.parcial`) enseña un renglón «Pago parcial» con lo que
// cobró, como el papel del cobro; sin la marca, sus productos como siempre.
describe('productosDelRecibo · parte de una venta dividida (D15)', () => {
  const parcial = { kind: 'COBRO' as const, desglosado: false, parcial: true as const, subtotal: 15, serviceCharge: 0, addedTax: 0, tip: 2, total: 17 }
  const pagoParcial = [{ name: 'Pago parcial', quantity: 1, price: 15, totalPrice: 15, weightKg: null, modifiers: [] }]

  it('recibo de la terminal de una parte: un renglón «Pago parcial»', () => {
    expect(
      productosDelRecibo({
        ticketTotals: parcial,
        items: [
          { productName: 'Agua', quantity: 1, unitPrice: 20, total: 20 },
          { productName: 'Café', quantity: 1, unitPrice: 10, total: 10 },
        ],
      }),
    ).toEqual(pagoParcial)
  })

  it('recibo del panel de una parte: también «Pago parcial»', () => {
    expect(
      productosDelRecibo({ ticketTotals: parcial, order: { items: [{ name: 'Gorra', quantity: 1, price: 30, totalPrice: 30, modifiers: [] }] } as never }),
    ).toEqual(pagoParcial)
  })

  it('sin la marca (venta completa o recibo de antes de D15): sus productos', () => {
    const { parcial: _sinMarca, ...completo } = parcial
    expect(productosDelRecibo({ ticketTotals: completo, items: [{ productName: 'Agua', quantity: 1, unitPrice: 20, total: 20 }] })).toEqual([
      { name: 'Agua', quantity: 1, price: 20, totalPrice: 20, weightKg: null, modifiers: [] },
    ])
  })

  it('una parte sin productos guardados: lista vacía', () => {
    expect(productosDelRecibo({ ticketTotals: parcial, items: [] })).toEqual([])
  })

  it('D1 fotocopia: con la copia del ticket mandan sus renglones, con o sin «parcial»', () => {
    const lineasDelTicket = { lineas: [{ nombre: 'Café', cantidad: 1, unitarioCents: 3000, totalCents: 3000, nota: 'sin azúcar' }], subtotalCents: 3000, descuentoCents: 300 }
    const esperado = [{ name: 'Café', quantity: 1, price: 30, totalPrice: 30, weightKg: null, nota: 'sin azúcar', modifiers: [] }]
    const items = [{ productName: 'Agua', quantity: 1, unitPrice: 20, total: 20 }]
    expect(productosDelRecibo({ items, ticketTotals: { subtotal: 27, parcial: true }, lineasDelTicket })).toEqual(esperado)
    expect(productosDelRecibo({ items, ticketTotals: { subtotal: 27 }, lineasDelTicket })).toEqual(esperado)
  })
})
