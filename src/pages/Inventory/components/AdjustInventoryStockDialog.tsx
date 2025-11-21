import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { productInventoryApi, type AdjustInventoryStockDto } from '@/services/inventory.service'
import { Loader2, AlertCircle, AlertTriangle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MOVEMENT_TYPE_OPTIONS } from '@/lib/inventory-constants'
import type { Product } from '@/types'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useRecentMovements } from '@/hooks/useRecentMovements'
import { RecentMovementsSection } from '@/components/inventory/RecentMovementsSection'

interface AdjustInventoryStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

export function AdjustInventoryStockDialog({ open, onOpenChange, product }: AdjustInventoryStockDialogProps) {
  const { t } = useTranslation('inventory')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const [showLargeAdjustmentConfirm, setShowLargeAdjustmentConfirm] = useState(false)

  // Fetch recent movements
  const { movements, isLoading: isLoadingMovements, hasRecentMovements } = useRecentMovements({
    venueId,
    productId: product?.id ?? null,
    enabled: open,
    limit: 5,
  })

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdjustInventoryStockDto>({
    defaultValues: {
      type: 'ADJUSTMENT',
      quantity: undefined,
      reason: '',
      reference: '',
    },
  })

  const adjustmentType = watch('type')
  const quantity = watch('quantity')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        type: 'ADJUSTMENT',
        quantity: undefined,
        reason: '',
        reference: '',
      })
      setShowLargeAdjustmentConfirm(false)
    }
  }, [open, reset])

  // Adjust stock mutation
  const adjustStockMutation = useMutation({
    mutationFn: (data: AdjustInventoryStockDto) => productInventoryApi.adjustStock(venueId, product!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products', venueId] })
      queryClient.invalidateQueries({ queryKey: ['productInventoryMovements', venueId, product?.id] })
      toast({
        title: t('rawMaterials.messages.stockAdjusted'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to adjust stock',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AdjustInventoryStockDto) => {
    // Check for large adjustment confirmation
    const isLargeAdjustment = currentStock > 0 && Math.abs(quantity || 0) > (currentStock * 0.5)

    if (isLargeAdjustment && !showLargeAdjustmentConfirm) {
      setShowLargeAdjustmentConfirm(true)
      return
    }

    adjustStockMutation.mutate(data)
  }

  if (!product || !product.inventory) return null

  const unitKey = (product.unit || 'UNIT').toUpperCase()
  const currentStock = Number(product.inventory.currentStock)
  const newStock = currentStock + (quantity || 0)
  const isNegativeStock = newStock < 0
  const isLargeAdjustment = currentStock > 0 && Math.abs(quantity || 0) > (currentStock * 0.5)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rawMaterials.adjustStock')}</DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        {/* Recent Stock Movements */}
        <RecentMovementsSection
          movements={movements}
          isLoading={isLoadingMovements}
          hasRecentMovements={hasRecentMovements}
          unit={formatUnitWithQuantity(1, unitKey)}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Stock Display */}
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rawMaterials.fields.currentStock')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {currentStock.toFixed(2)} {formatUnitWithQuantity(currentStock, unitKey)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('rawMaterials.movements.newStock')}</p>
                <p className={`text-2xl font-bold ${isNegativeStock ? 'text-destructive' : 'text-foreground'}`}>
                  {newStock.toFixed(2)} {formatUnitWithQuantity(newStock, unitKey)}
                </p>
              </div>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('rawMaterials.movements.type')} *</Label>
            <Select value={adjustmentType} onValueChange={value => setValue('type', value as any)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MOVEMENT_TYPE_OPTIONS.map(type => (
                  <SelectItem key={type.value} value={type.value}>
                    {t(`rawMaterials.movements.types.${type.value}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Quantity */}
          <div className="space-y-2">
            <Label htmlFor="quantity">{t('rawMaterials.movements.quantity')} *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setValue('quantity', Number(((quantity || 0) - 1).toFixed(2)))
                  setShowLargeAdjustmentConfirm(false)
                }}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('quantity', {
                  required: true,
                  valueAsNumber: true,
                  onChange: () => setShowLargeAdjustmentConfirm(false)
                })}
                className="flex-1 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  setValue('quantity', Number(((quantity || 0) + 1).toFixed(2)))
                  setShowLargeAdjustmentConfirm(false)
                }}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {quantity > 0 ? t('common.add') : quantity < 0 ? t('common.subtract') : ''}{' '}
              {Math.abs(quantity || 0).toFixed(2)} {formatUnitWithQuantity(quantity || 0, unitKey)}
            </p>
            {errors.quantity && <p className="text-xs text-destructive">Required</p>}
          </div>

          {/* Warning for negative stock */}
          {isNegativeStock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Cannot reduce stock below 0. Current stock is {currentStock.toFixed(2)} {formatUnitWithQuantity(currentStock, unitKey)}.
                Minimum adjustment: {(-currentStock).toFixed(2)}
              </AlertDescription>
            </Alert>
          )}

          {/* Large Adjustment Warning */}
          {isLargeAdjustment && !isNegativeStock && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {showLargeAdjustmentConfirm ? (
                  <>
                    <strong>Confirm large adjustment:</strong> This will change stock by {Math.abs(quantity || 0).toFixed(2)} {formatUnitWithQuantity(quantity || 0, unitKey)}
                    ({(Math.abs(quantity || 0) / currentStock * 100).toFixed(0)}% of current stock). Click Save again to confirm.
                  </>
                ) : (
                  <>
                    <strong>Warning:</strong> This is a large adjustment ({(Math.abs(quantity || 0) / currentStock * 100).toFixed(0)}% of current stock).
                    Please verify the amount is correct.
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('rawMaterials.movements.reason')}</Label>
            <Textarea id="reason" rows={2} {...register('reason')} placeholder={t('rawMaterials.movements.reason')} />
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">{t('rawMaterials.movements.reference')}</Label>
            <Input id="reference" {...register('reference')} placeholder={t('rawMaterials.movements.reference')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={adjustStockMutation.isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending || isNegativeStock}>
              {adjustStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showLargeAdjustmentConfirm && isLargeAdjustment && !isNegativeStock
                ? 'Confirm & Save'
                : adjustStockMutation.isPending
                ? t('common.saving')
                : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
