import { useEffect, useMemo } from 'react'
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
import { Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { MOVEMENT_TYPE_OPTIONS } from '@/lib/inventory-constants'
import { invalidateStockOverviewQueries } from '@/lib/queryKeys/inventory'
import { previewAfterWaste, type SelectableWasteReasonCode } from '@/lib/inventoryWaste'
import { WasteReasonSelect } from './WasteReasonSelect'
import { useWasteSubmission } from './useWasteSubmission'

interface AdjustStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
}

type AdjustFormValues = AdjustStockDto & { wasteReason: SelectableWasteReasonCode | '' }

const EMPTY_FORM: AdjustFormValues = { type: 'ADJUSTMENT', quantity: undefined, reason: '', reference: '', wasteReason: '' }

/**
 * ¿Hay algo que registrar como merma? Una merma de 0 (o vacía, que llega como NaN) no es merma: el
 * servidor sólo manda al libro de merma una cantidad NEGATIVA, así que 0 caería al ajuste viejo sin
 * folio y la pantalla diría «Merma registrada» sin haber registrado nada. Sólo aplica a SPOILAGE.
 */
const hasWasteQuantity = (quantity: number | undefined) => Math.abs(quantity || 0) > 0

export function AdjustStockDialog({ open, onOpenChange, rawMaterial }: AdjustStockDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnitWithQuantity } = useUnitTranslation()

  const target = useMemo(
    () => (rawMaterial ? { kind: 'ingredient' as const, id: rawMaterial.id, unit: rawMaterial.unit } : null),
    [rawMaterial],
  )
  // «Desperdicio» (SPOILAGE) es MERMA: folio estable y sin bloqueo por existencia (D4).
  const waste = useWasteSubmission({
    venueId,
    target,
    type: 'SPOILAGE',
    send: payload => rawMaterialsApi.adjustStock(venueId, rawMaterial!.id, payload),
    onSuccess: () => onOpenChange(false),
  })
  const { restart } = waste

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors },
  } = useForm<AdjustFormValues>({ defaultValues: EMPTY_FORM })

  const adjustmentType = watch('type')
  const quantity = watch('quantity')
  const wasteReason = watch('wasteReason')
  const isWaste = adjustmentType === 'SPOILAGE'

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM)
      restart()
    }
  }, [open, reset, restart])

  // Todo lo que NO es merma sigue exactamente como antes.
  const adjustStockMutation = useMutation({
    mutationFn: (data: AdjustStockDto) => rawMaterialsApi.adjustStock(venueId, rawMaterial!.id, data),
    onSuccess: () => {
      if (venueId && rawMaterial?.id) {
        invalidateStockOverviewQueries(queryClient, venueId, {
          kind: 'ingredient',
          id: rawMaterial.id,
        })
      }
      toast({
        title: t('rawMaterials.messages.stockAdjusted'),
        variant: 'default',
      })
      onOpenChange(false)
      reset(EMPTY_FORM)
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.response?.data?.message || 'Failed to adjust stock',
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (values: AdjustFormValues) => {
    if (values.type === 'SPOILAGE') {
      if (!values.wasteReason || !hasWasteQuantity(values.quantity)) return
      waste.submit({
        quantity: values.quantity,
        reasonCode: values.wasteReason,
        note: values.reason ?? '',
        reference: values.reference ?? '',
      })
      return
    }
    const { wasteReason: _wasteReason, ...data } = values
    adjustStockMutation.mutate(data)
  }

  if (!rawMaterial) return null

  const unit = rawMaterial.unit
  const currentStock = Number(rawMaterial.currentStock)
  const wastePreview = previewAfterWaste(currentStock, Math.abs(quantity || 0))
  const newStock = isWaste ? wastePreview.newStock : currentStock + (quantity || 0)
  // Un AJUSTE bajo cero sigue bloqueado (el servidor lo rechaza); la MERMA no (D4).
  const isNegativeStock = !isWaste && newStock < 0
  const isPending = adjustStockMutation.isPending || waste.isPending
  const available = Math.max(0, currentStock)
  // Merma sin cantidad: el botón no se habilita. Si la persona ESCRIBIÓ 0, se le dice por qué.
  const wasteWithoutQuantity = isWaste && !hasWasteQuantity(quantity)
  const wasteQuantityIsZero = isWaste && quantity === 0

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
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rawMaterials.fields.currentStock')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {currentStock.toFixed(2)} {formatUnitWithQuantity(currentStock, unit)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('rawMaterials.movements.newStock')}</p>
                <p className={`text-2xl font-bold ${isNegativeStock ? 'text-destructive' : 'text-foreground'}`}>
                  {newStock.toFixed(2)} {formatUnitWithQuantity(newStock, unit)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="adjustmentType">{t('rawMaterials.movements.type')} *</Label>
            <Select name="adjustmentType" value={adjustmentType} onValueChange={value => setValue('type', value as AdjustStockDto['type'])}>
              <SelectTrigger id="adjustmentType" data-tour="ingredient-adjust-type">
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

          {isWaste && (
            <div className="space-y-2">
              <Label htmlFor="ingredientWasteReason">{t('waste.reason')} *</Label>
              <WasteReasonSelect
                id="ingredientWasteReason"
                value={wasteReason}
                onChange={code => setValue('wasteReason', code, { shouldValidate: true })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">{isWaste ? t('waste.quantityWasted') : t('rawMaterials.movements.quantity')} *</Label>
            <div className="flex gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setValue('quantity', Number(((quantity || 0) - 1).toFixed(2)))}>
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0"
                data-tour="ingredient-adjust-quantity"
                {...register('quantity', { required: true, valueAsNumber: true })}
                className="flex-1 text-center"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setValue('quantity', Number(((quantity || 0) + 1).toFixed(2)))}>
                +
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              {isWaste ? tCommon('subtract') : quantity > 0 ? tCommon('add') : quantity < 0 ? tCommon('subtract') : ''}{' '}
              {Math.abs(quantity || 0).toFixed(2)} {formatUnitWithQuantity(Math.abs(quantity || 0), unit)}
            </p>
            {errors.quantity && <p className="text-xs text-destructive">{t('validation.required')}</p>}
            {wasteQuantityIsZero && <p className="text-xs text-destructive">{t('waste.quantityMinimum')}</p>}
          </div>

          {isNegativeStock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{t('validation.negativeStockWarning')}</AlertDescription>
            </Alert>
          )}

          {isWaste && wastePreview.unrecorded > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('waste.unrecordedWarning', {
                  available: `${available} ${formatUnitWithQuantity(available, unit)}`,
                  unrecorded: `${wastePreview.unrecorded} ${formatUnitWithQuantity(wastePreview.unrecorded, unit)}`,
                })}
              </AlertDescription>
            </Alert>
          )}

          {/* Con CUALQUIER tipo elegido: al reabrir, el formulario vuelve a «Ajuste», y la persona tiene
              que saber que la merma anterior pudo haber entrado antes de capturar otra cosa. */}
          {waste.ambiguous && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('waste.ambiguousHint')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">{isWaste ? t('waste.notes') : t('rawMaterials.movements.reason')}</Label>
            <Textarea
              id="reason"
              rows={2}
              {...register('reason')}
              placeholder={isWaste ? t('waste.notesPlaceholder') : t('rawMaterials.movements.reason')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">{t('rawMaterials.movements.reference')}</Label>
            <Input id="reference" {...register('reference')} placeholder={t('rawMaterials.movements.reference')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {t('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || isNegativeStock || (isWaste && !wasteReason) || wasteWithoutQuantity}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
