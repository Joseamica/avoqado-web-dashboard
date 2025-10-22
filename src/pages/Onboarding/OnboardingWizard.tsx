import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
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
import { PaymentInfoStep, PaymentInfoData } from './steps/PaymentInfoStep'
import { LoadingScreen } from '@/components/spinner'
import {
  startOnboarding,
  updateStep2,
  updateStep3,
  updateStep4,
  updateStep5,
  updateStep6,
  updateStep7,
  completeOnboarding,
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
  onSave?: (data: BusinessInfoData) => void
}

// Onboarding data interface
export interface OnboardingData {
  type?: OnboardingType
  businessInfo?: BusinessInfoData
  menuData?: MenuDataStepData
  teamInvites?: TeamInvitesStepData
  features?: FeaturesStepData
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
    id: 'payment',
    title: 'steps.payment',
    component: PaymentInfoStep,
  },
]

export function OnboardingWizard() {
  const { t } = useTranslation('onboarding')
  const { t: tCommon } = useTranslation('common')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { isAuthenticated, user, isLoading } = useAuth()
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [onboardingData, setOnboardingData] = useState<OnboardingData>({})
  const [isCreatingVenue, setIsCreatingVenue] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)

  // Use ref to access latest data synchronously (avoids race condition)
  const latestDataRef = useRef<OnboardingData>(onboardingData)

  // Sync ref with state
  useEffect(() => {
    latestDataRef.current = onboardingData
  }, [onboardingData])

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true })
    }
  }, [isAuthenticated, isLoading, navigate])

  // Initialize onboarding progress when wizard loads
  useEffect(() => {
    const initializeOnboarding = async () => {
      if (!user?.organizationId || isInitialized) return

      try {
        await startOnboarding(user.organizationId)
        setIsInitialized(true)
      } catch (error: any) {
        console.error('Failed to initialize onboarding:', error)
        toast({
          variant: 'destructive',
          title: tCommon('error'),
          description: error.response?.data?.message || 'Failed to initialize onboarding',
        })
      }
    }

    if (isAuthenticated && user) {
      initializeOnboarding()
    }
  }, [isAuthenticated, user, isInitialized, toast, tCommon])

  const handleNext = () => {
    if (currentStepIndex < STEPS.length - 1) {
      const currentStep = STEPS[currentStepIndex]

      // If we're on BusinessInfo step and type is 'demo', skip MenuData step
      if (currentStep.id === 'businessInfo' && onboardingData.type === 'demo') {
        console.log('🎯 Modo Demo detectado - saltando MenuData step')
        setCurrentStepIndex(prev => prev + 2) // Skip MenuData
      } else {
        setCurrentStepIndex(prev => prev + 1)
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
        setCurrentStepIndex(prev => prev - 2) // Skip MenuData
      } else {
        setCurrentStepIndex(prev => prev - 1)
      }
    }
  }

  const handleSkip = () => {
    // Skip to the end
    handleComplete()
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

      // Step 6 (Optional): Update payment info (Step 7) if provided
      if (currentData.payment && currentData.payment.clabe) {
        await updateStep7(user.organizationId, currentData.payment)
      }

      // Step 7: Complete onboarding and create venue
      const result = await completeOnboarding(user.organizationId)

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

  if (isLoading) {
    return <LoadingScreen message={tCommon('loading')} />
  }

  if (isCreatingVenue) {
    return <LoadingScreen message={onboardingData.type === 'demo' ? 'Creating your venue with demo data...' : 'Completing onboarding...'} />
  }

  if (!isAuthenticated) {
    return null // Will redirect via useEffect
  }

  const currentStep = STEPS[currentStepIndex]

  // Render the appropriate step with its specific props
  const renderStep = () => {
    const baseProps = {
      onNext: handleNext,
      onPrevious: handlePrevious,
      onSkip: handleSkip,
      isFirstStep: currentStepIndex === 0,
      isLastStep: currentStepIndex === STEPS.length - 1,
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
          />
        )

      default:
        return null
    }
  }

  return (
    <OnboardingLayout currentStep={currentStepIndex + 1} totalSteps={STEPS.length} stepTitle={t(currentStep.title)}>
      {renderStep()}
    </OnboardingLayout>
  )
}

export default OnboardingWizard
