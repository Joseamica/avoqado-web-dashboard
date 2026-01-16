/**
 * ActivityFeed - Real-time transaction feed
 *
 * Shows recent transactions with:
 * - Transaction type icon
 * - Product/promoter info
 * - Timestamp (relative)
 * - Amount
 */

import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { GlassCard } from '@/components/ui/glass-card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  ShoppingCart,
  CreditCard,
  Package,
  Clock,
  AlertTriangle,
  LogIn,
  LogOut,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getActivityFeed, type ActivityItem } from '@/services/commandCenter.service'
import { formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

interface ActivityFeedProps {
  className?: string
}

const getActivityIcon = (type: ActivityItem['type']) => {
  switch (type) {
    case 'SALE':
      return <ShoppingCart className="w-4 h-4" />
    case 'DEPOSIT':
      return <CreditCard className="w-4 h-4" />
    case 'REGISTRATION':
      return <Package className="w-4 h-4" />
    case 'CLOCK_IN':
      return <LogIn className="w-4 h-4" />
    case 'CLOCK_OUT':
      return <LogOut className="w-4 h-4" />
    case 'ALERT':
      return <AlertTriangle className="w-4 h-4" />
    default:
      return <Clock className="w-4 h-4" />
  }
}

const getActivityColor = (type: ActivityItem['type']) => {
  switch (type) {
    case 'SALE':
      return 'from-green-500/20 to-green-500/5 text-green-600 dark:text-green-400'
    case 'DEPOSIT':
      return 'from-blue-500/20 to-blue-500/5 text-blue-600 dark:text-blue-400'
    case 'REGISTRATION':
      return 'from-purple-500/20 to-purple-500/5 text-purple-600 dark:text-purple-400'
    case 'CLOCK_IN':
    case 'CLOCK_OUT':
      return 'from-orange-500/20 to-orange-500/5 text-orange-600 dark:text-orange-400'
    case 'ALERT':
      return 'from-red-500/20 to-red-500/5 text-red-600 dark:text-red-400'
    default:
      return 'from-gray-500/20 to-gray-500/5 text-gray-600 dark:text-gray-400'
  }
}

export const ActivityFeed: React.FC<ActivityFeedProps> = ({ className }) => {
  const { t } = useTranslation(['playtelecom', 'common'])
  const { venueId, venue } = useCurrentVenue()

  // Format relative time for activity timestamps
  const formatRelativeTime = (timestamp: string) => {
    return formatDistanceToNow(new Date(timestamp), { addSuffix: true, locale: es })
  }

  // Fetch activity feed
  const { data, isLoading } = useQuery({
    queryKey: ['commandCenter', 'activity', venueId],
    queryFn: () => getActivityFeed(venueId!, { limit: 15 }),
    enabled: !!venueId,
    refetchInterval: 30000, // Refresh every 30 seconds
  })

  const formatCurrency = useMemo(
    () =>
      (amount: number) =>
        new Intl.NumberFormat('es-MX', {
          style: 'currency',
          currency: venue?.currency || 'MXN',
          minimumFractionDigits: 0,
        }).format(amount),
    [venue?.currency]
  )

  const activities = data?.activities || []

  if (isLoading) {
    return (
      <GlassCard className={cn('p-6', className)}>
        <div className="flex items-center justify-between mb-4">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-20" />
        </div>
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </GlassCard>
    )
  }

  return (
    <GlassCard className={cn('p-6', className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">
          {t('playtelecom:commandCenter.activityFeed', { defaultValue: 'Actividad Reciente' })}
        </h3>
        <span className="text-xs text-muted-foreground">
          {t('common:realtime', { defaultValue: 'Tiempo real' })}
        </span>
      </div>

      <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2">
        {activities.length > 0 ? (
          activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
            >
              <div
                className={cn(
                  'p-2 rounded-lg bg-gradient-to-br shrink-0',
                  getActivityColor(activity.type)
                )}
              >
                {getActivityIcon(activity.type)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{activity.description}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {activity.promoterName && `${activity.promoterName} - `}
                  {activity.storeName || ''}
                </p>
              </div>
              <div className="text-right shrink-0">
                {activity.amount && (
                  <p className="font-semibold text-sm text-green-600 dark:text-green-400">
                    {formatCurrency(activity.amount)}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {formatRelativeTime(activity.timestamp)}
                </p>
              </div>
            </div>
          ))
        ) : (
          <p className="text-center text-muted-foreground py-8">
            {t('playtelecom:commandCenter.noActivity', { defaultValue: 'Sin actividad reciente' })}
          </p>
        )}
      </div>
    </GlassCard>
  )
}

export default ActivityFeed
