# Superadmin TanStack Query Hooks

Este archivo contiene los hooks personalizados para manejar los datos del panel de superadministrador usando TanStack Query.

## Hooks Disponibles

### `useSuperadminDashboard()`
Obtiene todos los datos del dashboard principal.

```tsx
import { useSuperadminDashboard } from '@/hooks/use-superadmin-queries'

const MyComponent = () => {
  const { 
    data, 
    isLoading, 
    isError, 
    error, 
    refetch,
    isFetching 
  } = useSuperadminDashboard()

  if (isLoading) return <div>Cargando...</div>
  if (isError) return <div>Error: {error?.message}</div>

  return <div>{/* Renderizar datos */}</div>
}
```

### `useSuperadminNotifications(limit?)`
Obtiene las notificaciones del superadmin.

```tsx
import { useSuperadminNotifications } from '@/hooks/use-superadmin-queries'

const NotificationsList = () => {
  const { data, isLoading } = useSuperadminNotifications(10)
  
  return (
    <div>
      {data?.notifications.map(notification => (
        <div key={notification.id}>{notification.title}</div>
      ))}
    </div>
  )
}
```

### `useUnreadNotificationsCount()`
Obtiene el contador de notificaciones sin leer (se actualiza automáticamente cada 30 segundos).

```tsx
import { useUnreadNotificationsCount } from '@/hooks/use-superadmin-queries'

const NotificationBadge = () => {
  const { data: count } = useUnreadNotificationsCount()
  
  return count > 0 ? <Badge>{count}</Badge> : null
}
```

### `useSuperadminNotificationData(limit?)`
Hook combinado que obtiene tanto las notificaciones como el contador.

```tsx
import { useSuperadminNotificationData } from '@/hooks/use-superadmin-queries'

const NotificationDropdown = () => {
  const {
    notifications,
    unreadCount,
    isLoading,
    isError,
    refetch
  } = useSuperadminNotificationData(5)

  return (
    <div>
      <Button>{unreadCount}</Button>
      {notifications.map(notification => (
        <div key={notification.id}>{notification.title}</div>
      ))}
    </div>
  )
}
```

### `useMarkNotificationAsRead()`
Mutation para marcar notificaciones como leídas.

```tsx
import { useMarkNotificationAsRead } from '@/hooks/use-superadmin-queries'

const NotificationItem = ({ notification }) => {
  const markAsRead = useMarkNotificationAsRead()

  const handleMarkAsRead = () => {
    markAsRead.mutate(notification.id)
  }

  return (
    <div onClick={handleMarkAsRead}>
      {notification.title}
    </div>
  )
}
```

### `useRefreshSuperadminData()`
Hook para refrescar todos los datos del superadmin.

```tsx
import { useRefreshSuperadminData } from '@/hooks/use-superadmin-queries'

const RefreshButton = () => {
  const refreshAll = useRefreshSuperadminData()

  return (
    <Button onClick={refreshAll}>
      Actualizar Todo
    </Button>
  )
}
```

## Ventajas de usar TanStack Query

1. **Caching inteligente**: Los datos se almacenan en caché y se reutilizan automáticamente
2. **Sincronización**: Refetch automático cuando la ventana vuelve a tener foco
3. **Estados de carga**: Manejo automático de loading, error, y success states
4. **Retry automático**: Reintenta automáticamente las queries fallidas
5. **Optimistic updates**: Para mutations instantáneas
6. **Background updates**: Los datos se actualizan en segundo plano
7. **Memory management**: Garbage collection automático de datos no utilizados

## Query Keys

Los query keys están centralizados para facilitar la invalidación:

```tsx
export const superadminQueryKeys = {
  dashboard: ['superadmin', 'dashboard'] as const,
  notifications: ['superadmin', 'notifications'] as const,
  unreadCount: ['superadmin', 'notifications', 'unread-count'] as const,
}
```

## Configuración Recomendada

- **staleTime**: Tiempo que los datos se consideran frescos
- **gcTime** (antes cacheTime): Tiempo que los datos se mantienen en memoria
- **retry**: Número de reintentos automáticos
- **refetchInterval**: Intervalo de actualización automática
