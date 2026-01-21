import api from '@/api'
import { PermissionGate } from '@/components/PermissionGate'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricCard } from '@/components/ui/metric-card'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useSocket } from '@/context/SocketContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { TpvSettingsForm } from '@/pages/Settings/components/TpvSettingsForm'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { generateActivationCode } from '@/services/tpv.service'
import { StaffRole } from '@/types'
import { getIntlLocale } from '@/utils/i18n-locale'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ChevronRight,
  Clock,
  Cpu,
  CreditCard,
  Home,
  Info,
  Key,
  Link2,
  Loader2,
  Lock,
  LockOpen,
  MemoryStick,
  PencilIcon,
  RefreshCw,
  SaveIcon,
  Settings,
  Shield,
  Unlink,
  Wifi,
  WifiOff,
  Wrench,
  XIcon,
  Zap,
} from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import * as z from 'zod'
import { ActivationCodeDialog } from './ActivationCodeDialog'
import { CommandHistoryTable } from './components/CommandHistoryTable'
import { RemoteCommandPanel } from './components/RemoteCommandPanel'

// Valid tab values for URL hash
const VALID_TABS = ['info', 'commands', 'settings'] as const
type TabValue = (typeof VALID_TABS)[number]

// Type for the form values
type TpvFormValues = {
  name: string
  serialNumber: string
  type?: string
  brand?: string
  model?: string
  status?: string
  config?: string
}

interface TpvData {
  id: string
  name: string
  serialNumber: string
  type?: string
  brand?: string // Hardware manufacturer (PAX, Ingenico, etc.)
  model?: string // Hardware model (A910S, D220, etc.)
  status?: string
  lastHeartbeat?: string
  config?: any // JSON field
  venueId: string
  createdAt?: string
  updatedAt?: string
  version?: string
  ipAddress?: string
  activatedAt?: string | null // 🆕 Activation timestamp (null = not activated)
  isLocked?: boolean // 🆕 Whether terminal is remotely locked
  lockReason?: string | null // 🆕 Why terminal was locked
  lockedAt?: string | null // 🆕 When terminal was locked
  lockedBy?: string | null // 🆕 StaffId who locked
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
  const { t, i18n } = useTranslation(['tpv', 'common'])
  const { tpvId } = useParams()
  const location = useLocation()
  const { venueId, venueSlug, venue, fullBasePath } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { user } = useAuth()
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('info')
  const [pendingCommand, setPendingCommand] = useState<string | null>(null)
  const [merchantAccountToLink, setMerchantAccountToLink] = useState<string>('')
  const [isLinkingMerchant, setIsLinkingMerchant] = useState(false)
  const [isUnlinkingMerchant, setIsUnlinkingMerchant] = useState<string | null>(null)

  // Sync tab state with URL hash
  useEffect(() => {
    const syncTabFromHash = () => {
      const hash = window.location.hash.replace('#', '')
      if (VALID_TABS.includes(hash as TabValue)) {
        setActiveTab(hash as TabValue)
      }
    }

    // Set initial tab from hash on mount
    syncTabFromHash()

    // Listen for hash changes (browser back/forward)
    window.addEventListener('hashchange', syncTabFromHash)
    return () => window.removeEventListener('hashchange', syncTabFromHash)
  }, [])

  // Update URL hash when tab changes
  const handleTabChange = useCallback((value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    window.history.replaceState(null, '', `#${tab}`)
  }, [])

  // Socket.IO listeners for real-time updates (Toast/Square pattern)
  // Commands are delivered via HTTP polling, but status updates come via Socket.IO
  useEffect(() => {
    if (!socket || !venueId || !tpvId) return

    // Join venue room for real-time updates
    joinVenueRoom(venueId)

    // Listen for command status changes
    const handleCommandStatusChanged = (data: { commandId: string; terminalId: string; newStatus: string; resultStatus?: string }) => {
      // Only invalidate if this event is for our terminal
      if (data.terminalId === tpvId) {
        // Invalidate command history query to refresh the table
        queryClient.invalidateQueries({ queryKey: ['commandHistory', venueId, tpvId] })
      }
    }

    // Listen for terminal status updates
    const handleTerminalStatusUpdate = (data: { terminalId: string; status: string; lastHeartbeat?: string }) => {
      // Only invalidate if this event is for our terminal
      if (data.terminalId === tpvId) {
        // Invalidate terminal data query to refresh status badge
        queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
      }
    }

    socket.on('tpv_command_status_changed', handleCommandStatusChanged)
    socket.on('tpv_status_update', handleTerminalStatusUpdate)

    return () => {
      socket.off('tpv_command_status_changed', handleCommandStatusChanged)
      socket.off('tpv_status_update', handleTerminalStatusUpdate)
      leaveVenueRoom(venueId)
    }
  }, [socket, venueId, tpvId, queryClient, joinVenueRoom, leaveVenueRoom])

  const [activationDialogOpen, setActivationDialogOpen] = useState(false)
  const [activationData, setActivationData] = useState<{
    activationCode: string
    expiresAt: string
    expiresIn: number
    serialNumber: string
    venueName: string
    venueId?: string
    terminalId?: string
  } | null>(null)

  const tpvFormSchema = z.object({
    name: z.string().min(1, { message: t('detail.validation.nameRequired') }),
    serialNumber: z.string().min(1, { message: t('detail.validation.serialRequired') }),
    type: z.string().optional(),
    brand: z.string().optional(),
    model: z.string().optional(),
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
      brand: '',
      model: '',
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
    // Terminal is "online" if it has a recent heartbeat AND status is ACTIVE or MAINTENANCE
    // MAINTENANCE means the terminal IS connected (socket + heartbeat working), just in a special mode
    // Only truly "offline" if no recent heartbeat OR status is INACTIVE/RETIRED
    const isConnectedStatus = status === 'ACTIVE' || status === 'MAINTENANCE'
    return isConnectedStatus && lastHeartbeat && new Date(lastHeartbeat) > cutoff
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
  // Toast/Square pattern: Socket.IO for real-time + polling fallback every 10s
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
    refetchInterval: 60000, // 60s fallback polling (Socket.IO handles real-time via tpv_status_update)
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 error
      if (error?.response?.status === 404) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
  })

  // SUPERADMIN: Fetch terminal details with assignedMerchantIds
  const { data: terminalDetails, refetch: refetchTerminalDetails } = useQuery({
    queryKey: ['superadmin-terminal', tpvId],
    queryFn: () => terminalAPI.getTerminalById(tpvId!),
    enabled: isSuperAdmin && Boolean(tpvId),
  })

  // SUPERADMIN: Fetch all merchant accounts (they are global, not per-venue)
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: isSuperAdmin,
  })

  // Get assigned merchant accounts (full objects)
  const assignedMerchantIds = terminalDetails?.assignedMerchantIds || []
  const assignedMerchantAccounts = merchantAccounts.filter((m: MerchantAccount) => assignedMerchantIds.includes(m.id))
  const availableMerchantAccounts = merchantAccounts.filter((m: MerchantAccount) => !assignedMerchantIds.includes(m.id))

  // SUPERADMIN: Link merchant account to terminal
  const handleLinkMerchantAccount = async () => {
    if (!merchantAccountToLink || !tpvId) return
    setIsLinkingMerchant(true)
    try {
      const newMerchantIds = [...assignedMerchantIds, merchantAccountToLink]
      await terminalAPI.updateTerminal(tpvId, { assignedMerchantIds: newMerchantIds })
      refetchTerminalDetails()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Cuenta vinculada',
        description: 'La cuenta de comercio se ha asignado a la terminal',
      })
      setMerchantAccountToLink('')
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo vincular la cuenta de comercio',
      })
    } finally {
      setIsLinkingMerchant(false)
    }
  }

  // SUPERADMIN: Unlink merchant account from terminal
  const handleUnlinkMerchantAccount = async (merchantId: string) => {
    if (!tpvId) return
    setIsUnlinkingMerchant(merchantId)
    try {
      const newMerchantIds = assignedMerchantIds.filter((id: string) => id !== merchantId)
      await terminalAPI.updateTerminal(tpvId, { assignedMerchantIds: newMerchantIds })
      refetchTerminalDetails()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Cuenta desvinculada',
        description: 'La cuenta de comercio se ha removido de la terminal',
      })
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo desvincular la cuenta de comercio',
      })
    } finally {
      setIsUnlinkingMerchant(null)
    }
  }

  useEffect(() => {
    if (tpv) {
      form.reset({
        name: tpv.name || '',
        serialNumber: tpv.serialNumber || '',
        type: tpv.type || '',
        brand: tpv.brand || '',
        model: tpv.model || '',
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
    setPendingCommand(command)
    const payload = command === 'MAINTENANCE_MODE' ? { message: t('commands.maintenancePayload'), duration: 0 } : undefined

    commandMutation.mutate(
      { command, payload },
      {
        onSettled: () => {
          setPendingCommand(null)
        },
      },
    )
  }

  // Mutation for generating activation code
  const generateActivationCodeMutation = useMutation({
    mutationFn: async () => {
      if (!venueId || !tpvId) {
        throw new Error(t('detail.errors.venueOrTpvUndefined'))
      }
      return generateActivationCode(venueId, tpvId)
    },
    onSuccess: data => {
      setActivationData({
        activationCode: data.activationCode,
        expiresAt: data.expiresAt,
        expiresIn: data.expiresIn,
        serialNumber: tpv?.serialNumber || '',
        venueName: data.venueName || '',
        venueId: venueId,
        terminalId: tpvId,
      })
      setActivationDialogOpen(true)
      toast({
        title: t('activation.generateSuccess'),
      })
    },
    onError: (error: any) => {
      toast({
        title: t('activation.generateError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  // Mutation for deactivating TPV (clear activatedAt)
  const deactivateTpvMutation = useMutation({
    mutationFn: async () => {
      if (!venueId || !tpvId) {
        throw new Error(t('detail.errors.venueOrTpvUndefined'))
      }
      const response = await api.patch(`/api/v1/dashboard/venues/${venueId}/tpv/${tpvId}/deactivate`)
      return response.data
    },
    onSuccess: () => {
      toast({
        title: t('detail.deactivateSuccess'),
        description: t('detail.deactivateSuccessDesc'),
      })
      // Refresh TPV data
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
    },
    onError: (error: any) => {
      toast({
        title: t('detail.deactivateError'),
        description: error.response?.data?.message || error.message,
        variant: 'destructive',
      })
    },
  })

  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)

  const handleDeactivate = () => {
    deactivateTpvMutation.mutate()
    setShowDeactivateDialog(false)
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
        brand: tpv.brand || '',
        model: tpv.model || '',
        status: tpv.status || '',
        config: tpv.config ? JSON.stringify(tpv.config, null, 2) : '',
      })
    }
    setIsEditing(false)
  }

  const from = (location.state as any)?.from || `${fullBasePath}/tpv`

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
              <Button onClick={() => navigate(`${fullBasePath}/tpv`)} className="flex items-center gap-2">
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
        <Button onClick={() => navigate(`${fullBasePath}/tpv`)}>
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
                  <div>
                    <h1 className="text-lg font-semibold text-foreground">{tpv?.name || t('detail.terminal')}</h1>
                    <p className="text-sm text-muted-foreground">
                      {t('detail.id')}: {tpv?.id?.slice(-8) || 'N/A'}
                    </p>
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
          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            {/* Pill-style Tabs */}
            <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
              <TabsTrigger
                value="info"
                className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
              >
                {t('common:information', 'Información')}
              </TabsTrigger>
              <TabsTrigger
                value="commands"
                className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
              >
                {t('commands.remoteCommands')}
              </TabsTrigger>
              <PermissionGate permission="tpv:update">
                <TabsTrigger
                  value="settings"
                  className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
                >
                  {t('tpvSettings.title')}
                </TabsTrigger>
              </PermissionGate>
            </TabsList>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              {/* Status Metrics - Stack on mobile, 4 columns on desktop */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <MetricCard
                  label={t('detail.connection')}
                  value={isInMaintenance ? t('detail.inMaintenance') : terminalOnline ? t('detail.connected') : t('detail.disconnected')}
                  icon={
                    isInMaintenance ? (
                      <Wrench className="w-4 h-4" />
                    ) : terminalOnline ? (
                      <Wifi className="w-4 h-4" />
                    ) : (
                      <WifiOff className="w-4 h-4" />
                    )
                  }
                  accent={isInMaintenance ? 'orange' : terminalOnline ? 'green' : 'red'}
                />
                <MetricCard
                  label={t('detail.registration', { defaultValue: 'Registro' })}
                  value={
                    tpv?.activatedAt
                      ? t('detail.registered', { defaultValue: 'Registrado' })
                      : t('detail.pendingRegistration', { defaultValue: 'Pendiente' })
                  }
                  icon={<Key className="w-4 h-4" />}
                  accent={tpv?.activatedAt ? 'green' : 'yellow'}
                />
                <MetricCard
                  label={t('detail.lastContact')}
                  value={
                    tpv?.lastHeartbeat
                      ? DateTime.fromISO(tpv.lastHeartbeat, { zone: 'utc' })
                          .setZone(venueTimezone)
                          .setLocale(getIntlLocale(i18n.language))
                          .toRelative() || '-'
                      : t('detail.never')
                  }
                  icon={<Clock className="w-4 h-4" />}
                  accent="blue"
                />
                <MetricCard
                  label={t('detail.version')}
                  value={tpv?.version || 'N/A'}
                  icon={<Shield className="w-4 h-4" />}
                  accent="purple"
                />
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Left Column - Main Info */}
                <div className="xl:col-span-2 space-y-6">
                  {/* System Info - Collapsible */}
                  {tpv?.systemInfo && (
                    <Collapsible defaultOpen>
                      <GlassCard>
                        <CollapsibleTrigger asChild>
                          <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                            <div className="flex items-center gap-3">
                              <div className="p-2 rounded-xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
                                <Cpu className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                              </div>
                              <div>
                                <h3 className="font-medium text-sm">{t('detail.systemInfo')}</h3>
                                <p className="text-xs text-muted-foreground">{tpv.systemInfo.platform || 'Android'}</p>
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
                          </div>
                        </CollapsibleTrigger>
                        <CollapsibleContent>
                          <div className="px-4 pb-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {tpv.systemInfo.platform && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <Cpu className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{t('detail.platform')}</span>
                                  </div>
                                  <span className="text-sm font-mono text-foreground">{tpv.systemInfo.platform}</span>
                                </div>
                              )}

                              {tpv?.ipAddress && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <Wifi className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{t('detail.ip')}</span>
                                  </div>
                                  <span className="text-sm font-mono text-foreground">{tpv.ipAddress}</span>
                                </div>
                              )}

                              {tpv.systemInfo.uptime && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <Zap className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{t('detail.uptime')}</span>
                                  </div>
                                  <span className="text-sm font-mono text-foreground">{formatUptime(tpv.systemInfo.uptime)}</span>
                                </div>
                              )}

                              {tpv.systemInfo.memory && (
                                <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                                  <div className="flex items-center gap-2">
                                    <MemoryStick className="w-4 h-4 text-muted-foreground" />
                                    <span className="text-sm text-muted-foreground">{t('detail.memory')}</span>
                                  </div>
                                  <span className="text-sm font-mono text-foreground">
                                    {formatBytes(tpv.systemInfo.memory.used)} / {formatBytes(tpv.systemInfo.memory.total)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Memory Usage Progress */}
                            {tpv.systemInfo.memory && tpv.systemInfo.memory.total > 0 && (
                              <div className="p-3 rounded-xl bg-muted/50">
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
                        </CollapsibleContent>
                      </GlassCard>
                    </Collapsible>
                  )}

                  {/* Terminal Configuration - GlassCard style matching System Info */}
                  <Collapsible defaultOpen>
                    <GlassCard>
                      <CollapsibleTrigger asChild>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                              <Settings className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-medium text-sm">{t('detail.terminalInfo')}</h3>
                              <p className="text-xs text-muted-foreground">{tpv?.name || 'Terminal'}</p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-4">
                          <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
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
                                  render={({ field }) => {
                                    // Map enum values to translations
                                    const typeTranslations: Record<string, string> = {
                                      TPV_ANDROID: t('detail.types.tpvAndroid'),
                                      TPV_IOS: t('detail.types.tpvIOS'),
                                      PRINTER_RECEIPT: t('detail.types.printerReceipt'),
                                      PRINTER_KITCHEN: t('detail.types.printerKitchen'),
                                      KDS: t('detail.types.kds'),
                                    }
                                    const displayValue = field.value
                                      ? typeTranslations[field.value] || field.value
                                      : t('detail.notSpecified')

                                    return (
                                      <FormItem>
                                        <FormLabel className="text-sm font-medium">{t('detail.terminalType')}</FormLabel>
                                        <FormControl>
                                          {isEditing ? (
                                            <Select
                                              onValueChange={field.onChange}
                                              value={field.value || ''}
                                              defaultValue={field.value || ''}
                                            >
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
                                            <Input value={displayValue} disabled className="bg-muted" />
                                          )}
                                        </FormControl>
                                        <FormMessage />
                                      </FormItem>
                                    )
                                  }}
                                />

                                {/* Status Selector - SUPERADMIN Only */}
                                {isSuperAdmin && (
                                  <FormField
                                    control={form.control}
                                    name="status"
                                    render={({ field }) => {
                                      // Map enum values to translations
                                      const statusTranslations: Record<string, string> = {
                                        ACTIVE: t('detail.statusOptions.active'),
                                        INACTIVE: t('detail.statusOptions.inactive'),
                                        MAINTENANCE: t('detail.statusOptions.maintenance'),
                                        RETIRED: t('detail.statusOptions.retired'),
                                      }
                                      const displayValue = field.value
                                        ? statusTranslations[field.value] || field.value
                                        : t('detail.notSpecified')

                                      return (
                                        <FormItem>
                                          <FormLabel className="text-sm font-medium">{t('detail.terminalStatus')}</FormLabel>
                                          <FormControl>
                                            {isEditing ? (
                                              <Select
                                                onValueChange={field.onChange}
                                                value={field.value || 'ACTIVE'}
                                                defaultValue={field.value || 'ACTIVE'}
                                              >
                                                <SelectTrigger className="border-primary/50 focus:border-primary">
                                                  <SelectValue placeholder={t('detail.selectStatus')} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                  <SelectItem value="ACTIVE">{t('detail.statusOptions.active')}</SelectItem>
                                                  <SelectItem value="INACTIVE">{t('detail.statusOptions.inactive')}</SelectItem>
                                                  <SelectItem value="MAINTENANCE">{t('detail.statusOptions.maintenance')}</SelectItem>
                                                  <SelectItem value="RETIRED">{t('detail.statusOptions.retired')}</SelectItem>
                                                </SelectContent>
                                              </Select>
                                            ) : (
                                              <Input value={displayValue} disabled className="bg-muted" />
                                            )}
                                          </FormControl>
                                          <FormMessage />
                                          {field.value === 'RETIRED' && (
                                            <p className="text-xs text-muted-foreground mt-1">⚠️ {t('detail.retiredWarning')}</p>
                                          )}
                                        </FormItem>
                                      )
                                    }}
                                  />
                                )}
                              </div>

                              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <FormField
                                  control={form.control}
                                  name="brand"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">{t('detail.brand')}</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          disabled={!isEditing}
                                          placeholder={t('detail.brandPlaceholder')}
                                          className={isEditing ? 'border-primary/50 focus:border-primary' : 'bg-muted'}
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />

                                <FormField
                                  control={form.control}
                                  name="model"
                                  render={({ field }) => (
                                    <FormItem>
                                      <FormLabel className="text-sm font-medium">{t('detail.model')}</FormLabel>
                                      <FormControl>
                                        <Input
                                          {...field}
                                          disabled={!isEditing}
                                          placeholder={t('detail.modelPlaceholder')}
                                          className={isEditing ? 'border-primary/50 focus:border-primary' : 'bg-muted'}
                                        />
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
                        </div>
                      </CollapsibleContent>
                    </GlassCard>
                  </Collapsible>
                </div>

                {/* Right Column - Additional Info */}
                <div className="space-y-6">
                  {/* Quick Actions */}
                  <GlassCard className="p-0">
                    <div className="p-4 border-b border-border/50">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
                          <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="font-semibold text-sm">{t('detail.quickActions')}</h3>
                      </div>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Maintenance Mode Toggle */}
                      <PermissionGate permission="tpv:command">
                        <div
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            isInMaintenance ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {pendingCommand === 'MAINTENANCE_MODE' || pendingCommand === 'EXIT_MAINTENANCE' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
                            ) : (
                              <Wrench
                                className={`w-5 h-5 ${isInMaintenance ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'}`}
                              />
                            )}
                            <div>
                              <p
                                className={`text-sm font-medium ${
                                  isInMaintenance ? 'text-orange-800 dark:text-orange-400' : 'text-foreground'
                                }`}
                              >
                                {pendingCommand === 'MAINTENANCE_MODE' || pendingCommand === 'EXIT_MAINTENANCE'
                                  ? t('common:loading')
                                  : t('actions.maintenance')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {isInMaintenance ? t('detail.alerts.inMaintenanceMode') : t('detail.tooltips.maintenanceMode')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={isInMaintenance}
                            onCheckedChange={checked => {
                              if (checked) {
                                sendTpvCommand('MAINTENANCE_MODE')
                              } else {
                                sendTpvCommand('EXIT_MAINTENANCE')
                              }
                            }}
                            disabled={(!terminalOnline && !isInMaintenance) || commandMutation.isPending}
                            className="data-[state=checked]:bg-orange-500"
                          />
                        </div>
                      </PermissionGate>

                      {/* Lock Toggle */}
                      <PermissionGate permission="tpv:command">
                        <div
                          className={`flex items-center justify-between p-3 rounded-lg ${
                            tpv?.isLocked ? 'bg-red-100 dark:bg-red-900/30' : 'bg-muted'
                          }`}
                        >
                          <div className="flex items-center space-x-3">
                            {pendingCommand === 'LOCK' || pendingCommand === 'UNLOCK' ? (
                              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                            ) : tpv?.isLocked ? (
                              <Lock className="w-5 h-5 text-red-600 dark:text-red-400" />
                            ) : (
                              <LockOpen className="w-5 h-5 text-muted-foreground" />
                            )}
                            <div>
                              <p className={`text-sm font-medium ${tpv?.isLocked ? 'text-red-800 dark:text-red-400' : 'text-foreground'}`}>
                                {pendingCommand === 'LOCK' || pendingCommand === 'UNLOCK'
                                  ? t('common:loading')
                                  : tpv?.isLocked
                                    ? t('actions.locked')
                                    : t('actions.unlocked')}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {tpv?.isLocked ? t('detail.tooltips.unlock') : t('detail.tooltips.lock')}
                              </p>
                            </div>
                          </div>
                          <Switch
                            checked={tpv?.isLocked ?? false}
                            onCheckedChange={checked => {
                              if (checked) {
                                sendTpvCommand('LOCK')
                              } else {
                                sendTpvCommand('UNLOCK')
                              }
                            }}
                            disabled={!terminalOnline || commandMutation.isPending}
                            className="data-[state=checked]:bg-red-500"
                          />
                        </div>
                      </PermissionGate>

                      {/* Terminal status alert - only show if status is INACTIVE (different from disconnected) */}
                      {isInactive && (
                        <Alert className="bg-muted text-muted-foreground border border-border">
                          <XIcon className="h-4 w-4" />
                          <AlertDescription>
                            <span className="text-sm">
                              {t('detail.alerts.terminalDisabled', { defaultValue: 'Terminal deshabilitado por administrador' })}
                            </span>
                          </AlertDescription>
                        </Alert>
                      )}

                      {/* Separator before secondary actions */}
                      <div className="pt-4 space-y-3">
                        <PermissionGate permission="tpv:update">
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="outline"
                                  className="w-full justify-start"
                                  onClick={() => generateActivationCodeMutation.mutate()}
                                  disabled={generateActivationCodeMutation.isPending || !!tpv?.activatedAt}
                                >
                                  <Key className="w-4 h-4 mr-2" />
                                  {generateActivationCodeMutation.isPending ? t('common:loading') : t('actions.generateCode')}
                                </Button>
                              </TooltipTrigger>
                              {tpv?.activatedAt && (
                                <TooltipContent>
                                  <p>{t('activation.alreadyActivatedTooltip')}</p>
                                </TooltipContent>
                              )}
                            </Tooltip>
                          </TooltipProvider>
                        </PermissionGate>

                        {isSuperAdmin && tpv?.activatedAt && (
                          <Button
                            variant="outline"
                            className="w-full justify-start text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:text-orange-400 dark:hover:bg-orange-950/30"
                            onClick={() => setShowDeactivateDialog(true)}
                            disabled={deactivateTpvMutation.isPending}
                          >
                            <Wrench className="w-4 h-4 mr-2" />
                            {deactivateTpvMutation.isPending ? t('actions.deactivating') : t('actions.deactivate')}
                          </Button>
                        )}
                      </div>
                    </div>
                  </GlassCard>

                  {/* SUPERADMIN: Merchant Accounts Card */}
                  {isSuperAdmin && (
                    <GlassCard className="border-amber-200/50 dark:border-amber-800/30">
                      <div className="p-4 border-b border-border/50 bg-gradient-to-r from-amber-400/10 to-pink-500/10 rounded-t-2xl">
                        <div className="flex items-center gap-3">
                          <div className="p-2 rounded-xl bg-gradient-to-br from-amber-400/20 to-pink-500/20">
                            <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                          </div>
                          <h3 className="font-semibold text-sm">Cuentas de Comercio</h3>
                          <Badge variant="outline" className="ml-auto text-xs border-amber-400 text-amber-600 dark:text-amber-400">
                            {assignedMerchantAccounts.length}
                          </Badge>
                        </div>
                      </div>
                      <div className="p-4 space-y-4">
                        {/* Assigned Merchant Accounts */}
                        {assignedMerchantAccounts.length > 0 ? (
                          <div className="space-y-2">
                            {assignedMerchantAccounts.map((account: MerchantAccount) => (
                              <div key={account.id} className="flex items-center justify-between p-3 rounded-lg bg-muted">
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-400/20 to-pink-500/20">
                                    <CreditCard className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-sm font-medium truncate">{account.displayName || account.externalMerchantId}</p>
                                    <p className="text-xs text-muted-foreground">{account.provider?.name || 'Proveedor desconocido'}</p>
                                  </div>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUnlinkMerchantAccount(account.id)}
                                  disabled={isUnlinkingMerchant === account.id}
                                  className="text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                                >
                                  {isUnlinkingMerchant === account.id ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <Unlink className="w-4 h-4" />
                                  )}
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-4 text-center border-2 border-dashed border-border rounded-lg">
                            <CreditCard className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                            <p className="text-sm text-muted-foreground">No hay cuentas de comercio asignadas</p>
                          </div>
                        )}

                        {/* Add Merchant Account - Always show dropdown section */}
                        <div className="pt-3 border-t border-border space-y-3">
                          <Label className="text-sm font-medium">Vincular cuenta</Label>
                          <Select
                            value={merchantAccountToLink}
                            onValueChange={setMerchantAccountToLink}
                            disabled={availableMerchantAccounts.length === 0}
                          >
                            <SelectTrigger className={availableMerchantAccounts.length === 0 ? 'opacity-60' : ''}>
                              <SelectValue
                                placeholder={
                                  merchantAccounts.length === 0
                                    ? 'No hay cuentas en el venue'
                                    : availableMerchantAccounts.length === 0
                                      ? 'Todas las cuentas ya están asignadas'
                                      : 'Seleccionar cuenta...'
                                }
                              />
                            </SelectTrigger>
                            <SelectContent>
                              {availableMerchantAccounts.map((account: MerchantAccount) => (
                                <SelectItem key={account.id} value={account.id}>
                                  {account.displayName || account.externalMerchantId} ({account.provider?.name})
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            className="w-full bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground disabled:opacity-50"
                            onClick={handleLinkMerchantAccount}
                            disabled={!merchantAccountToLink || isLinkingMerchant || availableMerchantAccounts.length === 0}
                          >
                            {isLinkingMerchant ? (
                              <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Vinculando...
                              </>
                            ) : (
                              <>
                                <Link2 className="w-4 h-4 mr-2" />
                                Vincular Cuenta
                              </>
                            )}
                          </Button>

                          {/* Hint when no merchant accounts exist in venue */}
                          {merchantAccounts.length === 0 && (
                            <p className="text-xs text-muted-foreground text-center">
                              <Link
                                to={`${fullBasePath}/merchant-accounts`}
                                className="text-amber-600 dark:text-amber-400 underline hover:text-amber-700"
                              >
                                Crear cuenta de comercio
                              </Link>{' '}
                              para poder vincularla
                            </p>
                          )}
                        </div>
                      </div>
                    </GlassCard>
                  )}

                  {/* System Details - Collapsible */}
                  <Collapsible defaultOpen>
                    <GlassCard>
                      <CollapsibleTrigger asChild>
                        <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
                          <div className="flex items-center gap-3">
                            <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
                              <Clock className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                            </div>
                            <div>
                              <h3 className="font-medium text-sm">{t('detail.systemDetails')}</h3>
                              <p className="text-xs text-muted-foreground">
                                {tpv?.activatedAt ? t('detail.activated') : t('detail.pendingActivation')}
                              </p>
                            </div>
                          </div>
                          <ChevronRight className="w-4 h-4 text-muted-foreground transition-transform data-[state=open]:rotate-90" />
                        </div>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="px-4 pb-4 space-y-4">
                          <div className="grid grid-cols-1 gap-3">
                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                              <span className="text-sm text-muted-foreground">{t('detail.created')}</span>
                              <span className="text-sm text-foreground">
                                {tpv?.createdAt
                                  ? DateTime.fromISO(tpv.createdAt, { zone: 'utc' })
                                      .setZone(venueTimezone)
                                      .setLocale(getIntlLocale(i18n.language))
                                      .toLocaleString({
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                  : '-'}
                              </span>
                            </div>

                            <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
                              <span className="text-sm text-muted-foreground">{t('detail.lastUpdate')}</span>
                              <span className="text-sm text-foreground">
                                {tpv?.updatedAt
                                  ? DateTime.fromISO(tpv.updatedAt, { zone: 'utc' })
                                      .setZone(venueTimezone)
                                      .setLocale(getIntlLocale(i18n.language))
                                      .toRelative()
                                  : '-'}
                              </span>
                            </div>

                            <div
                              className={`flex items-center justify-between p-3 rounded-xl ${
                                tpv?.activatedAt
                                  ? 'bg-green-500/10 border border-green-500/20'
                                  : 'bg-yellow-500/10 border border-yellow-500/20'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <Key className="w-4 h-4 text-muted-foreground" />
                                <span className="text-sm text-muted-foreground">{t('detail.activatedOn')}</span>
                              </div>
                              <span
                                className={`text-sm font-medium ${
                                  tpv?.activatedAt ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
                                }`}
                              >
                                {tpv?.activatedAt
                                  ? DateTime.fromISO(tpv.activatedAt, { zone: 'utc' })
                                      .setZone(venueTimezone)
                                      .setLocale(getIntlLocale(i18n.language))
                                      .toLocaleString({
                                        year: 'numeric',
                                        month: 'short',
                                        day: 'numeric',
                                      })
                                  : t('detail.pendingActivation')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    </GlassCard>
                  </Collapsible>
                </div>
              </div>
            </TabsContent>

            {/* Commands Tab */}
            <TabsContent value="commands" className="space-y-6">
              <PermissionGate permission="tpv:command">
                <RemoteCommandPanel
                  terminalId={tpvId!}
                  terminalName={tpv?.name || t('detail.terminal')}
                  isOnline={terminalOnline}
                  isLocked={tpv?.isLocked ?? false}
                  isInMaintenance={isInMaintenance}
                  isActivated={!!tpv?.activatedAt}
                  isSuperadmin={isSuperAdmin}
                  venueId={venueId!}
                  currentVersion={tpv?.version}
                  currentVersionCode={tpv?.systemInfo?.versionCode as number | undefined}
                />
                <CommandHistoryTable terminalId={tpvId!} venueId={venueId!} />
              </PermissionGate>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <PermissionGate permission="tpv-settings:read">
                <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                  <AlertDescription className="text-blue-800 dark:text-blue-200">{t('tpvSettings.infoAlert')}</AlertDescription>
                </Alert>
                <TpvSettingsForm tpvId={tpvId!} compact={true} />
              </PermissionGate>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Activation Code Dialog */}
      <ActivationCodeDialog open={activationDialogOpen} onOpenChange={setActivationDialogOpen} activationData={activationData} />

      {/* Deactivate Confirmation Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('detail.deactivateConfirmTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('detail.deactivateConfirmDescription', { name: tpv?.name })}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeactivate} className="bg-orange-600 hover:bg-orange-700">
              {t('actions.deactivate')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}
