import { type UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { SearchableSelect } from '@/components/ui/searchable-select'
import {
  REGIMEN_FISCAL_OPTIONS,
  usoCfdiOptionsForRegimen,
  type ReceptorFormValues,
  type AutofacturaReceptorFormValues,
} from './receptor-catalog'

/**
 * Either receptor form shape — staff issuance (email optional) or autofactura
 * (email required). Both carry the same field names, so the fields render
 * identically; only the validation differs at the schema layer.
 */
type AnyReceptorForm = UseFormReturn<ReceptorFormValues> | UseFormReturn<AutofacturaReceptorFormValues>

/**
 * Receptor (recipient) fiscal fields, ready to drop inside any `<Form {...form}>`.
 * The caller owns the form instance + submit; this only renders the inputs.
 *
 * Shared between the staff-issued flow (Flow B — IssueCfdiDialog) and the public
 * autofactura page (Flow A). SAT catalogs + schema live in `receptor-catalog.ts`.
 *
 * `emailRequired` only swaps the email label/hint copy — validation is enforced
 * by whichever schema the caller wires into its `useForm`.
 */
export function ReceptorFields({ form, emailRequired = false }: { form: AnyReceptorForm; emailRequired?: boolean }) {
  const { t } = useTranslation('cfdi')

  // Both schemas share field names; pin the form/control to one concrete shape so
  // `<FormField>` generics resolve (the union of two `Control` types confuses RHF).
  const f = form as UseFormReturn<ReceptorFormValues>
  const control = f.control

  // The valid "uso de CFDI" options depend on the chosen régimen (SAT catalog
  // c_UsoCFDI). Watch the régimen so the uso picker re-filters live.
  const regimen = f.watch('regimenFiscal')
  const usoOptions = usoCfdiOptionsForRegimen(regimen)
  const regimenOptions = REGIMEN_FISCAL_OPTIONS.map(o => ({ value: o.code, label: `${o.code} — ${o.description}` }))

  return (
    <section className="rounded-2xl border border-input bg-card p-6 space-y-5">
      <h2 className="text-base font-semibold">{t('issueDialog.sectionTitle')}</h2>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="rfc"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('issueDialog.rfc')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  data-tour="cfdi-receptor-rfc"
                  onChange={e => field.onChange(e.target.value.toUpperCase())}
                  placeholder={t('issueDialog.rfcPlaceholder')}
                  className="h-12 text-base"
                  autoComplete="off"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="codigoPostal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('issueDialog.codigoPostal')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  data-tour="cfdi-receptor-cp"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder={t('issueDialog.codigoPostalPlaceholder')}
                  className="h-12 text-base"
                />
              </FormControl>
              <FormDescription>{t('issueDialog.codigoPostalHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="razonSocial"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('issueDialog.razonSocial')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                data-tour="cfdi-receptor-razon-social"
                placeholder={t('issueDialog.razonSocialPlaceholder')}
                className="h-12 text-base"
              />
            </FormControl>
            <FormDescription>{t('issueDialog.razonSocialHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <FormField
          control={control}
          name="regimenFiscal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('issueDialog.regimenFiscal')}</FormLabel>
              <FormControl>
                <div data-tour="cfdi-receptor-regimen">
                  <SearchableSelect
                    options={regimenOptions}
                    value={field.value}
                    onValueChange={v => {
                      field.onChange(v)
                      // If the previously chosen uso is no longer valid for the new
                      // régimen, clear it so the user re-picks from the filtered list.
                      const currentUso = f.getValues('usoCfdi')
                      if (currentUso && !usoCfdiOptionsForRegimen(v).some(o => o.code === currentUso)) {
                        f.setValue('usoCfdi', '' as ReceptorFormValues['usoCfdi'], { shouldValidate: false })
                      }
                    }}
                    size="lg"
                    searchThreshold={0}
                    contentWidth="auto"
                    placeholder={t('issueDialog.regimenFiscalSelect')}
                    searchPlaceholder={t('issueDialog.regimenSearch')}
                    emptyMessage={t('issueDialog.noResults')}
                  />
                </div>
              </FormControl>
              <FormDescription>{t('issueDialog.regimenFiscalHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={control}
          name="usoCfdi"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('issueDialog.usoCfdi')}</FormLabel>
              <FormControl>
                <div data-tour="cfdi-receptor-uso">
                  <SearchableSelect
                    options={usoOptions.map(o => ({ value: o.code, label: `${o.code} — ${o.description}` }))}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={!regimen}
                    size="lg"
                    searchThreshold={0}
                    contentWidth="auto"
                    placeholder={regimen ? t('issueDialog.usoCfdiSelect') : t('issueDialog.usoCfdiNeedsRegimen')}
                    searchPlaceholder={t('issueDialog.usoSearch')}
                    emptyMessage={t('issueDialog.noResults')}
                  />
                </div>
              </FormControl>
              <FormDescription>{t('issueDialog.usoCfdiHint')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      </div>

      <FormField
        control={control}
        name="email"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{emailRequired ? t('issueDialog.emailRequired') : t('issueDialog.email')}</FormLabel>
            <FormControl>
              <Input
                {...field}
                data-tour="cfdi-receptor-email"
                type="email"
                placeholder={t('issueDialog.emailPlaceholder')}
                className="h-12 text-base"
                autoComplete="off"
              />
            </FormControl>
            <FormDescription>{emailRequired ? t('issueDialog.emailRequiredHint') : t('issueDialog.emailHint')}</FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </section>
  )
}
