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
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { MetricCard } from '@/components/ui/metric-card'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { TooltipProvider } from '@/components/ui/tooltip'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { getOrganizationVenues } from '@/services/organization.service'
import {
  assignOrgTerminalMerchants,
  createOrgTerminal,
  deleteOrgTerminal,
  generateOrgTerminalActivationCode,
  getOrgTerminals,
  sendOrgTerminalCommand,
  sendOrgTerminalRemoteActivation,
  updateOrgTerminal,
  type CreateOrgTerminalRequest,
  type OrgTerminal,
  type OrgTerminalCommand,
  type OrgTerminalSortBy,
  type OrgTerminalsFilters,
  type OrgTerminalsResponse,
  type UpdateOrgTerminalRequest,
} from '@/services/organizationDashboard.service'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BookOpen, Plus, Smartphone, Terminal, Wifi, WifiOff } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams, useSearchParams } from 'react-router-dom'
import { OrgTerminalDialog } from './components/OrgTerminalDialog'
import { OrgTerminalMerchantDialog } from './components/OrgTerminalMerchantDialog'
import { OrgTerminalDrawer } from './components/OrgTerminalDrawer'
import { OrgTerminalsBulkBar } from './components/OrgTerminalsBulkBar'
import { OrgTerminalsTable, type SortState } from './components/OrgTerminalsTable'
import { OrgTerminalsToolbar } from './components/OrgTerminalsToolbar'

const PAGE_SIZE = 20
const DEFAULT_SORT: SortState = { sortBy: 'lastHeartbeat', sortOrder: 'desc' }

const STATUS_OPTIONS = ['ACTIVE', 'INACTIVE', 'PENDING_ACTIVATION', 'MAINTENANCE', 'RETIRED'] as const
const TYPE_OPTIONS = ['TPV_ANDROID', 'TPV_IOS', 'PRINTER_RECEIPT', 'PRINTER_KITCHEN', 'KDS'] as const

const TAB_TO_STATUSES: Record<string, string[]> = {
  all: [],
  online: ['ACTIVE'],
  offline: ['INACTIVE'],
  pending: ['PENDING_ACTIVATION'],
  maintenance: ['MAINTENANCE'],
  retired: ['RETIRED'],
}

function parseCsv(value: string | null): string[] {
  if (!value) return []
  return value
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
}

function arraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) return false
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
  return true
}

const VALID_SORT_BY = new Set<OrgTerminalSortBy>([
  'name',
  'lastHeartbeat',
  'status',
  'type',
  'brand',
  'createdAt',
  'latestHealthScore',
  'venue.name',
])

export default function OrganizationTerminals() {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL state
  const searchTerm = searchParams.get('q') ?? ''
  const statusFilter = parseCsv(searchParams.get('status'))
  const typeFilter = parseCsv(searchParams.get('type'))
  const venueFilter = parseCsv(searchParams.get('venue'))
  const drawerTerminalId = searchParams.get('terminal')
  const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10))
  const sortBy = searchParams.get('sortBy')
  const sortOrder = searchParams.get('sortOrder')
  const sort: SortState = {
    sortBy: sortBy && VALID_SORT_BY.has(sortBy as OrgTerminalSortBy) ? (sortBy as OrgTerminalSortBy) : DEFAULT_SORT.sortBy,
    sortOrder: sortOrder === 'asc' ? 'asc' : 'desc',
  }

  // Derive active tab from statusFilter (single match → tab; multi → "all")
  const activeTab = useMemo(() => {
    if (statusFilter.length === 1) {
      const entry = Object.entries(TAB_TO_STATUSES).find(([, s]) => arraysEqual(s, statusFilter))
      if (entry) return entry[0]
    }
    return statusFilter.length === 0 ? 'all' : 'all'
  }, [statusFilter])

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Build filters for the query
  const filters: OrgTerminalsFilters = {
    page,
    pageSize: PAGE_SIZE,
    search: debouncedSearch || undefined,
    statuses: statusFilter.length > 0 ? statusFilter : undefined,
    types: typeFilter.length > 0 ? typeFilter : undefined,
    venueIds: venueFilter.length > 0 ? venueFilter : undefined,
    sortBy: sort.sortBy,
    sortOrder: sort.sortOrder,
  }

  const { data, isLoading, isFetching, refetch } = useQuery<OrgTerminalsResponse>({
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

  // URL state setter — preserves drawer state, replaces history for filter changes.
  const updateParams = useCallback(
    (mutator: (params: URLSearchParams) => void, opts: { resetPage?: boolean; mode?: 'replace' | 'push' } = {}) => {
      setSearchParams(
        prev => {
          const next = new URLSearchParams(prev)
          mutator(next)
          if (opts.resetPage) {
            next.delete('page')
          }
          return next
        },
        { replace: opts.mode !== 'push' },
      )
    },
    [setSearchParams],
  )

  const setSearchValue = (q: string) =>
    updateParams(p => {
      if (q) p.set('q', q)
      else p.delete('q')
    }, { resetPage: true })

  const setStatusValues = (values: string[]) =>
    updateParams(p => {
      if (values.length > 0) p.set('status', values.join(','))
      else p.delete('status')
    }, { resetPage: true })

  const setTypeValues = (values: string[]) =>
    updateParams(p => {
      if (values.length > 0) p.set('type', values.join(','))
      else p.delete('type')
    }, { resetPage: true })

  const setVenueValues = (values: string[]) =>
    updateParams(p => {
      if (values.length > 0) p.set('venue', values.join(','))
      else p.delete('venue')
    }, { resetPage: true })

  const setSort = (next: SortState) =>
    updateParams(p => {
      if (next.sortBy === DEFAULT_SORT.sortBy && next.sortOrder === DEFAULT_SORT.sortOrder) {
        p.delete('sortBy')
        p.delete('sortOrder')
      } else {
        p.set('sortBy', next.sortBy)
        p.set('sortOrder', next.sortOrder)
      }
    }, { resetPage: true })

  const setPage = (next: number) =>
    updateParams(p => {
      if (next <= 1) p.delete('page')
      else p.set('page', String(next))
    })

  const handleTabChange = (tab: string) => {
    const targetStatuses = TAB_TO_STATUSES[tab] ?? []
    setStatusValues(targetStatuses)
  }

  const handleClearAll = () => {
    updateParams(p => {
      p.delete('q')
      p.delete('status')
      p.delete('type')
      p.delete('venue')
    }, { resetPage: true })
  }

  // Drawer URL state (push for browser-back support)
  const openDrawer = (terminal: OrgTerminal) =>
    updateParams(p => p.set('terminal', terminal.id), { mode: 'push' })
  const closeDrawer = () =>
    updateParams(p => p.delete('terminal'), { mode: 'push' })

  // Esc → close drawer (global keydown when drawer is open)
  useEffect(() => {
    if (!drawerTerminalId) return
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeDrawer()
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
    // closeDrawer is stable enough via updateParams; we intentionally exclude to avoid resub
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drawerTerminalId])

  const terminals = useMemo(() => data?.terminals ?? [], [data?.terminals])
  const summary = data?.summary
  const paginationData = data?.pagination

  const metrics = useMemo(() => {
    const total = summary?.total ?? 0
    const online = summary?.online ?? 0
    const offline = summary?.offline ?? 0
    const lowHealth = terminals.filter(t => t.healthScore !== null && t.healthScore < 50).length
    return { total, online, offline, lowHealth }
  }, [summary, terminals])

  // Dialog state
  const [terminalDialogOpen, setTerminalDialogOpen] = useState(false)
  const [editingTerminal, setEditingTerminal] = useState<OrgTerminal | null>(null)
  const [merchantDialogOpen, setMerchantDialogOpen] = useState(false)
  const [merchantTerminal, setMerchantTerminal] = useState<OrgTerminal | null>(null)

  // Single-terminal command confirm dialog
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean
    title: string
    description: string
    action: () => void
    variant?: 'destructive' | 'default'
  }>({ open: false, title: '', description: '', action: () => {} })

  // Selection (for bulk actions)
  const [selectedRows, setSelectedRows] = useState<OrgTerminal[]>([])
  const [clearSelectionTrigger, setClearSelectionTrigger] = useState(0)

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
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: err.response?.data?.message ?? err.message,
      })
    },
  })

  const activationCodeMutation = useMutation({
    mutationFn: (terminalId: string) => generateOrgTerminalActivationCode(orgId!, terminalId),
    onSuccess: data => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.activationCodeGenerated'), description: data.activationCode })
    },
  })

  const remoteActivationMutation = useMutation({
    mutationFn: (terminalId: string) => sendOrgTerminalRemoteActivation(orgId!, terminalId),
    onSuccess: () => {
      invalidateTerminals()
      toast({ title: t('terminals.toast.remoteActivationSent') })
    },
  })

  const commandMutation = useMutation({
    mutationFn: ({ terminalId, command }: { terminalId: string; command: OrgTerminalCommand }) =>
      sendOrgTerminalCommand(orgId!, terminalId, command),
    onSuccess: (_d, variables) => {
      invalidateTerminals()
      toast({ title: t(`terminals.toast.command.${variables.command}` as const, { defaultValue: 'Comando enviado' }) })
    },
    onError: (err: any) => {
      toast({
        variant: 'destructive',
        title: t('terminals.actions.error'),
        description: err.response?.data?.message ?? err.message,
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

  const openCreateDialog = () => {
    setEditingTerminal(null)
    setTerminalDialogOpen(true)
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

  const confirmAction = (
    title: string,
    description: string,
    action: () => void,
    variant?: 'destructive' | 'default',
  ) => {
    setConfirmDialog({ open: true, title, description, action, variant })
  }

  const handleCommandFromDrawer = (terminal: OrgTerminal, command: OrgTerminalCommand) => {
    const dangerous: OrgTerminalCommand[] = ['LOCK', 'FACTORY_RESET']
    const confirmable: OrgTerminalCommand[] = ['LOCK', 'RESTART', 'CLEAR_CACHE', 'FACTORY_RESET', 'REMOTE_ACTIVATE', 'FORCE_UPDATE', 'SYNC_DATA']
    if (confirmable.includes(command)) {
      confirmAction(
        t(`terminals.confirm.${command}.title` as const, { defaultValue: command }),
        t(`terminals.confirm.${command}.description` as const, {
          defaultValue: `¿Enviar ${command} a ${terminal.name}?`,
          name: terminal.name,
        }),
        () => commandMutation.mutate({ terminalId: terminal.id, command }),
        dangerous.includes(command) ? 'destructive' : 'default',
      )
    } else {
      commandMutation.mutate({ terminalId: terminal.id, command })
    }
  }

  const handleSelectionChange = useCallback((rows: OrgTerminal[]) => {
    setSelectedRows(rows)
  }, [])

  const clearSelection = () => {
    setSelectedRows([])
    setClearSelectionTrigger(v => v + 1)
  }

  const onPaginationChange = (next: any) => {
    if (typeof next === 'function') {
      const computed = next({ pageIndex: page - 1, pageSize: PAGE_SIZE })
      setPage(computed.pageIndex + 1)
    } else {
      setPage(next.pageIndex + 1)
    }
  }

  // Loading skeleton (first paint)
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
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    )
  }

  const isOrgEmpty = (summary?.total ?? 0) === 0
  const isFilterEmpty =
    !isOrgEmpty && terminals.length === 0 &&
    (debouncedSearch.length > 0 || statusFilter.length > 0 || typeFilter.length > 0 || venueFilter.length > 0)

  const fromCacheTerminal = drawerTerminalId ? terminals.find(t => t.id === drawerTerminalId) ?? null : null

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{t('terminals.title')}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">{t('terminals.subtitle')}</p>
          </div>
          <Button size="sm" onClick={openCreateDialog} data-tour="org-terminals-create-btn">
            <Plus className="h-4 w-4 mr-1.5" />
            {t('terminals.actions.create')}
          </Button>
        </div>

        {isOrgEmpty ? (
          <EmptyOrgState onCreate={openCreateDialog} />
        ) : (
          <>
            {/* Metric cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <MetricCard label={t('terminals.stats.total')} value={metrics.total} icon={<Terminal className="w-4 h-4" />} accent="blue" />
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

            {/* Status pivot tabs (rounded-full pill style) */}
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="rounded-full bg-muted/60 px-1 py-1 border border-input h-auto flex-wrap">
                {Object.keys(TAB_TO_STATUSES).map(tab => (
                  <TabsTrigger
                    key={tab}
                    value={tab}
                    className="rounded-full data-[state=active]:bg-foreground data-[state=active]:text-background text-xs px-3 py-1"
                  >
                    {t(`terminals.tabs.${tab}` as const)}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

            {/* Toolbar */}
            <OrgTerminalsToolbar
              searchTerm={searchTerm}
              onSearchChange={setSearchValue}
              statusOptions={STATUS_OPTIONS.map(v => ({
                value: v,
                label: t(`terminals.status.${statusKeyFor(v)}` as const, { defaultValue: v }),
              }))}
              statusFilter={statusFilter}
              onStatusChange={setStatusValues}
              typeOptions={TYPE_OPTIONS.map(v => ({ value: v, label: typeLabelFor(v, t) }))}
              typeFilter={typeFilter}
              onTypeChange={setTypeValues}
              venueOptions={(venues ?? []).map(v => ({ value: v.id, label: v.name }))}
              venueFilter={venueFilter}
              onVenueChange={setVenueValues}
              onClearAll={handleClearAll}
              onRefresh={() => refetch()}
              isRefreshing={isFetching}
            />

            {/* Table or empty-results */}
            <GlassCard className="p-0 overflow-hidden">
              {isFilterEmpty ? (
                <EmptyResultsState query={debouncedSearch} onClear={handleClearAll} />
              ) : (
                <OrgTerminalsTable
                  data={terminals}
                  total={paginationData?.total ?? 0}
                  isLoading={isFetching && terminals.length === 0}
                  sort={sort}
                  onSortChange={setSort}
                  pagination={{ pageIndex: page - 1, pageSize: PAGE_SIZE }}
                  setPagination={onPaginationChange}
                  onRowClick={openDrawer}
                  onSelectionChange={handleSelectionChange}
                  clearSelectionTrigger={clearSelectionTrigger}
                />
              )}
            </GlassCard>
          </>
        )}

        {/* Bulk bar */}
        {orgId && (
          <OrgTerminalsBulkBar
            orgId={orgId}
            selected={selectedRows}
            onClear={clearSelection}
            onComplete={result => {
              invalidateTerminals()
              if (result.failed === 0) clearSelection()
            }}
          />
        )}

        {/* Drawer */}
        {orgId && (
          <OrgTerminalDrawer
            orgId={orgId}
            terminalId={drawerTerminalId}
            fromCache={fromCacheTerminal}
            onClose={closeDrawer}
            onCommand={handleCommandFromDrawer}
            onEdit={terminal => {
              setEditingTerminal(terminal)
              setTerminalDialogOpen(true)
            }}
            onEditMerchants={terminal => {
              setMerchantTerminal(terminal)
              setMerchantDialogOpen(true)
            }}
            onDelete={terminal =>
              confirmAction(
                t('terminals.confirm.delete.title'),
                t('terminals.confirm.delete.description', { name: terminal.name }),
                () => deleteMutation.mutate(terminal.id),
                'destructive',
              )
            }
            onGenerateActivationCode={terminal => activationCodeMutation.mutate(terminal.id)}
            onRemoteActivate={terminal => remoteActivationMutation.mutate(terminal.id)}
            isLockUnlockBusy={commandMutation.isPending}
          />
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

        {/* Single-terminal command confirm */}
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
                className={
                  confirmDialog.variant === 'destructive'
                    ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                    : ''
                }
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

// ---------- Helpers ----------

function statusKeyFor(value: string) {
  // Map Prisma status -> i18n key under terminals.status.*
  switch (value) {
    case 'ACTIVE':
      return 'active'
    case 'INACTIVE':
      return 'inactive'
    case 'PENDING_ACTIVATION':
      return 'pending'
    case 'MAINTENANCE':
      return 'maintenance'
    case 'RETIRED':
      return 'retired'
    default:
      return 'inactive'
  }
}

function typeLabelFor(value: string, t: (k: string, opts?: any) => string) {
  switch (value) {
    case 'TPV_ANDROID':
      return 'Android'
    case 'TPV_IOS':
      return 'iOS'
    case 'PRINTER_RECEIPT':
      return t('terminals.type.receipt')
    case 'PRINTER_KITCHEN':
      return t('terminals.type.kitchen')
    case 'KDS':
      return 'KDS'
    default:
      return value
  }
}

// ---------- Empty States ----------

function EmptyOrgState({ onCreate }: { onCreate: () => void }) {
  const { t } = useTranslation('organization')
  return (
    <GlassCard className="px-6 py-16 text-center">
      <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full bg-muted/60">
        <Smartphone className="h-6 w-6 text-muted-foreground" />
      </div>
      <h2 className="mt-4 text-lg font-semibold">{t('terminals.emptyOrg.title')}</h2>
      <p className="mt-2 text-sm text-muted-foreground max-w-md mx-auto">{t('terminals.emptyOrg.body')}</p>
      <div className="mt-5 flex items-center justify-center gap-2">
        <Button size="sm" onClick={onCreate}>
          <Plus className="h-4 w-4 mr-1.5" />
          {t('terminals.emptyOrg.cta')}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.open('https://docs.avoqado.io/terminals', '_blank', 'noopener,noreferrer')}
        >
          <BookOpen className="h-4 w-4 mr-1.5" />
          {t('terminals.emptyOrg.docs')}
        </Button>
      </div>
    </GlassCard>
  )
}

function EmptyResultsState({ query, onClear }: { query: string; onClear: () => void }) {
  const { t } = useTranslation('organization')
  return (
    <div className="py-16 text-center">
      <Smartphone className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
      <p className="text-sm text-foreground font-medium">
        {query ? t('terminals.noResultsForQuery', { q: query }) : t('terminals.emptyResults.title')}
      </p>
      <p className="text-xs text-muted-foreground mt-1">{t('terminals.emptyResults.body')}</p>
      <Button variant="outline" size="sm" className="mt-4" onClick={onClear}>
        {t('terminals.emptyResults.clear')}
      </Button>
    </div>
  )
}
