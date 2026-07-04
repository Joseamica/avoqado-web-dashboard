import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { PayoutTimeline } from './PayoutTimeline'
import type { SettlementCalendarDay } from '@/services/reports/salesSummary.service'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'en' },
  }),
}))
// Desktop path (popover per node) — keeps the render deterministic.
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }))

const fmt = (n: number) => `$${n.toFixed(2)}`
const days: SettlementCalendarDay[] = [
  { date: '2026-06-29', status: 'settled', totalNet: 1757.4, byMerchant: [] },
  { date: '2026-07-09', status: 'projected', totalNet: 13329.3, byMerchant: [] },
]

describe('PayoutTimeline', () => {
  it('returns null when there is nothing to show', () => {
    const { container } = render(<PayoutTimeline days={[]} incoming={0} unprojected={0} formatCurrency={fmt} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('renders a node per day and the incoming total', () => {
    render(<PayoutTimeline days={days} incoming={13329.3} unprojected={0} formatCurrency={fmt} />)
    expect(screen.getByTestId('timeline-day-2026-06-29')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-day-2026-07-09')).toBeInTheDocument()
    expect(screen.getByTestId('timeline-incoming')).toHaveTextContent('$13329.30')
  })

  it('shows the honesty chip only when unprojected money exceeds 1 peso', () => {
    const { rerender } = render(<PayoutTimeline days={days} incoming={0} unprojected={0.5} formatCurrency={fmt} />)
    expect(screen.queryByTestId('timeline-unprojected-chip')).not.toBeInTheDocument()

    rerender(<PayoutTimeline days={days} incoming={0} unprojected={500} formatCurrency={fmt} />)
    expect(screen.getByTestId('timeline-unprojected-chip')).toHaveTextContent('$500.00')
  })

  it('renders even with no days when there is unprojected money to flag', () => {
    render(<PayoutTimeline days={[]} incoming={0} unprojected={900} formatCurrency={fmt} />)
    expect(screen.getByTestId('timeline-unprojected-chip')).toBeInTheDocument()
  })
})
