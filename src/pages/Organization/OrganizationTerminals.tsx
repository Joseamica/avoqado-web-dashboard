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
import { Card, CardContent } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
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
  CreditCard,
  Edit,
  Key,
  Lock,
  MoreHorizontal,
  Plus,
  Power,
  RefreshCw,
  Search,
  Smartphone,
  Trash2,
  Unlock,
  Wifi,
  WifiOff,
  Wrench,
  FileText,
  HardDrive,
} from 'lucide-react'
import React, { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { OrgTerminalDialog } from './components/OrgTerminalDialog'
import { OrgTerminalMerchantDialog } from './components/OrgTerminalMerchantDialog'

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
  const pagination = data?.pagination

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

  const getStatusBadge = (terminal: OrgTerminal) => {
    const online = isTerminalOnline(terminal.lastHeartbeat)

    if (terminal.isLocked) {
      return (
        <Badge variant="destructive" className="bg-red-700">
          {t('terminals.status.locked')}
        </Badge>
      )
    }
    if (terminal.status === 'RETIRED') {
      return <Badge variant="destructive">{t('terminals.status.retired')}</Badge>
    }
    if (terminal.status === 'PENDING_ACTIVATION') {
      return <Badge variant="secondary">{t('terminals.status.pending')}</Badge>
    }
    if (terminal.status === 'MAINTENANCE') {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {t('terminals.status.maintenance')}
        </Badge>
      )
    }
    if (terminal.status === 'ACTIVE' && online) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">
          {t('terminals.status.online')}
        </Badge>
      )
    }
    return <Badge variant="secondary">{t('terminals.status.offline')}</Badge>
  }

  const getTypeBadge = (type: string) => {
    const labels: Record<string, string> = {
      TPV_ANDROID: 'Android',
      TPV_IOS: 'iOS',
      PRINTER_RECEIPT: t('terminals.type.receipt'),
      PRINTER_KITCHEN: t('terminals.type.kitchen'),
      KDS: 'KDS',
    }
    return <Badge variant="outline">{labels[type] || type}</Badge>
  }

  const getHealthBadge = (score: number | null) => {
    if (score === null) return <span className="text-muted-foreground">-</span>
    if (score >= 80) {
      return (
        <Badge variant="default" className="bg-green-600 hover:bg-green-600/80">
          {score}%
        </Badge>
      )
    }
    if (score >= 50) {
      return (
        <Badge variant="outline" className="text-amber-600 border-amber-300">
          {score}%
        </Badge>
      )
    }
    return <Badge variant="destructive">{score}%</Badge>
  }

  const formatLastSeen = (lastHeartbeat: string | null) => {
    if (!lastHeartbeat) return '-'
    return formatDistanceToNow(new Date(lastHeartbeat), { addSuffix: true, locale: dateFnsLocale })
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const lowHealthCount = terminals.filter(t => t.healthScore !== null && t.healthScore < 50).length

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-2">
            <Smartphone className="h-8 w-8 text-primary" />
            {t('terminals.title')}
          </h1>
          <p className="text-muted-foreground mt-1">{t('terminals.subtitle')}</p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          {t('terminals.actions.create')}
        </Button>
      </div>

      {/* Stats Cards */}
      {summary && (
        <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-primary/10 p-2">
                  <Smartphone className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.total')}</p>
                  <p className="text-2xl font-bold">{summary.total}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 dark:bg-green-900/30 p-2">
                  <Wifi className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.online')}</p>
                  <p className="text-2xl font-bold text-green-600">{summary.online}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-muted p-2">
                  <WifiOff className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.offline')}</p>
                  <p className="text-2xl font-bold">{summary.offline}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t('terminals.stats.lowHealth')}</p>
                  <p className="text-2xl font-bold text-amber-600">{lowHealthCount}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

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
      <Card>
        {terminals.length === 0 ? (
          <CardContent className="py-12 text-center text-muted-foreground">
            {debouncedSearch || venueFilter !== 'all' || statusFilter !== 'all' || typeFilter !== 'all'
              ? t('terminals.noResults')
              : t('terminals.empty')}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('terminals.columns.terminal')}</TableHead>
                <TableHead>{t('terminals.columns.venue')}</TableHead>
                <TableHead>{t('terminals.columns.status')}</TableHead>
                <TableHead>{t('terminals.columns.type')}</TableHead>
                <TableHead>{t('terminals.columns.brandModel')}</TableHead>
                <TableHead>{t('terminals.columns.health')}</TableHead>
                <TableHead>{t('terminals.columns.version')}</TableHead>
                <TableHead>{t('terminals.columns.lastSeen')}</TableHead>
                <TableHead className="w-[50px]">{t('terminals.columns.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {terminals.map(terminal => (
                <TableRow key={terminal.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{terminal.name}</p>
                      {terminal.serialNumber && (
                        <p className="text-xs text-muted-foreground">{terminal.serialNumber}</p>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{terminal.venue.name}</TableCell>
                  <TableCell>{getStatusBadge(terminal)}</TableCell>
                  <TableCell>{getTypeBadge(terminal.type)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {[terminal.brand, terminal.model].filter(Boolean).join(' ') || '-'}
                  </TableCell>
                  <TableCell>{getHealthBadge(terminal.healthScore)}</TableCell>
                  <TableCell className="text-muted-foreground">{terminal.version || '-'}</TableCell>
                  <TableCell className="text-muted-foreground">{formatLastSeen(terminal.lastHeartbeat)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEditDialog(terminal)}>
                          <Edit className="h-4 w-4 mr-2" />
                          {t('terminals.actions.edit')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => activationCodeMutation.mutate(terminal.id)}>
                          <Key className="h-4 w-4 mr-2" />
                          {t('terminals.actions.generateCode')}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => remoteActivationMutation.mutate(terminal.id)}>
                          <Power className="h-4 w-4 mr-2" />
                          {t('terminals.actions.remoteActivate')}
                        </DropdownMenuItem>
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
              ))}
            </TableBody>
          </Table>
        )}
      </Card>

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {t('terminals.pagination.showing', {
              from: (pagination.page - 1) * pagination.pageSize + 1,
              to: Math.min(pagination.page * pagination.pageSize, pagination.total),
              total: pagination.total,
            })}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              {t('terminals.pagination.previous')}
            </button>
            <button
              onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
              disabled={page === pagination.totalPages}
              className="px-3 py-1 text-sm border rounded-md disabled:opacity-50 hover:bg-muted"
            >
              {t('terminals.pagination.next')}
            </button>
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
  )
}

export default OrganizationTerminals
