import { getNotifications, getUnreadCount, markAsRead, NotificationsResponse } from '@/services/notification.service'
import { getDashboardData } from '@/services/superadmin.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

// Query keys para consistencia y invalidación
export const superadminQueryKeys = {
  dashboard: ['superadmin', 'dashboard'] as const,
  notifications: ['superadmin', 'notifications'] as const,
  unreadCount: ['superadmin', 'notifications', 'unread-count'] as const,
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
 * Hook para obtener notificaciones del superadmin
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
 * Hook para obtener el contador de notificaciones sin leer
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
 * Hook combinado para datos completos de notificaciones
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
 * Mutation hook para marcar notificación como leída
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
