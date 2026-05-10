import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { StatusPulse } from '@/components/ui/status-pulse'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { getTerminalStatusInfo, type TerminalStatusKey } from '@/lib/terminal-status'
import { useVenueDateTime } from '@/utils/datetime'
import { getDateFnsLocale } from '@/utils/i18n-locale'
import type { OrgTerminal, OrgTerminalSortBy } from '@/services/organizationDashboard.service'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { formatDistanceToNow } from 'date-fns'
import { ArrowDown, ArrowUp, ArrowUpDown, Lock } from 'lucide-react'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

export interface SortState {
  sortBy: OrgTerminalSortBy
  sortOrder: 'asc' | 'desc'
}

interface OrgTerminalsTableProps {
  data: OrgTerminal[]
  total: number
  isLoading: boolean
  sort: SortState
  onSortChange: (next: SortState) => void
  pagination: PaginationState
  setPagination: React.Dispatch<React.SetStateAction<PaginationState>>
  onRowClick: (terminal: OrgTerminal) => void
  onSelectionChange: (selected: OrgTerminal[]) => void
  clearSelectionTrigger: number
}

function SortHeader({
  label,
  columnId,
  sort,
  onSortChange,
}: {
  label: string
  columnId: OrgTerminalSortBy
  sort: SortState
  onSortChange: (next: SortState) => void
}) {
  const isActive = sort.sortBy === columnId
  const handleClick = () => {
    if (!isActive) {
      onSortChange({ sortBy: columnId, sortOrder: 'desc' })
      return
    }
    if (sort.sortOrder === 'desc') {
      onSortChange({ sortBy: columnId, sortOrder: 'asc' })
      return
    }
    // Tri-state: third click resets to default sort
    onSortChange({ sortBy: 'lastHeartbeat', sortOrder: 'desc' })
  }
  const Icon = !isActive ? ArrowUpDown : sort.sortOrder === 'asc' ? ArrowUp : ArrowDown
  return (
    <button
      type="button"
      onClick={handleClick}
      aria-sort={isActive ? (sort.sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}
      className="inline-flex items-center gap-1 -ml-1 px-1 py-0.5 rounded hover:bg-muted/50 transition-colors cursor-pointer"
    >
      <span className="text-xs font-medium">{label}</span>
      <Icon className={`h-3 w-3 ${isActive ? 'text-foreground' : 'text-muted-foreground/60'}`} />
    </button>
  )
}

export function OrgTerminalsTable({
  data,
  total,
  isLoading,
  sort,
  onSortChange,
  pagination,
  setPagination,
  onRowClick,
  onSelectionChange,
  clearSelectionTrigger,
}: OrgTerminalsTableProps) {
  const { t, i18n } = useTranslation('organization')
  const { formatDateTime } = useVenueDateTime()
  const dateFnsLocale = getDateFnsLocale(i18n.language)

  const columns = useMemo<ColumnDef<OrgTerminal>[]>(() => {
    const formatLastSeen = (last: string | null) => {
      if (!last) return '—'
      return formatDistanceToNow(new Date(last), { addSuffix: true, locale: dateFnsLocale })
    }
    const statusLabelMap: Record<TerminalStatusKey, string> = {
      locked: t('terminals.status.locked'),
      pending: t('terminals.status.pending'),
      online: t('terminals.status.online'),
      offline: t('terminals.status.offline'),
      inactive: t('terminals.status.inactive'),
      maintenance: t('terminals.status.maintenance'),
      retired: t('terminals.status.retired'),
      unknown: t('terminals.status.online', { defaultValue: '—' }),
    }

    const typeLabelMap: Record<string, string> = {
      TPV_ANDROID: 'Android',
      TPV_IOS: 'iOS',
      PRINTER_RECEIPT: t('terminals.type.receipt'),
      PRINTER_KITCHEN: t('terminals.type.kitchen'),
      KDS: 'KDS',
    }

    return [
      {
        id: 'pulse',
        header: '',
        enableSorting: false,
        size: 32,
        meta: { label: '' },
        cell: ({ row }) => {
          const terminal = row.original
          const info = getTerminalStatusInfo({
            status: terminal.status,
            lastHeartbeat: terminal.lastHeartbeat,
            isLocked: terminal.isLocked,
          })
          return (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <StatusPulse status={info.pulseStatus} size="sm" />
                </span>
              </TooltipTrigger>
              <TooltipContent side="right">
                <p className="text-xs font-medium">{statusLabelMap[info.statusKey]}</p>
                {terminal.lastHeartbeat && (
                  <p className="text-xs text-muted-foreground">{formatDateTime(terminal.lastHeartbeat)}</p>
                )}
              </TooltipContent>
            </Tooltip>
          )
        },
      },
      {
        id: 'name',
        accessorKey: 'name',
        enableSorting: false,
        meta: { label: t('terminals.columns.terminal') },
        header: () => <SortHeader columnId="name" label={t('terminals.columns.terminal')} sort={sort} onSortChange={onSortChange} />,
        cell: ({ row }) => {
          const terminal = row.original
          return (
            <div className="min-w-0">
              <p className="font-medium text-sm truncate">{terminal.name}</p>
              {terminal.serialNumber && (
                <p className="text-xs text-muted-foreground font-mono truncate">{terminal.serialNumber}</p>
              )}
            </div>
          )
        },
      },
      {
        id: 'venue',
        accessorFn: row => row.venue.name,
        enableSorting: false,
        meta: { label: t('terminals.columns.venue') },
        header: () => (
          <SortHeader columnId="venue.name" label={t('terminals.columns.venue')} sort={sort} onSortChange={onSortChange} />
        ),
        cell: ({ row }) => <span className="text-sm text-muted-foreground">{row.original.venue.name}</span>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        enableSorting: false,
        meta: { label: t('terminals.columns.status') },
        header: () => <SortHeader columnId="status" label={t('terminals.columns.status')} sort={sort} onSortChange={onSortChange} />,
        cell: ({ row }) => {
          const terminal = row.original
          const info = getTerminalStatusInfo({
            status: terminal.status,
            lastHeartbeat: terminal.lastHeartbeat,
            isLocked: terminal.isLocked,
          })
          return (
            <div className="flex items-center gap-1.5">
              <span className="text-sm">{statusLabelMap[info.statusKey]}</span>
              {terminal.isLocked && (
                <Badge variant="outline" className="h-4 px-1.5 text-[10px] gap-0.5">
                  <Lock className="h-2.5 w-2.5" />
                  {t('terminals.status.locked')}
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        id: 'type',
        accessorKey: 'type',
        enableSorting: false,
        meta: { label: t('terminals.columns.type') },
        header: () => <SortHeader columnId="type" label={t('terminals.columns.type')} sort={sort} onSortChange={onSortChange} />,
        cell: ({ row }) => (
          <Badge variant="outline" className="text-xs">
            {typeLabelMap[row.original.type] ?? row.original.type}
          </Badge>
        ),
      },
      {
        id: 'brandModel',
        accessorFn: row => [row.brand, row.model].filter(Boolean).join(' '),
        enableSorting: false,
        meta: { label: t('terminals.columns.brandModel') },
        header: () => <SortHeader columnId="brand" label={t('terminals.columns.brandModel')} sort={sort} onSortChange={onSortChange} />,
        cell: ({ row }) => {
          const value = [row.original.brand, row.original.model].filter(Boolean).join(' ')
          return <span className="text-sm text-muted-foreground">{value || '—'}</span>
        },
      },
      {
        id: 'health',
        accessorKey: 'healthScore',
        enableSorting: false,
        meta: { label: t('terminals.columns.health') },
        header: () => (
          <SortHeader columnId="latestHealthScore" label={t('terminals.columns.health')} sort={sort} onSortChange={onSortChange} />
        ),
        cell: ({ row }) => {
          const score = row.original.healthScore
          if (score === null) return <span className="text-sm text-muted-foreground">—</span>
          const color = score >= 80 ? 'text-green-600 dark:text-green-400'
            : score >= 50 ? 'text-amber-600 dark:text-amber-400'
              : 'text-red-600 dark:text-red-400'
          return <span className={`text-sm font-medium ${color}`}>{score}%</span>
        },
      },
      {
        id: 'version',
        accessorKey: 'version',
        enableSorting: false,
        meta: { label: t('terminals.columns.version') },
        header: t('terminals.columns.version'),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground font-mono">{row.original.version ?? '—'}</span>
        ),
      },
      {
        id: 'lastSeen',
        accessorKey: 'lastHeartbeat',
        enableSorting: false,
        meta: { label: t('terminals.columns.lastSeen') },
        header: () => (
          <SortHeader columnId="lastHeartbeat" label={t('terminals.columns.lastSeen')} sort={sort} onSortChange={onSortChange} />
        ),
        cell: ({ row }) => (
          <span className="text-sm text-muted-foreground">{formatLastSeen(row.original.lastHeartbeat)}</span>
        ),
      },
    ]
  }, [t, sort, onSortChange, formatDateTime, dateFnsLocale])

  return (
    <DataTable<OrgTerminal>
      data={data}
      rowCount={total}
      columns={columns}
      isLoading={isLoading}
      pagination={pagination}
      setPagination={setPagination}
      onRowClick={onRowClick}
      tableId="org-terminals"
      enableRowSelection
      onRowSelectionChange={onSelectionChange}
      clearSelectionTrigger={clearSelectionTrigger}
    />
  )
}

