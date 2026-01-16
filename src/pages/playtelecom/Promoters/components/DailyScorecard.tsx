/**
 * DailyScorecard - Today's performance metrics
 *
 * IMPORTANTE: Implementar con TPV
 * - Las ventas vienen de OrderItems creados en el TPV
 * - Las unidades vendidas vienen de OrderItems con productos serializados
 * - La comisión se calcula en base a CommissionRule del venue
 * - El progreso de meta requiere PerformanceGoal configurado por venue
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { GlassCard } from '@/components/ui/glass-card'
import {
  ShoppingCart,
  Package,
  DollarSign,
  Target,
  TrendingUp,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface DailyScorecardProps {
  metrics: {
    salesAmount: number
    unitsSold: number
    commission: number
    goalProgress: number // percentage 0-100
    vsYesterday?: number // percentage change
  }
  currency?: string
  className?: string
}

export const DailyScorecard: React.FC<DailyScorecardProps> = ({
  metrics,
  currency = 'MXN',
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency,
      minimumFractionDigits: 0,
    }).format(value)

  const scorecardItems = [
    {
      label: t('playtelecom:promoters.scorecard.sales', { defaultValue: 'Ventas Hoy' }),
      value: formatCurrency(metrics.salesAmount),
      icon: DollarSign,
      iconBg: 'from-green-500/20 to-green-500/5',
      iconColor: 'text-green-600 dark:text-green-400',
    },
    {
      label: t('playtelecom:promoters.scorecard.units', { defaultValue: 'Unidades' }),
      value: metrics.unitsSold.toString(),
      icon: Package,
      iconBg: 'from-blue-500/20 to-blue-500/5',
      iconColor: 'text-blue-600 dark:text-blue-400',
    },
    {
      label: t('playtelecom:promoters.scorecard.commission', { defaultValue: 'Comisión' }),
      value: formatCurrency(metrics.commission),
      icon: ShoppingCart,
      iconBg: 'from-purple-500/20 to-purple-500/5',
      iconColor: 'text-purple-600 dark:text-purple-400',
    },
    {
      label: t('playtelecom:promoters.scorecard.goal', { defaultValue: 'Meta Diaria' }),
      value: `${metrics.goalProgress}%`,
      icon: Target,
      iconBg: metrics.goalProgress >= 100
        ? 'from-green-500/20 to-green-500/5'
        : metrics.goalProgress >= 50
          ? 'from-yellow-500/20 to-yellow-500/5'
          : 'from-red-500/20 to-red-500/5',
      iconColor: metrics.goalProgress >= 100
        ? 'text-green-600 dark:text-green-400'
        : metrics.goalProgress >= 50
          ? 'text-yellow-600 dark:text-yellow-400'
          : 'text-red-600 dark:text-red-400',
    },
  ]

  return (
    <GlassCard className={cn('p-4', className)}>
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-sm">
          {t('playtelecom:promoters.scorecard.title', { defaultValue: 'Desempeño Hoy' })}
        </h4>
        {metrics.vsYesterday !== undefined && (
          <div className={cn(
            'flex items-center gap-1 text-xs font-medium',
            metrics.vsYesterday >= 0
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          )}>
            {metrics.vsYesterday >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5" />
            )}
            <span>{metrics.vsYesterday >= 0 ? '+' : ''}{metrics.vsYesterday}% vs ayer</span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {scorecardItems.map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-2 p-2 rounded-lg bg-muted/30"
          >
            <div className={cn(
              'p-1.5 rounded-lg bg-gradient-to-br shrink-0',
              item.iconBg
            )}>
              <item.icon className={cn('w-4 h-4', item.iconColor)} />
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground truncate">{item.label}</p>
              <p className="font-semibold text-sm">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Goal progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-muted-foreground">
            {t('playtelecom:promoters.scorecard.progress', { defaultValue: 'Progreso' })}
          </span>
          <span className="font-medium">{metrics.goalProgress}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full rounded-full transition-all duration-500',
              metrics.goalProgress >= 100
                ? 'bg-green-500'
                : metrics.goalProgress >= 50
                  ? 'bg-yellow-500'
                  : 'bg-red-500'
            )}
            style={{ width: `${Math.min(metrics.goalProgress, 100)}%` }}
          />
        </div>
      </div>
    </GlassCard>
  )
}

export default DailyScorecard
