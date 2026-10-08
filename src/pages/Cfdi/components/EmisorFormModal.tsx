import { useEffect, useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { Loader2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { useUpsertEmisor } from '@/hooks/use-cfdi'
import { textoDelServidor } from '@/utils/apiError'
import type { Emisor, GlobalPeriodicity } from '@/services/cfdi.service'
import { REGIMEN_FISCAL_OPTIONS, USO_CFDI_OPTIONS } from './receptor-catalog'

const opcion = (o: { code: string; description: string }) => ({ value: o.code, label: `${o.code} — ${o.description}` })

const PERIODICITIES: GlobalPeriodicity[] = ['DIARIO', 'SEMANAL', 'QUINCENAL', 'MENSUAL', 'BIMESTRAL']

/** Régimen 621 (Incorporación Fiscal): el único al que el SAT le permite la periodicidad bimestral (Periodicidad "05"). */
const REGIMEN_BIMESTRAL = '621'

const emisorObject = z.object({
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
  // C1 (T10, ajuste del founder): las ventas cobradas fuera de la terminal en la global. Apagado de fábrica.
  includeOffTerminalSalesInGlobal: z.boolean(),
  includeCashInAccounting: z.boolean(),
  isnRatePct: z.number().min(0).max(10), // ISN como PORCENTAJE (0-10); se guarda como fracción
})

/**
 * C1 (Tarea 9): Guía del CFDI global, `InformacionGlobal/Periodicidad` — «Cuando el valor de este campo sea "05" el campo
 * RegimenFiscal debe ser "621"». El servidor también lo rechaza (400 con el texto), y su texto es el que vale si llega.
 */
function crearEsquema(mensajeBimestral: string) {
  return emisorObject.superRefine((v, ctx) => {
    if (v.globalPeriodicity === 'BIMESTRAL' && v.regimenFiscal !== REGIMEN_BIMESTRAL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['globalPeriodicity'], message: mensajeBimestral })
    }
  })
}

type EmisorFormValues = z.infer<typeof emisorObject>

interface EmisorFormModalProps {
  open: boolean
  onClose: () => void
  /** When set, edits this emisor; otherwise creates a new one. */
  emisor?: Emisor | null
}

export function EmisorFormModal({ open, onClose, emisor }: EmisorFormModalProps) {
  const { t } = useTranslation('cfdi')
  const upsertMutation = useUpsertEmisor()
  const bimestralOnly621 = t('emisorForm.bimestralOnly621')
  const emisorSchema = useMemo(() => crearEsquema(bimestralOnly621), [bimestralOnly621])

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
      includeOffTerminalSalesInGlobal: false,
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
      // Un servidor anterior a la T10 no manda el campo: apagado.
      includeOffTerminalSalesInGlobal: emisor?.includeOffTerminalSalesInGlobal ?? false,
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
          includeOffTerminalSalesInGlobal: values.includeOffTerminalSalesInGlobal,
          includeCashInAccounting: values.includeCashInAccounting,
          isnRate: values.isnRatePct / 100, // % → fracción
        },
      },
      {
        onSuccess: () => onClose(),
        // El 400 del servidor (p. ej. bimestral con un régimen que no es 621) se queda EN el formulario, con su texto.
        onError: (err: any) => {
          // Ronda 2 (residual): el texto de NUESTRO servidor o el de la pantalla; nunca el «Request failed…» de axios.
          if (err?.response?.status === 400) form.setError('root.server', { message: textoDelServidor(err) ?? t('emisorForm.saveError') })
        },
      },
    )
  }

  const regimen = form.watch('regimenFiscal')
  const bimestralBloqueado = regimen !== REGIMEN_BIMESTRAL
  const errorDelServidor = form.formState.errors.root?.server?.message

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

              {errorDelServidor && (
                <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
                  {errorDelServidor}
                </p>
              )}

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
                        <SearchableSelect
                          options={REGIMEN_FISCAL_OPTIONS.map(opcion)}
                          value={field.value}
                          onValueChange={field.onChange}
                          size="lg"
                          searchThreshold={0}
                          contentWidth="auto"
                          placeholder={t('emisorForm.regimenFiscalSelect')}
                          searchPlaceholder={t('issueDialog.regimenSearch')}
                          emptyMessage={t('issueDialog.noResults')}
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
                        <SearchableSelect
                          options={USO_CFDI_OPTIONS.map(opcion)}
                          value={field.value ?? ''}
                          onValueChange={field.onChange}
                          size="lg"
                          searchThreshold={0}
                          contentWidth="auto"
                          placeholder={t('emisorForm.defaultUsoCfdiSelect')}
                          searchPlaceholder={t('issueDialog.usoSearch')}
                          emptyMessage={t('issueDialog.noResults')}
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
                render={({ field, fieldState }) => (
                  <FormItem>
                    <FormLabel>{t('emisorForm.globalPeriodicity')}</FormLabel>
                    <Select name={field.name} value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="h-12 text-base">
                          <SelectValue />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {PERIODICITIES.map(p => (
                          <SelectItem key={p} value={p} disabled={p === 'BIMESTRAL' && bimestralBloqueado}>
                            {t(`periodicity.${p}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {/* Por qué la bimestral sale deshabilitada; si ya hay error en el campo, lo dice el mensaje (no dos veces). */}
                    {bimestralBloqueado && !fieldState.error && <FormDescription>{bimestralOnly621}</FormDescription>}
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
                name="includeOffTerminalSalesInGlobal"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between gap-3 rounded-lg border border-input p-4">
                    <div className="space-y-0.5 pr-2">
                      <FormLabel>{t('emisorForm.includeOffTerminalSalesInGlobal')}</FormLabel>
                      <FormDescription>{t('emisorForm.includeOffTerminalSalesInGlobalHint')}</FormDescription>
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
