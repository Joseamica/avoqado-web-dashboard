import { render, screen, fireEvent } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { StatementFlow } from './StatementFlow'
import { deriveStatement } from './derive'
import type { PaymentMethodDetailedBreakdown } from '@/services/reports/salesSummary.service'

// Self-contained i18n: echo the key (+ interpolated values), so assertions don't
// depend on the JSON catalog. Mirrors the repo's established test pattern.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'en' },
  }),
}))

const fmt = (n: number) => `$${n.toFixed(2)}`
const bucket = (b: Partial<PaymentMethodDetailedBreakdown> & { bucket: PaymentMethodDetailedBreakdown['bucket'] }): PaymentMethodDetailedBreakdown => ({
  amount: 0, count: 0, percentage: 0, tips: 0, refunds: 0, platformFees: 0, ...b,
})

const model = (over: Parameters<typeof deriveStatement>[0]) => deriveStatement(over)

describe('StatementFlow', () => {
  it('renders the hero (you keep) and the fee deduction exactly once', () => {
    const m = model({
      buckets: [bucket({ bucket: 'CARD', amount: 1000, count: 4, platformFees: 80 }), bucket({ bucket: 'CASH', amount: 300, count: 2 })],
      merchants: [],
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$1220.00') // 1300 - 80
    expect(screen.getByTestId('statement-collected')).toHaveTextContent('$1300.00')
    expect(screen.getByTestId('statement-fees')).toHaveTextContent('$80.00')
  })

  it('hides the bank row when there is no card activity (all cash)', () => {
    const m = model({ buckets: [bucket({ bucket: 'CASH', amount: 500, count: 3 })], merchants: [], calendar: [], todayKey: '2026-07-04' })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-cash-row')).toBeInTheDocument()
    expect(screen.queryByTestId('statement-bank-row')).not.toBeInTheDocument()
  })

  it('reveals card sub-buckets on toggle', () => {
    const m = model({
      buckets: [
        bucket({ bucket: 'CARD', amount: 1000, count: 4, platformFees: 40, subBuckets: [{ type: 'CREDIT', amount: 600, count: 2, percentage: 60, platformFees: 24 }, { type: 'DEBIT', amount: 400, count: 2, percentage: 40, platformFees: 16 }] }),
      ],
      merchants: [],
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    // Collapsed by default.
    expect(screen.queryByText('salesSummary.controls.filterBy.cardType.options.credit')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('statement-card-detail-toggle'))
    expect(screen.getByText('salesSummary.controls.filterBy.cardType.options.credit')).toBeInTheDocument()
  })

  it('D10: la devolución es su propio renglón, ningún % negativo, y la comisión revertida no pinta «−−»', () => {
    const m = model({
      buckets: [
        bucket({ bucket: 'CASH', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1 }),
        bucket({ bucket: 'CARD', amount: -30, count: 1, refunds: 30, platformFees: -0.9, chargedAmount: 0, chargedCount: 0 }),
      ],
      merchants: [
        { merchantAccountId: 'r', displayName: 'R', provider: 'P', affiliation: null, collectedOnCard: -30, refunds: 30, refundCount: 1, platformFee: -0.9, netToReceive: -29.1, transactionCount: 1 },
      ],
      calendar: [],
      todayKey: '2026-07-04',
    })
    const { container } = render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-collected')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('statement-refunds')).toHaveTextContent('−$30.00')
    expect(screen.getByTestId('statement-fees')).toHaveTextContent('+$0.90')
    expect(screen.getByTestId('statement-fees').textContent).not.toContain('−')
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$70.90')
    expect(container.textContent).not.toMatch(/-\d+(\.\d+)?%/)
    expect(container.textContent).not.toContain('142.9')
    // El banco sólo tuvo la devolución: se dice que se descuenta, con lo que ya trae de devoluciones.
    expect(screen.getByTestId('statement-bank-row')).toHaveTextContent('salesSummary.statement.flow.bankRowNegative')
    expect(screen.getByTestId('statement-bank-refunds')).toHaveTextContent('$30.00')
  })

  it('D10: la devolución de una cuenta cancelada dice en una línea por qué difiere de las ventas', () => {
    const m = model({
      buckets: [bucket({ bucket: 'OTHER', amount: -250, count: 1, refunds: 250, chargedAmount: 0, chargedCount: 0, cancelledOrderRefunds: 250 })],
      merchants: [],
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-cancelled-refunds')).toHaveTextContent('salesSummary.statement.flow.cancelledRefunds $250.00')
  })

  it('D1: la comisión de plataformas y tipos de pago propios es un renglón aparte de las de Avoqado', () => {
    const m = model({
      buckets: [
        bucket({ bucket: 'OTHER', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1, tenderCommissions: 30 }),
        bucket({ bucket: 'CASH', amount: 50, count: 1, chargedAmount: 50, chargedCount: 1 }),
      ],
      merchants: [],
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-tender-commissions')).toHaveTextContent('−$30.00')
    expect(screen.getByTestId('statement-fees')).toHaveTextContent('$0.00')
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$120.00')
    // Uber deposita aparte: «Otros» queda entero y la comisión se resta en su propio renglón también abajo.
    expect(screen.getByTestId('statement-other-row')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('statement-tender-row')).toHaveTextContent('−$30.00')
  })

  it('sin devoluciones ni comisión de terceros no pinta esos renglones', () => {
    const m = model({ buckets: [bucket({ bucket: 'CASH', amount: 500, count: 3, chargedAmount: 500, chargedCount: 3 })], merchants: [], calendar: [], todayKey: '2026-07-04' })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.queryByTestId('statement-refunds')).not.toBeInTheDocument()
    expect(screen.queryByTestId('statement-tender-commissions')).not.toBeInTheDocument()
    expect(screen.queryByTestId('statement-cancelled-refunds')).not.toBeInTheDocument()
  })

  it('con los destinos del SERVIDOR: una devolución en efectivo sin cobros hoy se ve como salida de la caja', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      buckets: [bucket({ bucket: 'CASH', amount: -30, count: 1, refunds: 30, chargedAmount: 0, chargedCount: 0 })],
      merchants: [],
      destinations: { drawer: d({ collected: -30, refunds: 30, refundCount: 1, netToReceive: -30, transactionCount: 1 }), terminal: d(), online: d(), other: d(), tenderCommissions: 0 },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$-30.00')
    expect(screen.getByTestId('statement-cash-row')).toHaveTextContent('$-30.00')
    expect(screen.getByTestId('statement-refunds')).toHaveTextContent('−$30.00')
  })

  it('con los destinos del SERVIDOR: el efectivo de un pedido de Rappi queda entero y la comisión va aparte', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      buckets: [bucket({ bucket: 'CASH', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1, tenderCommissions: 30 })],
      merchants: [],
      destinations: { drawer: d({ collected: 100, netToReceive: 100, transactionCount: 1 }), terminal: d(), online: d(), other: d(), tenderCommissions: 30 },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-cash-row')).toHaveTextContent('$100.00')
    expect(screen.getByTestId('statement-tender-row')).toHaveTextContent('−$30.00')
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$70.00')
  })

  it('con los destinos del SERVIDOR: un OXXO viejo guardado como efectivo pero de Avoqado no está en caja sino en el banco', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      buckets: [bucket({ bucket: 'CASH', amount: 120, count: 1, platformFees: 4, chargedAmount: 120, chargedCount: 1 })],
      merchants: [],
      destinations: { drawer: d(), terminal: d(), online: d({ collected: 120, platformFee: 4, netToReceive: 116, transactionCount: 1 }), other: d(), tenderCommissions: 0 },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    // Sin destinos (servidor viejo) estos $120 saldrían en «Ya en tu mano»: aquí no.
    expect(screen.queryByTestId('statement-cash-row')).not.toBeInTheDocument()
    expect(screen.getByTestId('statement-bank-row')).toHaveTextContent('$116.00')
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$116.00')
  })

  it('D12.3: «Otros métodos» se abre por tipo de pago, con su nombre y la comisión de la plataforma', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      buckets: [bucket({ bucket: 'OTHER', amount: 150, count: 2, chargedAmount: 150, chargedCount: 2, tenderCommissions: 30 })],
      merchants: [],
      destinations: {
        drawer: d(),
        terminal: d(),
        online: d(),
        other: d({ collected: 150, netToReceive: 150, transactionCount: 2 }),
        tenderCommissions: 30,
        otherByType: [
          { key: 't-uber', label: 'Uber Eats', method: 'OTHER', ...d({ collected: 100, netToReceive: 100, transactionCount: 1 }), tenderCommissions: 30 },
          { key: 'BANK_TRANSFER', label: null, method: 'BANK_TRANSFER', ...d({ collected: 50, netToReceive: 50, transactionCount: 1 }), tenderCommissions: 0 },
        ],
      },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.queryByTestId('statement-other-types')).not.toBeInTheDocument()
    fireEvent.click(screen.getByTestId('statement-other-toggle'))
    const lista = screen.getByTestId('statement-other-types')
    expect(lista).toHaveTextContent('Uber Eats')
    expect(lista).toHaveTextContent('$100.00')
    expect(lista).toHaveTextContent('salesSummary.statement.flow.otherTypeCommission −$30.00')
    expect(lista).toHaveTextContent('salesSummary.statement.flow.otherTypes.BANK_TRANSFER')
  })

  it('D12.3: con neto $0 en «Otros» (una venta de terminal externa devuelta entera) el desglose sigue a la vista', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      buckets: [bucket({ bucket: 'CARD', amount: 0, count: 2, chargedAmount: 100, chargedCount: 1 })],
      merchants: [],
      destinations: {
        drawer: d(),
        terminal: d(),
        online: d(),
        other: d({ collected: 0, refunds: 100, refundCount: 1, transactionCount: 2 }),
        tenderCommissions: 0,
        otherByType: [{ key: 'CARD', label: null, method: 'CARD', ...d({ collected: 0, refunds: 100, refundCount: 1, transactionCount: 2 }), tenderCommissions: 0 }],
      },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-other-toggle')).toBeInTheDocument()
  })

  it('D17: los cobros en otra moneda se dicen en su moneda y no entran a las cuentas en pesos', () => {
    const d = (o: Record<string, number> = {}) => ({ collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0, ...o })
    const m = model({
      // El cajón de tarjeta trae la liga en dólares (US$80) en su movimiento de siempre; lo cobrado en pesos es 0.
      buckets: [
        bucket({ bucket: 'CASH', amount: 100, count: 1, chargedAmount: 100, chargedCount: 1 }),
        bucket({ bucket: 'CARD', amount: 80, count: 2, chargedAmount: 0, chargedCount: 0, foreignAmount: 80, foreignCount: 2, platformFees: 4 }),
      ],
      merchants: [],
      destinations: { drawer: d({ collected: 100, netToReceive: 100, transactionCount: 1 }), terminal: d(), online: d(), other: d(), tenderCommissions: 0, foreignCurrency: [{ currency: 'USD', net: 80, transactionCount: 1, refundCount: 1 }] },
      calendar: [],
      todayKey: '2026-07-04',
    })
    render(<StatementFlow model={m} formatCurrency={fmt} />)
    expect(screen.getByTestId('statement-foreign-currency')).toHaveTextContent('USD 80.00')
    expect(screen.getByTestId('statement-foreign-currency')).toHaveTextContent('salesSummary.statement.flow.foreignCurrencyRefunds 1')
    expect(screen.getByTestId('statement-collected')).toHaveTextContent('$100.00')
    expect(screen.queryByTestId('statement-refunds')).not.toBeInTheDocument()
    expect(screen.getByTestId('statement-hero-net')).toHaveTextContent('$100.00')
  })
})
