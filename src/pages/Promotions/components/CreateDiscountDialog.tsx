import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'

import { LoadingButton } from '@/components/loading-button'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { useToast } from '@/hooks/use-toast'
import discountService from '@/services/discount.service'
import type { CreateDiscountRequest, DiscountScope, DiscountType } from '@/types/discount'

import { DiscountFormFields } from './DiscountFormFields'
import { useDiscountFormData } from '../hooks/useDiscountFormData'

interface CreateDiscountDialogProps {
  venueId: string
  onSuccess: (discountId: string) => void
}

export function CreateDiscountDialog({ venueId, onSuccess }: CreateDiscountDialogProps) {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)

  const { productOptions, categoryOptions, customerGroupOptions, dayOptions, isLoading } = useDiscountFormData(venueId)

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

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      form.reset()
    }
  }, [open, form])

  const mutation = useMutation({
    mutationFn: (data: CreateDiscountRequest & { active: boolean }) => discountService.createDiscount(venueId, data),
    onSuccess: data => {
      toast({
        title: t('discounts.toasts.createSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['discounts', venueId] })
      onSuccess(data.id)
      setOpen(false)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('discounts.toasts.error'),
        variant: 'destructive',
      })
    },
  })

  const onSubmit = (data: CreateDiscountRequest & { active: boolean }) => {
    // Clean up data based on scope (same logic as DiscountForm)
    const cleanedData = { ...data }

    if (data.scope !== 'ITEM') cleanedData.targetItemIds = undefined
    if (data.scope !== 'CATEGORY') cleanedData.targetCategoryIds = undefined
    if (data.scope !== 'CUSTOMER_GROUP') cleanedData.customerGroupId = undefined
    if (data.scope !== 'QUANTITY') {
      cleanedData.buyQuantity = undefined
      cleanedData.getQuantity = undefined
      cleanedData.getDiscountPercent = undefined
      cleanedData.buyItemIds = undefined
      cleanedData.getItemIds = undefined
    }

    if (data.type !== 'COMP') {
      cleanedData.requiresApproval = undefined
      cleanedData.compReason = undefined
    }

    if (!cleanedData.validFrom) cleanedData.validFrom = undefined
    if (!cleanedData.validUntil) cleanedData.validUntil = undefined
    if (!cleanedData.timeFrom) cleanedData.timeFrom = undefined
    if (!cleanedData.timeUntil) cleanedData.timeUntil = undefined
    if (!cleanedData.description) cleanedData.description = undefined

    if (cleanedData.daysOfWeek && cleanedData.daysOfWeek.length > 0) {
      cleanedData.daysOfWeek = cleanedData.daysOfWeek.map((d: any) => (typeof d === 'object' ? parseInt(d.value) : parseInt(d)))
    } else {
      cleanedData.daysOfWeek = undefined
    }

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

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="w-full justify-start font-normal" onClick={e => e.stopPropagation()}>
          <Plus className="mr-2 h-4 w-4" />
          {t('discounts.create.title')}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>{t('discounts.create.title')}</DialogTitle>
          <DialogDescription>{t('discounts.create.subtitle')}</DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 py-4">
            <DiscountFormFields
              form={form}
              productOptions={productOptions}
              categoryOptions={categoryOptions}
              customerGroupOptions={customerGroupOptions}
              dayOptions={dayOptions}
            />

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {tCommon('cancel')}
              </Button>
              <LoadingButton loading={mutation.isPending} type="submit">
                {t('discounts.actions.create')}
              </LoadingButton>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
