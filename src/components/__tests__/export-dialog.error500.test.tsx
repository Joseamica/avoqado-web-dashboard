import { render, screen, act, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { describe, expect, it, vi } from 'vitest'
import { ExportDialog } from '@/components/export-dialog'
import { exportRunsService } from '@/services/exportRuns.service'

const toast = vi.fn()
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: { defaultValue?: string }) => o?.defaultValue ?? k }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
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

function rechazo(status: number, message: string) {
  const json = JSON.stringify({ success: false, message })
  // jsdom no trae Blob.text(); el navegador sí, y es el camino real (responseType: 'blob').
  const data = Object.assign(new Blob([json], { type: 'application/json' }), { text: async () => json })
  return { response: { status, data } }
}

function abrir() {
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
        segundoPlano={{ venueId: 'v1', kind: 'ordenes' }}
      />
    </QueryClientProvider>,
  )
  act(() => screen.getByRole('button', { name: 'Exportar' }).click())
}

describe('ExportDialog · errores del servidor', () => {
  it('🔴 un 500 (p. ej. Prisma sin transacción a tiempo) muestra el texto genérico en español, no el error técnico', async () => {
    toast.mockClear()
    ;(exportRunsService.pedir as any).mockRejectedValue(
      rechazo(500, 'Transaction API error: Unable to start a transaction in the given time.'),
    )
    abrir()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'No se pudo generar el archivo', variant: 'destructive' }))
  })

  it('un 429 (mensaje nuestro, en español) se sigue mostrando tal cual', async () => {
    toast.mockClear()
    ;(exportRunsService.pedir as any).mockRejectedValue(rechazo(429, 'Ya tienes 3 exportes armándose. Espera a que termine alguno.'))
    abrir()
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith({ title: 'Ya tienes 3 exportes armándose. Espera a que termine alguno.', variant: 'destructive' }),
    )
  })
})
