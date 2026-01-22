import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import DataTable from '@/components/data-table'

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilterPill, CheckboxFilterContent, AmountFilterContent, type AmountFilter } from '@/components/filters'
import { YieldStatusHoverCard } from './components/YieldStatusHoverCard'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { getProducts } from '@/services/menu.service'
import { productInventoryApi as inventoryApi } from '@/services/inventory.service'
import { supplierService, type Supplier } from '@/services/supplier.service'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { AlertTriangle, ChevronDown, Download, MoreHorizontal, Plus, Search, Star, Upload, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { useToast } from '@/hooks/use-toast'
import { useDebounce } from '@/hooks/useDebounce'

// Type for product data
interface InventoryProduct {
  id: string
  name: string
  sku?: string | null
  price: number | string
  cost?: number | string | null
  trackInventory: boolean
  inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
  availableQuantity?: number | string | null
  inventory?: {
    minimumStock?: number | null
  } | null
}

export default function InventorySummary() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Search state - expandable pattern
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Filter state - array for multi-select pattern
  const [stockFilter, setStockFilter] = useState<string[]>([])
  const [disponibleFilter, setDisponibleFilter] = useState<string[]>([])
  const [priceFilter, setPriceFilter] = useState<AmountFilter | null>(null)
  const [activeTab, setActiveTab] = useState('physical')

  // Fetch real products with inventory data
  const { data: products, isLoading } = useQuery({
    queryKey: ['products', venueId, 'inventory-summary'],
    queryFn: () => getProducts(venueId!),
    enabled: !!venueId,
  })

  // Stock Adjustment Mutation
  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      type,
      quantity,
      reason,
      unitCost,
      supplier,
    }: {
      productId: string
      type: string
      quantity: number
      reason?: string
      unitCost?: number
      supplier?: string
    }) => {
      // Map frontend actions to backend enum types
      // Backend expects: 'PURCHASE' | 'SALE' | 'ADJUSTMENT' | 'LOSS' | 'TRANSFER' | 'COUNT'
      let apiType = type
      let finalQuantity = quantity

      if (type === 'RECEIVE' || type === 'RETURN') {
        apiType = 'PURCHASE' // Adds stock
        finalQuantity = Math.abs(quantity) // Ensure positive
      }

      if (type === 'DAMAGE' || type === 'THEFT') {
        apiType = 'LOSS' // Removes stock
        finalQuantity = -Math.abs(quantity) // Ensure negative
      }

      const reasonMap: Record<string, string> = {
        RECEIVE: 'Stock Received',
        COUNT: 'Physical Count',
        DAMAGE: 'Damaged Goods',
        THEFT: 'Theft / Stolen',
        LOSS: 'Lost Inventory',
        RETURN: 'Customer Return',
      }

      return await inventoryApi.adjustStock(venueId!, productId, {
        type: apiType as any,
        quantity: finalQuantity,
        reason: reasonMap[reason || type] || 'Manual Adjustment',
        unitCost,
        supplier,
      })
    },
    onSuccess: () => {
      toast({ title: 'Stock actualizado correctamente' })
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onError: () => {
      toast({ title: 'Error al actualizar stock', description: 'Inténtalo de nuevo', variant: 'destructive' })
    },
  })

  // Stock filter options
  const stockFilterOptions = useMemo(() => [{ value: 'low_stock', label: '⚠️ Stock Bajo' }], [])

  // Disponible (available quantity) filter options
  const disponibleFilterOptions = useMemo(
    () => [
      { value: 'sin_stock', label: 'Sin stock (0)' },
      { value: '1_10', label: '1 - 10' },
      { value: '11_50', label: '11 - 50' },
      { value: '50_plus', label: '50+' },
    ],
    [],
  )

  // Helper for filter display label
  const getFilterDisplayLabel = (selectedValues: string[], options: { value: string; label: string }[]): string | undefined => {
    if (selectedValues.length === 0) return undefined
    if (selectedValues.length === 1) {
      return options.find(o => o.value === selectedValues[0])?.label
    }
    return `${selectedValues.length} seleccionados`
  }

  // Helper for price filter display label
  const getPriceFilterLabel = (filter: AmountFilter | null): string | undefined => {
    if (!filter || filter.value === null) return undefined
    const operators: Record<string, string> = {
      gt: '>',
      lt: '<',
      eq: '=',
      between: '',
    }
    if (filter.operator === 'between' && filter.value2 !== undefined) {
      return `$${filter.value} - $${filter.value2}`
    }
    return `${operators[filter.operator]} $${filter.value}`
  }

  // Filter products
  const filteredProducts = useMemo(() => {
    return (
      products?.filter((product: InventoryProduct) => {
        // 1. Search Filter (debounced)
        const matchesSearch =
          product.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
          (product.sku?.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ?? false)

        // 2. Stock Status Filter (array-based)
        let matchesStockFilter = true
        const stock = Number(product.availableQuantity || 0)
        const minStock = Number(product.inventory?.minimumStock || 0)

        if (stockFilter.includes('low_stock')) {
          matchesStockFilter = product.trackInventory && stock <= minStock
        }

        // 3. Disponible (available quantity) Filter
        let matchesDisponibleFilter = true
        if (disponibleFilter.length > 0) {
          matchesDisponibleFilter = disponibleFilter.some(filter => {
            if (filter === 'sin_stock') return stock === 0
            if (filter === '1_10') return stock >= 1 && stock <= 10
            if (filter === '11_50') return stock >= 11 && stock <= 50
            if (filter === '50_plus') return stock > 50
            return true
          })
        }

        // 4. Price Filter
        let matchesPriceFilter = true
        const price = Number(product.price || 0)
        if (priceFilter && priceFilter.value !== null) {
          switch (priceFilter.operator) {
            case 'gt':
              matchesPriceFilter = price > priceFilter.value
              break
            case 'lt':
              matchesPriceFilter = price < priceFilter.value
              break
            case 'eq':
              matchesPriceFilter = price === priceFilter.value
              break
            case 'between':
              matchesPriceFilter = price >= priceFilter.value && price <= (priceFilter.value2 ?? priceFilter.value)
              break
          }
        }

        return matchesSearch && matchesStockFilter && matchesDisponibleFilter && matchesPriceFilter
      }) || []
    )
  }, [products, debouncedSearchTerm, stockFilter, disponibleFilter, priceFilter])

  // Split into physical (countable) and recipe (calculated)
  const physicalItems = useMemo(
    () => filteredProducts.filter((p: InventoryProduct) => p.inventoryMethod === 'QUANTITY' || (!p.inventoryMethod && p.trackInventory)),
    [filteredProducts],
  )

  const recipeItems = useMemo(() => filteredProducts.filter((p: InventoryProduct) => p.inventoryMethod === 'RECIPE'), [filteredProducts])

  // Column definitions for physical items
  const physicalColumns = useMemo<ColumnDef<InventoryProduct>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Artículo',
        cell: ({ row }) => {
          const item = row.original
          const stock = Number(item.availableQuantity || 0)
          const minStock = Number(item.inventory?.minimumStock || 0)
          const isLowStock = item.trackInventory && stock <= minStock

          return (
            <div className="flex flex-col">
              <span className="font-medium">{item.name}</span>
              {isLowStock && (
                <span className="text-xs text-amber-600 flex items-center font-semibold mt-1">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Stock Bajo
                </span>
              )}
            </div>
          )
        },
        size: 300,
      },
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku || '-'}</span>,
      },
      {
        id: 'disponible',
        header: 'Disponible',
        cell: ({ row }) => {
          const item = row.original
          const stock = Number(item.availableQuantity || 0)
          const minStock = Number(item.inventory?.minimumStock || 0)
          const isLowStock = item.trackInventory && stock <= minStock

          return item.trackInventory ? (
            <Badge variant={isLowStock ? 'destructive' : 'secondary'} className="min-w-[60px] justify-center">
              {stock}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-sm italic">No rastreado</span>
          )
        },
      },
      {
        id: 'minimo',
        header: 'Mínimo',
        cell: ({ row }) => {
          const item = row.original
          const minStock = Number(item.inventory?.minimumStock || 0)
          return item.trackInventory ? minStock : '-'
        },
      },
      {
        id: 'confirmado',
        header: () => (
          <div className="flex items-center gap-1 cursor-help">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="border-b border-dotted border-muted-foreground/50">Confirmado</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">
                    Función disponible para Ingredientes (no productos terminados). Los productos terminados no se compran directamente -
                    solo se compran sus ingredientes.
                  </p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        cell: () => (
          <Badge variant="secondary" className="min-w-[60px] justify-center bg-muted/50">
            0
          </Badge>
        ),
      },
      {
        id: 'existencias',
        header: 'Existencias físicas',
        cell: ({ row }) => {
          const item = row.original
          const stock = Number(item.availableQuantity || 0)

          return item.trackInventory ? (
            <StockEditPopover
              productId={item.id}
              currentStock={stock}
              defaultUnitCost={Number(item.cost) || undefined}
              onSave={(type, quantity, reason, unitCost, supplier) =>
                adjustStockMutation.mutate({ productId: item.id, type, quantity, reason, unitCost, supplier })
              }
            />
          ) : (
            '-'
          )
        },
      },
      {
        accessorKey: 'price',
        header: () => <span className="block text-right">Precio</span>,
        cell: ({ row }) => <span className="block text-right">${Number(row.original.price).toFixed(2)}</span>,
      },
      {
        id: 'actions',
        header: '',
        cell: () => (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0">
                <span className="sr-only">Abrir menú</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem disabled>
                <Star className="mr-2 h-4 w-4 text-blue-500" />
                <div className="flex flex-col">
                  <span>Crear orden de compra</span>
                  <span className="text-xs text-muted-foreground">(Próximamente)</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <div className="flex flex-col">
                  <span>Editar aviso de existencias bajas</span>
                  <span className="text-xs text-muted-foreground">(Próximamente)</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ),
        size: 50,
      },
    ],
    [adjustStockMutation],
  )

  // Column definitions for recipe items
  const recipeColumns = useMemo<ColumnDef<InventoryProduct>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Artículo',
        cell: ({ row }) => {
          const item = row.original
          const stock = Number(item.availableQuantity || 0)
          const minStock = Number(item.inventory?.minimumStock || 0)
          const isLowStock = item.trackInventory && stock <= minStock

          return (
            <div className="flex flex-col">
              <span className="font-medium">{item.name}</span>
              {isLowStock && (
                <span className="text-xs text-amber-600 flex items-center font-semibold mt-1">
                  <AlertTriangle className="w-3 h-3 mr-1" /> Stock Bajo
                </span>
              )}
            </div>
          )
        },
        size: 300,
      },
      {
        accessorKey: 'sku',
        header: 'SKU',
        cell: ({ row }) => <span className="text-muted-foreground">{row.original.sku || '-'}</span>,
      },
      {
        id: 'disponibleTeorico',
        header: () => (
          <div className="flex items-center gap-1 cursor-help">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className="border-b border-dotted border-muted-foreground/50">Disponible (Teórico)</span>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">Calculado automáticamente basado en el ingrediente con menor inventario disponible.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
        ),
        cell: ({ row }) => {
          const stock = Number(row.original.availableQuantity || 0)
          return <YieldStatusHoverCard productId={row.original.id} currentYield={stock} />
        },
      },
      {
        accessorKey: 'price',
        header: () => <span className="block text-right">Precio</span>,
        cell: ({ row }) => <span className="block text-right">${Number(row.original.price).toFixed(2)}</span>,
      },
    ],
    [],
  )

  // Count active filters for reset button
  const activeFiltersCount = (searchTerm ? 1 : 0) + stockFilter.length + disponibleFilter.length + (priceFilter ? 1 : 0)

  return (
    <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Header: Tabs (left) + Actions (right) */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
          <TabsTrigger
            value="physical"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <span>Artículos Contables</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {physicalItems.length}
            </span>
          </TabsTrigger>
          <TabsTrigger
            value="recipes"
            className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
          >
            <span>Basados en Receta</span>
            <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
              {recipeItems.length}
            </span>
          </TabsTrigger>
        </TabsList>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Upload className="mr-2 h-4 w-4" /> Importar
          </Button>
          <Button variant="outline" size="sm">
            <Download className="mr-2 h-4 w-4" /> Exportar
          </Button>
          <Button size="sm" onClick={() => navigate('create')}>
            <Plus className="mr-2 h-4 w-4" /> Crear Artículo
          </Button>
        </div>
      </div>

      {/* Stripe-style Filter Bar */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-3 mt-3">
        {/* Expandable Search Icon */}
        <div className="relative flex items-center">
          {isSearchOpen ? (
            <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nombre o SKU..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Escape') {
                      if (!searchTerm) setIsSearchOpen(false)
                    }
                  }}
                  className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
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
              {searchTerm && <span className="sr-only">Búsqueda activa</span>}
            </Button>
          )}
          {/* Active search indicator dot */}
          {searchTerm && !isSearchOpen && <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />}
        </div>

        {/* Stock Filter Pill */}
        <FilterPill
          label="Estado"
          activeValue={getFilterDisplayLabel(stockFilter, stockFilterOptions)}
          isActive={stockFilter.length > 0}
          onClear={() => setStockFilter([])}
        >
          <CheckboxFilterContent
            title="Filtrar por: estado de stock"
            options={stockFilterOptions}
            selectedValues={stockFilter}
            onApply={setStockFilter}
          />
        </FilterPill>

        {/* Disponible Filter Pill */}
        <FilterPill
          label="Disponible"
          activeValue={getFilterDisplayLabel(disponibleFilter, disponibleFilterOptions)}
          isActive={disponibleFilter.length > 0}
          onClear={() => setDisponibleFilter([])}
        >
          <CheckboxFilterContent
            title="Filtrar por: cantidad disponible"
            options={disponibleFilterOptions}
            selectedValues={disponibleFilter}
            onApply={setDisponibleFilter}
          />
        </FilterPill>

        {/* Precio Filter Pill */}
        <FilterPill
          label="Precio"
          activeValue={getPriceFilterLabel(priceFilter)}
          isActive={!!priceFilter}
          onClear={() => setPriceFilter(null)}
        >
          <AmountFilterContent title="Filtrar por: precio" currentFilter={priceFilter} onApply={setPriceFilter} currency="$" />
        </FilterPill>

        {/* Reset Filters Button */}
        {activeFiltersCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearchTerm('')
              setStockFilter([])
              setDisponibleFilter([])
              setPriceFilter(null)
              setIsSearchOpen(false)
            }}
            className="h-8 gap-1.5 rounded-full bg-background dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black"
          >
            <X className="h-3.5 w-3.5" />
            Borrar filtros
          </Button>
        )}
      </div>

      <TabsContent value="physical" className="mt-0">
        <DataTable
          data={physicalItems}
          rowCount={physicalItems.length}
          columns={physicalColumns}
          isLoading={isLoading}
          enableSearch={false}
          showColumnCustomizer={false}
          tableId="inventory:physical"
        />
      </TabsContent>
      <TabsContent value="recipes" className="mt-0">
        <DataTable
          data={recipeItems}
          rowCount={recipeItems.length}
          columns={recipeColumns}
          isLoading={isLoading}
          enableSearch={false}
          showColumnCustomizer={false}
          tableId="inventory:recipes"
        />
      </TabsContent>
    </Tabs>
  )
}

function StockEditPopover({
  productId,
  currentStock,
  defaultUnitCost,
  onSave,
}: {
  productId: string
  currentStock: number
  defaultUnitCost?: number
  onSave: (type: any, qty: number, reason?: string, unitCost?: number, supplier?: string) => void
}) {
  const { venueId } = useCurrentVenue()
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState<'RECEIVE' | 'COUNT' | 'LOSS' | 'DAMAGE' | 'THEFT' | 'RETURN'>('RECEIVE')
  const [amount, setAmount] = useState<string>('')
  const [unitCost, setUnitCost] = useState(defaultUnitCost?.toString() || '')
  const [supplierId, setSupplierId] = useState('')

  // Fetch suppliers for the venue
  const { data: suppliersResponse } = useQuery({
    queryKey: ['suppliers', venueId],
    queryFn: () => supplierService.getSuppliers(venueId!),
    enabled: !!venueId && open,
  })

  // Extract suppliers array from response (API returns { data: [...] })
  const suppliers: Supplier[] = Array.isArray(suppliersResponse)
    ? suppliersResponse
    : (suppliersResponse?.data || [])

  // Convert suppliers to SearchableSelect options
  const supplierOptions = useMemo(
    () => suppliers.map(s => ({ value: s.id, label: s.name })),
    [suppliers]
  )

  // Reset to defaults when opening
  const handleOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setAmount('')
      setUnitCost(defaultUnitCost?.toString() || '')
      setSupplierId('')
      setAction('RECEIVE')
    }
    setOpen(isOpen)
  }

  // Silence unused variable warning - productId is used for identification
  void productId

  // Calculate new total for preview
  const numAmount = parseFloat(amount) || 0
  let newTotal = currentStock

  // Add logic
  if (['RECEIVE', 'RETURN'].includes(action)) {
    newTotal += numAmount
  }
  // Subtract logic
  if (['LOSS', 'DAMAGE', 'THEFT'].includes(action)) {
    newTotal -= numAmount
  }
  // Set logic
  if (action === 'COUNT') {
    newTotal = numAmount
  }

  // Check if unitCost is required for this action
  const requiresCost = ['RECEIVE', 'RETURN'].includes(action)
  const parsedUnitCost = unitCost ? parseFloat(unitCost) : undefined

  // For COUNT: allow 0 or any positive value. For others: require positive value
  const isValidAmount = action === 'COUNT'
    ? amount !== '' && !isNaN(numAmount) && numAmount >= 0
    : amount !== '' && numAmount > 0
  const canSave = isValidAmount && (!requiresCost || parsedUnitCost !== undefined)

  const handleSave = () => {
    const qty = parseFloat(amount)
    if (isNaN(qty)) return
    if (requiresCost && !parsedUnitCost) return

    // Get supplier name from selected ID
    const selectedSupplier = suppliers.find(s => s.id === supplierId)
    const supplierName = selectedSupplier?.name || undefined

    // For COUNT: calculate delta (newTotal - currentStock) since backend treats quantity as delta
    // For other actions: send the quantity as-is (already represents delta)
    const finalQty = action === 'COUNT' ? qty - currentStock : qty

    onSave(action, finalQty, action, parsedUnitCost, supplierName)
    handleOpenChange(false)
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 w-20 justify-between">
          {currentStock}
          <ChevronDown className="h-3 w-3 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-4">
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Acción de existencias</Label>
            <Select value={action} onValueChange={(v: any) => setAction(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RECEIVE">Existencias recibidas</SelectItem>
                <SelectItem value="COUNT">Recuento de inventario</SelectItem>
                <SelectItem value="DAMAGE">Daño</SelectItem>
                <SelectItem value="THEFT">Robo</SelectItem>
                <SelectItem value="LOSS">Pérdida</SelectItem>
                <SelectItem value="RETURN">Devolución de existencias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Existencias disponibles</span>
            <span className="font-medium">{currentStock}</span>
          </div>

          <div className="space-y-2">
            <Label>
              {action === 'COUNT'
                ? 'Nuevo total'
                : ['RECEIVE', 'RETURN'].includes(action)
                  ? 'Cantidad a sumar'
                  : 'Cantidad a restar'}
            </Label>
            <Input type="number" className="text-right" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" />
          </div>

          {/* For COUNT: show Diferencia. For others: show Nuevo total */}
          {action === 'COUNT' ? (
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="font-medium">Diferencia</span>
              <span className={`font-bold ${numAmount - currentStock >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {numAmount - currentStock >= 0 ? '+' : ''}{numAmount - currentStock}
              </span>
            </div>
          ) : (
            <div className="flex justify-between text-sm pt-2 border-t">
              <span className="font-medium">Nuevo total</span>
              <span className="font-bold">{newTotal}</span>
            </div>
          )}

          {/* Only show cost/supplier fields for RECEIVE and RETURN */}
          {['RECEIVE', 'RETURN'].includes(action) && (
            <>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Coste unitario <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={unitCost}
                    onChange={e => setUnitCost(e.target.value)}
                    className={!unitCost ? 'border-destructive' : ''}
                  />
                </div>
                <div className="space-y-2">
                  <Label className="flex items-center gap-1">
                    Proveedor <Star className="h-3 w-3 text-blue-500 fill-blue-500" />
                  </Label>
                  <SearchableSelect
                    options={supplierOptions}
                    value={supplierId}
                    onValueChange={setSupplierId}
                    placeholder="Seleccionar..."
                    searchPlaceholder="Buscar proveedor..."
                    emptyMessage="No hay proveedores"
                    searchThreshold={3}
                  />
                </div>
              </div>

              {/* Show total cost when unit cost is provided */}
              {parsedUnitCost && numAmount > 0 && (
                <div className="flex justify-between text-sm pt-2 border-t">
                  <span className="text-muted-foreground">Coste total</span>
                  <span className="font-medium">${(numAmount * parsedUnitCost).toFixed(2)}</span>
                </div>
              )}

              {!unitCost && (
                <p className="text-xs text-destructive">El coste unitario es requerido para {action === 'RETURN' ? 'devoluciones' : 'recepciones'}</p>
              )}
            </>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => handleOpenChange(false)}>
              Cancelar
            </Button>
            <Button size="sm" onClick={handleSave} disabled={!canSave}>
              Guardar
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}
