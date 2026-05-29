import { useToast } from '@/hooks/use-toast'
import { useTpvTour } from '@/hooks/useTpvTour'
import { deleteTpv, getTpvs, sendTpvCommand as sendTpvCommandApi } from '@/services/tpv.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Package,
  Plus,
  RotateCw,
  Search,
  Shield,
  Terminal,
  Trash2,
  Wifi,
  ExternalLink,
  Wrench,
  X,
} from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { FilterPill, FilterPillBar, CheckboxFilterContent } from '@/components/filters'
import { getTerminalStatusInfo, type TerminalStatusKey } from '@/lib/terminal-status'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
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
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { MetricCard } from '@/components/ui/metric-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { StaffRole, Terminal as TerminalType } from '@/types'
import { Currency } from '@/utils/currency'
import { useTranslation } from 'react-i18next'
import { ActivateTerminalModal } from './components/ActivateTerminalModal'
import { TerminalPurchaseWizard } from './components/purchase-wizard/TerminalPurchaseWizard'
import { SuperadminTerminalDialog } from './components/SuperadminTerminalDialog'
import { TerminalOrdersTab } from './components/TerminalOrdersTab'

// ⚠️ COHERENCIA con tours interactivos:
// Esta página tiene un tour driver.js (`useTpvTour`) que enseña al usuario
// cómo registrar y administrar terminales. Si modificas la UI/UX (lista de
// TPVs, botón de crear, wizard de registro), revisa
// `src/hooks/useTpvTour.ts` y actualiza los selectores `data-tour="tpv-*"`
// y los textos de los steps en paralelo.
export default function Tpvs() {
  const { venueId, venue } = useCurrentVenue()
  const { user } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation('common')
  const { t: tTpv } = useTranslation('tpv')
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Detect Stripe-cancel redirect and show toast.
  const [searchParams, setSearchParams] = useSearchParams()
  useEffect(() => {
    if (searchParams.get('cancelled') === 'true') {
      toast({
        title: tTpv('purchaseWizard.cancelled.title'),
        description: tTpv('purchaseWizard.cancelled.description'),
        variant: 'destructive',
      })
      // Clean URL so refresh doesn't re-trigger the toast
      const next = new URLSearchParams(searchParams)
      next.delete('cancelled')
      setSearchParams(next, { replace: true })
    }
  }, [searchParams, setSearchParams, toast, tTpv])


  // Pill-tab state synced to ?tab=...
  const activeTab = searchParams.get('tab') === 'orders' ? 'orders' : 'terminals'
  const setActiveTab = (value: string) => {
    const next = new URLSearchParams(searchParams)
    next.set('tab', value)
    setSearchParams(next, { replace: true })
  }

  // Tour driver.js — auto-arranca cuando `requestAtomicTour('tpv-onboarding')`
  // se dispara externamente. Ver `useTpvTour.ts`.
  useTpvTour()

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [wizardOpen, setWizardOpen] = useState(false)

  // Deeplink: HomeSetupChecklist's "Compra tu primer TPV" step navigates here
  // with `?action=buy` to auto-open the purchase wizard. Clean the param after
  // opening so a refresh doesn't re-trigger the wizard mid-flow.
  useEffect(() => {
    if (searchParams.get('action') === 'buy') {
      setWizardOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL changes
  }, [searchParams])
  const [superadminDialogOpen, setSuperadminDialogOpen] = useState(false)
  const [activationModalOpen, setActivationModalOpen] = useState(false)
  const [selectedTerminalForActivation, setSelectedTerminalForActivation] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null)
  const [connectionFilter, setConnectionFilter] = useState<string[]>([])
  const [activationFilter, setActivationFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [versionFilter, setVersionFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Check if user is SUPERADMIN
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  const statusLabelMap: Record<TerminalStatusKey, string> = {
    locked: t('tpv.status.locked', { defaultValue: 'Bloqueado' }),
    pending: t('tpv.status.pendingActivation', { defaultValue: 'Pendiente' }),
    online: t('tpv.status.online', { defaultValue: 'En línea' }),
    offline: t('tpv.status.offline', { defaultValue: 'Sin conexión' }),
    inactive: t('tpv.status.inactive', { defaultValue: 'Inactivo' }),
    maintenance: t('tpv.status.maintenance', { defaultValue: 'Mantenimiento' }),
    retired: t('tpv.status.retired', { defaultValue: 'Retirado' }),
    unknown: t('tpv.status.unknown', { defaultValue: 'Desconocido' }),
  }

  const getTerminalStatusStyle = (status: string, lastHeartbeat?: string | null) => {
    const info = getTerminalStatusInfo({ status, lastHeartbeat })
    return {
      pulseStatus: info.pulseStatus,
      label: statusLabelMap[info.statusKey],
      isOnline: info.isOnline,
    }
  }

  const isTerminalOnline = (status: string, lastHeartbeat?: string | null) => {
    return getTerminalStatusInfo({ status, lastHeartbeat }).isOnline
  }

  // Multi-select filters and search are sent to backend so pagination respects them.
  // Previously filtered client-side on paginated data — missed matches on other pages.
  const { data, isLoading } = useQuery({
    queryKey: [
      'tpvs',
      venueId,
      pagination.pageIndex,
      pagination.pageSize,
      connectionFilter,
      activationFilter,
      statusFilter,
      versionFilter,
      debouncedSearchTerm,
    ],
    queryFn: () =>
      getTpvs(venueId, pagination, {
        statuses: statusFilter.length > 0 ? statusFilter : undefined,
        versions: versionFilter.length > 0 ? versionFilter : undefined,
        connections: connectionFilter.length > 0 ? (connectionFilter as Array<'online' | 'offline'>) : undefined,
        activations: activationFilter.length > 0 ? (activationFilter as Array<'activated' | 'notActivated'>) : undefined,
        search: debouncedSearchTerm || undefined,
      }),
  })

  // Calculate metrics from data
  const metrics = useMemo(() => {
    const terminals = data?.data || []
    const total = terminals.length
    const online = terminals.filter((t: any) => isTerminalOnline(t.status, t.lastHeartbeat)).length
    const pendingActivation = terminals.filter((t: any) => !t.activatedAt).length
    const inMaintenance = terminals.filter((t: any) => t.status === 'MAINTENANCE').length

    return { total, online, pendingActivation, inMaintenance }
  }, [data?.data])

  // Relative time helper
  const getRelativeTime = (dateString: string | null | undefined) => {
    if (!dateString) return t('tpv.filter.never', { defaultValue: 'Nunca' })
    const now = Date.now()
    const then = new Date(dateString).getTime()
    const diffMs = now - then
    const diffMin = Math.floor(diffMs / 60000)
    const diffHr = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMin < 1) return t('tpv.filter.justNow', { defaultValue: 'Ahora' })
    if (diffMin < 60) return `${diffMin} min`
    if (diffHr < 24) return `${diffHr}h`
    return `${diffDays}d`
  }

  // Version options derived from data
  const versionOptions = useMemo(() => {
    const terminals = data?.data || []
    const versions: string[] = []
    terminals.forEach((t: any) => {
      if (t.version && !versions.includes(t.version)) versions.push(t.version)
    })
    return versions.sort().map(v => ({ value: v, label: `v${v}` }))
  }, [data?.data])

  // Filter display label helper
  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return t('tpv.filter.nSelected', { count: values.length, defaultValue: `${values.length} seleccionados` })
  }

  // Reset all filters
  const resetFilters = useCallback(() => {
    setConnectionFilter([])
    setActivationFilter([])
    setStatusFilter([])
    setVersionFilter([])
    setSearchTerm('')
  }, [])

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [connectionFilter, activationFilter, statusFilter, versionFilter, debouncedSearchTerm])

  // All filters are applied server-side via query params (see useQuery above).
  // Client-side filtering over paginated data would only match terminals on the current page.
  const filteredData = useMemo(() => data?.data || [], [data?.data])

  // Connection filter options
  const connectionOptions = useMemo(
    () => [
      { value: 'online', label: t('tpv.filter.online', { defaultValue: 'En línea' }) },
      { value: 'offline', label: t('tpv.filter.offline', { defaultValue: 'Sin conexión' }) },
    ],
    [t],
  )

  // Activation filter options
  const activationOptions = useMemo(
    () => [
      { value: 'activated', label: t('tpv.filter.activated', { defaultValue: 'Activado' }) },
      { value: 'notActivated', label: t('tpv.filter.notActivated', { defaultValue: 'Sin activar' }) },
    ],
    [t],
  )

  // Status filter options
  const statusOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: t('tpv.filter.active', { defaultValue: 'Activo' }) },
      { value: 'PENDING_ACTIVATION', label: t('tpv.filter.pending', { defaultValue: 'Pendiente' }) },
      { value: 'MAINTENANCE', label: t('tpv.filter.maintenance', { defaultValue: 'Mantenimiento' }) },
      { value: 'INACTIVE', label: t('tpv.filter.inactive', { defaultValue: 'Inactivo' }) },
      { value: 'RETIRED', label: t('tpv.filter.retired', { defaultValue: 'Retirado' }) },
    ],
    [t],
  )

  // SUPERADMIN: Fetch terminals with assignedMerchantIds
  const { data: superadminTerminals = [], refetch: refetchSuperadminTerminals } = useQuery({
    queryKey: ['superadmin-terminals', venueId],
    queryFn: () => terminalAPI.getAllTerminals({ venueId: venueId! }),
    enabled: isSuperadmin && Boolean(venueId),
  })

  // SUPERADMIN: Fetch all merchant accounts (they are global, not per-venue)
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: isSuperadmin,
  })

  // Create lookup map: terminalId -> assignedMerchantIds
  const terminalMerchantMap = useMemo(() => {
    const map = new Map<string, string[]>()
    superadminTerminals.forEach((t: any) => {
      map.set(t.id, t.assignedMerchantIds || [])
    })
    return map
  }, [superadminTerminals])

  // State for merchant account popover
  const [openPopoverId, setOpenPopoverId] = useState<string | null>(null)
  const [linkingMerchant, setLinkingMerchant] = useState<{ terminalId: string; merchantId: string } | null>(null)
  const [unlinkingMerchant, setUnlinkingMerchant] = useState<{ terminalId: string; merchantId: string } | null>(null)
  // Account being viewed in the detail dialog (clicked from a badge inside the Cuentas column)
  const [viewingAccount, setViewingAccount] = useState<MerchantAccount | null>(null)
  // Per-row search for the "Vincular cuenta" popover
  const [vincularSearch, setVincularSearch] = useState('')

  // SUPERADMIN: Link merchant account to terminal
  const handleLinkMerchant = async (terminalId: string, merchantId: string) => {
    setLinkingMerchant({ terminalId, merchantId })
    try {
      const currentIds = terminalMerchantMap.get(terminalId) || []
      const newIds = [...currentIds, merchantId]
      await terminalAPI.updateTerminal(terminalId, { assignedMerchantIds: newIds })
      refetchSuperadminTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Cuenta vinculada',
        description: 'La cuenta se ha asignado a la terminal',
      })
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo vincular la cuenta',
      })
    } finally {
      setLinkingMerchant(null)
    }
  }

  // SUPERADMIN: Unlink merchant account from terminal
  const handleUnlinkMerchant = async (terminalId: string, merchantId: string) => {
    setUnlinkingMerchant({ terminalId, merchantId })
    try {
      const currentIds = terminalMerchantMap.get(terminalId) || []
      const newIds = currentIds.filter((id: string) => id !== merchantId)
      await terminalAPI.updateTerminal(terminalId, { assignedMerchantIds: newIds })
      refetchSuperadminTerminals()
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['payment-readiness', venueId] })
      toast({
        title: 'Cuenta desvinculada',
        description: 'La cuenta se ha removido de la terminal',
      })
    } catch (_error) {
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'No se pudo desvincular la cuenta',
      })
    } finally {
      setUnlinkingMerchant(null)
    }
  }

  const commandMutation = useMutation({
    mutationFn: ({ terminalId, command, payload }: { terminalId: string; command: string; payload?: any }) =>
      sendTpvCommandApi(terminalId, command, payload),
    onSuccess: (_data, variables) => {
      const commandLabel = t(`tpv.commandLabels.${variables.command}`, { defaultValue: variables.command })
      toast({
        title: t('tpv.commands.sent', { defaultValue: 'Comando enviado' }),
        description: t('tpv.commands.sentSuccess', {
          command: commandLabel,
          defaultValue: `Comando ${commandLabel} enviado exitosamente`,
        }),
        variant: 'default',
      })

      // Optimistic update for state-changing commands — backend queues async (TPV ACK updates DB later)
      // Without this, the UI stays stale and user can accidentally re-send the same command
      const statusCommandMap: Record<string, string> = {
        MAINTENANCE_MODE: 'MAINTENANCE',
        EXIT_MAINTENANCE: 'ACTIVE',
      }
      const newStatus = statusCommandMap[variables.command]
      if (newStatus) {
        queryClient.setQueryData(['tpvs', venueId, pagination.pageIndex, pagination.pageSize], (old: any) => {
          if (!old?.data) return old
          return {
            ...old,
            data: old.data.map((t: any) => (t.id === variables.terminalId ? { ...t, status: newStatus } : t)),
          }
        })
        // Delay refetch so the optimistic update isn't immediately overwritten by stale server data
        setTimeout(() => {
          queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
        }, 5000)
      } else {
        queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      }
    },
    onError: (error: any) => {
      toast({
        title: t('tpv.commands.error', { defaultValue: 'Error' }),
        description: t('tpv.commands.sendError', {
          error: error.response?.data?.message || error.message,
          defaultValue: `Error enviando comando: ${error.response?.data?.message || error.message}`,
        }),
        variant: 'destructive',
      })
    },
  })

  const sendTpvCommand = useCallback(
    (terminalId: string, command: string) => {
      const payload =
        command === 'MAINTENANCE_MODE'
          ? { message: t('tpv.commands.maintenancePayload', { defaultValue: 'Activado desde dashboard' }), duration: 0 }
          : undefined

      commandMutation.mutate({ terminalId, command, payload })
    },
    [commandMutation, t],
  )

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) => deleteTpv(venueId, terminalId),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setTerminalToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      toast({
        title: t('tpv.messages.deleted', { defaultValue: 'Terminal eliminada' }),
        description: t('tpv.messages.deletedSuccess', { defaultValue: 'La terminal ha sido eliminada correctamente.' }),
      })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || error.message
      toast({
        title: tCommon('error', { defaultValue: 'Error' }),
        description: errorMessage,
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<TerminalType, unknown>[] = [
    {
      id: 'terminal',
      accessorKey: 'name',
      meta: { label: t('tpv.table.columns.name', { defaultValue: 'Terminal' }) },
      header: t('tpv.table.columns.name', { defaultValue: 'Terminal' }),
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)

        return (
          <div className="flex items-center gap-3">
            {/* Status indicator with pulse */}
            <Tooltip>
              <TooltipTrigger asChild>
                <div className="relative">
                  <StatusPulse status={statusStyle.pulseStatus} size="sm" />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs font-medium">{statusStyle.label}</p>
                {terminal.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">{new Date(terminal.lastHeartbeat).toLocaleString()}</p>
                )}
              </TooltipContent>
            </Tooltip>

            {/* Terminal info */}
            <div className="flex flex-col min-w-0">
              <span className="font-medium truncate">{terminal.name}</span>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {terminal.serialNumber && (
                  <span className="font-mono truncate max-w-[140px]">
                    {terminal.serialNumber.startsWith('AVQD-') ? terminal.serialNumber : terminal.serialNumber.slice(0, 8)}
                  </span>
                )}
                {terminal.version && <span className="text-muted-foreground/60">v{terminal.version}</span>}
              </div>
            </div>
          </div>
        )
      },
    },
    {
      id: 'connection',
      header: t('tpv.table.columns.connection', { defaultValue: 'Conexión' }),
      meta: { label: t('tpv.table.columns.connection', { defaultValue: 'Conexión' }) },
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)

        return (
          <div className="flex items-center gap-1.5">
            <StatusPulse status={statusStyle.pulseStatus} size="sm" />
            <span className="text-sm">{statusStyle.label}</span>
          </div>
        )
      },
    },
    {
      id: 'lastConnection',
      header: t('tpv.table.columns.lastConnection', { defaultValue: 'Última conexión' }),
      meta: { label: t('tpv.table.columns.lastConnection', { defaultValue: 'Última conexión' }) },
      cell: ({ row }) => {
        const terminal = row.original as any
        const relativeTime = getRelativeTime(terminal.lastHeartbeat)

        return (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground cursor-default">{relativeTime}</span>
            </TooltipTrigger>
            <TooltipContent>
              {terminal.lastHeartbeat
                ? new Date(terminal.lastHeartbeat).toLocaleString()
                : t('tpv.filter.never', { defaultValue: 'Nunca' })}
            </TooltipContent>
          </Tooltip>
        )
      },
    },
    {
      id: 'activation',
      accessorKey: 'activatedAt',
      meta: { label: t('tpv.table.columns.activation', { defaultValue: 'Activación' }) },
      header: t('tpv.table.columns.activation', { defaultValue: 'Activación' }),
      cell: ({ row }) => {
        const terminal = row.original as any
        const isActivated = terminal.activatedAt != null

        if (isActivated) {
          return (
            <div className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              <span className="text-sm">{t('tpv.status.activated', { defaultValue: 'Activado' })}</span>
            </div>
          )
        }

        return (
          <div className="flex items-center gap-1.5 text-muted-foreground">
            <Package className="w-4 h-4" />
            <span className="text-sm">{t('tpv.status.notActivated', { defaultValue: 'Sin activar' })}</span>
          </div>
        )
      },
    },
    {
      id: 'todaySales',
      meta: { label: t('tpv.table.columns.todaySales', { defaultValue: 'Ventas hoy' }) },
      header: t('tpv.table.columns.todaySales', { defaultValue: 'Ventas hoy' }),
      cell: ({ row }) => {
        const terminal = row.original as any
        const count = terminal.todayPaymentCount || 0
        const total = terminal.todayPaymentTotal || 0

        if (count === 0) {
          return <span className="text-sm text-muted-foreground">—</span>
        }

        return (
          <div className="flex flex-col">
            <span className="text-sm font-medium">{Currency(total)}</span>
            <span className="text-xs text-muted-foreground">
              {count}{' '}
              {count === 1
                ? t('tpv.table.transaction', { defaultValue: 'transacción' })
                : t('tpv.table.transactions', { defaultValue: 'transacciones' })}
            </span>
          </div>
        )
      },
    },
    // SUPERADMIN: Merchant Accounts column
    ...(isSuperadmin
      ? [
          {
            id: 'merchantAccounts',
            header: () => (
              <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
                <CreditCard className="w-4 h-4" />
                <span>Cuentas</span>
              </div>
            ),
            cell: ({ row }: { row: any }) => {
              const terminal = row.original as any
              const assignedIds = terminalMerchantMap.get(terminal.id) || []
              const assignedAccounts = merchantAccounts.filter((m: MerchantAccount) => assignedIds.includes(m.id))
              const availableAccounts = merchantAccounts.filter((m: MerchantAccount) => !assignedIds.includes(m.id))

              // Check if venue has any merchant accounts at all
              const hasNoMerchantAccounts = merchantAccounts.length === 0

              return (
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {/* Show ALL assigned accounts as badges (wrap to multiple rows when needed) */}
                  {assignedAccounts.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap">
                      {assignedAccounts.map((account: MerchantAccount) => (
                        <Badge
                          key={account.id}
                          variant="outline"
                          onClick={e => {
                            e.stopPropagation()
                            setViewingAccount(account)
                          }}
                          className="text-xs py-0 px-1.5 h-5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 group cursor-pointer hover:bg-amber-50 dark:hover:bg-amber-950/30"
                        >
                          <span className="truncate max-w-[80px]">
                            {account.displayName?.split(' ')[0] || account.provider?.name?.slice(0, 8)}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={e => {
                              e.stopPropagation()
                              e.preventDefault()
                              handleUnlinkMerchant(terminal.id, account.id)
                            }}
                            onKeyDown={e => {
                              if (e.key === 'Enter' || e.key === ' ') {
                                e.stopPropagation()
                                e.preventDefault()
                                handleUnlinkMerchant(terminal.id, account.id)
                              }
                            }}
                            aria-label="Desvincular"
                            className="ml-1 inline-flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                          >
                            {unlinkingMerchant?.terminalId === terminal.id && unlinkingMerchant?.merchantId === account.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </span>
                        </Badge>
                      ))}
                    </div>
                  ) : hasNoMerchantAccounts ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="text-xs text-muted-foreground/60 cursor-help">—</span>
                      </TooltipTrigger>
                      <TooltipContent side="left">
                        <p className="text-xs">No hay cuentas de comercio en este venue</p>
                        <p className="text-xs text-muted-foreground">Primero crea una cuenta en Configuración</p>
                      </TooltipContent>
                    </Tooltip>
                  ) : (
                    <span className="text-xs text-muted-foreground">Sin asignar</span>
                  )}

                  {/* Add button with popover */}
                  {availableAccounts.length > 0 && (
                    <Popover
                      open={openPopoverId === terminal.id}
                      onOpenChange={open => {
                        setOpenPopoverId(open ? terminal.id : null)
                        if (!open) setVincularSearch('')
                      }}
                    >
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => e.stopPropagation()}>
                          <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-72 p-0" align="end">
                        <div className="px-3 py-2 border-b border-border">
                          <p className="text-xs font-medium text-muted-foreground mb-2">Vincular cuenta</p>
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                              autoFocus
                              value={vincularSearch}
                              onChange={e => setVincularSearch(e.target.value)}
                              placeholder="Buscar cuenta…"
                              className="h-8 pl-8 text-xs"
                            />
                          </div>
                        </div>
                        <div className="max-h-[260px] overflow-y-auto p-1">
                          {(() => {
                            const q = vincularSearch.trim().toLowerCase()
                            const filtered = q
                              ? availableAccounts.filter(
                                  (a: MerchantAccount) =>
                                    (a.displayName || '').toLowerCase().includes(q) ||
                                    (a.externalMerchantId || '').toLowerCase().includes(q) ||
                                    (a.provider?.name || '').toLowerCase().includes(q),
                                )
                              : availableAccounts
                            if (filtered.length === 0) {
                              return <p className="px-3 py-4 text-xs text-center text-muted-foreground">Sin resultados</p>
                            }
                            return filtered.map((account: MerchantAccount) => (
                              <button
                                key={account.id}
                                onClick={e => {
                                  e.stopPropagation()
                                  handleLinkMerchant(terminal.id, account.id)
                                  setOpenPopoverId(null)
                                  setVincularSearch('')
                                }}
                                disabled={linkingMerchant?.terminalId === terminal.id}
                                className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left"
                              >
                                {linkingMerchant?.terminalId === terminal.id && linkingMerchant?.merchantId === account.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin text-amber-500 shrink-0" />
                                ) : (
                                  <CreditCard className="w-4 h-4 text-amber-500 shrink-0" />
                                )}
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{account.displayName || account.externalMerchantId}</p>
                                  <p className="text-xs text-muted-foreground truncate">{account.provider?.name}</p>
                                </div>
                              </button>
                            ))
                          })()}
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
              )
            },
          },
        ]
      : []),
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const terminal = row.original as any
        const statusStyle = getTerminalStatusStyle(terminal.status, terminal.lastHeartbeat)
        const isInMaintenance = terminal.status === 'MAINTENANCE'
        const isOnline = statusStyle.isOnline

        return (
          <div className="flex items-center justify-end gap-1">
            {/* Show Activate button if terminal is pending activation */}
            {terminal.status === 'PENDING_ACTIVATION' && (
              <PermissionGate permission="tpv:update">
                <Button
                  variant="default"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedTerminalForActivation(terminal.id)
                    setActivationModalOpen(true)
                  }}
                  className="h-7 px-2.5 text-xs"
                >
                  <KeyRound className="w-3.5 h-3.5 mr-1" />
                  {t('tpv.actions.activate', { defaultValue: 'Activar' })}
                </Button>
              </PermissionGate>
            )}

            {/* Only show command buttons if user has permission */}
            <PermissionGate permission="tpv:command">
              {isInMaintenance ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation()
                        sendTpvCommand(terminal.id, 'EXIT_MAINTENANCE')
                      }}
                      className="h-7 w-7 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('tpv.actions.exit_maintenance', { defaultValue: 'Salir mantenimiento' })}</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      disabled={!isOnline}
                      onClick={e => {
                        e.stopPropagation()
                        sendTpvCommand(terminal.id, 'MAINTENANCE_MODE')
                      }}
                      className="h-7 w-7"
                    >
                      <Wrench className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    {isOnline
                      ? t('tpv.actions.maintenance', { defaultValue: 'Mantenimiento' })
                      : t('tpv.actions.offline', { defaultValue: 'Desconectado' })}
                  </TooltipContent>
                </Tooltip>
              )}

              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={e => {
                      e.stopPropagation()
                      sendTpvCommand(terminal.id, 'RESTART')
                    }}
                    className="h-7 w-7"
                  >
                    <RotateCw className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOnline
                    ? t('tpv.commandLabels.RESTART', { defaultValue: 'Reiniciar' })
                    : t('tpv.commandLabels.RESTART_QUEUED', { defaultValue: 'Reiniciar (al conectarse)' })}
                </TooltipContent>
              </Tooltip>
            </PermissionGate>

            {/* Delete button - only for non-activated terminals */}
            {!terminal.activatedAt && (
              <PermissionGate permission="tpv:delete">
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={e => {
                        e.stopPropagation()
                        setTerminalToDelete({ id: terminal.id, name: terminal.name })
                        setDeleteDialogOpen(true)
                      }}
                      className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{t('tpv.actions.delete', { defaultValue: 'Eliminar terminal' })}</TooltipContent>
                </Tooltip>
              </PermissionGate>
            )}
          </div>
        )
      },
    },
  ]

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 bg-background text-foreground max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <PageTitleWithInfo
              title={t('tpv.title', { defaultValue: 'Terminales Punto de Venta' })}
              className="text-2xl font-bold tracking-tight"
              tooltip={t('tpv.info', {
                defaultValue: 'Administra terminales TPV, su estado y acciones remotas.',
              })}
            />
            <p className="text-sm text-muted-foreground mt-1">
              {t('tpv.subtitle', { defaultValue: 'Gestiona los dispositivos TPV de tu restaurante' })}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {/* SUPERADMIN: Direct terminal creation button */}
            {isSuperadmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setSuperadminDialogOpen(true)}
                    className="h-9 bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
                  >
                    <Shield className="w-4 h-4 mr-1.5" />
                    <span>{t('tpv.superadmin.quickCreate', { defaultValue: 'Crear Rápido' })}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('tpv.superadmin.quickCreateTooltip', { defaultValue: 'Crear terminal directamente (solo Superadmin)' })}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Link to org-level TPV config — only OWNER/SUPERADMIN (they have access to org settings page) */}
            {venue?.organizationId && (user?.role === StaffRole.OWNER || isSuperadmin) && (
              <Button size="sm" variant="outline" className="h-9" asChild>
                <Link to={`/organizations/${venue.organizationId}/settings`}>
                  <ExternalLink className="w-4 h-4 mr-1.5" />
                  <span>{t('tpv.actions.globalConfig', { defaultValue: 'Config. Global' })}</span>
                </Link>
              </Button>
            )}

            {/* Regular "Create" button - purchase wizard flow */}
            <PermissionGate permission="tpv:create">
              <Button data-tour="tpv-new-btn" size="sm" variant={isSuperadmin ? 'outline' : 'default'} className="h-9" onClick={() => setWizardOpen(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                <span>{t('tpv.actions.createNew', { defaultValue: 'Nuevo dispositivo' })}</span>
              </Button>
            </PermissionGate>
          </div>
        </div>

        {/* Pill tabs: Terminals (existing list + metrics) vs Pedidos (orders list) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-input h-auto w-fit">
            <TabsTrigger
              value="terminals"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background text-xs px-3 py-1"
            >
              {tTpv('tabs.terminals', { defaultValue: 'Terminales' })}
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background text-xs px-3 py-1"
            >
              {tTpv('tabs.orders', { defaultValue: 'Pedidos' })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminals" className="space-y-6">
            {/* Metrics Summary Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard
                label={t('tpv.metrics.total', { defaultValue: 'Total' })}
                value={metrics.total}
                icon={<Terminal className="w-4 h-4" />}
                accent="blue"
              />
              <MetricCard
                label={t('tpv.metrics.online', { defaultValue: 'En línea' })}
                value={metrics.online}
                icon={<Wifi className="w-4 h-4" />}
                accent="green"
                trend={metrics.online > 0 ? 'up' : 'neutral'}
              />
              <MetricCard
                label={t('tpv.metrics.pendingActivation', { defaultValue: 'Sin activar' })}
                value={metrics.pendingActivation}
                icon={<Package className="w-4 h-4" />}
                accent={metrics.pendingActivation > 0 ? 'yellow' : 'blue'}
              />
              <MetricCard
                label={t('tpv.metrics.maintenance', { defaultValue: 'Mantenimiento' })}
                value={metrics.inMaintenance}
                icon={<Wrench className="w-4 h-4" />}
                accent={metrics.inMaintenance > 0 ? 'orange' : 'blue'}
              />
            </div>

            {/* Data Table — wrapper kept only for the tour anchor */}
            <div data-tour="tpv-list">
          <DataTable
            data={filteredData}
            rowCount={filteredData.length}
            columns={columns}
            isLoading={isLoading}
            enableSearch={false}
            clickableRow={row => ({
              to: row.id,
              state: { from: location.pathname },
            })}
            tableId="tpv:list"
            pagination={pagination}
            setPagination={setPagination}
            tableTabLeft={
              <>
                {/* Expandable Search */}
                <div className="relative flex items-center">
                  {isSearchOpen ? (
                    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                        <Input
                          placeholder={t('tpv.search.placeholder', { defaultValue: 'Buscar terminales...' })}
                          value={searchTerm}
                          onChange={e => setSearchTerm(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Escape') {
                              if (!searchTerm) setIsSearchOpen(false)
                            }
                          }}
                          className="h-7 w-[180px] pl-8 pr-7 text-xs rounded-full"
                          autoFocus
                        />
                        {searchTerm && (
                          <button
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 rounded-full"
                        onClick={() => {
                          setSearchTerm('')
                          setIsSearchOpen(false)
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant={searchTerm ? 'secondary' : 'ghost'}
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => setIsSearchOpen(true)}
                    >
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
                </div>

                <FilterPillBar onReset={resetFilters} resetLabel={t('tpv.filter.reset', { defaultValue: 'Borrar filtros' })}>
                  <FilterPill
                    label={t('tpv.filter.connection', { defaultValue: 'Conexión' })}
                    activeValue={getFilterDisplayLabel(connectionFilter, connectionOptions)}
                    isActive={connectionFilter.length > 0}
                    onClear={() => setConnectionFilter([])}
                  >
                    <CheckboxFilterContent
                      title={t('tpv.filter.connection', { defaultValue: 'Conexión' })}
                      options={connectionOptions}
                      selectedValues={connectionFilter}
                      onApply={setConnectionFilter}
                    />
                  </FilterPill>
                  <FilterPill
                    label={t('tpv.filter.activation', { defaultValue: 'Activación' })}
                    activeValue={getFilterDisplayLabel(activationFilter, activationOptions)}
                    isActive={activationFilter.length > 0}
                    onClear={() => setActivationFilter([])}
                  >
                    <CheckboxFilterContent
                      title={t('tpv.filter.activation', { defaultValue: 'Activación' })}
                      options={activationOptions}
                      selectedValues={activationFilter}
                      onApply={setActivationFilter}
                    />
                  </FilterPill>
                  <FilterPill
                    label={t('tpv.filter.status', { defaultValue: 'Estado' })}
                    activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
                    isActive={statusFilter.length > 0}
                    onClear={() => setStatusFilter([])}
                  >
                    <CheckboxFilterContent
                      title={t('tpv.filter.status', { defaultValue: 'Estado' })}
                      options={statusOptions}
                      selectedValues={statusFilter}
                      onApply={setStatusFilter}
                    />
                  </FilterPill>
                  {versionOptions.length > 0 && (
                    <FilterPill
                      label={t('tpv.filter.version', { defaultValue: 'Versión' })}
                      activeValue={getFilterDisplayLabel(versionFilter, versionOptions)}
                      isActive={versionFilter.length > 0}
                      onClear={() => setVersionFilter([])}
                    >
                      <CheckboxFilterContent
                        title={t('tpv.filter.version', { defaultValue: 'Versión' })}
                        options={versionOptions}
                        selectedValues={versionFilter}
                        onApply={setVersionFilter}
                        searchable={versionOptions.length > 5}
                      />
                    </FilterPill>
                  )}
                </FilterPillBar>
              </>
            }
          />
            </div>
          </TabsContent>

          <TabsContent value="orders">
            <TerminalOrdersTab />
          </TabsContent>
        </Tabs>

        <TerminalPurchaseWizard
          open={wizardOpen}
          onOpenChange={setWizardOpen}
          onSuccess={() => {
            // Refresh the list
            queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
          }}
        />

        <ActivateTerminalModal
          open={activationModalOpen}
          onOpenChange={setActivationModalOpen}
          terminalId={selectedTerminalForActivation}
          onSuccess={() => {
            // Refresh the list
            queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
          }}
        />

        {/* SUPERADMIN: Direct terminal creation dialog */}
        {isSuperadmin && (
          <SuperadminTerminalDialog
            open={superadminDialogOpen}
            onOpenChange={setSuperadminDialogOpen}
            onSuccess={() => {
              queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
            }}
          />
        )}

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{t('tpv.delete.title', { defaultValue: '¿Eliminar terminal?' })}</AlertDialogTitle>
              <AlertDialogDescription>
                {t('tpv.delete.description', {
                  name: terminalToDelete?.name,
                  defaultValue: `Esta acción eliminará permanentemente la terminal "${terminalToDelete?.name}". Esta acción no se puede deshacer.`,
                })}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => terminalToDelete && deleteMutation.mutate(terminalToDelete.id)}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={deleteMutation.isPending}
              >
                {deleteMutation.isPending
                  ? tCommon('deleting', { defaultValue: 'Eliminando...' })
                  : tCommon('delete', { defaultValue: 'Eliminar' })}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Merchant Account detail dialog — opened by clicking a Cuentas badge */}
        <Dialog open={!!viewingAccount} onOpenChange={open => !open && setViewingAccount(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                {viewingAccount?.displayName || viewingAccount?.externalMerchantId || 'Cuenta'}
              </DialogTitle>
              <DialogDescription>
                {viewingAccount?.provider?.name}
                {viewingAccount?.provider?.type ? ` · ${viewingAccount.provider.type}` : ''}
              </DialogDescription>
            </DialogHeader>
            {viewingAccount && (
              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-[max-content_1fr] gap-x-3 gap-y-2">
                  <span className="text-muted-foreground">ID externo</span>
                  <span className="font-mono text-xs break-all">{viewingAccount.externalMerchantId}</span>
                  {viewingAccount.alias && (
                    <>
                      <span className="text-muted-foreground">Alias</span>
                      <span>{viewingAccount.alias}</span>
                    </>
                  )}
                  {viewingAccount.bankName && (
                    <>
                      <span className="text-muted-foreground">Banco</span>
                      <span>{viewingAccount.bankName}</span>
                    </>
                  )}
                  {viewingAccount.accountHolder && (
                    <>
                      <span className="text-muted-foreground">Titular</span>
                      <span>{viewingAccount.accountHolder}</span>
                    </>
                  )}
                  {viewingAccount.clabeNumber && (
                    <>
                      <span className="text-muted-foreground">CLABE</span>
                      <span className="font-mono text-xs">{viewingAccount.clabeNumber}</span>
                    </>
                  )}
                  {viewingAccount.blumonMerchantId && (
                    <>
                      <span className="text-muted-foreground">Blumon merchant</span>
                      <span className="font-mono text-xs">{viewingAccount.blumonMerchantId}</span>
                    </>
                  )}
                  {viewingAccount.blumonSerialNumber && (
                    <>
                      <span className="text-muted-foreground">Blumon serial</span>
                      <span className="font-mono text-xs">{viewingAccount.blumonSerialNumber}</span>
                    </>
                  )}
                  {viewingAccount.blumonEnvironment && (
                    <>
                      <span className="text-muted-foreground">Entorno</span>
                      <Badge variant="outline" className="w-fit">
                        {viewingAccount.blumonEnvironment}
                      </Badge>
                    </>
                  )}
                  {viewingAccount.angelpayAffiliation && (
                    <>
                      <span className="text-muted-foreground">Afiliación AngelPay</span>
                      <span className="font-mono text-xs">{viewingAccount.angelpayAffiliation}</span>
                    </>
                  )}
                  <span className="text-muted-foreground">Estado</span>
                  <Badge variant={viewingAccount.active ? 'default' : 'outline'} className="w-fit">
                    {viewingAccount.active ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setViewingAccount(null)}>
                Cerrar
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </TooltipProvider>
  )
}
