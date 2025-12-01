import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, RefreshCw } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { LoadingButton } from '@/components/loading-button'
import { LoadingScreen } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectSeparator, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import couponService from '@/services/coupon.service'
import discountService from '@/services/discount.service'
import type { CreateCouponRequest } from '@/types/discount'

import { CreateDiscountDialog } from './components/CreateDiscountDialog'

// Generate random code
function generateRandomCode(length: number = 8): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Excluding similar chars: I, O, 0, 1
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return result
}

export default function CouponForm() {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { couponId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isEditing = !!couponId

  // Fetch existing coupon if editing
  const { data: existingCoupon, isLoading: isLoadingCoupon } = useQuery({
    queryKey: ['coupon', venueId, couponId],
    queryFn: () => couponService.getCoupon(venueId, couponId!),
    enabled: isEditing,
  })

  // Fetch discounts for selector
  const { data: discountsData, isLoading: isLoadingDiscounts } = useQuery({
    queryKey: ['discounts', venueId, 'all'],
    queryFn: () => discountService.getDiscounts(venueId, { pageSize: 100, active: true }),
    enabled: !!venueId,
  })

  const discounts = discountsData?.data || []

  // Form setup
  const form = useForm<CreateCouponRequest & { active: boolean }>({
    defaultValues: {
      discountId: '',
      code: generateRandomCode(),
      maxUses: undefined,
      maxUsesPerCustomer: undefined,
      minPurchaseAmount: undefined,
      validFrom: '',
      validUntil: '',
      active: true,
    },
  })

  // Populate form with existing data
  useEffect(() => {
    if (existingCoupon) {
      form.reset({
        discountId: existingCoupon.discountId,
        code: existingCoupon.code,
        maxUses: existingCoupon.maxUses,
        maxUsesPerCustomer: existingCoupon.maxUsesPerCustomer,
        minPurchaseAmount: existingCoupon.minPurchaseAmount,
        validFrom: existingCoupon.validFrom ? existingCoupon.validFrom.split('T')[0] : '',
        validUntil: existingCoupon.validUntil ? existingCoupon.validUntil.split('T')[0] : '',
        active: existingCoupon.active,
      })
    }
  }, [existingCoupon, form])

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: CreateCouponRequest & { active: boolean }) => {
      if (isEditing) {
        // For update, exclude discountId as it can't be changed
        const { discountId, ...updateData } = data
        return couponService.updateCoupon(venueId, couponId!, updateData)
      }
      return couponService.createCoupon(venueId, data)
    },
    onSuccess: () => {
      toast({
        title: isEditing ? t('coupons.toasts.updateSuccess') : t('coupons.toasts.createSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['coupons', venueId] })
      navigate('..')
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('coupons.toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Handle form submit
  const onSubmit = (data: CreateCouponRequest & { active: boolean }) => {
    // Clean up empty values
    const cleanedData = { ...data }
    if (!cleanedData.validFrom) cleanedData.validFrom = undefined
    if (!cleanedData.validUntil) cleanedData.validUntil = undefined

    mutation.mutate(cleanedData)
  }

  // Handle auto-generate code
  const handleGenerateCode = () => {
    form.setValue('code', generateRandomCode())
  }

  if (isLoadingCoupon || isLoadingDiscounts) {
    return <LoadingScreen message="Cargando cúpones" />
  }

  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => navigate('..')} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span className="font-medium">{form.watch('code') || (isEditing ? t('coupons.edit.title') : t('coupons.create.title'))}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button
            variant={form.watch('active') ? 'default' : 'secondary'}
            size="sm"
            onClick={() => form.setValue('active', !form.getValues('active'))}
          >
            {form.watch('active') ? t('coupons.status.active') : t('coupons.status.inactive')}
          </Button>
          <LoadingButton loading={mutation.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {mutation.isPending ? tCommon('saving') : t('coupons.actions.save')}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-8 space-y-6 max-w-2xl">
          <Card>
            <CardHeader>
              <CardTitle>{isEditing ? t('coupons.edit.title') : t('coupons.create.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Parent Discount */}
              <FormField
                control={form.control}
                name="discountId"
                rules={{ required: { value: true, message: t('coupons.form.validation.discountRequired') } }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('coupons.form.fields.discount')}</FormLabel>
                    <Select onValueChange={field.onChange} value={field.value} disabled={isEditing}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('coupons.form.placeholders.discount')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {discounts.length === 0 ? (
                          <SelectItem value="no-discounts" disabled>
                            {t('coupons.form.noDiscounts')}
                          </SelectItem>
                        ) : (
                          discounts.map(discount => (
                            <SelectItem key={discount.id} value={discount.id}>
                              <div>
                                <div>{discount.name}</div>
                                <div className="text-xs text-muted-foreground">
                                  {discount.type === 'PERCENTAGE' && `${discount.value}%`}
                                  {discount.type === 'FIXED_AMOUNT' && `$${discount.value}`}
                                  {discount.type === 'COMP' && '100%'}
                                </div>
                              </div>
                            </SelectItem>
                          ))
                        )}
                        <SelectSeparator />
                        <div className="p-1">
                          <CreateDiscountDialog venueId={venueId} onSuccess={id => form.setValue('discountId', id)} />
                        </div>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Coupon Code */}
              <FormField
                control={form.control}
                name="code"
                rules={{
                  required: { value: true, message: t('coupons.form.validation.codeRequired') },
                  minLength: { value: 3, message: t('coupons.form.validation.codeMin') },
                  maxLength: { value: 30, message: t('coupons.form.validation.codeMax') },
                  pattern: {
                    value: /^[A-Za-z0-9_-]+$/,
                    message: t('coupons.form.validation.codeFormat'),
                  },
                }}
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('coupons.form.fields.code')}</FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input
                          placeholder={t('coupons.form.placeholders.code')}
                          {...field}
                          onChange={e => field.onChange(e.target.value.toUpperCase())}
                          className="font-mono"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={handleGenerateCode}
                        title={t('coupons.form.hints.autoGenerate')}
                      >
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                    </div>
                    <FormDescription>{t('coupons.form.hints.codeUnique')}</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Usage Limits */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="maxUses"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('coupons.form.fields.maxUses')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder={t('coupons.form.placeholders.maxUses')}
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
                      <FormLabel>{t('coupons.form.fields.maxUsesPerCustomer')}</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          placeholder={t('coupons.form.placeholders.maxUsesPerCustomer')}
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

              {/* Minimum Purchase */}
              <FormField
                control={form.control}
                name="minPurchaseAmount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('coupons.form.fields.minPurchaseAmount')}</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder={t('coupons.form.placeholders.minPurchaseAmount')}
                        {...field}
                        value={field.value ?? ''}
                        onChange={e => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Validity Period */}
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="validFrom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('coupons.form.fields.validFrom')}</FormLabel>
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
                      <FormLabel>{t('coupons.form.fields.validUntil')}</FormLabel>
                      <FormControl>
                        <Input type="date" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  )
}
