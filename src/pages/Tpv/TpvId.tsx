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
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent } from '@/components/ui/tabs'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useBreadcrumb } from '@/context/BreadcrumbContext'
import { useSocket } from '@/context/SocketContext'
import { useAccess } from '@/hooks/use-access'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { TpvSettingsForm } from '@/pages/Settings/components/TpvSettingsForm'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI, TerminalStatus } from '@/services/superadmin-terminals.service'
import { generateActivationCode, type DisplayModeRequest, type EffectiveDeviceCapabilities } from '@/services/tpv.service'
import { StaffRole } from '@/types'
import { type TpvCommandPayload, TpvCommandType } from '@/types/tpv-commands'
import { getIntlLocale } from '@/utils/i18n-locale'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  Activity,
  AlertCircle,
  AppWindow,
  BatteryMedium,
  ChevronDown,
  MessageSquare,
  ArrowLeft,
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
  RotateCcw,
  SaveIcon,
  Settings,
  Shield,
  Unlink,
  Wifi,
  Wrench,
  XIcon,
  Zap,
} from 'lucide-react'
import { DateTime } from 'luxon'
import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom'
import * as z from 'zod'
import { ActivationCodeDialog } from './ActivationCodeDialog'
import { CommandHistoryTable } from './components/CommandHistoryTable'
import { DisplayModeRequestControl, getDisplayModeRefetchInterval } from './components/DisplayModeRequestControl'
import { MessagesTab } from './components/MessagesTab'
import { RemoteCommandPanel } from './components/RemoteCommandPanel'
import { canActivate, canConfigurePayments, canSendCommand, getDeviceActionPolicy } from './deviceCapabilities'
import { DeviceBatteryCell, DeviceIcon, DeviceIdCell, DeviceStatusPill, DeviceSystemCell } from './components/DeviceListCells'
import { useDeviceSubtitle } from './components/useDeviceListLabels'
import { getAppVersion, getDeviceIdentifier, getDeviceRole, type DeviceListInput } from './deviceListPresentation'

// Valid tab values for URL hash
const VALID_TABS = ['info', 'commands', 'messages', 'settings'] as const
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

interface TpvCommandMutationVariables {
  terminalId: string
  venueId: string
  command: TpvCommandType
  payload?: TpvCommandPayload
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
  customerDisplayInverted: boolean
  capabilities: EffectiveDeviceCapabilities
  customerDisplayRequest?: DisplayModeRequest | null
  selfRegistered?: boolean
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
  const { venueId } = useCurrentVenue()

  return <TpvIdContent key={`${venueId ?? 'unknown-venue'}:${tpvId ?? 'unknown-device'}`} />
}

function TpvIdContent() {
  const { t, i18n } = useTranslation(['tpv', 'common'])
  const { tpvId } = useParams()
  const location = useLocation()
  const { venueId, venueSlug: _venueSlug, venue, fullBasePath } = useCurrentVenue()
  const venueTimezone = venue?.timezone || 'America/Mexico_City'
  const queryClient = useQueryClient()
  const { setCustomSegment, clearCustomSegment } = useBreadcrumb()
  const { toast } = useToast()
  const { user } = useAuth()
  const { can } = useAccess()
  const canUpdate = can('tpv:update')
  const subtitleFor = useDeviceSubtitle()
  const [showRestartDialog, setShowRestartDialog] = useState(false)
  const { socket, joinVenueRoom, leaveVenueRoom } = useSocket()
  const isSuperAdmin = user?.role === StaffRole.SUPERADMIN
  const [isEditing, setIsEditing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabValue>('info')
  const [pendingCommand, setPendingCommand] = useState<TpvCommandType | null>(null)
  const [merchantAccountToLink, setMerchantAccountToLink] = useState<string>('')
  const [isLinkingMerchant, setIsLinkingMerchant] = useState(false)
  const [isUnlinkingMerchant, setIsUnlinkingMerchant] = useState<string | null>(null)
  const [hasUnsyncedChanges, setHasUnsyncedChanges] = useState(false)

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

  const navigate = useNavigate()

  // Fetch the device data. A pending durable display request polls until its canonical resolution.
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
    refetchInterval: query => getDisplayModeRefetchInterval(query.state.data?.customerDisplayRequest),
    retry: (failureCount, error: any) => {
      // Don't retry if it's a 404 error
      if (error?.response?.status === 404) {
        return false
      }
      // Retry up to 3 times for other errors
      return failureCount < 3
    },
  })

  const actionPolicy = getDeviceActionPolicy(tpv?.capabilities, tpv?.activatedAt, tpv?.type)

  useEffect(() => {
    if (!tpv) return

    const activeTabIsSupported =
      activeTab === 'info' ||
      (activeTab === 'commands' && actionPolicy.showRemoteCommands) ||
      (activeTab === 'messages' && actionPolicy.showTpvMessages) ||
      (activeTab === 'settings' && actionPolicy.showTpvSettings)

    if (!activeTabIsSupported) handleTabChange('info')
  }, [actionPolicy.showRemoteCommands, actionPolicy.showTpvMessages, actionPolicy.showTpvSettings, activeTab, handleTabChange, tpv])

  // SUPERADMIN: Fetch terminal details with assignedMerchantIds
  const { data: terminalDetails, refetch: refetchTerminalDetails } = useQuery({
    queryKey: ['superadmin-terminal', tpvId],
    queryFn: () => terminalAPI.getTerminalById(tpvId!),
    enabled: isSuperAdmin && Boolean(tpvId) && canConfigurePayments(tpv?.capabilities),
  })

  // SUPERADMIN: Fetch all merchant accounts (they are global, not per-venue)
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: isSuperAdmin && canConfigurePayments(tpv?.capabilities),
  })

  // Get assigned merchant accounts (full objects)
  const assignedMerchantIds = terminalDetails?.assignedMerchantIds || []
  const assignedMerchantAccounts = merchantAccounts.filter((m: MerchantAccount) => assignedMerchantIds.includes(m.id))
  const availableMerchantAccounts = merchantAccounts.filter((m: MerchantAccount) => !assignedMerchantIds.includes(m.id))

  useEffect(() => {
    if (tpvId && tpv?.name) {
      setCustomSegment(tpvId, tpv.name)
    }

    return () => {
      if (tpvId) clearCustomSegment(tpvId)
    }
  }, [clearCustomSegment, setCustomSegment, tpv?.name, tpvId])

  // SUPERADMIN: Link merchant account to terminal
  const handleLinkMerchantAccount = async () => {
    if (!merchantAccountToLink || !tpvId || !canConfigurePayments(tpv?.capabilities)) return
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
    } catch (_error) {
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
    if (!tpvId || !canConfigurePayments(tpv?.capabilities)) return
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
    } catch (_error) {
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
    mutationFn: async ({ terminalId: targetTerminalId, command, payload }: TpvCommandMutationVariables) => {
      if (!canSendCommand(tpv?.capabilities, command)) throw new Error(t('commands.unsupportedForDevice'))
      const response = await api.post(`/api/v1/dashboard/tpv/${targetTerminalId}/command`, { command, payload })
      return response.data
    },
    onSuccess: (_, variables) => {
      toast({
        title: t('commands.sent'),
        description: t('commands.sentSuccess', { command: t(`commandLabels.${variables.command}`, variables.command) }),
      })
      // Refresh the TPV data to show updated status
      queryClient.invalidateQueries({ queryKey: ['tpv', variables.venueId, variables.terminalId] })
    },
    onError: (error: any) => {
      toast({
        title: t('commands.error'),
        description: t('commands.sendError', { error: error.response?.data?.message || error.message }),
        variant: 'destructive',
      })
    },
  })

  const sendTpvCommand = (command: TpvCommandType) => {
    if (!tpvId || !venueId || !canSendCommand(tpv?.capabilities, command)) return
    setPendingCommand(command)
    const payload = command === TpvCommandType.MAINTENANCE_MODE ? { message: t('commands.maintenancePayload'), duration: 0 } : undefined

    commandMutation.mutate(
      { terminalId: tpvId, venueId, command, payload },
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
      if (!getDeviceActionPolicy(tpv?.capabilities, tpv?.activatedAt).activationPending) {
        throw new Error(t('activation.notRequired'))
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
  // SUPERADMIN: activar sin código. PATCH `status: ACTIVE` a la ruta de superadmin, que sella
  // `activatedAt`; la ruta del venue (el selector de Estado al editar) NO lo sella, por eso la
  // terminal seguía pidiendo código aunque dijera «Activa».
  const activateWithoutCodeMutation = useMutation({
    mutationFn: async () => {
      if (!tpvId) throw new Error(t('detail.errors.venueOrTpvUndefined'))
      return terminalAPI.updateTerminal(tpvId, { status: TerminalStatus.ACTIVE })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tpv', venueId, tpvId] })
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      toast({ title: t('device.activatedWithoutCode'), description: t('device.activatedWithoutCodeDesc') })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('newTerminal.toast.activationFailed'),
        description: error?.response?.data?.message || error?.message,
      })
    },
  })

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
    if (!getDeviceActionPolicy(tpv?.capabilities, tpv?.activatedAt).canDeactivate) return
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

  const from = (location.state as any)?.from || `${fullBasePath}/devices`

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
              <Button onClick={() => navigate(`${fullBasePath}/devices`)} className="flex items-center gap-2">
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
        <Button onClick={() => navigate(`${fullBasePath}/devices`)}>
          <Home className="h-4 w-4 mr-2" />
          {t('detail.goToTerminals')}
        </Button>
      </div>
    )
  }

  const terminalOnline = isOnline(tpv?.status, tpv?.lastHeartbeat)
  const isInMaintenance = tpv?.status === 'MAINTENANCE'
  const maintenanceTransition = isInMaintenance ? TpvCommandType.EXIT_MAINTENANCE : TpvCommandType.MAINTENANCE_MODE
  const lockTransition = tpv.isLocked ? TpvCommandType.UNLOCK : TpvCommandType.LOCK
  const canRestart = canSendCommand(tpv.capabilities, TpvCommandType.RESTART)
  const showDisplayModeControl =
    tpv.capabilities.customerDisplay.presence !== 'UNSUPPORTED' &&
    tpv.capabilities.customerDisplay.invertibility !== 'UNSUPPORTED'

  // Lo que el menú «Acciones» ofrece: mismos permisos y capacidades que los botones y switches de antes.
  const canCommand = can('tpv:command')
  const menuCanRestart = canCommand && canRestart
  const menuCanMaintenance = canCommand && canSendCommand(tpv.capabilities, maintenanceTransition)
  const menuCanLock = canCommand && canSendCommand(tpv.capabilities, lockTransition)
  const menuCanGenerateCode = canUpdate && actionPolicy.activationPending
  const hasMenuActions = menuCanRestart || menuCanMaintenance || menuCanLock || menuCanGenerateCode || canUpdate

  const deviceForCells = tpv as unknown as DeviceListInput
  const deviceSubtitle = subtitleFor(deviceForCells)
  const appVersion = getAppVersion(deviceForCells)
  const identifier = getDeviceIdentifier(deviceForCells)
  const memory = tpv.systemInfo?.memory
  // 🔴 La TPV manda la memoria en MEGAS (HeartbeatDto: memory.used/total en MB). Antes se pintaba con
  // un formateador de bytes y salía «18 B / 128 B».
  const memoryPercent = memory?.total ? Math.min(100, Math.round(((memory.used ?? 0) / memory.total) * 100)) : null
  const networkType = typeof tpv.systemInfo?.networkType === 'string' ? tpv.systemInfo.networkType : null

  const formatVenueDate = (iso?: string | null) =>
    iso
      ? DateTime.fromISO(iso, { zone: 'utc' })
          .setZone(venueTimezone)
          .setLocale(getIntlLocale(i18n.language))
          .toLocaleString({ year: 'numeric', month: 'short', day: 'numeric' })
      : null
  const formatVenueRelative = (iso?: string | null) =>
    iso
      ? DateTime.fromISO(iso, { zone: 'utc' }).setZone(venueTimezone).setLocale(getIntlLocale(i18n.language)).toRelative()
      : null

  const activationText = canActivate(tpv.capabilities)
    ? tpv.activatedAt
      ? t('device.activation.activatedOn', { date: formatVenueDate(tpv.activatedAt) })
      : t('device.activation.pending')
    : tpv.selfRegistered
      ? t('device.activation.selfRegistered')
      : t('device.activation.notRequired')

  // «Tipo» dice el ROL, igual que la lista («Terminal de cobro», «Punto de venta»); el sistema va en su renglón.
  const roleLabel = t(`list.role.${getDeviceRole(deviceForCells)}`)
  // El selector de tipo sólo lista tipos de hardware dado de alta por admin. Un POS (celular, tablet, PC)
  // no se reclasifica desde aquí: el select saldría vacío y podría volverlo «terminal de cobro» por error.
  const typeIsEditable = ['TPV_ANDROID', 'TPV_IOS', 'PRINTER_RECEIPT', 'PRINTER_KITCHEN', 'KDS'].includes(tpv.type ?? '')

  const tabClass = (tab: TabValue) =>
    `relative pb-3 text-sm font-medium transition-colors flex items-center gap-1.5 ${
      activeTab === tab ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
    }`
  const tabUnderline = <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-foreground rounded-full" />

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
          {/* Encabezado (maqueta E, 8-oct-2026): quién es, cómo está, y UN botón con las acciones. */}
          <div className="space-y-4">
            <Link to={from} className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              {t('device.back')}
            </Link>

            <div className="flex flex-wrap items-start gap-4">
              <DeviceIcon device={deviceForCells} className="size-14 rounded-2xl [&_svg]:size-6" />
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-2xl font-semibold tracking-tight text-foreground">{tpv.name || t('detail.terminal')}</h1>
                  <DeviceStatusPill device={deviceForCells} />
                </div>
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                  <span>{deviceSubtitle}</span>
                  {identifier && (
                    <>
                      <span aria-hidden="true">·</span>
                      <DeviceIdCell device={deviceForCells} />
                    </>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {isEditing ? (
                  <PermissionGate permission="tpv:update">
                    <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                      <XIcon className="w-4 h-4 mr-2" />
                      {t('common:cancel')}
                    </Button>
                    <Button size="sm" onClick={form.handleSubmit(onSubmit)} disabled={updateTpvMutation.isPending}>
                      <SaveIcon className="w-4 h-4 mr-2" />
                      {updateTpvMutation.isPending ? t('common:saving') : t('common:save')}
                    </Button>
                  </PermissionGate>
                ) : (
                  hasMenuActions && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="outline" size="sm" className="h-9" data-tour="tpv-detail-actions">
                          {t('device.actions')}
                          <ChevronDown className="w-4 h-4 ml-1.5 opacity-70" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64">
                        {menuCanRestart && (
                          <DropdownMenuItem onSelect={() => setShowRestartDialog(true)} disabled={commandMutation.isPending}>
                            <RotateCcw className="size-4" />
                            {terminalOnline ? t('list.menu.restart') : t('list.menu.restartQueued')}
                          </DropdownMenuItem>
                        )}
                        {menuCanMaintenance && (
                          <DropdownMenuItem
                            disabled={(!terminalOnline && !isInMaintenance) || commandMutation.isPending}
                            onSelect={() => sendTpvCommand(maintenanceTransition)}
                          >
                            <Wrench className="size-4" />
                            <span className="flex flex-col">
                              {isInMaintenance ? t('list.menu.exitMaintenance') : t('list.menu.maintenance')}
                              {!terminalOnline && !isInMaintenance && (
                                <span className="text-xs text-muted-foreground">{t('list.menu.needsOnline')}</span>
                              )}
                            </span>
                          </DropdownMenuItem>
                        )}
                        {menuCanLock && (
                          <DropdownMenuItem
                            disabled={!terminalOnline || commandMutation.isPending}
                            onSelect={() => sendTpvCommand(lockTransition)}
                          >
                            {tpv.isLocked ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                            <span className="flex flex-col">
                              {tpv.isLocked ? t('device.menu.unlock') : t('device.menu.lock')}
                              {!terminalOnline && <span className="text-xs text-muted-foreground">{t('list.menu.needsOnline')}</span>}
                            </span>
                          </DropdownMenuItem>
                        )}
                        {menuCanGenerateCode && (
                          <DropdownMenuItem
                            onSelect={() => generateActivationCodeMutation.mutate()}
                            disabled={generateActivationCodeMutation.isPending}
                          >
                            <Key className="size-4" />
                            {t('actions.generateCode')}
                          </DropdownMenuItem>
                        )}
                        {canUpdate && (
                          <>
                            {(menuCanRestart || menuCanMaintenance || menuCanLock || menuCanGenerateCode) && <DropdownMenuSeparator />}
                            <DropdownMenuItem onSelect={() => setIsEditing(true)}>
                              <PencilIcon className="size-4" />
                              {t('device.menu.edit')}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )
                )}
              </div>
            </div>

            {/* Un estado que cambia lo que la terminal puede hacer se VE, con la salida a la mano. */}
            {isInMaintenance && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-(--info-border) bg-(--info-muted) px-4 py-3 text-sm text-(--info-foreground)">
                <Wrench className="h-4 w-4 shrink-0" />
                <span className="flex-1">{t('device.banner.maintenance')}</span>
                {menuCanMaintenance && (
                  <Button size="sm" variant="outline" disabled={commandMutation.isPending} onClick={() => sendTpvCommand(TpvCommandType.EXIT_MAINTENANCE)}>
                    {pendingCommand === TpvCommandType.EXIT_MAINTENANCE && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    {t('list.menu.exitMaintenance')}
                  </Button>
                )}
              </div>
            )}
            {tpv.isLocked && (
              <div className="flex flex-wrap items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm">
                <Lock className="h-4 w-4 shrink-0 text-destructive" />
                <span className="flex-1">{t('device.banner.locked')}</span>
                {menuCanLock && (
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={!terminalOnline || commandMutation.isPending}
                    onClick={() => sendTpvCommand(TpvCommandType.UNLOCK)}
                  >
                    {pendingCommand === TpvCommandType.UNLOCK && <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />}
                    {t('device.menu.unlock')}
                  </Button>
                )}
              </div>
            )}
          </div>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
            <div className="flex items-center gap-6 border-b border-border">
              <button onClick={() => handleTabChange('info')} className={tabClass('info')}>
                <Info className="h-4 w-4" />
                {t('common:information', 'Información')}
                {activeTab === 'info' && tabUnderline}
              </button>
              {actionPolicy.showRemoteCommands && (
                <button onClick={() => handleTabChange('commands')} className={tabClass('commands')}>
                  <Zap className="h-4 w-4" />
                  {t('commands.remoteCommands')}
                  {activeTab === 'commands' && tabUnderline}
                </button>
              )}
              {actionPolicy.showTpvMessages && (
                <PermissionGate permission="tpv-messages:read">
                  <button onClick={() => handleTabChange('messages')} className={tabClass('messages')}>
                    <MessageSquare className="h-4 w-4" />
                    {t('device.tabs.messages')}
                    {activeTab === 'messages' && tabUnderline}
                  </button>
                </PermissionGate>
              )}
              {actionPolicy.showTpvSettings && (
                <PermissionGate permission="tpv:update">
                  <button onClick={() => handleTabChange('settings')} className={tabClass('settings')}>
                    <Settings className="h-4 w-4" />
                    {t('tpvSettings.title')}
                    {activeTab === 'settings' && tabUnderline}
                  </button>
                </PermissionGate>
              )}
            </div>

            {/* Info Tab */}
            <TabsContent value="info" className="space-y-6">
              <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
                <div className="space-y-6 xl:col-span-2">
                  {/* Este dispositivo: lo que el dueño revisa cuando algo falla. */}
                  <section className="rounded-2xl border border-input bg-card p-5">
                    <h2 className="mb-2 text-base font-semibold">{t('device.sections.thisDevice')}</h2>
                    <dl className="divide-y divide-border">
                      <DetailRow icon={<BatteryMedium className="h-4 w-4" />} label={t('list.columns.battery')}>
                        <DeviceBatteryCell device={deviceForCells} />
                      </DetailRow>
                      <DetailRow icon={<Cpu className="h-4 w-4" />} label={t('list.columns.system')}>
                        <DeviceSystemCell device={deviceForCells} />
                      </DetailRow>
                      <DetailRow icon={<AppWindow className="h-4 w-4" />} label={t('list.columns.app')}>
                        {appVersion ? <span className="tabular-nums">v{appVersion.full}</span> : <span className="text-muted-foreground">—</span>}
                      </DetailRow>
                      {(networkType || tpv.ipAddress) && (
                        <DetailRow icon={<Wifi className="h-4 w-4" />} label={t('device.fields.network')}>
                          <span>
                            {[networkType ? t(`device.network.${networkType}`, { defaultValue: networkType }) : null, tpv.ipAddress ? `IP ${tpv.ipAddress}` : null]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </DetailRow>
                      )}
                      {memory?.total ? (
                        <DetailRow icon={<MemoryStick className="h-4 w-4" />} label={t('device.fields.memory')}>
                          <span className="flex w-full max-w-sm items-center gap-3">
                            <Progress value={memoryPercent ?? 0} className="h-1.5 flex-1" />
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {t('device.fields.memoryValue', { used: Math.round(memory.used ?? 0), total: Math.round(memory.total) })}
                            </span>
                          </span>
                        </DetailRow>
                      ) : null}
                      {tpv.systemInfo?.uptime ? (
                        <DetailRow icon={<Clock className="h-4 w-4" />} label={t('device.fields.uptime')}>
                          <span>{formatUptime(tpv.systemInfo.uptime)}</span>
                        </DetailRow>
                      ) : null}
                      <DetailRow icon={<Key className="h-4 w-4" />} label={t('device.fields.activation')}>
                        <span>{activationText}</span>
                      </DetailRow>
                      <DetailRow icon={<Activity className="h-4 w-4" />} label={t('device.fields.lastSeen')}>
                        <span>{formatVenueRelative(tpv.lastHeartbeat) ?? t('detail.never')}</span>
                      </DetailRow>
                    </dl>
                  </section>

                  {/* Identificación: se lee como lista; sólo se vuelve formulario al editar. */}
                  <section className="rounded-2xl border border-input bg-card p-5">
                    <div className="mb-2 flex items-center justify-between">
                      <h2 className="text-base font-semibold">{t('device.sections.identity')}</h2>
                      {!isEditing && (
                        <PermissionGate permission="tpv:update">
                          <Button variant="ghost" size="sm" className="h-8" onClick={() => setIsEditing(true)}>
                            <PencilIcon className="mr-1.5 h-3.5 w-3.5" />
                            {t('common:edit')}
                          </Button>
                        </PermissionGate>
                      )}
                    </div>

                    {!isEditing ? (
                      <dl className="divide-y divide-border">
                        <DetailRow label={t('device.fields.name')}>{tpv.name}</DetailRow>
                        <DetailRow label={identifier?.kind === 'deviceUid' ? t('device.fields.deviceId') : t('device.fields.serial')}>
                          {identifier ? <span className="select-all break-all font-mono text-xs">{identifier.full}</span> : '—'}
                        </DetailRow>
                        <DetailRow label={t('device.fields.model')}>{tpv.model || '—'}</DetailRow>
                        <DetailRow label={t('device.fields.brand')}>{tpv.brand || '—'}</DetailRow>
                        <DetailRow label={t('device.fields.type')}>{roleLabel}</DetailRow>
                        <DetailRow label={t('device.fields.created')}>{formatVenueDate(tpv.createdAt) ?? '—'}</DetailRow>
                      </dl>
                    ) : (
                      <Form {...form}>
                        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                            <FormField
                              control={form.control}
                              name="name"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('detail.terminalName')}</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-11" />
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
                                  <FormLabel>{t('detail.serialNumber')}</FormLabel>
                                  <FormControl>
                                    <Input {...field} className="h-11 font-mono" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                            {typeIsEditable && (
                              <FormField
                                control={form.control}
                                name="type"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel>{t('detail.terminalType')}</FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || ''}>
                                      <FormControl>
                                        <SelectTrigger className="h-11">
                                          <SelectValue placeholder={t('detail.selectType')} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="TPV_ANDROID">{t('detail.types.tpvAndroid')}</SelectItem>
                                        <SelectItem value="TPV_IOS">{t('detail.types.tpvIOS')}</SelectItem>
                                        <SelectItem value="PRINTER_RECEIPT">{t('detail.types.printerReceipt')}</SelectItem>
                                        <SelectItem value="PRINTER_KITCHEN">{t('detail.types.printerKitchen')}</SelectItem>
                                        <SelectItem value="KDS">{t('detail.types.kds')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                  </FormItem>
                                )}
                              />
                            )}
                            {/* Status Selector - SUPERADMIN Only */}
                            {isSuperAdmin && (
                              <FormField
                                control={form.control}
                                name="status"
                                render={({ field }) => (
                                  <FormItem>
                                    <FormLabel className="flex items-center gap-1.5">
                                      <Shield className="h-3.5 w-3.5 text-amber-500" />
                                      {t('detail.terminalStatus')}
                                    </FormLabel>
                                    <Select onValueChange={field.onChange} value={field.value || 'ACTIVE'}>
                                      <FormControl>
                                        <SelectTrigger className="h-11">
                                          <SelectValue placeholder={t('detail.selectStatus')} />
                                        </SelectTrigger>
                                      </FormControl>
                                      <SelectContent>
                                        <SelectItem value="ACTIVE">{t('detail.statusOptions.active')}</SelectItem>
                                        <SelectItem value="INACTIVE">{t('detail.statusOptions.inactive')}</SelectItem>
                                        <SelectItem value="MAINTENANCE">{t('detail.statusOptions.maintenance')}</SelectItem>
                                        <SelectItem value="RETIRED">{t('detail.statusOptions.retired')}</SelectItem>
                                      </SelectContent>
                                    </Select>
                                    <FormMessage />
                                    {field.value === 'RETIRED' && (
                                      <p className="text-xs text-muted-foreground mt-1">⚠️ {t('detail.retiredWarning')}</p>
                                    )}
                                  </FormItem>
                                )}
                              />
                            )}
                            <FormField
                              control={form.control}
                              name="brand"
                              render={({ field }) => (
                                <FormItem>
                                  <FormLabel>{t('detail.brand')}</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder={t('detail.brandPlaceholder')} className="h-11" />
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
                                  <FormLabel>{t('detail.model')}</FormLabel>
                                  <FormControl>
                                    <Input {...field} placeholder={t('detail.modelPlaceholder')} className="h-11" />
                                  </FormControl>
                                  <FormMessage />
                                </FormItem>
                              )}
                            />
                          </div>
                          <PermissionGate permission="tpv:update">
                            <div className="flex justify-end gap-3 border-t border-border pt-4">
                              <Button type="button" variant="outline" onClick={handleCancel} disabled={updateTpvMutation.isPending}>
                                <XIcon className="w-4 h-4 mr-2" />
                                {t('common:cancel')}
                              </Button>
                              <Button type="submit" disabled={updateTpvMutation.isPending}>
                                <SaveIcon className="w-4 h-4 mr-2" />
                                {updateTpvMutation.isPending ? t('common:saving') : t('detail.saveChanges')}
                              </Button>
                            </div>
                          </PermissionGate>
                        </form>
                      </Form>
                    )}
                  </section>
                </div>

                <div className="space-y-6">
                  {venueId && tpvId && showDisplayModeControl && (
                    <section className="rounded-2xl border border-input bg-card p-5">
                      <h2 className="mb-3 text-base font-semibold">{t('device.sections.customerDisplay')}</h2>
                      <DisplayModeRequestControl
                        key={`${venueId}:${tpvId}`}
                        venueId={venueId}
                        terminalId={tpvId}
                        capabilities={tpv.capabilities}
                        customerDisplayInverted={tpv.customerDisplayInverted}
                        request={tpv.customerDisplayRequest}
                        canUpdate={canUpdate}
                      />
                    </section>
                  )}

                  {/* SUPERADMIN: todo lo suyo junto, con su degradado (ui-patterns.md). */}
                  {isSuperAdmin && (actionPolicy.canConfigurePayments || actionPolicy.canDeactivate || actionPolicy.activationPending) && (
                    <section className="rounded-2xl border border-amber-300/60 bg-card p-5 dark:border-amber-700/50">
                      <div className="mb-3 flex items-center gap-2">
                        <Shield className="h-4 w-4 text-amber-500" />
                        <span className="bg-gradient-to-r from-amber-400 to-pink-500 bg-clip-text text-xs font-semibold uppercase tracking-wider text-transparent">
                          {t('device.sections.superadmin')}
                        </span>
                      </div>

                      {actionPolicy.canConfigurePayments && (
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold">Cuentas de comercio</h3>
                            <Badge variant="outline" className="text-xs border-amber-400 text-amber-600 dark:text-amber-400">
                              {assignedMerchantAccounts.length}
                            </Badge>
                          </div>
                          {assignedMerchantAccounts.length > 0 ? (
                            <div className="space-y-2">
                              {assignedMerchantAccounts.map((account: MerchantAccount) => (
                                <div key={account.id} className="flex items-center justify-between rounded-lg bg-muted p-3">
                                  <div className="flex min-w-0 items-center gap-3">
                                    <CreditCard className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                                    <div className="min-w-0">
                                      <p className="truncate text-sm font-medium">{account.displayName || account.externalMerchantId}</p>
                                      <p className="text-xs text-muted-foreground">{account.provider?.name || 'Proveedor desconocido'}</p>
                                    </div>
                                  </div>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleUnlinkMerchantAccount(account.id)}
                                    disabled={isUnlinkingMerchant === account.id}
                                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                                    aria-label="Desvincular"
                                  >
                                    {isUnlinkingMerchant === account.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlink className="h-4 w-4" />}
                                  </Button>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="rounded-lg border border-dashed border-border p-3 text-center text-sm text-muted-foreground">
                              No hay cuentas de comercio asignadas
                            </p>
                          )}

                          <div className="space-y-2 pt-1">
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
                                  Vincular cuenta
                                </>
                              )}
                            </Button>
                            {merchantAccounts.length === 0 && (
                              <p className="text-center text-xs text-muted-foreground">
                                <Link to={`${fullBasePath}/merchant-accounts`} className="text-amber-600 underline dark:text-amber-400">
                                  Crear cuenta de comercio
                                </Link>{' '}
                                para poder vincularla
                              </p>
                            )}
                          </div>
                        </div>
                      )}

                      {actionPolicy.canDeactivate && (
                        <div className={actionPolicy.canConfigurePayments ? 'mt-4 border-t border-border pt-4' : ''}>
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{t('device.fields.activation')}</p>
                              <p className="text-xs text-muted-foreground">{activationText}</p>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setShowDeactivateDialog(true)}
                              disabled={deactivateTpvMutation.isPending}
                            >
                              {deactivateTpvMutation.isPending ? t('actions.deactivating') : t('actions.deactivate')}
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* Activar sin código: lo mismo que «Crear terminal → Activar ya». Es la salida cuando
                          ese segundo paso falló o la terminal ya existía y pide código. */}
                      {actionPolicy.activationPending && (
                        <div
                          className={
                            actionPolicy.canConfigurePayments || actionPolicy.canDeactivate ? 'mt-4 border-t border-border pt-4' : ''
                          }
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium">{t('device.fields.activation')}</p>
                              <p className="text-xs text-muted-foreground">{t('device.activateWithoutCodeHint')}</p>
                            </div>
                            <Button
                              size="sm"
                              variant="outline"
                              data-tour="tpv-detail-activate-without-code"
                              onClick={() => activateWithoutCodeMutation.mutate()}
                              disabled={activateWithoutCodeMutation.isPending}
                            >
                              {activateWithoutCodeMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
                              {t('device.activateWithoutCode')}
                            </Button>
                          </div>
                        </div>
                      )}
                    </section>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* Commands Tab */}
            {actionPolicy.showRemoteCommands && (
              <TabsContent value="commands" className="space-y-6">
                {actionPolicy.supportedRemoteCommands.length > 0 ? (
                <PermissionGate permission="tpv:command">
                  <RemoteCommandPanel
                    key={`${venueId}:${tpvId}`}
                    terminalId={tpvId!}
                    terminalName={tpv?.name || t('detail.terminal')}
                    isOnline={terminalOnline}
                    isLocked={tpv?.isLocked ?? false}
                    isInMaintenance={isInMaintenance}
                    activationPending={actionPolicy.activationPending}
                    isSuperadmin={isSuperAdmin}
                    isOwnerPlus={user?.role === StaffRole.OWNER || isSuperAdmin}
                    venueId={venueId!}
                    currentVersion={tpv?.version}
                    currentVersionCode={tpv?.systemInfo?.versionCode as number | undefined}
                    supportedRemoteCommands={actionPolicy.supportedRemoteCommands}
                  />
                  <CommandHistoryTable terminalId={tpvId!} venueId={venueId!} />
                </PermissionGate>
                ) : (
                <Alert>
                  <Info className="h-4 w-4" />
                  <AlertDescription>{t('commands.noSupportedActions')}</AlertDescription>
                </Alert>
                )}
              </TabsContent>
            )}

            {/* Messages Tab */}
            {actionPolicy.showTpvMessages && (
              <TabsContent value="messages" className="space-y-6">
                <PermissionGate permission="tpv-messages:read">
                  <MessagesTab venueId={venueId!} />
                </PermissionGate>
              </TabsContent>
            )}

            {/* Settings Tab */}
            {actionPolicy.showTpvSettings && (
              <TabsContent value="settings" className="space-y-6">
                <PermissionGate permission="tpv-settings:read">
                  <Alert className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800">
                    <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                    <AlertDescription className="text-blue-800 dark:text-blue-200">{t('tpvSettings.infoAlert')}</AlertDescription>
                  </Alert>
                  <TpvSettingsForm
                    tpvId={tpvId!}
                    compact={true}
                    onSettingChanged={() => setHasUnsyncedChanges(true)}
                    terminalVersionCode={tpv?.systemInfo?.versionCode as number | undefined}
                    terminalVersionName={tpv?.version}
                  />
                </PermissionGate>
              </TabsContent>
            )}
          </Tabs>

          {/* Floating restart banner after settings change */}
          {actionPolicy.showTpvSettings && hasUnsyncedChanges && (
            <div className="sticky bottom-4 z-10 mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300">
              <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/80 p-4 shadow-lg">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <RotateCcw className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
                  <p className="text-sm text-amber-800 dark:text-amber-200 flex-1">
                    {canRestart
                      ? t('tpvSettings.restartBanner.message', { serialNumber: tpv?.serialNumber || '' })
                      : t('tpvSettings.restartBanner.unsupportedDevice')}
                  </p>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    {canRestart && !terminalOnline && (
                      <span className="text-xs text-amber-600/70 dark:text-amber-400/70 mr-1">
                        {t('tpvSettings.restartBanner.offlineHint')}
                      </span>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 hover:bg-amber-100 dark:hover:bg-amber-900/50"
                      onClick={() => setHasUnsyncedChanges(false)}
                    >
                      {t('tpvSettings.restartBanner.dismiss')}
                    </Button>
                    {canRestart && <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-primary-foreground"
                      disabled={!terminalOnline || commandMutation.isPending}
                      onClick={() => {
                        commandMutation.mutate(
                          { terminalId: tpvId!, venueId: venueId!, command: TpvCommandType.RESTART },
                          {
                            onSuccess: () => {
                              setHasUnsyncedChanges(false)
                            },
                          },
                        )
                      }}
                    >
                      {commandMutation.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                          {t('tpvSettings.restartBanner.restarting')}
                        </>
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4 mr-1.5" />
                          {t('tpvSettings.restartBanner.restart')}
                        </>
                      )}
                    </Button>}
                  </div>
                </div>
              </div>
            </div>
          )}
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
      {/* Reiniciar pide confirmación: si alguien está cobrando, el cobro se interrumpe. */}
      <AlertDialog open={showRestartDialog} onOpenChange={setShowRestartDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('list.restartConfirm.title', { name: tpv?.name ?? '' })}</AlertDialogTitle>
            <AlertDialogDescription>
              {isOnline(tpv?.status, tpv?.lastHeartbeat) ? t('list.restartConfirm.description') : t('list.restartConfirm.descriptionQueued')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common:cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                sendTpvCommand(TpvCommandType.RESTART)
                setShowRestartDialog(false)
              }}
            >
              {t('list.restartConfirm.confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </TooltipProvider>
  )
}

/** Renglón de la lista de datos del detalle: etiqueta a la izquierda, valor a la derecha. */
function DetailRow({ icon, label, children }: { icon?: ReactNode; label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1 py-3 sm:flex-row sm:items-center sm:gap-4">
      <dt className="flex w-44 shrink-0 items-center gap-2 text-sm text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="flex min-w-0 flex-1 items-center gap-2 text-sm text-foreground">{children}</dd>
    </div>
  )
}
