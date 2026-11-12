import { render, screen, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ExportDialog, type ExportFormat } from '@/components/export-dialog'
import { exportRunsService } from '@/services/exportRuns.service'

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))
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

const desde = new Date('2026-10-13T06:00:00.000Z')
const hasta = new Date('2026-11-12T21:30:00.000Z')

function abrir(formatos?: ExportFormat[]) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ExportDialog
        open
        onClose={() => {}}
        title="Exportar historial"
        endpoint="/x"
        baseParams={{ search: 'cerveza', type: undefined }}
        columns={[{ id: 'createdAt', label: 'Fecha', required: true }]}
        initialDateFrom={desde}
        initialDateTo={hasta}
        filenameStem="historial-inventario"
        segundoPlano={{ venueId: 'v1', kind: 'historial-inventario' }}
        formatos={formatos}
      />
    </QueryClientProvider>,
  )
}

describe('ExportDialog · formatos', () => {
  it('por omisión ofrece CSV, Excel y PDF (Órdenes, Pagos y Ventas no cambian)', () => {
    abrir()
    expect(screen.getByText('CSV')).toBeTruthy()
    expect(screen.getByText('Excel')).toBeTruthy()
    expect(screen.getByText('PDF')).toBeTruthy()
  })

  it('🔴 el Historial no ofrece PDF: su exporte no tiene GET viejo que lo arme', () => {
    abrir(['csv', 'xlsx'])
    expect(screen.getByText('CSV')).toBeTruthy()
    expect(screen.getByText('Excel')).toBeTruthy()
    expect(screen.queryByText('PDF')).toBeNull()
  })

  it('pide al carril del Historial con los filtros de la página y el rango del diálogo', async () => {
    ;(exportRunsService.pedir as any).mockResolvedValue({ kind: 'run', runId: 'crun1' })
    abrir(['csv', 'xlsx'])
    act(() => screen.getByRole('button', { name: 'Exportar' }).click())
    await waitFor(() => expect(exportRunsService.pedir).toHaveBeenCalled())
    expect(exportRunsService.pedir).toHaveBeenCalledWith('v1', 'historial-inventario', {
      format: 'csv',
      columns: ['createdAt'],
      filters: { search: 'cerveza', startDate: desde.toISOString(), endDate: hasta.toISOString() },
    })
  })
})
