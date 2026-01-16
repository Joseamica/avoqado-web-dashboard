/**
 * LowStockAlerts - Alert list for low stock items
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertTriangle,
  Package,
  ArrowRight,
  Bell,
  TrendingDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getStockAlerts, type StockAlert as APIStockAlert } from '@/services/stockDashboard.service'

type AlertLevel = 'critical' | 'warning' | 'info'

interface StockAlertDisplay {
  id: string
  productName: string
  currentStock: number
  minStock: number
  level: AlertLevel
}

interface LowStockAlertsProps {
  onRequestStock?: (productId: string) => void
  className?: string
}

const LEVEL_CONFIG: Record<AlertLevel, {
  color: string
  bgColor: string
  borderColor: string
  label: string
}> = {
  critical: {
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
    borderColor: 'border-red-500/30',
    label: 'Crítico',
  },
  warning: {
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10',
    borderColor: 'border-yellow-500/30',
    label: 'Bajo',
  },
  info: {
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-500/10',
    borderColor: 'border-blue-500/30',
    label: 'Normal',
  },
}

// Map API alert level to UI alert level
const mapAlertLevel = (level: APIStockAlert['alertLevel']): AlertLevel => {
  switch (level) {
    case 'CRITICAL':
      return 'critical'
    case 'WARNING':
      return 'warning'
    default:
      return 'info'
  }
}

export const LowStockAlerts: React.FC<LowStockAlertsProps> = ({
  onRequestStock,
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()

  // Fetch stock alerts
  const { data: alertsData, isLoading } = useQuery({
    queryKey: ['stock', 'alerts', venueId],
    queryFn: () => getStockAlerts(venueId!),
    enabled: !!venueId,
  })

  // Map API data to display format
  const alerts: StockAlertDisplay[] = useMemo(() => {
    if (!alertsData?.alerts) return []
    return alertsData.alerts.map(alert => ({
      id: alert.categoryId,
      productName: alert.categoryName,
      currentStock: alert.currentStock,
      minStock: alert.minimumStock,
      level: mapAlertLevel(alert.alertLevel),
    }))
  }, [alertsData])

  const criticalCount = alerts.filter(a => a.level === 'critical').length
  const warningCount = alerts.filter(a => a.level === 'warning').length

  if (isLoading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-32" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16" />
            <Skeleton className="h-5 w-12" />
          </div>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-lg font-semibold">
            {t('playtelecom:stock.alerts.title', { defaultValue: 'Alertas de Stock' })}
          </h3>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <Badge variant="destructive" className="text-xs">
              {criticalCount} {t('playtelecom:stock.alerts.critical', { defaultValue: 'críticos' })}
            </Badge>
          )}
          {warningCount > 0 && (
            <Badge variant="secondary" className="text-xs bg-yellow-500/10 text-yellow-600">
              {warningCount} {t('playtelecom:stock.alerts.low', { defaultValue: 'bajos' })}
            </Badge>
          )}
        </div>
      </div>

      {alerts.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">
            {t('playtelecom:stock.alerts.noAlerts', { defaultValue: 'Sin alertas de stock' })}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {alerts.map((alert) => {
            const config = LEVEL_CONFIG[alert.level]

            return (
              <div
                key={alert.id}
                className={cn(
                  'p-4 rounded-xl border transition-colors',
                  config.bgColor,
                  config.borderColor
                )}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'p-2 rounded-lg shrink-0',
                      alert.level === 'critical' ? 'bg-red-500/20' :
                      alert.level === 'warning' ? 'bg-yellow-500/20' : 'bg-blue-500/20'
                    )}>
                      {alert.level === 'critical' ? (
                        <AlertTriangle className={cn('w-4 h-4', config.color)} />
                      ) : (
                        <TrendingDown className={cn('w-4 h-4', config.color)} />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-sm">{alert.productName}</p>
                        <Badge variant="outline" className={cn('text-xs', config.color)}>
                          {config.label}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>
                          Stock: <strong className={config.color}>{alert.currentStock}</strong>/{alert.minStock} mín
                        </span>
                      </div>
                    </div>
                  </div>
                  {onRequestStock && alert.level !== 'info' && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="shrink-0"
                      onClick={() => onRequestStock(alert.id)}
                    >
                      <span>{t('playtelecom:stock.alerts.request', { defaultValue: 'Solicitar' })}</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </Button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </GlassCard>
  )
}

export default LowStockAlerts
