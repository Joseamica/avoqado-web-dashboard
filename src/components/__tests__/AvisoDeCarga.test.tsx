/** El aviso común de lista que no cargó: qué dice y qué salidas ofrece. */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const estables = vi.hoisted(() => {
  const t = (k: string) => k
  return { i18n: { t, i18n: { language: 'es' } } }
})
vi.mock('react-i18next', () => ({ useTranslation: () => estables.i18n }))

import { AvisoDeCarga } from '../AvisoDeCarga'
import type { EstadoDeCarga } from '@/lib/falloDeCarga'

const consulta = (extra: Partial<EstadoDeCarga> = {}): EstadoDeCarga => ({
  isError: true,
  isFetching: false,
  isPaused: false,
  error: { response: { status: 500 } },
  refetch: vi.fn(),
  ...extra,
})

describe('AvisoDeCarga', () => {
  it('sin fallo no pinta nada, ni con consulta nula', () => {
    const { container, rerender } = render(<AvisoDeCarga query={consulta({ isError: false })} hayDatos={false} />)
    expect(container).toBeEmptyDOMElement()
    rerender(<AvisoDeCarga query={null} hayDatos={false} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('mientras reintenta no avisa: si vuelve a fallar, regresa', () => {
    const { container } = render(<AvisoDeCarga query={consulta({ isFetching: true })} hayDatos />)
    expect(container).toBeEmptyDOMElement()
  })

  it('«Reintentar» repite la consulta, o pide la página que faltó de una lista infinita', () => {
    const refetch = vi.fn()
    const fetchNextPage = vi.fn()
    const { rerender } = render(<AvisoDeCarga query={consulta({ refetch, fetchNextPage })} hayDatos />)
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(refetch).toHaveBeenCalledTimes(1)
    expect(fetchNextPage).not.toHaveBeenCalled()

    rerender(<AvisoDeCarga query={consulta({ refetch, fetchNextPage, isFetchNextPageError: true })} hayDatos />)
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
    expect(refetch).toHaveBeenCalledTimes(1)
  })

  it('ofrece volver a la primera página sólo si la pantalla se lo pide (Codex r1)', () => {
    const volver = vi.fn()
    const { rerender } = render(<AvisoDeCarga query={consulta()} hayDatos={false} />)
    expect(screen.queryByRole('button', { name: 'loadFailure.backToFirstPage' })).not.toBeInTheDocument()

    rerender(<AvisoDeCarga query={consulta()} hayDatos={false} volverAlInicio={volver} />)
    fireEvent.click(screen.getByRole('button', { name: 'loadFailure.backToFirstPage' }))
    expect(volver).toHaveBeenCalledTimes(1)
  })
})
