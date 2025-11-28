import { useState, useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useMutation, useQueryClient } from '@tanstack/react-query'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'
import { useToast } from '@/hooks/use-toast'
import discountService from '@/services/discount.service'
import type { CreateDiscountRequest, DiscountScope, DiscountType } from '@/types/discount'

import { ChevronLeft, ChevronRight, Check, Loader2 } from 'lucide-react'

import { useDiscountFormData } from '../hooks/useDiscountFormData'
import { WizardStep1BasicInfo } from './wizard-steps/WizardStep1BasicInfo'
import { WizardStep2Scope } from './wizard-steps/WizardStep2Scope'
import { WizardStep3Rules } from './wizard-steps/WizardStep3Rules'
import { WizardStep4Advanced } from './wizard-steps/WizardStep4Advanced'

interface DiscountWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  onSuccess?: (discountId: string) => void
}

type WizardStep = 1 | 2 | 3 | 4
const TOTAL_STEPS = 4

// Step 1: Basic Info
interface Step1FormData {
  name: string
  description: string
  type: DiscountType
  value: number
}

// Step 2: Scope & Targets
interface Step2FormData {
  scope: DiscountScope
  targetItemIds: any[]
  targetCategoryIds: any[]
  customerGroupId: string
  buyQuantity?: number
  getQuantity?: number
  getDiscountPercent?: number
  buyItemIds: any[]
  getItemIds: any[]
}

// Step 3: Rules & Time
interface Step3FormData {
  minPurchaseAmount?: number
  maxDiscountAmount?: number
  maxTotalUses?: number
  maxUsesPerCustomer?: number
  validFrom: string
  validUntil: string
  daysOfWeek: any[]
  timeFrom: string
  timeUntil: string
}

// Step 4: Advanced
interface Step4FormData {
  isAutomatic: boolean
  priority: number
  isStackable: boolean
  applyBeforeTax: boolean
  requiresApproval: boolean
  compReason: string
  active: boolean
}

export function DiscountWizard({ open, onOpenChange, venueId, onSuccess }: DiscountWizardProps) {
  const { t } = useTranslation('promotions')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  // Store wizard data in state (only submit on final step)
  const [step1Data, setStep1Data] = useState<Step1FormData | null>(null)
  const [step2Data, setStep2Data] = useState<Step2FormData | null>(null)
  const [step3Data, setStep3Data] = useState<Step3FormData | null>(null)

  const { productOptions, categoryOptions, customerGroupOptions, dayOptions } = useDiscountFormData(venueId)

  // Step 1 Form
  const step1Form = useForm<Step1FormData>({
    defaultValues: {
      name: '',
      description: '',
      type: 'PERCENTAGE' as DiscountType,
      value: undefined,
    },
  })

  // Step 2 Form
  const step2Form = useForm<Step2FormData>({
    defaultValues: {
      scope: 'ORDER' as DiscountScope,
      targetItemIds: [],
      targetCategoryIds: [],
      customerGroupId: '',
      buyQuantity: 1,
      getQuantity: 1,
      getDiscountPercent: 100,
      buyItemIds: [],
      getItemIds: [],
    },
  })

  // Step 3 Form
  const step3Form = useForm<Step3FormData>({
    defaultValues: {
      minPurchaseAmount: undefined,
      maxDiscountAmount: undefined,
      maxTotalUses: undefined,
      maxUsesPerCustomer: undefined,
      validFrom: '',
      validUntil: '',
      daysOfWeek: [],
      timeFrom: '',
      timeUntil: '',
    },
  })

  // Step 4 Form
  const step4Form = useForm<Step4FormData>({
    defaultValues: {
      isAutomatic: false,
      priority: 0,
      isStackable: false,
      applyBeforeTax: true,
      requiresApproval: false,
      compReason: '',
      active: true,
    },
  })

  // Reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setStep1Data(null)
      setStep2Data(null)
      setStep3Data(null)
      step1Form.reset()
      step2Form.reset()
      step3Form.reset()
      step4Form.reset()
    }
  }, [open])

  // Create discount mutation
  const createDiscountMutation = useMutation({
    mutationFn: (data: CreateDiscountRequest & { active: boolean }) => discountService.createDiscount(venueId, data),
    onSuccess: data => {
      toast({
        title: t('discounts.toasts.createSuccess'),
      })
      queryClient.invalidateQueries({ queryKey: ['discounts', venueId] })
      onSuccess?.(data.id)
      onOpenChange(false)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('discounts.toasts.error'),
        variant: 'destructive',
      })
    },
  })

  // Calculate progress
  const progressPercentage = (currentStep / TOTAL_STEPS) * 100

  // Handle next step
  const handleNext = async () => {
    let isValid = false

    if (currentStep === 1) {
      isValid = await step1Form.trigger()
      if (isValid) {
        setStep1Data(step1Form.getValues())
        setCurrentStep(2)
      }
    } else if (currentStep === 2) {
      isValid = await step2Form.trigger()
      if (isValid) {
        setStep2Data(step2Form.getValues())
        setCurrentStep(3)
      }
    } else if (currentStep === 3) {
      isValid = await step3Form.trigger()
      if (isValid) {
        setStep3Data(step3Form.getValues())
        setCurrentStep(4)
      }
    } else if (currentStep === 4) {
      isValid = await step4Form.trigger()
      if (isValid) {
        handleComplete()
      }
    }
  }

  // Handle back
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(prev => (prev - 1) as WizardStep)
    }
  }

  // Handle complete - collect all data and submit
  const handleComplete = () => {
    if (!step1Data || !step2Data || !step3Data) {
      toast({
        title: tCommon('common.error'),
        description: 'Missing wizard data',
        variant: 'destructive',
      })
      return
    }

    const step4Values = step4Form.getValues()

    // Build complete data
    const completeData: CreateDiscountRequest & { active: boolean } = {
      // Step 1
      name: step1Data.name,
      description: step1Data.description || undefined,
      type: step1Data.type,
      value: step1Data.value,
      // Step 2
      scope: step2Data.scope,
      targetItemIds: step2Data.scope === 'ITEM' ? cleanMultiSelect(step2Data.targetItemIds) : undefined,
      targetCategoryIds: step2Data.scope === 'CATEGORY' ? cleanMultiSelect(step2Data.targetCategoryIds) : undefined,
      customerGroupId: step2Data.scope === 'CUSTOMER_GROUP' ? step2Data.customerGroupId : undefined,
      buyQuantity: step2Data.scope === 'QUANTITY' ? step2Data.buyQuantity : undefined,
      getQuantity: step2Data.scope === 'QUANTITY' ? step2Data.getQuantity : undefined,
      getDiscountPercent: step2Data.scope === 'QUANTITY' ? step2Data.getDiscountPercent : undefined,
      buyItemIds: step2Data.scope === 'QUANTITY' ? cleanMultiSelect(step2Data.buyItemIds) : undefined,
      getItemIds: step2Data.scope === 'QUANTITY' ? cleanMultiSelect(step2Data.getItemIds) : undefined,
      // Step 3
      minPurchaseAmount: step3Data.minPurchaseAmount || undefined,
      maxDiscountAmount: step3Data.maxDiscountAmount || undefined,
      maxTotalUses: step3Data.maxTotalUses || undefined,
      maxUsesPerCustomer: step3Data.maxUsesPerCustomer || undefined,
      validFrom: step3Data.validFrom || undefined,
      validUntil: step3Data.validUntil || undefined,
      daysOfWeek: cleanDaysOfWeek(step3Data.daysOfWeek),
      timeFrom: step3Data.timeFrom || undefined,
      timeUntil: step3Data.timeUntil || undefined,
      // Step 4
      isAutomatic: step4Values.isAutomatic,
      priority: step4Values.priority,
      isStackable: step4Values.isStackable,
      applyBeforeTax: step4Values.applyBeforeTax,
      requiresApproval: step1Data.type === 'COMP' ? step4Values.requiresApproval : undefined,
      compReason: step1Data.type === 'COMP' ? step4Values.compReason : undefined,
      active: step4Values.active,
    }

    createDiscountMutation.mutate(completeData)
  }

  // Helper to clean multi-select values
  const cleanMultiSelect = (values: any[]): string[] | undefined => {
    if (!values || values.length === 0) return undefined
    return values.map((item: any) => (typeof item === 'object' ? item.value : item))
  }

  // Helper to clean days of week
  const cleanDaysOfWeek = (values: any[]): number[] | undefined => {
    if (!values || values.length === 0) return undefined
    return values.map((d: any) => (typeof d === 'object' ? parseInt(d.value) : parseInt(d)))
  }

  const isLoading = createDiscountMutation.isPending

  // Get step title
  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return t('discounts.wizard.step1.title')
      case 2:
        return t('discounts.wizard.step2.title')
      case 3:
        return t('discounts.wizard.step3.title')
      case 4:
        return t('discounts.wizard.step4.title')
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('discounts.wizard.title')}</DialogTitle>
          <DialogDescription>{t('discounts.wizard.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{getStepTitle()}</span>
            <span>{t('discounts.wizard.progress', { current: currentStep, total: TOTAL_STEPS })}</span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="py-4">
          {currentStep === 1 && (
            <Form {...step1Form}>
              <WizardStep1BasicInfo form={step1Form} />
            </Form>
          )}

          {currentStep === 2 && (
            <Form {...step2Form}>
              <WizardStep2Scope
                form={step2Form}
                productOptions={productOptions}
                categoryOptions={categoryOptions}
                customerGroupOptions={customerGroupOptions}
              />
            </Form>
          )}

          {currentStep === 3 && (
            <Form {...step3Form}>
              <WizardStep3Rules
                form={step3Form}
                dayOptions={dayOptions}
              />
            </Form>
          )}

          {currentStep === 4 && (
            <Form {...step4Form}>
              <WizardStep4Advanced
                form={step4Form}
                discountType={step1Data?.type || 'PERCENTAGE'}
              />
            </Form>
          )}
        </div>

        {/* Navigation */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button
            type="button"
            variant="outline"
            onClick={handleBack}
            disabled={currentStep === 1 || isLoading}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            {tCommon('back')}
          </Button>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
            <Button onClick={handleNext} disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {currentStep < TOTAL_STEPS ? (
                <>
                  {tCommon('next')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </>
              ) : (
                <>
                  {t('discounts.wizard.create')}
                  <Check className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
