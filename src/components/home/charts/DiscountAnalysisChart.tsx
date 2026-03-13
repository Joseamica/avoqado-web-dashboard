import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import { Currency } from '@/utils/currency'

export const DiscountAnalysisChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []
    return data.map((item: any) => ({
      ...item,
      displayLabel: item.label || item.type,
    }))
  }, [data])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('discountAnalysis.title')}</CardTitle>
        <CardDescription>{t('discountAnalysis.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-2 sm:px-4" style={{ height: '360px' }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              totalAmount: {
                label: t('charts.sales'),
                color: 'var(--chart-3)',
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
                dataKey="displayLabel"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tickFormatter={(value) => Currency(Number(value), false)}
                width={80}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, _name: any, item: any) => {
                      const count = item?.payload?.count
                      return (
                        <div className="flex flex-col gap-1">
                          <span className="font-medium">{Currency(Number(value), false)}</span>
                          {count != null && (
                            <span className="text-xs text-muted-foreground">
                              {count} {t('charts.orders')}
                            </span>
                          )}
                        </div>
                      )
                    }}
                  />
                }
              />
              <Bar dataKey="totalAmount" fill="var(--color-totalAmount)" radius={4} maxBarSize={40} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
