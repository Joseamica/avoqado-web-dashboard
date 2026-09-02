import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { CommercialReceiptHistoryBoundary } from './CommercialReceiptHistory'
import { CommercialSubscriptionsBoundary } from './CommercialSubscriptions'

const mockOverviewQuery = vi.fn()
const mockReceiptsQuery = vi.fn()

vi.mock('./use-commercial-billing', () => ({
  useCommercialBillingOverview: () => mockOverviewQuery(),
  useCommercialBillingReceipts: () => mockReceiptsQuery(),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'venue-1',
    fullBasePath: '/venues/test',
  }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (value: string) => `date:${value}`,
    formatDateTime: (value: string) => `datetime:${value}`,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'es-MX' },
  }),
}))

function readyOverview() {
  return {
    schemaVersion: 1 as const,
    state: 'READY' as const,
    collectionState: 'PAYMENT_UNDER_REVIEW' as const,
    contract: {
      id: 'contract-1',
      status: 'PENDING_PAYMENT' as const,
      cadence: 'MONTHLY' as const,
      currency: 'MXN' as const,
      timezone: 'America/Mexico_City',
      startsAt: '2026-09-01T18:00:00.000Z',
      endedAt: null,
      quoteId: 'quote-1',
      lines: [
        {
          lineKey: 'pos',
          targetType: 'PRODUCT' as const,
          targetCode: 'POS',
          priceCode: 'POS_MONTHLY',
          quantity: 1,
          productKind: 'POS' as const,
          name: 'Punto de venta',
          billingUnit: 'VENUE_MONTH' as const,
          listUnitAmountMinor: '24900',
          listSubtotalMinor: '24900',
          discountMinor: '0',
          subtotalMinor: '24900',
          taxMinor: '3984',
          totalMinor: '28884',
          promotionalCycles: null,
          renewalSubtotalMinor: '24900',
          renewalTaxMinor: '3984',
          renewalTotalMinor: '28884',
        },
      ],
      today: {
        listSubtotalMinor: '24900',
        discountMinor: '0',
        subtotalMinor: '24900',
        taxMinor: '3984',
        totalMinor: '28884',
      },
      renewal: {
        listSubtotalMinor: '24900',
        discountMinor: '0',
        subtotalMinor: '24900',
        taxMinor: '3984',
        totalMinor: '28884',
      },
      entitlements: ['POS_CORE'],
    },
    obligations: [
      {
        periodId: 'period-1',
        scheduleKey: 'SAAS_MONTHLY' as const,
        cadence: 'MONTHLY' as const,
        sequence: 1,
        startsAt: '2026-09-01T18:00:00.000Z',
        endsAt: '2026-10-01T18:00:00.000Z',
        dueAt: '2026-09-01T18:00:00.000Z',
        graceEndsAt: '2026-09-06T18:00:00.000Z',
        periodStatus: 'OPEN' as const,
        receivableId: 'receivable-1',
        reference: 'AVQ-REFERENCE-1',
        receivableStatus: 'PARTIALLY_PAID' as const,
        amountDueMinor: '28884',
        allocatedMinor: '0',
        outstandingMinor: '28884',
        currency: 'MXN' as const,
        paymentProvider: 'MANUAL_SPEI' as const,
        paymentState: 'UNDER_REVIEW' as const,
      },
    ],
    latestPaidPeriod: null,
    nextRenewalAt: null,
    recentReceipts: [],
    receiptHistoryHasMore: false,
  }
}

function renderRoute(node: React.ReactNode) {
  return render(<MemoryRouter>{node}</MemoryRouter>)
}

describe('commercial billing Dashboard surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows Server-authoritative plan, tax, outstanding balance and review state without a payment mutation', () => {
    mockOverviewQuery.mockReturnValue({
      data: readyOverview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText('Punto de venta')).toBeInTheDocument()
    expect(screen.getAllByText('$288.84').length).toBeGreaterThan(0)
    expect(screen.getByText('AVQ-REFERENCE-1')).toBeInTheDocument()
    expect(screen.getByText('commercialBilling.collection.PAYMENT_UNDER_REVIEW.title')).toBeInTheDocument()
    expect(screen.queryByText('legacy billing')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /pay|pagar|retry|reintentar/i })).not.toBeInTheDocument()
  })

  it('keeps legacy billing only when Server explicitly says there is no commercial contract', () => {
    mockOverviewQuery.mockReturnValue({
      data: { schemaVersion: 1, state: 'NO_COMMERCIAL_CONTRACT' },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText('legacy billing')).toBeInTheDocument()
  })

  it('fails closed on incompatible or unavailable authority instead of exposing legacy checkout actions', () => {
    mockOverviewQuery.mockReturnValue({
      data: {
        schemaVersion: 1,
        state: 'INCOMPATIBLE',
        supportCode: 'COMMERCIAL_BILLING_SCHEMA_UNSUPPORTED',
      },
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText('commercialBilling.incompatible.title')).toBeInTheDocument()
    expect(screen.getByText('COMMERCIAL_BILLING_SCHEMA_UNSUPPORTED')).toBeInTheDocument()
    expect(screen.queryByText('legacy billing')).not.toBeInTheDocument()
  })

  it('shows bounded receipt history and loads the next cursor only after an explicit action', () => {
    const fetchNextPage = vi.fn()
    mockOverviewQuery.mockReturnValue({
      data: readyOverview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
    mockReceiptsQuery.mockReturnValue({
      data: {
        pages: [
          {
            schemaVersion: 1,
            state: 'READY',
            items: [
              {
                id: 'receipt-1',
                provider: 'STRIPE',
                entryType: 'PAYMENT',
                amountMinor: '28884',
                currency: 'MXN',
                observedAt: '2026-09-01T19:00:00.000Z',
                createdAt: '2026-09-01T19:01:00.000Z',
              },
            ],
            nextCursor: 'receipt-1',
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: true,
      fetchNextPage,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialReceiptHistoryBoundary legacy={<div>legacy history</div>} />)

    expect(screen.getByText('$288.84')).toBeInTheDocument()
    const loadMore = screen.getByRole('button', { name: 'commercialBilling.receipts.loadMore' })
    expect(loadMore).toHaveAttribute('data-tour', 'commercial-billing-load-more-receipts')
    fireEvent.click(loadMore)
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
    expect(screen.queryByText('legacy history')).not.toBeInTheDocument()
  })

  it('fails receipt history closed when Server reports an unsupported commercial schema', () => {
    mockOverviewQuery.mockReturnValue({
      data: readyOverview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })
    mockReceiptsQuery.mockReturnValue({
      data: {
        pages: [
          {
            schemaVersion: 1,
            state: 'INCOMPATIBLE',
            supportCode: 'COMMERCIAL_BILLING_SCHEMA_UNSUPPORTED',
          },
        ],
      },
      isLoading: false,
      isError: false,
      isFetchingNextPage: false,
      hasNextPage: false,
      fetchNextPage: vi.fn(),
      refetch: vi.fn(),
    })

    renderRoute(<CommercialReceiptHistoryBoundary legacy={<div>legacy history</div>} />)

    expect(screen.getByText('commercialBilling.incompatible.title')).toBeInTheDocument()
    expect(screen.getByText('COMMERCIAL_BILLING_SCHEMA_UNSUPPORTED')).toBeInTheDocument()
    expect(screen.queryByText('legacy history')).not.toBeInTheDocument()
  })
})
