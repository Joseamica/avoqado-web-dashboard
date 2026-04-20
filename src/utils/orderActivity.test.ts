import { describe, expect, it } from 'vitest'
import { buildOrderActivity } from './orderActivity'
import type { Order } from '@/types'

const baseOrder = (overrides: Partial<Order> = {}): Order =>
  ({
    id: 'o1',
    orderNumber: 'ORD-1',
    createdAt: '2026-04-17T11:00:00.000Z',
    completedAt: null,
    items: [],
    payments: [],
    actions: [],
    createdBy: { id: 's1', firstName: 'Grace', lastName: 'APM' },
    ...overrides,
  } as any)

describe('buildOrderActivity', () => {
  it('emits a "created" event from order.createdAt', () => {
    const events = buildOrderActivity(baseOrder())
    expect(events[0].type).toBe('created')
    expect(events[0].timestamp).toBe('2026-04-17T11:00:00.000Z')
  })

  it('groups items added in the same minute into a single event', () => {
    const events = buildOrderActivity(
      baseOrder({
        items: [
          { id: 'i1', createdAt: '2026-04-17T11:05:10.000Z', productName: 'A', quantity: 1 } as any,
          { id: 'i2', createdAt: '2026-04-17T11:05:30.000Z', productName: 'B', quantity: 2 } as any,
        ],
      } as any),
    )
    const itemEvents = events.filter(e => e.type === 'items_added')
    expect(itemEvents).toHaveLength(1)
    expect((itemEvents[0] as any).count).toBe(2)
  })

  it('emits separate "items_added" events for items added in different minutes', () => {
    const events = buildOrderActivity(
      baseOrder({
        items: [
          { id: 'i1', createdAt: '2026-04-17T11:05:00.000Z', productName: 'A', quantity: 1 } as any,
          { id: 'i2', createdAt: '2026-04-17T11:08:00.000Z', productName: 'B', quantity: 1 } as any,
        ],
      } as any),
    )
    const itemEvents = events.filter(e => e.type === 'items_added')
    expect(itemEvents).toHaveLength(2)
  })

  it('emits "payment" events for non-refund payments', () => {
    const events = buildOrderActivity(
      baseOrder({
        payments: [
          {
            id: 'p1',
            type: 'REGULAR',
            method: 'CREDIT_CARD',
            cardBrand: 'VISA',
            amount: 50,
            tipAmount: 0,
            createdAt: '2026-04-17T11:10:00.000Z',
          } as any,
        ],
      } as any),
    )
    const paymentEvents = events.filter(e => e.type === 'payment')
    expect(paymentEvents).toHaveLength(1)
    expect((paymentEvents[0] as any).amount).toBe(50)
  })

  it('emits "refund" events for refund payments', () => {
    const events = buildOrderActivity(
      baseOrder({
        payments: [
          {
            id: 'p2',
            type: 'REFUND',
            method: 'CREDIT_CARD',
            amount: -25,
            tipAmount: 0,
            refundReason: 'Cliente insatisfecho',
            createdAt: '2026-04-17T11:35:00.000Z',
          } as any,
        ],
      } as any),
    )
    const refundEvents = events.filter(e => e.type === 'refund')
    expect(refundEvents).toHaveLength(1)
    expect((refundEvents[0] as any).refundReason).toBe('Cliente insatisfecho')
  })

  it('emits action events from order.actions[]', () => {
    const events = buildOrderActivity(
      baseOrder({
        actions: [
          {
            id: 'a1',
            actionType: 'COMP',
            reason: 'Comp por error',
            performedBy: { firstName: 'Jose', lastName: 'A' },
            createdAt: '2026-04-17T11:15:00.000Z',
          } as any,
        ],
      } as any),
    )
    const actionEvents = events.filter(e => e.type === 'action')
    expect(actionEvents).toHaveLength(1)
    expect((actionEvents[0] as any).actionType).toBe('COMP')
  })

  it('emits "completed" event when order.completedAt is set', () => {
    const events = buildOrderActivity(baseOrder({ completedAt: '2026-04-17T12:00:00.000Z' } as any))
    expect(events.some(e => e.type === 'completed')).toBe(true)
  })

  it('returns events sorted ascending by timestamp', () => {
    const events = buildOrderActivity(
      baseOrder({
        completedAt: '2026-04-17T12:00:00.000Z',
        payments: [
          { id: 'p1', type: 'REGULAR', method: 'CASH', amount: 10, tipAmount: 0, createdAt: '2026-04-17T11:30:00.000Z' } as any,
        ],
      } as any),
    )
    const ts = events.map(e => e.timestamp)
    const sorted = [...ts].sort()
    expect(ts).toEqual(sorted)
  })
})
