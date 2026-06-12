// src/components/billing/__tests__/FeatureGate.test.tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { FeatureGate } from '../FeatureGate'
import type { PlanState } from '@/services/features.service'

// ---------------------------------------------------------------------------
// i18n stub: renders keys as "key:interpolated-value" so assertions are stable
// ---------------------------------------------------------------------------
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => (o?.tier ? `${k}:${o.tier}` : k) }),
}))

// ---------------------------------------------------------------------------
// useAccess mock — default values overridden per-test
// ---------------------------------------------------------------------------
const mockCanFeature = vi.fn()
const mockUseAccess = vi.fn()
vi.mock('@/hooks/use-access', () => ({ useAccess: () => mockUseAccess() }))

// ---------------------------------------------------------------------------
// useCurrentVenue mock — overridable per-test (e.g. demo venue status)
// ---------------------------------------------------------------------------
const mockUseCurrentVenue = vi.fn()
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => mockUseCurrentVenue(),
}))

// ---------------------------------------------------------------------------
// react-router-dom stub
// ---------------------------------------------------------------------------
vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}))

// ---------------------------------------------------------------------------
// features.service mock — getVenuePlan resolved via useQuery
// ---------------------------------------------------------------------------
vi.mock('@/services/features.service', () => ({
  getVenuePlan: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock @tanstack/react-query's useQuery so we control planState without HTTP
// ---------------------------------------------------------------------------
const mockUseQuery = vi.fn()
vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQuery: (opts: Parameters<typeof actual.useQuery>[0]) => mockUseQuery(opts),
  }
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function makePlanState(planTier: PlanState['planTier'], overrides: Partial<PlanState> = {}): PlanState {
  return {
    hasPlan: planTier !== null,
    state: planTier ? 'active' : 'none',
    planTier,
    planName: planTier,
    interval: 'month',
    price: null,
    trialEndsAt: null,
    currentPeriodEnd: null,
    cancelAtPeriodEnd: false,
    suspendedAt: null,
    gracePeriodEndsAt: null,
    paymentMethod: null,
    stripeSubscriptionId: null,
    retentionOfferEligible: false,
    grandfathered: false,
    ...overrides,
  }
}

function renderGate(children = <div>secret content</div>) {
  // Wrap in a real QueryClientProvider (even though useQuery is mocked, the
  // QueryClientProvider is still expected in context by other hooks)
  const queryClient = new QueryClient()
  return render(
    <QueryClientProvider client={queryClient}>
      <FeatureGate feature="CFDI">{children}</FeatureGate>
    </QueryClientProvider>
  )
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('FeatureGate', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Default useAccess: non-superadmin, non-white-label OWNER
    mockCanFeature.mockReturnValue(false)
    mockUseAccess.mockReturnValue({
      canFeature: mockCanFeature,
      role: 'OWNER',
      isWhiteLabelEnabled: false,
    })
    // Default venue: normal ACTIVE venue
    mockUseCurrentVenue.mockReturnValue({
      venueId: 'venue-123',
      fullBasePath: '/venues/test-venue',
      venue: { id: 'venue-123', status: 'ACTIVE' },
    })
  })

  it('normal venue on FREE tier + CFDI feature (PREMIUM required) → shows paywall', () => {
    mockUseQuery.mockReturnValue({ data: makePlanState('GRATIS'), isLoading: false })

    renderGate()

    expect(screen.getByText('featureGate.upgrade:Premium')).toBeInTheDocument()
    // Children still present but blurred (aria-hidden teaser)
    expect(screen.getByText('secret content')).toBeInTheDocument()
  })

  it('normal venue on PREMIUM tier + CFDI feature → renders children without paywall', () => {
    mockUseQuery.mockReturnValue({ data: makePlanState('PREMIUM'), isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('normal venue on ENTERPRISE tier + CFDI feature → renders children without paywall', () => {
    mockUseQuery.mockReturnValue({ data: makePlanState('ENTERPRISE'), isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('LIVE_DEMO venue on FREE tier + CFDI feature (PREMIUM required) → renders children without paywall', () => {
    // Demo venues get EVERYTHING open (mirrors backend venueIsExemptFromPlanGating).
    // Regression: the live-demo Reservations calendar showed "Upgrade to Pro".
    mockUseCurrentVenue.mockReturnValue({
      venueId: 'venue-demo',
      fullBasePath: '/venues/demo-venue',
      venue: { id: 'venue-demo', status: 'LIVE_DEMO' },
    })
    mockUseQuery.mockReturnValue({ data: makePlanState('GRATIS'), isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('grandfathered FREE-tier venue + CFDI feature (PREMIUM required) → renders children without paywall', () => {
    // Legacy venue: planState.grandfathered=true exempts it from ALL tier paywalls.
    mockUseQuery.mockReturnValue({ data: makePlanState('GRATIS', { grandfathered: true }), isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('superadmin → renders children regardless of plan tier', () => {
    // useQuery should be disabled (enabled: false), but we stub it to return nothing
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })
    mockUseAccess.mockReturnValue({
      canFeature: mockCanFeature,
      role: 'SUPERADMIN',
      isWhiteLabelEnabled: false,
    })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('white-label venue with canFeature true → renders children', () => {
    mockCanFeature.mockReturnValue(true)
    mockUseAccess.mockReturnValue({
      canFeature: mockCanFeature,
      role: 'OWNER',
      isWhiteLabelEnabled: true,
    })
    // useQuery disabled for white-label; stub anyway
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('white-label venue with canFeature false → shows paywall', () => {
    mockCanFeature.mockReturnValue(false)
    mockUseAccess.mockReturnValue({
      canFeature: mockCanFeature,
      role: 'OWNER',
      isWhiteLabelEnabled: true,
    })
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })

    renderGate()

    expect(screen.getByText('featureGate.upgrade:Premium')).toBeInTheDocument()
  })

  it('plan still loading with no cached data → renders children optimistically (no paywall flash)', () => {
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: true })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('plan loading but has stale cached FREE data → shows paywall (stale data is trusted)', () => {
    mockUseQuery.mockReturnValue({ data: makePlanState('GRATIS'), isLoading: true })

    renderGate()

    expect(screen.getByText('featureGate.upgrade:Premium')).toBeInTheDocument()
  })
})
