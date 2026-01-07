import * as React from 'react'
import { cn } from '@/lib/utils'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ArrowUpRight } from 'lucide-react'
import { GlassCard } from './glass-card'

export interface MetricCardProps {
  label: string
  value: string | number
  subValue?: string
  icon: React.ReactNode
  trend?: 'up' | 'down' | 'neutral'
  accent?: 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'yellow'
  tooltip?: string
  className?: string
  onClick?: () => void
}

/**
 * MetricCard - Bento grid metric display
 *
 * Modern metric card for displaying KPIs and statistics.
 * Designed for use in bento grid layouts.
 *
 * @example
 * <MetricCard
 *   label="Online Terminals"
 *   value="5"
 *   icon={<Wifi className="w-4 h-4" />}
 *   accent="green"
 *   trend="up"
 * />
 */
const MetricCard: React.FC<MetricCardProps> = ({ label, value, subValue, icon, trend, accent = 'blue', tooltip, className, onClick }) => {
  const accentColors = {
    green: 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400',
    blue: 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400',
    purple: 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400',
    orange: 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400',
    red: 'from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400',
    yellow: 'from-yellow-500/20 to-yellow-500/5 text-yellow-600 dark:text-yellow-400',
  }

  const content = (
    <GlassCard className={cn('p-3 sm:p-4 h-full', className)} hover={!!onClick} onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className={cn('p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gradient-to-br', accentColors[accent])}>{icon}</div>
        {trend && (
          <div
            className={cn(
              'flex items-center gap-0.5 text-xs font-medium',
              trend === 'up' && 'text-green-600',
              trend === 'down' && 'text-red-600',
            )}
          >
            <ArrowUpRight className={cn('w-3 h-3', trend === 'down' && 'rotate-90')} />
          </div>
        )}
      </div>
      <div className="mt-2 sm:mt-3">
        <p className="text-lg sm:text-xl font-bold tracking-tight truncate">{value}</p>
        {subValue && <p className="text-xs text-muted-foreground mt-0.5">{subValue}</p>}
        <p className="text-xs sm:text-sm text-muted-foreground mt-0.5 sm:mt-1">{label}</p>
      </div>
    </GlassCard>
  )

  if (tooltip) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{content}</TooltipTrigger>
        <TooltipContent>
          <p className="max-w-xs text-sm">{tooltip}</p>
        </TooltipContent>
      </Tooltip>
    )
  }

  return content
}

export { MetricCard }
