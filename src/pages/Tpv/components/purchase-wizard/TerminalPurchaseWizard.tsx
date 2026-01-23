import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import api from '@/api'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { Progress } from '@/components/ui/progress'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'

import { Step1Configuration, Step1Data } from './wizard-steps/Step1Configuration'
import { Step2Data, Step2ShippingInfo } from './wizard-steps/Step2ShippingInfo'
import { Step3Data, Step3PaymentMethod } from './wizard-steps/Step3PaymentMethod'
import { Step4Data, Step4ReviewConfirm } from './wizard-steps/Step4ReviewConfirm'

interface TerminalPurchaseWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

type WizardStep = 1 | 2 | 3 | 4
const TOTAL_STEPS = 4

export function TerminalPurchaseWizard({ open, onOpenChange, onSuccess }: TerminalPurchaseWizardProps) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { venue, venueId, fullBasePath } = useCurrentVenue()

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null)
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null)
  const [wasPreFilled, setWasPreFilled] = useState<boolean | undefined>(undefined)

  // Step 1 Form
  const step1Form = useForm<Step1Data>({
    defaultValues: {
      quantity: 1,
      namePrefix: 'Terminal',
    },
  })

  // Step 2 Form - Pre-fill with venue data
  const step2Form = useForm<Step2Data>({
    defaultValues: {
      contactName: venue?.name || '',
      contactEmail: venue?.email || '',
      contactPhone: venue?.phone || '',
      address: venue?.address || '',
      addressLine2: '',
      city: venue?.city || '',
      state: venue?.state || '',
      postalCode: venue?.zipCode || '',
      country: venue?.country || 'México',
      shippingSpeed: 'standard',
    },
  })

  // Step 3 Form
  const step3Form = useForm<Step3Data>({
    defaultValues: {
      method: 'card',
      cardNumber: '',
      cardExpiry: '',
      cardCVV: '',
      cardName: '',
      mockToken: '',
    },
  })

  // Step 4 Form
  const step4Form = useForm<Step4Data>({
    defaultValues: {
      acceptTerms: false,
    },
  })

  // Reset wizard when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep(1)
      setStep1Data(null)
      setStep2Data(null)
      setStep3Data(null)
      setWasPreFilled(undefined)

      step1Form.reset()
      step3Form.reset()
      step4Form.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset when dialog opens, forms are stable refs
  }, [open])

  // Pre-fill Step 2 when wizard opens (backup - main pre-fill happens in handleNext)
  useEffect(() => {
    if (open && venue && currentStep === 2) {
      console.log('🔧 [useEffect] Pre-filling Step 2 with venue data')
      step2Form.reset({
        contactName: venue.name || '',
        contactEmail: venue.email || '',
        contactPhone: venue.phone || '',
        address: venue.address || '',
        addressLine2: '',
        city: venue.city || '',
        state: venue.state || '',
        postalCode: venue.zipCode || '',
        country: venue.country || 'México',
        shippingSpeed: 'standard',
      })
    }
  }, [open, venue, currentStep, step2Form])

  // Create terminals mutation
  const createTerminalsMutation = useMutation({
    mutationFn: async (data: any) => {
      const createdTerminals = []
      const errors = []

      for (let i = 0; i < data.quantity; i++) {
        try {
          const payload = {
            name: `${data.namePrefix} ${i + 1}`,
            // Serial number will be added later during activation
            brand: 'PAX',
            model: 'A910S',
            type: 'TPV_ANDROID',
            status: 'PENDING_ACTIVATION', // Terminal awaiting hardware serial number
            config: {
              purchaseOrder: {
                orderDate: new Date().toISOString(),
                product: {
                  name: 'PAX A910S',
                  price: 349,
                },
                quantity: data.quantity,
                shipping: data.shipping,
                payment: {
                  method: data.payment.method,
                  mockToken: data.payment.mockToken,
                  status: 'demo_completed',
                },
                totalAmount: data.totalAmount,
                currency: 'USD',
                sendEmail: i === 0, // Only send email for first terminal to avoid duplicates
              },
            },
          }

          const response = await api.post(`/api/v1/dashboard/venues/${venueId}/tpvs`, payload)
          createdTerminals.push(response.data)
        } catch (error: any) {
          errors.push({ index: i, error: error.response?.data?.message || error.message })
        }
      }

      return { createdTerminals, errors, total: data.quantity }
    },
    onSuccess: data => {
      if (data.errors.length === 0) {
        // All terminals created successfully
        toast({
          title: t('purchaseWizard.success.title'),
          description: t('purchaseWizard.success.message'),
        })
      } else if (data.createdTerminals.length > 0) {
        // Partial success
        toast({
          title: t('purchaseWizard.success.title'),
          description: t('purchaseWizard.errors.partialSuccess', {
            success: data.createdTerminals.length,
            total: data.total,
            failed: data.errors.length,
          }),
          variant: 'destructive',
        })
      }

      queryClient.invalidateQueries({ queryKey: ['tpvs', venueId] })
      onSuccess?.()
      onOpenChange(false)

      // Navigate to TPV list
      navigate(`${fullBasePath}/tpv`)
    },
    onError: (error: any) => {
      toast({
        title: tCommon('common.error'),
        description: error.response?.data?.message || t('purchaseWizard.errors.createFailed'),
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

        // Pre-fill Step 2 form when user advances to it
        if (venue) {
          // Check if venue has complete data
          const hasCompleteData = Boolean(
            venue.name && venue.email && venue.phone && venue.address && venue.city && venue.state && venue.zipCode,
          )

          console.log('🔧 Pre-filling Step 2 with venue data:', {
            name: venue.name,
            email: venue.email,
            phone: venue.phone,
            address: venue.address,
            city: venue.city,
            state: venue.state,
            zipCode: venue.zipCode,
            country: venue.country,
            hasCompleteData,
          })

          setWasPreFilled(hasCompleteData)

          // Use setTimeout to ensure form is ready
          setTimeout(() => {
            step2Form.reset({
              contactName: venue.name || '',
              contactEmail: venue.email || '',
              contactPhone: venue.phone || '',
              address: venue.address || '',
              addressLine2: '',
              city: venue.city || '',
              state: venue.state || '',
              postalCode: venue.zipCode || '',
              country: venue.country || 'México',
              shippingSpeed: 'standard',
            })
          }, 0)
        } else {
          setWasPreFilled(false)
        }
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
        const formData = step3Form.getValues()
        // Generate mock token
        const mockToken = `mock_tok_${Date.now()}`
        setStep3Data({ ...formData, mockToken })
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

  // Handle edit from review step
  const handleEditStep = (step: number) => {
    setCurrentStep(step as WizardStep)
  }

  // Handle complete - collect all data and submit
  const handleComplete = () => {
    if (!step1Data || !step2Data || !step3Data) {
      toast({
        title: tCommon('common.error'),
        description: t('purchaseWizard.errors.validationFailed'),
        variant: 'destructive',
      })
      return
    }

    const step4Values = step4Form.getValues()

    if (!step4Values.acceptTerms) {
      toast({
        title: tCommon('common.error'),
        description: t('purchaseWizard.errors.termsRequired'),
        variant: 'destructive',
      })
      return
    }

    // Calculate total
    const subtotal = 349 * step1Data.quantity
    const shippingCost = step2Data.shippingSpeed === 'express' ? 15 : step2Data.shippingSpeed === 'overnight' ? 35 : 0
    const tax = (subtotal + shippingCost) * 0.16
    const totalAmount = subtotal + shippingCost + tax

    // Build complete data
    const completeData = {
      quantity: step1Data.quantity,
      namePrefix: step1Data.namePrefix,
      autoGenerate: step1Data.autoGenerate,
      serialNumbers: step1Data.serialNumbers,
      shipping: step2Data,
      payment: step3Data,
      totalAmount,
    }

    createTerminalsMutation.mutate(completeData)
  }

  const isLoading = createTerminalsMutation.isPending

  // Get step title
  const getStepTitle = () => {
    switch (currentStep) {
      case 1:
        return t('purchaseWizard.step1.title')
      case 2:
        return t('purchaseWizard.step2.title')
      case 3:
        return t('purchaseWizard.step3.title')
      case 4:
        return t('purchaseWizard.step4.title')
      default:
        return ''
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('purchaseWizard.title')}</DialogTitle>
          <DialogDescription>{t('purchaseWizard.subtitle')}</DialogDescription>
        </DialogHeader>

        {/* Progress Bar */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-muted-foreground">
            <span>{getStepTitle()}</span>
            <span>
              {tCommon('step')} {currentStep} {tCommon('of')} {TOTAL_STEPS}
            </span>
          </div>
          <Progress value={progressPercentage} className="h-2" />
        </div>

        {/* Step Content */}
        <div className="py-4">
          {currentStep === 1 && (
            <Form {...step1Form}>
              <Step1Configuration form={step1Form} />
            </Form>
          )}

          {currentStep === 2 && (
            <Form {...step2Form}>
              <Step2ShippingInfo form={step2Form} wasPreFilled={wasPreFilled} />
            </Form>
          )}

          {currentStep === 3 && (
            <Form {...step3Form}>
              <Step3PaymentMethod form={step3Form} />
            </Form>
          )}

          {currentStep === 4 && step1Data && step2Data && step3Data && (
            <Form {...step4Form}>
              <Step4ReviewConfirm
                form={step4Form}
                step1Data={step1Data}
                step2Data={step2Data}
                step3Data={step3Data}
                onEditStep={handleEditStep}
              />
            </Form>
          )}
        </div>

        {/* Navigation */}
        <DialogFooter className="flex justify-between sm:justify-between">
          <Button type="button" variant="outline" onClick={handleBack} disabled={currentStep === 1 || isLoading}>
            <ChevronLeft className="mr-2 h-4 w-4" />
            {tCommon('back')}
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
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
                  {t('purchaseWizard.step4.placeOrder')}
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
