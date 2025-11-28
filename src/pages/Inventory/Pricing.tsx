import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2, Settings, DollarSign } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { pricingApi, type PricingPolicy } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { PricingPolicyDialog } from './components/PricingPolicyDialog'
import { RecipeDialog } from './components/RecipeDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import api from '@/api'
import { Loader2 } from 'lucide-react'
import { PermissionGate } from '@/components/PermissionGate'

interface ProductPricingAnalysis {
  id: string
  name: string
  price: number
  active: boolean
  category: {
    id: string
    name: string
  }
  recipe?: {
    id: string
    totalCost: number
    portionYield: number
  }
  pricingPolicy?: PricingPolicy
}

export default function Pricing() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Dialog states
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false)
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductPricingAnalysis | null>(null)

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [profitabilityFilter, setProfitabilityFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Fetch products with pricing data
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-pricing', venueId, categoryFilter, profitabilityFilter, searchTerm],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: {
          includeRecipe: true,
          includePricingPolicy: true,
          ...(categoryFilter !== 'all' && { categoryId: categoryFilter }),
        },
      })

      let productsData = response.data.data as ProductPricingAnalysis[]

      // Filter products with recipes only (need recipe for pricing analysis)
      productsData = productsData.filter(p => p.recipe)

      // Apply profitability filter
      if (profitabilityFilter !== 'all') {
        productsData = productsData.filter(p => {
          if (!p.recipe) return false
          const foodCostPercentage = (Number(p.recipe.totalCost) / Number(p.price)) * 100

          switch (profitabilityFilter) {
            case 'excellent':
              return foodCostPercentage < 20
            case 'good':
              return foodCostPercentage >= 20 && foodCostPercentage < 30
            case 'acceptable':
              return foodCostPercentage >= 30 && foodCostPercentage < 40
            case 'poor':
              return foodCostPercentage >= 40
            default:
              return true
          }
        })
      }

      // Apply search filter
      if (searchTerm) {
        const lowerSearch = searchTerm.toLowerCase()
        productsData = productsData.filter(
          p =>
            p.name.toLowerCase().includes(lowerSearch) ||
            p.category.name.toLowerCase().includes(lowerSearch),
        )
      }

      return productsData
    },
    enabled: !!venueId,
  })

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

  // Get profitability status
  const getProfitabilityStatus = (foodCostPercentage: number) => {
    if (foodCostPercentage < 20) return 'excellent'
    if (foodCostPercentage < 30) return 'good'
    if (foodCostPercentage < 40) return 'acceptable'
    return 'poor'
  }

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
        header: ({ column }) => (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              {t('pricing.fields.currentPrice')}
              <ArrowUpDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ),
        cell: ({ cell }) => {
          const price = cell.getValue() as number
          return (
            <div className="flex justify-center">
              <span className="text-sm font-semibold text-foreground">
                {Currency(Number(price))}
              </span>
            </div>
          )
        },
      },
      {
        id: 'recipeCost',
        meta: { label: t('pricing.fields.recipeCost') },
        header: ({ column }) => (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              {t('pricing.fields.recipeCost')}
              <ArrowUpDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <div className="flex justify-center"><span className="text-sm text-muted-foreground">-</span></div>

          const totalCost = Number(product.recipe.totalCost)
          return (
            <div className="flex justify-center">
              <span className="text-sm font-medium text-foreground">
                {Currency(totalCost)}
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
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              {t('pricing.fields.foodCostPercentage')}
              <ArrowUpDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <div className="flex justify-center"><span className="text-sm text-muted-foreground">-</span></div>

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
            <div className="flex items-center justify-center gap-2">
              <span className={`text-sm font-semibold ${colorClass}`}>
                {foodCostPercentage.toFixed(1)}%
              </span>
            </div>
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
        header: ({ column }) => (
          <div className="flex justify-center">
            <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
              {t('pricing.fields.contribution')}
              <ArrowUpDown className="w-4 h-4 ml-2" />
            </Button>
          </div>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) return <div className="flex justify-center"><span className="text-sm text-muted-foreground">-</span></div>

          const totalCost = Number(product.recipe.totalCost)
          const price = Number(product.price)
          const contribution = price - totalCost

          return (
            <div className="flex justify-center">
              <span className="text-sm font-medium text-foreground">
                {Currency(contribution)}
              </span>
            </div>
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
        meta: { label: t('common.status') },
        header: t('common.status'),
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
        header: t('pricing.fields.strategy'),
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
                  {hasPolicy ? t('common.edit') : t('pricing.createPolicy')}
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

  const productsNeedingReview = products?.filter(p => {
    if (!p.recipe) return false
    const foodCostPercentage = (Number(p.recipe.totalCost) / Number(p.price)) * 100
    return foodCostPercentage >= 40
  }).length || 0

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('pricing.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('pricing.subtitle')}</p>
          </div>
        </div>

        {/* Stats */}
        {productsNeedingReview > 0 && (
          <button
            type="button"
            onClick={() => setProfitabilityFilter('poor')}
            className="p-4 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 transition-colors cursor-pointer w-full text-left"
            aria-label={t('pricing.filterPoorProfitability', `Filter products with poor profitability (${productsNeedingReview} items)`)}
          >
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
          </button>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('common:search')}
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="max-w-md"
            />
          </div>

          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('rawMaterials.fields.category')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rawMaterials.filters.all')}</SelectItem>
              {categories?.map((category: any) => (
                <SelectItem key={category.id} value={category.id}>
                  {category.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={profitabilityFilter} onValueChange={setProfitabilityFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('common.filter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rawMaterials.filters.all')}</SelectItem>
              <SelectItem value="excellent">{t('pricing.profitabilityStatus.EXCELLENT')}</SelectItem>
              <SelectItem value="good">{t('pricing.profitabilityStatus.GOOD')}</SelectItem>
              <SelectItem value="acceptable">{t('pricing.profitabilityStatus.ACCEPTABLE')}</SelectItem>
              <SelectItem value="poor">{t('pricing.profitabilityStatus.POOR')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={products || []}
        rowCount={products?.length || 0}
        columns={columns}
        isLoading={isLoading}
        tableId="pricing:main"
        enableSearch={false}
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
