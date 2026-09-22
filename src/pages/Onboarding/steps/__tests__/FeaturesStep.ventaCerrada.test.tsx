/**
 * Venta suelta CERRADA (founder, 21-sep-2026, opción A). El onboarding V1 (`/onboarding`, vivo: ahí
 * manda `SignupForm` y todo `wizardVersion != 2`) vendía funciones sueltas con casillas, «2 días gratis»
 * y el total mensual. Con la venta cerrada el paso NO desaparece —el avance guardado depende del orden
 * de los pasos—: explica que se contratan con nuestro equipo y sigue de largo sin funciones.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}))

import { FeaturesStep } from '../FeaturesStep'

describe('FeaturesStep con la venta suelta cerrada', () => {
  it('🔴 no ofrece casillas ni precios: dice que se contratan con nuestro equipo', () => {
    render(<FeaturesStep onNext={vi.fn()} onPrevious={vi.fn()} isFirstStep={false} isLastStep={false} onSave={vi.fn()} />)

    expect(screen.getByText('features.closed.body')).toBeInTheDocument()
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument()
    expect(screen.queryByText('shared.twoDaysFree')).not.toBeInTheDocument()
  })

  it('continuar guarda CERO funciones y avanza', () => {
    const onSave = vi.fn()
    const onNext = vi.fn()
    render(<FeaturesStep onNext={onNext} onPrevious={vi.fn()} isFirstStep={false} isLastStep={false} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))

    expect(onSave).toHaveBeenCalledWith({ features: [] })
    expect(onNext).toHaveBeenCalled()
  })

  it('aunque traiga funciones guardadas de antes, no las arrastra', () => {
    const onSave = vi.fn()
    render(
      <FeaturesStep
        onNext={vi.fn()}
        onPrevious={vi.fn()}
        isFirstStep={false}
        isLastStep={false}
        onSave={onSave}
        initialValue={{ features: ['INVENTORY_TRACKING'] }}
      />,
    )

    fireEvent.click(screen.getByRole('button', { name: 'continue' }))

    expect(onSave).toHaveBeenCalledWith({ features: [] })
  })
})
