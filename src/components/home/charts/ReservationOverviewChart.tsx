import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Cell } from 'recharts'

const STATUS_COLORS: Record<string, string> = {
  CONFIRMED: 'var(--chart-1)',   // blue
  COMPLETED: 'var(--chart-2)',   // green-ish
  CANCELLED: 'var(--chart-5)',   // red-ish
  NO_SHOW: 'var(--chart-3)',     // amber
}

export const ReservationOverviewChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')

  const hasData = data && typeof data === 'object' && data.byStatus

  const chartData = useMemo(() => {
    if (!hasData) return []
    return Object.entries(data.byStatus as Record<string, number>).map(([status, count]) => ({
      status,
      label: t(`reservationStatus.${status}`),
      count: count as number,
      fill: STATUS_COLORS[status] || 'var(--chart-4)',
    }))
  }, [data, hasData, t])

  const chartConfig = useMemo(() => {
    if (!hasData) return {}
    return Object.keys(data.byStatus as Record<string, number>).reduce(
      (acc: any, status: string) => {
        acc[status] = {
          label: t(`reservationStatus.${status}`),
          color: STATUS_COLORS[status] || 'var(--chart-4)',
        }
        return acc
      },
      {} as Record<string, { label: string; color: string }>
    )
  }, [data, hasData, t])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('reservationOverview.title')}</CardTitle>
        <CardDescription>{t('reservationOverview.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6">
        {!hasData ? (
          <div className="flex items-center justify-center h-48">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* KPI Summary */}
            <div className="flex items-center gap-6">
              <div>
                <p className="text-3xl font-bold text-foreground">{data.total}</p>
                <p className="text-sm text-muted-foreground">{t('total')}</p>
              </div>
              {data.noShowRate != null && (
                <div className="rounded-md border border-input px-3 py-2">
                  <p className="text-lg font-semibold text-foreground">{data.noShowRate}%</p>
                  <p className="text-xs text-muted-foreground">No Show</p>
                </div>
              )}
            </div>

            {/* Bar chart */}
            <div style={{ height: '240px' }}>
              <ChartContainer
                className="h-full"
                config={chartConfig}
              >
                <BarChart
                  accessibilityLayer
                  data={chartData}
                  margin={{ top: 10, right: 20, left: 20, bottom: 20 }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="label"
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value: any) => (
                          <span className="font-medium">{value}</span>
                        )}
                      />
                    }
                  />
                  <Bar dataKey="count" radius={4} maxBarSize={40}>
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ChartContainer>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
