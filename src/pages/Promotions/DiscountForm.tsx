import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router-dom'

import { LoadingButton } from '@/components/loading-button'
import { LoadingScreen } from '@/components/spinner'
import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import discountService from '@/services/discount.service'
import type { CreateDiscountRequest, DiscountScope, DiscountType } from '@/types/discount'

import { DiscountFormFields } from './components/DiscountFormFields'
import { useDiscountFormData } from './hooks/useDiscountFormData'

export default function DiscountForm() {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()
  const { venueId } = useCurrentVenue()
  const { discountId } = useParams()
  const navigate = useNavigate()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const isEditing = !!discountId

  // Fetch existing discount if editing
  const { data: existingDiscount, isLoading: isLoadingDiscount } = useQuery({
    queryKey: ['discount', venueId, discountId],
    queryFn: () => discountService.getDiscount(venueId, discountId!),
    enabled: isEditing,
  })

  // Fetch form data options
  const { productOptions, categoryOptions, customerGroupOptions, dayOptions, isLoading: isLoadingOptions } = useDiscountFormData(venueId)

  // Form setup
  const form = useForm<CreateDiscountRequest & { active: boolean }>({
    defaultValues: {
      name: '',
      description: '',
      type: 'PERCENTAGE' as DiscountType,
      value: 0,
      scope: 'ORDER' as DiscountScope,
      targetItemIds: [],
      targetCategoryIds: [],
      customerGroupId: '',
      isAutomatic: false,
      priority: 0,
      minPurchaseAmount: undefined,
      maxDiscountAmount: undefined,
      maxTotalUses: undefined,
      maxUsesPerCustomer: undefined,
      validFrom: '',
      validUntil: '',
      daysOfWeek: [],
      timeFrom: '',
      timeUntil: '',
      buyQuantity: undefined,
      getQuantity: undefined,
      getDiscountPercent: 100,
      buyItemIds: [],
      getItemIds: [],
      requiresApproval: false,
      compReason: '',
      applyBeforeTax: true,
      isStackable: false,
      stackPriority: 0,
      active: true,
    },
  })

  // Populate form with existing data
  useEffect(() => {
    if (existingDiscount) {
      form.reset({
        name: existingDiscount.name,
        description: existingDiscount.description || '',
        type: existingDiscount.type,
        value: existingDiscount.value,
        scope: existingDiscount.scope,
        targetItemIds: existingDiscount.targetItemIds || [],
        targetCategoryIds: existingDiscount.targetCategoryIds || [],
        customerGroupId: existingDiscount.customerGroupId || '',
        isAutomatic: existingDiscount.isAutomatic,
        priority: existingDiscount.priority,
        minPurchaseAmount: existingDiscount.minPurchaseAmount,
        maxDiscountAmount: existingDiscount.maxDiscountAmount,
        maxTotalUses: existingDiscount.maxTotalUses,
        maxUsesPerCustomer: existingDiscount.maxUsesPerCustomer,
        validFrom: existingDiscount.validFrom ? existingDiscount.validFrom.split('T')[0] : '',
        validUntil: existingDiscount.validUntil ? existingDiscount.validUntil.split('T')[0] : '',
        daysOfWeek: existingDiscount.daysOfWeek || [],
        timeFrom: existingDiscount.timeFrom || '',
        timeUntil: existingDiscount.timeUntil || '',
        buyQuantity: existingDiscount.buyQuantity,
        getQuantity: existingDiscount.getQuantity,
        getDiscountPercent: existingDiscount.getDiscountPercent || 100,
        buyItemIds: existingDiscount.buyItemIds || [],
        getItemIds: existingDiscount.getItemIds || [],
        requiresApproval: existingDiscount.requiresApproval || false,
        compReason: existingDiscount.compReason || '',
        applyBeforeTax: existingDiscount.applyBeforeTax,
        isStackable: existingDiscount.isStackable,
        stackPriority: existingDiscount.stackPriority,
        active: existingDiscount.active,
      })
    }
  }, [existingDiscount, form])

  // Create/Update mutation
  const mutation = useMutation({
    mutationFn: async (data: CreateDiscountRequest & { active: boolean }) => {
      if (isEditing) {
        return discountService.updateDiscount(venueId, discountId!, data)
      }
      return discountService.createDiscount(venueId, data)
    },
    onSuccess: () => {
      toast({
        title: isEditing ? t('discounts.toasts.updateSuccess') : t('discounts.toasts.createSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['discounts', venueId] })
      navigate('..')
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('discounts.toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Handle form submit
  const onSubmit = (data: CreateDiscountRequest & { active: boolean }) => {
    // Clean up data based on scope
    const cleanedData = { ...data }

    // Only keep relevant target fields based on scope
    if (data.scope !== 'ITEM') {
      cleanedData.targetItemIds = undefined
    }
    if (data.scope !== 'CATEGORY') {
      cleanedData.targetCategoryIds = undefined
    }
    if (data.scope !== 'CUSTOMER_GROUP') {
      cleanedData.customerGroupId = undefined
    }
    if (data.scope !== 'QUANTITY') {
      cleanedData.buyQuantity = undefined
      cleanedData.getQuantity = undefined
      cleanedData.getDiscountPercent = undefined
      cleanedData.buyItemIds = undefined
      cleanedData.getItemIds = undefined
    }

    // Only keep comp fields for COMP type
    if (data.type !== 'COMP') {
      cleanedData.requiresApproval = undefined
      cleanedData.compReason = undefined
    }

    // Convert empty strings to undefined for optional fields
    if (!cleanedData.validFrom) cleanedData.validFrom = undefined
    if (!cleanedData.validUntil) cleanedData.validUntil = undefined
    if (!cleanedData.timeFrom) cleanedData.timeFrom = undefined
    if (!cleanedData.timeUntil) cleanedData.timeUntil = undefined
    if (!cleanedData.description) cleanedData.description = undefined

    // Convert daysOfWeek to numbers
    if (cleanedData.daysOfWeek && cleanedData.daysOfWeek.length > 0) {
      cleanedData.daysOfWeek = cleanedData.daysOfWeek.map((d: any) => (typeof d === 'object' ? parseInt(d.value) : parseInt(d)))
    } else {
      cleanedData.daysOfWeek = undefined
    }

    // Convert MultipleSelector values to arrays of IDs
    if (cleanedData.targetItemIds && Array.isArray(cleanedData.targetItemIds)) {
      cleanedData.targetItemIds = cleanedData.targetItemIds.map((item: any) => (typeof item === 'object' ? item.value : item))
    }
    if (cleanedData.targetCategoryIds && Array.isArray(cleanedData.targetCategoryIds)) {
      cleanedData.targetCategoryIds = cleanedData.targetCategoryIds.map((item: any) => (typeof item === 'object' ? item.value : item))
    }
    if (cleanedData.buyItemIds && Array.isArray(cleanedData.buyItemIds)) {
      cleanedData.buyItemIds = cleanedData.buyItemIds.map((item: any) => (typeof item === 'object' ? item.value : item))
    }
    if (cleanedData.getItemIds && Array.isArray(cleanedData.getItemIds)) {
      cleanedData.getItemIds = cleanedData.getItemIds.map((item: any) => (typeof item === 'object' ? item.value : item))
    }

    mutation.mutate(cleanedData)
  }

  if (isLoadingDiscount || isLoadingOptions) {
    return <LoadingScreen message="Cargando descuentos" />
  }

  return (
    <div className="bg-background text-foreground">
      {/* Header */}
      <div className="sticky z-10 flex flex-row justify-between w-full px-4 py-3 mb-4 bg-background border-b-2 top-14">
        <div className="space-x-4 flex-row-center">
          <button type="button" onClick={() => navigate('..')} className="cursor-pointer bg-transparent">
            <ArrowLeft />
          </button>
          <span className="font-medium">{form.watch('name') || (isEditing ? t('discounts.edit.title') : t('discounts.create.title'))}</span>
        </div>
        <div className="space-x-3 flex-row-center">
          <Button
            variant={form.watch('active') ? 'default' : 'secondary'}
            size="sm"
            onClick={() => form.setValue('active', !form.getValues('active'))}
          >
            {form.watch('active') ? t('discounts.status.active') : t('discounts.status.inactive')}
          </Button>
          <LoadingButton loading={mutation.isPending} onClick={form.handleSubmit(onSubmit)} variant="default">
            {mutation.isPending ? tCommon('saving') : t('discounts.actions.save')}
          </LoadingButton>
        </div>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="px-4 pb-8 space-y-6 max-w-4xl">
          <DiscountFormFields
            form={form}
            productOptions={productOptions}
            categoryOptions={categoryOptions}
            customerGroupOptions={customerGroupOptions}
            dayOptions={dayOptions}
          />
        </form>
      </Form>
    </div>
  )
}
