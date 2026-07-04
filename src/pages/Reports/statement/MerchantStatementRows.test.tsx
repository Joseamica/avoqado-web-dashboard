import { render, screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MerchantStatementRows } from './MerchantStatementRows'
import type { MerchantStatementRowModel } from './types'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'en' },
  }),
}))

const fmt = (n: number) => `$${n.toFixed(2)}`

const row = (over: Partial<MerchantStatementRowModel> & { merchantAccountId: string }): MerchantStatementRowModel => ({
  displayName: over.merchantAccountId,
  provider: 'Blumon PAX',
  affiliation: null,
  collectedOnCard: 1000,
  platformFee: 36,
  netToReceive: 964,
  transactionCount: 3,
  effectiveRatePct: 3.6,
  shareOfNetPct: 100,
  payoutStatus: 'lands',
  payoutDate: '2026-07-09',
  payoutAmount: null,
  deposits: [],
  ...over,
})

describe('MerchantStatementRows', () => {
  it('renders nothing with no rows', () => {
    const { container } = render(<MerchantStatementRows rows={[]} formatCurrency={fmt} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('picks the payout chip by status', () => {
    render(
      <MerchantStatementRows
        rows={[
          row({ merchantAccountId: 'a', payoutStatus: 'lands', payoutDate: '2026-07-09' }),
          row({ merchantAccountId: 'b', payoutStatus: 'landed', payoutDate: '2026-06-29' }),
          row({ merchantAccountId: 'c', payoutStatus: 'noRule', payoutDate: null }),
          row({ merchantAccountId: 'd', payoutStatus: 'next', payoutDate: '2026-07-06', payoutAmount: 200 }),
        ]}
        formatCurrency={fmt}
      />,
    )
    expect(screen.getAllByTestId('payout-chip-lands').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('payout-chip-landed').length).toBeGreaterThan(0)
    expect(screen.getAllByTestId('payout-chip-no-rule').length).toBeGreaterThan(0)
    // 'next' chip renders the interpolated amount ($200.00) — only the upcoming slice.
    const nextChips = screen.getAllByTestId('payout-chip-next')
    expect(nextChips.length).toBeGreaterThan(0)
    expect(nextChips[0].textContent).toContain('$200.00')
  })

  it('hides the Share column when there is only one merchant', () => {
    render(<MerchantStatementRows rows={[row({ merchantAccountId: 'solo' })]} formatCurrency={fmt} />)
    expect(screen.queryByText('salesSummary.statement.merchants.cols.share')).not.toBeInTheDocument()
  })

  it('shows the effective rate alongside the fee', () => {
    render(<MerchantStatementRows rows={[row({ merchantAccountId: 'a', platformFee: 36, effectiveRatePct: 3.6 })]} formatCurrency={fmt} />)
    // Desktop table cell: "−$36.00 · 3.6%"
    const table = screen.getByRole('table')
    expect(within(table).getByText(/3\.6%/)).toBeInTheDocument()
  })
})
