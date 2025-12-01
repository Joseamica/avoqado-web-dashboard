import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

// Enhanced color palette for charts (reused from Home.tsx)
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

export const OrderFrequencyChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const frequencyData = data?.frequency || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('orderFrequency.title')}</CardTitle>
        <CardDescription>{t('orderFrequency.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!frequencyData || frequencyData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full w-full aspect-auto"
            config={{
              orders: {
                label: t('charts.ordersLabel'),
                color: CHART_COLORS[3],
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
              <XAxis dataKey="hour" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => `${value} ${t('charts.ordersLabel')}`} />} />
              <Bar dataKey="orders" fill="var(--color-orders)" radius={4} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
