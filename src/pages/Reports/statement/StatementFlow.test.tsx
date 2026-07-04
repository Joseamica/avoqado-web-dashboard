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
})
