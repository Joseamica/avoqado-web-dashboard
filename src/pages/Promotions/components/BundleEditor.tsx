import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation } from '@tanstack/react-query'
import { ImagePlus, Layers, Plus, Trash2 } from 'lucide-react'
import { DateTime } from 'luxon'
import { useEffect } from 'react'
import Cropper from 'react-easy-crop'
import { type FieldPath, type UseFormReturn, useFieldArray, useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useImageUploader } from '@/hooks/use-image-uploader'
import { useToast } from '@/hooks/use-toast'
import promotionService from '@/services/promotion.service'
import type { Promotion, UpsertPromotionRequest } from '@/types/promotion'
import { useDiscountFormData } from '../hooks/useDiscountFormData'

// Zod = FORMA. Las reglas de publicación viven en el server y llegan como
// errors[] al publicar — aquí sólo se valida lo que no deja ni guardar.
const optionSchema = z.object({
  productId: z.string().min(1),
  quantity: z.number().int().min(1).optional(),
  chargedQuantity: z.number().int().min(0).optional(),
  priceDelta: z.number().min(0).optional(),
})
const groupSchema = z.object({ name: z.string().trim().min(1), options: z.array(optionSchema).min(1) })
const formSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().max(500).optional(),
  pricingMode: z.enum(['FIXED_TOTAL', 'PER_UNIT']),
  price: z.number().min(0).optional(),
  groups: z.array(groupSchema).min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)),
  timeFrom: z.string().optional(),
  timeUntil: z.string().optional(),
  validFrom: z.string().optional(),
  validUntil: z.string().optional(),
})
type FormData = z.infer<typeof formSchema>

interface BundleEditorProps {
  open: boolean
  onClose: () => void
  venueId: string
  editPromotion: Promotion | null
  onSaved: () => void
}

const emptyOption = { productId: '', quantity: 1, chargedQuantity: 1, priceDelta: 0 }

export function BundleEditor({ open, onClose, venueId, editPromotion, onSaved }: BundleEditorProps) {
  const { t } = useTranslation('promotions')
  const { toast } = useToast()
  const { venue } = useCurrentVenue()
  const venueTz = venue?.timezone ?? 'America/Mexico_City'
  const { productOptions, dayOptions } = useDiscountFormData(venueId)

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: { name: '', pricingMode: 'FIXED_TOTAL', price: undefined, groups: [{ name: '', options: [{ ...emptyOption }] }], daysOfWeek: [] },
  })
  const groupsArray = useFieldArray({ control: form.control, name: 'groups' })
  const pricingMode = form.watch('pricingMode')

  const {
    uploading, imageUrl, imageForCrop, crop, zoom, setImageForCrop, setCrop, setZoom,
    onCropComplete, handleFileUpload, handleCropConfirm, handleFileRemove, initializeWithExistingUrl,
  } = useImageUploader(`venues/${venue?.slug}/promociones`, form.watch('name') || 'promocion', { minWidth: 320, minHeight: 320 })

  // Hidratar en modo edición cada vez que abre
  useEffect(() => {
    if (!open) return
    if (editPromotion) {
      form.reset({
        name: editPromotion.name,
        description: editPromotion.description ?? undefined,
        pricingMode: editPromotion.pricingMode,
        price: editPromotion.pricingMode === 'FIXED_TOTAL' ? editPromotion.price : undefined,
        groups: editPromotion.groups.map(g => ({
          name: g.name,
          options: g.options.map(o => ({ productId: o.productId, quantity: o.quantity, chargedQuantity: o.chargedQuantity, priceDelta: o.priceDelta })),
        })),
        daysOfWeek: editPromotion.daysOfWeek,
        timeFrom: editPromotion.timeFrom ?? undefined,
        timeUntil: editPromotion.timeUntil ?? undefined,
        // 🔴 Las fechas se hidratan de vuelta EN LA ZONA DEL VENUE. Un slice(0,10)
        // sobre el ISO UTC (…T05:59:59Z) mostraría el día SIGUIENTE y cada ciclo
        // editar→guardar estiraría la vigencia +1 día (audit 2026-08-14).
        validFrom: editPromotion.validFrom ? (DateTime.fromISO(editPromotion.validFrom).setZone(venueTz).toISODate() ?? undefined) : undefined,
        validUntil: editPromotion.validUntil ? (DateTime.fromISO(editPromotion.validUntil).setZone(venueTz).toISODate() ?? undefined) : undefined,
      })
      initializeWithExistingUrl(editPromotion.imageUrl ?? null) // firma real: string | null (use-image-uploader.tsx:128)
    } else {
      form.reset({ name: '', pricingMode: 'FIXED_TOTAL', price: undefined, groups: [{ name: '', options: [{ ...emptyOption }] }], daysOfWeek: [] })
      // 🔴 NUNCA handleFileRemove() aquí: ese helper BORRA el objeto de Firebase
      // (use-image-uploader.tsx:156) — al abrir el editor limpio sólo se resetea estado local.
      initializeWithExistingUrl(null)
      setImageForCrop(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editPromotion?.id])

  const saveMutation = useMutation({
    mutationFn: (payload: UpsertPromotionRequest) =>
      editPromotion
        ? promotionService.updatePromotion(venueId, editPromotion.id, payload)
        : promotionService.createPromotion(venueId, payload),
    onSuccess: () => {
      toast({ title: editPromotion ? t('bundles.form.savedEdit') : t('bundles.form.savedNew') })
      onSaved()
    },
    onError: (error: any) => {
      toast({ title: error?.response?.data?.message ?? t('bundles.form.saveFailed'), variant: 'destructive' })
    },
  })

  const onSubmit = form.handleSubmit(values => {
    // El TYPE se deriva de la estructura: si algún grupo ofrece varias opciones
    // es COMBO ("elige"); si todos tienen una, es BUNDLE (fijo). Es la MISMA
    // regla del validador del server (un COMBO sin grupos multi-opción es
    // impublicable), así que derivar no puede "degradar" un combo legítimo —
    // y el dueño no tiene que aprenderse los términos.
    const type = values.groups.some(g => g.options.length > 1) ? 'COMBO' : 'BUNDLE'
    const payload: UpsertPromotionRequest = {
      name: values.name,
      description: values.description ?? null,
      imageUrl: imageUrl || null, // el backend exige URL válida o campo ausente — nunca ''
      type,
      pricingMode: values.pricingMode,
      price: values.pricingMode === 'FIXED_TOTAL' ? (values.price ?? 0) : 0,
      groups: values.groups.map(g => ({
        name: g.name,
        options: g.options.map(o => ({
          productId: o.productId,
          quantity: o.quantity ?? 1,
          chargedQuantity: o.chargedQuantity ?? 1,
          priceDelta: values.pricingMode === 'FIXED_TOTAL' ? (o.priceDelta ?? 0) : 0,
        })),
      })),
      daysOfWeek: values.daysOfWeek,
      timeFrom: values.timeFrom || null,
      timeUntil: values.timeUntil || null,
      // 🔴 Las fechas se anclan en la zona del VENUE, jamás en la del navegador
      // (critical-warnings: timezone). Un admin en CDMX editando un venue de
      // Tijuana NO debe correr la vigencia 2 horas.
      validFrom: values.validFrom ? DateTime.fromISO(values.validFrom, { zone: venueTz }).startOf('day').toUTC().toISO() : null,
      validUntil: values.validUntil ? DateTime.fromISO(values.validUntil, { zone: venueTz }).endOf('day').toUTC().toISO() : null,
    }
    saveMutation.mutate(payload)
  })

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={editPromotion ? t('bundles.form.editTitle') : t('bundles.form.createTitle')}
      subtitle={t('bundles.form.subtitle')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={onSubmit} disabled={saveMutation.isPending || uploading} data-tour="bundle-save">
          {saveMutation.isPending ? t('bundles.form.saving') : t('bundles.form.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {/* ── Básicos ─────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-basics">
          <div className="space-y-2">
            <Label>{t('bundles.form.name')}</Label>
            <Input className="h-12 text-base" placeholder={t('bundles.form.namePlaceholder')} {...form.register('name')} data-tour="bundle-name" />
          </div>
          <div className="space-y-2">
            <Label>{t('bundles.form.description')}</Label>
            <Textarea rows={2} {...form.register('description')} data-tour="bundle-description" />
          </div>
          <div className="space-y-2">
            <Label>{t('bundles.form.image')}</Label>
            {imageForCrop ? (
              <div className="space-y-3">
                <div className="relative h-64 w-full overflow-hidden rounded-xl">
                  <Cropper image={imageForCrop} crop={crop} zoom={zoom} maxZoom={2} aspect={4 / 3}
                    onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
                </div>
                <div className="flex gap-2">
                  <Button type="button" onClick={handleCropConfirm} disabled={uploading}>{t('bundles.form.imageConfirm')}</Button>
                  <Button type="button" variant="outline" onClick={() => setImageForCrop(null)}>{t('bundles.form.imageCancel')}</Button>
                </div>
              </div>
            ) : imageUrl ? (
              <div className="flex items-center gap-3" data-tour="bundle-image">
                <img src={imageUrl} alt="" className="h-20 w-28 rounded-xl object-cover" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    // La foto EXISTENTE (ya guardada en la promo) sólo se desliga en
                    // local — borrarla de Storage rompería la promo si el usuario
                    // cancela. handleFileRemove (que SÍ borra de Firebase) es sólo
                    // para la foto recién subida en esta edición.
                    if (editPromotion?.imageUrl && imageUrl === editPromotion.imageUrl) initializeWithExistingUrl(null)
                    else void handleFileRemove()
                  }}
                >
                  {t('bundles.form.imageRemove')}
                </Button>
              </div>
            ) : (
              <label className="flex h-24 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-input text-muted-foreground" data-tour="bundle-image">
                <ImagePlus className="h-5 w-5" /> {t('bundles.form.imageUpload')}
                {/* handleFileUpload recibe File, NO el evento (use-image-uploader.tsx:49) */}
                <input
                  type="file"
                  accept="image/png,image/jpeg"
                  className="hidden"
                  onChange={e => {
                    const file = e.target.files?.[0]
                    if (file) handleFileUpload(file)
                    e.target.value = ''
                  }}
                />
              </label>
            )}
          </div>
        </section>

        {/* ── Precio ──────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-pricing">
          <div className="space-y-2">
            <Label>{t('bundles.form.pricingMode')}</Label>
            <Select value={pricingMode} onValueChange={v => form.setValue('pricingMode', v as FormData['pricingMode'], { shouldDirty: true })}>
              <SelectTrigger className="h-12" data-tour="bundle-pricing-mode"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="FIXED_TOTAL">{t('bundles.form.modeFixed')}</SelectItem>
                <SelectItem value="PER_UNIT">{t('bundles.form.modePerUnit')}</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              {pricingMode === 'PER_UNIT' ? t('bundles.form.modePerUnitHelp') : t('bundles.form.modeFixedHelp')}
            </p>
          </div>
          {pricingMode === 'FIXED_TOTAL' && (
            <div className="space-y-2">
              <Label>{t('bundles.form.price')}</Label>
              <Input
                className="h-12 text-base" type="number" inputMode="decimal" min={0} step="0.01" data-tour="bundle-price"
                value={form.watch('price') ?? ''}
                onChange={e => form.setValue('price', e.target.value === '' ? undefined : parseFloat(e.target.value), { shouldDirty: true })}
              />
            </div>
          )}
        </section>

        {/* ── Grupos y opciones ───────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-groups">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2"><Layers className="h-4 w-4" /><Label>{t('bundles.form.groups')}</Label></div>
            <Button type="button" variant="outline" size="sm"
              onClick={() => groupsArray.append({ name: '', options: [{ ...emptyOption }] })} data-tour="bundle-add-group">
              <Plus className="mr-1 h-4 w-4" /> {t('bundles.form.addGroup')}
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">{t('bundles.form.groupsHelp')}</p>

          {groupsArray.fields.map((group, gi) => (
            <GroupCard key={group.id} gi={gi} form={form} productOptions={productOptions} pricingMode={pricingMode}
              onRemove={groupsArray.fields.length > 1 ? () => groupsArray.remove(gi) : undefined} t={t} />
          ))}
        </section>

        {/* ── Vigencia ────────────────────────────────────────────── */}
        <section className="rounded-2xl border border-border/50 bg-card p-6 space-y-4" data-tour="bundle-schedule">
          <Label>{t('bundles.form.schedule')}</Label>
          <p className="text-sm text-muted-foreground">{t('bundles.form.scheduleHelp')}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.validFrom')}</Label>
              <Input className="h-12" type="date" {...form.register('validFrom')} data-tour="bundle-valid-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.validUntil')}</Label>
              <Input className="h-12" type="date" {...form.register('validUntil')} data-tour="bundle-valid-until" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.timeFrom')}</Label>
              <Input className="h-12" type="time" {...form.register('timeFrom')} data-tour="bundle-time-from" />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">{t('bundles.form.timeUntil')}</Label>
              <Input className="h-12" type="time" {...form.register('timeUntil')} data-tour="bundle-time-until" />
            </div>
          </div>
          <div className="flex flex-wrap gap-3 pt-1" data-tour="bundle-days">
            {dayOptions.map(day => {
              // 🔴 dayOptions[].value es STRING (useDiscountFormData.ts:56);
              // el API habla number[] — convertir aquí, no cambiar el hook.
              const dayNum = Number(day.value)
              return (
                <label key={day.value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.watch('daysOfWeek').includes(dayNum)}
                    onCheckedChange={checked => {
                      const current = form.getValues('daysOfWeek')
                      form.setValue('daysOfWeek', checked ? [...current, dayNum] : current.filter(d => d !== dayNum), { shouldDirty: true })
                    }}
                  />
                  {day.label}
                </label>
              )
            })}
          </div>
          <p className="text-xs text-muted-foreground">{t('bundles.form.daysHelp')}</p>
        </section>
      </div>
    </FullScreenModal>
  )
}

interface GroupCardProps {
  gi: number
  form: ReturnType<typeof useForm<FormData>>
  productOptions: Array<{ value: string; label: string }>
  pricingMode: FormData['pricingMode']
  onRemove?: () => void
  t: (key: string, opts?: Record<string, unknown>) => string
}

function GroupCard({ gi, form, productOptions, pricingMode, onRemove, t }: GroupCardProps) {
  const optionsArray = useFieldArray({ control: form.control, name: `groups.${gi}.options` as const })

  return (
    <div className="rounded-xl border border-input p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Input
          className="h-12 text-base"
          placeholder={t('bundles.form.groupNamePlaceholder')}
          {...form.register(`groups.${gi}.name` as const)}
          data-tour={`bundle-group-name-${gi}`}
        />
        {onRemove && (
          <Button type="button" variant="ghost" size="icon" className="cursor-pointer text-destructive" onClick={onRemove}>
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {optionsArray.fields.map((option, oi) => (
        <div key={option.id} className="grid grid-cols-12 items-end gap-2">
          <div className="col-span-5 space-y-1">
            {oi === 0 && <Label className="text-xs text-muted-foreground">{t('bundles.form.product')}</Label>}
            <Select
              value={form.watch(`groups.${gi}.options.${oi}.productId`)}
              onValueChange={v => form.setValue(`groups.${gi}.options.${oi}.productId`, v, { shouldDirty: true })}
            >
              <SelectTrigger className="h-12" data-tour={`bundle-product-${gi}-${oi}`}>
                <SelectValue placeholder={t('bundles.form.productPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {productOptions.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <NumberCell
            form={form}
            name={`groups.${gi}.options.${oi}.quantity`}
            label={oi === 0 ? t('bundles.form.quantity') : undefined}
            dataTour={`bundle-qty-${gi}-${oi}`}
          />
          <NumberCell
            form={form}
            name={`groups.${gi}.options.${oi}.chargedQuantity`}
            label={oi === 0 ? t('bundles.form.chargedQuantity') : undefined}
            dataTour={`bundle-charged-${gi}-${oi}`}
          />
          {pricingMode === 'FIXED_TOTAL' && (
            <NumberCell
              form={form}
              name={`groups.${gi}.options.${oi}.priceDelta`}
              label={oi === 0 ? t('bundles.form.priceDelta') : undefined}
              step="0.01"
              dataTour={`bundle-delta-${gi}-${oi}`}
            />
          )}
          <div className="col-span-1">
            {optionsArray.fields.length > 1 && (
              <Button type="button" variant="ghost" size="icon" className="cursor-pointer" onClick={() => optionsArray.remove(oi)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ))}

      <Button type="button" variant="outline" size="sm" onClick={() => optionsArray.append({ ...emptyOption })}>
        <Plus className="mr-1 h-4 w-4" /> {t('bundles.form.addOption')}
      </Button>
      <p className="text-xs text-muted-foreground">
        {pricingMode === 'PER_UNIT' ? t('bundles.form.perUnitRowHelp') : t('bundles.form.fixedRowHelp')}
      </p>
    </div>
  )
}

/** Numérico CLEARABLE (regla ui-patterns): borrar deja undefined, nunca 0.
 *  Tipado real de RHF — nada de `any`: los paths anidados de useFieldArray SÍ
 *  son representables con FieldPath<FormData>. */
function NumberCell({
  form,
  name,
  label,
  step = '1',
  dataTour,
}: {
  form: UseFormReturn<FormData>
  name: FieldPath<FormData>
  label?: string
  step?: string
  dataTour?: string
}) {
  const value = form.watch(name) as number | undefined
  return (
    <div className="col-span-2 space-y-1">
      {label && <Label className="text-xs text-muted-foreground">{label}</Label>}
      <Input
        className="h-12 text-base" type="number" inputMode="numeric" min={0} step={step} data-tour={dataTour}
        value={value ?? ''}
        onChange={e =>
          form.setValue(name, (e.target.value === '' ? undefined : parseFloat(e.target.value)) as never, { shouldDirty: true })
        }
      />
    </div>
  )
}
