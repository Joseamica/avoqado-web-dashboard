/**
 * Humo del `PlanStep` del asistente LARGO.
 *
 * 🔴 Existe porque la oferta le agregó dos props (`activateBeforeContinue` y `quote`) y el
 * asistente largo NO las pasa: ahí el cobro sigue ocurriendo al finalizar, por el camino legacy.
 * Si alguien hiciera el cobro obligatorio dentro del paso, el alta larga cobraría dos veces.
 */
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()
const activateBeforeContinue = vi.fn()

vi.mock('@/services/setup.service', () => ({
  setupService: { planSetupIntent: (...a: unknown[]) => planSetupIntent(...a), activatePlan: vi.fn(), saveStep: vi.fn() },
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: () => <div data-testid="payment-element" />,
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({}),
}))
vi.mock('@/components/billing/PlanPicker', () => ({ PlanPicker: () => <div data-testid="plan-picker" /> }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: any) => {
      const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
      return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
    },
  }),
}))

import { PlanStep } from '../steps/PlanStep'

beforeEach(() => {
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti' } } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_1' } })
  activateBeforeContinue.mockReset().mockResolvedValue(undefined)
})

describe('asistente LARGO (sin props nuevas)', () => {
  it('sigue ofreciendo prueba gratis y pago hoy, y guarda el plan sin cobrar aquí', async () => {
    const onNext = vi.fn()
    render(<PlanStep data={{}} onNext={onNext} venueId="venue_1" organizationId="org_1" />)

    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(screen.getByRole('button', { name: /30 días gratis/i })).toBeInTheDocument()

    await userEvent.setup().click(screen.getByRole('button', { name: /30 días gratis/i }))
    await waitFor(() => expect(onNext).toHaveBeenCalledTimes(1))
    expect(onNext.mock.calls[0][0].plan).toMatchObject({ tier: 'PRO', paymentMethodId: 'pm_1', payNow: false })
  })

  it('el plan GRATIS sigue sin tarjeta', () => {
    const onNext = vi.fn()
    render(<PlanStep data={{ plan: { tier: 'FREE' } }} onNext={onNext} venueId="venue_1" organizationId="org_1" />)
    expect(screen.getByRole('button', { name: /plan Gratis/i })).toBeInTheDocument()
  })
})

describe('alta CORTA (con activateBeforeContinue)', () => {
  it('cobra ANTES de avanzar', async () => {
    const onNext = vi.fn()
    render(<PlanStep data={{}} onNext={onNext} venueId="venue_1" organizationId="org_1" activateBeforeContinue={activateBeforeContinue} />)
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await userEvent.setup().click(screen.getByRole('button', { name: /Pagar hoy/i }))

    await waitFor(() =>
      expect(activateBeforeContinue).toHaveBeenCalledWith({
        tier: 'PRO',
        interval: 'monthly',
        payNow: true,
        paymentMethodId: 'pm_1',
      }),
    )
    await waitFor(() => expect(onNext).toHaveBeenCalled())
  })

  it('🔴 si el cobro REVIENTA no se avanza: avanzar dejaría el alta creyendo que hay plan pagado', async () => {
    const onNext = vi.fn()
    activateBeforeContinue.mockRejectedValue(new Error('402'))
    render(<PlanStep data={{}} onNext={onNext} venueId="venue_1" organizationId="org_1" activateBeforeContinue={activateBeforeContinue} />)
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await userEvent.setup().click(screen.getByRole('button', { name: /Pagar hoy/i }))

    await waitFor(() => expect(activateBeforeContinue).toHaveBeenCalled())
    expect(onNext).not.toHaveBeenCalled()
    // Y la persona se entera: un fallo mudo la haría tocar otra vez sobre un cobro que ya salió.
    expect(await screen.findByText(/No pudimos procesar el pago/i)).toBeInTheDocument()
  })

  it('con `quote` la línea promocional sale de los montos del SERVIDOR', async () => {
    render(
      <PlanStep
        data={{}}
        onNext={vi.fn()}
        venueId="venue_1"
        organizationId="org_1"
        quote={{
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
        }}
      />,
    )
    expect(await screen.findByText(/Paga hoy: 3 meses a \$694\.84, luego \$1,158\.84 al mes/)).toBeInTheDocument()
  })

  it('🔴 bajo «30 días gratis» dice qué se cobra y cuándo: el precio COMPLETO, sin el descuento de pagar hoy', async () => {
    render(
      <PlanStep
        data={{}}
        onNext={vi.fn()}
        venueId="venue_1"
        organizationId="org_1"
        quote={{
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
        }}
      />,
    )
    const aviso = await screen.findByText(/Hoy no pagas nada/)
    expect(aviso.textContent).toMatch(/se cobran \$1,158\.84 al mes a esta tarjeta/)
    expect(aviso.textContent).not.toMatch(/694/)
    expect(aviso.textContent).toMatch(/Cancela antes/)
  })
})
