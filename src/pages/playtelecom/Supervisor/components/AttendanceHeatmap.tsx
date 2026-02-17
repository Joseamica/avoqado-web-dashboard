/**
 * AttendanceHeatmap — Staff × Day matrix showing attendance status
 * Color-coded: present (green), late (amber), absent (red)
 * Grouped by venue state → venue name
 */

import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Download } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip'
import { useStoresAttendanceHeatmap } from '@/hooks/useStoresAnalysis'
import { exportToExcel, generateFilename } from '@/utils/export'
import type { AttendanceHeatmapStaff, AttendanceStatus } from '@/services/storesAnalysis.service'

interface AttendanceHeatmapProps {
  startDate: string
  endDate: string
  filterVenueId?: string
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-500',
  late: 'bg-amber-400',
  absent: 'bg-red-500',
  future: 'bg-muted/30',
}

interface VenueGroup {
  state: string
  venues: Array<{
    venueId: string
    venueName: string
    staff: AttendanceHeatmapStaff[]
  }>
}

function groupByState(staff: AttendanceHeatmapStaff[]): VenueGroup[] {
  const stateMap = new Map<string, Map<string, AttendanceHeatmapStaff[]>>()

  for (const s of staff) {
    const state = s.venueState || 'Otros'
    if (!stateMap.has(state)) stateMap.set(state, new Map())
    const venueMap = stateMap.get(state)!
    if (!venueMap.has(s.venueId)) venueMap.set(s.venueId, [])
    venueMap.get(s.venueId)!.push(s)
  }

  const groups: VenueGroup[] = []
  for (const [state, venueMap] of stateMap) {
    const venues: VenueGroup['venues'] = []
    for (const [venueId, staffList] of venueMap) {
      venues.push({ venueId, venueName: staffList[0].venueName, staff: staffList })
    }
    groups.push({ state, venues })
  }

  return groups.sort((a, b) => a.state.localeCompare(b.state))
}

export function AttendanceHeatmap({ startDate, endDate, filterVenueId }: AttendanceHeatmapProps) {
  const { t } = useTranslation('playtelecom')
  const { data, isLoading } = useStoresAttendanceHeatmap({ startDate, endDate, filterVenueId })

  const dayColumns = useMemo(() => {
    if (!data?.summary?.byDay?.length) return []
    return data.summary.byDay.map(d => ({
      date: d.date,
      label: format(parseISO(d.date), 'EEE d', { locale: es }),
      shortLabel: format(parseISO(d.date), 'dd'),
    }))
  }, [data])

  const groups = useMemo(() => {
    if (!data?.staff?.length) return []
    return groupByState(data.staff)
  }, [data])

  const handleExport = async () => {
    if (!data?.staff?.length) return
    const rows: Record<string, any>[] = []
    for (const s of data.staff) {
      const row: Record<string, any> = {
        [t('supervisor.attendanceHeatmap.store')]: s.venueName,
        [t('supervisor.attendanceHeatmap.promoter')]: s.staffName,
      }
      for (const d of s.days) {
        const label = format(parseISO(d.date), 'dd/MM')
        row[label] = d.status === 'present' ? 'OK' : d.status === 'late' ? 'TARDE' : d.status === 'absent' ? 'FALTA' : '-'
      }
      rows.push(row)
    }
    await exportToExcel(rows, generateFilename('asistencia'), 'Asistencia')
  }

  if (isLoading) {
    return (
      <GlassCard className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-64 w-full" />
        </div>
      </GlassCard>
    )
  }

  if (!data?.staff?.length) {
    return (
      <GlassCard className="p-6">
        <p className="text-muted-foreground text-sm text-center py-8">
          {t('supervisor.attendanceHeatmap.noData')}
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">{t('supervisor.attendanceHeatmap.title')}</h3>
          {/* Legend */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
              <span>{t('supervisor.attendanceHeatmap.present')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <span>{t('supervisor.attendanceHeatmap.late')}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <span>{t('supervisor.attendanceHeatmap.absent')}</span>
            </div>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {t('supervisor.attendanceHeatmap.export')}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <TooltipProvider>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium min-w-[120px]">
                  {t('supervisor.attendanceHeatmap.store')}
                </th>
                <th className="sticky left-[120px] z-10 bg-card px-3 py-2 text-left font-medium min-w-[140px]">
                  {t('supervisor.attendanceHeatmap.promoter')}
                </th>
                {dayColumns.map(d => (
                  <th key={d.date} className="px-1 py-2 text-center font-medium min-w-[36px]">
                    <span className="block text-[10px] leading-tight">{d.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <GroupRows
                  key={group.state}
                  group={group}
                  dayColumns={dayColumns}
                  t={t}
                  summaryByDay={data.summary.byDay}
                />
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-border font-semibold bg-muted/30">
                <td colSpan={2} className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-xs uppercase">
                  {t('supervisor.attendanceHeatmap.totals')}
                </td>
                {data.summary.byDay.map(d => (
                  <td key={d.date} className="px-1 py-2 text-center text-xs">
                    <span className="text-green-600 dark:text-green-400">{d.present}</span>
                    {d.late > 0 && <span className="text-amber-600 dark:text-amber-400">/{d.late}</span>}
                    {d.absent > 0 && <span className="text-red-600 dark:text-red-400">/{d.absent}</span>}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </TooltipProvider>
      </div>
    </GlassCard>
  )
}

function GroupRows({
  group,
  dayColumns,
  t,
  summaryByDay,
}: {
  group: VenueGroup
  dayColumns: Array<{ date: string; label: string }>
  t: (key: string) => string
  summaryByDay: Array<{ date: string; present: number; late: number; absent: number }>
}) {
  // Calculate subtotals for this group
  const subtotals = useMemo(() => {
    return dayColumns.map(dc => {
      let present = 0
      let late = 0
      let absent = 0
      for (const venue of group.venues) {
        for (const staff of venue.staff) {
          const day = staff.days.find(d => d.date === dc.date)
          if (day?.status === 'present') present++
          else if (day?.status === 'late') late++
          else if (day?.status === 'absent') absent++
        }
      }
      return { date: dc.date, present, late, absent }
    })
  }, [group, dayColumns])

  return (
    <>
      {/* State header row */}
      <tr>
        <td
          colSpan={2 + dayColumns.length}
          className="sticky left-0 z-10 bg-card px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground border-t border-border"
        >
          {group.state}
        </td>
      </tr>
      {/* Staff rows */}
      {group.venues.map(venue =>
        venue.staff.map(staff => (
          <tr key={`${staff.staffId}-${staff.venueId}`} className="hover:bg-muted/20">
            <td className="sticky left-0 z-10 bg-card px-3 py-1.5 text-xs truncate max-w-[120px]">
              {venue.venueName}
            </td>
            <td className="sticky left-[120px] z-10 bg-card px-3 py-1.5 text-xs truncate max-w-[140px]">
              {staff.staffName}
            </td>
            {staff.days.map(day => (
              <td key={day.date} className="px-1 py-1.5 text-center">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        'mx-auto w-5 h-5 rounded-full transition-all',
                        STATUS_COLORS[day.status],
                        day.status !== 'future' && 'cursor-pointer shadow-sm',
                      )}
                    />
                  </TooltipTrigger>
                  <TooltipContent>
                    <div className="text-xs space-y-0.5">
                      <p className="font-semibold">{staff.staffName}</p>
                      <p>{format(parseISO(day.date), 'EEEE d MMMM', { locale: es })}</p>
                      <p className="text-muted-foreground capitalize">{day.status}</p>
                      {day.clockInTime && (
                        <p className="text-muted-foreground">
                          {t('supervisor.attendanceHeatmap.clockIn')}: {format(new Date(day.clockInTime), 'HH:mm')}
                        </p>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </td>
            ))}
          </tr>
        )),
      )}
      {/* Subtotal row */}
      <tr className="border-b border-border/50">
        <td colSpan={2} className="sticky left-0 z-10 bg-card px-3 py-1 text-xs text-muted-foreground italic">
          {t('supervisor.attendanceHeatmap.subtotal')} {group.state}
        </td>
        {subtotals.map(st => (
          <td key={st.date} className="px-1 py-1 text-center text-[10px] text-muted-foreground">
            {st.present + st.late}/{st.present + st.late + st.absent}
          </td>
        ))}
      </tr>
    </>
  )
}
