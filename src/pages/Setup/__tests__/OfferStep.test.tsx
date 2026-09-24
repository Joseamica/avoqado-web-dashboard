/**
 * La pantalla de la oferta, RENDERIZADA (§4.5).
 *
 * 🔴 Es la pantalla donde se cobra. Lo que estas pruebas fijan:
 *  1. Pinta EXACTAMENTE los montos del servidor y manda de vuelta el mismo `firstChargeCents`.
 *  2. Un rechazo de tarjeta (402) NO avanza y NO escribe el respaldo `step/10` — escribirlo
 *     dejaría `v2SetupData.plan` listo para que el camino legacy cobre a precio de lista.
 *  3. Ningún 409 es un callejón: los dos «ya tienes plan» ofrecen un botón que TERMINA el alta.
 *  4. Una oferta que ya no está disponible NO se reintenta sola: se avisa y se enseña la vista
 *     estándar, donde el precio normal hay que volver a tocarlo.
 */
import { act, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const activatePlan = vi.fn()
const saveStep = vi.fn()
const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()
const trackPurchase = vi.fn()
const track = vi.fn()

vi.mock('@/services/setup.service', () => ({
  setupService: {
    activatePlan: (...a: unknown[]) => activatePlan(...a),
    saveStep: (...a: unknown[]) => saveStep(...a),
    planSetupIntent: (...a: unknown[]) => planSetupIntent(...a),
  },
}))
vi.mock('@/lib/gtag', () => ({ trackPurchase: (...a: unknown[]) => trackPurchase(...a), trackSignup: vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: (...a: unknown[]) => track(...a) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({}),
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => {
      const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
      return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
    },
    i18n: { language: 'es' },
  }),
}))
vi.mock('../steps/PlanStep', () => ({
  PlanStep: ({ quote }: { quote?: any }) => (
    <div data-testid="plan-step-estandar">
      <span>{`estandar:${quote?.tiers?.PRO?.monthlyCents ?? 'sin-cotizacion'}`}</span>
    </div>
  ),
}))

import { OfferStep } from '../steps/OfferStep'
import type { LaunchOfferView, PlanQuote } from '../launchOffer.types'

const OFERTA: LaunchOfferView = {
  code: 'POS22',
  slug: 'pos-22',
  offerVersion: 1,
  vertical: 'ALL',
  planTier: 'PRO',
  planName: 'Pro',
  available: true,
  currency: 'MXN',
  ivaIncluded: true,
  requiresCard: true,
  promo: { monthlyCents: 2200, months: 3, subtotalCents: 1897, ivaCents: 303, periodTotalCents: 6600 },
  renewal: { monthlyCents: 115884, subtotalCents: 99900, ivaCents: 15984 },
  firstChargeCents: 2200,
  validUntil: '2026-10-31T06:00:00.000Z',
  limited: true,
  copy: { headline: 'Tu punto de venta a $22 al mes', subheadline: null, bullets: [] },
}

const QUOTE: PlanQuote = {
  currency: 'MXN',
  ivaIncluded: true,
  trialDays: 30,
  tiers: {
    PRO: { monthlyCents: 115884, annualCents: 1158840, intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true } },
    PREMIUM: { monthlyCents: 197084, annualCents: 1970840, intro: null },
  },
}

function errorHttp(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { response: { status, data: { code, message: `mensaje-${code}`, ...extra } } }
}

const onActivated = vi.fn()
const onFinish = vi.fn()
const onRefreshProgress = vi.fn()

function pintar(props: Partial<React.ComponentProps<typeof OfferStep>> = {}) {
  return render(
    <OfferStep
      organizationId="org_1"
      venueId="venue_1"
      launchOffer={OFERTA}
      planQuote={QUOTE}
      onActivated={onActivated}
      onFinish={onFinish}
      onRefreshProgress={onRefreshProgress}
      {...props}
    />,
  )
}

async function pagar() {
  const user = userEvent.setup()
  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  await user.click(screen.getByRole('button', { name: /pagar/i }))
}

beforeEach(() => {
  activatePlan.mockReset()
  saveStep.mockReset().mockResolvedValue({})
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti_secret' } } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_123' } })
  trackPurchase.mockReset()
  track.mockReset()
  onActivated.mockReset()
  onFinish.mockReset()
  onRefreshProgress.mockReset().mockResolvedValue(undefined)
})

describe('OfferStep — lo que pinta', () => {
  it('pinta los montos del servidor: promo, meses, renovación, IVA y lo que se cobra hoy', async () => {
    pintar()
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())

    expect(screen.getAllByText(/\$22\.00/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/3 meses/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/\$1,158\.84/).length).toBeGreaterThan(0)
    expect(screen.getByText('$3.03')).toBeInTheDocument()
    expect(screen.getByText(/Hoy pagas/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pagar \$22\.00 y entrar/i })).toBeInTheDocument()
  })

  it('el desglose de IVA solo sale si el servidor lo mandó', async () => {
    const sinIva = { ...OFERTA, promo: { ...OFERTA.promo, ivaCents: 0 } }
    pintar({ launchOffer: sinIva })
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(screen.queryByText('$3.03')).not.toBeInTheDocument()
  })

  it('este camino NO ofrece prueba gratis: un solo botón', async () => {
    pintar()
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(screen.queryByText(/30 días gratis/i)).not.toBeInTheDocument()
  })

  it('una oferta reclamada pero NO disponible avisa y enseña la vista estándar', async () => {
    pintar({ launchOffer: { code: 'POS22', slug: 'pos-22', available: false, unavailableReason: 'SOLD_OUT' } })
    expect(await screen.findByTestId('plan-step-estandar')).toBeInTheDocument()
    expect(screen.getByText(/POS22/)).toBeInTheDocument()
    expect(activatePlan).not.toHaveBeenCalled()
  })

  it('sin campaña abre directo en la vista estándar con la cotización del servidor', async () => {
    pintar({ launchOffer: null })
    expect(await screen.findByTestId('plan-step-estandar')).toBeInTheDocument()
    expect(screen.getByText('estandar:115884')).toBeInTheDocument()
  })
})

describe('OfferStep — el cobro', () => {
  it('manda EXACTAMENTE el cuerpo del contrato y avisa al asistente', async () => {
    activatePlan.mockResolvedValue({
      data: { data: { status: 'ACTIVE', alreadyActive: false, tier: 'PRO', interval: 'monthly', firstChargeCents: 2200, nextChargeAt: '2026-10-17T00:00:00.000Z' } },
    })

    pintar()
    await pagar()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PRO',
      interval: 'monthly',
      payNow: true,
      paymentMethodId: 'pm_123',
      offer: { kind: 'LAUNCH', code: 'POS22', offerVersion: 1, expectedFirstChargeCents: 2200 },
      language: 'es',
    })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    // El respaldo del paso 10 va DESPUÉS del 200, nunca antes.
    expect(saveStep).toHaveBeenCalledWith('org_1', 10, expect.objectContaining({ plan: expect.objectContaining({ tier: 'PRO', payNow: true }) }))
    // La conversión de dinero se reporta en PESOS, no en centavos.
    expect(trackPurchase).toHaveBeenCalledWith(22, 'POS22')
  })

  it('🔴 un rechazo del banco (402) muestra el mensaje, NO avanza y NO escribe el respaldo step/10', async () => {
    activatePlan.mockRejectedValue(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined', message: 'Tu banco rechazó el cargo' } }))

    pintar()
    await pagar()

    expect(await screen.findByText(/Tu banco rechazó el cargo/)).toBeInTheDocument()
    expect(onActivated).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
    expect(screen.getByTestId('payment-element')).toBeInTheDocument()
  })

  it('409 PLAN_ALREADY_ACTIVATED no es un callejón: hay un botón que TERMINA el alta', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'PLAN_ALREADY_ACTIVATED', { details: { currentTier: 'PREMIUM' } }))

    pintar()
    await pagar()

    const boton = await screen.findByRole('button', { name: /Entrar a Avoqado/i })
    await userEvent.setup().click(boton)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('409 PLAN_ACTIVE_WITHOUT_OFFER explica que la oferta no se aplica y deja entrar — nunca dice que se cobró', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'PLAN_ACTIVE_WITHOUT_OFFER', { details: { currentTier: 'PRO', currentInterval: 'monthly' } }))

    pintar()
    await pagar()

    expect(await screen.findByRole('button', { name: /Entrar a Avoqado/i })).toBeInTheDocument()
    expect(screen.queryByText(/recibimos tu pago|pago confirmado/i)).not.toBeInTheDocument()
    expect(saveStep).not.toHaveBeenCalled()
  })

  it('409 LAUNCH_OFFER_UNAVAILABLE avisa, pide el progreso otra vez y NO vuelve a llamar a activate-plan', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'LAUNCH_OFFER_UNAVAILABLE', { details: { reason: 'SOLD_OUT' } }))

    pintar()
    await pagar()

    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalledTimes(1))
    expect(await screen.findByTestId('plan-step-estandar')).toBeInTheDocument()
    expect(activatePlan).toHaveBeenCalledTimes(1)
  })

  it('409 OFFER_CHANGED vuelve a pedir el progreso: se consiente el precio NUEVO, no el viejo', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'OFFER_CHANGED', {}))

    pintar()
    await pagar()

    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalledTimes(1))
    expect(onActivated).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
  })

  it('503 reintenta el MISMO cuerpo a los 10 s y al cerrar en éxito termina el alta', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan
        .mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
        .mockResolvedValueOnce({
          data: { data: { status: 'ACTIVE', alreadyActive: false, tier: 'PRO', interval: 'monthly', firstChargeCents: 2200, nextChargeAt: '2026-10-17T00:00:00.000Z' } },
        })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /pagar/i }))

      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })

      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(activatePlan.mock.calls[1]).toEqual(activatePlan.mock.calls[0])
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    } finally {
      vi.useRealTimers()
    }
  })

  it('503 que nunca se resuelve se rinde después de 3 reintentos y lo DICE', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /pagar/i }))

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000)
        })
      }

      await waitFor(() => expect(screen.getByText(/vuelve en unos minutos/i)).toBeInTheDocument())
      expect(activatePlan.mock.calls.length).toBeLessThanOrEqual(4)
      expect(onActivated).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('409 PLAN_ACTIVATION_IN_PROGRESS se comporta como el 503 (otro intento tiene el lease)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan
        .mockRejectedValueOnce(errorHttp(409, 'PLAN_ACTIVATION_IN_PROGRESS'))
        .mockResolvedValueOnce({
          data: { data: { status: 'ACTIVE', alreadyActive: true, tier: 'PRO', interval: 'monthly', firstChargeCents: 2200, nextChargeAt: '2026-10-17T00:00:00.000Z' } },
        })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /pagar/i }))
      await waitFor(() => expect(screen.getByText(/Confirmando tu pago/i)).toBeInTheDocument())

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })

      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    } finally {
      vi.useRealTimers()
    }
  })

  it('si la tarjeta no se puede guardar, NO se llama a activate-plan', async () => {
    confirmSetup.mockResolvedValue({ error: { message: 'Tarjeta inválida' } })

    pintar()
    await pagar()

    await waitFor(() => expect(screen.getByText(/Tarjeta inválida/)).toBeInTheDocument())
    expect(activatePlan).not.toHaveBeenCalled()
  })
})

describe('OfferStep — sin números en el código', () => {
  it('🔴 el archivo no trae ningún monto escrito a mano', () => {
    const fuente = readFileSync(path.resolve(__dirname, '../steps/OfferStep.tsx'), 'utf8')
    expect(fuente).not.toMatch(/\b22\b/)
    expect(fuente).not.toMatch(/\b599\b/)
    expect(fuente).not.toMatch(/\b1158\b/)
    expect(fuente).not.toMatch(/\b69484\b/)
    expect(fuente).not.toMatch(/\b115884\b/)
  })

  /**
   * 🔴 Medido en vivo el 18-sep: con la Feature del plan sin sembrar, el cobro murió ANTES de
   * tocar Stripe y la pantalla dijo «Tu pago se está confirmando». El front atrapaba CUALQUIER
   * 503 como ambigüedad de cobro, así que prometía una confirmación que nunca iba a llegar y
   * reintentaba tres veces algo que ningún reintento puede arreglar.
   */
  it('🔴 un 503 de CONFIGURACIÓN no es un pago ambiguo: dice el motivo real y NO reintenta', async () => {
    activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_NOT_CONFIGURED'))

    const user = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /pagar/i }))

    // el mensaje del servidor («no se te cobró nada») llega tal cual
    expect(await screen.findByText(/mensaje-PLAN_NOT_CONFIGURED/)).toBeInTheDocument()
    // y NUNCA promete una confirmación que no existe
    expect(screen.queryByText(/se está confirmando|Confirmando tu pago/i)).not.toBeInTheDocument()
    // un solo intento: ningún reintento arregla una configuración rota
    expect(activatePlan).toHaveBeenCalledTimes(1)
  })

  /**
   * 🔴 Medido en vivo el 18-sep con la tarjeta de prueba que el banco rechaza: la pantalla, toda
   * en español, mostró «Your card was declined.» — el `message` crudo de Stripe ganaba sobre el
   * texto propio, que existía y nunca se veía.
   */
  it('🔴 un rechazo del banco se dice en ESPAÑOL, nunca con el texto en ingles de Stripe', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'insufficient_funds', message: 'Your card has insufficient funds.' } }),
    )

    const user = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /pagar/i }))

    expect(await screen.findByText(/fondos suficientes/i)).toBeInTheDocument()
    expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/declined/i)).not.toBeInTheDocument()
  })

  it('un rechazo sin codigo conocido usa el generico en espanol, no el ingles', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'do_not_honor', message: 'Your card was declined.' } }),
    )

    const user = userEvent.setup()
    pintar()
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /pagar/i }))

    expect(await screen.findByText(/Tu banco rechaz/i)).toBeInTheDocument()
    expect(screen.queryByText(/Your card was declined/i)).not.toBeInTheDocument()
  })
})
