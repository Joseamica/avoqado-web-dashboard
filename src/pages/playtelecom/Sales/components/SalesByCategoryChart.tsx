/**
 * SalesByCategoryChart - Donut chart showing sales breakdown by category
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Legend,
  Tooltip,
} from 'recharts'
import { Package } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CategoryData {
  name: string
  value: number
  units: number
  color: string
}

interface SalesByCategoryChartProps {
  data: CategoryData[]
  className?: string
}

// Default colors for categories
const DEFAULT_COLORS = [
  '#22c55e', // green
  '#3b82f6', // blue
  '#f59e0b', // amber
  '#ef4444', // red
  '#8b5cf6', // violet
  '#ec4899', // pink
]

// Format currency
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('es-MX', {
    style: 'currency',
    currency: 'MXN',
    minimumFractionDigits: 0,
  }).format(value)

// Custom tooltip
const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <span
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-medium text-sm">{data.name}</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-green-600 dark:text-green-400">
            {formatCurrency(data.value)}
          </p>
          <p className="text-muted-foreground">{data.units} unidades</p>
        </div>
      </div>
    )
  }
  return null
}

// Custom legend
const CustomLegend = ({ payload }: any) => {
  return (
    <div className="flex flex-wrap justify-center gap-3 mt-2">
      {payload?.map((entry: any, index: number) => (
        <div key={index} className="flex items-center gap-1.5 text-xs">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-muted-foreground">{entry.value}</span>
        </div>
      ))}
    </div>
  )
}

export const SalesByCategoryChart: React.FC<SalesByCategoryChartProps> = ({
  data,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Add default colors if not provided
  const dataWithColors = data.map((item, index) => ({
    ...item,
    color: item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
  }))

  // Calculate total
  const total = data.reduce((sum, item) => sum + item.value, 0)

  return (
    <GlassCard className={cn('p-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-purple-500/20 to-purple-500/5">
          <Package className="w-4 h-4 text-purple-600 dark:text-purple-400" />
        </div>
        <div>
          <h4 className="font-medium text-sm">
            {t('playtelecom:sales.salesByCategory', { defaultValue: 'Ventas por Categoría' })}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('playtelecom:sales.totalCategories', {
              defaultValue: '{{count}} categorías',
              count: data.length,
            })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48 relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={dataWithColors}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
            >
              {dataWithColors.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />
          </PieChart>
        </ResponsiveContainer>

        {/* Center label */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center -mt-6">
            <p className="text-lg font-bold">{formatCurrency(total)}</p>
            <p className="text-[10px] text-muted-foreground">Total</p>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

export default SalesByCategoryChart
