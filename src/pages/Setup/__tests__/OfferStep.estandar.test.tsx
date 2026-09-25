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
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const activatePlan = vi.fn()
const saveStep = vi.fn()
const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()

vi.mock('@/services/setup.service', () => ({
  setupService: {
    activatePlan: (...a: unknown[]) => activatePlan(...a),
    saveStep: (...a: unknown[]) => saveStep(...a),
    planSetupIntent: (...a: unknown[]) => planSetupIntent(...a),
  },
}))
vi.mock('@/lib/gtag', () => ({ trackPurchase: vi.fn(), trackSignup: vi.fn() }))
vi.mock('@/lib/posthog', () => ({ track: vi.fn() }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({}),
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
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => {
      const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
      return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
    },
    i18n: { language: 'es' },
  }),
}))

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

  it('🔴 una caída de red (sin `response`) no avanza y lo dice', async () => {
    activatePlan.mockRejectedValue(new Error('Network Error'))

    pintarEstandar()
    await pagarHoy()

    await waitFor(() => expect(activatePlan).toHaveBeenCalledTimes(1))
    expect(await screen.findByText(/No pudimos procesar el pago/i)).toBeInTheDocument()
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
