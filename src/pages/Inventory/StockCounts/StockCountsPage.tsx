import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useInfiniteQuery } from '@tanstack/react-query'
import type { ColumnDef, PaginationState } from '@tanstack/react-table'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, ClipboardList, Info, Search, Smartphone, X } from 'lucide-react'

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
import { includesNormalized } from '@/lib/utils'
import { colorDeDiferencia, diferenciasComoTexto, etiquetaDeUnidad, formatearDiferencia } from './resumen'

/** Tope del servidor: 100. 50 llena la pantalla sin traer de más. */
const PAGE_SIZE = 50

/**
 * Stock Count History — READ-ONLY audit view.
 *
 * Stock counts are created from the Avoqado mobile POS apps. The dashboard
 * only lets managers and accountants review the history. No create/edit/delete.
 */
export default function StockCountsPage() {
  const navigate = useNavigate()
  const { t, i18n } = useTranslation('inventory')
  const locale = i18n.language
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [statusFilter, setStatusFilter] = useState<StockCountStatus[]>([])
  const [typeFilter, setTypeFilter] = useState<StockCountType[]>([])
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const debouncedSearch = useDebounce(searchTerm, 300)

  // Paginación del SERVIDOR (tope 100 impuesto allá): cada «Cargar más» añade una
  // página. El buscador y el filtro de fecha siguen siendo locales, sobre las
  // filas ya cargadas (declarado: con 2-10 conteos por negocio hoy, no hay
  // caso que lo justifique aún).
  const query = useInfiniteQuery({
    queryKey: ['stock-counts', venueId, statusFilter, typeFilter],
    queryFn: ({ pageParam }) =>
      stockCountService.list(venueId!, {
        status: statusFilter.length === 1 ? statusFilter[0] : undefined,
        type: typeFilter.length === 1 ? typeFilter[0] : undefined,
        page: pageParam,
        pageSize: PAGE_SIZE,
      }),
    initialPageParam: 1,
    getNextPageParam: last => (last.pagination.page < last.pagination.totalPages ? last.pagination.page + 1 : undefined),
    enabled: !!venueId,
  })
  const isLoading = query.isLoading
  const counts = useMemo<StockCountRow[]>(() => query.data?.pages.flatMap(p => p.data) ?? [], [query.data])
  const total = query.data?.pages[0]?.pagination.total ?? 0

  // 🔴 La página la manda el servidor, así que la tabla NO debe volver a rebanar las
  // filas: `DataTable` pagina por dentro a 20 y, con `hidePagination`, de la 21 en
  // adelante no habría un solo control para alcanzarlas — desaparecerían en silencio
  // mientras el pie dice «Mostrando 50 de 51». Pasar `pagination` + `setPagination`
  // enciende `manualPagination`, que es lo que apaga ese rebanado.
  const [tablePagination, setTablePagination] = useState<PaginationState>({ pageIndex: 0, pageSize: PAGE_SIZE })

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
      result = result.filter(
        c =>
          includesNormalized(c.id ?? '', debouncedSearch) ||
          includesNormalized(c.createdBy ?? '', debouncedSearch) ||
          includesNormalized(c.note ?? '', debouncedSearch),
      )
    }

    if (dateFilter) {
      const now = new Date()
      result = result.filter(c => {
        const created = new Date(c.createdAt)
        switch (dateFilter.operator) {
          case 'last': {
            const value = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt((dateFilter.value as string) || '0', 10)
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
      { value: 'CANCELLED', label: 'Cancelado' },
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

  const getMultiSelectLabel = useCallback((values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) return options.find(o => o.value === values[0])?.label ?? null
    return `${values.length} seleccionados`
  }, [])

  // Columns — memoized
  const columns = useMemo<ColumnDef<StockCountRow>[]>(
    () => [
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: 'Fecha',
        cell: ({ row }) => <div className="text-sm">{format(new Date(row.original.createdAt), 'dd MMM yyyy, HH:mm', { locale: es })}</div>,
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
        cell: ({ row }) => <div className="text-sm text-muted-foreground">{row.original.createdBy ?? '—'}</div>,
      },
      {
        id: 'counted',
        accessorFn: row => row.summary?.countedCount ?? 0,
        header: t('stockCounts.counted'),
        cell: ({ row }) => (
          <div className="text-sm text-muted-foreground">
            {t('stockCounts.countedOf', {
              counted: row.original.summary?.countedCount ?? 0,
              // El servidor viejo no manda `summary` pero sí `itemCount`: el total sigue siendo cierto.
              total: row.original.summary?.itemCount ?? row.original.itemCount,
            })}
          </div>
        ),
      },
      {
        // 🔴 Una sola cifra mezclaría gramos con piezas. La diferencia va POR UNIDAD,
        // y sin nada contado se DICE «Sin contar» — nunca un número que nadie capturó
        // (la captura de Mindform: 137 líneas, 0 contadas, «−6968054.084» en pantalla).
        //
        // 🔴 Y el `?.` de aquí y de la columna de arriba no es paranoia: `summary` lo
        // ESTRENA el servidor de este mismo cambio. Dashboard y servidor despliegan en
        // minutos, pero nada garantiza el orden — si el dashboard sale primero, una fila
        // sin `summary` reventaría la LISTA ENTERA en vez de degradar una columna. El
        // tipo se queda obligatorio a propósito: la respuesta futura sí lo trae siempre.
        id: 'difference',
        accessorFn: row => (row.summary?.differenceByUnit ?? []).map(d => d.difference).join(','),
        header: t('stockCounts.difference'),
        cell: ({ row }) => {
          const s = row.original.summary
          if (!s || s.countedCount === 0) {
            return <div className="text-sm text-muted-foreground">{t('stockCounts.notCounted')}</div>
          }
          return (
            <div className="flex flex-wrap gap-x-2 text-sm" title={diferenciasComoTexto(s, t, locale)}>
              {s.differenceByUnit.map(d => (
                <span key={d.unit} className={colorDeDiferencia(d.difference)}>
                  {formatearDiferencia(d.difference, locale)} {etiquetaDeUnidad(t, d.unit)}
                </span>
              ))}
            </div>
          )
        },
      },
    ],
    [t, locale],
  )

  const hasFilters = !!debouncedSearch || statusFilter.length > 0 || typeFilter.length > 0 || dateFilter !== null

  const clearAll = () => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setStatusFilter([])
    setTypeFilter([])
    setDateFilter(null)
  }

  // Loading / empty guards
  if (!venue) return null

  // 🔴 Un fallo de red NO es «aún no hay conteos». Con la lista vacía por un 500 el
  // estado vacío le afirmaba al dueño que su equipo nunca ha contado nada — el reporte
  // falso que prohíbe `testing-and-git.md` §3. Se dice que falló y se ofrece reintentar.
  // Cuando YA hay filas cargadas y falla una página siguiente, la tabla se queda (esas
  // filas existen) y «Cargar más» es el reintento.
  const loadFailed = query.isError && counts.length === 0
  const sourceIsEmpty = !isLoading && !loadFailed && counts.length === 0

  return (
    <div className="p-6 space-y-3">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conteos de inventario</h1>
          <p className="text-muted-foreground">Historial de auditoría de los conteos realizados en tus ubicaciones.</p>
        </div>
      </div>

      {/* Info banner — explains this is read-only */}
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          Los conteos de inventario se crean desde la app móvil de Avoqado. Desde aquí puedes revisar el historial para auditoría.
        </AlertDescription>
      </Alert>

      {/* Filters row */}
      {!sourceIsEmpty && !loadFailed && (
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

      {/* Error / empty state / table */}
      {loadFailed ? (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-lg border border-dashed border-destructive/40 bg-muted/30 py-16 px-6 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="h-6 w-6 text-destructive" />
          </div>
          <h3 className="mt-4 text-lg font-semibold text-destructive">{t('stockCounts.loadError')}</h3>
          <Button variant="outline" size="sm" className="mt-4" onClick={() => void query.refetch()}>
            {t('stockCounts.retry')}
          </Button>
        </div>
      ) : sourceIsEmpty ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed bg-muted/30 py-16 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <ClipboardList className="h-6 w-6 text-muted-foreground" />
          </div>
          <h3 className="mt-4 text-lg font-semibold">Aún no hay conteos</h3>
          <p className="mt-2 max-w-md text-sm text-muted-foreground">
            Los conteos de inventario se realizan desde la app móvil de Avoqado. Cuando tu equipo haga un conteo, aparecerá aquí para que
            puedas auditarlo.
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
          pagination={tablePagination}
          setPagination={setTablePagination}
          hidePagination
          footer={
            <div className="flex items-center justify-between px-4 py-3 text-sm text-muted-foreground">
              <span>{t('stockCounts.showing', { shown: counts.length, total })}</span>
              {query.hasNextPage && (
                <Button variant="outline" size="sm" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
                  {t('stockCounts.loadMore')}
                </Button>
              )}
            </div>
          }
        />
      )}
    </div>
  )
}
