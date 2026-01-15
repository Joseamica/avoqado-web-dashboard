import { useToast } from '@/hooks/use-toast'
import { deleteTpv, getTpvs, sendTpvCommand as sendTpvCommandApi } from '@/services/tpv.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  KeyRound,
  Loader2,
  Package,
  Plus,
  Shield,
  Terminal,
  Trash2,
  Wifi,
  Wrench,
  X,
} from 'lucide-react'
import { useCallback, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { PermissionGate } from '@/components/PermissionGate'
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
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { StaffRole, Terminal as TerminalType } from '@/types'
import { useTranslation } from 'react-i18next'
import { ActivateTerminalModal } from './components/ActivateTerminalModal'
import { TerminalPurchaseWizard } from './components/purchase-wizard/TerminalPurchaseWizard'
import { SuperadminTerminalDialog } from './components/SuperadminTerminalDialog'

export default function Tpvs() {
  const { venueId } = useCurrentVenue()
  const { user } = useAuth()
  const location = useLocation()
  const { t } = useTranslation()
  const { t: tCommon } = useTranslation('common')
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })
  const [wizardOpen, setWizardOpen] = useState(false)
  const [superadminDialogOpen, setSuperadminDialogOpen] = useState(false)
  const [activationModalOpen, setActivationModalOpen] = useState(false)
  const [selectedTerminalForActivation, setSelectedTerminalForActivation] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>('all')

  // Check if user is SUPERADMIN
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  // Helper function to check if terminal is online
  const isTerminalOnline = (status: string, lastHeartbeat?: string | null) => {
    const now = new Date()
    const heartbeatTime = lastHeartbeat ? new Date(lastHeartbeat) : null
    return status === 'ACTIVE' && heartbeatTime && now.getTime() - heartbeatTime.getTime() < 5 * 60 * 1000
  }

  // Helper function to get terminal status styling
  const getTerminalStatusStyle = (status: string, lastHeartbeat?: string | null) => {
    const isOnline = isTerminalOnline(status, lastHeartbeat)

    switch (status) {
      case 'PENDING_ACTIVATION':
        return {
          dotColor: 'bg-blue-500',
          pulseStatus: 'info' as const,
          label: t('tpv.status.pendingActivation', { defaultValue: 'Pendiente' }),
          isOnline: false,
        }
      case 'ACTIVE':
        return {
          dotColor: isOnline ? 'bg-emerald-500' : 'bg-amber-500',
          pulseStatus: isOnline ? ('success' as const) : ('warning' as const),
          label: isOnline
            ? t('tpv.status.online', { defaultValue: 'En línea' })
            : t('tpv.status.offline', { defaultValue: 'Sin conexión' }),
          isOnline,
        }
      case 'INACTIVE':
        return {
          dotColor: 'bg-muted-foreground/60',
          pulseStatus: 'neutral' as const,
          label: t('tpv.status.inactive', { defaultValue: 'Inactivo' }),
          isOnline: false,
        }
      case 'MAINTENANCE':
        return {
          dotColor: 'bg-orange-500',
          pulseStatus: 'warning' as const,
          label: t('tpv.status.maintenance', { defaultValue: 'Mantenimiento' }),
          isOnline: true,
        }
      case 'RETIRED':
        return {
          dotColor: 'bg-red-500',
          pulseStatus: 'error' as const,
          label: t('tpv.status.retired', { defaultValue: 'Retirado' }),
          isOnline: false,
        }
      default:
        return {
          dotColor: 'bg-muted-foreground/60',
          pulseStatus: 'neutral' as const,
          label: t('tpv.status.unknown', { defaultValue: 'Desconocido' }),
          isOnline: false,
        }
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tpvs', venueId, pagination.pageIndex, pagination.pageSize],
    queryFn: () => getTpvs(venueId, pagination),
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
    } catch (error) {
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
    } catch (error) {
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
    onSuccess: (data, variables) => {
      const commandLabel = t(`tpv.commandLabels.${variables.command}`, { defaultValue: variables.command })
      toast({
        title: t('tpv.commands.sent', { defaultValue: 'Comando enviado' }),
        description: t('tpv.commands.sentSuccess', {
          command: commandLabel,
          defaultValue: `Comando ${commandLabel} enviado exitosamente`,
        }),
        variant: 'default',
      })
      // Refresh the TPV list to show updated status
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
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

  const totalTpvs = data?.meta?.total || 0

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
      id: 'activation',
      accessorKey: 'activatedAt',
      meta: { label: t('tpv.table.columns.activation', { defaultValue: 'Activación' }) },
      header: t('tpv.table.columns.status', { defaultValue: 'Estado' }),
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
                  {/* Show assigned accounts as small badges */}
                  {assignedAccounts.length > 0 ? (
                    <div className="flex items-center gap-1 flex-wrap max-w-[180px]">
                      {assignedAccounts.slice(0, 2).map((account: MerchantAccount) => (
                        <Badge
                          key={account.id}
                          variant="outline"
                          className="text-xs py-0 px-1.5 h-5 border-amber-300 dark:border-amber-700 text-amber-700 dark:text-amber-300 group cursor-default"
                        >
                          <span className="truncate max-w-[60px]">
                            {account.displayName?.split(' ')[0] || account.provider?.name?.slice(0, 6)}
                          </span>
                          <button
                            onClick={e => {
                              e.stopPropagation()
                              handleUnlinkMerchant(terminal.id, account.id)
                            }}
                            disabled={unlinkingMerchant?.terminalId === terminal.id && unlinkingMerchant?.merchantId === account.id}
                            className="ml-1 opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-500"
                          >
                            {unlinkingMerchant?.terminalId === terminal.id && unlinkingMerchant?.merchantId === account.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                        </Badge>
                      ))}
                      {assignedAccounts.length > 2 && (
                        <Badge variant="outline" className="text-xs py-0 px-1.5 h-5">
                          +{assignedAccounts.length - 2}
                        </Badge>
                      )}
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
                    <Popover open={openPopoverId === terminal.id} onOpenChange={open => setOpenPopoverId(open ? terminal.id : null)}>
                      <PopoverTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={e => e.stopPropagation()}>
                          <Plus className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-56 p-2" align="end">
                        <div className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground px-2 py-1">Vincular cuenta</p>
                          {availableAccounts.map((account: MerchantAccount) => (
                            <button
                              key={account.id}
                              onClick={e => {
                                e.stopPropagation()
                                handleLinkMerchant(terminal.id, account.id)
                                setOpenPopoverId(null)
                              }}
                              disabled={linkingMerchant?.terminalId === terminal.id}
                              className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-muted transition-colors text-left"
                            >
                              {linkingMerchant?.terminalId === terminal.id && linkingMerchant?.merchantId === account.id ? (
                                <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
                              ) : (
                                <CreditCard className="w-4 h-4 text-amber-500" />
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="truncate font-medium">{account.displayName || account.externalMerchantId}</p>
                                <p className="text-xs text-muted-foreground truncate">{account.provider?.name}</p>
                              </div>
                            </button>
                          ))}
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
                    disabled={!isOnline}
                    onClick={e => {
                      e.stopPropagation()
                      sendTpvCommand(terminal.id, 'UPDATE_STATUS')
                    }}
                    className="h-7 w-7"
                  >
                    <AlertTriangle className="w-4 h-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {isOnline
                    ? t('tpv.actions.update_status', { defaultValue: 'Actualizar' })
                    : t('tpv.actions.offline', { defaultValue: 'Desconectado' })}
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

  // Search callback for DataTable
  const handleSearch = useCallback(
    (searchTerm: string, tpvs: any[]) => {
      let filtered = tpvs

      // Apply status filter first
      if (statusFilter !== 'all') {
        filtered = filtered.filter(tpv => {
          const isOnline = isTerminalOnline(tpv.status, tpv.lastHeartbeat)
          switch (statusFilter) {
            case 'online':
              return tpv.status === 'ACTIVE' && isOnline
            case 'offline':
              return tpv.status === 'ACTIVE' && !isOnline
            case 'pending':
              return tpv.status === 'PENDING_ACTIVATION'
            case 'maintenance':
              return tpv.status === 'MAINTENANCE'
            default:
              return true
          }
        })
      }

      // Then apply search term
      if (!searchTerm) return filtered

      const lowerSearchTerm = searchTerm.toLowerCase()

      return filtered.filter(tpv => {
        const tpvIdMatch = tpv.id.toString().includes(lowerSearchTerm)
        const tpvNameMatch = tpv.name.toLowerCase().includes(lowerSearchTerm)
        const serialNumberMatch = tpv.serialNumber?.toLowerCase().includes(lowerSearchTerm)
        const versionMatch = tpv.version?.toLowerCase().includes(lowerSearchTerm)

        return tpvIdMatch || tpvNameMatch || serialNumberMatch || versionMatch
      })
    },
    [statusFilter],
  )

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 bg-background text-foreground max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
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
          <div className="flex items-center gap-2">
            {/* SUPERADMIN: Direct terminal creation button */}
            {isSuperadmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    onClick={() => setSuperadminDialogOpen(true)}
                    className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
                  >
                    <Shield className="w-4 h-4 mr-2" />
                    <span>{t('tpv.superadmin.quickCreate', { defaultValue: 'Crear Rápido' })}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {t('tpv.superadmin.quickCreateTooltip', { defaultValue: 'Crear terminal directamente (solo Superadmin)' })}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Regular "Create" button - purchase wizard flow */}
            <PermissionGate permission="tpv:create">
              <Button variant={isSuperadmin ? 'outline' : 'default'} onClick={() => setWizardOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                <span>{t('tpv.actions.createNew', { defaultValue: 'Nuevo dispositivo' })}</span>
              </Button>
            </PermissionGate>
          </div>
        </div>

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

        {/* Filter Row - Industry standard (Square/Stripe pattern) */}
        <div className="flex items-center gap-3">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder={t('tpv.filter.status', { defaultValue: 'Estado' })} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('tpv.filter.all', { defaultValue: 'Todos' })}</SelectItem>
              <SelectItem value="online">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  {t('tpv.filter.online', { defaultValue: 'En línea' })}
                </div>
              </SelectItem>
              <SelectItem value="offline">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-amber-500" />
                  {t('tpv.filter.offline', { defaultValue: 'Sin conexión' })}
                </div>
              </SelectItem>
              <SelectItem value="pending">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500" />
                  {t('tpv.filter.pending', { defaultValue: 'Pendiente' })}
                </div>
              </SelectItem>
              <SelectItem value="maintenance">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-orange-500" />
                  {t('tpv.filter.maintenance', { defaultValue: 'Mantenimiento' })}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>
          {statusFilter !== 'all' && (
            <Button variant="ghost" size="sm" onClick={() => setStatusFilter('all')} className="text-muted-foreground">
              <X className="w-4 h-4 mr-1" />
              {t('tpv.filter.clear', { defaultValue: 'Limpiar' })}
            </Button>
          )}
        </div>

        {/* Data Table in GlassCard */}
        <GlassCard className="p-0 overflow-hidden">
          <DataTable
            data={data?.data || []}
            rowCount={totalTpvs}
            columns={columns}
            isLoading={isLoading}
            enableSearch={true}
            searchPlaceholder={t('tpv.search.placeholder', { defaultValue: 'Buscar terminales...' })}
            onSearch={handleSearch}
            clickableRow={row => ({
              to: row.id,
              state: { from: location.pathname },
            })}
            tableId="tpv:list"
            pagination={pagination}
            setPagination={setPagination}
          />
        </GlassCard>

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
      </div>
    </TooltipProvider>
  )
}
