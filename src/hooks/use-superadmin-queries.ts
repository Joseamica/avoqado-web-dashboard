import { getNotifications, getUnreadCount, markAsRead, NotificationsResponse } from '@/services/notification.service'
import { getDashboardData, getServerMetrics } from '@/services/superadmin.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Query keys para consistencia y invalidación
export const superadminQueryKeys = {
  dashboard: ['superadmin', 'dashboard'] as const,
  notifications: ['superadmin', 'notifications'] as const,
  unreadCount: ['superadmin', 'notifications', 'unread-count'] as const,
  serverMetrics: ['superadmin', 'server-metrics'] as const,
}

/**
 * Hook para obtener datos del dashboard de superadmin
 */
export function useSuperadminDashboard() {
  return useQuery({
    queryKey: superadminQueryKeys.dashboard,
    queryFn: getDashboardData,
    staleTime: 5 * 60 * 1000, // 5 minutos
    gcTime: 10 * 60 * 1000, // 10 minutos (antes cacheTime)
    retry: 2,
    retryDelay: attemptIndex => Math.min(1000 * 2 ** attemptIndex, 30000),
  })
}

/**
 * @deprecated Use `useNotifications()` from `@/context/NotificationContext` instead.
 * This hook uses polling which causes unnecessary server load.
 * NotificationContext uses WebSocket for real-time updates.
 *
 * Hook para obtener notificaciones del superadmin (DEPRECATED)
 */
export function useSuperadminNotifications(limit = 5) {
  return useQuery({
    queryKey: [...superadminQueryKeys.notifications, { limit }],
    queryFn: () => getNotifications({}, { limit }),
    staleTime: 2 * 60 * 1000, // 2 minutos
    gcTime: 5 * 60 * 1000, // 5 minutos
    retry: 2,
    select: (data: NotificationsResponse) => ({
      notifications: data.notifications || [],
      pagination: data.pagination,
    }),
  })
}

/**
 * @deprecated Use `useNotifications()` from `@/context/NotificationContext` instead.
 * This hook polls every 30 seconds causing log noise.
 * NotificationContext uses WebSocket for real-time updates.
 *
 * Hook para obtener el contador de notificaciones sin leer (DEPRECATED)
 */
export function useUnreadNotificationsCount() {
  return useQuery({
    queryKey: superadminQueryKeys.unreadCount,
    queryFn: getUnreadCount,
    staleTime: 1 * 60 * 1000, // 1 minuto
    gcTime: 2 * 60 * 1000, // 2 minutos
    retry: 2,
    refetchInterval: 30 * 1000, // Refetch cada 30 segundos
    select: data => data.count || 0,
  })
}

/**
 * @deprecated Use `useNotifications()` from `@/context/NotificationContext` instead.
 * This combines deprecated polling hooks.
 * NotificationContext uses WebSocket for real-time updates.
 *
 * Hook combinado para datos completos de notificaciones (DEPRECATED)
 */
export function useSuperadminNotificationData(limit = 5) {
  const notifications = useSuperadminNotifications(limit)
  const unreadCount = useUnreadNotificationsCount()

  return {
    notifications: notifications.data?.notifications || [],
    unreadCount: unreadCount.data || 0,
    isLoading: notifications.isLoading || unreadCount.isLoading,
    isError: notifications.isError || unreadCount.isError,
    error: notifications.error || unreadCount.error,
    refetch: () => {
      notifications.refetch()
      unreadCount.refetch()
    },
  }
}

/**
 * @deprecated Use `markAsRead()` from `useNotifications()` in `@/context/NotificationContext` instead.
 * NotificationContext handles state updates automatically via WebSocket.
 *
 * Mutation hook para marcar notificación como leída (DEPRECATED)
 */
export function useMarkNotificationAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: markAsRead,
    onSuccess: () => {
      // Invalidar las queries relacionadas con notificaciones
      queryClient.invalidateQueries({ queryKey: superadminQueryKeys.notifications })
      queryClient.invalidateQueries({ queryKey: superadminQueryKeys.unreadCount })
    },
  })
}

/**
 * Hook para refrescar todos los datos del superadmin
 */
export function useRefreshSuperadminData() {
  const queryClient = useQueryClient()

  return () => {
    queryClient.invalidateQueries({ queryKey: ['superadmin'] })
  }
}

/**
 * Hook para obtener métricas de salud del servidor
 * @param refetchInterval - false to pause, number for interval in ms
 */
export function useServerMetrics(refetchInterval: false | number = 30_000) {
  return useQuery({
    queryKey: superadminQueryKeys.serverMetrics,
    queryFn: getServerMetrics,
    refetchInterval,
    staleTime: 10_000,
    gcTime: 60_000,
  })
}
