/**
 * SalesTrendChart - Sales trend visualization
 *
 * Shows:
 * - Area chart for sales over time
 * - Comparison percentage with previous period
 * - Tooltips with detailed info
 * - Date range filter (presets + custom range)
 */

import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  TooltipProps,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getSalesTrend } from '@/services/commandCenter.service'
import { CalendarIcon } from 'lucide-react'
import { format, subDays, startOfDay, endOfDay } from 'date-fns'
import { es } from 'date-fns/locale'
import { DateRange } from 'react-day-picker'

interface DataPoint {
  date: string
  sales: number
  units: number
  transactions: number
}

interface SalesTrendChartProps {
  className?: string
  title?: string
  subtitle?: string
}

// Period presets
type PeriodPreset = '7d' | '14d' | '30d' | '90d' | 'custom'

const PERIOD_PRESETS: { value: PeriodPreset; label: string; days: number }[] = [
  { value: '7d', label: '7 días', days: 7 },
  { value: '14d', label: '14 días', days: 14 },
  { value: '30d', label: '30 días', days: 30 },
  { value: '90d', label: '90 días', days: 90 },
]

// Custom tooltip component
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: 'MXN',
      minimumFractionDigits: 0,
    }).format(value)

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">Ventas:</span>
          <span className="font-medium">{formatCurrency(entry.value as number)}</span>
        </div>
      ))}
    </div>
  )
}

export const SalesTrendChart: React.FC<SalesTrendChartProps> = ({
  className,
  title,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId, venue } = useCurrentVenue()

  // Date filter state
  const [selectedPeriod, setSelectedPeriod] = useState<PeriodPreset>('7d')
  const [dateRange, setDateRange] = useState<DateRange | undefined>({
    from: subDays(new Date(), 7),
    to: new Date(),
  })
  const [isCalendarOpen, setIsCalendarOpen] = useState(false)

  // Calculate query params based on selection
  const queryParams = useMemo(() => {
    if (selectedPeriod === 'custom' && dateRange?.from && dateRange?.to) {
      return {
        startDate: format(startOfDay(dateRange.from), 'yyyy-MM-dd'),
        endDate: format(endOfDay(dateRange.to), 'yyyy-MM-dd'),
      }
    }
    const preset = PERIOD_PRESETS.find(p => p.value === selectedPeriod)
    return { days: preset?.days || 7 }
  }, [selectedPeriod, dateRange])

  // Fetch sales trend data
  const { data: trendData, isLoading } = useQuery({
    queryKey: ['commandCenter', 'salesTrend', venueId, queryParams],
    queryFn: () => getSalesTrend(venueId!, queryParams),
    enabled: !!venueId,
    staleTime: 60000, // Cache for 1 minute
  })

  const chartTitle = title || t('playtelecom:commandCenter.salesTrend', { defaultValue: 'Tendencia de Ventas' })

  // Generate subtitle based on selection
  const chartSubtitle = useMemo(() => {
    if (selectedPeriod === 'custom' && dateRange?.from && dateRange?.to) {
      return `${format(dateRange.from, 'dd MMM', { locale: es })} - ${format(dateRange.to, 'dd MMM yyyy', { locale: es })}`
    }
    const preset = PERIOD_PRESETS.find(p => p.value === selectedPeriod)
    return t('playtelecom:commandCenter.lastNDays', {
      count: preset?.days || 7,
      defaultValue: `Últimos ${preset?.days || 7} días`,
    })
  }, [selectedPeriod, dateRange, t])

  // Map API data to chart format
  const data: DataPoint[] = useMemo(() => {
    if (!trendData?.trend) return []
    return trendData.trend.map(point => ({
      date: point.date,
      sales: point.sales,
      units: point.units,
      transactions: point.transactions,
    }))
  }, [trendData])

  // Calculate totals for summary
  const totals = useMemo(() => {
    const currentTotal = data.reduce((sum, d) => sum + d.sales, 0)
    // Use comparison percentage from API response
    const change = trendData?.comparison?.salesChange ?? 0

    return {
      current: currentTotal,
      change: change.toFixed(1),
      isPositive: change >= 0,
    }
  }, [data, trendData?.comparison])

  const formatCurrency = useMemo(
    () =>
      (value: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: venue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(value),
    [venue?.currency]
  )

  // Handle period preset selection
  const handlePeriodChange = (period: PeriodPreset) => {
    setSelectedPeriod(period)
    if (period !== 'custom') {
      const preset = PERIOD_PRESETS.find(p => p.value === period)
      if (preset) {
        setDateRange({
          from: subDays(new Date(), preset.days),
          to: new Date(),
        })
      }
    }
  }

  // Handle custom date range selection
  const handleDateRangeSelect = (range: DateRange | undefined) => {
    setDateRange(range)
    if (range?.from && range?.to) {
      setSelectedPeriod('custom')
    }
  }

  if (isLoading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <Skeleton className="h-6 w-40 mb-2" />
            <Skeleton className="h-4 w-28" />
          </div>
          <div className="text-right">
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      {/* Header with title and filters */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
        <div>
          <h3 className="text-lg font-semibold">{chartTitle}</h3>
          <p className="text-sm text-muted-foreground">{chartSubtitle}</p>
        </div>

        {/* Period Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset Buttons */}
          <div className="inline-flex items-center rounded-full bg-muted/60 p-1 border border-border">
            {PERIOD_PRESETS.map(preset => (
              <button
                key={preset.value}
                onClick={() => handlePeriodChange(preset.value)}
                className={cn(
                  'px-3 py-1.5 text-xs font-medium rounded-full transition-colors',
                  selectedPeriod === preset.value
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/80'
                )}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {/* Custom Date Range Picker */}
          <Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
            <PopoverTrigger asChild>
              <Button
                variant={selectedPeriod === 'custom' ? 'default' : 'outline'}
                size="sm"
                className={cn(
                  'h-8 gap-2',
                  selectedPeriod === 'custom' && 'bg-foreground text-background hover:bg-foreground/90'
                )}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                <span className="text-xs">
                  {selectedPeriod === 'custom' && dateRange?.from && dateRange?.to
                    ? `${format(dateRange.from, 'dd/MM')} - ${format(dateRange.to, 'dd/MM')}`
                    : t('playtelecom:commandCenter.customRange', { defaultValue: 'Personalizado' })}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                defaultMonth={dateRange?.from}
                selected={dateRange}
                onSelect={handleDateRangeSelect}
                numberOfMonths={2}
                disabled={{ after: new Date() }}
                locale={es}
              />
              <div className="p-3 border-t border-border flex justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDateRange(undefined)
                    setSelectedPeriod('7d')
                    setIsCalendarOpen(false)
                  }}
                >
                  {t('common:cancel', { defaultValue: 'Cancelar' })}
                </Button>
                <Button
                  size="sm"
                  onClick={() => setIsCalendarOpen(false)}
                  disabled={!dateRange?.from || !dateRange?.to}
                >
                  {t('common:apply', { defaultValue: 'Aplicar' })}
                </Button>
              </div>
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="flex items-center justify-end mb-4">
        <div className="text-right">
          <p className="text-2xl font-bold">{formatCurrency(totals.current)}</p>
          <p className={cn(
            'text-sm font-medium',
            totals.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
          )}>
            {totals.isPositive ? '+' : ''}{totals.change}% vs período anterior
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.5} />
                <stop offset="95%" stopColor="#22c55e" stopOpacity={0.15} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.3}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="#22c55e"
              strokeWidth={2.5}
              fillOpacity={1}
              fill="url(#colorSales)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex items-center justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-primary" />
          <span className="text-muted-foreground">
            {t('playtelecom:commandCenter.thisPeriod', { defaultValue: 'Este período' })}
          </span>
        </div>
      </div>
    </GlassCard>
  )
}

export default SalesTrendChart
