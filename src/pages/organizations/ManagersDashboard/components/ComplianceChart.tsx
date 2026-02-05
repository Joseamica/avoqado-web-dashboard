/**
 * ComplianceChart - Bar chart showing Real vs Target compliance
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  TooltipProps,
  Cell,
} from 'recharts'
import { cn } from '@/lib/utils'

interface ComplianceChartProps {
  managerId?: string | null
  className?: string
}

// Mock data - compliance metrics by category
const MOCK_DATA = [
  { category: 'Ventas', real: 92, target: 95 },
  { category: 'Asistencia', real: 88, target: 90 },
  { category: 'Calidad', real: 95, target: 90 },
  { category: 'Capacitación', real: 78, target: 85 },
]

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
            {entry.dataKey === 'real' ? 'Real' : 'Objetivo'}:
          </span>
          <span className="font-medium">{entry.value}%</span>
        </div>
      ))}
    </div>
  )
}

export const ComplianceChart: React.FC<ComplianceChartProps> = ({
  managerId: _managerId,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Calculate average compliance
  const avgCompliance = Math.round(
    MOCK_DATA.reduce((acc, d) => acc + d.real, 0) / MOCK_DATA.length
  )

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold">
            {t('playtelecom:managers.compliance', { defaultValue: 'Cumplimiento' })}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t('playtelecom:managers.complianceDesc', { defaultValue: 'Real vs Objetivo por categoría' })}
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">
            {avgCompliance}%
          </p>
          <p className="text-xs text-muted-foreground">Promedio</p>
        </div>
      </div>

      <div className="h-64">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={MOCK_DATA}
            margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
            barGap={4}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              opacity={0.5}
              vertical={false}
            />
            <XAxis
              dataKey="category"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }}
              domain={[0, 100]}
              tickFormatter={(value) => `${value}%`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => (
                <span className="text-xs text-muted-foreground">
                  {value === 'real' ? 'Real' : 'Objetivo'}
                </span>
              )}
            />
            <Bar
              dataKey="target"
              fill="hsl(var(--muted))"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
            <Bar
              dataKey="real"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            >
              {MOCK_DATA.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.real >= entry.target
                    ? 'hsl(var(--chart-2))'  // Green if meeting target
                    : 'hsl(var(--chart-1))'  // Primary if below
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  )
}

export default ComplianceChart
