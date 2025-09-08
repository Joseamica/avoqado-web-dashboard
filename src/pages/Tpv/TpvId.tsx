import api from '@/api'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  Clock,
  Cpu,
  HardDrive,
  Home,
  MemoryStick,
  PencilIcon,
  RefreshCw,
  SaveIcon,
  Settings,
  Shield,
  Terminal,
  Wifi,
  WifiOff,
  Wrench,
  XIcon,
  Zap,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import * as z from 'zod'

// Define the schema for validation (based on actual database schema)
const tpvFormSchema = z.object({
  name: z.string().min(1, { message: 'El nombre es requerido' }),
  serialNumber: z.string().min(1, { message: 'El número de serie es requerido' }),
  type: z.string().optional(),
  status: z.string().optional(),
  config: z.string().optional(), // JSON configuration
})

// Type for the form values
type TpvFormValues = z.infer<typeof tpvFormSchema>

interface TpvData {
  id: string
  name: string
  serialNumber: string
  type?: string
  status?: string
  lastHeartbeat?: string
  config?: any // JSON field
  venueId: string
  createdAt?: string
  updatedAt?: string
  version?: string
  ipAddress?: string
  systemInfo?: {
    platform?: string
    memory?: {
      total?: number
      free?: number
      used?: number
    }
    uptime?: number
    [key: string]: any
  }
}

export default function TpvId() {
  const { tpvId } = useParams()
  const location = useLocation()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  // Initialize form with react-hook-form
  const form = useForm<TpvFormValues>({
    resolver: zodResolver(tpvFormSchema),
    defaultValues: {
      name: '',
      serialNumber: '',
      type: '',
      status: '',
      config: '',
    },
  })

  // Helper functions
  const getTerminalStatusStyle = (status?: string, lastHeartbeat?: string) => {
    if (!status) return { variant: 'secondary' as const, label: 'Desconocido', icon: AlertCircle }

    const cutoff = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    const isRecentHeartbeat = lastHeartbeat && new Date(lastHeartbeat) > cutoff

    switch (status) {
      case 'ACTIVE':
        if (isRecentHeartbeat) {
          return {
            variant: 'default' as const,
            label: 'En línea',
            icon: Activity,
            className: 'bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400',
          }
        } else {
          return {
            variant: 'destructive' as const,
            label: 'Desconectado',
            icon: WifiOff,
            className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
          }
        }
      case 'MAINTENANCE':
        return {
          variant: 'secondary' as const,
          label: 'Mantenimiento',
          icon: Wrench,
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent',
        }
      case 'INACTIVE':
        return { variant: 'secondary' as const, label: 'Inactivo', icon: XIcon }
      case 'RETIRED':
        return { variant: 'secondary' as const, label: 'Retirado', icon: XIcon }
      default:
        return { variant: 'secondary' as const, label: 'Desconocido', icon: AlertCircle }
    }
  }

  const isOnline = (status?: string, lastHeartbeat?: string) => {
    const cutoff = new Date(Date.now() - 2 * 60 * 1000)
    return status === 'ACTIVE' && lastHeartbeat && new Date(lastHeartbeat) > cutoff
  }

  const formatUptime = (seconds?: number) => {
    if (!seconds) return 'N/A'
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    if (hours > 0) return `${hours}h ${minutes}m`
    return `${minutes}m`
  }

  const formatBytes = (bytes?: number) => {
    if (!bytes || bytes === 0) return '0 B'
    const k = 1024
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const navigate = useNavigate()

  // Fetch the TPV data
  const {
    data: tpv,
    isLoading,
    error,
    isError,
  } = useQuery<TpvData>({
    queryKey: ['tpv', venueId, tpvId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`)
      return response.data
    },
    enabled: Boolean(venueId && tpvId),
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 error
      if (error?.response?.status === 404) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
  })

  useEffect(() => {
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        serialNumber: tpv.serialNumber || '',
        type: tpv.type || '',
        status: tpv.status || '',
        config: tpv.config ? JSON.stringify(tpv.config, null, 2) : '',
      })
    }
  }, [tpv, form])

  // Mutation for updating the TPV
  const updateTpvMutation = useMutation({
    mutationFn: async (updatedData: TpvFormValues) => {
      if (!venueId || !tpvId) {
        throw new Error('Venue o TPV no definido')
      }
      const response = await api.put(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}`, updatedData)
      return response.data
    },
    onSuccess: () => {
      // Invalidate and refetch
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })

      setIsEditing(false)
      toast({
        title: 'Terminal actualizado',
        description: 'Los cambios han sido guardados exitosamente',
      })
    },
    onError: error => {
      toast({
        title: 'Error',
        description: 'No se pudo actualizar el terminal. Por favor intente de nuevo.',
        variant: 'destructive',
      })
      console.error('Error updating TPV:', error)
    },
  })

  // Mutation for sending commands to TPV
  const commandMutation = useMutation({
    mutationFn: async ({ command, payload }: { command: string; payload?: any }) => {
      if (!tpvId) throw new Error('TPV ID no definido')
      const response = await api.post(`/api/v1/dashboard/tpv/${tpvId}/command`, { command, payload })
      return response.data
    },
    onSuccess: (_, variables) => {
      toast({
        title: 'Comando enviado',
        description: `Comando ${variables.command} enviado exitosamente`,
      })
      // Refresh the TPV data to show updated status
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: `Error enviando comando: ${error.response?.data?.message || error.message}`,
        variant: 'destructive',
      })
    },
  })

  const sendTpvCommand = (command: string) => {
    const payload = command === 'MAINTENANCE_MODE' ? { message: 'Activado desde dashboard', duration: 0 } : undefined

    commandMutation.mutate({ command, payload })
  }

  const onSubmit = (values: TpvFormValues) => {
    updateTpvMutation.mutate(values)
  }

  const handleCancel = () => {
    // Reset form to original values
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        serialNumber: tpv.serialNumber || '',
        type: tpv.type || '',
        status: tpv.status || '',
        config: tpv.config ? JSON.stringify(tpv.config, null, 2) : '',
      })
    }
    setIsEditing(false)
  }

  const from = (location.state as any)?.from || `/venues/${venueId}/tpv`

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <p className="text-muted-foreground">Cargando información del terminal...</p>
      </div>
    )
  }

  // Handle 404 error - TPV not found
  if (isError && (error as any)?.response?.status === 404) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto w-12 h-12 bg-red-100 dark:bg-red-900/50 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400" />
            </div>
            <CardTitle className="text-xl">Terminal no encontrado</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              El terminal con ID <code className="bg-muted px-2 py-1 rounded text-sm">{tpvId}</code> no existe o no tienes permisos para
              acceder a él.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Volver atrás
              </Button>
              <Button onClick={() => navigate(`/venues/${venueId}/tpv`)} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Ir a Terminales
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  // Handle other errors
  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Error al cargar el terminal. Por favor intenta de nuevo o contacta al soporte técnico.</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver atrás
          </Button>
          <Button onClick={() => window.location.reload()}>Intentar de nuevo</Button>
        </div>
      </div>
    )
  }

  // If no TPV data and not loading/error, show not found
  if (!tpv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-muted-foreground">No se encontraron datos del terminal.</p>
        <Button onClick={() => navigate(`/venues/${venueId}/tpv`)}>
          <Home className="h-4 w-4 mr-2" />
          Volver a Terminales
        </Button>
      </div>
    )
  }

  const statusStyle = getTerminalStatusStyle(tpv?.status, tpv?.lastHeartbeat)
  const terminalOnline = isOnline(tpv?.status, tpv?.lastHeartbeat)
  const isInMaintenance = tpv?.status === 'MAINTENANCE'
  const isInactive = tpv?.status === 'INACTIVE'

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        {/* Enhanced Header with gradient background */}
        <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-sm border-b border-border shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <div className="flex items-center space-x-4">
                <Link to={from} className="p-2 rounded-lg hover:bg-accent transition-colors">
                  <ArrowLeft className="h-5 w-5 text-muted-foreground" />
                </Link>
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-primary/10 dark:bg-primary/20">
                    <Terminal className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">{tpv?.name || 'Terminal'}</h1>
                    <p className="text-sm text-muted-foreground">ID: {tpv?.id?.slice(-8) || 'N/A'}</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-3">
                {/* Status Badge */}
                <Badge className={`${statusStyle.className} px-3 py-1 text-sm font-medium`}>
                  <statusStyle.icon className="w-4 h-4 mr-2" />
                  {statusStyle.label}
                </Badge>

                {/* Action Buttons */}
                {!isEditing && (
                  <div className="flex items-center space-x-2">
                    {/* Maintenance Mode Toggle */}
                    {isInMaintenance ? (
                      <Tooltip>
                        <TooltipTrigger asChild></TooltipTrigger>
                        <TooltipContent>
                          <p>Reactivar operación normal del terminal</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild></TooltipTrigger>
                        <TooltipContent>
                          <p>{terminalOnline ? 'Poner en modo mantenimiento' : 'Terminal desconectado'}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Update Status Button */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendTpvCommand('UPDATE_STATUS')}
                          disabled={!terminalOnline || commandMutation.isPending}
                        >
                          <RefreshCw className="w-4 h-4 mr-2" />
                          Actualizar
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{terminalOnline ? 'Forzar actualización de estado' : 'Terminal desconectado'}</p>
                      </TooltipContent>
                    </Tooltip>

                    {/* Edit Button */}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setIsEditing(true)}
                      className="border-primary/30 text-primary hover:bg-primary/5"
                    >
                      <PencilIcon className="w-4 h-4 mr-2" />
                      Editar
                    </Button>
                  </div>
                )}

                {/* Save/Cancel Buttons when editing */}
                {isEditing && (
                  <div className="flex items-center space-x-2">
                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                      <XIcon className="w-4 h-4 mr-2" />
                      Cancelar
                    </Button>
                    <Button
                      size="sm"
                      onClick={form.handleSubmit(onSubmit)}
                      disabled={updateTpvMutation.isPending}
                      className="bg-primary hover:bg-primary/90"
                    >
                      <SaveIcon className="w-4 h-4 mr-2" />
                      {updateTpvMutation.isPending ? 'Guardando...' : 'Guardar'}
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
            {/* Left Column - Main Info */}
            <div className="xl:col-span-2 space-y-6">
              {/* Status Overview Card */}
              <Card className="overflow-hidden">
                <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10 dark:from-primary/10 dark:to-primary/20">
                  <CardTitle className="flex items-center text-lg">
                    <Activity className="w-5 h-5 mr-2 text-primary" />
                    Estado del Terminal
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="flex justify-center mb-2">
                        {isInMaintenance ? (
                          <Wrench className="w-8 h-8 text-orange-800 dark:text-orange-400" />
                        ) : terminalOnline ? (
                          <Wifi className="w-8 h-8 text-green-600" />
                        ) : (
                          <WifiOff className="w-8 h-8 text-destructive" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">Conexión</p>
                      <p
                        className={`font-semibold ${
                          isInMaintenance
                            ? ' text-orange-800  dark:text-orange-400 border border-transparent'
                            : terminalOnline
                            ? 'text-green-600'
                            : 'text-destructive'
                        }`}
                      >
                        {isInMaintenance ? 'En Mantenimiento' : terminalOnline ? 'Conectado' : 'Desconectado'}
                      </p>
                    </div>

                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="flex justify-center mb-2">
                        <Clock className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">Último contacto</p>
                      <p className="font-semibold text-foreground">
                        {tpv?.lastHeartbeat ? (
                          <span className="text-xs">
                            {new Date(tpv.lastHeartbeat).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </span>
                        ) : (
                          'Nunca'
                        )}
                      </p>
                    </div>

                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="flex justify-center mb-2">
                        <Shield className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">Versión</p>
                      <p className="font-semibold text-foreground">{tpv?.version || 'N/A'}</p>
                    </div>
                  </div>

                  {/* System Info */}
                  {tpv?.systemInfo && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <h4 className="text-sm font-medium text-foreground mb-4">Información del Sistema</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tpv.systemInfo.platform && (
                          <div className="flex items-center space-x-2">
                            <Cpu className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Plataforma:</span>
                            <span className="text-sm font-mono text-foreground">{tpv.systemInfo.platform}</span>
                          </div>
                        )}

                        {tpv.systemInfo.memory && (
                          <div className="flex items-center space-x-2">
                            <MemoryStick className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Memoria:</span>
                            <span className="text-sm font-mono text-foreground">
                              {formatBytes(tpv.systemInfo.memory.used)} / {formatBytes(tpv.systemInfo.memory.total)}
                            </span>
                          </div>
                        )}

                        {tpv.systemInfo.uptime && (
                          <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">Uptime:</span>
                            <span className="text-sm font-mono text-foreground">{formatUptime(tpv.systemInfo.uptime)}</span>
                          </div>
                        )}

                        {tpv?.ipAddress && (
                          <div className="flex items-center space-x-2">
                            <Wifi className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">IP:</span>
                            <span className="text-sm font-mono text-foreground">{tpv.ipAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Memory Usage Progress */}
                      {tpv.systemInfo.memory && tpv.systemInfo.memory.total > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">Uso de memoria</span>
                            <span className="text-foreground font-mono">
                              {Math.round((tpv.systemInfo.memory.used / tpv.systemInfo.memory.total) * 100)}%
                            </span>
                          </div>
                          <Progress value={(tpv.systemInfo.memory.used / tpv.systemInfo.memory.total) * 100} className="h-2" />
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Terminal Configuration */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center text-lg">
                    <Settings className="w-5 h-5 mr-2 text-primary" />
                    Información del Terminal
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                      {/* Basic Information */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Nombre del Terminal</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!isEditing}
                                  className={isEditing ? 'border-primary/50 focus:border-primary' : 'bg-muted'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <div>
                          <Label className="text-sm font-medium text-foreground">ID del Sistema</Label>
                          <Input value={tpv?.id || ''} disabled className="bg-muted font-mono text-sm mt-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="serialNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Número de Serie</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  disabled={!isEditing}
                                  className={isEditing ? 'border-primary/50 focus:border-primary font-mono' : 'bg-muted font-mono'}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">Tipo de Terminal</FormLabel>
                              <FormControl>
                                {isEditing ? (
                                  <Select onValueChange={field.onChange} value={field.value || ''} defaultValue={field.value || ''}>
                                    <SelectTrigger className="border-primary/50 focus:border-primary">
                                      <SelectValue placeholder="Seleccionar tipo" />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="ANDROID_TABLET">Tablet Android</SelectItem>
                                      <SelectItem value="WINDOWS_PC">PC Windows</SelectItem>
                                      <SelectItem value="LINUX_DEVICE">Dispositivo Linux</SelectItem>
                                      <SelectItem value="MOBILE_DEVICE">Dispositivo Móvil</SelectItem>
                                      <SelectItem value="KIOSK">Kiosco</SelectItem>
                                      <SelectItem value="OTHER">Otro</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input value={field.value || 'No especificado'} disabled className="bg-muted" />
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Configuration JSON */}
                      <div className="space-y-4">
                        <h4 className="text-sm font-medium text-foreground flex items-center">
                          <HardDrive className="w-4 h-4 mr-2 text-muted-foreground" />
                          Configuración Avanzada
                        </h4>
                        <FormField
                          control={form.control}
                          name="config"
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                {isEditing ? (
                                  <div className="relative">
                                    <Textarea
                                      {...field}
                                      className="w-full h-32 p-4 text-sm font-mono resize-y border-primary/50 focus:border-primary bg-muted"
                                      placeholder='{"configuracion": "valor", "ajuste": true}'
                                    />
                                    <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                                      JSON
                                    </div>
                                  </div>
                                ) : tpv?.config ? (
                                  <div className="relative p-4 border rounded-lg bg-muted overflow-x-auto">
                                    <pre className="whitespace-pre-wrap text-xs font-mono text-foreground">
                                      {JSON.stringify(tpv.config, null, 2)}
                                    </pre>
                                    <div className="absolute top-2 right-2 text-xs text-muted-foreground bg-background px-2 py-1 rounded">
                                      JSON
                                    </div>
                                  </div>
                                ) : (
                                  <div className="p-8 text-center border-2 border-dashed border-border rounded-lg">
                                    <HardDrive className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                                    <p className="text-sm text-muted-foreground">No hay configuración registrada</p>
                                  </div>
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {isEditing && (
                        <div className="flex justify-end space-x-3 pt-6 border-t border-border">
                          <Button type="button" variant="outline" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                            <XIcon className="w-4 h-4 mr-2" />
                            Cancelar
                          </Button>
                          <Button type="submit" disabled={updateTpvMutation.isPending} className="bg-primary hover:bg-primary/90">
                            <SaveIcon className="w-4 h-4 mr-2" />
                            {updateTpvMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
                          </Button>
                        </div>
                      )}
                    </form>
                  </Form>
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Additional Info */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Acciones Rápidas</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Status Actions */}
                  {isInMaintenance ? (
                    <Alert className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent">
                      <Wrench className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">En modo mantenimiento</span>
                          <Button
                            size="sm"
                            onClick={() => sendTpvCommand('EXIT_MAINTENANCE')}
                            disabled={commandMutation.isPending}
                            className="ml-2 bg-green-600 hover:bg-green-700 text-background  h-7 px-3 "
                          >
                            Reactivar
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : isInactive ? (
                    <Alert className="bg-muted text-muted-foreground border border-border">
                      <XIcon className="h-4 w-4" />
                      <AlertDescription>
                        <div className="flex items-center justify-between">
                          <span className="text-sm">Terminal inactivo</span>
                          <Button
                            size="sm"
                            onClick={() => sendTpvCommand('REACTIVATE')}
                            disabled={commandMutation.isPending}
                            className="ml-2 bg-green-600 hover:bg-green-700 text-background h-7 px-3"
                          >
                            Reactivar
                          </Button>
                        </div>
                      </AlertDescription>
                    </Alert>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full justify-start bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent"
                      onClick={() => sendTpvCommand('MAINTENANCE_MODE')}
                      disabled={!terminalOnline || commandMutation.isPending}
                    >
                      <Wrench className="w-4 h-4 mr-2" />
                      Activar Mantenimiento
                    </Button>
                  )}

                  <Button
                    variant="outline"
                    className="w-full justify-start"
                    onClick={() => sendTpvCommand('UPDATE_STATUS')}
                    disabled={!terminalOnline || commandMutation.isPending}
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    Actualizar Estado
                  </Button>
                </CardContent>
              </Card>

              {/* System Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Detalles del Sistema</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Venue ID</Label>
                      <p className="text-sm font-mono text-foreground mt-1 break-all">{tpv?.venueId}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Creado</Label>
                      <p className="text-sm text-foreground mt-1">
                        {tpv?.createdAt
                          ? new Date(tpv.createdAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">Última actualización</Label>
                      <p className="text-sm text-foreground mt-1">
                        {tpv?.updatedAt
                          ? new Date(tpv.updatedAt).toLocaleDateString('es-ES', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '-'}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
