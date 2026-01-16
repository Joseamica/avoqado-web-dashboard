/**
 * SalesByPeriodChart - Area chart showing sales over time periods
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { Badge } from '@/components/ui/badge'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { TrendingUp, TrendingDown, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PeriodData {
  period: string
  sales: number
  units: number
}

interface SalesByPeriodChartProps {
  data: PeriodData[]
  periodType: 'day' | 'week' | 'month'
  trend?: number
  className?: string
}

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value)

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <p className="font-medium text-sm mb-2">{label}</p>
        <div className="space-y-1">
          <p className="text-sm text-green-600 dark:text-green-400">
            Ventas: {formatCurrency(payload[0]?.value || 0)}
          </p>
          <p className="text-sm text-muted-foreground">
            Unidades: {payload[0]?.payload?.units || 0}
          </p>
        </div>
      </div>
    )
  }
  return null
}

export const SalesByPeriodChart: React.FC<SalesByPeriodChartProps> = ({
  data,
  periodType,
  trend = 0,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  const periodLabels = {
    day: t('playtelecom:sales.periodDay', { defaultValue: 'Por Día' }),
    week: t('playtelecom:sales.periodWeek', { defaultValue: 'Por Semana' }),
    month: t('playtelecom:sales.periodMonth', { defaultValue: 'Por Mes' }),
  }

  return (
    <GlassCard className={cn('p-4', className)}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-500/20 to-blue-500/5">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h4 className="font-medium text-sm">
              {t('playtelecom:sales.salesByPeriod', { defaultValue: 'Ventas por Período' })}
            </h4>
            <p className="text-xs text-muted-foreground">{periodLabels[periodType]}</p>
          </div>
        </div>
        {trend !== 0 && (
          <Badge
            variant="outline"
            className={cn(
              trend > 0
                ? 'bg-green-500/10 text-green-600 border-green-500/20'
                : 'bg-red-500/10 text-red-600 border-red-500/20'
            )}
          >
            {trend > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
            {trend > 0 ? '+' : ''}{trend}%
          </Badge>
        )}
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
            <defs>
              <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-border/30" />
            <XAxis
              dataKey="period"
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="sales"
              stroke="hsl(var(--primary))"
              strokeWidth={2}
              fill="url(#salesGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

export default SalesByPeriodChart
