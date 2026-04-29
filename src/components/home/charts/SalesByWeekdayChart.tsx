import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { BarChart3 } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { EmptyChart } from './EmptyChart'

// Compact currency formatter for axis ticks: $1.2M, $45K, $300
const formatAxisCurrency = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value}`
}

// Backend contract (generalStats.dashboard.service.ts:913): array always ordered Mon→Sun
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'] as const

export const SalesByWeekdayChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []
    return data.map((item: any, index: number) => ({
      ...item,
      weekdayName: t(`weekdays.${WEEKDAY_KEYS[index] ?? 'mon'}`),
    }))
  }, [data, t])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('salesByWeekday.title')}</CardTitle>
        <CardDescription>{t('salesByWeekday.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-2 sm:px-4 h-90">
        {chartData.length === 0 ? (
          <EmptyChart icon={BarChart3} messageKey="emptyChart.weekdaySales" />
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              sales: {
                label: t('charts.sales'),
                color: 'var(--chart-1)',
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              margin={{ top: 20, right: 20, left: 20, bottom: 20 }}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="weekdayName"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => formatAxisCurrency(Number(value))}
                width={56}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, _name: any, item: any) => {
                      const orders = item?.payload?.orders
                      return (
                        <div className="flex flex-col gap-1">
                          <span>{Currency(Number(value), false)}</span>
                          {orders != null && (
                            <span className="text-muted-foreground text-xs">
                              {orders} {t('charts.orders')}
                            </span>
                          )}
                        </div>
                      )
                    }}
                  />
                }
              />
              <Bar dataKey="sales" fill="var(--color-sales)" radius={4} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
