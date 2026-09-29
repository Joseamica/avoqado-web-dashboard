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
import { useEffect, useState } from 'react'
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

const pagoListo = vi.hoisted(() => ({ auto: true, fallaCarga: false }))
const secretMontado = vi.hoisted(() => ({ actual: undefined as string | undefined }))
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
  // Como el <Elements> REAL: su `clientSecret` es INMUTABLE — se queda con el del primer montaje y sólo
  // cambia si se vuelve a montar. Con un <div> pelón, un SetupIntent nuevo «entraba» sin remontar y la
  // prueba no podía ver que el formulario seguía confirmando el ya gastado (full-testing, 26-sep).
  Elements: ({ children, options }: { children: React.ReactNode; options?: { clientSecret?: string } }) => {
    const [inicial] = useState(options?.clientSecret)
    secretMontado.actual = inicial
    return (
      <div data-testid="elements" data-secret={inicial}>
        {children}
      </div>
    )
  },
  // Como el REAL: avisa `onReady` cuando termina de pintar; el formulario no deja pagar antes.
  PaymentElement: ({ onReady, onLoadError }: { onReady?: () => void; onLoadError?: (e: unknown) => void }) => {
    // Como el REAL cuando Stripe rechaza la sesión: UN `loaderror` por montaje y nunca `onReady`.
    useEffect(() => {
      if (pagoListo.fallaCarga) onLoadError?.({ elementType: 'payment', error: { type: 'invalid_request_error' } })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!pagoListo.fallaCarga && pagoListo.auto) onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({ secret: secretMontado.actual }),
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
    PRO: {
      monthlyCents: 115884,
      annualCents: 1158840,
      intro: { monthlyCents: 69484, months: 3, interval: 'monthly', requiresPayNow: true },
    },
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
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 2200,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
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
    expect(saveStep).toHaveBeenCalledWith(
      'org_1',
      10,
      expect.objectContaining({ plan: expect.objectContaining({ tier: 'PRO', payNow: true }) }),
    )
    // La conversión de dinero se reporta en PESOS, no en centavos.
    expect(trackPurchase).toHaveBeenCalledWith(22, 'POS22')
  })

  it('🔴 un rechazo del banco (402) muestra el mensaje, NO avanza y NO escribe el respaldo step/10', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined', message: 'Tu banco rechazó el cargo' } }),
    )

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
    activatePlan.mockRejectedValue(
      errorHttp(409, 'PLAN_ACTIVE_WITHOUT_OFFER', { details: { currentTier: 'PRO', currentInterval: 'monthly' } }),
    )

    pintar()
    await pagar()

    expect(await screen.findByRole('button', { name: /Entrar a Avoqado/i })).toBeInTheDocument()
    expect(screen.queryByText(/recibimos tu pago|pago confirmado/i)).not.toBeInTheDocument()
    expect(saveStep).not.toHaveBeenCalled()
  })

  it('🔴 409 PLAN_ACTIVE_WITHOUT_OFFER sobre un cobro ANTERIOR: nunca le dice «no te cobramos nada» a quien ya pagó', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(409, 'PLAN_ACTIVE_WITHOUT_OFFER', { details: { currentTier: 'PREMIUM', currentInterval: 'monthly', charged: true } }),
    )

    pintar()
    await pagar()

    expect(await screen.findByText(/pagaste en un intento anterior/i)).toBeInTheDocument()
    expect(screen.queryByText(/No te cobramos nada/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Entrar a Avoqado/i })).toBeInTheDocument()
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
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce({
        data: {
          data: {
            status: 'ACTIVE',
            alreadyActive: false,
            tier: 'PRO',
            interval: 'monthly',
            firstChargeCents: 2200,
            nextChargeAt: '2026-10-17T00:00:00.000Z',
          },
        },
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

  it.each([500, 502, 504])('🔴 un %i sin código también pudo cobrar: confirma, no deja volver a pagar', async status => {
    // El proxy (Render/Cloudflare) contesta 502/504 sin cuerpo nuestro, y un 500 pudo salir DESPUÉS del cargo.
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValue({ response: { status, data: {} } })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /pagar/i }))

      expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(activatePlan.mock.calls[1]).toEqual(activatePlan.mock.calls[0]) // el MISMO cuerpo: nunca un segundo cobro
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

  it('🔴 «Volver a comprobar» se apaga mientras la comprobación está en vuelo: dos toques no son dos peticiones', async () => {
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
      const boton = await screen.findByRole('button', { name: /Volver a comprobar/i })
      const antes = activatePlan.mock.calls.length

      activatePlan.mockReturnValue(new Promise(() => undefined)) // el servidor no contesta todavía
      await user.click(boton)
      expect(boton).toBeDisabled()
      await user.click(boton)
      expect(activatePlan.mock.calls.length).toBe(antes + 1)
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 tras recargar, «Volver a comprobar» se queda apagado mientras el progreso sigue en camino', async () => {
    let soltar: () => void = () => undefined
    onRefreshProgress.mockReturnValue(new Promise<void>(r => (soltar = r)))
    pintar({ activacionEnCurso: true })

    const boton = await screen.findByRole('button', { name: /Volver a comprobar/i })
    const user = userEvent.setup()
    await user.click(boton)
    expect(boton).toBeDisabled()
    await user.click(boton)
    expect(onRefreshProgress).toHaveBeenCalledTimes(1)

    await act(async () => soltar())
    await waitFor(() => expect(boton).toBeEnabled())
  })

  it('🔴 si Stripe no carga el formulario, NO gira para siempre: dice que falló y «Reintentar» pide un cobro nuevo', async () => {
    pagoListo.fallaCarga = true
    try {
      pintar()
      const reintentar = await screen.findByRole('button', { name: /reintentar/i })
      expect(screen.getByText(/No pudimos preparar el pago con tarjeta/)).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: /pagar/i })).toBeNull()
      pagoListo.fallaCarga = false
      await userEvent.setup().click(reintentar)
      await waitFor(() => expect(planSetupIntent).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(screen.getByRole('button', { name: /pagar/i })).toBeEnabled())
    } finally {
      pagoListo.fallaCarga = false
    }
  })

  it('🔴 sin el aviso de Stripe (`onReady`) no se puede pagar la oferta', async () => {
    pagoListo.auto = false
    try {
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled()
    } finally {
      pagoListo.auto = true
    }
  })

  it('409 PLAN_ACTIVATION_IN_PROGRESS se comporta como el 503 (otro intento tiene el lease)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce(errorHttp(409, 'PLAN_ACTIVATION_IN_PROGRESS')).mockResolvedValueOnce({
        data: {
          data: {
            status: 'ACTIVE',
            alreadyActive: true,
            tier: 'PRO',
            interval: 'monthly',
            firstChargeCents: 2200,
            nextChargeAt: '2026-10-17T00:00:00.000Z',
          },
        },
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
    // 🔴 Codex R12: la tarjeta ya confirmó ese SetupIntent — para volver a pagar se pide uno NUEVO
    await waitFor(() => expect(planSetupIntent).toHaveBeenCalledTimes(2))
  })

  /**
   * 🔴 Medido en vivo el 18-sep con la tarjeta de prueba que el banco rechaza: la pantalla, toda
   * en español, mostró «Your card was declined.» — el `message` crudo de Stripe ganaba sobre el
   * texto propio, que existía y nunca se veía.
   */
  it('🔴 un rechazo del banco se dice en ESPAÑOL, nunca con el texto en ingles de Stripe', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', {
        details: { declineCode: 'insufficient_funds', message: 'Your card has insufficient funds.' },
      }),
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

describe('«Ver otros planes» tiene regreso a la oferta', () => {
  // 🔴 Pro ES el plan de la oferta. Sin un regreso, quien toca «Ver otros planes» por curiosidad
  // se queda frente a Pro a precio de lista y puede pagar $694.84 por lo mismo que costaba $22.
  it('muestra «Volver a la oferta» y al tocarlo regresa a la tarjeta de $22', async () => {
    const user = userEvent.setup()
    pintar()
    await user.click(await screen.findByRole('button', { name: 'Ver otros planes' }))
    expect(await screen.findByTestId('plan-step-estandar')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Volver a la oferta de $22.00' }))
    expect(screen.queryByTestId('plan-step-estandar')).not.toBeInTheDocument()
    expect(await screen.findByRole('button', { name: 'Ver otros planes' })).toBeInTheDocument()
  })

  it('avisa al asistente cuándo se ven los planes, para ensanchar la columna', async () => {
    const user = userEvent.setup()
    const onVistaDePlanes = vi.fn()
    pintar({ onVistaDePlanes })
    await user.click(await screen.findByRole('button', { name: 'Ver otros planes' }))
    await waitFor(() => expect(onVistaDePlanes).toHaveBeenLastCalledWith(true))
    await user.click(screen.getByRole('button', { name: 'Volver a la oferta de $22.00' }))
    await waitFor(() => expect(onVistaDePlanes).toHaveBeenLastCalledWith(false))
  })

  it('con la oferta ya NO disponible no ofrece volver a ella', async () => {
    pintar({ launchOffer: { code: 'POS22', slug: 'pos-22', available: false, unavailableReason: 'SOLD_OUT' } as any })
    expect(await screen.findByTestId('plan-step-estandar')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Volver a la oferta/ })).not.toBeInTheDocument()
  })
})

describe('🔴 Codex ronda 9: el plan queda bloqueado desde que sale el cobro hasta que hay respuesta definitiva', () => {
  it('con el PRIMER cobro de la oferta en vuelo, «Ver otros planes» no se puede tocar', async () => {
    let responder: (v: unknown) => void = () => {}
    activatePlan.mockImplementation(() => new Promise(r => (responder = r)))
    pintar()
    await pagar()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled()
    responder({
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 2200,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
    })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('tras rendirse («sin confirmar») el plan SIGUE bloqueado y «Volver a comprobar» pregunta por el MISMO cobro', async () => {
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
      await waitFor(() => expect(screen.getByTestId('offer-pending-locked')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled()

      const antes = activatePlan.mock.calls.length
      activatePlan.mockReset().mockResolvedValue({
        data: {
          data: {
            status: 'ACTIVE',
            alreadyActive: false,
            tier: 'PRO',
            interval: 'monthly',
            firstChargeCents: 2200,
            nextChargeAt: '2026-10-17T00:00:00.000Z',
          },
        },
      })
      await user.click(screen.getByRole('button', { name: /Volver a comprobar mi pago/i }))
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
      expect(antes).toBeGreaterThan(0)
      expect(activatePlan.mock.calls[0][1].paymentMethodId).toBe('pm_123') // el mismo cobro, no uno nuevo
    } finally {
      vi.useRealTimers()
    }
  })

  it('un rechazo del banco SÍ suelta el candado: el plan se puede volver a elegir', async () => {
    activatePlan.mockRejectedValue(errorHttp(402, 'CARD_DECLINED', { details: { declineCode: 'insufficient_funds' } }))
    pintar()
    await pagar()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeEnabled())
  })
})

describe('🔴 Codex ronda 10: tres puertas más al mismo candado', () => {
  const exito = {
    data: {
      data: {
        status: 'ACTIVE',
        alreadyActive: false,
        tier: 'PRO',
        interval: 'monthly',
        firstChargeCents: 2200,
        nextChargeAt: '2026-10-17T00:00:00.000Z',
      },
    },
  }

  it('una caída de red a media petición NO es un «no»: el candado sigue y se pregunta otra vez por el MISMO cobro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce({ message: 'Network Error', code: 'ERR_NETWORK' }).mockResolvedValueOnce(exito)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('button', { name: /pagar/i }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled()
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

  it('mientras Stripe guarda la tarjeta, «Ver otros planes» ya está bloqueado', async () => {
    confirmSetup.mockImplementation(() => new Promise(() => {}))
    pintar()
    await pagar()
    await waitFor(() => expect(confirmSetup).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled())
  })

  it('si la pantalla se va mientras se guarda la tarjeta, ese cobro ya NO sale', async () => {
    let terminarTarjeta: (v: unknown) => void = () => {}
    confirmSetup.mockImplementation(() => new Promise(r => (terminarTarjeta = r)))
    const { unmount } = pintar()
    await pagar()
    await waitFor(() => expect(confirmSetup).toHaveBeenCalledTimes(1))
    unmount()
    await act(async () => terminarTarjeta({ setupIntent: { payment_method: 'pm_tarde' } }))
    expect(activatePlan).not.toHaveBeenCalled()
  })

  it('al volver con un cobro EN CURSO en el servidor (recarga), el plan sigue bloqueado y «Volver a comprobar» le pregunta al servidor', async () => {
    const user = userEvent.setup()
    pintar({ activacionEnCurso: true })
    expect(await screen.findByTestId('offer-pending-locked')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Volver a comprobar mi pago/i }))
    expect(onRefreshProgress).toHaveBeenCalled()
    expect(activatePlan).not.toHaveBeenCalled() // sin la tarjeta de antes no se reenvía nada: se pregunta
  })
})

describe('🔴 revisión independiente (26-sep): tras recargar con un cobro colgado, confirmar otra vez es la salida', () => {
  it('la oferta deja pagar (el servidor recupera el cobro anterior) pero no cambiar de plan', async () => {
    activatePlan.mockResolvedValue({
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 2200,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
    })
    pintar({ activacionEnCurso: true })
    expect(await screen.findByText(/Tu último pago quedó sin confirmar/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Ver otros planes' })).toBeDisabled()
    await pagar()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })
})

describe('🔴 full-testing 26-sep: en la OFERTA, tras un rechazo el formulario usa el SetupIntent nuevo', () => {
  it('pedía uno nuevo pero el formulario seguía con el gastado: ahora se remonta con él', async () => {
    planSetupIntent
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { clientSecret: 'seti_1' } } })
      .mockResolvedValue({ data: { data: { clientSecret: 'seti_2' } } })
    activatePlan.mockRejectedValueOnce(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined' } }))
    pintar()
    await pagar()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    expect(screen.getByRole('alert')).toHaveTextContent(/rechaz/i)
  })
})
