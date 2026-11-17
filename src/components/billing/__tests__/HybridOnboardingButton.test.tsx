import { render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const getPublicBasicPlan = vi.fn()
vi.mock('@/services/hybridBilling.service', () => ({ getPublicBasicPlan: (...a: unknown[]) => getPublicBasicPlan(...a) }))
vi.mock('../HybridCheckout', () => ({ HybridCheckout: () => <div data-testid="checkout" /> }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ open, children }: any) => (open ? <div data-testid="modal">{children}</div> : null),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

import { HybridOnboardingButton } from '../HybridOnboardingButton'

beforeEach(() => {
  localStorage.clear()
  getPublicBasicPlan.mockReset()
})

describe('HybridOnboardingButton — recomendación hybridOffer', () => {
  it('slug del Básico: NO abre la compra inmediata', async () => {
    getPublicBasicPlan.mockResolvedValue({ slug: 'plan-basico' })
    render(<HybridOnboardingButton venueId="v1" initialSlug="plan-basico" onNext={() => {}} />)
    await waitFor(() => expect(getPublicBasicPlan).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 20))
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })

  it('regresión: otro slug abre la compra como hoy', async () => {
    getPublicBasicPlan.mockResolvedValue({ slug: 'plan-basico' })
    render(<HybridOnboardingButton venueId="v1" initialSlug="paquete-x" onNext={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())
  })

  it('regresión: si el Básico no responde, otro slug abre igual (un error nunca bloquea)', async () => {
    getPublicBasicPlan.mockRejectedValue(new Error('x'))
    render(<HybridOnboardingButton venueId="v1" initialSlug="paquete-x" onNext={() => {}} />)
    await waitFor(() => expect(screen.getByTestId('modal')).toBeInTheDocument())
  })

  it('sin recomendación no abre ni pide el Básico', async () => {
    render(<HybridOnboardingButton venueId="v1" onNext={() => {}} />)
    expect(getPublicBasicPlan).not.toHaveBeenCalled()
    expect(screen.queryByTestId('modal')).not.toBeInTheDocument()
  })
})
