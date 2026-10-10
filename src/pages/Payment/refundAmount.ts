export interface RefundableItem {
  id: string // orderItem id
  productId: string | null
  productName: string | null
  quantity: number
  unitPrice: number
  total: number
  /**
   * Lo que COBRÓ el renglón completo (pesos): sin su descuento propio ni su parte del de la cuenta; cortesía = 0. Lo manda
   * el servidor; lo omite cuando no puede repartir los descuentos por artículo (y entonces rechaza la devolución por
   * artículos con un 400 que se muestra tal cual). Sin él, la hoja usa `total`.
   */
  chargedTotal?: number | null
  /** Whether this product has inventory tracking enabled (for the restock step) */
  trackInventory?: boolean
  venueName?: string
  /** Quantity already refunded across prior REFUND payments for this orderItemId */
  priorRefundedQty?: number
  /** Total amount already refunded for this orderItemId (decimal) */
  priorRefundedAmount?: number
}

/**
 * Espejo EXACTO de `getUnitRefundCents` (avoqado-server refund.dashboard.service.ts): el
 * servidor reparte los centavos del renglón entre sus piezas —los sobrantes van a las
 * primeras: $10 / 3 = [3.34, 3.33, 3.33]— y cobra desde la pieza que sigue a lo ya devuelto.
 * Prorratear y redondear no coincide con eso. Mismo algoritmo en Android e iOS
 * (`RefundAmountCalculator`).
 */
export function unitRefundCents(totalCents: number, quantity: number, offset: number, count: number): number {
  if (quantity <= 0 || count <= 0) return 0
  const baseUnit = Math.floor(totalCents / quantity)
  const remainder = totalCents % quantity
  const end = offset + count
  const bonusUnits = Math.max(0, Math.min(remainder, end) - Math.min(remainder, offset))
  return baseUnit * count + bonusUnits
}

/**
 * Importe (pesos) que el servidor devolverá al reembolsar `qty` de las piezas que quedan del renglón. Reparte lo que COBRÓ
 * el renglón (`chargedTotal`: sin su descuento propio ni su parte del de la cuenta; cortesía = 0), no el bruto `total`
 * (decisión A del founder, 9-oct-2026). Sin `chargedTotal` (servidor viejo, o composición que no se puede repartir por
 * artículo y que el servidor rechaza con un 400) cae al `total` de siempre.
 */
export function lineRefundAmount(
  item: { total: number; chargedTotal?: number | null; quantity: number; priorRefundedQty?: number },
  qty: number,
): number {
  const prior = Math.min(Math.max(item.priorRefundedQty ?? 0, 0), item.quantity)
  const count = Math.min(qty, item.quantity - prior)
  return unitRefundCents(Math.round((item.chargedTotal ?? item.total) * 100), item.quantity, prior, count) / 100
}

/**
 * Renglones de la orden del cobro (`payment.order.items[]`) como los pide la hoja de reembolso, con lo ya devuelto de cada
 * uno sumado de los reembolsos previos (`processorData.refundedItems[]`).
 */
export function refundableItemsFromOrder(orderItems: any[], refunds: any[]): RefundableItem[] {
  return orderItems.map((item: any) => {
    // Sum qty + amount already refunded for this orderItemId across
    // all prior REFUND payments on this payment.
    let priorRefundedQty = 0
    let priorRefundedAmount = 0
    refunds.forEach((r: any) => {
      const refundedItems = (r.processorData as any)?.refundedItems ?? []
      refundedItems.forEach((ri: any) => {
        if (ri.orderItemId === item.id) {
          priorRefundedQty += Number(ri.quantity) || 0
          priorRefundedAmount += Number(ri.amount) || 0
        }
      })
    })
    return {
      id: item.id,
      productId: item.productId,
      productName: item.productName || item.product?.name || null,
      quantity: item.quantity,
      unitPrice: Number(item.unitPrice) || 0,
      total: Number(item.total) || 0,
      chargedTotal: optionalPesos(item.chargedTotal),
      trackInventory: !!item.product?.trackInventory,
      priorRefundedQty,
      priorRefundedAmount,
    }
  })
}

/** Pesos opcionales del servidor (número o texto decimal). Ausente o no numérico ⇒ null, nunca 0 (0 es una cortesía). */
function optionalPesos(value: unknown): number | null {
  const n = typeof value === 'string' ? parseFloat(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : null
}
