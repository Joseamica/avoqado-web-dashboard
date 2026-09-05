import { act, fireEvent, render, screen, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

import { CommercialReceiptHistoryBoundary } from './CommercialReceiptHistory'
import { CommercialSubscriptionsBoundary } from './CommercialSubscriptions'

const { mockCan } = vi.hoisted(() => ({ mockCan: vi.fn(() => true) }))
const mockOverviewQuery = vi.fn()
const mockReceiptsQuery = vi.fn()
const mockConfiguratorQuery = vi.fn()

vi.mock('./use-commercial-billing', () => ({
  useCommercialBillingOverview: () => mockOverviewQuery(),
  useCommercialBillingReceipts: () => mockReceiptsQuery(),
  useCommercialConfiguratorPreview: (...args: unknown[]) => mockConfiguratorQuery(...args),
}))

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({
    venueId: 'venue-1',
    fullBasePath: '/venues/test',
  }),
}))

vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: mockCan }),
}))

vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatDate: (value: string) => `date:${value}`,
    formatDateTime: (value: string) => `datetime:${value}`,
  }),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, values?: Record<string, unknown>) =>
      values && Object.keys(values).length > 0 ? `${key}:${JSON.stringify(values)}` : key,
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

function configuratorResult() {
  const money = {
    listSubtotalMinor: '213000',
    discountMinor: '19900',
    subtotalMinor: '193100',
    taxMinor: '30896',
    totalMinor: '223996',
  }
  const quote = {
    lines: [
      {
        lineKey: 'PRODUCT:POS:POS_MONTHLY',
        targetType: 'PRODUCT' as const,
        targetCode: 'POS',
        priceCode: 'POS_MONTHLY',
        productKind: 'POS' as const,
        name: 'Punto de venta',
        billingUnit: 'VENUE_MONTH' as const,
        listSubtotalMinor: '24900',
        discountMinor: '19900',
        subtotalMinor: '5000',
        taxMinor: '800',
        totalMinor: '5800',
        promotionalCycles: 3,
        renewalSubtotalMinor: '24900',
        renewalTaxMinor: '3984',
        renewalTotalMinor: '28884',
        appliedDiscounts: [{ type: 'FIXED_PRICE' as const, cycles: 3, discountMinor: '19900' }],
      },
    ],
    today: money,
    renewal: { ...money, discountMinor: '0', subtotalMinor: '213000', taxMinor: '34080', totalMinor: '247080' },
    entitlementCodes: ['POS_CORE'],
  }
  const price = (code: string, billingUnit: 'VENUE_MONTH' | 'VENUE_YEAR', amount: string) => ({
    code,
    billingUnit,
    listUnitAmountMinor: amount,
    taxRateBasisPoints: amount === '0' ? (0 as const) : (1600 as const),
  })
  const product = (
    code: string,
    name: string,
    kind: 'PLAN' | 'POS' | 'MODULE',
    prices: ReturnType<typeof price>[],
    salesMode: 'SELF_SERVICE' | 'CONTACT' = 'SELF_SERVICE',
  ) => ({ code, name, description: `${name} descripción`, kind, salesMode, capabilityCodes: ['POS_CORE'], prices })
  return {
    schemaVersion: 1 as const,
    state: 'READY' as const,
    pricing: { state: 'BOUND_OFFER_APPLIED' as const, offerVersionId: 'offer-1', offerCode: 'POS_50' },
    preview: {
      schemaVersion: 1 as const,
      catalogPublicationId: 'catalog-1',
      offer: { offerVersionId: 'offer-1', offerCode: 'POS_50' },
      selection: { mode: 'CUSTOM' as const, billingUnit: 'VENUE_MONTH' as const, moduleCodes: [] },
      options: {
        packages: [
          product('FREE', 'Free', 'PLAN', [price('FREE_MONTHLY', 'VENUE_MONTH', '0')]),
          product('PRO', 'Pro', 'PLAN', [price('PRO_MONTHLY', 'VENUE_MONTH', '99900'), price('PRO_ANNUAL', 'VENUE_YEAR', '999000')]),
          product('PREMIUM', 'Premium', 'PLAN', [
            price('PREMIUM_MONTHLY', 'VENUE_MONTH', '169900'),
            price('PREMIUM_ANNUAL', 'VENUE_YEAR', '1699000'),
          ]),
          product('ENTERPRISE', 'Enterprise', 'PLAN', [], 'CONTACT'),
        ],
        customBase: product('POS', 'Punto de venta', 'POS', [price('POS_MONTHLY', 'VENUE_MONTH', '24900')]),
        modules: [
          product('CFDI_MODULE', 'Facturación CFDI 4.0', 'MODULE', [price('CFDI_MONTHLY', 'VENUE_MONTH', '17900')]),
          product('KITCHEN_DISPLAY_MODULE', 'Pantalla de cocina', 'MODULE', [
            price('KITCHEN_DISPLAY_MONTHLY', 'VENUE_MONTH', '17900'),
          ]),
        ],
      },
      quote,
      recommendation: {
        reason: 'CHEAPER_TODAY_AND_RENEWAL' as const,
        selection: { mode: 'PACKAGE' as const, packageCode: 'PREMIUM', billingUnit: 'VENUE_MONTH' as const },
        quote: {
          ...quote,
          lines: [{ ...quote.lines[0], targetCode: 'PREMIUM', productKind: 'PLAN' as const, name: 'Premium' }],
          today: { ...money, totalMinor: '197084' },
          renewal: { ...money, totalMinor: '197084' },
        },
        savingsTodayMinor: '26912',
        savingsRenewalMinor: '49996',
      },
    },
  }
}

describe('commercial billing Dashboard surfaces', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCan.mockReturnValue(true)
    mockConfiguratorQuery.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isSelectionPending: false,
      isError: false,
      refetch: vi.fn(),
    })
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

  it('shows the Server deadline and explains that an unpaid pending selection remains on Free without deleting data', () => {
    mockOverviewQuery.mockReturnValue({
      data: readyOverview(),
      isLoading: false,
      isError: false,
      isFetching: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText(/commercialBilling\.nonPayment\.deadline/)).toHaveTextContent(
      'date:2026-09-06T18:00:00.000Z',
    )
    expect(screen.getByText('commercialBilling.nonPayment.pendingSelection')).toBeInTheDocument()
  })

  it('explains that an unpaid active subscription returns to Free without deleting data', () => {
    const pendingOverview = readyOverview()
    const overview = {
      ...pendingOverview,
      contract: { ...pendingOverview.contract, status: 'ACTIVE' as const },
    }
    mockOverviewQuery.mockReturnValue({ data: overview, isLoading: false, isError: false, refetch: vi.fn() })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText('commercialBilling.nonPayment.activeSubscription')).toBeInTheDocument()
  })

  it('explains that an expired paused subscription is already operating on Free with its data preserved', () => {
    const pendingOverview = readyOverview()
    mockOverviewQuery.mockReturnValue({
      data: {
        ...pendingOverview,
        contract: { ...pendingOverview.contract, status: 'PAUSED' as const },
      },
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy</div>} />)

    expect(screen.getByText(/commercialBilling\.nonPayment\.expiredAt/)).toHaveTextContent(
      'date:2026-09-06T18:00:00.000Z',
    )
    expect(screen.getByText('commercialBilling.nonPayment.pausedSubscription')).toBeInTheDocument()
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

  it('opens one unified configurator with mutually exclusive package and custom modes', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))

    expect(screen.getByRole('tab', { name: 'commercialBilling.configurator.modes.packages' })).toBeInTheDocument()
    const customTab = screen.getByRole('tab', { name: 'commercialBilling.configurator.modes.custom' })
    expect(customTab).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText('Facturación CFDI 4.0')).toBeInTheDocument()
    fireEvent.mouseDown(screen.getByRole('tab', { name: 'commercialBilling.configurator.modes.packages' }), { button: 0 })
    expect(screen.getByText('Premium')).toBeInTheDocument()
    const packageCall = mockConfiguratorQuery.mock.calls[mockConfiguratorQuery.mock.calls.length - 1]
    expect(packageCall?.[1]).toMatchObject({ mode: 'PACKAGE' })
  })

  it('selects module rows without client-side money and renders the exact Server discount and renewal', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    fireEvent.click(screen.getByRole('checkbox', { name: /Facturación CFDI 4.0/ }))

    const moduleCall = mockConfiguratorQuery.mock.calls[mockConfiguratorQuery.mock.calls.length - 1]
    expect(moduleCall?.[1]).toEqual({
      mode: 'CUSTOM',
      billingUnit: 'VENUE_MONTH',
      moduleCodes: ['CFDI_MODULE'],
    })
    expect(screen.getByText('−$199.00')).toBeInTheDocument()
    expect(screen.getByText('$2,239.96')).toBeInTheDocument()
    expect(screen.getByText(/commercialBilling\.configurator\.offer\.renewal/)).toHaveTextContent('$2,470.80')
  })

  it('shows a Server-issued equivalent-package recommendation and switches to it with one action', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))

    const comparison = screen.getByTestId('commercial-configurator-recommendation-comparison')
    expect(within(comparison).getByText('commercialBilling.configurator.recommendation.comparison.selection')).toBeInTheDocument()
    expect(within(comparison).getByText('$2,470.80')).toBeInTheDocument()
    expect(within(comparison).getByText('Premium')).toBeInTheDocument()
    expect(within(comparison).getByText('$1,970.84')).toBeInTheDocument()
    expect(within(comparison).getByText('commercialBilling.configurator.recommendation.comparison.savings')).toBeInTheDocument()
    expect(within(comparison).getByText('$499.96')).toBeInTheDocument()
    expect(screen.getByText('$269.12')).toBeInTheDocument()
    fireEvent.click(
      screen.getByRole('button', {
        name: 'commercialBilling.configurator.recommendation.choose:{"packageName":"Premium"}',
      }),
    )
    const recommendationCall = mockConfiguratorQuery.mock.calls[mockConfiguratorQuery.mock.calls.length - 1]
    expect(recommendationCall?.[1]).toEqual({
      mode: 'PACKAGE',
      packageCode: 'PREMIUM',
      billingUnit: 'VENUE_MONTH',
    })
  })

  it('states both current totals when a package only becomes cheaper at renewal', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    const current = configuratorResult()
    const lowerRenewal = {
      ...current,
      preview: {
        ...current.preview,
        recommendation: {
          ...current.preview.recommendation!,
          reason: 'LOWER_RENEWAL' as const,
          quote: {
            ...current.preview.recommendation!.quote,
            today: { ...current.preview.recommendation!.quote.today, totalMinor: '240000' },
          },
        },
      },
    }
    mockConfiguratorQuery.mockReturnValue({
      data: lowerRenewal,
      isLoading: false,
      isFetching: false,
      isSelectionPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))

    expect(screen.getByText(/commercialBilling\.configurator\.recommendation\.LOWER_RENEWAL\.description/)).toHaveTextContent(
      '"todayAmount":"$2,239.96"',
    )
    expect(screen.getByText(/commercialBilling\.configurator\.recommendation\.LOWER_RENEWAL\.description/)).toHaveTextContent(
      '"packageToday":"$2,400.00"',
    )
  })

  it('shows an explicit campaign warning when the bound promotion is unavailable', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    const current = configuratorResult()
    mockConfiguratorQuery.mockReturnValue({
      data: {
        ...current,
        pricing: {
          state: 'BOUND_OFFER_UNAVAILABLE' as const,
          offerVersionId: 'offer-1',
          offerCode: 'POS_50',
          reason: 'OFFER_SUSPENDED' as const,
        },
        preview: { ...current.preview, offer: null },
      },
      isLoading: false,
      isFetching: false,
      isSelectionPending: false,
      isError: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))

    expect(screen.getByText('commercialBilling.configurator.offer.unavailableTitle')).toBeInTheDocument()
    expect(screen.getByText('commercialBilling.configurator.offer.unavailable.OFFER_SUSPENDED')).toBeInTheDocument()
  })

  it('does not expose stale money while a new selection is still being priced', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })
    mockConfiguratorQuery.mockReturnValue({
      data: configuratorResult(),
      isLoading: false,
      isFetching: false,
      isSelectionPending: true,
      isError: false,
      refetch: vi.fn(),
    })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))

    const summary = screen.getByTestId('commercial-configurator-summary')
    expect(within(summary).getByText('commercialBilling.configurator.updatingBadge')).toBeInTheDocument()
    expect(within(summary).queryByText('$2,239.96')).not.toBeInTheDocument()
    expect(screen.queryByTestId('commercial-configurator-recommendation-comparison')).not.toBeInTheDocument()
  })

  it('keeps the read-only subscription visible without showing a change action to users lacking manage permission', () => {
    mockCan.mockReturnValue(false)
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false, refetch: vi.fn() })

    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)

    expect(screen.getByText('commercialBilling.title')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'commercialBilling.configurator.actions.open' })).not.toBeInTheDocument()
  })

  it('revalidates the offer before reviewing exact line discounts, tax and renewal without accepting a purchase', async () => {
    const refreshed = configuratorResult()
    refreshed.preview.quote.today.totalMinor = '5800'
    refreshed.preview.quote.today.subtotalMinor = '5000'
    refreshed.preview.quote.today.taxMinor = '800'
    refreshed.preview.quote.today.listSubtotalMinor = '24900'
    refreshed.preview.quote.renewal = {
      listSubtotalMinor: '24900', discountMinor: '0', subtotalMinor: '24900', taxMinor: '3984', totalMinor: '28884',
    }
    let resolve!: (value: { data: typeof refreshed; isSuccess: boolean }) => void
    const refetch = vi.fn(() => new Promise<{ data: typeof refreshed; isSuccess: boolean }>(done => { resolve = done }))
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('status')).toBeInTheDocument()
    expect(within(dialog).queryByText('$2,239.96')).not.toBeInTheDocument()
    expect(refetch).toHaveBeenCalledTimes(1)
    await act(async () => resolve({ data: refreshed, isSuccess: true }))
    expect(within(dialog).getByText('POS_50')).toBeInTheDocument()
    expect(within(dialog).getByText(/review.lineDiscount/)).toHaveTextContent('$199.00')
    expect(within(dialog).getByText('$8.00')).toBeInTheDocument()
    expect(within(dialog).getByText('$58.00')).toBeInTheDocument()
    expect(within(dialog).getByText(/review.lineRenewal/)).toHaveTextContent('$288.84')
    expect(within(dialog).getByText(/offer.cycles/)).toHaveTextContent('"count":3')
    expect(within(dialog).getByRole('button', { name: 'commercialBilling.configurator.review.confirm' })).toBeDisabled()
    fireEvent.click(within(dialog).getByRole('button', { name: 'commercialBilling.configurator.review.edit' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /Facturación CFDI/ })).toBeInTheDocument()
    expect(screen.getByText('commercialBilling.contractStatus.PENDING_PAYMENT')).toBeInTheDocument()
  })

  it('never falls back to cached money when review revalidation fails and can retry safely', async () => {
    const stale = configuratorResult()
    const refetch = vi.fn().mockResolvedValueOnce({ data: stale, isSuccess: false }).mockResolvedValueOnce({ data: stale, isSuccess: true })
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: stale, isLoading: false, isFetching: false, isError: false, refetch })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' })))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('alert')).toBeInTheDocument()
    expect(within(dialog).queryByText('$2,239.96')).not.toBeInTheDocument()
    await act(async () => fireEvent.click(within(dialog).getByRole('button', { name: 'commercialBilling.actions.retry' })))
    expect(within(dialog).getByText('$2,239.96')).toBeInTheDocument()
  })

  it('hides stale totals and review actions after a failed background refresh while keeping selection controls', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: true, refetch: vi.fn() })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    expect(screen.getByRole('checkbox', { name: /Facturación CFDI/ })).toBeInTheDocument()
    expect(screen.queryByText('$2,239.96')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'commercialBilling.configurator.actions.review' })).not.toBeInTheDocument()
    expect(screen.getByText('commercialBilling.configurator.error.title')).toBeInTheDocument()
  })

  it('removes an already-open configurator when subscription management permission is revoked', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })
    const view = renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    mockCan.mockReturnValue(false)
    view.rerender(<MemoryRouter><CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} /></MemoryRouter>)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByRole('button', { name: 'commercialBilling.configurator.actions.review' })).not.toBeInTheDocument()
  })

  it('rejects a review response priced for a different selection', async () => {
    const wrongSelection = configuratorResult()
    wrongSelection.preview.selection.moduleCodes = ['CFDI_MODULE']
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({
      data: configuratorResult(), isLoading: false, isFetching: false, isError: false,
      refetch: vi.fn().mockResolvedValue({ data: wrongSelection, isSuccess: true }),
    })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' })))
    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByText('commercialBilling.configurator.error.title')).toBeInTheDocument()
    expect(within(dialog).queryByText('$2,239.96')).not.toBeInTheDocument()
  })

  it('does not show one global promotion duration for products with different discounted cycles', () => {
    const data = configuratorResult()
    data.preview.quote.lines.push({
      ...data.preview.quote.lines[0], lineKey: 'cfdi', targetCode: 'CFDI_MODULE', name: 'CFDI con descuento',
      promotionalCycles: 1, appliedDiscounts: [{ type: 'FIXED_PRICE', cycles: 1, discountMinor: '19900' }],
    })
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data, isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    const summary = screen.getByTestId('commercial-configurator-summary')
    expect(within(summary).getByText('commercialBilling.configurator.offer.cycles:{"count":1}')).toBeInTheDocument()
    expect(within(summary).getByText('commercialBilling.configurator.offer.cycles:{"count":3}')).toBeInTheDocument()
  })

  it('clears the open configuration when the displayed commercial contract changes', () => {
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: configuratorResult(), isLoading: false, isFetching: false, isError: false, refetch: vi.fn() })
    const view = renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    const next = readyOverview()
    next.contract.id = 'contract-2'
    mockOverviewQuery.mockReturnValue({ data: next, isLoading: false, isError: false })
    view.rerender(<MemoryRouter><CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} /></MemoryRouter>)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' })).toBeInTheDocument()
  })

  it.each(['matching', 'wrong-cadence', 'wrong-package'] as const)('validates the Server echo for annual packages: %s', async scenario => {
    const current = readyOverview()
    const annualOverview = {
      ...current,
      contract: {
        ...current.contract,
        cadence: 'ANNUAL',
        lines: [{ ...current.contract.lines[0], productKind: 'PLAN', targetCode: 'PREMIUM', billingUnit: 'VENUE_YEAR' }],
      },
    }
    const base = configuratorResult()
    const annual = {
      ...base,
      pricing: { state: 'LIST_PRICE' },
      preview: {
        ...base.preview,
        offer: null,
        recommendation: null,
        selection: { mode: 'PACKAGE', packageCode: 'PREMIUM', billingUnit: 'VENUE_YEAR' },
        quote: {
          ...base.preview.quote,
          lines: [{
            ...base.preview.quote.lines[0], productKind: 'PLAN', targetCode: 'PREMIUM', name: 'Premium', billingUnit: 'VENUE_YEAR',
            listSubtotalMinor: '1699000', discountMinor: '0', subtotalMinor: '1699000', taxMinor: '271840', totalMinor: '1970840',
            promotionalCycles: null, appliedDiscounts: [], renewalSubtotalMinor: '1699000', renewalTaxMinor: '271840', renewalTotalMinor: '1970840',
          }],
          today: { listSubtotalMinor: '1699000', discountMinor: '0', subtotalMinor: '1699000', taxMinor: '271840', totalMinor: '1970840' },
          renewal: { listSubtotalMinor: '1699000', discountMinor: '0', subtotalMinor: '1699000', taxMinor: '271840', totalMinor: '1970840' },
        },
      },
    }
    const response = {
      ...annual,
      preview: { ...annual.preview, selection: { ...annual.preview.selection,
        billingUnit: scenario === 'wrong-cadence' ? 'VENUE_MONTH' : 'VENUE_YEAR',
        packageCode: scenario === 'wrong-package' ? 'PRO' : 'PREMIUM',
      } },
    }
    mockOverviewQuery.mockReturnValue({ data: annualOverview, isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: annual, isLoading: false, isFetching: false, isError: false, refetch: vi.fn().mockResolvedValue({ isSuccess: true, data: response }) })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' })))
    const dialog = screen.getByRole('dialog')
    if (scenario === 'matching') {
      expect(within(dialog).getByText('Premium')).toBeInTheDocument()
      expect(within(dialog).getByText('$19,708.40')).toBeInTheDocument()
      expect(within(dialog).getByText('commercialBilling.billingUnit.VENUE_YEAR')).toBeInTheDocument()
    } else {
      expect(within(dialog).getByText('commercialBilling.configurator.error.title')).toBeInTheDocument()
      expect(within(dialog).queryByText('$19,708.40')).not.toBeInTheDocument()
    }
  })

  it.each([false, true])('ignores a dismissed review response (reopened: %s)', async reopened => {
    const latest = configuratorResult()
    let resolveDiscarded!: (value: unknown) => void
    const refetch = vi.fn()
      .mockImplementationOnce(() => new Promise(resolve => { resolveDiscarded = resolve }))
      .mockResolvedValueOnce({ isSuccess: true, data: latest })
    mockOverviewQuery.mockReturnValue({ data: readyOverview(), isLoading: false, isError: false })
    mockConfiguratorQuery.mockReturnValue({ data: latest, isLoading: false, isFetching: false, isError: false, refetch })
    renderRoute(<CommercialSubscriptionsBoundary legacy={<div>legacy billing</div>} />)
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.open' }))
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' }))
    fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.review.edit' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    if (reopened) await act(async () => fireEvent.click(screen.getByRole('button', { name: 'commercialBilling.configurator.actions.review' })))
    const discarded = configuratorResult()
    discarded.preview.quote.today.totalMinor = '12345'
    await act(async () => resolveDiscarded({ isSuccess: true, data: discarded }))
    if (reopened) {
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText('$2,239.96')).toBeInTheDocument()
      expect(within(dialog).queryByText('$123.45')).not.toBeInTheDocument()
    } else {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    }
  })
})
