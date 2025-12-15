import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { productInventoryApi, type InventoryMovement } from '@/services/inventory.service'
import { getIntlLocale } from '@/utils/i18n-locale'
import { Loader2, TrendingUp, TrendingDown, Package } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { Product } from '@/types'
import { useUnitTranslation } from '@/hooks/use-unit-translation'

interface InventoryMovementsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function InventoryMovementsDialog({ open, onOpenChange, product }: InventoryMovementsDialogProps) {
  const { t, i18n } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const localeCode = getIntlLocale(i18n.language)
  const { formatUnitWithQuantity } = useUnitTranslation()

  // Fetch inventory movements
  const { data: movements, isLoading } = useQuery({
    queryKey: ['productInventoryMovements', venueId, product?.id],
    queryFn: async () => {
      if (!product) return []
      const response = await productInventoryApi.getMovements(venueId, product.id)
      return response.data as InventoryMovement[]
    },
    enabled: !!venueId && !!product && open,
  })

  if (!product || !product.inventory) return null
  const unitKey = (product.unit || 'UNIT').toUpperCase()

  const getMovementIcon = (quantity: number) => {
    if (quantity > 0) {
      return <TrendingUp className="h-4 w-4 text-green-600 dark:text-green-400" />
    } else if (quantity < 0) {
      return <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400" />
    }
    return <Package className="h-4 w-4 text-muted-foreground" />
  }

  const getMovementTypeColor = (type: string) => {
    const colors = {
      PURCHASE: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-400 border-green-200 dark:border-green-800',
      USAGE: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-400 border-blue-200 dark:border-blue-800',
      ADJUSTMENT: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
      SPOILAGE: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-400 border-red-200 dark:border-red-800',
      TRANSFER: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-400 border-orange-200 dark:border-orange-800',
      RETURN: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-400 border-purple-200 dark:border-purple-800',
      COUNT: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-800 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800',
    }
    return colors[type as keyof typeof colors] || 'bg-muted text-muted-foreground border-border'
  }

  const currentStock = Number(product.inventory.currentStock)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>{t('rawMaterials.movements.title')}</DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku}) - {t('rawMaterials.fields.currentStock')}: {currentStock.toFixed(2)}{' '}
            {formatUnitWithQuantity(currentStock, unitKey)}
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : !movements || movements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">{t('common.noData')}</p>
          </div>
        ) : (
          <ScrollArea className="h-[500px] pr-4">
            <div className="space-y-3">
              {movements.map((movement, index) => {
                const date = new Date(movement.createdAt)
                const timeStr = date.toLocaleTimeString(localeCode, { hour: 'numeric', minute: '2-digit' })
                const dateStr = date.toLocaleDateString(localeCode, { day: '2-digit', month: 'short', year: 'numeric' })
                const quantity = Number(movement.quantity)
                const previousStock = Number(movement.previousStock)
                const newStock = Number(movement.newStock)

                return (
                  <div
                    key={movement.id}
                    className="relative flex gap-4 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors"
                  >
                    {/* Timeline connector */}
                    {index < movements.length - 1 && <div className="absolute left-[26px] top-[60px] w-0.5 h-[calc(100%+12px)] bg-border" />}

                    {/* Icon */}
                    <div className="relative shrink-0">
                      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-background border-2 border-border shadow-sm">
                        {getMovementIcon(quantity)}
                      </div>
                    </div>

                    {/* Content */}
                    <div className="flex-1 space-y-2">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                          <Badge className={getMovementTypeColor(movement.type)}>{t(`rawMaterials.movements.types.${movement.type}`)}</Badge>
                          <p className="text-xs text-muted-foreground">
                            {timeStr} · {dateStr}
                          </p>
                        </div>
                        <div className="text-right">
                          <p
                            className={`text-lg font-bold ${quantity > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}
                          >
                            {quantity > 0 ? '+' : ''}
                            {quantity.toFixed(2)} {formatUnitWithQuantity(quantity, unitKey)}
                          </p>
                        </div>
                      </div>

                      {/* Stock Change */}
                      <div className="flex items-center gap-2 text-sm">
                        <span className="text-muted-foreground">{previousStock.toFixed(2)}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-semibold text-foreground">{newStock.toFixed(2)}</span>
                        <span className="text-muted-foreground">{formatUnitWithQuantity(newStock, unitKey)}</span>
                      </div>

                      {/* Reason & Reference */}
                      {(movement.reason || movement.reference) && (
                        <div className="space-y-1 pt-2 border-t border-border">
                          {movement.reason && (
                            <div className="flex gap-2">
                              <span className="text-xs text-muted-foreground">{t('rawMaterials.movements.reason')}:</span>
                              <span className="text-xs text-foreground">{movement.reason}</span>
                            </div>
                          )}
                          {movement.reference && (
                            <div className="flex gap-2">
                              <span className="text-xs text-muted-foreground">{t('rawMaterials.movements.reference')}:</span>
                              <span className="text-xs text-foreground font-mono">{movement.reference}</span>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  )
}
