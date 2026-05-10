import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { Currency } from '@/utils/currency'

const WEEKDAY_KEYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const

const formatAxisCurrency = (value: number): string => {
  const abs = Math.abs(value)
  if (abs >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toFixed(0)}`
}

const bucketByWeekday = (payments: any[], timezone: string): number[] => {
  const buckets = new Array(7).fill(0)
  for (const payment of payments) {
    if (!payment?.createdAt) continue
    const dt = DateTime.fromISO(String(payment.createdAt), { zone: 'utc' }).setZone(timezone)
    if (!dt.isValid) continue
    const idx = dt.weekday % 7 // luxon: 1=Mon..7=Sun → idx: Sun=0..Sat=6
    buckets[idx] += Number(payment.amount || 0)
  }
  return buckets
}

interface PerformanceChartProps {
  currentPayments: any[]
  comparePayments: any[]
  venueTimezone: string
  currentLabel: string
  compareLabel: string
  /** Mensaje a mostrar como pill superpuesta cuando ambos periodos están vacíos */
  emptyLabel: string
}

export function PerformanceChart({
  currentPayments,
  comparePayments,
  venueTimezone,
  currentLabel,
  compareLabel,
  emptyLabel,
}: PerformanceChartProps) {
  const { t } = useTranslation('home')

  const data = useMemo(() => {
    const current = bucketByWeekday(currentPayments, venueTimezone)
    const compare = bucketByWeekday(comparePayments, venueTimezone)
    return WEEKDAY_KEYS.map((key, index) => ({
      weekday: t(`weekdays.${key}`),
      current: current[index],
      compare: compare[index],
    }))
  }, [currentPayments, comparePayments, venueTimezone, t])

  // Square pattern: cuando NO hay datos en ambos periodos, dejamos el chart
  // con sus ejes y la grilla pero superponemos un pill central diciéndole al
  // usuario que no hay datos. Si hay datos en cualquiera de los periodos, el
  // pill se oculta.
  const isEmpty = useMemo(() => data.every(row => row.current === 0 && row.compare === 0), [data])

  return (
    <div className="relative">
    <ChartContainer
      className="h-44 w-full"
      config={{
        current: { label: currentLabel, color: 'var(--primary)' },
        compare: { label: compareLabel, color: 'color-mix(in oklab, var(--muted-foreground) 35%, transparent)' },
      }}
    >
      <BarChart accessibilityLayer data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }} barCategoryGap="20%">
        <CartesianGrid vertical={false} strokeDasharray="3 3" />
        <XAxis dataKey="weekday" tickLine={false} axisLine={false} tickMargin={8} className="text-xs" />
        <YAxis
          tickLine={false}
          axisLine={false}
          tickFormatter={value => formatAxisCurrency(Number(value))}
          width={40}
          className="text-xs"
        />
        {!isEmpty && (
          <ChartTooltip
            cursor={{ fill: 'var(--muted)', fillOpacity: 0.5 }}
            content={
              <ChartTooltipContent
                formatter={(value, _name, item) => {
                  const key = String(item?.dataKey ?? '')
                  const seriesLabel = key === 'current' ? currentLabel : key === 'compare' ? compareLabel : key
                  return (
                    <div className="flex flex-col gap-0.5">
                      <span className="text-xs text-muted-foreground">{seriesLabel}</span>
                      <span className="font-semibold">{Currency(Number(value), false)}</span>
                    </div>
                  )
                }}
              />
            }
          />
        )}
        <Bar dataKey="current" fill="var(--color-current)" radius={[4, 4, 0, 0]} maxBarSize={28} />
        <Bar dataKey="compare" fill="var(--color-compare)" radius={[4, 4, 0, 0]} maxBarSize={28} />
      </BarChart>
    </ChartContainer>
    {isEmpty && (
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="rounded-full bg-muted px-4 py-1.5 text-sm text-muted-foreground shadow-sm">
          {emptyLabel}
        </span>
      </div>
    )}
    </div>
  )
}
