import { describe, expect, it } from 'vitest'
import { deriveStatement } from './derive'
import type {
  MerchantAccountBreakdown,
  MoneyDestination,
  PaymentMethodDetailedBreakdown,
  SettlementCalendarDay,
  StatementDestinations,
} from '@/services/reports/salesSummary.service'

const bucket = (b: Partial<PaymentMethodDetailedBreakdown> & { bucket: PaymentMethodDetailedBreakdown['bucket'] }): PaymentMethodDetailedBreakdown => ({
  amount: 0,
  count: 0,
  percentage: 0,
  tips: 0,
  refunds: 0,
  platformFees: 0,
  ...b,
})

const merchant = (m: Partial<MerchantAccountBreakdown> & { merchantAccountId: string }): MerchantAccountBreakdown => ({
  displayName: m.merchantAccountId,
  provider: 'Test',
  affiliation: null,
  collectedOnCard: 0,
  platformFee: 0,
  netToReceive: 0,
  transactionCount: 0,
  ...m,
})

const TODAY = '2026-07-04'

describe('deriveStatement', () => {
  it('commissions is the single sum of every bucket platformFees (card + other)', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 }),
        bucket({ bucket: 'OTHER', amount: 200, platformFees: 5 }),
        bucket({ bucket: 'CASH', amount: 300 }),
      ],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.commissions).toBe(85)
    expect(m.collectedTotal).toBe(1500)
  })

  it('reconciles youKeep = cash + cardNet + other.net', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 }),
        bucket({ bucket: 'OTHER', amount: 200, platformFees: 5 }),
        bucket({ bucket: 'CASH', amount: 300 }),
      ],
      merchants: [merchant({ merchantAccountId: 'a', collectedOnCard: 1000, platformFee: 80, netToReceive: 920 })],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.youKeep).toBeCloseTo(m.cash.amount + m.cardNet + m.other.net, 5)
    expect(m.youKeep).toBe(1500 - 85)
  })

  it('falls back to the CARD bucket net when byMerchantAccount is absent', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 })],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(920)
  })

  it('prefers the per-merchant net sum over the bucket when merchants exist', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 80 })],
      merchants: [
        merchant({ merchantAccountId: 'a', netToReceive: 500 }),
        merchant({ merchantAccountId: 'b', netToReceive: 420 }),
      ],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(920)
  })

  it('unprojected fires only when card money exceeds the calendar total by > 1 peso', () => {
    const base = {
      buckets: [bucket({ bucket: 'CARD', amount: 1000, platformFees: 0 })],
      merchants: [merchant({ merchantAccountId: 'a', netToReceive: 1000 })],
      todayKey: TODAY,
    }
    const projected = deriveStatement({
      ...base,
      calendar: [{ date: '2026-07-06', status: 'projected', totalNet: 999.5, byMerchant: [] }],
    })
    expect(projected.unprojected).toBeCloseTo(0.5, 5) // ≤ 1 → UI hides the chip

    const gap = deriveStatement({
      ...base,
      calendar: [{ date: '2026-07-06', status: 'projected', totalNet: 400, byMerchant: [] }],
    })
    expect(gap.unprojected).toBe(600) // > 1 → chip shows
  })

  it('sorts calendar days ascending and computes incoming from non-settled days', () => {
    const cal: SettlementCalendarDay[] = [
      { date: '2026-07-08', status: 'projected', totalNet: 300, byMerchant: [] },
      { date: '2026-07-02', status: 'settled', totalNet: 100, byMerchant: [] },
      { date: '2026-07-05', status: 'pending', totalNet: 200, byMerchant: [] },
    ]
    const m = deriveStatement({ buckets: [], merchants: [], calendar: cal, todayKey: TODAY })
    expect(m.days.map(d => d.date)).toEqual(['2026-07-02', '2026-07-05', '2026-07-08'])
    expect(m.incoming).toBe(500) // pending + projected, not settled
    expect(m.lastDepositDate).toBe('2026-07-08')
  })

  it('computes effective rate and payout status per merchant', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [
        merchant({ merchantAccountId: 'past', collectedOnCard: 100, platformFee: 8, netToReceive: 92, estimatedSettlement: { nextDate: '2026-07-01', settlementDays: 1 } }),
        merchant({ merchantAccountId: 'future', collectedOnCard: 200, platformFee: 8, netToReceive: 192, estimatedSettlement: { nextDate: '2026-07-09', settlementDays: 1 } }),
        merchant({ merchantAccountId: 'norule', collectedOnCard: 0, platformFee: 0, netToReceive: 0 }),
      ],
      calendar: [],
      todayKey: TODAY,
    })
    const [past, future, norule] = m.merchants
    expect(past.effectiveRatePct).toBeCloseTo(8, 5)
    expect(past.payoutStatus).toBe('landed')
    expect(future.payoutStatus).toBe('lands')
    expect(norule.effectiveRatePct).toBeNull() // no collection → no rate
    expect(norule.payoutStatus).toBe('noRule')
  })

  it('handles all-cash (no card activity) without producing a phantom chip', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CASH', amount: 500, count: 3 })],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(0)
    expect(m.hasCardActivity).toBe(false)
    expect(m.unprojected).toBe(0)
    expect(m.segments).toHaveLength(1)
    expect(m.segments[0].key).toBe('cash')
    expect(m.segments[0].pct).toBe(100)
  })

  it('attaches each merchant its calendar deposit slices', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'a', netToReceive: 92 })],
      calendar: [
        { date: '2026-07-06', status: 'projected', totalNet: 92, byMerchant: [{ merchantAccountId: 'a', displayName: 'A', platformFee: 8, netToReceive: 92, transactionCount: 1 }] },
      ],
      todayKey: TODAY,
    })
    expect(m.merchants[0].deposits).toEqual([{ date: '2026-07-06', status: 'projected', platformFee: 8, netToReceive: 92 }])
  })

  it("payout=next when money is estimated across several days: shows only the NEXT upcoming slice (amount+date)", () => {
    // 3 slices around today (2026-07-04): two past (should-have-landed) + one upcoming.
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'x', netToReceive: 300, estimatedSettlement: { nextDate: '2026-07-06', settlementDays: 1 } })],
      calendar: [
        { date: '2026-07-01', status: 'settled', totalNet: 60, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 4, netToReceive: 60, transactionCount: 1 }] },
        { date: '2026-07-03', status: 'settled', totalNet: 40, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 40, transactionCount: 1 }] },
        { date: '2026-07-06', status: 'projected', totalNet: 200, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 8, netToReceive: 200, transactionCount: 1 }] },
      ],
      todayKey: TODAY,
    })
    const row = m.merchants[0]
    expect(row.payoutStatus).toBe('next')
    expect(row.payoutDate).toBe('2026-07-06') // the soonest UPCOMING slice, not the full net's single date
    expect(row.payoutAmount).toBe(200) // only that slice (< netToReceive 300)
  })

  it('payout stays a single date (lands/landed, amount null) when a merchant lands on ONE day', () => {
    const single = (nextDate: string, date: string) =>
      deriveStatement({
        buckets: [],
        merchants: [merchant({ merchantAccountId: 'x', netToReceive: 200, estimatedSettlement: { nextDate, settlementDays: 1 } })],
        calendar: [{ date, status: 'projected', totalNet: 200, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 8, netToReceive: 200, transactionCount: 1 }] }],
        todayKey: TODAY,
      }).merchants[0]

    const future = single('2026-07-09', '2026-07-09')
    expect(future.payoutStatus).toBe('lands')
    expect(future.payoutAmount).toBeNull()

    const past = single('2026-07-01', '2026-07-01')
    expect(past.payoutStatus).toBe('landed')
    expect(past.payoutAmount).toBeNull()
  })

  it('trusts the calendar slices over a disagreeing backend nextDate (no future flip on all-past slices)', () => {
    // All slices are past, but the backend's single estimate points to a FUTURE date
    // (e.g. clock skew or a stale nextDate). The chip must follow the slices — the same
    // data the strip/expand show — not flip to a future "Cae".
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'x', netToReceive: 100, estimatedSettlement: { nextDate: '2026-07-20', settlementDays: 1 } })],
      calendar: [
        { date: '2026-07-01', status: 'settled', totalNet: 60, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 4, netToReceive: 60, transactionCount: 1 }] },
        { date: '2026-07-02', status: 'settled', totalNet: 40, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 40, transactionCount: 1 }] },
      ],
      todayKey: TODAY, // 2026-07-04 → both slices past
    })
    expect(m.merchants[0].payoutStatus).toBe('landed') // NOT 'lands' from nextDate 2026-07-20
    expect(m.merchants[0].payoutDate).toBe('2026-07-02') // last slice, not the backend date
  })
})

/**
 * Carril C (21-nov-2026): devoluciones del día (D10.2), cobros en línea (D11), filtro por comercio (D9.2) y comisión de
 * plataformas o tipos de pago propios (D1). La identidad que pinta la pantalla se prueba al centavo:
 * «Te queda» = efectivo + banco + otros − comisión de terceros = cobrado − devoluciones − comisiones − comisión de terceros.
 */
describe('deriveStatement — devoluciones, en línea y comisión de terceros', () => {
  const cents = (n: number) => Math.round(n * 100)
  const dest = (over: Partial<MoneyDestination> = {}): MoneyDestination => ({
    collected: 0,
    refunds: 0,
    refundCount: 0,
    platformFee: 0,
    netToReceive: 0,
    transactionCount: 0,
    ...over,
  })
  const destinations = (over: Partial<StatementDestinations> = {}): StatementDestinations => ({
    drawer: dest(),
    terminal: dest(),
    online: dest(),
    other: dest(),
    tenderCommissions: 0,
    ...over,
  })
  const expectIdentity = (m: ReturnType<typeof deriveStatement>) => {
    expect(cents(m.cash.amount + m.cardNet + m.other.net - m.tenderCommissions)).toBe(cents(m.youKeep))
    expect(cents(m.collectedTotal - m.refunds.amount - m.commissions - m.tenderCommissions)).toBe(cents(m.youKeep))
    for (const s of m.segments) {
      expect(s.pct).toBeGreaterThanOrEqual(0)
      expect(s.pct).toBeLessThanOrEqual(100)
      expect(s.amount).toBeGreaterThan(0)
    }
  }

  it('D10: $100 en efectivo y $30 devueltos a tarjeta de ayer — la devolución es su renglón, no un % negativo', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CASH', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1 }),
        bucket({ bucket: 'CARD', amount: -30, count: 1, refunds: 30, platformFees: -0.9, chargedAmount: 0, chargedCount: 0 }),
      ],
      merchants: [
        merchant({ merchantAccountId: 'r', collectedOnCard: -30, refunds: 30, refundCount: 1, platformFee: -0.9, netToReceive: -29.1, transactionCount: 1 }),
      ],
      destinations: destinations({
        drawer: dest({ collected: 100, netToReceive: 100, transactionCount: 1 }),
        terminal: dest({ collected: -30, refunds: 30, refundCount: 1, platformFee: -0.9, netToReceive: -29.1, transactionCount: 1 }),
      }),
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.collectedTotal).toBe(100)
    expect(m.collectedCount).toBe(1)
    expect(m.refunds).toEqual({ amount: 30, count: 1 })
    expect(m.commissions).toBe(-0.9)
    expect(m.youKeep).toBe(70.9)
    expect(m.segments.map(s => [s.key, s.amount, s.count, s.pct])).toEqual([['cash', 100, 1, 100]])
    expect(m.cash.amount).toBe(100)
    expect(m.cardNet).toBe(-29.1)
    expect(m.bankRefunds).toBe(30)
    expect(m.other.net).toBe(0)
    // El comercio: lo cobrado HOY ($0) aparte de lo devuelto; la devolución no cuenta como transacción.
    const [r] = m.merchants
    expect([r.collectedOnCard, r.refunds, r.transactionCount, r.netToReceive]).toEqual([0, 30, 0, -29.1])
    expect(r.effectiveRatePct).toBeNull()
    expectIdentity(m)
  })

  it('D10 con un servidor viejo (sin campos nuevos): mismo «Te queda», nada negativo en la barra', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'CASH', amount: 100, count: 1 }),
        bucket({ bucket: 'CARD', amount: -30, count: 1, refunds: 30, platformFees: -0.9 }),
      ],
      merchants: [merchant({ merchantAccountId: 'r', collectedOnCard: -30, platformFee: -0.9, netToReceive: -29.1, transactionCount: 1 })],
      calendar: [],
      todayKey: TODAY,
    })
    expect(cents(m.youKeep)).toBe(7090)
    expect(m.collectedTotal).toBe(100)
    expect(m.collectedCount).toBe(1)
    expect(m.refunds.amount).toBe(30)
    expect(m.segments.map(s => s.key)).toEqual(['cash'])
    expectIdentity(m)
  })

  it('D10: la devolución de una cuenta CANCELADA se cuenta aparte para explicar la diferencia con las ventas', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'OTHER', amount: -250, count: 1, refunds: 250, chargedAmount: 0, chargedCount: 0, cancelledOrderRefunds: 250 })],
      merchants: [],
      destinations: destinations({ other: dest({ collected: -250, refunds: 250, refundCount: 1, netToReceive: -250, transactionCount: 1 }) }),
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cancelledOrderRefunds).toBe(250)
    expect(m.collectedTotal).toBe(0)
    expect(m.refunds.amount).toBe(250)
    expect(m.youKeep).toBe(-250)
    expect(m.segments).toEqual([])
    expectIdentity(m)
  })

  it('D11: terminal $97 + pedido en línea $194 ⇒ Te queda $291 = Llega a tu banco $291, con la fila «en línea»', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 300, count: 2, platformFees: 9, chargedAmount: 300, chargedCount: 2 })],
      merchants: [merchant({ merchantAccountId: 'a', collectedOnCard: 100, platformFee: 3, netToReceive: 97, transactionCount: 1, unprojectedNet: 0 })],
      destinations: destinations({
        terminal: dest({ collected: 100, platformFee: 3, netToReceive: 97, transactionCount: 1 }),
        online: dest({ collected: 200, platformFee: 6, netToReceive: 194, transactionCount: 1 }),
      }),
      calendar: [
        { date: '2026-07-06', status: 'projected', totalNet: 97, byMerchant: [{ merchantAccountId: 'a', displayName: 'A', platformFee: 3, netToReceive: 97, transactionCount: 1 }] },
      ],
      todayKey: TODAY,
    })
    expect(m.youKeep).toBe(291)
    expect(m.cardNet).toBe(291)
    expect(m.other.net).toBe(0)
    expect(m.commissions).toBe(9)
    expect(m.hasCardActivity).toBe(true)
    // La fila «Cobros en línea» va con los comercios, sin fecha estimada (su propio chip); la nota «sin fecha» es de comercios.
    expect(m.merchants.map(r => [r.kind ?? 'merchant', r.netToReceive, r.payoutStatus])).toEqual([
      ['merchant', 97, 'lands'],
      ['online', 194, 'noRule'],
    ])
    expect(m.unprojected).toBe(0)
    expectIdentity(m)
  })

  it('D11 con un servidor viejo (sin destinos): las cifras de antes', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 300, count: 2, platformFees: 9 })],
      merchants: [merchant({ merchantAccountId: 'a', collectedOnCard: 100, platformFee: 3, netToReceive: 97, transactionCount: 1 })],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(97)
    expect(m.youKeep).toBe(291)
    expect(m.merchants).toHaveLength(1)
  })

  it('D1: Uber $100 con su 30 % ⇒ renglón propio; «Otros» y el efectivo quedan enteros', () => {
    const m = deriveStatement({
      buckets: [
        bucket({ bucket: 'OTHER', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1, tenderCommissions: 30 }),
        bucket({ bucket: 'CASH', amount: 50, count: 1, chargedAmount: 50, chargedCount: 1 }),
      ],
      merchants: [],
      destinations: destinations({
        drawer: dest({ collected: 50, netToReceive: 50, transactionCount: 1 }),
        other: dest({ collected: 100, netToReceive: 100, transactionCount: 1 }),
        tenderCommissions: 30,
      }),
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.tenderCommissions).toBe(30)
    expect(m.commissions).toBe(0)
    expect(m.youKeep).toBe(120)
    expect(m.cash.amount).toBe(50)
    expect(m.other.net).toBe(100)
    expectIdentity(m)
  })

  it('D9.2: con un comercio elegido el estado cuadra sólo con ese comercio', () => {
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 100, count: 1, platformFees: 3, chargedAmount: 100, chargedCount: 1 })],
      merchants: [merchant({ merchantAccountId: 'a', collectedOnCard: 100, platformFee: 3, netToReceive: 97, transactionCount: 1 })],
      destinations: destinations({ terminal: dest({ collected: 100, platformFee: 3, netToReceive: 97, transactionCount: 1 }) }),
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.youKeep).toBe(97)
    expect(m.cardNet).toBe(97)
    expect(m.other.net).toBe(0)
    expectIdentity(m)
  })

  it('las comisiones que redondean distinto por comercio no inventan un centavo: «Comisiones» cierra al de las filas', () => {
    // Dos cobros de $21 con $0.5355 de comisión cada uno, uno por comercio: cada fila $20.46, banco $40.92.
    const m = deriveStatement({
      buckets: [bucket({ bucket: 'CARD', amount: 42, count: 2, platformFees: 1.071, chargedAmount: 42, chargedCount: 2 })],
      merchants: [
        merchant({ merchantAccountId: 'a', collectedOnCard: 21, platformFee: 0.54, netToReceive: 20.46, transactionCount: 1 }),
        merchant({ merchantAccountId: 'b', collectedOnCard: 21, platformFee: 0.54, netToReceive: 20.46, transactionCount: 1 }),
      ],
      destinations: destinations({ terminal: dest({ collected: 42, platformFee: 1.07, netToReceive: 40.93, transactionCount: 2 }) }),
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardNet).toBe(40.92)
    expect(m.youKeep).toBe(40.92)
    expect(m.commissions).toBe(1.08)
    expectIdentity(m)
  })

  it('un comercio con dinero sin fecha no dice «Cae» como si cayera todo: enseña sólo el próximo depósito', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'x', netToReceive: 297, unprojectedNet: 200 })],
      calendar: [{ date: '2026-07-06', status: 'projected', totalNet: 97, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 97, transactionCount: 1 }] }],
      todayKey: TODAY,
    })
    expect([m.merchants[0].payoutStatus, m.merchants[0].payoutAmount]).toEqual(['next', 97])
    expect(m.unprojected).toBe(200)
  })

  it('una devolución sin costo todavía (o centavos sin fecha) tampoco deja «Cae» junto al neto completo', () => {
    const cal = [{ date: '2026-07-06', status: 'projected' as const, totalNet: 97, byMerchant: [{ merchantAccountId: 'x', displayName: 'X', platformFee: 3, netToReceive: 97, transactionCount: 1 }] }]
    for (const unprojectedNet of [-30, 0.75]) {
      const m = deriveStatement({ buckets: [], merchants: [merchant({ merchantAccountId: 'x', netToReceive: 97 + unprojectedNet, unprojectedNet })], calendar: cal, todayKey: TODAY })
      expect([m.merchants[0].payoutStatus, m.merchants[0].payoutAmount]).toEqual(['next', 97])
    }
  })

  it('la nota «sin fecha» suma por comercio: la devolución sin costo de uno no esconde lo de otro', () => {
    const m = deriveStatement({
      buckets: [],
      merchants: [merchant({ merchantAccountId: 'a', unprojectedNet: 200 }), merchant({ merchantAccountId: 'b', unprojectedNet: -200 })],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.unprojected).toBe(200)
  })

  it('el detalle por tipo de tarjeta usa lo cobrado: una sub-caja que sólo tuvo devoluciones no sale', () => {
    const m = deriveStatement({
      buckets: [
        bucket({
          bucket: 'CARD',
          amount: 70,
          count: 2,
          chargedAmount: 100,
          chargedCount: 1,
          subBuckets: [
            { type: 'CREDIT', amount: 100, count: 1, percentage: 142.9, platformFees: 3, chargedAmount: 100, chargedCount: 1 },
            { type: 'DEBIT', amount: -30, count: 1, percentage: -42.9, platformFees: 0, chargedAmount: 0, chargedCount: 0 },
          ],
        }),
      ],
      merchants: [],
      calendar: [],
      todayKey: TODAY,
    })
    expect(m.cardSubs.map(s => [s.type, s.amount, s.count, s.pct])).toEqual([['CREDIT', 100, 1, 100]])
  })
})
