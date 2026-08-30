/**
 * La columna de horas extra, RENDERIZADA.
 *
 * 🔴 Existe porque el typecheck no ve lo que rompe una pantalla: un `Tooltip` de Radix sin su
 * Provider revienta en vivo y compila feliz, y una llave de i18n sin traducción se pinta cruda.
 * Los dos ya pasaron esta semana. Esto los caza montando el componente de verdad.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PayrollReport } from '@/pages/Attendance/PayrollReport'
import { attendanceService } from '@/services/attendance.service'

vi.mock('@/services/attendance.service', () => ({
  attendanceService: { getPayrollSummary: vi.fn(), getReport: vi.fn(), approveOvertime: vi.fn() },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))
// `useAccess` cuelga del contexto de venue, que no existe en una prueba de componente suelto.
// Se controla el permiso desde aquí para poder probar los dos lados del botón de autorizar.
const can = vi.fn(() => true)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can, canAny: can, canAll: can }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `cal:${d}` }),
}))

const getPayrollSummary = vi.mocked(attendanceService.getPayrollSummary)

function fila(over: Partial<any> = {}): any {
  return {
    staffId: 's1',
    staffVenueId: 'sv1',
    name: 'Ana Martínez',
    scheduledDays: 5,
    workedDays: 5,
    onTimeDays: 5,
    lateDays: 0,
    lateMinutesTotal: 0,
    absentDays: 0,
    pendingDays: 0,
    absences: {},
    hoursWorked: 40,
    breakMinutes: 0,
    overtimeMinutes: 0,
    overtimeApprovedMinutes: 0,
    overtimePendingMinutes: 0,
    overtimeDeniedMinutes: 0,
    overtimeDaysToReview: [],
    overtimeDoubleMinutes: 0,
    overtimeTripleMinutes: 0,
    overtimeWeeks: [],
    hasOvertimeViolation: false,
    ...over,
  }
}

function pintar(rows: any[]) {
  getPayrollSummary.mockResolvedValue({
    rows,
    timezone: 'America/Mexico_City',
    startDate: '2026-08-24',
    endDate: '2026-08-30',
  } as any)
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PayrollReport venueId="venue-1" startDate="2026-08-24" endDate="2026-08-30" />
    </QueryClientProvider>,
  )
}

describe('PayrollReport — horas extra', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    can.mockReturnValue(true)
  })

  it('pinta el total en horas y minutos, no en minutos crudos', async () => {
    pintar([fila({ overtimeMinutes: 150, overtimeApprovedMinutes: 150, overtimeDoubleMinutes: 150 })])
    // "2h 30m", nunca "150".
    expect(await screen.findByText('2h 30m')).toBeInTheDocument()
    expect(screen.queryByText('150')).toBeNull()
  })

  it('sin horas extra pinta un guion, no un cero engañoso', async () => {
    pintar([fila({ overtimeMinutes: 0 })])
    await screen.findByText('Ana Martínez')
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('🔴 el desglose doble/triple aparece cuando HAY triples — es la diferencia entre 200% y 300%', async () => {
    pintar([
      fila({
        overtimeMinutes: 720,
        overtimeApprovedMinutes: 720,
        overtimeDoubleMinutes: 540,
        overtimeTripleMinutes: 180,
      }),
    ])
    expect(await screen.findByText('12h')).toBeInTheDocument()
    expect(screen.getByText('payroll.overtime.split')).toBeInTheDocument()
  })

  it('sin triples no se enseña el desglose: sería ruido', async () => {
    pintar([fila({ overtimeMinutes: 120, overtimeApprovedMinutes: 120, overtimeDoubleMinutes: 120, overtimeTripleMinutes: 0 })])
    await screen.findByText('2h')
    expect(screen.queryByText('payroll.overtime.split')).toBeNull()
  })

  it('🔴 la advertencia del art. 66 se MONTA sin reventar (Tooltip de Radix necesita su Provider)', async () => {
    pintar([
      fila({
        overtimeMinutes: 240,
        overtimeApprovedMinutes: 240,
        overtimeDoubleMinutes: 240,
        hasOvertimeViolation: true,
        overtimeWeeks: [{ weekStart: '2026-08-24', weekEnd: '2026-08-30', parcial: false } as any],
      }),
    ])
    expect(await screen.findByLabelText('payroll.overtime.violation')).toBeInTheDocument()
  })

  it('sin infracción no hay advertencia', async () => {
    pintar([fila({ overtimeMinutes: 120, overtimeApprovedMinutes: 120, overtimeDoubleMinutes: 120 })])
    await screen.findByText('2h')
    expect(screen.queryByLabelText('payroll.overtime.violation')).toBeNull()
  })

  it('🔴 una semana incompleta lo DICE, en vez de enseñar un número que parece final', async () => {
    pintar([
      fila({
        overtimeMinutes: 600,
        overtimeApprovedMinutes: 600,
        overtimeDoubleMinutes: 540,
        overtimeTripleMinutes: 60,
        overtimeWeeks: [{ weekStart: '2026-08-24', weekEnd: '2026-08-30', parcial: true } as any],
      }),
    ])
    expect(await screen.findByText('payroll.overtime.partial')).toBeInTheDocument()
  })

  it('🔴 lo PENDIENTE de autorizar se ve, y en ámbar — si no, no pagar sería invisible', async () => {
    pintar([fila({ overtimeMinutes: 120, overtimePendingMinutes: 120 })])
    expect(await screen.findByText('payroll.overtime.pending')).toBeInTheDocument()
  })

  it('lo ya autorizado también se ve', async () => {
    pintar([fila({ overtimeMinutes: 120, overtimeApprovedMinutes: 120, overtimeDoubleMinutes: 120 })])
    expect(await screen.findByText('payroll.overtime.approved')).toBeInTheDocument()
  })

  it('🔴 sin `attendance:manage` NO se enseña el botón de revisar', async () => {
    // Enseñar un botón que el servidor va a rebotar deja al usuario explicando un error
    // delante de su empleado.
    can.mockReturnValue(false)
    pintar([fila({ overtimeMinutes: 120, overtimePendingMinutes: 120 })])
    await screen.findByText('Ana Martínez')
    expect(screen.queryByText('payroll.overtime.review')).toBeNull()
  })

  it('con el permiso, el botón sí aparece', async () => {
    pintar([fila({ overtimeMinutes: 120, overtimePendingMinutes: 120 })])
    expect(await screen.findByText('payroll.overtime.review')).toBeInTheDocument()
  })

  it('regresión: las columnas que ya existían siguen ahí', async () => {
    pintar([fila({ lateDays: 2, lateMinutesTotal: 35, hoursWorked: 38.5 })])
    expect(await screen.findByText('Ana Martínez')).toBeInTheDocument()
    expect(screen.getByText('38.5')).toBeInTheDocument()
    expect(screen.getByText('payroll.cols.overtime')).toBeInTheDocument()
  })
})
