import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getSuperadminActivityLogs,
  getSuperadminActivityLogActions,
  getSuperadminActivityLogEntities,
  type SuperadminActivityLogEntry,
  type SuperadminActivityLogFilters,
  type SuperadminActivityLogResponse,
} from '@/services/superadmin-activity-log.service'
import { getOrganizationsList, type OrganizationSimple } from '@/services/superadmin-organizations.service'
import { getOrganizationVenues } from '@/services/organization.service'
import { getAllVenues } from '@/services/superadmin.service'
import { useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  ChevronLeft,
  ChevronRight,
  FileText,
  LogIn,
  Plus,
  ScrollText,
  Search,
  Settings,
  Shield,
  Smartphone,
  Store,
  Trash2,
  UserCheck,
  UserX,
  Zap,
  DollarSign,
  Package,
  Clock,
  MapPin,
  Key,
  RefreshCw,
} from 'lucide-react'
import { useMemo, useState } from 'react'

// ── Action Display Config ──

interface ActionConfig {
  icon: React.ElementType
  color: string
  bgColor: string
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  // Terminal actions
  TERMINAL_CREATED: { icon: Plus, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  TERMINAL_UPDATED: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  TERMINAL_DELETED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  COMMAND_SENT: { icon: Zap, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  ACTIVATION_CODE_GENERATED: { icon: Smartphone, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  MERCHANTS_ASSIGNED: { icon: Smartphone, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  // User actions
  ROLE_CHANGED: { icon: Shield, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  USER_ACTIVATED: { icon: UserCheck, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  USER_DEACTIVATED: { icon: UserX, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  USER_PASSWORD_RESET: { icon: Key, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  // Auth actions
  MASTER_LOGIN_SUCCESS: { icon: LogIn, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  MASTER_LOGIN_FAILED: { icon: LogIn, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  // Venue actions
  VENUE_CREATED: { icon: Store, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  VENUE_UPDATED: { icon: Store, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  VENUE_DELETED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  VENUE_ASSIGNED: { icon: Plus, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  VENUE_REMOVED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  // Settings
  SETTINGS_UPDATED: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  PASSWORD_RESET: { icon: Shield, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  // Commission actions
  COMMISSION_SUMMARY_APPROVED: { icon: DollarSign, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  COMMISSION_MANUAL_CREATED: { icon: DollarSign, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  COMMISSION_OVERRIDE_CREATED: { icon: DollarSign, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  // Inventory actions
  STOCK_BATCH_CREATED: { icon: Package, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  STOCK_BATCH_QUARANTINED: { icon: Package, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  PURCHASE_ORDER_APPROVED: { icon: Package, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  PURCHASE_ORDER_REJECTED: { icon: Package, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  // Time entry actions
  TIME_ENTRY_APPROVED: { icon: Clock, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  TIME_ENTRY_REJECTED: { icon: Clock, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  TIME_ENTRY_VALIDATION_RESET: { icon: RefreshCw, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  // Zone actions
  ZONE_CREATED: { icon: MapPin, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  ZONE_UPDATED: { icon: MapPin, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  ZONE_DELETED: { icon: MapPin, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  // KYC
  KYC_APPROVED: { icon: Shield, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  KYC_REJECTED: { icon: Shield, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  KYC_IN_REVIEW: { icon: Shield, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  // Payment config
  VENUE_PAYMENT_CONFIG_CREATED: { icon: DollarSign, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  VENUE_PAYMENT_CONFIG_UPDATED: { icon: DollarSign, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  VENUE_PAYMENT_CONFIG_DELETED: { icon: DollarSign, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  // Organization
  ORGANIZATION_UPDATED: { icon: Store, color: 'text-muted-foreground', bgColor: 'bg-muted' },
}

const DEFAULT_ACTION_CONFIG: ActionConfig = {
  icon: FileText,
  color: 'text-muted-foreground',
  bgColor: 'bg-muted',
}

function getActionConfig(action: string): ActionConfig {
  return ACTION_CONFIG[action] || DEFAULT_ACTION_CONFIG
}

function formatActionLabel(action: string): string {
  return action.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
}

// ── Component ──

export default function SuperadminActivityLog() {
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [orgFilter, setOrgFilter] = useState('all')
  const [venueFilter, setVenueFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [entityFilter, setEntityFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 50

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Build filters
  const filters: SuperadminActivityLogFilters = useMemo(
    () => ({
      page,
      pageSize,
      ...(orgFilter !== 'all' && { organizationId: orgFilter }),
      ...(venueFilter !== 'all' && { venueId: venueFilter }),
      ...(actionFilter !== 'all' && { action: actionFilter }),
      ...(entityFilter !== 'all' && { entity: entityFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }),
    [page, pageSize, orgFilter, venueFilter, actionFilter, entityFilter, debouncedSearch],
  )

  // Data fetching
  const { data, isLoading } = useQuery<SuperadminActivityLogResponse>({
    queryKey: ['superadmin-activity-log', filters],
    queryFn: () => getSuperadminActivityLogs(filters),
  })

  const { data: organizations } = useQuery<OrganizationSimple[]>({
    queryKey: ['superadmin-organizations-list'],
    queryFn: () => getOrganizationsList(),
  })

  const { data: allVenues } = useQuery({
    queryKey: ['superadmin-all-venues'],
    queryFn: () => getAllVenues(),
    enabled: orgFilter === 'all',
  })

  const { data: orgVenues } = useQuery({
    queryKey: ['organization', 'venues', orgFilter],
    queryFn: () => getOrganizationVenues(orgFilter),
    enabled: orgFilter !== 'all',
  })

  const venueOptions = useMemo(() => {
    if (orgFilter !== 'all') {
      return (orgVenues ?? []).map((v: { id: string; name: string }) => ({ id: v.id, name: v.name }))
    }
    return (allVenues ?? []).map(v => ({ id: v.id, name: v.name })).sort((a, b) => a.name.localeCompare(b.name))
  }, [orgFilter, orgVenues, allVenues])

  const { data: availableActions } = useQuery<string[]>({
    queryKey: ['superadmin-activity-log-actions'],
    queryFn: () => getSuperadminActivityLogActions(),
  })

  const { data: availableEntities } = useQuery<string[]>({
    queryKey: ['superadmin-activity-log-entities'],
    queryFn: () => getSuperadminActivityLogEntities(),
  })

  const logs = useMemo(() => data?.logs ?? [], [data?.logs])
  const paginationData = data?.pagination

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  const handleOrgChange = (value: string) => {
    setOrgFilter(value)
    setVenueFilter('all') // Reset venue when org changes
    setPage(1)
  }

  // Stats
  const totalLogs = paginationData?.total ?? 0

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-[200px]" />
          <Skeleton className="h-10 w-[200px]" />
        </div>
        <Skeleton className="h-[600px] rounded-xl" />
      </div>
    )
  }

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Activity Log Global</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Registro de auditoría de todas las acciones en la plataforma
            {totalLogs > 0 && (
              <span className="ml-2 text-foreground font-medium">
                ({totalLogs.toLocaleString()} registros)
              </span>
            )}
          </p>
        </div>

        {/* Filters — Row 1: Search + Organization + Venue */}
        <div className="flex flex-col gap-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por acción, entidad o ID..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={orgFilter} onValueChange={handleOrgChange}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todas las organizaciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las organizaciones</SelectItem>
                {organizations?.map(org => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={venueFilter} onValueChange={handleFilterChange(setVenueFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todos los venues" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos los venues</SelectItem>
                {venueOptions.map(v => (
                  <SelectItem key={v.id} value={v.id}>
                    {v.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Filters — Row 2: Action + Entity */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
              <SelectTrigger className="w-full sm:w-[220px]">
                <SelectValue placeholder="Todas las acciones" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las acciones</SelectItem>
                {availableActions?.map(action => (
                  <SelectItem key={action} value={action}>
                    {formatActionLabel(action)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={entityFilter} onValueChange={handleFilterChange(setEntityFilter)}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Todas las entidades" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas las entidades</SelectItem>
                {availableEntities?.map(entity => (
                  <SelectItem key={entity} value={entity}>
                    {entity}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Table */}
        <Card className="border-input overflow-hidden">
          <CardContent className="p-0">
            {logs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
                <ScrollText className="h-12 w-12 mb-4 opacity-40" />
                <p className="text-lg font-medium">
                  {debouncedSearch || actionFilter !== 'all' || entityFilter !== 'all' || orgFilter !== 'all' || venueFilter !== 'all'
                    ? 'No se encontraron registros con estos filtros'
                    : 'No hay actividad registrada aún'}
                </p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Acción</TableHead>
                    <TableHead>Entidad</TableHead>
                    <TableHead>Realizado por</TableHead>
                    <TableHead>Venue</TableHead>
                    <TableHead>Organización</TableHead>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Detalles</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map(log => (
                    <ActivityLogRow key={log.id} log={log} />
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Pagination */}
        {paginationData && paginationData.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Mostrando {(page - 1) * pageSize + 1} - {Math.min(page * pageSize, paginationData.total)} de {paginationData.total.toLocaleString()}
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
              <span className="flex items-center px-3 text-sm text-muted-foreground">
                {page} / {paginationData.totalPages}
              </span>
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
      </div>
    </TooltipProvider>
  )
}

// ── Row Component ──

function ActivityLogRow({ log }: { log: SuperadminActivityLogEntry }) {
  const [expanded, setExpanded] = useState(false)
  const config = getActionConfig(log.action)
  const Icon = config.icon

  const hasDetails = log.data && Object.keys(log.data).length > 0

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${config.bgColor}`}>
              <Icon className={`h-3.5 w-3.5 ${config.color}`} />
            </div>
            <Badge variant="outline" className="text-xs font-mono">
              {formatActionLabel(log.action)}
            </Badge>
          </div>
        </TableCell>
        <TableCell>
          {log.entity ? (
            <span className="text-sm">
              {log.entity}
              {log.entityId && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="text-muted-foreground ml-1 cursor-help">
                      #{log.entityId.slice(0, 8)}
                    </span>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="font-mono text-xs">{log.entityId}</p>
                  </TooltipContent>
                </Tooltip>
              )}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {log.staff ? (
            <span className="text-sm">{log.staff.firstName} {log.staff.lastName}</span>
          ) : (
            <span className="text-muted-foreground text-sm italic">System</span>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm">{log.venueName}</span>
        </TableCell>
        <TableCell>
          {log.organizationName ? (
            <span className="text-sm">{log.organizationName}</span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground cursor-help">
                {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{new Date(log.createdAt).toISOString()}</p>
            </TooltipContent>
          </Tooltip>
        </TableCell>
        <TableCell>
          {hasDetails ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Ocultar' : 'Ver'}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && hasDetails && (
        <TableRow>
          <TableCell colSpan={7} className="bg-muted/50">
            <pre className="text-xs font-mono p-2 rounded-md overflow-x-auto max-w-full">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}
