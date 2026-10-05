import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { LiquidarDialog } from '../components/LiquidarDialog'

// Hooks y servicio REALES; sólo se finge `@/api`. Así se prueba lo que pasa cuando el interceptor global reintenta a
// escondidas un POST cuya respuesta se perdió: el diálogo ve UN envío que vuelve «ya liquidada» con líneas.
const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get, post: m.post } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatDateTime: (d: string) => d, formatCalendarDate: (d: string) => d }),
}))
vi.mock('../useNombreSede', () => ({ useNombreSede: () => (id: string) => id, useRutaDeSede: () => () => '/venues/x' }))

const preview = {
  periodoOrigen: { id: 'p8', start: '2026-08-01', end: '2026-08-31' },
  destino: { start: '2026-10-01', end: '2026-10-31', venueIds: ['v1'] },
  sedeEnDestino: true,
  filas: [
    {
      classSessionId: 'c1',
      venueId: 'v1',
      productName: 'Yoga',
      startsAt: '2026-08-04T14:00:00Z',
      fechaLocal: '2026-08-04',
      fechaValoracion: '2026-08-04',
      periodoOrigenId: 'p8',
      persona: 'a',
      personaNombre: 'Ana Martínez',
      coachActual: 'a',
      estadoClase: 'OK',
      motivo: null,
      corresponde: '610.00',
      congelado: '570.00',
      conciliado: '0.00',
      pendiente: '40.00',
      payLevelId: 'l',
      payLevelName: 'HC',
      tableVersionId: 'tv',
      countMode: 'BOOKED',
      conteo: 9,
    },
  ],
  total: '40.00',
  bloqueada: false,
  huella: 'h'.repeat(64),
}

beforeEach(() => {
  vi.clearAllMocks()
  m.get.mockResolvedValue({ data: preview })
})

describe('LiquidarDialog con el servicio real', () => {
  it('el reintento OCULTO del interceptor vuelve «ya liquidada» con líneas: es el éxito de ESTE clic (C11 residual)', async () => {
    m.post.mockResolvedValue({ data: { lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: true } })
    const onClose = vi.fn()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter>
          <LiquidarDialog classVenueId="v1" sessionId="c1" onClose={onClose} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const confirmar = await screen.findByRole('button', { name: /differences\.settleIn/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    fireEvent.click(confirmar)
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(m.post).toHaveBeenCalledTimes(1)
    expect(m.post.mock.calls[0][0]).toBe('/api/v1/dashboard/venues/v1/staff-pay/class-sessions/c1/difference/settle')
    expect(m.toast).toHaveBeenCalledWith(
      expect.objectContaining({
        title: expect.stringMatching(/^differences\.settled:/),
        description: expect.stringContaining('Ana Martínez'),
      }),
    )
    expect(m.toast).not.toHaveBeenCalledWith(expect.objectContaining({ title: 'differences.alreadySettledElsewhere' }))
  })
})
