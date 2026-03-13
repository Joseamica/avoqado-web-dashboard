import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, XAxis, YAxis, CartesianGrid, Cell } from 'recharts'
import { Currency } from '@/utils/currency'

export const ChannelMixChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []
    return data.map((item: any, index: number) => ({
      ...item,
      label: item.channelLabel || t(`channels.${item.channel}`),
      fill: `var(--chart-${(index % 5) + 1})`,
    }))
  }, [data, t])

  const chartConfig = useMemo(() => {
    if (!data || !Array.isArray(data)) return {}
    return data.reduce((acc: any, item: any, index: number) => {
      acc[item.channel] = {
        label: item.channelLabel || t(`channels.${item.channel}`),
        color: `var(--chart-${(index % 5) + 1})`,
      }
      return acc
    }, {} as Record<string, { label: string; color: string }>)
  }, [data, t])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('channelMix.title')}</CardTitle>
        <CardDescription>{t('channelMix.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-2 sm:px-4" style={{ height: '360px' }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={chartConfig}
          >
            <BarChart
              accessibilityLayer
              data={chartData}
              layout="vertical"
              margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
            >
              <CartesianGrid horizontal={false} />
              <YAxis
                dataKey="label"
                type="category"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                width={90}
              />
              <XAxis
                type="number"
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => Currency(Number(value), false)}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, _name: any, item: any) => {
                      const payload = item?.payload
                      const orders = payload?.orders
                      const percentage = payload?.percentage
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{Currency(Number(value), false)}</span>
                          <div className="flex gap-2 text-xs text-muted-foreground">
                            {orders != null && (
                              <span>{orders} {t('charts.orders')}</span>
                            )}
                            {percentage != null && (
                              <span>({percentage}%)</span>
                            )}
                          </div>
                        </div>
                      )
                    }}
                  />
                }
              />
              <Bar dataKey="revenue" radius={4} maxBarSize={30}>
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
