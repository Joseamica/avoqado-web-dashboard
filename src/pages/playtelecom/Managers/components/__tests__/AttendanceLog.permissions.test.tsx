/**
 * Bitácora de asistencia: aprobar, rechazar y deshacer sólo se ofrecen a quien el servidor deja.
 *
 * El servidor (ronda 6) exige `attendance:manage` efectivo (con exclusiones) y prohíbe validar o regresar
 * a pendiente la PROPIA checada (403 SELF_VALIDATION_FORBIDDEN). Un botón que va a rebotar deja a la
 * persona explicando un error delante de su empleado.
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { AttendanceLog, type AttendanceEntry } from '../AttendanceLog'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key }),
}))

const YO = 'staff-yo'
const OTRA = 'staff-otra'

function checada(over: Partial<AttendanceEntry> = {}): AttendanceEntry {
  return {
    id: 'te-1',
    timeEntryId: 'te-1',
    promoterId: OTRA,
    date: 'lunes',
    storeName: 'Tienda',
    promoterName: 'Ana',
    clockIn: '09:00 A. M.',
    clockOut: '06:00 P. M.',
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
    ...over,
  }
}

function pintar(entries: AttendanceEntry[], props: { canManage: boolean; currentStaffId?: string | null }) {
  render(
    <AttendanceLog
      entries={entries}
      onApprove={() => undefined}
      onReject={() => undefined}
      onResetValidation={() => undefined}
      onViewPhoto={() => undefined}
      onViewLocation={() => undefined}
      {...props}
    />,
  )
}

const APROBAR = 'Aprobar'
const RECHAZAR = 'Rechazar'
const DESHACER = 'Deshacer'
const AVISO = 'Es tu propia checada: la valida otra persona'

describe('AttendanceLog · quién ve aprobar, rechazar y deshacer', () => {
  it('con `attendance:manage` y la checada de otra persona: aprobar y rechazar', () => {
    pintar([checada()], { canManage: true, currentStaffId: YO })

    expect(screen.getAllByLabelText(APROBAR).length).toBeGreaterThan(0)
    expect(screen.getAllByLabelText(RECHAZAR).length).toBeGreaterThan(0)
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('con `attendance:manage`, una checada ya aprobada o rechazada de otra persona se puede deshacer', () => {
    pintar([checada({ validationStatus: 'APPROVED' }), checada({ id: 'te-2', timeEntryId: 'te-2', validationStatus: 'REJECTED' })], {
      canManage: true,
      currentStaffId: YO,
    })

    expect(screen.getAllByTitle(DESHACER)).toHaveLength(2)
  })

  it('🔴 sin `attendance:manage` (excluido o piso): no hay aprobar, rechazar ni deshacer', () => {
    pintar(
      [checada(), checada({ id: 'te-2', timeEntryId: 'te-2', validationStatus: 'APPROVED' }), checada({ id: 'te-3', timeEntryId: 'te-3', validationStatus: 'REJECTED' })],
      { canManage: false, currentStaffId: YO },
    )

    expect(screen.queryByLabelText(APROBAR)).toBeNull()
    expect(screen.queryByLabelText(RECHAZAR)).toBeNull()
    expect(screen.queryByTitle(DESHACER)).toBeNull()
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('🔴 su PROPIA checada: no hay aprobar, rechazar ni deshacer, y se dice por qué', () => {
    pintar(
      [
        checada({ promoterId: YO }),
        checada({ id: 'te-2', timeEntryId: 'te-2', promoterId: YO, validationStatus: 'APPROVED' }),
        checada({ id: 'te-3', timeEntryId: 'te-3', promoterId: YO, validationStatus: 'REJECTED' }),
      ],
      { canManage: true, currentStaffId: YO },
    )

    expect(screen.queryByLabelText(APROBAR)).toBeNull()
    expect(screen.queryByLabelText(RECHAZAR)).toBeNull()
    expect(screen.queryByTitle(DESHACER)).toBeNull()
    expect(screen.getAllByText(AVISO).length).toBeGreaterThan(0)
  })

  it('🔴 sin saber quién mira, falla cerrado', () => {
    pintar([checada(), checada({ id: 'te-2', timeEntryId: 'te-2', validationStatus: 'APPROVED' })], { canManage: true, currentStaffId: undefined })

    expect(screen.queryByLabelText(APROBAR)).toBeNull()
    expect(screen.queryByLabelText(RECHAZAR)).toBeNull()
    expect(screen.queryByTitle(DESHACER)).toBeNull()
  })

  it('regresión: la checada, sus fotos y sus incidencias se siguen viendo sin permiso', () => {
    pintar([checada({ validationStatus: 'APPROVED' })], { canManage: false, currentStaffId: YO })

    expect(screen.getAllByText('Tienda').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Sin Incidencias').length).toBeGreaterThan(0)
  })
})
