/**
 * PlanStep con el PlanPicker REAL (B4, Task 8, fix 1): sin versión, el selector Mensual/Anual conserva su píldora «2 meses gratis».
 * El paso nunca recibe cotización en producción, así que le pasaba al picker un objeto vacío, que éste tomaba por «hay cotización».
 */
import { useEffect } from 'react'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/services/setup.service', () => ({
  setupService: { planSetupIntent: () => Promise.resolve({ data: { data: { clientSecret: 's' } } }) },
}))
vi.mock('@/services/hybridBilling.service', () => ({ getPublicBasicPlan: () => Promise.resolve(null) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
vi.mock('@stripe/stripe-js', () => ({ loadStripe: () => Promise.resolve(null) }))
vi.mock('@stripe/react-stripe-js', () => ({
  Elements: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  PaymentElement: ({ onReady }: { onReady?: () => void }) => {
    useEffect(() => {
      onReady?.()
    }, [onReady])
    return <div />
  },
  useStripe: () => ({}),
  useElements: () => ({}),
}))
vi.mock('@/components/billing/FeatureCatalogBrowser', () => ({ FeatureCatalogBrowser: () => null }))
vi.mock('@/components/billing/HybridOnboardingButton', () => ({ HybridOnboardingButton: () => null }))
vi.mock('@/components/billing/PlanComparison', () => ({ PlanComparison: () => null }))
vi.mock('react-i18next', () => import('./traduccionesDePrueba'))
vi.mock('@/hooks/usePlanOffer', async () => {
  const f = await import('@/hooks/__tests__/planOfferFixtures')
  return f.moduloDelHookConOferta(() => f.ofertaActual.valor)
})

import { PlanStep } from '../steps/PlanStep'
import { OFERTA_V1, ofertaActual } from '@/hooks/__tests__/planOfferFixtures'

beforeEach(() => {
  localStorage.clear()
  ofertaActual.valor = OFERTA_V1
})

describe('PlanStep con el PlanPicker real', () => {
  it('🔴 sin versión (v1: Pro y Premium a 10 mensualidades) el selector anual dice «2 meses gratis», como hoy', () => {
    render(<PlanStep data={{}} onNext={vi.fn()} venueId="venue_1" organizationId="org_1" />)
    expect(screen.getByRole('button', { name: /Anual/ })).toHaveTextContent('2 meses gratis')
  })
})
