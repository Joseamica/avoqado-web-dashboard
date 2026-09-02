/**
 * Pestañas y tarjetas de /orders a partir de los GRUPOS del resumen del servidor
 * (`GET …/orders/summary`, 2026-09-01). Gemelo de `../Payment/paymentSummary.ts`:
 * módulo PURO (sin `@/`, sin React) que el golden del servidor importa tal cual.
 * La semántica de las pestañas es la de siempre, sin cambios.
 */

export interface OrderSummaryGroup {
  status: string
  count: number
  total: number
  tipAmount: number
}

export interface OrdersSummaryData {
  groups: OrderSummaryGroup[]
  filteredGroups: OrderSummaryGroup[]
  total: number
  filteredTotal: number
}

export type OrderStatusTab = 'all' | 'active' | 'completed' | 'cancelled'

export const ORDER_TAB_STATUSES: Record<Exclude<OrderStatusTab, 'all'>, readonly string[]> = {
  active: ['PENDING', 'CONFIRMED', 'PREPARING', 'READY'],
  completed: ['COMPLETED'],
  cancelled: ['CANCELLED'],
}

export function orderRowMatchesTab(row: { status?: string | null }, tab: string): boolean {
  if (tab === 'all') return true
  const allowed = (ORDER_TAB_STATUSES as Record<string, readonly string[] | undefined>)[tab] ?? []
  return allowed.includes(row.status ?? '')
}

export function orderTabCounts(groups: OrderSummaryGroup[] | undefined): Record<OrderStatusTab, number> {
  const counts = { all: 0, active: 0, completed: 0, cancelled: 0 }
  for (const g of groups ?? []) {
    counts.all += g.count
    for (const tab of ['active', 'completed', 'cancelled'] as const) {
      if (orderRowMatchesTab(g, tab)) counts[tab] += g.count
    }
  }
  return counts
}

export interface OrderCardTotals {
  count: number
  total: number
  avgTicket: number
}

export function orderCardsForTab(groups: OrderSummaryGroup[] | undefined, tab: string): OrderCardTotals {
  let count = 0
  let total = 0
  for (const g of groups ?? []) {
    if (!orderRowMatchesTab(g, tab)) continue
    count += g.count
    total += g.total
  }
  return { count, total, avgTicket: count > 0 ? total / count : 0 }
}
