import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'
import { Currency } from '@/utils/currency'
import { getIntlLocale } from '@/utils/i18n-locale'

export const TipsOverTimeChart = ({ data }: { data: any }) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)

  const [activeMetric, setActiveMetric] = useState<'tips' | 'tipPercentage'>('tips')

  // Process tips data over time with additional metrics
  const tipsOverTime = useMemo(() => {
    const payments = data?.payments || []
    if (!payments || payments.length === 0) return []

    const tipsByDate = new Map()
    const revenueByDate = new Map()

    payments.forEach((payment: any) => {
      const date = new Date(payment.createdAt).toISOString().split('T')[0]
      const paymentAmount = Number(payment.amount)
      const tipAmount = payment.tips?.reduce((sum: number, tip: any) => sum + Number(tip.amount), 0) || 0

      // Accumulate tips
      if (tipsByDate.has(date)) {
        tipsByDate.set(date, tipsByDate.get(date) + tipAmount)
      } else {
        tipsByDate.set(date, tipAmount)
      }

      // Accumulate revenue
      if (revenueByDate.has(date)) {
        revenueByDate.set(date, revenueByDate.get(date) + paymentAmount)
      } else {
        revenueByDate.set(date, paymentAmount)
      }
    })

    return Array.from(tipsByDate.entries())
      .map(([date, tips]) => {
        const revenue = revenueByDate.get(date) || 0
        const tipPercentage = revenue > 0 ? (tips / revenue) * 100 : 0

        return {
          date,
          tips,
          tipPercentage: Number(tipPercentage.toFixed(2)),
          formattedDate: new Date(date).toLocaleDateString(localeCode, { month: 'short', day: 'numeric' }),
        }
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [data?.payments, localeCode])

  // Calculate totals
  const stats = useMemo(() => {
    const totalTips = tipsOverTime.reduce((acc, curr) => acc + curr.tips, 0)
    const avgTipPercentage =
      tipsOverTime.length > 0 ? tipsOverTime.reduce((acc, curr) => acc + curr.tipPercentage, 0) / tipsOverTime.length : 0

    return {
      tips: totalTips,
      tipPercentage: Number(avgTipPercentage.toFixed(1)),
    }
  }, [tipsOverTime])

  const chartConfig = {
    tips: {
      label: t('charts.tips'),
      color: 'var(--chart-1)',
    },
    tipPercentage: {
      label: t('charts.tipPercentage'),
      color: 'var(--chart-2)',
    },
  }

  return (
    <Card className="py-4 sm:py-0">
      <CardHeader className="flex flex-col items-stretch border-b p-0! sm:flex-row">
        <div className="flex flex-1 flex-col justify-center gap-1 px-6 pb-3 sm:pb-0">
          <CardTitle>{t('sections.tipsOverTime')}</CardTitle>
          <CardDescription>{t('sections.tipsOverTimeDesc')}</CardDescription>
        </div>
        <div className="flex flex-wrap">
          {(['tips', 'tipPercentage'] as const).map(key => (
            <button
              key={key}
              data-active={activeMetric === key}
              className="data-[active=true]:bg-muted/50 flex basis-1/2 sm:basis-auto flex-col justify-center gap-1 border-t px-6 py-4 text-left even:border-l sm:border-t-0 sm:border-l sm:px-8 sm:py-6"
              onClick={() => setActiveMetric(key)}
            >
              <span className="text-muted-foreground text-xs">{chartConfig[key].label}</span>
              <span className="text-lg leading-none font-bold sm:text-2xl">
                {key === 'tips' ? Currency(stats[key], false) : `${stats[key]}%`}
              </span>
            </button>
          ))}
        </div>
      </CardHeader>
      <CardContent className="px-2 sm:p-6">
        {!tipsOverTime || tipsOverTime.length === 0 ? (
          <div className="flex items-center justify-center h-[250px]">
            <p className="text-muted-foreground">{t('noData')}</p>
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[220px] sm:h-[250px] w-full">
            <LineChart
              accessibilityLayer
              data={tipsOverTime}
              margin={{
                left: 10,
                right: 10,
              }}
            >
              <CartesianGrid vertical={false} />
              <XAxis dataKey="formattedDate" tickLine={false} axisLine={false} tickMargin={8} minTickGap={32} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    className="w-[180px]"
                    labelFormatter={value => {
                      const matchingData = tipsOverTime.find(d => d.formattedDate === value)
                      if (matchingData) {
                        const date = new Date(matchingData.date)
                        return date.toLocaleDateString(localeCode, {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })
                      }
                      return value
                    }}
                    formatter={(value: any) => (activeMetric === 'tips' ? Currency(Number(value), false) : `${value}%`)}
                  />
                }
              />
              <Line dataKey={activeMetric} type="monotone" stroke={`var(--color-${activeMetric})`} strokeWidth={2} dot={false} />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
