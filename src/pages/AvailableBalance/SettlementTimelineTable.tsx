import { useMemo, useState } from 'react'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useVenueDateTime } from '@/utils/datetime'
import { cn } from '@/lib/utils'
import type { TimelineEntry } from '@/services/availableBalance.service'

interface Props {
  data: TimelineEntry[]
  formatCurrency: (n: number) => string
  cardTypeLabel: (key: string) => string
}

const CARD_TYPE_KEYS = ['CASH', 'DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL', 'OTHER'] as const

const SORT_BUTTON_CLASS = 'h-7 px-1 -ml-1 hover:bg-transparent text-xs font-medium uppercase tracking-wider text-muted-foreground'

const COLUMN_LABELS = {
  date: 'Fecha de transacción',
  cardType: 'Tipo',
  transactionCount: 'Transacciones',
  netAmount: 'Monto neto',
  fees: 'Comisiones',
  estimatedSettlementDate: 'Fecha de liquidación',
} as const

export function SettlementTimelineTable({ data, formatCurrency, cardTypeLabel }: Props) {
  const { formatDate } = useVenueDateTime()
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 })
  const [cardTypeFilter, setCardTypeFilter] = useState<string>('all')

  const filtered = useMemo(() => {
    if (cardTypeFilter === 'all') return data
    return data.filter(d => d.cardType === cardTypeFilter)
  }, [data, cardTypeFilter])

  const presentCardTypes = useMemo(() => {
    const set = new Set<string>()
    for (const d of data) set.add(d.cardType)
    return CARD_TYPE_KEYS.filter(k => set.has(k))
  }, [data])

  const columns: ColumnDef<TimelineEntry, any>[] = useMemo(
    () => [
      {
        accessorKey: 'date',
        meta: { label: COLUMN_LABELS.date },
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className={SORT_BUTTON_CLASS} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {COLUMN_LABELS.date}
            <ArrowUpDown className="ml-1.5 h-3 w-3" />
          </Button>
        ),
        cell: ({ row }) => <span className="font-medium tabular-nums">{formatDate(row.original.date)}</span>,
        sortingFn: (a, b) => new Date(a.original.date).getTime() - new Date(b.original.date).getTime(),
      },
      {
        accessorKey: 'cardType',
        meta: { label: COLUMN_LABELS.cardType },
        header: () => (
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{COLUMN_LABELS.cardType}</span>
        ),
        cell: ({ row }) => <span className="text-sm">{cardTypeLabel(row.original.cardType)}</span>,
        filterFn: (row, _id, value) => value === 'all' || row.original.cardType === value,
      },
      {
        accessorKey: 'transactionCount',
        meta: { label: COLUMN_LABELS.transactionCount },
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className={SORT_BUTTON_CLASS} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Txns
              <ArrowUpDown className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        ),
        cell: ({ row }) => <div className="text-right tabular-nums">{row.original.transactionCount}</div>,
      },
      {
        accessorKey: 'netAmount',
        meta: { label: COLUMN_LABELS.netAmount },
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className={SORT_BUTTON_CLASS} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              {COLUMN_LABELS.netAmount}
              <ArrowUpDown className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className={cn('text-right font-semibold tabular-nums', row.original.netAmount < 0 && 'text-destructive')}>
            {formatCurrency(row.original.netAmount)}
          </div>
        ),
      },
      {
        accessorKey: 'fees',
        meta: { label: COLUMN_LABELS.fees },
        header: () => (
          <div className="text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {COLUMN_LABELS.fees}
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right tabular-nums text-muted-foreground">
            {row.original.fees > 0 ? `-${formatCurrency(row.original.fees)}` : '—'}
          </div>
        ),
      },
      {
        accessorKey: 'estimatedSettlementDate',
        meta: { label: COLUMN_LABELS.estimatedSettlementDate },
        header: ({ column }) => (
          <div className="flex justify-end">
            <Button variant="ghost" size="sm" className={SORT_BUTTON_CLASS} onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              Liquidación
              <ArrowUpDown className="ml-1.5 h-3 w-3" />
            </Button>
          </div>
        ),
        cell: ({ row }) => (
          <div className="text-right text-sm text-muted-foreground tabular-nums">
            {row.original.estimatedSettlementDate ? formatDate(row.original.estimatedSettlementDate) : '—'}
          </div>
        ),
        sortingFn: (a, b) => {
          const ad = a.original.estimatedSettlementDate ? new Date(a.original.estimatedSettlementDate).getTime() : 0
          const bd = b.original.estimatedSettlementDate ? new Date(b.original.estimatedSettlementDate).getTime() : 0
          return ad - bd
        },
      },
    ],
    [formatDate, formatCurrency, cardTypeLabel],
  )

  const filteredTotal = useMemo(() => filtered.reduce((s, r) => s + r.netAmount, 0), [filtered])

  return (
    <DataTable
      data={filtered}
      rowCount={filtered.length}
      columns={columns}
      pagination={pagination}
      setPagination={setPagination}
      tableId="settlement-timeline"
      showColumnCustomizer
      toolbarLeft={
        <>
          <Select value={cardTypeFilter} onValueChange={setCardTypeFilter}>
            <SelectTrigger className="h-9 w-[180px] text-sm">
              <SelectValue placeholder="Filtrar por tipo" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos los métodos</SelectItem>
              {presentCardTypes.map(k => (
                <SelectItem key={k} value={k}>
                  {cardTypeLabel(k)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
            {filtered.length} {filtered.length === 1 ? 'fila' : 'filas'} · {formatCurrency(filteredTotal)} neto
          </span>
        </>
      }
    />
  )
}
