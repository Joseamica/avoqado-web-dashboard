/**
 * Encargo 44e957 (hz:be99f328:D13): «Cambio único» del diálogo de disponibilidad editaba los renglones del día de la
 * semana y al guardar escribía el horario SEMANAL. Cerrar «sólo este lunes» cerraba todos los lunes y el negocio dejaba
 * de recibir reservas en línea ese día sin saberlo. El SERVIDOR no tiene dónde guardar un cambio con fecha, así que la
 * pestaña no se ofrece («Muy pronto») hasta que exista, y lo que sí se edita dice que se repite cada semana.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}

vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/test', venue: { timezone: 'America/Mexico_City' } }),
}))
const toastSpy = vi.hoisted(() => vi.fn())
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: toastSpy }) }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }))
vi.mock('@/components/ui/time-picker', () => ({
  TimePicker: (p: { value?: string; onChange?: (v: string) => void; disabled?: boolean }) => (
    <input value={p.value ?? ''} disabled={p.disabled} onChange={e => p.onChange?.(e.target.value)} />
  ),
}))
const svc = vi.hoisted(() => ({ getSettings: vi.fn(), updateSettings: vi.fn() }))
vi.mock('@/services/reservation.service', () => ({ default: svc }))

import { EditAvailabilityDialog } from '../EditAvailabilityDialog'

const dia = { enabled: true, ranges: [{ open: '09:00', close: '17:00' }] }
const HORARIO = { monday: dia, tuesday: dia, wednesday: dia, thursday: dia, friday: dia, saturday: dia, sunday: dia }

function abrir() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <EditAvailabilityDialog open onOpenChange={() => {}} />
    </QueryClientProvider>,
  )
}

describe('EditAvailabilityDialog — «Cambio único» no reescribe el horario de todas las semanas', () => {
  beforeEach(() => {
    svc.getSettings.mockResolvedValue({ operatingHours: structuredClone(HORARIO) })
    svc.updateSettings.mockResolvedValue({})
  })

  it('«Cambio único» está en gris con «Muy pronto» y no se puede abrir', async () => {
    abrir()
    const pestana = await screen.findByRole('tab', { name: /availability\.singleChange/ })
    expect(pestana).toBeDisabled()
    expect(pestana).toHaveTextContent('availability.comingSoon')
    fireEvent.mouseDown(pestana)
    fireEvent.click(pestana)
    expect(screen.getByRole('tab', { name: /availability\.recurringSchedule/ })).toHaveAttribute('data-state', 'active')
  })

  it('abre directo en el horario semanal, que avisa que se repite cada semana', async () => {
    abrir()
    expect(await screen.findByRole('tab', { name: /availability\.recurringSchedule/ })).toHaveAttribute('data-state', 'active')
    expect(screen.getByText('availability.recurringNote')).toBeInTheDocument()
    expect(screen.getByText('settings.operatingHours.days.monday')).toBeInTheDocument()
    // No hay renglones con fecha (los de la semana del «Cambio único»), ni el botón de «restablecer semana».
    expect(screen.queryByText('availability.resetWeek')).toBeNull()
  })

  it('cerrar el lunes en el horario semanal guarda el horario semanal con el lunes cerrado', async () => {
    abrir()
    await screen.findByText('settings.operatingHours.days.monday')
    const casillas = screen.getAllByRole('checkbox')
    fireEvent.click(casillas[0]) // lunes
    fireEvent.click(screen.getByRole('button', { name: 'availability.done' }))
    await waitFor(() => expect(svc.updateSettings).toHaveBeenCalledTimes(1))
    const [venueId, body] = svc.updateSettings.mock.calls[0]
    expect(venueId).toBe('v1')
    expect(body.operatingHours.monday.enabled).toBe(false)
    expect(body.operatingHours.tuesday.enabled).toBe(true)
  })
})
