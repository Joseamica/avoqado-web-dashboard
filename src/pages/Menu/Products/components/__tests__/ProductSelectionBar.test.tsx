/** Variantes, bloque 2 (Tarea 10): la barra de «elegir para agrupar». `t` pega los valores con «:» para ver el conteo. */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: Record<string, unknown>) => [k, ...Object.values(o ?? {}).map(String)].join(':') }),
}))

import { ProductSelectionBar } from '../ProductSelectionBar'

describe('ProductSelectionBar', () => {
  it('cuenta los elegidos y agrupa de 1 a 250', () => {
    const onAgrupar = vi.fn()
    const onCancelar = vi.fn()
    const { rerender } = render(<ProductSelectionBar count={2} onAgrupar={onAgrupar} onCancelar={onCancelar} />)
    expect(screen.getByText('agrupar.elegidos:2')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.agruparComo' }))
    expect(onAgrupar).toHaveBeenCalledTimes(1)
    fireEvent.click(screen.getByRole('button', { name: 'agrupar.cancelar' }))
    expect(onCancelar).toHaveBeenCalledTimes(1)

    rerender(<ProductSelectionBar count={0} onAgrupar={onAgrupar} onCancelar={onCancelar} />)
    expect(screen.getByRole('button', { name: 'agrupar.agruparComo' })).toBeDisabled()
    rerender(<ProductSelectionBar count={251} onAgrupar={onAgrupar} onCancelar={onCancelar} />)
    expect(screen.getByRole('button', { name: 'agrupar.agruparComo' })).toBeDisabled()
    expect(screen.getByText('agrupar.problema.demasiadosMiembros')).toBeInTheDocument()
  })
})
