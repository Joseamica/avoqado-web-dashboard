import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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

  // Transform data for chart
  const chartData = useMemo(() => {
    if (!data?.currentPeriod.dataPoints) return []

    return data.currentPeriod.dataPoints.map((point) => ({
      date: point.date,
      formattedDate: DateTime.fromISO(point.date, { zone: 'utc' })
        .setLocale(localeCode)
        .toLocaleString({ month: 'short', day: 'numeric' }),
      revenue: point.revenue,
      orders: point.orders,
    }))
  }, [data, localeCode])

  const chartConfig = {
    revenue: {
      label: t('dashboard.revenue'),
      color: 'var(--chart-1)',
    },
    orders: {
      label: t('dashboard.orders'),
      color: 'var(--chart-2)',
    },
  }

  if (isLoading) {
    return (
      <Card className="py-4 sm:py-0">
        <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
          <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
            <div className="h-6 w-40 bg-muted animate-pulse rounded" />
            <div className="h-4 w-60 bg-muted animate-pulse rounded mt-1" />
          </div>
          <div className="flex">
            <div className="flex flex-col justify-center gap-1 border-t px-6 py-4 sm:border-t-0 sm:border-l sm:px-8 sm:py-6">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
            <div className="flex flex-col justify-center gap-1 border-t border-l px-6 py-4 sm:border-t-0 sm:px-8 sm:py-6">
              <div className="h-4 w-16 bg-muted animate-pulse rounded" />
              <div className="h-8 w-24 bg-muted animate-pulse rounded" />
            </div>
          </div>
        </CardHeader>
        <CardContent className="px-2 sm:p-6">
          <div className="h-[250px] w-full bg-muted/20 animate-pulse rounded" />
        </CardContent>
      </Card>
    )
  }

  const totals = data?.currentPeriod.totals || { revenue: 0, orders: 0 }
  const comparison = data?.comparison || { revenueChange: 0, ordersChange: 0 }

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{t('dashboard.revenueTrends')}</CardTitle>
          <CardDescription>{t('dashboard.revenueTrendsDesc')}</CardDescription>
        </div>
        <div className="flex flex-wrap">
          {(['revenue', 'orders'] as const).map((key) => {
            const change = key === 'revenue' ? comparison.revenueChange : comparison.ordersChange
            const isPositive = change > 0
            const TrendIcon = isPositive ? TrendingUp : change < 0 ? TrendingDown : null

            return (
              <button
                key={key}
                data-active={activeMetric === key}
                className="data-[active=true]:bg-muted/50 flex basis-1/2 sm:basis-auto flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
                onClick={() => setActiveMetric(key)}
              >
                <span className="text-muted-foreground text-xs">{chartConfig[key].label}</span>
                <span className="text-lg leading-none font-bold sm:text-2xl">
                  {key === 'revenue'
                    ? formatCurrency(totals[key])
                    : totals[key].toLocaleString()}
                </span>
                {TrendIcon && (
                  <span
                    className={cn(
                      'flex items-center gap-1 text-xs',
                      isPositive ? 'text-green-500' : 'text-red-500'
                    )}
                  >
                    <TrendIcon className="h-3 w-3" />
                    {isPositive ? '+' : ''}
                    {change.toFixed(1)}%
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {!chartData || chartData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">{t('dashboard.noData')}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] sm:h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={chartData}
              margin={{
                left: 12,
                right: 12,
              }}
            >
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
                    labelFormatter={(value) => {
                      if (typeof value === 'string' && value.includes(' ')) {
                        return value
                      }
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
      </CardContent>
    </Card>
  )
}
