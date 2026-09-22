import { useCallback, useMemo, useState } from 'react'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Info, Search, Trash2, X } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FilterPill } from '@/components/filters/FilterPill'
import { DateFilterContent, type DateFilter } from '@/components/filters/DateFilterContent'
import { FeatureGate } from '@/components/billing/FeatureGate'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useVenueDateTime } from '@/utils/datetime'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Currency } from '@/utils/currency'
import { inventoryKeys } from '@/lib/queryKeys/inventory'
import { formatWasteQuantity, wasteReasonLabelKey } from '@/lib/inventoryWaste'
import { wasteReportsApi, type WasteReport } from '@/services/inventoryWaste.service'
import { wasteDateRange } from './wasteDateRange'

/** 50 llena la pantalla; el servidor recorta a 200. */
const PAGE_SIZE = 50

/**
 * Inventario → Mermas. Sólo lectura: cada declaración de merma (del dashboard, del POS o del
 * asistente) con lo declarado, lo que se descontó, lo que quedó «sin existencia» y su costo.
 * Incluye las declaraciones que no descontaron nada (todo «sin existencia»), que el Historial no
 * puede mostrar porque no tienen movimiento.
 */
export default function InventoryWastePage() {
  return (
    <FeatureGate feature="INVENTORY_TRACKING">
      <InventoryWasteList />
    </FeatureGate>
  )
}

function InventoryWasteList() {
  const { t, i18n } = useTranslation('inventory')
  const locale = getIntlLocale(i18n.language)
  const { venue, venueId } = useCurrentVenue()
  const { formatDateTime, venueTimezone } = useVenueDateTime()
  const { formatUnitWithQuantity } = useUnitTranslation()

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)
  const range = useMemo(() => wasteDateRange(dateFilter, venueTimezone), [dateFilter, venueTimezone])

  // Paginación, búsqueda y fechas en el SERVIDOR: nunca se descarga toda la historia.
  const query = useInfiniteQuery({
    queryKey: [...inventoryKeys.wasteReports(venueId ?? ''), debouncedSearch, range.startDate ?? null, range.endDate ?? null],
    queryFn: ({ pageParam, signal }) =>
      wasteReportsApi.list(venueId!, { page: pageParam, pageSize: PAGE_SIZE, search: debouncedSearch || undefined, ...range }, signal),
    initialPageParam: 1,
    getNextPageParam: last => (last.page * last.pageSize < last.total ? last.page + 1 : undefined),
    enabled: !!venueId,
  })
  const reports = useMemo<WasteReport[]>(() => query.data?.pages.flatMap(p => p.items) ?? [], [query.data])
  const total = query.data?.pages[0]?.total ?? 0

  // Paginación manual: la página la manda el servidor; DataTable NO debe volver a rebanar las filas
  // (mismo motivo que en StockCountsPage: sin esto, de la 21 en adelante no habría forma de verlas).
  const [tablePagination, setTablePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })

  const staffName = (r: WasteReport) => (r.reportedByStaff ? `${r.reportedByStaff.firstName} ${r.reportedByStaff.lastName}`.trim() : '')

  const columns = useMemo<ColumnDef<WasteReport>[]>(
    () => [
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('wasteReports.columns.date'),
        cell: ({ row }) => <div className="text-sm">{formatDateTime(row.original.createdAt)}</div>,
      },
      {
        id: 'item',
        accessorFn: r => r.rawMaterial?.name ?? r.product?.name ?? '',
        header: t('wasteReports.columns.item'),
        cell: ({ row }) => {
          const item = row.original.rawMaterial ?? row.original.product
          return (
            <div>
              <p className="font-medium text-foreground">{item?.name ?? t('wasteReports.unknownItem')}</p>
              {item?.sku && <p className="text-xs text-muted-foreground">{item.sku}</p>}
            </div>
          )
        },
      },
      {
        id: 'reason',
        accessorKey: 'reasonCode',
        header: t('wasteReports.columns.reason'),
        cell: ({ row }) => {
          const key = wasteReasonLabelKey(row.original.reasonCode)
          return (
            <div className="max-w-[240px]">
              <p className="text-sm">{key ? t(key) : row.original.reasonCode || '—'}</p>
              {row.original.note && <p className="text-xs text-muted-foreground line-clamp-2">{row.original.note}</p>}
            </div>
          )
        },
      },
      {
        id: 'quantity',
        accessorKey: 'declaredQuantity',
        header: t('wasteReports.columns.quantity'),
        cell: ({ row }) => {
          const r = row.original
          const unit = r.unit ?? ''
          const unrecorded = Number(r.unrecordedQuantity)
          return (
            <div className="space-y-1">
              <p className="text-sm">
                {formatWasteQuantity(r.declaredQuantity, locale)} {formatUnitWithQuantity(Number(r.declaredQuantity), unit)}
              </p>
              {Number.isFinite(unrecorded) && unrecorded > 0 && (
                <>
                  <p className="text-xs text-muted-foreground">
                    {t('wasteReports.deducted', { quantity: formatWasteQuantity(r.deductedQuantity, locale) })}
                  </p>
                  <Badge variant="outline" className="font-normal">
                    {t('wasteReports.unrecorded', { quantity: formatWasteQuantity(r.unrecordedQuantity, locale) })}
                  </Badge>
                </>
              )}
            </div>
          )
        },
      },
      {
        id: 'cost',
        accessorKey: 'costImpact',
        header: t('wasteReports.columns.cost'),
        cell: ({ row }) => {
          const r = row.original
          if (r.costState === 'NONE') return <span className="text-sm text-muted-foreground">{t('wasteReports.cost.none')}</span>
          const amount = r.costImpact === null ? Number.NaN : Number(r.costImpact)
          // Un costo desconocido NO es cero (spec §4.6): se dice, no se inventa.
          if (!Number.isFinite(amount)) return <span className="text-sm text-muted-foreground">{t('wasteReports.cost.unvalued')}</span>
          return (
            <div>
              <p className="text-sm font-medium">{Currency(amount)}</p>
              {r.costState === 'PARTIAL' && <p className="text-xs text-muted-foreground">{t('wasteReports.cost.partial')}</p>}
            </div>
          )
        },
      },
      {
        id: 'reportedBy',
        accessorFn: staffName,
        header: t('wasteReports.columns.reportedBy'),
        cell: ({ row }) => <div className="text-sm text-muted-foreground">{staffName(row.original) || '—'}</div>,
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: t('wasteReports.columns.source'),
        cell: ({ row }) => (
          <Badge variant="secondary" className="font-normal">
            {t(`wasteReports.sources.${row.original.source}`)}
          </Badge>
        ),
      },
    ],
    [t, locale, formatDateTime, formatUnitWithQuantity],
  )

  const dateLabel = useCallback(
    (filter: DateFilter | null) => {
      if (!filter) return null
      switch (filter.operator) {
        case 'last':
          return t('wasteReports.dateLabels.last', { value: filter.value, unit: t(`wasteReports.dateLabels.units.${filter.unit ?? 'days'}`) })
        case 'before':
          return t('wasteReports.dateLabels.before', { date: filter.value })
        case 'after':
          return t('wasteReports.dateLabels.after', { date: filter.value })
        case 'between':
          return t('wasteReports.dateLabels.between', { from: filter.value, to: filter.value2 })
        case 'on':
          return t('wasteReports.dateLabels.on', { date: filter.value })
        default:
          return null
      }
    },
    [t],
  )

  const hasFilters = !!debouncedSearch || dateFilter !== null
  const clearAll = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setDateFilter(null)
  }

  if (!venue) return null

  // Un fallo NO es «aún no hay mermas»: se dice y se ofrece reintentar. Si ya hay filas y falla una
  // página siguiente, la tabla se queda y «Cargar más» es el reintento.
  const loadFailed = query.isError && reports.length === 0
  const isEmpty = !query.isLoading && !loadFailed && reports.length === 0

  return (
    <div className="p-6 space-y-3">
      <div>
        <h1 className="text-2xl font-bold">{t('wasteReports.title')}</h1>
        <p className="text-muted-foreground">{t('wasteReports.subtitle')}</p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>{t('wasteReports.info')}</AlertDescription>
      </Alert>

      {!loadFailed && (!isEmpty || hasFilters) && (
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('wasteReports.searchPlaceholder')}
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                    }}
                    className="h-8 w-[240px] pl-8 pr-8 text-sm rounded-full"
                    data-tour="waste-reports-search"
                    autoFocus
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  aria-label={t('wasteReports.clearFilters')}
                  onClick={() => {
                    setSearchTerm('')
                    setIsSearchOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchTerm ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-full"
                aria-label={t('wasteReports.searchPlaceholder')}
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>

          <FilterPill
            label={t('wasteReports.dateFilter')}
            activeValue={dateLabel(dateFilter)}
            isActive={dateFilter !== null}
            onClear={() => setDateFilter(null)}
          >
            <DateFilterContent title={t('wasteReports.dateFilterTitle')} currentFilter={dateFilter} onApply={setDateFilter} />
          </FilterPill>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              {t('wasteReports.clearFilters')}
            </Button>
          )}
        </div>
      )}

      {loadFailed ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-muted/30 py-16 px-6 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-destructive">{t('wasteReports.loadError')}</h3>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void query.refetch()}>
            {t('wasteReports.retry')}
          </Button>
        </div>
      ) : isEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Trash2 className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">{hasFilters ? t('wasteReports.noResults') : t('wasteReports.emptyTitle')}</h3>
          {!hasFilters && <p className="mt-2 max-w-md text-sm text-muted-foreground">{t('wasteReports.emptyBody')}</p>}
        </div>
      ) : (
        <DataTable<WasteReport>
          columns={columns}
          data={reports}
          rowCount={reports.length}
          isLoading={query.isLoading}
          pagination={tablePagination}
          setPagination={setTablePagination}
          hidePagination
          footer={
            <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
              <span>{t('wasteReports.showing', { shown: reports.length, total })}</span>
              {query.hasNextPage && (
                <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {t('wasteReports.loadMore')}
                </Button>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}
