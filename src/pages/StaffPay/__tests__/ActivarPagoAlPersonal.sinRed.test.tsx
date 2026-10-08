// E6a-fix3 C5 (hermano de «marcar pagado»): sin red, activar pago al personal se queda EN PAUSA y se manda solo al volver la red.
// Hooks REALES, QueryClient real y la red apagada con `onlineManager`; sólo el servicio es simulado.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivarPagoAlPersonal } from '../components/ActivarPagoAlPersonal'

const m = vi.hoisted(() => ({ activate: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }) }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    access: async () => ({ enabled: true, activado: false, startDate: null, propinasEncendidas: false, periodicidad: 'MONTHLY', periodicidadFija: false }),
    sedes: async () => ({
      activado: false,
      startDate: null,
      periodo: null,
      sedes: [{ venueId: 'v1', nombre: 'Centro', zona: 'America/Mexico_City', tienePlan: true, estado: 'SIN_ACTIVAR', desde: null, hasta: null, minimo: null, puedeActivar: false, puedeDesactivar: false }],
    }),
    activate: (...a: unknown[]) => m.activate(...a),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  m.activate.mockResolvedValue({ startDate: '2026-10-01' })
})
afterEach(() => onlineManager.setOnline(true))

const activarSinRed = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <ActivarPagoAlPersonal />
    </QueryClientProvider>,
  )
  const boton = await screen.findByRole('button', { name: 'activation.button' })
  await waitFor(() => expect(boton).toBeEnabled())
  fireEvent.click(boton)
  const confirmar = (await screen.findAllByRole('button', { name: 'activation.button' })).slice(-1)[0]
  onlineManager.setOnline(false)
  fireEvent.click(confirmar)
  await screen.findByText('offline.willSendActivate')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('activar pago al personal sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    await activarSinRed()
    expect(m.activate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })
  it('🔴 cancelar en pausa es de verdad: al volver la red NO se activa, y se puede volver a intentar', async () => {
    await activarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull())
    await volverLaRed()
    expect(m.activate).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'activation.button' }))
    fireEvent.click((await screen.findAllByRole('button', { name: 'activation.button' })).slice(-1)[0])
    await waitFor(() => expect(m.activate).toHaveBeenCalledTimes(1))
  })
  it('sin cancelar, al volver la red se manda una vez', async () => {
    await activarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.activate).toHaveBeenCalledTimes(1))
  })
})
