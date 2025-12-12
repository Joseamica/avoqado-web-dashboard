import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useVenueDateTime } from '@/utils/datetime'
import { DateTime } from 'luxon'

export const AOVTrendsChart = ({ data }: { data: any }) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)
  const { venueTimezone } = useVenueDateTime()
  const aovData = useMemo(() => data?.aov ?? [], [data?.aov])

  const [activeMetric, setActiveMetric] = useState<'aov' | 'orderCount'>('aov')

  // Calculate totals and averages
  const stats = useMemo(() => {
    const totalRevenue = aovData.reduce((acc: number, curr: any) => acc + (curr.revenue || 0), 0)
    const totalOrders = aovData.reduce((acc: number, curr: any) => acc + (curr.orderCount || 0), 0)
    const avgAOV = totalOrders > 0 ? totalRevenue / totalOrders : 0

    return {
      aov: avgAOV,
      orderCount: totalOrders,
    }
  }, [aovData])

  const chartConfig = {
    aov: {
      label: t('aov.title'),
      color: 'var(--chart-1)',
    },
    orderCount: {
      label: t('charts.totalOrders'),
      color: 'var(--chart-2)',
    },
  }

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{t('aov.title')}</CardTitle>
          <CardDescription>{t('aov.desc')}</CardDescription>
        </div>
        <div className="flex">
          {(['aov', 'orderCount'] as const).map(key => (
            <button
              key={key}
              data-active={activeMetric === key}
              className="data-[active=true]:bg-muted/50 flex flex-1 flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
              onClick={() => setActiveMetric(key)}
            >
              <span className="text-muted-foreground text-xs">{chartConfig[key].label}</span>
              <span className="text-lg leading-none font-bold sm:text-2xl">
                {key === 'aov' ? Currency(stats[key], false) : stats[key].toLocaleString()}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {!aovData || aovData.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={aovData}
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
                  if (typeof value === 'string' && value.includes(' ')) {
                    return value
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
                      activeMetric === 'aov' ? Currency(Number(value), false) : `${value} ${t('charts.ordersLabel')}`
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
