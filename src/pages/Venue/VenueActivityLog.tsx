import { FeatureGate } from '@/components/billing/FeatureGate'
import { DateFilterContent, FilterPill, FilterPillBar, SingleSelectFilterContent, type DateFilter } from '@/components/filters'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { cn } from '@/lib/utils'
import { teamService } from '@/services/team.service'
import {
  getVenueActivityLog,
  getVenueActivityLogActions,
  type VenueActivityLogEntry,
  type VenueActivityLogFilters,
  type VenueActivityLogResponse,
} from '@/services/venueActivity.service'
import { useVenueDateTime } from '@/utils/datetime'
import { useQuery } from '@tanstack/react-query'
import {
  AlertTriangle,
  Ban,
  Banknote,
  Boxes,
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileText,
  LogIn,
  Pencil,
  Plus,
  Printer,
  ScrollText,
  Search,
  Shield,
  ShoppingCart,
  Smartphone,
  Store,
  Trash2,
  User,
  Tag,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { actionTone, dateFilterToRange, formatEntityId, groupByDay, toDetailRows, type ActionTone } from './activity-log/formatActivity'

// ── Presentación de la acción ─────────────────────────────────────────────────

/** Colores por tono. Cada uno lleva su variante dark explícita. */
const TONE_STYLES: Record<ActionTone, { icon: string; dot: string }> = {
  destructive: { icon: 'text-red-600 dark:text-red-400', dot: 'bg-red-500' },
  attention: { icon: 'text-amber-600 dark:text-amber-400', dot: 'bg-amber-500' },
  positive: { icon: 'text-emerald-600 dark:text-emerald-400', dot: 'bg-emerald-500' },
  neutral: { icon: 'text-muted-foreground', dot: 'bg-muted-foreground/40' },
}

/**
 * Icono por FAMILIA de acción, no por código exacto.
 * El servidor emite más de 500 códigos: un mapa uno a uno se queda atrás y la
 * acción nueva sale sin icono. Se evalúa en orden — gana la primera que casa.
 */
const ICON_RULES: Array<[RegExp, React.ElementType]> = [
  [/PERMISSION|ROLE|KYC|OVERRIDE/, Shield],
  [/LOGIN|LOGOUT|SESSION|INVIT|PIN_/, LogIn],
  [/PAYMENT|REFUND|CASH|SETTLEMENT|COMMISSION|PAYOUT|MERCHANT|CFDI|LEDGER|JOURNAL|EXPENSE|PAYROLL|CREDIT|RATE_|REVENUE|FINANCIAL|TOKENS/, Banknote],
  [/STOCK|INVENTORY|RAW_MATERIAL|RECIPE|BATCH|TRANSFER|SERIALIZED|SIM_/, Boxes],
  [/PURCHASE_ORDER|SUPPLIER|PURCHASE_INVOICE/, ShoppingCart],
  [/MENU|PRODUCT|MODIFIER|CATEGORY|CATALOG|PROMOTION|DISCOUNT|COUPON|UPSELL/, Tag],
  [/TERMINAL|TPV|DEVICE|DISPLAY_MODE|SCALE/, Smartphone],
  [/PRINT/, Printer],
  [/STAFF|TEAM|EMPLOYEE|USER_|CUSTOMER|WAITLIST/, User],
  [/SHIFT|SCHEDULE|OVERTIME|TIME_ENTRY|ATTENDANCE|RESERVATION|CLASS_SESSION/, CalendarClock],
  [/VENUE|ORGANIZATION|ORG_|SETTINGS|CONFIG|FEATURE|PLAN_|ZONE|TABLE|FLOOR/, Store],
  [/DENIED|REJECTED|FAILED|BLOCKED|LOCKED/, Ban],
  [/DELETED|REMOVED|CANCELLED|VOIDED/, Trash2],
  [/CREATED|ADDED|ISSUED|GENERATED/, Plus],
  [/APPROVED|CONFIRMED|COMPLETED|RESOLVED/, CircleCheck],
  [/UPDATED|CHANGED|_SET$|REORDERED|EDIT/, Pencil],
]

function iconFor(action: string): React.ElementType {
  // Lo negado manda sobre el sustantivo: PERMISSION_DENIED debe leerse como un
  // bloqueo, no como "algo de permisos".
  if (/DENIED|REJECTED|FAILED|LOCKED|INSUFFICIENT/.test(action)) return Ban
  for (const [re, Icon] of ICON_RULES) if (re.test(action)) return Icon
  return FileText
}

// ── Pantalla ──────────────────────────────────────────────────────────────────

const PAGE_SIZE = 25

function VenueActivityLog() {
  const { t } = useTranslation('organization')
  const { venueId } = useCurrentVenue()
  const { venueTimezone } = useVenueDateTime()

  const [searchTerm, setSearchTerm] = useState('')
  const [actionFilter, setActionFilter] = useState<string | null>(null)
  const [staffFilter, setStaffFilter] = useState<string | null>(null)
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const [page, setPage] = useState(1)

  const debouncedSearch = useDebounce(searchTerm, 300)

  const dateRange = useMemo(() => dateFilterToRange(dateFilter), [dateFilter])

  const filters: VenueActivityLogFilters = useMemo(
    () => ({
      page,
      pageSize: PAGE_SIZE,
      ...(actionFilter && { action: actionFilter }),
      ...(staffFilter && { staffId: staffFilter }),
      ...dateRange,
      ...(debouncedSearch && { search: debouncedSearch }),
    }),
    [page, actionFilter, staffFilter, dateRange, debouncedSearch],
  )

  const {
    data,
    isLoading,
    isError,
    refetch,
    isFetching,
  } = useQuery<VenueActivityLogResponse>({
    queryKey: ['venue-activity-log', venueId, filters],
    queryFn: () => getVenueActivityLog(venueId!, filters),
    enabled: !!venueId,
    placeholderData: previous => previous,
  })

  const { data: availableActions } = useQuery<string[]>({
    queryKey: ['venue-activity-log-actions', venueId],
    queryFn: () => getVenueActivityLogActions(venueId!),
    enabled: !!venueId,
  })

  const { data: teamData } = useQuery({
    queryKey: ['venue-activity-log-staff', venueId],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: !!venueId,
  })

  const staffOptions = useMemo(
    () =>
      (teamData?.data ?? []).map(m => ({
        value: m.staffId,
        label: `${m.firstName} ${m.lastName}`.trim(),
      })),
    [teamData?.data],
  )

  const actionOptions = useMemo(
    () =>
      (availableActions ?? [])
        .map(action => ({ value: action, label: labelForAction(action, t) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    [availableActions, t],
  )

  const logs = useMemo(() => data?.logs ?? [], [data?.logs])
  const pagination = data?.pagination

  // El día se corta en la zona del NEGOCIO, nunca en la del navegador.
  const dayKeyOf = useMemo(() => {
    const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: venueTimezone, year: 'numeric', month: '2-digit', day: '2-digit' })
    return (iso: string) => {
      const d = new Date(iso)
      return Number.isNaN(d.getTime()) ? iso : fmt.format(d)
    }
  }, [venueTimezone])

  const groups = useMemo(() => groupByDay(logs, dayKeyOf), [logs, dayKeyOf])

  const activeFilterCount =
    (debouncedSearch ? 1 : 0) + (actionFilter ? 1 : 0) + (staffFilter ? 1 : 0) + (dateFilter ? 1 : 0)

  const resetPage = <T,>(setter: (v: T) => void) => (value: T) => {
    setter(value)
    setPage(1)
  }

  const clearAll = () => {
    setSearchTerm('')
    setActionFilter(null)
    setStaffFilter(null)
    setDateFilter(null)
    setPage(1)
  }

  return (
    <FeatureGate feature="VENUE_AUDIT_LOG" requiredTier="PRO">
      <TooltipProvider delayDuration={200}>
        <div className="space-y-5">
          {/* Encabezado */}
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('activityLog.title')}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{t('activityLog.subtitleVenue')}</p>
          </div>

          {/* Barra de filtros — mismo orden en que se leen las columnas */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
            <div className="relative flex-shrink-0">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder={t('activityLog.searchPlaceholder')}
                value={searchTerm}
                onChange={e => {
                  setSearchTerm(e.target.value)
                  setPage(1)
                }}
                className="h-7 w-[220px] rounded-full pl-8 text-xs"
              />
            </div>

            <FilterPillBar
              onReset={activeFilterCount > 0 ? clearAll : undefined}
              resetLabel={t('activityLog.filters.clear')}
            >
            <FilterPill
              label={t('activityLog.filters.action')}
              activeLabel={actionFilter ? labelForAction(actionFilter, t) : null}
              onClear={() => resetPage(setActionFilter)(null)}
            >
              <SingleSelectFilterContent
                title={t('activityLog.filters.action')}
                options={actionOptions}
                selectedValue={actionFilter}
                onSelect={resetPage(setActionFilter)}
                searchable
                searchPlaceholder={t('activityLog.filters.searchActions')}
              />
            </FilterPill>

            <FilterPill
              label={t('activityLog.filters.staff')}
              activeLabel={staffOptions.find(s => s.value === staffFilter)?.label ?? null}
              onClear={() => resetPage(setStaffFilter)(null)}
            >
              <SingleSelectFilterContent
                title={t('activityLog.filters.staff')}
                options={staffOptions}
                selectedValue={staffFilter}
                onSelect={resetPage(setStaffFilter)}
                searchable
              />
            </FilterPill>

            <FilterPill
              label={t('activityLog.filters.date')}
              isActive={!!dateFilter}
              onClear={() => resetPage(setDateFilter)(null)}
            >
              <DateFilterContent
                title={t('activityLog.filters.date')}
                value={dateFilter}
                onApply={resetPage(setDateFilter)}
                timezone={venueTimezone}
              />
            </FilterPill>
            </FilterPillBar>
          </div>

          {/* Contenido */}
          {isLoading ? (
            <ActivitySkeleton />
          ) : isError ? (
            <EmptyState
              icon={AlertTriangle}
              title={t('activityLog.error.title')}
              action={
                <Button variant="outline" size="sm" onClick={() => refetch()}>
                  {t('activityLog.error.retry')}
                </Button>
              }
            />
          ) : logs.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              title={activeFilterCount > 0 ? t('activityLog.noResults') : t('activityLog.empty')}
              action={
                activeFilterCount > 0 ? (
                  <Button variant="outline" size="sm" onClick={clearAll}>
                    {t('activityLog.filters.clear')}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <div className={cn('overflow-hidden rounded-xl border border-input', isFetching && 'opacity-60 transition-opacity')}>
              {groups.map(group => (
                <section key={group.day}>
                  <DayHeading day={group.day} timezone={venueTimezone} />
                  <ul className="divide-y divide-border/60">
                    {group.logs.map(log => (
                      <ActivityRow key={log.id} log={log} />
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          {/* Paginación */}
          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {t('activityLog.pagination.showing', {
                  from: (page - 1) * PAGE_SIZE + 1,
                  to: Math.min(page * PAGE_SIZE, pagination.total),
                  total: pagination.total,
                })}
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('activityLog.pagination.previous')}
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1 || isFetching}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={t('activityLog.pagination.next')}
                  className="h-8 w-8"
                  onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                  disabled={page === pagination.totalPages || isFetching}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </TooltipProvider>
    </FeatureGate>
  )
}

// ── Piezas ────────────────────────────────────────────────────────────────────

function labelForAction(action: string, t: (key: string, opts?: Record<string, unknown>) => string): string {
  return t(`activityLog.actions.${action}`, {
    // El fallback deja de gritar en MAYÚSCULAS: "PERMISSION DENIED" → "Permission denied".
    defaultValue: action.replace(/_/g, ' ').toLowerCase().replace(/^./, c => c.toUpperCase()),
  })
}

function DayHeading({ day, timezone }: { day: string; timezone: string }) {
  const { t } = useTranslation('organization')
  // 🔴 `formatCalendarDate` y NO `formatDate`: `day` es una fecha CIVIL
  // ("2026-08-27"), y formatDate la lee como medianoche UTC — en México pinta
  // el 26. Es la trampa que ya costó un defecto en el reporte de asistencia.
  const { formatCalendarDate } = useVenueDateTime()

  // "Hoy" y "Ayer" también se calculan en la zona del negocio: a las 11 p.m. de
  // México, el navegador de alguien en Madrid ya está en el día siguiente.
  const fmt = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit' })
  const today = fmt.format(new Date())
  const yesterday = fmt.format(new Date(Date.now() - 86_400_000))

  const label = day === today ? t('activityLog.today') : day === yesterday ? t('activityLog.yesterday') : formatCalendarDate(day)

  return (
    <div className="sticky top-0 z-10 border-b border-input bg-muted/70 px-4 py-2 backdrop-blur-sm">
      <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</span>
    </div>
  )
}

function ActivityRow({ log }: { log: VenueActivityLogEntry }) {
  const { t } = useTranslation('organization')
  const { formatDateTime, formatTime } = useVenueDateTime()
  const [expanded, setExpanded] = useState(false)

  const tone = actionTone(log.action)
  const Icon = iconFor(log.action)
  const styles = TONE_STYLES[tone]
  const entityId = formatEntityId(log.entityId)
  const entityLabel = log.entity ? t(`activityLog.entities.${log.entity}`, { defaultValue: log.entity }) : null

  const who = log.staff ? `${log.staff.firstName} ${log.staff.lastName}`.trim() : null

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
    <li className="bg-card">
      <button
        type="button"
        onClick={() => hasDetails && setExpanded(v => !v)}
        aria-expanded={hasDetails ? expanded : undefined}
        disabled={!hasDetails}
        className={cn(
          'flex w-full items-center gap-3 px-4 py-3 text-left transition-colors',
          hasDetails ? 'cursor-pointer hover:bg-muted/50' : 'cursor-default',
        )}
      >
        <Icon className={cn('h-4 w-4 flex-shrink-0', styles.icon)} aria-hidden />

        {/* Qué pasó */}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{labelForAction(log.action, t)}</p>
          <p className="mt-0.5 truncate text-xs text-muted-foreground">
            {/* En móvil la columna «Quién» no cabe: el nombre viaja aquí para
                que la fila nunca se quede sin decir quién lo hizo. */}
            <span className="sm:hidden">
              {who ?? t('activityLog.system')}
              {(entityLabel || entityId) && ' · '}
            </span>
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
          </p>
        </div>

        {/* Quién */}
        <div className="hidden w-40 flex-shrink-0 sm:block">
          {who ? (
            <span className="block truncate text-sm text-foreground">{who}</span>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="cursor-help text-sm italic text-muted-foreground">{t('activityLog.system')}</span>
              </TooltipTrigger>
              <TooltipContent>
                <p className="text-xs">{t('activityLog.systemHint')}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {/* Cuándo */}
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="w-16 flex-shrink-0 cursor-help text-right text-xs tabular-nums text-muted-foreground">
              {formatTime(log.createdAt)}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="text-xs">{formatDateTime(log.createdAt)}</p>
          </TooltipContent>
        </Tooltip>

        {/* Afordancia de expandir — sólo cuando hay algo que abrir */}
        <ChevronDown
          className={cn(
            'h-4 w-4 flex-shrink-0 text-muted-foreground transition-transform',
            !hasDetails && 'invisible',
            expanded && 'rotate-180',
          )}
          aria-hidden
        />
      </button>

      {expanded && hasDetails && (
        <dl className="grid grid-cols-1 gap-x-6 gap-y-2 border-t border-border/60 bg-muted/40 px-4 py-3 sm:grid-cols-2">
          {detailRows.map(row => (
            <div key={row.key} className="flex gap-2 text-xs">
              <dt className="min-w-0 flex-shrink-0 font-medium text-muted-foreground">{row.label}</dt>
              <dd className="min-w-0 flex-1 break-all text-foreground">{row.value}</dd>
            </div>
          ))}
        </dl>
      )}
    </li>
  )
}

function EmptyState({ icon: Icon, title, action }: { icon: React.ElementType; title: string; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-input bg-card py-16 text-muted-foreground">
      <Icon className="mb-4 h-10 w-10 opacity-40" aria-hidden />
      <p className="text-sm font-medium">{title}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

function ActivitySkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-input">
      <div className="border-b border-input bg-muted/70 px-4 py-2">
        <Skeleton className="h-3 w-16" />
      </div>
      <div className="divide-y divide-border/60">
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex items-center gap-3 px-4 py-3">
            <Skeleton className="h-4 w-4 rounded" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-3.5 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="hidden h-3.5 w-32 sm:block" />
            <Skeleton className="h-3 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export default VenueActivityLog
