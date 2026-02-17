/**
 * SalesHeatmap — Staff × Day matrix showing sales count/amount with color gradient
 * Grouped by venue state → venue name, with toggle between count and amount mode
 */

import { useMemo, useState } from 'react'
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
import { useStoresSalesHeatmap } from '@/hooks/useStoresAnalysis'
import { exportToExcel, generateFilename } from '@/utils/export'
import type { SalesHeatmapStaff } from '@/services/storesAnalysis.service'

interface SalesHeatmapProps {
  startDate: string
  endDate: string
  filterVenueId?: string
  currency?: string
}

type ViewMode = 'count' | 'amount'

interface VenueGroup {
  state: string
  venues: Array<{
    venueId: string
    venueName: string
    staff: SalesHeatmapStaff[]
  }>
}

function groupByState(staff: SalesHeatmapStaff[]): VenueGroup[] {
  const stateMap = new Map<string, Map<string, SalesHeatmapStaff[]>>()

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

function getIntensityClass(ratio: number): string {
  if (ratio === 0) return 'bg-muted/20'
  if (ratio < 0.25) return 'bg-red-400/60'
  if (ratio < 0.5) return 'bg-amber-400/60'
  if (ratio < 0.75) return 'bg-yellow-300/70'
  if (ratio < 1) return 'bg-green-400/80'
  return 'bg-green-500'
}

function formatCurrency(amount: number, currency = 'MXN'): string {
  return new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function SalesHeatmap({ startDate, endDate, filterVenueId, currency = 'MXN' }: SalesHeatmapProps) {
  const { t } = useTranslation('playtelecom')
  const [viewMode, setViewMode] = useState<ViewMode>('count')
  const { data, isLoading } = useStoresSalesHeatmap({ startDate, endDate, filterVenueId })

  const dayColumns = useMemo(() => {
    if (!data?.summary?.byDay?.length) return []
    return data.summary.byDay.map(d => ({
      date: d.date,
      label: format(parseISO(d.date), 'EEE d', { locale: es }),
    }))
  }, [data])

  const groups = useMemo(() => {
    if (!data?.staff?.length) return []
    return groupByState(data.staff)
  }, [data])

  // Compute max value for color gradient normalization
  const maxValue = useMemo(() => {
    if (!data?.staff?.length) return 1
    let max = 0
    for (const s of data.staff) {
      for (const d of s.days) {
        const val = viewMode === 'count' ? d.salesCount : d.salesAmount
        if (val > max) max = val
      }
    }
    return max || 1
  }, [data, viewMode])

  const handleExport = async () => {
    if (!data?.staff?.length) return
    const rows: Record<string, any>[] = []
    for (const s of data.staff) {
      const row: Record<string, any> = {
        [t('supervisor.salesHeatmap.store')]: s.venueName,
        [t('supervisor.salesHeatmap.promoter')]: s.staffName,
      }
      for (const d of s.days) {
        const label = format(parseISO(d.date), 'dd/MM')
        row[`${label} (#)`] = d.salesCount
        row[`${label} ($)`] = d.salesAmount
      }
      row[t('supervisor.salesHeatmap.totalSales')] = s.totalSales
      row[t('supervisor.salesHeatmap.totalCount')] = s.totalCount
      row[t('supervisor.salesHeatmap.avgDaily')] = Math.round(s.avgDailySales)
      rows.push(row)
    }
    await exportToExcel(rows, generateFilename('ventas'), 'Ventas')
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
          {t('supervisor.salesHeatmap.noData')}
        </p>
      </GlassCard>
    )
  }

  return (
    <GlassCard className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <h3 className="text-lg font-semibold">{t('supervisor.salesHeatmap.title')}</h3>
          {/* Mode toggle */}
          <div className="flex items-center rounded-full bg-muted/60 p-0.5 border border-border">
            <button
              onClick={() => setViewMode('count')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-all',
                viewMode === 'count' && 'bg-foreground text-background',
              )}
            >
              {t('supervisor.salesHeatmap.modeCount')}
            </button>
            <button
              onClick={() => setViewMode('amount')}
              className={cn(
                'px-3 py-1 text-xs font-medium rounded-full transition-all',
                viewMode === 'amount' && 'bg-foreground text-background',
              )}
            >
              {t('supervisor.salesHeatmap.modeAmount')}
            </button>
          </div>
          {/* Gradient legend */}
          <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span>0</span>
            <div className="flex gap-px">
              <div className="w-3 h-3 rounded-sm bg-red-400/60" />
              <div className="w-3 h-3 rounded-sm bg-amber-400/60" />
              <div className="w-3 h-3 rounded-sm bg-yellow-300/70" />
              <div className="w-3 h-3 rounded-sm bg-green-400/80" />
              <div className="w-3 h-3 rounded-sm bg-green-500" />
            </div>
            <span>max</span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {t('supervisor.salesHeatmap.export')}
        </Button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <TooltipProvider>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="sticky left-0 z-10 bg-card px-3 py-2 text-left font-medium min-w-[120px]">
                  {t('supervisor.salesHeatmap.store')}
                </th>
                <th className="sticky left-[120px] z-10 bg-card px-3 py-2 text-left font-medium min-w-[140px]">
                  {t('supervisor.salesHeatmap.promoter')}
                </th>
                {dayColumns.map(d => (
                  <th key={d.date} className="px-1 py-2 text-center font-medium min-w-[36px]">
                    <span className="block text-[10px] leading-tight">{d.label}</span>
                  </th>
                ))}
                <th className="px-3 py-2 text-right font-medium min-w-[80px]">
                  {t('supervisor.salesHeatmap.totalSales')}
                </th>
                <th className="px-3 py-2 text-right font-medium min-w-[70px]">
                  {t('supervisor.salesHeatmap.avgDaily')}
                </th>
              </tr>
            </thead>
            <tbody>
              {groups.map(group => (
                <SalesGroupRows
                  key={group.state}
                  group={group}
                  dayColumns={dayColumns}
                  viewMode={viewMode}
                  maxValue={maxValue}
                  currency={currency}
                  t={t}
                />
              ))}
              {/* Total row */}
              <tr className="border-t-2 border-border font-semibold bg-muted/30">
                <td colSpan={2} className="sticky left-0 z-10 bg-muted/30 px-3 py-2 text-xs uppercase">
                  {t('supervisor.salesHeatmap.totals')}
                </td>
                {data.summary.byDay.map(d => (
                  <td key={d.date} className="px-1 py-2 text-center text-xs">
                    {viewMode === 'count' ? d.totalCount : formatCurrency(d.totalAmount, currency)}
                  </td>
                ))}
                <td className="px-3 py-2 text-right text-xs">
                  {formatCurrency(
                    data.staff.reduce((sum, s) => sum + s.totalSales, 0),
                    currency,
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs" />
              </tr>
            </tbody>
          </table>
        </TooltipProvider>
      </div>
    </GlassCard>
  )
}

function SalesGroupRows({
  group,
  dayColumns,
  viewMode,
  maxValue,
  currency,
  t,
}: {
  group: VenueGroup
  dayColumns: Array<{ date: string; label: string }>
  viewMode: ViewMode
  maxValue: number
  currency: string
  t: (key: string) => string
}) {
  // Subtotals per day
  const subtotals = useMemo(() => {
    return dayColumns.map(dc => {
      let totalCount = 0
      let totalAmount = 0
      for (const venue of group.venues) {
        for (const staff of venue.staff) {
          const day = staff.days.find(d => d.date === dc.date)
          if (day) {
            totalCount += day.salesCount
            totalAmount += day.salesAmount
          }
        }
      }
      return { date: dc.date, totalCount, totalAmount }
    })
  }, [group, dayColumns])

  const groupTotal = useMemo(() => {
    return group.venues.reduce((sum, v) => sum + v.staff.reduce((s, st) => s + st.totalSales, 0), 0)
  }, [group])

  return (
    <>
      {/* State header */}
      <tr>
        <td
          colSpan={2 + dayColumns.length + 2}
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
            {staff.days.map(day => {
              const value = viewMode === 'count' ? day.salesCount : day.salesAmount
              const ratio = maxValue > 0 ? value / maxValue : 0

              return (
                <td key={day.date} className="px-0.5 py-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          'mx-auto w-7 h-5 rounded-sm flex items-center justify-center text-[9px] font-medium transition-all',
                          getIntensityClass(ratio),
                          ratio > 0.5 ? 'text-white' : 'text-foreground',
                        )}
                      >
                        {value > 0 ? (viewMode === 'count' ? value : '') : ''}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <div className="text-xs space-y-0.5">
                        <p className="font-semibold">{staff.staffName}</p>
                        <p>{format(parseISO(day.date), 'EEEE d MMMM', { locale: es })}</p>
                        <p>{day.salesCount} {t('supervisor.salesHeatmap.modeCount').toLowerCase()}</p>
                        <p>{formatCurrency(day.salesAmount, currency)}</p>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </td>
              )
            })}
            <td className="px-3 py-1.5 text-right text-xs font-medium">
              {formatCurrency(staff.totalSales, currency)}
            </td>
            <td className="px-3 py-1.5 text-right text-xs text-muted-foreground">
              {formatCurrency(Math.round(staff.avgDailySales), currency)}
            </td>
          </tr>
        )),
      )}
      {/* Subtotal row */}
      <tr className="border-b border-border/50">
        <td colSpan={2} className="sticky left-0 z-10 bg-card px-3 py-1 text-xs text-muted-foreground italic">
          {t('supervisor.salesHeatmap.subtotal')} {group.state}
        </td>
        {subtotals.map(st => (
          <td key={st.date} className="px-1 py-1 text-center text-[10px] text-muted-foreground">
            {viewMode === 'count' ? st.totalCount : formatCurrency(st.totalAmount, currency)}
          </td>
        ))}
        <td className="px-3 py-1 text-right text-xs text-muted-foreground font-medium">
          {formatCurrency(groupTotal, currency)}
        </td>
        <td />
      </tr>
    </>
  )
}
