/**
 * StockVsSalesChart - Dual-axis chart showing stock evolution vs sales
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
} from 'recharts'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getStockChart } from '@/services/stockDashboard.service'

interface DataPoint {
  date: string
  stock: number
  sales: number
}

interface StockVsSalesChartProps {
  className?: string
}

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <p className="font-semibold text-sm mb-2">{label}</p>
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-2 text-sm">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">
            {entry.dataKey === 'stock' ? 'Stock' : 'Ventas'}:
          </span>
          <span className="font-medium">{entry.value} uds</span>
        </div>
      ))}
    </div>
  )
}

export const StockVsSalesChart: React.FC<StockVsSalesChartProps> = ({
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()

  // Fetch stock chart data
  const { data: chartData, isLoading } = useQuery({
    queryKey: ['stock', 'chart', venueId],
    queryFn: () => getStockChart(venueId!, { days: 7 }),
    enabled: !!venueId,
  })

  // Map API data to chart format
  const data: DataPoint[] = useMemo(() => {
    if (!chartData?.days) return []
    return chartData.days.map(point => ({
      date: point.date,
      stock: point.stockLevel,
      sales: point.salesCount,
    }))
  }, [chartData])

  // Calculate summary stats
  const summary = useMemo(() => {
    if (data.length === 0) {
      return { totalSales: 0, avgStock: 0, minStock: 0, daysOfCoverage: 0 }
    }
    const totalSales = data.reduce((sum, d) => sum + d.sales, 0)
    const avgStock = Math.round(data.reduce((sum, d) => sum + d.stock, 0) / data.length)
    const minStock = Math.min(...data.map(d => d.stock))
    const avgDailySales = totalSales / data.length
    const daysOfCoverage = avgDailySales > 0 ? Math.round(avgStock / avgDailySales) : 0

    return { totalSales, avgStock, minStock, daysOfCoverage }
  }, [data])

  if (isLoading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="flex items-start justify-between mb-6">
          <div>
            <Skeleton className="h-6 w-32 mb-2" />
            <Skeleton className="h-4 w-24" />
          </div>
          <div className="flex gap-4">
            <Skeleton className="h-12 w-20" />
            <Skeleton className="h-12 w-24" />
          </div>
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold">
            {t('playtelecom:stock.stockVsSales', { defaultValue: 'Stock vs Ventas' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:stock.last7Days', { defaultValue: 'Últimos 7 días' })}
          </p>
        </div>
        <div className="flex gap-4 text-right">
          <div>
            <p className="text-xs text-muted-foreground">Cobertura</p>
            <p className={cn(
              'text-lg font-bold',
              summary.daysOfCoverage < 7
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
            )}>
              {summary.daysOfCoverage} días
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Stock promedio</p>
            <p className="text-lg font-bold">{summary.avgStock} uds</p>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={data}
            margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="var(--border)"
              opacity={0.5}
            />
            <XAxis
              dataKey="date"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            />
            <YAxis
              yAxisId="left"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              label={{
                value: 'Stock',
                angle: -90,
                position: 'insideLeft',
                style: { fill: 'var(--muted-foreground)', fontSize: 10 }
              }}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
              label={{
                value: 'Ventas',
                angle: 90,
                position: 'insideRight',
                style: { fill: 'var(--muted-foreground)', fontSize: 10 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '20px' }}
              formatter={(value) => (
                <span style={{ color: '#9ca3af', fontSize: '14px' }}>
                  {value === 'stock' ? 'Stock' : 'Ventas'}
                </span>
              )}
            />
            <Bar
              yAxisId="right"
              dataKey="sales"
              fill="#3b82f6"
              opacity={0.7}
              radius={[4, 4, 0, 0]}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="stock"
              stroke="#22c55e"
              strokeWidth={2}
              dot={{ fill: '#22c55e', strokeWidth: 0, r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

export default StockVsSalesChart
