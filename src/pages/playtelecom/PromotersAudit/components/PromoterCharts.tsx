/**
 * PromoterCharts - Gráficas de desempeño del promotor
 *
 * Incluye:
 * - Tendencia de ventas (área chart)
 * - Mix de venta (donut chart)
 * - Calendario de asistencia
 */

import React from 'react'
import { TrendingUp, Calendar, PieChart } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useQuery } from '@tanstack/react-query'
import api from '@/api'

interface PromoterChartsProps {
  promoterId: string
  promoterName: string
  venueId?: string
  /** Callback when a calendar date is clicked */
  onDateClick?: (date: string, timeEntries: any[]) => void
}

export function PromoterCharts({ promoterId, promoterName: _promoterName, venueId, onDateClick }: PromoterChartsProps) {
  const { venue } = useCurrentVenue()
  const queryParams = venueId ? { venueId } : undefined

  // Fetch sales trend data
  const { data: salesTrendData } = useQuery({
    queryKey: ['staff-sales-trend', venue?.organizationId, promoterId, venueId],
    queryFn: async () => {
      if (!venue?.organizationId) return { salesData: [] }
      const response = await api.get(`/api/v1/dashboard/organizations/${venue.organizationId}/staff/${promoterId}/sales-trend`, {
        params: queryParams,
      })
      return response.data.data
    },
    enabled: !!venue?.organizationId && !!promoterId,
  })

  // Fetch sales mix data
  const { data: salesMixData } = useQuery({
    queryKey: ['staff-sales-mix', venue?.organizationId, promoterId, venueId],
    queryFn: async () => {
      if (!venue?.organizationId) return { salesMix: [] }
      const response = await api.get(`/api/v1/dashboard/organizations/${venue.organizationId}/staff/${promoterId}/sales-mix`, {
        params: queryParams,
      })
      return response.data.data
    },
    enabled: !!venue?.organizationId && !!promoterId,
  })

  // Fetch attendance calendar data
  const { data: calendarData } = useQuery({
    queryKey: ['staff-attendance-calendar', venue?.organizationId, promoterId, venueId],
    queryFn: async () => {
      if (!venue?.organizationId) return { calendar: [], stats: { present: 0, absent: 0 } }
      const response = await api.get(`/api/v1/dashboard/organizations/${venue.organizationId}/staff/${promoterId}/attendance-calendar`, {
        params: queryParams,
      })
      return response.data.data
    },
    enabled: !!venue?.organizationId && !!promoterId,
  })

  const salesData = salesTrendData?.salesData || []
  const salesMix = salesMixData?.salesMix || []
  const calendar = calendarData?.calendar || []
  const attendanceStats = calendarData?.stats || { present: 0, absent: 0 }

  // Assign colors to sales mix categories
  const colors = ['bg-blue-500', 'bg-green-500', 'bg-purple-500', 'bg-orange-500', 'bg-pink-500']
  const salesMixWithColors = salesMix.map((item: any, idx: number) => ({
    ...item,
    color: colors[idx % colors.length],
  }))

  const maxSales = salesData.length > 0 ? Math.max(...salesData.map((d: any) => d.sales)) : 1

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Tendencia de Ventas */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5">
            <TrendingUp className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Tendencia de Ventas</h3>
            <p className="text-xs text-muted-foreground">Última semana</p>
          </div>
        </div>

        {/* Simple area chart */}
        <div className="h-40 flex items-end gap-1">
          {salesData.length > 0 ? (
            salesData.map((data: any, idx: number) => {
              const height = maxSales > 0 ? (data.sales / maxSales) * 100 : 0
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className={cn(
                      'w-full rounded-t-sm bg-gradient-to-t from-primary to-primary/60',
                      'hover:from-primary/80 hover:to-primary/40 transition-all cursor-pointer',
                      'relative group',
                    )}
                    style={{ height: `${Math.max(height, 2)}%` }}
                  >
                    {/* Tooltip on hover */}
                    <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-foreground text-background text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                      ${data.sales.toLocaleString('es-MX')}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground font-medium mt-1">{data.day}</span>
                </div>
              )
            })
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <p className="text-xs text-muted-foreground">Sin datos de ventas</p>
            </div>
          )}
        </div>

        {salesData.length > 0 && (
          <div className="mt-4 pt-4 border-t flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">Promedio</p>
              <p className="text-sm font-bold">
                $
                {(salesData.reduce((acc: number, d: any) => acc + d.sales, 0) / salesData.length).toLocaleString('es-MX', {
                  maximumFractionDigits: 0,
                })}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Mejor día</p>
              <p className="text-sm font-bold text-green-600">${Math.max(...salesData.map((d: any) => d.sales)).toLocaleString('es-MX')}</p>
            </div>
          </div>
        )}
      </div>

      {/* Mix de Venta */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
            <PieChart className="w-4 h-4 text-green-600 dark:text-green-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Mix de Venta</h3>
            <p className="text-xs text-muted-foreground">Por categoría</p>
          </div>
        </div>

        {/* Simple donut chart representation */}
        <div className="flex items-center justify-center h-32 mb-4">
          <div className="relative w-32 h-32">
            {/* Outer ring with segments */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="20" className="text-muted/20" />
              {/* Segments (simplified - would need proper arc calculation in production) */}
              <circle
                cx="50"
                cy="50"
                r="40"
                fill="none"
                stroke="#3B82F6"
                strokeWidth="20"
                strokeDasharray={`${45 * 2.51} ${100 * 2.51}`}
                strokeDashoffset="0"
                className="transition-all"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">100%</p>
              </div>
            </div>
          </div>
        </div>

        {/* Legend */}
        <div className="space-y-2">
          {salesMixWithColors.length > 0 ? (
            salesMixWithColors.map((item: any, idx: number) => (
              <div key={idx} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className={cn('w-3 h-3 rounded-full', item.color)}></div>
                  <span className="text-xs text-muted-foreground">{item.category}</span>
                </div>
                <span className="text-xs font-bold">{item.percentage}%</span>
              </div>
            ))
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">Sin datos de ventas</p>
          )}
        </div>
      </div>

      {/* Asistencia Calendar */}
      <div className="bg-card rounded-xl border p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="p-2 rounded-lg bg-gradient-to-br from-orange-500/20 to-orange-500/5">
            <Calendar className="w-4 h-4 text-orange-600 dark:text-orange-400" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Asistencia</h3>
            <p className="text-xs text-muted-foreground">Mes actual</p>
          </div>
        </div>

        {/* Simple calendar grid */}
        <div className="space-y-3">
          {/* Days of week */}
          <div className="grid grid-cols-7 gap-1">
            {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((day, idx) => (
              <div key={idx} className="text-center text-xs font-bold text-muted-foreground">
                {day}
              </div>
            ))}
          </div>

          {/* Calendar days */}
          <div className="grid grid-cols-7 gap-1">
            {calendar.map((dayData: any, idx: number) => {
              const isClickable = !dayData.isFutureDay && onDateClick && dayData.date
              return (
                <div
                  key={idx}
                  onClick={() => {
                    if (isClickable) {
                      onDateClick(dayData.date, dayData.timeEntries || [])
                    }
                  }}
                  className={cn(
                    'aspect-square rounded-md flex items-center justify-center text-xs font-medium transition-colors',
                    dayData.isFutureDay && 'text-muted-foreground/30',
                    !dayData.isFutureDay && dayData.isPresent && 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400',
                    !dayData.isFutureDay && !dayData.isPresent && 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400',
                    dayData.isToday && 'ring-2 ring-primary ring-offset-2',
                    isClickable && 'cursor-pointer hover:ring-2 hover:ring-primary/50',
                  )}
                >
                  {dayData.day}
                </div>
              )
            })}
          </div>

          {/* Stats */}
          <div className="pt-3 border-t grid grid-cols-2 gap-2">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Asistencias</p>
              <p className="text-lg font-bold text-green-600">{attendanceStats.present}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-muted-foreground">Faltas</p>
              <p className="text-lg font-bold text-red-600">{attendanceStats.absent}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
