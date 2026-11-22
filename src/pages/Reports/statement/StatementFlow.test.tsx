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
})
