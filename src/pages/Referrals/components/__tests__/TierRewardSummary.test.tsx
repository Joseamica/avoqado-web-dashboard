import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'

import TierRewardSummary from '../TierRewardSummary'
import type { TierReward } from '@/types/referrals'

// i18n stub: echoes the key with interpolated values so assertions are
// deterministic without depending on the JSON catalog (repo convention —
// see PlanPicker.test.tsx / MerchantBreakdownPanel.test.tsx).
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
  }),
}))

vi.mock('@/services/menu.service', () => ({
  getProduct: vi.fn(),
}))

import { getProduct } from '@/services/menu.service'

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function makeReward(overrides: Partial<TierReward> = {}): TierReward {
  return {
    id: 'reward-1',
    configId: 'config-1',
    tierLevel: 1,
    rewardType: 'PERCENT_COUPON',
    recurrence: 'ONE_TIME',
    rewardPercent: '15.00',
    rewardProductId: null,
    rewardQuantity: 1,
    active: true,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

describe('TierRewardSummary', () => {
  it('renders a percent-coupon reward line from tierRewards', () => {
    renderWithClient(
      <TierRewardSummary
        venueId="venue-1"
        tierLevel={1}
        referralsRequired={7}
        legacyRewardPercent={15}
        tierRewards={[makeReward({ tierLevel: 1, rewardType: 'PERCENT_COUPON', rewardPercent: '15' })]}
      />,
    )

    expect(
      screen.getByText(
        'activate.tierSummaryLine(level=1,referralsCount=7,rewards=activate.rewardPercentCoupon(percent=15))',
      ),
    ).toBeInTheDocument()
  })

  it('joins multiple active rewards for the same level with " + "', () => {
    renderWithClient(
      <TierRewardSummary
        venueId="venue-1"
        tierLevel={3}
        referralsRequired={20}
        tierRewards={[
          makeReward({ id: 'r1', tierLevel: 3, rewardType: 'PERMANENT_DISCOUNT', rewardPercent: '5' }),
          makeReward({
            id: 'r2',
            tierLevel: 3,
            rewardType: 'FREE_PRODUCT',
            rewardPercent: null,
            rewardProductId: null,
            rewardQuantity: 1,
            recurrence: 'MONTHLY',
          }),
        ]}
      />,
    )

    const expectedRewards =
      'activate.rewardPermanentDiscount(percent=5) + ' +
      'activate.rewardFreeProduct(quantity=1,product=activate.rewardProductFallback)activate.rewardMonthlySuffix'
    expect(
      screen.getByText(`activate.tierSummaryLine(level=3,referralsCount=20,rewards=${expectedRewards})`),
    ).toBeInTheDocument()
  })

  it('ignores inactive reward rows for the level', () => {
    renderWithClient(
      <TierRewardSummary
        venueId="venue-1"
        tierLevel={2}
        referralsRequired={12}
        legacyRewardPercent={20}
        tierRewards={[makeReward({ tierLevel: 2, active: false })]}
      />,
    )

    // No active rows for level 2 → falls back to legacy percent as the phrase
    expect(
      screen.getByText(
        'activate.tierSummaryLine(level=2,referralsCount=12,rewards=activate.rewardPercentCoupon(percent=20))',
      ),
    ).toBeInTheDocument()
  })

  it('falls back to legacy percent when tierRewards is empty (backward compat)', () => {
    renderWithClient(
      <TierRewardSummary
        venueId="venue-1"
        tierLevel={1}
        referralsRequired={7}
        legacyRewardPercent={15}
        tierRewards={[]}
      />,
    )

    expect(
      screen.getByText(
        'activate.tierSummaryLine(level=1,referralsCount=7,rewards=activate.rewardPercentCoupon(percent=15))',
      ),
    ).toBeInTheDocument()
  })

  it('renders "—" when there is neither tierRewards nor a legacy percent for the level', () => {
    renderWithClient(
      <TierRewardSummary venueId="venue-1" tierLevel={1} referralsRequired={7} tierRewards={[]} />,
    )

    expect(
      screen.getByText('activate.tierSummaryLine(level=1,referralsCount=7,rewards=—)'),
    ).toBeInTheDocument()
  })

  it('resolves the product name for a FREE_PRODUCT reward via the product catalog', async () => {
    vi.mocked(getProduct).mockResolvedValue({ id: 'prod-1', name: 'Sesión Iyashi' } as any)

    renderWithClient(
      <TierRewardSummary
        venueId="venue-1"
        tierLevel={3}
        referralsRequired={20}
        tierRewards={[
          makeReward({
            tierLevel: 3,
            rewardType: 'FREE_PRODUCT',
            rewardPercent: null,
            rewardProductId: 'prod-1',
            rewardQuantity: 1,
            recurrence: 'ONE_TIME',
          }),
        ]}
      />,
    )

    await waitFor(() =>
      expect(
        screen.getByText(
          'activate.tierSummaryLine(level=3,referralsCount=20,rewards=activate.rewardFreeProduct(quantity=1,product=Sesión Iyashi))',
        ),
      ).toBeInTheDocument(),
    )
    expect(getProduct).toHaveBeenCalledWith('venue-1', 'prod-1')
  })
})
