import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { GlassCard } from '@/components/ui/glass-card'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getOrgActivityLog,
  getOrgActivityLogActions,
  type OrgActivityLogEntry,
  type OrgActivityLogFilters,
  type OrgActivityLogResponse,
} from '@/services/organizationDashboard.service'
import { getOrganizationVenues } from '@/services/organization.service'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import { useQuery } from '@tanstack/react-query'
import { format, type Locale } from 'date-fns'
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
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'

// ── Action Display Config ──

interface ActionConfig {
  icon: React.ElementType
  color: string
  bgColor: string
}

const ACTION_CONFIG: Record<string, ActionConfig> = {
  TERMINAL_CREATED: { icon: Plus, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  TERMINAL_UPDATED: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  TERMINAL_DELETED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  COMMAND_SENT: { icon: Zap, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  ACTIVATION_CODE_GENERATED: { icon: Smartphone, color: 'text-cyan-600 dark:text-cyan-400', bgColor: 'bg-cyan-100 dark:bg-cyan-900/30' },
  MERCHANTS_ASSIGNED: { icon: Smartphone, color: 'text-indigo-600 dark:text-indigo-400', bgColor: 'bg-indigo-100 dark:bg-indigo-900/30' },
  ROLE_CHANGED: { icon: Shield, color: 'text-purple-600 dark:text-purple-400', bgColor: 'bg-purple-100 dark:bg-purple-900/30' },
  USER_ACTIVATED: { icon: UserCheck, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  USER_DEACTIVATED: { icon: UserX, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  MASTER_LOGIN_SUCCESS: { icon: LogIn, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
  MASTER_LOGIN_FAILED: { icon: LogIn, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  VENUE_CREATED: { icon: Store, color: 'text-blue-600 dark:text-blue-400', bgColor: 'bg-blue-100 dark:bg-blue-900/30' },
  VENUE_UPDATED: { icon: Store, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  VENUE_DELETED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  VENUE_ASSIGNED: { icon: Plus, color: 'text-green-600 dark:text-green-400', bgColor: 'bg-green-100 dark:bg-green-900/30' },
  VENUE_REMOVED: { icon: Trash2, color: 'text-red-600 dark:text-red-400', bgColor: 'bg-red-100 dark:bg-red-900/30' },
  SETTINGS_UPDATED: { icon: Settings, color: 'text-muted-foreground', bgColor: 'bg-muted' },
  PASSWORD_RESET: { icon: Shield, color: 'text-amber-600 dark:text-amber-400', bgColor: 'bg-amber-100 dark:bg-amber-900/30' },
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

function OrganizationActivityLog() {
  const { t, i18n } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  const dateFnsLocale = getDateFnsLocale(i18n.language)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [venueFilter, setVenueFilter] = useState('all')
  const [actionFilter, setActionFilter] = useState('all')
  const [page, setPage] = useState(1)
  const pageSize = 25

  const debouncedSearch = useDebounce(searchTerm, 300)

  // Build filters
  const filters: OrgActivityLogFilters = useMemo(
    () => ({
      page,
      pageSize,
      ...(venueFilter !== 'all' && { venueId: venueFilter }),
      ...(actionFilter !== 'all' && { action: actionFilter }),
      ...(debouncedSearch && { search: debouncedSearch }),
    }),
    [page, pageSize, venueFilter, actionFilter, debouncedSearch],
  )

  // Data fetching
  const { data, isLoading } = useQuery<OrgActivityLogResponse>({
    queryKey: ['org-activity-log', orgId, filters],
    queryFn: () => getOrgActivityLog(orgId!, filters),
    enabled: !!orgId,
  })

  const { data: venues } = useQuery({
    queryKey: ['organization', 'venues', orgId],
    queryFn: () => getOrganizationVenues(orgId!),
    enabled: !!orgId,
  })

  const { data: availableActions } = useQuery<string[]>({
    queryKey: ['org-activity-log-actions', orgId],
    queryFn: () => getOrgActivityLogActions(orgId!),
    enabled: !!orgId,
  })

  const logs = useMemo(() => data?.logs ?? [], [data?.logs])
  const paginationData = data?.pagination

  // Reset page when filters change
  const handleFilterChange = (setter: (val: string) => void) => (value: string) => {
    setter(value)
    setPage(1)
  }

  // Loading skeleton
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <Skeleton className="h-8 w-64 mb-2" />
          <Skeleton className="h-4 w-96" />
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
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('activityLog.title')}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">{t('activityLog.subtitle')}</p>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t('activityLog.searchPlaceholder')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={venueFilter} onValueChange={handleFilterChange(setVenueFilter)}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder={t('activityLog.filters.allVenues')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('activityLog.filters.allVenues')}</SelectItem>
              {venues?.map((v: { id: string; name: string }) => (
                <SelectItem key={v.id} value={v.id}>
                  {v.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={actionFilter} onValueChange={handleFilterChange(setActionFilter)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder={t('activityLog.filters.allActions')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('activityLog.filters.allActions')}</SelectItem>
              {availableActions?.map(action => (
                <SelectItem key={action} value={action}>
                  {formatActionLabel(action)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <GlassCard className="overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <ScrollText className="h-12 w-12 mb-4 opacity-40" />
              <p className="text-lg font-medium">
                {debouncedSearch || venueFilter !== 'all' || actionFilter !== 'all'
                  ? t('activityLog.noResults')
                  : t('activityLog.empty')}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('activityLog.columns.action')}</TableHead>
                  <TableHead>{t('activityLog.columns.entity')}</TableHead>
                  <TableHead>{t('activityLog.columns.performedBy')}</TableHead>
                  <TableHead>{t('activityLog.columns.venue')}</TableHead>
                  <TableHead>{t('activityLog.columns.date')}</TableHead>
                  <TableHead>{t('activityLog.columns.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <ActivityLogRow key={log.id} log={log} dateFnsLocale={dateFnsLocale} />
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCard>

        {/* Pagination */}
        {paginationData && paginationData.totalPages > 1 && (
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t('activityLog.pagination.showing', {
                from: (page - 1) * pageSize + 1,
                to: Math.min(page * pageSize, paginationData.total),
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
      </div>
    </TooltipProvider>
  )
}

// ── Row Component ──

function ActivityLogRow({ log, dateFnsLocale }: { log: OrgActivityLogEntry; dateFnsLocale: Locale }) {
  const { t } = useTranslation('organization')
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
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground cursor-help">
                {format(new Date(log.createdAt), 'dd MMM yyyy, HH:mm', { locale: dateFnsLocale })}
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
              {expanded ? t('activityLog.hideDetails') : t('activityLog.showDetails')}
            </Button>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      </TableRow>
      {expanded && hasDetails && (
        <TableRow>
          <TableCell colSpan={6} className="bg-muted/50">
            <pre className="text-xs font-mono p-2 rounded-md overflow-x-auto max-w-full">
              {JSON.stringify(log.data, null, 2)}
            </pre>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default OrganizationActivityLog
