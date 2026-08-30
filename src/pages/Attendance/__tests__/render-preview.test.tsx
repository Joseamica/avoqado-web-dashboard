/**
 * No es una prueba: es un generador de VISTA PREVIA.
 *
 * Renderiza los componentes REALES con datos realistas y vuelca el HTML a disco, para poder
 * MIRAR la pantalla sin iniciar sesión. Usa los textos reales de `locales/es/attendance.json`
 * (no las llaves), así que un `t()` sin traducir sale crudo y se nota.
 *
 * 🔴 Vale la pena porque encontró dos defectos que ninguna de las 36 pruebas de esta carpeta
 * veía: el campo decía «180» junto a «El reloj marcó 3h» —dos unidades en el mismo renglón, sin
 * decir cuál es cuál— y un día negado se leía «autorizadas 0m».
 *
 * APAGADO por defecto para no escribir archivos en cada `vitest run`. Se enciende así:
 *
 *   VISTA_PREVIA=1 npx vitest run src/pages/Attendance/__tests__/render-preview.test.tsx
 *
 * y después se arma la página con el CSS compilado de `dist/assets/index-*.css`.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import fs from 'fs'
import path from 'path'
import { describe, expect, it, vi } from 'vitest'

import es from '@/locales/es/attendance.json'
import { OvertimeApprovalDialog } from '@/pages/Attendance/OvertimeApprovalDialog'
import { PayrollReport } from '@/pages/Attendance/PayrollReport'
import { attendanceService } from '@/services/attendance.service'

vi.mock('@/services/attendance.service', () => ({
  attendanceService: { getPayrollSummary: vi.fn(), getReport: vi.fn(), approveOvertime: vi.fn() },
}))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, canAny: () => true, canAll: () => true }) }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({
    formatCalendarDate: (d: string) => {
      const [y, m, dd] = d.split('-')
      const meses = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic']
      return `${dd} ${meses[Number(m) - 1]} ${y}`
    },
  }),
}))

// 🔴 `t` REAL contra el archivo de español: si una llave faltara, saldría cruda en la vista
// previa — que es justo uno de los defectos que se quieren ver.
function traducir(llave: string, vars?: Record<string, unknown>): string {
  const valor = llave.split('.').reduce<any>((o, k) => (o == null ? o : o[k]), es as any)
  if (typeof valor !== 'string') return llave
  return valor.replace(/\{\{(\w+)\}\}/g, (_m, v) => String(vars?.[v] ?? `{{${v}}}`))
}
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: traducir }) }))

const SALIDA = '/tmp/vista-previa-horas-extra'

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
    hoursWorked: 48,
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

const SEMANA = { weekStart: '2026-08-24', weekEnd: '2026-08-30', parcial: false } as any

/** Los tres casos que importan, más uno sin horas extra para ver el contraste. */
const FILAS = [
  fila({
    staffVenueId: 'sv1',
    name: 'Ana Martínez',
    overtimeMinutes: 480,
    overtimePendingMinutes: 480,
    hasOvertimeViolation: true,
    overtimeWeeks: [SEMANA],
  }),
  fila({
    staffVenueId: 'sv2',
    name: 'Beto Ruiz',
    hoursWorked: 44,
    lateDays: 1,
    lateMinutesTotal: 18,
    overtimeMinutes: 240,
    overtimeApprovedMinutes: 180,
    overtimePendingMinutes: 60,
    overtimeDoubleMinutes: 180,
    overtimeWeeks: [SEMANA],
  }),
  fila({
    staffVenueId: 'sv3',
    name: 'Carla Domínguez',
    hoursWorked: 46,
    overtimeMinutes: 720,
    overtimeApprovedMinutes: 720,
    overtimeDoubleMinutes: 540,
    overtimeTripleMinutes: 180,
    hasOvertimeViolation: true,
    overtimeWeeks: [SEMANA],
  }),
  fila({
    staffVenueId: 'sv4',
    name: 'Diego Herrera',
    hoursWorked: 40,
    absences: { VACATION: 2 },
    absentDays: 0,
  }),
]

const DIAS_DEL_PANEL = [
  { date: '2026-08-24', overtimeMinutes: 180, overtimeApprovedMinutes: null },
  { date: '2026-08-25', overtimeMinutes: 120, overtimeApprovedMinutes: 60 },
  { date: '2026-08-26', overtimeMinutes: 90, overtimeApprovedMinutes: null },
  { date: '2026-08-27', overtimeMinutes: 90, overtimeApprovedMinutes: 0 },
].map(d => ({
  staffId: 's1',
  staffVenueId: 'sv1',
  name: 'Ana Martínez',
  expectedStart: '09:00',
  expectedEnd: '17:00',
  clockInTime: null,
  clockOutTime: null,
  status: 'ON_TIME',
  lateMinutes: 0,
  earlyLeaveMinutes: 0,
  ...d,
}))

function envolver(titulo: string, cuerpo: string, ancho: string): string {
  return `<section style="margin:0 0 44px">
  <h2 style="font:600 15px/1.4 -apple-system,system-ui,sans-serif;color:#111;margin:0 0 4px">${titulo}</h2>
  <div style="max-width:${ancho};border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;background:#fff">${cuerpo}</div>
</section>`
}

const ENCENDIDA = process.env.VISTA_PREVIA === '1'

describe.skipIf(!ENCENDIDA)('vista previa', () => {
  it('vuelca el HTML de la tabla y del panel', async () => {
    fs.mkdirSync(SALIDA, { recursive: true })

    // ── La tabla de nómina ──────────────────────────────────────────────────────────
    vi.mocked(attendanceService.getPayrollSummary).mockResolvedValue({
      rows: FILAS,
      timezone: 'America/Mexico_City',
      startDate: '2026-08-24',
      endDate: '2026-08-30',
    } as any)
    const c1 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const tabla = render(
      <QueryClientProvider client={c1}>
        <PayrollReport venueId="v1" startDate="2026-08-24" endDate="2026-08-30" />
      </QueryClientProvider>,
    )
    await screen.findByText('Ana Martínez')
    const htmlTabla = tabla.container.innerHTML
    tabla.unmount()

    // ── El panel de autorizar ───────────────────────────────────────────────────────
    vi.mocked(attendanceService.getReport).mockResolvedValue({
      rows: DIAS_DEL_PANEL,
      graceMinutes: 10,
      timezone: 'America/Mexico_City',
    } as any)
    const c2 = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={c2}>
        <OvertimeApprovalDialog
          venueId="v1"
          startDate="2026-08-24"
          endDate="2026-08-30"
          persona={{ staffVenueId: 'sv1', name: 'Ana Martínez' } as any}
          onClose={() => {}}
        />
      </QueryClientProvider>,
    )
    // El Dialog de Radix se monta en un portal, fuera del contenedor.
    // 🔴 Esperar a que EXISTA no basta: la primera versión capturó el panel en "Cargando…".
    // Hay que esperar a que la consulta resuelva y aparezca un día de verdad.
    await screen.findByText('24 ago 2026')
    await waitFor(() => expect(document.querySelector('[role="dialog"]')).toBeTruthy())
    const htmlPanel = document.querySelector('[role="dialog"]')!.outerHTML

    fs.writeFileSync(path.join(SALIDA, 'tabla.html'), htmlTabla)
    fs.writeFileSync(path.join(SALIDA, 'panel.html'), htmlPanel)
    fs.writeFileSync(
      path.join(SALIDA, 'partes.json'),
      JSON.stringify({ tabla: envolver('', '', ''), ok: true }),
    )
    expect(htmlTabla.length).toBeGreaterThan(500)
    expect(htmlPanel.length).toBeGreaterThan(500)
  })
})
