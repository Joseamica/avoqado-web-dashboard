import { useState } from 'react'
import { Bell, Filter, Search, Check, CheckCheck, Trash2, Settings, RefreshCw } from 'lucide-react'
import { useNotifications } from '@/contexts/NotificationContext'
import {
  formatNotificationTime,
  getNotificationPriorityColor,
  formatNotificationType,
  formatNotificationPriority,
  groupNotificationsByDate,
  NotificationType,
  NotificationPriority
} from '@/services/notification.service'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface NotificationsPageProps {
  className?: string
}

export function NotificationsPage({ className }: NotificationsPageProps) {
  const {
    notifications,
    unreadCount,
    loading,
    error,
    filters,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    setFilters,
    refreshNotifications
  } = useNotifications()

  const [selectedNotifications, setSelectedNotifications] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [showSettings, setShowSettings] = useState(false)

  // Filter notifications based on search query
  const filteredNotifications = notifications.filter(notification =>
    notification.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    notification.message.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const groupedNotifications = groupNotificationsByDate(filteredNotifications)

  const handleSelectNotification = (notificationId: string, checked: boolean) => {
    if (checked) {
      setSelectedNotifications(prev => [...prev, notificationId])
    } else {
      setSelectedNotifications(prev => prev.filter(id => id !== notificationId))
    }
  }

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNotifications(notifications.map(n => n.id))
    } else {
      setSelectedNotifications([])
    }
  }

  const handleBulkMarkAsRead = async () => {
    for (const id of selectedNotifications) {
      await markAsRead(id)
    }
    setSelectedNotifications([])
  }

  const handleBulkDelete = async () => {
    for (const id of selectedNotifications) {
      await deleteNotification(id)
    }
    setSelectedNotifications([])
  }

  const handleNotificationClick = async (notification: any) => {
    if (!notification.isRead) {
      await markAsRead(notification.id)
    }

    if (notification.actionUrl) {
      window.location.href = notification.actionUrl
    }
  }

  return (
    <div className={`max-w-4xl mx-auto p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center">
            <Bell className="h-6 w-6 mr-2" />
            Notificaciones
            {unreadCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {unreadCount}
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground mt-1">
            Mantente actualizado con eventos y actividades importantes
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={refreshNotifications}
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Actualizar
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.location.href = '/notifications/preferences'}
          >
            <Settings className="h-4 w-4 mr-2" />
            Configuración
          </Button>
        </div>
      </div>

      {/* Filters and Search */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <div className="flex items-center space-x-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Buscar notificaciones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Filter Toggle */}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="h-4 w-4 mr-2" />
              Filtros
            </Button>

            {/* Mark All as Read */}
            {unreadCount > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={markAllAsRead}
              >
                <CheckCheck className="h-4 w-4 mr-2" />
                Marcar todas como leídas
              </Button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="mt-4 pt-4 border-t">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Estado
                  </label>
                  <Select
                    value={filters.isRead === undefined ? 'all' : filters.isRead ? 'read' : 'unread'}
                    onValueChange={(value) => {
                      setFilters({
                        ...filters,
                        isRead: value === 'all' ? undefined : value === 'read'
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      <SelectItem value="unread">No leídas</SelectItem>
                      <SelectItem value="read">Leídas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Tipo
                  </label>
                  <Select
                    value={filters.type || 'all'}
                    onValueChange={(value) => {
                      setFilters({
                        ...filters,
                        type: value === 'all' ? undefined : value as NotificationType
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos los tipos</SelectItem>
                      {Object.values(NotificationType).map((type) => (
                        <SelectItem key={type} value={type}>
                          {formatNotificationType(type)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <label className="text-sm font-medium text-foreground mb-2 block">
                    Prioridad
                  </label>
                  <Select
                    value={filters.priority || 'all'}
                    onValueChange={(value) => {
                      setFilters({
                        ...filters,
                        priority: value === 'all' ? undefined : value as NotificationPriority
                      })
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas las prioridades</SelectItem>
                      {Object.values(NotificationPriority).map((priority) => (
                        <SelectItem key={priority} value={priority}>
                          {formatNotificationPriority(priority)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Bulk Actions */}
      {selectedNotifications.length > 0 && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">
                {selectedNotifications.length} notificación(es) seleccionada(s)
              </span>
              <div className="flex items-center space-x-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkMarkAsRead}
                >
                  <Check className="h-4 w-4 mr-2" />
                  Marcar como leída
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleBulkDelete}
                  className="text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Eliminar
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notifications List */}
      {error && (
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="text-red-600 text-center">
              <p>Error al cargar notificaciones: {error}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={refreshNotifications}
                className="mt-2"
              >
                Intentar de nuevo
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {filteredNotifications.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium text-foreground mb-2">
              No se encontraron notificaciones
            </h3>
            <p className="text-muted-foreground">
              {searchQuery
                ? 'Intenta ajustar tu búsqueda o filtros'
                : '¡Estás al día! Las nuevas notificaciones aparecerán aquí.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {/* Select All */}
          <div className="flex items-center space-x-2 px-4">
            <Checkbox
              checked={selectedNotifications.length === notifications.length}
              onCheckedChange={handleSelectAll}
            />
            <label className="text-sm text-muted-foreground">
              Seleccionar todas
            </label>
          </div>

          {/* Grouped Notifications */}
          {Object.entries(groupedNotifications).map(([dateGroup, groupNotifications]) => (
            <div key={dateGroup}>
              {/* Date Group Header */}
              <div className="px-4 py-2 bg-muted rounded-lg mb-2">
                <h3 className="text-sm font-medium text-foreground">{dateGroup}</h3>
              </div>

              {/* Notifications in Group */}
              <div className="space-y-2">
                {groupNotifications.map((notification) => (
                  <Card
                    key={notification.id}
                    className={`cursor-pointer transition-all hover:shadow-md ${
                      !notification.isRead
                        ? 'border-l-4 border-l-blue-500 bg-blue-50/50'
                        : ''
                    }`}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <CardContent className="p-4">
                      <div className="flex items-start space-x-3">
                        {/* Selection Checkbox */}
                        <Checkbox
                          checked={selectedNotifications.includes(notification.id)}
                          onCheckedChange={(checked) =>
                            handleSelectNotification(notification.id, checked as boolean)
                          }
                          onClick={(e) => e.stopPropagation()}
                        />

                        {/* Notification Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className={`font-medium ${
                              !notification.isRead ? 'text-foreground' : 'text-foreground'
                            }`}>
                              {notification.title}
                            </h4>
                            <div className="flex items-center space-x-2">
                              <Badge
                                variant="outline"
                                className={getNotificationPriorityColor(notification.priority)}
                              >
                                {formatNotificationPriority(notification.priority)}
                              </Badge>
                              <Badge variant="secondary">
                                {formatNotificationType(notification.type)}
                              </Badge>
                            </div>
                          </div>

                          <p className={`text-sm mb-3 ${
                            !notification.isRead ? 'text-foreground' : 'text-muted-foreground'
                          }`}>
                            {notification.message}
                          </p>

                          <div className="flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {formatNotificationTime(notification.createdAt)}
                            </span>

                            <div className="flex items-center space-x-2">
                              {notification.actionLabel && (
                                <span className="text-xs text-blue-600 font-medium">
                                  {notification.actionLabel}
                                </span>
                              )}
                              {!notification.isRead && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={(e) => {
                                    e.stopPropagation()
                                    markAsRead(notification.id)
                                  }}
                                >
                                  <Check className="h-3 w-3" />
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  deleteNotification(notification.id)
                                }}
                                className="text-red-600 hover:text-red-700"
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configuración de Notificaciones</DialogTitle>
            <DialogDescription>
              Configura tus preferencias de notificaciones aquí.
            </DialogDescription>
          </DialogHeader>
          
          <div className="py-4">
            <p className="text-sm text-muted-foreground">
              Las preferencias de notificaciones estarán disponibles en la próxima actualización.
            </p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowSettings(false)}>
              Cerrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default NotificationsPage