import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, ChefHat, Plus, Edit, AlertCircle, DollarSign, RefreshCcw, Search, X } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { type Recipe, productInventoryApi } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { RecipeDialog } from './components/RecipeDialog'
import { CreateRecipeWizard } from './components/CreateRecipeWizard'
import { YieldStatusHoverCard } from './components/YieldStatusHoverCard'
import { SimpleConfirmDialog } from './components/SimpleConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { Input } from '@/components/ui/input'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  active: boolean
  category: {
    id: string
    name: string
  }
  recipe?: Recipe
  inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
}

export default function Recipes() {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const highlightProductId = searchParams.get('productId')

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null)
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // Filter states - Stripe-style multi-select arrays
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [recipeFilter, setRecipeFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name',
    'price',
    'recipeStatus',
    'portionYield',
    'recipeCost',
    'foodCostPercentage',
    'actions',
  ])

  // Fetch products with recipes (fetch all, filter client-side for Stripe-style filters)
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-with-recipes', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: {
          includeRecipe: true,
        },
      })
      return response.data.data as ProductWithRecipe[]
    },
    enabled: !!venueId,
  })

  // Client-side filtering for Stripe-style filters
  const products = useMemo(() => {
    let filtered = productsData || []

    // Apply category filter (multi-select)
    if (categoryFilter.length > 0) {
      filtered = filtered.filter(p => categoryFilter.includes(p.category.id))
    }

    // Apply recipe filter (multi-select)
    if (recipeFilter.length > 0) {
      filtered = filtered.filter(p => {
        if (recipeFilter.includes('withRecipe') && p.recipe) return true
        if (recipeFilter.includes('withoutRecipe') && !p.recipe) return true
        return false
      })
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      const lowerSearch = debouncedSearchTerm.toLowerCase()
      filtered = filtered.filter(
        p => p.name.toLowerCase().includes(lowerSearch) || p.category.name.toLowerCase().includes(lowerSearch),
      )
    }

    return filtered
  }, [productsData, categoryFilter, recipeFilter, debouncedSearchTerm])

  // ✅ Auto-open dialog if productId is active in URL
  useEffect(() => {
    if (highlightProductId && products && !isLoading) {
      const product = products.find(p => p.id === highlightProductId)
      if (product) {
        setSelectedProduct(product)
        if (product.recipe) {
          setEditDialogOpen(true)
        } else {
          setCreateDialogOpen(true)
        }
      }
    }
  }, [highlightProductId, products, isLoading])

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menucategories`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Filter options for category (dynamic from fetched categories)
  const categoryOptions = useMemo(() =>
    (categories || []).map((cat: any) => ({
      value: cat.id,
      label: cat.name,
    })),
    [categories]
  )

  // Filter options for recipe status
  const recipeFilterOptions = useMemo(() => [
    { value: 'withRecipe', label: t('recipes.filters.withRecipe') },
    { value: 'withoutRecipe', label: t('recipes.filters.withoutRecipe') },
  ], [t])

  // Helper to get display label for multi-select filters
  const getFilterDisplayLabel = useCallback((selectedValues: string[], options: { value: string; label: string }[]) => {
    if (selectedValues.length === 0) return null
    if (selectedValues.length === 1) {
      return options.find(o => o.value === selectedValues[0])?.label || null
    }
    return `${selectedValues.length} ${t('rawMaterials.filters.selected', { defaultValue: 'seleccionados' })}`
  }, [t])

  // Count active filters
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchTerm) count++
    if (categoryFilter.length > 0) count++
    if (recipeFilter.length > 0) count++
    return count
  }, [searchTerm, categoryFilter, recipeFilter])

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setCategoryFilter([])
    setRecipeFilter([])
  }, [])

  // Column options for customizer
  const columnOptions = useMemo(() => [
    { id: 'name', label: t('recipes.fields.product'), visible: visibleColumns.includes('name') },
    { id: 'price', label: t('recipes.fields.currentPrice'), visible: visibleColumns.includes('price') },
    { id: 'recipeStatus', label: tCommon('status'), visible: visibleColumns.includes('recipeStatus') },
    { id: 'portionYield', label: t('recipes.fields.portionYield'), visible: visibleColumns.includes('portionYield') },
    { id: 'recipeCost', label: t('recipes.fields.totalCost'), visible: visibleColumns.includes('recipeCost') },
    { id: 'foodCostPercentage', label: t('pricing.fields.foodCostPercentage'), visible: visibleColumns.includes('foodCostPercentage') },
  ], [t, tCommon, visibleColumns])

  // Mutation to switch inventory method
  const switchInventoryMethodMutation = useMutation({
    mutationFn: () => productInventoryApi.switchInventoryMethod(venueId, selectedProduct!.id, 'RECIPE'),
    onSuccess: () => {
      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })

      toast({
        title: t('conversion.toRecipe.success'),
        variant: 'default',
      })

      // Close conversion dialog and open recipe dialog
      setConversionDialogOpen(false)
      setCreateDialogOpen(true)
    },
    onError: (error: any) => {
      toast({
        title: t('conversion.toRecipe.error'),
        description: error.response?.data?.message || 'Failed to switch inventory type',
        variant: 'destructive',
      })
    },
  })

  // Column definitions
  const columns = useMemo<ColumnDef<ProductWithRecipe, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        meta: { label: t('recipes.fields.product') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('recipes.fields.product')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original
          const hasRecipe = !!product.recipe

          return (
            <div className="flex items-center gap-3">
              <div
                className={`flex items-center justify-center w-10 h-10 rounded-lg border border-border shadow-sm ${
                  hasRecipe ? 'bg-green-50 dark:bg-green-950/50' : 'bg-muted'
                }`}
              >
                <ChefHat className={`h-5 w-5 ${hasRecipe ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`} />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{product.name}</span>
                <span className="text-xs text-muted-foreground">{product.category.name}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'price',
        meta: { label: t('recipes.fields.currentPrice') },
        header: t('recipes.fields.currentPrice'),
        cell: ({ cell }) => {
          const price = cell.getValue() as number
          return <div className="text-sm font-medium text-foreground">{Currency(Number(price))}</div>
        },
      },
      {
        id: 'recipeStatus',
        meta: { label: tCommon('status') },
        header: tCommon('status'),
        cell: ({ row }) => {
          const product = row.original
          const hasRecipe = !!product.recipe

          if (!hasRecipe) {
            return (
              <Badge
                variant="secondary"
                className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 truncate max-w-[150px]"
              >
                {t('recipes.messages.noRecipeShort')}
              </Badge>
            )
          }

          return (
            <div className="flex items-center gap-2">
               <YieldStatusHoverCard productId={product.id} />
               <span className="text-xs text-muted-foreground ml-2">({product.recipe.lines.length} Ing.)</span>
            </div>
          )
        },
      },
      {
        id: 'portionYield',
        meta: { label: t('recipes.fields.portionYield') },
        header: () => <span className="text-xs">Porciones</span>,
        size: 80,
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          return <span className="text-sm font-medium text-foreground">{product.recipe.portionYield}</span>
        },
      },
      {
        id: 'recipeCost',
        meta: { label: t('recipes.fields.totalCost') },
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('recipes.fields.totalCost')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        size: 120,
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          const totalCost = Number(product.recipe.totalCost)
          const costPerServing = totalCost / product.recipe.portionYield

          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{Currency(totalCost)}</span>
              <span className="text-xs text-muted-foreground">
                {Currency(costPerServing)} / porción
              </span>
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          const costA = rowA.original.recipe ? Number(rowA.original.recipe.totalCost) : 0
          const costB = rowB.original.recipe ? Number(rowB.original.recipe.totalCost) : 0
          return costA - costB
        },
      },
      {
        id: 'foodCostPercentage',
        meta: { label: t('pricing.fields.foodCostPercentage') },
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            Food Cost %
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        size: 100,
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const foodCostPercentage = (totalCost / price) * 100

          let colorClass = 'text-green-600 dark:text-green-400'
          if (foodCostPercentage > 40) {
            colorClass = 'text-red-600 dark:text-red-400'
          } else if (foodCostPercentage > 30) {
            colorClass = 'text-yellow-600 dark:text-yellow-400'
          }

          return (
            <div className="flex items-center gap-1.5">
              <DollarSign className={`h-3.5 w-3.5 ${colorClass}`} />
              <span className={`text-sm font-semibold ${colorClass}`}>{foodCostPercentage.toFixed(1)}%</span>
            </div>
          )
        },
        sortingFn: (rowA, rowB) => {
          const costA = rowA.original.recipe ? (Number(rowA.original.recipe.totalCost) / Number(rowA.original.price)) * 100 : 0
          const costB = rowB.original.recipe ? (Number(rowB.original.recipe.totalCost) / Number(rowB.original.price)) * 100 : 0
          return costA - costB
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const product = row.original
          const hasRecipe = !!product.recipe
          const hasQuantityTracking = product.inventoryMethod === 'QUANTITY'

          return (
            <PermissionGate permission={hasRecipe ? 'inventory:update' : 'inventory:create'}>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedProduct(product)

                  // Pre-check: If product has QUANTITY tracking and we're trying to add/edit recipe
                  if (hasQuantityTracking && !hasRecipe) {
                    // Show conversion dialog
                    setConversionDialogOpen(true)
                  } else {
                    // Normal flow
                    if (hasRecipe) {
                      setEditDialogOpen(true)
                    } else {
                      setCreateDialogOpen(true)
                    }
                  }
                }}
              >
                {hasRecipe ? (
                  <>
                    <Edit className="h-4 w-4 mr-1" />
                    {tCommon('edit')}
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-1" />
                    {t('recipes.add')}
                  </>
                )}
              </Button>
            </PermissionGate>
          )
        },
      },
    ],
    [t],
  )

  // Filter columns based on visibility
  const filteredColumns = useMemo(
    () =>
      columns.filter(col => {
        const colId = col.id || (col as any).accessorKey
        if (!colId) return true
        if (colId === 'actions') return true // Always show actions
        return visibleColumns.includes(colId)
      }),
    [columns, visibleColumns]
  )

  const productsWithoutRecipes = products?.filter(p => !p.recipe).length || 0

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex flex-row items-center justify-between">
          <div>
            <PageTitleWithInfo
              title={t('recipes.title')}
              className="text-xl font-semibold"
              tooltip={t('info.recipes', {
                defaultValue: 'Define recetas y cantidades para calcular costos y consumo de inventario.',
              })}
            />
            <p className="text-sm text-muted-foreground">{t('recipes.subtitle')}</p>
          </div>
          <div className="flex items-center gap-2">
            <PermissionGate permission="inventory:create">
              <Button size="sm" onClick={() => setWizardOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                {t('recipes.add')}
              </Button>
            </PermissionGate>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                queryClient.invalidateQueries({
                  queryKey: ['products-with-recipes'],
                  refetchType: 'active',
                })
              }}
              disabled={isLoading}
            >
              <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              {tCommon('refresh')}
            </Button>
          </div>
        </div>

        {/* Alert for products without recipes */}
        {productsWithoutRecipes > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('recipes.messages.productsWithoutRecipes', { count: productsWithoutRecipes })} - {t('recipes.subtitle').toLowerCase()}
            </AlertDescription>
          </Alert>
        )}

        {/* Stripe-style Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Expandable Search */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={t('common:search')}
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
              </Button>
            )}
            {searchTerm && !isSearchOpen && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
            )}
          </div>

          {/* Category Filter */}
          <FilterPill
            label={t('rawMaterials.fields.category')}
            isActive={categoryFilter.length > 0}
            activeLabel={getFilterDisplayLabel(categoryFilter, categoryOptions)}
            onClear={() => setCategoryFilter([])}
          >
            <CheckboxFilterContent
              title={t('rawMaterials.fields.category')}
              options={categoryOptions}
              selectedValues={categoryFilter}
              onApply={setCategoryFilter}
            />
          </FilterPill>

          {/* Recipe Status Filter */}
          <FilterPill
            label={t('recipes.filters.recipeStatus', { defaultValue: 'Estado de receta' })}
            isActive={recipeFilter.length > 0}
            activeLabel={getFilterDisplayLabel(recipeFilter, recipeFilterOptions)}
            onClear={() => setRecipeFilter([])}
          >
            <CheckboxFilterContent
              title={t('recipes.filters.recipeStatus', { defaultValue: 'Estado de receta' })}
              options={recipeFilterOptions}
              selectedValues={recipeFilter}
              onApply={setRecipeFilter}
            />
          </FilterPill>

          {/* Column Customizer */}
          <ColumnCustomizer
            columns={columnOptions}
            onApply={setVisibleColumns}
          />

          {/* Clear All Filters */}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 rounded-full">
              {tCommon('filters.clearAll', { defaultValue: 'Limpiar filtros' })} ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={products || []}
        rowCount={products?.length || 0}
        columns={filteredColumns}
        isLoading={isLoading}
        tableId="recipes:main"
        enableSearch={false}
        showColumnCustomizer={false}
        pagination={pagination}
        setPagination={setPagination}
      />

      {/* Dialogs */}
      <RecipeDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" product={selectedProduct} />

      <RecipeDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} mode="edit" product={selectedProduct} />

      {/* Conversion Dialog */}
      <SimpleConfirmDialog
        open={conversionDialogOpen}
        onOpenChange={setConversionDialogOpen}
        title={t('conversion.toRecipe.title')}
        message={t('conversion.toRecipe.message')}
        confirmLabel={t('conversion.toRecipe.confirm')}
        cancelLabel={t('conversion.toRecipe.cancel')}
        onConfirm={() => switchInventoryMethodMutation.mutate()}
        isLoading={switchInventoryMethodMutation.isPending}
      />

      {/* Create Recipe Wizard */}
      <CreateRecipeWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />
    </div>
  )
}
