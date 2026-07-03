import { render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi, beforeEach } from 'vitest'

import RecentReferralsTable from '../RecentReferralsTable'
import type { ReferralRecord, PaginatedReferrals } from '@/types/referrals'

// ─── i18n: echo key (+ interpolated values) — repo convention (see
// ReferralCard.test.tsx / TierRewardSummary.test.tsx) ───────────────────────
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key}(${Object.entries(opts).map(([k, v]) => `${k}=${v}`).join(',')})` : key,
  }),
}))

// ─── venue-local date formatting ───────────────────────────────────────────
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (d: string) => (d ? d.split('T')[0] : d),
  }),
}))

// ─── referrals service ──────────────────────────────────────────────────────
const mockListReferrals = vi.fn()
vi.mock('@/services/referrals.service', () => ({
  default: {
    listReferrals: (...args: unknown[]) => mockListReferrals(...args),
  },
}))

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>)
}

function makeReferral(overrides: Partial<ReferralRecord> = {}): ReferralRecord {
  return {
    id: 'ref-1',
    status: 'QUALIFIED',
    createdAt: '2026-06-01T00:00:00.000Z',
    qualifiedAt: '2026-06-02T00:00:00.000Z',
    voidedAt: null,
    forcedOverride: false,
    referrerCustomer: { id: 'cust-1', firstName: 'Ana', lastName: 'Referidora', referralTier: null },
    referredCustomer: { id: 'ref-cust-1', firstName: 'Beto', lastName: 'Referido' },
    rewardDiscount: null,
    ...overrides,
  }
}

function makePage(items: ReferralRecord[]): PaginatedReferrals {
  return { items, total: items.length, page: 1, pageSize: 25 }
}

describe('RecentReferralsTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one chip per reward when the row carries rewards[]', async () => {
    mockListReferrals.mockResolvedValue(
      makePage([
        makeReferral({
          id: 'ref-multi',
          rewards: [
            { id: 'grant-1', rewardType: 'PERCENT_COUPON', rewardPercent: '15', rewardProductId: null, rewardQuantity: 1, status: 'ISSUED', couponCode: 'ABC123' },
            { id: 'grant-2', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: 'prod-1', rewardQuantity: 2, status: 'MANUAL_PENDING', couponCode: null },
          ],
        }),
      ]),
    )

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('recent-referrals-reward-chips-ref-multi')).toBeInTheDocument())
    expect(screen.getByTestId('recent-referrals-reward-chip-grant-1')).toHaveTextContent(
      'table.rewardChipCouponWithCode(percent=15,code=ABC123)',
    )
    expect(screen.getByTestId('recent-referrals-reward-chip-grant-2')).toHaveTextContent(
      'table.rewardChipProduct(quantity=2)',
    )
  })

  it('applies status-differentiated styling: muted/strikethrough for REVOKED, check for REDEEMED/MANUAL_FULFILLED, amber for MANUAL_PENDING', async () => {
    mockListReferrals.mockResolvedValue(
      makePage([
        makeReferral({
          id: 'ref-status',
          rewards: [
            { id: 'g-redeemed', rewardType: 'PERCENT_COUPON', rewardPercent: '10', rewardProductId: null, rewardQuantity: 1, status: 'REDEEMED', couponCode: null },
            { id: 'g-revoked', rewardType: 'PERMANENT_DISCOUNT', rewardPercent: '5', rewardProductId: null, rewardQuantity: 1, status: 'REVOKED', couponCode: null },
            { id: 'g-pending', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: null, rewardQuantity: 1, status: 'MANUAL_PENDING', couponCode: null },
            { id: 'g-fulfilled', rewardType: 'FREE_PRODUCT', rewardPercent: null, rewardProductId: null, rewardQuantity: 1, status: 'MANUAL_FULFILLED', couponCode: null },
          ],
        }),
      ]),
    )

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('recent-referrals-reward-chip-g-redeemed')).toBeInTheDocument())

    expect(screen.getByTestId('recent-referrals-reward-chip-g-redeemed').className).toContain('text-muted-foreground')
    expect(screen.getByTestId('recent-referrals-reward-chip-g-redeemed').querySelector('svg')).toBeTruthy()

    const revokedChip = screen.getByTestId('recent-referrals-reward-chip-g-revoked')
    expect(revokedChip.className).toContain('line-through')
    expect(revokedChip.querySelector('svg')).toBeFalsy()

    expect(screen.getByTestId('recent-referrals-reward-chip-g-pending').className).toContain('bg-amber-100')

    const fulfilledChip = screen.getByTestId('recent-referrals-reward-chip-g-fulfilled')
    expect(fulfilledChip.querySelector('svg')).toBeTruthy()
    expect(fulfilledChip.className).toContain('text-green-700')
  })

  it('wraps multiple chips in a flex-wrap container', async () => {
    mockListReferrals.mockResolvedValue(
      makePage([
        makeReferral({
          id: 'ref-wrap',
          rewards: [
            { id: 'w1', rewardType: 'PERCENT_COUPON', rewardPercent: '15', rewardProductId: null, rewardQuantity: 1, status: 'ISSUED', couponCode: null },
            { id: 'w2', rewardType: 'PERMANENT_DISCOUNT', rewardPercent: '5', rewardProductId: null, rewardQuantity: 1, status: 'ISSUED', couponCode: null },
          ],
        }),
      ]),
    )

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('recent-referrals-reward-chips-ref-wrap')).toBeInTheDocument())
    expect(screen.getByTestId('recent-referrals-reward-chips-ref-wrap').className).toContain('flex-wrap')
    expect(screen.getByTestId('recent-referrals-reward-chip-w2')).toHaveTextContent(
      'table.rewardChipPermanent(percent=5)',
    )
  })

  it('falls back to the legacy rewardDiscount % render when rewards[] is absent (backward compat)', async () => {
    mockListReferrals.mockResolvedValue(
      makePage([
        makeReferral({
          id: 'ref-legacy',
          status: 'QUALIFIED',
          rewardDiscount: { id: 'd1', value: 12, active: true },
        }),
      ]),
    )

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    expect(await screen.findByText('12%')).toBeInTheDocument()
    expect(screen.queryByTestId(/recent-referrals-reward-chips-/)).not.toBeInTheDocument()
  })

  it('falls back to the legacy render when rewards[] is an empty array', async () => {
    mockListReferrals.mockResolvedValue(
      makePage([
        makeReferral({
          id: 'ref-empty-rewards',
          status: 'QUALIFIED',
          rewardDiscount: { id: 'd2', value: 20, active: true },
          rewards: [],
        }),
      ]),
    )

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    expect(await screen.findByText('20%')).toBeInTheDocument()
  })

  it('shows the no-reward placeholder when there is neither rewards[] nor a legacy rewardDiscount', async () => {
    mockListReferrals.mockResolvedValue(makePage([makeReferral({ id: 'ref-none', status: 'PENDING' })]))

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    expect(await screen.findByText('table.noRewardYet')).toBeInTheDocument()
  })

  it('renders the empty state when there are no referrals', async () => {
    mockListReferrals.mockResolvedValue(makePage([]))

    renderWithClient(<RecentReferralsTable venueId="venue-1" />)

    await waitFor(() => expect(screen.getByTestId('recent-referrals-empty')).toBeInTheDocument())
  })
})
