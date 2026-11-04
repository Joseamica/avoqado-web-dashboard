import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ExportRunProgress } from '@/components/export-run-progress'
import { exportRunsService, abrirDescarga } from '@/services/exportRuns.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/services/exportRuns.service', () => ({
  exportRunsService: { estado: vi.fn(), urlDescarga: vi.fn(), reintentar: vi.fn() },
  abrirDescarga: vi.fn(),
}))

const montar = (props: Partial<Parameters<typeof ExportRunProgress>[0]> = {}) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ExportRunProgress venueId="v1" runId="run1" {...props} />
    </QueryClientProvider>,
  )
}
const estado = exportRunsService.estado as unknown as ReturnType<typeof vi.fn>

describe('ExportRunProgress', () => {
  it('🔴 enlace del correo: si ya está listo, descarga SOLA una vez con la liga firmada', async () => {
    estado.mockResolvedValue({ status: 'READY', processedRows: 4224, totalRows: 4224, format: 'xlsx', waitingForPayments: false })
    ;(exportRunsService.urlDescarga as any).mockResolvedValue({ url: 'https://storage.test/firmada', fileName: 'payments-2026-11-03.xlsx' })
    montar({ autoDescargar: true })
    await waitFor(() => expect(abrirDescarga).toHaveBeenCalledWith('https://storage.test/firmada'))
    await new Promise(r => setTimeout(r, 50))
    expect(abrirDescarga).toHaveBeenCalledTimes(1)
  })
  it('sin autoDescargar no descarga hasta que tocan «Descargar»', async () => {
    estado.mockResolvedValue({ status: 'READY', processedRows: 10, totalRows: 10, format: 'csv', waitingForPayments: false })
    ;(exportRunsService.urlDescarga as any).mockResolvedValue({ url: 'https://storage.test/f', fileName: 'x.csv' })
    montar()
    const boton = await screen.findByRole('button', { name: 'exportDialog.run.download' })
    expect(abrirDescarga).not.toHaveBeenCalled()
    fireEvent.click(boton)
    await waitFor(() => expect(abrirDescarga).toHaveBeenCalledWith('https://storage.test/f'))
  })
  it('falló ⇒ «Intentar otra vez» pide el reintento al servidor y entrega el pedido nuevo', async () => {
    estado.mockResolvedValue({ status: 'FAILED', processedRows: 0, totalRows: 4224, format: 'xlsx', waitingForPayments: false, failureCode: 'ARMADO_FALLO' })
    ;(exportRunsService.reintentar as any).mockResolvedValue({ runId: 'run9' })
    const onNuevoPedido = vi.fn()
    montar({ onNuevoPedido })
    fireEvent.click(await screen.findByRole('button', { name: 'exportDialog.run.retry' }))
    await waitFor(() => expect(onNuevoPedido).toHaveBeenCalledWith('run9'))
    expect(exportRunsService.reintentar).toHaveBeenCalledWith('v1', 'run1')
  })
  it('🔴 vencido ⇒ «ya expiró» con «Volver a exportar», que pide el reintento (Codex r1 #8)', async () => {
    estado.mockResolvedValue({ status: 'EXPIRED', processedRows: 4224, totalRows: 4224, format: 'csv', waitingForPayments: false })
    ;(exportRunsService.reintentar as any).mockResolvedValue({ runId: 'run11' })
    const onNuevoPedido = vi.fn()
    montar({ onNuevoPedido })
    expect(await screen.findByText('exportDialog.run.expired')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exportDialog.run.download' })).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: 'exportDialog.run.reexport' }))
    await waitFor(() => expect(onNuevoPedido).toHaveBeenCalledWith('run11'))
  })
  it('no encontrado (otro usuario u otro negocio) lo dice y no ofrece descargar', async () => {
    estado.mockRejectedValue({ response: { status: 404 } })
    montar({ autoDescargar: true })
    expect(await screen.findByText('exportDialog.run.notFound')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'exportDialog.run.download' })).toBeNull()
  })
})
