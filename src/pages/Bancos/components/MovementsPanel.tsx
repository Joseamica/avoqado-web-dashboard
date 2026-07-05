/**
 * MovementsPanel — estado de cuenta reusable de una cuenta bancaria conectada.
 * 4 tarjetas de totales por categoría (SPEI in/out, transferencias, dispersiones)
 * + DataTable paginada de movimientos (paginación y filtros server-side), con rango de
 * fechas preseleccionable y filtros Tipo/Estatus (Stripe-style, ver ui-patterns.md).
 * Solo lectura. Montos honestos: null → '—', jamás $0.
 *
 * Filtros de un solo valor (SingleSelectFilterContent, no checkboxes): el proveedor solo
 * acepta UN TipoMovimiento/idEstatus por request (no una lista IN) — confirmado contra el
 * swagger del proveedor. Las opciones de cada filtro se derivan de una muestra REAL de
 * movimientos (sin filtrar por tipo/estatus, solo por rango de fecha) en vez de un catálogo
 * hardcodeado — no existe un catálogo de tipos de movimiento en el proveedor, y así el
 * universo de opciones no se reduce cuando ya hay un filtro aplicado (mismo patrón que
 * Orders.tsx: fetch amplio y estable para opciones, separado del fetch paginado/filtrado).
 *
 * Extraído del BankAccountMovementsSheet para reusarse como página del hub Bancos
 * (bancos/movimientos) y dentro del Sheet. El Sheet queda como wrapper delgado.
 */
import { useMemo, useState } from 'react'
import { useQuery, keepPreviousData } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowDownLeft, ArrowUpRight, Repeat, Send, X } from 'lucide-react'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import DataTable from '@/components/data-table'
import { FilterPill, SingleSelectFilterContent } from '@/components/filters'
import { cn } from '@/lib/utils'
import { Currency } from '@/utils/currency'
import {
  financialConnectionAPI,
  type AccountMovement,
  type FinancialAccountSummary,
  type MovementCategoryStats,
} from '@/services/financialConnection.service'

const PAGE_SIZE = 10
// Tamaño de la muestra para derivar las opciones de los filtros Tipo/Estatus — el máximo que
// acepta el endpoint (MAX_MOVEMENTS_PAGE_SIZE en el controller). Un tipo que no aparezca en
// los últimos 50 movimientos del rango simplemente no se ofrece todavía como filtro.
const FILTER_OPTIONS_SAMPLE_SIZE = 50
const RANGE_PRESETS = [7, 30, 90] as const
type RangePreset = (typeof RANGE_PRESETS)[number]

function rangeToIso(days: RangePreset): { from: string; to: string } {
  const to = new Date()
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000)
  return { from: from.toISOString(), to: to.toISOString() }
}

/** Paleta por categoría — chip tenue (10% de opacidad) que da identidad sin gritar. */
const STAT_TONE = {
  in: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
  out: 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
  transfer: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400',
  dispersion: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
} as const

/** El proveedor no manda una dirección explícita — se infiere del texto libre de type/operationType. */
function isOutgoingMovement(m: Pick<AccountMovement, 'type' | 'operationType'>): boolean {
  return /egreso|out|env|cargo|salida/i.test(`${m.type ?? ''} ${m.operationType ?? ''}`)
}

/** Pares {value,label} únicos de un id+label de una muestra de movimientos, para un FilterPill. */
function uniqueOptions(
  movements: AccountMovement[],
  idKey: 'typeId' | 'statusId',
  labelKey: 'type' | 'status',
): { value: string; label: string }[] {
  const seen = new Map<number, string>()
  for (const m of movements) {
    const id = m[idKey]
    const label = m[labelKey]
    if (id != null && label && !seen.has(id)) seen.set(id, label)
  }
  return Array.from(seen, ([value, label]) => ({ value: String(value), label }))
}

function StatCard({
  label,
  icon,
  tone,
  stats,
}: {
  label: string
  icon: React.ReactNode
  tone: keyof typeof STAT_TONE
  stats: MovementCategoryStats | undefined
}) {
  const { t } = useTranslation('financialConnections')
  return (
    <div className="flex flex-col gap-2.5 rounded-xl bg-muted/50 p-4">
      <div className="flex items-center gap-2">
        <span className={cn('flex h-7 w-7 shrink-0 items-center justify-center rounded-full', STAT_TONE[tone])}>{icon}</span>
        <span className="text-xs font-medium leading-tight text-muted-foreground">{label}</span>
      </div>
      <span className="text-xl font-semibold tracking-tight tabular-nums">{stats?.amount != null ? Currency(stats.amount) : '—'}</span>
      <span className="text-xs text-muted-foreground">{t('movements.stats.operations', { count: stats?.count ?? 0 })}</span>
    </div>
  )
}

/** Detalle de un movimiento — todos los campos que la fila de la tabla no muestra por separado. */
function MovementDetailSheet({ movement, onClose }: { movement: AccountMovement | null; onClose: () => void }) {
  const { t } = useTranslation('financialConnections')
  const outgoing = movement ? isOutgoingMovement(movement) : false

  const rows: Array<{ label: string; value: string }> = movement
    ? [
        { label: t('movements.table.type'), value: movement.type ?? '—' },
        {
          label: outgoing ? t('movements.detail.destination') : t('movements.detail.origin'),
          value: movement.beneficiary ?? movement.originator ?? '—',
        },
        { label: t('movements.table.reference'), value: movement.reference ?? '—' },
        { label: t('movements.table.status'), value: movement.status ?? '—' },
        { label: t('movements.detail.folio'), value: movement.id ?? '—' },
      ]
    : []

  return (
    <Sheet open={!!movement} onOpenChange={o => !o && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto sm:max-w-md">
        {movement && (
          <>
            <SheetHeader className="gap-3 px-6 pb-4 pt-6">
              <span
                className={cn('flex h-10 w-10 items-center justify-center rounded-full', outgoing ? STAT_TONE.out : STAT_TONE.in)}
                aria-hidden
              >
                {outgoing ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}
              </span>
              <SheetTitle>{movement.concept ?? movement.type ?? t('movements.detail.title')}</SheetTitle>
              <SheetDescription>{movement.date ? new Date(movement.date).toLocaleString() : '—'}</SheetDescription>
              <span
                className={cn(
                  'text-2xl font-semibold tabular-nums',
                  outgoing ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400',
                )}
              >
                {movement.amount != null ? `${outgoing ? '−' : '+'}${Currency(movement.amount)}` : '—'}
              </span>
            </SheetHeader>
            <div className="divide-y divide-border/40 px-6">
              {rows.map(r => (
                <div key={r.label} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm text-muted-foreground">{r.label}</span>
                  <span className="max-w-[60%] truncate text-right text-sm font-medium">{r.value}</span>
                </div>
              ))}
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}

/**
 * Panel de movimientos. `enabled` controla el disparo de las queries (para el Sheet,
 * que solo consulta cuando está abierto; en una página siempre es true).
 */
export function MovementsPanel({
  venueId,
  account,
  enabled = true,
}: {
  venueId: string
  account: FinancialAccountSummary
  enabled?: boolean
}) {
  const { t } = useTranslation('financialConnections')
  const [rangeDays, setRangeDays] = useState<RangePreset>(30)
  const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })
  const [typeFilter, setTypeFilter] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState<string | null>(null)
  const [selectedMovement, setSelectedMovement] = useState<AccountMovement | null>(null)
  const range = useMemo(() => rangeToIso(rangeDays), [rangeDays])

  const stats = useQuery({
    queryKey: ['financial-account-movement-stats', account.id, rangeDays],
    queryFn: () => financialConnectionAPI.getMovementStats(venueId, account.id, range),
    enabled,
  })

  // Universo de opciones para los FilterPill — ver comentario de cabecera del archivo.
  const filterOptionsQuery = useQuery({
    queryKey: ['financial-account-movement-filter-options', account.id, rangeDays],
    queryFn: () => financialConnectionAPI.getMovements(venueId, account.id, { page: 0, size: FILTER_OPTIONS_SAMPLE_SIZE, ...range }),
    enabled,
  })
  const typeOptions = useMemo(
    () => uniqueOptions(filterOptionsQuery.data?.movements ?? [], 'typeId', 'type'),
    [filterOptionsQuery.data],
  )
  const statusOptions = useMemo(
    () => uniqueOptions(filterOptionsQuery.data?.movements ?? [], 'statusId', 'status'),
    [filterOptionsQuery.data],
  )

  const movs = useQuery({
    queryKey: [
      'financial-account-movements',
      account.id,
      rangeDays,
      pagination.pageIndex,
      pagination.pageSize,
      typeFilter,
      statusFilter,
    ],
    queryFn: () =>
      financialConnectionAPI.getMovements(venueId, account.id, {
        page: pagination.pageIndex,
        size: pagination.pageSize,
        ...range,
        type: typeFilter != null ? Number(typeFilter) : undefined,
        status: statusFilter != null ? Number(statusFilter) : undefined,
      }),
    enabled,
    placeholderData: keepPreviousData,
  })

  const selectRange = (d: RangePreset) => {
    setRangeDays(d)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }
  const selectType = (v: string | null) => {
    setTypeFilter(v)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }
  const selectStatus = (v: string | null) => {
    setStatusFilter(v)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }
  const activeFiltersCount = (typeFilter ? 1 : 0) + (statusFilter ? 1 : 0)
  const clearFilters = () => {
    setTypeFilter(null)
    setStatusFilter(null)
    setPagination(p => ({ ...p, pageIndex: 0 }))
  }

  // Orden de columnas: Fecha, Concepto, Tipo, Contraparte, Referencia, Estatus, Monto —
  // los filtros (Tipo, Estatus) van más abajo en ESE MISMO orden (regla MANDATORY de ui-patterns.md).
  const columns: ColumnDef<AccountMovement>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        header: t('movements.table.date'),
        cell: ({ row }) => (
          <span className="whitespace-nowrap text-sm">{row.original.date ? new Date(row.original.date).toLocaleString() : '—'}</span>
        ),
      },
      {
        accessorKey: 'concept',
        header: t('movements.table.concept'),
        cell: ({ row }) => <span className="text-sm">{row.original.concept ?? row.original.type ?? '—'}</span>,
      },
      {
        accessorKey: 'type',
        header: t('movements.table.type'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.type ?? '—'}</span>,
      },
      {
        id: 'counterparty',
        header: t('movements.table.counterparty'),
        cell: ({ row }) => {
          const m = row.original
          const outgoing = isOutgoingMovement(m)
          return <span className="text-sm">{(outgoing ? m.beneficiary : m.originator) ?? '—'}</span>
        },
      },
      {
        accessorKey: 'reference',
        header: t('movements.table.reference'),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.reference ?? '—'}</span>,
      },
      {
        accessorKey: 'status',
        header: t('movements.table.status'),
        cell: ({ row }) =>
          row.original.status ? (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">{row.original.status}</span>
          ) : (
            '—'
          ),
      },
      {
        accessorKey: 'amount',
        header: t('movements.table.amount'),
        cell: ({ row }) => {
          const m = row.original
          const outgoing = isOutgoingMovement(m)
          return (
            <span className={cn('text-sm font-semibold tabular-nums', outgoing ? 'text-foreground' : 'text-emerald-600 dark:text-emerald-400')}>
              {m.amount != null ? `${outgoing ? '−' : '+'}${Currency(m.amount)}` : '—'}
            </span>
          )
        },
      },
    ],
    [t],
  )

  return (
    <div className="flex flex-col gap-5">
      {/* Rango — pills al estilo del dashboard */}
      <div className="flex gap-1.5">
        {RANGE_PRESETS.map(d => (
          <button
            key={d}
            type="button"
            onClick={() => selectRange(d)}
            className={cn(
              'cursor-pointer rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors',
              rangeDays === d ? 'bg-foreground text-background' : 'text-muted-foreground hover:bg-muted hover:text-foreground',
            )}
          >
            {t(`movements.range.${d}`)}
          </button>
        ))}
      </div>

      {/* Totales entra/sale */}
      {stats.isLoading ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[0, 1, 2, 3].map(i => (
            <Skeleton key={i} className="h-[104px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label={t('movements.stats.speiIn')} tone="in" icon={<ArrowDownLeft className="h-4 w-4" aria-hidden />} stats={stats.data?.speiIn} />
          <StatCard label={t('movements.stats.speiOut')} tone="out" icon={<ArrowUpRight className="h-4 w-4" aria-hidden />} stats={stats.data?.speiOut} />
          <StatCard
            label={t('movements.stats.internalTransfers')}
            tone="transfer"
            icon={<Repeat className="h-4 w-4" aria-hidden />}
            stats={stats.data?.internalTransfers}
          />
          <StatCard label={t('movements.stats.dispersions')} tone="dispersion" icon={<Send className="h-4 w-4" aria-hidden />} stats={stats.data?.dispersions} />
        </div>
      )}

      {/* Filtros Tipo/Estatus — un solo valor c/u: el proveedor no soporta listas IN. */}
      <div className="flex flex-wrap items-center gap-2">
        <FilterPill
          label={t('movements.filters.type')}
          activeLabel={typeOptions.find(o => o.value === typeFilter)?.label}
          onClear={() => selectType(null)}
        >
          <SingleSelectFilterContent
            title={t('movements.filters.type')}
            options={typeOptions}
            selectedValue={typeFilter}
            onSelect={selectType}
            emptyLabel={t('movements.filters.empty')}
          />
        </FilterPill>
        <FilterPill
          label={t('movements.filters.status')}
          activeLabel={statusOptions.find(o => o.value === statusFilter)?.label}
          onClear={() => selectStatus(null)}
        >
          <SingleSelectFilterContent
            title={t('movements.filters.status')}
            options={statusOptions}
            selectedValue={statusFilter}
            onSelect={selectStatus}
            emptyLabel={t('movements.filters.empty')}
          />
        </FilterPill>
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={clearFilters}
            className="h-7 gap-1.5 rounded-full bg-background dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black"
          >
            <X className="h-3.5 w-3.5" />
            {t('movements.filters.reset')}
          </Button>
        )}
      </div>

      {/* Estado de cuenta */}
      {movs.isError ? (
        <div className="rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">{t('movements.table.loadError')}</div>
      ) : (
        <>
          <DataTable
            data={movs.data?.movements ?? []}
            rowCount={movs.data?.total ?? 0}
            columns={columns}
            isLoading={movs.isLoading}
            pagination={pagination}
            setPagination={setPagination}
            onRowClick={m => setSelectedMovement(m)}
            tableId="bancos-movimientos"
          />
          {!movs.isLoading && movs.data?.movements.length === 0 && (
            <div className="rounded-xl bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">{t('movements.table.empty')}</div>
          )}
        </>
      )}

      <MovementDetailSheet movement={selectedMovement} onClose={() => setSelectedMovement(null)} />
    </div>
  )
}
