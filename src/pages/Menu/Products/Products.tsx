import { getProducts, updateProduct, deleteProduct } from '@/services/menu.service'
import { productInventoryApi, type AdjustInventoryStockDto } from '@/services/inventory.service'
import { useToast } from '@/hooks/use-toast'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { type ColumnDef } from '@tanstack/react-table'
import { ArrowUpDown, UploadCloud, ImageIcon, MoreHorizontal, Edit, Trash2, Package2, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useCallback, useState, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useVenueDateTime } from '@/utils/datetime'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import DataTable from '@/components/data-table'
import { AddToAIButton } from '@/components/AddToAIButton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ItemsCell } from '@/components/multiple-cell-values'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Product } from '@/types'
import { useAuth } from '@/context/AuthContext'
import { Currency } from '@/utils/currency'
import { PermissionGate } from '@/components/PermissionGate'
import { InventoryBadge } from '@/components/inventory/InventoryBadge'
import { InventoryDetailsModal } from '@/components/inventory/InventoryDetailsModal'
import { AdjustStockDialog } from '@/components/AdjustStockDialog'
import { useMenuSocketEvents } from '@/hooks/use-menu-socket-events'
import { PageTitleWithInfo } from '@/components/PageTitleWithInfo'

export default function Products() {
  const { t } = useTranslation('menu')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { formatDate } = useVenueDateTime()
  const { checkFeatureAccess } = useAuth()
  const hasChatbot = checkFeatureAccess('CHATBOT')

  const location = useLocation()
  const navigate = useNavigate()

  const queryClient = useQueryClient()
  const { toast } = useToast()
  const [imageErrors, setImageErrors] = useState<Record<string, boolean>>({})
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize: 10,
  })
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [productToDelete, setProductToDelete] = useState<Product | null>(null)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [isInventoryModalOpen, setIsInventoryModalOpen] = useState(false)
  const [adjustStockDialogOpen, setAdjustStockDialogOpen] = useState(false)
  const [productToAdjust, setProductToAdjust] = useState<Product | null>(null)
  const [showLowStockOnly, setShowLowStockOnly] = useState(false)

  // ✅ WORLD-CLASS: Fetch products sorted alphabetically by name
  const {
    data: products,
    isLoading,
    dataUpdatedAt,
  } = useQuery({
    queryKey: ['products', venueId, 'orderBy:name'],
    queryFn: () => getProducts(venueId!, { orderBy: 'name' }),
    // ✅ FIX: Reduce staleTime to keep inventory data fresh
    // Especially important for RECIPE products where availableQuantity
    // can change when ingredient stock updates
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 60 * 1000, // Refetch every minute as backup
    refetchOnWindowFocus: true, // Refetch when user returns to tab
  })

  // ✅ REAL-TIME: Listen to menu/inventory socket events for automatic badge updates
  useMenuSocketEvents(venueId, {
    onAvailabilityChanged: () => {
      // Invalidate products query when inventory changes
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
    onMenuItemUpdated: () => {
      // Invalidate on any menu item update
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
    },
  })

  // ✅ SQUARE POS PATTERN: Calculate low stock items (memoized for performance)
  const lowStockProducts = useMemo(() => {
    if (!products) return []

    return products.filter(product => {
      // Only check products with inventory tracking
      if (!product.trackInventory || !product.inventoryMethod) return false

      // For QUANTITY method: check against reorder point OR custom threshold
      if (product.inventoryMethod === 'QUANTITY') {
        const currentStock = Number(product.inventory?.currentStock ?? 0)
        // Use custom threshold if set, otherwise fall back to reorderPoint
        const threshold = product.lowStockThreshold ?? Number(product.inventory?.minimumStock ?? 10)
        return currentStock <= threshold
      }

      // For RECIPE method: check availableQuantity against custom threshold
      if (product.inventoryMethod === 'RECIPE') {
        const availableQuantity = product.availableQuantity ?? 0
        // Use custom threshold if set, otherwise default to 5 portions
        const threshold = product.lowStockThreshold ?? 5
        return availableQuantity <= threshold
      }

      return false
    })
  }, [products])

  // ✅ Filter products based on low stock toggle
  const filteredProducts = useMemo(() => {
    if (!showLowStockOnly || !products) return products
    return lowStockProducts
  }, [showLowStockOnly, products, lowStockProducts])

  const toggleActive = useMutation({
    mutationFn: async ({ productId, status }: { productId: string; status: boolean }) => {
      await updateProduct(venueId!, productId, { active: status })
      return { productId, status }
    },
    onMutate: async ({ productId, status }) => {
      // Cancel any outgoing refetches
      await queryClient.cancelQueries({ queryKey: ['products', venueId] })

      // Snapshot the previous value and timestamp
      const previousProducts = queryClient.getQueryData<Product[]>(['products', venueId])
      const timestamp = Date.now()

      // Find the specific product to check its current state
      const targetProduct = previousProducts?.find(p => p.id === productId)
      const previousActiveState = targetProduct?.active

      // Optimistically update the cache
      queryClient.setQueryData<Product[]>(['products', venueId], old => {
        if (!old) return old
        return old.map(product => (product.id === productId ? { ...product, active: status } : product))
      })

      // Return context with snapshot, timestamp, and previous state
      return { previousProducts, timestamp, productId, previousActiveState }
    },
    onError: (error, variables, context) => {
      // ✅ FIX: Instead of blind rollback, invalidate queries to get fresh server state
      // This prevents restoring incorrect state if someone else modified it
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })

      // Show error toast with more context
      toast({
        title: t('common.error'),
        description: 'Failed to update product status. Please try again.',
        variant: 'destructive',
      })
    },
    onSuccess: (data, variables, context) => {
      // Verify the operation completed successfully by checking current state
      const currentProducts = queryClient.getQueryData<Product[]>(['products', venueId])
      const currentProduct = currentProducts?.find(p => p.id === variables.productId)

      // If current state doesn't match what we expect, show warning
      if (currentProduct && currentProduct.active !== variables.status) {
        toast({
          title: t('common.warning'),
          description: 'Product status may have been modified by another user. Refreshing data...',
          variant: 'default',
        })
        queryClient.invalidateQueries({ queryKey: ['products', venueId] })
        return
      }

      toast({
        title: data.status ? t('products.toasts.activated') : t('products.toasts.deactivated'),
        description: t('products.toasts.saved'),
      })
    },
  })

  const deleteProductMutation = useMutation({
    mutationFn: async (productId: string) => {
      await deleteProduct(venueId!, productId)
      return productId
    },
    onSuccess: () => {
      setDeleteDialogOpen(false)
      setProductToDelete(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('products.detail.toasts.deleted'),
        description: t('products.detail.toasts.deletedDesc'),
      })
    },
    onError: () => {
      setDeleteDialogOpen(false)
      toast({
        title: t('common.error'),
        description: t('products.detail.toasts.saveErrorDesc'),
        variant: 'destructive',
      })
    },
  })

  const adjustStockMutation = useMutation({
    mutationFn: async ({
      productId,
      adjustment,
      reason,
      notes,
    }: {
      productId: string
      adjustment: number
      reason: string
      notes: string
    }) => {
      const payload: AdjustInventoryStockDto = {
        type: 'ADJUSTMENT',
        quantity: adjustment,
        reason: `${reason}${notes ? ` - ${notes}` : ''}`,
      }
      return await productInventoryApi.adjustStock(venueId!, productId, payload)
    },
    onSuccess: () => {
      setAdjustStockDialogOpen(false)
      setProductToAdjust(null)
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      toast({
        title: t('products.toasts.saved'),
        description: 'Stock adjusted successfully',
      })
    },
    onError: (error: any) => {
      toast({
        title: t('common.error'),
        description: error.response?.data?.message || 'Failed to adjust stock',
        variant: 'destructive',
      })
    },
  })

  const columns: ColumnDef<Product, unknown>[] = [
    // AI column - only show if venue has chatbot feature
    ...(hasChatbot
      ? [
          {
            id: 'ai',
            header: () => <span className="sr-only">{tCommon('screenReaderOnly.ai')}</span>,
            cell: ({ row }: { row: { original: Product } }) => (
              <div className="flex justify-center">
                <AddToAIButton type="product" data={row.original} variant="icon" />
              </div>
            ),
            size: 50,
            enableSorting: false,
          } as ColumnDef<Product, unknown>,
        ]
      : []),
    {
      id: 'imageUrl',
      accessorKey: 'imageUrl',
      sortDescFirst: true,
      meta: { label: t('products.columns.photo') },
      header: () => <div className=" flex-row-center">{t('products.columns.photo')}</div>,

      cell: ({ cell, row }) => {
        const imageUrl = cell.getValue() as string
        const productId = row.original.id
        const hasError = imageErrors[productId]

        return (
          <div className="w-12 h-12 overflow-hidden bg-muted rounded">
            {imageUrl && !hasError ? (
              <img
                src={imageUrl}
                alt={t('products.imageAlt')}
                className="object-cover h-12 w-12"
                onError={() => setImageErrors(prev => ({ ...prev, [productId]: true }))}
              />
            ) : imageUrl && hasError ? (
              <div className="flex items-center justify-center w-full h-full bg-muted">
                <ImageIcon className="w-4 h-4 text-muted-foreground" />
              </div>
            ) : (
              <div className="flex items-center justify-center w-full h-full">
                <UploadCloud className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        )
      },
    },
    {
      id: 'name',
      accessorKey: 'name',
      sortDescFirst: true,
      meta: { label: t('products.columns.name') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.name')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        return cell.getValue() as string
      },
    },
    {
      id: 'price',
      accessorKey: 'price',
      sortDescFirst: true,
      meta: { label: t('products.columns.price') },
      header: ({ column }) => (
        <div onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')} className="cursor-pointer flex-row-center">
          {t('products.columns.price')}
          <ArrowUpDown className="w-4 h-4 ml-2" />
        </div>
      ),

      cell: ({ cell }) => {
        const price = cell.getValue() as number
        return <ul>{Currency(price)}</ul>
      },
    },
    {
      id: 'stock',
      accessorKey: 'availableQuantity',
      meta: { label: t('products.columns.stock') },
      header: t('products.columns.stock'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original

        return (
          <InventoryBadge
            product={product}
            onClick={() => {
              setSelectedProduct(product)
              setIsInventoryModalOpen(true)
            }}
          />
        )
      },
    },

    {
      id: 'categories',
      accessorKey: 'category',
      meta: { label: t('products.columns.categories') },
      header: t('products.columns.categories'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const category = row.original.category
        // Transform single category to array for ItemsCell
        const categories = category ? [category] : []
        return <ItemsCell cell={{ getValue: () => categories }} max_visible_items={2} />
      },
    },
    {
      id: 'modifierGroups',
      accessorKey: 'modifierGroups',
      meta: { label: t('products.columns.modifierGroups') },
      header: t('products.columns.modifierGroups'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const modifierGroups = row.original.modifierGroups || []
        // Extract the group from each ProductModifierGroup
        const groups = modifierGroups.map(pmg => pmg.group).filter(Boolean)

        if (groups.length === 0) {
          return <span className="text-muted-foreground">-</span>
        }

        return (
          <div className="flex flex-wrap gap-1">
            {groups.slice(0, 3).map(group => (
              <Badge key={group.id} variant="secondary" className="text-xs px-2 py-0.5">
                {group.name}
              </Badge>
            ))}
            {groups.length > 3 && (
              <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
                +{groups.length - 3}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'updatedAt',
      accessorKey: 'updatedAt',
      meta: { label: t('products.columns.updatedAt') },
      header: t('products.columns.updatedAt'),
      enableColumnFilter: false,
      cell: ({ cell }) => {
        const updatedAt = cell.getValue() as string
        return <span>{formatDate(updatedAt)}</span>
      },
    },
    {
      id: 'available',
      accessorKey: 'active',
      meta: { label: 'Available' },
      header: 'Available',
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original
        const isActive = product.active

        return (
          <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
            <Switch
              checked={isActive}
              onCheckedChange={checked => {
                toggleActive.mutate({ productId: product.id, status: checked })
              }}
              className={isActive ? 'data-[state=checked]:bg-green-500' : 'data-[state=unchecked]:bg-red-500'}
            />
            {isActive ? (
              <CheckCircle2 className="h-4 w-4 text-green-600" />
            ) : (
              <Badge variant="destructive" className="text-xs">
                {t('products.columns.unavailable')}
              </Badge>
            )}
          </div>
        )
      },
    },
    {
      id: 'actions',
      header: t('common:actions'),
      enableColumnFilter: false,
      cell: ({ row }) => {
        const product = row.original

        return (
          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-8 w-8 p-0" onClick={e => e.stopPropagation()}>
                <span className="sr-only">{t('modifiers.actions.openMenu')}</span>
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48" sideOffset={5}>
              <DropdownMenuLabel>{t('common:actions')}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <PermissionGate permission="menu:update">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    navigate(product.id, { state: { from: location.pathname } })
                  }}
                  className="cursor-pointer"
                >
                  <Edit className="mr-2 h-4 w-4" />
                  {t('common.edit')}
                </DropdownMenuItem>
              </PermissionGate>
              {/* ✅ TOAST POS PATTERN: Quick stock adjustment from product list */}
              {product.trackInventory && product.inventoryMethod === 'QUANTITY' && (
                <PermissionGate permission="menu:update">
                  <DropdownMenuItem
                    onClick={e => {
                      e.stopPropagation()
                      setProductToAdjust(product)
                      setAdjustStockDialogOpen(true)
                    }}
                    className="cursor-pointer"
                  >
                    <Package2 className="mr-2 h-4 w-4" />
                    {t('products.actions.adjustStock')}
                  </DropdownMenuItem>
                </PermissionGate>
              )}
              <PermissionGate permission="menu:delete">
                <DropdownMenuItem
                  onClick={e => {
                    e.stopPropagation()
                    setProductToDelete(product)
                    setDeleteDialogOpen(true)
                  }}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  {t('common.delete')}
                </DropdownMenuItem>
              </PermissionGate>
            </DropdownMenuContent>
          </DropdownMenu>
        )
      },
    },
  ]

  // Search callback for DataTable
  const handleSearch = useCallback((searchTerm: string, products: any[]) => {
    if (!searchTerm) return products

    const lowerSearchTerm = searchTerm.toLowerCase()

    return products.filter(product => {
      const nameMatches = product.name.toLowerCase().includes(lowerSearchTerm)
      const modifierGroupMatches =
        product.modifierGroups?.some(modifierGroup => modifierGroup.group?.name.toLowerCase().includes(lowerSearchTerm)) || false
      const categoryMatches = product.category?.name.toLowerCase().includes(lowerSearchTerm) || false
      return nameMatches || modifierGroupMatches || categoryMatches
    })
  }, [])

  return (
    <div className="p-4">
      <div className="flex flex-row items-center justify-between mb-6">
        <PageTitleWithInfo
          title={t('products.title')}
          className="text-xl font-semibold"
          tooltip={t('info.products', {
            defaultValue: 'Lista y administra productos, precios, inventario y visibilidad en el menu.',
          })}
        />
        <PermissionGate permission="menu:create">
          <Button asChild>
            <Link
              to={`create`}
              state={{
                from: location.pathname,
              }}
              className="flex items-center space-x-2"
            >
              <span>{t('products.new')}</span>
            </Link>
          </Button>
        </PermissionGate>
      </div>

      {/* ✅ SQUARE POS PATTERN: Low stock alert banner */}
      {lowStockProducts.length > 0 && !showLowStockOnly && (
        <Alert className="mb-4 border-orange-200 bg-orange-50 dark:bg-orange-950/50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="flex items-center justify-between">
            <span className="text-orange-800 dark:text-orange-200">{t('products.lowStock.alert', { count: lowStockProducts.length })}</span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLowStockOnly(true)}
              className="ml-4 border-orange-300 text-orange-700 hover:bg-orange-100 dark:border-orange-700 dark:text-orange-300"
            >
              {t('products.lowStock.viewDetails')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* ✅ Active filter indicator */}
      {showLowStockOnly && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary" className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
            {t('products.lowStock.filterLabel')}
          </Badge>
          <Button variant="ghost" size="sm" onClick={() => setShowLowStockOnly(false)}>
            {t('products.lowStock.clearFilter')}
          </Button>
        </div>
      )}

      <DataTable
        data={filteredProducts || []}
        rowCount={filteredProducts?.length}
        columns={columns}
        isLoading={isLoading}
        enableSearch={true}
        searchPlaceholder={t('common:search')}
        onSearch={handleSearch}
        tableId="menu:products"
        pagination={pagination}
        setPagination={setPagination}
        clickableRow={row => ({
          to: row.id,
          state: { from: location.pathname },
        })}
      />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('products.detail.deleteTitle')}</AlertDialogTitle>
            <AlertDialogDescription>{t('products.detail.deleteMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('forms.buttons.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (productToDelete) {
                  deleteProductMutation.mutate(productToDelete.id)
                }
              }}
              disabled={deleteProductMutation.isPending}
            >
              {deleteProductMutation.isPending ? t('products.detail.toasts.deleted') : t('products.detail.deleteConfirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <InventoryDetailsModal product={selectedProduct} open={isInventoryModalOpen} onOpenChange={setIsInventoryModalOpen} />

      {/* ✅ TOAST POS PATTERN: Quick stock adjustment dialog */}
      <AdjustStockDialog
        open={adjustStockDialogOpen}
        onOpenChange={setAdjustStockDialogOpen}
        product={productToAdjust}
        onConfirm={(adjustment, reason, notes) => {
          if (productToAdjust) {
            adjustStockMutation.mutate({
              productId: productToAdjust.id,
              adjustment,
              reason,
              notes,
            })
          }
        }}
        isLoading={adjustStockMutation.isPending}
      />
    </div>
  )
}
