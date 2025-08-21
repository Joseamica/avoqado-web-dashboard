import api from '@/api'

// ===== TYPES =====

export interface Notification {
  id: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  entityType?: string
  entityId?: string
  metadata?: any
  isRead: boolean
  readAt?: string
  priority: NotificationPriority
  channels: NotificationChannel[]
  sentAt?: string
  createdAt: string
  updatedAt: string
  recipient: {
    id: string
    firstName: string
    lastName: string
    email: string
  }
  venue?: {
    id: string
    name: string
    slug: string
  }
}

export interface NotificationPreference {
  id: string
  staffId: string
  venueId?: string
  type: NotificationType
  enabled: boolean
  channels: NotificationChannel[]
  priority: NotificationPriority
  quietStart?: string
  quietEnd?: string
  createdAt: string
  updatedAt: string
}

export interface NotificationFilters {
  isRead?: boolean
  type?: NotificationType
  priority?: NotificationPriority
  entityType?: string
  startDate?: string
  endDate?: string
}

export interface PaginationOptions {
  page?: number
  limit?: number
  sortBy?: 'createdAt' | 'updatedAt' | 'priority'
  sortOrder?: 'asc' | 'desc'
}

export interface NotificationsResponse {
  notifications: Notification[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
  unreadCount: number
}

export interface CreateNotificationDto {
  recipientId: string
  venueId?: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  entityType?: string
  entityId?: string
  metadata?: any
  priority?: NotificationPriority
  channels?: NotificationChannel[]
}

export interface BulkNotificationDto {
  recipientIds: string[]
  venueId?: string
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  priority?: NotificationPriority
}

export interface VenueNotificationDto {
  type: NotificationType
  title: string
  message: string
  actionUrl?: string
  actionLabel?: string
  priority?: NotificationPriority
  roles?: string[]
}

// Enums
export enum NotificationType {
  // Order notifications
  NEW_ORDER = 'NEW_ORDER',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_READY = 'ORDER_READY',
  ORDER_CANCELLED = 'ORDER_CANCELLED',

  // Payment notifications
  PAYMENT_RECEIVED = 'PAYMENT_RECEIVED',
  PAYMENT_FAILED = 'PAYMENT_FAILED',
  REFUND_PROCESSED = 'REFUND_PROCESSED',

  // Review notifications
  NEW_REVIEW = 'NEW_REVIEW',
  BAD_REVIEW = 'BAD_REVIEW',
  REVIEW_RESPONSE_NEEDED = 'REVIEW_RESPONSE_NEEDED',

  // Staff notifications
  SHIFT_REMINDER = 'SHIFT_REMINDER',
  SHIFT_ENDED = 'SHIFT_ENDED',
  NEW_STAFF_JOINED = 'NEW_STAFF_JOINED',

  // System notifications
  POS_DISCONNECTED = 'POS_DISCONNECTED',
  POS_RECONNECTED = 'POS_RECONNECTED',
  LOW_INVENTORY = 'LOW_INVENTORY',
  SYSTEM_MAINTENANCE = 'SYSTEM_MAINTENANCE',
  FEATURE_UPDATED = 'FEATURE_UPDATED',

  // Admin notifications
  VENUE_APPROVAL_NEEDED = 'VENUE_APPROVAL_NEEDED',
  VENUE_SUSPENDED = 'VENUE_SUSPENDED',
  HIGH_COMMISSION_ALERT = 'HIGH_COMMISSION_ALERT',
  REVENUE_MILESTONE = 'REVENUE_MILESTONE',

  // General
  ANNOUNCEMENT = 'ANNOUNCEMENT',
  REMINDER = 'REMINDER',
  ALERT = 'ALERT'
}

export enum NotificationPriority {
  LOW = 'LOW',
  NORMAL = 'NORMAL',
  HIGH = 'HIGH',
  URGENT = 'URGENT'
}

export enum NotificationChannel {
  IN_APP = 'IN_APP',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
  PUSH = 'PUSH',
  WEBHOOK = 'WEBHOOK'
}

// ===== API FUNCTIONS =====

/**
 * Get user notifications
 */
export async function getNotifications(
  filters: NotificationFilters = {},
  pagination: PaginationOptions = {}
): Promise<NotificationsResponse> {
  const params = {
    ...filters,
    ...pagination
  }

  const response = await api.get('/api/v1/dashboard/notifications', { params })
  return response.data.data
}

/**
 * Get unread notifications count
 */
export async function getUnreadCount(): Promise<{ count: number }> {
  const response = await api.get('/api/v1/dashboard/notifications/unread-count')
  return response.data.data
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId: string): Promise<Notification> {
  const response = await api.patch(`/api/v1/dashboard/notifications/${notificationId}/read`)
  return response.data.data
}

/**
 * Mark all notifications as read
 */
export async function markAllAsRead(): Promise<{ count: number }> {
  const response = await api.patch('/api/v1/dashboard/notifications/mark-all-read')
  return response.data.data
}

/**
 * Delete notification
 */
export async function deleteNotification(notificationId: string): Promise<void> {
  await api.delete(`/api/v1/dashboard/notifications/${notificationId}`)
}

/**
 * Get notification preferences
 */
export async function getPreferences(): Promise<NotificationPreference[]> {
  const response = await api.get('/api/v1/dashboard/notifications/preferences')
  return response.data.data
}

/**
 * Update notification preferences
 */
export async function updatePreferences(preference: {
  type: NotificationType
  enabled?: boolean
  channels?: NotificationChannel[]
  priority?: NotificationPriority
  quietStart?: string
  quietEnd?: string
}): Promise<NotificationPreference> {
  const response = await api.put('/api/v1/dashboard/notifications/preferences', preference)
  return response.data.data
}

/**
 * Get available notification types
 */
export async function getNotificationTypes(): Promise<{ types: Array<{ value: string; label: string }> }> {
  const response = await api.get('/api/v1/dashboard/notifications/types')
  return response.data.data
}

// ===== ADMIN FUNCTIONS =====

/**
 * Create a notification (admin only)
 */
export async function createNotification(data: CreateNotificationDto): Promise<Notification> {
  const response = await api.post('/api/v1/dashboard/notifications', data)
  return response.data.data
}

/**
 * Send bulk notifications (admin only)
 */
export async function sendBulkNotification(data: BulkNotificationDto): Promise<{
  sent: number
  notifications: Notification[]
}> {
  const response = await api.post('/api/v1/dashboard/notifications/bulk', data)
  return response.data.data
}

/**
 * Send notification to venue staff (admin only)
 */
export async function sendVenueNotification(
  venueId: string,
  data: VenueNotificationDto
): Promise<{
  sent: number
  notifications: Notification[]
}> {
  const response = await api.post(`/api/v1/dashboard/notifications/venue/${venueId}`, data)
  return response.data.data
}

// ===== UTILITY FUNCTIONS =====

/**
 * Format notification type for display (Spanish)
 */
export function formatNotificationType(type: NotificationType): string {
  const translations = {
    // Order notifications
    [NotificationType.NEW_ORDER]: 'Nuevo Pedido',
    [NotificationType.ORDER_UPDATED]: 'Pedido Actualizado',
    [NotificationType.ORDER_READY]: 'Pedido Listo',
    [NotificationType.ORDER_CANCELLED]: 'Pedido Cancelado',
    
    // Payment notifications
    [NotificationType.PAYMENT_RECEIVED]: 'Pago Recibido',
    [NotificationType.PAYMENT_FAILED]: 'Pago Fallido',
    [NotificationType.REFUND_PROCESSED]: 'Reembolso Procesado',
    
    // Review notifications
    [NotificationType.NEW_REVIEW]: 'Nueva Reseña',
    [NotificationType.BAD_REVIEW]: 'Reseña Negativa',
    [NotificationType.REVIEW_RESPONSE_NEEDED]: 'Respuesta de Reseña Requerida',
    
    // Staff notifications
    [NotificationType.SHIFT_REMINDER]: 'Recordatorio de Turno',
    [NotificationType.SHIFT_ENDED]: 'Turno Finalizado',
    [NotificationType.NEW_STAFF_JOINED]: 'Nuevo Personal Unido',
    
    // System notifications
    [NotificationType.POS_DISCONNECTED]: 'POS Desconectado',
    [NotificationType.POS_RECONNECTED]: 'POS Reconectado',
    [NotificationType.LOW_INVENTORY]: 'Inventario Bajo',
    [NotificationType.SYSTEM_MAINTENANCE]: 'Mantenimiento del Sistema',
    [NotificationType.FEATURE_UPDATED]: 'Función Actualizada',
    
    // Admin notifications
    [NotificationType.VENUE_APPROVAL_NEEDED]: 'Aprobación de Venue Requerida',
    [NotificationType.VENUE_SUSPENDED]: 'Venue Suspendido',
    [NotificationType.HIGH_COMMISSION_ALERT]: 'Alerta de Comisión Alta',
    [NotificationType.REVENUE_MILESTONE]: 'Hito de Ingresos',
    
    // General
    [NotificationType.ANNOUNCEMENT]: 'Anuncio',
    [NotificationType.REMINDER]: 'Recordatorio',
    [NotificationType.ALERT]: 'Alerta'
  }
  
  return translations[type] || type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
}

/**
 * Format notification priority for display (Spanish)
 */
export function formatNotificationPriority(priority: NotificationPriority): string {
  const translations = {
    [NotificationPriority.LOW]: 'Baja',
    [NotificationPriority.NORMAL]: 'Normal', 
    [NotificationPriority.HIGH]: 'Alta',
    [NotificationPriority.URGENT]: 'Urgente'
  }
  
  return translations[priority] || priority
}

/**
 * Get notification priority color
 */
export function getNotificationPriorityColor(priority: NotificationPriority): string {
  switch (priority) {
    case NotificationPriority.LOW:
      return 'text-muted-foreground'
    case NotificationPriority.NORMAL:
      return 'text-blue-500 dark:text-blue-400'
    case NotificationPriority.HIGH:
      return 'text-orange-500 dark:text-orange-400'
    case NotificationPriority.URGENT:
      return 'text-destructive'
    default:
      return 'text-muted-foreground'
  }
}

/**
 * Get notification priority icon
 */
export function getNotificationPriorityIcon(priority: NotificationPriority): string {
  switch (priority) {
    case NotificationPriority.LOW:
      return 'info'
    case NotificationPriority.NORMAL:
      return 'info'
    case NotificationPriority.HIGH:
      return 'warning'
    case NotificationPriority.URGENT:
      return 'alert-triangle'
    default:
      return 'info'
  }
}

/**
 * Format notification time
 */
export function formatNotificationTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diff = now.getTime() - date.getTime()

  // Less than 1 minute
  if (diff < 60000) {
    return 'Justo ahora'
  }

  // Less than 1 hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000)
    return `hace ${minutes} min`
  }

  // Less than 24 hours
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000)
    return `hace ${hours} h`
  }

  // Less than 7 days
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000)
    return `hace ${days} ${days === 1 ? 'día' : 'días'}`
  }

  // More than 7 days - show date
  return date.toLocaleDateString()
}

/**
 * Group notifications by date
 */
export function groupNotificationsByDate(notifications: Notification[]): Record<string, Notification[]> {
  const groups: Record<string, Notification[]> = {}

  notifications.forEach(notification => {
    const date = new Date(notification.createdAt)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    let groupKey: string

    if (date.toDateString() === today.toDateString()) {
      groupKey = 'Hoy'
    } else if (date.toDateString() === yesterday.toDateString()) {
      groupKey = 'Ayer'
    } else {
      groupKey = date.toLocaleDateString()
    }

    if (!groups[groupKey]) {
      groups[groupKey] = []
    }

    groups[groupKey].push(notification)
  })

  return groups
}