import { useEffect, useMemo, useState } from 'react'
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
import { Loader2, AlertCircle, AlertTriangle, Info } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { PRODUCT_MOVEMENT_TYPE_OPTIONS } from '@/lib/inventory-constants'
import { previewAfterWaste, type SelectableWasteReasonCode } from '@/lib/inventoryWaste'
import type { Product } from '@/types'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { useRecentMovements } from '@/hooks/useRecentMovements'
import { RecentMovementsSection } from '@/components/inventory/RecentMovementsSection'
import { WasteReasonSelect } from './WasteReasonSelect'
import { useWasteSubmission } from './useWasteSubmission'

interface AdjustInventoryStockDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  product: Product | null
}

type AdjustFormValues = AdjustInventoryStockDto & { wasteReason: SelectableWasteReasonCode | '' }

const EMPTY_FORM: AdjustFormValues = { type: 'ADJUSTMENT', quantity: undefined, reason: '', reference: '', wasteReason: '' }

/**
 * ¿Hay algo que registrar como merma? Una merma de 0 (o vacía, que llega como NaN) no es merma: el
 * servidor sólo manda al libro de merma una cantidad NEGATIVA, así que 0 caería al ajuste viejo sin
 * folio y la pantalla diría «Merma registrada» sin haber registrado nada. Sólo aplica a LOSS.
 */
const hasWasteQuantity = (quantity: number | undefined) => Math.abs(quantity || 0) > 0

export function AdjustInventoryStockDialog({ open, onOpenChange, product }: AdjustInventoryStockDialogProps) {
  const { t } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const [showLargeAdjustmentConfirm, setShowLargeAdjustmentConfirm] = useState(false)

  const {
    movements,
    isLoading: isLoadingMovements,
    hasRecentMovements,
  } = useRecentMovements({
    venueId,
    productId: product?.id ?? null,
    enabled: open,
    limit: 5,
  })

  const unitKey = (product?.unit || 'UNIT').toUpperCase()
  const target = useMemo(() => (product ? { kind: 'product' as const, id: product.id, unit: unitKey } : null), [product, unitKey])
  // La MERMA (LOSS) va por su propio envío: folio estable, sin bloqueo por existencia (D4).
  const waste = useWasteSubmission({
    venueId,
    target,
    type: 'LOSS',
    send: payload => productInventoryApi.adjustStock(venueId, product!.id, payload),
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
  const isLoss = adjustmentType === 'LOSS'

  useEffect(() => {
    if (open) {
      reset(EMPTY_FORM)
      setShowLargeAdjustmentConfirm(false)
      restart()
    }
  }, [open, reset, restart])

  // Todo lo que NO es merma sigue exactamente como antes.
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
    const isLargeAdjustmentNow = currentStock > 0 && Math.abs(quantity || 0) > currentStock * 0.5
    if (isLargeAdjustmentNow && !showLargeAdjustmentConfirm) {
      setShowLargeAdjustmentConfirm(true)
      return
    }
    if (values.type === 'LOSS') {
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

  if (!product || !product.inventory) return null

  const currentStock = Number(product.inventory.currentStock)
  const lossPreview = previewAfterWaste(currentStock, Math.abs(quantity || 0))
  const newStock = isLoss ? lossPreview.newStock : currentStock + (quantity || 0)
  // Un AJUSTE bajo cero sigue bloqueado (el servidor lo rechaza); la MERMA no (D4).
  const isNegativeStock = !isLoss && newStock < 0
  const isLargeAdjustment = currentStock > 0 && Math.abs(quantity || 0) > currentStock * 0.5
  const isPending = adjustStockMutation.isPending || waste.isPending
  const available = Math.max(0, currentStock)
  // Merma sin cantidad: el botón no se habilita. Si la persona ESCRIBIÓ 0, se le dice por qué.
  const lossWithoutQuantity = isLoss && !hasWasteQuantity(quantity)
  const lossQuantityIsZero = isLoss && quantity === 0

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('rawMaterials.adjustStock')}</DialogTitle>
          <DialogDescription>
            {product.name} ({product.sku})
          </DialogDescription>
        </DialogHeader>

        <RecentMovementsSection
          movements={movements}
          isLoading={isLoadingMovements}
          hasRecentMovements={hasRecentMovements}
          unit={formatUnitWithQuantity(1, unitKey)}
        />

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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

          <div className="space-y-2">
            <Label htmlFor="adjustmentType">{t('rawMaterials.movements.type')} *</Label>
            <Select
              name="adjustmentType"
              value={adjustmentType}
              onValueChange={value => {
                setValue('type', value as AdjustInventoryStockDto['type'])
                setShowLargeAdjustmentConfirm(false)
              }}
            >
              <SelectTrigger id="adjustmentType" data-tour="product-adjust-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_MOVEMENT_TYPE_OPTIONS.map(type => (
                  <SelectItem key={type} value={type}>
                    {t(`rawMaterials.movements.types.${type}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoss && (
            <div className="space-y-2">
              <Label htmlFor="productWasteReason">{t('waste.reason')} *</Label>
              <WasteReasonSelect
                id="productWasteReason"
                value={wasteReason}
                onChange={code => setValue('wasteReason', code, { shouldValidate: true })}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="quantity">{isLoss ? t('waste.quantityWasted') : t('rawMaterials.movements.quantity')} *</Label>
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
                data-tour="product-adjust-quantity"
                {...register('quantity', {
                  required: true,
                  valueAsNumber: true,
                  onChange: () => setShowLargeAdjustmentConfirm(false),
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
              {isLoss
                ? `${tCommon('subtract')} ${Math.abs(quantity || 0).toFixed(2)} ${formatUnitWithQuantity(Math.abs(quantity || 0), unitKey)}`
                : `${quantity > 0 ? tCommon('add') : quantity < 0 ? tCommon('subtract') : ''} ${Math.abs(quantity || 0).toFixed(2)} ${formatUnitWithQuantity(quantity || 0, unitKey)}`}
            </p>
            {errors.quantity && <p className="text-xs text-destructive">{t('validation.required')}</p>}
            {lossQuantityIsZero && <p className="text-xs text-destructive">{t('waste.quantityMinimum')}</p>}
          </div>

          {isNegativeStock && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {t('validation.cannotReduceBelowZero', {
                  amount: currentStock.toFixed(2),
                  unit: formatUnitWithQuantity(currentStock, unitKey),
                  minimum: (-currentStock).toFixed(2),
                })}
              </AlertDescription>
            </Alert>
          )}

          {isLoss && lossPreview.unrecorded > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('waste.unrecordedWarning', {
                  available: `${available} ${formatUnitWithQuantity(available, unitKey)}`,
                  unrecorded: `${lossPreview.unrecorded} ${formatUnitWithQuantity(lossPreview.unrecorded, unitKey)}`,
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

          {isLargeAdjustment && !isNegativeStock && (
            <Alert className="border-orange-200 bg-orange-50 dark:bg-orange-950/50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800 dark:text-orange-200">
                {showLargeAdjustmentConfirm ? (
                  <>
                    <strong>{t('validation.confirmLargeAdjustment')}</strong>{' '}
                    {t('validation.confirmLargeAdjustmentMessage', {
                      amount: Math.abs(quantity || 0).toFixed(2),
                      unit: formatUnitWithQuantity(quantity || 0, unitKey),
                      percentage: ((Math.abs(quantity || 0) / currentStock) * 100).toFixed(0),
                    })}
                  </>
                ) : (
                  <>
                    <strong>{t('validation.warning')}</strong>{' '}
                    {t('validation.largeAdjustmentWarning', {
                      percentage: ((Math.abs(quantity || 0) / currentStock) * 100).toFixed(0),
                    })}
                  </>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">{isLoss ? t('waste.notes') : t('rawMaterials.movements.reason')}</Label>
            <Textarea
              id="reason"
              rows={2}
              {...register('reason')}
              placeholder={isLoss ? t('waste.notesPlaceholder') : t('rawMaterials.movements.reason')}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="reference">{t('rawMaterials.movements.reference')}</Label>
            <Input id="reference" {...register('reference')} placeholder={t('rawMaterials.movements.reference')} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={isPending || isNegativeStock || (isLoss && !wasteReason) || lossWithoutQuantity}>
              {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {showLargeAdjustmentConfirm && isLargeAdjustment && !isNegativeStock
                ? tCommon('confirmAndSave')
                : isPending
                  ? tCommon('saving')
                  : t('save')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
