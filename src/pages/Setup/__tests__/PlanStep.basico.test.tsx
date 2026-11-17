/**
 * PlanStep — tarjeta del Plan Básico: se elige como una tarjeta más, por dentro es Pro mensual SIN pagar hoy.
 */
import { useEffect } from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const planSetupIntent = vi.fn()
const confirmSetup = vi.fn()
const getPublicBasicPlan = vi.fn()
const activateBeforeContinue = vi.fn()

vi.mock('@/services/setup.service', () => ({ setupService: { planSetupIntent: (...a: unknown[]) => planSetupIntent(...a) } }))
vi.mock('@/services/hybridBilling.service', () => ({ getPublicBasicPlan: (...a: unknown[]) => getPublicBasicPlan(...a) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => confirmSetup(...a) }),
  useElements: () => ({}),
}))
// El picker real no importa aquí: sólo que pinte la tarjeta Básico y deje elegir Pro.
vi.mock('@/components/billing/PlanPicker', () => ({
  PlanPicker: ({ leadingCard, leadingSelected, onSelectTier }: any) => (
    <div data-testid="plan-picker" data-leading-selected={String(leadingSelected)}>
      {leadingCard}
      <button onClick={() => onSelectTier('PRO', 'monthly')}>elegir-pro</button>
    </div>
  ),
}))
vi.mock('@/components/billing/FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => null }))
vi.mock('@/components/billing/HybridOnboardingButton', () => ({ HybridOnboardingButton: () => null }))
vi.mock('@/components/billing/PlanComparison', () => ({ PlanComparison: () => null }))
const t = (k: string, o?: any) => {
  const base = typeof o?.defaultValue === 'string' ? o.defaultValue : k
  return base.replace(/\{\{(\w+)\}\}/g, (_: string, n: string) => String(o?.[n] ?? ''))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t, i18n: { language: 'es' } }) }))

import { PlanStep } from '../steps/PlanStep'

const BASICO = {
  slug: 'plan-basico',
  name: 'Plan Básico',
  priceWithTax: '578.84',
  priceWithoutTax: '499.00',
  featureCodes: ['KITCHEN_DISPLAY'],
  seatCap: null,
  trialDays: 30,
  publicationId: 'pub_1',
}

beforeEach(() => {
  localStorage.clear()
  planSetupIntent.mockReset().mockResolvedValue({ data: { data: { clientSecret: 'seti' } } })
  confirmSetup.mockReset().mockResolvedValue({ setupIntent: { payment_method: 'pm_1' } })
  getPublicBasicPlan.mockReset().mockResolvedValue(BASICO)
  activateBeforeContinue.mockReset().mockResolvedValue(undefined)
})

describe('PlanStep · Plan Básico', () => {
  it('sin Básico publicado no hay tarjeta (regresión)', async () => {
    getPublicBasicPlan.mockResolvedValue(null)
    render(<PlanStep data={{}} onNext={vi.fn()} venueId="v1" organizationId="o1" />)
    await waitFor(() => expect(getPublicBasicPlan).toHaveBeenCalled())
    expect(screen.queryByText('Plan Básico')).not.toBeInTheDocument()
  })

  it('elegirlo guarda Pro mensual sin pagar hoy con basicPlan, y el pago es UN solo botón de prueba', async () => {
    const onNext = vi.fn()
    render(<PlanStep data={{}} onNext={onNext} venueId="v1" organizationId="o1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: /Plan Básico/ }))
    expect(screen.getByTestId('plan-picker')).toHaveAttribute('data-leading-selected', 'true')
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    expect(screen.queryByRole('radio', { name: /Pagar hoy/i })).not.toBeInTheDocument()
    expect(screen.getByText(/podrás contratar el Básico por \$499 \+ IVA al mes/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Empezar 30 días gratis/i }))
    await waitFor(() => expect(onNext).toHaveBeenCalled())
    expect(onNext.mock.calls[0][0].plan).toMatchObject({
      tier: 'PRO',
      basicPlan: true,
      interval: 'monthly',
      payNow: false,
      paymentMethodId: 'pm_1',
    })
  })

  it('volver a Pro quita el Básico: no viaja basicPlan', async () => {
    const onNext = vi.fn()
    render(<PlanStep data={{}} onNext={onNext} venueId="v1" organizationId="o1" />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: /Plan Básico/ }))
    await user.click(screen.getByRole('button', { name: 'elegir-pro' }))
    expect(screen.getByTestId('plan-picker')).toHaveAttribute('data-leading-selected', 'false')
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /30 días gratis/i }))
    await waitFor(() => expect(onNext).toHaveBeenCalled())
    expect(onNext.mock.calls[0][0].plan.basicPlan).toBeUndefined()
  })

  it('en el alta corta avisa basicPlan al cobrar antes de continuar', async () => {
    render(<PlanStep data={{}} onNext={vi.fn()} venueId="v1" organizationId="o1" activateBeforeContinue={activateBeforeContinue} />)
    const user = userEvent.setup()
    await user.click(await screen.findByRole('radio', { name: /Plan Básico/ }))
    await user.click(screen.getByRole('button', { name: /^Continuar$/ }))
    await waitFor(() => expect(screen.getByTestId('payment-element')).toBeInTheDocument())
    await user.click(screen.getByRole('button', { name: /Empezar 30 días gratis/i }))
    await waitFor(() =>
      expect(activateBeforeContinue).toHaveBeenCalledWith({
        tier: 'PRO',
        interval: 'monthly',
        payNow: false,
        paymentMethodId: 'pm_1',
        basicPlan: true,
      }),
    )
  })

  it('hybridOffer = slug del Básico: llega con su tarjeta preseleccionada', async () => {
    render(<PlanStep data={{ hybridOfferSlug: 'plan-basico' }} onNext={vi.fn()} venueId="v1" organizationId="o1" />)
    await waitFor(() => expect(screen.getByRole('radio', { name: /Plan Básico/ })).toHaveAttribute('aria-checked', 'true'))
  })

  it('hybridOffer de OTRO slug: no preselecciona el Básico', async () => {
    render(<PlanStep data={{ hybridOfferSlug: 'paquete-x' }} onNext={vi.fn()} venueId="v1" organizationId="o1" />)
    const card = await screen.findByRole('radio', { name: /Plan Básico/ })
    expect(card).toHaveAttribute('aria-checked', 'false')
  })
})
