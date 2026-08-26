/**
 * PunctualityReport — un error del servidor NO se disfraza de "sin novedades".
 * Auditoría Codex de la fase 2 del checador (2026-08-26), hallazgo 2.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { PunctualityReport } from '@/pages/Attendance/PunctualityReport'
import { attendanceService } from '@/services/attendance.service'

vi.mock('@/services/attendance.service', () => ({ attendanceService: { getReport: vi.fn() } }))
vi.mock('@/utils/datetime', () => ({
  useVenueDateTime: () => ({ formatCalendarDate: (d: string) => `cal:${d}`, formatTime: () => '9:00 AM' }),
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }))

const getReport = vi.mocked(attendanceService.getReport)

function renderReport() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PunctualityReport venueId="venue-1" startDate="2026-08-26" endDate="2026-08-26" />
    </QueryClientProvider>,
  )
}

describe('PunctualityReport', () => {
  beforeEach(() => vi.clearAllMocks())

  it('un 500 muestra el error y un reintento — nunca "sin novedades"', async () => {
    getReport.mockRejectedValue(new Error('boom'))
    renderReport()
    expect(await screen.findByRole('alert')).toHaveTextContent('loadError.title')
    expect(screen.getByRole('button', { name: 'loadError.retry' })).toBeInTheDocument()
    expect(screen.queryByText('report.empty.title')).toBeNull()
  })

  it('regresión: sin filas sigue diciendo "sin novedades", y las fechas son de calendario', async () => {
    getReport.mockResolvedValue({ rows: [], graceMinutes: 10, timezone: 'America/Mexico_City' } as any)
    renderReport()
    expect(await screen.findByText('report.empty.title')).toBeInTheDocument()

    getReport.mockResolvedValue({
      rows: [
        {
          staffId: 's1',
          staffVenueId: 'sv1',
          name: 'Ana',
          date: '2026-08-26',
          expectedStart: '09:00',
          expectedEnd: '18:00',
          clockInTime: '2026-08-26T15:00:00Z',
          clockOutTime: null,
          status: 'ON_TIME',
          lateMinutes: 0,
          earlyLeaveMinutes: 0,
        },
      ],
      graceMinutes: 10,
      timezone: 'America/Mexico_City',
    } as any)
    renderReport()
    expect(await screen.findByText('cal:2026-08-26')).toBeInTheDocument()
  })
})
