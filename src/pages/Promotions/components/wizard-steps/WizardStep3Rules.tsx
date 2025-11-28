import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Clock, CalendarDays, Info } from 'lucide-react'

import MultipleSelector, { Option } from '@/components/multi-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface WizardStep3RulesProps {
  form: UseFormReturn<any>
  dayOptions: Option[]
}

export function WizardStep3Rules({ form, dayOptions }: WizardStep3RulesProps) {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Clock className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{t('discounts.wizard.step3.header')}</h4>
          <p className="text-xs text-muted-foreground">{t('discounts.wizard.step3.description')}</p>
        </div>
      </div>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">{t('discounts.form.sections.rulesLimits')}</CardTitle>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                </TooltipTrigger>
                <TooltipContent className="max-w-sm" side="right">
                  <div className="space-y-2">
                    <p className="font-semibold">{t('discounts.wizard.hints.limits.title')}</p>
                    <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.limits.description')}</p>
                    <ul className="text-xs space-y-1 list-disc list-inside">
                      <li>{t('discounts.wizard.hints.limits.minPurchase')}</li>
                      <li>{t('discounts.wizard.hints.limits.maxDiscount')}</li>
                      <li>{t('discounts.wizard.hints.limits.totalUses')}</li>
                      <li>{t('discounts.wizard.hints.limits.perCustomer')}</li>
                    </ul>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          </div>
          <CardDescription>{t('discounts.wizard.hints.limits.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="minPurchaseAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.minPurchaseAmount')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={t('discounts.form.placeholders.minPurchaseAmount')}
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">MXN</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxDiscountAmount"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.maxDiscountAmount')}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={t('discounts.form.placeholders.maxDiscountAmount')}
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">MXN</span>
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="maxTotalUses"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.maxTotalUses')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('discounts.form.placeholders.maxTotalUses')}
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>{t('discounts.wizard.hints.limits.totalUsesHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="maxUsesPerCustomer"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.maxUsesPerCustomer')}</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('discounts.form.placeholders.maxUsesPerCustomer')}
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? parseInt(e.target.value) : undefined)}
                    />
                  </FormControl>
                  <FormDescription>{t('discounts.wizard.hints.limits.perCustomerHint')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Time Restrictions */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{t('discounts.form.sections.timeRestrictions')}</CardTitle>
          </div>
          <CardDescription>{t('discounts.wizard.hints.time.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="validFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.validFrom')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="validUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.validUntil')}</FormLabel>
                  <FormControl>
                    <Input type="date" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="daysOfWeek"
            render={({ field }) => (
              <FormItem>
                <div className="flex items-center gap-2">
                  <FormLabel className="mb-0">{t('discounts.form.fields.daysOfWeek')}</FormLabel>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs" side="right">
                        <p>{t('discounts.wizard.hints.time.daysOfWeek')}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>
                <FormControl>
                  <MultipleSelector
                    value={
                      field.value?.map((day: any) => {
                        const dayValue = typeof day === 'object' ? day.value : day.toString()
                        const option = dayOptions.find(o => o.value === dayValue)
                        return option || { value: dayValue, label: dayValue }
                      }) || []
                    }
                    onChange={newValue => field.onChange(newValue)}
                    options={dayOptions}
                    placeholder={t('discounts.form.placeholders.selectDays')}
                    emptyIndicator={<p className="text-center text-muted-foreground">{tCommon('noResults')}</p>}
                  />
                </FormControl>
                <FormDescription>{t('discounts.wizard.hints.time.daysHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="timeFrom"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.timeFrom')}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="timeUntil"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.timeUntil')}</FormLabel>
                  <FormControl>
                    <Input type="time" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <p className="text-xs text-muted-foreground">{t('discounts.wizard.hints.time.timeHint')}</p>
        </CardContent>
      </Card>
    </div>
  )
}
