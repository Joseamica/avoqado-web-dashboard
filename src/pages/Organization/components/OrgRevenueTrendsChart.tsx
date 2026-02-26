import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'
import { getIntlLocale } from '@/utils/i18n-locale'
import { TrendingUp, TrendingDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { DateTime } from 'luxon'
import type { RevenueTrendsResponse } from '@/services/organization.service'

interface OrgRevenueTrendsChartProps {
  data: RevenueTrendsResponse | undefined
  isLoading?: boolean
  formatCurrency: (amount: number) => string
}

export function OrgRevenueTrendsChart({ data, isLoading, formatCurrency }: OrgRevenueTrendsChartProps) {
  const { t, i18n } = useTranslation('organization')
  const localeCode = getIntlLocale(i18n.language)
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders'>('revenue')

  const chartData = useMemo(() => {
    if (!data?.currentPeriod.dataPoints) return []
    return data.currentPeriod.dataPoints.map(point => ({
      date: point.date,
      formattedDate: DateTime.fromISO(point.date, { zone: 'utc' })
        .setLocale(localeCode)
        .toLocaleString({ month: 'short', day: 'numeric' }),
      revenue: point.revenue,
      orders: point.orders,
    }))
  }, [data, localeCode])

  const chartConfig = {
    revenue: { label: t('dashboard.revenue'), color: 'var(--chart-1)' },
    orders: { label: t('dashboard.orders'), color: 'var(--chart-2)' },
  }

  if (isLoading) {
    return (
      <GlassCard className="p-5 h-full">
        <Skeleton className="h-5 w-44 mb-1" />
        <Skeleton className="h-4 w-64 mb-4" />
        <div className="flex gap-4 mb-4">
          <Skeleton className="h-16 flex-1 rounded-xl" />
          <Skeleton className="h-16 flex-1 rounded-xl" />
        </div>
        <Skeleton className="h-[220px] rounded-xl" />
      </GlassCard>
    )
  }

  const totals = data?.currentPeriod.totals || { revenue: 0, orders: 0 }
  const comparison = data?.comparison || { revenueChange: 0, ordersChange: 0 }

  return (
    <GlassCard className="p-5 h-full flex flex-col">
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-sm font-semibold">{t('dashboard.revenueTrends')}</h3>
        <p className="text-xs text-muted-foreground mt-0.5">{t('dashboard.revenueTrendsDesc')}</p>
      </div>

      {/* Metric toggles */}
      <div className="flex gap-2 mb-4">
        {(['revenue', 'orders'] as const).map(key => {
          const change = key === 'revenue' ? comparison.revenueChange : comparison.ordersChange
          const isPositive = change > 0
          const isActive = activeMetric === key
          const TrendIcon = isPositive ? TrendingUp : change < 0 ? TrendingDown : null

          return (
            <button
              key={key}
              className={cn(
                'flex-1 rounded-xl p-3 text-left transition-colors',
                isActive ? 'bg-muted/70 ring-1 ring-border' : 'bg-muted/30 hover:bg-muted/50',
              )}
              onClick={() => setActiveMetric(key)}
            >
              <span className="text-[11px] text-muted-foreground">{chartConfig[key].label}</span>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-bold leading-tight">
                  {key === 'revenue' ? formatCurrency(totals[key]) : totals[key].toLocaleString()}
                </span>
                {TrendIcon && (
                  <span
                    className={cn(
                      'flex items-center gap-0.5 text-[10px] font-medium',
                      isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {isPositive ? '+' : ''}
                    {change.toFixed(1)}%
                  </span>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        {!chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            {t('dashboard.noData')}
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[200px] sm:h-[220px] w-full">
            <LineChart accessibilityLayer data={chartData} margin={{ left: 12, right: 12 }}>
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="formattedDate"
                tickLine={false}
                axisLine={false}
                tickMargin={8}
                minTickGap={32}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[180px]"
                    labelFormatter={value => {
                      if (typeof value === 'string' && value.includes(' ')) return value
                      return DateTime.fromISO(value as string, { zone: 'utc' })
                        .setLocale(localeCode)
                        .toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })
                    }}
                    formatter={(value: any) =>
                      activeMetric === 'revenue'
                        ? formatCurrency(Number(value))
                        : `${value} ${t('dashboard.ordersLabel')}`
                    }
                  />
                }
              />
              <Line
                dataKey={activeMetric}
                type="monotone"
                stroke={`var(--color-${activeMetric})`}
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </div>
    </GlassCard>
  )
}
