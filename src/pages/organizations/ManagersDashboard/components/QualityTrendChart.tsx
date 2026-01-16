/**
 * QualityTrendChart - Area chart showing quality trends over time
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, TooltipProps } from 'recharts'
import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown } from 'lucide-react'

interface QualityTrendChartProps {
  managerId?: string | null
  className?: string
}

// Mock data - quality scores over last 12 weeks
const MOCK_DATA = [
  { week: 'S1', quality: 82 },
  { week: 'S2', quality: 84 },
  { week: 'S3', quality: 81 },
  { week: 'S4', quality: 86 },
  { week: 'S5', quality: 88 },
  { week: 'S6', quality: 85 },
  { week: 'S7', quality: 89 },
  { week: 'S8', quality: 91 },
  { week: 'S9', quality: 88 },
  { week: 'S10', quality: 92 },
  { week: 'S11', quality: 90 },
  { week: 'S12', quality: 94 },
]

// Custom tooltip
const CustomTooltip = ({ active, payload, label }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <p className="text-xs text-muted-foreground mb-1">Semana {label?.replace('S', '')}</p>
      <p className="text-lg font-bold">{payload[0].value}%</p>
      <p className="text-xs text-muted-foreground">Calidad promedio</p>
    </div>
  )
}

export const QualityTrendChart: React.FC<QualityTrendChartProps> = ({
  // managerId,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Calculate trend
  const currentQuality = MOCK_DATA[MOCK_DATA.length - 1].quality
  const previousQuality = MOCK_DATA[MOCK_DATA.length - 5].quality
  const trend = currentQuality - previousQuality
  const trendPercentage = ((trend / previousQuality) * 100).toFixed(1)

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{t('playtelecom:managers.qualityTrend', { defaultValue: 'Tendencia de Calidad' })}</h3>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:managers.qualityTrendDesc', { defaultValue: 'Últimas 12 semanas' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold">{currentQuality}%</p>
          <div
            className={cn(
              'flex items-center justify-end gap-1 text-xs',
              trend >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400',
            )}
          >
            {trend >= 0 ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
            <span>
              {trend >= 0 ? '+' : ''}
              {trendPercentage}%
            </span>
          </div>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={MOCK_DATA} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="qualityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--chart-2))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.5} vertical={false} />
            <XAxis dataKey="week" axisLine={false} tickLine={false} tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }} />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 10 }}
              domain={[70, 100]}
              tickFormatter={value => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="quality"
              stroke="hsl(var(--chart-2))"
              strokeWidth={2}
              fill="url(#qualityGradient)"
              dot={{ fill: 'hsl(var(--chart-2))', strokeWidth: 0, r: 3 }}
              activeDot={{ r: 5, strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

export default QualityTrendChart
