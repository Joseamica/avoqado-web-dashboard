// src/pages/Settings/Billing/__tests__/Subscriptions.plan.test.tsx
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Subscriptions from '../Subscriptions'
import {
  createPlanCheckoutSession,
  downgradeVenueToFree,
  getBillingPortalUrl,
  getDowngradePreview,
  getVenuePlan,
} from '@/services/features.service'
import api from '@/api'
import { hybridBilling } from '@/services/hybridBilling.service'
import esBilling from '@/locales/es/billing.json'
import { OFERTA_V1, OFERTA_V2_PLUS, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'

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
  HybridBillingPanel: ({ checkoutOpen }: { checkoutOpen?: boolean }) => <p>{checkoutOpen ? 'checkout abierto' : 'checkout cerrado'}</p>,
}))
vi.mock('../components/SuperadminBillingSection', () => ({ SuperadminBillingSection: () => null }))
// «Poner mi tarjeta» nunca abre un formulario propio ni pide un SetupIntent (§17): si alguien lo monta, se ve aquí.
vi.mock('@/components/AddPaymentMethodDialog', () => ({ AddPaymentMethodDialog: () => <p>formulario propio de tarjeta</p> }))
vi.mock('@/api', () => ({ default: { post: vi.fn(), get: vi.fn() } }))
vi.mock('@/components/billing/PlanUpgradeDialog', () => ({
  PlanUpgradeDialog: ({ tier }: { tier: string | null }) => (tier ? <p>asistido {tier}</p> : null),
}))

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
const offer = (id: string, price: number, extra: object = {}) => ({
  publicationId: `pub_${id}`,
  campaignId: `camp_${id}`,
  name: id,
  kind: 'FEATURES',
  planTier: null,
  price,
  renewal: 'SAME_PRICE',
  renewalPrice: null,
  promotionCycles: null,
  includedFeatureCodes: [id],
  ...extra,
})
const entry = (id: string, category: string, minimumTier: string, source: string, price: number | null) => ({
  id,
  featureCode: id.startsWith('BASE_') ? null : id,
  names: { es: id, en: id, fr: id },
  description: '',
  category,
  minimumTier,
  offering: minimumTier === 'FREE' ? 'INCLUDED' : 'CONFIGURABLE',
  access: { source, contractId: null, paidThrough: null, cancelAt: null },
  offer: price == null ? null : offer(id, price),
})
const GRID = {
  catalogVersion: 'v',
  purchasesEnabled: true,
  plans: {
    PRO: offer('PRO', 999, { kind: 'PLAN', planTier: 'PRO', includedFeatureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'] }),
    PREMIUM: offer('PREMIUM', 1999, {
      kind: 'PLAN',
      planTier: 'PREMIUM',
      includedFeatureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS', 'CFDI'],
    }),
  },
  entries: [
    entry('BASE_POS', 'sell', 'FREE', 'FREE', null),
    entry('CHATBOT', 'ai', 'FREE', 'FREE', null),
    entry('LOYALTY_PROGRAM', 'customers', 'PRO', 'NONE', 199),
    entry('RESERVATIONS', 'team', 'PRO', 'NONE', 129),
    entry('CFDI', 'money', 'PREMIUM', 'NONE', 249),
  ],
}
const CLASSIC_PRO = {
  kind: 'CLASSIC',
  tier: 'PRO',
  price: { base: 999, gross: 1158.84, currency: 'MXN' },
  interval: 'month',
  currentPeriodEnd: '2026-10-27T00:00:00.000Z',
  subscriptionId: 'sub_classic',
}
const CONTRACT_PRO = {
  kind: 'CONTRACT',
  tier: 'PRO',
  contractId: 'hc_pro',
  contractRevision: 1,
  subscriptionId: 'sub_contract',
  currentPeriodEnd: '2026-10-27T00:00:00.000Z',
}
const PREVIEW = {
  required: true,
  cap: 2,
  currentActive: 3,
  keepMax: 2,
  staff: [
    { staffVenueId: 'sv-owner', staffId: 's1', name: 'Olivia', email: 'o@x.com', role: 'OWNER', isOwner: true, lastActiveAt: null },
    { staffVenueId: 'sv-ana', staffId: 's2', name: 'Ana', email: 'a@x.com', role: 'MANAGER', isOwner: false, lastActiveAt: null },
    { staffVenueId: 'sv-beto', staffId: 's3', name: 'Beto', email: 'b@x.com', role: 'WAITER', isOwner: false, lastActiveAt: null },
  ],
}
const noReplacements = { standaloneFeatureCodes: ['CHATBOT'], items: [], total: 0 }
const renderPage = (url = '/') =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}
    >
      <MemoryRouter initialEntries={[url]}>
        <Subscriptions />
      </MemoryRouter>
    </QueryClientProvider>,
  )
const review = () => document.querySelector('[data-tour="plan-review"]') as HTMLButtonElement

beforeEach(() => {
  ofertaActual.valor = OFERTA_V1
  access.manage = true
  toastSpy.mockReset()
  vi.mocked(getVenuePlan).mockResolvedValue(plan({}) as never)
  vi.mocked(hybridBilling.featureGrid).mockResolvedValue(GRID as never)
  vi.mocked(hybridBilling.replacements).mockResolvedValue(noReplacements as never)
  vi.mocked(hybridBilling.quote).mockResolvedValue({ id: 'quote_1' } as never)
  vi.mocked(hybridBilling.cancelContract).mockResolvedValue({} as never)
  vi.mocked(downgradeVenueToFree).mockResolvedValue(plan({}) as never)
  vi.mocked(createPlanCheckoutSession).mockResolvedValue('#stripe')
})

describe('the plan row says where the plan comes from', () => {
  it('sin internet: el aviso del plan, y no un «Gratis» que nadie leyó', async () => {
    onlineManager.setOnline(false)
    try {
      renderPage()
      expect(await screen.findByText(esBilling.plan.page.planError)).toBeInTheDocument()
      expect(screen.queryByRole('radio', { name: /Gratis/ })).not.toBeInTheDocument()
    } finally {
      onlineManager.setOnline(true)
    }
  })

  it('Gratis is the current plan, with no status line', async () => {
    renderPage()
    const free = await screen.findByRole('radio', { name: /Gratis/ })
    expect(free).toHaveAttribute('aria-checked', 'true')
    expect(within(free).getByText('Tu plan actual')).toBeInTheDocument()
    expect(document.querySelector('[data-tour="plan-status"]')).toBeNull()
  })

  it('classic Pro: renewal date, cancel and payment method', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    renderPage()
    expect(await screen.findByText('Se renueva el 2026-10-27')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancelar plan' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Actualizar método de pago' })).toBeEnabled()
  })

  it('a plan by contract: "Cancelar renovación"', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({
        kind: 'CONTRACT',
        tier: 'PREMIUM',
        contractId: 'hc_1',
        contractRevision: 3,
        subscriptionId: 'sub_contract',
        currentPeriodEnd: '2026-10-27T00:00:00.000Z',
      }) as never,
    )
    renderPage()
    expect(await screen.findByRole('button', { name: 'Cancelar renovación' })).toBeInTheDocument()
  })

  it('a comped plan says until when, with no cancel', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: '2026-11-01T00:00:00.000Z' }) as never)
    renderPage()
    expect(await screen.findByText('Tu plan Pro es de cortesía hasta el 2026-11-01.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cancelar plan' })).toBeNull()
  })
})

describe('each choice opens its operation (spec §4.1)', () => {
  it('Gratis → Pro pays the classic first charge today and opens the classic checkout', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    expect(screen.getByText(/Hoy pagas \$1,158\.84/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() => expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly'))
  })

  it('D3: con una prueba regalada, quedarse con Pro dice hoy $0 y abre el checkout marcado «sin cobro hoy»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: '2026-12-05T17:19:24.498Z', firstChargeAt: '2026-12-05T17:19:24.498Z' }) as never,
    )
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    expect(await screen.findByText(/Hoy pagas \$0\.00 · primer cobro el/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() =>
      expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly', {
        primerCobroAnunciado: '2026-12-05T17:19:24.498Z',
      }),
    )
  })

  it('D3: al volver de Stripe «sin cobro hoy» con la suscripción ligada: tarjeta guardada y la fecha, nunca «Pago recibido»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(
        { kind: 'CLASSIC', tier: 'PRO', subscriptionId: 'sub_1', currentPeriodEnd: '2026-12-05T17:19:24.000Z' },
        { state: 'trial', hasPlan: true, stripeSubscriptionId: 'sub_1', trialEndsAt: '2026-12-05T17:19:24.000Z' },
      ) as never,
    )
    renderPage('/?checkout=success&sinCobroHoy=1')
    await waitFor(() =>
      expect(toastSpy).toHaveBeenCalledWith({ title: 'Listo: tu tarjeta quedó guardada. El primer cobro será el 2026-12-05.' }),
    )
    expect(toastSpy).not.toHaveBeenCalledWith({ title: 'Pago recibido. Estamos activando tu plan…' })
  })

  it('D3: con una prueba regalada, Premium sigue en «escríbenos» (no abre checkout)', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: '2026-12-05T17:19:24.498Z', firstChargeAt: '2026-12-05T17:19:24.498Z' }) as never,
    )
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    expect(await screen.findByText('Tu plan es de cortesía: para cambiarlo, escríbenos.')).toBeInTheDocument()
    expect(createPlanCheckoutSession).not.toHaveBeenCalled()
  })

  it('PLAN_ABSORBE_SUELTA switches to a replacement with credit and opens the hybrid checkout', async () => {
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_loyalty', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }],
      total: 1,
    } as never)
    vi.mocked(createPlanCheckoutSession).mockRejectedValue({
      response: { data: { code: 'PLAN_ABSORBE_SUELTA', message: 'Ese plan incluye una función que ya pagas por separado.' } },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    await userEvent.click(review())
    expect(await screen.findByText(/te lo cambiamos hoy con crédito/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [{ publicationId: 'pub_PRO', selectedFeatureCodes: [] }],
        replaceSubscriptionIds: ['sub_loyalty'],
        dropFeatureCodes: [],
      }),
    )
    expect(await screen.findByText('checkout abierto')).toBeInTheDocument()
  })

  it('Pro (classic) → Premium is an assisted change in phase 1: the classic subscription may be annual (§4.2 (c))', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }],
      total: 1,
    } as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    await userEvent.click(review())
    expect(await screen.findByText('asistido PREMIUM')).toBeInTheDocument()
    expect(hybridBilling.quote).not.toHaveBeenCalled()
  })

  it('Pro (contract) → Premium goes through a replacement with credit, never through "Cambiar selección"', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CONTRACT_PRO) as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }],
      total: 1,
    } as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    expect(screen.getByText(/Lo que pagas hoy se calcula al revisar/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [{ publicationId: 'pub_PREMIUM', selectedFeatureCodes: [] }],
        replaceSubscriptionIds: ['sub_contract'],
        dropFeatureCodes: [],
      }),
    )
  })

  // Inventory sold by a 3-month promotion with a $599 list behind it, and auto-reorder that needs it for good.
  const stubPromoInventory = () =>
    vi.mocked(hybridBilling.featureGrid).mockResolvedValue({
      ...GRID,
      entries: [
        ...GRID.entries,
        {
          ...entry('INVENTORY_TRACKING', 'inventory', 'PREMIUM', 'NONE', null),
          offer: {
            ...offer('INVENTORY_TRACKING', 479.2),
            publicationId: 'pub_promo_inv',
            listPrice: 599,
            renewal: 'END',
            promotionCycles: 3,
          },
          listOffer: { ...offer('INVENTORY_TRACKING', 599), publicationId: 'pub_list_inv', listPrice: 599 },
        },
        entry('AUTO_REORDER', 'inventory', 'PREMIUM', 'NONE', 149),
      ],
    } as never)
  const dependencyRefusal = {
    response: {
      status: 409,
      data: {
        code: 'HYBRID_DEPENDENCY_TERM',
        message:
          'Reorden automático necesita Inventario FIFO, recetas y costeo mientras la conserves: agrégalo con precio de lista o consérvalo.',
        details: [
          {
            featureCode: 'AUTO_REORDER',
            requiredFeatureCode: 'INVENTORY_TRACKING',
            requiredUntil: null,
            unit: { kind: 'LINE', publicationId: 'pub_promo_inv' },
          },
        ],
      },
    },
  }
  const useListButton = { name: 'Usar el precio de lista de Inventario FIFO, recetas y costeo ($516.38 + IVA)' }
  const markInventory = { name: 'Marcar Inventario FIFO, recetas y costeo' }

  it('a dependency its promotion brings for too short offers that function at its list price, and quotes it', async () => {
    stubPromoInventory()
    vi.mocked(hybridBilling.quote).mockRejectedValueOnce(dependencyRefusal)
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', markInventory))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Reorden automático' }))
    await userEvent.click(review())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Reorden automático necesita Inventario FIFO')
    await userEvent.click(within(alert).getByRole('button', useListButton))
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenLastCalledWith('venue', {
        lines: [
          { publicationId: 'pub_list_inv', selectedFeatureCodes: [] },
          { publicationId: 'pub_AUTO_REORDER', selectedFeatureCodes: [] },
        ],
        replaceSubscriptionIds: [],
        dropFeatureCodes: [],
      }),
    )
    expect(await screen.findByText('checkout abierto')).toBeInTheDocument()
  })

  it('unmarking a function forgets its list choice: marked again, it starts from the cheapest offer', async () => {
    stubPromoInventory()
    vi.mocked(hybridBilling.quote)
      .mockRejectedValueOnce(dependencyRefusal)
      .mockRejectedValueOnce({ response: { status: 409, data: { message: 'Otra cosa salió mal.' } } })
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', markInventory))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Reorden automático' }))
    await userEvent.click(review())
    await userEvent.click(within(await screen.findByRole('alert')).getByRole('button', useListButton))
    expect(await screen.findByText('Otra cosa salió mal.')).toBeInTheDocument()
    const summary = () => document.querySelector('[data-tour="plan-selection"]') as HTMLElement
    expect(summary()).toHaveTextContent('$599.00')
    await userEvent.click(screen.getByRole('checkbox', markInventory))
    await userEvent.click(screen.getByRole('checkbox', markInventory))
    expect(summary()).toHaveTextContent('$479.20')
    expect(summary()).not.toHaveTextContent('$599.00')
  })

  it('a server refusal is shown as is, with the assisted change', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CONTRACT_PRO) as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }],
      total: 1,
    } as never)
    vi.mocked(hybridBilling.quote).mockRejectedValue({
      response: {
        data: { code: 'HYBRID_OFFER_REDEEMED', message: 'Tu organización ya utilizó esta campaña o tiene una aceptación pendiente.' },
      },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    await userEvent.click(review())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tu organización ya utilizó esta campaña')
    await userEvent.click(within(alert).getByRole('button', { name: 'Cambio asistido' }))
    expect(screen.getByText('asistido PREMIUM')).toBeInTheDocument()
  })

  it('Pro → Gratis asks why, states the seat rule, lets the owner choose who stays and schedules the downgrade', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(getDowngradePreview).mockResolvedValue(PREVIEW as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Gratis/ }))
    expect(document.querySelector('[data-tour="plan-seat-notice"]')).toHaveTextContent('En Gratis caben 2 usuarios')
    await userEvent.click(review())
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/sigue activo hasta el 2026-10-27/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByText('Es muy caro'))
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar mi plan' }))
    expect(await screen.findByRole('heading', { name: 'Elige quién se queda' })).toBeInTheDocument()
    await userEvent.click(document.querySelector('[data-tour="downgrade-confirm"]')!)
    await waitFor(() => expect(downgradeVenueToFree).toHaveBeenCalledWith('venue', ['sv-owner'], { reason: 'TOO_EXPENSIVE' }))
  })

  it('a refused drop keeping a function falls back to dropping at period end', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(hybridBilling.featureGrid).mockResolvedValue({
      ...GRID,
      entries: GRID.entries.map(item => (item.id === 'RESERVATIONS' ? { ...item, access: { ...item.access, source: 'PLAN' } } : item)),
    } as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }],
      total: 1,
    } as never)
    vi.mocked(getDowngradePreview).mockResolvedValue({ ...PREVIEW, required: false } as never)
    vi.mocked(hybridBilling.quote).mockRejectedValue({ response: { data: { message: 'No se pudo reemplazar tu plan hoy.' } } })
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Gratis/ }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Reservas y citas' }))
    await userEvent.click(review())
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [{ publicationId: 'pub_RESERVATIONS', selectedFeatureCodes: [] }],
        replaceSubscriptionIds: ['sub_classic'],
        dropFeatureCodes: ['LOYALTY_PROGRAM'],
      }),
    )
    await userEvent.click(await screen.findByRole('button', { name: 'Bajar a Gratis al final del periodo' }))
    const dialog = await screen.findByRole('dialog')
    expect(within(dialog).getByText(/sigue activo hasta el 2026-10-27/)).toBeInTheDocument()
  })

  it('a plan by contract cancels its renewal with the reason, without choosing who stays', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({
        kind: 'CONTRACT',
        tier: 'PREMIUM',
        contractId: 'hc_1',
        contractRevision: 3,
        subscriptionId: 'sub_contract',
        currentPeriodEnd: '2026-10-27T00:00:00.000Z',
      }) as never,
    )
    renderPage()
    await userEvent.click(await screen.findByRole('button', { name: 'Cancelar renovación' }))
    const dialog = await screen.findByRole('dialog')
    await userEvent.click(within(dialog).getByText('Cierre o pausa temporal'))
    await userEvent.type(within(dialog).getByRole('textbox'), 'Cerramos agosto')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Sí, cancelar mi plan' }))
    await waitFor(() =>
      expect(hybridBilling.cancelContract).toHaveBeenCalledWith('venue', 'hc_1', 3, { reason: 'TEMPORARY', comment: 'Cerramos agosto' }),
    )
    expect(getDowngradePreview).not.toHaveBeenCalled()
  })

  it('adding functions on Gratis quotes one line per function, with the Pro comparison', async () => {
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar Programa de lealtad' }))
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Reservas y citas' }))
    expect(document.querySelector('[data-tour="plan-hint"]')).toHaveTextContent('Pro incluye estas 2 y')
    await userEvent.click(review())
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [
          { publicationId: 'pub_LOYALTY_PROGRAM', selectedFeatureCodes: [] },
          { publicationId: 'pub_RESERVATIONS', selectedFeatureCodes: [] },
        ],
        replaceSubscriptionIds: [],
        dropFeatureCodes: [],
      }),
    )
  })

  it('on Gratis, a refused function purchase shows the server message and never offers an assisted "Gratis"', async () => {
    vi.mocked(hybridBilling.quote).mockRejectedValue({
      response: {
        data: { code: 'HYBRID_OFFER_REDEEMED', message: 'Tu organización ya utilizó esta campaña o tiene una aceptación pendiente.' },
      },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar Programa de lealtad' }))
    await userEvent.click(review())
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Tu organización ya utilizó esta campaña')
    expect(within(alert).queryByRole('button', { name: 'Cambio asistido' })).toBeNull()
    expect(screen.queryByText(/asistido/)).toBeNull()
  })
})

describe('what the page keeps honest when something fails or changes mid-way', () => {
  const RESERVATIONS_IN_PLAN = {
    ...GRID,
    entries: GRID.entries.map(item => (item.id === 'RESERVATIONS' ? { ...item, access: { ...item.access, source: 'PLAN' } } : item)),
  }
  const CLASSIC_REPLACEABLE = {
    ...noReplacements,
    items: [{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }],
    total: 1,
  }
  const reachWhoStays = async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(getDowngradePreview).mockResolvedValue(PREVIEW as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Gratis/ }))
    await userEvent.click(review())
    await userEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Sí, cancelar mi plan' }))
    await screen.findByRole('heading', { name: 'Elige quién se queda' })
    return document.querySelector('[data-tour="downgrade-confirm"]') as HTMLButtonElement
  }

  it('"who stays" quotes what was reviewed, even if the selection changes while the preview loads', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(hybridBilling.featureGrid).mockResolvedValue(RESERVATIONS_IN_PLAN as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue(CLASSIC_REPLACEABLE as never)
    let answer: (value: unknown) => void = () => undefined
    vi.mocked(getDowngradePreview).mockReturnValue(new Promise(resolve => void (answer = resolve)) as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Gratis/ }))
    const reservations = screen.getByRole('checkbox', { name: 'Marcar Reservas y citas' })
    await userEvent.click(reservations)
    await userEvent.click(review())
    // The grid stays live while the preview loads: un-marking now must not change what was reviewed.
    await userEvent.click(reservations)
    answer(PREVIEW)
    expect(await screen.findByRole('heading', { name: 'Elige quién se queda' })).toBeInTheDocument()
    await userEvent.click(document.querySelector('[data-tour="downgrade-confirm"]')!)
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [{ publicationId: 'pub_RESERVATIONS', selectedFeatureCodes: [] }],
        replaceSubscriptionIds: ['sub_classic'],
        dropFeatureCodes: ['LOYALTY_PROGRAM'],
        keepStaffVenueIds: ['sv-owner'],
      }),
    )
  })

  it('changing the selection clears the message of a refused quote', async () => {
    vi.mocked(hybridBilling.quote).mockRejectedValue({ response: { data: { message: 'Tu organización ya utilizó esta campaña.' } } })
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar Programa de lealtad' }))
    await userEvent.click(review())
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu organización ya utilizó esta campaña.')
    await userEvent.click(screen.getByRole('checkbox', { name: 'Marcar Reservas y citas' }))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('a failed function grid still lets Gratis → Pro pay the classic checkout', async () => {
    vi.mocked(hybridBilling.featureGrid).mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar las funciones')
    await userEvent.click(screen.getByRole('radio', { name: /Pro/ }))
    expect(screen.getByText(/Hoy pagas \$1,158\.84/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() => expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly'))
  })

  it('a failed plan read never shows Gratis as the current plan', async () => {
    vi.mocked(getVenuePlan).mockRejectedValue(new Error('network'))
    renderPage()
    expect(await screen.findByRole('alert')).toHaveTextContent('No pudimos cargar tu plan')
    expect(screen.queryByRole('radio', { name: /Gratis/ })).toBeNull()
    expect(screen.queryByText('Tu plan actual')).toBeNull()
    expect(review()).toBeNull()
    expect(screen.getByText('checkout cerrado')).toBeInTheDocument()
  })

  // D4 (5-nov): two clicks in the same instant both reached the server before `busy` disabled the button.
  it('two clicks in the same instant open one classic checkout', async () => {
    vi.mocked(createPlanCheckoutSession).mockReturnValue(new Promise(() => undefined) as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    // Both clicks land before React re-renders, as a fast double click does in the browser.
    act(() => {
      review().click()
      review().click()
    })
    await waitFor(() => expect(review()).toBeDisabled())
    expect(createPlanCheckoutSession).toHaveBeenCalledTimes(1)
  })

  it('two clicks in the same instant quote the functions once', async () => {
    vi.mocked(hybridBilling.quote).mockReturnValue(new Promise(() => undefined) as never)
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar Programa de lealtad' }))
    // Both clicks land before React re-renders, as a fast double click does in the browser.
    act(() => {
      review().click()
      review().click()
    })
    await waitFor(() => expect(review()).toBeDisabled())
    expect(hybridBilling.quote).toHaveBeenCalledTimes(1)
  })

  // D6 (5-nov): the selection stays as it was reviewed while its purchase is on its way.
  it('with a purchase in flight no function can be marked and no plan picked', async () => {
    vi.mocked(hybridBilling.quote).mockReturnValue(new Promise(() => undefined) as never)
    renderPage()
    await userEvent.click(await screen.findByRole('checkbox', { name: 'Marcar Programa de lealtad' }))
    await userEvent.click(review())
    await waitFor(() => expect(review()).toBeDisabled())
    expect(screen.queryByRole('checkbox', { name: 'Marcar Reservas y citas' })).toBeNull()
    for (const radio of screen.getAllByRole('radio')) expect(radio).toBeDisabled()
  })

  it('the downgrade is sent once, even with two clicks', async () => {
    vi.mocked(downgradeVenueToFree).mockReturnValue(new Promise(() => undefined) as never)
    const confirm = await reachWhoStays()
    await userEvent.click(confirm)
    await userEvent.click(confirm)
    await waitFor(() => expect(downgradeVenueToFree).toHaveBeenCalledTimes(1))
    expect(confirm).toBeDisabled()
  })

  it('a refused downgrade keeps "Elige quién se queda" open', async () => {
    vi.mocked(downgradeVenueToFree).mockRejectedValue({ response: { data: { message: 'El propietario debe conservar su acceso.' } } })
    const confirm = await reachWhoStays()
    await userEvent.click(confirm)
    await waitFor(() => expect(downgradeVenueToFree).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(confirm).toBeEnabled())
    expect(screen.getByRole('heading', { name: 'Elige quién se queda' })).toBeInTheDocument()
  })
})

describe('permissions', () => {
  it('with read and without manage, shows everything and disables every action', async () => {
    access.manage = false
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    renderPage()
    expect(await screen.findByRole('radio', { name: /Premium/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Cancelar plan' })).toBeDisabled()
    expect(review()).toBeDisabled()
    expect(screen.getAllByText('Pide a tu administrador permiso para gestionar suscripciones.').length).toBeGreaterThan(0)
    expect(screen.queryByRole('checkbox')).toBeNull()
  })
})

describe('back from Stripe', () => {
  it('waits for the webhook to grant the plan before saying the payment is still pending', async () => {
    vi.mocked(getVenuePlan)
      .mockResolvedValueOnce(plan({}) as never)
      .mockResolvedValueOnce(plan({}) as never)
      .mockResolvedValue(plan(CLASSIC_PRO, { hasPlan: true, state: 'active', planTier: 'PRO' }) as never)
    renderPage('/?checkout=success')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: esBilling.plan.checkoutSuccess.replace('{{plan}}', 'Pro') }), {
      timeout: 8000,
    })
    expect(toastSpy).not.toHaveBeenCalledWith({ title: esBilling.plan.checkoutPending })
  }, 10000)

  it('B4 (r1 #12): «¡Bienvenido a Plus!» con el plan que se releyó, con la v2 de la oferta', async () => {
    ofertaActual.valor = OFERTA_V2_PLUS
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { hasPlan: true, state: 'active', planTier: 'PRO' }) as never)
    renderPage('/?checkout=success')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: esBilling.plan.checkoutSuccess.replace('{{plan}}', 'Plus') }), {
      timeout: 8000,
    })
  }, 10000)

  it('B4 (r1 #12): si el plan releído no trae su nivel, el aviso es el genérico «Tu plan quedó activo»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO, { hasPlan: true, state: 'active', planTier: null, tier: null }) as never)
    renderPage('/?checkout=success')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: esBilling.checkout.welcomeGeneric }), { timeout: 8000 })
  }, 10000)
})

// Planes editables (B2, Task 12): «Tu plan» con la cotización de una versión del editor.
describe('«Tu plan» con la versión del editor (B2, Task 12)', () => {
  const FIN = '2026-12-10T17:00:00.000Z'
  const opcion = (precioCents: number, netCents: number) => ({
    quoteToken: `tok_${precioCents}`,
    precioCents,
    netCents,
    firstChargeCents: precioCents,
    trialEndsAt: null,
  })
  const V2 = {
    versionNumber: 2,
    planes: {
      PRO: { displayName: 'Pro', vendible: true, monthly: opcion(92684, 79900), annual: opcion(926840, 799000) },
      PREMIUM: { displayName: 'Premium', vendible: true, monthly: opcion(197084, 169900), annual: opcion(1970840, 1699000) },
    },
  }
  const SIN_PLANES = {
    PRO: { displayName: 'Pro', vendible: false, monthly: null, annual: null },
    PREMIUM: { displayName: 'Premium', vendible: false, monthly: null, annual: null },
  }
  const PRUEBA_PRO = {
    kind: 'CLASSIC',
    tier: 'PRO',
    price: { base: 799, gross: 926.84, currency: 'MXN' },
    interval: 'month',
    currentPeriodEnd: FIN,
    subscriptionId: 'sub_trial',
  }
  const enPrueba = (estadoDeLaPrueba: object | undefined, extra: { origin?: object; state?: string } = {}) =>
    plan(extra.origin ?? PRUEBA_PRO, {
      hasPlan: true,
      state: extra.state ?? 'trial',
      planTier: 'PRO',
      trialEndsAt: FIN,
      currentPeriodEnd: FIN,
      stripeSubscriptionId: 'sub_trial',
      cotizacion: {
        versionNumber: 2,
        planes: estadoDeLaPrueba && (estadoDeLaPrueba as { estado: string }).estado === 'SIN_TARJETA' ? SIN_PLANES : V2.planes,
        ...(estadoDeLaPrueba ? { estadoDeLaPrueba } : {}),
      },
    })
  const prueba = (estado: 'SIN_TARJETA' | 'CON_TARJETA' | 'TERMINADA') => ({
    estado,
    tier: 'PRO',
    interval: 'monthly',
    trialEndsAt: FIN,
    tarjeta: estado === 'CON_TARJETA' ? { brand: 'visa', last4: '4242' } : null,
    montoAlTerminarCents: estado === 'TERMINADA' ? null : 81084,
  })
  const S = esBilling.plan.selection
  const SITIO = 'https://dashboard.example.com'
  const PAGINA = '/venues/mi-negocio/settings/billing/subscriptions'
  const assign = vi.fn()
  const conLaPagina = () => {
    assign.mockReset()
    vi.stubGlobal('location', { ...window.location, origin: SITIO, pathname: PAGINA, search: '', href: `${SITIO}${PAGINA}`, assign })
  }
  let search = ''
  function Direccion() {
    search = useLocation().search
    return null
  }
  const conDireccion = (url: string) =>
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })}
      >
        <MemoryRouter initialEntries={[url]}>
          <Subscriptions />
          <Direccion />
        </MemoryRouter>
      </QueryClientProvider>,
    )
  const listo = (precio: string) => esBilling.plan.selection.cardAdded.replace('{{price}}', precio).replace('{{last4}}', '4242')
  const tituloDe = (call: unknown[]) => (call[0] as { title?: string })?.title

  beforeEach(() => {
    conLaPagina()
    vi.mocked(getBillingPortalUrl).mockReset()
    vi.mocked(api.post).mockReset()
    vi.mocked(createPlanCheckoutSession).mockReset()
    vi.mocked(createPlanCheckoutSession).mockResolvedValue('#stripe')
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('🔴 «Poner mi tarjeta»: llama a getBillingPortalUrl con flujo PONER_TARJETA y returnUrl con ?portal=tarjeta, y navega a su url; nunca createPlanCheckoutSession, ni AddPaymentMethodDialog, ni POST …/setup-intent', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(prueba('SIN_TARJETA'), { origin: { ...PRUEBA_PRO, faltaTarjeta: true } }) as never)
    vi.mocked(getBillingPortalUrl).mockResolvedValue({ url: 'https://billing.stripe.example/p/1' } as never)
    renderPage()
    expect(
      (await screen.findAllByText(S.trialCardSummary.replace('{{date}}', '2026-12-10').replace('{{price}}', '$810.84'))).length,
    ).toBeGreaterThan(0)
    expect(screen.getByText(S.portalNote)).toBeInTheDocument()
    expect(review()).toHaveTextContent(S.addCard)
    await userEvent.click(review())
    await waitFor(() => expect(assign).toHaveBeenCalledWith('https://billing.stripe.example/p/1'))
    expect(getBillingPortalUrl).toHaveBeenCalledWith('venue', { flujo: 'PONER_TARJETA', returnUrl: `${SITIO}${PAGINA}?portal=tarjeta` })
    expect(createPlanCheckoutSession).not.toHaveBeenCalled()
    expect(screen.queryByText('formulario propio de tarjeta')).toBeNull()
    expect(api.post).not.toHaveBeenCalled()
    // La fila ya no dice «se renueva»: dice que falta la tarjeta.
    expect(
      screen.getByText(esBilling.plan.row.trialNoCard.replace('{{date}}', '2026-12-10').replace('{{tier}}', 'Pro')),
    ).toBeInTheDocument()
  })

  it('🔴 al volver con ?portal=tarjeta: CON_TARJETA → «Listo: al terminar tu prueba se cobrarán $810.84 en tu tarjeta ••••4242»; SIN_TARJETA → «Todavía no vemos tu tarjeta…»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(prueba('CON_TARJETA')) as never)
    const view = conDireccion('/?portal=tarjeta')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: listo('$810.84') }))
    // Se quitó el parámetro (recargar no vuelve a decirlo) y el plan se volvió a leer.
    expect(search).toBe('')
    expect(getVenuePlan).toHaveBeenCalled()
    view.unmount()
    toastSpy.mockReset()
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(prueba('SIN_TARJETA'), { origin: { ...PRUEBA_PRO, faltaTarjeta: true } }) as never)
    conDireccion('/?portal=tarjeta')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: S.cardNotYet }))
    expect(toastSpy.mock.calls.map(tituloDe)).not.toContain(listo('$810.84'))
  })

  // Fix 1 (revisión #2, decisión del coordinador): «Tu prueba terminó» SÓLO cuando el SERVIDOR dice TERMINADA. Sin
  // `estadoDeLaPrueba` el SERVIDOR también calla cuando no pudo leer Stripe o la tarjeta: una lectura fallida no concluye nada.
  it('🔴 b2-r5 #1 y b2-r6 #4: al volver con ?portal=tarjeta y la prueba ya TERMINADA (también con origin CLASSIC) → «Tu prueba terminó…» y lo que enseñe «Tu plan»; nunca «Listo»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(prueba('TERMINADA')) as never)
    conDireccion('/?portal=tarjeta')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: S.trialEnded }))
    const titulos = toastSpy.mock.calls.map(tituloDe)
    expect(titulos.some(titulo => String(titulo).startsWith('Listo'))).toBe(false)
    expect(titulos).not.toContain(S.cardNotYet)
    expect(titulos).not.toContain(S.portalBack)
  })

  it('🔴 fix 2 (revisión #2): sin estadoDeLaPrueba (Stripe no se pudo leer) con la fila en prueba CLASSIC → el aviso neutral; nunca «Tu prueba terminó» ni «Listo»', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(undefined) as never)
    conDireccion('/?portal=tarjeta')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: S.portalBack }))
    const titulos = toastSpy.mock.calls.map(tituloDe)
    expect(titulos).not.toContain(S.trialEnded)
    expect(titulos.some(titulo => String(titulo).startsWith('Listo'))).toBe(false)
  })

  it('fix 2: past_due o active sin estadoDeLaPrueba → el aviso neutral (lo demás lo enseña «Tu plan»), nunca «Tu prueba terminó»', async () => {
    const casos = [
      enPrueba(undefined, { state: 'past_due' }),
      plan(CLASSIC_PRO, { hasPlan: true, state: 'active', planTier: 'PRO', cotizacion: V2 }),
    ]
    for (const caso of casos) {
      toastSpy.mockReset()
      vi.mocked(getVenuePlan).mockResolvedValue(caso as never)
      const view = conDireccion('/?portal=tarjeta')
      await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: S.portalBack }))
      const titulos = toastSpy.mock.calls.map(tituloDe)
      expect(titulos).not.toContain(S.trialEnded)
      expect(titulos.some(titulo => String(titulo).startsWith('Listo'))).toBe(false)
      view.unmount()
    }
  })

  it('fix 3 (revisión #3): CON_TARJETA sin el monto de Stripe confirma la tarjeta sin la frase del monto', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba({ ...prueba('CON_TARJETA'), montoAlTerminarCents: null }) as never)
    conDireccion('/?portal=tarjeta')
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: S.cardAddedNoAmount.replace('{{last4}}', '4242') }))
    expect(toastSpy.mock.calls.map(tituloDe)).not.toContain(S.amountUnavailable)
    // «Tu selección» también dice la tarjeta, sin monto.
    expect(
      (await screen.findAllByText(S.trialWithCardNoAmount.replace('{{date}}', '2026-12-10').replace('{{last4}}', '4242'))).length,
    ).toBeGreaterThan(0)
  })

  it('503 PORTAL_NOT_CONFIGURED → enseña el mensaje del SERVIDOR y no navega', async () => {
    const mensaje = 'No pudimos abrir la página para poner tu tarjeta. Intenta en unos minutos.'
    vi.mocked(getVenuePlan).mockResolvedValue(enPrueba(prueba('SIN_TARJETA'), { origin: { ...PRUEBA_PRO, faltaTarjeta: true } }) as never)
    vi.mocked(getBillingPortalUrl).mockRejectedValue({
      response: { status: 503, data: { code: 'PORTAL_NOT_CONFIGURED', message: mensaje } },
    })
    renderPage()
    await waitFor(() => expect(review()).toHaveTextContent(S.addCard))
    await userEvent.click(review())
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(assign).not.toHaveBeenCalled()
  })

  it('🔴 409 OFFER_CHANGED al abrir el checkout → vuelve a pedir el plan, enseña el mensaje del SERVIDOR y no navega', async () => {
    const mensaje = 'La oferta cambió. Revisa el precio antes de pagar. No se te cobró nada.'
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { cotizacion: V2 }) as never)
    vi.mocked(createPlanCheckoutSession).mockRejectedValue({
      response: { status: 409, data: { code: 'OFFER_CHANGED', message: mensaje, details: { reason: 'VERSION', offerVersion: 3 } } },
    })
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    await userEvent.click(review())
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(createPlanCheckoutSession).toHaveBeenCalledTimes(1)
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PRO', 'monthly', { quoteToken: 'tok_92684' })
    await waitFor(() => expect(vi.mocked(getVenuePlan).mock.calls.length).toBeGreaterThan(1))
    expect(window.location.href).toBe(`${SITIO}${PAGINA}`)
  })

  it('fix 5 (revisión #7): QUOTE_EXPIRED, QUOTE_INVALID y PLAN_NOT_ON_SALE, uno por uno → vuelve a pedir el plan, enseña el mensaje del SERVIDOR y no navega', async () => {
    const rechazos = [
      {
        status: 409,
        code: 'QUOTE_EXPIRED',
        message: 'El precio que viste venció. Recarga la página para ver el vigente. No se te cobró nada.',
      },
      { status: 400, code: 'QUOTE_INVALID', message: 'No pudimos validar el precio que viste. Recarga la página. No se te cobró nada.' },
      { status: 409, code: 'PLAN_NOT_ON_SALE', message: 'El plan Pro ya no está a la venta. Elige otro plan. No se te cobró nada.' },
    ]
    for (const { status, code, message } of rechazos) {
      vi.mocked(getVenuePlan).mockReset()
      vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { cotizacion: V2 }) as never)
      vi.mocked(createPlanCheckoutSession).mockReset()
      vi.mocked(createPlanCheckoutSession).mockRejectedValue({ response: { status, data: { code, message } } })
      const view = renderPage()
      await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
      await userEvent.click(review())
      expect(await screen.findByText(message)).toBeInTheDocument()
      expect(createPlanCheckoutSession).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(vi.mocked(getVenuePlan).mock.calls.length).toBeGreaterThan(1))
      expect(window.location.href).toBe(`${SITIO}${PAGINA}`)
      view.unmount()
    }
  })

  it('fix 5 (revisión #7): si el reintento con el acceptanceId también falla, enseña el mensaje del SERVIDOR y no reintenta otra vez', async () => {
    const mensaje = 'Este negocio ya tiene un plan contratado. No se te cobró nada.'
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { cotizacion: V2 }) as never)
    vi.mocked(createPlanCheckoutSession)
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            code: 'PLAN_ACCEPTANCE_REQUIRED',
            message: 'Termina la contratación que empezaste al convertir tu negocio, o espera 30 minutos.',
            details: { acceptanceId: 'cacc1', tier: 'PREMIUM', interval: 'annual' },
          },
        },
      })
      .mockRejectedValueOnce({ response: { status: 409, data: { code: 'PLAN_YA_CONTRATADO', message: mensaje } } })
      .mockResolvedValue('https://checkout.stripe.example/nunca')
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    await userEvent.click(review())
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(createPlanCheckoutSession).toHaveBeenCalledTimes(2)
    expect(createPlanCheckoutSession).toHaveBeenNthCalledWith(2, 'venue', 'PREMIUM', 'annual', { acceptanceId: 'cacc1' })
    expect(window.location.href).toBe(`${SITIO}${PAGINA}`)
  })

  it('fix 5 (revisión #7): con el acceptanceId ya enviado, otro 409 PLAN_ACCEPTANCE_REQUIRED no se reintenta: el mensaje del SERVIDOR', async () => {
    const mensaje = 'Termina la contratación que empezaste al convertir tu negocio, o espera 30 minutos.'
    const aceptacionPendiente = { acceptanceId: 'cacc1', tier: 'PREMIUM', interval: 'annual', expiresAt: FIN }
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({}, { cotizacion: { versionNumber: 3, planes: SIN_PLANES, aceptacionPendiente } }) as never,
    )
    vi.mocked(createPlanCheckoutSession).mockRejectedValue({
      response: {
        status: 409,
        data: { code: 'PLAN_ACCEPTANCE_REQUIRED', message: mensaje, details: { acceptanceId: 'cacc2', tier: 'PRO', interval: 'monthly' } },
      },
    })
    renderPage()
    expect((await screen.findAllByText(S.finishAcceptance.replace('{{tier}}', 'Premium'))).length).toBeGreaterThan(0)
    await userEvent.click(review())
    expect(await screen.findByText(mensaje)).toBeInTheDocument()
    expect(createPlanCheckoutSession).toHaveBeenCalledTimes(1)
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PREMIUM', 'annual', { acceptanceId: 'cacc1' })
  })

  it('🔴 b2-r7 #4 (el caso de Codex): la respuesta de convert-from-demo se perdió; en «Tu plan» el checkout responde 409 PLAN_ACCEPTANCE_REQUIRED con { acceptanceId, tier: PREMIUM, interval: annual } → reintenta con ese acceptanceId, ese plan y esa periodicidad, y navega a la url del checkout', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan({}, { cotizacion: V2 }) as never)
    vi.mocked(createPlanCheckoutSession)
      .mockRejectedValueOnce({
        response: {
          status: 409,
          data: {
            code: 'PLAN_ACCEPTANCE_REQUIRED',
            message: 'Termina la contratación que empezaste al convertir tu negocio, o espera 30 minutos.',
            details: { acceptanceId: 'cacc1', tier: 'PREMIUM', interval: 'annual' },
          },
        },
      })
      .mockResolvedValueOnce('https://checkout.stripe.example/c/1')
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Pro/ }))
    await userEvent.click(review())
    await waitFor(() => expect(createPlanCheckoutSession).toHaveBeenCalledTimes(2))
    expect(createPlanCheckoutSession).toHaveBeenNthCalledWith(1, 'venue', 'PRO', 'monthly', { quoteToken: 'tok_92684' })
    expect(createPlanCheckoutSession).toHaveBeenNthCalledWith(2, 'venue', 'PREMIUM', 'annual', { acceptanceId: 'cacc1' })
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.example/c/1'))
  })

  it('🔴 b2-r9 #5 (el caso de Codex): «Terminar la compra que empezaste» → checkout pagado → al volver de Stripe, el plan releído ya no trae aceptacionPendiente (el SERVIDOR la ve usada) → la acción desaparece y queda el plan comprado', async () => {
    const terminar = S.finishAcceptance.replace('{{tier}}', 'Premium')
    const aceptacionPendiente = { acceptanceId: 'cacc1', tier: 'PREMIUM', interval: 'annual', expiresAt: FIN }
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan({}, { cotizacion: { versionNumber: 3, planes: SIN_PLANES, aceptacionPendiente } }) as never,
    )
    vi.mocked(createPlanCheckoutSession).mockResolvedValue('https://checkout.stripe.example/c/2')
    const view = renderPage()
    expect((await screen.findAllByText(terminar)).length).toBeGreaterThan(0)
    await userEvent.click(review())
    await waitFor(() => expect(window.location.href).toBe('https://checkout.stripe.example/c/2'))
    expect(createPlanCheckoutSession).toHaveBeenCalledWith('venue', 'PREMIUM', 'annual', { acceptanceId: 'cacc1' })
    view.unmount()
    const PREMIUM_PAGADO = { ...CLASSIC_PRO, tier: 'PREMIUM', price: { base: 16990, gross: 19708.4, currency: 'MXN' }, interval: 'year' }
    vi.mocked(getVenuePlan).mockResolvedValue(
      plan(PREMIUM_PAGADO, {
        hasPlan: true,
        state: 'active',
        planTier: 'PREMIUM',
        cotizacion: { versionNumber: 3, planes: SIN_PLANES },
      }) as never,
    )
    renderPage('/?checkout=success')
    const premium = await screen.findByRole('radio', { name: /Premium/ })
    await waitFor(() => expect(within(premium).getByText(esBilling.plan.row.current)).toBeInTheDocument())
    expect(screen.queryByText(terminar)).toBeNull()
  })
})
