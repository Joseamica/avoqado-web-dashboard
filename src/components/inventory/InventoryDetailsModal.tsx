import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Package, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'

import type { Product } from '@/types'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { productInventoryApi } from '@/services/inventory.service'

interface InventoryDetailsModalProps {
  product: Product | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

/**
 * Inventory Details Modal - Toast POS Style
 *
 * Shows detailed inventory information when clicking on an InventoryBadge.
 * Displays different information based on inventory method:
 * - QUANTITY: Simple stock count, reorder point, movements
 * - RECIPE: Ingredients breakdown, bottleneck analysis, max portions
 *
 * @example
 * ```tsx
 * <InventoryDetailsModal
 *   product={selectedProduct}
 *   open={isModalOpen}
 *   onOpenChange={setIsModalOpen}
 * />
 * ```
 */
export function InventoryDetailsModal({ product, open, onOpenChange }: InventoryDetailsModalProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()

  // Fetch detailed inventory status
  const { data: inventoryStatus, isLoading } = useQuery({
    queryKey: ['inventory-status', venueId, product?.id],
    queryFn: async () => {
      const response = await productInventoryApi.getStatus(venueId, product!.id)
      // Backend wraps response in { success, data }, extract the actual status
      const responseData = response.data as unknown as { success: boolean; data: typeof response.data }
      return responseData.data
    },
    enabled: open && !!product && !!venueId,
  })

  if (!product) {
    return null
  }

  const quantity = product.availableQuantity ?? 0

  const getStatusIcon = () => {
    if (quantity === 0) return <XCircle className="h-5 w-5 text-destructive" />
    if (quantity <= 5) return <AlertTriangle className="h-5 w-5 text-orange-500" />
    return <CheckCircle2 className="h-5 w-5 text-green-500" />
  }

  const getStatusText = () => {
    if (quantity === 0) return t('badge.status.outOfStock')
    if (quantity <= 5) return t('badge.status.lowStock')
    return t('badge.status.inStock')
  }

  const getStatusColor = () => {
    if (quantity === 0) return 'bg-destructive/10 text-destructive'
    if (quantity <= 5) return 'bg-orange-500/10 text-orange-700 dark:text-orange-400'
    return 'bg-green-500/10 text-green-700 dark:text-green-400'
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            {product.name}
          </DialogTitle>
          <DialogDescription>{t('badge.modal.description')}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status Badge */}
          <Alert className={getStatusColor()}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {getStatusIcon()}
                <AlertDescription className="font-semibold">{getStatusText()}</AlertDescription>
              </div>
              <Badge variant="outline" className="text-lg font-bold tabular-nums">
                {quantity}
              </Badge>
            </div>
          </Alert>

          {/* Inventory Method Info */}
          <div className="rounded-lg border bg-muted/40 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('badge.method.label')}</p>
                <p className="text-base font-semibold">
                  {product.inventoryMethod === 'QUANTITY' ? t('badge.method.quantity') : t('badge.method.recipe')}
                </p>
              </div>
              {product.unit && (
                <Badge variant="secondary">
                  {t('badge.unit')}: {product.unit}
                </Badge>
              )}
            </div>
          </div>

          <Separator />

          {/* Loading State */}
          {isLoading && (
            <div className="space-y-3">
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
              <Skeleton className="h-8 w-full" />
            </div>
          )}

          {/* QUANTITY Method Details */}
          {!isLoading && product.inventoryMethod === 'QUANTITY' && inventoryStatus && (
            <div className="space-y-3">
              <h3 className="font-semibold">{t('badge.quantity.title')}</h3>

              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t('badge.quantity.currentStock')}</p>
                  <p className="text-2xl font-bold tabular-nums">{inventoryStatus.currentStock ?? 0}</p>
                </div>

                <div className="rounded-lg border bg-card p-3">
                  <p className="text-xs text-muted-foreground">{t('badge.quantity.reorderPoint')}</p>
                  <p className="text-2xl font-bold tabular-nums">{inventoryStatus.reorderPoint ?? 0}</p>
                </div>
              </div>

              {inventoryStatus.lowStock && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>{t('badge.quantity.lowStockWarning')}</AlertDescription>
                </Alert>
              )}
            </div>
          )}

          {/* RECIPE Method Details */}
          {!isLoading && product.inventoryMethod === 'RECIPE' && inventoryStatus && (
            <div className="space-y-3">
              <h3 className="font-semibold">{t('badge.recipe.title')}</h3>

              <div className="rounded-lg border bg-card p-3">
                <p className="text-xs text-muted-foreground">{t('badge.recipe.maxPortions')}</p>
                <p className="text-2xl font-bold tabular-nums">{inventoryStatus.maxPortions ?? 0}</p>
              </div>

              {/* Ingredients List */}
              {inventoryStatus.insufficientIngredients && inventoryStatus.insufficientIngredients.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium">{t('badge.recipe.ingredients')}</h4>
                  <div className="space-y-2">
                    {inventoryStatus.insufficientIngredients.map(ingredient => {
                      const hasEnough = ingredient.available >= ingredient.required
                      const portionsAvailable = Math.floor(ingredient.available / ingredient.required)

                      return (
                        <div
                          key={ingredient.rawMaterialId}
                          className="flex items-center justify-between rounded-lg border bg-muted/40 p-3"
                        >
                          <div className="flex-1">
                            <p className="font-medium">{ingredient.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {t('badge.recipe.required')}: {ingredient.required} {ingredient.unit}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold tabular-nums">
                              {ingredient.available} {ingredient.unit}
                            </p>
                            <Badge variant={hasEnough ? 'secondary' : 'destructive'} className="text-xs">
                              {portionsAvailable} {t('badge.recipe.portions')}
                            </Badge>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Recipe Cost */}
              {inventoryStatus.recipeCost !== undefined && (
                <div className="rounded-lg border bg-muted/40 p-3">
                  <p className="text-xs text-muted-foreground">{t('badge.recipe.cost')}</p>
                  <p className="text-xl font-bold">${inventoryStatus.recipeCost.toFixed(2)}</p>
                </div>
              )}
            </div>
          )}

          {/* Message */}
          {inventoryStatus?.message && (
            <Alert>
              <AlertDescription>{inventoryStatus.message}</AlertDescription>
            </Alert>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
