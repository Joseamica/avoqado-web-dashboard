// E6a-fix3 C5 (hermano de «marcar pagado»): sin red, liquidar una diferencia se queda EN PAUSA y se manda solo al volver la red.
// Hooks y servicio REALES (sólo se finge `@/api`), QueryClient real y la red apagada con `onlineManager`.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { LiquidarDialog } from '../components/LiquidarDialog'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), toast: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get, post: m.post } }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, o?: object) => (o ? `${k}:${JSON.stringify(o)}` : k), i18n: { language: 'es' } }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => d, formatCalendarDate: (d: string) => d }) }))
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
  m.post.mockResolvedValue({ data: { lineas: [{ staffId: 'a', amount: '40.00' }], yaLiquidada: false } })
})
afterEach(() => onlineManager.setOnline(true))

const liquidarSinRed = async () => {
  const onClose = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter>
        <LiquidarDialog classVenueId="v1" sessionId="c1" onClose={onClose} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  const confirmar = await screen.findByRole('button', { name: /differences\.settleIn/ })
  await waitFor(() => expect(confirmar).toBeEnabled())
  onlineManager.setOnline(false)
  fireEvent.click(confirmar)
  await screen.findByText('offline.willSendSettle')
  return onClose
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('liquidar una diferencia sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    await liquidarSinRed()
    expect(m.post).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })
  it('🔴 cancelar en pausa es de verdad: al volver la red NO se liquida', async () => {
    const onClose = await liquidarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(onClose).toHaveBeenCalled())
    await volverLaRed()
    expect(m.post).not.toHaveBeenCalled()
  })
  it('sin cancelar, al volver la red se manda una vez', async () => {
    await liquidarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.post).toHaveBeenCalledTimes(1))
  })
})

// G2 (hermano): abrir «Liquidar diferencia» YA sin red dejaba el diálogo vacío (ni montos ni por qué). Ahora lo dice.
describe('abrir liquidar ya sin red (G2)', () => {
  it('🔴 dice que se calcula al volver la red, y al volver la red trae lo que se liquida', async () => {
    onlineManager.setOnline(false)
    render(
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
        <MemoryRouter>
          <LiquidarDialog classVenueId="v1" sessionId="c1" onClose={vi.fn()} />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('offline.willCalculate')).toBeInTheDocument()
    expect(screen.queryByText('differences.previewError')).toBeNull()
    expect(m.get).not.toHaveBeenCalled()
    await volverLaRed()
    expect(await screen.findByRole('button', { name: /differences\.settleIn/ })).toBeEnabled()
    expect(screen.queryByText('offline.willCalculate')).toBeNull()
  })
})
