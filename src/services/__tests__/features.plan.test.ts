import { beforeEach, describe, expect, it, vi } from 'vitest'
import api from '@/api'
import { cancelVenuePlan, createPlanCheckoutSession, downgradeVenueToFree, getBillingPortalUrl } from '@/services/features.service'

vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))

beforeEach(() => {
  vi.mocked(api.post).mockResolvedValue({ data: { data: { state: 'canceling' } } } as never)
})

describe('plan cancel requests carry the owner reason', () => {
  it('cancel sends the reason, or an empty body', async () => {
    await cancelVenuePlan('v1', { reason: 'TOO_EXPENSIVE', comment: 'Caro' })
    expect(api.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/plan/cancel', { reason: 'TOO_EXPENSIVE', comment: 'Caro' })
    await cancelVenuePlan('v1')
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/plan/cancel', {})
  })

  it('downgrade keeps the selection and adds the reason', async () => {
    await downgradeVenueToFree('v1', ['sv1'], { reason: 'OTHER' })
    expect(api.post).toHaveBeenCalledWith('/api/v1/dashboard/venues/v1/plan/downgrade', { keepStaffVenueIds: ['sv1'], reason: 'OTHER' })
  })
})

// Planes editables (B2, Task 12): lo nuevo viaja sólo si viene; sin opciones, el cuerpo de hoy.
describe('el checkout de «Tu plan» y el portal mandan sólo lo que traen', () => {
  it('createPlanCheckoutSession: sin opciones, { tier, interval }; con comprobante o aceptación, también ésos', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { url: 'https://checkout.stripe.example/c/1' } } as never)
    await createPlanCheckoutSession('v1', 'PRO', 'monthly')
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/plan/checkout', { tier: 'PRO', interval: 'monthly' })
    await createPlanCheckoutSession('v1', 'PRO', 'annual', { quoteToken: 'tok_v2' })
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/plan/checkout', {
      tier: 'PRO',
      interval: 'annual',
      quoteToken: 'tok_v2',
    })
    await createPlanCheckoutSession('v1', 'PREMIUM', 'annual', { acceptanceId: 'cacc1' })
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/plan/checkout', {
      tier: 'PREMIUM',
      interval: 'annual',
      acceptanceId: 'cacc1',
    })
  })

  it('getBillingPortalUrl: sin opciones, el cuerpo de hoy (vuelve a esta página); con PONER_TARJETA, el flujo y su regreso', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { success: true, url: 'https://billing.stripe.example/p/1' } } as never)
    await getBillingPortalUrl('v1')
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/billing-portal', { returnUrl: window.location.href })
    const regreso = 'https://dashboard.example.com/venues/x/settings/billing/subscriptions?portal=tarjeta'
    await getBillingPortalUrl('v1', { flujo: 'PONER_TARJETA', returnUrl: regreso })
    expect(api.post).toHaveBeenLastCalledWith('/api/v1/dashboard/venues/v1/billing-portal', { returnUrl: regreso, flujo: 'PONER_TARJETA' })
  })
})
