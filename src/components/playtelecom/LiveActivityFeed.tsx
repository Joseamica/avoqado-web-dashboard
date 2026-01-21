/**
 * LiveActivityFeed - Real-time activity stream
 *
 * Displays a scrollable feed of real-time events (sales, check-ins, alerts).
 * Items fade in with animation as they appear.
 *
 * Used in: index.html mockup (command center activity panel)
 * Design: Matches Avoqado glassmorphism with semantic colors
 */

import * as React from 'react'
import { cn } from '@/lib/utils'
import { DollarSign, BadgeCheck, MapPinOff, AlertTriangle, Clock } from 'lucide-react'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'

export type ActivityType = 'sale' | 'checkin' | 'gps_error' | 'alert' | 'other'
export type ActivitySeverity = 'normal' | 'warning' | 'error'

export interface ActivityItem {
  id: string
  type: ActivityType
  title: string
  subtitle: string // e.g., "Juan • Tienda Norte"
  timestamp: Date
  severity?: ActivitySeverity
}

export interface LiveActivityFeedProps {
  activities: ActivityItem[]
  className?: string
  maxHeight?: string // Tailwind height class (e.g., "h-64")
  showTimestamps?: boolean
  onViewAll?: () => void
}

/**
 * LiveActivityFeed Component
 *
 * @example
 * <LiveActivityFeed
 *   activities={liveActivities}
 *   maxHeight="h-96"
 *   showTimestamps
 *   onViewAll={() => navigate('/activity-log')}
 * />
 */
export function LiveActivityFeed({
  activities,
  className,
  maxHeight = 'h-80',
  showTimestamps = false,
  onViewAll,
}: LiveActivityFeedProps) {
  // Icon and color mapping
  const getActivityStyle = (
    type: ActivityType,
    severity?: ActivitySeverity
  ): { icon: React.ElementType; bgColor: string; textColor: string } => {
    if (severity === 'error') {
      return {
        icon: MapPinOff,
        bgColor: 'bg-red-100',
        textColor: 'text-red-600',
      }
    }

    if (severity === 'warning') {
      return {
        icon: AlertTriangle,
        bgColor: 'bg-orange-100',
        textColor: 'text-orange-600',
      }
    }

    switch (type) {
      case 'sale':
        return {
          icon: DollarSign,
          bgColor: 'bg-green-100',
          textColor: 'text-green-600',
        }
      case 'checkin':
        return {
          icon: BadgeCheck,
          bgColor: 'bg-blue-100',
          textColor: 'text-blue-600',
        }
      case 'gps_error':
        return {
          icon: MapPinOff,
          bgColor: 'bg-red-100',
          textColor: 'text-red-600',
        }
      case 'alert':
        return {
          icon: AlertTriangle,
          bgColor: 'bg-yellow-100',
          textColor: 'text-yellow-600',
        }
      default:
        return {
          icon: Clock,
          bgColor: 'bg-gray-100',
          textColor: 'text-gray-600',
        }
    }
  }

  if (activities.length === 0) {
    return (
      <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
        <Clock className="w-8 h-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground">No hay actividad reciente</p>
      </div>
    )
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {/* Header */}
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
          </span>
          Actividad
        </h3>
        {onViewAll && (
          <button
            onClick={onViewAll}
            className="text-[10px] text-primary font-bold hover:underline"
          >
            Ver Todo
          </button>
        )}
      </div>

      {/* Activity list */}
      <div className={cn('overflow-y-auto space-y-1', maxHeight)}>
        {activities.map((activity, index) => {
          const style = getActivityStyle(activity.type, activity.severity)
          const Icon = style.icon

          return (
            <div
              key={activity.id}
              className={cn(
                'flex gap-3 p-2.5 rounded-xl transition-all duration-300',
                'hover:bg-muted/50',
                activity.severity === 'error' && 'bg-red-50/50 border border-red-100',
                activity.severity === 'warning' && 'bg-orange-50/50 border border-orange-100',
                !activity.severity && 'hover:bg-muted/30'
              )}
              style={{
                animation: `fadeIn 0.5s ease-in-out ${index * 0.05}s both`,
              }}
            >
              {/* Icon */}
              <div
                className={cn(
                  'mt-1 size-7 rounded-full flex items-center justify-center shrink-0',
                  style.bgColor,
                  style.textColor
                )}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={cn(
                    'text-xs font-bold truncate',
                    activity.severity === 'error' ? 'text-red-600' : 'text-foreground'
                  )}
                >
                  {activity.title}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {activity.subtitle}
                </p>
                {showTimestamps && (
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {format(activity.timestamp, 'HH:mm:ss', { locale: es })}
                  </p>
                )}
              </div>
            </div>
          )
        })}
      </div>

      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateX(10px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
      `}</style>
    </div>
  )
}
