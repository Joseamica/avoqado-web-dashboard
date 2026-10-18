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
  describe('ocultarGratis (el alta nunca enseña Gratis)', () => {
    const abrir = async (ui: React.ReactElement) => {
      render(ui)
      await userEvent.setup().click(screen.getByRole('button', { name: /Ver todo lo que incluye/i }))
    }

    it('sin la prop sigue igual: tres columnas, Gratis incluida', async () => {
      await abrir(<PlanComparison />)
      expect(screen.getAllByRole('columnheader')).toHaveLength(4) // vacía + Gratis + Pro + Premium
      expect(screen.getByTestId('compare-cfdi-FREE')).toBeInTheDocument()
      expect(screen.getByTestId('compare-seats-FREE')).toBeInTheDocument()
    })

    it('con la prop no pinta la columna de Gratis: ni encabezado ni celdas', async () => {
      await abrir(<PlanComparison ocultarGratis />)
      expect(screen.getAllByRole('columnheader')).toHaveLength(3) // vacía + Pro + Premium
      expect(screen.queryByText('plan.tiers.free.name')).not.toBeInTheDocument()
      expect(screen.queryAllByTestId(/^compare-.*-FREE$/)).toHaveLength(0)
      expect(screen.getByTestId('compare-cfdi-PRO')).toBeInTheDocument()
      expect(screen.getByTestId('compare-cfdi-PREMIUM')).toBeInTheDocument()
    })

    it('lo «común a todos» se calcula sólo entre Pro y Premium', async () => {
      await abrir(<PlanComparison ocultarGratis />)
      // Tienen lo mismo en Pro y Premium (sólo cambiaban contra Gratis): pasan a la línea de arriba.
      expect(screen.queryByTestId('compare-loyalty-PRO')).not.toBeInTheDocument()
      expect(screen.queryByTestId('compare-seats-PRO')).not.toBeInTheDocument()
      // Lo que sí distingue a Pro de Premium se queda en la tabla.
      expect(screen.getByTestId('compare-cfdi-PRO')).toBeInTheDocument()
    })

    it('el plan resaltado sigue resaltándose', async () => {
      await abrir(<PlanComparison ocultarGratis selectedTier="PREMIUM" />)
      expect(screen.getByTestId('compare-cfdi-PREMIUM').className).toMatch(/bg-muted/)
      expect(screen.getByTestId('compare-cfdi-PRO').className).not.toMatch(/bg-muted/)
    })

    it('defaultOpen la abre sin tocar el botón (así la monta el diálogo del alta)', () => {
      render(<PlanComparison ocultarGratis defaultOpen />)
      expect(screen.getByRole('table')).toBeInTheDocument()
      expect(screen.queryAllByTestId(/^compare-.*-FREE$/)).toHaveLength(0)
    })
  })
})
