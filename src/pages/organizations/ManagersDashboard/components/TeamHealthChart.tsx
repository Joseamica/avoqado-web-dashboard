/**
 * TeamHealthChart - Donut chart showing team health distribution
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip, TooltipProps } from 'recharts'
import { cn } from '@/lib/utils'

interface TeamHealthChartProps {
  managerId?: string | null
  className?: string
}

// Mock data - team health status distribution
const MOCK_DATA = [
  { name: 'Excelente', value: 45, color: '#22c55e' },
  { name: 'Bueno', value: 30, color: '#3b82f6' },
  { name: 'Regular', value: 18, color: '#eab308' },
  { name: 'Necesita Atención', value: 7, color: '#ef4444' },
]

// Custom tooltip
const CustomTooltip = ({ active, payload }: TooltipProps<number, string>) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0]
  return (
    <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
      <div className="flex items-center gap-2">
        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: data.payload.color }} />
        <span className="font-medium text-sm">{data.name}</span>
      </div>
      <p className="text-lg font-bold mt-1">{data.value} promotores</p>
      <p className="text-xs text-muted-foreground">
        {(((data.value as number) / MOCK_DATA.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%
      </p>
    </div>
  )
}

// Custom legend
const CustomLegend = ({ payload }: { payload?: Array<{ value: string; color: string }> }) => {
  if (!payload) return null

  return (
    <div className="flex flex-wrap justify-center gap-3 mt-4">
      {payload.map((entry, index) => (
        <div key={index} className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
          <span className="text-xs text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export const TeamHealthChart: React.FC<TeamHealthChartProps> = ({ managerId: _managerId, className }) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Calculate totals
  const totalPromoters = MOCK_DATA.reduce((acc, d) => acc + d.value, 0)
  const healthyPercentage = Math.round(((MOCK_DATA[0].value + MOCK_DATA[1].value) / totalPromoters) * 100)

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">{t('playtelecom:managers.teamHealth', { defaultValue: 'Salud del Equipo' })}</h3>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:managers.teamHealthDesc', { defaultValue: 'Distribución por desempeño' })}
          </p>
        </div>
        <div className="text-right">
          <p
            className={cn(
              'text-2xl font-bold',
              healthyPercentage >= 70
                ? 'text-green-600 dark:text-green-400'
                : healthyPercentage >= 50
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-red-600 dark:text-red-400',
            )}
          >
            {healthyPercentage}%
          </p>
          <p className="text-xs text-muted-foreground">Saludable</p>
        </div>
      </div>

      <div className="h-64 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={MOCK_DATA} cx="50%" cy="45%" innerRadius={60} outerRadius={80} paddingAngle={3} dataKey="value">
              {MOCK_DATA.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute top-[45%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <p className="text-2xl font-bold">{totalPromoters}</p>
          <p className="text-xs text-muted-foreground">Total</p>
        </div>
      </div>
    </GlassCard>
  )
}

export default TeamHealthChart
