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

const SETUP_STEPS = [
  { id: 'businessInfo', component: BusinessInfoStep },
  { id: 'businessType', component: BusinessTypeStep },
  { id: 'entityType', component: EntityTypeStep },
  { id: 'identity', component: IdentityStep },
  { id: 'terms', component: TermsStep },
  { id: 'bankAccount', component: BankAccountStep },
] as const

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

  const StepComponent = SETUP_STEPS[currentStep].component
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
          {t('wizard.step', { current: currentStep + 2, total: 7 })}
        </p>

        <StepComponent
          data={data}
          onNext={handleNext}
          onBack={isFirstStep ? undefined : handleBack}
        />
      </div>
    </SetupWizardLayout>
  )
}
