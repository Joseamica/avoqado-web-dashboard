import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, ChefHat, Plus, Edit, AlertCircle, DollarSign, RefreshCcw } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { type Recipe } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { RecipeDialog } from './components/RecipeDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import api from '@/api'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

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
}

export default function Recipes() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const queryClient = useQueryClient()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<ProductWithRecipe | null>(null)

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [recipeFilter, setRecipeFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Fetch products with recipes
  const { data: products, isLoading, refetch } = useQuery({
    queryKey: ['products-with-recipes', venueId, categoryFilter, recipeFilter, searchTerm],
    queryFn: async () => {
      const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`, {
        params: {
          includeRecipe: true,
          ...(categoryFilter !== 'all' && { categoryId: categoryFilter }),
        },
      })

      let productsData = response.data.data as ProductWithRecipe[]

      // Apply recipe filter
      if (recipeFilter === 'withRecipe') {
        productsData = productsData.filter(p => p.recipe)
      } else if (recipeFilter === 'withoutRecipe') {
        productsData = productsData.filter(p => !p.recipe)
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
                  hasRecipe
                    ? 'bg-green-50 dark:bg-green-950/50'
                    : 'bg-muted'
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
          return (
            <div className="text-sm font-medium text-foreground">
              {Currency(Number(price))}
            </div>
          )
        },
      },
      {
        id: 'recipeStatus',
        meta: { label: t('common.status') },
        header: t('common.status'),
        cell: ({ row }) => {
          const product = row.original
          const hasRecipe = !!product.recipe

          if (!hasRecipe) {
            return (
              <Badge variant="secondary" className="bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800 truncate max-w-[150px]">
                {t('recipes.messages.noRecipeShort')}
              </Badge>
            )
          }

          return (
            <Badge variant="default" className="bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800">
              {product.recipe.lines.length} {t('recipes.ingredients.title')}
            </Badge>
          )
        },
      },
      {
        id: 'portionYield',
        meta: { label: t('recipes.fields.portionYield') },
        header: t('recipes.fields.portionYield'),
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
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('recipes.fields.totalCost')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => {
          const product = row.original
          if (!product.recipe) {
            return <span className="text-sm text-muted-foreground">-</span>
          }

          const totalCost = Number(product.recipe.totalCost)
          const costPerServing = totalCost / product.recipe.portionYield

          return (
            <div className="flex flex-col items-end">
              <span className="text-sm font-semibold text-foreground">{Currency(totalCost)}</span>
              <span className="text-xs text-muted-foreground">
                {Currency(costPerServing)} / {t('recipes.fields.costPerServing').split(' ')[0]}
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
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('pricing.fields.foodCostPercentage')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
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
            <div className="flex items-center gap-2">
              <DollarSign className={`h-4 w-4 ${colorClass}`} />
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
        id: 'actions',
        cell: ({ row }) => {
          const product = row.original
          const hasRecipe = !!product.recipe

          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                setSelectedProduct(product)
                if (hasRecipe) {
                  setEditDialogOpen(true)
                } else {
                  setCreateDialogOpen(true)
                }
              }}
            >
              {hasRecipe ? (
                <>
                  <Edit className="h-4 w-4 mr-1" />
                  {t('common.edit')}
                </>
              ) : (
                <>
                  <Plus className="h-4 w-4 mr-1" />
                  {t('recipes.add')}
                </>
              )}
            </Button>
          )
        },
      },
    ],
    [t],
  )

  const productsWithoutRecipes = products?.filter(p => !p.recipe).length || 0

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('recipes.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('recipes.subtitle')}</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              queryClient.invalidateQueries({
                queryKey: ['products-with-recipes'],
                refetchType: 'active'
              })
            }}
            disabled={isLoading}
          >
            <RefreshCcw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            {t('common.refresh')}
          </Button>
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

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('common.search')}
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

          <Select value={recipeFilter} onValueChange={setRecipeFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('common.filter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rawMaterials.filters.all')}</SelectItem>
              <SelectItem value="withRecipe">{t('recipes.filters.withRecipe')}</SelectItem>
              <SelectItem value="withoutRecipe">{t('recipes.filters.withoutRecipe')}</SelectItem>
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
        tableId="recipes:main"
        enableSearch={false}
        pagination={pagination}
        setPagination={setPagination}
      />

      {/* Dialogs */}
      <RecipeDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        mode="create"
        product={selectedProduct}
      />

      <RecipeDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        product={selectedProduct}
      />
    </div>
  )
}
