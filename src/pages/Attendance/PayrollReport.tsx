import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { Download } from 'lucide-react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { attendanceService, type PayrollSummaryRow } from '@/services/attendance.service'
import { useAccess } from '@/hooks/use-access'
import { OvertimeApprovalDialog } from './OvertimeApprovalDialog'
import { LoadError } from './PunctualityReport'

/**
 * Fase 3 — el puente a nómina: un renglón por persona con los números del periodo. La
 * vacación y el permiso NO son falta (ese es el punto). Sólo lectura + export CSV: aquí no
 * se calcula dinero, se entregan los números listos.
 */

interface Props {
  venueId: string
  startDate: string
  endDate: string
}

const ABSENCE_ORDER = ['VACATION', 'PAID_LEAVE', 'UNPAID_LEAVE', 'SICK_LEAVE', 'JUSTIFIED_ABSENCE'] as const

/** 150 → "2h 30m". Los minutos crudos no se leen de un vistazo en una tabla de nómina. */
function hm(minutos: number): string {
  if (!minutos) return '—'
  const h = Math.floor(minutos / 60)
  const m = minutos % 60
  if (!h) return `${m}m`
  return m ? `${h}h ${m}m` : `${h}h`
}

export function PayrollReport({ venueId, startDate, endDate }: Props) {
  const { t } = useTranslation('attendance')
  const { can } = useAccess()
  // Firmar lo que se paga NO es leer el reporte: quien sólo tiene `attendance:read` ve los
  // números pero no puede autorizar. El servidor lo vuelve a exigir; esto sólo evita
  // enseñar un botón que iba a rebotar delante del usuario.
  const puedeAutorizar = can('attendance:manage')
  const [revisando, setRevisando] = useState<PayrollSummaryRow | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['attendance', 'payroll', venueId, startDate, endDate],
    queryFn: () => attendanceService.getPayrollSummary(venueId, startDate, endDate),
    enabled: !!venueId,
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>
  if (isError) return <LoadError t={t} onRetry={() => refetch()} />

  const rows = data?.rows ?? []
  if (rows.length === 0) {
    return (
      <Card className="border-input">
        <CardContent className="p-8 text-center">
          <p className="text-sm text-muted-foreground">{t('payroll.empty')}</p>
        </CardContent>
      </Card>
    )
  }

  const absenceLabel = (k: string) => t(`absenceTypes.${k}`)

  function exportCsv() {
    const head = [
      t('payroll.cols.person'),
      t('payroll.cols.scheduled'),
      t('payroll.cols.worked'),
      t('payroll.cols.late'),
      'min',
      t('payroll.cols.absent'),
      ...ABSENCE_ORDER.map(absenceLabel),
      t('payroll.cols.hours'),
      t('payroll.cols.breaks'),
      t('payroll.cols.overtime'),
      t('payroll.cols.overtimeApproved'),
      t('payroll.cols.overtimePending'),
    ]
    const lines = rows.map(r =>
      [
        `"${r.name.replace(/"/g, '""')}"`,
        r.scheduledDays,
        r.workedDays,
        r.lateDays,
        r.lateMinutesTotal,
        r.absentDays,
        ...ABSENCE_ORDER.map(k => r.absences[k] ?? 0),
        r.hoursWorked,
        r.breakMinutes,
        // En MINUTOS crudos: el CSV se mete a un sistema de nómina que suma, no una persona
        // que lee. En pantalla sí van como "2h 30m".
        r.overtimeMinutes,
        r.overtimeApprovedMinutes,
        r.overtimePendingMinutes,
      ].join(','),
    )
    // BOM para que Excel en español abra los acentos bien.
    const blob = new Blob(['﻿' + [head.join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `nomina-${startDate}-${endDate}.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const overtimeCell = (r: PayrollSummaryRow) => {
    if (!r.overtimeMinutes) return <span className="text-muted-foreground">—</span>
    // Una semana que el rango no cubre entera todavía puede crecer: se dice, en vez de enseñar
    // un número que parece final y no lo es.
    const parcial = r.overtimeWeeks.some(w => w.parcial)
    return (
      <div className="flex items-center justify-end gap-1.5">
        <div className="text-right">
          <div className="font-medium">{hm(r.overtimeMinutes)}</div>
          {/* Lo PENDIENTE va primero y en ámbar: es lo único que pide una acción, y si no
              saltara a la vista, exigir autorización se convertiría en no pagar en silencio. */}
          {r.overtimePendingMinutes > 0 && (
            <div className="text-[11px] font-medium text-amber-600">
              {t('payroll.overtime.pending', { amount: hm(r.overtimePendingMinutes) })}
            </div>
          )}
          {r.overtimeApprovedMinutes > 0 && (
            <div className="text-[11px] text-muted-foreground">
              {t('payroll.overtime.approved', { amount: hm(r.overtimeApprovedMinutes) })}
            </div>
          )}
          {parcial && <div className="text-[11px] text-muted-foreground">{t('payroll.overtime.partial')}</div>}
          {puedeAutorizar && (
            <button
              type="button"
              className="mt-0.5 cursor-pointer text-[11px] underline underline-offset-2 text-muted-foreground hover:text-foreground"
              onClick={() => setRevisando(r)}
            >
              {t('payroll.overtime.review')}
            </button>
          )}
        </div>
      </div>
    )
  }

  const absencesCell = (r: PayrollSummaryRow) => {
    const parts = ABSENCE_ORDER.filter(k => r.absences[k]).map(k => `${r.absences[k]} ${absenceLabel(k)}`)
    return parts.length ? parts.join(' · ') : '—'
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('payroll.subtitle')}</p>
        <Button variant="outline" size="sm" className="cursor-pointer" onClick={exportCsv}>
          <Download className="mr-1.5 h-3.5 w-3.5" />
          {t('payroll.csv')}
        </Button>
      </div>

      <Card className="border-input">
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-[11px] uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium">{t('payroll.cols.person')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.scheduled')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.worked')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.late')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.absent')}</th>
                <th className="px-4 py-3 font-medium">{t('payroll.cols.absences')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.hours')}</th>
                <th className="px-4 py-3 font-medium text-right">{t('payroll.cols.overtime')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={r.staffVenueId} className="border-b border-border last:border-0">
                  <td className="px-4 py-3 font-medium">
                    {r.name}
                    {r.pendingDays > 0 && (
                      <Badge variant="outline" className="ml-2 rounded-full text-[10px]">
                        {t('payroll.pending', { count: r.pendingDays })}
                      </Badge>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.scheduledDays}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.workedDays}</td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    {r.lateDays > 0 ? t('payroll.lateCell', { days: r.lateDays, minutes: r.lateMinutesTotal }) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.absentDays > 0 ? r.absentDays : '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground">{absencesCell(r)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{r.hoursWorked}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{overtimeCell(r)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {puedeAutorizar && (
        <OvertimeApprovalDialog
          venueId={venueId}
          startDate={startDate}
          endDate={endDate}
          persona={revisando}
          onClose={() => setRevisando(null)}
        />
      )}
    </div>
  )
}
