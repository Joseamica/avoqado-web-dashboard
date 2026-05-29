import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Form } from '@/components/ui/form'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Progress } from '@/components/ui/progress'
import { CartLine } from '@/config/tpvCatalog'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { useToast } from '@/hooks/use-toast'
import { tpvOrderService } from '@/services/tpvOrder.service'

import { Step1Configuration } from './wizard-steps/Step1Configuration'
import { Step2Data, Step2ShippingInfo } from './wizard-steps/Step2ShippingInfo'
import { Step3Data, Step3PaymentMethod } from './wizard-steps/Step3PaymentMethod'
import { Step4Data, Step4ReviewConfirm } from './wizard-steps/Step4ReviewConfirm'

interface TerminalPurchaseWizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
  /**
   * Origin of the purchase — forwarded to the backend so Stripe Checkout
   * `success_url` routes back to the right place after Card payments:
   *   - `'tpv'` (default): land at the venue's order detail page.
   *   - `'setup'`: round-trip back to the V2 onboarding wizard Step 9.
   */
  from?: 'tpv' | 'setup'
  /**
   * Called when the wizard completes WITHOUT a Stripe redirect (SPEI path).
   * Receives the new order id + payment method so the caller can hydrate
   * downstream UI (e.g. the onboarding step's View B). For Card payments,
   * the Stripe redirect happens before this fires — the caller observes
   * completion via URL params on return instead.
   *
   * When provided, also OVERRIDES the default "navigate to order detail"
   * behavior — the caller is responsible for closing the modal and routing.
   */
  onComplete?: (result: { orderId: string; paymentMethod: 'CARD_STRIPE' | 'SPEI' }) => void
  /**
   * Explicit venue id. REQUIRED when the wizard is opened outside a
   * `/venues/:slug/` route (e.g. the onboarding wizard at `/setup`), because
   * `useCurrentVenue()` can't resolve a venue from the URL there. When omitted,
   * falls back to the current-venue context (normal post-onboarding usage).
   */
  venueId?: string
}

type WizardStep = 1 | 2 | 3 | 4
const TOTAL_STEPS = 4

export function TerminalPurchaseWizard({
  open,
  onOpenChange,
  onSuccess,
  from = 'tpv',
  onComplete,
  venueId: venueIdProp,
}: TerminalPurchaseWizardProps) {
  const { t } = useTranslation('tpv')
  const { t: tCommon } = useTranslation()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { venue, venueId: venueIdFromContext, fullBasePath } = useCurrentVenue()
  // Explicit prop wins (onboarding /setup has no venue in the URL); otherwise
  // use the current-venue context (normal /venues/:slug/tpv usage).
  const venueId = venueIdProp ?? venueIdFromContext

  const [currentStep, setCurrentStep] = useState<WizardStep>(1)
  const [cart, setCart] = useState<CartLine[]>([])
  const [showEmptyCartError, setShowEmptyCartError] = useState(false)
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null)
  const [step3Data, setStep3Data] = useState<Step3Data | null>(null)
  const [wasPreFilled, setWasPreFilled] = useState<boolean | undefined>(undefined)

  // Clear the empty-cart error as soon as the user adds at least one item.
  useEffect(() => {
    if (cart.length > 0 && showEmptyCartError) {
      setShowEmptyCartError(false)
    }
  }, [cart.length, showEmptyCartError])

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
    },
  })

  // Step 3 Form
  const step3Form = useForm<Step3Data>({
    defaultValues: { method: 'CARD_STRIPE' },
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
      setCart([])
      setShowEmptyCartError(false)
      setStep2Data(null)
      setStep3Data(null)
      setWasPreFilled(undefined)

      step3Form.reset()
      step4Form.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- Only reset when dialog opens, forms are stable refs
  }, [open])

  // Pre-fill Step 2 when wizard opens (backup - main pre-fill happens in handleNext)
  useEffect(() => {
    if (open && venue && currentStep === 2) {
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
      })
    }
  }, [open, venue, currentStep, step2Form])

  // Create order mutation — POSTs to /tpv-orders and (for Stripe Card) redirects to hosted checkout.
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (cart.length === 0 || !step2Data || !step3Data) {
        throw new Error('Missing wizard data')
      }
      return tpvOrderService.create(venueId!, {
        items: cart.map(line => ({
          catalogKey: line.catalogKey,
          quantity: line.quantity,
        })),
        contactName: step2Data.contactName,
        contactEmail: step2Data.contactEmail,
        contactPhone: step2Data.contactPhone,
        shippingAddress: step2Data.address,
        shippingAddress2: step2Data.addressLine2 || undefined,
        shippingCity: step2Data.city,
        shippingState: step2Data.state,
        shippingZip: step2Data.postalCode,
        shippingCountry: step2Data.country,
        paymentMethod: step3Data.method,
        from,
      })
    },
    onSuccess: result => {
      if (result.redirectUrl) {
        // Stripe Card → redirect to hosted checkout. Backend already routed
        // success_url to the right destination based on `from`.
        window.location.href = result.redirectUrl
        return
      }
      // SPEI path: order created, no redirect. Two completion strategies:
      //   1. Caller provided `onComplete` → hand off to them (used by the
      //      onboarding wizard's BuyTpvStep so it can hydrate View B).
      //      They take responsibility for closing the modal + any routing.
      //   2. No `onComplete` → default behavior: invalidate queries, close
      //      modal, navigate to order detail page.
      queryClient.invalidateQueries({ queryKey: ['tpv-orders', venueId] })
      if (onComplete) {
        onComplete({ orderId: result.orderId, paymentMethod: step3Data!.method })
        return
      }
      onOpenChange(false)
      navigate(`${fullBasePath}/tpv/orders/${result.orderId}`)
      onSuccess?.()
    },
    onError: (error: any) => {
      toast({
        title: tCommon('error', { defaultValue: 'Error' }),
        description:
          error.response?.data?.message ??
          error.response?.data?.error ??
          error.message ??
          t('purchaseWizard.errors.createFailed'),
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
      if (cart.length === 0) {
        // Inline error in Step1 (catalog cards highlight + cart card shows the message)
        // — no toast, no i18n-broken "common.error" title.
        setShowEmptyCartError(true)
        return
      }
      setShowEmptyCartError(false)
      setCurrentStep(2)

      // Pre-fill Step 2 form when user advances to it
      if (venue) {
        // Check if venue has complete data
        const hasCompleteData = Boolean(
          venue.name && venue.email && venue.phone && venue.address && venue.city && venue.state && venue.zipCode,
        )

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
          })
        }, 0)
      } else {
        setWasPreFilled(false)
      }
      return
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

  // Handle edit from review step
  const handleEditStep = (step: number) => {
    setCurrentStep(step as WizardStep)
  }

  // Handle complete - submit the new cart-based order mutation
  const handleComplete = () => {
    const step4Values = step4Form.getValues()
    if (!step4Values.acceptTerms) {
      toast({
        title: tCommon('error', { defaultValue: 'Error' }),
        description: t('purchaseWizard.errors.termsRequired'),
        variant: 'destructive',
      })
      return
    }
    createOrderMutation.mutate()
  }

  const isLoading = createOrderMutation.isPending

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
    <FullScreenModal
      open={open}
      onClose={() => onOpenChange(false)}
      title={t('purchaseWizard.title')}
      subtitle={t('purchaseWizard.subtitle')}
      contentClassName="bg-muted/30"
      actions={
        <div className="flex items-center gap-2">
          {currentStep > 1 && (
            <Button type="button" variant="outline" onClick={handleBack} disabled={isLoading}>
              <ChevronLeft className="mr-2 h-4 w-4" />
              {tCommon('back')}
            </Button>
          )}
          <Button onClick={handleNext} disabled={isLoading} data-tour="tpv-wizard-next">
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
      }
    >
      <div className="mx-auto w-full max-w-3xl px-6 py-8 space-y-6">
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
        <div>
          {currentStep === 1 && (
            <Step1Configuration cart={cart} onChange={setCart} showEmptyError={showEmptyCartError} />
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

          {currentStep === 4 && step2Data && step3Data && (
            <Form {...step4Form}>
              <Step4ReviewConfirm
                form={step4Form}
                cart={cart}
                step2Data={step2Data}
                step3Data={step3Data}
                onEditStep={handleEditStep}
              />
            </Form>
          )}
        </div>
      </div>
    </FullScreenModal>
  )
}
