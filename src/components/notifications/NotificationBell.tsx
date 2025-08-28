import React, { useState } from 'react'
import { Bell, X, Check, CheckCheck, MoreVertical } from 'lucide-react'
import { useNotificationBadge, useNotifications } from '@/context/NotificationContext'
import {
  formatNotificationTime,
  getNotificationPriorityColor,
  formatNotificationPriority,
  groupNotificationsByDate,
} from '@/services/notification.service'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'

interface NotificationBellProps {
  className?: string
}

export function NotificationBell({ className }: NotificationBellProps) {
  const { unreadCount, hasUnread } = useNotificationBadge()
  const { notifications, markAsRead, markAllAsRead, deleteNotification, refreshNotifications, loading } = useNotifications()

  const [isOpen, setIsOpen] = useState(false)

  const handleNotificationClick = async (notificationId: string, actionUrl?: string) => {
    await markAsRead(notificationId)

    if (actionUrl) {
      // Navigate to the action URL
      window.location.href = actionUrl
    }
  }

  const handleMarkAllAsRead = async () => {
    await markAllAsRead()
  }

  const handleDeleteNotification = async (notificationId: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await deleteNotification(notificationId)
  }

  const groupedNotifications = groupNotificationsByDate(notifications)

  return (
    <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className={`relative p-2 ${className}`}
          aria-label={`Notifications ${hasUnread ? `(${unreadCount} unread)` : ''}`}
        >
          <Bell className="h-5 w-5" />
          {hasUnread && (
            <Badge variant="destructive" className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
              {unreadCount > 99 ? '99+' : unreadCount}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent className="w-80 max-h-96" align="end" side="bottom" sideOffset={4}>
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border">
          <h3 className="font-semibold text-sm text-foreground">
            Notificaciones
            {hasUnread && (
              <Badge variant="secondary" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h3>
          <div className="flex items-center space-x-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={refreshNotifications}
              disabled={loading}
              className="h-6 w-6 p-0"
              title="Actualizar notificaciones"
            >
              <Bell className="h-3 w-3" />
            </Button>
            {hasUnread && (
              <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead} className="h-6 w-6 p-0" title="Marcar todas como leídas">
                <CheckCheck className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Notifications List */}
        <ScrollArea className="max-h-80">
          {notifications.length === 0 ? (
            <div className="p-6 text-center text-muted-foreground">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">Aún no hay notificaciones</p>
            </div>
          ) : (
            <div className="p-0">
              {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
                <div key={dateGroup}>
                  {/* Date Group Header */}
                  <div className="px-3 py-2 bg-muted border-b border-border">
                    <p className="text-xs font-medium text-muted-foreground">{dateGroup}</p>
                  </div>

                  {/* Notifications in Group */}
                  {groupNotifications.map(notification => (
                    <div
                      key={notification.id}
                      className={`
                        border-b border-border last:border-b-0 hover:bg-muted/50 cursor-pointer transition-colors
                        ${!notification.isRead ? 'bg-accent/50 border-l-4 border-l-primary' : ''}
                      `}
                      onClick={() => handleNotificationClick(notification.id, notification.actionUrl)}
                    >
                      <div className="p-3">
                        <div className="flex items-start justify-between space-x-2">
                          {/* Notification Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center space-x-2 mb-1">
                              <h4
                                className={`text-sm font-medium truncate ${
                                  !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                                }`}
                              >
                                {notification.title}
                              </h4>
                              <Badge variant="outline" className={`text-xs ${getNotificationPriorityColor(notification.priority)}`}>
                                {formatNotificationPriority(notification.priority)}
                              </Badge>
                            </div>

                            <p
                              className={`text-sm mb-2 line-clamp-2 ${!notification.isRead ? 'text-foreground' : 'text-muted-foreground'}`}
                            >
                              {notification.message}
                            </p>

                            <div className="flex items-center justify-between">
                              <span className="text-xs text-muted-foreground">{formatNotificationTime(notification.createdAt)}</span>

                              {notification.actionLabel && (
                                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium">{notification.actionLabel}</span>
                              )}
                            </div>
                          </div>

                          {/* Action Menu */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                                onClick={e => e.stopPropagation()}
                              >
                                <MoreVertical className="h-3 w-3" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {!notification.isRead && (
                                <DropdownMenuItem
                                  onClick={e => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                >
                                  <Check className="h-3 w-3 mr-2" />
                                  Marcar como leída
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem onClick={e => handleDeleteNotification(notification.id, e)} className="text-destructive">
                                <X className="h-3 w-3 mr-2" />
                                Eliminar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <div className="p-3 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            className="w-full"
            onClick={() => {
              setIsOpen(false)
              // Navigate to full notifications page - use current venue slug
              const currentPath = window.location.pathname
              const venueSlugMatch = currentPath.match(/\/venues\/([^/]+)/)
              const venueSlug = venueSlugMatch ? venueSlugMatch[1] : ''
              window.location.href = venueSlug ? `/venues/${venueSlug}/notifications` : '/notifications'
            }}
          >
            Ver todas las notificaciones
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default NotificationBell
