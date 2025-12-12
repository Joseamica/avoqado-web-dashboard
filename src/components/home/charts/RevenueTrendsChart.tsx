import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useVenueDateTime } from '@/utils/datetime'
import { DateTime } from 'luxon'

export const RevenueTrendsChart = ({ data }: { data: any }) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)
  const { venueTimezone } = useVenueDateTime()
  const revenueData = useMemo(() => data?.revenue ?? [], [data?.revenue])

  // Add state for interactive chart
  const [activeMetric, setActiveMetric] = useState<'revenue' | 'orders'>('revenue')

  // Calculate totals for header buttons
  const totals = useMemo(
    () => ({
      revenue: revenueData.reduce((acc: number, curr: any) => acc + (curr.revenue || 0), 0),
      orders: revenueData.reduce((acc: number, curr: any) => acc + (curr.orders || 0), 0),
    }),
    [revenueData],
  )

  const chartConfig = {
    revenue: {
      label: t('charts.revenue'),
      color: 'var(--chart-1)',
    },
    orders: {
      label: t('charts.orders'),
      color: 'var(--chart-2)',
    },
  }

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{t('sections.revenueTrends')}</CardTitle>
          <CardDescription>{t('sections.revenueTrendsDesc')}</CardDescription>
        </div>
        <div className="flex flex-wrap">
          {(['revenue', 'orders'] as const).map(key => (
            <button
              key={key}
              data-active={activeMetric === key}
              className="data-[active=true]:bg-muted/50 flex basis-1/2 sm:basis-auto flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
              onClick={() => setActiveMetric(key)}
            >
              <span className="text-muted-foreground text-xs">{chartConfig[key].label}</span>
              <span className="text-lg leading-none font-bold sm:text-2xl">
                {key === 'revenue' ? Currency(totals[key], false) : totals[key].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {!revenueData || revenueData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] sm:h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={revenueData}
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
                tickFormatter={value => {
                  // Handle both formatted dates and raw dates
                  if (typeof value === 'string' && value.includes(' ')) {
                    return value // Already formatted
                  }
                  return DateTime.fromISO(value, { zone: 'utc' })
                    .setZone(venueTimezone)
                    .setLocale(localeCode)
                    .toLocaleString({ month: 'short', day: 'numeric' })
                }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[180px]"
                    labelFormatter={value => {
                      if (typeof value === 'string' && value.includes(' ')) {
                        return value
                      }
                      return DateTime.fromISO(value, { zone: 'utc' })
                        .setZone(venueTimezone)
                        .setLocale(localeCode)
                        .toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })
                    }}
                    formatter={(value: any) =>
                      activeMetric === 'revenue' ? Currency(Number(value), false) : `${value} ${t('charts.ordersLabel')}`
                    }
                  />
                }
              />
              <Line dataKey={activeMetric} type="monotone" stroke={`var(--color-${activeMetric})`} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
