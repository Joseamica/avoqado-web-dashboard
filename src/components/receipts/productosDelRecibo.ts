import type { ReceiptOrderItem, ReceiptTerminalItem, ReceiptTicketTotals, UnifiedReceiptData } from '@/types/receipt'

/**
 * D8 (26-oct): los productos que pinta el visor. El recibo del panel los trae en `order.items` con el formato del visor; el de
 * la terminal (avoqado-server `digitalReceipt.tpv.service.ts`) los guarda en `items`, fuera de `order`, con `productName`,
 * `unitPrice` y `total`. Se traducen aquí, así los recibos ya creados también los enseñan, sin migrar datos.
 */
export function productosDelRecibo(data: {
  order?: Pick<UnifiedReceiptData['order'], 'items'> | null
  items?: ReceiptTerminalItem[]
  ticketTotals?: Pick<ReceiptTicketTotals, 'subtotal' | 'parcial'> | null
}): ReceiptOrderItem[] {
  const productos = productosGuardados(data)
  // D15: el recibo de UNA parte de una venta dividida (`ticketTotals.parcial`, lo decide el SERVIDOR) enseña un renglón «Pago
  // parcial» con lo que cobró, como el papel del cobro. Sin la marca (venta completa o recibo de antes de D15), sus productos.
  const totales = data.ticketTotals
  if (totales?.parcial === true && productos.length) {
    return [{ name: 'Pago parcial', quantity: 1, price: totales.subtotal, totalPrice: totales.subtotal, weightKg: null, modifiers: [] }]
  }
  return productos
}

function productosGuardados(data: { order?: Pick<UnifiedReceiptData['order'], 'items'> | null; items?: ReceiptTerminalItem[] }): ReceiptOrderItem[] {
  if (data.order?.items?.length) return data.order.items
  return (data.items ?? []).map(item => ({
    name: item.productName || 'Producto',
    quantity: item.quantity,
    price: item.unitPrice,
    totalPrice: item.total,
    weightKg: item.weightKg ?? null,
    modifiers: (item.modifiers ?? []).map(m => ({ name: m.name, price: m.price, quantity: m.quantity })),
  }))
}
