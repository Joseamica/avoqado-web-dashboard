import type { ReceiptTicketTotals, UnifiedReceiptData } from '@/types/receipt'

/**
 * IVA por producto, plan 7 (D3; r1 #8; A7-R6): los totales que pinta el visor. Los congelados por el servidor (con `discount`
 * cuando desglosa); en un recibo viejo, el total de ESE cobro sin desglose —nunca el subtotal o el impuesto de toda la orden, que
 * en un cobro parcial no cuadraban con «Total pagado»—. Una devolución va en magnitudes. Siempre:
 * subtotal − descuento + cargo + IVA agregado + propina = total.
 */
export function totalesDelRecibo(data: {
  payment?: Pick<UnifiedReceiptData['payment'], 'amount' | 'tipAmount'> | null
  ticketTotals?: ReceiptTicketTotals | null
}): ReceiptTicketTotals {
  if (data.ticketTotals && typeof data.ticketTotals.total === 'number') return data.ticketTotals
  const amount = Number(data.payment?.amount ?? 0)
  const propina = Number(data.payment?.tipAmount ?? 0)
  const tip = Math.abs(propina)
  const subtotal = Math.abs(amount)
  // Devolución: importe negativo, o importe 0 con propina negativa (devolución de sólo propina, r2 R2-6).
  const esDevolucion = amount < 0 || (amount === 0 && propina < 0)
  return {
    kind: esDevolucion ? 'DEVOLUCION' : 'COBRO',
    desglosado: false,
    subtotal,
    serviceCharge: 0,
    addedTax: 0,
    tip,
    total: Math.round((subtotal + tip) * 100) / 100,
  }
}
