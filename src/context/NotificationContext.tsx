import React, { createContext, useContext, useReducer, useEffect, useRef, ReactNode, useCallback } from 'react'
import { matchPath, useLocation } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import * as notificationService from '@/services/notification.service'
import { Notification, NotificationFilters, PaginationOptions } from '@/services/notification.service'
import { useSocket } from '@/context/SocketContext'
import { useAuth } from '@/context/AuthContext'
import { showBrowserNotification, getNotificationOptions, avisoEnVivoANotificacion } from '@/utils/notification.utils'
import type { EstadoDeCarga } from '@/lib/falloDeCarga'

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
  /** El negocio de la campana (el de la URL). Sin él (pantallas de organización) la campana junta los avisos de todos. */
  venueId: string | undefined
  /** La lectura de la lista. `error` no sirve para saber si llegó: también lo escriben las mutaciones, y sin internet no se llena. */
  lecturaDeNotificaciones: EstadoDeCarga & { data: unknown }
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
  | { type: 'RESET' }
  | { type: 'MARK_ALL_READ' }

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

    case 'RESET':
      return { ...state, notifications: [], unreadCount: 0, loading: false, error: null }

    case 'MARK_ALL_READ':
      return {
        ...state,
        notifications: state.notifications.map(n => ({ ...n, isRead: true, readAt: new Date().toISOString() })),
        unreadCount: 0,
      }

    case 'MARK_AS_READ': {
      // Sólo resta si el aviso está en ESTA lista y estaba sin leer: una respuesta tardía de otro negocio no baja este contador.
      const objetivo = state.notifications.find(n => n.id === action.payload)
      if (!objetivo || objetivo.isRead) return state
      return {
        ...state,
        notifications: state.notifications.map(notification =>
          notification.id === action.payload
            ? { ...notification, isRead: true, readAt: new Date().toISOString() }
            : notification
        ),
        unreadCount: Math.max(0, state.unreadCount - 1)
      }
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
      // BUG #7 FIX: Deduplication - prevents duplicate notifications if socket re-emits
      // This follows Square's idempotency pattern where event_id prevents duplicates
      if (state.notifications.some(n => n.id === action.payload.id)) {
        return state
      }
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
  const { isAuthenticated, allVenues } = useAuth()

  // Este provider está por ENCIMA del Outlet: useParams no ve `:slug`. Se saca de la ruta (normal y marca blanca).
  const { pathname } = useLocation()
  const slug =
    matchPath('/venues/:slug/*', pathname)?.params.slug ?? matchPath('/wl/venues/:slug/*', pathname)?.params.slug
  const venueId = slug ? allVenues?.find(v => v.slug === slug)?.id : undefined
  // Hay slug pero su negocio aún no está en la lista (cargando): no se pide sin header, sería la lista de TODOS los negocios.
  const venuePendiente = Boolean(slug) && !venueId
  const negocioRef = useRef({ venueId, venuePendiente })
  negocioRef.current = { venueId, venuePendiente }

  // Al cambiar de negocio se vacían lista y contador en el acto: nunca se ve la del negocio anterior.
  // (Va antes del efecto que copia la consulta, para que una lista ya en caché del nuevo negocio gane.)
  useEffect(() => {
    dispatch({ type: 'RESET' })
  }, [venueId])

  // Fetch notifications
  const notificationsQuery = useQuery({
    queryKey: ['notifications', venueId ?? null, state.filters, state.pagination],
    queryFn: () => notificationService.getNotifications(state.filters, state.pagination, venueId),
    enabled: isAuthenticated && !venuePendiente,
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
    if (isAuthenticated && isConnected && !venuePendiente) {
      refetch()
    }
  }, [isAuthenticated, isConnected, venuePendiente, refetch])

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

  // Mark all as read mutation. Lleva el negocio de ORIGEN: si al responder ya se cambió de negocio, no toca la lista nueva.
  const markAllAsReadMutation = useMutation({
    mutationFn: (origen: { venueId?: string }) => notificationService.markAllAsRead(origen.venueId),
    onSuccess: (_, origen) => {
      if (origen.venueId === negocioRef.current.venueId) dispatch({ type: 'MARK_ALL_READ' })
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
  // BUG #2 FIX: Add try/catch to prevent unhandled promise rejections
  const markAsRead = useCallback(async (id: string) => {
    try {
      await markAsReadMutation.mutateAsync(id)
    } catch (error) {
      // Error is already handled by onError in mutation config
      console.error('Failed to mark notification as read:', error)
    }
  }, [markAsReadMutation])

  const markAllAsRead = useCallback(async () => {
    try {
      if (negocioRef.current.venuePendiente) return
      await markAllAsReadMutation.mutateAsync({ venueId: negocioRef.current.venueId })
    } catch (error) {
      // Error is already handled by onError in mutation config
      console.error('Failed to mark all notifications as read:', error)
    }
  }, [markAllAsReadMutation])

  const deleteNotification = useCallback(async (id: string) => {
    try {
      await deleteNotificationMutation.mutateAsync(id)
    } catch (error) {
      // Error is already handled by onError in mutation config
      console.error('Failed to delete notification:', error)
    }
  }, [deleteNotificationMutation])

  const setFilters = useCallback((filters: NotificationFilters) => {
    dispatch({ type: 'SET_FILTERS', payload: filters })
  }, [])

  const setPagination = useCallback((pagination: PaginationOptions) => {
    dispatch({ type: 'SET_PAGINATION', payload: pagination })
  }, [])

  const refreshNotifications = useCallback(() => {
    notificationsQuery.refetch()
  }, [notificationsQuery])

  // (Real-time additions are handled via socket effect below)

  // Context value
  const contextValue: NotificationContextType = {
    ...state,
    venueId,
    lecturaDeNotificaciones: notificationsQuery,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilters,
    setPagination,
    refreshNotifications
  }

  // BUG #1 FIX: Use useCallback for socket handlers to prevent memory leaks
  // Handlers are memoized with stable references, preventing duplicate registrations
  const handleNewNotification = useCallback((notification: any) => {
    console.log('Received new notification:', notification)

    // Normaliza el id (notificationId o id) y la fecha (el evento trae `timestamp`, no `createdAt`: D2).
    const transformedNotification = avisoEnVivoANotificacion(notification)
    if (!transformedNotification) {
      console.error('Notification received without ID:', notification)
      return
    }

    // Con negocio actual, un aviso en vivo de otro negocio no entra, sea del tipo que sea (los anuncios de plataforma
    // no salen por socket: se recogen al pedir la lista).
    const { venueId: actual, venuePendiente: pendiente } = negocioRef.current
    if (pendiente || (actual && transformedNotification.venueId !== actual)) return

    dispatch({ type: 'ADD_NOTIFICATION', payload: transformedNotification })

    // BUG #4 FIX: Wrap browser notification in try/catch
    // If permissions are denied or API fails, don't crash the handler
    try {
      const options = getNotificationOptions(notification.priority)
      showBrowserNotification(notification.title, {
        ...options,
        body: notification.message,
        tag: transformedNotification.id
      })
    } catch (error) {
      // Browser notification failed (permissions denied, API unavailable, etc.)
      // Real-time in-app notification still works
      console.warn('Browser notification failed:', error)
    }
  }, [])

  const handleNotificationUpdate = useCallback((data: { id: string; isRead: boolean }) => {
    if (data.isRead) {
      dispatch({ type: 'MARK_AS_READ', payload: data.id })
    }
  }, [])

  // Listen for real-time notifications (Socket.IO integration)
  useEffect(() => {
    if (!socket || !isConnected) return

    // Register socket listeners
    socket.on('notification_new', handleNewNotification)
    socket.on('notification:updated', handleNotificationUpdate)

    // Cleanup listeners on unmount
    return () => {
      socket.off('notification_new', handleNewNotification)
      socket.off('notification:updated', handleNotificationUpdate)
    }
  }, [socket, isConnected, handleNewNotification, handleNotificationUpdate])

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