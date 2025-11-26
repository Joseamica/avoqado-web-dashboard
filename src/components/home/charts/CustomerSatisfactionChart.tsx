import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartLegend, ChartLegendContent, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Bar, BarChart, CartesianGrid, XAxis } from 'recharts'

// Enhanced color palette for charts (reused from Home.tsx)
const CHART_COLORS = ['#2563eb', '#60a8fb', '#f59e0b', '#8b5cf6', '#ec4899', '#6366f1']

export const CustomerSatisfactionChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')
  const satisfactionData = data?.satisfaction || []

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('customerSatisfaction.title')}</CardTitle>
        <CardDescription>{t('customerSatisfaction.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {!satisfactionData || satisfactionData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            className="h-full"
            config={{
              rating: {
                label: t('charts.rating'),
                color: CHART_COLORS[4],
              },
              reviewCount: {
                label: t('charts.reviewCount'),
                color: CHART_COLORS[5],
              },
            }}
          >
            <BarChart
              accessibilityLayer
              data={satisfactionData}
              margin={{
                top: 30,
                right: 30,
                left: 20,
                bottom: 20,
              }}
              height={280}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} tickMargin={10} axisLine={false} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value: any, name: any) =>
                      name === 'rating' ? `${value} ${t('tooltips.starsSuffix')}` : `${value} ${t('tooltips.reviewsSuffix')}`
                    }
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="rating" fill="var(--color-rating)" radius={4} maxBarSize={30} />
              <Bar dataKey="reviewCount" fill="var(--color-reviewCount)" radius={4} maxBarSize={30} />
            </BarChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
