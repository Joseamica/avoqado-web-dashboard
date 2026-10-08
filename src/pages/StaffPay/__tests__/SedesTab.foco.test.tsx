// E6a-fix2 C3 (full-testing E6a): al desactivar una sede con último día = hoy, su tarjeta se queda sin botones (hoy todavía
// entra y no se reactiva hasta mañana): el botón «Desactivar» al que volvía el foco desaparece y el foco caía en <body>. Con
// los hooks REALES, la pestaña y el diálogo de verdad (sólo el servicio es simulado): el foco vuelve a la TARJETA de la sede.
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SedesTab } from '../components/SedesTab'

const m = vi.hoisted(() => ({ sedes: vi.fn(), preview: vi.fn(), desactivar: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-feature-price', () => ({ useFeaturePrice: () => ({ price: null, canSeePrices: true, canPurchase: true }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `dia(${d})` }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    sedes: (...a: unknown[]) => m.sedes(...a),
    participationPreview: (...a: unknown[]) => m.preview(...a),
    deactivateSede: (...a: unknown[]) => m.desactivar(...a),
  },
}))

const cero = { clases: { n: 0, total: '0.00', pendientesDeValoracion: 0 }, comisiones: { n: 0, total: '0.00' }, propinas: { n: 0, total: '0.00' } }
const condesa = {
  venueId: 'b', nombre: 'Condesa', zona: 'America/Mexico_City', tienePlan: true, estado: 'ACTIVA', desde: '2026-10-01', hasta: null,
  minimo: null, puedeActivar: false, puedeDesactivar: true, fueraEstePeriodo: cero,
}
const estado = (sedes: unknown[]) => ({ activado: true, startDate: '2026-10-01', periodo: { start: '2026-10-01', end: '2026-10-31' }, sedes })
const vistaDesactivar = { accion: 'desactivar', fecha: '2026-10-08', minimo: '2026-09-30', maximo: '2026-10-08', zona: 'America/Mexico_City', dejanDeEntrar: cero, permanecen: cero }

beforeEach(() => vi.clearAllMocks())

describe('Sedes: el foco tras desactivar con último día = hoy', () => {
  it('🔴 la tarjeta se queda sin botones y el foco vuelve a ELLA, no a <body>', async () => {
    m.sedes.mockResolvedValueOnce(estado([condesa])).mockResolvedValue(estado([{ ...condesa, hasta: '2026-10-08', puedeDesactivar: false }]))
    m.preview.mockResolvedValue(vistaDesactivar)
    m.desactivar.mockResolvedValue({ ventana: { venueId: 'b', desde: '2026-10-01', hasta: '2026-10-08' } })
    const cliente = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={cliente}>
        <MemoryRouter>
          <SedesTab activa />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    const desactivar = await screen.findByRole('button', { name: 'sedes.desactivar' })
    desactivar.focus()
    fireEvent.click(desactivar)
    const confirmar = await screen.findByRole('button', { name: /sedes\.dialogo\.confirmarDesactivar/ })
    await waitFor(() => expect(confirmar).toBeEnabled())
    fireEvent.click(confirmar)
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    expect(screen.queryByRole('button', { name: 'sedes.desactivar' })).toBeNull()
    expect(screen.getByText('sedes.ultimoDiaHoy')).toBeInTheDocument()
    await waitFor(() => expect(document.activeElement).toHaveAttribute('data-sede-id', 'b'))
  })
})
