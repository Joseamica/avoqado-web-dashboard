/**
 * Pestañas y tarjetas de /payments a partir de los GRUPOS del resumen del servidor
 * (`GET …/payments/summary`, 2026-09-01). Antes se bajaban hasta 10,000 pagos para
 * contarlos en el navegador; ahora el servidor devuelve un grupo por estado×tipo con
 * su conteo y sus sumas, y aquí se suman grupos.
 *
 * Módulo PURO a propósito (sin `@/`, sin React): el script de golden del servidor lo
 * importa tal cual para comprobar que los números salen idénticos a los de antes.
 *
 * 🔴 Semántica de las pestañas — y el defecto que corrige, declarado:
 *  - «Reembolsados»: `type === 'REFUND' || status === 'REFUNDED'` (sin cambio).
 *  - «Completados»: antes comparaba contra `PaymentStatus.PAID` ('PAID'), un valor que el
 *    servidor NUNCA emite (el estado de un pago es `TransactionStatus`: COMPLETED…), así
 *    que la pestaña siempre decía 0 y su tabla salía vacía (medido en la base local el
 *    2026-09-01: 650 pagos completados, pestaña en 0). Ahora es `status === 'COMPLETED'`
 *    excluyendo los reembolsos, que ya tienen su pestaña.
 *  - «Pendientes»: antes PENDING|PARTIAL (PARTIAL no existe); ahora PENDING|PROCESSING.
 *    El listado excluye PENDING, así que en la práctica es PROCESSING.
 * `paymentTabOfRow` aplica la MISMA regla a las filas cargadas en la tabla, para que la
 * pestaña y la tabla nunca se contradigan.
 */

export interface PaymentSummaryGroup {
  status: string
  type: string | null
  count: number
  amount: number
  tipAmount: number
}

export interface PaymentsSummaryData {
  /** Sólo con los filtros del servidor (fechas, cuentas, métodos, orígenes, personal, búsqueda). */
  groups: PaymentSummaryGroup[]
  /** Además con los filtros del navegador (subtotal, propina, total, internacional, marca). */
  filteredGroups: PaymentSummaryGroup[]
  total: number
  filteredTotal: number
}

export type PaymentStatusTab = 'all' | 'completed' | 'pending' | 'refunded'
export type PaymentTabBucket = Exclude<PaymentStatusTab, 'all'> | 'other'

export function paymentTabOfRow(row: { status?: string | null; type?: string | null }): PaymentTabBucket {
  if (row.type === 'REFUND' || row.status === 'REFUNDED') return 'refunded'
  if (row.status === 'COMPLETED') return 'completed'
  if (row.status === 'PENDING' || row.status === 'PROCESSING') return 'pending'
  return 'other'
}

export function paymentRowMatchesTab(row: { status?: string | null; type?: string | null }, tab: string): boolean {
  if (tab === 'all') return true
  return paymentTabOfRow(row) === tab
}

export function paymentTabCounts(groups: PaymentSummaryGroup[] | undefined): Record<PaymentStatusTab, number> {
  const counts = { all: 0, completed: 0, pending: 0, refunded: 0 }
  for (const g of groups ?? []) {
    counts.all += g.count
    const bucket = paymentTabOfRow(g)
    if (bucket !== 'other') counts[bucket] += g.count
  }
  return counts
}

export interface PaymentCardTotals {
  count: number
  /** Σ (amount + tipAmount). Los reembolsos llevan monto NEGATIVO y se restan solos. */
  totalCollected: number
  /** Σ amount. */
  netSales: number
}

export function paymentCardsForTab(groups: PaymentSummaryGroup[] | undefined, tab: string): PaymentCardTotals {
  let count = 0
  let totalCollected = 0
  let netSales = 0
  for (const g of groups ?? []) {
    if (!paymentRowMatchesTab(g, tab)) continue
    count += g.count
    totalCollected += g.amount + g.tipAmount
    netSales += g.amount
  }
  return { count, totalCollected, netSales }
}
