import { useState, useMemo, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
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
import { PermissionGate } from '@/components/PermissionGate'

export default function RawMaterials() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit, formatUnitWithQuantity } = useUnitTranslation()
  const [searchParams, setSearchParams] = useSearchParams()

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

  // Handle highlight from notifications
  const highlightId = searchParams.get('highlight')

  useEffect(() => {
    if (!highlightId || !rawMaterials || isLoading) {
      console.log('Highlight check:', { highlightId, hasRawMaterials: !!rawMaterials, isLoading })
      return
    }

    try {
      // Find the material to highlight
      const materialIndex = rawMaterials.findIndex(m => m.id === highlightId)
      console.log('Looking for material with ID:', highlightId)
      console.log('Material found at index:', materialIndex)
      console.log('Current filters:', { categoryFilter, stockFilter, searchTerm })

      if (materialIndex === -1) {
        console.warn('Material not found in current list. ID:', highlightId)
        console.log('Available materials:', rawMaterials.map(m => ({ id: m.id, name: m.name })))

        // Check if filters are applied
        const hasFilters = categoryFilter !== 'all' || stockFilter !== 'all' || searchTerm !== ''

        if (hasFilters) {
          console.log('Filters detected, clearing them to find material...')
          // Clear filters to show all materials
          setCategoryFilter('all')
          setStockFilter('all')
          setSearchTerm('')
          // Don't remove highlight param yet - let it retry after filters clear
          return
        }

        // If no filters are applied and still not found, material truly doesn't exist
        console.error('Material not found even without filters')
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('highlight')
        setSearchParams(newParams, { replace: true })
        return
      }

      const targetMaterial = rawMaterials[materialIndex]
      console.log('Target material:', { id: targetMaterial.id, name: targetMaterial.name, sku: targetMaterial.sku })

      // Calculate which page the material is on
      const pageSize = pagination.pageSize
      const targetPage = Math.floor(materialIndex / pageSize)
      const rowIndexInPage = materialIndex % pageSize

      console.log('Pagination info:', {
        materialIndex,
        pageSize,
        currentPage: pagination.pageIndex,
        targetPage,
        rowIndexInPage
      })

      // If material is on a different page, change to that page
      if (targetPage !== pagination.pageIndex) {
        console.log(`Material is on page ${targetPage}, switching from page ${pagination.pageIndex}...`)
        setPagination({ ...pagination, pageIndex: targetPage })
        // Don't remove highlight param yet - let it retry after page changes
        return
      }

      console.log('Material is on current page, proceeding to highlight...')

      // Small delay to ensure table is rendered
      const timeoutId = setTimeout(() => {
        try {
          console.log('Searching for row in DOM...')
          // Find the row element - use row index within current page
          const rowElements = document.querySelectorAll('tbody tr')
          console.log('Total rows found:', rowElements.length)
          console.log('Looking for row at index:', rowIndexInPage)

          // Use the row index within the current page
          const row = Array.from(rowElements)[rowIndexInPage]

          if (row) {
            console.log('Row found! Highlighting...')
            try {
              // Scroll into view
              row.scrollIntoView({ behavior: 'smooth', block: 'center' })

              // Detect if dark mode is active
              const isDarkMode = document.documentElement.classList.contains('dark')

              // Apply theme-appropriate highlight color
              if (isDarkMode) {
                // Dark mode: use amber/orange glow
                row.style.backgroundColor = 'rgba(251, 146, 60, 0.3)' // orange-400 with opacity
                row.style.boxShadow = '0 0 20px rgba(251, 146, 60, 0.4)'
              } else {
                // Light mode: use yellow
                row.style.backgroundColor = 'rgba(254, 243, 199, 0.9)' // yellow-100
                row.style.boxShadow = '0 0 10px rgba(251, 191, 36, 0.3)'
              }

              row.style.transition = 'all 0.3s ease-in-out'
              row.classList.add('animate-pulse')

              // Remove animation after 3 seconds
              setTimeout(() => {
                try {
                  console.log('Removing highlight animation')
                  row.classList.remove('animate-pulse')
                  row.style.backgroundColor = ''
                  row.style.boxShadow = ''

                  // Remove the highlight param from URL
                  const newParams = new URLSearchParams(searchParams)
                  newParams.delete('highlight')
                  setSearchParams(newParams, { replace: true })
                } catch (cleanupError) {
                  console.error('Error cleaning up highlight:', cleanupError)
                }
              }, 3000)
            } catch (animationError) {
              console.error('Error applying highlight animation:', animationError)
              // Remove highlight param even if animation fails
              const newParams = new URLSearchParams(searchParams)
              newParams.delete('highlight')
              setSearchParams(newParams, { replace: true })
            }
          } else {
            console.warn('Row element not found in DOM')
            console.log('Row index in page:', rowIndexInPage, 'Available rows:', rowElements.length, 'Material global index:', materialIndex)
            // Remove highlight param if row not found
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('highlight')
            setSearchParams(newParams, { replace: true })
          }
        } catch (domError) {
          console.error('Error in DOM manipulation:', domError)
          // Remove highlight param on error
          try {
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('highlight')
            setSearchParams(newParams, { replace: true })
          } catch (paramError) {
            console.error('Error removing highlight param after DOM error:', paramError)
          }
        }
      }, 1000) // Increased delay to ensure table is fully rendered

      // Cleanup function
      return () => {
        clearTimeout(timeoutId)
      }
    } catch (error) {
      console.error('Error in highlight detection:', error)
      // Remove highlight param on any error to prevent infinite loops
      try {
        const newParams = new URLSearchParams(searchParams)
        newParams.delete('highlight')
        setSearchParams(newParams, { replace: true })
      } catch (paramError) {
        console.error('Error removing highlight param:', paramError)
      }
    }
  }, [highlightId, rawMaterials, isLoading, searchParams, setSearchParams, categoryFilter, stockFilter, searchTerm, pagination])

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
              <PermissionGate permission="inventory:adjust">
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
              </PermissionGate>
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
              <PermissionGate permission="inventory:update">
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
              </PermissionGate>
              <PermissionGate permission="inventory:delete">
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
              </PermissionGate>
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
          <PermissionGate permission="inventory:create">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('rawMaterials.add')}
            </Button>
          </PermissionGate>
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
