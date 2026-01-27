import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Textarea } from '@/components/ui/textarea'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { DateTime } from 'luxon'
import { Bell, CheckCircle2, RefreshCw, Search, Send, Smartphone, Users } from 'lucide-react'
import { useState } from 'react'
import api from '@/api'

interface DeviceToken {
  id: string
  platform: 'IOS' | 'ANDROID' | 'WEB'
  deviceModel: string | null
  osVersion: string | null
  appVersion: string | null
  lastUsed: string
  createdAt: string
}

interface StaffWithDevices {
  id: string
  firstName: string
  lastName: string
  email: string
  venues: Array<{ id: string; name: string; role: string }>
  devices: DeviceToken[]
  deviceCount: number
}

interface PushStats {
  totalActiveDevices: number
  totalInactiveDevices: number
  staffWithDevices: number
  recentRegistrations: number
  byPlatform: Record<string, number>
}

interface Venue {
  id: string
  name: string
}

// API functions
async function getStaffWithDevices(venueId?: string, search?: string) {
  const params = new URLSearchParams()
  if (venueId && venueId !== 'all') params.append('venueId', venueId)
  if (search) params.append('search', search)

  const response = await api.get(`/api/v1/dashboard/superadmin/push-notifications/staff-devices?${params}`)
  return response.data as { staff: StaffWithDevices[]; venues: Venue[]; total: number }
}

async function getPushStats() {
  const response = await api.get('/api/v1/dashboard/superadmin/push-notifications/stats')
  return response.data.stats as PushStats
}

async function sendTestNotification(data: { staffId: string; title?: string; body?: string }) {
  const response = await api.post('/api/v1/dashboard/superadmin/push-notifications/send-test', data)
  return response.data
}

function PushNotifications() {
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filter states
  const [venueFilter, setVenueFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState<string>('')

  // Send notification states
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null)
  const [notificationTitle, setNotificationTitle] = useState<string>('')
  const [notificationBody, setNotificationBody] = useState<string>('')

  // Fetch stats
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['pushStats'],
    queryFn: getPushStats,
  })

  // Fetch staff with devices
  const { data: staffData, isLoading: staffLoading } = useQuery({
    queryKey: ['staffWithDevices', venueFilter, searchQuery],
    queryFn: () => getStaffWithDevices(venueFilter, searchQuery),
  })

  // Send notification mutation
  const sendMutation = useMutation({
    mutationFn: sendTestNotification,
    onSuccess: data => {
      toast({
        title: 'Notificacion enviada',
        description: data.message,
      })
      setSelectedStaffId(null)
      setNotificationTitle('')
      setNotificationBody('')
    },
    onError: (error: any) => {
      toast({
        title: 'Error al enviar',
        description: error.response?.data?.error || 'No se pudo enviar la notificacion',
        variant: 'destructive',
      })
    },
  })

  const handleSend = (staffId: string) => {
    sendMutation.mutate({
      staffId,
      title: notificationTitle || undefined,
      body: notificationBody || undefined,
    })
  }

  const getPlatformBadge = (platform: string) => {
    switch (platform) {
      case 'IOS':
        return <Badge variant="default">iOS</Badge>
      case 'ANDROID':
        return <Badge variant="secondary">Android</Badge>
      case 'WEB':
        return <Badge variant="outline">Web</Badge>
      default:
        return <Badge variant="outline">{platform}</Badge>
    }
  }

  return (
    <div className="space-y-6 p-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Push Notifications</h1>
        <p className="text-muted-foreground mt-2">Prueba y monitorea las notificaciones push de la plataforma</p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Dispositivos Activos</CardTitle>
              <Smartphone className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalActiveDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">{stats.totalInactiveDevices} inactivos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Staff con Dispositivos</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.staffWithDevices}</div>
              <p className="text-xs text-muted-foreground mt-1">usuarios registrados</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">iOS</CardTitle>
              <Bell className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.byPlatform?.IOS || 0}</div>
              <p className="text-xs text-muted-foreground mt-1">dispositivos</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Registros Recientes</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.recentRegistrations}</div>
              <p className="text-xs text-muted-foreground mt-1">ultimos 7 dias</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Send Test Notification Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Send className="h-5 w-5" />
            Enviar Notificacion de Prueba
          </CardTitle>
          <CardDescription>Personaliza el mensaje o usa los valores predeterminados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="title">Titulo (opcional)</Label>
              <Input
                id="title"
                placeholder="Test de Avoqado"
                value={notificationTitle}
                onChange={e => setNotificationTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="body">Mensaje (opcional)</Label>
              <Textarea
                id="body"
                placeholder="Las notificaciones push funcionan correctamente."
                value={notificationBody}
                onChange={e => setNotificationBody(e.target.value)}
                rows={2}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Staff with Devices Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Staff con Dispositivos Registrados
              </CardTitle>
              <CardDescription className="mt-1">
                Selecciona un usuario para enviarle una notificacion de prueba
              </CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => queryClient.invalidateQueries({ queryKey: ['staffWithDevices'] })}
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refrescar
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-6 flex gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o email..."
                  className="pl-10"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
            <Select value={venueFilter} onValueChange={setVenueFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Todos los venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los venues</SelectItem>
                {staffData?.venues.map(venue => (
                  <SelectItem key={venue.id} value={venue.id}>
                    {venue.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Table */}
          {staffLoading ? (
            <p className="text-center py-8 text-muted-foreground">Cargando...</p>
          ) : !staffData?.staff.length ? (
            <p className="text-center py-8 text-muted-foreground">No hay staff con dispositivos registrados</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Venues</TableHead>
                  <TableHead>Dispositivos</TableHead>
                  <TableHead>Ultima Actividad</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {staffData.staff.map(staff => (
                  <TableRow key={staff.id}>
                    <TableCell className="font-medium">
                      {staff.firstName} {staff.lastName}
                    </TableCell>
                    <TableCell className="text-muted-foreground">{staff.email}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {staff.venues.slice(0, 2).map(v => (
                          <Badge key={v.id} variant="outline" className="text-xs">
                            {v.name}
                          </Badge>
                        ))}
                        {staff.venues.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{staff.venues.length - 2}
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {staff.devices.map(d => (
                          <span key={d.id}>{getPlatformBadge(d.platform)}</span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {staff.devices[0]?.lastUsed
                        ? DateTime.fromISO(staff.devices[0].lastUsed).toRelative({ locale: 'es' })
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        size="sm"
                        onClick={() => handleSend(staff.id)}
                        disabled={sendMutation.isPending && selectedStaffId === staff.id}
                      >
                        {sendMutation.isPending && selectedStaffId === staff.id ? (
                          <RefreshCw className="h-4 w-4 mr-1 animate-spin" />
                        ) : (
                          <Send className="h-4 w-4 mr-1" />
                        )}
                        Enviar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

export default PushNotifications
