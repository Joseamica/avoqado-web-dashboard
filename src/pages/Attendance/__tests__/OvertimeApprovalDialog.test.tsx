/**
 * El panel de autorizar horas extra, RENDERIZADO.
 *
 * 🔴 Existe por la misma lección que el Tooltip: un componente de overlay puede compilar y
 * reventar al montarse, y una llave de i18n sin traducción se pinta cruda. Sólo se ve
 * montándolo de verdad.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OvertimeApprovalDialog } from '@/pages/Attendance/OvertimeApprovalDialog'
import { attendanceService } from '@/services/attendance.service'

vi.mock('@/services/attendance.service', () => ({
  attendanceService: { getReport: vi.fn(), approveOvertime: vi.fn() },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `cal:${d}` }),
}))

const getReport = vi.mocked(attendanceService.getReport)
const approveOvertime = vi.mocked(attendanceService.approveOvertime)

const PERSONA = { staffVenueId: 'sv1', name: 'Ana Martínez' } as any

function diaDelReporte(over: Partial<any> = {}): any {
  return {
    staffId: 's1',
    staffVenueId: 'sv1',
    name: 'Ana Martínez',
    date: '2026-08-24',
    expectedStart: '09:00',
    expectedEnd: '17:00',
    clockInTime: null,
    clockOutTime: null,
    status: 'ON_TIME',
    lateMinutes: 0,
    earlyLeaveMinutes: 0,
    overtimeMinutes: 120,
    overtimeApprovedMinutes: null,
    ...over,
  }
}

function pintar(dias: any[], persona: any = PERSONA) {
  getReport.mockResolvedValue({ rows: dias, graceMinutes: 10, timezone: 'America/Mexico_City' } as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OvertimeApprovalDialog
        venueId="venue-1"
        startDate="2026-08-24"
        endDate="2026-08-30"
        persona={persona}
        onClose={() => {}}
      />
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
  approveOvertime.mockResolvedValue({} as any)
})

describe('OvertimeApprovalDialog', () => {
  it('se monta y lista los días con horas extra', async () => {
    pintar([diaDelReporte()])
    expect(await screen.findByText('cal:2026-08-24')).toBeInTheDocument()
    expect(screen.getByText(/payroll.overtime.approve.measured/)).toBeInTheDocument()
  })

  it('🔴 sólo muestra los días de ESA persona', async () => {
    pintar([
      diaDelReporte({ date: '2026-08-24' }),
      diaDelReporte({ date: '2026-08-25', staffVenueId: 'sv2', name: 'Beto' }),
    ])
    expect(await screen.findByText('cal:2026-08-24')).toBeInTheDocument()
    expect(screen.queryByText('cal:2026-08-25')).toBeNull()
  })

  it('los días SIN horas extra no aparecen', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 0 })])
    expect(await screen.findByText('payroll.overtime.approve.empty')).toBeInTheDocument()
  })

  it('🔴 el campo viene prellenado con lo MEDIDO — obligar a teclearlo empuja a aprobar sin mirar', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120 })])
    const campo = (await screen.findByLabelText('payroll.overtime.approve.minutesLabel')) as HTMLInputElement
    expect(campo.value).toBe('120')
  })

  it('un día ya autorizado se prellena con lo AUTORIZADO, no con lo medido', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120, overtimeApprovedMinutes: 60 })])
    const campo = (await screen.findByLabelText('payroll.overtime.approve.minutesLabel')) as HTMLInputElement
    expect(campo.value).toBe('60')
  })

  it('autorizar manda los minutos y el día', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120 })])
    fireEvent.click(await screen.findByText('payroll.overtime.approve.action'))
    await waitFor(() =>
      expect(approveOvertime).toHaveBeenCalledWith('venue-1', 'sv1', {
        date: '2026-08-24',
        minutesApproved: 120,
      }),
    )
  })

  it('autorizar MENOS de lo medido se permite (parcial)', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120 })])
    const campo = await screen.findByLabelText('payroll.overtime.approve.minutesLabel')
    fireEvent.change(campo, { target: { value: '60' } })
    fireEvent.click(screen.getByText('payroll.overtime.approve.action'))
    await waitFor(() =>
      expect(approveOvertime).toHaveBeenCalledWith('venue-1', 'sv1', {
        date: '2026-08-24',
        minutesApproved: 60,
      }),
    )
  })

  it('🔴 autorizar MÁS de lo medido se rechaza sin hacer el viaje al servidor', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120 })])
    const campo = await screen.findByLabelText('payroll.overtime.approve.minutesLabel')
    fireEvent.change(campo, { target: { value: '999' } })
    fireEvent.click(screen.getByText('payroll.overtime.approve.action'))
    expect(approveOvertime).not.toHaveBeenCalled()
    expect(screen.getByText('payroll.overtime.approve.tooMuch')).toBeInTheDocument()
  })

  it('autorizar CERO (negar) sí se manda', async () => {
    pintar([diaDelReporte({ overtimeMinutes: 120 })])
    const campo = await screen.findByLabelText('payroll.overtime.approve.minutesLabel')
    fireEvent.change(campo, { target: { value: '0' } })
    fireEvent.click(screen.getByText('payroll.overtime.approve.action'))
    await waitFor(() =>
      expect(approveOvertime).toHaveBeenCalledWith('venue-1', 'sv1', {
        date: '2026-08-24',
        minutesApproved: 0,
      }),
    )
  })

  it('🔴 un error del reporte se DICE, no se ve como "no hay horas extra"', async () => {
    getReport.mockRejectedValue(new Error('boom'))
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <OvertimeApprovalDialog
          venueId="venue-1"
          startDate="2026-08-24"
          endDate="2026-08-30"
          persona={PERSONA}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    )
    expect(await screen.findByRole('alert')).toHaveTextContent('loadError.title')
    expect(screen.queryByText('payroll.overtime.approve.empty')).toBeNull()
  })

  it('sin persona no se pide nada', () => {
    pintar([diaDelReporte()], null)
    expect(getReport).not.toHaveBeenCalled()
  })
})
