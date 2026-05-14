import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { type ColumnDef } from '@tanstack/react-table'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { ChefHat, Package, Flame, Settings2, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getIntlLocale } from '@/utils/i18n-locale'
import type { DerivedRow, ProfitabilityStatus } from '../../types/profitability'

interface Props {
  rows: DerivedRow[]
  isLoading?: boolean
  onConfigurePolicy: (row: DerivedRow) => void
  onRowClick?: (row: DerivedRow) => void
}

const STATUS_STYLES: Record<ProfitabilityStatus, { label: string; cls: string; dot: string }> = {
  EXCELLENT: {
    label: 'Excelente',
    cls: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-400',
    dot: 'bg-emerald-500',
  },
  HEALTHY: {
    label: 'Saludable',
    cls: 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900/60 dark:bg-teal-950/40 dark:text-teal-400',
    dot: 'bg-teal-500',
  },
  ACCEPTABLE: {
    label: 'Aceptable',
    cls: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-400',
    dot: 'bg-amber-500',
  },
  POOR: {
    label: 'Pobre',
    cls: 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-950/40 dark:text-rose-400',
    dot: 'bg-rose-500',
  },
  UNDEFINED: {
    label: 'Sin definir',
    cls: 'border-border bg-muted text-muted-foreground',
    dot: 'bg-muted-foreground',
  },
}

function StatusPill({ status }: { status: ProfitabilityStatus }) {
  const s = STATUS_STYLES[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap',
        s.cls,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} />
      {s.label}
    </span>
  )
}

function TypeBadge({ type }: { type: DerivedRow['type'] }) {
  const isRecipe = type === 'RECIPE'
  const Icon = isRecipe ? ChefHat : Package
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider whitespace-nowrap',
        isRecipe
          ? 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-900/60 dark:bg-violet-950/30 dark:text-violet-400'
          : 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-400',
      )}
    >
      <Icon className="h-3 w-3" />
      {isRecipe ? 'Receta' : 'Unitario'}
    </span>
  )
}

const pct = (n: number | null, digits = 1) => (n === null ? '—' : `${(n * 100).toFixed(digits)}%`)

function SortHeader({ label, onSort }: { label: string; onSort: () => void }) {
  return (
    <button onClick={onSort} className="inline-flex items-center gap-1.5 hover:text-foreground transition-colors">
      {label}
      <ArrowUpDown className="h-3 w-3 opacity-50" />
    </button>
  )
}

export function UnifiedProfitabilityTable({ rows, isLoading, onConfigurePolicy, onRowClick }: Props) {
  const { venue } = useCurrentVenue()
  const { i18n } = useTranslation()

  const currency = useMemo(() => {
    const code = venue?.currency || 'USD'
    const locale = getIntlLocale(i18n.language)
    return (n: number | null) =>
      n === null ? '—' : new Intl.NumberFormat(locale, { style: 'currency', currency: code, minimumFractionDigits: 2 }).format(n)
  }, [venue?.currency, i18n.language])

  const columns = useMemo<ColumnDef<DerivedRow>[]>(
    () => [
      {
        id: 'name',
        accessorKey: 'name',
        meta: { label: 'Producto' },
        header: ({ column }) => <SortHeader label="Producto" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => (
          <div className="min-w-0">
            <div className="font-medium text-foreground truncate flex items-center gap-2">
              {row.original.name}
              {row.original.costDrift && (
                <Flame className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 flex-none" />
              )}
            </div>
            <div className="text-xs text-muted-foreground truncate">{row.original.category ?? 'Sin categoría'}</div>
          </div>
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        meta: { label: 'Tipo' },
        header: 'Tipo',
        cell: ({ row }) => <TypeBadge type={row.original.type} />,
      },
      {
        id: 'price',
        accessorKey: 'price',
        meta: { label: 'Precio' },
        header: ({ column }) => <SortHeader label="Precio" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => <div className="text-right tabular-nums">{currency(row.original.price)}</div>,
      },
      {
        id: 'cost',
        accessorKey: 'cost',
        meta: { label: 'Costo' },
        header: ({ column }) => <SortHeader label="Costo" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => <div className="text-right tabular-nums text-muted-foreground">{currency(row.original.cost)}</div>,
      },
      {
        id: 'costPct',
        accessorKey: 'costPct',
        meta: { label: 'Costo %' },
        header: ({ column }) => <SortHeader label="Costo %" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => {
          const v = row.original.costPct
          if (v === null) return <div className="text-right tabular-nums text-muted-foreground">—</div>
          const pctNum = v * 100
          return (
            <div
              className={cn(
                'text-right tabular-nums font-medium',
                pctNum >= 65 ? 'text-rose-600 dark:text-rose-400' : pctNum >= 50 ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground',
              )}
            >
              {pctNum.toFixed(1)}%
            </div>
          )
        },
      },
      {
        id: 'marginAmount',
        accessorKey: 'marginAmount',
        meta: { label: 'Margen $' },
        header: ({ column }) => <SortHeader label="Margen $" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => <div className="text-right tabular-nums">{currency(row.original.marginAmount)}</div>,
      },
      {
        id: 'marginPct',
        accessorKey: 'marginPct',
        meta: { label: 'Margen %' },
        header: ({ column }) => <SortHeader label="Margen %" onSort={() => column.toggleSorting()} />,
        cell: ({ row }) => <div className="text-right tabular-nums font-semibold">{pct(row.original.marginPct)}</div>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        meta: { label: 'Estatus' },
        header: 'Estatus',
        cell: ({ row }) => <StatusPill status={row.original.status} />,
      },
      {
        id: 'actions',
        meta: { label: '' },
        header: '',
        cell: ({ row }) => (
          <div className="flex justify-end">
            <Button
              size="sm"
              variant="ghost"
              onClick={e => {
                e.stopPropagation()
                onConfigurePolicy(row.original)
              }}
              className="h-8 gap-1.5 text-xs"
            >
              <Settings2 className="h-3.5 w-3.5" />
              Política
            </Button>
          </div>
        ),
      },
    ],
    [onConfigurePolicy, currency],
  )

  return (
    <DataTable
      data={rows}
      rowCount={rows.length}
      columns={columns}
      isLoading={isLoading}
      tableId="inventory:profitability"
      stickyFirstColumn
      onRowClick={onRowClick}
    />
  )
}
