/**
 * SetupWizard — Steps 2-7 of the Square-style onboarding
 *
 * Orchestrates post-signup setup: business info, type, entity,
 * identity, terms, and bank account.
 *
 * Protected by EmailVerifiedRoute — user must be logged in + email verified.
 */

import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQuery, useQueryClient } from '@tanstack/react-query'

import { SetupWizardLayout } from '@/components/layouts/SetupWizardLayout'
import { Icons } from '@/components/icons'
import { setupService } from '@/services/setup.service'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import type { SetupData } from './types'

import { BusinessInfoStep } from './steps/BusinessInfoStep'
import { BusinessTypeStep } from './steps/BusinessTypeStep'
import { EntityTypeStep } from './steps/EntityTypeStep'
import { IdentityStep } from './steps/IdentityStep'
import { TermsStep } from './steps/TermsStep'
import { BankAccountStep } from './steps/BankAccountStep'
import { PaymentProvidersStep } from './steps/PaymentProvidersStep'
import { BuyTpvStep } from './steps/BuyTpvStep'

// Always show Step 8 in the wizard. Backend gates the API (test-payment-link
// endpoint, OAuth callback wizard-routing) with ENABLE_ONBOARDING_PAYMENT_PROVIDERS;
// the frontend opts into showing the step unconditionally so every new
// merchant sees the option to connect MP/Stripe during onboarding.
const PAYMENT_PROVIDERS_ENABLED = true

// Same strategy for Step 9: always show, backend gates the API behavior
// (resolveTpvPurchase only surfaces tpvOrderId when ENABLE_ONBOARDING_TPV_PURCHASE=true).
// Spec: ../../../avoqado-server/docs/superpowers/specs/2026-05-29-onboarding-tpv-purchase-design.md
const TPV_PURCHASE_ENABLED = true

const BASE_SETUP_STEPS = [
  { id: 'businessInfo', component: BusinessInfoStep },
  { id: 'businessType', component: BusinessTypeStep },
  { id: 'entityType', component: EntityTypeStep },
  { id: 'identity', component: IdentityStep },
  { id: 'terms', component: TermsStep },
  { id: 'bankAccount', component: BankAccountStep },
] as const

const SETUP_STEPS = (() => {
  const steps: Array<{ id: string; component: any }> = [...BASE_SETUP_STEPS]
  if (PAYMENT_PROVIDERS_ENABLED) {
    steps.push({ id: 'paymentProviders', component: PaymentProvidersStep })
  }
  if (TPV_PURCHASE_ENABLED) {
    steps.push({ id: 'buyTpv', component: BuyTpvStep })
  }
  return steps
})()

const getStepIndexFromHash = (hash: string): number | null => {
  const match = hash.match(/^#step-(\d+)$/)
  if (!match) return null
  const idx = parseInt(match[1], 10) - 1
  if (idx >= 0 && idx < SETUP_STEPS.length) return idx
  return null
}

const getHashFromStepIndex = (idx: number): string => `#step-${idx + 1}`

// Backend stores v2SetupData nested by step keys ({ step2: {...}, step3: {...} }).
// Frontend SetupData uses a flat shape, so flatten before merging into wizard state.
const flattenV2SetupData = (raw: unknown): Partial<SetupData> => {
  if (!raw || typeof raw !== 'object') return {}
  return Object.values(raw as Record<string, unknown>).reduce<Partial<SetupData>>((acc, stepData) => {
    if (stepData && typeof stepData === 'object') {
      return { ...acc, ...(stepData as Partial<SetupData>) }
    }
    return acc
  }, {})
}

export default function SetupWizard() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { user, logout } = useAuth()
  const { toast } = useToast()
  const orgId = user?.organizationId ?? null

  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<SetupData>({})
  const [isSaving, setIsSaving] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Ref for latest data to avoid stale closures in async handlers
  const dataRef = useRef(data)
  dataRef.current = data

  // Max step the user is allowed to navigate to. Set from backend progress on mount
  // and bumped as the user advances. Prevents URL hash / browser-back from jumping ahead.
  const maxAllowedStepRef = useRef(0)

  // Fetch onboarding progress using org ID from AuthContext (avoids extra auth endpoint)
  const { data: progressData, isLoading } = useQuery({
    queryKey: ['onboarding-progress', orgId],
    queryFn: async () => {
      const response = await setupService.getProgress(orgId!)
      return response.data
    },
    enabled: !!orgId,
    retry: false,
  })

  // Initialize wizard step + form data from backend progress + URL hash. Runs once
  // when the progress query settles. Backend is the source of truth for max progress;
  // URL hash decides which allowed step the user lands on (useful for refresh / direct links).
  useEffect(() => {
    if (isInitialized) return
    if (isLoading) return

    const progress = progressData?.progress

    // Backend currentStep is 1-indexed and includes step 1 (signup).
    // Wizard is 0-indexed starting at businessInfo, so wizard.idx = backend.currentStep - 2.
    let backendMaxStep = 0
    if (progress?.currentStep && progress.currentStep >= 2) {
      backendMaxStep = Math.max(0, Math.min(progress.currentStep - 2, SETUP_STEPS.length - 1))
    }

    // Restore form data — backend stores it nested by step key, so flatten first.
    if (progress?.v2SetupData) {
      const restored = flattenV2SetupData(progress.v2SetupData)
      if (Object.keys(restored).length > 0) {
        setData((prev) => ({ ...prev, ...restored }))
        dataRef.current = { ...dataRef.current, ...restored }
      }
    }

    // Hydrate paymentProviders from the backend even if `v2SetupData` didn't surface it
    // under a step key (covers the "user came back days later" case where they connected
    // a merchant out-of-band and just want to see the green checkmark).
    const persistedProviders = (progressData as any)?.paymentProviders ?? null
    if (persistedProviders) {
      setData((prev) => ({ ...prev, paymentProviders: persistedProviders }))
      dataRef.current = { ...dataRef.current, paymentProviders: persistedProviders }
    }

    // Hydrate provisional venueId from ensureVenueForOnboarding. This is what
    // makes Steps 8 (payment providers) and 9 (buy TPV) functional during the
    // wizard — without it those steps would have no real venueId to call
    // backend APIs against.
    const persistedVenueId = (progressData as any)?.venueId ?? null
    if (persistedVenueId) {
      setData((prev) => ({ ...prev, venueId: persistedVenueId } as any))
      dataRef.current = { ...dataRef.current, venueId: persistedVenueId } as any
    }

    // Hydrate tpvPurchase (Step 9) the same way as paymentProviders. The
    // backend's resolveTpvPurchaseForOnboarding returns this when the env
    // flag is on; otherwise the field is undefined and Step 9 renders View A.
    const persistedTpvPurchase = (progressData as any)?.tpvPurchase ?? null
    if (persistedTpvPurchase) {
      setData((prev) => ({ ...prev, tpvPurchase: persistedTpvPurchase }))
      dataRef.current = { ...dataRef.current, tpvPurchase: persistedTpvPurchase }
    }

    // Resolve target step: prefer URL hash if it points to a step the user can already access.
    let targetStep = backendMaxStep
    const hashStep = getStepIndexFromHash(window.location.hash)
    if (hashStep !== null && hashStep <= backendMaxStep) {
      targetStep = hashStep
    }

    maxAllowedStepRef.current = backendMaxStep
    setCurrentStep(targetStep)

    // Anchor the initial history entry to the resolved step (no extra entries pushed yet).
    const targetHash = getHashFromStepIndex(targetStep)
    if (window.location.hash !== targetHash) {
      window.history.replaceState(null, '', targetHash)
    }

    // OAuth round-trip hydration. The MP callback sends users back to
    // /setup?mp_status=success&merchantId=X#step-7, and Stripe Connect uses the
    // same pattern with stripe_status. We jump straight to step 8 and seed the
    // merchant ID into the wizard state so the right tile renders green.
    const url = new URL(window.location.href)
    const mpStatus = url.searchParams.get('mp_status')
    const mpMerchantId = url.searchParams.get('merchantId')
    const stripeStatus = url.searchParams.get('stripe_status')

    if (PAYMENT_PROVIDERS_ENABLED && (mpStatus === 'success' || stripeStatus === 'success')) {
      // PaymentProviders is at index `length-2` when TPV step is enabled,
      // `length-1` otherwise. Compute by id so this stays correct if the
      // step order changes.
      const ppIndex = SETUP_STEPS.findIndex(s => s.id === 'paymentProviders')
      if (ppIndex >= 0) {
        maxAllowedStepRef.current = Math.max(maxAllowedStepRef.current, ppIndex)
        setCurrentStep(ppIndex)
        setData((prev) => {
          const next = {
            ...prev,
            paymentProviders: {
              ...(prev.paymentProviders ?? {}),
              ...(mpStatus === 'success' && mpMerchantId ? { mpMerchantId } : {}),
              ...(stripeStatus === 'success' && mpMerchantId ? { stripeMerchantId: mpMerchantId } : {}),
            },
          }
          dataRef.current = next
          return next
        })
        // Clean the URL so a refresh doesn't loop.
        url.search = ''
        window.history.replaceState(null, '', `${url.pathname}#step-${ppIndex + 1}`)
      }
    }

    // TPV purchase round-trip from Stripe Checkout. The backend's
    // buildStripeCheckoutUrls sends success/cancel back to
    // /setup?tpv_status=...&orderId=...#step-8 when `from=setup`.
    const tpvStatus = url.searchParams.get('tpv_status')
    const tpvOrderIdParam = url.searchParams.get('orderId')

    if (TPV_PURCHASE_ENABLED && (tpvStatus === 'success' || tpvStatus === 'cancel')) {
      const buyTpvIndex = SETUP_STEPS.findIndex(s => s.id === 'buyTpv')
      if (buyTpvIndex >= 0) {
        maxAllowedStepRef.current = Math.max(maxAllowedStepRef.current, buyTpvIndex)
        setCurrentStep(buyTpvIndex)
        setData((prev) => {
          const next = {
            ...prev,
            tpvPurchase: {
              ...(prev.tpvPurchase ?? {}),
              ...(tpvStatus === 'success' && tpvOrderIdParam ? { tpvOrderId: tpvOrderIdParam } : {}),
              skipped: false,
            },
          }
          dataRef.current = next
          return next
        })
        url.search = ''
        window.history.replaceState(null, '', `${url.pathname}#step-${buyTpvIndex + 1}`)
      }
    }

    setIsInitialized(true)
  }, [progressData, isLoading, isInitialized])

  // Sync state with browser back/forward navigation. Pop events occur when the user
  // walks history entries pushed by handleNext (or types a hash manually).
  useEffect(() => {
    if (!isInitialized) return

    const handlePopState = () => {
      const hashStep = getStepIndexFromHash(window.location.hash)
      if (hashStep === null) return

      if (hashStep <= maxAllowedStepRef.current) {
        setCurrentStep(hashStep)
      } else {
        // Block jumping forward past the user's actual progress.
        window.history.replaceState(null, '', getHashFromStepIndex(currentStep))
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [isInitialized, currentStep])

  const handleNext = useCallback(
    async (stepData: Partial<SetupData>) => {
      // Merge step data into state
      const merged = { ...dataRef.current, ...stepData }
      setData(merged)
      dataRef.current = merged

      // Save to backend
      if (orgId) {
        setIsSaving(true)
        try {
          // Backend step numbers: 1=signup, 2=businessInfo, 3=businessType, etc.
          const backendStep = currentStep + 2

          if (SETUP_STEPS[currentStep].id === 'terms') {
            // Terms step uses a separate endpoint
            await setupService.acceptTerms(orgId, {
              termsAccepted: true,
              privacyAccepted: true,
              termsVersion: new Date().toISOString().split('T')[0],
            })
          } else {
            await setupService.saveStep(orgId, backendStep, stepData)
          }
        } catch (error) {
          console.error('[SetupWizard] Failed to save step:', error)
          // Continue anyway — data is in local state, backend will retry on next step
        } finally {
          setIsSaving(false)
        }
      }

      // Advance to next step or complete
      if (currentStep < SETUP_STEPS.length - 1) {
        const newStep = currentStep + 1
        setCurrentStep(newStep)
        if (newStep > maxAllowedStepRef.current) {
          maxAllowedStepRef.current = newStep
        }
        // Push a new history entry so browser back returns to the previous wizard step.
        // The wizardStep marker lets handleBack distinguish wizard-pushed entries from
        // the initial anchor (which used replaceState and has null state).
        window.history.pushState({ wizardStep: newStep }, '', getHashFromStepIndex(newStep))
      } else {
        // Final step completed — finalize setup
        await handleComplete(merged)
      }
    },
    [orgId, currentStep],
  )

  const handleBack = useCallback(() => {
    if (currentStep <= 0) return

    // If the current entry was pushed by handleNext, walk history backwards so popstate
    // keeps URL/state aligned. If we're on the initial anchor entry (state === null),
    // there's no prior wizard entry to pop to — update state and replace URL in place
    // instead, otherwise history.back() would exit the wizard.
    if ((window.history.state as { wizardStep?: number } | null)?.wizardStep != null) {
      window.history.back()
    } else {
      const newStep = currentStep - 1
      setCurrentStep(newStep)
      window.history.replaceState(null, '', getHashFromStepIndex(newStep))
    }
  }, [currentStep])

  const handleFinishLater = useCallback(async () => {
    toast({
      title: t('wizard.progressSaved'),
      description: t('wizard.progressSavedDesc'),
    })
    // Logout and go to login — user can resume setup on next login
    await logout('/login')
  }, [logout, toast, t])

  const handleComplete = async (finalData: SetupData) => {
    if (!orgId) return
    setIsSaving(true)
    try {
      await setupService.completeSetup(orgId)

      // Refetch auth status to get the new venue
      await queryClient.refetchQueries({ queryKey: ['status'], type: 'active' })

      // Navigate to the dashboard — AuthContext will handle finding the venue
      navigate('/', { replace: true })
    } catch (error) {
      console.error('[SetupWizard] Failed to complete setup:', error)
      setIsSaving(false)
    }
  }

  if (isLoading || !isInitialized) {
    return (
      <SetupWizardLayout hideFinishLater>
        <div className="flex items-center justify-center py-20">
          <Icons.spinner className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </SetupWizardLayout>
    )
  }

  const StepComponent = SETUP_STEPS[currentStep].component as any
  const stepId = SETUP_STEPS[currentStep].id
  const isFirstStep = currentStep === 0

  return (
    <SetupWizardLayout
      onBack={isFirstStep ? undefined : handleBack}
      onFinishLater={handleFinishLater}
    >
      {isSaving && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/50">
          <Icons.spinner className="h-8 w-8 animate-spin text-foreground" />
        </div>
      )}
      <div className="relative">
        {/* Step indicator */}
        <p className="mb-6 text-xs text-muted-foreground">
          {t('wizard.step', { current: currentStep + 2, total: SETUP_STEPS.length + 1 })}
        </p>

        <StepComponent
          data={data}
          onNext={handleNext}
          onBack={isFirstStep ? undefined : handleBack}
          {...(stepId === 'paymentProviders'
            ? {
                venueId: (data as any).venueId,
                organizationId: orgId,
                mpMerchantId: data.paymentProviders?.mpMerchantId,
                stripeMerchantId: data.paymentProviders?.stripeMerchantId,
              }
            : {})}
          {...(stepId === 'buyTpv'
            ? {
                venueId: (data as any).venueId,
                tpvOrderId: data.tpvPurchase?.tpvOrderId,
              }
            : {})}
        />
      </div>
    </SetupWizardLayout>
  )
}
