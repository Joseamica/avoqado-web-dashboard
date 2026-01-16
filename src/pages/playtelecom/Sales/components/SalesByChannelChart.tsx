/**
 * SalesByChannelChart - Bar chart showing sales breakdown by payment channel
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
  Cell,
} from 'recharts'
import { CreditCard, Banknote, Smartphone, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ChannelData {
  name: string
  value: number
  transactions: number
  color?: string
  icon?: 'cash' | 'card' | 'transfer' | 'bank'
}

interface SalesByChannelChartProps {
  data: ChannelData[]
  className?: string
}

// Default colors for channels
const CHANNEL_CONFIG: Record<string, { color: string; icon: React.ElementType }> = {
  Efectivo: { color: '#22c55e', icon: Banknote },
  Tarjeta: { color: '#3b82f6', icon: CreditCard },
  Transferencia: { color: '#8b5cf6', icon: Smartphone },
  Deposito: { color: '#f59e0b', icon: Building2 },
}

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
    const config = CHANNEL_CONFIG[data.name] || { color: '#6b7280', icon: CreditCard }
    const Icon = config.icon

    return (
      <div className="bg-background/95 backdrop-blur-sm border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4" style={{ color: config.color }} />
          <span className="font-medium text-sm">{data.name}</span>
        </div>
        <div className="space-y-1 text-sm">
          <p className="text-green-600 dark:text-green-400">
            {formatCurrency(data.value)}
          </p>
          <p className="text-muted-foreground">
            {data.transactions} transacciones
          </p>
        </div>
      </div>
    )
  }
  return null
}

export const SalesByChannelChart: React.FC<SalesByChannelChartProps> = ({
  data,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  // Enrich data with colors
  const enrichedData = data.map(item => ({
    ...item,
    color: item.color || CHANNEL_CONFIG[item.name]?.color || '#6b7280',
  }))

  return (
    <GlassCard className={cn('p-4', className)}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500/20 to-green-500/5">
          <CreditCard className="w-4 h-4 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <h4 className="font-medium text-sm">
            {t('playtelecom:sales.salesByChannel', { defaultValue: 'Ventas por Canal' })}
          </h4>
          <p className="text-xs text-muted-foreground">
            {t('playtelecom:sales.paymentMethods', { defaultValue: 'Métodos de pago' })}
          </p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-48">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={enrichedData}
            layout="vertical"
            margin={{ top: 5, right: 5, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal className="stroke-border/30" />
            <XAxis
              type="number"
              tickFormatter={v => `$${(v / 1000).toFixed(0)}k`}
              tick={{ fontSize: 10 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 11 }}
              className="text-muted-foreground"
              tickLine={false}
              axisLine={false}
              width={80}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              {enrichedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Legend with icons */}
      <div className="flex flex-wrap justify-center gap-4 mt-2 pt-2 border-t border-border/30">
        {enrichedData.map((item, index) => {
          const config = CHANNEL_CONFIG[item.name] || { icon: CreditCard }
          const Icon = config.icon
          return (
            <div key={index} className="flex items-center gap-1.5 text-xs">
              <Icon className="w-3.5 h-3.5" style={{ color: item.color }} />
              <span className="text-muted-foreground">{item.name}</span>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default SalesByChannelChart
