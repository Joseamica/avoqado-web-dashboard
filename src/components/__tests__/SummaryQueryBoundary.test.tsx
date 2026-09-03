import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { SummaryQueryBoundary } from '../SummaryQueryBoundary'

describe('SummaryQueryBoundary', () => {
  it('no muestra totales hijos mientras el resumen está cargando', () => {
    render(
      <SummaryQueryBoundary isLoading message="No se pudieron cargar los totales" retryLabel="Reintentar" onRetry={() => undefined}>
        <div>MXN 0.00</div>
      </SummaryQueryBoundary>,
    )

    expect(screen.queryByText('MXN 0.00')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Cargando resumen')).toBeInTheDocument()
  })

  it('muestra un error explícito y permite reintentar, sin presentar ceros falsos', () => {
    const onRetry = vi.fn()
    render(
      <SummaryQueryBoundary isError message="No se pudieron cargar los totales" retryLabel="Reintentar" onRetry={onRetry}>
        <div>MXN 0.00</div>
      </SummaryQueryBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudieron cargar los totales')
    expect(screen.queryByText('MXN 0.00')).not.toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(onRetry).toHaveBeenCalledOnce()
  })

  it('renderiza los totales sólo cuando el resumen sí está disponible', () => {
    render(
      <SummaryQueryBoundary message="Error" retryLabel="Reintentar" onRetry={() => undefined}>
        <div>MXN 1,234.00</div>
      </SummaryQueryBoundary>,
    )

    expect(screen.getByText('MXN 1,234.00')).toBeInTheDocument()
  })
})
