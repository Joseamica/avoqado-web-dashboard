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

/** Importe (pesos) que el servidor devolverá al reembolsar `qty` de las piezas que quedan del renglón. */
export function lineRefundAmount(item: { total: number; quantity: number; priorRefundedQty?: number }, qty: number): number {
  const prior = Math.min(Math.max(item.priorRefundedQty ?? 0, 0), item.quantity)
  const count = Math.min(qty, item.quantity - prior)
  return unitRefundCents(Math.round(item.total * 100), item.quantity, prior, count) / 100
}
