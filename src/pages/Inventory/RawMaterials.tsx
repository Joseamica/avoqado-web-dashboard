import { useState, useMemo, useEffect, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import {
  ArrowUpDown,
  Plus,
  Edit,
  History,
  TrendingDown,
  AlertTriangle,
  Trash2,
  ChefHat,
  DollarSign,
  Clock,
  Info,
  MoreHorizontal,
  Search,
  X,
} from 'lucide-react'
import DataTable from '@/components/data-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useDebounce } from '@/hooks/useDebounce'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { purchaseOrderService, PurchaseOrderStatus } from '@/services/purchaseOrder.service'
import { AddToAIButton } from '@/components/AddToAIButton'
import { Currency } from '@/utils/currency'
import { RawMaterialDialog } from './components/RawMaterialDialog'
import { getCategoryInfo, RAW_MATERIAL_CATEGORIES } from '@/lib/inventory-constants'
import { AdjustStockDialog } from './components/AdjustStockDialog'
import { StockMovementsDialog } from './components/StockMovementsDialog'
import { RecipeUsageDialog } from './components/RecipeUsageDialog'
import { RecipeDialog } from './components/RecipeDialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { PermissionGate } from '@/components/PermissionGate'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { FilterPill } from '@/components/filters/FilterPill'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { RangeFilterContent } from '@/components/filters/RangeFilterContent'
import { ColumnCustomizer } from '@/components/filters/ColumnCustomizer'

export default function RawMaterials() {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { checkFeatureAccess } = useAuth()
  const hasChatbot = checkFeatureAccess('CHATBOT')
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
  const [selectedProductForRecipe, setSelectedProductForRecipe] = useState<{ id: string; name: string; price: number } | null>(null)

  // Filter states - Stripe-style multi-select arrays
  const [categoryFilter, setCategoryFilter] = useState<string[]>([])
  const [stockStatusFilter, setStockStatusFilter] = useState<string[]>([])
  const [perishableFilter, setPerishableFilter] = useState<string[]>([])
  const [usageFilter, setUsageFilter] = useState<string[]>([])
  const [stockRange, setStockRange] = useState<{ min: string; max: string } | null>(null)
  const [confirmedStockRange, setConfirmedStockRange] = useState<{ min: string; max: string } | null>(null)
  const [costRange, setCostRange] = useState<{ min: string; max: string } | null>(null)

  // Search state
  const [searchTerm, setSearchTerm] = useState(searchParams.get('search') || '')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const debouncedSearchTerm = useDebounce(searchTerm, 300)

  // Column visibility
  const [visibleColumns, setVisibleColumns] = useState<string[]>([
    'name',
    'currentStock',
    'confirmedStock',
    'costPerUnit',
    'perishable',
    'usage',
    'active',
    'actions',
  ])

  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 20,
  })

  // Fetch raw materials - minimal backend filtering, do most client-side
  const { data: rawMaterialsData, isLoading } = useQuery({
    queryKey: ['rawMaterials', venueId, debouncedSearchTerm],
    queryFn: async () => {
      const filters = {
        ...(debouncedSearchTerm && { search: debouncedSearchTerm }),
      }
      const response = await rawMaterialsApi.getAll(venueId, filters)
      return response.data.data as RawMaterial[]
    },
    enabled: !!venueId,
  })

  // Fetch purchase orders for confirmed stock calculation (must be before rawMaterials useMemo)
  const { data: confirmedStockData } = useQuery({
    queryKey: ['purchase-orders-confirmed-stock', venueId],
    queryFn: async () => {
      const response = await purchaseOrderService.getPurchaseOrders(venueId!, {
        status: [
          PurchaseOrderStatus.SENT,
          PurchaseOrderStatus.CONFIRMED,
          PurchaseOrderStatus.SHIPPED,
          PurchaseOrderStatus.PARTIAL,
        ],
      })

      // Calculate confirmed stock per raw material
      const confirmedStockMap = new Map<string, number>()

      // response.data is the array of PurchaseOrders (not response.data.data)
      if (response.data) {
        for (const po of response.data) {
          for (const item of po.items) {
            const currentConfirmed = confirmedStockMap.get(item.rawMaterialId) || 0
            // Prisma Decimals are serialized as strings, convert to numbers
            const pendingQuantity = Number(item.quantityOrdered) - Number(item.quantityReceived)
            confirmedStockMap.set(item.rawMaterialId, currentConfirmed + pendingQuantity)
          }
        }
      }

      return confirmedStockMap
    },
    enabled: !!venueId,
  })

  // Client-side filtering for all Stripe-style filters
  const rawMaterials = useMemo(() => {
    let materials = rawMaterialsData || []

    // Category filter
    if (categoryFilter.length > 0) {
      materials = materials.filter(m => categoryFilter.includes(m.category))
    }

    // Stock status filter
    if (stockStatusFilter.length > 0) {
      materials = materials.filter(m => {
        const stock = Number(m.currentStock)
        const reorderPoint = Number(m.reorderPoint)
        const isLowStock = stock <= reorderPoint && stock > 0
        const isOutOfStock = stock === 0
        const isActive = m.active
        const isInactive = !m.active

        for (const status of stockStatusFilter) {
          if (status === 'lowStock' && isLowStock) return true
          if (status === 'outOfStock' && isOutOfStock) return true
          if (status === 'active' && isActive) return true
          if (status === 'inactive' && isInactive) return true
          if (status === 'inStock' && stock > reorderPoint) return true
        }
        return false
      })
    }

    // Stock range filter
    if (stockRange) {
      materials = materials.filter(m => {
        const stock = Number(m.currentStock)
        const min = stockRange.min ? parseFloat(stockRange.min) : -Infinity
        const max = stockRange.max ? parseFloat(stockRange.max) : Infinity
        return stock >= min && stock <= max
      })
    }

    // Confirmed stock range filter
    if (confirmedStockRange && confirmedStockData) {
      materials = materials.filter(m => {
        const confirmed = confirmedStockData.get(m.id) || 0
        const min = confirmedStockRange.min ? parseFloat(confirmedStockRange.min) : -Infinity
        const max = confirmedStockRange.max ? parseFloat(confirmedStockRange.max) : Infinity
        return confirmed >= min && confirmed <= max
      })
    }

    // Cost range filter
    if (costRange) {
      materials = materials.filter(m => {
        const cost = Number(m.costPerUnit)
        const min = costRange.min ? parseFloat(costRange.min) : -Infinity
        const max = costRange.max ? parseFloat(costRange.max) : Infinity
        return cost >= min && cost <= max
      })
    }

    // Perishable filter
    if (perishableFilter.length > 0) {
      materials = materials.filter(m => {
        if (perishableFilter.includes('yes') && m.perishable) return true
        if (perishableFilter.includes('no') && !m.perishable) return true
        return false
      })
    }

    // Usage filter (used in recipes)
    if (usageFilter.length > 0) {
      materials = materials.filter(m => {
        const recipeCount = m._count?.recipeLines || 0
        if (usageFilter.includes('used') && recipeCount > 0) return true
        if (usageFilter.includes('notUsed') && recipeCount === 0) return true
        return false
      })
    }

    return materials
  }, [rawMaterialsData, categoryFilter, stockStatusFilter, stockRange, confirmedStockRange, costRange, perishableFilter, usageFilter, confirmedStockData])

  // Handle highlight from notifications
  const highlightId = searchParams.get('highlight')

  useEffect(() => {
    if (!highlightId || !rawMaterials || isLoading) {
      return
    }

    try {
      // Find the material to highlight
      const materialIndex = rawMaterials.findIndex(m => m.id === highlightId)

      if (materialIndex === -1) {
        // Check if filters are applied
        const hasFilters = categoryFilter.length > 0 || stockStatusFilter.length > 0 || searchTerm !== '' ||
                          stockRange !== null || confirmedStockRange !== null || costRange !== null ||
                          perishableFilter.length > 0 || usageFilter.length > 0

        if (hasFilters) {
          // Clear filters to show all materials
          setCategoryFilter([])
          setStockStatusFilter([])
          setSearchTerm('')
          setStockRange(null)
          setConfirmedStockRange(null)
          setCostRange(null)
          setPerishableFilter([])
          setUsageFilter([])
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
        rowIndexInPage,
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
          const row = Array.from(rowElements)[rowIndexInPage] as HTMLElement

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
            console.log(
              'Row index in page:',
              rowIndexInPage,
              'Available rows:',
              rowElements.length,
              'Material global index:',
              materialIndex,
            )
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
  }, [highlightId, rawMaterials, isLoading, searchParams, setSearchParams, categoryFilter, stockStatusFilter, searchTerm, pagination, stockRange, confirmedStockRange, costRange, perishableFilter, usageFilter])

  // Handle openRestock param
  const openRestock = searchParams.get('openRestock') === 'true'
  useEffect(() => {
    if (openRestock && rawMaterials && !isLoading && rawMaterials.length > 0) {
        // Try to find exact match if search term exists, otherwise take first
        const search = searchParams.get('search')
        const targetMaterial = search 
            ? rawMaterials.find(m => m.name.toLowerCase() === search.toLowerCase()) || rawMaterials[0]
            : rawMaterials[0]
            
        if (targetMaterial) {
            setSelectedMaterial(targetMaterial)
            setAdjustStockDialogOpen(true)
            
            // Clean up param
            const newParams = new URLSearchParams(searchParams)
            newParams.delete('openRestock')
            setSearchParams(newParams, { replace: true })
        }
    }
  }, [openRestock, rawMaterials, isLoading, searchParams, setSearchParams])

  // Toggle active mutation
  const toggleActiveMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) => rawMaterialsApi.update(venueId, id, { active }),
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

  // Options for category filter (Stripe-style)
  const categoryOptions = useMemo(() =>
    categories.map(category => ({
      value: category,
      label: t(`rawMaterials.categories.${category}`),
    })),
    [categories, t]
  )

  // Options for stock status filter
  const stockStatusOptions = useMemo(() => [
    { value: 'inStock', label: t('rawMaterials.filters.inStock', { defaultValue: 'En stock' }) },
    { value: 'lowStock', label: t('rawMaterials.filters.lowStock') },
    { value: 'outOfStock', label: t('rawMaterials.filters.outOfStock', { defaultValue: 'Sin stock' }) },
    { value: 'active', label: t('rawMaterials.filters.active') },
    { value: 'inactive', label: t('rawMaterials.filters.inactive') },
  ], [t])

  // Options for perishable filter
  const perishableOptions = useMemo(() => [
    { value: 'yes', label: tCommon('yes') },
    { value: 'no', label: tCommon('no') },
  ], [tCommon])

  // Options for usage filter
  const usageOptions = useMemo(() => [
    { value: 'used', label: t('rawMaterials.usage.inRecipesFilter', { defaultValue: 'Usado en recetas' }) },
    { value: 'notUsed', label: t('rawMaterials.usage.notUsed') },
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
    if (stockStatusFilter.length > 0) count++
    if (stockRange) count++
    if (confirmedStockRange) count++
    if (costRange) count++
    if (perishableFilter.length > 0) count++
    if (usageFilter.length > 0) count++
    return count
  }, [searchTerm, categoryFilter, stockStatusFilter, stockRange, confirmedStockRange, costRange, perishableFilter, usageFilter])

  // Clear all filters
  const clearAllFilters = useCallback(() => {
    setSearchTerm('')
    setIsSearchOpen(false)
    setCategoryFilter([])
    setStockStatusFilter([])
    setStockRange(null)
    setConfirmedStockRange(null)
    setCostRange(null)
    setPerishableFilter([])
    setUsageFilter([])
  }, [])

  // Column options for customizer
  const columnOptions = useMemo(() => [
    { id: 'name', label: t('rawMaterials.fields.name'), visible: visibleColumns.includes('name') },
    { id: 'currentStock', label: t('rawMaterials.fields.currentStock'), visible: visibleColumns.includes('currentStock') },
    { id: 'confirmedStock', label: t('rawMaterials.fields.confirmedStock'), visible: visibleColumns.includes('confirmedStock') },
    { id: 'costPerUnit', label: t('rawMaterials.fields.costPerUnit'), visible: visibleColumns.includes('costPerUnit') },
    { id: 'perishable', label: t('rawMaterials.fields.perishable'), visible: visibleColumns.includes('perishable') },
    { id: 'usage', label: t('rawMaterials.usage.column'), visible: visibleColumns.includes('usage') },
    { id: 'active', label: t('rawMaterials.fields.active'), visible: visibleColumns.includes('active') },
  ], [t, visibleColumns])

  // Column definitions
  const columns = useMemo<ColumnDef<RawMaterial, unknown>[]>(
    () => [
      // AI column - only show if venue has chatbot feature
      ...(hasChatbot
        ? [
            {
              id: 'ai',
              header: () => <span className="sr-only">{tCommon('screenReaderOnly.ai')}</span>,
              cell: ({ row }: { row: { original: RawMaterial } }) => (
                <div className="flex justify-center">
                  <AddToAIButton type="rawMaterial" data={row.original} variant="icon" />
                </div>
              ),
              size: 50,
              enableSorting: false,
            } as ColumnDef<RawMaterial, unknown>,
          ]
        : []),
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
          const categoryInfo = getCategoryInfo(material.category as any)
          return (
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="bg-background flex items-center gap-1.5 px-2 py-1 shrink-0"
                title={t(`rawMaterials.categories.${material.category}`)}
              >
                <span className="text-base" aria-hidden>
                  {categoryInfo.icon}
                </span>
                <span className="hidden xl:inline text-xs">{t(`rawMaterials.categories.${material.category}`)}</span>
              </Badge>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-medium text-foreground truncate">{material.name}</span>
                <span className="text-xs text-muted-foreground truncate hidden xl:inline">{material.sku}</span>
              </div>
            </div>
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
            <div className="flex items-center gap-1">
              <div className="flex flex-col items-end">
                <span
                  className={`text-sm font-semibold underline decoration-dotted underline-offset-4 cursor-pointer ${
                    isOutOfStock ? 'text-destructive decoration-destructive/50' : isLowStock ? 'text-yellow-600 dark:text-yellow-400 decoration-yellow-600/50 dark:decoration-yellow-400/50' : 'text-foreground decoration-muted-foreground/50'
                  }`}
                >
                  {stock.toFixed(2)} <span className="hidden xl:inline">{formatUnitWithQuantity(stock, material.unit)}</span>
                </span>
                <span className="text-xs text-muted-foreground hidden 2xl:inline">
                  {t('rawMaterials.fields.minimumStock')}: {minimumStock.toFixed(2)}
                </span>
              </div>
              {isOutOfStock && <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />}
              {isLowStock && !isOutOfStock && <TrendingDown className="h-4 w-4 text-yellow-600 dark:text-yellow-400 shrink-0" />}
            </div>
          )
        },
        sortingFn: 'basic',
      },
      {
        id: 'confirmedStock',
        accessorFn: (row) => confirmedStockData?.get(row.id) || 0,
        meta: { label: t('rawMaterials.fields.confirmedStock') },
        header: () => (
          <div className="flex items-center justify-center">
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 2xl:hidden cursor-pointer" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>{t('rawMaterials.fields.confirmedStockTooltip')}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <span className="hidden 2xl:inline">{t('rawMaterials.fields.confirmedStock')}</span>
          </div>
        ),
        cell: ({ row }) => {
          const material = row.original
          const confirmed = confirmedStockData?.get(material.id) || 0

          return (
            <div className="flex flex-col items-center">
              <Badge variant="secondary" className="min-w-[60px] justify-center bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800">
                {confirmed.toFixed(2)} <span className="hidden xl:inline ml-1">{formatUnitWithQuantity(confirmed, material.unit)}</span>
              </Badge>
              {confirmed > 0 && (
                <span className="text-xs text-muted-foreground mt-0.5 hidden 2xl:inline">{t('rawMaterials.inTransit')}</span>
              )}
            </div>
          )
        },
        enableSorting: true,
        sortingFn: 'basic',
      },
      {
        accessorKey: 'costPerUnit',
        meta: { label: t('rawMaterials.fields.costPerUnit') },
        header: () => (
          <div className="flex items-center justify-center">
            <DollarSign className="h-4 w-4 2xl:hidden" />
            <span className="hidden 2xl:inline">{t('rawMaterials.fields.costPerUnit')}</span>
          </div>
        ),
        cell: ({ row }) => {
          const material = row.original
          return (
            <div className="flex flex-col items-center 2xl:items-end">
              <div className="flex items-center gap-1">
                <DollarSign className="h-3 w-3 2xl:hidden text-muted-foreground" />
                <span className="text-sm font-medium text-foreground">{Currency(Number(material.costPerUnit))}</span>
              </div>
              <span className="text-xs text-muted-foreground hidden 2xl:inline">
                {t('rawMaterials.fields.avgCostPerUnit')}: {Currency(Number(material.avgCostPerUnit))}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'perishable',
        meta: { label: t('rawMaterials.fields.perishable') },
        header: () => (
          <div className="flex items-center justify-center">
            <Clock className="h-4 w-4 2xl:hidden" />
            <span className="hidden 2xl:inline">{t('rawMaterials.fields.perishable')}</span>
          </div>
        ),
        cell: ({ row }) => {
          const material = row.original
          if (!material.perishable) {
            return (
              <div className="flex justify-center">
                <Badge variant="outline" className="2xl:inline-flex">
                  <span className="2xl:hidden">✖️</span>
                  <span className="hidden 2xl:inline">{tCommon('no')}</span>
                </Badge>
              </div>
            )
          }
          return (
            <div className="flex flex-col gap-1 items-center">
              <Badge variant="secondary" className="flex items-center gap-1">
                <Clock className="h-3 w-3 2xl:hidden" />
                <span className="hidden 2xl:inline">{tCommon('yes')}</span>
              </Badge>
              {material.shelfLifeDays && (
                <span className="text-xs text-muted-foreground hidden 2xl:inline">
                  {material.shelfLifeDays} {t('rawMaterials.fields.shelfLifeDays').split(' ')[2]}
                </span>
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
              className="gap-1 whitespace-nowrap px-1"
              title={recipeCount > 0 ? t('rawMaterials.usage.inRecipes', { count: recipeCount }) : t('rawMaterials.usage.notUsed')}
            >
              <ChefHat className="h-4 w-4 shrink-0" />
              {recipeCount > 0 ? (
                <span className="text-sm hidden 2xl:inline underline underline-offset-4 decoration-foreground/50">{t('rawMaterials.usage.inRecipes', { count: recipeCount })}</span>
              ) : (
                <span className="text-sm text-muted-foreground hidden 2xl:inline underline underline-offset-4 decoration-muted-foreground/50">{t('rawMaterials.usage.notUsed')}</span>
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
              onCheckedChange={checked => toggleActiveMutation.mutate({ id: material.id, active: checked })}
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  onClick={e => e.stopPropagation()}
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">{tCommon('actions')}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <PermissionGate permission="inventory:adjust">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedMaterial(material)
                      setAdjustStockDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <TrendingDown className="h-4 w-4 mr-2" />
                    {t('rawMaterials.adjustStock')}
                  </DropdownMenuItem>
                </PermissionGate>
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    setSelectedMaterial(material)
                    setMovementsDialogOpen(true)
                  }}
                  className="cursor-pointer"
                >
                  <History className="h-4 w-4 mr-2" />
                  {t('rawMaterials.viewMovements')}
                </DropdownMenuItem>
                <PermissionGate permission="inventory:update">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setSelectedMaterial(material)
                      setEditDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <Edit className="h-4 w-4 mr-2" />
                    {tCommon('edit')}
                  </DropdownMenuItem>
                </PermissionGate>
                <PermissionGate permission="inventory:delete">
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      handleDeleteClick(material)
                    }}
                    disabled={deleteMutation.isPending}
                    className="cursor-pointer text-destructive focus:text-destructive"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {tCommon('delete')}
                  </DropdownMenuItem>
                </PermissionGate>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [t, formatUnit, formatUnitWithQuantity, deleteMutation.isPending, toggleActiveMutation, hasChatbot, confirmedStockData],
  )

  // Filter columns based on visibility
  const filteredColumns = useMemo(
    () =>
      columns.filter(col => {
        const colId = col.id || (col as any).accessorKey
        if (!colId) return true
        if (colId === 'actions' || colId === 'ai') return true // Always show actions and AI columns
        return visibleColumns.includes(colId)
      }),
    [columns, visibleColumns]
  )

  return (
    <div className="p-4 bg-background text-foreground">
      {/* Header */}
      <div className="flex flex-col gap-3 mb-3">
        <div className="flex flex-row items-center justify-between">
          <div>
            <PageTitleWithInfo
              title={t('rawMaterials.title')}
              className="text-xl font-semibold"
              tooltip={t('info.rawMaterials', {
                defaultValue: 'Gestiona materias primas, existencias, costos y alertas de stock bajo.',
              })}
            />
            <p className="text-sm text-muted-foreground">{t('rawMaterials.subtitle')}</p>
          </div>
          <PermissionGate permission="inventory:create">
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              {t('rawMaterials.add')}
            </Button>
          </PermissionGate>
        </div>

        {/* Onboarding Banner */}
        {!isLoading && rawMaterials?.length === 0 && activeFiltersCount === 0 && (
          <Alert className="mb-2 border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
            <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            <AlertTitle className="text-blue-800 dark:text-blue-300">{t('onboarding.title')}</AlertTitle>
            <AlertDescription className="text-blue-700 dark:text-blue-400">{t('onboarding.description')}</AlertDescription>
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
                    placeholder={t('rawMaterials.filters.search')}
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
                {searchTerm && <span className="sr-only">{t('rawMaterials.filters.searchActive', { defaultValue: 'Búsqueda activa' })}</span>}
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

          {/* Stock Status Filter */}
          <FilterPill
            label={t('rawMaterials.filters.stockStatus', { defaultValue: 'Estado de stock' })}
            isActive={stockStatusFilter.length > 0}
            activeLabel={getFilterDisplayLabel(stockStatusFilter, stockStatusOptions)}
            onClear={() => setStockStatusFilter([])}
          >
            <CheckboxFilterContent
              title={t('rawMaterials.filters.stockStatus', { defaultValue: 'Estado de stock' })}
              options={stockStatusOptions}
              selectedValues={stockStatusFilter}
              onApply={setStockStatusFilter}
            />
          </FilterPill>

          {/* Stock Range Filter */}
          <FilterPill
            label={t('rawMaterials.fields.currentStock')}
            isActive={stockRange !== null}
            activeLabel={stockRange ? `${stockRange.min || '0'} - ${stockRange.max || '∞'}` : null}
            onClear={() => setStockRange(null)}
          >
            <RangeFilterContent
              title={t('rawMaterials.fields.currentStock')}
              currentRange={stockRange}
              onApply={setStockRange}
              placeholder="0"
            />
          </FilterPill>

          {/* Confirmed Stock Range Filter */}
          <FilterPill
            label={t('rawMaterials.fields.confirmedStock')}
            isActive={confirmedStockRange !== null}
            activeLabel={confirmedStockRange ? `${confirmedStockRange.min || '0'} - ${confirmedStockRange.max || '∞'}` : null}
            onClear={() => setConfirmedStockRange(null)}
          >
            <RangeFilterContent
              title={t('rawMaterials.fields.confirmedStock')}
              currentRange={confirmedStockRange}
              onApply={setConfirmedStockRange}
              placeholder="0"
            />
          </FilterPill>

          {/* Cost Range Filter */}
          <FilterPill
            label={t('rawMaterials.fields.costPerUnit')}
            isActive={costRange !== null}
            activeLabel={costRange ? `$${costRange.min || '0'} - $${costRange.max || '∞'}` : null}
            onClear={() => setCostRange(null)}
          >
            <RangeFilterContent
              title={t('rawMaterials.fields.costPerUnit')}
              currentRange={costRange}
              onApply={setCostRange}
              prefix="$"
              placeholder="0"
            />
          </FilterPill>

          {/* Perishable Filter */}
          <FilterPill
            label={t('rawMaterials.fields.perishable')}
            isActive={perishableFilter.length > 0}
            activeLabel={getFilterDisplayLabel(perishableFilter, perishableOptions)}
            onClear={() => setPerishableFilter([])}
          >
            <CheckboxFilterContent
              title={t('rawMaterials.fields.perishable')}
              options={perishableOptions}
              selectedValues={perishableFilter}
              onApply={setPerishableFilter}
            />
          </FilterPill>

          {/* Usage Filter */}
          <FilterPill
            label={t('rawMaterials.usage.column')}
            isActive={usageFilter.length > 0}
            activeLabel={getFilterDisplayLabel(usageFilter, usageOptions)}
            onClear={() => setUsageFilter([])}
          >
            <CheckboxFilterContent
              title={t('rawMaterials.usage.column')}
              options={usageOptions}
              selectedValues={usageFilter}
              onApply={setUsageFilter}
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

      {/* Data Table - Fully responsive */}
      <DataTable
        data={rawMaterials || []}
        rowCount={rawMaterials?.length || 0}
        columns={filteredColumns}
        isLoading={isLoading}
        tableId="rawMaterials:main"
        enableSearch={false} // We're using custom search
        showColumnCustomizer={false} // Using our custom ColumnCustomizer
        pagination={pagination}
        setPagination={setPagination}
      />

      {/* Dialogs */}
      <RawMaterialDialog open={createDialogOpen} onOpenChange={setCreateDialogOpen} mode="create" />

      <RawMaterialDialog open={editDialogOpen} onOpenChange={setEditDialogOpen} mode="edit" rawMaterial={selectedMaterial} />

      <AdjustStockDialog open={adjustStockDialogOpen} onOpenChange={setAdjustStockDialogOpen} rawMaterial={selectedMaterial} />

      <StockMovementsDialog open={movementsDialogOpen} onOpenChange={setMovementsDialogOpen} rawMaterial={selectedMaterial} />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirmOpen}
        onOpenChange={setDeleteConfirmOpen}
        title={t('rawMaterials.delete')}
        description={`${tCommon('confirm')}? ${t('rawMaterials.delete')} "${selectedMaterial?.name}"`}
        confirmText={tCommon('delete')}
        cancelText={t('cancel')}
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
        <RecipeDialog open={recipeEditDialogOpen} onOpenChange={setRecipeEditDialogOpen} mode="edit" product={selectedProductForRecipe} />
      )}
    </div>
  )
}
