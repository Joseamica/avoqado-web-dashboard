import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }),
}))

import { PlanComparison } from '../PlanComparison'

describe('PlanComparison', () => {
  it('arranca cerrada: la elección de plan sigue simple', () => {
    render(<PlanComparison />)
    expect(screen.getByRole('button', { name: /Ver todo lo que incluye/i })).toHaveAttribute('aria-expanded', 'false')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
  })

  it('al abrirla muestra cada función con la palomita del plan que la da', async () => {
    render(<PlanComparison selectedTier="PRO" />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Ver todo lo que incluye/i }))

    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByTestId('compare-cfdi-FREE').querySelector('[aria-label="No incluido"]')).not.toBeNull()
    expect(screen.getByTestId('compare-cfdi-PREMIUM').querySelector('[aria-label="Incluido"]')).not.toBeNull()
    expect(screen.getByTestId('compare-loyalty-PRO').querySelector('[aria-label="Incluido"]')).not.toBeNull()
    // La columna del plan elegido se resalta.
    expect(screen.getByTestId('compare-loyalty-PRO').className).toMatch(/bg-muted/)
    expect(screen.getByTestId('compare-loyalty-FREE').className).not.toMatch(/bg-muted/)
  })

  it('sólo enseña lo que CAMBIA entre planes; lo común va en una línea', async () => {
    render(<PlanComparison />)
    await userEvent.setup().click(screen.getByRole('button', { name: /Ver todo lo que incluye/i }))
    expect(screen.queryByTestId('compare-pos-FREE')).not.toBeInTheDocument()
    expect(screen.getByText(/Todos los planes incluyen/)).toBeInTheDocument()
    expect(screen.getByTestId('compare-cfdi-FREE')).toBeInTheDocument()
  })
})
