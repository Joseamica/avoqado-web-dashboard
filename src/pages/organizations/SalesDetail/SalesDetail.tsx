/**
 * Org-level "Ventas — Detalle" view (PlayTelecom / Walmart).
 *
 * Back-office surface to approve or reject SIM-sale documentation across
 * ALL venues in the organization in a single screen. Each row is one sale
 * verification; clicking a row opens approve/reject dialogs that hit the
 * org-scoped backend endpoint. The TPV gets a socket event on success.
 *
 * Patterns followed (mandatory per .claude/rules/ui-patterns.md):
 *   - FilterPill for filters
 *   - Expandable search bar (300ms debounce)
 *   - DataTable with memoized columns
 *   - Receipt photo zoom via Dialog (image preview)
 */

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Search, ImageIcon, CheckCircle2, XCircle, ChevronLeft, ChevronRight, Download, Loader2, FileSpreadsheet, FileText } from 'lucide-react'
import { DateTime } from 'luxon'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useDebounce } from '@/hooks/useDebounce'
import { useIsMobile } from '@/hooks/use-mobile'
import { useToast } from '@/hooks/use-toast'
import { useAuth } from '@/context/AuthContext'
import { useVenueDateTime, getLast30Days } from '@/utils/datetime'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { DateRangePicker } from '@/components/date-range-picker'
import { GlassCard } from '@/components/ui/glass-card'
import { cn } from '@/lib/utils'
import { exportToExcel, exportToCSV, generateFilename } from '@/utils/export'
import { ReviewSaleDialog, type ReviewMode } from '@/pages/playtelecom/Sales/components/ReviewSaleDialog'
import {
  listOrgSaleVerifications,
  getOrgSalesSummary,
  SALE_TYPE_LABELS,
  PAYMENT_FORM_LABELS,
  type ListOrgSalesParams,
  type OrgSaleRow,
  type PaymentForm,
  type PaymentMethod,
  type SaleType,
} from '@/services/saleVerification.org.service'
import { SALE_VERIFICATION_REJECTION_REASON_LABELS, type SaleVerificationStatus } from '@/services/saleVerification.service'

const PAGE_SIZE = 25
const EXPORT_PAGE_SIZE = 200 // backend cap
const MAX_EXPORT_ROWS = 10_000
const EXPORT_TZ = 'America/Mexico_City'

const STATUS_OPTIONS: { value: SaleVerificationStatus; label: string }[] = [
  { value: 'PENDING', label: 'Pendiente' },
  { value: 'COMPLETED', label: 'Venta correcta' },
  { value: 'FAILED', label: 'Revisar' },
]

const SALE_TYPE_OPTIONS: { value: SaleType; label: string }[] = [
  { value: 'LINEA_NUEVA', label: SALE_TYPE_LABELS.LINEA_NUEVA },
  { value: 'PORTABILIDAD', label: SALE_TYPE_LABELS.PORTABILIDAD },
  { value: 'NO_APLICA', label: SALE_TYPE_LABELS.NO_APLICA },
]

const PAYMENT_FORM_OPTIONS: { value: PaymentForm; label: string }[] = [
  { value: 'CASH', label: PAYMENT_FORM_LABELS.CASH },
  { value: 'CARD', label: PAYMENT_FORM_LABELS.CARD },
  { value: 'OTHER', label: PAYMENT_FORM_LABELS.OTHER },
  { value: 'NONE', label: PAYMENT_FORM_LABELS.NONE },
]

function statusBadge(status: SaleVerificationStatus) {
  if (status === 'COMPLETED')
    return (
      <Badge className="bg-green-100 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-700">
        Venta correcta
      </Badge>
    )
  if (status === 'FAILED')
    return (
      <Badge className="bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700">
        Revisar
      </Badge>
    )
  return <Badge className="bg-muted text-muted-foreground border-input">Pendiente</Badge>
}

/**
 * Display label for the "Tipo de venta" column. A sale with a $0 payment is a
 * giveaway, so it shows "Gratis" regardless of the underlying saleType enum.
 */
function saleTypeLabel(row: OrgSaleRow): string {
  if (row.payment != null && Number(row.payment.amount) === 0) return 'Gratis'
  return SALE_TYPE_LABELS[row.saleType]
}

export default function SalesDetail() {
  const { orgId, orgSlug, isLoading: orgLoading, organization } = useCurrentOrganization()
  const { formatDate, formatTime } = useVenueDateTime()
  const { activeVenue } = useAuth()
  const { toast } = useToast()
  const isMobile = useIsMobile()

  const venueTz = activeVenue?.timezone || EXPORT_TZ
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() => {
    const r = getLast30Days(venueTz)
    return { from: r.from, to: r.to }
  })
  const fromDateStr = useMemo(() => DateTime.fromJSDate(dateRange.from).setZone(venueTz).toFormat('yyyy-LL-dd'), [dateRange.from, venueTz])
  const toDateStr = useMemo(() => DateTime.fromJSDate(dateRange.to).setZone(venueTz).toFormat('yyyy-LL-dd'), [dateRange.to, venueTz])

  // Export state
  const [exporting, setExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState<{ fetched: number; total: number } | null>(null)

  // Filters
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [saleTypeFilter, setSaleTypeFilter] = useState<string[]>([])
  const [paymentFormFilter, setPaymentFormFilter] = useState<string[]>([])
  const [venueFilter, setVenueFilter] = useState<string[]>([])

  // Search + pagination
  const [search, setSearch] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearch = useDebounce(search, 300)
  const [pageNumber, setPageNumber] = useState(1)

  // Review dialog state
  const [reviewVerification, setReviewVerification] = useState<OrgSaleRow | null>(null)
  const [reviewMode, setReviewMode] = useState<ReviewMode>('approve')
  const [reviewOpen, setReviewOpen] = useState(false)

  // Photo preview state
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  const listParams = useMemo<ListOrgSalesParams>(
    () => ({
      pageSize: PAGE_SIZE,
      pageNumber,
      status: statusFilter.length === 1 ? (statusFilter[0] as SaleVerificationStatus) : undefined,
      // Note: the backend supports a single value for these — when the user selects multiple
      // we let the frontend display them all and skip server filter (broad fetch). For PlayTelecom's
      // 38 venues with paginated results this is acceptable; can be tightened later.
      venueId: venueFilter.length === 1 ? venueFilter[0] : undefined,
      isPortabilidad:
        saleTypeFilter.length === 1 && saleTypeFilter[0] === 'PORTABILIDAD'
          ? true
          : saleTypeFilter.length === 1 && saleTypeFilter[0] === 'LINEA_NUEVA'
            ? false
            : undefined,
      paymentMethod: paymentFormFilter.length === 1 && paymentFormFilter[0] === 'CASH' ? ('CASH' as PaymentMethod) : undefined,
      search: debouncedSearch.trim() || undefined,
      fromDate: fromDateStr,
      toDate: toDateStr,
    }),
    [pageNumber, statusFilter, venueFilter, saleTypeFilter, paymentFormFilter, debouncedSearch, fromDateStr, toDateStr],
  )

  const listQuery = useQuery({
    queryKey: ['org', orgId, 'sale-verifications', listParams],
    queryFn: () => listOrgSaleVerifications(orgId!, listParams),
    enabled: !!orgId,
    staleTime: 30_000,
  })

  const summaryQuery = useQuery({
    queryKey: ['org', orgId, 'sales-summary', fromDateStr, toDateStr],
    queryFn: () => getOrgSalesSummary(orgId!, { fromDate: fromDateStr, toDate: toDateStr }),
    enabled: !!orgId,
    staleTime: 60_000,
  })

  // Client-side filter pass — handles multi-select cases the backend serves broadly
  const rows = useMemo(() => {
    const data = listQuery.data?.data ?? []
    return data.filter(r => {
      if (statusFilter.length > 1 && !statusFilter.includes(r.status)) return false
      if (saleTypeFilter.length > 1 && !saleTypeFilter.includes(r.saleType)) return false
      if (paymentFormFilter.length > 1 && !paymentFormFilter.includes(r.payment?.paymentForm ?? 'NONE')) return false
      if (venueFilter.length > 1 && !venueFilter.includes(r.venue.id)) return false
      return true
    })
  }, [listQuery.data?.data, statusFilter, saleTypeFilter, paymentFormFilter, venueFilter])

  const pagination = listQuery.data?.pagination
  const totalPages = pagination?.totalPages ?? 1
  const totalCount = pagination?.totalCount ?? 0

  // Build venue options dynamically from results so we don't need a separate endpoint.
  const venueOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const r of listQuery.data?.data ?? []) {
      if (!seen.has(r.venue.id)) seen.set(r.venue.id, r.venue.name)
    }
    return Array.from(seen.entries()).map(([id, name]) => ({ value: id, label: name }))
  }, [listQuery.data?.data])

  const openReview = (row: OrgSaleRow, mode: ReviewMode) => {
    setReviewVerification(row)
    setReviewMode(mode)
    setReviewOpen(true)
  }

  // ============================================================
  // Export handler — chunked fetch, capped at MAX_EXPORT_ROWS
  // ============================================================
  // Loops pageSize=200 (backend cap) until totalPages reached.
  // Sequential to keep DB pool pressure predictable, with progress
  // toast and a hard cap so the browser never balloons memory on
  // a runaway query.
  const handleExport = async (format: 'xlsx' | 'csv') => {
    if (!orgId || exporting) return
    setExporting(true)
    setExportProgress({ fetched: 0, total: 0 })

    try {
      const baseParams: ListOrgSalesParams = {
        ...listParams,
        pageNumber: 1,
        pageSize: EXPORT_PAGE_SIZE,
      }

      const accumulated: OrgSaleRow[] = []
      let pageNumber = 1
      let totalPages = 1
      let totalCount = 0

      // First request seeds totalPages / totalCount
      while (pageNumber <= totalPages) {
        const resp = await listOrgSaleVerifications(orgId, { ...baseParams, pageNumber })
        accumulated.push(...resp.data)
        totalPages = resp.pagination.totalPages
        totalCount = resp.pagination.totalCount
        setExportProgress({ fetched: accumulated.length, total: totalCount })

        if (accumulated.length >= MAX_EXPORT_ROWS) {
          toast({
            title: 'Demasiados registros',
            description: `Hay ${totalCount.toLocaleString('es-MX')} ventas que cumplen los filtros (máx ${MAX_EXPORT_ROWS.toLocaleString('es-MX')}). Acorta el rango de fechas y vuelve a exportar.`,
            variant: 'destructive',
          })
          return
        }
        pageNumber++
      }

      if (accumulated.length === 0) {
        toast({
          title: 'Sin datos para exportar',
          description: 'No hay ventas en el rango y filtros seleccionados.',
          variant: 'destructive',
        })
        return
      }

      const rows = accumulated.map((r, idx) => ({
        '#': idx + 1,
        'ID Venta': r.id,
        'ID SIM': r.serialNumbers[0] ?? '',
        'SIMs Adicionales': r.serialNumbers.slice(1).join(', '),
        'Tipo SIM': r.category?.name ?? '',
        Fecha: DateTime.fromISO(r.createdAt, { zone: 'utc' }).setZone(venueTz).toFormat('yyyy-LL-dd'),
        Hora: DateTime.fromISO(r.createdAt, { zone: 'utc' }).setZone(venueTz).toFormat('HH:mm:ss'),
        Promotor: r.staff ? `${r.staff.firstName} ${r.staff.lastName}`.trim() : '',
        'Email Promotor': r.staff?.email ?? '',
        Ciudad: r.venue.city ?? '',
        Tienda: r.venue.name,
        'Tipo de Venta': saleTypeLabel(r),
        'Forma de Pago': PAYMENT_FORM_LABELS[r.payment?.paymentForm ?? 'NONE'],
        'Monto MXN': r.payment?.amount ?? 0,
        Status:
          r.status === 'COMPLETED'
            ? 'Venta correcta'
            : r.status === 'FAILED'
              ? 'Revisar'
              : r.status === 'PENDING'
                ? 'Pendiente'
                : r.status,
        'Razones de Rechazo': r.rejectionReasons.map(rr => SALE_VERIFICATION_REJECTION_REASON_LABELS[rr] ?? rr).join('; '),
        'Notas de Revisión': r.reviewNotes ?? '',
        'Revisado Por': r.reviewedBy ? `${r.reviewedBy.firstName} ${r.reviewedBy.lastName}`.trim() : '',
        'Fecha Revisión': r.reviewedAt ? DateTime.fromISO(r.reviewedAt, { zone: 'utc' }).setZone(venueTz).toFormat('yyyy-LL-dd HH:mm:ss') : '',
        'Evidencias (count)': r.photos.length,
      }))

      const filename = generateFilename(`ventas-${orgSlug ?? orgId}`, `${fromDateStr}-a-${toDateStr}`)

      if (format === 'xlsx') {
        await exportToExcel(rows, filename, 'Ventas')
      } else {
        exportToCSV(rows, filename)
      }

      toast({
        title: format === 'xlsx' ? 'Excel descargado' : 'CSV descargado',
        description: `${rows.length.toLocaleString('es-MX')} ventas · ${filename}.${format}`,
      })
    } catch (err: any) {
      console.error('Export error:', err)
      toast({
        title: 'Error al exportar',
        description: err?.message || 'Intenta de nuevo en unos momentos.',
        variant: 'destructive',
      })
    } finally {
      setExporting(false)
      setExportProgress(null)
    }
  }

  if (orgLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  if (!orgId) {
    return (
      <div className="p-6">
        <p className="text-muted-foreground">No se pudo determinar la organización.</p>
      </div>
    )
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight">Ventas — Detalle</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">
            {organization?.name ?? 'Organización'} · Aprobar o rechazar documentación
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total ventas" value={summaryQuery.data?.totalCount ?? 0} loading={summaryQuery.isLoading} />
        <SummaryCard label="Aprobadas" value={summaryQuery.data?.completedCount ?? 0} loading={summaryQuery.isLoading} tone="success" />
        <SummaryCard label="Pendientes" value={summaryQuery.data?.pendingCount ?? 0} loading={summaryQuery.isLoading} tone="warning" />
        <SummaryCard label="Por revisar" value={summaryQuery.data?.failedCount ?? 0} loading={summaryQuery.isLoading} tone="danger" />
      </div>

      {/* Date range + export */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <DateRangePicker
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          showCompare={false}
          align="start"
          onUpdate={({ range }) => {
            if (!range.to) return
            setDateRange({ from: range.from, to: range.to })
            setPageNumber(1)
          }}
        />
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={exporting || listQuery.isLoading} className="gap-2">
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {exporting && exportProgress
                ? `${exportProgress.fetched.toLocaleString('es-MX')}${exportProgress.total ? ` / ${exportProgress.total.toLocaleString('es-MX')}` : ''}`
                : 'Exportar'}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport('xlsx')} disabled={exporting}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport('csv')} disabled={exporting}>
              <FileText className="h-4 w-4 mr-2" />
              CSV (.csv)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters + search bar */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0 sm:overflow-visible sm:flex-wrap pb-1 sm:pb-0">
          <FilterPill label="Status" activeCount={statusFilter.length} onClear={() => setStatusFilter([])}>
            <CheckboxFilterContent
              title="Status de venta"
              options={STATUS_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              selectedValues={statusFilter}
              onApply={values => {
                setStatusFilter(values)
                setPageNumber(1)
              }}
            />
          </FilterPill>
          <FilterPill label="Tipo de venta" activeCount={saleTypeFilter.length} onClear={() => setSaleTypeFilter([])}>
            <CheckboxFilterContent
              title="Tipo de venta"
              options={SALE_TYPE_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              selectedValues={saleTypeFilter}
              onApply={values => {
                setSaleTypeFilter(values)
                setPageNumber(1)
              }}
            />
          </FilterPill>
          <FilterPill label="Forma de pago" activeCount={paymentFormFilter.length} onClear={() => setPaymentFormFilter([])}>
            <CheckboxFilterContent
              title="Forma de pago"
              options={PAYMENT_FORM_OPTIONS.map(o => ({ value: o.value, label: o.label }))}
              selectedValues={paymentFormFilter}
              onApply={values => {
                setPaymentFormFilter(values)
                setPageNumber(1)
              }}
            />
          </FilterPill>
          {venueOptions.length > 1 && (
            <FilterPill label="Tienda" activeCount={venueFilter.length} onClear={() => setVenueFilter([])}>
              <CheckboxFilterContent
                title="Tienda"
                options={venueOptions}
                selectedValues={venueFilter}
                onApply={values => {
                  setVenueFilter(values)
                  setPageNumber(1)
                }}
                searchable
              />
            </FilterPill>
          )}
        </div>

        {/* Search */}
        <div className="ml-auto w-full sm:w-auto">
          {isSearchOpen ? (
            <div className="animate-in fade-in slide-in-from-left-2 duration-200 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                onBlur={() => !search && setIsSearchOpen(false)}
                autoFocus
                placeholder="ID SIM, promotor…"
                className="pl-9 rounded-full w-full sm:w-64"
              />
            </div>
          ) : (
            <Button size="icon" variant="outline" className="rounded-full relative" onClick={() => setIsSearchOpen(true)}>
              <Search className="h-4 w-4" />
              {debouncedSearch && <span className="absolute top-1 right-1 size-2 rounded-full bg-primary" />}
            </Button>
          )}
        </div>
      </div>

      {/* Mobile card list */}
      {isMobile && (
        <div className="space-y-3">
          {listQuery.isLoading ? (
            Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 w-full" />)
          ) : rows.length === 0 ? (
            <GlassCard className="p-8 text-center text-sm text-muted-foreground">No hay ventas que coincidan con los filtros.</GlassCard>
          ) : (
            rows.map(row => (
              <SaleCard
                key={row.id}
                row={row}
                formatDate={formatDate}
                formatTime={formatTime}
                onPhotoClick={url => setPhotoPreview(url)}
                onReview={mode => openReview(row, mode)}
              />
            ))
          )}
          {totalCount > PAGE_SIZE && (
            <div className="flex items-center justify-between px-1 py-2 text-sm">
              <span className="text-muted-foreground text-xs">
                Pág. {pageNumber} de {totalPages} · {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <Button size="icon" variant="outline" disabled={pageNumber === 1} onClick={() => setPageNumber(p => p - 1)}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button size="icon" variant="outline" disabled={pageNumber >= totalPages} onClick={() => setPageNumber(p => p + 1)}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Desktop table */}
      {!isMobile && (
      <GlassCard className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left">ID SIM</th>
                <th className="px-3 py-2 text-left">Tipo de SIM</th>
                <th className="px-3 py-2 text-left">Fecha</th>
                <th className="px-3 py-2 text-left">Hora</th>
                <th className="px-3 py-2 text-left">Promotor</th>
                <th className="px-3 py-2 text-left">Ciudad</th>
                <th className="px-3 py-2 text-left">Tienda</th>
                <th className="px-3 py-2 text-left">Tipo de venta</th>
                <th className="px-3 py-2 text-left">Forma de pago</th>
                <th className="px-3 py-2 text-right">Monto</th>
                <th className="px-3 py-2 text-center">Evidencias</th>
                <th className="px-3 py-2 text-left">Status</th>
                <th className="px-3 py-2 text-left">Razón</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {listQuery.isLoading ? (
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-t border-border/30">
                    <td colSpan={14} className="px-3 py-3">
                      <Skeleton className="h-6 w-full" />
                    </td>
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-3 py-10 text-center text-muted-foreground">
                    No hay ventas que coincidan con los filtros.
                  </td>
                </tr>
              ) : (
                rows.map(row => (
                  <tr key={row.id} className="border-t border-border/30 hover:bg-muted/20">
                    <td className="px-3 py-2 font-mono text-xs">{row.serialNumbers[0] ?? '—'}</td>
                    <td className="px-3 py-2">{row.category?.name ?? '—'}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatDate(row.createdAt)}</td>
                    <td className="px-3 py-2 whitespace-nowrap">{formatTime(row.createdAt)}</td>
                    <td className="px-3 py-2">{row.staff ? `${row.staff.firstName} ${row.staff.lastName}`.trim() : '—'}</td>
                    <td className="px-3 py-2">{row.venue.city ?? '—'}</td>
                    <td className="px-3 py-2">{row.venue.name}</td>
                    <td className="px-3 py-2">{saleTypeLabel(row)}</td>
                    <td className="px-3 py-2">{PAYMENT_FORM_LABELS[row.payment?.paymentForm ?? 'NONE']}</td>
                    <td className="px-3 py-2 text-right font-mono">
                      {row.payment?.amount?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) ?? '—'}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-center gap-1">
                        {row.photos.length === 0 ? (
                          <span className="text-muted-foreground text-xs">Sin foto</span>
                        ) : (
                          row.photos.map((url, i) => (
                            <button
                              key={i}
                              type="button"
                              onClick={() => setPhotoPreview(url)}
                              className="rounded border border-input p-1 hover:border-foreground transition-colors"
                              title={i === 0 ? 'Vinculación' : 'Portabilidad'}
                            >
                              <ImageIcon className="h-4 w-4" />
                            </button>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-3 py-2">{statusBadge(row.status)}</td>
                    <td className="px-3 py-2 text-xs">
                      {row.rejectionReasons.length > 0 ? (
                        <div className="space-y-0.5">
                          {row.rejectionReasons.map(r => (
                            <div key={r} className="text-yellow-700 dark:text-yellow-400">
                              {SALE_VERIFICATION_REJECTION_REASON_LABELS[r]}
                            </div>
                          ))}
                          {row.reviewNotes && <div className="text-muted-foreground italic">{row.reviewNotes}</div>}
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex items-center justify-end gap-1">
                        {row.status === 'PENDING' ? (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-700 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
                              onClick={() => openReview(row, 'approve')}
                            >
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                              Aprobar
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-700 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
                              onClick={() => openReview(row, 'reject')}
                            >
                              <XCircle className="h-3.5 w-3.5 mr-1" />
                              Revisar
                            </Button>
                          </>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            {row.reviewedBy ? `por ${row.reviewedBy.firstName}` : 'Revisada'}
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalCount > PAGE_SIZE && (
          <div className="flex items-center justify-between px-3 py-2 border-t border-border/30 text-sm">
            <span className="text-muted-foreground">
              Página {pageNumber} de {totalPages} · {totalCount} ventas
            </span>
            <div className="flex items-center gap-1">
              <Button size="icon" variant="outline" disabled={pageNumber === 1} onClick={() => setPageNumber(p => p - 1)}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="outline" disabled={pageNumber >= totalPages} onClick={() => setPageNumber(p => p + 1)}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </GlassCard>
      )}

      {/* Review dialog (approve/reject) */}
      <ReviewSaleDialog
        open={reviewOpen}
        mode={reviewMode}
        verification={reviewVerification}
        orgId={orgId}
        onClose={() => setReviewOpen(false)}
      />

      {/* Photo zoom dialog */}
      <Dialog open={!!photoPreview} onOpenChange={open => !open && setPhotoPreview(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Evidencia</DialogTitle>
          </DialogHeader>
          {photoPreview && (
            <img
              src={photoPreview}
              alt="Evidencia de venta"
              className={cn('w-full h-auto rounded-md max-h-[80vh] object-contain bg-muted')}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

function SummaryCard({
  label,
  value,
  loading,
  tone,
}: {
  label: string
  value: number
  loading?: boolean
  tone?: 'success' | 'warning' | 'danger'
}) {
  const toneClass =
    tone === 'success'
      ? 'text-green-700 dark:text-green-400'
      : tone === 'warning'
        ? 'text-yellow-700 dark:text-yellow-400'
        : tone === 'danger'
          ? 'text-red-700 dark:text-red-400'
          : 'text-foreground'
  return (
    <GlassCard className="p-3 sm:p-4">
      <p className="text-[10px] sm:text-xs uppercase tracking-wide text-muted-foreground mb-1 leading-tight">{label}</p>
      {loading ? (
        <Skeleton className="h-7 w-16" />
      ) : (
        <p className={cn('text-lg sm:text-2xl font-bold leading-tight', toneClass)}>{value.toLocaleString('es-MX')}</p>
      )}
    </GlassCard>
  )
}

function SaleCard({
  row,
  formatDate,
  formatTime,
  onPhotoClick,
  onReview,
}: {
  row: OrgSaleRow
  formatDate: (d: string | Date | null | undefined) => string
  formatTime: (d: string | Date | null | undefined) => string
  onPhotoClick: (url: string) => void
  onReview: (mode: ReviewMode) => void
}) {
  const promoter = row.staff ? `${row.staff.firstName} ${row.staff.lastName}`.trim() : '—'
  const venueLabel = row.venue.city ? `${row.venue.name} · ${row.venue.city}` : row.venue.name
  const amount = row.payment?.amount?.toLocaleString('es-MX', { style: 'currency', currency: 'MXN' }) ?? '—'

  return (
    <GlassCard className="p-4 space-y-3">
      {/* Header: serial + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-mono text-xs text-muted-foreground">ID SIM</p>
          <p className="font-mono text-sm break-all">{row.serialNumbers[0] ?? '—'}</p>
        </div>
        {statusBadge(row.status)}
      </div>

      {/* Venue + date */}
      <div className="text-xs text-muted-foreground space-y-0.5">
        <div className="truncate">{venueLabel}</div>
        <div>
          {formatDate(row.createdAt)} · {formatTime(row.createdAt)} · {promoter}
        </div>
      </div>

      {/* Key fields grid */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        <Field label="Tipo SIM" value={row.category?.name ?? '—'} />
        <Field label="Tipo venta" value={saleTypeLabel(row)} />
        <Field label="Forma pago" value={PAYMENT_FORM_LABELS[row.payment?.paymentForm ?? 'NONE']} />
        <Field label="Monto" value={amount} mono />
      </div>

      {/* Photos */}
      {row.photos.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">Evidencias</span>
          <div className="flex items-center gap-1">
            {row.photos.map((url, i) => (
              <button
                key={i}
                type="button"
                onClick={() => onPhotoClick(url)}
                className="rounded border border-input p-2 hover:border-foreground transition-colors"
                title={i === 0 ? 'Vinculación' : 'Portabilidad'}
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Rejection reasons */}
      {row.rejectionReasons.length > 0 && (
        <div className="text-xs space-y-0.5 pt-2 border-t border-border/30">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Razón</p>
          {row.rejectionReasons.map(r => (
            <div key={r} className="text-yellow-700 dark:text-yellow-400">
              {SALE_VERIFICATION_REJECTION_REASON_LABELS[r]}
            </div>
          ))}
          {row.reviewNotes && <div className="text-muted-foreground italic">{row.reviewNotes}</div>}
        </div>
      )}

      {/* Actions */}
      <div className="pt-2 border-t border-border/30">
        {row.status === 'PENDING' ? (
          <div className="grid grid-cols-2 gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-green-700 border-green-200 hover:bg-green-50 dark:hover:bg-green-900/20"
              onClick={() => onReview('approve')}
            >
              <CheckCircle2 className="h-4 w-4 mr-1" />
              Aprobar
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-red-700 border-red-200 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => onReview('reject')}
            >
              <XCircle className="h-4 w-4 mr-1" />
              Revisar
            </Button>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center">{row.reviewedBy ? `Revisada por ${row.reviewedBy.firstName}` : 'Revisada'}</p>
        )}
      </div>
    </GlassCard>
  )
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] uppercase tracking-wide text-muted-foreground leading-tight">{label}</p>
      <p className={cn('text-sm truncate', mono && 'font-mono')} title={value}>
        {value}
      </p>
    </div>
  )
}
