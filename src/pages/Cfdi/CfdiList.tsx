import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { Download, FileText, MoreHorizontal, XCircle } from 'lucide-react'

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
import { useVenueDateTime } from '@/utils/datetime'
import { Currency } from '@/utils/currency'
import { useCfdis } from '@/hooks/use-cfdi'
import type { Cfdi, CfdiFlow } from '@/services/cfdi.service'
import { CancelCfdiDialog } from './components/CancelCfdiDialog'

const FLOW_OPTIONS: CfdiFlow[] = ['STAFF_B', 'AUTOFACTURA_A', 'GLOBAL_C']
const STATUS_OPTIONS = ['DRAFT', 'PENDING', 'STAMPED', 'CANCELLED', 'ERROR']

function toIsoDay(date: Date | undefined): string | undefined {
  if (!date) return undefined
  return date.toISOString().slice(0, 10)
}

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
  const { formatDate } = useVenueDateTime()

  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 })
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [flowFilter, setFlowFilter] = useState<string[]>([])
  const [receptorRfc, setReceptorRfc] = useState('')
  const [dateRange, setDateRange] = useState<{ from?: Date; to?: Date }>({})

  const canConfigure = can('cfdi:configure')

  const [cancelTarget, setCancelTarget] = useState<Cfdi | null>(null)

  const filters = useMemo(
    () => ({
      page: pagination.pageIndex + 1,
      pageSize: pagination.pageSize,
      ...(statusFilter.length === 1 && { status: statusFilter[0] }),
      ...(flowFilter.length === 1 && { flow: flowFilter[0] as CfdiFlow }),
      ...(receptorRfc.trim() && { receptorRfc: receptorRfc.trim() }),
      ...(toIsoDay(dateRange.from) && { from: toIsoDay(dateRange.from) }),
      ...(toIsoDay(dateRange.to) && { to: toIsoDay(dateRange.to) }),
    }),
    [pagination, statusFilter, flowFilter, receptorRfc, dateRange],
  )

  const { data, isLoading, isError } = useCfdis(filters)
  const cfdis = data?.cfdis ?? []
  const total = data?.total ?? 0

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

      {isError && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          {t('list.loadError')}
        </div>
      )}

      <DataTable
        data={cfdis}
        rowCount={total}
        columns={columns}
        isLoading={isLoading}
        tableId="cfdi:main"
        pagination={pagination}
        setPagination={setPagination}
        toolbarLeft={
          <div className="flex flex-wrap items-center gap-2">
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
                  onApply={setStatusFilter}
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
                  onApply={setFlowFilter}
                />
              </FilterPill>
            </FilterPillBar>

            <Input
              value={receptorRfc}
              onChange={e => setReceptorRfc(e.target.value.toUpperCase())}
              placeholder={t('filters.receptorRfcPlaceholder')}
              className="h-7 w-[180px] rounded-full text-xs"
              aria-label={t('filters.receptorRfc')}
            />
          </div>
        }
      />

      <CancelCfdiDialog cfdi={cancelTarget} onOpenChange={open => !open && setCancelTarget(null)} />
    </div>
  )
}
