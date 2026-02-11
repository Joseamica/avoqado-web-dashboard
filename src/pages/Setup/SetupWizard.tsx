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

export default function SetupWizard() {
  const { t } = useTranslation('setup')
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { user } = useAuth()
  const orgId = user?.organizationId ?? null

  const [currentStep, setCurrentStep] = useState(0)
  const [data, setData] = useState<SetupData>({})
  const [isSaving, setIsSaving] = useState(false)

  // Ref for latest data to avoid stale closures in async handlers
  const dataRef = useRef(data)
  dataRef.current = data

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

  // Restore saved data on mount
  useEffect(() => {
    if (!progressData?.progress) return

    const progress = progressData.progress

    // Restore v2 setup data if available
    if (progress.v2SetupData) {
      const saved = progress.v2SetupData as SetupData
      setData((prev) => ({ ...prev, ...saved }))

      // Restore to last completed step
      if (progress.currentStep && progress.currentStep > 1) {
        // currentStep from backend is 1-indexed and includes step 1 (signup)
        // Our steps are 0-indexed starting from step 2
        const resumeStep = Math.min(progress.currentStep - 1, SETUP_STEPS.length - 1)
        setCurrentStep(resumeStep)
      }
    }
  }, [progressData])

  // Sync URL hash with current step
  useEffect(() => {
    const hash = `#step-${currentStep + 1}`
    if (window.location.hash !== hash) {
      window.history.replaceState(null, '', hash)
    }
  }, [currentStep])

  // Restore step from URL hash on mount
  useEffect(() => {
    const hash = window.location.hash
    const match = hash.match(/^#step-(\d+)$/)
    if (match) {
      const stepIndex = parseInt(match[1], 10) - 1
      if (stepIndex >= 0 && stepIndex < SETUP_STEPS.length) {
        setCurrentStep(stepIndex)
      }
    }
  }, [])

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
        setCurrentStep((prev) => prev + 1)
      } else {
        // Final step completed — finalize setup
        await handleComplete(merged)
      }
    },
    [orgId, currentStep],
  )

  const handleBack = useCallback(() => {
    if (currentStep > 0) {
      setCurrentStep((prev) => prev - 1)
    }
  }, [currentStep])

  const handleFinishLater = useCallback(() => {
    // Navigate to home — AuthContext will handle showing the incomplete setup banner
    navigate('/', { replace: true })
  }, [navigate])

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

  if (isLoading) {
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/50">
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
