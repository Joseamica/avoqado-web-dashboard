import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'
import { Target, ShoppingCart, Tag, Users, Package, Info, Plus } from 'lucide-react'

import MultipleSelector, { Option } from '@/components/multi-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface WizardStep2ScopeProps {
  form: UseFormReturn<any>
  productOptions: Option[]
  categoryOptions: Option[]
  customerGroupOptions: Option[]
}

export function WizardStep2Scope({ form, productOptions, categoryOptions, customerGroupOptions }: WizardStep2ScopeProps) {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()

  const watchScope = form.watch('scope')

  const scopeOptions = [
    {
      value: 'ORDER',
      icon: ShoppingCart,
      label: t('discounts.form.scopes.ORDER'),
      description: t('discounts.form.scopes.ORDER_DESC'),
    },
    {
      value: 'ITEM',
      icon: Package,
      label: t('discounts.form.scopes.ITEM'),
      description: t('discounts.form.scopes.ITEM_DESC'),
    },
    {
      value: 'CATEGORY',
      icon: Tag,
      label: t('discounts.form.scopes.CATEGORY'),
      description: t('discounts.form.scopes.CATEGORY_DESC'),
    },
    {
      value: 'CUSTOMER_GROUP',
      icon: Users,
      label: t('discounts.form.scopes.CUSTOMER_GROUP'),
      description: t('discounts.form.scopes.CUSTOMER_GROUP_DESC'),
    },
    {
      value: 'QUANTITY',
      icon: Target,
      label: t('discounts.form.scopes.QUANTITY'),
      description: t('discounts.form.scopes.QUANTITY_DESC'),
    },
  ]

  return (
    <div className="space-y-6">
      {/* Introduction */}
      <div className="flex items-center gap-3 p-4 bg-muted/50 rounded-lg">
        <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
          <Target className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h4 className="font-semibold text-sm">{t('discounts.wizard.step2.header')}</h4>
          <p className="text-xs text-muted-foreground">{t('discounts.wizard.step2.description')}</p>
        </div>
      </div>

      {/* Scope Selection */}
      <FormField
        control={form.control}
        name="scope"
        rules={{ required: { value: true, message: t('discounts.form.validation.scopeRequired') } }}
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center gap-2 mb-3">
              <FormLabel className="mb-0">{t('discounts.form.fields.scope')} *</FormLabel>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm" side="right">
                    <div className="space-y-2">
                      <p className="font-semibold">{t('discounts.wizard.hints.scope.title')}</p>
                      <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.scope.description')}</p>
                      <ul className="text-xs space-y-1 list-disc list-inside">
                        <li><strong>{t('discounts.form.scopes.ORDER')}:</strong> {t('discounts.wizard.hints.scope.order')}</li>
                        <li><strong>{t('discounts.form.scopes.ITEM')}:</strong> {t('discounts.wizard.hints.scope.item')}</li>
                        <li><strong>{t('discounts.form.scopes.CATEGORY')}:</strong> {t('discounts.wizard.hints.scope.category')}</li>
                        <li><strong>{t('discounts.form.scopes.QUANTITY')}:</strong> {t('discounts.wizard.hints.scope.quantity')}</li>
                      </ul>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <FormControl>
              <RadioGroup
                value={field.value}
                onValueChange={field.onChange}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
              >
                {scopeOptions.map((scope) => (
                  <div key={scope.value} className="h-full">
                    <RadioGroupItem value={scope.value} id={scope.value} className="peer sr-only" />
                    <Label
                      htmlFor={scope.value}
                      className={cn(
                        'flex items-start gap-3 rounded-lg border border-input p-3 cursor-pointer transition-all h-full',
                        'bg-linear-to-b from-muted to-muted/70 dark:from-zinc-900 dark:to-zinc-950',
                        'hover:border-primary/50',
                        'peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20',
                        '[&:has([data-state=checked])]:border-primary'
                      )}
                    >
                      <div className="w-8 h-8 rounded-md bg-background/50 flex items-center justify-center shrink-0">
                        <scope.icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <span className="font-medium text-sm block">{scope.label}</span>
                        <span className="text-xs text-muted-foreground">{scope.description}</span>
                      </div>
                    </Label>
                  </div>
                ))}
              </RadioGroup>
            </FormControl>
            <FormMessage />
          </FormItem>
        )}
      />

      {/* Target Products */}
      {watchScope === 'ITEM' && (
        <FormField
          control={form.control}
          name="targetItemIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('discounts.form.fields.targetItems')}</FormLabel>
              <FormControl>
                <MultipleSelector
                  value={
                    field.value?.map((id: string) => {
                      const product = productOptions.find((p: any) => p.value === id)
                      return product || { value: id, label: id }
                    }) || []
                  }
                  onChange={newValue => field.onChange(newValue.map((opt: Option) => opt.value))}
                  options={productOptions}
                  placeholder={t('discounts.form.placeholders.selectProducts')}
                  emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</p>}
                  footer={
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/menu/products/create">
                        <Plus className="mr-2 h-4 w-4" />
                        {tCommon('create')} {t('discounts.form.fields.product')}
                      </Link>
                    </Button>
                  }
                />
              </FormControl>
              <FormDescription>{t('discounts.wizard.hints.targetItems')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Target Categories */}
      {watchScope === 'CATEGORY' && (
        <FormField
          control={form.control}
          name="targetCategoryIds"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('discounts.form.fields.targetCategories')}</FormLabel>
              <FormControl>
                <MultipleSelector
                  value={
                    field.value?.map((id: string) => {
                      const category = categoryOptions.find((c: any) => c.value === id)
                      return category || { value: id, label: id }
                    }) || []
                  }
                  onChange={newValue => field.onChange(newValue.map((opt: Option) => opt.value))}
                  options={categoryOptions}
                  placeholder={t('discounts.form.placeholders.selectCategories')}
                  emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</p>}
                  footer={
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/menu/categories/create">
                        <Plus className="mr-2 h-4 w-4" />
                        {tCommon('create')} {t('discounts.form.fields.category')}
                      </Link>
                    </Button>
                  }
                />
              </FormControl>
              <FormDescription>{t('discounts.wizard.hints.targetCategories')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* Customer Group */}
      {watchScope === 'CUSTOMER_GROUP' && (
        <FormField
          control={form.control}
          name="customerGroupId"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('discounts.form.fields.customerGroup')}</FormLabel>
              <Select onValueChange={field.onChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder={t('discounts.form.placeholders.selectCustomerGroup')} />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {customerGroupOptions.length === 0 ? (
                    <div className="py-6 text-center text-sm text-muted-foreground">
                      {tCommon('no_results')}
                    </div>
                  ) : (
                    customerGroupOptions.map((group: any) => (
                      <SelectItem key={group.value} value={group.value}>
                        {group.label}
                      </SelectItem>
                    ))
                  )}
                  <div className="border-t p-1">
                    <Button variant="ghost" className="w-full justify-start" asChild>
                      <Link to="/customers/groups/create">
                        <Plus className="mr-2 h-4 w-4" />
                        {tCommon('create')} {t('discounts.form.fields.customerGroup')}
                      </Link>
                    </Button>
                  </div>
                </SelectContent>
              </Select>
              <FormDescription>{t('discounts.wizard.hints.customerGroup')}</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
      )}

      {/* BOGO Configuration */}
      {watchScope === 'QUANTITY' && (
        <Card className="border-dashed border-orange-200 dark:border-orange-800 bg-orange-50/50 dark:bg-orange-950/20">
          <CardHeader>
            <div className="flex items-center gap-2">
              <CardTitle className="text-base">{t('discounts.bogo.title')}</CardTitle>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="h-4 w-4 text-muted-foreground cursor-help" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-sm" side="right">
                    <div className="space-y-2">
                      <p className="font-semibold">{t('discounts.wizard.hints.bogo.title')}</p>
                      <p className="text-sm text-muted-foreground">{t('discounts.wizard.hints.bogo.description')}</p>
                      <div className="bg-orange-50 dark:bg-orange-950/30 p-2 rounded-md border border-orange-200 dark:border-orange-800">
                        <p className="text-xs font-medium text-orange-900 dark:text-orange-100">{t('discounts.wizard.hints.bogo.example')}</p>
                        <p className="text-xs text-orange-800 dark:text-orange-200 mt-1">
                          {t('discounts.wizard.hints.bogo.exampleText')}
                        </p>
                      </div>
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <CardDescription>{t('discounts.bogo.description')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="buyQuantity"
                rules={{ required: watchScope === 'QUANTITY', min: 1 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('discounts.bogo.buyQuantity')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                    </FormControl>
                    <FormDescription>{t('discounts.bogo.buyQuantityDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="getQuantity"
                rules={{ required: watchScope === 'QUANTITY', min: 1 }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('discounts.bogo.getQuantity')}</FormLabel>
                    <FormControl>
                      <Input type="number" min={1} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 1)} />
                    </FormControl>
                    <FormDescription>{t('discounts.bogo.getQuantityDesc')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="getDiscountPercent"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.bogo.discountPercent')}</FormLabel>
                  <FormControl>
                    <div className="relative max-w-xs">
                      <Input type="number" min={0} max={100} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                    </div>
                  </FormControl>
                  <FormDescription>
                    {field.value === 100
                      ? t('discounts.bogo.freeLabel')
                      : t('discounts.bogo.discountPercentDesc')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="buyItemIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.bogo.buyFrom')}</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      value={
                        field.value?.map((id: string) => {
                          const product = productOptions.find((p: any) => p.value === id)
                          return product || { value: id, label: id }
                        }) || []
                      }
                      onChange={newValue => field.onChange(newValue.map((opt: Option) => opt.value))}
                      options={productOptions}
                      placeholder={t('discounts.form.placeholders.selectProducts')}
                      emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</p>}
                      footer={
                        <Button variant="ghost" className="w-full justify-start" asChild>
                          <Link to="/menu/products/create">
                            <Plus className="mr-2 h-4 w-4" />
                            {tCommon('create')} {t('discounts.form.fields.product')}
                          </Link>
                        </Button>
                      }
                    />
                  </FormControl>
                  <FormDescription>{t('discounts.bogo.buyFromDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="getItemIds"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.bogo.getFrom')}</FormLabel>
                  <FormControl>
                    <MultipleSelector
                      value={
                        field.value?.map((id: string) => {
                          const product = productOptions.find((p: any) => p.value === id)
                          return product || { value: id, label: id }
                        }) || []
                      }
                      onChange={newValue => field.onChange(newValue.map((opt: Option) => opt.value))}
                      options={productOptions}
                      placeholder={t('discounts.form.placeholders.selectProducts')}
                      emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</p>}
                      footer={
                        <Button variant="ghost" className="w-full justify-start" asChild>
                          <Link to="/menu/products/create">
                            <Plus className="mr-2 h-4 w-4" />
                            {tCommon('create')} {t('discounts.form.fields.product')}
                          </Link>
                        </Button>
                      }
                    />
                  </FormControl>
                  <FormDescription>{t('discounts.bogo.getFromDesc')}</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
      )}
    </div>
  )
}
