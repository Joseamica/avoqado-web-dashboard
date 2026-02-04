/**
 * AttendanceCalendar - Heatmap calendar for attendance tracking
 *
 * IMPORTANTE: Implementar con TPV
 * - El TPV crea TimeEntry al hacer clock-in (clockInTime)
 * - El TPV actualiza TimeEntry al hacer clock-out (clockOutTime)
 * - Status se determina por: CLOCKED_IN, CLOCKED_OUT, ON_BREAK
 * - "LATE" se calcula comparando clockInTime vs horario esperado del staff
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import { Calendar, CheckCircle2, XCircle, Clock } from 'lucide-react'

type AttendanceStatus = 'present' | 'absent' | 'late' | 'holiday' | 'none'

interface AttendanceDay {
  date: string // YYYY-MM-DD
  status: AttendanceStatus
  checkInTime?: string
  checkOutTime?: string
}

interface AttendanceCalendarProps {
  data: AttendanceDay[]
  month?: Date
  className?: string
}

const STATUS_CONFIG: Record<AttendanceStatus, { color: string; label: string }> = {
  present: { color: 'bg-green-500', label: 'Asistió' },
  absent: { color: 'bg-red-500', label: 'Falta' },
  late: { color: 'bg-yellow-500', label: 'Tarde' },
  holiday: { color: 'bg-gray-400', label: 'Descanso' },
  none: { color: 'bg-muted', label: '' },
}

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

export const AttendanceCalendar: React.FC<AttendanceCalendarProps> = ({
  data,
  month = new Date(),
  className,
}) => {
  const { t: _t } = useTranslation(['playtelecom', 'common'])

  // Generate calendar grid
  const calendarDays = useMemo(() => {
    const year = month.getFullYear()
    const monthIndex = month.getMonth()
    const firstDay = new Date(year, monthIndex, 1)
    const lastDay = new Date(year, monthIndex + 1, 0)

    // Get day of week for first day (0 = Sunday, we want Monday = 0)
    let startDayOfWeek = firstDay.getDay() - 1
    if (startDayOfWeek < 0) startDayOfWeek = 6

    const days: { date: Date | null; attendance: AttendanceDay | null }[] = []

    // Add empty days for alignment
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push({ date: null, attendance: null })
    }

    // Add days of month
    for (let day = 1; day <= lastDay.getDate(); day++) {
      const date = new Date(year, monthIndex, day)
      const dateStr = date.toISOString().split('T')[0]
      const attendance = data.find(d => d.date === dateStr)
      days.push({ date, attendance: attendance || null })
    }

    return days
  }, [data, month])

  // Calculate stats
  const stats = useMemo(() => {
    const presentDays = data.filter(d => d.status === 'present').length
    const lateDays = data.filter(d => d.status === 'late').length
    const absentDays = data.filter(d => d.status === 'absent').length
    const workDays = data.filter(d => d.status !== 'holiday' && d.status !== 'none').length

    return {
      present: presentDays,
      late: lateDays,
      absent: absentDays,
      attendanceRate: workDays > 0 ? Math.round((presentDays / workDays) * 100) : 0,
    }
  }, [data])

  const monthName = month.toLocaleDateString('es-MX', { month: 'long', year: 'numeric' })

  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-muted-foreground" />
          <h4 className="font-semibold text-sm capitalize">{monthName}</h4>
        </div>
        <span className="text-xs text-muted-foreground">
          {stats.attendanceRate}% asistencia
        </span>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map(day => (
          <div
            key={day}
            className="text-center text-xs text-muted-foreground font-medium py-1"
          >
            {day}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((item, index) => {
          if (!item.date) {
            return <div key={`empty-${index}`} className="aspect-square" />
          }

          const status = item.attendance?.status || 'none'
          const config = STATUS_CONFIG[status]
          const isToday = item.date.toDateString() === new Date().toDateString()

          return (
            <div
              key={item.date.toISOString()}
              className={cn(
                'aspect-square rounded-md flex items-center justify-center text-xs relative',
                'transition-all hover:scale-110 cursor-pointer',
                config.color,
                status === 'none' ? 'text-muted-foreground' : 'text-white',
                isToday && 'ring-2 ring-primary ring-offset-1 ring-offset-background'
              )}
              title={`${item.date.getDate()}: ${config.label}`}
            >
              {item.date.getDate()}
            </div>
          )
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">{stats.present}</span>
          </div>
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-yellow-500" />
            <span className="text-xs text-muted-foreground">{stats.late}</span>
          </div>
          <div className="flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <span className="text-xs text-muted-foreground">{stats.absent}</span>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export default AttendanceCalendar
