import { render, screen, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ExportDialog } from '@/components/export-dialog'
import { exportRunsService } from '@/services/exportRuns.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
vi.mock('@/components/ui/full-screen-modal', () => ({
  FullScreenModal: ({ actions, children }: any) => (
    <div>
      {actions}
      {children}
    </div>
  ),
}))
vi.mock('@/services/exportRuns.service', () => ({
  exportRunsService: { pedir: vi.fn(), recientes: vi.fn().mockResolvedValue([]), estado: vi.fn() },
  descargarBlob: vi.fn(),
}))

describe('ExportDialog · doble clic', () => {
  it('🔴 dos clics seguidos en «Exportar» mandan UN solo pedido', async () => {
    let soltar!: (v: unknown) => void
    ;(exportRunsService.pedir as any).mockReturnValue(new Promise(r => (soltar = r)))
    render(
      <QueryClientProvider client={new QueryClient()}>
        <ExportDialog
          open
          onClose={() => {}}
          title="x"
          endpoint="/x"
          baseParams={{}}
          columns={[{ id: 'a', label: 'A' }]}
          initialDateFrom={new Date()}
          initialDateTo={new Date()}
          filenameStem="x"
          segundoPlano={{ venueId: 'v1', kind: 'payments' }}
        />
      </QueryClientProvider>,
    )
    const boton = screen.getByRole('button', { name: 'Exportar' })
    // Los dos clics caen antes de que React repinte el `disabled`: sólo el candado síncrono los frena.
    act(() => {
      boton.click()
      boton.click()
    })
    expect(exportRunsService.pedir).toHaveBeenCalledTimes(1)
    soltar({ kind: 'run', runId: 'r1', format: 'csv' })
    await waitFor(() => expect(exportRunsService.estado).toHaveBeenCalled())
  })
})
