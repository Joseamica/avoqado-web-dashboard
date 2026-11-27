/**
 * Planes editables (B2, Task 11): el alta cita la versión del editor (`planQuote.oferta`), con tarjeta y sin ella.
 *
 * 🔴 Lo que fija este archivo:
 *  - sin `planQuote.oferta` (el SERVIDOR de hoy o B2 sin versión del editor) nada cambia: el mismo cuerpo y el SetupIntent al montar;
 *  - con la oferta, cada compra manda el comprobante (`quoteToken`) de la opción que el SERVIDOR cotizó, y la ventana enseña SU
 *    precio y SU fecha, nunca una calculada aquí;
 *  - la prueba sin tarjeta no pide nada a Stripe para la tarjeta (ni SetupIntent ni formulario), y la ventana dice, leído al
 *    abrirse, qué tarjeta cobraría Stripe; una lectura fallida nunca se dice «sin tarjeta»;
 *  - «Confirmar mi pago» retoma el reto del banco sin depender de una opción cotizada;
 *  - la prueba que terminó sin tarjeta (con cualquiera de sus dos 409) saca del asistente con el alta en Gratis.
 */
import { useEffect, useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const activatePlan = vi.fn()
const saveStep = vi.fn()
const planSetupIntent = vi.fn()
const tarjetaDeLaPrueba = vi.fn()
const retomarPago = vi.fn()
const getProgress = vi.fn()
const completeSetup = vi.fn()
const confirmSetup = vi.fn()
const navigate = vi.fn()

const confirmCardPayment = vi.hoisted(() => vi.fn())
const secretMontado = vi.hoisted(() => ({ actual: undefined as string | undefined }))
vi.mock('@/services/setup.service', () => ({
  setupService: {
    activatePlan: (...a: unknown[]) => activatePlan(...a),
    saveStep: (...a: unknown[]) => saveStep(...a),
    planSetupIntent: (...a: unknown[]) => planSetupIntent(...a),
    tarjetaDeLaPrueba: (...a: unknown[]) => tarjetaDeLaPrueba(...a),
    retomarPago: (...a: unknown[]) => retomarPago(...a),
    getProgress: (...a: unknown[]) => getProgress(...a),
    completeSetup: (...a: unknown[]) => completeSetup(...a),
    acceptTerms: vi.fn(),
    attachLaunchCampaign: vi.fn(),
  },
}))
vi.mock('@/lib/gtag', () => ({ trackPurchase: vi.fn(), trackSignup: vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
const toastEstable = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastEstable }) }))
// El Básico: publicado o no según la prueba (sin el mock, `usePublicBasicPlan` pegaría a la red de verdad).
const getPublicBasicPlan = vi.hoisted(() => vi.fn())
vi.mock('@/services/hybridBilling.service', () => ({ getPublicBasicPlan: (...a: unknown[]) => getPublicBasicPlan(...a) }))
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }))
vi.mock('@/components/layouts/SetupWizardLayout', () => ({
  SetupWizardLayout: ({ children }: { children: React.ReactNode }) => <div data-testid="layout">{children}</div>,
}))
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({ confirmCardPayment: (...a: unknown[]) => confirmCardPayment(...a) }),
}))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children, options }: { children: React.ReactNode; options?: { clientSecret?: string } }) => {
    const [inicial] = useState(options?.clientSecret)
    secretMontado.actual = inicial
    return (
      <div data-testid="elements" data-secret={inicial}>
        {children}
      </div>
    )
  },
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({ secret: secretMontado.actual }),
}))
vi.mock('react-i18next', () => import('./traduccionesDePrueba'))

import { OfferStep } from '../steps/OfferStep'
import ShortSetupWizard from '../ShortSetupWizard'
import type { OfertaDelAlta, OpcionCotizada, PlanCotizado, PlanQuote } from '../launchOffer.types'

// ── La oferta de prueba: Pro sin tarjeta 14 días (fin 15-dic), Premium con tarjeta y 0 días ($1,970.84) ──
const FIN_PRO = '2026-12-15T18:00:00.000Z'

function opcion(quoteToken: string, precioCents: number, netCents: number, trialEndsAt: string | null): OpcionCotizada {
  return { quoteToken, precioCents, netCents, firstChargeCents: trialEndsAt ? 0 : precioCents, trialEndsAt }
}

const PRO_SIN_TARJETA: PlanCotizado = {
  displayName: 'Pro',
  onSale: true,
  requiresCard: false,
  trialDays: 14,
  monthly: opcion('tok-pro-mes', 92684, 79900, FIN_PRO),
  annual: opcion('tok-pro-anual', 926840, 799000, FIN_PRO),
}
const PREMIUM_HOY: PlanCotizado = {
  displayName: 'Premium',
  onSale: true,
  requiresCard: true,
  trialDays: 0,
  monthly: opcion('tok-premium-mes', 197084, 169900, null),
  annual: opcion('tok-premium-anual', 1970840, 1699000, null),
}
const FUERA_DE_VENTA = (displayName: string): PlanCotizado => ({
  displayName,
  onSale: false,
  requiresCard: true,
  trialDays: 0,
  monthly: null,
  annual: null,
})

function ofertaCon(planes: Partial<OfertaDelAlta['planes']> = {}): OfertaDelAlta {
  return { versionNumber: 2, free: { displayName: 'Gratis' }, planes: { PRO: PRO_SIN_TARJETA, PREMIUM: PREMIUM_HOY, ...planes } }
}

function quoteCon(oferta: OfertaDelAlta | undefined): PlanQuote {
  return {
    currency: 'MXN',
    ivaIncluded: true,
    trialDays: 14,
    tiers: {
      PRO: { monthlyCents: 92684, annualCents: 926840, monthlyNetCents: 79900, annualNetCents: 799000, intro: null },
      PREMIUM: { monthlyCents: 197084, annualCents: 1970840, monthlyNetCents: 169900, annualNetCents: 1699000, intro: null },
    },
    ...(oferta ? { oferta } : {}),
  }
}

/** El `planQuote` de hoy (sin versión del editor): el que publica el SERVIDOR sin `oferta`. */
const QUOTE_DE_HOY: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: {
      monthlyCents: 115884,
      annualCents: 1158840,
      intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true },
    },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
  },
}

const exito = (extra: Record<string, unknown> = {}) => ({
  data: {
    data: {
      status: 'ACTIVE',
      alreadyActive: false,
      tier: 'PRO',
      interval: 'monthly',
      firstChargeCents: 0,
      nextChargeAt: FIN_PRO,
      ...extra,
    },
  },
})

function errorHttp(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { response: { status, data: { code, message: `mensaje-${code}`, ...extra } } }
}

const onActivated = vi.fn()
const onFinish = vi.fn()
const onRefreshProgress = vi.fn()
const onFreePlan = vi.fn()

function pintar(planQuote: PlanQuote, props: Partial<React.ComponentProps<typeof OfferStep>> = {}) {
  return render(
    <OfferStep
      organizationId="org_1"
      venueId="venue_1"
      launchOffer={null}
      planQuote={planQuote}
      onActivated={onActivated}
      onFinish={onFinish}
      onRefreshProgress={onRefreshProgress}
      onFreePlan={onFreePlan}
      {...props}
    />,
  )
}

const ventana = () => screen.getByRole('dialog')

/** Abre la ventana de un plan; con tarjeta, espera el formulario de Stripe. */
async function abrir(plan: 'Pro' | 'Premium', user = userEvent.setup(), conTarjeta = false) {
  await user.click(await screen.findByRole('button', { name: `Elegir ${plan}` }))
  await screen.findByRole('dialog')
  if (conTarjeta) await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  return user
}

const CUERPO_PRO_SIN_TARJETA = {
  tier: 'PRO',
  interval: 'monthly',
  payNow: false,
  offer: { kind: 'STANDARD_SIN_TARJETA', expectedFirstChargeCents: 0, quoteToken: 'tok-pro-mes' },
  language: 'es',
}

beforeEach(() => {
  toastEstable.mockReset()
  getPublicBasicPlan.mockReset().mockResolvedValue(null)
  activatePlan.mockReset()
  saveStep.mockReset().mockResolvedValue({})
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti_secret' } } })
  tarjetaDeLaPrueba.mockReset().mockResolvedValue({ tarjeta: null })
  retomarPago.mockReset().mockResolvedValue({ estado: 'NADA' })
  getProgress.mockReset()
  completeSetup.mockReset().mockResolvedValue({ data: { success: true } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_123' } })
  confirmCardPayment.mockReset().mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
  navigate.mockReset()
  onActivated.mockReset()
  onFinish.mockReset()
  onRefreshProgress.mockReset().mockResolvedValue(undefined)
  onFreePlan.mockReset()
})

describe('sin versión del editor: el alta de hoy', () => {
  it('🔴 sin planQuote.oferta, el cuerpo de activate-plan es exactamente el de hoy y el SetupIntent se pide al montar', async () => {
    activatePlan.mockResolvedValue(exito())
    pintar(QUOTE_DE_HOY)
    // Al montar, antes de tocar nada.
    await waitFor(() => expect(planSetupIntent).toHaveBeenCalledTimes(1))
    expect(planSetupIntent).toHaveBeenCalledWith('venue_1')

    const user = await abrir('Pro', undefined, true)
    await user.click(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PRO',
      interval: 'monthly',
      payNow: false,
      paymentMethodId: 'pm_123',
      offer: { kind: 'STANDARD', expectedFirstChargeCents: 0 },
      language: 'es',
    })
    // Nada de lo nuevo: ni la lectura de la tarjeta ni la nota del saldo.
    expect(tarjetaDeLaPrueba).not.toHaveBeenCalled()
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
  })
})

describe('con la versión del editor: con tarjeta', () => {
  it('🔴 Pro con tarjeta y 30 días: el cuerpo lleva quoteToken, expectedFirstChargeCents 0 y payNow false; la fecha de la ventana es la trialEndsAt del SERVIDOR', async () => {
    activatePlan.mockResolvedValue(exito())
    // 8 de enero: NO es hoy + 30 días. Si la ventana calculara la fecha, diría otra.
    const FIN = '2027-01-08T18:00:00.000Z'
    const proConTarjeta: PlanCotizado = {
      ...PRO_SIN_TARJETA,
      requiresCard: true,
      trialDays: 30,
      monthly: opcion('tok-pro-30', 92684, 79900, FIN),
    }
    pintar(quoteCon(ofertaCon({ PRO: proConTarjeta })))
    const user = await abrir('Pro', undefined, true)

    const v = ventana()
    expect(within(v).getByText('Empieza tu prueba de Pro')).toBeInTheDocument()
    expect(within(v).getByText('30 días gratis. Cancela antes y no se te cobra.')).toBeInTheDocument()
    expect(within(v).getByText('Primer cobro: 8 de enero')).toBeInTheDocument()
    expect(within(v).getByText('$799.00 + IVA = $926.84')).toBeInTheDocument()
    expect(within(v).getByText(/desde el 8 de enero se cobren \$926\.84 al mes/)).toBeInTheDocument()
    expect(within(v).getByText('Si tu cuenta tiene saldo a favor o pendiente en Stripe, se aplica en tu recibo.')).toBeInTheDocument()

    await user.click(within(v).getByRole('button', { name: 'Empezar mis 30 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PRO',
      interval: 'monthly',
      payNow: false,
      paymentMethodId: 'pm_123',
      offer: { kind: 'STANDARD', expectedFirstChargeCents: 0, quoteToken: 'tok-pro-30' },
      language: 'es',
    })
    // Con la oferta no hay Básico: el cuerpo no lo lleva aunque el plan guardado lo dijera.
    expect(activatePlan.mock.calls[0][1]).not.toHaveProperty('basicPlan')
  })

  it('Premium con 0 días: la ventana dice «Pagar $1,970.84 y entrar» y el cuerpo va con payNow true y su quoteToken', async () => {
    activatePlan.mockResolvedValue(exito({ tier: 'PREMIUM', firstChargeCents: 197084 }))
    pintar(quoteCon(ofertaCon()))
    const user = await abrir('Premium', undefined, true)

    const v = ventana()
    expect(within(v).getByText('Contrata Premium')).toBeInTheDocument()
    expect(within(v).getByText('$1,970.84')).toBeInTheDocument()
    await user.click(within(v).getByRole('button', { name: 'Pagar $1,970.84 y entrar' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PREMIUM',
      interval: 'monthly',
      payNow: true,
      paymentMethodId: 'pm_123',
      offer: { kind: 'STANDARD', expectedFirstChargeCents: 197084, quoteToken: 'tok-premium-mes' },
      language: 'es',
    })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('🔴 b2-r8 #2 y #4: con 0 días el botón dice «Pagar $926.84» y el legal «$926.84 al mes» (el precio de la versión), con la nota del saldo; sin tarjeta, el mismo precio y la misma nota', async () => {
    const pro0Dias: PlanCotizado = {
      ...PRO_SIN_TARJETA,
      requiresCard: true,
      trialDays: 0,
      monthly: opcion('tok-pro-0', 92684, 79900, null),
    }
    const conTarjeta = pintar(quoteCon(ofertaCon({ PRO: pro0Dias })))
    await abrir('Pro', undefined, true)
    let v = ventana()
    expect(within(v).getByRole('button', { name: 'Pagar $926.84 y entrar' })).toBeInTheDocument()
    expect(within(v).getByText(/cobrar \$926\.84 al mes a esta tarjeta/)).toBeInTheDocument()
    expect(within(v).getByText('Si tu cuenta tiene saldo a favor o pendiente en Stripe, se aplica en tu recibo.')).toBeInTheDocument()
    conTarjeta.unmount()

    // Sin tarjeta (con una guardada): el MISMO precio de la versión, con la misma nota.
    tarjetaDeLaPrueba.mockResolvedValue({ tarjeta: { id: 'pm_guardada', brand: 'visa', last4: '4242' } })
    pintar(quoteCon(ofertaCon()))
    await abrir('Pro')
    v = ventana()
    expect(await within(v).findByText(/se cobrarán \$926\.84 en tu tarjeta/)).toBeInTheDocument()
    expect(within(v).getByText('Si tu cuenta tiene saldo a favor o pendiente en Stripe, se aplica en tu recibo.')).toBeInTheDocument()
  })
})

describe('con la versión del editor: la ventana abierta pasa de sin tarjeta a con tarjeta (Minor 6)', () => {
  it('🔴 una relectura del progreso trae el MISMO plan abierto ahora con tarjeta: se pide el SetupIntent una sola vez y sale el formulario, no «Cargando…» para siempre', async () => {
    const { rerender } = pintar(quoteCon(ofertaCon()))
    await abrir('Pro')
    expect(planSetupIntent).not.toHaveBeenCalled()
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument()

    rerender(
      <OfferStep
        organizationId="org_1"
        venueId="venue_1"
        launchOffer={null}
        planQuote={quoteCon(ofertaCon({ PRO: { ...PRO_SIN_TARJETA, requiresCard: true } }))}
        onActivated={onActivated}
        onFinish={onFinish}
        onRefreshProgress={onRefreshProgress}
        onFreePlan={onFreePlan}
      />,
    )
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
  })
})

describe('con la versión del editor: sin tarjeta', () => {
  it('🔴 Pro sin tarjeta: la ventana no monta el formulario de tarjeta; «Empezar mis 14 días gratis» manda offer.kind STANDARD_SIN_TARJETA, sin paymentMethodId, con su quoteToken; con el 200, guarda el respaldo con sinTarjeta y avanza', async () => {
    activatePlan.mockResolvedValue(
      exito({ trialModality: 'RENEWS_AS_PRO', trialEndsAt: FIN_PRO, sinTarjeta: true, tarjetaQueCobrara: null }),
    )
    pintar(quoteCon(ofertaCon()))
    const user = await abrir('Pro')

    const v = ventana()
    expect(within(v).getByText('Empieza tu prueba de Pro')).toBeInTheDocument()
    expect(within(v).getByText('14 días gratis, sin tarjeta.')).toBeInTheDocument()
    expect(within(v).getByText('$0.00')).toBeInTheDocument()
    expect(within(v).queryByText(/Primer cobro/)).not.toBeInTheDocument()
    expect(screen.queryByTestId('elements')).not.toBeInTheDocument()
    expect(screen.queryByTestId('payment-element')).not.toBeInTheDocument()
    expect(
      await within(v).findByText(
        'Tu prueba termina el 15 de diciembre. Para seguir con Pro, pon tu tarjeta antes en «Tu plan»; si no, ese día tu negocio sigue en Gratis. No te pedimos tarjeta ahora.',
      ),
    ).toBeInTheDocument()

    await user.click(within(v).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', CUERPO_PRO_SIN_TARJETA)
    expect(activatePlan.mock.calls[0][1]).not.toHaveProperty('paymentMethodId')
    // El respaldo del paso 10 va DESPUÉS del 200, con la marca de la prueba sin tarjeta.
    await waitFor(() =>
      expect(saveStep).toHaveBeenCalledWith('org_1', 10, {
        plan: expect.objectContaining({ tier: 'PRO', interval: 'monthly', payNow: false, sinTarjeta: true }),
      }),
    )
    expect(saveStep.mock.calls[0][2].plan).not.toHaveProperty('paymentMethodId')
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    expect(onActivated.mock.calls[0][0]).toMatchObject({ sinTarjeta: true, tarjetaQueCobrara: null })
    expect(confirmSetup).not.toHaveBeenCalled()
  })

  it('🔴 b2-r7 #1 / b2-r8 (el caso de Codex): progress se leyó sin tarjeta; al abrir la ventana, tarjetaDeLaPrueba ya trae ••••4242 → la ventana dice ANTES de confirmar «se cobrarán $926.84 en tu tarjeta Visa ••••4242…» y el cuerpo no lleva nada de la tarjeta', async () => {
    tarjetaDeLaPrueba.mockResolvedValue({ tarjeta: { id: 'pm_guardada', brand: 'visa', last4: '4242' } })
    activatePlan.mockResolvedValue(exito({ sinTarjeta: true }))
    pintar(quoteCon(ofertaCon()))
    // Montar no la lee: se lee al abrir la ventana, en ese momento.
    await screen.findByRole('button', { name: 'Elegir Pro' })
    expect(tarjetaDeLaPrueba).not.toHaveBeenCalled()

    const user = await abrir('Pro')
    const v = ventana()
    expect(
      await within(v).findByText(
        'Al terminar tu prueba el 15 de diciembre se cobrarán $926.84 en tu tarjeta Visa ••••4242; puedes quitarla o cambiarla antes en la página de Stripe desde «Tu plan».',
      ),
    ).toBeInTheDocument()
    expect(tarjetaDeLaPrueba).toHaveBeenCalledTimes(1)
    expect(tarjetaDeLaPrueba).toHaveBeenCalledWith('org_1')
    expect(activatePlan).not.toHaveBeenCalled()

    await user.click(within(v).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', CUERPO_PRO_SIN_TARJETA)
    const enviado = JSON.stringify(activatePlan.mock.calls[0][1])
    expect(enviado).not.toContain('pm_guardada')
    expect(enviado).not.toContain('4242')
  })

  it('🔴 una lectura de la tarjeta que falla NUNCA se dice «sin tarjeta»: el botón queda apagado con el aviso; con { tarjeta: null } sí', async () => {
    // Codex fix 5 del SERVIDOR: si Stripe falla, la ruta responde 503 `TARJETA_NO_LEIDA` (ya no `{ tarjeta: null }`).
    tarjetaDeLaPrueba.mockRejectedValue({
      response: { status: 503, data: { code: 'TARJETA_NO_LEIDA', message: 'No pudimos revisar tu cuenta de Stripe.' } },
    })
    pintar(quoteCon(ofertaCon()))
    const user = await abrir('Pro')
    const v = ventana()
    expect(await within(v).findByText('No pudimos revisar tu cuenta de Stripe. Intenta en unos minutos.')).toBeInTheDocument()
    expect(within(v).getByRole('button', { name: 'Empezar mis 14 días gratis' })).toBeDisabled()
    expect(within(v).queryByText(/pon tu tarjeta antes/)).not.toBeInTheDocument()
    expect(within(v).queryByText(/se cobrarán/)).not.toBeInTheDocument()
    // El aviso es el de la ventana: ningún toast de error encima.
    expect(toastEstable).not.toHaveBeenCalled()

    // Sin respuesta (la red): lo mismo.
    tarjetaDeLaPrueba.mockRejectedValue({ message: 'Network Error', code: 'ERR_NETWORK' })
    await user.click(within(v).getByRole('button', { name: 'Reintentar' }))
    expect(await within(v).findByText('No pudimos revisar tu cuenta de Stripe. Intenta en unos minutos.')).toBeInTheDocument()
    expect(within(v).getByRole('button', { name: 'Empezar mis 14 días gratis' })).toBeDisabled()
    expect(within(v).queryByText(/pon tu tarjeta antes/)).not.toBeInTheDocument()
    expect(toastEstable).not.toHaveBeenCalled()

    // Reintentar vuelve a leer en ese momento.
    tarjetaDeLaPrueba.mockResolvedValue({ tarjeta: null })
    await user.click(within(v).getByRole('button', { name: 'Reintentar' }))
    expect(await within(v).findByText(/pon tu tarjeta antes en «Tu plan»/)).toBeInTheDocument()
    expect(within(v).getByRole('button', { name: 'Empezar mis 14 días gratis' })).toBeEnabled()
    expect(tarjetaDeLaPrueba).toHaveBeenCalledTimes(3)
  })

  it('🔴 b2-r1 #4: con oferta, montar la pantalla y elegir Pro sin tarjeta hasta «Empezar» → setupService.planSetupIntent nunca se llama; elegir Premium lo llama una vez', async () => {
    activatePlan.mockRejectedValueOnce(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined' } }))
    pintar(quoteCon(ofertaCon()))
    const user = await abrir('Pro')
    await within(ventana()).findByText(/pon tu tarjeta antes/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    // Ni al montar, ni al abrir Pro, ni al empezar (ni tras un no del servidor).
    expect(planSetupIntent).not.toHaveBeenCalled()

    await user.click(within(ventana()).getByRole('button', { name: /Cerrar|Close|close/i }))
    await abrir('Premium', user, true)
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
  })

  it('🔴 un 503 sin tarjeta reintenta con el MISMO cuerpo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan
        .mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
        .mockResolvedValueOnce(exito({ sinTarjeta: true, tarjetaQueCobrara: null }))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar(quoteCon(ofertaCon()))
      await abrir('Pro', user)
      await within(ventana()).findByText(/pon tu tarjeta antes/)
      await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()
      // Mientras tanto, el plan no se cambia: el botón queda apagado.
      expect(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' })).toBeDisabled()
      expect(saveStep).not.toHaveBeenCalled()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(activatePlan.mock.calls[1]).toEqual(activatePlan.mock.calls[0])
      expect(activatePlan.mock.calls[1][1]).toEqual(CUERPO_PRO_SIN_TARJETA)
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
      expect(saveStep).toHaveBeenCalledTimes(1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 409 OFFER_CHANGED, PLAN_NOT_ON_SALE o QUOTE_EXPIRED → cierra la ventana, muestra el aviso y vuelve a pedir el progreso', async () => {
    for (const code of ['OFFER_CHANGED', 'PLAN_NOT_ON_SALE', 'QUOTE_EXPIRED', 'QUOTE_INVALID']) {
      activatePlan.mockReset().mockRejectedValue(errorHttp(code === 'QUOTE_INVALID' ? 400 : 409, code))
      onRefreshProgress.mockClear()
      const vista = pintar(quoteCon(ofertaCon()))
      const user = await abrir('Pro')
      await within(ventana()).findByText(/pon tu tarjeta antes/)
      await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      expect(screen.getByText('La oferta cambió. Revisa el precio nuevo antes de continuar.')).toBeInTheDocument()
      expect(onRefreshProgress).toHaveBeenCalledTimes(1)
      expect(saveStep).not.toHaveBeenCalled()
      expect(onActivated).not.toHaveBeenCalled()
      // Ningún candado queda puesto: el plan se puede volver a elegir.
      expect(screen.getByRole('button', { name: 'Elegir Pro' })).toBeEnabled()
      vista.unmount()
    }
  })

  it('con oferta no aparece la tarjeta del Básico aunque haya Básico publicado', async () => {
    getPublicBasicPlan.mockResolvedValue({
      name: 'Básico',
      slug: 'plan-basico',
      priceWithTax: '578.84',
      priceWithoutTax: '499.00',
      featureCodes: [],
      seatCap: 3,
      trialDays: 30,
      publicationId: 'pub_basico',
    })
    activatePlan.mockResolvedValue(exito({ sinTarjeta: true }))
    pintar(quoteCon(ofertaCon()), { data: { plan: { tier: 'PRO', interval: 'monthly', payNow: false, basicPlan: true } } })
    await screen.findByRole('button', { name: 'Elegir Pro' })
    // Deja que la lectura del Básico termine antes de mirar.
    await act(async () => {
      await Promise.resolve()
    })
    expect(screen.queryByRole('button', { name: 'Elegir Básico' })).not.toBeInTheDocument()
    expect(screen.queryByText('Básico')).not.toBeInTheDocument()
    // Aunque el plan guardado lo dijera, el cuerpo no lleva `basicPlan`.
    const user = await abrir('Pro')
    await within(ventana()).findByText(/pon tu tarjeta antes/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toEqual(CUERPO_PRO_SIN_TARJETA)
  })
})

describe('tras recargar con un intento sin cerrar (activacionEnCurso)', () => {
  it('🔴 b2-r8 #5 y #6: no hay segundo envío ni vista previa que apague «Confirmar mi pago»: tras recargar, con retomarPago en NADA, el botón abre la ventana y el pago va a activate-plan como hoy', async () => {
    activatePlan.mockResolvedValue(exito())
    const proConTarjeta: PlanCotizado = {
      ...PRO_SIN_TARJETA,
      requiresCard: true,
      trialDays: 30,
      monthly: opcion('tok-pro-30', 92684, 79900, '2027-01-08T18:00:00.000Z'),
    }
    const user = userEvent.setup()
    pintar(quoteCon(ofertaCon({ PRO: proConTarjeta })), { activacionEnCurso: true })
    const confirmar = await screen.findByRole('button', { name: 'Confirmar mi pago' })
    expect(confirmar).toBeEnabled()
    await user.click(confirmar)
    await waitFor(() => expect(retomarPago).toHaveBeenCalledTimes(1))
    expect(retomarPago).toHaveBeenCalledWith('org_1')
    // NADA ⇒ la ventana de hoy, con el formulario de tarjeta habilitado.
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 30 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toMatchObject({
      tier: 'PRO',
      paymentMethodId: 'pm_123',
      offer: { kind: 'STANDARD', expectedFirstChargeCents: 0, quoteToken: 'tok-pro-30' },
    })
    expect(confirmCardPayment).not.toHaveBeenCalled()
  })

  it('🔴 b2-r9 #2 (el caso de Codex): Premium de 0 días abre el reto y se pierde el 409; se publica una v3 sin planes en venta y se recarga (planQuote.oferta sin opciones, activacionEnCurso); «Confirmar mi pago» llama a retomarPago → RETO con el secreto original → confirmCardPayment(ese secreto) sin payment_method → retomarPago otra vez y onRefreshProgress; activatePlan nunca se llama', async () => {
    retomarPago.mockResolvedValueOnce({ estado: 'RETO', clientSecret: 'pi_original_secret' }).mockResolvedValueOnce({ estado: 'CERRADA' })
    const v3 = ofertaCon({ PRO: FUERA_DE_VENTA('Pro'), PREMIUM: FUERA_DE_VENTA('Premium') })
    const user = userEvent.setup()
    pintar(quoteCon(v3), { activacionEnCurso: true })
    await user.click(await screen.findByRole('button', { name: 'Confirmar mi pago' }))

    await waitFor(() => expect(confirmCardPayment).toHaveBeenCalledTimes(1))
    // El MISMO reto, sin `payment_method`: la tarjeta ya es la del cobro.
    expect(confirmCardPayment.mock.calls[0]).toEqual(['pi_original_secret'])
    await waitFor(() => expect(retomarPago).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalled())
    expect(activatePlan).not.toHaveBeenCalled()
    expect(planSetupIntent).not.toHaveBeenCalled()
  })

  it('M2: «Confirmar mi pago» sin ningún plan a la venta y retomarPago en NADA (o con error) → no abre una ventana que pida recargar: dice que se vuelva a comprobar y pide el progreso', async () => {
    const v3 = ofertaCon({ PRO: FUERA_DE_VENTA('Pro'), PREMIUM: FUERA_DE_VENTA('Premium') })
    const user = userEvent.setup()
    for (const respuesta of ['NADA', 'error'] as const) {
      retomarPago.mockReset()
      if (respuesta === 'NADA') retomarPago.mockResolvedValue({ estado: 'NADA' })
      else retomarPago.mockRejectedValue({ response: { status: 503, data: { code: 'PLAN_ACTIVATION_PENDING' } } })
      onRefreshProgress.mockClear()
      const vista = pintar(quoteCon(v3), { activacionEnCurso: true })
      await user.click(await screen.findByRole('button', { name: 'Confirmar mi pago' }))
      await waitFor(() => expect(retomarPago).toHaveBeenCalledTimes(1))
      expect(
        await screen.findByText('Todavía no podemos confirmar tu pago. Vuelve a comprobarlo en unos minutos; no se te cobrará dos veces.'),
      ).toBeInTheDocument()
      await waitFor(() => expect(onRefreshProgress).toHaveBeenCalledTimes(1))
      // Ninguna ventana con «Recarga la página»: no hay plan que cobrar y recargar no ayuda.
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
      expect(screen.queryByText(/Recarga la página/)).not.toBeInTheDocument()
      // La salida sigue ahí: volver a comprobar.
      expect(screen.getByRole('button', { name: 'Volver a comprobar mi pago' })).toBeEnabled()
      expect(activatePlan).not.toHaveBeenCalled()
      expect(planSetupIntent).not.toHaveBeenCalled()
      vista.unmount()
    }
  })

  it('b2-r9 #2: retomarPago CERRADA → onRefreshProgress sin abrir la ventana', async () => {
    retomarPago.mockResolvedValue({ estado: 'CERRADA' })
    const user = userEvent.setup()
    pintar(quoteCon(ofertaCon()), { activacionEnCurso: true })
    await user.click(await screen.findByRole('button', { name: 'Confirmar mi pago' }))
    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalledTimes(1))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(confirmCardPayment).not.toHaveBeenCalled()
    expect(activatePlan).not.toHaveBeenCalled()
  })

  it('🔴 b2-r2 #2: tras recargar con activacionEnCurso (un intento de Premium vencido) y Pro fuera de venta, Premium sin tarjeta se puede elegir y su cuerpo sale a activate-plan; ninguna tarjeta queda apagada por la recarga', async () => {
    activatePlan.mockResolvedValue(exito({ tier: 'PREMIUM', sinTarjeta: true }))
    const premiumSinTarjeta: PlanCotizado = {
      displayName: 'Premium',
      onSale: true,
      requiresCard: false,
      trialDays: 7,
      monthly: opcion('tok-premium-sin', 197084, 169900, '2026-12-03T18:00:00.000Z'),
      annual: null,
    }
    pintar(quoteCon(ofertaCon({ PRO: FUERA_DE_VENTA('Pro'), PREMIUM: premiumSinTarjeta })), { activacionEnCurso: true })
    // El aviso del cobro sin confirmar se queda…
    expect(await screen.findByText(/Tu último pago quedó sin confirmar/)).toBeInTheDocument()
    // …pero las tarjetas NO se apagan (Pro, fuera de venta, no tiene tarjeta).
    expect(screen.queryByRole('button', { name: 'Elegir Pro' })).not.toBeInTheDocument()
    const premium = screen.getByRole('button', { name: 'Elegir Premium' })
    expect(premium).toBeEnabled()

    const user = await abrir('Premium')
    await within(ventana()).findByText(/pon tu tarjeta antes/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 7 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PREMIUM',
      interval: 'monthly',
      payNow: false,
      offer: { kind: 'STANDARD_SIN_TARJETA', expectedFirstChargeCents: 0, quoteToken: 'tok-premium-sin' },
      language: 'es',
    })
  })
})

// ── El asistente entero: la pantalla final y la salida ──────────────────────────────────────────────────────────

function progresoDe(over: Record<string, unknown> = {}) {
  return {
    data: {
      featureFlags: { shortOnboarding: true },
      progress: {
        legal: { currentVersion: '2026-09-17', acceptedVersion: '2026-09-17', consentRequired: false },
        v2SetupData: { step2: { businessName: 'Mi negocio' }, step3: { businessType: 'CAFE' } },
        planActivation: { status: 'NONE', attempt: 0, activatedAt: null },
        launchOffer: null,
        planQuote: quoteCon(ofertaCon()),
        venueId: 'venue_1',
        completedAt: null,
        ...over,
      },
    },
  }
}

function pintarAsistente() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ShortSetupWizard organizationId="org_1" />
    </QueryClientProvider>,
  )
}

describe('la pantalla final y la salida del asistente', () => {
  it('🔴 b2-r8 #9: tras recargar, la pantalla final dice la tarjetaQueCobrara de progress (••••4242), no «pon tu tarjeta»', async () => {
    getProgress.mockResolvedValue(
      progresoDe({
        planActivation: {
          status: 'ACTIVE',
          attempt: 1,
          activatedAt: '2026-12-01T18:00:00.000Z',
          trialModality: 'RENEWS_AS_PRO',
          trialEndsAt: FIN_PRO,
          sinTarjeta: true,
          tarjetaQueCobrara: { brand: 'visa', last4: '4242' },
          noHabraCobro: false,
        },
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'PRO', interval: 'monthly', payNow: false, sinTarjeta: true },
        },
      }),
    )
    pintarAsistente()
    expect(
      await screen.findByText(
        'Tu prueba de Pro termina el 15 de diciembre; ese día se cobrará tu tarjeta ••••4242. Puedes quitarla en «Tu plan».',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/pon tu tarjeta/)).not.toBeInTheDocument()
  })

  it('la pantalla final dice la tarjetaQueCobrara de la respuesta (aunque difiera de la que enseñó la ventana)', async () => {
    getProgress.mockResolvedValue(progresoDe())
    tarjetaDeLaPrueba.mockResolvedValue({ tarjeta: { id: 'pm_a', brand: 'visa', last4: '4242' } })
    activatePlan.mockResolvedValue(
      exito({
        trialModality: 'RENEWS_AS_PRO',
        trialEndsAt: FIN_PRO,
        sinTarjeta: true,
        tarjetaQueCobrara: { brand: 'mastercard', last4: '5555' },
        noHabraCobro: false,
      }),
    )
    pintarAsistente()
    const user = await abrir('Pro')
    await within(ventana()).findByText(/tu tarjeta Visa ••••4242/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    expect(
      await screen.findByText(
        'Tu prueba de Pro termina el 15 de diciembre; ese día se cobrará tu tarjeta ••••5555. Puedes quitarla en «Tu plan».',
      ),
    ).toBeInTheDocument()
    expect(screen.queryByText(/4242/)).not.toBeInTheDocument()
  })

  it('🔴 b2-r3 #3: 409 PLAN_TRIAL_ENDED → muestra «Tu prueba terminó sin tarjeta…», vuelve a pedir el progreso y, con completedAt, sale del asistente', async () => {
    const MENSAJE = 'Tu prueba terminó sin tarjeta y tu negocio quedó en Gratis. No se te cobró nada.'
    getProgress.mockResolvedValueOnce(progresoDe()).mockResolvedValue(
      progresoDe({
        planActivation: { status: 'ACTIVE', attempt: 1, activatedAt: null },
        completedAt: '2026-12-16T00:00:00.000Z',
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'FREE', pruebaSinTarjetaTerminada: true },
        },
      }),
    )
    activatePlan.mockRejectedValue({ response: { status: 409, data: { code: 'PLAN_TRIAL_ENDED', message: MENSAJE } } })
    pintarAsistente()
    const user = await abrir('Pro')
    await within(ventana()).findByText(/pon tu tarjeta antes/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))

    // El aviso sale primero en la pantalla de planes y, al llegar el progreso con completedAt, el asistente la cambia por la
    // final con el MISMO aviso. Se espera la final: el elemento de la primera puede quedar desmontado (CI intermitente, 26-nov).
    await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('done-trial-ended')).toHaveTextContent(MENSAJE)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(saveStep).not.toHaveBeenCalled()
    // El alta ya quedó terminada en Gratis: la salida es «Entrar a Avoqado», que termina el alta como hoy y sale.
    await user.click(await screen.findByRole('button', { name: 'Entrar a Avoqado' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
    expect(completeSetup).toHaveBeenCalledTimes(1)
  })

  it('🔴 T6: tras cerrar en Gratis, el 409 PLAN_ALREADY_ACTIVATED con currentTier FREE sale igual: Gratis, el alta terminada y el aviso de la prueba', async () => {
    getProgress.mockResolvedValueOnce(progresoDe()).mockResolvedValue(
      progresoDe({
        planActivation: { status: 'ACTIVE', attempt: 1, activatedAt: null },
        completedAt: '2026-12-16T00:00:00.000Z',
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'FREE', pruebaSinTarjetaTerminada: true },
        },
      }),
    )
    activatePlan.mockRejectedValue(
      errorHttp(409, 'PLAN_ALREADY_ACTIVATED', { details: { currentTier: 'FREE', currentInterval: 'monthly' } }),
    )
    pintarAsistente()
    const user = await abrir('Premium', undefined, true)
    await user.click(within(ventana()).getByRole('button', { name: 'Pagar $1,970.84 y entrar' }))

    // Igual que el caso de arriba: se espera la pantalla final, no el aviso de la pantalla de planes que el asistente reemplaza.
    await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2))
    expect(await screen.findByTestId('done-trial-ended')).toHaveTextContent(
      'Tu prueba terminó sin tarjeta y tu negocio quedó en Gratis. No se te cobró nada.',
    )
    expect(screen.queryByText(/Ya tienes el plan FREE/)).not.toBeInTheDocument()
    await user.click(await screen.findByRole('button', { name: 'Entrar a Avoqado' }))
    await waitFor(() => expect(navigate).toHaveBeenCalledWith('/', { replace: true }))
  })

  const NEUTRO =
    'Tu prueba de Pro termina el 15 de diciembre. Revisa en «Tu plan» qué tarjeta se cobrará ese día; si no hay ninguna, tu negocio sigue en Gratis.'

  it('🔴 I1: la respuesta del cobro no trae la tarjeta (Stripe no dejó leerla) → la pantalla final dice el texto neutro, nunca «pon tu tarjeta»; el progreso se vuelve a pedir una vez', async () => {
    const ACTIVA_SIN_SABER = {
      status: 'ACTIVE',
      attempt: 1,
      activatedAt: '2026-12-01T18:00:00.000Z',
      trialModality: 'RENEWS_AS_PRO',
      trialEndsAt: FIN_PRO,
      sinTarjeta: true,
      noHabraCobro: false,
    }
    getProgress.mockResolvedValueOnce(progresoDe()).mockResolvedValue(progresoDe({ planActivation: ACTIVA_SIN_SABER, completedAt: null }))
    tarjetaDeLaPrueba.mockResolvedValue({ tarjeta: { id: 'pm_a', brand: 'visa', last4: '4242' } })
    // La ventana dijo Visa ••••4242; la lectura de la respuesta no alcanzó: `tarjetaQueCobrara` no viaja.
    activatePlan.mockResolvedValue(exito({ trialModality: 'RENEWS_AS_PRO', trialEndsAt: FIN_PRO, sinTarjeta: true, noHabraCobro: false }))
    pintarAsistente()
    const user = await abrir('Pro')
    await within(ventana()).findByText(/tu tarjeta Visa ••••4242/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))

    expect(await screen.findByText(NEUTRO)).toBeInTheDocument()
    await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2))
    expect(screen.getByText(NEUTRO)).toBeInTheDocument()
    expect(screen.queryByText(/pon tu tarjeta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/se cobrará tu tarjeta/)).not.toBeInTheDocument()
  })

  it('I1: la respuesta no trae la tarjeta y el progreso vuelto a pedir sí → la pantalla final dice esa tarjeta', async () => {
    getProgress.mockResolvedValueOnce(progresoDe()).mockResolvedValue(
      progresoDe({
        planActivation: {
          status: 'ACTIVE',
          attempt: 1,
          activatedAt: '2026-12-01T18:00:00.000Z',
          trialModality: 'RENEWS_AS_PRO',
          trialEndsAt: FIN_PRO,
          sinTarjeta: true,
          tarjetaQueCobrara: { brand: 'visa', last4: '4242' },
          noHabraCobro: false,
        },
      }),
    )
    activatePlan.mockResolvedValue(exito({ trialModality: 'RENEWS_AS_PRO', trialEndsAt: FIN_PRO, sinTarjeta: true }))
    pintarAsistente()
    const user = await abrir('Pro')
    await within(ventana()).findByText(/pon tu tarjeta antes/)
    await user.click(within(ventana()).getByRole('button', { name: 'Empezar mis 14 días gratis' }))
    expect(
      await screen.findByText(
        'Tu prueba de Pro termina el 15 de diciembre; ese día se cobrará tu tarjeta ••••4242. Puedes quitarla en «Tu plan».',
      ),
    ).toBeInTheDocument()
  })

  it('🔴 I1: tras recargar, el progreso no trae la tarjeta (Stripe no dejó leerla) → el texto neutro, nunca «pon tu tarjeta»', async () => {
    getProgress.mockResolvedValue(
      progresoDe({
        planActivation: {
          status: 'ACTIVE',
          attempt: 1,
          activatedAt: '2026-12-01T18:00:00.000Z',
          trialModality: 'RENEWS_AS_PRO',
          trialEndsAt: FIN_PRO,
          sinTarjeta: true,
          noHabraCobro: false,
        },
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'PRO', interval: 'monthly', payNow: false, sinTarjeta: true },
        },
      }),
    )
    pintarAsistente()
    expect(await screen.findByText(NEUTRO)).toBeInTheDocument()
    expect(screen.queryByText(/pon tu tarjeta/)).not.toBeInTheDocument()
    expect(screen.queryByText(/se cobrará tu tarjeta/)).not.toBeInTheDocument()
  })

  it('🔴 M1: completedAt manda aunque el SERVIDOR no haya podido leer la oferta (planQuote sin oferta): pantalla final, sin el aviso de pago sin confirmar', async () => {
    getProgress.mockResolvedValue(
      progresoDe({
        planQuote: QUOTE_DE_HOY,
        planActivation: { status: 'IN_PROGRESS', attempt: 1, activatedAt: null },
        completedAt: '2026-12-16T00:00:00.000Z',
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'PRO', interval: 'monthly', payNow: false, sinTarjeta: true },
        },
      }),
    )
    pintarAsistente()
    expect(await screen.findByRole('button', { name: 'Entrar a Avoqado' })).toBeInTheDocument()
    expect(screen.queryByText(/Tu último pago quedó sin confirmar/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar mi pago' })).not.toBeInTheDocument()
  })

  it('🔴 T6-C1: completedAt manda — con el cobro todavía IN_PROGRESS el alta está terminada: pantalla final, sin el aviso de pago sin confirmar', async () => {
    getProgress.mockResolvedValue(
      progresoDe({
        planActivation: { status: 'IN_PROGRESS', attempt: 1, activatedAt: null },
        completedAt: '2026-12-16T00:00:00.000Z',
        // Un plan de pago guardado: sin `completedAt` como autoridad, esto reanudaría en la oferta con el cobro «sin confirmar».
        v2SetupData: {
          step2: { businessName: 'Mi negocio' },
          step3: { businessType: 'CAFE' },
          plan: { tier: 'PRO', interval: 'monthly', payNow: false, sinTarjeta: true },
        },
      }),
    )
    pintarAsistente()
    expect(await screen.findByRole('button', { name: 'Entrar a Avoqado' })).toBeInTheDocument()
    expect(screen.queryByText(/Tu último pago quedó sin confirmar/)).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Confirmar mi pago' })).not.toBeInTheDocument()
  })
})

/** El párrafo bajo el título del paso de planes (las tarjetas repiten algunas frases). */
async function subtitulo() {
  const h1 = await screen.findByRole('heading', { level: 1 })
  return h1.parentElement!.querySelector('p')!.textContent
}

describe('A22: el subtítulo del paso de planes sale de la versión', () => {
  it('Pro 14 días sin tarjeta y Premium pagando hoy: una línea por plan', async () => {
    pintar(quoteCon(ofertaCon()))
    expect(await subtitulo()).toBe('Pro: 14 días gratis, sin tarjeta · Premium: pagas hoy')
  })

  it('los dos con 21 días y tarjeta: «21 días gratis»', async () => {
    const con21 = (p: PlanCotizado): PlanCotizado => ({ ...p, requiresCard: true, trialDays: 21 })
    pintar(quoteCon(ofertaCon({ PRO: con21(PRO_SIN_TARJETA), PREMIUM: con21(PREMIUM_HOY) })))
    expect(await subtitulo()).toBe('21 días gratis')
  })

  it('los dos con 21 días y sin tarjeta: «21 días gratis, sin tarjeta»', async () => {
    const sin = (p: PlanCotizado): PlanCotizado => ({ ...p, requiresCard: false, trialDays: 21 })
    pintar(quoteCon(ofertaCon({ PRO: sin(PRO_SIN_TARJETA), PREMIUM: sin(PREMIUM_HOY) })))
    expect(await subtitulo()).toBe('21 días gratis, sin tarjeta')
  })

  it('los dos en 0 días: «Pagas hoy y entras»', async () => {
    pintar(quoteCon(ofertaCon({ PRO: { ...PREMIUM_HOY, displayName: 'Pro' } })))
    expect(await subtitulo()).toBe('Pagas hoy y entras')
  })

  it('un plan fuera de venta no cuenta: con sólo Pro a la venta, su línea sola', async () => {
    pintar(quoteCon(ofertaCon({ PREMIUM: FUERA_DE_VENTA('Premium') })))
    expect(await subtitulo()).toBe('14 días gratis, sin tarjeta')
  })

  it('con 1 día: «1 día gratis» (singular)', async () => {
    const con1 = (p: PlanCotizado): PlanCotizado => ({ ...p, requiresCard: true, trialDays: 1 })
    pintar(quoteCon(ofertaCon({ PRO: con1(PRO_SIN_TARJETA), PREMIUM: con1(PREMIUM_HOY) })))
    expect(await subtitulo()).toBe('1 día gratis')
  })

  it('sin oferta: el texto de hoy', async () => {
    pintar(QUOTE_DE_HOY)
    expect(await subtitulo()).toBe('Pro y Premium: 30 días gratis. Cancela antes y no se te cobra.')
  })
})
