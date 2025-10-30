import { NotificationChannel, NotificationPriority, NotificationType } from '@/services/notification.service'

/**
 * Notification Category Configuration
 * Inspired by Stripe's notification preferences system
 */

export interface NotificationTypeMetadata {
  type: NotificationType
  defaultEnabled: boolean
  defaultChannels: NotificationChannel[]
  defaultPriority: NotificationPriority
  canDisable: boolean // Some critical notifications can't be disabled
  description: string
}

export interface NotificationCategory {
  id: string
  icon: string
  description: string
  types: NotificationTypeMetadata[]
}

/**
 * Notification Categories
 * Organized by business domain for better UX
 */
export const notificationCategories: NotificationCategory[] = [
  {
    id: 'orders',
    icon: 'ShoppingBag',
    description: 'Receive updates about order status, new orders, and cancellations',
    types: [
      {
        type: NotificationType.NEW_ORDER,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false, // Critical for operations
        description: 'Notified immediately when a new order is received',
      },
      {
        type: NotificationType.ORDER_UPDATED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Get updates when order details are modified',
      },
      {
        type: NotificationType.ORDER_READY,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Know when orders are ready for pickup or delivery',
      },
      {
        type: NotificationType.ORDER_CANCELLED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Receive alerts when orders are cancelled',
      },
    ],
  },
  {
    id: 'payments',
    icon: 'CreditCard',
    description: 'Stay informed about payment transactions, refunds, and failures',
    types: [
      {
        type: NotificationType.PAYMENT_RECEIVED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Receive confirmation when payments are successfully processed',
      },
      {
        type: NotificationType.PAYMENT_FAILED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Get immediately notified of failed payment attempts',
      },
      {
        type: NotificationType.REFUND_PROCESSED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Know when refunds have been successfully processed',
      },
    ],
  },
  {
    id: 'reviews',
    icon: 'Star',
    description: 'Monitor customer feedback, reviews, and ratings',
    types: [
      {
        type: NotificationType.NEW_REVIEW,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Be notified when customers leave new reviews',
      },
      {
        type: NotificationType.BAD_REVIEW,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Get urgent alerts for low-rated reviews (1-2 stars)',
      },
      {
        type: NotificationType.REVIEW_RESPONSE_NEEDED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Reminders for reviews that need your response',
      },
    ],
  },
  {
    id: 'staff',
    icon: 'Users',
    description: 'Manage staff schedules, shifts, and team updates',
    types: [
      {
        type: NotificationType.SHIFT_REMINDER,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Receive reminders before your scheduled shifts',
      },
      {
        type: NotificationType.SHIFT_ENDED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.LOW,
        canDisable: true,
        description: 'Know when your shift has officially ended',
      },
      {
        type: NotificationType.NEW_STAFF_JOINED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.LOW,
        canDisable: true,
        description: 'Be informed when new team members join',
      },
    ],
  },
  {
    id: 'system',
    icon: 'Settings',
    description: 'System health, POS connection, and inventory alerts',
    types: [
      {
        type: NotificationType.POS_DISCONNECTED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.URGENT,
        canDisable: false,
        description: 'Critical alerts when POS terminal disconnects',
      },
      {
        type: NotificationType.POS_RECONNECTED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Confirmation when POS terminal reconnects',
      },
      {
        type: NotificationType.LOW_INVENTORY,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: true,
        description: 'Alerts when inventory levels fall below threshold',
      },
      {
        type: NotificationType.SYSTEM_MAINTENANCE,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Important system maintenance notifications',
      },
      {
        type: NotificationType.FEATURE_UPDATED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.LOW,
        canDisable: true,
        description: 'Updates about new features and improvements',
      },
    ],
  },
  {
    id: 'admin',
    icon: 'Shield',
    description: 'Administrative alerts for managers and owners only',
    types: [
      {
        type: NotificationType.VENUE_APPROVAL_NEEDED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: false,
        description: 'Approval requests for venue operations',
      },
      {
        type: NotificationType.VENUE_SUSPENDED,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL, NotificationChannel.SMS],
        defaultPriority: NotificationPriority.URGENT,
        canDisable: false,
        description: 'Critical alerts when venue is suspended',
      },
      {
        type: NotificationType.HIGH_COMMISSION_ALERT,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: true,
        description: 'Alerts for unusually high commission charges',
      },
      {
        type: NotificationType.REVENUE_MILESTONE,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Celebrate when revenue milestones are reached',
      },
    ],
  },
  {
    id: 'general',
    icon: 'Bell',
    description: 'General announcements, reminders, and alerts',
    types: [
      {
        type: NotificationType.ANNOUNCEMENT,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Platform-wide announcements and news',
      },
      {
        type: NotificationType.REMINDER,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP, NotificationChannel.PUSH],
        defaultPriority: NotificationPriority.NORMAL,
        canDisable: true,
        description: 'Custom reminders and scheduled notifications',
      },
      {
        type: NotificationType.ALERT,
        defaultEnabled: true,
        defaultChannels: [NotificationChannel.IN_APP],
        defaultPriority: NotificationPriority.HIGH,
        canDisable: true,
        description: 'General alerts requiring your attention',
      },
    ],
  },
]

/**
 * Get category by ID
 */
export function getCategoryById(categoryId: string): NotificationCategory | undefined {
  return notificationCategories.find(cat => cat.id === categoryId)
}

/**
 * Get all notification types across all categories
 */
export function getAllNotificationTypes(): NotificationTypeMetadata[] {
  return notificationCategories.flatMap(category => category.types)
}

/**
 * Get metadata for a specific notification type
 */
export function getNotificationMetadata(type: NotificationType): NotificationTypeMetadata | undefined {
  return getAllNotificationTypes().find(meta => meta.type === type)
}

/**
 * Get category that contains a specific notification type
 */
export function getCategoryForType(type: NotificationType): NotificationCategory | undefined {
  return notificationCategories.find(category => category.types.some(t => t.type === type))
}
