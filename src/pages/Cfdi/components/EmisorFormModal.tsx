import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useUpsertEmisor } from '@/hooks/use-cfdi'
import type { Emisor, GlobalPeriodicity } from '@/services/cfdi.service'

const PERIODICITIES: GlobalPeriodicity[] = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL']

const emisorSchema = z.object({
  rfc: z.string().trim().min(12).max(13),
  legalName: z.string().trim().min(1),
  regimenFiscal: z
    .string()
    .trim()
    .regex(/^\d{3}$/),
  lugarExpedicion: z
    .string()
    .trim()
    .regex(/^\d{5}$/),
  serie: z.string().trim().optional(),
  defaultUsoCfdi: z.string().trim().optional(),
  globalPeriodicity: z.enum(['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL']),
  invoiceCashSales: z.boolean(),
  includeCashInAccounting: z.boolean(),
  isnRatePct: z.number().min(0).max(10), // ISN como PORCENTAJE (0-10); se guarda como fracción
})

type EmisorFormValues = z.infer<typeof emisorSchema>

interface EmisorFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, edits this emisor; otherwise creates a new one. */
  emisor?: Emisor | null
}

export function EmisorFormModal({ open, onClose, emisor }: EmisorFormModalProps) {
  const { t } = useTranslation('cfdi')
  const upsertMutation = useUpsertEmisor()

  const form = useForm<EmisorFormValues>({
    resolver: zodResolver(emisorSchema),
    defaultValues: {
      rfc: '',
      legalName: '',
      regimenFiscal: '',
      lugarExpedicion: '',
      serie: '',
      defaultUsoCfdi: '',
      globalPeriodicity: 'MENSUAL',
      invoiceCashSales: false,
      includeCashInAccounting: false,
      isnRatePct: 0,
    },
  })

  // Hydrate the form when the modal opens for create or edit.
  useEffect(() => {
    if (!open) return
    form.reset({
      rfc: emisor?.rfc ?? '',
      legalName: emisor?.legalName ?? '',
      regimenFiscal: emisor?.regimenFiscal ?? '',
      lugarExpedicion: emisor?.lugarExpedicion ?? '',
      serie: emisor?.serie ?? '',
      defaultUsoCfdi: emisor?.defaultUsoCfdi ?? '',
      globalPeriodicity: emisor?.globalPeriodicity ?? 'MENSUAL',
      invoiceCashSales: emisor?.invoiceCashSales ?? false,
      includeCashInAccounting: emisor?.includeCashInAccounting ?? false,
      isnRatePct: Math.round(Number(emisor?.isnRate ?? 0) * 100 * 100) / 100, // fracción → % (2 decimales)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, emisor])

  const onSubmit = (values: EmisorFormValues) => {
    upsertMutation.mutate(
      {
        emisorId: emisor?.id,
        data: {
          rfc: values.rfc.toUpperCase(),
          legalName: values.legalName,
          regimenFiscal: values.regimenFiscal,
          lugarExpedicion: values.lugarExpedicion,
          ...(values.serie?.trim() && { serie: values.serie.trim() }),
          ...(values.defaultUsoCfdi?.trim() && { defaultUsoCfdi: values.defaultUsoCfdi.trim() }),
          globalPeriodicity: values.globalPeriodicity,
          invoiceCashSales: values.invoiceCashSales,
          includeCashInAccounting: values.includeCashInAccounting,
          isnRate: values.isnRatePct / 100, // % → fracción
        },
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={emisor ? t('emisores.edit') : t('emisores.new')}
      contentClassName="bg-muted/30"
      actions={
        <Button onClick={form.handleSubmit(onSubmit)} disabled={upsertMutation.isPending}>
          {upsertMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {t('emisorForm.save')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl p-6">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <section className="rounded-2xl border border-input bg-card p-6 space-y-5">
              <h2 className="text-base font-semibold">{t('emisorForm.title')}</h2>

              <FormField
                control={form.control}
                name="rfc"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emisorForm.rfc')}</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        onChange={e => field.onChange(e.target.value.toUpperCase())}
                        placeholder={t('emisorForm.rfcPlaceholder')}
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="legalName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emisorForm.legalName')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('emisorForm.legalNamePlaceholder')} className="h-12 text-base" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="regimenFiscal"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emisorForm.regimenFiscal')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          maxLength={3}
                          placeholder={t('emisorForm.regimenFiscalPlaceholder')}
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormDescription>{t('emisorForm.regimenFiscalHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="lugarExpedicion"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emisorForm.lugarExpedicion')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          inputMode="numeric"
                          maxLength={5}
                          placeholder={t('emisorForm.lugarExpedicionPlaceholder')}
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormDescription>{t('emisorForm.lugarExpedicionHint')}</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <FormField
                  control={form.control}
                  name="serie"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emisorForm.serie')}</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder={t('emisorForm.seriePlaceholder')} className="h-12 text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="defaultUsoCfdi"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('emisorForm.defaultUsoCfdi')}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          placeholder={t('emisorForm.defaultUsoCfdiPlaceholder')}
                          className="h-12 text-base"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="globalPeriodicity"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emisorForm.globalPeriodicity')}</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERIODICITIES.map(p => (
                          <SelectItem key={p} value={p}>
                            {t(`periodicity.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoiceCashSales"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-input p-4">
                    <div className="space-y-0.5 pr-2">
                      <FormLabel>{t('emisorForm.invoiceCashSales')}</FormLabel>
                      <FormDescription>{t('emisorForm.invoiceCashSalesHint')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} className="cursor-pointer" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="includeCashInAccounting"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-input p-4">
                    <div className="space-y-0.5 pr-2">
                      <FormLabel>{t('emisorForm.includeCashInAccounting')}</FormLabel>
                      <FormDescription>{t('emisorForm.includeCashInAccountingHint')}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} className="cursor-pointer" />
                    </FormControl>
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="isnRatePct"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('emisorForm.isnRate')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        inputMode="decimal"
                        step="0.1"
                        min={0}
                        max={10}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="0"
                        className="h-12 text-base"
                      />
                    </FormControl>
                    <FormDescription>{t('emisorForm.isnRateHint')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </section>
          </form>
        </Form>
      </div>
    </FullScreenModal>
  )
}
