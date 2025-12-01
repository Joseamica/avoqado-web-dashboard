import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

// Enhanced color palette for charts (reused from Home.tsx)
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

export const KitchenPerformanceChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const kitchenData = data?.kitchen || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('kitchen.title')}</CardTitle>
        <CardDescription>{t('kitchen.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!kitchenData || kitchenData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full w-full aspect-auto"
            config={{
              prepTime: {
                label: t('charts.prepTime'),
                color: CHART_COLORS[0],
              },
              target: {
                label: t('charts.target'),
                color: CHART_COLORS[2],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={kitchenData}
              margin={{
                top: 20,
                right: 20,
                left: 16,
                bottom: 16,
              }}
              height={240}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="category" tickLine={false} tickMargin={8} axisLine={false} />
              <ChartTooltip content={<ChartTooltipContent formatter={(value: any) => `${value} ${t('tooltips.minutesSuffix')}`} />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="prepTime" fill="var(--color-prepTime)" radius={4} maxBarSize={30} />
              <Bar dataKey="target" fill="var(--color-target)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
