/**
 * La prueba de 30 días del alta corta (sin campaña, o tras una oferta que se acabó): el cuerpo STANDARD.
 *
 * 🔴 Por qué existe este archivo aparte: el camino de la prueba cobra por el MISMO endpoint que la oferta
 * pero con otro cuerpo, y es donde antes se colaban los avances sin cobro (con el `PlanStep` de entonces un
 * rechazo del banco pasaba verde mientras el alta AVANZABA y guardaba un plan de pago sin cargo detrás).
 *
 * Lo que fija este archivo, todo medido antes de arreglarlo:
 *  1. Ningún desenlace que no sea un 200 avanza. Ni 402, ni 409, ni una caída de red.
 *  2. Un fallo se VE: el mensaje queda bajo el formulario de tarjeta, no solo en la consola.
 *  3. Sin `planQuote` NO se cobra **y tampoco se avanza** (Review Focus 4).
 *  4. El camino feliz manda el cuerpo `STANDARD` exacto: `payNow:false` y `expectedFirstChargeCents: 0`.
 *
 * Las garantías de los caminos que la pantalla ya no ofrece (pagar hoy $694.84, anual, Gratis) se
 * trasladaron aquí, al cuerpo de la prueba (spec §6-bis 3). El servidor y sus pruebas no cambian.
 */
import { useEffect, useState } from 'react'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const activatePlan = vi.fn()
const saveStep = vi.fn()
const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()

const secretMontado = vi.hoisted(() => ({ actual: undefined as string | undefined }))
vi.mock('@/services/setup.service', () => ({
  setupService: {
    activatePlan: (...a: unknown[]) => activatePlan(...a),
    saveStep: (...a: unknown[]) => saveStep(...a),
    planSetupIntent: (...a: unknown[]) => planSetupIntent(...a),
  },
}))
vi.mock('@/lib/gtag', () => ({ trackPurchase: vi.fn(), trackSignup: vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
const toastEstable = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastEstable }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  // Como el <Elements> REAL: su `clientSecret` es INMUTABLE — se queda con el del primer montaje y sólo
  // cambia si se vuelve a montar (full-testing, 26-sep).
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
import type { PlanQuote } from '../launchOffer.types'

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

const exito = (tier: 'PRO' | 'PREMIUM' = 'PRO') => ({
  data: {
    data: {
      status: 'ACTIVE',
      alreadyActive: false,
      tier,
      interval: 'monthly',
      firstChargeCents: 0,
      nextChargeAt: '2026-11-16T00:00:00.000Z',
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

/** Sin campaña ⇒ las 3 tarjetas en modo prueba de 30 días. */
function pintarEstandar(props: Partial<React.ComponentProps<typeof OfferStep>> = {}) {
  return render(
    <OfferStep
      organizationId="org_1"
      venueId="venue_1"
      launchOffer={null}
      planQuote={QUOTE}
      onActivated={onActivated}
      onFinish={onFinish}
      onRefreshProgress={onRefreshProgress}
      onFreePlan={onFreePlan}
      {...props}
    />,
  )
}

/** Elegir el plan abre la ventana para pagar con el formulario de tarjeta. */
async function abrir(plan: 'Pro' | 'Premium' = 'Pro', user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: `Elegir ${plan}` }))
  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  return user
}

async function empezarPrueba(plan: 'Pro' | 'Premium' = 'Pro', user = userEvent.setup()) {
  await abrir(plan, user)
  await user.click(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' }))
  return user
}

const CUERPO_PREMIUM = {
  tier: 'PREMIUM',
  interval: 'monthly',
  payNow: false,
  paymentMethodId: 'pm_123',
  offer: { kind: 'STANDARD', expectedFirstChargeCents: 0 },
  language: 'es',
}

beforeEach(() => {
  activatePlan.mockReset()
  saveStep.mockReset().mockResolvedValue({})
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti_secret' } } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_123' } })
  onActivated.mockReset()
  onFinish.mockReset()
  onRefreshProgress.mockReset().mockResolvedValue(undefined)
  onFreePlan.mockReset()
})

describe('prueba de 30 días — el camino feliz', () => {
  it('«Elegir Premium» manda el cuerpo STANDARD exacto (cobro de hoy = 0) y avisa al asistente tras el 200', async () => {
    activatePlan.mockResolvedValue(exito('PREMIUM'))

    pintarEstandar()
    await empezarPrueba('Premium')

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', CUERPO_PREMIUM)
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    expect(onActivated.mock.calls[0][1]).toMatchObject({ tier: 'PREMIUM', interval: 'monthly', payNow: false })
    // El respaldo del paso 10 va DESPUÉS del 200.
    expect(saveStep).toHaveBeenCalledWith(
      'org_1',
      10,
      expect.objectContaining({ plan: expect.objectContaining({ tier: 'PREMIUM', payNow: false }) }),
    )
    expect(onFreePlan).not.toHaveBeenCalled()
  })

  it('«Elegir Pro» también cobra CERO hoy y pasa por activate-plan', async () => {
    activatePlan.mockResolvedValue(exito())
    pintarEstandar()
    await empezarPrueba('Pro')
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toEqual({ ...CUERPO_PREMIUM, tier: 'PRO' })
  })
})

describe('prueba de 30 días — lo que dice la ventana', () => {
  it('título, «Hoy pagas $0.00», fecha y precio del primer cobro, y el legal de la prueba con el monto del servidor', async () => {
    pintarEstandar()
    await abrir('Premium')
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText('Empieza tu prueba de Premium')).toBeInTheDocument()
    expect(within(ventana).getByText('30 días gratis. Cancela antes y no se te cobra.')).toBeInTheDocument()
    expect(within(ventana).getByText('$0.00')).toBeInTheDocument()
    expect(within(ventana).getByText(/^Primer cobro: \d{1,2} de \p{L}+$/u)).toBeInTheDocument()
    expect(within(ventana).getByText('$1,970.84 con IVA')).toBeInTheDocument()
    expect(
      within(ventana).getByText(
        /^Al empezar aceptas que desde el \d{1,2} de \p{L}+ se cobren \$1,970\.84 al mes a esta tarjeta hasta que canceles\. Te avisamos 7 días antes\./u,
      ),
    ).toBeInTheDocument()
  })

  it('con el neto del servidor, el primer cobro dice «$1,699.00 + IVA = $1,970.84»', async () => {
    const conNeto: PlanQuote = {
      ...QUOTE,
      tiers: { ...QUOTE.tiers, PREMIUM: { ...QUOTE.tiers.PREMIUM, monthlyNetCents: 169900, annualNetCents: 1699000 } },
    }
    pintarEstandar({ planQuote: conNeto })
    await abrir('Premium')
    expect(within(screen.getByRole('dialog')).getByText('$1,699.00 + IVA = $1,970.84')).toBeInTheDocument()
  })
})

describe('prueba de 30 días — ningún fallo avanza, y todos se VEN', () => {
  it('🔴 402 del banco: NO avanza el alta, NO escribe step/10 y el motivo queda en pantalla', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined', message: 'Tu banco rechazó el cargo' } }),
    )

    pintarEstandar()
    await empezarPrueba('Premium')

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toEqual(CUERPO_PREMIUM)
    expect(await screen.findByText(/Tu banco rechazó el cargo/)).toBeInTheDocument()
    expect(onActivated).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
  })

  it('🔴 Review Focus 4: sin `planQuote` NO se llama a activate-plan NI se avanza — dice `offer.noQuote`', async () => {
    pintarEstandar({ planQuote: null })
    await empezarPrueba('Pro')

    expect(await screen.findByText('No pudimos cargar los precios. Recarga la página e intenta de nuevo.')).toBeInTheDocument()
    expect(activatePlan).not.toHaveBeenCalled()
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
    // La tarjeta ya confirmó ese SetupIntent: el siguiente intento lleva uno nuevo.
    await waitFor(() => expect(planSetupIntent).toHaveBeenCalledTimes(2))
  })

  it('🔴 409 OFFER_CHANGED no avanza: el precio nuevo se vuelve a consentir', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'OFFER_CHANGED'))

    pintarEstandar()
    await empezarPrueba()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalled())
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument())
    expect(onActivated).not.toHaveBeenCalled()
  })

  // Cambio DELIBERADO (Codex ronda 10, P1): sin respuesta la petición PUDO cobrar: decir «no se pudo»
  // invitaba a pagar otra vez con otra tarjeta. No avanza y lo dice con la verdad: se está confirmando.
  it('🔴 una caída de red (sin `response`) no avanza, dice que se está confirmando y NO suelta el plan', async () => {
    activatePlan.mockRejectedValue(new Error('Network Error'))

    pintarEstandar()
    await empezarPrueba()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()
    expect(screen.queryByText(/No pudimos procesar el pago/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Elegir Premium' })).toBeDisabled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('🔴 409 PLAN_ALREADY_ACTIVATED no avanza como si se hubiera cobrado: ofrece ENTRAR', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'PLAN_ALREADY_ACTIVATED', { details: { currentTier: 'PREMIUM' } }))

    pintarEstandar()
    await empezarPrueba()

    expect(await screen.findByRole('button', { name: /Entrar a Avoqado/i })).toBeInTheDocument()
    expect(onActivated).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
  })
})

describe('🔴 un cobro de la prueba que se está CONFIRMANDO (503 y reintentos) mantiene el plan bloqueado (Codex ronda 8, P1)', () => {
  it('503 reintenta el MISMO cuerpo STANDARD; mientras, ni otro plan ni pagar otra vez, y al confirmar avanza', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce(exito('PREMIUM'))
      pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await empezarPrueba('Premium', user)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))

      // El primer intento ya terminó (503) y el reintento está agendado: el candado sigue puesto.
      await waitFor(() => expect(screen.getByRole('button', { name: 'Elegir Pro' })).toBeDisabled())
      expect(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' })).toBeDisabled()
      await user.keyboard('{Escape}')
      expect(screen.getByRole('dialog')).toBeInTheDocument()

      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      expect(activatePlan.mock.calls[1]).toEqual(activatePlan.mock.calls[0])
      expect(activatePlan.mock.calls[1][1]).toEqual(CUERPO_PREMIUM)
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    } finally {
      vi.useRealTimers()
    }
  })

  it('si la pantalla se va con un reintento EN VUELO, su respuesta tardía ya no activa nada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let responder: (v: unknown) => void = () => {}
      activatePlan
        .mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
        .mockImplementationOnce(() => new Promise(r => (responder = r)))
      const { unmount } = pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await empezarPrueba('Pro', user)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))

      unmount()
      responder(exito())
      await vi.advanceTimersByTimeAsync(50)
      expect(onActivated).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('🔴 Codex ronda 9 — prueba de 30 días', () => {
  it('el reintento ya confirmó pero el respaldo sigue guardándose: no se desbloquea, y si la pantalla se va no avanza nada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let terminarRespaldo: (v: unknown) => void = () => {}
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce(exito())
      saveStep.mockImplementation(() => new Promise(r => (terminarRespaldo = r)))
      const { unmount } = pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await empezarPrueba('Pro', user)
      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(saveStep).toHaveBeenCalledTimes(1))

      expect(screen.getByRole('button', { name: 'Elegir Premium' })).toBeDisabled()
      unmount()
      terminarRespaldo({})
      await vi.advanceTimersByTimeAsync(50)
      expect(onActivated).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('«sin confirmar» deja el plan bloqueado y ofrece volver a comprobar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
      pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await empezarPrueba('Pro', user)
      for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(10_000)

      await waitFor(() => expect(screen.getByTestId('offer-pending-locked')).toBeInTheDocument())
      expect(screen.getByRole('button', { name: 'Elegir Premium' })).toBeDisabled()
      expect(screen.getByRole('dialog')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /Volver a comprobar mi pago/i })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('🔴 recarga con un cobro colgado — sin campaña', () => {
  it('«Confirmar mi pago» abre la prueba de Pro con la tarjeta habilitada; las tarjetas siguen bloqueadas', async () => {
    activatePlan.mockResolvedValue(exito())
    pintarEstandar({ activacionEnCurso: true })
    const user = userEvent.setup()
    expect(await screen.findByRole('button', { name: 'Elegir Premium' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Confirmar mi pago' }))
    const ventana = screen.getByRole('dialog')
    expect(within(ventana).getByText('Empieza tu prueba de Pro')).toBeInTheDocument()
    await waitFor(() => expect(within(ventana).getByRole('button', { name: 'Empezar mis 30 días gratis' })).toBeEnabled())
    await user.click(within(ventana).getByRole('button', { name: 'Empezar mis 30 días gratis' }))

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toEqual({ ...CUERPO_PREMIUM, tier: 'PRO' })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    expect(onFreePlan).not.toHaveBeenCalled()
  })
})

describe('🔴 full-testing 26-sep: tras un rechazo se puede pagar con OTRA tarjeta sin recargar', () => {
  it('pide un SetupIntent nuevo, remonta el formulario con él, conserva el mensaje y el segundo intento lo usa', async () => {
    planSetupIntent
      .mockReset()
      .mockResolvedValueOnce({ data: { data: { clientSecret: 'seti_1' } } })
      .mockResolvedValue({ data: { data: { clientSecret: 'seti_2' } } })
    activatePlan
      .mockRejectedValueOnce(errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined' } }))
      .mockResolvedValueOnce(exito('PREMIUM'))
    pintarEstandar()
    const user = await empezarPrueba('Premium')
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))

    // El formulario vuelve con el SetupIntent NUEVO (el viejo ya quedó confirmado con la tarjeta rechazada)…
    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    // …y el mensaje del banco sigue a la vista aunque el formulario se haya vuelto a montar.
    expect(screen.getByRole('alert')).toHaveTextContent(/rechaz/i)

    await user.click(screen.getByRole('button', { name: 'Empezar mis 30 días gratis' }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
    expect(activatePlan.mock.calls[1][1]).toEqual(CUERPO_PREMIUM)
    expect(confirmSetup.mock.calls[1][0].elements.secret).toBe('seti_2')
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })
})
