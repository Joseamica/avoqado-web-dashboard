import type { Order, OrderItem, OrderAction } from '@/types'

export type ActivityEvent =
  | { type: 'created'; timestamp: string; staffName: string | null }
  | { type: 'items_added'; timestamp: string; count: number; items: Array<{ name: string; quantity: number }> }
  | { type: 'action'; timestamp: string; actionType: OrderAction['actionType']; reason: string | null; staffName: string | null }
  | { type: 'payment'; timestamp: string; paymentId: string; amount: number; method: string; cardBrand: string | null }
  | { type: 'refund'; timestamp: string; paymentId: string; amount: number; refundReason: string | null }
  | { type: 'completed'; timestamp: string }

const minuteKey = (iso: string): string => iso.slice(0, 16) // "YYYY-MM-DDTHH:MM"

const staffName = (s?: { firstName?: string; lastName?: string } | null): string | null =>
  s ? `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || null : null

export function buildOrderActivity(order: Order): ActivityEvent[] {
  const events: ActivityEvent[] = []

  // Order created
  events.push({
    type: 'created',
    timestamp: order.createdAt,
    staffName: staffName(order.createdBy),
  })

  // Items added — group by minute
  const itemGroups = new Map<string, OrderItem[]>()
  for (const item of order.items ?? []) {
    if (!item.createdAt) continue
    const key = minuteKey(item.createdAt)
    if (!itemGroups.has(key)) itemGroups.set(key, [])
    itemGroups.get(key)!.push(item)
  }
  for (const [, group] of itemGroups) {
    events.push({
      type: 'items_added',
      timestamp: group[0].createdAt!,
      count: group.length,
      items: group.map(i => ({
        name: i.productName ?? (i as any).product?.name ?? 'Producto',
        quantity: i.quantity ?? 1,
      })),
    })
  }

  // Staff actions (COMP/VOID/etc.)
  for (const action of order.actions ?? []) {
    events.push({
      type: 'action',
      timestamp: action.createdAt,
      actionType: action.actionType,
      reason: action.reason,
      staffName: staffName(action.performedBy),
    })
  }

  // Payments + refunds
  for (const p of order.payments ?? []) {
    const isRefund = (p as any).type === 'REFUND'
    const amount = Number((p as any).amount ?? 0) + Number((p as any).tipAmount ?? 0)
    if (isRefund) {
      events.push({
        type: 'refund',
        timestamp: p.createdAt,
        paymentId: p.id,
        amount,
        refundReason: (p as any).refundReason ?? null,
      })
    } else {
      events.push({
        type: 'payment',
        timestamp: p.createdAt,
        paymentId: p.id,
        amount,
        method: (p as any).method,
        cardBrand: (p as any).cardBrand ?? null,
      })
    }
  }

  // Order completed
  if (order.completedAt) {
    events.push({ type: 'completed', timestamp: order.completedAt })
  }

  // Sort ascending
  return events.sort((a, b) => (a.timestamp < b.timestamp ? -1 : a.timestamp > b.timestamp ? 1 : 0))
}
