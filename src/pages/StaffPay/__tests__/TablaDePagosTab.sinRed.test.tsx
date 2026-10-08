// E6a-fix4 C5 (hermano de los envíos de la fase 2): sin red, «Crear la tabla» se queda EN PAUSA y se manda sola al volver la red.
// Es un botón en línea (no hay diálogo que cerrar), así que el aviso trae «Cancelar envío». Hooks REALES, QueryClient real y la
// red apagada con `onlineManager`; sólo los servicios son simulados.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TablaDePagosTab } from '../components/TablaDePagosTab'

const m = vi.hoisted(() => ({ create: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City' }) }))
vi.mock('@/services/team.service', () => ({ teamService: { getTeamMembers: async () => ({ data: [] }) } }))
vi.mock('@/services/staffPay.service', () => ({
  staffPayService: {
    access: async () => ({ enabled: true, activado: true }),
    levels: async () => [],
    assignments: async () => [],
    tables: async () => [],
    createTable: (...a: unknown[]) => m.create(...a),
  },
}))

beforeEach(() => {
  vi.clearAllMocks()
  m.create.mockResolvedValue({ id: 't1', name: 'grid.title', productIds: [] })
})
afterEach(() => onlineManager.setOnline(true))

const montar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <TablaDePagosTab />
    </QueryClientProvider>,
  )
const crear = () => screen.getByRole('button', { name: 'grid.create' })
const crearSinRed = async () => {
  montar()
  await waitFor(() => expect(crear()).toBeEnabled())
  onlineManager.setOnline(false)
  fireEvent.click(crear())
  await screen.findByText('offline.willSendSave')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('crear la tabla sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red y ofrece «Cancelar envío»', async () => {
    await crearSinRed()
    expect(m.create).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'offline.cancelSend' })).toBeEnabled()
  })
  it('🔴 cancelar el envío es de verdad: al volver la red NO se crea, y se puede volver a crear', async () => {
    await crearSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'offline.cancelSend' }))
    await waitFor(() => expect(screen.queryByText('offline.willSendSave')).toBeNull())
    await volverLaRed()
    expect(m.create).not.toHaveBeenCalled()
    await waitFor(() => expect(crear()).toBeEnabled())
    fireEvent.click(crear())
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1))
  })
  it('sin cancelar, al volver la red se crea una vez', async () => {
    await crearSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.queryByText('offline.willSendSave')).toBeNull())
  })
})

// E6a-fix4 (revisión de E6b): candado SÍNCRONO contra el doble clic en «Crear la tabla».
describe('crear la tabla: doble clic (candado)', () => {
  it('🔴 dos clics seguidos crean UNA tabla', async () => {
    m.create.mockReturnValue(new Promise(() => undefined))
    montar()
    await waitFor(() => expect(crear()).toBeEnabled())
    const boton = crear()
    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(m.create).toHaveBeenCalled())
    await new Promise(r => setTimeout(r, 30))
    expect(m.create).toHaveBeenCalledTimes(1)
  })
  it('tras un rechazo, el candado se suelta: se puede volver a crear', async () => {
    m.create.mockRejectedValueOnce({ response: { status: 409, data: { message: 'Ya existe' } } })
    montar()
    await waitFor(() => expect(crear()).toBeEnabled())
    fireEvent.click(crear())
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'Ya existe', variant: 'destructive' }))
    await waitFor(() => expect(crear()).toBeEnabled())
    fireEvent.click(crear())
    await waitFor(() => expect(m.create).toHaveBeenCalledTimes(2))
  })
})
