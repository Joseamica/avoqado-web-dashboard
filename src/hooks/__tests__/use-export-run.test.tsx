import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { useExportRun, useExporteVivo } from '@/hooks/use-export-run'
import { exportRunsService } from '@/services/exportRuns.service'

vi.mock('@/services/exportRuns.service', () => ({ exportRunsService: { estado: vi.fn(), recientes: vi.fn() } }))

// UN cliente por prueba (no por render): si se crea dentro del wrapper, cada re-render pierde la caché.
function envoltura() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>
}
const estado = exportRunsService.estado as unknown as ReturnType<typeof vi.fn>
const recientes = exportRunsService.recientes as unknown as ReturnType<typeof vi.fn>

describe('useExportRun', () => {
  it('calcula el porcentaje mientras arma', async () => {
    estado.mockResolvedValue({ status: 'RUNNING', processedRows: 1500, totalRows: 4224, format: 'xlsx', waitingForPayments: false })
    const { result } = renderHook(() => useExportRun('v1', 'run1'), { wrapper: envoltura() })
    await waitFor(() => expect(result.current.percent).toBe(35))
    expect(result.current.isDone).toBe(false)
  })
  it('expone la pausa por cobros y el cambio a CSV', async () => {
    estado.mockResolvedValue({ status: 'RUNNING', processedRows: 0, totalRows: 90000, format: 'csv', changedToFormat: 'csv', waitingForPayments: true })
    const { result } = renderHook(() => useExportRun('v1', 'run3'), { wrapper: envoltura() })
    await waitFor(() => expect(result.current.waitingForPayments).toBe(true))
    expect(result.current.changedToFormat).toBe('csv')
  })
  it('sin runId no consulta', () => {
    const { result } = renderHook(() => useExportRun('v1', null), { wrapper: envoltura() })
    expect(result.current.status).toBeUndefined()
    expect(estado).not.toHaveBeenCalled()
  })
  it('0 de 0 filas listo es 100 %', async () => {
    estado.mockResolvedValue({ status: 'READY', processedRows: 0, totalRows: 0, format: 'csv', waitingForPayments: false })
    const { result } = renderHook(() => useExportRun('v1', 'run2'), { wrapper: envoltura() })
    await waitFor(() => expect(result.current.isDone).toBe(true))
    expect(result.current.percent).toBe(100)
  })
  it('un 404 dice «no encontrado» y deja de sondear', async () => {
    estado.mockRejectedValue({ response: { status: 404 } })
    const { result } = renderHook(() => useExportRun('v1', 'otro'), { wrapper: envoltura() })
    await waitFor(() => expect(result.current.notFound).toBe(true))
    const llamadas = estado.mock.calls.length
    await new Promise(r => setTimeout(r, 1_700))
    expect(estado.mock.calls.length).toBe(llamadas)
  })
})

describe('useExporteVivo', () => {
  it('devuelve el pedido que sigue armándose y no uno viejo', async () => {
    recientes.mockResolvedValue([
      { id: 'viejo', status: 'READY', createdAt: new Date(Date.now() - 3 * 3600_000).toISOString() },
      { id: 'vivo', status: 'RUNNING', createdAt: new Date().toISOString() },
    ])
    const { result } = renderHook(() => useExporteVivo('v1', 'cobros', true), { wrapper: envoltura() })
    await waitFor(() => expect(result.current).toBe('vivo'))
  })
  it('apagado no consulta', () => {
    renderHook(() => useExporteVivo('v1', 'cobros', false), { wrapper: envoltura() })
    expect(recientes).not.toHaveBeenCalled()
  })
})
