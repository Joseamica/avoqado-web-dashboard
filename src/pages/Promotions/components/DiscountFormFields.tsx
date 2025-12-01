import { Info } from 'lucide-react'
import { UseFormReturn } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import MultipleSelector, { Option } from '@/components/multi-selector'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

interface DiscountFormFieldsProps {
  form: UseFormReturn<any>
  productOptions: Option[]
  categoryOptions: Option[]
  customerGroupOptions: Option[]
  dayOptions: Option[]
}

export function DiscountFormFields({ form, productOptions, categoryOptions, customerGroupOptions, dayOptions }: DiscountFormFieldsProps) {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()

  const watchType = form.watch('type')
  const watchScope = form.watch('scope')

  return (
    <div className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.form.sections.basicInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            rules={{
              required: { value: true, message: t('discounts.form.validation.nameRequired') },
              maxLength: { value: 100, message: t('discounts.form.validation.nameMax') },
            }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('discounts.form.fields.name')}</FormLabel>
                <FormControl>
                  <Input placeholder={t('discounts.form.placeholders.name')} {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

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

          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="type"
              rules={{ required: { value: true, message: t('discounts.form.validation.typeRequired') } }}
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('discounts.form.fields.type')}</FormLabel>
                  <Select onValueChange={field.onChange} value={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PERCENTAGE">
                        <div>
                          <div>{t('discounts.form.types.PERCENTAGE')}</div>
                          <div className="text-xs text-muted-foreground">{t('discounts.form.types.PERCENTAGE_DESC')}</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="FIXED_AMOUNT">
                        <div>
                          <div>{t('discounts.form.types.FIXED_AMOUNT')}</div>
                          <div className="text-xs text-muted-foreground">{t('discounts.form.types.FIXED_AMOUNT_DESC')}</div>
                        </div>
                      </SelectItem>
                      <SelectItem value="COMP">
                        <div>
                          <div>{t('discounts.form.types.COMP')}</div>
                          <div className="text-xs text-muted-foreground">{t('discounts.form.types.COMP_DESC')}</div>
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

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
                    <FormLabel>{t('discounts.form.fields.value')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type="number"
                          placeholder={t('discounts.form.placeholders.value')}
                          {...field}
                          onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                          {watchType === 'PERCENTAGE' ? '%' : '$'}
                        </span>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Scope & Targets */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.form.sections.scopeTargets')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="scope"
            rules={{ required: { value: true, message: t('discounts.form.validation.scopeRequired') } }}
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('discounts.form.fields.scope')}</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="ORDER">{t('discounts.form.scopes.ORDER')}</SelectItem>
                    <SelectItem value="ITEM">{t('discounts.form.scopes.ITEM')}</SelectItem>
                    <SelectItem value="CATEGORY">{t('discounts.form.scopes.CATEGORY')}</SelectItem>
                    <SelectItem value="CUSTOMER_GROUP">{t('discounts.form.scopes.CUSTOMER_GROUP')}</SelectItem>
                    <SelectItem value="QUANTITY">{t('discounts.form.scopes.QUANTITY')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormDescription>{t(`discounts.form.scopes.${field.value}_DESC`)}</FormDescription>
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
                      onChange={newValue => field.onChange(newValue)}
                      options={productOptions}
                      placeholder={t('discounts.form.placeholders.selectProducts')}
                      emptyIndicator={<p className="text-center text-muted-foreground">{tCommon('noResults')}</p>}
                    />
                  </FormControl>
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
                      onChange={newValue => field.onChange(newValue)}
                      options={categoryOptions}
                      placeholder={t('discounts.form.placeholders.selectCategories')}
                      emptyIndicator={<p className="text-center text-muted-foreground">{tCommon('noResults')}</p>}
                    />
                  </FormControl>
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
                      {customerGroupOptions.map((group: any) => (
                        <SelectItem key={group.value} value={group.value}>
                          {group.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}

          {/* BOGO Configuration */}
          {watchScope === 'QUANTITY' && (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle className="text-base">{t('discounts.bogo.title')}</CardTitle>
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
                        <div className="relative">
                          <Input type="number" min={0} max={100} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">%</span>
                        </div>
                      </FormControl>
                      <FormDescription>{t('discounts.bogo.discountPercentDesc')}</FormDescription>
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
                          onChange={newValue => field.onChange(newValue)}
                          options={productOptions}
                          placeholder={t('discounts.form.placeholders.selectProducts')}
                          emptyIndicator={<p className="text-center text-muted-foreground">{tCommon('noResults')}</p>}
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
                          onChange={newValue => field.onChange(newValue)}
                          options={productOptions}
                          placeholder={t('discounts.form.placeholders.selectProducts')}
                          emptyIndicator={<p className="text-center text-muted-foreground">{tCommon('noResults')}</p>}
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
        </CardContent>
      </Card>

      {/* Rules & Limits */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.form.sections.rulesLimits')}</CardTitle>
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
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={t('discounts.form.placeholders.minPurchaseAmount')}
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
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
                    <Input
                      type="number"
                      min={0}
                      step="0.01"
                      placeholder={t('discounts.form.placeholders.maxDiscountAmount')}
                      {...field}
                      value={field.value ?? ''}
                      onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                    />
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
          <CardTitle>{t('discounts.form.sections.timeRestrictions')}</CardTitle>
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
                <FormLabel>{t('discounts.form.fields.daysOfWeek')}</FormLabel>
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
        </CardContent>
      </Card>

      {/* Advanced Options */}
      <Card>
        <CardHeader>
          <CardTitle>{t('discounts.form.sections.advancedOptions')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('discounts.form.fields.isAutomatic')}</Label>
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

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Label>{t('discounts.form.fields.isStackable')}</Label>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger>
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{t('discounts.form.hints.stackable')}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
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

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>{t('discounts.form.fields.applyBeforeTax')}</Label>
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

          <FormField
            control={form.control}
            name="priority"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('discounts.form.fields.priority')}</FormLabel>
                <FormControl>
                  <Input type="number" min={0} {...field} onChange={e => field.onChange(parseInt(e.target.value) || 0)} />
                </FormControl>
                <FormDescription>{t('discounts.form.hints.priority')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          {/* Comp-specific fields */}
          {watchType === 'COMP' && (
            <>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>{t('discounts.form.fields.requiresApproval')}</Label>
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
                    <FormMessage />
                  </FormItem>
                )}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
