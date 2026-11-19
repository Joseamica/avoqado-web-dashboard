import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Line, LineChart, CartesianGrid, XAxis } from 'recharts'
import { Coins } from 'lucide-react'
import { Currency } from '@/utils/currency'
import { EmptyChart } from './EmptyChart'
import { getIntlLocale } from '@/utils/i18n-locale'
import { useVenueDateTime } from '@/utils/datetime'
import { DateTime } from 'luxon'
import { aggregateTipsOverTime } from './tipsOverTimeAggregate'

export const TipsOverTimeChart = ({ data }: { data: any }) => {
  const { t, i18n } = useTranslation('home')
  const localeCode = getIntlLocale(i18n.language)
  const { venueTimezone } = useVenueDateTime()

  const [activeMetric, setActiveMetric] = useState<'tips' | 'tipPercentage'>('tips')

  const tipsOverTime = useMemo(
    () => aggregateTipsOverTime(data?.payments, venueTimezone, localeCode),
    [data?.payments, venueTimezone, localeCode],
  )

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
          <div className="h-[15.625rem]">
            <EmptyChart icon={Coins} messageKey="emptyChart.tips" />
          </div>
        ) : (
          <ChartContainer config={chartConfig} className="aspect-auto h-[13.75rem] sm:h-[15.625rem] w-full">
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
                        return DateTime.fromISO(matchingData.date, { zone: venueTimezone })
                          .setLocale(localeCode)
                          .toLocaleString({ month: 'short', day: 'numeric', year: 'numeric' })
                      }
                      return value
                    }}
                    formatter={(value: any) => (activeMetric === 'tips' ? Currency(Number(value), false) : `${value}%`)}
                  />
                }
              />
              <Line
                dataKey={activeMetric}
                type="monotone"
                stroke={`var(--color-${activeMetric})`}
                strokeWidth={2}
                dot={tipsOverTime.length === 1 ? { r: 4 } : false}
              />
            </LineChart>
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  )
}
