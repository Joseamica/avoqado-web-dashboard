import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Download, FileText, MoreHorizontal, Search, X, XCircle } from 'lucide-react'

import DataTable from '@/components/data-table'
import { CheckboxFilterContent, FilterPill, FilterPillBar } from '@/components/filters'
import { DateRangePicker } from '@/components/date-range-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useAccess } from '@/hooks/use-access'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useVenueDateTime } from '@/utils/datetime'
import { Currency } from '@/utils/currency'
import { useCfdis } from '@/hooks/use-cfdi'
import { FeatureTeaser } from '@/components/FeatureTeaser'
import type { Cfdi, CfdiFlow } from '@/services/cfdi.service'
import { CancelCfdiDialog } from './components/CancelCfdiDialog'

const FLOW_OPTIONS: CfdiFlow[] = ['STAFF_B', 'AUTOFACTURA_A', 'GLOBAL_C']
const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'STAMPED', 'CANCELLED', 'ERROR']

/**
 * Placeholder rows shown BEHIND the teaser blur when the venue lacks the CFDI
 * feature. Realistic-looking fake data so the paywall reads like a real screen.
 * Never hits the API — purely visual.
 */
const SAMPLE_CFDIS: Cfdi[] = [
  {
    id: 'sample-1', type: 'I', status: 'STAMPED', flow: 'STAFF_B', isGlobal: false, orderId: null,
    receptorRfc: 'XAXX010101000', receptorNombre: 'Cliente Mostrador', serie: 'A', folio: '1042', uuid: null,
    subtotalCents: 45000, taxCents: 7200, totalCents: 52200, stampedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), cancelStatus: null, xmlUrl: null, pdfUrl: null, globalPeriod: null,
  },
  {
    id: 'sample-2', type: 'I', status: 'STAMPED', flow: 'AUTOFACTURA_A', isGlobal: false, orderId: null,
    receptorRfc: 'GODE561231GR8', receptorNombre: 'Distribuidora del Norte SA de CV', serie: 'A', folio: '1041', uuid: null,
    subtotalCents: 128000, taxCents: 20480, totalCents: 148480, stampedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), cancelStatus: null, xmlUrl: null, pdfUrl: null, globalPeriod: null,
  },
  {
    id: 'sample-3', type: 'I', status: 'STAMPED', flow: 'GLOBAL_C', isGlobal: true, orderId: null,
    receptorRfc: 'XAXX010101000', receptorNombre: 'Público en General', serie: 'G', folio: '0087', uuid: null,
    subtotalCents: 310000, taxCents: 49600, totalCents: 359600, stampedAt: new Date().toISOString(),
    createdAt: new Date().toISOString(), cancelStatus: null, xmlUrl: null, pdfUrl: null, globalPeriod: null,
  },
  {
    id: 'sample-4', type: 'I', status: 'PENDING', flow: 'STAFF_B', isGlobal: false, orderId: null,
    receptorRfc: 'MABO751210I27', receptorNombre: 'María Bonilla', serie: 'A', folio: '1040', uuid: null,
    subtotalCents: 86000, taxCents: 13760, totalCents: 99760, stampedAt: null,
    createdAt: new Date().toISOString(), cancelStatus: null, xmlUrl: null, pdfUrl: null, globalPeriod: null,
  },
]

function statusBadgeVariant(status: string): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'STAMPED':
      return 'default'
    case 'CANCELLED':
    case 'ERROR':
      return 'destructive'
    case 'PENDING':
      return 'secondary'
    default:
      return 'outline'
  }
}

export default function CfdiList() {
  const { t } = useTranslation('cfdi')
  const { can } = useAccess()
  const { checkFeatureAccess } = useAuth()
  const { formatDate } = useVenueDateTime()
  const { venue } = useCurrentVenue()
  const tz = venue?.timezone ?? 'America/Mexico_City'

  // Format a venue-local JS Date (start/end of day from the DateRangePicker) as
  // the VENUE-timezone calendar day. Using `toISOString()` would format in UTC,
  // which for a Mexico evening rolls `to` forward to the next calendar day.
  const toIsoDay = (date: Date | undefined): string | undefined =>
    date ? DateTime.fromJSDate(date).setZone(tz).toISODate() ?? undefined : undefined

  // CFDI is a paid feature shown as a VISIBLE teaser. When the venue hasn't
  // subscribed we keep the page discoverable but render sample rows behind a
  // blurred upsell overlay and NEVER call the (feature-gated) backend.
  const hasCfdi = checkFeatureAccess('CFDI')

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [flowFilter, setFlowFilter] = useState<string[]>([])
  const [receptorRfc, setReceptorRfc] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedReceptorRfc = useDebounce(receptorRfc, 300)
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  const canConfigure = can('cfdi:configure')

  const [cancelTarget, setCancelTarget] = useState<Cfdi | null>(null)

  const filters = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(statusFilter.length === 1 && { status: statusFilter[0] }),
      ...(flowFilter.length === 1 && { flow: flowFilter[0] as CfdiFlow }),
      ...(debouncedReceptorRfc.trim() && { receptorRfc: debouncedReceptorRfc.trim() }),
      ...(toIsoDay(dateRange.from) && { from: toIsoDay(dateRange.from) }),
      ...(toIsoDay(dateRange.to) && { to: toIsoDay(dateRange.to) }),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [pagination, statusFilter, flowFilter, debouncedReceptorRfc, dateRange, tz],
  )

  // Filters narrow the result set; if we're on a later page when they change, the
  // narrowed set may not have that page → reset to the first page.
  useEffect(() => {
    setPagination(p => (p.pageIndex === 0 ? p : { ...p, pageIndex: 0 }))
  }, [statusFilter, flowFilter, debouncedReceptorRfc, dateRange])

  const { data, isLoading, isError } = useCfdis(filters, { enabled: hasCfdi })
  // When locked, feed the table sample rows so the teaser looks real behind the blur.
  const cfdis = hasCfdi ? data?.cfdis ?? [] : SAMPLE_CFDIS
  const total = hasCfdi ? data?.total ?? 0 : SAMPLE_CFDIS.length

  const resetFilters = () => {
    setStatusFilter([])
    setFlowFilter([])
    setReceptorRfc('')
    setDateRange({})
  }

  const columns = useMemo<ColumnDef<Cfdi, any>[]>(
    () => [
      {
        id: 'folio',
        header: t('columns.folio'),
        cell: ({ row }) => (
          <span className="font-medium">
            {[row.original.serie, row.original.folio].filter(Boolean).join('-') || '—'}
          </span>
        ),
      },
      {
        id: 'receptor',
        header: t('columns.receptor'),
        cell: ({ row }) => (
          <div className="flex flex-col">
            <span className="font-medium">{row.original.receptorNombre || '—'}</span>
            <span className="text-xs text-muted-foreground">{row.original.receptorRfc || '—'}</span>
          </div>
        ),
      },
      {
        id: 'total',
        header: t('columns.total'),
        cell: ({ row }) => <span className="tabular-nums">{Currency(row.original.totalCents, true)}</span>,
      },
      {
        id: 'flow',
        header: t('columns.flow'),
        cell: ({ row }) => (
          <Badge variant="outline">{t(`flow.${row.original.flow}`, { defaultValue: row.original.flow })}</Badge>
        ),
      },
      {
        id: 'status',
        header: t('columns.status'),
        cell: ({ row }) => (
          <Badge variant={statusBadgeVariant(row.original.status)}>{row.original.status}</Badge>
        ),
      },
      {
        id: 'date',
        header: t('columns.date'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">{formatDate(row.original.stampedAt ?? row.original.createdAt)}</span>
        ),
      },
      {
        id: 'actions',
        header: '',
        cell: ({ row }) => {
          const cfdi = row.original
          const canCancel = canConfigure && cfdi.status === 'STAMPED' && !cfdi.cancelStatus
          return (
            <div className="flex justify-end">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer">
                    <MoreHorizontal className="h-4 w-4" />
                    <span className="sr-only">{t('columns.actions')}</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!cfdi.xmlUrl}
                    onClick={() => cfdi.xmlUrl && window.open(cfdi.xmlUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    {t('actions.downloadXml')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!cfdi.pdfUrl}
                    onClick={() => cfdi.pdfUrl && window.open(cfdi.pdfUrl, '_blank', 'noopener,noreferrer')}
                  >
                    <FileText className="mr-2 h-4 w-4" />
                    {t('actions.downloadPdf')}
                  </DropdownMenuItem>
                  {canCancel && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => setCancelTarget(cfdi)}
                      >
                        <XCircle className="mr-2 h-4 w-4" />
                        {t('actions.cancel')}
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        },
      },
    ],
    [t, formatDate, canConfigure],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">{t('list.title')}</h1>
        <p className="text-muted-foreground mt-1">{t('list.description')}</p>
      </div>

      {hasCfdi && isError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('list.loadError')}
        </div>
      )}

      <FeatureTeaser active={hasCfdi} featureName={t('list.title')}>
        <DataTable
          data={cfdis}
          rowCount={total}
          columns={columns}
          isLoading={hasCfdi && isLoading}
          tableId="cfdi:main"
          pagination={pagination}
          setPagination={setPagination}
          toolbarLeft={
            <div className="flex flex-wrap items-center gap-2">
              {/* Expandable search (lupa) — mirrors Payments/Orders (ui-patterns.md) */}
              <div className="relative flex items-center">
                {isSearchOpen ? (
                  <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                    <div className="relative">
                      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={receptorRfc}
                        onChange={e => setReceptorRfc(e.target.value.toUpperCase())}
                        onKeyDown={e => {
                          if (e.key === 'Escape' && !receptorRfc) setIsSearchOpen(false)
                        }}
                        placeholder={t('filters.receptorRfcPlaceholder')}
                        aria-label={t('filters.receptorRfc')}
                        className="h-7 w-[180px] rounded-full pl-8 pr-7 text-xs"
                        autoFocus
                      />
                      {receptorRfc && (
                        <button
                          type="button"
                          onClick={() => setReceptorRfc('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 rounded-full"
                      onClick={() => {
                        setReceptorRfc('')
                        setIsSearchOpen(false)
                      }}
                    >
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant={receptorRfc ? 'secondary' : 'ghost'}
                    size="icon"
                    className="h-7 w-7 rounded-full"
                    onClick={() => setIsSearchOpen(true)}
                    aria-label={t('filters.receptorRfc')}
                  >
                    <Search className="h-3.5 w-3.5" />
                  </Button>
                )}
                {receptorRfc && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
              </div>

              <DateRangePicker
                showCompare={false}
                align="start"
                onUpdate={({ range }) => setDateRange({ from: range.from, to: range.to ?? range.from })}
              />

              <FilterPillBar onReset={resetFilters} resetLabel={t('filters.reset')}>
                <FilterPill
                  label={t('filters.status')}
                  activeCount={statusFilter.length}
                  isActive={statusFilter.length > 0}
                  onClear={() => setStatusFilter([])}
                >
                  <CheckboxFilterContent
                    title={t('filters.filterBy', { field: t('filters.status') })}
                    options={STATUS_OPTIONS.map(s => ({ value: s, label: s }))}
                    selectedValues={statusFilter}
                    // Backend supports a SINGLE status; enforce single-select so the
                    // UI can't express an unsupported (and silently-dropped) 2+ state.
                    onApply={vals => setStatusFilter(vals.slice(-1))}
                  />
                </FilterPill>

                <FilterPill
                  label={t('filters.flow')}
                  activeCount={flowFilter.length}
                  isActive={flowFilter.length > 0}
                  onClear={() => setFlowFilter([])}
                >
                  <CheckboxFilterContent
                    title={t('filters.filterBy', { field: t('filters.flow') })}
                    options={FLOW_OPTIONS.map(f => ({ value: f, label: t(`flow.${f}`, { defaultValue: f }) }))}
                    selectedValues={flowFilter}
                    // Backend supports a SINGLE flow; enforce single-select (see status above).
                    onApply={vals => setFlowFilter(vals.slice(-1))}
                  />
                </FilterPill>
              </FilterPillBar>
            </div>
          }
        />
      </FeatureTeaser>

      {hasCfdi && <CancelCfdiDialog cfdi={cancelTarget} onOpenChange={open => !open && setCancelTarget(null)} />}
    </div>
  )
}
