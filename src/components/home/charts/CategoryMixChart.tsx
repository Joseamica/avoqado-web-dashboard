import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Pie, PieChart, Label, Cell } from 'recharts'
import { Currency } from '@/utils/currency'

export const CategoryMixChart = ({ data }: { data: any }) => {
  const { t } = useTranslation('home')

  const chartData = useMemo(() => {
    if (!data || !Array.isArray(data) || data.length === 0) return []
    return data.map((item: any, index: number) => ({
      ...item,
      fill: `var(--chart-${(index % 5) + 1})`,
    }))
  }, [data])

  const chartConfig = useMemo(() => {
    if (!data || !Array.isArray(data)) return {}
    return data.reduce((acc: any, item: any, index: number) => {
      acc[item.category] = {
        label: item.categoryLabel || t(`categories.${item.category}`),
        color: `var(--chart-${(index % 5) + 1})`,
      }
      return acc
    }, {} as Record<string, { label: string; color: string }>)
  }, [data, t])

  const totalRevenue = useMemo(() => {
    if (!chartData || chartData.length === 0) return 0
    return chartData.reduce((sum: number, item: any) => sum + (item.revenue || 0), 0)
  }, [chartData])

  return (
    <Card>
      <CardHeader className="border-b pb-3">
        <CardTitle>{t('categoryMix.title')}</CardTitle>
        <CardDescription>{t('categoryMix.desc')}</CardDescription>
      </CardHeader>
      <CardContent className="pt-6" style={{ height: '360px' }}>
        {chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer
            config={chartConfig}
            className="mx-auto aspect-square max-h-[280px]"
          >
            <PieChart>
              <ChartTooltip
                cursor={false}
                content={
                  <ChartTooltipContent
                    hideLabel
                    formatter={(value, _name, item: any) => {
                      const payload = item?.payload
                      const color = payload?.fill
                      const label = payload?.categoryLabel || t(`categories.${payload?.category}`)
                      const percentage = payload?.percentage
                      return (
                        <div className="flex w-full items-center justify-between gap-3">
                          <div className="flex items-center gap-2">
                            <span
                              className="h-2.5 w-2.5 shrink-0 rounded-[2px]"
                              style={{ backgroundColor: color }}
                            />
                            <span className="text-muted-foreground">{label}</span>
                          </div>
                          <div className="flex flex-col items-end">
                            <span className="font-mono font-medium tabular-nums text-foreground">
                              {Currency(Number(value), false)}
                            </span>
                            {percentage != null && (
                              <span className="text-xs text-muted-foreground">{percentage}%</span>
                            )}
                          </div>
                        </div>
                      )
                    }}
                  />
                }
              />
              <Pie
                data={chartData}
                dataKey="revenue"
                nameKey="category"
                innerRadius={60}
                strokeWidth={5}
              >
                {chartData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.fill} />
                ))}
                <Label
                  content={({ viewBox }) => {
                    if (viewBox && 'cx' in viewBox && 'cy' in viewBox) {
                      return (
                        <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle">
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) - 6} className="fill-foreground text-base font-bold">
                            {Currency(totalRevenue, false)}
                          </tspan>
                          <tspan x={viewBox.cx} y={(viewBox.cy || 0) + 14} className="fill-muted-foreground text-xs">
                            {t('total')}
                          </tspan>
                        </text>
                      )
                    }
                  }}
                />
              </Pie>
            </PieChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
