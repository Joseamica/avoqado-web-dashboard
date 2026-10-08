// E6a-fix4 C5 (hermano): sin red, cambiar cada cuánto se paga se queda EN PAUSA y se manda solo al volver la red. El diálogo lo
// dice y «Cancelar» sigue disponible (antes se apagaba con el envío pendiente y no había salida). `useSetPeriodicity` es el REAL
// (QueryClient real, sólo el servicio simulado); lo demás de la pestaña se simula como en PeriodosTab.test.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { PeriodosTab } from '../components/PeriodosTab'

const m = vi.hoisted(() => ({ periodicity: vi.fn(), toast: vi.fn() }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string, o?: unknown) => (o ? `${k}:${JSON.stringify(o)}` : k) }) }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ venueTimezone: 'America/Mexico_City', formatCalendarDate: (d: string) => d }) }))
vi.mock('../components/PeriodoAbiertoTab', () => ({ PeriodoAbiertoTab: () => null }))
vi.mock('../components/PeriodoCerradoView', () => ({ PeriodoCerradoView: () => null }))
vi.mock('../components/ActivarPagoAlPersonal', () => ({ ActivarPagoAlPersonal: () => null }))
vi.mock('../components/AvisoSedesFuera', () => ({ AvisoSedesFuera: () => null }))
vi.mock('../components/InterruptorPropinas', () => ({ InterruptorPropinas: () => null }))
// Select nativo: el Select de Radix no se deja manejar en jsdom.
vi.mock('@/components/ui/select', () => ({
  Select: ({ value, onValueChange, disabled, children }: any) => (
    <select aria-label="select" value={value} disabled={disabled} onChange={e => onValueChange(e.target.value)}>
      {children}
    </select>
  ),
  SelectTrigger: () => null,
  SelectValue: () => null,
  SelectContent: ({ children }: any) => <>{children}</>,
  SelectItem: ({ value, children }: any) => <option value={value}>{children}</option>,
}))
const LISTA = {
  periodicidad: 'MONTHLY',
  puedeCambiarPeriodicidad: true,
  items: [{ id: null, start: '2026-10-01', end: '2026-10-31', estado: 'OPEN', personas: 0, pagadas: 0, total: '0.00' }],
  antesDe: null,
}
vi.mock('@/hooks/useStaffPay', async importOriginal => ({
  ...(await importOriginal<typeof import('@/hooks/useStaffPay')>()),
  useStaffPayAccess: () => ({ data: { enabled: true, activado: true, startDate: '2026-09-01', propinasEncendidas: false } }),
  useStaffPayPeriods: () => ({ data: LISTA, isLoading: false, hasNextPage: false, fetchNextPage: vi.fn(), isFetchingNextPage: false, refetch: vi.fn() }),
}))
vi.mock('@/services/staffPay.service', () => ({ staffPayService: { setPeriodicity: (...a: unknown[]) => m.periodicity(...a) } }))

beforeEach(() => {
  vi.clearAllMocks()
  m.periodicity.mockResolvedValue({ periodicidad: 'SEMIMONTHLY' })
})
afterEach(() => onlineManager.setOnline(true))

const frecuencia = () => screen.getAllByRole('combobox', { name: 'select' })[1]
const confirmarSinRed = async () => {
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })}>
      <MemoryRouter initialEntries={['/x#periodos']}>
        <PeriodosTab activa />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  fireEvent.change(frecuencia(), { target: { value: 'SEMIMONTHLY' } })
  const confirmar = await screen.findByRole('button', { name: /periods\.changeConfirm/ })
  onlineManager.setOnline(false)
  fireEvent.click(confirmar)
  await screen.findByText('offline.willSendPeriodicity')
}
const volverLaRed = () =>
  act(async () => {
    onlineManager.setOnline(true)
    await new Promise(r => setTimeout(r, 50))
  })

describe('cambiar la frecuencia sin red (C5)', () => {
  it('🔴 en pausa dice que se enviará al volver la red, y «Cancelar» sigue disponible', async () => {
    await confirmarSinRed()
    expect(m.periodicity).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'closed.cancel' })).toBeEnabled()
  })
  it('🔴 cancelar en pausa es de verdad: el diálogo se cierra y al volver la red NO se cambia', async () => {
    await confirmarSinRed()
    fireEvent.click(screen.getByRole('button', { name: 'closed.cancel' }))
    await waitFor(() => expect(screen.queryByText('offline.willSendPeriodicity')).toBeNull())
    expect(screen.queryByRole('alertdialog')).toBeNull()
    await volverLaRed()
    expect(m.periodicity).not.toHaveBeenCalled()
  })
  it('sin cancelar, al volver la red se cambia una vez', async () => {
    await confirmarSinRed()
    await volverLaRed()
    await waitFor(() => expect(m.periodicity).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(m.toast).toHaveBeenCalledWith({ title: 'periods.periodicitySaved' }))
  })
})
