/**
 * La pantalla de planes del alta con la oferta del anuncio, RENDERIZADA (§4.5 y diseño D del 17-oct).
 *
 * 🔴 Es la pantalla donde se cobra. Lo que estas pruebas fijan:
 *  1. Pinta EXACTAMENTE los montos del servidor y manda de vuelta el mismo `firstChargeCents`.
 *  2. Un rechazo de tarjeta (402) NO avanza y NO escribe el respaldo `step/10` — escribirlo
 *     dejaría `v2SetupData.plan` listo para que el camino legacy cobre a precio de lista.
 *  3. Ningún 409 es un callejón: los dos «ya tienes plan» ofrecen un botón que TERMINA el alta.
 *  4. Una oferta que ya no está disponible NO se reintenta sola: se cierra la ventana, se avisa y
 *     las tarjetas pasan a la prueba de 30 días, donde el precio normal hay que volver a tocarlo.
 *  5. Con un cobro sin respuesta definitiva el plan no se cambia: las tarjetas se apagan y la
 *     ventana no se cierra.
 *
 * Las cadenas son las REALES de `setup.json` (ver `traduccionesDePrueba`). Para pagar, primero se abre
 * la ventana con «Elegir Pro por $22.00», como el cliente.
 */
import { useEffect, useState } from 'react'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const activatePlan = vi.fn()
const saveStep = vi.fn()
const planSetupIntent = vi.fn()
const getProgress = vi.fn()
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
    getProgress: (...a: unknown[]) => getProgress(...a),
  },
}))
// Sólo para montar el asistente corto REAL en la prueba I1 (el marco usa tema e idioma, que aquí no importan).
vi.mock('@/components/layouts/SetupWizardLayout', () => ({
  SetupWizardLayout: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))
vi.mock('@/lib/gtag', () => ({ trackPurchase: (...a: unknown[]) => trackPurchase(...a), trackSignup: vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: (...a: unknown[]) => track(...a) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
// D2: la MISMA instancia que recibe <Elements> abre el reto 3D Secure del banco (`confirmCardPayment`).
const confirmCardPayment = vi.hoisted(() => vi.fn())
vi.mock('@stripe/stripe-js', () => ({
  loadStripe: () => Promise.resolve({ confirmCardPayment: (...a: unknown[]) => confirmCardPayment(...a) }),
}))
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
vi.mock('react-i18next', () => import('./traduccionesDePrueba'))

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { OfferStep } from '../steps/OfferStep'
import ShortSetupWizard from '../ShortSetupWizard'
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

const EXITO = {
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

/** Abre la ventana del plan de la campaña, como el cliente: «Elegir Pro por $22.00». */
async function abrirLaOferta(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: 'Elegir Pro por $22.00' }))
  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  return user
}

async function pagar() {
  const user = await abrirLaOferta()
  await user.click(screen.getByRole('button', { name: /pagar/i }))
}

const elegirPremium = () => screen.getByRole('button', { name: 'Elegir Premium' })

beforeEach(() => {
  activatePlan.mockReset()
  saveStep.mockReset().mockResolvedValue({})
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti_secret' } } })
  getProgress.mockReset()
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_123' } })
  confirmCardPayment.mockReset().mockResolvedValue({ paymentIntent: { status: 'succeeded' } })
  trackPurchase.mockReset()
  track.mockReset()
  onActivated.mockReset()
  onFinish.mockReset()
  onRefreshProgress.mockReset().mockResolvedValue(undefined)
})

describe('OfferStep — lo que pinta', () => {
  it('pinta los montos del servidor: promo, meses, renovación y, en la ventana, lo que se cobra hoy', async () => {
    pintar()
    expect(await screen.findByText('$22.00 al mes por 3 meses')).toBeInTheDocument()
    expect(screen.getByText(/Después \$999\.00 \+ IVA = \$1,158\.84 al mes/)).toBeInTheDocument()

    await abrirLaOferta()
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText('Tu oferta: $22.00 al mes por 3 meses')).toBeInTheDocument()
    expect(within(ventana).getByText('Hoy pagas')).toBeInTheDocument()
    expect(within(ventana).getByText('$22.00')).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: 'Pagar $22.00 y entrar' })).toBeInTheDocument()
    // El legal de la campaña (`offer.legal`) con los montos de `launchOffer`.
    expect(
      within(ventana).getByText(/autorizas a Avoqado a cobrar \$22\.00 al mes durante 3 meses y después \$1,158\.84/),
    ).toBeInTheDocument()
  })

  it('una campaña de 1 mes dice «1 mes», nunca «1 meses»', async () => {
    pintar({ launchOffer: { ...OFERTA, promo: { ...OFERTA.promo, months: 1 } } })
    expect(await screen.findByText('$22.00 al mes por 1 mes')).toBeInTheDocument()
    await abrirLaOferta()
    expect(within(screen.getByRole('dialog')).getByText('Tu oferta: $22.00 al mes por 1 mes')).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/1 meses/)
  })

  it('la ventana de la oferta NO ofrece prueba gratis: un solo botón, el de pagar', async () => {
    pintar()
    await abrirLaOferta()
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).queryByText(/30 días gratis/i)).not.toBeInTheDocument()
    expect(within(ventana).getAllByRole('button', { name: /pagar|gratis/i })).toHaveLength(1)
  })

  it('una oferta reclamada pero NO disponible avisa y enseña las tarjetas sin campaña', async () => {
    pintar({ launchOffer: { code: 'POS22', slug: 'pos-22', available: false, unavailableReason: 'SOLD_OUT' } })
    expect(await screen.findByText('La oferta POS22 ya no está disponible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir Pro' })).toBeInTheDocument()
    expect(screen.queryByText('Oferta de tu anuncio')).not.toBeInTheDocument()
    expect(activatePlan).not.toHaveBeenCalled()
  })

  it('sin campaña abre en las 3 tarjetas con la cotización del servidor', async () => {
    pintar({ launchOffer: null })
    expect(await screen.findByRole('heading', { name: 'Elige tu plan' })).toBeInTheDocument()
    expect(screen.getByText('Pro y Premium: 30 días gratis. Cancela antes y no se te cobra.')).toBeInTheDocument()
    expect(screen.getByText('Luego $1,158.84 con IVA al mes')).toBeInTheDocument()
    expect(screen.getByText('Recomendado')).toBeInTheDocument()
  })

  it('🔴 no existe ningún «Gratis» ni «Continuar con el plan Gratis» en el paso (con y sin campaña)', async () => {
    const { unmount } = pintar()
    await screen.findByRole('button', { name: 'Elegir Pro por $22.00' })
    expect(document.body.textContent).not.toMatch(/Gratis/)
    expect(screen.queryByRole('button', { name: /plan Gratis/i })).not.toBeInTheDocument()
    unmount()

    pintar({ launchOffer: null })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Elegir Pro' }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(document.body.textContent).not.toMatch(/Gratis/)
  })
})

describe('OfferStep — el pie de las tarjetas', () => {
  it('«Comparar todo lo que incluye cada plan» abre la comparación, ya desplegada y sin Gratis', async () => {
    pintar()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Comparar todo lo que incluye cada plan' }))
    const ventana = await screen.findByRole('dialog', { name: 'Qué incluye cada plan' })
    expect(within(ventana).getByRole('table')).toBeInTheDocument()
    expect(ventana.textContent).not.toMatch(/Gratis/)
    // M5: sin «Ocultar la comparación» — ocultarla dejaba un diálogo con título y vacío.
    expect(within(ventana).queryByRole('button', { name: /Ocultar la comparación/ })).not.toBeInTheDocument()
  })

  it('«¿No tienes tarjeta? Escríbenos» abre WhatsApp de ventas con su texto', async () => {
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null)
    pintar()
    await userEvent.setup().click(await screen.findByRole('button', { name: '¿No tienes tarjeta? Escríbenos' }))
    expect(abrir).toHaveBeenCalledWith(expect.stringContaining('wa.me'), '_blank', 'noopener,noreferrer')
    expect(decodeURIComponent(String(abrir.mock.calls[0][0]))).toContain('no tengo tarjeta')
  })
})

describe('OfferStep — la ventana para pagar', () => {
  it('🔴 mientras la ventana está abierta, las tarjetas y el pie quedan `inert` (Tab no llega a «Elegir…»)', async () => {
    pintar()
    const user = await abrirLaOferta()
    expect(screen.getByTestId('planes-del-alta')).toHaveAttribute('inert')
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByTestId('planes-del-alta')).not.toHaveAttribute('inert')
  })

  it('🔴 Review Focus 2: con un 503 en curso, Esc NO cierra la ventana y la X está apagada', async () => {
    activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
    pintar()
    const user = await abrirLaOferta()
    await user.click(screen.getByRole('button', { name: /pagar/i }))
    expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()

    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /cerrar|close/i })).toBeDisabled()
  })

  it('🔴 Review Focus 3: OFFER_CHANGED con la ventana abierta la cierra, avisa, quita la oferta y NO reintenta', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'OFFER_CHANGED', {}))
    pintar()
    await pagar()

    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(screen.getByText('La oferta cambió. Revisa el precio nuevo antes de continuar.')).toBeInTheDocument()
    const pro = document.querySelector<HTMLElement>('[data-plan="PRO"]')!
    expect(within(pro).queryByText('Oferta de tu anuncio')).not.toBeInTheDocument()
    expect(within(pro).getByRole('button', { name: 'Elegir Pro' })).toBeEnabled()
    expect(activatePlan).toHaveBeenCalledTimes(1)
  })

  it('🔴 (Codex r1 P2) OFFER_CHANGED → reabrir «Elegir Pro» usa un SetupIntent NUEVO y cobra la prueba STANDARD', async () => {
    planSetupIntent
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { clientSecret: 'seti_1' } } })
      .mockResolvedValue({ data: { data: { clientSecret: 'seti_2' } } })
    activatePlan.mockRejectedValueOnce(errorHttp(409, 'OFFER_CHANGED', {})).mockResolvedValueOnce({
      data: { data: { ...EXITO.data.data, firstChargeCents: 0 } },
    })
    pintar()
    const user = await abrirLaOferta()
    expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_1')
    await user.click(screen.getByRole('button', { name: /pagar/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    await waitFor(() => expect(planSetupIntent).toHaveBeenCalledTimes(2))

    await user.click(screen.getByRole('button', { name: 'Elegir Pro' }))
    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    await user.click(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' }))

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
    expect(activatePlan.mock.calls[1]).toEqual([
      'org_1',
      {
        tier: 'PRO',
        interval: 'monthly',
        payNow: false,
        paymentMethodId: 'pm_123',
        offer: { kind: 'STANDARD', expectedFirstChargeCents: 0 },
        language: 'es',
      },
    ])
    expect(confirmSetup.mock.calls[1][0].elements.secret).toBe('seti_2')
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('SetupIntent que falla: «Reintentar» y WhatsApp, nunca Gratis', async () => {
    planSetupIntent.mockReset().mockRejectedValue(new Error('404'))
    pintar()
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Elegir Pro por $22.00' }))
    const ventana = screen.getByRole('dialog')
    expect(await within(ventana).findByRole('button', { name: 'Reintentar' })).toBeInTheDocument()
    expect(within(ventana).getByText('No pudimos preparar el pago con tarjeta. Vuelve a intentarlo.')).toBeInTheDocument()
    expect(within(ventana).getByRole('button', { name: '¿Problemas? Escríbenos' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '¿No tienes tarjeta? Escríbenos' })).toBeInTheDocument()
    expect(document.body.textContent).not.toMatch(/Gratis/)
  })
})

describe('OfferStep — el cobro', () => {
  it('manda EXACTAMENTE el cuerpo del contrato y avisa al asistente', async () => {
    activatePlan.mockResolvedValue(EXITO)

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
    // M6: la ventana se fue con el foco adentro; la salida lo recibe (no se queda en el <body>).
    await waitFor(() => expect(boton).toHaveFocus())
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
    expect(await screen.findByText('La oferta ya no está disponible.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir Pro' })).toBeInTheDocument()
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
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce(EXITO)

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
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
      await abrirLaOferta(user)
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
      await abrirLaOferta(user)
      await user.click(screen.getByRole('button', { name: /pagar/i }))

      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000)
        })
      }

      await waitFor(() => expect(screen.getByText(/Estamos confirmando tu pago con el banco/i)).toBeInTheDocument())
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
      await abrirLaOferta(user)
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
      await userEvent.setup().click(await screen.findByRole('button', { name: 'Elegir Pro por $22.00' }))
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
      await abrirLaOferta()
      expect(screen.getByRole('button', { name: /pagar/i })).toBeDisabled()
    } finally {
      pagoListo.auto = true
    }
  })

  it('409 PLAN_ACTIVATION_IN_PROGRESS se comporta como el 503 (otro intento tiene el lease)', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce(errorHttp(409, 'PLAN_ACTIVATION_IN_PROGRESS')).mockResolvedValueOnce({
        data: { data: { ...EXITO.data.data, alreadyActive: true } },
      })

      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
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

    pintar()
    await pagar()

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

    pintar()
    await pagar()

    expect(await screen.findByText(/fondos suficientes/i)).toBeInTheDocument()
    expect(screen.queryByText(/insufficient funds/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/declined/i)).not.toBeInTheDocument()
  })

  it('un rechazo sin codigo conocido usa el generico en espanol, no el ingles', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'do_not_honor', message: 'Your card was declined.' } }),
    )

    pintar()
    await pagar()

    expect(await screen.findByText(/Tu banco rechaz/i)).toBeInTheDocument()
    expect(screen.queryByText(/Your card was declined/i)).not.toBeInTheDocument()
  })
})

describe('🔴 Codex ronda 9: el plan queda bloqueado desde que sale el cobro hasta que hay respuesta definitiva', () => {
  it('con el PRIMER cobro de la oferta en vuelo, ni se elige otro plan ni se cierra la ventana', async () => {
    let responder: (v: unknown) => void = () => {}
    activatePlan.mockImplementation(() => new Promise(r => (responder = r)))
    pintar()
    await pagar()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(elegirPremium()).toBeDisabled()
    expect(screen.getByRole('button', { name: /cerrar|close/i })).toBeDisabled()
    responder(EXITO)
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('tras rendirse («sin confirmar») el plan SIGUE bloqueado y «Volver a comprobar» pregunta por el MISMO cobro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
      await user.click(screen.getByRole('button', { name: /pagar/i }))
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000)
        })
      }
      await waitFor(() => expect(screen.getByTestId('offer-pending-locked')).toBeInTheDocument())
      expect(elegirPremium()).toBeDisabled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      // M6: el botón de pagar sigue apagado; el foco va a la única salida, no se queda en el aire.
      expect(screen.getByRole('button', { name: /Volver a comprobar mi pago/i })).toHaveFocus()

      const antes = activatePlan.mock.calls.length
      activatePlan.mockReset().mockResolvedValue(EXITO)
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
    await waitFor(() => expect(elegirPremium()).toBeEnabled())
    expect(screen.getByRole('button', { name: /cerrar|close/i })).toBeEnabled()
  })
})

describe('🔴 Codex ronda 10: tres puertas más al mismo candado', () => {
  it('una caída de red a media petición NO es un «no»: el candado sigue y se pregunta otra vez por el MISMO cobro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce({ message: 'Network Error', code: 'ERR_NETWORK' }).mockResolvedValueOnce(EXITO)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
      await user.click(screen.getByRole('button', { name: /pagar/i }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      expect(elegirPremium()).toBeDisabled()
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

  it('mientras Stripe guarda la tarjeta, ya no se puede elegir otro plan ni cerrar la ventana', async () => {
    confirmSetup.mockImplementation(() => new Promise(() => {}))
    pintar()
    await pagar()
    await waitFor(() => expect(confirmSetup).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(elegirPremium()).toBeDisabled())
    expect(screen.getByRole('button', { name: /cerrar|close/i })).toBeDisabled()
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
    expect(elegirPremium()).toBeDisabled()
    await user.click(screen.getByRole('button', { name: /Volver a comprobar mi pago/i }))
    expect(onRefreshProgress).toHaveBeenCalled()
    expect(activatePlan).not.toHaveBeenCalled() // sin la tarjeta de antes no se reenvía nada: se pregunta
  })
})

describe('🔴 recarga con un cobro sin cerrar: «Confirmar mi pago» es la salida (revisión 26-sep y Codex r1 P1)', () => {
  it('las tarjetas quedan apagadas, y «Confirmar mi pago» abre la ventana de la campaña con la tarjeta HABILITADA', async () => {
    activatePlan.mockResolvedValue(EXITO)
    pintar({ activacionEnCurso: true })

    expect(await screen.findByText('Tienes un pago sin confirmar')).toBeInTheDocument()
    expect(screen.getByText(/Tu último pago quedó sin confirmar/)).toBeInTheDocument()
    for (const nombre of ['Elegir Pro por $22.00', 'Elegir Premium', 'Hablar con ventas']) {
      expect(screen.getByRole('button', { name: nombre })).toBeDisabled()
    }

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: 'Confirmar mi pago' }))
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText('Tu oferta: $22.00 al mes por 3 meses')).toBeInTheDocument()
    await waitFor(() => expect(within(ventana).getByRole('button', { name: /pagar/i })).toBeEnabled())

    await user.click(within(ventana).getByRole('button', { name: /pagar/i }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toMatchObject({ tier: 'PRO', payNow: true, offer: { kind: 'LAUNCH', code: 'POS22' } })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('al cerrar esa ventana no hay forma de abrir la de otro plan', async () => {
    pintar({ activacionEnCurso: true })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: 'Confirmar mi pago' }))
    await user.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(elegirPremium()).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Elegir Pro por $22.00' })).toBeDisabled()
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

  it('🔴 D1: tras el 402 y el remontaje con el SetupIntent nuevo, el foco queda en el mensaje (no en el <body>)', async () => {
    planSetupIntent
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { clientSecret: 'seti_1' } } })
      .mockResolvedValue({ data: { data: { clientSecret: 'seti_2' } } })
    activatePlan.mockRejectedValueOnce(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined' } }))
    pintar()
    await pagar()
    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(within(screen.getByRole('dialog')).getByRole('alert')).toHaveTextContent(/rechaz/i)
  })
})

/**
 * 🔴 D2 (spec 2026-10-18-campana-3ds §6.5): el banco pide autorizar el primer cobro (3D Secure). El servidor responde 409
 * `PLAN_PAYMENT_REQUIRES_ACTION` con el secreto del cobro; la pantalla abre el reto del banco con la tarjeta YA guardada y
 * vuelve a mandar el MISMO cuerpo: decide el servidor (200 · 409 sigue esperando · 402 · 503). Un reto por clic, también en
 * los reintentos automáticos (Codex r1 #5): sólo «Autorizar el pago» abre otro.
 */
describe('🔴 D2: el banco pide autorizar el primer cobro', () => {
  const RETO = errorHttp(409, 'PLAN_PAYMENT_REQUIRES_ACTION', { details: { clientSecret: 'pi_1_secret_x' } })
  const PENDIENTE = errorHttp(503, 'PLAN_ACTIVATION_PENDING')
  const cerrar = () => screen.getByRole('button', { name: /cerrar|close/i })
  const mismosCuerpos = () => {
    for (const llamada of activatePlan.mock.calls) expect(llamada).toEqual(activatePlan.mock.calls[0])
  }

  beforeEach(() => {
    confirmSetup.mockResolvedValue({ setupIntent: { payment_method: 'pm_1' } })
  })

  it('409 ⇒ abre el reto con el secreto y la tarjeta guardada, y vuelve a mandar el MISMO cuerpo; con 200 avanza', async () => {
    activatePlan.mockRejectedValueOnce(RETO).mockResolvedValueOnce(EXITO)
    pintar()
    await pagar()

    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    expect(confirmCardPayment).toHaveBeenCalledTimes(1)
    expect(confirmCardPayment).toHaveBeenCalledWith('pi_1_secret_x', { payment_method: 'pm_1' })
    expect(activatePlan).toHaveBeenCalledTimes(2)
    expect(activatePlan.mock.calls[1]).toEqual(activatePlan.mock.calls[0])
    expect(activatePlan.mock.calls[0][1].paymentMethodId).toBe('pm_1')
    // El respaldo del paso 10 sólo DESPUÉS del 200.
    expect(saveStep).toHaveBeenCalledTimes(1)
    expect(saveStep.mock.invocationCallOrder[0]).toBeGreaterThan(activatePlan.mock.invocationCallOrder[1])
    expect(trackPurchase).toHaveBeenCalledTimes(1)
    // El formulario NO se remonta: la autorización es sobre ESA tarjeta y ese SetupIntent.
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
    expect(screen.queryByText(/Tu banco rechazó el cargo/)).not.toBeInTheDocument()
    expect(screen.queryByText(/mensaje-PLAN_PAYMENT_REQUIRES_ACTION/)).not.toBeInTheDocument()
  })

  it('🔴 mientras el banco pregunta: texto de estado, la ventana no se cierra, aria-modal="false" y los planes apagados', async () => {
    confirmCardPayment.mockImplementation(() => new Promise(() => undefined))
    activatePlan.mockRejectedValueOnce(RETO)
    pintar()
    const user = await abrirLaOferta()
    await user.click(screen.getByRole('button', { name: /pagar/i }))

    const estado = await screen.findByText('Tu banco pide que autorices este pago. Sigue los pasos en la ventana de tu banco.')
    expect(estado).toHaveAttribute('role', 'status')
    await user.keyboard('{Escape}')
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(cerrar()).toBeDisabled()
    // El reto del banco se monta FUERA de la ventana: con `aria-modal` VoiceOver lo dejaría mudo.
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'false')
    expect(elegirPremium()).toBeDisabled()
    expect(saveStep).not.toHaveBeenCalled()
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
    // El secreto del cobro nunca se pinta.
    expect(document.body.textContent).not.toContain('pi_1_secret_x')
  })

  it('🔴 el reto falla: el servidor responde 402 de autenticación ⇒ texto propio, formulario NUEVO, candado suelto y foco en el mensaje', async () => {
    planSetupIntent
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { clientSecret: 'seti_1' } } })
      .mockResolvedValue({ data: { data: { clientSecret: 'seti_2' } } })
    activatePlan
      .mockRejectedValueOnce(RETO)
      .mockRejectedValueOnce(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'payment_intent_authentication_failure' } }))
    pintar()
    await pagar()

    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    expect(planSetupIntent).toHaveBeenCalledTimes(2)
    expect(confirmCardPayment).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('alert')).toHaveTextContent(
      'No se completó la autorización de tu banco. Inténtalo otra vez o usa otra tarjeta.',
    )
    await waitFor(() => expect(cerrar()).toBeEnabled())
    await waitFor(() => expect(screen.getByRole('alert')).toHaveFocus())
    expect(saveStep).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('el servidor sigue esperando tras el reto ⇒ NO abre otro reto solo: «Autorizar el pago», y al tocarlo sí', async () => {
    activatePlan.mockRejectedValueOnce(RETO).mockRejectedValueOnce(RETO).mockRejectedValueOnce(RETO).mockResolvedValueOnce(EXITO)
    pintar()
    await pagar()

    const boton = await screen.findByRole('button', { name: 'Autorizar el pago' })
    expect(screen.getByText('Tu banco todavía espera que autorices el pago. No se te ha cobrado.')).toBeInTheDocument()
    expect(activatePlan).toHaveBeenCalledTimes(2)
    expect(confirmCardPayment).toHaveBeenCalledTimes(1)
    expect(cerrar()).toBeDisabled()
    expect(elegirPremium()).toBeDisabled()
    // El botón de pagar sigue apagado: el foco va a la única salida.
    await waitFor(() => expect(boton).toHaveFocus())

    await userEvent.setup().click(boton)
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledTimes(4)
    expect(confirmCardPayment).toHaveBeenCalledTimes(2)
    expect(confirmCardPayment.mock.calls[1]).toEqual(['pi_1_secret_x', { payment_method: 'pm_1' }])
    mismosCuerpos()
    expect(cerrar()).toBeDisabled()
    expect(planSetupIntent).toHaveBeenCalledTimes(1)
  })

  it('si Stripe.js falla al abrir el reto, igual le pregunta al servidor (decide él)', async () => {
    confirmCardPayment.mockRejectedValue(new Error('network'))
    activatePlan.mockRejectedValueOnce(RETO).mockResolvedValueOnce(EXITO)
    pintar()
    await pagar()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
    expect(confirmCardPayment).toHaveBeenCalledTimes(1)
    mismosCuerpos()
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('si la pantalla se va durante el reto, NO se manda el pedido de después', async () => {
    let terminarReto: (v: unknown) => void = () => {}
    confirmCardPayment.mockImplementation(() => new Promise(r => (terminarReto = r)))
    activatePlan.mockRejectedValueOnce(RETO).mockResolvedValueOnce(EXITO)
    const { unmount } = pintar()
    await pagar()
    await waitFor(() => expect(confirmCardPayment).toHaveBeenCalledTimes(1))

    unmount()
    await act(async () => {
      terminarReto({ paymentIntent: { status: 'succeeded' } })
      await new Promise(r => setTimeout(r, 0))
    })
    expect(activatePlan).toHaveBeenCalledTimes(1)
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('🔴 409 → reto → 503 → reintento automático → 409: NO abre otro reto solo; «Autorizar el pago» sí', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan
        .mockRejectedValueOnce(RETO)
        .mockRejectedValueOnce(PENDIENTE)
        .mockRejectedValueOnce(RETO)
        .mockRejectedValueOnce(RETO)
        .mockResolvedValueOnce(EXITO)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
      await user.click(screen.getByRole('button', { name: /pagar/i }))

      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(confirmCardPayment).toHaveBeenCalledTimes(1)
      expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000)
      })
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(3))
      const boton = await screen.findByRole('button', { name: 'Autorizar el pago' })
      expect(screen.getByText('Tu banco todavía espera que autorices el pago. No se te ha cobrado.')).toBeInTheDocument()
      expect(confirmCardPayment).toHaveBeenCalledTimes(1)
      expect(cerrar()).toBeDisabled()

      await user.click(boton)
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
      expect(activatePlan).toHaveBeenCalledTimes(5)
      expect(confirmCardPayment).toHaveBeenCalledTimes(2)
      mismosCuerpos()
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 «Volver a comprobar» tras rendirse conserva las opciones: un 409 no abre otro reto solo', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan
        .mockRejectedValueOnce(RETO)
        .mockRejectedValueOnce(PENDIENTE)
        .mockRejectedValueOnce(PENDIENTE)
        .mockRejectedValueOnce(PENDIENTE)
        .mockRejectedValueOnce(PENDIENTE)
        .mockRejectedValueOnce(RETO)
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      pintar()
      await abrirLaOferta(user)
      await user.click(screen.getByRole('button', { name: /pagar/i }))
      for (let i = 0; i < 4; i++) {
        await act(async () => {
          await vi.advanceTimersByTimeAsync(10_000)
        })
      }

      const volver = await screen.findByRole('button', { name: /Volver a comprobar mi pago/i })
      expect(activatePlan).toHaveBeenCalledTimes(5)
      expect(confirmCardPayment).toHaveBeenCalledTimes(1)

      await user.click(volver)
      expect(await screen.findByRole('button', { name: 'Autorizar el pago' })).toBeInTheDocument()
      expect(activatePlan).toHaveBeenCalledTimes(6)
      expect(confirmCardPayment).toHaveBeenCalledTimes(1)
      expect(screen.getByText('Tu banco todavía espera que autorices el pago. No se te ha cobrado.')).toBeInTheDocument()
      expect(cerrar()).toBeDisabled()
      mismosCuerpos()
    } finally {
      vi.useRealTimers()
    }
  })
})

/**
 * 🔴 Revisión final I1 (18-oct): mientras el banco pregunta, el servidor tiene el cobro en `IN_PROGRESS`. Si la persona se va
 * a la app de su banco (o a otra pestaña) y vuelve, react-query vuelve a leer el progreso al regresar la pantalla
 * (`refetchOnWindowFocus` por defecto, `staleTime: 0`) y se queda con `IN_PROGRESS`. Si el reto falla, el 402 tiene que
 * volver a leerlo: si no, los planes siguen apagados y la ventana dice «Tu último pago quedó sin confirmar» junto al rechazo
 * (spec §3: tras un reto fallido el plan se puede cambiar). Se monta el asistente corto REAL con un QueryClient como el de
 * `main.tsx`, y el regreso de la pantalla es el evento `visibilitychange` del navegador, no un `rerender` a mano.
 */
describe('🔴 I1: el reto falla después de ir a la app del banco y volver', () => {
  const RETO = errorHttp(409, 'PLAN_PAYMENT_REQUIRES_ACTION', { details: { clientSecret: 'pi_1_secret_x' } })
  const progresoDelAlta = (planActivationStatus: string) => ({
    data: {
      progress: {
        legal: { consentRequired: false },
        v2SetupData: { step2: { businessName: 'Café Testarudo' }, step3: { businessType: 'CAFE' } },
        planActivationStatus,
        launchOffer: OFERTA,
        planQuote: QUOTE,
        venueId: 'venue_1',
      },
    },
  })
  const pantallaEn = (estado: 'hidden' | 'visible') => {
    Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => estado })
    document.dispatchEvent(new Event('visibilitychange', { bubbles: true }))
  }

  it('tras el 402 se vuelve a leer el progreso: planes libres, sin «sin confirmar», y se puede elegir otro plan', async () => {
    // Lo que diría el servidor en cada momento.
    let enElServidor = 'NONE'
    getProgress.mockImplementation(async () => progresoDelAlta(enElServidor))
    confirmSetup.mockResolvedValue({ setupIntent: { payment_method: 'pm_1' } })
    let terminarReto: (v: unknown) => void = () => {}
    confirmCardPayment.mockImplementation(() => new Promise(r => (terminarReto = r)))
    activatePlan
      .mockImplementationOnce(async () => {
        enElServidor = 'IN_PROGRESS' // el servidor tomó el cobro y espera al banco
        throw RETO
      })
      .mockImplementationOnce(async () => {
        enElServidor = 'DECLINED' // el reto falló: el servidor lo cierra como rechazo
        throw errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'payment_intent_authentication_failure' } })
      })
    const client = new QueryClient()
    render(
      <MemoryRouter>
        <QueryClientProvider client={client}>
          <ShortSetupWizard organizationId="org_1" />
        </QueryClientProvider>
      </MemoryRouter>,
    )

    try {
      await pagar()
      await waitFor(() => expect(confirmCardPayment).toHaveBeenCalledTimes(1))

      // Con el reto abierto, la persona se va a la app de su banco y vuelve: react-query lee el progreso otra vez.
      act(() => pantallaEn('hidden'))
      act(() => pantallaEn('visible'))
      await waitFor(() => expect(getProgress).toHaveBeenCalledTimes(2))
      await waitFor(() =>
        expect(
          client.getQueryData<{ progress: { planActivationStatus: string } }>(['onboarding-progress', 'org_1'])?.progress,
        ).toMatchObject({ planActivationStatus: 'IN_PROGRESS' }),
      )

      // El reto falla.
      await act(async () => terminarReto({ error: { type: 'card_error', code: 'payment_intent_authentication_failure' } }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se completó la autorización de tu banco. Inténtalo otra vez o usa otra tarjeta.',
      )

      await waitFor(() => expect(screen.queryByTestId('offer-pending-locked')).not.toBeInTheDocument())
      expect(screen.queryByText(/Tu último pago quedó sin confirmar/)).not.toBeInTheDocument()
      await waitFor(() => expect(elegirPremium()).toBeEnabled())
      expect(getProgress).toHaveBeenCalledTimes(3)

      // Y de verdad se puede cambiar de plan: se cierra la ventana y se abre la de Premium.
      const user = userEvent.setup()
      await user.click(screen.getByRole('button', { name: /cerrar|close/i }))
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
      await user.click(elegirPremium())
      expect(within(screen.getByRole('dialog')).getByText(/Premium/)).toBeInTheDocument()
      expect(activatePlan).toHaveBeenCalledTimes(2)
    } finally {
      delete (document as { visibilityState?: unknown }).visibilityState
    }
  })
})

describe('OfferStep — embudo de la tarjeta en PostHog (27-oct)', () => {
  it('abrir la ventana y cerrarla sin pagar se miden, con la oferta y el tiempo abierto', async () => {
    pintar()
    const user = await abrirLaOferta()
    expect(track).toHaveBeenCalledWith('plan_card_opened', expect.objectContaining({ tier: 'PRO', flow: 'short' }))

    await user.click(screen.getByRole('button', { name: /cerrar|close/i }))
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(track).toHaveBeenCalledWith(
      'plan_card_closed',
      expect.objectContaining({ tier: 'PRO', flow: 'short', seconds_open: expect.any(Number) }),
    )
    const abierto = track.mock.calls.find(([e]) => e === 'plan_card_opened')?.[1] as Record<string, unknown>
    expect(abierto.launch_offer_code).toBe(OFERTA.code)
  })

  it('con un cobro en vuelo la ventana no se cierra y NO se cuenta como «cerró sin pagar»', async () => {
    activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
    pintar()
    const user = await abrirLaOferta()
    await user.click(screen.getByRole('button', { name: /pagar/i }))
    await screen.findByText(/Confirmando tu pago/i)
    await user.keyboard('{Escape}')
    expect(track).not.toHaveBeenCalledWith('plan_card_closed', expect.anything())
  })
})
