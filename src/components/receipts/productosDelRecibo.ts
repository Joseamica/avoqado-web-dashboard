import type { ReceiptOrderItem, ReceiptTerminalItem, UnifiedReceiptData } from '@/types/receipt'

/**
 * D8 (26-oct): los productos que pinta el visor. El recibo del panel los trae en `order.items` con el formato del visor; el de
 * la terminal (avoqado-server `digitalReceipt.tpv.service.ts`) los guarda en `items`, fuera de `order`, con `productName`,
 * `unitPrice` y `total`. Se traducen aquí, así los recibos ya creados también los enseñan, sin migrar datos.
 */
export function productosDelRecibo(data: { order?: Pick<UnifiedReceiptData['order'], 'items'> | null; items?: ReceiptTerminalItem[] }): ReceiptOrderItem[] {
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
