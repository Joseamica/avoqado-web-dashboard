import DataTable from '@/components/data-table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Skeleton } from '@/components/ui/skeleton'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { inventoryHistoryApi, GlobalInventoryMovement } from '@/services/inventory.service'
import { useQuery } from '@tanstack/react-query'
import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { ArrowDown, ArrowUp, Search, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'
import { AmountFilterContent, DateFilterContent, type AmountFilter, type DateFilter } from '@/components/filters'
import { Currency } from '@/utils/currency'

/**
 * Translate common inventory adjustment reasons from English to Spanish
 * Handles both seed data and user-generated reasons
 */
function translateReason(reason: string | null | undefined): string {
  if (!reason) return ''
  
  // Common translations mapping (short, concise labels)
  const translations: Record<string, string> = {
    // Seed data
    'Stock inicial - Seed data': 'stock inicial',
    'Stock inicial - Demo venue': 'stock inicial',
    'Stock inicial': 'stock inicial',

    // User-generated reasons (common patterns)
    'Stock Received': 'recibido',
    'Damaged Goods': 'dañado',
    'Lost Inventory': 'pérdida',
    'Manual adjustment from Inventory Summary': 'ajuste manual',
    'adjustment': 'ajuste',
    'ADJUSTMENT': 'ajuste',
    'Adjustment': 'ajuste',

    // Movement types
    'PURCHASE': 'recibido',
    'COUNT': 'reconteo',
    'LOSS': 'pérdida',
    'USAGE': 'uso',

    // Other common reasons
    'theft': 'robo',
    'spoilage': 'desperdicio',
    'expired': 'expirado',
    'damaged': 'dañado',
    'lost': 'perdido',
    'returned': 'devuelto',
  }
  
  // Check for exact match first (case-sensitive for proper nouns)
  if (translations[reason]) {
    return translations[reason]
  }
  
  // Check for case-insensitive match
  const lowerReason = reason.toLowerCase()
  const matchedKey = Object.keys(translations).find(key => key.toLowerCase() === lowerReason)
  if (matchedKey) {
    return translations[matchedKey]
  }
  
  // Return original if no translation found
  return reason
}

export default function InventoryHistory() {
  const { t } = useTranslation('inventory')
  const { venueId, venue } = useCurrentVenue()
  const { formatUnitWithQuantity } = useUnitTranslation()

  // Filters State - Multi-select arrays (ordered by column position)
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)
  const [skuFilter, setSkuFilter] = useState<string[]>([])
  const [providerFilter, setProviderFilter] = useState<string[]>([])
  const [totalCostFilter, setTotalCostFilter] = useState<AmountFilter | null>(null)
  const [typeFilter, setTypeFilter] = useState<string[]>([])

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'createdAt',
    'name',
    'sku',
    'provider',
    'totalCost',
    'adjustment',
  ])

  // Fetch History Query
  const { data, isLoading } = useQuery({
    queryKey: ['inventory-history', venueId],
    queryFn: async () => {
      const response = await inventoryHistoryApi.getGlobalMovements(venueId!, {})
      return response.data
    },
    enabled: !!venueId,
  })

  const movements = (data as any)?.data || []

  // Extract unique filter options from data (ordered by column position)
  const typeOptions = useMemo(() => {
    const uniqueTypes = [...new Set(movements.map((m: GlobalInventoryMovement) => m.type))]
    return uniqueTypes.map(type => ({
      value: type as string,
      label: type === 'PURCHASE' ? 'Recibido' : type === 'COUNT' ? 'Reconteo' : type === 'LOSS' ? 'Pérdida' : type === 'USAGE' ? 'Uso' : type === 'ADJUSTMENT' ? 'Ajuste' : type as string,
    }))
  }, [movements])

  const skuOptions = useMemo(() => {
    const uniqueSkus = [...new Set(movements.map((m: any) => m.sku).filter(Boolean))]
    return uniqueSkus.map(sku => ({
      value: sku as string,
      label: sku as string,
    }))
  }, [movements])

  const providerOptions = useMemo(() => {
    const uniqueProviders = [...new Set(movements.map((m: any) => m.supplierName || 'Sin proveedor').filter(Boolean))]
    return uniqueProviders.map(provider => ({
      value: provider as string,
      label: provider as string,
    }))
  }, [movements])

  // Apply filters to data
  const filteredData = useMemo(() => {
    return movements.filter((movement: any) => {
      // Date filter (first - most common)
      if (dateFilter) {
        const movementDate = new Date(movement.createdAt)
        const now = new Date()

        switch (dateFilter.operator) {
          case 'last': {
            const value = typeof dateFilter.value === 'number' ? dateFilter.value : parseInt(dateFilter.value as string) || 0
            const cutoffDate = new Date()
            switch (dateFilter.unit) {
              case 'hours':
                cutoffDate.setHours(now.getHours() - value)
                break
              case 'days':
                cutoffDate.setDate(now.getDate() - value)
                break
              case 'weeks':
                cutoffDate.setDate(now.getDate() - value * 7)
                break
              case 'months':
                cutoffDate.setMonth(now.getMonth() - value)
                break
            }
            if (movementDate < cutoffDate) return false
            break
          }
          case 'before': {
            const targetDate = new Date(dateFilter.value as string)
            if (movementDate >= targetDate) return false
            break
          }
          case 'after': {
            const targetDate = new Date(dateFilter.value as string)
            if (movementDate <= targetDate) return false
            break
          }
          case 'between': {
            const startDate = new Date(dateFilter.value as string)
            const endDate = new Date(dateFilter.value2 as string)
            endDate.setHours(23, 59, 59, 999)
            if (movementDate < startDate || movementDate > endDate) return false
            break
          }
          case 'on': {
            const targetDate = new Date(dateFilter.value as string)
            if (
              movementDate.getFullYear() !== targetDate.getFullYear() ||
              movementDate.getMonth() !== targetDate.getMonth() ||
              movementDate.getDate() !== targetDate.getDate()
            ) {
              return false
            }
            break
          }
        }
      }

      // SKU filter
      if (skuFilter.length > 0) {
        const sku = movement.sku || ''
        if (!skuFilter.includes(sku)) {
          return false
        }
      }

      // Provider filter
      if (providerFilter.length > 0) {
        const supplier = movement.supplierName || 'Sin proveedor'
        if (!providerFilter.includes(supplier)) {
          return false
        }
      }

      // Total cost filter
      if (totalCostFilter) {
        const cost = movement.cost || 0
        switch (totalCostFilter.operator) {
          case 'gt':
            if (cost <= (totalCostFilter.value || 0)) return false
            break
          case 'lt':
            if (cost >= (totalCostFilter.value || 0)) return false
            break
          case 'eq':
            if (cost !== (totalCostFilter.value || 0)) return false
            break
          case 'between':
            if (cost < (totalCostFilter.value || 0) || cost > (totalCostFilter.value2 || 0)) return false
            break
        }
      }

      // Type filter
      if (typeFilter.length > 0 && !typeFilter.includes(movement.type)) {
        return false
      }

      // Search query (name, SKU, GTIN)
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        const productName = (movement.productName || movement.rawMaterialName || '').toLowerCase()
        const sku = (movement.sku || '').toLowerCase()
        const gtin = (movement.gtin || '').toLowerCase()
        if (!productName.includes(query) && !sku.includes(query) && !gtin.includes(query)) {
          return false
        }
      }

      return true
    })
  }, [movements, dateFilter, skuFilter, providerFilter, totalCostFilter, typeFilter, searchQuery])

  // Reset filters
  const resetFilters = () => {
    setDateFilter(null)
    setSkuFilter([])
    setProviderFilter([])
    setTotalCostFilter(null)
    setTypeFilter([])
    setSearchQuery('')
    setIsSearchOpen(false)
  }

  const activeFiltersCount = [
    dateFilter !== null,
    skuFilter.length > 0,
    providerFilter.length > 0,
    totalCostFilter !== null,
    typeFilter.length > 0,
    searchQuery !== '',
  ].filter(Boolean).length

  // Helper to get display label for active filters
  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return null
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return `${values.length} seleccionados`
  }

  // Helper functions for filter labels
  const getAmountFilterLabel = (filter: AmountFilter | null) => {
    if (!filter) return null
    const value = Currency(filter.value || 0)
    switch (filter.operator) {
      case 'gt':
        return `> ${value}`
      case 'lt':
        return `< ${value}`
      case 'eq':
        return `= ${value}`
      case 'between':
        return `${value} - ${Currency(filter.value2 || 0)}`
      default:
        return value
    }
  }

  const getDateFilterLabel = (filter: DateFilter | null) => {
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
  }

  // Table Columns
  const columns = useMemo<ColumnDef<GlobalInventoryMovement, unknown>[]>(
    () => [
      {
        id: 'createdAt',
        accessorKey: 'createdAt',
        header: t('history.date', { defaultValue: 'Fecha' }),
        cell: ({ row }) => (
          <span className="font-semibold underline decoration-dotted underline-offset-4 decoration-muted-foreground/50">
           {format(new Date(row.original.createdAt), 'dd/MM/yy, HH:mm')}
          </span>
        ),
      },
      {
        id: 'name',
        accessorKey: 'name',
        header: t('history.name', { defaultValue: 'Nombre' }),
        cell: ({ row }) => (
          <div>
            <p className="font-medium text-foreground">{row.original.itemName || 'Sin nombre'}</p>
          </div>
        ),
      },
      {
        id: 'sku',
        accessorKey: 'sku',
        header: t('history.sku', { defaultValue: 'SKU' }),
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku || '-'}</span>,
      },
      {
        id: 'provider',
        accessorKey: 'provider',
        header: t('history.provider', { defaultValue: 'Proveedor' }),
        cell: ({ row }) => <span className="text-muted-foreground">{(row.original as any).supplierName || '-'}</span>,
      },
      {
        id: 'totalCost',
        accessorKey: 'totalCost',
        header: t('history.totalCost', { defaultValue: 'Coste total' }),
        cell: ({ row }) => {
            const cost = (row.original as any).cost || 0
            return <span className="font-medium">{cost > 0 ? `$${cost.toFixed(2)}` : '-'}</span>
        },
      },
      {
        id: 'adjustment',
        accessorKey: 'adjustment',
        header: t('history.adjustment', { defaultValue: 'Ajuste' }),
        cell: ({ row }) => {
          const type = row.original.type
          const qty = Math.abs(row.original.previousStock - row.original.newStock) // Or use quantity field

          // Determine arrow direction based on type and stock change
          let isPositive: boolean
          if (type === 'PURCHASE') {
            // Purchases always add to stock
            isPositive = true
          } else if (type === 'LOSS' || type === 'USAGE') {
            // Losses and usage always reduce stock
            isPositive = false
          } else {
            // For COUNT and ADJUSTMENT, check actual stock change
            isPositive = row.original.newStock > row.original.previousStock
          }

          // Priority: Use specific reason from backend, fallback to type-based label
          let reasonLabel = row.original.reason
          if (!reasonLabel) {
            // Only apply generic labels if no specific reason was provided
            if (type === 'COUNT') reasonLabel = 'reconteo'
            else if (type === 'PURCHASE') reasonLabel = 'recibido'
            else if (type === 'LOSS') reasonLabel = 'pérdida'
            else if (type === 'USAGE') reasonLabel = 'uso'
            else if (type === 'ADJUSTMENT') reasonLabel = 'ajuste'
            else reasonLabel = type.toLowerCase()
          } else {
            // Translate the reason to Spanish
            reasonLabel = translateReason(reasonLabel)
          }

          return (
            <div className="flex items-center gap-2">
              {isPositive ? (
                <ArrowUp className="h-4 w-4 text-foreground" />
              ) : (
                <ArrowDown className="h-4 w-4 text-foreground" />
              )}
              <span className="text-muted-foreground">
                {qty} {reasonLabel}
              </span>
            </div>
          )
        },
      },
    ],
    [t, venue?.name],
  )

  // Column options for customizer
  const columnOptions = useMemo(
    () => [
      { id: 'createdAt', label: t('history.date', { defaultValue: 'Fecha' }), visible: visibleColumns.includes('createdAt') },
      { id: 'name', label: t('history.name', { defaultValue: 'Nombre' }), visible: visibleColumns.includes('name') },
      { id: 'sku', label: t('history.sku', { defaultValue: 'SKU' }), visible: visibleColumns.includes('sku') },
      { id: 'provider', label: t('history.provider', { defaultValue: 'Proveedor' }), visible: visibleColumns.includes('provider') },
      { id: 'totalCost', label: t('history.totalCost', { defaultValue: 'Coste total' }), visible: visibleColumns.includes('totalCost') },
      { id: 'adjustment', label: t('history.adjustment', { defaultValue: 'Ajuste' }), visible: visibleColumns.includes('adjustment') },
    ],
    [t, visibleColumns]
  )

  // Filter columns based on visibility
  const filteredColumns = useMemo(
    () => columns.filter(col => visibleColumns.includes(col.id as string)),
    [columns, visibleColumns]
  )

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{t('history.title', { defaultValue: 'Historial' })}</h1>
        <Badge variant="secondary" className="bg-blue-100 text-blue-700 hover:bg-blue-100 p-0 h-5 w-5 flex items-center justify-center rounded-full">
            <span className="text-xs">★</span> 
        </Badge>
      </div>

      {/* Filters & Search */}
      <div className="space-y-4">
        {/* Filters Row */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
          {/* Expandable Search Icon */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Filtrar por artículo, SKU o GTIN"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Escape') {
                        if (!searchQuery) setIsSearchOpen(false)
                      }
                    }}
                    className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
                    autoFocus
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
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
                    setSearchQuery('')
                    setIsSearchOpen(false)
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Button
                variant={searchQuery ? 'secondary' : 'ghost'}
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={() => setIsSearchOpen(true)}
              >
                <Search className="h-4 w-4" />
              </Button>
            )}
            {/* Active search indicator dot */}
            {searchQuery && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
          </div>

          {/* Filter Pills - Ordered by column position */}
          {/* 1. Date (Column 1) */}
          <FilterPill
            label={t('history.date', { defaultValue: 'Fecha' })}
            activeValue={getDateFilterLabel(dateFilter)}
            isActive={dateFilter !== null}
            onClear={() => setDateFilter(null)}
          >
            <DateFilterContent
              value={dateFilter}
              onApply={setDateFilter}
            />
          </FilterPill>

          {/* 2. SKU (Column 3) */}
          <FilterPill
            label={t('history.sku', { defaultValue: 'SKU' })}
            activeValue={getFilterDisplayLabel(skuFilter, skuOptions)}
            isActive={skuFilter.length > 0}
            onClear={() => setSkuFilter([])}
          >
            <CheckboxFilterContent
              title={t('history.sku', { defaultValue: 'SKU' })}
              options={skuOptions}
              selectedValues={skuFilter}
              onApply={setSkuFilter}
              searchable
              searchPlaceholder="Buscar SKU..."
            />
          </FilterPill>

          {/* 3. Provider (Column 4) */}
          <FilterPill
            label={t('history.provider', { defaultValue: 'Proveedor' })}
            activeValue={getFilterDisplayLabel(providerFilter, providerOptions)}
            isActive={providerFilter.length > 0}
            onClear={() => setProviderFilter([])}
          >
            <CheckboxFilterContent
              title={t('history.provider', { defaultValue: 'Proveedor' })}
              options={providerOptions}
              selectedValues={providerFilter}
              onApply={setProviderFilter}
            />
          </FilterPill>

          {/* 4. Total Cost (Column 5) */}
          <FilterPill
            label={t('history.totalCost', { defaultValue: 'Coste total' })}
            activeValue={getAmountFilterLabel(totalCostFilter)}
            isActive={totalCostFilter !== null}
            onClear={() => setTotalCostFilter(null)}
          >
            <AmountFilterContent
              value={totalCostFilter}
              onApply={setTotalCostFilter}
            />
          </FilterPill>

          {/* 5. Type (Adjustment column - last) */}
          <FilterPill
            label={t('history.type', { defaultValue: 'Tipo' })}
            activeValue={getFilterDisplayLabel(typeFilter, typeOptions)}
            isActive={typeFilter.length > 0}
            onClear={() => setTypeFilter([])}
          >
            <CheckboxFilterContent
              title={t('history.type', { defaultValue: 'Tipo' })}
              options={typeOptions}
              selectedValues={typeFilter}
              onApply={setTypeFilter}
            />
          </FilterPill>

          {/* Clear Filters Button */}
          {activeFiltersCount > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="h-8 gap-1.5 rounded-full"
            >
              <X className="h-3.5 w-3.5" />
              {t('filters.reset', { defaultValue: 'Borrar filtros' })}
            </Button>
          )}

          {/* Action Buttons - Right Side */}
          <div className="ml-auto flex items-center gap-2">
            <ColumnCustomizer
              columns={columnOptions}
              onApply={setVisibleColumns}
            />
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="rounded-none border-t border-border mt-6">
        {/* We use standard shadcn table or custom one. Square's table is clean. */}
        {isLoading ? (
            <div className="space-y-4 py-4">
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
                 <Skeleton className="h-10 w-full" />
            </div>
        ) : (
             <DataTable
                columns={filteredColumns}
                data={filteredData}
                rowCount={filteredData.length}
            />
        )}
      </div>
    </div>
  )
}
