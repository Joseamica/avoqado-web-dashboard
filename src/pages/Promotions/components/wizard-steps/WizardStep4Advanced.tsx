import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Settings, Zap, Layers, Calculator, ShieldCheck, Info } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { DiscountType } from '@/types/discount'

interface WizardStep4AdvancedProps {
  form: UseFormReturn<any>
  discountType: DiscountType
}

export function WizardStep4Advanced({ form, discountType }: WizardStep4AdvancedProps) {
  const { t } = useTranslation('promotions')

  const watchIsAutomatic = form.watch('isAutomatic')

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Settings className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{t('discounts.wizard.step4.header')}</h4>
          <p className="text-xs text-muted-foreground">{t('discounts.wizard.step4.description')}</p>
        </div>
      </div>

      {/* Automatic Discount */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-yellow-500" />
                <Label className="font-medium">{t('discounts.form.fields.isAutomatic')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm" side="right">
                      <div className="space-y-2">
                        <p className="font-semibold">{t('discounts.wizard.hints.automatic.title')}</p>
                        <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.automatic.description')}</p>
                        <div className="bg-yellow-50 dark:bg-yellow-950/30 p-2 rounded-md border border-yellow-200 dark:border-yellow-800">
                          <p className="text-xs text-yellow-900 dark:text-yellow-100">
                            <strong>{t('discounts.wizard.hints.automatic.example')}</strong>
                          </p>
                          <p className="text-xs text-yellow-800 dark:text-yellow-200 mt-1">
                            {t('discounts.wizard.hints.automatic.exampleText')}
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">{t('discounts.form.hints.automatic')}</p>
            </div>
            <FormField
              control={form.control}
              name="isAutomatic"
              render={({ field }) => (
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              )}
            />
          </div>

          {/* Priority - Only show when automatic is enabled */}
          {watchIsAutomatic && (
            <div className="mt-4 pt-4 border-t">
              <FormField
                control={form.control}
                name="priority"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-center gap-2">
                      <FormLabel>{t('discounts.form.fields.priority')}</FormLabel>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent className="max-w-sm" side="right">
                            <div className="space-y-2">
                              <p className="font-semibold">{t('discounts.wizard.hints.priority.title')}</p>
                              <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.priority.description')}</p>
                              <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                                <p className="text-xs text-blue-900 dark:text-blue-100">
                                  {t('discounts.wizard.hints.priority.example')}
                                </p>
                              </div>
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        className="max-w-[150px]"
                        {...field}
                        onChange={e => field.onChange(parseInt(e.target.value) || 0)}
                      />
                    </FormControl>
                    <FormDescription>{t('discounts.form.hints.priority')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Stacking Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Layers className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{t('discounts.wizard.step4.stacking')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label className="font-medium">{t('discounts.form.fields.isStackable')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm" side="right">
                      <div className="space-y-2">
                        <p className="font-semibold">{t('discounts.wizard.hints.stackable.title')}</p>
                        <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.stackable.description')}</p>
                        <div className="space-y-1">
                          <div className="bg-green-50 dark:bg-green-950/30 p-2 rounded-md border border-green-200 dark:border-green-800">
                            <p className="text-xs text-green-900 dark:text-green-100">
                              <strong>{t('discounts.wizard.hints.stackable.enabled')}</strong>
                            </p>
                            <p className="text-xs text-green-800 dark:text-green-200">
                              {t('discounts.wizard.hints.stackable.enabledText')}
                            </p>
                          </div>
                          <div className="bg-red-50 dark:bg-red-950/30 p-2 rounded-md border border-red-200 dark:border-red-800">
                            <p className="text-xs text-red-900 dark:text-red-100">
                              <strong>{t('discounts.wizard.hints.stackable.disabled')}</strong>
                            </p>
                            <p className="text-xs text-red-800 dark:text-red-200">
                              {t('discounts.wizard.hints.stackable.disabledText')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">{t('discounts.form.hints.stackable')}</p>
            </div>
            <FormField
              control={form.control}
              name="isStackable"
              render={({ field }) => (
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Tax Options */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Calculator className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">{t('discounts.wizard.step4.tax')}</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <div className="flex items-center gap-2">
                <Label className="font-medium">{t('discounts.form.fields.applyBeforeTax')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-sm" side="right">
                      <div className="space-y-2">
                        <p className="font-semibold">{t('discounts.wizard.hints.tax.title')}</p>
                        <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.tax.description')}</p>
                        <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
                          <p className="text-xs text-blue-900 dark:text-blue-100">
                            <strong>{t('discounts.wizard.hints.tax.example')}</strong>
                          </p>
                          <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
                            {t('discounts.wizard.hints.tax.exampleText')}
                          </p>
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
              <p className="text-sm text-muted-foreground">{t('discounts.form.hints.applyBeforeTax')}</p>
            </div>
            <FormField
              control={form.control}
              name="applyBeforeTax"
              render={({ field }) => (
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              )}
            />
          </div>
        </CardContent>
      </Card>

      {/* Comp-specific fields */}
      {discountType === 'COMP' && (
        <Card className="border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              <CardTitle className="text-base">{t('discounts.wizard.step4.comp')}</CardTitle>
            </div>
            <CardDescription>{t('discounts.wizard.step4.compDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start justify-between">
              <div className="space-y-1 flex-1">
                <Label className="font-medium">{t('discounts.form.fields.requiresApproval')}</Label>
                <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.comp.approval')}</p>
              </div>
              <FormField
                control={form.control}
                name="requiresApproval"
                render={({ field }) => (
                  <FormControl>
                    <Switch checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="compReason"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.compReason')}</FormLabel>
                  <FormControl>
                    <Textarea placeholder={t('discounts.form.placeholders.compReason')} {...field} />
                  </FormControl>
                  <FormDescription>{t('discounts.wizard.hints.comp.reason')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}

      {/* Active Status */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="space-y-1 flex-1">
              <Label className="font-medium">{t('discounts.form.fields.active')}</Label>
              <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.active')}</p>
            </div>
            <FormField
              control={form.control}
              name="active"
              render={({ field }) => (
                <FormControl>
                  <Switch checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
              )}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
