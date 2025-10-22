import { useQuery } from '@tanstack/react-query'
import { useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { Button } from '@/components/ui/button'
import { Package, Search, TrendingDown, TrendingUp, DollarSign } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import DataTable from '@/components/data-table'
import { ColumnDef } from '@tanstack/react-table'
import { PermissionGate } from '@/components/PermissionGate'
import { getProducts } from '@/services/menu.service'
import { Product } from '@/types'
import { AdjustInventoryStockDialog } from './components/AdjustInventoryStockDialog'
import { InventoryMovementsDialog } from './components/InventoryMovementsDialog'

/**
 * ProductStock Page
 *
 * Displays products with Quantity Tracking inventory (Inventory table).
 * This is for products tracked by unit count, NOT recipe-based products.
 *
 * ✅ WORLD-CLASS 3-TIER INVENTORY ARCHITECTURE:
 * ============================================
 * 1. NO INVENTORY (trackInventory = false)
 *    - Services, digital products, classes
 *    - No stock tracking at all
 *
 * 2. QUANTITY TRACKING (trackInventory = true + inventoryMethod = 'QUANTITY')
 *    - Count-based tracking (bottles, units, pieces)
 *    - Uses Inventory table OR RawMaterial table
 *    - This page shows these products
 *
 * 3. RECIPE-BASED (trackInventory = true + inventoryMethod = 'RECIPE')
 *    - Ingredient-based tracking with FIFO costing
 *    - Uses Recipe + RawMaterial tables
 *    - NOT shown on this page
 *
 * Filter Logic (✅ WORLD-CLASS):
 * =============
 * - Filter by: product.trackInventory === true AND product.inventoryMethod === 'QUANTITY'
 * - Uses dedicated column (NOT JSON externalData)
 * - Follows Toast/Square/Shopify patterns
 *
 * See Documentation:
 * - /docs/INVENTORY_WORKFLOW.md (3-tier architecture explanation)
 * - /docs/MANUAL_INVENTORY_CONFIGURATION.md (inventoryMethod column)
 */

interface ProductWithStock extends Product {
  // Stock data from Inventory table (Simple Stock system)
  currentStock: number
  reorderPoint: number
  costPerUnit: number
  unit: string
}

// Stock status helper function
const getStockStatus = (
  currentStock: number,
  reorderPoint: number,
  t: (key: string) => string
) => {
  if (currentStock === 0) {
    return {
      label: t('productStock.status.outOfStock'),
      variant: 'destructive' as const,
      className: 'bg-destructive/10 border-destructive/20 text-destructive'
    }
  }
  if (currentStock <= reorderPoint) {
    return {
      label: t('productStock.status.lowStock'),
      variant: 'outline' as const,
      className: 'bg-yellow-50 dark:bg-yellow-950/50 border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200'
    }
  }
  return {
    label: t('productStock.status.inStock'),
    variant: 'outline' as const,
    className: 'bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200'
  }
}

export default function ProductStock() {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()

  const [searchQuery, setSearchQuery] = useState('')
  const [filterLowStock, setFilterLowStock] = useState(false)

  // Dialog states
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isAdjustStockDialogOpen, setIsAdjustStockDialogOpen] = useState(false)
  const [isMovementsDialogOpen, setIsMovementsDialogOpen] = useState(false)

  // Fetch all products (backend includes inventory relation)
  // ✅ WORLD-CLASS: Order by name (alphabetically) from backend for better performance
  const { data: products = [], isLoading: isLoadingProducts } = useQuery<Product[]>({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: async () => {
      const data = await getProducts(venueId, { orderBy: 'name' })
      return data
    },
    enabled: !!venueId,
  })

  // Filter and map products with Quantity Tracking inventory
  const productStockItems: ProductWithStock[] = useMemo(() => {
    // ✅ WORLD-CLASS FILTER: Based on dedicated inventoryMethod column
    // - No Inventory: trackInventory = false (services, digital products)
    // - Quantity Tracking: trackInventory = true + inventoryMethod = 'QUANTITY'
    // - Recipe-Based: trackInventory = true + inventoryMethod = 'RECIPE'
    const quantityTrackingProducts = products.filter(p => {
      // Filter: Must have quantity tracking AND inventory relation loaded
      return p.trackInventory === true && p.inventoryMethod === 'QUANTITY' && p.inventory
    })

    // Map products to include stock data from Inventory table
    // Products are already sorted by name from backend query
    return quantityTrackingProducts.map(product => {
      const inventory = product.inventory!

      return {
        ...product,
        currentStock: Number(inventory.currentStock),
        reorderPoint: Number(inventory.minimumStock),
        costPerUnit: Number(product.cost || 0),
        unit: product.unit || 'UNIT',
      } as ProductWithStock
    })
  }, [products])

  const isLoading = isLoadingProducts

  // Apply filters
  const filteredItems = productStockItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.sku.toLowerCase().includes(searchQuery.toLowerCase())
    const matchesLowStock = !filterLowStock || item.currentStock <= item.reorderPoint

    return matchesSearch && matchesLowStock
  })

  // Calculate stats
  const stats = useMemo(() => {
    const lowStockCount = filteredItems.filter(item =>
      item.currentStock > 0 && item.currentStock <= item.reorderPoint
    ).length

    const outOfStockCount = filteredItems.filter(item =>
      item.currentStock === 0
    ).length

    const totalValue = filteredItems.reduce((sum, item) =>
      sum + (item.currentStock * item.costPerUnit), 0
    )

    return {
      total: filteredItems.length,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      totalValue,
    }
  }, [filteredItems])

  // Table columns
  const columns = useMemo<ColumnDef<ProductWithStock, unknown>[]>(
    () => [
      {
        accessorKey: 'name',
        header: t('productStock.table.columns.product'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium">{row.original.name}</p>
              <p className="text-xs text-muted-foreground">SKU: {row.original.sku}</p>
            </div>
          </div>
        ),
      },
      {
        accessorKey: 'currentStock',
        header: t('productStock.table.columns.currentStock'),
        cell: ({ row }) => {
          const status = getStockStatus(row.original.currentStock, row.original.reorderPoint, t)
          return (
            <div className="flex items-center gap-2">
              <span className={`font-semibold ${status.className.includes('destructive') ? 'text-destructive' : status.className.includes('yellow') ? 'text-yellow-600 dark:text-yellow-500' : 'text-green-600 dark:text-green-500'}`}>
                {row.original.currentStock} {t(`units.${row.original.unit}`)}
              </span>
            </div>
          )
        },
      },
      {
        accessorKey: 'reorderPoint',
        header: t('productStock.table.columns.reorderPoint'),
        cell: ({ row }) => (
          <span className="text-muted-foreground">
            {row.original.reorderPoint} {t(`units.${row.original.unit}`)}
          </span>
        ),
      },
      {
        accessorKey: 'costPerUnit',
        header: t('productStock.table.columns.costPerUnit'),
        cell: ({ row }) => (
          <span className="font-medium">
            ${row.original.costPerUnit.toFixed(2)}
          </span>
        ),
      },
      {
        accessorKey: 'status',
        header: t('productStock.table.columns.status'),
        cell: ({ row }) => {
          const status = getStockStatus(row.original.currentStock, row.original.reorderPoint, t)
          return (
            <Badge variant={status.variant} className={status.className}>
              {status.label}
            </Badge>
          )
        },
      },
      {
        id: 'actions',
        header: t('productStock.table.columns.actions'),
        cell: ({ row }) => (
          <div className="flex items-center gap-2">
            <PermissionGate permission="inventory:update">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSelectedProduct(row.original)
                  setIsAdjustStockDialogOpen(true)
                }}
              >
                {t('productStock.actions.adjustStock')}
              </Button>
            </PermissionGate>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSelectedProduct(row.original)
                setIsMovementsDialogOpen(true)
              }}
            >
              {t('productStock.actions.viewMovements')}
            </Button>
          </div>
        ),
      },
    ],
    [t]
  )

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-4 w-96" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    )
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">{t('productStock.title')}</h1>
        <p className="text-muted-foreground">{t('productStock.subtitle')}</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productStock.stats.totalProducts')}</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productStock.stats.lowStock')}</CardTitle>
            <TrendingDown className="h-4 w-4 text-yellow-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{stats.lowStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productStock.stats.outOfStock')}</CardTitle>
            <TrendingUp className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.outOfStock}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t('productStock.stats.totalValue')}</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${stats.totalValue.toFixed(2)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={t('productStock.searchPlaceholder')}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-8"
          />
        </div>
        <Button
          variant={filterLowStock ? 'default' : 'outline'}
          onClick={() => setFilterLowStock(!filterLowStock)}
        >
          {t('productStock.stats.lowStock')}
        </Button>
      </div>

      {/* Data Table */}
      <div className="rounded-md border bg-card">
        <DataTable
          columns={columns}
          data={filteredItems}
          rowCount={filteredItems.length}
        />
      </div>

      {/* Dialogs */}
      <AdjustInventoryStockDialog
        open={isAdjustStockDialogOpen}
        onOpenChange={setIsAdjustStockDialogOpen}
        product={selectedProduct}
      />

      <InventoryMovementsDialog
        open={isMovementsDialogOpen}
        onOpenChange={setIsMovementsDialogOpen}
        product={selectedProduct}
      />
    </div>
  )
}
