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
import { useTranslation } from 'react-i18next'
import { PermissionGate } from '@/components/PermissionGate'

// Type for the form values
type TpvFormValues = {
  name: string
  serialNumber: string
  type?: string
  status?: string
  config?: string
}

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
  const { t } = useTranslation(['tpv', 'common'])
  const { tpvId } = useParams()
  const location = useLocation()
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [isEditing, setIsEditing] = useState(false)

  const tpvFormSchema = z.object({
    name: z.string().min(1, { message: t('detail.validation.nameRequired') }),
    serialNumber: z.string().min(1, { message: t('detail.validation.serialRequired') }),
    type: z.string().optional(),
    status: z.string().optional(),
    config: z.string().optional(),
  })

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
    if (!status) return { variant: 'secondary' as const, label: t('status.unknown'), icon: AlertCircle }

    const cutoff = new Date(Date.now() - 2 * 60 * 1000) // 2 minutes ago
    const isRecentHeartbeat = lastHeartbeat && new Date(lastHeartbeat) > cutoff

    switch (status) {
      case 'ACTIVE':
        if (isRecentHeartbeat) {
          return {
            variant: 'default' as const,
            label: t('status.online'),
            icon: Activity,
            className: 'bg-green-500/10 text-green-700 hover:bg-green-500/20 dark:text-green-400',
          }
        } else {
          return {
            variant: 'destructive' as const,
            label: t('status.offline'),
            icon: WifiOff,
            className: 'bg-destructive/10 text-destructive hover:bg-destructive/20',
          }
        }
      case 'MAINTENANCE':
        return {
          variant: 'secondary' as const,
          label: t('status.maintenance'),
          icon: Wrench,
          className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent',
        }
      case 'INACTIVE':
        return { variant: 'secondary' as const, label: t('status.inactive'), icon: XIcon }
      case 'RETIRED':
        return { variant: 'secondary' as const, label: t('status.retired'), icon: XIcon }
      default:
        return { variant: 'secondary' as const, label: t('status.unknown'), icon: AlertCircle }
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
        throw new Error(t('detail.errors.venueOrTpvUndefined'))
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
        title: t('detail.toast.updateSuccess'),
        description: t('detail.toast.updateSuccessDesc'),
      })
    },
    onError: error => {
      toast({
        title: t('common:error'),
        description: t('detail.errors.updateFailed'),
        variant: 'destructive',
      })
      console.error('Error updating TPV:', error)
    },
  })

  // Mutation for sending commands to TPV
  const commandMutation = useMutation({
    mutationFn: async ({ command, payload }: { command: string; payload?: any }) => {
      if (!tpvId) throw new Error(t('detail.errors.tpvIdUndefined'))
      const response = await api.post(`/api/v1/dashboard/tpv/${tpvId}/command`, { command, payload })
      return response.data
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('commands.sent'),
        description: t('commands.sentSuccess', { command: variables.command }),
      })
      // Refresh the TPV data to show updated status
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
    },
    onError: (error: any) => {
      toast({
        title: t('commands.error'),
        description: t('commands.sendError', { error: error.response?.data?.message || error.message }),
        variant: 'destructive',
      })
    },
  })

  const sendTpvCommand = (command: string) => {
    const payload = command === 'MAINTENANCE_MODE' ? { message: t('commands.maintenancePayload'), duration: 0 } : undefined

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
        <p className="text-muted-foreground">{t('detail.loading')}</p>
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
            <CardTitle className="text-xl">{t('detail.notFound')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              {t('detail.notFoundDesc')} <code className="bg-muted px-2 py-1 rounded text-sm">{tpvId}</code>
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate(-1)} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {t('common:goBack')}
              </Button>
              <Button onClick={() => navigate(`/venues/${venueId}/tpv`)} className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                {t('detail.goToTerminals')}
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
          <AlertDescription>{t('detail.errors.loadError')}</AlertDescription>
        </Alert>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            {t('common:goBack')}
          </Button>
          <Button onClick={() => window.location.reload()}>{t('common:tryAgain')}</Button>
        </div>
      </div>
    )
  }

  // If no TPV data and not loading/error, show not found
  if (!tpv) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <p className="text-muted-foreground">{t('detail.noData')}</p>
        <Button onClick={() => navigate(`/venues/${venueId}/tpv`)}>
          <Home className="h-4 w-4 mr-2" />
          {t('detail.goToTerminals')}
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
                    <h1 className="text-lg font-semibold text-foreground">{tpv?.name || t('detail.terminal')}</h1>
                    <p className="text-sm text-muted-foreground">{t('detail.id')}: {tpv?.id?.slice(-8) || 'N/A'}</p>
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
                          <p>{t('detail.tooltips.reactivate')}</p>
                        </TooltipContent>
                      </Tooltip>
                    ) : (
                      <Tooltip>
                        <TooltipTrigger asChild></TooltipTrigger>
                        <TooltipContent>
                          <p>{terminalOnline ? t('detail.tooltips.maintenanceMode') : t('actions.offline')}</p>
                        </TooltipContent>
                      </Tooltip>
                    )}

                    {/* Update Status Button */}
                    <PermissionGate permission="tpv:command">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendTpvCommand('UPDATE_STATUS')}
                            disabled={!terminalOnline || commandMutation.isPending}
                          >
                            <RefreshCw className="w-4 h-4 mr-2" />
                            {t('actions.update')}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>{terminalOnline ? t('detail.tooltips.updateStatus') : t('actions.offline')}</p>
                        </TooltipContent>
                      </Tooltip>
                    </PermissionGate>

                    {/* Edit Button */}
                    <PermissionGate permission="tpv:update">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setIsEditing(true)}
                        className="border-primary/30 text-primary hover:bg-primary/5"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        {t('common:edit')}
                      </Button>
                    </PermissionGate>
                  </div>
                )}

                {/* Save/Cancel Buttons when editing */}
                {isEditing && (
                  <PermissionGate permission="tpv:update">
                    <div className="flex items-center space-x-2">
                      <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                        <XIcon className="w-4 h-4 mr-2" />
                        {t('common:cancel')}
                      </Button>
                      <Button
                        size="sm"
                        onClick={form.handleSubmit(onSubmit)}
                        disabled={updateTpvMutation.isPending}
                        className="bg-primary hover:bg-primary/90"
                      >
                        <SaveIcon className="w-4 h-4 mr-2" />
                        {updateTpvMutation.isPending ? t('common:saving') : t('common:save')}
                      </Button>
                    </div>
                  </PermissionGate>
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
                    {t('detail.terminalStatus')}
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
                      <p className="text-sm text-muted-foreground">{t('detail.connection')}</p>
                      <p
                        className={`font-semibold ${
                          isInMaintenance
                            ? ' text-orange-800  dark:text-orange-400 border border-transparent'
                            : terminalOnline
                            ? 'text-green-600'
                            : 'text-destructive'
                        }`}
                      >
                        {isInMaintenance ? t('detail.inMaintenance') : terminalOnline ? t('detail.connected') : t('detail.disconnected')}
                      </p>
                    </div>

                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="flex justify-center mb-2">
                        <Clock className="w-8 h-8 text-blue-600" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('detail.lastContact')}</p>
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
                          t('detail.never')
                        )}
                      </p>
                    </div>

                    <div className="text-center p-4 rounded-lg bg-muted">
                      <div className="flex justify-center mb-2">
                        <Shield className="w-8 h-8 text-primary" />
                      </div>
                      <p className="text-sm text-muted-foreground">{t('detail.version')}</p>
                      <p className="font-semibold text-foreground">{tpv?.version || 'N/A'}</p>
                    </div>
                  </div>

                  {/* System Info */}
                  {tpv?.systemInfo && (
                    <div className="mt-6 pt-6 border-t border-border">
                      <h4 className="text-sm font-medium text-foreground mb-4">{t('detail.systemInfo')}</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {tpv.systemInfo.platform && (
                          <div className="flex items-center space-x-2">
                            <Cpu className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('detail.platform')}:</span>
                            <span className="text-sm font-mono text-foreground">{tpv.systemInfo.platform}</span>
                          </div>
                        )}

                        {tpv.systemInfo.memory && (
                          <div className="flex items-center space-x-2">
                            <MemoryStick className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('detail.memory')}:</span>
                            <span className="text-sm font-mono text-foreground">
                              {formatBytes(tpv.systemInfo.memory.used)} / {formatBytes(tpv.systemInfo.memory.total)}
                            </span>
                          </div>
                        )}

                        {tpv.systemInfo.uptime && (
                          <div className="flex items-center space-x-2">
                            <Zap className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('detail.uptime')}:</span>
                            <span className="text-sm font-mono text-foreground">{formatUptime(tpv.systemInfo.uptime)}</span>
                          </div>
                        )}

                        {tpv?.ipAddress && (
                          <div className="flex items-center space-x-2">
                            <Wifi className="w-4 h-4 text-muted-foreground" />
                            <span className="text-sm text-muted-foreground">{t('detail.ip')}:</span>
                            <span className="text-sm font-mono text-foreground">{tpv.ipAddress}</span>
                          </div>
                        )}
                      </div>

                      {/* Memory Usage Progress */}
                      {tpv.systemInfo.memory && tpv.systemInfo.memory.total > 0 && (
                        <div className="mt-4">
                          <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-muted-foreground">{t('detail.memoryUsage')}</span>
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
                    {t('detail.terminalInfo')}
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
                              <FormLabel className="text-sm font-medium">{t('detail.terminalName')}</FormLabel>
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
                          <Label className="text-sm font-medium text-foreground">{t('detail.systemId')}</Label>
                          <Input value={tpv?.id || ''} disabled className="bg-muted font-mono text-sm mt-2" />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <FormField
                          control={form.control}
                          name="serialNumber"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel className="text-sm font-medium">{t('detail.serialNumber')}</FormLabel>
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
                              <FormLabel className="text-sm font-medium">{t('detail.terminalType')}</FormLabel>
                              <FormControl>
                                {isEditing ? (
                                  <Select onValueChange={field.onChange} value={field.value || ''} defaultValue={field.value || ''}>
                                    <SelectTrigger className="border-primary/50 focus:border-primary">
                                      <SelectValue placeholder={t('detail.selectType')} />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="TPV_ANDROID">{t('detail.types.tpvAndroid')}</SelectItem>
                                      <SelectItem value="TPV_IOS">{t('detail.types.tpvIOS')}</SelectItem>
                                      <SelectItem value="PRINTER_RECEIPT">{t('detail.types.printerReceipt')}</SelectItem>
                                      <SelectItem value="PRINTER_KITCHEN">{t('detail.types.printerKitchen')}</SelectItem>
                                      <SelectItem value="KDS">{t('detail.types.kds')}</SelectItem>
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input value={field.value || t('detail.notSpecified')} disabled className="bg-muted" />
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
                          {t('detail.advancedConfig')}
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
                                    <p className="text-sm text-muted-foreground">{t('detail.noConfig')}</p>
                                  </div>
                                )}
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {isEditing && (
                        <PermissionGate permission="tpv:update">
                          <div className="flex justify-end space-x-3 pt-6 border-t border-border">
                            <Button type="button" variant="outline" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                              <XIcon className="w-4 h-4 mr-2" />
                              {t('common:cancel')}
                            </Button>
                            <Button type="submit" disabled={updateTpvMutation.isPending} className="bg-primary hover:bg-primary/90">
                              <SaveIcon className="w-4 h-4 mr-2" />
                              {updateTpvMutation.isPending ? t('common:saving') : t('detail.saveChanges')}
                            </Button>
                          </div>
                        </PermissionGate>
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
                  <CardTitle className="text-lg">{t('detail.quickActions')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  {/* Status Actions */}
                  <PermissionGate permission="tpv:command">
                    {isInMaintenance ? (
                      <Alert className="bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border border-transparent">
                        <Wrench className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{t('detail.alerts.inMaintenanceMode')}</span>
                            <Button
                              size="sm"
                              onClick={() => sendTpvCommand('EXIT_MAINTENANCE')}
                              disabled={commandMutation.isPending}
                              className="ml-2 bg-green-600 hover:bg-green-700 text-background  h-7 px-3 "
                            >
                              {t('detail.alerts.reactivate')}
                            </Button>
                          </div>
                        </AlertDescription>
                      </Alert>
                    ) : isInactive ? (
                      <Alert className="bg-muted text-muted-foreground border border-border">
                        <XIcon className="h-4 w-4" />
                        <AlertDescription>
                          <div className="flex items-center justify-between">
                            <span className="text-sm">{t('detail.alerts.terminalInactive')}</span>
                            <Button
                              size="sm"
                              onClick={() => sendTpvCommand('REACTIVATE')}
                              disabled={commandMutation.isPending}
                              className="ml-2 bg-green-600 hover:bg-green-700 text-background h-7 px-3"
                            >
                              {t('detail.alerts.reactivate')}
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
                        {t('detail.activateMaintenance')}
                      </Button>
                    )}
                  </PermissionGate>

                  <PermissionGate permission="tpv:command">
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => sendTpvCommand('UPDATE_STATUS')}
                      disabled={!terminalOnline || commandMutation.isPending}
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      {t('detail.updateStatus')}
                    </Button>
                  </PermissionGate>
                </CardContent>
              </Card>

              {/* System Details */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">{t('detail.systemDetails')}</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                  <div className="grid grid-cols-1 gap-4">
                    <div className="p-3 rounded-lg bg-muted">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t('detail.venueId')}</Label>
                      <p className="text-sm font-mono text-foreground mt-1 break-all">{tpv?.venueId}</p>
                    </div>

                    <div className="p-3 rounded-lg bg-muted">
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t('detail.created')}</Label>
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
                      <Label className="text-xs text-muted-foreground uppercase tracking-wider">{t('detail.lastUpdate')}</Label>
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
