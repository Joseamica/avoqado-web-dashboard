/**
 * La vista ESTÁNDAR del alta corta (sin oferta, o tras «Ver otros planes»), con el `PlanStep` REAL.
 *
 * 🔴 Por qué existe este archivo aparte, y por qué NO stubbea `PlanStep`:
 * `OfferStep.test.tsx` lo sustituye por un `<div>`, así que ahí el camino que va de «Pagar hoy»
 * → `activateBeforeContinue` → `onNext` → `onFreePlan` **nunca se ejercita**. Con el stub puesto,
 * un rechazo del banco pasaba verde mientras en la pantalla real el alta AVANZABA: el asistente
 * guardaba `plan.payNow = true` y terminaba el alta sin que existiera un cobro.
 *
 * Lo que fija este archivo, todo medido antes de arreglarlo:
 *  1. Ningún desenlace que no sea un 200 avanza. Ni 402, ni 409, ni una caída de red.
 *  2. Un fallo se VE: el mensaje queda bajo el formulario de tarjeta, no solo en la consola.
 *  3. Sin `planQuote` NO se cobra **y tampoco se avanza** — antes era un `return` mudo que dejaba
 *     pasar un plan de PAGO sin haber llamado a `activate-plan` una sola vez.
 *  4. El camino feliz manda el cuerpo `STANDARD` exacto del contrato (§3.6).
 */
import { useEffect, useState } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
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
// `toast` y `t` ESTABLES, como los reales: uno nuevo en cada render re-dispara el efecto que pide el SetupIntent
// y escondía justo el defecto de reintentar tras un rechazo (full-testing, 26-sep).
const toastEstable = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastEstable }) }))
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
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({ secret: secretMontado.actual }),
}))
// La rejilla de precios no participa en el cobro; el tier por defecto (PRO mensual) es el que
// `PlanStep` ya trae seleccionado.
let propsDelPicker: Record<string, unknown> = {}
vi.mock('@/components/billing/PlanPicker', () => ({
  PlanPicker: (p: Record<string, unknown>) => {
    propsDelPicker = p
    return <div data-testid="plan-picker" />
  },
}))
// Catalog interaction has its own tests; keep the real PlanStep payment flow under test here.
vi.mock('@/components/billing/FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => <div data-testid="feature-catalog" /> }))
const i18nEstable = vi.hoisted(() => ({
  t: (k: string, o?: any) => {
    const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
    return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
  },
  i18n: { language: 'es' },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => i18nEstable }))

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

function errorHttp(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { response: { status, data: { code, message: `mensaje-${code}`, ...extra } } }
}

const onActivated = vi.fn()
const onFinish = vi.fn()
const onRefreshProgress = vi.fn()
const onFreePlan = vi.fn()

/** Sin campaña ⇒ `OfferStep` abre DIRECTO en la vista estándar, que es el `PlanStep` real. */
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

/** Elegir el plan y pasar a la pantalla de pago (la tarjeta ya no vive bajo la cuadrícula). */
async function alPago(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
  await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
  return user
}

async function pagarHoy() {
  const user = await alPago()
  await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
  await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
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

describe('vista estándar — el camino feliz (no tenía ninguna prueba)', () => {
  it('manda el cuerpo STANDARD exacto con el monto que el SERVIDOR cotizó, y avisa al asistente', async () => {
    activatePlan.mockResolvedValue({
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 69484,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
    })

    pintarEstandar()
    await pagarHoy()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan).toHaveBeenCalledWith('org_1', {
      tier: 'PRO',
      interval: 'monthly',
      payNow: true,
      paymentMethodId: 'pm_123',
      offer: { kind: 'STANDARD', expectedFirstChargeCents: 69484 },
      language: 'es',
    })
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })

  it('la prueba gratis cobra CERO hoy y también pasa por activate-plan', async () => {
    activatePlan.mockResolvedValue({
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 0,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
    })

    pintarEstandar()
    const user = await alPago()
    await user.click(screen.getByRole('button', { name: /30 días gratis/i }))

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(activatePlan.mock.calls[0][1]).toMatchObject({ payNow: false, offer: { kind: 'STANDARD', expectedFirstChargeCents: 0 } })
  })

  it('el plan GRATIS sigue sin tarjeta y sin cobro', async () => {
    pintarEstandar({ data: { plan: { tier: 'FREE' } } })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /plan Gratis/i }))

    await waitFor(() => expect(onFreePlan).toHaveBeenCalledTimes(1))
    expect(onFreePlan.mock.calls[0][0]).toMatchObject({ tier: 'FREE' })
    expect(activatePlan).not.toHaveBeenCalled()
  })
})

describe('vista estándar — un solo idioma de precio: CON IVA', () => {
  // 🔴 La tarjeta decía «$999 + IVA», su nota «3 meses a $694.84… IVA incluido» y el botón
  // «3 meses a $599»: tres números para el mismo cobro. En México el precio que se ve es el que
  // se paga, así que todo sale de la cotización del servidor, con IVA.
  it('las tarjetas reciben los precios del servidor con IVA', async () => {
    pintarEstandar()
    await waitFor(() => expect(screen.getByTestId('plan-picker')).toBeInTheDocument())
    expect(propsDelPicker.preciosConIva).toEqual({
      PRO: { monthlyCents: 115884, annualCents: 1158840 },
      PREMIUM: { monthlyCents: 197084, annualCents: 1970840 },
    })
  })

  it('el botón de pagar hoy dice el precio de la promo CON IVA, no «$599»', async () => {
    pintarEstandar()
    const user = await alPago()
    await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
    expect(screen.getByRole('button', { name: 'Pagar hoy y ahorrar (3 meses a $694.84)' })).toBeInTheDocument()
    expect(screen.queryByText(/\$599/)).not.toBeInTheDocument()
  })
})

describe('vista estándar — ningún fallo avanza, y todos se VEN', () => {
  it('🔴 402 del banco: NO avanza el alta y el motivo queda en pantalla', async () => {
    activatePlan.mockRejectedValue(
      errorHttp(402, 'PLAN_PAYMENT_DECLINED', { details: { declineCode: 'card_declined', message: 'Tu banco rechazó el cargo' } }),
    )

    pintarEstandar()
    await pagarHoy()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Tu banco rechazó el cargo/)).toBeInTheDocument()
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('🔴 sin `planQuote` NO se llama a activate-plan NI se avanza — antes pasaba como plan de pago', async () => {
    pintarEstandar({ planQuote: null })
    await pagarHoy()

    await waitFor(() => expect(screen.getByText(/No pudimos|precios/i)).toBeInTheDocument())
    expect(activatePlan).not.toHaveBeenCalled()
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('🔴 409 OFFER_CHANGED no avanza: el precio nuevo se vuelve a consentir', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'OFFER_CHANGED'))

    pintarEstandar()
    await pagarHoy()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onRefreshProgress).toHaveBeenCalled())
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  // Cambio DELIBERADO (Codex ronda 10, P1): antes decía «No pudimos procesar el pago» y soltaba el plan.
  // Sin respuesta la petición PUDO cobrar: decir «no se pudo» invitaba a pagar otra vez con otra
  // tarjeta. Sigue sin avanzar y sigue diciéndolo — ahora con la verdad: se está confirmando.
  it('🔴 una caída de red (sin `response`) no avanza, dice que se está confirmando y NO suelta el plan', async () => {
    activatePlan.mockRejectedValue(new Error('Network Error'))

    pintarEstandar()
    await pagarHoy()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/Confirmando tu pago/i)).toBeInTheDocument()
    expect(screen.queryByText(/No pudimos procesar el pago/i)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Cambiar plan/i })).toBeDisabled()
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(onActivated).not.toHaveBeenCalled()
  })

  it('🔴 409 PLAN_ALREADY_ACTIVATED no avanza como si se hubiera cobrado: ofrece ENTRAR', async () => {
    activatePlan.mockRejectedValue(errorHttp(409, 'PLAN_ALREADY_ACTIVATED', { details: { currentTier: 'PREMIUM' } }))

    pintarEstandar()
    await pagarHoy()

    expect(await screen.findByRole('button', { name: /Entrar a Avoqado/i })).toBeInTheDocument()
    expect(onFreePlan).not.toHaveBeenCalled()
    expect(saveStep).not.toHaveBeenCalled()
  })
})

describe('🔴 un cobro que se está CONFIRMANDO (503 y reintentos) mantiene el plan bloqueado (Codex ronda 8, P1)', () => {
  const exito = {
    data: {
      data: {
        status: 'ACTIVE',
        alreadyActive: false,
        tier: 'PRO',
        interval: 'monthly',
        firstChargeCents: 69484,
        nextChargeAt: '2026-10-17T00:00:00.000Z',
      },
    },
  }

  it('entre el 503 y el reintento no se puede cambiar a Free: el reintento activa Pro y el alta NO avanza como Free', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce(exito)
      pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
      await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))

      // El primer intento ya terminó (503) y el reintento está agendado: el candado sigue puesto.
      const cambiar = await screen.findByRole('button', { name: /Cambiar plan/i })
      await waitFor(() => expect(cambiar).toBeDisabled())
      await user.click(cambiar)
      expect(screen.getByTestId('payment-element')).toBeInTheDocument()
      expect(screen.queryByTestId('plan-picker')).not.toBeInTheDocument()
      // Y no se puede pagar OTRA vez encima del cobro que se está confirmando.
      expect(screen.getByRole('button', { name: /Pagar hoy/i })).toBeDisabled()

      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
      await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
      expect(onFreePlan).not.toHaveBeenCalled()
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
      await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
      await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))

      unmount()
      responder(exito)
      await vi.advanceTimersByTimeAsync(50)
      expect(onActivated).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('🔴 Codex ronda 9 — vista estándar', () => {
  const exito = {
    data: {
      data: {
        status: 'ACTIVE',
        alreadyActive: false,
        tier: 'PRO',
        interval: 'monthly',
        firstChargeCents: 69484,
        nextChargeAt: '2026-10-17T00:00:00.000Z',
      },
    },
  }

  it('el reintento ya confirmó pero el respaldo sigue guardándose: no se desbloquea, y si la pantalla se va no avanza nada', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      let terminarRespaldo: (v: unknown) => void = () => {}
      activatePlan.mockRejectedValueOnce(errorHttp(503, 'PLAN_ACTIVATION_PENDING')).mockResolvedValueOnce(exito)
      saveStep.mockImplementation(() => new Promise(r => (terminarRespaldo = r)))
      const { unmount } = pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
      await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
      await vi.advanceTimersByTimeAsync(10_000)
      await waitFor(() => expect(saveStep).toHaveBeenCalledTimes(1))

      expect(screen.getByRole('button', { name: /Cambiar plan/i })).toBeDisabled()
      unmount()
      terminarRespaldo({})
      await vi.advanceTimersByTimeAsync(50)
      expect(onActivated).not.toHaveBeenCalled()
      expect(onFreePlan).not.toHaveBeenCalled()
    } finally {
      vi.useRealTimers()
    }
  })

  it('«sin confirmar» deja el plan bloqueado: ni «Cambiar plan» ni Free, y ofrece volver a comprobar', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      activatePlan.mockRejectedValue(errorHttp(503, 'PLAN_ACTIVATION_PENDING'))
      pintarEstandar()
      const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime })
      await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
      await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
      await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
      await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
      for (let i = 0; i < 4; i++) await vi.advanceTimersByTimeAsync(10_000)

      await waitFor(() => expect(screen.getByTestId('offer-pending-locked')).toBeInTheDocument())
      const cambiar = screen.getByRole('button', { name: /Cambiar plan/i })
      expect(cambiar).toBeDisabled()
      await user.click(cambiar)
      expect(screen.queryByTestId('plan-picker')).not.toBeInTheDocument()
      expect(onFreePlan).not.toHaveBeenCalled()
      expect(screen.getByRole('button', { name: /Volver a comprobar mi pago/i })).toBeEnabled()
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('🔴 revisión independiente (26-sep) — vista estándar tras recargar con un cobro colgado', () => {
  it('se puede llegar a la tarjeta y confirmar; «Cambiar plan» y Free siguen bloqueados', async () => {
    activatePlan.mockResolvedValue({
      data: {
        data: {
          status: 'ACTIVE',
          alreadyActive: false,
          tier: 'PRO',
          interval: 'monthly',
          firstChargeCents: 69484,
          nextChargeAt: '2026-10-17T00:00:00.000Z',
        },
      },
    })
    pintarEstandar({ activacionEnCurso: true })
    const user = userEvent.setup()
    await user.click(await screen.findByRole('button', { name: /^Continuar$/ }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /Cambiar plan/i })).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
    await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
    // Un plan de pago cierra el paso por la misma función (`onFreePlan` con el plan dentro); lo que nunca
    // puede pasar es cerrarlo como FREE.
    expect(onFreePlan.mock.calls.every(([plan]) => plan?.tier !== 'FREE')).toBe(true)
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
      .mockResolvedValueOnce({
        data: {
          data: {
            status: 'ACTIVE',
            alreadyActive: false,
            tier: 'PRO',
            interval: 'monthly',
            firstChargeCents: 69484,
            nextChargeAt: '2026-10-17T00:00:00.000Z',
          },
        },
      })
    pintarEstandar()
    await pagarHoy()
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))

    // El formulario vuelve con el SetupIntent NUEVO (el viejo ya quedó confirmado con la tarjeta rechazada)…
    await waitFor(() => expect(screen.getByTestId('elements')).toHaveAttribute('data-secret', 'seti_2'))
    // …y el mensaje del banco sigue a la vista aunque el formulario se haya vuelto a montar.
    expect(screen.getByRole('alert')).toHaveTextContent(/rechaz/i)

    const user = userEvent.setup()
    await user.click(screen.getByRole('radio', { name: /Pagar hoy/i }))
    await user.click(screen.getByRole('button', { name: /Pagar hoy/i }))
    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(2))
    expect(confirmSetup.mock.calls[1][0].elements.secret).toBe('seti_2')
    await waitFor(() => expect(onActivated).toHaveBeenCalledTimes(1))
  })
})
