import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import type { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { ArrowRight, Info, Search, Smartphone, Truck, X } from 'lucide-react'

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
  getTransferStatusBadge,
  inventoryTransferService,
  type InventoryTransferRow,
  type TransferStatus,
} from '@/services/inventoryTransfer.service'
import { includesNormalized } from '@/lib/utils'

/**
 * Inventory Transfer History — READ-ONLY audit view.
 *
 * Transfers are created from the Avoqado mobile POS apps. The dashboard
 * only lets managers and accountants review the history.
 */
export default function TransfersPage() {
  const navigate = useNavigate()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<TransferStatus[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  const { data, isLoading } = useQuery({
    queryKey: ['inventory-transfers', venueId, statusFilter],
    queryFn: () =>
      inventoryTransferService.list(venueId!, {
        status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        pageSize: 200,
      }),
    enabled: !!venueId,
  })

  const transfers = useMemo<InventoryTransferRow[]>(() => data?.data ?? [], [data])

  const filteredTransfers = useMemo(() => {
    let result = transfers

    if (statusFilter.length > 0) {
      result = result.filter(t => statusFilter.includes(t.status))
    }

    if (debouncedSearch) {
      result = result.filter(
        t =>
          includesNormalized(t.fromLocationName ?? '', debouncedSearch) ||
          includesNormalized(t.toLocationName ?? '', debouncedSearch) ||
          includesNormalized(t.createdByName ?? '', debouncedSearch) ||
          includesNormalized(t.notes ?? '', debouncedSearch),
      )
    }

    if (dateFilter) {
      const now = new Date()
      result = result.filter(t => {
        const created = new Date(t.createdAt)
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
  }, [transfers, statusFilter, debouncedSearch, dateFilter])

  const handleRowClick = useCallback(
    (row: InventoryTransferRow) => {
      navigate(`${fullBasePath}/inventory/transfers/${row.id}`)
    },
    [navigate, fullBasePath],
  )

  const statusOptions = useMemo(
    () => [
      { value: 'DRAFT', label: 'Borrador' },
      { value: 'IN_TRANSIT', label: 'En tránsito' },
      { value: 'COMPLETED', label: 'Completada' },
      { value: 'CANCELLED', label: 'Cancelada' },
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

  const columns = useMemo<ColumnDef<InventoryTransferRow>[]>(
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
        id: 'route',
        header: 'Origen → Destino',
        cell: ({ row }) => (
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{row.original.fromLocationName}</span>
            <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="font-medium">{row.original.toLocationName}</span>
          </div>
        ),
      },
      {
        id: 'itemCount',
        accessorKey: 'itemCount',
        header: 'Artículos',
        cell: ({ row }) => <div className="text-sm">{row.original.itemCount}</div>,
      },
      {
        id: 'status',
        accessorKey: 'status',
        header: 'Estado',
        cell: ({ row }) => {
          const badge = getTransferStatusBadge(row.original.status)
          return (
            <Badge variant={badge.variant} className={badge.className}>
              {badge.label}
            </Badge>
          )
        },
      },
      {
        id: 'createdByName',
        accessorKey: 'createdByName',
        header: 'Creado por',
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">{row.original.createdByName ?? '—'}</div>
        ),
      },
    ],
    [],
  )

  const hasFilters = !!debouncedSearch || statusFilter.length > 0 || dateFilter !== null

  const clearAll = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setStatusFilter([])
    setDateFilter(null)
  }

  if (!venue) return null

  const sourceIsEmpty = !isLoading && transfers.length === 0

  return (
    <div className="p-6 space-y-3">
      <div>
        <h1 className="text-2xl font-bold">Transferencias de inventario</h1>
        <p className="text-muted-foreground">
          Historial de auditoría de transferencias entre ubicaciones.
        </p>
      </div>

      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Las transferencias se crean desde la app móvil de Avoqado. Desde aquí puedes revisar el
          historial para auditoría.
        </AlertDescription>
      </Alert>

      {!sourceIsEmpty && (
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar ubicación o autor"
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
              onApply={values => setStatusFilter(values as TransferStatus[])}
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

      {sourceIsEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Truck className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Aún no hay transferencias</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Las transferencias de inventario se crean desde la app móvil de Avoqado. Cuando tu
            equipo haga una transferencia, aparecerá aquí para que puedas auditarla.
          </p>
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Smartphone className="h-4 w-4" />
            <span>Inventario → Transferencias en la app móvil</span>
          </div>
        </div>
      ) : (
        <DataTable<InventoryTransferRow>
          columns={columns}
          data={filteredTransfers}
          rowCount={filteredTransfers.length}
          isLoading={isLoading}
          onRowClick={handleRowClick}
        />
      )}
    </div>
  )
}
