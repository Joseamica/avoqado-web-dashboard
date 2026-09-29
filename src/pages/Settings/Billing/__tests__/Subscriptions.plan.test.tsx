// src/pages/Settings/Billing/__tests__/Subscriptions.plan.test.tsx
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import Subscriptions from '../Subscriptions'
import { createPlanCheckoutSession, downgradeVenueToFree, getDowngradePreview, getVenuePlan } from '@/services/features.service'
import { hybridBilling } from '@/services/hybridBilling.service'
import esBilling from '@/locales/es/billing.json'

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

  it('Pro → Premium goes through a replacement with credit, never through "Cambiar selección"', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }],
      total: 1,
    } as never)
    renderPage()
    await userEvent.click(await screen.findByRole('radio', { name: /Premium/ }))
    expect(screen.getByText(/Lo que pagas hoy se calcula al revisar/)).toBeInTheDocument()
    await userEvent.click(review())
    await waitFor(() =>
      expect(hybridBilling.quote).toHaveBeenCalledWith('venue', {
        lines: [{ publicationId: 'pub_PREMIUM', selectedFeatureCodes: [] }],
        replaceSubscriptionIds: ['sub_classic'],
        dropFeatureCodes: [],
      }),
    )
  })

  it('a server refusal is shown as is, with the assisted change', async () => {
    vi.mocked(getVenuePlan).mockResolvedValue(plan(CLASSIC_PRO) as never)
    vi.mocked(hybridBilling.replacements).mockResolvedValue({
      ...noReplacements,
      items: [{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }],
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
    await waitFor(() => expect(toastSpy).toHaveBeenCalledWith({ title: esBilling.plan.checkoutSuccess }), { timeout: 8000 })
    expect(toastSpy).not.toHaveBeenCalledWith({ title: esBilling.plan.checkoutPending })
  }, 10000)
})
