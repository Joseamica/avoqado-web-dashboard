import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { MerchantBreakdownPanel } from './MerchantBreakdownPanel'
import type { MerchantAccountBreakdown } from '@/services/reports/salesSummary.service'

// Self-contained i18n: return the key (plus interpolated values when present),
// so assertions don't depend on the JSON catalog being loaded.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) => (opts ? `${key} ${Object.values(opts).join(' ')}` : key),
    i18n: { language: 'en' },
  }),
}))

const TZ = 'America/Mexico_City'

/** YYYY-MM-DD relative to now — keeps the past/future copy assertions stable. */
const isoDaysFromNow = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

const items: MerchantAccountBreakdown[] = [
  {
    merchantAccountId: 'ext',
    displayName: 'Amaena - Externo',
    provider: 'Blumon PAX',
    affiliation: null,
    collectedOnCard: 13827,
    platformFee: 497.7,
    netToReceive: 13329.3,
    transactionCount: 17,
  },
  {
    merchantAccountId: 'a',
    displayName: 'Amaena - A',
    provider: 'AngelPay (Nexgo)',
    affiliation: '7494104',
    collectedOnCard: 1823,
    platformFee: 65.6,
    netToReceive: 1757.4,
    transactionCount: 5,
  },
]

const fmt = (n: number) => `$${n.toFixed(2)}`

describe('MerchantBreakdownPanel', () => {
  it('renders one row per merchant with its net to receive', () => {
    render(<MerchantBreakdownPanel items={items} formatCurrency={fmt} venueTimezone={TZ} />)
    expect(screen.getByText('Amaena - Externo')).toBeInTheDocument()
    expect(screen.getByText('Amaena - A')).toBeInTheDocument()
    expect(screen.getByText('$13329.30')).toBeInTheDocument()
    expect(screen.getByText('$1757.40')).toBeInTheDocument()
  })

  it('renders nothing when there are no card merchants', () => {
    const { container } = render(<MerchantBreakdownPanel items={[]} formatCurrency={fmt} venueTimezone={TZ} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('shows each merchant\'s share of the total net (% column)', () => {
    render(<MerchantBreakdownPanel items={items} formatCurrency={fmt} venueTimezone={TZ} />)
    // 13329.3 / 15086.7 ≈ 88% · 1757.4 / 15086.7 ≈ 12%
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('12%')).toBeInTheDocument()
  })

  it('uses future-tense "lands" for upcoming settlement and past-tense "landed" for past dates', () => {
    const withSettlement: MerchantAccountBreakdown[] = [
      { ...items[0], estimatedSettlement: { nextDate: isoDaysFromNow(5), settlementDays: 1 } },
      { ...items[1], estimatedSettlement: { nextDate: isoDaysFromNow(-5), settlementDays: 1 } },
    ]
    render(<MerchantBreakdownPanel items={withSettlement} formatCurrency={fmt} venueTimezone={TZ} />)
    // The i18n mock renders the key verbatim → assert the right key was picked per row.
    expect(screen.getByText(/merchantBreakdown\.lands /)).toBeInTheDocument()
    expect(screen.getByText(/merchantBreakdown\.landed /)).toBeInTheDocument()
  })
})
