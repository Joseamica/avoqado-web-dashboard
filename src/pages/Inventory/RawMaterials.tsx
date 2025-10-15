import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, Package, Plus, Edit, History, TrendingDown, AlertTriangle, Trash2, ChefHat } from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { Currency } from '@/utils/currency'
import { RawMaterialDialog } from './components/RawMaterialDialog'
import { getCategoryInfo, RAW_MATERIAL_CATEGORIES } from '@/lib/inventory-constants'
import { AdjustStockDialog } from './components/AdjustStockDialog'
import { StockMovementsDialog } from './components/StockMovementsDialog'
import { RecipeUsageDialog } from './components/RecipeUsageDialog'
import { RecipeDialog } from './components/RecipeDialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'

export default function RawMaterials() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit, formatUnitWithQuantity } = useUnitTranslation()

  // Dialog states
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [editDialogOpen, setEditDialogOpen] = useState(false)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [movementsDialogOpen, setMovementsDialogOpen] = useState(false)
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false)
  const [recipeUsageDialogOpen, setRecipeUsageDialogOpen] = useState(false)
  const [recipeEditDialogOpen, setRecipeEditDialogOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null)
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<{id: string, name: string, price: number} | null>(null)

  // Filter states
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [stockFilter, setStockFilter] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })

  // Fetch raw materials with filters
  const { data: rawMaterials, isLoading } = useQuery({
    queryKey: ['rawMaterials', venueId, categoryFilter, stockFilter, searchTerm],
    queryFn: async () => {
      const filters = {
        ...(categoryFilter !== 'all' && { category: categoryFilter }),
        ...(stockFilter === 'lowStock' && { lowStock: true }),
        ...(stockFilter === 'active' && { active: true }),
        ...(stockFilter === 'inactive' && { active: false }),
        ...(searchTerm && { search: searchTerm }),
      }
      const response = await rawMaterialsApi.getAll(venueId, filters)
      return response.data.data as RawMaterial[]
    },
    enabled: !!venueId,
  })

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      rawMaterialsApi.update(venueId, id, { active }),
    onSuccess: (_, variables) => {
      // Invalidate all rawMaterials queries for this venue (handles all filter combinations)
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: variables.active ? t('rawMaterials.messages.activated') : t('rawMaterials.messages.deactivated'),
        variant: 'default',
      })
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to update raw material status',
        variant: 'destructive',
      })
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (rawMaterialId: string) => rawMaterialsApi.delete(venueId, rawMaterialId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      toast({
        title: t('rawMaterials.messages.deleted'),
        variant: 'default',
      })
    },
    onError: (error: any) => {
      const errorMessage = error.response?.data?.message || ''

      // Check if error is about material being used in recipes
      if (errorMessage.includes('used in') && errorMessage.includes('recipe')) {
        // Extract the number of recipes from error message
        const recipeCount = errorMessage.match(/used in (\d+) recipe/)?.[1] || '1'

        toast({
          title: t('rawMaterials.messages.cannotDelete'),
          description: t('rawMaterials.messages.usedInRecipes', { count: parseInt(recipeCount) }),
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: errorMessage || t('rawMaterials.messages.deleteFailed'),
          variant: 'destructive',
        })
      }
    },
  })

  const handleDeleteClick = (material: RawMaterial) => {
    setSelectedMaterial(material)
    setDeleteConfirmOpen(true)
  }

  const handleDeleteConfirm = () => {
    if (selectedMaterial) {
      deleteMutation.mutate(selectedMaterial.id)
    }
  }

  const handleRecipeClick = (productId: string, productName: string, productPrice: number) => {
    setSelectedProductForRecipe({ id: productId, name: productName, price: productPrice })
    setRecipeEditDialogOpen(true)
  }

  // Categories for filter - use all categories from constants
  const categories = Object.keys(RAW_MATERIAL_CATEGORIES)

  // Column definitions
  const columns = useMemo<ColumnDef<RawMaterial, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        meta: { label: t('rawMaterials.fields.name') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('rawMaterials.fields.name')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => {
          const material = row.original
          return (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-primary/10 border border-border shadow-sm">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{material.name}</span>
                <span className="text-xs text-muted-foreground">{material.sku}</span>
              </div>
            </div>
          )
        },
      },
      {
        accessorKey: 'category',
        meta: { label: t('rawMaterials.fields.category') },
        header: t('rawMaterials.fields.category'),
        cell: ({ cell }) => {
          const category = cell.getValue() as string
          const categoryInfo = getCategoryInfo(category as any)
          return (
            <Badge variant="outline" className="bg-background">
              {categoryInfo.icon} {t(`rawMaterials.categories.${category}`)}
            </Badge>
          )
        },
      },
      {
        accessorKey: 'currentStock',
        meta: { label: t('rawMaterials.fields.currentStock') },
        header: ({ column }) => (
          <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
            {t('rawMaterials.fields.currentStock')}
            <ArrowUpDown className="w-4 h-4 ml-2" />
          </Button>
        ),
        cell: ({ row }) => {
          const material = row.original
          const stock = Number(material.currentStock)
          const minimumStock = Number(material.minimumStock)
          const reorderPoint = Number(material.reorderPoint)

          const isLowStock = stock <= reorderPoint
          const isOutOfStock = stock === 0

          return (
            <div className="flex items-center gap-2">
              <div className="flex flex-col items-end">
                <span className={`text-sm font-semibold ${isOutOfStock ? 'text-destructive' : isLowStock ? 'text-yellow-600 dark:text-yellow-400' : 'text-foreground'}`}>
                  {stock.toFixed(2)} {formatUnitWithQuantity(stock, material.unit)}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('rawMaterials.fields.minimumStock')}: {minimumStock.toFixed(2)}
                </span>
              </div>
              {isOutOfStock && <AlertTriangle className="h-4 w-4 text-destructive" />}
              {isLowStock && !isOutOfStock && <TrendingDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />}
            </div>
          )
        },
        sortingFn: 'basic',
      },
      {
        accessorKey: 'costPerUnit',
        meta: { label: t('rawMaterials.fields.costPerUnit') },
        header: t('rawMaterials.fields.costPerUnit'),
        cell: ({ row }) => {
          const material = row.original
          return (
            <div className="flex flex-col items-end">
              <span className="text-sm font-medium text-foreground">{Currency(Number(material.costPerUnit))}</span>
              <span className="text-xs text-muted-foreground">
                {t('rawMaterials.fields.avgCostPerUnit')}: {Currency(Number(material.avgCostPerUnit))}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'perishable',
        meta: { label: t('rawMaterials.fields.perishable') },
        header: t('rawMaterials.fields.perishable'),
        cell: ({ row }) => {
          const material = row.original
          if (!material.perishable) {
            return <Badge variant="outline">{t('common.no')}</Badge>
          }
          return (
            <div className="flex flex-col gap-1">
              <Badge variant="secondary">{t('common.yes')}</Badge>
              {material.shelfLifeDays && (
                <span className="text-xs text-muted-foreground">{material.shelfLifeDays} {t('rawMaterials.fields.shelfLifeDays').split(' ')[2]}</span>
              )}
            </div>
          )
        },
      },
      {
        accessorKey: 'usage',
        meta: { label: t('rawMaterials.usage.column') },
        header: t('rawMaterials.usage.column'),
        cell: ({ row }) => {
          const material = row.original
          const recipeCount = material._count?.recipeLines || 0

          return (
            <Button
              variant="ghost"
              size="sm"
              onClick={e => {
                e.stopPropagation()
                setSelectedMaterial(material)
                setRecipeUsageDialogOpen(true)
              }}
              className="gap-2 whitespace-nowrap"
              title={recipeCount > 0 ? t('rawMaterials.usage.inRecipes', { count: recipeCount }) : t('rawMaterials.usage.notUsed')}
            >
              <ChefHat className="h-4 w-4 shrink-0" />
              {recipeCount > 0 ? (
                <span className="text-sm hidden lg:inline">{t('rawMaterials.usage.inRecipes', { count: recipeCount })}</span>
              ) : (
                <span className="text-sm text-muted-foreground hidden lg:inline">{t('rawMaterials.usage.notUsed')}</span>
              )}
            </Button>
          )
        },
      },
      {
        accessorKey: 'active',
        meta: { label: t('rawMaterials.fields.active') },
        header: t('rawMaterials.fields.active'),
        cell: ({ row }) => {
          const material = row.original
          return (
            <Switch
              checked={material.active}
              onCheckedChange={(checked) => toggleActiveMutation.mutate({ id: material.id, active: checked })}
              onClick={e => e.stopPropagation()}
              disabled={toggleActiveMutation.isPending}
            />
          )
        },
      },
      {
        id: 'actions',
        cell: ({ row }) => {
          const material = row.original
          return (
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedMaterial(material)
                  setAdjustStockDialogOpen(true)
                }}
                className="gap-2 whitespace-nowrap"
                title={t('rawMaterials.adjustStock')}
              >
                <TrendingDown className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{t('rawMaterials.adjustStock')}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedMaterial(material)
                  setMovementsDialogOpen(true)
                }}
                className="gap-2 whitespace-nowrap"
                title={t('rawMaterials.viewMovements')}
              >
                <History className="h-4 w-4 shrink-0" />
                <span className="hidden lg:inline">{t('rawMaterials.viewMovements')}</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  setSelectedMaterial(material)
                  setEditDialogOpen(true)
                }}
                title={t('common.edit')}
              >
                <Edit className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={e => {
                  e.stopPropagation()
                  handleDeleteClick(material)
                }}
                disabled={deleteMutation.isPending}
                title={t('common.delete')}
              >
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </div>
          )
        },
      },
    ],
    [t, formatUnit, formatUnitWithQuantity, deleteMutation.isPending, toggleActiveMutation],
  )

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-4 mb-6">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">{t('rawMaterials.title')}</h1>
            <p className="text-sm text-muted-foreground">{t('rawMaterials.subtitle')}</p>
          </div>
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="h-4 w-4 mr-2" />
            {t('rawMaterials.add')}
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex-1">
            <Input
              placeholder={t('rawMaterials.filters.search')}
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
              {categories.map(category => {
                const categoryInfo = getCategoryInfo(category as any)
                return (
                  <SelectItem key={category} value={category}>
                    {categoryInfo.icon} {t(`rawMaterials.categories.${category}`)}
                  </SelectItem>
                )
              })}
            </SelectContent>
          </Select>

          <Select value={stockFilter} onValueChange={setStockFilter}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={t('common.filter')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('rawMaterials.filters.all')}</SelectItem>
              <SelectItem value="lowStock">{t('rawMaterials.filters.lowStock')}</SelectItem>
              <SelectItem value="active">{t('rawMaterials.filters.active')}</SelectItem>
              <SelectItem value="inactive">{t('rawMaterials.filters.inactive')}</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Data Table */}
      <DataTable
        data={rawMaterials || []}
        rowCount={rawMaterials?.length || 0}
        columns={columns}
        isLoading={isLoading}
        tableId="rawMaterials:main"
        enableSearch={false} // We're using custom search
        pagination={pagination}
        setPagination={setPagination}
      />

      {/* Dialogs */}
      <RawMaterialDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" />

      <RawMaterialDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        mode="edit"
        rawMaterial={selectedMaterial}
      />

      <AdjustStockDialog
        open={adjustStockDialogOpen}
        onOpenChange={setAdjustStockDialogOpen}
        rawMaterial={selectedMaterial}
      />

      <StockMovementsDialog
        open={movementsDialogOpen}
        onOpenChange={setMovementsDialogOpen}
        rawMaterial={selectedMaterial}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('rawMaterials.delete')}
        description={`${t('common.confirm')}? ${t('rawMaterials.delete')} "${selectedMaterial?.name}"`}
        confirmText={t('common.delete')}
        cancelText={t('common.cancel')}
        variant="destructive"
        onConfirm={handleDeleteConfirm}
      />

      {/* Recipe Usage Dialog */}
      <RecipeUsageDialog
        open={recipeUsageDialogOpen}
        onOpenChange={setRecipeUsageDialogOpen}
        rawMaterial={selectedMaterial}
        onRecipeClick={handleRecipeClick}
      />

      {/* Recipe Edit Dialog */}
      {selectedProductForRecipe && (
        <RecipeDialog
          open={recipeEditDialogOpen}
          onOpenChange={setRecipeEditDialogOpen}
          mode="edit"
          product={selectedProductForRecipe}
        />
      )}
    </div>
  )
}
