import { useToast } from '@/hooks/use-toast'
import { useTpvTour } from '@/hooks/useTpvTour'
import { deleteTpv, getTpvs, sendTpvCommand as sendTpvCommandApi, type TpvListDevice } from '@/services/tpv.service'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ChevronDown, CreditCard, Loader2, Plus, Search, Settings2, ShoppingCart, Smartphone, X, Zap } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link, useLocation, useSearchParams } from 'react-router-dom'

import DataTable from '@/components/data-table'
import { FilterPill, FilterPillBar, CheckboxFilterContent } from '@/components/filters'
import { DEVICE_FORM_FACTORS } from '@/lib/device-kind'
import { useDeviceKindLabels } from '@/pages/Tpv/components/useDeviceKindLabels'
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { canMoveMoney } from '@/lib/kyc-utils'
import { isTerminalOnline } from '@/lib/terminal-status'
import { useDebounce } from '@/hooks/useDebounce'
import { paymentProviderAPI, type MerchantAccount } from '@/services/paymentProvider.service'
import { terminalAPI } from '@/services/superadmin-terminals.service'
import { StaffRole } from '@/types'
import { TpvCommandType } from '@/types/tpv-commands'
import { useTranslation } from 'react-i18next'
import { ActivateTerminalModal } from './components/ActivateTerminalModal'
import {
  DeviceAppVersionCell,
  DeviceBatteryCell,
  DeviceIdCell,
  DeviceNameCell,
  DeviceStatusPill,
  DeviceSystemCell,
  DeviceTodaySalesCell,
} from './components/DeviceListCells'
import { DeviceMobileList } from './components/DeviceMobileList'
import { DeviceRowMenu } from './components/DeviceRowMenu'
import { TerminalPurchaseWizard } from './components/purchase-wizard/TerminalPurchaseWizard'
import { SuperadminTerminalDialog } from './components/SuperadminTerminalDialog'
import { TerminalOrdersTab } from './components/TerminalOrdersTab'
import { canConfigurePayments, canSendCommand } from './deviceCapabilities'

// ⚠️ COHERENCIA con tours interactivos:
// Esta página tiene un tour driver.js (`useTpvTour`) que enseña al usuario
// cómo registrar y administrar terminales. Si modificas la UI/UX (lista de
// TPVs, botón de crear, wizard de registro), revisa
// `src/hooks/useTpvTour.ts` y actualiza los selectores `data-tour="tpv-*"`
// y los textos de los steps en paralelo.
//
// Rediseño 8-oct-2026 (maqueta A1, elegida por el founder): una sola tabla al estilo
// Square con columna «Sistema»; sin tarjetas de métricas (contaban sólo la página);
// acciones en un menú «⋯» (el ↻ reiniciaba la terminal a un clic); tarjetas cuando el
// contenido es angosto. Tablero: https://claude.ai/artifact/SruhLk2YJhKTcrHxjSCyim
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
  // 🔴 La COMPRA conserva el candado de KYC (D5, §4.4) aunque el listado ya sea libre: una terminal
  // sin cuenta procesadora no puede cobrar —la crea la aprobación del KYC—, así que venderla antes
  // es venderle al cliente un aparato que todavía no le sirve. El candado se VE y se EXPLICA: el
  // botón queda deshabilitado con su motivo, nunca desaparece.
  const puedeComprarTerminal = canMoveMoney(venue ?? null)

  useEffect(() => {
    if (searchParams.get('action') === 'buy') {
      // El deeplink respeta el mismo candado que el botón: si no, bastaría con la URL para saltarlo.
      if (puedeComprarTerminal) setWizardOpen(true)
      const next = new URLSearchParams(searchParams)
      next.delete('action')
      setSearchParams(next, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to URL changes
  }, [searchParams, puedeComprarTerminal])
  const [superadminDialogOpen, setSuperadminDialogOpen] = useState(false)
  const [activationModalOpen, setActivationModalOpen] = useState(false)
  const [selectedTerminalForActivation, setSelectedTerminalForActivation] = useState<string | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [terminalToDelete, setTerminalToDelete] = useState<{ id: string; name: string } | null>(null)
  const [terminalToRestart, setTerminalToRestart] = useState<TpvListDevice | null>(null)
  const [connectionFilter, setConnectionFilter] = useState<string[]>([])
  const [activationFilter, setActivationFilter] = useState<string[]>([])
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [versionFilter, setVersionFilter] = useState<string[]>([])
  const [kindFilter, setKindFilter] = useState<string[]>([])
  const [originFilter, setOriginFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)

  // Check if user is SUPERADMIN
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  // Etiquetas de clase de aparato, compartidas por la columna "Tipo" y su filtro.
  const deviceKindLabels = useDeviceKindLabels()

  // Multi-select filters and search are sent to backend so pagination respects them.
  // Previously filtered client-side on paginated data — missed matches on other pages.
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: [
      'tpvs',
      venueId,
      pagination.pageIndex,
      pagination.pageSize,
      connectionFilter,
      activationFilter,
      statusFilter,
      versionFilter,
      kindFilter,
      originFilter,
      debouncedSearchTerm,
    ],
    queryFn: () =>
      getTpvs(venueId, pagination, {
        statuses: statusFilter.length > 0 ? statusFilter : undefined,
        versions: versionFilter.length > 0 ? versionFilter : undefined,
        formFactors: kindFilter.length > 0 ? kindFilter : undefined,
        connections: connectionFilter.length > 0 ? (connectionFilter as Array<'online' | 'offline'>) : undefined,
        activations: activationFilter.length > 0 ? (activationFilter as Array<'activated' | 'notActivated'>) : undefined,
        origins: originFilter.length > 0 ? (originFilter as Array<'provisioned' | 'selfRegistered'>) : undefined,
        search: debouncedSearchTerm || undefined,
      }),
    // La búsqueda va en la queryKey: sin esto cada tecla deja `data` vacío, la tabla pinta su
    // esqueleto y el buscador pierde el foco (bounded-data-and-query-load.md).
    placeholderData: keepPreviousData,
  })

  // 🔴 El TOTAL del server, no las filas de la página: con `rowCount = filas` el paginador
  // creía que todo cabía en una página y los dispositivos 21+ quedaban ocultos sin aviso.
  // Todas las lecturas de la lista pasan por aquí: una respuesta sin `data` (o `{}`) nunca tumba la página.
  const filteredData = useMemo(() => data?.data ?? [], [data?.data])
  const totalDevices = data?.meta?.total ?? filteredData.length

  // Version options derived from data
  const versionOptions = useMemo(() => {
    const terminals = filteredData
    const versions: string[] = []
    terminals.forEach(t => {
      if (t.version && !versions.includes(t.version)) versions.push(t.version)
    })
    return versions.sort().map(v => ({ value: v, label: `v${v}` }))
  }, [filteredData])

  // Filter display label helper
  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return tTpv('filter.nSelected', { count: values.length, defaultValue: `${values.length} seleccionados` })
  }

  // Reset all filters
  const resetFilters = useCallback(() => {
    setConnectionFilter([])
    setActivationFilter([])
    setStatusFilter([])
    setVersionFilter([])
    setKindFilter([])
    setOriginFilter([])
    setSearchTerm('')
  }, [])

  const hasActiveFilters =
    connectionFilter.length + activationFilter.length + statusFilter.length + versionFilter.length + kindFilter.length + originFilter.length > 0 ||
    debouncedSearchTerm.length > 0

  // Reset pagination when filters change
  useEffect(() => {
    setPagination(prev => ({ ...prev, pageIndex: 0 }))
  }, [connectionFilter, activationFilter, statusFilter, versionFilter, kindFilter, originFilter, debouncedSearchTerm])

  // All filters are applied server-side via query params (see useQuery above): `filteredData` es
  // la página que devolvió el server, no un filtro en el navegador.

  // Connection filter options
  const connectionOptions = useMemo(
    () => [
      { value: 'online', label: tTpv('filter.online', { defaultValue: 'En línea' }) },
      { value: 'offline', label: tTpv('filter.offline', { defaultValue: 'Sin conexión' }) },
    ],
    [tTpv],
  )

  // Activation filter options
  const activationOptions = useMemo(
    () => [
      { value: 'activated', label: tTpv('filter.activated', { defaultValue: 'Activado' }) },
      { value: 'notActivated', label: tTpv('filter.notActivated', { defaultValue: 'Sin activar' }) },
    ],
    [tTpv],
  )

  // Device kind filter options — mismas etiquetas que la columna "Tipo", para que el
  // dueño reconozca que son lo mismo.
  const kindOptions = useMemo(() => DEVICE_FORM_FACTORS.map(value => ({ value, label: deviceKindLabels[value] })), [deviceKindLabels])

  // Origin filter: hardware que dio de alta un admin vs dispositivo auto-registrado.
  const originOptions = useMemo(
    () => [
      { value: 'provisioned', label: tTpv('filter.provisioned', { defaultValue: 'Dado de alta por admin' }) },
      { value: 'selfRegistered', label: tTpv('filter.selfRegistered', { defaultValue: 'Auto-registrado' }) },
    ],
    [tTpv],
  )

  // Status filter options
  const statusOptions = useMemo(
    () => [
      { value: 'ACTIVE', label: tTpv('filter.active', { defaultValue: 'Activo' }) },
      { value: 'PENDING_ACTIVATION', label: tTpv('filter.pending', { defaultValue: 'Pendiente' }) },
      { value: 'MAINTENANCE', label: tTpv('filter.maintenance', { defaultValue: 'Mantenimiento' }) },
      { value: 'INACTIVE', label: tTpv('filter.inactive', { defaultValue: 'Inactivo' }) },
      { value: 'RETIRED', label: tTpv('filter.retired', { defaultValue: 'Retirado' }) },
    ],
    [tTpv],
  )

  const hasPaymentCapableDevice = useMemo(
    () => filteredData.some(device => canConfigurePayments(device.capabilities)),
    [filteredData],
  )

  // SUPERADMIN: Fetch terminals with assignedMerchantIds
  const { data: superadminTerminals = [], refetch: refetchSuperadminTerminals } = useQuery({
    queryKey: ['superadmin-terminals', venueId],
    queryFn: () => terminalAPI.getAllTerminals({ venueId: venueId! }),
    enabled: isSuperadmin && Boolean(venueId) && hasPaymentCapableDevice,
  })

  // SUPERADMIN: Fetch all merchant accounts (they are global, not per-venue)
  const { data: merchantAccounts = [] } = useQuery({
    queryKey: ['merchant-accounts'],
    queryFn: () => paymentProviderAPI.getAllMerchantAccounts(),
    enabled: isSuperadmin && hasPaymentCapableDevice,
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
    const terminal = filteredData.find(device => device.id === terminalId)
    if (!canConfigurePayments(terminal?.capabilities)) return
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
    const terminal = filteredData.find(device => device.id === terminalId)
    if (!canConfigurePayments(terminal?.capabilities)) return
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
    mutationFn: ({ terminalId, command, payload }: { terminalId: string; command: TpvCommandType; payload?: any }) =>
      sendTpvCommandApi(terminalId, command, payload),
    onSuccess: (_data, variables) => {
      const commandLabel = t(`tpv.commandLabels.${variables.command}`, { defaultValue: variables.command })
      toast({
        title: tTpv('commands.sent', { defaultValue: 'Comando enviado' }),
        description: tTpv('commands.sentSuccess', {
          command: commandLabel,
          defaultValue: `Comando ${commandLabel} enviado exitosamente`,
        }),
        variant: 'default',
      })

      // Optimistic update for state-changing commands — backend queues async (TPV ACK updates DB later)
      // Without this, the UI stays stale and user can accidentally re-send the same command
      const statusCommandMap: Partial<Record<TpvCommandType, string>> = {
        [TpvCommandType.MAINTENANCE_MODE]: 'MAINTENANCE',
        [TpvCommandType.EXIT_MAINTENANCE]: 'ACTIVE',
      }
      const newStatus = statusCommandMap[variables.command]
      if (newStatus) {
        // `setQueriesData` con el prefijo: la queryKey real lleva filtros y búsqueda, así que la
        // llave parcial de antes (`setQueryData`) nunca encontraba la lista y el cambio no se veía.
        queryClient.setQueriesData({ queryKey: ['tpvs', venueId] }, (old: any) => {
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
        title: tTpv('commands.error', { defaultValue: 'Error' }),
        description: tTpv('commands.sendError', {
          error: error.response?.data?.message || error.message,
          defaultValue: `Error enviando comando: ${error.response?.data?.message || error.message}`,
        }),
        variant: 'destructive',
      })
    },
  })

  const sendTpvCommand = useCallback(
    (terminal: TpvListDevice, command: TpvCommandType) => {
      if (!canSendCommand(terminal.capabilities, command)) return
      const payload =
        command === TpvCommandType.MAINTENANCE_MODE
          ? { message: tTpv('commands.maintenancePayload', { defaultValue: 'Activado desde dashboard' }), duration: 0 }
          : undefined

      commandMutation.mutate({ terminalId: terminal.id, command, payload })
    },
    [commandMutation, tTpv],
  )

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) => deleteTpv(venueId, terminalId),
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setTerminalToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      toast({
        title: tTpv('messages.deleted', { defaultValue: 'Terminal eliminada' }),
        description: tTpv('messages.deletedSuccess', { defaultValue: 'La terminal ha sido eliminada correctamente.' }),
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

  const rowLinkState = useMemo(() => ({ from: location.pathname }), [location.pathname])

  const columns: ColumnDef<TpvListDevice, unknown>[] = [
    {
      id: 'terminal',
      accessorKey: 'name',
      meta: { label: tTpv('list.columns.device') },
      header: tTpv('list.columns.device'),
      cell: ({ row }) => <DeviceNameCell device={row.original} name={row.original.name} />,
    },
    {
      id: 'status',
      meta: { label: tTpv('list.columns.status') },
      header: tTpv('list.columns.status'),
      cell: ({ row }) => <DeviceStatusPill device={row.original} />,
    },
    {
      id: 'system',
      meta: { label: tTpv('list.columns.system') },
      header: tTpv('list.columns.system'),
      cell: ({ row }) => <DeviceSystemCell device={row.original} />,
    },
    {
      id: 'battery',
      meta: { label: tTpv('list.columns.battery') },
      header: tTpv('list.columns.battery'),
      cell: ({ row }) => <DeviceBatteryCell device={row.original} />,
    },
    {
      id: 'app',
      meta: { label: tTpv('list.columns.app') },
      header: tTpv('list.columns.app'),
      cell: ({ row }) => <DeviceAppVersionCell device={row.original} />,
    },
    {
      id: 'identifier',
      meta: { label: tTpv('list.columns.id') },
      header: tTpv('list.columns.id'),
      cell: ({ row }) => <DeviceIdCell device={row.original} />,
    },
    {
      id: 'todaySales',
      meta: { label: tTpv('list.columns.todaySales') },
      header: tTpv('list.columns.todaySales'),
      cell: ({ row }) => <DeviceTodaySalesCell count={row.original.todayPaymentCount} total={row.original.todayPaymentTotal} />,
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
              const terminal = row.original as TpvListDevice
              if (!canConfigurePayments(terminal.capabilities)) {
                return <span className="text-xs text-muted-foreground">—</span>
              }
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
      cell: ({ row }) => (
        <DeviceRowMenu
          device={row.original}
          detailTo={row.original.id}
          detailState={rowLinkState}
          onActivate={device => {
            setSelectedTerminalForActivation(device.id)
            setActivationModalOpen(true)
          }}
          onRestart={setTerminalToRestart}
          onCommand={sendTpvCommand}
          onDelete={device => {
            setTerminalToDelete({ id: device.id, name: device.name })
            setDeleteDialogOpen(true)
          }}
        />
      ),
    },
  ]

  const restartIsQueued = terminalToRestart ? !isTerminalOnline(terminalToRestart.lastHeartbeat) : false
  const emptyMessage = hasActiveFilters ? tTpv('list.noMatches') : tTpv('list.empty')

  return (
    <TooltipProvider>
      <div className="p-4 md:p-6 bg-background text-foreground max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <PageTitleWithInfo
              title={tTpv('title', { defaultValue: 'Dispositivos' })}
              className="text-2xl font-bold tracking-tight"
              tooltip={tTpv('info', {
                defaultValue: 'Administra tus dispositivos y las acciones que cada modelo admite.',
              })}
            />
            <p className="text-sm text-muted-foreground mt-1">{tTpv('list.subtitle')}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* SUPERADMIN: Direct terminal creation button */}
            {isSuperadmin && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="sm"
                    onClick={() => setSuperadminDialogOpen(true)}
                    className="h-9 bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
                  >
                    <Zap className="w-4 h-4 mr-1.5" />
                    <span>{tTpv('list.createTerminal')}</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  {tTpv('superadmin.quickCreateTooltip', { defaultValue: 'Crear terminal directamente (solo Superadmin)' })}
                </TooltipContent>
              </Tooltip>
            )}

            {/* Link to org-level TPV config — only OWNER/SUPERADMIN (they have access to org settings page) */}
            {venue?.organizationId && (user?.role === StaffRole.OWNER || isSuperadmin) && (
              <Button size="sm" variant="outline" className="h-9" asChild>
                <Link to={`/organizations/${venue.organizationId}/settings`}>
                  <Settings2 className="w-4 h-4 mr-1.5" />
                  <span>{tTpv('list.terminalSettings')}</span>
                </Link>
              </Button>
            )}

            {/* Agregar dispositivo: comprar una terminal, o explicar que un celular/tablet/PC no se registra */}
            <PermissionGate permission="tpv:create">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button data-tour="tpv-new-btn" size="sm" className="h-9">
                    <Plus className="w-4 h-4 mr-1.5" />
                    <span>{tTpv('list.add.button')}</span>
                    <ChevronDown className="w-4 h-4 ml-1 opacity-70" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-80">
                  <DropdownMenuItem
                    data-tour="tpv-add-buy"
                    disabled={!puedeComprarTerminal}
                    onSelect={() => setWizardOpen(true)}
                    className="items-start py-2.5"
                  >
                    <ShoppingCart className="mt-0.5 size-4" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{tTpv('list.add.buy')}</span>
                      <span className="text-xs text-muted-foreground">
                        {puedeComprarTerminal
                          ? tTpv('list.add.buyHint')
                          : tTpv('actions.buyBlockedByKyc', {
                              defaultValue: 'Activa tus cobros para pedir una terminal: sin eso no podría cobrar con tarjeta.',
                            })}
                      </span>
                    </span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="flex items-start gap-2 py-2.5 font-normal">
                    <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                    <span className="flex flex-col gap-0.5">
                      <span className="font-medium">{tTpv('list.add.app')}</span>
                      <span className="text-xs text-muted-foreground">{tTpv('list.add.appHint')}</span>
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuContent>
              </DropdownMenu>
            </PermissionGate>
          </div>
        </div>

        {/* Pill tabs: Dispositivos vs Pedidos (órdenes de compra de terminales) */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-input h-auto w-fit">
            <TabsTrigger
              value="terminals"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background text-xs px-3 py-1"
            >
              {tTpv('tabs.terminals', { defaultValue: 'Dispositivos' })}
            </TabsTrigger>
            <TabsTrigger
              value="orders"
              className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background text-xs px-3 py-1"
            >
              {tTpv('tabs.orders', { defaultValue: 'Pedidos' })}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="terminals" className="space-y-4">
            {/* Buscador y filtros FUERA de la tabla: los usan la tabla y las tarjetas, y no se desmontan al cargar. */}
            <div className="flex items-center gap-2">
              <div className="relative flex items-center">
                {isSearchOpen ? (
                  <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        placeholder={tTpv('list.searchPlaceholder')}
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                        onKeyDown={e => {
                          if (e.key === 'Escape') {
                            if (!searchTerm) setIsSearchOpen(false)
                          }
                        }}
                        className="h-8 w-[220px] pl-8 pr-7 text-sm rounded-full"
                        autoFocus
                      />
                      {searchTerm && (
                        <button
                          type="button"
                          onClick={() => setSearchTerm('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 cursor-pointer text-muted-foreground hover:text-foreground"
                          aria-label={tCommon('clear', { defaultValue: 'Limpiar' })}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 rounded-full cursor-pointer"
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
                    variant={searchTerm ? 'secondary' : 'outline'}
                    size="icon"
                    className="h-8 w-8 rounded-full cursor-pointer"
                    onClick={() => setIsSearchOpen(true)}
                    aria-label={tTpv('list.searchPlaceholder')}
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                )}
                {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
              </div>

              <FilterPillBar className="min-w-0 flex-1" onReset={resetFilters} resetLabel={tTpv('filter.reset', { defaultValue: 'Borrar filtros' })}>
                <FilterPill
                  label={tTpv('filter.connection', { defaultValue: 'Conexión' })}
                  activeValue={getFilterDisplayLabel(connectionFilter, connectionOptions)}
                  isActive={connectionFilter.length > 0}
                  onClear={() => setConnectionFilter([])}
                >
                  <CheckboxFilterContent
                    title={tTpv('filter.connection', { defaultValue: 'Conexión' })}
                    options={connectionOptions}
                    selectedValues={connectionFilter}
                    onApply={setConnectionFilter}
                  />
                </FilterPill>
                <FilterPill
                  label={tTpv('filter.deviceKind', { defaultValue: 'Tipo' })}
                  activeValue={getFilterDisplayLabel(kindFilter, kindOptions)}
                  isActive={kindFilter.length > 0}
                  onClear={() => setKindFilter([])}
                >
                  <CheckboxFilterContent
                    title={tTpv('filter.deviceKind', { defaultValue: 'Tipo' })}
                    options={kindOptions}
                    selectedValues={kindFilter}
                    onApply={setKindFilter}
                  />
                </FilterPill>
                <FilterPill
                  label={tTpv('filter.status', { defaultValue: 'Estado' })}
                  activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
                  isActive={statusFilter.length > 0}
                  onClear={() => setStatusFilter([])}
                >
                  <CheckboxFilterContent
                    title={tTpv('filter.status', { defaultValue: 'Estado' })}
                    options={statusOptions}
                    selectedValues={statusFilter}
                    onApply={setStatusFilter}
                  />
                </FilterPill>
                {versionOptions.length > 0 && (
                  <FilterPill
                    label={tTpv('filter.version', { defaultValue: 'Versión' })}
                    activeValue={getFilterDisplayLabel(versionFilter, versionOptions)}
                    isActive={versionFilter.length > 0}
                    onClear={() => setVersionFilter([])}
                  >
                    <CheckboxFilterContent
                      title={tTpv('filter.version', { defaultValue: 'Versión' })}
                      options={versionOptions}
                      selectedValues={versionFilter}
                      onApply={setVersionFilter}
                      searchable={versionOptions.length > 5}
                    />
                  </FilterPill>
                )}
                <FilterPill
                  label={tTpv('filter.activation', { defaultValue: 'Activación' })}
                  activeValue={getFilterDisplayLabel(activationFilter, activationOptions)}
                  isActive={activationFilter.length > 0}
                  onClear={() => setActivationFilter([])}
                >
                  <CheckboxFilterContent
                    title={tTpv('filter.activation', { defaultValue: 'Activación' })}
                    options={activationOptions}
                    selectedValues={activationFilter}
                    onApply={setActivationFilter}
                  />
                </FilterPill>
                <FilterPill
                  label={tTpv('filter.origin', { defaultValue: 'Origen' })}
                  activeValue={getFilterDisplayLabel(originFilter, originOptions)}
                  isActive={originFilter.length > 0}
                  onClear={() => setOriginFilter([])}
                >
                  <CheckboxFilterContent
                    title={tTpv('filter.origin', { defaultValue: 'Origen' })}
                    options={originOptions}
                    selectedValues={originFilter}
                    onApply={setOriginFilter}
                  />
                </FilterPill>
              </FilterPillBar>

              {!isLoading && !isError && (
                <span className="shrink-0 text-sm text-muted-foreground tabular-nums">{tTpv('list.count', { count: totalDevices })}</span>
              )}
            </div>

            {isError ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-destructive/40 bg-destructive/5 px-4 py-3 text-sm">
                <span>{tTpv('list.loadError')}</span>
                <Button size="sm" variant="outline" onClick={() => refetch()}>
                  {tTpv('list.retry')}
                </Button>
              </div>
            ) : (
              // Tabla cuando el CONTENIDO mide ≥ 64rem; tarjetas cuando no. Se mide el contenedor,
              // no la pantalla: la barra lateral se come ~16rem y por eso la tabla se partía.
              <div data-tour="tpv-list" className="@container">
                <div className="hidden @5xl:block">
                  <DataTable
                    data={filteredData}
                    rowCount={totalDevices}
                    columns={columns}
                    isLoading={isLoading}
                    enableSearch={false}
                    clickableRow={row => ({
                      to: row.id,
                      state: rowLinkState,
                    })}
                    tableId="tpv:list"
                    pagination={pagination}
                    setPagination={setPagination}
                  />
                  {!isLoading && filteredData.length === 0 && (
                    <p className="mt-3 text-center text-sm text-muted-foreground">{emptyMessage}</p>
                  )}
                </div>
                <div className="@5xl:hidden">
                  <DeviceMobileList
                    devices={filteredData}
                    isLoading={isLoading}
                    total={totalDevices}
                    pageIndex={pagination.pageIndex}
                    pageSize={pagination.pageSize}
                    onPageChange={pageIndex => setPagination(prev => ({ ...prev, pageIndex }))}
                    linkState={rowLinkState}
                    emptyMessage={emptyMessage}
                  />
                </div>
              </div>
            )}
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

        {/* Reiniciar pide confirmación: interrumpe un cobro si alguien está cobrando. */}
        <AlertDialog open={!!terminalToRestart} onOpenChange={open => !open && setTerminalToRestart(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tTpv('list.restartConfirm.title', { name: terminalToRestart?.name ?? '' })}</AlertDialogTitle>
              <AlertDialogDescription>
                {restartIsQueued ? tTpv('list.restartConfirm.descriptionQueued') : tTpv('list.restartConfirm.description')}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{tCommon('cancel', { defaultValue: 'Cancelar' })}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (terminalToRestart) sendTpvCommand(terminalToRestart, TpvCommandType.RESTART)
                  setTerminalToRestart(null)
                }}
              >
                {tTpv('list.restartConfirm.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        {/* Delete confirmation dialog */}
        <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{tTpv('delete.title', { defaultValue: '¿Eliminar terminal?' })}</AlertDialogTitle>
              <AlertDialogDescription>
                {tTpv('delete.description', {
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
