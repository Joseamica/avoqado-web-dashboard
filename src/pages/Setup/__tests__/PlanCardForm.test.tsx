/**
 * Los dos candados del formulario de tarjeta que destapó el /full-testing del 26-sep:
 * pagar antes de que Stripe termine de pintar, y un «ocupado» que nunca se soltaba al desmontar.
 */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEffect } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const stripe = vi.hoisted(() => ({ listo: true, fallaCarga: false, confirmSetup: vi.fn() }))

vi.mock('@stripe/react-stripe-js', () => ({
  PaymentElement: ({ onReady, onLoadError }: { onReady?: () => void; onLoadError?: (e: unknown) => void }) => {
    // Como el REAL cuando Stripe rechaza la sesión (p. ej. llave de pruebas contra un cobro real): UN `loaderror` por
    // montaje, nunca `onReady`.
    useEffect(() => {
      if (stripe.fallaCarga) onLoadError?.({ elementType: 'payment', error: { type: 'invalid_request_error' } })
    }, []) // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => {
      if (!stripe.fallaCarga && stripe.listo) onReady?.()
    }, [onReady])
    return <div data-testid="payment-element" />
  },
  useStripe: () => ({ confirmSetup: (...a: unknown[]) => stripe.confirmSetup(...a) }),
  useElements: () => ({}),
}))
const tEstable = (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: tEstable }) }))

import { PlanCardForm } from '../steps/PlanCardForm'

beforeEach(() => {
  stripe.listo = true
  stripe.fallaCarga = false
  stripe.confirmSetup.mockReset()
})

describe('PlanCardForm', () => {
  it('🔴 no deja pagar hasta que el formulario de Stripe avisa que está listo', () => {
    stripe.listo = false
    render(<PlanCardForm payNowLabel="Pagar" onConfirmed={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeDisabled()
  })

  it('🔴 si Stripe no carga el formulario, deja de girar, lo dice y avisa al padre', () => {
    stripe.fallaCarga = true
    const onLoadError = vi.fn()
    render(<PlanCardForm payNowLabel="Pagar" onConfirmed={vi.fn()} onLoadError={onLoadError} />)
    const boton = screen.getByRole('button', { name: /Pagar/ })
    expect(boton).toBeDisabled()
    expect(boton).toHaveAttribute('aria-busy', 'false')
    expect(screen.getByRole('alert')).toHaveTextContent('No pudimos preparar el pago con tarjeta')
    expect(onLoadError).toHaveBeenCalledTimes(1)
  })

  it('con Stripe listo, el botón de pagar funciona', () => {
    render(<PlanCardForm payNowLabel="Pagar" onConfirmed={vi.fn()} />)
    expect(screen.getByRole('button', { name: /Pagar/ })).toBeEnabled()
  })

  it('🔴 desmontarse a media confirmación suelta el candado que anunció', async () => {
    stripe.confirmSetup.mockReturnValue(new Promise(() => undefined)) // Stripe nunca contesta
    const onBusyChange = vi.fn()
    const { unmount } = render(<PlanCardForm payNowLabel="Pagar" onConfirmed={vi.fn()} onBusyChange={onBusyChange} />)

    await userEvent.setup().click(screen.getByRole('button', { name: /Pagar/ }))
    expect(onBusyChange).toHaveBeenLastCalledWith(true)

    unmount()
    expect(onBusyChange).toHaveBeenLastCalledWith(false)
  })
})
