/**
 * D15 (16-nov-2026): el servidor contesta, pero marca `legacyUnavailable` cuando no pudo leer todos los cobros del sistema
 * anterior de QR (el puente legacy de Mindform). El panel nunca leía esa marca: el total salía como si estuviera completo.
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const estables = vi.hoisted(() => {
  const t = (k: string) => k
  return { i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import { AvisoCobrosQrIncompletos } from '../AvisoCobrosQrIncompletos'

describe('AvisoCobrosQrIncompletos', () => {
  it('🔴 con la marca: avisa que el total puede estar incompleto', () => {
    render(<AvisoCobrosQrIncompletos incompleto />)
    expect(screen.getByRole('alert')).toHaveTextContent('loadFailure.legacyQr')
  })

  it('sin la marca (o sin respuesta todavía) no pinta nada', () => {
    const { container, rerender } = render(<AvisoCobrosQrIncompletos incompleto={false} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<AvisoCobrosQrIncompletos incompleto={undefined} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('«Reintentar» vuelve a pedir la lectura; sin cómo reintentar, no hay botón', () => {
    const reintentar = vi.fn()
    const { rerender } = render(<AvisoCobrosQrIncompletos incompleto onRetry={reintentar} />)
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(reintentar).toHaveBeenCalledTimes(1)

    rerender(<AvisoCobrosQrIncompletos incompleto />)
    expect(screen.queryByRole('button')).toBeNull()
  })
})
