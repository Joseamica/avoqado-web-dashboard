/**
 * Utility functions for browser notifications
 */
import type { Notification as AvisoDeLista } from '@/services/notification.service'

/**
 * Request permission for browser notifications
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support notifications')
    return 'denied'
  }

  if (Notification.permission === 'granted') {
    return 'granted'
  }

  if (Notification.permission === 'denied') {
    return 'denied'
  }

  // Request permission
  const permission = await Notification.requestPermission()
  return permission
}

/**
 * Check if browser notifications are supported and permitted
 */
export function canShowNotifications(): boolean {
  return 'Notification' in window && Notification.permission === 'granted'
}

/**
 * Show a browser notification
 */
type BrowserNotificationAction = { action: string; title: string; icon?: string }

export function showBrowserNotification(
  title: string,
  options?: {
    body?: string
    icon?: string
    tag?: string
    silent?: boolean
    requireInteraction?: boolean
    actions?: BrowserNotificationAction[]
  }
): Notification | null {
  if (!canShowNotifications()) {
    return null
  }

  return new Notification(title, {
    icon: '/favicon.ico',
    ...options
  })
}

/**
 * Create notification options based on priority
 */
export function getNotificationOptions(priority: string): NotificationOptions {
  const baseOptions: NotificationOptions = {
    icon: '/favicon.ico',
    silent: false,
    requireInteraction: false
  }

  switch (priority) {
    case 'URGENT':
      return {
        ...baseOptions,
        requireInteraction: true,
        silent: false,
        tag: 'urgent'
      }
    case 'HIGH':
      return {
        ...baseOptions,
        requireInteraction: false,
        silent: false,
        tag: 'high'
      }
    case 'NORMAL':
      return {
        ...baseOptions,
        silent: false,
        tag: 'normal'
      }
    case 'LOW':
      return {
        ...baseOptions,
        silent: true,
        tag: 'low'
      }
    default:
      return baseOptions
  }
}

/**
 * Convierte el evento `notification_new` del SERVIDOR en una notificación de la lista. El evento trae `timestamp`
 * y no `createdAt` (D2, 4-nov: la campanita mostraba «Invalid DateTime»); sin id, null.
 */
export function avisoEnVivoANotificacion(evento: any): AvisoDeLista | null {
  const id = evento?.notificationId || evento?.id
  if (!id) return null
  const createdAt = evento.createdAt ?? (evento.timestamp ? new Date(evento.timestamp).toISOString() : new Date().toISOString())
  return { ...evento, id, createdAt }
}
