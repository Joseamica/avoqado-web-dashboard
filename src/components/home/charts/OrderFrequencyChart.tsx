import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'
import { Clock } from 'lucide-react'

import { EmptyChart } from './EmptyChart'

export const OrderFrequencyChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const frequencyData = data?.frequency || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('orderFrequency.title')}</CardTitle>
        <CardDescription>{t('orderFrequency.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6 h-90">
        {!frequencyData || frequencyData.length === 0 ? (
          <EmptyChart icon={Clock} messageKey="emptyChart.orderFrequency" />
        ) : (
          <ChartContainer
            className="h-full w-full aspect-auto"
            config={{
              orders: {
                label: t('charts.ordersLabel'),
                color: 'var(--chart-4)',
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={frequencyData}
              margin={{
                top: 24,
                right: 16,
                left: 12,
                bottom: 16,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis
                dataKey="hour"
                tickLine={false}
                tickMargin={10}
                axisLine={false}
                tickFormatter={(value) => `${value}:00`}
              />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => `${value} ${t('charts.ordersLabel')}`} />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
