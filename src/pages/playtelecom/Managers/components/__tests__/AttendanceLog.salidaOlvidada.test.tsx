/**
 * Bitácora de asistencia de marca blanca: la checada que el sistema cerró como «Salida olvidada» se marca y, a quien puede
 * manejar la asistencia (y no es la suya), le ofrece corregirla con la hora real (hz:0433f0cb:D3). Antes salía como una
 * checada normal de 0 horas y el gerente no tenía dónde corregirla, aunque la app de campo le dice al promotor que «la revisa
 * tu gerente».
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AttendanceLog, type AttendanceEntry } from '../AttendanceLog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))
vi.mock('@/services/attendance.service', () => ({ attendanceService: { corregirSalidaOlvidada: vi.fn() } }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

const YO = 'staff-yo'
const OTRA = 'staff-otra'
const NOTA = 'Salida del celular de las 22:40 (27/11): llegó después del día del turno y no se usó. Revisa la hora real.'

function checada(over: Partial<AttendanceEntry> = {}): AttendanceEntry {
  return {
    id: 'te-1',
    timeEntryId: 'te-1',
    promoterId: OTRA,
    date: 'jueves',
    storeName: 'Tienda',
    promoterName: 'Ana',
    clockIn: '02:00 P. M.',
    clockOut: '02:00 P. M.',
    clockInPhotoUrl: null,
    facadePhotoUrl: null,
    clockOutPhotoUrl: null,
    clockInLat: null,
    clockInLon: null,
    clockOutLat: null,
    clockOutLon: null,
    validationStatus: 'PENDING',
    sales: 0,
    cashSales: 0,
    dailyCashSales: 0,
    incidents: [{ label: 'Sin Incidencias', severity: 'ok' }],
    salidaOlvidada: true,
    clockInIso: '2026-11-27T20:00:00.000Z',
    venueId: 'venue-1',
    notaSalidaOlvidada: NOTA,
    ...over,
  }
}

function pintar(entries: AttendanceEntry[], props: { canManage: boolean; currentStaffId?: string | null; panelVenueId?: string }) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <AttendanceLog
        entries={entries}
        query={{ data: entries, isError: false, isFetching: false, isPaused: false, error: null, refetch: () => undefined }}
        venueTimezone="America/Mexico_City"
        panelVenueId="venue-1"
        onApprove={() => undefined}
        onReject={() => undefined}
        onResetValidation={() => undefined}
        onViewPhoto={() => undefined}
        onViewLocation={() => undefined}
        {...props}
      />
    </QueryClientProvider>,
  )
}

describe('AttendanceLog · «Salida olvidada» (hz:0433f0cb:D3)', () => {
  it('marca la checada, enseña la hora real que mandó el celular y ofrece corregirla', () => {
    pintar([checada()], { canManage: true, currentStaffId: YO })

    expect(screen.getAllByText('forgotten.badge').length).toBeGreaterThan(0)
    expect(screen.getAllByText(NOTA).length).toBeGreaterThan(0)
    expect(screen.getAllByText('forgotten.fix').length).toBeGreaterThan(0)
  })

  it('sin `attendance:manage` se ve la marca, pero no se ofrece corregir', () => {
    pintar([checada()], { canManage: false, currentStaffId: YO })

    expect(screen.getAllByText('forgotten.badge').length).toBeGreaterThan(0)
    expect(screen.queryByText('forgotten.fix')).toBeNull()
  })

  it('la propia checada no la corrige uno mismo (el servidor la rechaza)', () => {
    pintar([checada({ promoterId: YO })], { canManage: true, currentStaffId: YO })

    expect(screen.queryByText('forgotten.fix')).toBeNull()
  })

  // Codex D3 r1 #2: el permiso que se conoce es el de la sucursal del panel; la de otra sucursal se corrige desde la suya.
  it('una checada de otra sucursal se marca, pero no se ofrece corregirla desde este panel', () => {
    pintar([checada({ venueId: 'venue-2' })], { canManage: true, currentStaffId: YO })

    expect(screen.getAllByText('forgotten.badge').length).toBeGreaterThan(0)
    expect(screen.queryByText('forgotten.fix')).toBeNull()
  })

  // Codex D3 r1 #1: la hora que se teclea es la de la sucursal de la checada, no la del panel.
  it('la corrección abre con la hora de la entrada en la zona de la sucursal de la checada', () => {
    pintar([checada({ venueTimezone: 'America/Tijuana' })], { canManage: true, currentStaffId: YO })

    fireEvent.click(screen.getAllByText('forgotten.fix')[0])
    expect((screen.getByLabelText('forgotten.label') as HTMLInputElement).value).toBe('2026-11-27T12:00')
  })

  it('una checada normal no lleva marca ni botón', () => {
    pintar([checada({ salidaOlvidada: false, notaSalidaOlvidada: null })], { canManage: true, currentStaffId: YO })

    expect(screen.queryByText('forgotten.badge')).toBeNull()
    expect(screen.queryByText('forgotten.fix')).toBeNull()
  })
})
