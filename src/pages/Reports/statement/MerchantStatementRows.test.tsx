import { fireEvent, render, screen, within } from '@testing-library/react'
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

  it('D11: la fila «Cobros en línea» lleva su nombre y el chip «sin fecha estimada»', () => {
    render(
      <MerchantStatementRows
        rows={[
          row({ merchantAccountId: 'a' }),
          row({ merchantAccountId: 'online', kind: 'online', displayName: '', provider: '', payoutStatus: 'noRule', payoutDate: null, netToReceive: 194 }),
        ]}
        formatCurrency={fmt}
      />,
    )
    expect(screen.getAllByText('salesSummary.statement.merchants.online.name').length).toBeGreaterThan(0)
    const chips = screen.getAllByTestId('payout-chip-online')
    expect(chips[0]).toHaveTextContent('salesSummary.statement.merchants.payout.online')
  })

  it('D10: un comercio con devoluciones las enseña aparte de lo cobrado', () => {
    render(<MerchantStatementRows rows={[row({ merchantAccountId: 'r', collectedOnCard: 0, refunds: 30, platformFee: -0.9, netToReceive: -29.1, effectiveRatePct: null })]} formatCurrency={fmt} />)
    const table = screen.getByRole('table')
    expect(within(table).getByText('salesSummary.statement.merchants.cols.refunds')).toBeInTheDocument()
    expect(within(table).getByText('−$30.00')).toBeInTheDocument()
    // Una comisión revertida no pinta «−−$0.90».
    expect(table.textContent).not.toContain('−-')
    expect(within(table).getByText('+$0.90')).toBeInTheDocument()
  })

  it('«Debió caer» con dinero sin fecha dice cuánto; un comercio con reglas y nada proyectable dice «sin fecha», no «sin regla»', () => {
    render(
      <MerchantStatementRows
        rows={[
          row({ merchantAccountId: 'a', payoutStatus: 'landed', payoutDate: '2026-07-01', payoutAmount: 97 }),
          row({ merchantAccountId: 'b', payoutStatus: 'noRule', payoutDate: null, settlementRules: [{ cardType: 'CREDIT', settlementDays: 1 }] }),
        ]}
        formatCurrency={fmt}
      />,
    )
    expect(screen.getAllByTestId('payout-chip-landed')[0]).toHaveTextContent('salesSummary.statement.merchants.payout.landedPartial $97.00')
    expect(screen.getAllByTestId('payout-chip-no-rule')[0]).toHaveTextContent('salesSummary.statement.merchants.payout.online')
  })

  it('un descuento (devolución neta) nunca dice «Cae»', () => {
    render(<MerchantStatementRows rows={[row({ merchantAccountId: 'r', payoutStatus: 'lands', payoutDate: '2026-07-06', payoutIsDeduction: true, netToReceive: -29.1 })]} formatCurrency={fmt} />)
    const chip = screen.getAllByTestId('payout-chip-deduction')[0]
    expect(chip).toHaveTextContent('salesSummary.statement.merchants.payout.landsDeduction')
    expect(screen.queryByTestId('payout-chip-lands')).not.toBeInTheDocument()
  })

  it('🔴 carril F (Codex r2 #6, misma familia) · en escritorio el renglón de un comercio se despliega con teclado', () => {
    render(<MerchantStatementRows rows={[row({ merchantAccountId: 'm1', settlementRules: [{ cardType: 'CREDIT', settlementDays: 1 }] })]} formatCurrency={fmt} />)
    const tabla = screen.getByRole('table')
    const boton = within(tabla).getByRole('button', { name: 'm1' })
    expect(boton).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(boton)
    expect(boton).toHaveAttribute('aria-expanded', 'true')
  })
})

