import { AvisoDeCarga } from '@/components/AvisoDeCarga'
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
import { useVenueDateTime } from '@/utils/datetime'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Info, ScrollText, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router-dom'
import { iconFor, TONE_STYLES } from '@/pages/Venue/activity-log/actionDisplay'
import { actionLabel, actionTone, formatEntityId, toDetailRows } from '@/pages/Venue/activity-log/formatActivity'

// ── Component ──

function OrganizationActivityLog() {
  const { t } = useTranslation('organization')
  const { orgId } = useParams<{ orgId: string }>()
  // 🔴 La zona del NEGOCIO, nunca la del navegador (regla crítica #4). Esta pantalla
  // lista varias sucursales a la vez y el endpoint no devuelve la zona de cada una,
  // así que TODO se pinta en una sola zona — y por eso la columna la declara.
  const { venueTimezone, venueTimezoneShort } = useVenueDateTime()

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
  const listQuery = useQuery<OrgActivityLogResponse>({
    queryKey: ['org-activity-log', orgId, filters],
    queryFn: () => getOrgActivityLog(orgId!, filters),
    enabled: !!orgId,
  })
  const { data, isLoading } = listQuery

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
                  {actionLabel(action, t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <AvisoDeCarga query={listQuery} hayDatos={data !== undefined} volverAlInicio={page > 1 && logs.length === 0 ? () => setPage(1) : undefined} />

        {/* Table */}
        {isLoading && <Skeleton className="h-96 rounded-xl" />}
        {data !== undefined && (
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
                  <TableHead>
                    <span className="inline-flex items-center gap-1">
                      {t('activityLog.columns.date')}
                      <span className="text-xs font-normal text-muted-foreground">({venueTimezoneShort})</span>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span tabIndex={0} className="cursor-help" aria-label={t('activityLog.timezoneNote', { timezone: venueTimezone, abbr: venueTimezoneShort })}>
                            <Info className="h-3 w-3 text-muted-foreground" aria-hidden />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent className="max-w-xs">
                          <p className="text-xs">{t('activityLog.timezoneNote', { timezone: venueTimezone, abbr: venueTimezoneShort })}</p>
                        </TooltipContent>
                      </Tooltip>
                    </span>
                  </TableHead>
                  <TableHead>{t('activityLog.columns.details')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map(log => (
                  <ActivityLogRow key={log.id} log={log} />
                ))}
              </TableBody>
            </Table>
          )}
        </GlassCard>
        )}

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

function ActivityLogRow({ log }: { log: OrgActivityLogEntry }) {
  const { t } = useTranslation('organization')
  const { formatDateTime } = useVenueDateTime()
  const [expanded, setExpanded] = useState(false)
  // El mismo tono, icono y texto que la bitácora del negocio (una sola fuente).
  const styles = TONE_STYLES[actionTone(log.action)]
  const Icon = iconFor(log.action)

  const entityId = formatEntityId(log.entityId)
  const entityLabel = log.entity ? t(`activityLog.entities.${log.entity}`, { defaultValue: log.entity }) : null

  const detailRows = useMemo(
    () =>
      toDetailRows(
        log.data,
        key => {
          const full = `activityLog.detailKeys.${key}`
          const translated = t(full)
          return translated === full ? null : translated
        },
        word => t(`activityLog.words.${word}`),
      ),
    [log.data, t],
  )
  const hasDetails = detailRows.length > 0

  return (
    <>
      <TableRow>
        <TableCell>
          <div className="flex items-center gap-2">
            <div className={`p-1.5 rounded-md ${styles.chip}`}>
              <Icon className={`h-3.5 w-3.5 ${styles.icon}`} />
            </div>
            <span className="text-sm font-medium text-foreground">{actionLabel(log.action, t)}</span>
          </div>
        </TableCell>
        <TableCell>
          {entityLabel || entityId ? (
            <span className="text-sm text-muted-foreground">
              {entityLabel}
              {entityLabel && entityId && ' · '}
              {entityId &&
                (entityId.truncated ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="cursor-help font-mono">{entityId.text}</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs">{log.entityId}</p>
                    </TooltipContent>
                  </Tooltip>
                ) : (
                  <span className="font-mono">{entityId.text}</span>
                ))}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
        <TableCell>
          {log.staff ? (
            <span className="text-sm">{log.staff.firstName} {log.staff.lastName}</span>
          ) : (
            <span className="text-muted-foreground text-sm italic">{t('activityLog.system')}</span>
          )}
        </TableCell>
        <TableCell>
          <span className="text-sm">{log.venueName}</span>
        </TableCell>
        <TableCell>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground cursor-help">
                {formatDateTime(log.createdAt)}
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
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 py-1 sm:grid-cols-2">
              {detailRows.map(row => (
                <div key={row.key} className="flex gap-2 text-xs">
                  <dt className="flex-shrink-0 font-medium text-muted-foreground">{row.label}</dt>
                  <dd className="min-w-0 flex-1 break-all text-foreground">{row.value}</dd>
                </div>
              ))}
            </dl>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

export default OrganizationActivityLog
