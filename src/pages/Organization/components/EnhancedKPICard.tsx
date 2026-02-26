import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Minus, type LucideIcon } from 'lucide-react'
import { useTranslation } from 'react-i18next'

interface EnhancedKPICardProps {
  title: string
  value: string | number
  change: number
  icon: LucideIcon
  color: string
  bgColor: string
  isLoading?: boolean
}

export function EnhancedKPICard({
  title,
  value,
  change,
  icon: Icon,
  color,
  bgColor,
  isLoading = false,
}: EnhancedKPICardProps) {
  const { t } = useTranslation('organization')

  if (isLoading) {
    return <Skeleton className="h-[120px] rounded-2xl" />
  }

  const TrendIcon = change > 0 ? TrendingUp : change < 0 ? TrendingDown : Minus
  const trendColor = change > 0 ? 'text-green-600 dark:text-green-400' : change < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'

  return (
    <GlassCard className="p-4 sm:p-5">
      <div className="flex items-start justify-between">
        <div className={cn('p-2 rounded-xl bg-gradient-to-br', bgColor)}>
          <Icon className={cn('h-4 w-4', color)} />
        </div>
      </div>
      <div className="mt-3">
        <p className="text-xl sm:text-2xl font-bold tracking-tight">{value}</p>
        <div className="flex items-center gap-1.5 mt-1">
          <div className={cn('flex items-center gap-0.5 text-xs font-medium px-1.5 py-0.5 rounded-full',
            change > 0 ? 'bg-green-100 dark:bg-green-900/30' : change < 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted',
            trendColor,
          )}>
            <TrendIcon className="h-3 w-3" />
            {change > 0 ? '+' : ''}{change.toFixed(1)}%
          </div>
          <span className="text-[11px] text-muted-foreground">{t('dashboard.vsLastPeriod')}</span>
        </div>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1.5">{title}</p>
      </div>
    </GlassCard>
  )
}
