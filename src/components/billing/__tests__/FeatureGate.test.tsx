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
  useTranslation: () => ({
    t: (k: string, o?: Record<string, unknown>) => {
      const partes = [k]
      if (o?.tier) partes.push(String(o.tier))
      if (o?.price) partes.push(String(o.price))
      return partes.join(':')
    },
  }),
}))

// ---------------------------------------------------------------------------
// useAccess mock — default values overridden per-test
// ---------------------------------------------------------------------------
const mockCanFeature = vi.fn()
const mockCan = vi.fn()
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
  getVenuePlanTierInfo: vi.fn(),
  getVenueFeatures: vi.fn(),
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
// useVenueTier now makes TWO useQuery calls — ['venuePlanTier'] (reads .tier/.exempt) and
// ['venueFeatures'] (reads .activeFeatures). Our mockUseQuery returns the SAME object for both,
// so this helper produces one object that satisfies both: the PlanState fields PLUS the plan-tier
// gating signal (tier/grandfathered/exempt) and an empty activeFeatures list (no à-la-carte grants).
function makePlanState(planTier: PlanState['planTier'], overrides: Partial<PlanState> = {}): Record<string, unknown> {
  const grandfathered = overrides.grandfathered ?? false
  const tier = planTier === 'GRATIS' || planTier === null ? 'FREE' : planTier
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
    grandfathered,
    // Plan-tier gating signal (read by useVenueTier from the all-roles ['venuePlanTier'] query):
    tier,
    exempt: grandfathered, // grandfathered → exempt; demo venues are handled via venue.status
    // Features query (['venueFeatures']) — no à-la-carte grants by default:
    activeFeatures: [],
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
    mockCan.mockReturnValue(true) // OWNER: puede ver facturación
    mockUseAccess.mockReturnValue({
      can: mockCan,
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

  it('plan-tier signal settled with no data (endpoint error) → renders children, NO wrongful paywall (fail-open)', () => {
    // Regression (prod incident 2026-06-13): a MANAGER at Mindform (grandfathered) was blocked from
    // editing inventory with "tienes que ser premium". Root cause: the gate read grandfathered/tier
    // from GET /plan (billing:subscriptions:read — ADMIN/OWNER only), which 403s for sub-ADMIN roles,
    // so the signal was lost and it fell through to FREE → Premium paywall. The accurate fix moves
    // the signal to an all-roles endpoint (so a MANAGER reads it normally — see the grandfathered &
    // FREE-tier tests, which now hold for every role). This test guards the remaining safety net:
    // if the plan-tier request EVER settles with no data (network error), the UX gate must fail OPEN.
    mockCan.mockReturnValue(false) // un MANAGER no tiene billing:subscriptions:read
    mockUseAccess.mockReturnValue({ can: mockCan, canFeature: mockCanFeature, role: 'MANAGER', isWhiteLabelEnabled: false })
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })

    renderGate()

    expect(screen.getByText('secret content')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('superadmin → renders children regardless of plan tier', () => {
    // useQuery should be disabled (enabled: false), but we stub it to return nothing
    mockUseQuery.mockReturnValue({ data: undefined, isLoading: false })
    mockUseAccess.mockReturnValue({
      can: mockCan,
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
      can: mockCan,
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
      can: mockCan,
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
  // -------------------------------------------------------------------------
  // El precio en el cartel (founder, 21-sep): «que no esconda la pestaña, que
  // salga que es una funcionalidad pro/premium o que cuesta $x».
  // -------------------------------------------------------------------------
  it('con permiso de facturación → el cartel dice el precio del plan Y el de la función suelta', () => {
    mockUseQuery.mockReturnValue({
      data: { ...makePlanState('GRATIS'), availableFeatures: [{ code: 'CFDI', monthlyPrice: 89, stripePriceId: 'price_cfdi' }] },
      isLoading: false,
    })

    renderGate()

    expect(screen.getByText('featureGate.planPrice:Premium:$1,699')).toBeInTheDocument()
    expect(screen.getByText('featureGate.alonePrice:$89')).toBeInTheDocument()
    expect(screen.getByText('featureGate.upgrade:Premium')).toBeInTheDocument()
  })

  it('SIN permiso de facturación → sigue viéndose el cartel, pero sin precios ni botón', () => {
    mockCan.mockReturnValue(false)
    mockUseQuery.mockReturnValue({
      data: { ...makePlanState('GRATIS'), availableFeatures: [{ code: 'CFDI', monthlyPrice: 89, stripePriceId: 'price_cfdi' }] },
      isLoading: false,
    })

    renderGate()

    // La pantalla NUNCA se esconde: se sigue explicando de qué plan es.
    expect(screen.getByText('featureGate.tierTag:Premium')).toBeInTheDocument()
    expect(screen.getByText('featureGate.askOwner')).toBeInTheDocument()
    // Pero ni el precio (dato de facturación) ni un botón que lo mandaría a un 403.
    expect(screen.queryByText(/featureGate\.planPrice/)).not.toBeInTheDocument()
    expect(screen.queryByText(/featureGate\.alonePrice/)).not.toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
  })

  it('respuesta sin availableFeatures → no truena; sólo el precio del plan', () => {
    mockUseQuery.mockReturnValue({ data: makePlanState('GRATIS'), isLoading: false })

    renderGate()

    expect(screen.getByText('featureGate.planPrice:Premium:$1,699')).toBeInTheDocument()
    expect(screen.queryByText(/featureGate\.alonePrice/)).not.toBeInTheDocument()
  })
  // -------------------------------------------------------------------------
  // Auditoría de Codex del 21-sep sobre el cartel
  // -------------------------------------------------------------------------
  it('🔴 una función SIN precio de Stripe no se anuncia como «contrátala sola por $0»', async () => {
    // El seed de CFDI crea `monthlyPrice: 0` sin `stripePriceId`: no se puede contratar suelta.
    mockUseQuery.mockReturnValue({
      data: { ...makePlanState('GRATIS'), availableFeatures: [{ code: 'CFDI', monthlyPrice: 0, stripePriceId: null }] },
      isLoading: false,
    })

    renderGate()

    expect(screen.queryByText(/featureGate\.alonePrice/)).not.toBeInTheDocument()
  })

  it('🔴 quien sólo puede LEER facturación ve los precios pero NO el botón de contratar', async () => {
    // El backend le negaría la compra: mostrarle el botón es prometerle algo que no puede hacer.
    mockCan.mockImplementation((permiso: string) => permiso === 'billing:subscriptions:read')
    mockUseQuery.mockReturnValue({
      data: { ...makePlanState('GRATIS'), availableFeatures: [{ code: 'CFDI', monthlyPrice: 89, stripePriceId: 'price_cfdi' }] },
      isLoading: false,
    })

    renderGate()

    expect(screen.getByText('featureGate.planPrice:Premium:$1,699')).toBeInTheDocument()
    expect(screen.queryByText('featureGate.upgrade:Premium')).not.toBeInTheDocument()
    expect(screen.getByText('featureGate.askOwner')).toBeInTheDocument()
  })
})
