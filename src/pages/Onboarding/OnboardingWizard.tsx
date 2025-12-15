import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { OnboardingLayout } from './components/OnboardingLayout'
import { WelcomeStep } from './steps/WelcomeStep'
import { OnboardingTypeStep, OnboardingType } from './steps/OnboardingTypeStep'
import { BusinessInfoStep, BusinessInfoData } from './steps/BusinessInfoStep'
import { MenuDataStep, MenuDataStepData } from './steps/MenuDataStep'
import { TeamInvitesStep, TeamInvitesStepData } from './steps/TeamInvitesStep'
import { FeaturesStep, FeaturesStepData } from './steps/FeaturesStep'
import { KYCDocumentsStep, KYCDocumentsData } from './steps/KYCDocumentsStep'
import { PaymentInfoStep, PaymentInfoData } from './steps/PaymentInfoStep'
import { LoadingScreen } from '@/components/spinner'
import {
  startOnboarding,
  getOnboardingProgress,
  updateStep2,
  updateStep3,
  updateStep4,
  updateStep5,
  updateStep6,
  updateStep7,
  updateStep8,
  completeOnboarding,
  OnboardingProgressResponse,
} from '@/services/onboarding.service'
import { useToast } from '@/hooks/use-toast'

// Step definitions
export interface OnboardingStepConfig {
  id: string
  title: string
  component: React.ComponentType<OnboardingStepProps>
}

export interface OnboardingStepProps {
  onNext: () => void
  onPrevious: () => void
  onSkip?: () => void
  isFirstStep: boolean
  isLastStep: boolean
  onSelect?: (type: OnboardingType) => void
  onSave?: (data: any) => void
  initialValue?: any
  isLoading?: boolean
}

// Onboarding data interface
export interface OnboardingData {
  type?: OnboardingType
  businessInfo?: BusinessInfoData
  menuData?: MenuDataStepData
  teamInvites?: TeamInvitesStepData
  features?: FeaturesStepData
  kycDocuments?: KYCDocumentsData
  payment?: PaymentInfoData
}

const STEPS: OnboardingStepConfig[] = [
  {
    id: 'welcome',
    title: 'steps.welcome',
    component: WelcomeStep,
  },
  {
    id: 'type',
    title: 'steps.type',
    component: OnboardingTypeStep,
  },
  {
    id: 'businessInfo',
    title: 'steps.businessInfo',
    component: BusinessInfoStep,
  },
  {
    id: 'menuData',
    title: 'steps.menuData',
    component: MenuDataStep,
  },
  {
    id: 'teamInvites',
    title: 'steps.teamInvites',
    component: TeamInvitesStep,
  },
  {
    id: 'features',
    title: 'steps.features',
    component: FeaturesStep,
  },
  {
    id: 'kycDocuments',
    title: 'steps.kycDocuments',
    component: KYCDocumentsStep,
  },
  {
    id: 'payment',
    title: 'steps.payment',
    component: PaymentInfoStep,
  },
]

// Helper function to get step index from URL hash
const getStepIndexFromHash = (hash: string): number | null => {
  if (!hash) return null
  const match = hash.match(/^#step-(\d+)$/)
  if (match) {
    const stepNum = parseInt(match[1], 10)
    if (stepNum >= 1 && stepNum <= STEPS.length) {
      return stepNum - 1 // Convert to 0-indexed
    }
  }
  return null
}

// Helper function to create hash from step index
const getHashFromStepIndex = (index: number): string => {
  return `#step-${index + 1}`
}

export function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isAuthenticated, user, isLoading } = useAuth()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [isCreatingVenue, setIsCreatingVenue] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [isLoadingProgress, setIsLoadingProgress] = useState(true)
  const isNavigatingRef = useRef(false) // Prevent recursive hash updates
  const maxAllowedStepRef = useRef(0) // Track the maximum step user can access

  // Use ref to access latest data synchronously (avoids race condition)
  const latestDataRef = useRef<OnboardingData>(onboardingData)

  // Sync ref with state
  useEffect(() => {
    latestDataRef.current = onboardingData
  }, [onboardingData])

  // Sync URL hash with step (only for popstate navigation, not for programmatic navigation)
  // This ensures the hash stays in sync when browser back/forward is used
  useEffect(() => {
    if (isInitialized && isNavigatingRef.current) {
      const newHash = getHashFromStepIndex(currentStepIndex)
      if (window.location.hash !== newHash) {
        window.history.replaceState(null, '', newHash)
      }
    }
  }, [currentStepIndex, isInitialized])

  // Listen for browser back/forward navigation (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const hashIndex = getStepIndexFromHash(window.location.hash)
      if (hashIndex !== null && hashIndex !== currentStepIndex) {
        // Validate: only allow navigation to steps within allowed range
        if (hashIndex <= maxAllowedStepRef.current) {
          isNavigatingRef.current = true
          setCurrentStepIndex(hashIndex)
          // Reset flag after state update
          setTimeout(() => {
            isNavigatingRef.current = false
          }, 0)
        } else {
          // User tried to skip ahead - revert to current step
          console.log('⚠️ Cannot skip to step', hashIndex + 1, '- max allowed is', maxAllowedStepRef.current + 1)
          window.history.replaceState(null, '', getHashFromStepIndex(currentStepIndex))
        }
      }
    }

    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [currentStepIndex])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  // Helper function to restore local state from backend progress
  const restoreProgressFromBackend = (progress: OnboardingProgressResponse['progress']) => {
    const restoredData: OnboardingData = {}

    // Restore onboarding type (step 2)
    if (progress.step2_onboardingType) {
      restoredData.type = progress.step2_onboardingType.onboardingType === 'DEMO' ? 'demo' : 'manual'
    }

    // Restore business info (step 3)
    if (progress.step3_businessInfo) {
      restoredData.businessInfo = {
        name: progress.step3_businessInfo.name,
        type: progress.step3_businessInfo.venueType,
        address: progress.step3_businessInfo.address,
        city: progress.step3_businessInfo.city,
        state: progress.step3_businessInfo.state,
        country: progress.step3_businessInfo.country,
        zipCode: progress.step3_businessInfo.zipCode,
        phone: progress.step3_businessInfo.phone,
        email: progress.step3_businessInfo.email,
        timezone: progress.step3_businessInfo.timezone,
        currency: progress.step3_businessInfo.currency,
      }
    }

    // Restore menu data (step 4)
    if (progress.step4_menuData) {
      restoredData.menuData = {
        method: progress.step4_menuData.method,
        categories: progress.step4_menuData.categories,
        products: progress.step4_menuData.products,
      }
    }

    // Restore team invites (step 5)
    if (progress.step5_teamInvites?.teamInvites) {
      restoredData.teamInvites = {
        invites: progress.step5_teamInvites.teamInvites,
      }
    }

    // Restore features (step 6)
    if (progress.step6_selectedFeatures?.selectedFeatures) {
      restoredData.features = {
        features: progress.step6_selectedFeatures.selectedFeatures,
      }
    }

    // Restore KYC documents (step 7)
    if (progress.step7_kycDocuments) {
      restoredData.kycDocuments = progress.step7_kycDocuments
    }

    // Restore payment info (step 8)
    if (progress.step8_paymentInfo) {
      restoredData.payment = progress.step8_paymentInfo
    }

    return restoredData
  }

  // Initialize onboarding progress when wizard loads and restore state
  useEffect(() => {
    const initializeOnboarding = async () => {
      if (!user?.organizationId || isInitialized) return

      setIsLoadingProgress(true)

      try {
        // Step 1: Start/get onboarding (creates record if doesn't exist)
        await startOnboarding(user.organizationId)

        // Step 2: Fetch current progress to restore state
        const { progress } = await getOnboardingProgress(user.organizationId)

        // Step 3: Determine which step to show
        // Priority: Backend progress > URL hash > Default (step 1)
        let targetStepIndex = 0

        // Check backend progress first (source of truth)
        if (progress.currentStep > 1) {
          targetStepIndex = progress.currentStep - 1
        }

        // Check URL hash - if user manually navigated to a specific step
        const hashIndex = getStepIndexFromHash(window.location.hash)
        if (hashIndex !== null) {
          // Allow hash navigation only if it's within completed steps or next step
          const maxAllowedStep = progress.currentStep > 0 ? progress.currentStep - 1 : 0
          if (hashIndex <= maxAllowedStep) {
            targetStepIndex = hashIndex
            console.log('📍 Using URL hash step:', hashIndex + 1)
          }
        }

        setCurrentStepIndex(targetStepIndex)

        // Set max allowed step (user can only go back, not forward beyond their progress)
        maxAllowedStepRef.current = targetStepIndex

        // Step 4: Restore form data from backend
        const restoredData = restoreProgressFromBackend(progress)
        if (Object.keys(restoredData).length > 0) {
          setOnboardingData(restoredData)
          latestDataRef.current = restoredData
          console.log('📦 Restored onboarding progress:', restoredData)
        }

        setIsInitialized(true)

        // Update URL hash to reflect current step
        const newHash = getHashFromStepIndex(targetStepIndex)
        if (window.location.hash !== newHash) {
          window.history.replaceState(null, '', newHash)
        }
      } catch (error: any) {
        console.error('Failed to initialize onboarding:', error)
        toast({
          variant: 'destructive',
          title: tCommon('error'),
          description: error.response?.data?.message || 'Failed to initialize onboarding',
        })
        // Even on error, set initial hash
        window.history.replaceState(null, '', '#step-1')
      } finally {
        setIsLoadingProgress(false)
      }
    }

    if (isAuthenticated && user) {
      initializeOnboarding()
    }
  }, [isAuthenticated, user, isInitialized, toast, tCommon])

  // Auto-save current step data to backend
  const saveCurrentStepToBackend = async () => {
    if (!user?.organizationId) return

    const currentStep = STEPS[currentStepIndex]
    const currentData = latestDataRef.current

    try {
      switch (currentStep.id) {
        case 'type':
          if (currentData.type) {
            await updateStep2(user.organizationId, currentData.type)
            console.log('💾 Saved step 2 (type):', currentData.type)
          }
          break
        case 'businessInfo':
          if (currentData.businessInfo) {
            await updateStep3(user.organizationId, currentData.businessInfo)
            console.log('💾 Saved step 3 (businessInfo)')
          }
          break
        case 'menuData':
          if (currentData.menuData) {
            await updateStep4(user.organizationId, currentData.menuData)
            console.log('💾 Saved step 4 (menuData)')
          }
          break
        case 'teamInvites':
          if (currentData.teamInvites?.invites?.length) {
            await updateStep5(user.organizationId, currentData.teamInvites.invites)
            console.log('💾 Saved step 5 (teamInvites)')
          }
          break
        case 'features':
          if (currentData.features?.features?.length) {
            await updateStep6(user.organizationId, currentData.features.features)
            console.log('💾 Saved step 6 (features)')
          }
          break
        case 'kycDocuments':
          if (currentData.kycDocuments) {
            await updateStep7(user.organizationId, currentData.kycDocuments)
            console.log('💾 Saved step 7 (kycDocuments)')
          }
          break
        case 'payment':
          if (currentData.payment?.clabe) {
            await updateStep8(user.organizationId, currentData.payment)
            console.log('💾 Saved step 8 (payment)')
          }
          break
      }
    } catch (error) {
      console.error('Error auto-saving step:', error)
      // Don't block navigation on auto-save failure
    }
  }

  // Helper to navigate and update hash
  const navigateToStep = useCallback((newIndex: number) => {
    setCurrentStepIndex(newIndex)
    // Update max allowed step if moving forward
    if (newIndex > maxAllowedStepRef.current) {
      maxAllowedStepRef.current = newIndex
    }
    // Use pushState so browser back/forward works
    window.history.pushState(null, '', getHashFromStepIndex(newIndex))
  }, [])

  const handleNext = async () => {
    // Auto-save current step before moving to next
    await saveCurrentStepToBackend()

    if (currentStepIndex < STEPS.length - 1) {
      const currentStep = STEPS[currentStepIndex]

      // If we're on BusinessInfo step and type is 'demo', skip MenuData step
      if (currentStep.id === 'businessInfo' && onboardingData.type === 'demo') {
        console.log('🎯 Modo Demo detectado - saltando MenuData step')
        navigateToStep(currentStepIndex + 2) // Skip MenuData
      } else {
        navigateToStep(currentStepIndex + 1)
      }
    } else {
      // Last step completed - navigate to venue creation or dashboard
      handleComplete()
    }
  }

  const handlePrevious = () => {
    if (currentStepIndex > 0) {
      const currentStep = STEPS[currentStepIndex]

      // If we're on TeamInvites step and type is 'demo', skip MenuData step when going back
      if (currentStep.id === 'teamInvites' && onboardingData.type === 'demo') {
        console.log('🎯 Modo Demo detectado - saltando MenuData step (hacia atrás)')
        navigateToStep(currentStepIndex - 2) // Skip MenuData
      } else {
        navigateToStep(currentStepIndex - 1)
      }
    }
  }

  const handleSkip = () => {
    // Skip current step only, advance to next step
    handleNext()
  }

  const handleComplete = async () => {
    // Use ref to get latest data (avoids race condition with React state)
    const currentData = latestDataRef.current

    // Validate that we have all required data
    if (!user?.organizationId) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Organization ID is missing. Please log in again.',
      })
      return
    }

    if (!currentData.type) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Please select an onboarding type (Demo or Manual)',
      })
      return
    }

    if (!currentData.businessInfo) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Please complete the business information form',
      })
      return
    }

    // Validate KYC documents (required for "manual" type)
    if (currentData.type === 'manual' && !currentData.kycDocuments) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Please upload the required KYC documents',
      })
      return
    }

    // Validate payment info (required for "manual" type)
    if (currentData.type === 'manual' && (!currentData.payment?.clabe || !currentData.payment?.accountHolder)) {
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: 'Please complete the payment information (CLABE and Account Holder)',
      })
      return
    }

    console.log('🎯 Onboarding data:', currentData)
    console.log('👤 User org:', user.organizationId)

    setIsCreatingVenue(true)

    try {
      // Step 1: Update onboarding type (Step 2)
      await updateStep2(user.organizationId, currentData.type)

      // Step 2: Update business info (Step 3)
      await updateStep3(user.organizationId, currentData.businessInfo)

      // Step 3 (Optional): Update menu data (Step 4) if provided
      if (currentData.menuData && (currentData.menuData.categories?.length || currentData.menuData.products?.length || currentData.menuData.csvFile)) {
        await updateStep4(user.organizationId, currentData.menuData)
      }

      // Step 4 (Optional): Update team invites (Step 5) if provided
      if (currentData.teamInvites && currentData.teamInvites.invites.length > 0) {
        await updateStep5(user.organizationId, currentData.teamInvites.invites)
      }

      // Step 5 (Optional): Update features (Step 6) if provided
      if (currentData.features && currentData.features.features.length > 0) {
        await updateStep6(user.organizationId, currentData.features.features)
      }

      // Step 6: Update KYC documents (Step 7) - Required for manual mode
      if (currentData.kycDocuments) {
        await updateStep7(user.organizationId, currentData.kycDocuments)
      }

      // Step 7: Update payment info (Step 8) - Required for manual mode
      if (currentData.payment && currentData.payment.clabe) {
        await updateStep8(user.organizationId, currentData.payment)
      }

      // Step 8: Complete onboarding and create venue
      // Pass Stripe payment method ID if provided
      const result = await completeOnboarding(user.organizationId, currentData.features?.stripePaymentMethodId)

      // Show success message
      if (result.summary.demoDataSeeded) {
        toast({
          title: tCommon('success'),
          description: `Venue created with ${result.summary.categoriesCreated} categories and ${result.summary.productsCreated} products!`,
        })
      } else {
        toast({
          title: tCommon('success'),
          description: 'Venue created successfully!',
        })
      }

      // Step 4: Refresh auth status to get new venue in session
      await queryClient.invalidateQueries({ queryKey: ['status'] })

      // Step 5: Navigate to the new venue dashboard
      navigate(`/venues/${result.venue.slug}/home`, { replace: true })
    } catch (error: any) {
      console.error('Error completing onboarding:', error)
      toast({
        variant: 'destructive',
        title: tCommon('error'),
        description: error.response?.data?.message || 'Failed to complete onboarding. Please try again.',
      })
      setIsCreatingVenue(false)
    }
  }

  if (isLoading || isLoadingProgress) {
    return <LoadingScreen message={isLoadingProgress ? t('shared.loadingProgress') || tCommon('loading') : tCommon('loading')} />
  }

  if (isCreatingVenue) {
    return <LoadingScreen message={onboardingData.type === 'demo' ? 'Creating your venue with demo data...' : 'Completing onboarding...'} />
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  // Safeguard: Ensure currentStepIndex is always within bounds
  // This handles edge cases like stale URL hashes (e.g., #step-9 when only 8 steps exist)
  const safeStepIndex = Math.min(Math.max(0, currentStepIndex), STEPS.length - 1)
  const currentStep = STEPS[safeStepIndex]

  // If the index was out of bounds, fix it synchronously (no useEffect needed here)
  // The next render will use the corrected value
  if (currentStepIndex !== safeStepIndex) {
    console.warn(`⚠️ Invalid step index ${currentStepIndex}, resetting to ${safeStepIndex}`)
    // Schedule state update for next tick to avoid render-time setState
    setTimeout(() => {
      setCurrentStepIndex(safeStepIndex)
      window.history.replaceState(null, '', getHashFromStepIndex(safeStepIndex))
    }, 0)
  }

  // Render the appropriate step with its specific props
  const renderStep = () => {
    const baseProps = {
      onNext: handleNext,
      onPrevious: handlePrevious,
      onSkip: handleSkip,
      isFirstStep: safeStepIndex === 0,
      isLastStep: safeStepIndex === STEPS.length - 1,
    }

    switch (currentStep.id) {
      case 'welcome':
        return <WelcomeStep {...baseProps} />

      case 'type':
        return (
          <OnboardingTypeStep
            {...baseProps}
            onSelect={type => {
              setOnboardingData(prev => {
                const newData = { ...prev, type }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.type}
          />
        )

      case 'businessInfo':
        return (
          <BusinessInfoStep
            {...baseProps}
            onSave={businessInfo => {
              setOnboardingData(prev => {
                const newData = { ...prev, businessInfo }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.businessInfo}
          />
        )

      case 'menuData':
        return (
          <MenuDataStep
            {...baseProps}
            onSave={menuData => {
              setOnboardingData(prev => {
                const newData = { ...prev, menuData }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.menuData}
          />
        )

      case 'teamInvites':
        return (
          <TeamInvitesStep
            {...baseProps}
            onSave={teamInvites => {
              setOnboardingData(prev => {
                const newData = { ...prev, teamInvites }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.teamInvites}
          />
        )

      case 'features':
        return (
          <FeaturesStep
            {...baseProps}
            onSave={features => {
              setOnboardingData(prev => {
                const newData = { ...prev, features }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.features}
          />
        )

      case 'kycDocuments':
        return (
          <KYCDocumentsStep
            {...baseProps}
            onSave={kycDocuments => {
              setOnboardingData(prev => {
                const newData = { ...prev, kycDocuments }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.kycDocuments}
          />
        )

      case 'payment':
        return (
          <PaymentInfoStep
            {...baseProps}
            onSave={payment => {
              setOnboardingData(prev => {
                const newData = { ...prev, payment }
                latestDataRef.current = newData // Update ref immediately
                return newData
              })
            }}
            initialValue={onboardingData.payment}
            isLoading={isCreatingVenue}
          />
        )

      default:
        return null
    }
  }

  return (
    <OnboardingLayout currentStep={safeStepIndex + 1} totalSteps={STEPS.length} stepTitle={t(currentStep.title)}>
      {renderStep()}
    </OnboardingLayout>
  )
}

export default OnboardingWizard
