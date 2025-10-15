import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Bell } from 'lucide-react'
import { useNotificationBadge, useNotifications } from '@/context/NotificationContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { formatNotificationTime } from '@/services/notification.service'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount, hasUnread } = useNotificationBadge()
  const { notifications, markAsRead, loading } = useNotifications()
  const { t } = useTranslation()
  const { venueSlug } = useCurrentVenue()

  const [isOpen, setIsOpen] = useState(false)

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead(notificationId)

    if (actionUrl) {
      // Handle absolute URLs (http/https) and relative URLs differently
      if (actionUrl.startsWith('http')) {
        window.location.href = actionUrl
      } else {
        // Prepend venue slug to relative URLs
        window.location.href = `/venues/${venueSlug}${actionUrl}`
      }
    }
  }

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative p-2 ${className}`}
          aria-label={hasUnread ? t('dashboard.notifications.bell_with_unread', { count: unreadCount }) : t('dashboard.notifications.bell')}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-80 p-0">
        {/* Header */}
        <div className="p-4 border-b border-border">
          <h3 className="font-semibold text-foreground">{t('dashboard.notifications.title')}</h3>
          <p className="text-sm text-muted-foreground">
            {hasUnread ? t('dashboard.notifications.unread_count', { count: unreadCount }) : t('dashboard.notifications.none')}
          </p>
        </div>

        {/* Notifications List */}
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="p-3 space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full mt-2 bg-muted animate-pulse" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/2 bg-muted rounded animate-pulse" />
                    <div className="h-3 w-1/4 bg-muted rounded animate-pulse" />
                  </div>
                </div>
              ))}
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-muted-foreground">{t('dashboard.notifications.none')}</p>
            </div>
          ) : (
            notifications.map((notification, index) => (
              <div 
                key={notification.id} 
                className={`p-3 hover:bg-accent cursor-pointer ${index < notifications.length - 1 ? 'border-b border-border' : ''}`}
                onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
              >
                <div className="flex items-start space-x-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-2 ${
                      notification.priority === 'HIGH'
                        ? 'bg-red-500'
                        : notification.priority === 'NORMAL'
                          ? 'bg-amber-500'
                          : 'bg-blue-500'
                    }`}
                  />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-foreground">{notification.title}</p>
                    <p className="text-xs text-muted-foreground">{notification.message}</p>
                    <p className="text-xs text-muted-foreground mt-1">{formatNotificationTime(notification.createdAt)}</p>
                    {notification.actionLabel && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 font-medium mt-1">{notification.actionLabel}</p>
                    )}
                  </div>
                  {!notification.isRead && (
                    <div className="w-2 h-2 bg-red-500 rounded-full" title={t('dashboard.notifications.unread')} />
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button 
            variant="ghost" 
            className="w-full text-sm text-muted-foreground hover:text-foreground"
            onClick={() => {
              setIsOpen(false)
              // Navigate to full notifications page - use current venue slug
              const currentPath = window.location.pathname
              const venueSlugMatch = currentPath.match(/\/venues\/([^/]+)/)
              const venueSlug = venueSlugMatch ? venueSlugMatch[1] : ''
              window.location.href = venueSlug ? `/venues/${venueSlug}/notifications` : '/notifications'
            }}
          >
            {t('dashboard.notifications.view_all')}
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
