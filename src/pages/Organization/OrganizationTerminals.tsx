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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { MetricCard } from '@/components/ui/metric-card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import {
  assignOrgTerminalMerchants,
  createOrgTerminal,
  deleteOrgTerminal,
  generateOrgTerminalActivationCode,
  getOrgTerminals,
  isTerminalOnline,
  sendOrgTerminalCommand,
  sendOrgTerminalRemoteActivation,
  updateOrgTerminal,
  type CreateOrgTerminalRequest,
  type OrgTerminal,
  type OrgTerminalCommand,
  type OrgTerminalsFilters,
  type OrgTerminalsResponse,
  type UpdateOrgTerminalRequest,
} from '@/services/organizationDashboard.service'
import { getOrganizationVenues } from '@/services/organization.service'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { formatDistanceToNow } from 'date-fns'
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Edit,
  FileText,
  HardDrive,
  Key,
  Lock,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Search,
  Smartphone,
  Terminal,
  Trash2,
  Unlock,
  Wifi,
  WifiOff,
  Wrench,
} from 'lucide-react'
import React, { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { OrgTerminalDialog } from './components/OrgTerminalDialog'
import { OrgTerminalMerchantDialog } from './components/OrgTerminalMerchantDialog'

// ── Status Style Helpers (following Tpvs.tsx pattern) ──

type PulseStatus = 'success' | 'warning' | 'error' | 'neutral' | 'info'

const getTerminalStatusStyle = (terminal: OrgTerminal) => {
  const online = isTerminalOnline(terminal.lastHeartbeat)

  if (terminal.isLocked) {
    return {
      pulseStatus: 'error' as PulseStatus,
      label: 'Bloqueado',
    }
  }

  switch (terminal.status) {
    case 'PENDING_ACTIVATION':
      return {
        pulseStatus: 'info' as PulseStatus,
        label: 'Pendiente',
      }
    case 'ACTIVE':
      return {
        pulseStatus: (online ? 'success' : 'warning') as PulseStatus,
        label: online ? 'En línea' : 'Sin conexión',
      }
    case 'INACTIVE':
      return {
        pulseStatus: 'neutral' as PulseStatus,
        label: 'Inactivo',
      }
    case 'MAINTENANCE':
      return {
        pulseStatus: 'warning' as PulseStatus,
        label: 'Mantenimiento',
      }
    case 'RETIRED':
      return {
        pulseStatus: 'error' as PulseStatus,
        label: 'Retirado',
      }
    default:
      return {
        pulseStatus: 'neutral' as PulseStatus,
        label: 'Desconocido',
      }
  }
}

const OrganizationTerminals: React.FC = () => {
  const { t, i18n } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const dateFnsLocale = getDateFnsLocale(i18n.language)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [venueFilter, setVenueFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 20

  // Dialog state
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false)
  const [editingTerminal, setEditingTerminal] = useState<OrgTerminal | null>(null)
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false)
  const [merchantTerminal, setMerchantTerminal] = useState<OrgTerminal | null>(null)

  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    variant?: 'destructive' | 'default'
  }>({ open: false, title: '', description: '', action: () => {} })

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Data fetching
  const filters: OrgTerminalsFilters = {
    page,
    pageSize,
    ...(venueFilter !== 'all' && { venueId: venueFilter }),
    ...(statusFilter !== 'all' && { status: statusFilter }),
    ...(typeFilter !== 'all' && { type: typeFilter }),
    ...(debouncedSearch && { search: debouncedSearch }),
  }

  const { data, isLoading } = useQuery<OrgTerminalsResponse>({
    queryKey: ['org-terminals', orgId, filters],
    queryFn: () => getOrgTerminals(orgId!, filters),
    enabled: !!orgId,
  })

  const { data: venues } = useQuery({
    queryKey: ['organization', 'venues', orgId],
    queryFn: () => getOrganizationVenues(orgId!),
    enabled: !!orgId,
  })

  const invalidateTerminals = () => queryClient.invalidateQueries({ queryKey: ['org-terminals'] })

  // Mutations
  const createMutation = useMutation({
    mutationFn: (data: CreateOrgTerminalRequest) => createOrgTerminal(orgId!, data),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.created') })
    },
  })

  const updateMutation = useMutation({
    mutationFn: ({ terminalId, data }: { terminalId: string; data: UpdateOrgTerminalRequest }) =>
      updateOrgTerminal(orgId!, terminalId, data),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.updated') })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (terminalId: string) => deleteOrgTerminal(orgId!, terminalId),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.deleted') })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  const activationCodeMutation = useMutation({
    mutationFn: (terminalId: string) => generateOrgTerminalActivationCode(orgId!, terminalId),
    onSuccess: data => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.activationCodeGenerated'), description: data.activationCode })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  const remoteActivationMutation = useMutation({
    mutationFn: (terminalId: string) => sendOrgTerminalRemoteActivation(orgId!, terminalId),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.remoteActivationSent') })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  const commandMutation = useMutation({
    mutationFn: ({ terminalId, command }: { terminalId: string; command: OrgTerminalCommand }) =>
      sendOrgTerminalCommand(orgId!, terminalId, command),
    onSuccess: (_data, variables) => {
      invalidateTerminals()
      toast({ title: t(`terminals.toast.command.${variables.command}`) })
    },
    onError: (error: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: error.response?.data?.message || error.message,
      })
    },
  })

  const assignMerchantsMutation = useMutation({
    mutationFn: ({ terminalId, merchantIds }: { terminalId: string; merchantIds: string[] }) =>
      assignOrgTerminalMerchants(orgId!, terminalId, merchantIds),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.merchantsAssigned') })
    },
  })

  const summary = data?.summary
  const terminals = data?.terminals ?? []
  const paginationData = data?.pagination

  // Metrics (following Tpvs.tsx pattern)
  const metrics = useMemo(() => {
    const total = summary?.total || 0
    const online = summary?.online || 0
    const offline = summary?.offline || 0
    const pendingActivation = terminals.filter(t => !t.activatedAt).length
    const lowHealth = terminals.filter(t => t.healthScore !== null && t.healthScore < 50).length

    return { total, online, offline, pendingActivation, lowHealth }
  }, [summary, terminals])

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void) => (val: string) => {
    setter(val)
    setPage(1)
  }

  const openCreateDialog = () => {
    setEditingTerminal(null)
    setTerminalDialogOpen(true)
  }

  const openEditDialog = (terminal: OrgTerminal) => {
    setEditingTerminal(terminal)
    setTerminalDialogOpen(true)
  }

  const openMerchantDialog = (terminal: OrgTerminal) => {
    setMerchantTerminal(terminal)
    setMerchantDialogOpen(true)
  }

  const confirmAction = (title: string, description: string, action: () => void, variant?: 'destructive' | 'default') => {
    setConfirmDialog({ open: true, title, description, action, variant })
  }

  const handleSaveTerminal = async (data: CreateOrgTerminalRequest | UpdateOrgTerminalRequest) => {
    if (editingTerminal) {
      await updateMutation.mutateAsync({ terminalId: editingTerminal.id, data: data as UpdateOrgTerminalRequest })
    } else {
      await createMutation.mutateAsync(data as CreateOrgTerminalRequest)
    }
  }

  const handleSaveMerchants = async (merchantIds: string[]) => {
    if (merchantTerminal) {
      await assignMerchantsMutation.mutateAsync({ terminalId: merchantTerminal.id, merchantIds })
    }
  }

  const handleCommand = (terminal: OrgTerminal, command: OrgTerminalCommand) => {
    const needsConfirmation: OrgTerminalCommand[] = ['LOCK', 'RESTART', 'CLEAR_CACHE']
    if (needsConfirmation.includes(command)) {
      confirmAction(
        t(`terminals.confirm.${command}.title`),
        t(`terminals.confirm.${command}.description`, { name: terminal.name }),
        () => commandMutation.mutate({ terminalId: terminal.id, command }),
        command === 'LOCK' ? 'destructive' : 'default',
      )
    } else {
      commandMutation.mutate({ terminalId: terminal.id, command })
    }
  }

  const handleDelete = (terminal: OrgTerminal) => {
    confirmAction(
      t('terminals.confirm.delete.title'),
      t('terminals.confirm.delete.description', { name: terminal.name }),
      () => deleteMutation.mutate(terminal.id),
      'destructive',
    )
  }

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TPV_ANDROID: 'Android',
      TPV_IOS: 'iOS',
      PRINTER_RECEIPT: t('terminals.type.receipt'),
      PRINTER_KITCHEN: t('terminals.type.kitchen'),
      KDS: 'KDS',
    }
    return <Badge variant="outline" className="text-xs">{labels[type] || type}</Badge>
  }

  const formatLastSeen = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return '-'
    return formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true, locale: dateFnsLocale })
  }

  // Check if terminal is already activated
  const isActivated = (terminal: OrgTerminal) => !!terminal.activatedAt

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <Skeleton className="h-8 w-64 mb-2" />
            <Skeleton className="h-4 w-96" />
          </div>
          <Skeleton className="h-9 w-36" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">
              {t('terminals.title')}
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('terminals.subtitle')}</p>
          </div>
          <Button onClick={openCreateDialog} size="sm">
            <Plus className="h-4 w-4 mr-1.5" />
            {t('terminals.actions.create')}
          </Button>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            label={t('terminals.stats.total')}
            value={metrics.total}
            icon={<Terminal className="w-4 h-4" />}
            accent="blue"
          />
          <MetricCard
            label={t('terminals.stats.online')}
            value={metrics.online}
            icon={<Wifi className="w-4 h-4" />}
            accent="green"
            trend={metrics.online > 0 ? 'up' : 'neutral'}
          />
          <MetricCard
            label={t('terminals.stats.offline')}
            value={metrics.offline}
            icon={<WifiOff className="w-4 h-4" />}
            accent={metrics.offline > 0 ? 'red' : 'blue'}
          />
          <MetricCard
            label={t('terminals.stats.lowHealth')}
            value={metrics.lowHealth}
            icon={<AlertTriangle className="w-4 h-4" />}
            accent={metrics.lowHealth > 0 ? 'yellow' : 'blue'}
          />
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('terminals.searchPlaceholder')}
              value={searchTerm}
              onChange={e => {
                setSearchTerm(e.target.value)
                setPage(1)
              }}
              className="pl-10"
            />
          </div>
          <Select value={venueFilter} onValueChange={handleFilterChange(setVenueFilter)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('terminals.filters.venue')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('terminals.filters.allVenues')}</SelectItem>
              {venues?.map(v => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={handleFilterChange(setStatusFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('terminals.filters.status')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('terminals.filters.allStatuses')}</SelectItem>
              <SelectItem value="ACTIVE">{t('terminals.status.active')}</SelectItem>
              <SelectItem value="INACTIVE">{t('terminals.status.inactive')}</SelectItem>
              <SelectItem value="PENDING_ACTIVATION">{t('terminals.status.pending')}</SelectItem>
              <SelectItem value="MAINTENANCE">{t('terminals.status.maintenance')}</SelectItem>
              <SelectItem value="RETIRED">{t('terminals.status.retired')}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={typeFilter} onValueChange={handleFilterChange(setTypeFilter)}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder={t('terminals.filters.type')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('terminals.filters.allTypes')}</SelectItem>
              <SelectItem value="TPV_ANDROID">Android</SelectItem>
              <SelectItem value="TPV_IOS">iOS</SelectItem>
              <SelectItem value="PRINTER_RECEIPT">{t('terminals.type.receipt')}</SelectItem>
              <SelectItem value="PRINTER_KITCHEN">{t('terminals.type.kitchen')}</SelectItem>
              <SelectItem value="KDS">KDS</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <GlassCard className="p-0 overflow-hidden">
          {terminals.length === 0 ? (
            <div className="py-16 text-center">
              <Smartphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {debouncedSearch || venueFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
                  ? t('terminals.noResults')
                  : t('terminals.empty')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]" />
                  <TableHead>{t('terminals.columns.terminal')}</TableHead>
                  <TableHead>{t('terminals.columns.venue')}</TableHead>
                  <TableHead>{t('terminals.columns.status')}</TableHead>
                  <TableHead>{t('terminals.columns.type')}</TableHead>
                  <TableHead>{t('terminals.columns.brandModel')}</TableHead>
                  <TableHead>{t('terminals.columns.health')}</TableHead>
                  <TableHead>{t('terminals.columns.version')}</TableHead>
                  <TableHead>{t('terminals.columns.lastSeen')}</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {terminals.map(terminal => {
                  const statusStyle = getTerminalStatusStyle(terminal)
                  const healthScore = terminal.healthScore
                  const healthColor = healthScore === null
                    ? 'text-muted-foreground'
                    : healthScore >= 80
                      ? 'text-green-600 dark:text-green-400'
                      : healthScore >= 50
                        ? 'text-amber-600 dark:text-amber-400'
                        : 'text-red-600 dark:text-red-400'

                  return (
                    <TableRow key={terminal.id} className="group">
                      {/* StatusPulse dot */}
                      <TableCell className="pr-0">
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="relative">
                              <StatusPulse status={statusStyle.pulseStatus} size="sm" />
                            </div>
                          </TooltipTrigger>
                          <TooltipContent side="right">
                            <p className="text-xs font-medium">{statusStyle.label}</p>
                            {terminal.lastHeartbeat && (
                              <p className="text-xs text-muted-foreground">
                                {new Date(terminal.lastHeartbeat).toLocaleString()}
                              </p>
                            )}
                          </TooltipContent>
                        </Tooltip>
                      </TableCell>

                      {/* Terminal name + serial */}
                      <TableCell>
                        <div>
                          <p className="font-medium text-sm">{terminal.name}</p>
                          {terminal.serialNumber && (
                            <p className="text-xs text-muted-foreground font-mono">{terminal.serialNumber}</p>
                          )}
                        </div>
                      </TableCell>

                      {/* Venue */}
                      <TableCell className="text-sm text-muted-foreground">{terminal.venue.name}</TableCell>

                      {/* Status label */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <StatusPulse status={statusStyle.pulseStatus} size="sm" />
                          <span className="text-sm">{statusStyle.label}</span>
                        </div>
                      </TableCell>

                      {/* Type */}
                      <TableCell>{getTypeBadge(terminal.type)}</TableCell>

                      {/* Brand / Model */}
                      <TableCell className="text-sm text-muted-foreground">
                        {[terminal.brand, terminal.model].filter(Boolean).join(' ') || '-'}
                      </TableCell>

                      {/* Health */}
                      <TableCell>
                        <span className={`text-sm font-medium ${healthColor}`}>
                          {healthScore !== null ? `${healthScore}%` : '-'}
                        </span>
                      </TableCell>

                      {/* Version */}
                      <TableCell>
                        <span className="text-sm text-muted-foreground font-mono">
                          {terminal.version || '-'}
                        </span>
                      </TableCell>

                      {/* Last seen */}
                      <TableCell className="text-sm text-muted-foreground">
                        {formatLastSeen(terminal.lastHeartbeat)}
                      </TableCell>

                      {/* Actions */}
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openEditDialog(terminal)}>
                              <Edit className="h-4 w-4 mr-2" />
                              {t('terminals.actions.edit')}
                            </DropdownMenuItem>

                            {/* Only show activation actions for non-activated terminals */}
                            {!isActivated(terminal) && (
                              <>
                                <DropdownMenuItem onClick={() => activationCodeMutation.mutate(terminal.id)}>
                                  <Key className="h-4 w-4 mr-2" />
                                  {t('terminals.actions.generateCode')}
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => remoteActivationMutation.mutate(terminal.id)}>
                                  <Power className="h-4 w-4 mr-2" />
                                  {t('terminals.actions.remoteActivate')}
                                </DropdownMenuItem>
                              </>
                            )}

                            <DropdownMenuSeparator />

                            {terminal.isLocked ? (
                              <DropdownMenuItem onClick={() => handleCommand(terminal, 'UNLOCK')}>
                                <Unlock className="h-4 w-4 mr-2" />
                                {t('terminals.actions.unlock')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleCommand(terminal, 'LOCK')}>
                                <Lock className="h-4 w-4 mr-2" />
                                {t('terminals.actions.lock')}
                              </DropdownMenuItem>
                            )}

                            {terminal.status === 'MAINTENANCE' ? (
                              <DropdownMenuItem onClick={() => handleCommand(terminal, 'EXIT_MAINTENANCE')}>
                                <Wrench className="h-4 w-4 mr-2" />
                                {t('terminals.actions.exitMaintenance')}
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem onClick={() => handleCommand(terminal, 'MAINTENANCE_MODE')}>
                                <Wrench className="h-4 w-4 mr-2" />
                                {t('terminals.actions.maintenance')}
                              </DropdownMenuItem>
                            )}

                            <DropdownMenuItem onClick={() => handleCommand(terminal, 'RESTART')}>
                              <RefreshCw className="h-4 w-4 mr-2" />
                              {t('terminals.actions.restart')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCommand(terminal, 'CLEAR_CACHE')}>
                              <HardDrive className="h-4 w-4 mr-2" />
                              {t('terminals.actions.clearCache')}
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleCommand(terminal, 'EXPORT_LOGS')}>
                              <FileText className="h-4 w-4 mr-2" />
                              {t('terminals.actions.exportLogs')}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => openMerchantDialog(terminal)}>
                              <CreditCard className="h-4 w-4 mr-2" />
                              {t('terminals.actions.assignMerchants')}
                            </DropdownMenuItem>

                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => handleDelete(terminal)}
                              className="text-destructive focus:text-destructive"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              {t('terminals.actions.delete')}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </GlassCard>

        {/* Pagination */}
        {paginationData && paginationData.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('terminals.pagination.showing', {
                from: (paginationData.page - 1) * paginationData.pageSize + 1,
                to: Math.min(paginationData.page * paginationData.pageSize, paginationData.total),
                total: paginationData.total,
              })}
            </p>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                onClick={() => setPage(p => Math.min(paginationData.totalPages, p + 1))}
                disabled={page === paginationData.totalPages}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Dialogs */}
        <OrgTerminalDialog
          open={terminalDialogOpen}
          onOpenChange={setTerminalDialogOpen}
          orgId={orgId!}
          terminal={editingTerminal}
          onSave={handleSaveTerminal}
        />

        <OrgTerminalMerchantDialog
          open={merchantDialogOpen}
          onOpenChange={setMerchantDialogOpen}
          orgId={orgId!}
          terminal={merchantTerminal}
          onSave={handleSaveMerchants}
        />

        {/* Confirmation Dialog */}
        <AlertDialog open={confirmDialog.open} onOpenChange={open => setConfirmDialog(prev => ({ ...prev, open }))}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>{confirmDialog.title}</AlertDialogTitle>
              <AlertDialogDescription>{confirmDialog.description}</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>{t('terminals.confirm.cancel')}</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  confirmDialog.action()
                  setConfirmDialog(prev => ({ ...prev, open: false }))
                }}
                className={confirmDialog.variant === 'destructive' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
              >
                {t('terminals.confirm.confirm')}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </TooltipProvider>
  )
}

export default OrganizationTerminals
