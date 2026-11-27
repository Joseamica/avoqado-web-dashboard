// src/pages/Settings/Billing/__tests__/basicPlan.test.tsx
// Plan Básico (Task 9): «Tu plan» enseña el Básico por su nombre, lo contrata con un clic desde Gratis, deja quedarse en Pro
// en la prueba y no deja terminar Pro antes del último periodo con descuento.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Subscriptions from '../Subscriptions'
import { downgradeVenueToFree, getDowngradePreview, getVenuePlan, reactivateVenuePlan } from '@/services/features.service'
import { hybridBilling } from '@/services/hybridBilling.service'
import esBilling from '@/locales/es/billing.json'

vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})

const access = { manage: true }
vi.mock('react-i18next', async () => {
  const { default: es } = await import('@/locales/es/billing.json')
  const lookup = (key: string) => key.split('.').reduce((node: any, part) => node?.[part], es)
  return {
    useTranslation: () => ({
      i18n: { language: 'es' },
      t: (key: string, params: Record<string, unknown> = {}) => {
        const plural = params.count != null ? lookup(`${key}_${params.count === 1 ? 'one' : 'other'}`) : undefined
        const value = plural ?? lookup(key) ?? params.defaultValue ?? key
        return String(value).replace(/\{\{(\w+)\}\}/g, (_, name) => String(params[name]))
      },
    }),
  }
})
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ staffInfo: { role: 'OWNER' } }) }))
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'venue', venue: { timezone: 'America/Mexico_City', name: 'Estética Luna' } }),
}))
vi.mock('@/hooks/use-access', () => ({
  useAccess: () => ({ can: (permission: string) => permission !== 'billing:subscriptions:manage' || access.manage }),
}))
const { toastSpy } = vi.hoisted(() => ({ toastSpy: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDate: (value: string) => value.slice(0, 10) }) }))
vi.mock('@/lib/hybridIntent', () => ({ saveHybridAttempt: vi.fn() }))
const publicBasic = vi.hoisted(() => ({ state: { plan: { slug: 'plan-basico' } as { slug: string } | null, loaded: true } }))
vi.mock('@/hooks/usePublicBasicPlan', () => ({ usePublicBasicPlan: () => publicBasic.state }))
vi.mock('@/services/features.service', () => ({
  getVenuePlan: vi.fn(),
  createPlanCheckoutSession: vi.fn(),
  downgradeVenueToFree: vi.fn(),
  getDowngradePreview: vi.fn(),
  reactivateVenuePlan: vi.fn(),
  getBillingPortalUrl: vi.fn(),
  applyRetentionOffer: vi.fn(),
}))
vi.mock('@/services/hybridBilling.service', () => ({
  hybridBilling: { featureGrid: vi.fn(), replacements: vi.fn(), quote: vi.fn(), cancelContract: vi.fn() },
}))
vi.mock('@/components/billing/HybridBillingPanel', () => ({
  HybridBillingPanel: ({ checkoutOpen, initialSlug }: { checkoutOpen?: boolean; initialSlug?: string }) => (
    <p>{checkoutOpen ? `checkout abierto ${initialSlug ?? 'sin oferta'}` : 'checkout cerrado'}</p>
  ),
}))
vi.mock('../components/SuperadminBillingSection', () => ({ SuperadminBillingSection: () => null }))
vi.mock('@/components/billing/PlanUpgradeDialog', () => ({ PlanUpgradeDialog: () => null }))

const B = esBilling.plan.basic
const NO_ORIGIN = {
  kind: 'NONE',
  tier: null,
  price: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAt: null,
  contractId: null,
  contractRevision: null,
  subscriptionId: null,
  paymentIssue: null,
}
const CLASSIC_PRO = {
  kind: 'CLASSIC',
  tier: 'PRO',
  price: { base: 999, gross: 1158.84, currency: 'MXN' },
  interval: 'month',
  currentPeriodEnd: '2026-12-05T17:00:00.000Z',
  subscriptionId: 'sub_classic',
}
const PRICE = { base: 499, gross: 578.84, currency: 'MXN' }
const offer = (over: object = {}) => ({ availableAt: null, price: PRICE, canEndProNow: false, discountEndsAt: null, ...over })
const plan = (origin: object, extra: object = {}) => ({
  hasPlan: false,
  state: 'none',
  planTier: null,
  planName: null,
  interval: null,
  price: null,
  trialEndsAt: null,
  currentPeriodEnd: null,
  cancelAtPeriodEnd: false,
  suspendedAt: null,
  gracePeriodEndsAt: null,
  paymentMethod: null,
  stripeSubscriptionId: null,
  retentionOfferEligible: false,
  pauseOfferEligible: false,
  grandfathered: false,
  origin: { ...NO_ORIGIN, ...origin },
  ...extra,
})
const GRID = { catalogVersion: 'v', purchasesEnabled: true, plans: {}, entries: [] }

const renderPage = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <Subscriptions />
      </MemoryRouter>
    </QueryClientProvider>,
  )
const fill = (text: string, values: Record<string, string>) => text.replace(/\{\{(\w+)\}\}/g, (_, name) => values[name])

beforeEach(() => {
  access.manage = true
  publicBasic.state = { plan: { slug: 'plan-basico' }, loaded: true }
  toastSpy.mockReset()
  vi.mocked(hybridBilling.featureGrid).mockResolvedValue(GRID as never)
  vi.mocked(hybridBilling.replacements).mockResolvedValue({ standaloneFeatureCodes: [], items: [], total: 0 } as never)
  vi.mocked(getDowngradePreview).mockResolvedValue({ required: false, cap: 2, currentActive: 1, keepMax: 2, staff: [] } as never)
  vi.mocked(downgradeVenueToFree)
    .mockReset()
    .mockResolvedValue(plan({}) as never)
  vi.mocked(reactivateVenuePlan)
    .mockReset()
    .mockResolvedValue(plan({}) as never)
})

describe('«Tu plan» con el Plan Básico', () => {
  it('Básico vigente: se ve «Básico · $499 + IVA», nunca «Gratis», y «Subir a Pro» elige Pro', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { basicPlan: { active: true, name: 'Básico', price: PRICE } }) as never)
    renderPage()
    expect(await screen.findByText(fill(B.current, { name: 'Básico', price: '$499.00' }))).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: /Básico/ })).toHaveAttribute('aria-checked', 'true')
    expect(screen.queryByRole('radio', { name: /Gratis/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: fill(B.upgrade, { pro: 'Pro' }) }))
    expect(screen.getByRole('radio', { name: /Pro/ })).toHaveAttribute('aria-checked', 'true')
  })

  it('Básico contratado que hoy no da acceso: lo dice, no lo esconde', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { basicPlan: { active: false, name: 'Básico', price: PRICE } }) as never)
    renderPage()
    expect(await screen.findByText(fill(B.inactive, { name: 'Básico' }))).toBeInTheDocument()
  })

  it('Gratis con el Básico publicado: «Contratar Básico» abre la compra híbrida con el Básico', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { basicOffer: offer() }) as never)
    renderPage()
    expect(await screen.findByText(fill(B.buyCopy, { price: '$499.00' }))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: B.buy }))
    expect(screen.getByText('checkout abierto plan-basico')).toBeInTheDocument()
  })

  it('T9: «Contratar Básico» queda apagado mientras no llega el slug del Básico (no abre la compra sin él)', async () => {
    publicBasic.state = { plan: null, loaded: false }
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { basicOffer: offer() }) as never)
    renderPage()
    expect(await screen.findByRole('button', { name: B.buy })).toBeDisabled()
    expect(screen.getByText('checkout cerrado')).toBeInTheDocument()
  })

  it('T9: prueba que termina sin cobrar SIN Básico publicado → el texto de siempre, sin prometer el Básico', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(
        { ...CLASSIC_PRO, cancelAt: CLASSIC_PRO.currentPeriodEnd },
        { state: 'trial', trialModality: 'ENDS_FREE', trialEndsAt: '2026-12-01T06:00:00.000Z' },
      ) as never,
    )
    renderPage()
    expect(await screen.findByRole('button', { name: esBilling.plan.row.resume })).toBeInTheDocument()
    expect(screen.queryByText(fill(B.trialEnds, { date: '2026-12-01' }))).not.toBeInTheDocument()
    expect(screen.queryByText(B.trialEndsNoDate)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: fill(B.stayPro, { pro: 'Pro' }) })).not.toBeInTheDocument()
  })

  it('sin permiso: el botón está apagado y dice a quién pedirlo', async () => {
    access.manage = false
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { basicOffer: offer() }) as never)
    renderPage()
    expect(await screen.findByRole('button', { name: B.buy })).toBeDisabled()
    expect(screen.getAllByText(esBilling.hybrid.permission).length).toBeGreaterThan(0)
  })

  it('prueba que termina sin cobrar: «Tu prueba termina el…» y «Quedarme en Pro» reactiva', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(
        { ...CLASSIC_PRO, cancelAt: CLASSIC_PRO.currentPeriodEnd },
        {
          state: 'trial',
          trialModality: 'ENDS_FREE',
          trialEndsAt: '2026-12-01T06:00:00.000Z',
          basicOffer: offer({ availableAt: CLASSIC_PRO.currentPeriodEnd }),
        },
      ) as never,
    )
    renderPage()
    expect(await screen.findByText(fill(B.trialEnds, { date: '2026-12-01' }))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: fill(B.stayPro, { pro: 'Pro' }) }))
    await waitFor(() => expect(reactivateVenuePlan).toHaveBeenCalledWith('venue'))
  })

  it('Pro mensual en su último periodo con descuento: «Terminar mi Pro» manda purpose BASIC_PLAN', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { basicOffer: offer({ canEndProNow: true }) }) as never)
    renderPage()
    expect(await screen.findByText(B.preferBasic)).toBeInTheDocument()
    // T9/R14: antes de terminar, el aviso de qué pasa con el equipo si no contrata el Básico ese día.
    expect(screen.getByText(B.endProSeats)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: fill(B.endPro, { pro: 'Pro' }) }))
    await waitFor(() => expect(downgradeVenueToFree).toHaveBeenCalledWith('venue', [], { purpose: 'BASIC_PLAN' }))
  })

  it('doble clic en «Terminar mi Pro» manda UN solo downgrade (full-testing 17-nov: salían 2 correos y 2 códigos)', async () => {
    vi.mocked(getDowngradePreview).mockClear()
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { basicOffer: offer({ canEndProNow: true }) }) as never)
    renderPage()
    const boton = await screen.findByRole('button', { name: fill(B.endPro, { pro: 'Pro' }) })
    // Dos clics en el mismo instante: los dos llegan antes de que `busy` vuelva a pintar el botón apagado.
    act(() => {
      fireEvent.click(boton)
      fireEvent.click(boton)
    })
    await waitFor(() => expect(downgradeVenueToFree).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(toastSpy).toHaveBeenCalled())
    expect(getDowngradePreview).toHaveBeenCalledTimes(1)
    expect(downgradeVenueToFree).toHaveBeenCalledTimes(1)
  })

  it('el SERVIDOR rechaza terminar Pro (409): se enseña su mensaje', async () => {
    const mensaje = 'Tu descuento sigue hasta el 5 de marzo de 2027. Te avisaremos antes para que elijas el Básico.'
    vi.mocked(downgradeVenueToFree).mockRejectedValue({ response: { status: 409, data: { message: mensaje } } })
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { basicOffer: offer({ canEndProNow: true }) }) as never)
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: fill(B.endPro, { pro: 'Pro' }) }))
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith(expect.objectContaining({ title: mensaje, variant: 'destructive' })))
  })

  it('con meses de descuento: la fecha y SIN botón de terminar', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(CLASSIC_PRO, { basicOffer: offer({ discountEndsAt: '2027-03-05T18:00:00.000Z' }) }) as never,
    )
    renderPage()
    expect(await screen.findByText(fill(B.discountUntil, { date: '2027-03-05' }))).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: fill(B.endPro, { pro: 'Pro' }) })).not.toBeInTheDocument()
  })

  it('descuento sin fecha (forever): la frase sin fecha, nunca «null»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { basicOffer: offer({ discountEndsAt: null }) }) as never)
    renderPage()
    expect(await screen.findByText(B.discountNoDate)).toBeInTheDocument()
    expect(screen.queryByText(/null/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: fill(B.endPro, { pro: 'Pro' }) })).not.toBeInTheDocument()
  })

  it('Pro que ya termina: «Ese día podrás contratar el Básico», sin botón de terminar', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(
        { ...CLASSIC_PRO, cancelAt: CLASSIC_PRO.currentPeriodEnd },
        { basicOffer: offer({ availableAt: CLASSIC_PRO.currentPeriodEnd }) },
      ) as never,
    )
    renderPage()
    expect(await screen.findByText(fill(B.afterPro, { price: '$499.00' }))).toBeInTheDocument()
    expect(screen.getByRole('button', { name: esBilling.plan.row.resume })).toBeInTheDocument()
  })

  it('sin Básico publicado: «Tu plan» como siempre', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}) as never)
    renderPage()
    expect(await screen.findByRole('radio', { name: /Gratis/ })).toBeInTheDocument()
    expect(document.querySelector('[data-tour="plan-basic"]')).toBeNull()
  })

  it('el lector acepta la oferta del Básico sin fecha de fin ni tope de lugares (los dos en null)', async () => {
    const { parseHybridOffer } =
      await vi.importActual<typeof import('@/services/hybridBilling.service')>('@/services/hybridBilling.service')
    const basico = {
      id: 'pub_b',
      name: 'Básico',
      slug: 'plan-basico',
      definition: {
        schemaVersion: 1,
        kind: 'FEATURES',
        featureCodes: ['A'],
        terms: {
          currency: 'MXN',
          interval: 'MONTHLY',
          price: 578.84,
          taxIncluded: true,
          promotionCycles: null,
          renewal: { kind: 'SAME_PRICE' },
        },
      },
      includedFeatureCodes: ['A'],
      purchaseAvailable: true,
      placesRemaining: null,
      endsAt: null,
    }
    expect(parseHybridOffer(basico)).toMatchObject({ slug: 'plan-basico', placesRemaining: null, endsAt: null })
  })
})
