import { useState, useMemo, useEffect, useCallback } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowUpDown,
  ChefHat,
  Plus,
  Edit,
  AlertCircle,
  DollarSign,
  RefreshCcw,
  Search,
  X,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Settings,
  ChevronRight,
  Loader2,
} from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { type Recipe, productInventoryApi, pricingApi, type PricingPolicy } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { RecipeDialog } from './components/RecipeDialog'
import { CreateRecipeWizard } from './components/CreateRecipeWizard'
import { RecipeDetailDialog } from './components/RecipeDetailDialog'
import { YieldStatusHoverCard } from './components/YieldStatusHoverCard'
import { SimpleConfirmDialog } from './components/SimpleConfirmDialog'
import { PricingPolicyDialog } from './components/PricingPolicyDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useToast } from '@/hooks/use-toast'
import api from '@/api'
import { Input } from '@/components/ui/input'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { RangeFilterContent } from '@/components/filters/RangeFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'
import { includesNormalized } from '@/lib/utils'

// Product types that can have recipes (excludes services, classes, digital, donations)
const NO_RECIPE_PRODUCT_TYPES = ['APPOINTMENTS_SERVICE', 'SERVICE', 'CLASS', 'DIGITAL', 'DONATION']

interface ProductWithRecipe {
  id: string
  name: string
  price: number
  active: boolean
  type?: string
  trackInventory?: boolean
  category: {
    id: string
    name: string
  }
  recipe?: Recipe
  inventoryMethod?: 'QUANTITY' | 'RECIPE' | null
  pricingPolicy?: PricingPolicy
}

export default function Recipes() {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [searchParams] = useSearchParams()
  const highlightProductId = searchParams.get('productId')

  // Tab state
  const [activeTab, setActiveTab] = useState('recipes')

  // Dialog states — Recipes tab
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [detailDialogOpen, setDetailDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null)
  const [conversionDialogOpen, setConversionDialogOpen] = useState(false)
  const [wizardOpen, setWizardOpen] = useState(false)

  // Dialog states — Pricing tab
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [pricingRecipeDialogOpen, setPricingRecipeDialogOpen] = useState(false)
  const [selectedPricingProduct, setSelectedPricingProduct] = useState<ProductWithRecipe | null>(null)

  // Shared filter states
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [searchTerm, setSearchTerm] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 20 })

  // Recipes-specific filter states
  const [recipeFilter, setRecipeFilter] = useState<string[]>([])

  // Pricing-specific filter states
  const [profitabilityFilter, setProfitabilityFilter] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<{ min: string; max: string } | null>(null)
  const [foodCostRange, setFoodCostRange] = useState<{ min: string; max: string } | null>(null)
  const [strategyFilter, setStrategyFilter] = useState<string[]>([])

  // Column visibility — Recipes tab
  const [recipesVisibleColumns, setRecipesVisibleColumns] = useState<string[]>([
    'name', 'price', 'recipeStatus', 'portionYield', 'recipeCost', 'foodCostPercentage', 'actions',
  ])

  // Column visibility — Pricing tab
  const [pricingVisibleColumns, setPricingVisibleColumns] = useState<string[]>([
    'name', 'price', 'recipeCost', 'foodCostPercentage', 'contribution', 'profitability', 'pricingStrategy', 'actions',
  ])

  // Reset pagination when switching tabs
  useEffect(() => {
    setPagination({ pageIndex: 0, pageSize: 20 })
  }, [activeTab])

  // Fetch products with recipes + pricing policy
  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products-with-recipes', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: {
          includeRecipe: true,
          includePricingPolicy: true,
        },
      })
      return response.data.data as ProductWithRecipe[]
    },
    enabled: !!venueId,
  })

  // ─── Profitability helper ───
  const getProfitabilityStatus = (foodCostPercentage: number) => {
    if (foodCostPercentage < 20) return 'excellent'
    if (foodCostPercentage < 30) return 'good'
    if (foodCostPercentage < 40) return 'acceptable'
    return 'poor'
  }

  // ─── Recipes tab: client-side filtering ───
  const recipesProducts = useMemo(() => {
    let filtered = productsData || []

    // Exclude product types that can't have recipes
    filtered = filtered.filter(p => !NO_RECIPE_PRODUCT_TYPES.includes(p.type || ''))

    // Only show products with inventory tracking enabled or that already have a recipe
    filtered = filtered.filter(p => p.trackInventory || p.recipe)

    // Apply category filter
    if (categoryFilter.length > 0) {
      filtered = filtered.filter(p => categoryFilter.includes(p.category.id))
    }

    // Apply recipe filter
    if (recipeFilter.length > 0) {
      filtered = filtered.filter(p => {
        if (recipeFilter.includes('withRecipe') && p.recipe) return true
        if (recipeFilter.includes('withoutRecipe') && !p.recipe) return true
        return false
      })
    }

    // Apply search filter
    if (debouncedSearchTerm) {
      filtered = filtered.filter(
        p => includesNormalized(p.name ?? '', debouncedSearchTerm) || includesNormalized(p.category.name ?? '', debouncedSearchTerm),
      )
    }

    // Default sort: products WITH recipe first, then alphabetical by name within each group
    return [...filtered].sort((a, b) => {
      const aHasRecipe = a.recipe ? 0 : 1
      const bHasRecipe = b.recipe ? 0 : 1
      if (aHasRecipe !== bHasRecipe) return aHasRecipe - bHasRecipe
      return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
    })
  }, [productsData, categoryFilter, recipeFilter, debouncedSearchTerm])

  // ─── Pricing tab: client-side filtering (only products WITH recipes) ───
  const pricingProducts = useMemo(() => {
    if (!productsData) return []

    return productsData
      .filter(p => p.recipe) // Pricing tab only shows products with recipes
      .filter(p => {
        // Category filter
        if (categoryFilter.length > 0 && !categoryFilter.includes(p.category.id)) return false

        // Profitability filter
        if (profitabilityFilter.length > 0 && p.recipe) {
          const foodCostPct = (Number(p.recipe.totalCost) / Number(p.price)) * 100
          const status = getProfitabilityStatus(foodCostPct)
          if (!profitabilityFilter.includes(status)) return false
        }

        // Strategy filter
        if (strategyFilter.length > 0) {
          const strategy = p.pricingPolicy?.pricingStrategy || 'MANUAL'
          if (!strategyFilter.includes(strategy)) return false
        }

        // Price range filter
        if (priceRange) {
          const price = Number(p.price)
          if (priceRange.min && price < Number(priceRange.min)) return false
          if (priceRange.max && price > Number(priceRange.max)) return false
        }

        // Food cost % range filter
        if (foodCostRange && p.recipe) {
          const foodCostPct = (Number(p.recipe.totalCost) / Number(p.price)) * 100
          if (foodCostRange.min && foodCostPct < Number(foodCostRange.min)) return false
          if (foodCostRange.max && foodCostPct > Number(foodCostRange.max)) return false
        }

        // Search filter
        if (debouncedSearchTerm) {
          if (!includesNormalized(p.name ?? '', debouncedSearchTerm) && !includesNormalized(p.category.name ?? '', debouncedSearchTerm)) return false
        }

        return true
      })
  }, [productsData, categoryFilter, profitabilityFilter, strategyFilter, priceRange, foodCostRange, debouncedSearchTerm])

  // Auto-open dialog if productId in URL
  useEffect(() => {
    if (highlightProductId && recipesProducts && !isLoading) {
      const product = recipesProducts.find(p => p.id === highlightProductId)
      if (product) {
        setSelectedProduct(product)
        if (product.recipe) {
          setEditDialogOpen(true)
        } else {
          setCreateDialogOpen(true)
        }
      }
    }
  }, [highlightProductId, recipesProducts, isLoading])

  // Fetch categories for filter
  const { data: categories } = useQuery({
    queryKey: ['categories', venueId],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/menucategories`)
      return response.data
    },
    enabled: !!venueId,
  })

  // ─── Shared filter options ───
  const categoryOptions = useMemo(
    () => (categories || []).map((cat: any) => ({ value: cat.id, label: cat.name })),
    [categories],
  )

  // ─── Recipes tab filter options ───
  const recipeFilterOptions = useMemo(
    () => [
      { value: 'withRecipe', label: t('recipes.filters.withRecipe') },
      { value: 'withoutRecipe', label: t('recipes.filters.withoutRecipe') },
    ],
    [t],
  )

  // ─── Pricing tab filter options ───
  const profitabilityOptions = useMemo(
    () => [
      { value: 'excellent', label: t('pricing.profitabilityStatus.EXCELLENT') },
      { value: 'good', label: t('pricing.profitabilityStatus.GOOD') },
      { value: 'acceptable', label: t('pricing.profitabilityStatus.ACCEPTABLE') },
      { value: 'poor', label: t('pricing.profitabilityStatus.POOR') },
    ],
    [t],
  )

  const strategyOptions = useMemo(
    () => [
      { value: 'MANUAL', label: t('pricing.strategies.MANUAL') },
      { value: 'AUTO_MARKUP', label: t('pricing.strategies.AUTO_MARKUP') },
      { value: 'AUTO_TARGET_MARGIN', label: t('pricing.strategies.AUTO_TARGET_MARGIN') },
    ],
    [t],
  )

  // ─── Column options for customizer ───
  const recipesColumnOptions = useMemo(
    () => [
      { id: 'name', label: t('recipes.fields.product'), visible: recipesVisibleColumns.includes('name') },
      { id: 'price', label: t('recipes.fields.currentPrice'), visible: recipesVisibleColumns.includes('price') },
      { id: 'recipeStatus', label: tCommon('status'), visible: recipesVisibleColumns.includes('recipeStatus') },
      { id: 'portionYield', label: t('recipes.fields.portionYield'), visible: recipesVisibleColumns.includes('portionYield') },
      { id: 'recipeCost', label: t('recipes.fields.totalCost'), visible: recipesVisibleColumns.includes('recipeCost') },
      { id: 'foodCostPercentage', label: t('pricing.fields.foodCostPercentage'), visible: recipesVisibleColumns.includes('foodCostPercentage') },
    ],
    [t, tCommon, recipesVisibleColumns],
  )

  const pricingColumnOptions = useMemo(
    () => [
      { id: 'name', label: t('recipes.fields.product'), visible: pricingVisibleColumns.includes('name') },
      { id: 'price', label: t('pricing.fields.currentPrice'), visible: pricingVisibleColumns.includes('price') },
      { id: 'recipeCost', label: t('pricing.fields.recipeCost'), visible: pricingVisibleColumns.includes('recipeCost') },
      { id: 'foodCostPercentage', label: t('pricing.fields.foodCostPercentage'), visible: pricingVisibleColumns.includes('foodCostPercentage') },
      { id: 'contribution', label: t('pricing.fields.contribution'), visible: pricingVisibleColumns.includes('contribution') },
      { id: 'profitability', label: t('pricing.fields.estatus'), visible: pricingVisibleColumns.includes('profitability') },
      { id: 'pricingStrategy', label: t('pricing.fields.strategy'), visible: pricingVisibleColumns.includes('pricingStrategy') },
      { id: 'actions', label: tCommon('actions'), visible: pricingVisibleColumns.includes('actions') },
    ],
    [t, tCommon, pricingVisibleColumns],
  )

  // ─── Helper ───
  const getFilterDisplayLabel = useCallback(
    (selectedValues: string[], options: { value: string; label: string }[]) => {
      if (selectedValues.length === 0) return null
      if (selectedValues.length === 1) return options.find(o => o.value === selectedValues[0])?.label || null
      return `${selectedValues.length} ${t('rawMaterials.filters.selected', { defaultValue: 'seleccionados' })}`
    },
    [t],
  )

  // ─── Active filters count ───
  const activeFiltersCount = useMemo(() => {
    let count = 0
    if (searchTerm) count++
    if (categoryFilter.length > 0) count++
    if (activeTab === 'recipes') {
      if (recipeFilter.length > 0) count++
    } else {
      if (profitabilityFilter.length > 0) count++
      if (strategyFilter.length > 0) count++
      if (priceRange) count++
      if (foodCostRange) count++
    }
    return count
  }, [searchTerm, categoryFilter, recipeFilter, profitabilityFilter, strategyFilter, priceRange, foodCostRange, activeTab])

  // ─── Clear all filters ───
  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setCategoryFilter([])
    setRecipeFilter([])
    setProfitabilityFilter([])
    setStrategyFilter([])
    setPriceRange(null)
    setFoodCostRange(null)
  }, [])

  // ─── Mutations ───
  const switchInventoryMethodMutation = useMutation({
    mutationFn: () => productInventoryApi.switchInventoryMethod(venueId, selectedProduct!.id, 'RECIPE'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      toast({ title: t('conversion.toRecipe.success'), variant: 'default' })
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

  const applySuggestedPriceMutation = useMutation({
    mutationFn: (productId: string) => pricingApi.applySuggestedPrice(venueId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products-with-recipes'] })
      toast({ title: t('pricing.messages.priceApplied'), variant: 'default' })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to apply price',
        variant: 'destructive',
      })
    },
  })

  // ─── Profitability badge ───
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

  // ═══════════════════════════════════════════
  // RECIPES TAB — Column definitions
  // ═══════════════════════════════════════════
  const recipesColumns = useMemo<ColumnDef<ProductWithRecipe, unknown>[]>(
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
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>
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
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>
          const totalCost = Number(product.recipe.totalCost)
          const costPerServing = totalCost / product.recipe.portionYield
          return (
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-foreground">{Currency(totalCost)}</span>
              <span className="text-xs text-muted-foreground">{Currency(costPerServing)} / porción</span>
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
          if (!product.recipe) return <span className="text-sm text-muted-foreground">-</span>
          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const foodCostPercentage = (totalCost / price) * 100
          let colorClass = 'text-green-600 dark:text-green-400'
          if (foodCostPercentage > 40) colorClass = 'text-red-600 dark:text-red-400'
          else if (foodCostPercentage > 30) colorClass = 'text-yellow-600 dark:text-yellow-400'
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
                  if (hasQuantityTracking && !hasRecipe) {
                    setConversionDialogOpen(true)
                  } else if (hasRecipe) {
                    setEditDialogOpen(true)
                  } else {
                    setCreateDialogOpen(true)
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
    [t, tCommon],
  )

  // Filter recipes columns based on visibility
  const filteredRecipesColumns = useMemo(
    () =>
      recipesColumns.filter(col => {
        const colId = col.id || (col as any).accessorKey
        if (!colId) return true
        if (colId === 'actions') return true
        return recipesVisibleColumns.includes(colId)
      }),
    [recipesColumns, recipesVisibleColumns],
  )

  // ═══════════════════════════════════════════
  // PRICING TAB — Column definitions
  // ═══════════════════════════════════════════
  const pricingColumns = useMemo<ColumnDef<ProductWithRecipe, unknown>[]>(
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
          return <span className="text-sm font-semibold text-foreground">{Currency(Number(price))}</span>
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
          return <span className="text-sm font-medium text-foreground">{Currency(Number(product.recipe.totalCost))}</span>
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
          const foodCostPct = (totalCost / price) * 100
          let colorClass = 'text-green-600 dark:text-green-400'
          if (foodCostPct >= 40) colorClass = 'text-red-600 dark:text-red-400'
          else if (foodCostPct >= 30) colorClass = 'text-yellow-600 dark:text-yellow-400'
          else if (foodCostPct >= 20) colorClass = 'text-blue-600 dark:text-blue-400'
          return <span className={`text-sm font-semibold ${colorClass}`}>{foodCostPct.toFixed(1)}%</span>
        },
        sortingFn: (rowA, rowB) => {
          const costA = rowA.original.recipe ? (Number(rowA.original.recipe.totalCost) / Number(rowA.original.price)) * 100 : 0
          const costB = rowB.original.recipe ? (Number(rowB.original.recipe.totalCost) / Number(rowB.original.price)) * 100 : 0
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
          const contribution = Number(product.price) - Number(product.recipe.totalCost)
          return <span className="text-sm font-medium text-foreground">{Currency(contribution)}</span>
        },
        sortingFn: (rowA, rowB) => {
          const contribA = rowA.original.recipe ? Number(rowA.original.price) - Number(rowA.original.recipe.totalCost) : 0
          const contribB = rowB.original.recipe ? Number(rowB.original.price) - Number(rowB.original.recipe.totalCost) : 0
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
          const foodCostPct = (totalCost / price) * 100
          return getProfitabilityBadge(foodCostPct)
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
                    setSelectedPricingProduct(product)
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
    [t, tCommon, applySuggestedPriceMutation],
  )

  // Filter pricing columns based on visibility
  const filteredPricingColumns = useMemo(
    () =>
      pricingColumns.filter(col => {
        const colId = col.id || (col as any).accessorKey
        return pricingVisibleColumns.includes(colId)
      }),
    [pricingColumns, pricingVisibleColumns],
  )

  // ─── Counts ───
  const productsWithoutRecipes = recipesProducts?.filter(p => !p.recipe).length || 0
  const productsNeedingReview =
    pricingProducts?.filter(p => {
      if (!p.recipe) return false
      const foodCostPct = (Number(p.recipe.totalCost) / Number(p.price)) * 100
      return foodCostPct >= 40
    }).length || 0

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
            {activeTab === 'recipes' && (
              <PermissionGate permission="inventory:create">
                <Button size="sm" onClick={() => setWizardOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  {t('recipes.add')}
                </Button>
              </PermissionGate>
            )}
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

        {/* Tab nav with underline — Stripe pattern */}
        <div className="border-b border-border">
          <nav className="flex items-center gap-6">
            <button
              onClick={() => setActiveTab('recipes')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === 'recipes' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('recipes.tabs.recipes')}
              <span className="ml-1.5 text-xs opacity-60">{recipesProducts.length}</span>
              {activeTab === 'recipes' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
              )}
            </button>
            <button
              onClick={() => setActiveTab('pricing')}
              className={`relative pb-3 text-sm font-medium transition-colors ${
                activeTab === 'pricing' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('recipes.tabs.pricing')}
              <span className="ml-1.5 text-xs opacity-60">{pricingProducts.length}</span>
              {activeTab === 'pricing' && (
                <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-primary rounded-full" />
              )}
            </button>
          </nav>
        </div>

        {/* Tab-specific alerts */}
        {activeTab === 'recipes' && productsWithoutRecipes > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {t('recipes.messages.productsWithoutRecipes', { count: productsWithoutRecipes })} -{' '}
              {t('recipes.subtitle').toLowerCase()}
            </AlertDescription>
          </Alert>
        )}

        {activeTab === 'pricing' && productsNeedingReview > 0 && (
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
                  <p className="text-xs text-red-700 dark:text-red-500">{t('pricing.subtitle').toLowerCase()}</p>
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-red-600 dark:text-red-400 group-hover:translate-x-1 transition-transform" />
            </div>
          </button>
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

          {/* Category Filter (both tabs) */}
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

          {/* Recipes tab filters */}
          {activeTab === 'recipes' && (
            <>
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

              <ColumnCustomizer columns={recipesColumnOptions} onApply={setRecipesVisibleColumns} />
            </>
          )}

          {/* Pricing tab filters */}
          {activeTab === 'pricing' && (
            <>
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

              <ColumnCustomizer columns={pricingColumnOptions} onApply={setPricingVisibleColumns} />
            </>
          )}

          {/* Clear All Filters */}
          {activeFiltersCount > 0 && (
            <Button variant="ghost" size="sm" onClick={clearAllFilters} className="h-8 rounded-full">
              {tCommon('filters.clearAll', { defaultValue: 'Limpiar filtros' })} ({activeFiltersCount})
            </Button>
          )}
        </div>
      </div>

      {/* Data Table — Recipes Tab */}
      {activeTab === 'recipes' && (
        <DataTable
          data={recipesProducts || []}
          rowCount={recipesProducts?.length || 0}
          columns={filteredRecipesColumns}
          isLoading={isLoading}
          tableId="recipes:main"
          enableSearch={false}
          showColumnCustomizer={false}
          pagination={pagination}
          setPagination={setPagination}
          onRowClick={row => {
            setSelectedProduct(row)
            setDetailDialogOpen(true)
          }}
        />
      )}

      {/* Data Table — Pricing Tab */}
      {activeTab === 'pricing' && (
        <DataTable
          data={pricingProducts || []}
          rowCount={pricingProducts?.length || 0}
          columns={filteredPricingColumns}
          isLoading={isLoading}
          tableId="pricing:main"
          enableSearch={false}
          showColumnCustomizer={false}
          pagination={pagination}
          setPagination={setPagination}
          onRowClick={row => {
            setSelectedPricingProduct(row)
            setPricingRecipeDialogOpen(true)
          }}
        />
      )}

      {/* Dialogs — Recipes Tab */}
      <RecipeDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" product={selectedProduct} />
      <RecipeDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} mode="edit" product={selectedProduct} />

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

      <CreateRecipeWizard open={wizardOpen} onClose={() => setWizardOpen(false)} />

      {/* Detail Dialog — opens on row click in Recipes tab, audit-friendly */}
      <RecipeDetailDialog
        open={detailDialogOpen}
        onOpenChange={setDetailDialogOpen}
        product={selectedProduct}
        onEdit={() => {
          if (selectedProduct?.recipe) setEditDialogOpen(true)
          else setCreateDialogOpen(true)
        }}
      />

      {/* Dialogs — Pricing Tab */}
      <PricingPolicyDialog open={policyDialogOpen} onOpenChange={setPolicyDialogOpen} product={selectedPricingProduct} />

      <RecipeDialog open={pricingRecipeDialogOpen} onOpenChange={setPricingRecipeDialogOpen} mode="edit" product={selectedPricingProduct} />
    </div>
  )
}
