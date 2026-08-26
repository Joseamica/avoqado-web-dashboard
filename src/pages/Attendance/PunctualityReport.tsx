import { useQuery } from '@tanstack/react-query'
import { AlertTriangle, CheckCircle2, Clock, MinusCircle } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { attendanceService, type AttendanceReportRow, type AttendanceStatus } from '@/services/attendance.service'
import { useVenueDateTime } from '@/utils/datetime'

/**
 * Reporte de puntualidad: el cuadrante contra lo que pasó. Sólo lectura.
 *
 * Los días sin novedad no llegan (el servidor ya los omite). Quien no tiene cuadrante sale
 * como «Sin horario» en gris, nunca en rojo: la prueba viva de que nadie está obligado a
 * llenar horarios para usar el reloj.
 */

interface Props {
  venueId: string
  startDate: string
  endDate: string
}

export function PunctualityReport({ venueId, startDate, endDate }: Props) {
  const { t } = useTranslation('attendance')
  const { formatDate, formatTime } = useVenueDateTime()

  const { data, isLoading } = useQuery({
    queryKey: ['attendance', 'report', venueId, startDate, endDate],
    queryFn: () => attendanceService.getReport(venueId, startDate, endDate),
    enabled: !!venueId,
  })

  const rows = data?.rows ?? []
  const lateCount = rows.filter(r => r.status === 'LATE').length
  const absentCount = rows.filter(r => r.status === 'ABSENT').length

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>

  if (rows.length === 0) {
    return (
      <Card className="border-input">
        <CardContent className="p-8 text-center space-y-1">
          <p className="text-sm font-medium">{t('report.empty.title')}</p>
          <p className="text-sm text-muted-foreground">{t('report.empty.description')}</p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
        <span>{t('report.grace', { minutes: data?.graceMinutes ?? 10 })}</span>
        {lateCount > 0 && (
          <Badge variant="outline" className="rounded-full">
            {t('report.lateCount', { count: lateCount })}
          </Badge>
        )}
        {absentCount > 0 && (
          <Badge variant="destructive" className="rounded-full">
            {t('report.absentCount', { count: absentCount })}
          </Badge>
        )}
      </div>

      <Card className="border-input">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('report.cols.person')}</th>
                <th className="px-4 py-3 font-medium">{t('report.cols.date')}</th>
                <th className="px-4 py-3 font-medium">{t('report.cols.expected')}</th>
                <th className="px-4 py-3 font-medium">{t('report.cols.in')}</th>
                <th className="px-4 py-3 font-medium">{t('report.cols.out')}</th>
                <th className="px-4 py-3 font-medium">{t('report.cols.status')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => (
                <tr key={`${row.staffVenueId}-${row.date}`} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">{row.name}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">{formatDate(`${row.date}T12:00:00`)}</td>
                  <td className="px-4 py-3 tabular-nums text-muted-foreground">
                    {row.expectedStart ? `${row.expectedStart} – ${row.expectedEnd}` : <span className="text-muted-foreground/70">{t('report.noSchedule')}</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{row.clockInTime ? formatTime(row.clockInTime) : '—'}</td>
                  <td className="px-4 py-3 tabular-nums">{row.clockOutTime ? formatTime(row.clockOutTime) : row.clockInTime ? t('stillIn') : '—'}</td>
                  <td className="px-4 py-3">
                    <StatusBadge row={row} t={t} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function StatusBadge({ row, t }: { row: AttendanceReportRow; t: (k: string, o?: Record<string, unknown>) => string }) {
  const s: AttendanceStatus = row.status
  const early = row.earlyLeaveMinutes > 0 ? (
    <Badge variant="outline" className="rounded-full gap-1 ml-1">
      {t('report.earlyLeave', { minutes: row.earlyLeaveMinutes })}
    </Badge>
  ) : null

  if (s === 'LATE')
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge variant="outline" className="rounded-full gap-1 border-amber-500/40 text-amber-700 dark:text-amber-400">
          <AlertTriangle className="h-3 w-3" />
          {t('report.late', { minutes: row.lateMinutes })}
        </Badge>
        {early}
      </span>
    )
  if (s === 'ABSENT')
    return (
      <Badge variant="destructive" className="rounded-full gap-1">
        <MinusCircle className="h-3 w-3" />
        {t('report.absent')}
      </Badge>
    )
  if (s === 'ON_TIME')
    return (
      <span className="inline-flex flex-wrap items-center gap-1">
        <Badge variant="secondary" className="rounded-full gap-1">
          <CheckCircle2 className="h-3 w-3" />
          {t('report.onTime')}
        </Badge>
        {early}
      </span>
    )
  if (s === 'PENDING')
    return (
      <Badge variant="outline" className="rounded-full gap-1">
        <Clock className="h-3 w-3" />
        {t('report.pending')}
      </Badge>
    )
  // NO_SCHEDULE y DAY_OFF: gris, sin juicio
  return (
    <Badge variant="outline" className="rounded-full text-muted-foreground">
      {s === 'DAY_OFF' ? t('report.dayOff') : t('report.noSchedule')}
    </Badge>
  )
}
