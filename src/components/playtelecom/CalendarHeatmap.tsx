/**
 * CalendarHeatmap - Attendance visualization calendar
 *
 * Displays a 7x4 grid (7 days x 4 weeks) showing attendance status
 * with color-coded cells:
 * - Green: Present/On-time
 * - Yellow: Late
 * - Red: Absent
 * - Gray: Off-day / No data
 *
 * Used in: tiendas.html mockup, promotores.html mockup
 * Design: Matches Avoqado glassmorphism with semantic colors
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from '@/components/ui/tooltip'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type AttendanceStatus = 'present' | 'late' | 'absent' | 'off' | 'future'

export interface AttendanceDay {
  date: Date
  status: AttendanceStatus
  note?: string // Optional: "A tiempo", "15 min tarde", etc.
}

export interface CalendarHeatmapProps {
  data: AttendanceDay[]
  className?: string
  showLegend?: boolean
  compact?: boolean // Smaller cells for mobile
}

/**
 * CalendarHeatmap Component
 *
 * @example
 * <CalendarHeatmap
 *   data={attendanceData}
 *   showLegend
 * />
 */
export function CalendarHeatmap({ data, className, showLegend = true, compact = false }: CalendarHeatmapProps) {
  // Status to color mapping (Avoqado theme semantic colors)
  const statusColors: Record<AttendanceStatus, string> = {
    present: 'bg-green-500 dark:bg-green-400 hover:bg-green-600', // Success
    late: 'bg-yellow-400 dark:bg-yellow-500 hover:bg-yellow-500', // Warning
    absent: 'bg-red-500 dark:bg-red-400 hover:bg-red-600', // Danger
    off: 'bg-muted dark:bg-muted/50 hover:bg-muted', // Neutral
    future: 'bg-muted/30 dark:bg-muted/20 border-2 border-dashed border-border', // Future days
  }

  const statusLabels: Record<AttendanceStatus, string> = {
    present: 'Asistió',
    late: 'Tarde',
    absent: 'Falta',
    off: 'Descanso',
    future: 'Futuro',
  }

  // Organize data into 7 columns (days) x 4 rows (weeks)
  // Most recent week at top
  const gridData = React.useMemo(() => {
    // Fill 28 days (7x4 grid)
    const cells: (AttendanceDay | null)[] = []
    const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime())

    // Get the most recent 28 days
    const maxDays = 28
    const recentData = sortedData.slice(-maxDays)

    // Fill grid
    for (let i = 0; i < maxDays; i++) {
      cells.push(recentData[i] || null)
    }

    return cells
  }, [data])

  // Calculate stats for display
  const stats = React.useMemo(() => {
    const present = data.filter(d => d.status === 'present').length
    const late = data.filter(d => d.status === 'late').length
    const absent = data.filter(d => d.status === 'absent').length
    const total = present + late + absent

    return {
      present,
      late,
      absent,
      total,
      attendanceRate: total > 0 ? Math.round((present / total) * 100) : 0,
    }
  }, [data])

  return (
    <div className={cn('space-y-4', className)}>
      {/* Grid */}
      <TooltipProvider>
        <div
          className={cn(
            'grid grid-cols-7 gap-1',
            compact ? 'gap-0.5' : 'gap-1',
          )}
        >
          {gridData.map((day, index) => (
            <Tooltip key={index}>
              <TooltipTrigger asChild>
                <div
                  className={cn(
                    'aspect-square rounded-sm transition-all duration-200',
                    compact ? 'rounded' : 'rounded-sm',
                    day ? statusColors[day.status] : 'bg-muted/30',
                    day && day.status !== 'future' && 'cursor-pointer shadow-sm',
                  )}
                  title={day ? format(day.date, 'PPP', { locale: es }) : ''}
                />
              </TooltipTrigger>
              {day && (
                <TooltipContent>
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">
                      {format(day.date, 'EEEE, d MMMM', { locale: es })}
                    </p>
                    <p className="text-muted-foreground">
                      {statusLabels[day.status]}
                    </p>
                    {day.note && (
                      <p className="text-xs text-muted-foreground italic">
                        {day.note}
                      </p>
                    )}
                  </div>
                </TooltipContent>
              )}
            </Tooltip>
          ))}
        </div>
      </TooltipProvider>

      {/* Legend */}
      {showLegend && (
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-green-500 rounded-sm" />
              <span className="text-muted-foreground">
                OK ({stats.present})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-yellow-400 rounded-sm" />
              <span className="text-muted-foreground">
                Tarde ({stats.late})
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-2 h-2 bg-red-500 rounded-sm" />
              <span className="text-muted-foreground">
                Falta ({stats.absent})
              </span>
            </div>
          </div>
          <div className="font-semibold text-sm">
            {stats.attendanceRate}% Asistencia
          </div>
        </div>
      )}
    </div>
  )
}
