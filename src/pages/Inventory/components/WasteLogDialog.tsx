import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useUnitTranslation } from '@/hooks/use-unit-translation'
import { getIntlLocale } from '@/utils/i18n-locale'
import { rawMaterialsApi, type RawMaterial } from '@/services/inventory.service'
import { formatWasteQuantity, previewAfterWaste, type SelectableWasteReasonCode } from '@/lib/inventoryWaste'
import { AlertTriangle, Info, Loader2, Trash2 } from 'lucide-react'
import { WasteReasonSelect } from './WasteReasonSelect'
import { useWasteSubmission } from './useWasteSubmission'

interface WasteLogDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  rawMaterial: RawMaterial | null
}

interface WasteLogFormValues {
  quantity: number
  reasonCode: SelectableWasteReasonCode | ''
  note: string
}

export function WasteLogDialog({ open, onOpenChange, rawMaterial }: WasteLogDialogProps) {
  const { t, i18n } = useTranslation('inventory')
  const { t: tCommon } = useTranslation('common')
  const { venueId } = useCurrentVenue()
  const { formatUnitWithQuantity } = useUnitTranslation()
  const locale = getIntlLocale(i18n.language)

  const target = useMemo(
    () => (rawMaterial ? { kind: 'ingredient' as const, id: rawMaterial.id, unit: rawMaterial.unit } : null),
    [rawMaterial],
  )
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
  } = useForm<WasteLogFormValues>({ defaultValues: { quantity: undefined, reasonCode: '', note: '' } })

  const quantity = watch('quantity')
  const reasonCode = watch('reasonCode')

  // Cada vez que se abre: formulario limpio y folio nuevo.
  useEffect(() => {
    if (open) {
      reset({ quantity: undefined, reasonCode: '', note: '' })
      restart()
    }
  }, [open, reset, restart])

  const onSubmit = (values: WasteLogFormValues) => {
    if (!values.reasonCode) return
    waste.submit({ quantity: values.quantity, reasonCode: values.reasonCode, note: values.note ?? '' })
  }

  if (!rawMaterial) return null

  const unit = rawMaterial.unit
  const currentStock = Number(rawMaterial.currentStock)
  const declared = Math.abs(quantity || 0)
  // D4: el servidor descuenta lo que haya y el resto queda «sin existencia». Aquí sólo se AVISA.
  const preview = previewAfterWaste(currentStock, declared)
  const available = Math.max(0, currentStock)

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
          <div className="p-4 rounded-lg bg-muted border border-border">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">{t('rawMaterials.fields.currentStock')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatWasteQuantity(currentStock, locale)} {formatUnitWithQuantity(currentStock, unit)}
                </p>
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">{t('waste.afterWaste')}</p>
                <p className="text-2xl font-bold text-foreground">
                  {formatWasteQuantity(preview.newStock, locale)} {formatUnitWithQuantity(preview.newStock, unit)}
                </p>
              </div>
            </div>
            {declared > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-sm text-muted-foreground">{t('waste.wastedAmount')}</p>
                <p className="text-lg font-semibold text-destructive">
                  -{formatWasteQuantity(declared, locale)} {formatUnitWithQuantity(declared, unit)}
                </p>
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="wasteReason">{t('waste.reason')} *</Label>
            <WasteReasonSelect id="wasteReason" value={reasonCode} onChange={code => setValue('reasonCode', code, { shouldValidate: true })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="quantity">{t('waste.quantityWasted')} *</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={() => setValue('quantity', Number(Math.max(0, (quantity || 0) - 1).toFixed(2)))}
              >
                -
              </Button>
              <Input
                id="quantity"
                type="number"
                step="0.01"
                min="0"
                placeholder="0"
                data-tour="waste-quantity"
                {...register('quantity', {
                  required: true,
                  valueAsNumber: true,
                  min: { value: 0.01, message: t('waste.quantityMinimum') },
                })}
                className="flex-1 text-center"
              />
              <Button type="button" variant="outline" size="icon" onClick={() => setValue('quantity', Number(((quantity || 0) + 1).toFixed(2)))}>
                +
              </Button>
            </div>
            {errors.quantity && <p className="text-xs text-destructive">{errors.quantity.message || t('waste.quantityRequired')}</p>}
          </div>

          {preview.unrecorded > 0 && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {t('waste.unrecordedWarning', {
                  available: `${formatWasteQuantity(available, locale)} ${formatUnitWithQuantity(available, unit)}`,
                  unrecorded: `${formatWasteQuantity(preview.unrecorded, locale)} ${formatUnitWithQuantity(preview.unrecorded, unit)}`,
                })}
              </AlertDescription>
            </Alert>
          )}

          {waste.ambiguous && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{t('waste.ambiguousHint')}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="note">{t('waste.notes')}</Label>
            <Textarea id="note" rows={3} data-tour="waste-note" {...register('note')} placeholder={t('waste.notesPlaceholder')} />
            <p className="text-xs text-muted-foreground">{t('waste.notesHelp')}</p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={waste.isPending}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" variant="destructive" disabled={waste.isPending || !reasonCode} data-tour="waste-submit">
              {waste.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              {t('waste.logWaste')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
