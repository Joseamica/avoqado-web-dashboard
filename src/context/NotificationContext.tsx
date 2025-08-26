import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import * as notificationService from '@/services/notification.service'
import { Notification, NotificationFilters, PaginationOptions } from '@/services/notification.service'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { showBrowserNotification, getNotificationOptions } from '@/utils/notification.utils'

// ===== TYPES =====

interface NotificationState {
  notifications: Notification[]
  unreadCount: number
  loading: boolean
  error: string | null
  filters: NotificationFilters
  pagination: PaginationOptions
}

interface NotificationContextType extends NotificationState {
  // Actions
  markAsRead: (id: string) => Promise<void>
  markAllAsRead: () => Promise<void>
  deleteNotification: (id: string) => Promise<void>
  setFilters: (filters: NotificationFilters) => void
  setPagination: (pagination: PaginationOptions) => void
  refreshNotifications: () => void
}

// ===== ACTION TYPES =====

type NotificationAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_NOTIFICATIONS'; payload: Notification[] }
  | { type: 'SET_UNREAD_COUNT'; payload: number }
  | { type: 'MARK_AS_READ'; payload: string }
  | { type: 'DELETE_NOTIFICATION'; payload: string }
  | { type: 'ADD_NOTIFICATION'; payload: Notification }
  | { type: 'SET_FILTERS'; payload: NotificationFilters }
  | { type: 'SET_PAGINATION'; payload: PaginationOptions }

// ===== REDUCER =====

const initialState: NotificationState = {
  notifications: [],
  unreadCount: 0,
  loading: false,
  error: null,
  filters: {},
  pagination: {
    page: 1,
    limit: 20,
    sortBy: 'createdAt',
    sortOrder: 'desc'
  }
}

function notificationReducer(state: NotificationState, action: NotificationAction): NotificationState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, loading: action.payload }

    case 'SET_ERROR':
      return { ...state, error: action.payload, loading: false }

    case 'SET_NOTIFICATIONS':
      return { ...state, notifications: action.payload, loading: false, error: null }

    case 'SET_UNREAD_COUNT':
      return { ...state, unreadCount: action.payload }

    case 'MARK_AS_READ':
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }

    case 'DELETE_NOTIFICATION':
      {
        const deletedNotification = state.notifications.find(n => n.id === action.payload)
        return {
          ...state,
          notifications: state.notifications.filter(notification => notification.id !== action.payload),
          unreadCount:
            deletedNotification && !deletedNotification.isRead
              ? Math.max(0, state.unreadCount - 1)
              : state.unreadCount,
        }
      }

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: [action.payload, ...state.notifications],
        unreadCount: action.payload.isRead ? state.unreadCount : state.unreadCount + 1
      }

    case 'SET_FILTERS':
      return { ...state, filters: action.payload }

    case 'SET_PAGINATION':
      return { ...state, pagination: { ...state.pagination, ...action.payload } }

    default:
      return state
  }
}

// ===== CONTEXT =====

const NotificationContext = createContext<NotificationContextType | undefined>(undefined)

// ===== PROVIDER =====

interface NotificationProviderProps {
  children: ReactNode
}

export function NotificationProvider({ children }: NotificationProviderProps) {
  const [state, dispatch] = useReducer(notificationReducer, initialState)
  const { socket, isConnected } = useSocket()
  const { isAuthenticated } = useAuth()

  // Fetch notifications
  const notificationsQuery = useQuery({
    queryKey: ['notifications', state.filters, state.pagination],
    queryFn: () => notificationService.getNotifications(state.filters, state.pagination),
    enabled: isAuthenticated,
    refetchInterval: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  })
  const { refetch } = notificationsQuery

  // Sync query results with local reducer state (v5-compatible)
  useEffect(() => {
    const data = notificationsQuery.data
    if (data) {
      dispatch({ type: 'SET_NOTIFICATIONS', payload: data.notifications })
      dispatch({ type: 'SET_UNREAD_COUNT', payload: data.unreadCount })
    }
  }, [notificationsQuery.data])

  useEffect(() => {
    if (notificationsQuery.error) {
      const err = notificationsQuery.error as any
      dispatch({ type: 'SET_ERROR', payload: err?.message || 'Failed to fetch notifications' })
    }
  }, [notificationsQuery.error])

  // Refetch once when socket connects or reconnects to sync any missed data
  useEffect(() => {
    if (isAuthenticated && isConnected) {
      refetch()
    }
  }, [isAuthenticated, isConnected, refetch])

  // Mark as read mutation
  const markAsReadMutation = useMutation({
    mutationFn: notificationService.markAsRead,
    onSuccess: (_, notificationId) => {
      dispatch({ type: 'MARK_AS_READ', payload: notificationId })
    },
    onError: (error: any) => {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to mark notification as read' })
    }
  })

  // Mark all as read mutation
  const markAllAsReadMutation = useMutation({
    mutationFn: notificationService.markAllAsRead,
    onSuccess: () => {
      dispatch({
        type: 'SET_NOTIFICATIONS',
        payload: state.notifications.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() }))
      })
      dispatch({ type: 'SET_UNREAD_COUNT', payload: 0 })
    },
    onError: (error: any) => {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to mark all notifications as read' })
    }
  })

  // Delete notification mutation
  const deleteNotificationMutation = useMutation({
    mutationFn: notificationService.deleteNotification,
    onSuccess: (_, notificationId) => {
      dispatch({ type: 'DELETE_NOTIFICATION', payload: notificationId })
    },
    onError: (error: any) => {
      dispatch({ type: 'SET_ERROR', payload: error.message || 'Failed to delete notification' })
    }
  })

  // Actions
  const markAsRead = async (id: string) => {
    await markAsReadMutation.mutateAsync(id)
  }

  const markAllAsRead = async () => {
    await markAllAsReadMutation.mutateAsync()
  }

  const deleteNotification = async (id: string) => {
    await deleteNotificationMutation.mutateAsync(id)
  }

  const setFilters = (filters: NotificationFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }

  const setPagination = (pagination: PaginationOptions) => {
    dispatch({ type: 'SET_PAGINATION', payload: pagination })
  }

  const refreshNotifications = () => {
    notificationsQuery.refetch()
  }

  // (Real-time additions are handled via socket effect below)

  // Context value
  const contextValue: NotificationContextType = {
    ...state,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilters,
    setPagination,
    refreshNotifications
  }

  // Listen for real-time notifications (Socket.IO integration)
  useEffect(() => {
    if (!socket || !isConnected) return

    // Listen for new notifications
    const handleNewNotification = (notification: Notification) => {
      console.log('Received new notification:', notification)
      dispatch({ type: 'ADD_NOTIFICATION', payload: notification })
      
      // Show browser notification with appropriate options based on priority
      const options = getNotificationOptions(notification.priority)
      showBrowserNotification(notification.title, {
        ...options,
        body: notification.message,
        tag: notification.id
      })
    }

    // Listen for notification updates (e.g., marked as read)
    const handleNotificationUpdate = (data: { id: string; isRead: boolean }) => {
      if (data.isRead) {
        dispatch({ type: 'MARK_AS_READ', payload: data.id })
      }
    }

    // Register socket listeners
    socket.on('notification_new', handleNewNotification)
    socket.on('notification:updated', handleNotificationUpdate)

    // Cleanup listeners on unmount
    return () => {
      socket.off('notification_new', handleNewNotification)
      socket.off('notification:updated', handleNotificationUpdate)
    }
  }, [socket, isConnected])

  return (
    <NotificationContext.Provider value={contextValue}>
      {children}
    </NotificationContext.Provider>
  )
}

// ===== HOOK =====

export function useNotifications(): NotificationContextType {
  const context = useContext(NotificationContext)
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider')
  }
  return context
}

// ===== ADDITIONAL HOOKS =====

/**
 * Hook for notification bell icon with unread count
 */
export function useNotificationBadge() {
  const { unreadCount } = useNotifications()

  return {
    unreadCount,
    hasUnread: unreadCount > 0
  }
}

/**
 * Hook for filtering notifications
 */
export function useNotificationFilters() {
  const { filters, setFilters, notifications } = useNotifications()

  const filterNotifications = (customFilters: NotificationFilters) => {
    setFilters(customFilters)
  }

  const clearFilters = () => {
    setFilters({})
  }

  return {
    filters,
    notifications,
    filterNotifications,
    clearFilters
  }
}