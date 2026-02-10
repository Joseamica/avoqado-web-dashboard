/**
 * OperationalInsights - Anomaly alerts and operational insights
 *
 * Shows:
 * - Alert severity indicators (warning, info, success)
 * - Anomaly descriptions
 * - Quick action suggestions
 */

import React from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Info,
  Package,
  Users,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getAnomalies, type Anomaly } from '@/services/commandCenter.service'

type InsightSeverity = 'warning' | 'info' | 'success' | 'critical'
type InsightIcon = 'trend_up' | 'trend_down' | 'stock' | 'users' | 'time' | 'alert'

interface Insight {
  id: string
  severity: InsightSeverity
  title: string
  description: string
  icon: InsightIcon
  timestamp?: string
}

interface OperationalInsightsProps {
  className?: string
}

// Map anomaly type to icon
const getIconForType = (type: Anomaly['type']): InsightIcon => {
  switch (type) {
    case 'LOW_PERFORMANCE':
      return 'trend_down'
    case 'NO_CHECKINS':
      return 'time'
    case 'LOW_STOCK':
      return 'stock'
    case 'PENDING_DEPOSITS':
      return 'users'
    case 'GPS_VIOLATION':
      return 'alert'
    default:
      return 'alert'
  }
}

// Map anomaly severity to insight severity
const mapSeverity = (severity: Anomaly['severity']): InsightSeverity => {
  switch (severity) {
    case 'CRITICAL':
      return 'critical'
    case 'WARNING':
      return 'warning'
    case 'INFO':
    default:
      return 'info'
  }
}

const getSeverityStyles = (severity: InsightSeverity) => {
  switch (severity) {
    case 'warning':
      return {
        bg: 'bg-yellow-500/10 border-yellow-500/20',
        text: 'text-yellow-600 dark:text-yellow-400',
        icon: 'from-yellow-500/20 to-yellow-500/5',
      }
    case 'success':
      return {
        bg: 'bg-green-500/10 border-green-500/20',
        text: 'text-green-600 dark:text-green-400',
        icon: 'from-green-500/20 to-green-500/5',
      }
    case 'critical':
      return {
        bg: 'bg-red-500/10 border-red-500/20',
        text: 'text-red-600 dark:text-red-400',
        icon: 'from-red-500/20 to-red-500/5',
      }
    case 'info':
    default:
      return {
        bg: 'bg-blue-500/10 border-blue-500/20',
        text: 'text-blue-600 dark:text-blue-400',
        icon: 'from-blue-500/20 to-blue-500/5',
      }
  }
}

const getInsightIcon = (iconType: Insight['icon'], className: string) => {
  switch (iconType) {
    case 'trend_up':
      return <TrendingUp className={className} />
    case 'trend_down':
      return <TrendingDown className={className} />
    case 'stock':
      return <Package className={className} />
    case 'users':
      return <Users className={className} />
    case 'time':
      return <Clock className={className} />
    case 'alert':
    default:
      return <AlertTriangle className={className} />
  }
}

const _getSeverityIcon = (severity: InsightSeverity, className: string) => {
  switch (severity) {
    case 'warning':
      return <AlertTriangle className={className} />
    case 'success':
      return <CheckCircle2 className={className} />
    case 'critical':
      return <AlertTriangle className={className} />
    case 'info':
    default:
      return <Info className={className} />
  }
}

export const OperationalInsights: React.FC<OperationalInsightsProps> = ({
  className,
}) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId } = useCurrentVenue()

  // Fetch anomalies from API
  const { data, isLoading } = useQuery({
    queryKey: ['commandCenter', 'anomalies', venueId],
    queryFn: () => getAnomalies(venueId!),
    enabled: !!venueId,
    refetchInterval: 60000, // Refresh every minute
  })

  // Map API anomalies to component insights
  const insights: Insight[] = (data?.anomalies || []).map(anomaly => ({
    id: anomaly.id,
    severity: mapSeverity(anomaly.severity),
    title: anomaly.title,
    description: anomaly.description,
    icon: getIconForType(anomaly.type),
    timestamp: anomaly.timestamp,
  }))

  if (isLoading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {t('playtelecom:commandCenter.insights', { defaultValue: 'Alertas' })}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('playtelecom:commandCenter.requiresAttention', { defaultValue: 'Requieren atención' })}
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {insights.length > 0 ? (
          insights.map((insight) => {
            const styles = getSeverityStyles(insight.severity)

            return (
              <div
                key={insight.id}
                className={cn(
                  'p-3 rounded-xl border transition-colors hover:opacity-90 cursor-pointer',
                  styles.bg
                )}
              >
                <div className="flex items-start gap-3">
                  <div className={cn(
                    'p-1.5 rounded-lg bg-gradient-to-br shrink-0',
                    styles.icon,
                    styles.text
                  )}>
                    {getInsightIcon(insight.icon, 'w-4 h-4')}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className={cn('text-sm font-medium', styles.text)}>
                        {insight.title}
                      </p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {insight.description}
                    </p>
                  </div>
                </div>
              </div>
            )
          })
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {t('playtelecom:commandCenter.noAlerts', { defaultValue: 'Sin alertas pendientes' })}
          </p>
        )}
      </div>
    </GlassCard>
  )
}

export default OperationalInsights
