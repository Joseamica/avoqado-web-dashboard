import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Currency } from '@/utils/currency'

// Enhanced color palette for charts (reused from Home.tsx)
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

export const PeakHoursChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const peakHoursData = data || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('sections.peakHours')}</CardTitle>
        <CardDescription>{t('sections.peakHoursDesc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 px-2 sm:px-4" style={{ height: '360px' }}>
        {!peakHoursData || peakHoursData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              sales: {
                label: t('charts.sales'),
                color: CHART_COLORS[0],
              },
              transactions: {
                label: t('charts.transactions'),
                color: CHART_COLORS[1],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={peakHoursData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={value => `${value}:00`}
                label={{ value: t('charts.hourOfDay'), position: 'insideBottomRight', offset: -10 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) =>
                      name === 'sales' ? Currency(Number(value), false) : `${value} ${t('charts.transactionsSuffix')}`
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="sales" fill="var(--color-sales)" radius={4} maxBarSize={30} />
              <Bar dataKey="transactions" fill="var(--color-transactions)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
