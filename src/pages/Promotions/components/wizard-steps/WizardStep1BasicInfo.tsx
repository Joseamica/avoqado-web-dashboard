import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Percent, DollarSign, Gift, Info } from 'lucide-react'

import { FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface WizardStep1BasicInfoProps {
  form: UseFormReturn<any>
}

export function WizardStep1BasicInfo({ form }: WizardStep1BasicInfoProps) {
  const { t } = useTranslation('promotions')

  const watchType = form.watch('type')

  const discountTypes = [
    {
      value: 'PERCENTAGE',
      icon: Percent,
      label: t('discounts.form.types.PERCENTAGE'),
      description: t('discounts.form.types.PERCENTAGE_DESC'),
      color: 'blue',
    },
    {
      value: 'FIXED_AMOUNT',
      icon: DollarSign,
      label: t('discounts.form.types.FIXED_AMOUNT'),
      description: t('discounts.form.types.FIXED_AMOUNT_DESC'),
      color: 'green',
    },
    {
      value: 'COMP',
      icon: Gift,
      label: t('discounts.form.types.COMP'),
      description: t('discounts.form.types.COMP_DESC'),
      color: 'purple',
    },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Percent className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{t('discounts.wizard.step1.header')}</h4>
          <p className="text-xs text-muted-foreground">{t('discounts.wizard.step1.description')}</p>
        </div>
      </div>

      {/* Name */}
      <FormField
        control={form.control}
        name="name"
        rules={{
          required: { value: true, message: t('discounts.form.validation.nameRequired') },
          maxLength: { value: 100, message: t('discounts.form.validation.nameMax') },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('discounts.form.fields.name')} *</FormLabel>
            <FormControl>
              <Input placeholder={t('discounts.form.placeholders.name')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Description */}
      <FormField
        control={form.control}
        name="description"
        rules={{
          maxLength: { value: 500, message: t('discounts.form.validation.descriptionMax') },
        }}
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('discounts.form.fields.description')}</FormLabel>
            <FormControl>
              <Textarea placeholder={t('discounts.form.placeholders.description')} {...field} />
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Discount Type - Icon-based selection */}
      <FormField
        control={form.control}
        name="type"
        rules={{ required: { value: true, message: t('discounts.form.validation.typeRequired') } }}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2 mb-3">
              <FormLabel className="mb-0">{t('discounts.form.fields.type')} *</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm" side="right">
                    <div className="space-y-3">
                      <p className="font-semibold">{t('discounts.wizard.hints.type.title')}</p>
                      <div className="space-y-2">
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                          <p className="font-medium text-sm text-blue-900 dark:text-blue-100 flex items-center gap-2">
                            <Percent className="h-4 w-4" />
                            {t('discounts.form.types.PERCENTAGE')}
                          </p>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                            {t('discounts.wizard.hints.type.percentage')}
                          </p>
                        </div>
                        <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-md border border-green-200 dark:border-green-800">
                          <p className="font-medium text-sm text-green-900 dark:text-green-100 flex items-center gap-2">
                            <DollarSign className="h-4 w-4" />
                            {t('discounts.form.types.FIXED_AMOUNT')}
                          </p>
                          <p className="text-xs text-green-800 dark:text-green-200 mt-1">
                            {t('discounts.wizard.hints.type.fixedAmount')}
                          </p>
                        </div>
                        <div className="bg-purple-50 dark:bg-purple-950/30 p-2 rounded-md border border-purple-200 dark:border-purple-800">
                          <p className="font-medium text-sm text-purple-900 dark:text-purple-100 flex items-center gap-2">
                            <Gift className="h-4 w-4" />
                            {t('discounts.form.types.COMP')}
                          </p>
                          <p className="text-xs text-purple-800 dark:text-purple-200 mt-1">
                            {t('discounts.wizard.hints.type.comp')}
                          </p>
                        </div>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid grid-cols-1 md:grid-cols-3 gap-4"
              >
                {discountTypes.map((type) => (
                  <div key={type.value} className="h-full">
                    <RadioGroupItem value={type.value} id={type.value} className="peer sr-only" />
                    <Label
                      htmlFor={type.value}
                      className={cn(
                        'flex flex-col items-center justify-center rounded-lg border border-input p-4 cursor-pointer transition-all h-full',
                        'bg-linear-to-b from-muted to-muted/70 dark:from-zinc-900 dark:to-zinc-950',
                        'hover:border-primary/50',
                        'peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20',
                        '[&:has([data-state=checked])]:border-primary'
                      )}
                    >
                      <div
                        className={cn(
                          'w-12 h-12 rounded-lg flex items-center justify-center mb-3',
                          type.color === 'blue' && 'bg-blue-100 dark:bg-blue-950/50',
                          type.color === 'green' && 'bg-green-100 dark:bg-green-950/50',
                          type.color === 'purple' && 'bg-purple-100 dark:bg-purple-950/50'
                        )}
                      >
                        <type.icon
                          className={cn(
                            'h-6 w-6',
                            type.color === 'blue' && 'text-blue-600 dark:text-blue-400',
                            type.color === 'green' && 'text-green-600 dark:text-green-400',
                            type.color === 'purple' && 'text-purple-600 dark:text-purple-400'
                          )}
                        />
                      </div>
                      <span className="font-medium text-center">{type.label}</span>
                      <span className="text-xs text-muted-foreground text-center mt-1 flex-1">{type.description}</span>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Value - Only shown for non-COMP types */}
      {watchType !== 'COMP' && (
        <FormField
          control={form.control}
          name="value"
          rules={{
            required: { value: true, message: t('discounts.form.validation.valueRequired') },
            min: { value: 0, message: t('discounts.form.validation.valuePositive') },
            max:
              watchType === 'PERCENTAGE' ? { value: 100, message: t('discounts.form.validation.valuePercentageRange') } : undefined,
          }}
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('discounts.form.fields.value')} *</FormLabel>
              <FormControl>
                <div className="relative max-w-xs">
                  <Input
                    type="number"
                    placeholder={t('discounts.form.placeholders.value')}
                    name={field.name}
                    ref={field.ref}
                    onBlur={field.onBlur}
                    value={field.value ?? ''}
                    onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
                    className="pr-12"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground font-medium">
                    {watchType === 'PERCENTAGE' ? '%' : 'MXN'}
                  </span>
                </div>
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
      )}
    </div>
  )
}
