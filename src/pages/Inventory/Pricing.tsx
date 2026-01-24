import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Settings, Search, X, ChevronRight } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useToast } from '@/hooks/use-toast'
import { pricingApi, type PricingPolicy, type Recipe } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { PricingPolicyDialog } from './components/PricingPolicyDialog'
import { RecipeDialog } from './components/RecipeDialog'
import { Input } from '@/components/ui/input'
import api from '@/api'
import { Loader2 } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { RangeFilterContent } from '@/components/filters/RangeFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'

interface ProductPricingAnalysis {
  id: string
  name: string
  price: number
  active: boolean
  category: {
    id: string
    name: string
  }
  recipe?: Recipe
  pricingPolicy?: PricingPolicy
}

export default function Pricing() {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Dialog states
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductPricingAnalysis | null>(null)

  // Filter states - multi-select arrays
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [profitabilityFilter, setProfitabilityFilter] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<{ min: string; max: string } | null>(null)
  const [foodCostRange, setFoodCostRange] = useState<{ min: string; max: string } | null>(null)
  const [strategyFilter, setStrategyFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Get profitability status - defined early because it's used in useMemo filters
  const getProfitabilityStatus = (foodCostPercentage: number) => {
    if (foodCostPercentage < 20) return 'excellent'
    if (foodCostPercentage < 30) return 'good'
    if (foodCostPercentage < 40) return 'acceptable'
    return 'poor'
  }

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name',
    'price',
    'recipeCost',
    'foodCostPercentage',
    'contribution',
    'profitability',
    'pricingStrategy',
    'actions',
  ])

  // Fetch products with pricing data
  const { data: productsRaw, isLoading } = useQuery({
    queryKey: ['products-pricing', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: {
          includeRecipe: true,
          includePricingPolicy: true,
        },
      })

      // Filter products with recipes only (need recipe for pricing analysis)
      return (response.data.data as ProductPricingAnalysis[]).filter(p => p.recipe)
    },
    enabled: !!venueId,
    staleTime: 0, // Always consider data stale to ensure fresh pricing data
    refetchOnMount: true, // Refetch when component mounts
  })

  // Client-side filtering
  const products = useMemo(() => {
    if (!productsRaw) return []

    return productsRaw.filter(p => {
      // Category filter
      if (categoryFilter.length > 0 && !categoryFilter.includes(p.category.id)) {
        return false
      }

      // Profitability filter
      if (profitabilityFilter.length > 0 && p.recipe) {
        const foodCostPercentage = (Number(p.recipe.totalCost) / Number(p.price)) * 100
        const status = getProfitabilityStatus(foodCostPercentage)
        if (!profitabilityFilter.includes(status)) {
          return false
        }
      }

      // Strategy filter
      if (strategyFilter.length > 0) {
        const strategy = p.pricingPolicy?.pricingStrategy || 'MANUAL'
        if (!strategyFilter.includes(strategy)) {
          return false
        }
      }

      // Price range filter
      if (priceRange) {
        const price = Number(p.price)
        if (priceRange.min && price < Number(priceRange.min)) return false
        if (priceRange.max && price > Number(priceRange.max)) return false
      }

      // Food cost % range filter
      if (foodCostRange && p.recipe) {
        const foodCostPercentage = (Number(p.recipe.totalCost) / Number(p.price)) * 100
        if (foodCostRange.min && foodCostPercentage < Number(foodCostRange.min)) return false
        if (foodCostRange.max && foodCostPercentage > Number(foodCostRange.max)) return false
      }

      // Search filter
      if (debouncedSearchTerm) {
        const lowerSearch = debouncedSearchTerm.toLowerCase()
        if (
          !p.name.toLowerCase().includes(lowerSearch) &&
          !p.category.name.toLowerCase().includes(lowerSearch)
        ) {
          return false
        }
      }

      return true
    })
  }, [productsRaw, categoryFilter, profitabilityFilter, strategyFilter, priceRange, foodCostRange, debouncedSearchTerm])

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menucategories`)
      return response.data
    },
    enabled: !!venueId,
  })

  // Apply suggested price mutation
  const applySuggestedPriceMutation = useMutation({
    mutationFn: (productId: string) => pricingApi.applySuggestedPrice(venueId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-pricing', venueId] })
      toast({
        title: t('pricing.messages.priceApplied'),
        variant: 'default',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to apply price',
        variant: 'destructive',
      })
    },
  })

  // Get profitability badge
  const getProfitabilityBadge = (foodCostPercentage: number) => {
    const status = getProfitabilityStatus(foodCostPercentage)

    const configs = {
      excellent: {
        icon: CheckCircle2,
        className: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
        label: t('pricing.profitabilityStatus.EXCELLENT'),
      },
      good: {
        icon: TrendingUp,
        className: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800',
        label: t('pricing.profitabilityStatus.GOOD'),
      },
      acceptable: {
        icon: TrendingDown,
        className: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
        label: t('pricing.profitabilityStatus.ACCEPTABLE'),
      },
      poor: {
        icon: AlertTriangle,
        className: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800',
        label: t('pricing.profitabilityStatus.POOR'),
      },
    }

    const config = configs[status]
    const Icon = config.icon

    return (
      <Badge variant="outline" className={config.className}>
        <Icon className="h-3 w-3 mr-1" />
        {config.label}
      </Badge>
    )
  }

  // Filter options
  const categoryOptions = useMemo(() => {
    return (categories || []).map((cat: any) => ({
      value: cat.id,
      label: cat.name,
    }))
  }, [categories])

  const profitabilityOptions = useMemo(() => [
    { value: 'excellent', label: t('pricing.profitabilityStatus.EXCELLENT') },
    { value: 'good', label: t('pricing.profitabilityStatus.GOOD') },
    { value: 'acceptable', label: t('pricing.profitabilityStatus.ACCEPTABLE') },
    { value: 'poor', label: t('pricing.profitabilityStatus.POOR') },
  ], [t])

  const strategyOptions = useMemo(() => [
    { value: 'MANUAL', label: t('pricing.strategies.MANUAL') },
    { value: 'AUTO_MARKUP', label: t('pricing.strategies.AUTO_MARKUP') },
    { value: 'AUTO_TARGET_MARGIN', label: t('pricing.strategies.AUTO_TARGET_MARGIN') },
  ], [t])

  // Column options for customizer
  const columnOptions = useMemo(() => [
    { id: 'name', label: t('recipes.fields.product'), visible: visibleColumns.includes('name') },
    { id: 'price', label: t('pricing.fields.currentPrice'), visible: visibleColumns.includes('price') },
    { id: 'recipeCost', label: t('pricing.fields.recipeCost'), visible: visibleColumns.includes('recipeCost') },
    { id: 'foodCostPercentage', label: t('pricing.fields.foodCostPercentage'), visible: visibleColumns.includes('foodCostPercentage') },
    { id: 'contribution', label: t('pricing.fields.contribution'), visible: visibleColumns.includes('contribution') },
    { id: 'profitability', label: t('pricing.fields.estatus'), visible: visibleColumns.includes('profitability') },
    { id: 'pricingStrategy', label: t('pricing.fields.strategy'), visible: visibleColumns.includes('pricingStrategy') },
    { id: 'actions', label: tCommon('actions'), visible: visibleColumns.includes('actions') },
  ], [t, tCommon, visibleColumns])

  // Filter display helpers
  const getFilterDisplayLabel = (values: string[], options: { value: string; label: string }[]) => {
    if (values.length === 0) return ''
    if (values.length === 1) {
      const option = options.find(o => o.value === values[0])
      return option?.label || values[0]
    }
    return `${values.length} ${t('rawMaterials.filters.selected')}`
  }

  // Active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (categoryFilter.length > 0) count++
    if (profitabilityFilter.length > 0) count++
    if (strategyFilter.length > 0) count++
    if (priceRange) count++
    if (foodCostRange) count++
    return count
  }, [categoryFilter, profitabilityFilter, strategyFilter, priceRange, foodCostRange])

  // Clear all filters
  const clearAllFilters = () => {
    setCategoryFilter([])
    setProfitabilityFilter([])
    setStrategyFilter([])
    setPriceRange(null)
    setFoodCostRange(null)
    setSearchTerm('')
  }

  // Column definitions
  const columns = useMemo<ColumnDef<ProductPricingAnalysis, unknown>[]>(
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
          return (
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{product.name}</span>
              <span className="text-xs text-muted-foreground">{product.category.name}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'price',
        meta: { label: t('pricing.fields.currentPrice') },
        size: 100,
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('pricing.fields.currentPrice')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        cell: ({ cell }) => {
          const price = cell.getValue() as number
          return (
            <span className="text-sm font-semibold text-foreground">
              {Currency(Number(price))}
            </span>
          )
        },
      },
      {
        id: 'recipeCost',
        meta: { label: t('pricing.fields.recipeCost') },
        size: 100,
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('pricing.fields.recipeCost')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>

          const totalCost = Number(product.recipe.totalCost)
          return (
            <span className="text-sm font-medium text-foreground">
              {Currency(totalCost)}
            </span>
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
        size: 90,
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('pricing.fields.foodCostPercentage')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>

          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const foodCostPercentage = (totalCost / price) * 100

          let colorClass = 'text-green-600 dark:text-green-400'
          if (foodCostPercentage >= 40) {
            colorClass = 'text-red-600 dark:text-red-400'
          } else if (foodCostPercentage >= 30) {
            colorClass = 'text-yellow-600 dark:text-yellow-400'
          } else if (foodCostPercentage >= 20) {
            colorClass = 'text-blue-600 dark:text-blue-400'
          }

          return (
            <span className={`text-sm font-semibold ${colorClass}`}>
              {foodCostPercentage.toFixed(1)}%
            </span>
          )
        },
        sortingFn: (rowA, rowB) => {
          const costA = rowA.original.recipe
            ? (Number(rowA.original.recipe.totalCost) / Number(rowA.original.price)) * 100
            : 0
          const costB = rowB.original.recipe
            ? (Number(rowB.original.recipe.totalCost) / Number(rowB.original.price)) * 100
            : 0
          return costA - costB
        },
      },
      {
        id: 'contribution',
        meta: { label: t('pricing.fields.contribution') },
        size: 100,
        header: ({ column }) => (
          <Button variant="ghost" size="sm" className="h-8 px-2" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('pricing.fields.contribution')}
            <ArrowUpDown className="w-3 h-3 ml-1" />
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>

          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const contribution = price - totalCost

          return (
            <span className="text-sm font-medium text-foreground">
              {Currency(contribution)}
            </span>
          )
        },
        sortingFn: (rowA, rowB) => {
          const contribA = rowA.original.recipe
            ? Number(rowA.original.price) - Number(rowA.original.recipe.totalCost)
            : 0
          const contribB = rowB.original.recipe
            ? Number(rowB.original.price) - Number(rowB.original.recipe.totalCost)
            : 0
          return contribA - contribB
        },
      },
      {
        id: 'profitability',
        meta: { label: t('pricing.fields.estatus') },
        size: 110,
        header: () => <span className="text-xs">{t('pricing.fields.estatus')}</span>,
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return null

          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const foodCostPercentage = (totalCost / price) * 100

          return getProfitabilityBadge(foodCostPercentage)
        },
      },
      {
        id: 'pricingStrategy',
        meta: { label: t('pricing.fields.strategy') },
        size: 100,
        header: () => <span className="text-xs">{t('pricing.fields.strategy')}</span>,
        cell: ({ row }) => {
          const product = row.original
          if (!product.pricingPolicy) {
            return <span className="text-xs text-muted-foreground">{t('pricing.strategies.MANUAL')}</span>
          }

          return (
            <span className="text-xs font-medium text-foreground">
              {t(`pricing.strategies.${product.pricingPolicy.pricingStrategy}`)}
            </span>
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const product = row.original
          const hasPolicy = !!product.pricingPolicy

          return (
            <div className="flex items-center gap-2">
              <PermissionGate permission="inventory:update">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedProduct(product)
                    setPolicyDialogOpen(true)
                  }}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  {hasPolicy ? tCommon('edit') : t('pricing.createPolicy')}
                </Button>
              </PermissionGate>

              {product.pricingPolicy?.suggestedPrice &&
                Number(product.pricingPolicy.suggestedPrice) !== Number(product.price) && (
                  <PermissionGate permission="inventory:update">
                    <Button
                      variant="default"
                      size="sm"
                      onClick={e => {
                        e.stopPropagation()
                        applySuggestedPriceMutation.mutate(product.id)
                      }}
                      disabled={applySuggestedPriceMutation.isPending}
                    >
                      {applySuggestedPriceMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                      {t('pricing.applySuggested')}
                    </Button>
                  </PermissionGate>
                )}
            </div>
          )
        },
      },
    ],
    [t, applySuggestedPriceMutation],
  )

  // Filtered columns based on visibility
  const filteredColumns = useMemo(() => {
    return columns.filter(col => {
      const colId = col.id || (col as any).accessorKey
      return visibleColumns.includes(colId)
    })
  }, [columns, visibleColumns])

  const productsNeedingReview = products?.filter(p => {
    if (!p.recipe) return false
    const foodCostPercentage = (Number(p.recipe.totalCost) / Number(p.price)) * 100
    return foodCostPercentage >= 40
  }).length || 0

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-2">
        <div className="flex flex-row items-center justify-between">
          <div>
            <PageTitleWithInfo
              title={t('pricing.title')}
              className="text-xl font-semibold"
              tooltip={t('info.pricing', {
                defaultValue: 'Analiza costos vs precio para detectar margen y rentabilidad.',
              })}
            />
            <p className="text-sm text-muted-foreground">{t('pricing.subtitle')}</p>
          </div>
        </div>

        {/* Stats */}
        {productsNeedingReview > 0 && (
          <button
            type="button"
            onClick={() => setProfitabilityFilter(['poor'])}
            className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer w-full text-left group"
            aria-label={t('pricing.filterPoorProfitability', `Filter products with poor profitability (${productsNeedingReview} items)`)}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                <div>
                  <p className="text-sm font-semibold text-red-800 dark:text-red-400">
                    {productsNeedingReview} {t('reports.profitability.needsReview').toLowerCase()}
                  </p>
                  <p className="text-xs text-red-700 dark:text-red-500">
                    {t('pricing.subtitle').toLowerCase()}
                  </p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
        )}

        {/* Stripe-style Filters */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Expandable Search */}
          <div className="relative flex items-center">
            {isSearchOpen ? (
              <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder={tCommon('search')}
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
                {searchTerm && <span className="sr-only">{t('rawMaterials.filters.searchActive')}</span>}
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

          {/* Profitability Filter */}
          <FilterPill
            label={t('pricing.fields.estatus')}
            isActive={profitabilityFilter.length > 0}
            activeLabel={getFilterDisplayLabel(profitabilityFilter, profitabilityOptions)}
            onClear={() => setProfitabilityFilter([])}
          >
            <CheckboxFilterContent
              title={t('pricing.fields.estatus')}
              options={profitabilityOptions}
              selectedValues={profitabilityFilter}
              onApply={setProfitabilityFilter}
            />
          </FilterPill>

          {/* Strategy Filter */}
          <FilterPill
            label={t('pricing.fields.strategy')}
            isActive={strategyFilter.length > 0}
            activeLabel={getFilterDisplayLabel(strategyFilter, strategyOptions)}
            onClear={() => setStrategyFilter([])}
          >
            <CheckboxFilterContent
              title={t('pricing.fields.strategy')}
              options={strategyOptions}
              selectedValues={strategyFilter}
              onApply={setStrategyFilter}
            />
          </FilterPill>

          {/* Price Range Filter */}
          <FilterPill
            label={t('pricing.fields.currentPrice')}
            isActive={priceRange !== null}
            activeLabel={priceRange ? `$${priceRange.min || '0'} - $${priceRange.max || '∞'}` : null}
            onClear={() => setPriceRange(null)}
          >
            <RangeFilterContent
              title={t('pricing.fields.currentPrice')}
              currentRange={priceRange}
              onApply={setPriceRange}
              prefix="$"
              placeholder="0"
            />
          </FilterPill>

          {/* Food Cost % Range Filter */}
          <FilterPill
            label={t('pricing.fields.foodCostPercentage')}
            isActive={foodCostRange !== null}
            activeLabel={foodCostRange ? `${foodCostRange.min || '0'}% - ${foodCostRange.max || '∞'}%` : null}
            onClear={() => setFoodCostRange(null)}
          >
            <RangeFilterContent
              title={t('pricing.fields.foodCostPercentage')}
              currentRange={foodCostRange}
              onApply={setFoodCostRange}
              prefix=""
              placeholder="0"
            />
          </FilterPill>

          {/* Clear All */}
          {activeFiltersCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-8 text-xs text-muted-foreground hover:text-foreground"
            >
              {tCommon('filters.clearAll')} ({activeFiltersCount})
            </Button>
          )}

          {/* Column Customizer */}
          <ColumnCustomizer
            columns={columnOptions}
            onApply={setVisibleColumns}
          />
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={products || []}
        rowCount={products?.length || 0}
        columns={filteredColumns}
        isLoading={isLoading}
        tableId="pricing:main"
        enableSearch={false}
        showColumnCustomizer={false}
        pagination={pagination}
        setPagination={setPagination}
        onRowClick={(row) => {
          // Open recipe dialog when clicking on a row
          setSelectedProduct(row)
          setRecipeDialogOpen(true)
        }}
      />

      {/* Pricing Policy Dialog */}
      <PricingPolicyDialog
        open={policyDialogOpen}
        onOpenChange={setPolicyDialogOpen}
        product={selectedProduct}
      />

      {/* Recipe Dialog */}
      <RecipeDialog
        open={recipeDialogOpen}
        onOpenChange={setRecipeDialogOpen}
        mode="edit"
        product={selectedProduct}
      />
    </div>
  )
}
