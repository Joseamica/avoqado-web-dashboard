import { useEffect } from 'react'
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
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { rawMaterialsApi, type RawMaterial, type AdjustStockDto } from '@/services/inventory.service'
import { Loader2, AlertCircle } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MOVEMENT_TYPE_OPTIONS } from '@/lib/inventory-constants'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
}

export function AdjustStockDialog({ open, onOpenChange, rawMaterial }: AdjustStockDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnit, formatUnitWithQuantity } = useUnitTranslation()

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdjustStockDto>({
    defaultValues: {
      type: 'ADJUSTMENT',
      quantity: undefined, // No default value - user must enter
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
        quantity: undefined, // No default value - user must enter
        reason: '',
        reference: '',
      })
    }
  }, [open, reset])

  // Adjust stock mutation
  const adjustStockMutation = useMutation({
    mutationFn: (data: AdjustStockDto) => rawMaterialsApi.adjustStock(venueId, rawMaterial!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stockMovements', venueId, rawMaterial?.id] })
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

  const onSubmit = (data: AdjustStockDto) => {
    adjustStockMutation.mutate(data)
  }

  if (!rawMaterial) return null

  const currentStock = Number(rawMaterial.currentStock)
  const newStock = currentStock + (quantity || 0)
  const isNegativeStock = newStock < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rawMaterials.adjustStock')}</DialogTitle>
          <DialogDescription>
            {rawMaterial.name} ({rawMaterial.sku})
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* Current Stock Display */}
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rawMaterials.fields.currentStock')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {currentStock.toFixed(2)} {formatUnitWithQuantity(currentStock, rawMaterial.unit)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('rawMaterials.movements.newStock')}</p>
                <p className={`text-2xl font-bold ${isNegativeStock ? 'text-destructive' : 'text-foreground'}`}>
                  {newStock.toFixed(2)} {formatUnitWithQuantity(newStock, rawMaterial.unit)}
                </p>
              </div>
            </div>
          </div>

          {/* Adjustment Type */}
          <div className="space-y-2">
            <Label htmlFor="type">{t('rawMaterials.movements.type')} *</Label>
            <Select
              value={adjustmentType}
              onValueChange={value => setValue('type', value as any)}
            >
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
                onClick={() => setValue('quantity', Number(((quantity || 0) - 1).toFixed(2)))}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0"
                {...register('quantity', { required: true, valueAsNumber: true })}
                className="flex-1 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setValue('quantity', Number(((quantity || 0) + 1).toFixed(2)))}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {quantity > 0 ? tCommon('add') : quantity < 0 ? tCommon('subtract') : ''} {Math.abs(quantity || 0).toFixed(2)} {formatUnitWithQuantity(Math.abs(quantity || 0), rawMaterial.unit)}
            </p>
            {errors.quantity && <p className="text-xs text-destructive">{t('validation.required')}</p>}
          </div>

          {/* Warning for negative stock */}
          {isNegativeStock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('validation.negativeStockWarning')}
              </AlertDescription>
            </Alert>
          )}

          {/* Reason */}
          <div className="space-y-2">
            <Label htmlFor="reason">{t('rawMaterials.movements.reason')}</Label>
            <Textarea
              id="reason"
              rows={2}
              {...register('reason')}
              placeholder={t('rawMaterials.movements.reason')}
            />
          </div>

          {/* Reference */}
          <div className="space-y-2">
            <Label htmlFor="reference">{t('rawMaterials.movements.reference')}</Label>
            <Input
              id="reference"
              {...register('reference')}
              placeholder={t('rawMaterials.movements.reference')}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={adjustStockMutation.isPending}
            >
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={adjustStockMutation.isPending || isNegativeStock}>
              {adjustStockMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
