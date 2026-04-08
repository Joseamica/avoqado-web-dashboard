import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ClipboardList, Info, Search, Smartphone, X } from 'lucide-react'

import DataTable from '@/components/data-table'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { DateFilterContent, type DateFilter } from '@/components/filters/DateFilterContent'
import { FilterPill } from '@/components/filters/FilterPill'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import {
  getStockCountStatusBadge,
  getStockCountTypeLabel,
  stockCountService,
  type StockCountRow,
  type StockCountStatus,
  type StockCountType,
} from '@/services/stockCount.service'

/**
 * Stock Count History — READ-ONLY audit view.
 *
 * Stock counts are created from the Avoqado mobile POS apps. The dashboard
 * only lets managers and accountants review the history. No create/edit/delete.
 */
export default function StockCountsPage() {
  const navigate = useNavigate()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StockCountStatus[]>([])
  const [typeFilter, setTypeFilter] = useState<StockCountType[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Fetch stock counts (server handles status/type/date filters; we apply
  // client-side search on top since the payload per venue is small).
  const { data, isLoading } = useQuery({
    queryKey: ['stock-counts', venueId, statusFilter, typeFilter],
    queryFn: () =>
      stockCountService.list(venueId!, {
        status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        type: typeFilter.length === 1 ? typeFilter[0] : undefined,
        pageSize: 200,
      }),
    enabled: !!venueId,
  })

  const counts = useMemo<StockCountRow[]>(() => data?.data ?? [], [data])

  // Client-side filters (date + search + multi-value status/type)
  const filteredCounts = useMemo(() => {
    let result = counts

    if (statusFilter.length > 0) {
      result = result.filter(c => statusFilter.includes(c.status))
    }
    if (typeFilter.length > 0) {
      result = result.filter(c => typeFilter.includes(c.type))
    }

    if (debouncedSearch) {
      const term = debouncedSearch.toLowerCase()
      result = result.filter(
        c =>
          c.id.toLowerCase().includes(term) ||
          (c.createdBy ?? '').toLowerCase().includes(term) ||
          (c.note ?? '').toLowerCase().includes(term),
      )
    }

    if (dateFilter) {
      const now = new Date()
      result = result.filter(c => {
        const created = new Date(c.createdAt)
        switch (dateFilter.operator) {
          case 'last': {
            const value =
              typeof dateFilter.value === 'number'
                ? dateFilter.value
                : parseInt((dateFilter.value as string) || '0', 10)
            const cutoff = new Date()
            switch (dateFilter.unit) {
              case 'hours':
                cutoff.setHours(now.getHours() - value)
                break
              case 'days':
                cutoff.setDate(now.getDate() - value)
                break
              case 'weeks':
                cutoff.setDate(now.getDate() - value * 7)
                break
              case 'months':
                cutoff.setMonth(now.getMonth() - value)
                break
            }
            return created >= cutoff
          }
          case 'before':
            return created < new Date(dateFilter.value as string)
          case 'after':
            return created > new Date(dateFilter.value as string)
          case 'between': {
            const start = new Date(dateFilter.value as string)
            const end = new Date(dateFilter.value2 as string)
            end.setHours(23, 59, 59, 999)
            return created >= start && created <= end
          }
          case 'on': {
            const target = new Date(dateFilter.value as string)
            return (
              created.getFullYear() === target.getFullYear() &&
              created.getMonth() === target.getMonth() &&
              created.getDate() === target.getDate()
            )
          }
          default:
            return true
        }
      })
    }

    return result
  }, [counts, statusFilter, typeFilter, debouncedSearch, dateFilter])

  // Row click → detail
  const handleRowClick = useCallback(
    (row: StockCountRow) => {
      navigate(`${fullBasePath}/inventory/stock-counts/${row.id}`)
    },
    [navigate, fullBasePath],
  )

  // Filter options
  const statusOptions = useMemo(
    () => [
      { value: 'IN_PROGRESS', label: 'En progreso' },
      { value: 'COMPLETED', label: 'Completado' },
    ],
    [],
  )
  const typeOptions = useMemo(
    () => [
      { value: 'CYCLE', label: 'Cíclico' },
      { value: 'FULL', label: 'Completo' },
    ],
    [],
  )

  const getDateFilterLabel = useCallback((filter: DateFilter | null) => {
    if (!filter) return null
    switch (filter.operator) {
      case 'last': {
        const unitLabels: Record<string, string> = {
          hours: 'horas',
          days: 'días',
          weeks: 'semanas',
          months: 'meses',
        }
        return `Últimos ${filter.value} ${unitLabels[filter.unit || 'days']}`
      }
      case 'before':
        return `Antes de ${filter.value}`
      case 'after':
        return `Después de ${filter.value}`
      case 'between':
        return `${filter.value} - ${filter.value2}`
      case 'on':
        return `En ${filter.value}`
      default:
        return null
    }
  }, [])

  const getMultiSelectLabel = useCallback(
    (values: string[], options: { value: string; label: string }[]) => {
      if (values.length === 0) return null
      if (values.length === 1) return options.find(o => o.value === values[0])?.label ?? null
      return `${values.length} seleccionados`
    },
    [],
  )

  // Columns — memoized
  const columns = useMemo<ColumnDef<StockCountRow>[]>(
    () => [
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => (
          <div className="text-sm">
            {format(new Date(row.original.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}
          </div>
        ),
      },
      {
        id: 'type',
        accessorKey: 'type',
        header: 'Tipo',
        cell: ({ row }) => (
          <Badge variant="outline" className="font-normal">
            {getStockCountTypeLabel(row.original.type)}
          </Badge>
        ),
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const badge = getStockCountStatusBadge(row.original.status)
          return (
            <Badge variant={badge.variant} className={badge.className}>
              {badge.label}
            </Badge>
          )
        },
      },
      {
        id: 'itemCount',
        accessorKey: 'itemCount',
        header: 'Artículos',
        cell: ({ row }) => <div className="text-sm">{row.original.itemCount}</div>,
      },
      {
        id: 'createdBy',
        accessorKey: 'createdBy',
        header: 'Creado por',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">{row.original.createdBy ?? '—'}</div>
        ),
      },
      {
        id: 'totalDifference',
        accessorKey: 'totalDifference',
        header: 'Diferencia total',
        cell: ({ row }) => {
          const diff = row.original.totalDifference
          if (diff === 0) {
            return <div className="text-sm text-muted-foreground">0</div>
          }
          const positive = diff > 0
          return (
            <div
              className={`text-sm font-medium ${
                positive ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'
              }`}
            >
              {positive ? '+' : ''}
              {diff}
            </div>
          )
        },
      },
    ],
    [],
  )

  const hasFilters =
    !!debouncedSearch || statusFilter.length > 0 || typeFilter.length > 0 || dateFilter !== null

  const clearAll = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setStatusFilter([])
    setTypeFilter([])
    setDateFilter(null)
  }

  // Loading / empty guards
  if (!venue) return null

  const sourceIsEmpty = !isLoading && counts.length === 0

  return (
    <div className="p-6 space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteos de inventario</h1>
          <p className="text-muted-foreground">
            Historial de auditoría de los conteos realizados en tus ubicaciones.
          </p>
        </div>
      </div>

      {/* Info banner — explains this is read-only */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Los conteos de inventario se crean desde la app móvil de Avoqado. Desde aquí puedes
          revisar el historial para auditoría.
        </AlertDescription>
      </Alert>

      {/* Filters row */}
      {!sourceIsEmpty && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Expandable search */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por ID, autor o nota"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape' && !searchTerm) setIsSearchOpen(false)
                    }}
                    className="h-8 w-[240px] pl-8 pr-8 text-sm rounded-full"
                    autoFocus
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
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
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Type filter */}
          <FilterPill
            label="Tipo"
            activeValue={getMultiSelectLabel(typeFilter, typeOptions)}
            isActive={typeFilter.length > 0}
            onClear={() => setTypeFilter([])}
          >
            <CheckboxFilterContent
              title="Tipo"
              options={typeOptions}
              selectedValues={typeFilter}
              onApply={values => setTypeFilter(values as StockCountType[])}
            />
          </FilterPill>

          {/* Status filter */}
          <FilterPill
            label="Estado"
            activeValue={getMultiSelectLabel(statusFilter, statusOptions)}
            isActive={statusFilter.length > 0}
            onClear={() => setStatusFilter([])}
          >
            <CheckboxFilterContent
              title="Estado"
              options={statusOptions}
              selectedValues={statusFilter}
              onApply={values => setStatusFilter(values as StockCountStatus[])}
            />
          </FilterPill>

          {/* Date filter */}
          <FilterPill
            label="Fecha"
            activeValue={getDateFilterLabel(dateFilter)}
            isActive={dateFilter !== null}
            onClear={() => setDateFilter(null)}
          >
            <DateFilterContent title="Filtrar por fecha" currentFilter={dateFilter} onApply={setDateFilter} />
          </FilterPill>

          {hasFilters && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Limpiar filtros
            </Button>
          )}
        </div>
      )}

      {/* Table or empty state */}
      {sourceIsEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Aún no hay conteos</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Los conteos de inventario se realizan desde la app móvil de Avoqado. Cuando tu equipo
            haga un conteo, aparecerá aquí para que puedas auditarlo.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Inventario → Conteos en la app móvil</span>
          </div>
        </div>
      ) : (
        <DataTable<StockCountRow>
          columns={columns}
          data={filteredCounts}
          rowCount={filteredCounts.length}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  )
}
