import type { ReceiptLineasDelTicket, ReceiptOrderItem, ReceiptTerminalItem, ReceiptTicketTotals, UnifiedReceiptData } from '@/types/receipt'

/**
 * D8 (26-oct): los productos que pinta el visor. El recibo del panel los trae en `order.items` con el formato del visor; el de
 * la terminal (avoqado-server `digitalReceipt.tpv.service.ts`) los guarda en `items`, fuera de `order`, con `productName`,
 * `unitPrice` y `total`. Se traducen aquí, así los recibos ya creados también los enseñan, sin migrar datos.
 */
export function productosDelRecibo(data: {
  order?: Pick<UnifiedReceiptData['order'], 'items'> | null
  items?: ReceiptTerminalItem[]
  ticketTotals?: Pick<ReceiptTicketTotals, 'subtotal' | 'parcial'> | null
  lineasDelTicket?: ReceiptLineasDelTicket | null
}): ReceiptOrderItem[] {
  // D1 «fotocopia del ticket»: si el cobro guardó los renglones que imprimió, esos mandan, con o sin `parcial`.
  const copia = copiaDelRecibo(data)
  if (copia) {
    return copia.lineas.map(l => ({
      name: l.nombre,
      quantity: l.cantidad,
      price: l.unitarioCents / 100,
      totalPrice: l.totalCents / 100,
      weightKg: null,
      ...(l.peso ? { peso: l.peso } : {}),
      ...(l.nota ? { nota: l.nota } : {}),
      ...(l.area ? { area: l.area } : {}),
      ...(l.cortesia ? { cortesia: true } : {}),
      ...(l.pieza ? { pieza: true } : {}),
      // La copia sólo trae el texto del modificador: no se inventa un precio (Codex código r1 #1).
      modifiers: (l.modificadores ?? []).map(name => ({ name })),
    }))
  }
  const productos = productosGuardados(data)
  // D15: el recibo de UNA parte de una venta dividida (`ticketTotals.parcial`, lo decide el SERVIDOR) enseña un renglón «Pago
  // parcial» con lo que cobró, como el papel del cobro. Sin la marca (venta completa o recibo de antes de D15), sus productos.
  const totales = data.ticketTotals
  if (totales?.parcial === true && productos.length) {
    return [{ name: 'Pago parcial', quantity: 1, price: totales.subtotal, totalPrice: totales.subtotal, weightKg: null, modifiers: [] }]
  }
  return productos
}

/** La copia del ticket del recibo, si viene bien formada (el SERVIDOR ya la validó al guardarla). */
export function copiaDelRecibo(data: { lineasDelTicket?: ReceiptLineasDelTicket | null }): ReceiptLineasDelTicket | null {
  const c = data.lineasDelTicket
  return c && Array.isArray(c.lineas) && c.lineas.length > 0 && typeof c.subtotalCents === 'number' && typeof c.descuentoCents === 'number'
    ? c
    : null
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
