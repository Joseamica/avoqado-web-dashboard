import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { rawMaterialsApi, type RawMaterial, type AdjustStockDto } from '@/services/inventory.service'
import { Loader2, AlertCircle, Trash2 } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { WASTE_REASONS, WASTE_CATEGORIES, WASTE_REASONS_BY_CATEGORY } from '@/lib/inventory-constants'

interface WasteLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
}

export function WasteLogDialog({ open, onOpenChange, rawMaterial }: WasteLogDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const [selectedCategory, setSelectedCategory] = useState<string>('')

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdjustStockDto & { wasteReason: string }>({
    defaultValues: {
      type: 'SPOILAGE', // Always spoilage for waste tracking
      quantity: undefined,
      reason: '',
      reference: '',
      wasteReason: '',
    },
  })

  const quantity = watch('quantity')
  const wasteReason = watch('wasteReason')

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      reset({
        type: 'SPOILAGE',
        quantity: undefined,
        reason: '',
        reference: '',
        wasteReason: '',
      })
      setSelectedCategory('')
    }
  }, [open, reset])

  // Update reason when waste reason changes
  useEffect(() => {
    if (wasteReason && WASTE_REASONS[wasteReason as keyof typeof WASTE_REASONS]) {
      const reasonInfo = WASTE_REASONS[wasteReason as keyof typeof WASTE_REASONS]
      setValue('reason', reasonInfo.label)
    }
  }, [wasteReason, setValue])

  // Log waste mutation (uses the existing adjust stock API with SPOILAGE type)
  const logWasteMutation = useMutation({
    mutationFn: (data: AdjustStockDto) => {
      // Convert to negative quantity for waste
      const wasteData = {
        ...data,
        quantity: Math.abs(data.quantity || 0) * -1, // Always negative for waste
      }
      return rawMaterialsApi.adjustStock(venueId, rawMaterial!.id, wasteData)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rawMaterials', venueId] })
      queryClient.invalidateQueries({ queryKey: ['stockMovements', venueId, rawMaterial?.id] })
      toast({
        title: t('waste.logged'),
        description: t('waste.loggedDesc'),
        variant: 'default',
      })
      onOpenChange(false)
      reset()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error'),
        description: error.response?.data?.message || t('waste.errorLogging'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: AdjustStockDto & { wasteReason: string }) => {
    logWasteMutation.mutate(data)
  }

  if (!rawMaterial) return null

  const currentStock = Number(rawMaterial.currentStock)
  const wastedQuantity = Math.abs(quantity || 0)
  const newStock = currentStock - wastedQuantity
  const isInsufficientStock = newStock < 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            {t('waste.title')}
          </DialogTitle>
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
                <p className="text-sm text-muted-foreground">{t('waste.afterWaste')}</p>
                <p className={`text-2xl font-bold ${isInsufficientStock ? 'text-destructive' : 'text-foreground'}`}>
                  {newStock.toFixed(2)} {formatUnitWithQuantity(newStock, rawMaterial.unit)}
                </p>
              </div>
            </div>
            {wastedQuantity > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground">{t('waste.wastedAmount')}</p>
                <p className="text-lg font-semibold text-destructive">
                  -{wastedQuantity.toFixed(2)} {formatUnitWithQuantity(wastedQuantity, rawMaterial.unit)}
                </p>
              </div>
            )}
          </div>

          {/* Waste Reason - Grouped by Category */}
          <div className="space-y-2">
            <Label htmlFor="wasteReason">{t('waste.reason')} *</Label>
            <Select
              value={wasteReason}
              onValueChange={value => {
                setValue('wasteReason', value, { shouldValidate: true })
                // Find the category of the selected reason
                const reason = WASTE_REASONS[value as keyof typeof WASTE_REASONS]
                if (reason) {
                  setSelectedCategory(reason.category)
                }
              }}
            >
              <SelectTrigger>
                <SelectValue placeholder={t('waste.selectReason')} />
              </SelectTrigger>
              <SelectContent className="max-h-[400px]">
                {Object.entries(WASTE_REASONS_BY_CATEGORY).map(([categoryKey, reasons]) => {
                  const categoryInfo = WASTE_CATEGORIES[categoryKey as keyof typeof WASTE_CATEGORIES]
                  return (
                    <SelectGroup key={categoryKey}>
                      <SelectLabel className="flex items-center gap-2 py-2">
                        <span>{categoryInfo.icon}</span>
                        <span className="font-semibold">{t(`waste.categories.${categoryKey}`)}</span>
                      </SelectLabel>
                      {reasons.map(reason => (
                        <SelectItem key={reason.value} value={reason.value}>
                          <div className="flex items-center gap-2">
                            <span>{reason.icon}</span>
                            <div>
                              <p className="font-medium">{t(`waste.reasons.${reason.value}.label`)}</p>
                              <p className="text-xs text-muted-foreground">{t(`waste.reasons.${reason.value}.description`)}</p>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )
                })}
              </SelectContent>
            </Select>
            {errors.wasteReason && <p className="text-xs text-destructive">{t('waste.reasonRequired')}</p>}
          </div>

          {/* Quantity Wasted */}
          <div className="space-y-2">
            <Label htmlFor="quantity">{t('waste.quantityWasted')} *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const newVal = Math.max(0, (quantity || 0) - 1)
                  setValue('quantity', Number(newVal.toFixed(2)))
                }}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                {...register('quantity', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 0.01, message: t('waste.quantityMinimum') },
                })}
                className="flex-1 text-center"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => {
                  const newVal = (quantity || 0) + 1
                  setValue('quantity', Number(newVal.toFixed(2)))
                }}
              >
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {wastedQuantity > 0 && `${wastedQuantity.toFixed(2)} ${formatUnitWithQuantity(wastedQuantity, rawMaterial.unit)} ${t('waste.willBeDeducted')}`}
            </p>
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message || t('waste.quantityRequired')}</p>}
          </div>

          {/* Warning for insufficient stock */}
          {isInsufficientStock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('waste.insufficientStock')}</AlertDescription>
            </Alert>
          )}

          {/* Additional Notes */}
          <div className="space-y-2">
            <Label htmlFor="reference">{t('waste.notes')}</Label>
            <Textarea
              id="reference"
              rows={3}
              {...register('reference')}
              placeholder={t('waste.notesPlaceholder')}
            />
            <p className="text-xs text-muted-foreground">{t('waste.notesHelp')}</p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={logWasteMutation.isPending}
            >
              {tCommon('cancel')}
            </Button>
            <Button
              type="submit"
              variant="destructive"
              disabled={logWasteMutation.isPending || isInsufficientStock || !wasteReason}
            >
              {logWasteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              {t('waste.logWaste')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
