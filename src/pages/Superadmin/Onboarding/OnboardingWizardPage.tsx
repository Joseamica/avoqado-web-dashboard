import React, { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Check, ArrowLeft, ArrowRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnboardingWizard } from './useOnboardingWizard'
import { createVenueWizard } from './onboarding.service'
import type { StepResult, WizardResponse } from './onboarding.types'
import { Step1OrgVenue } from './steps/Step1OrgVenue'
import { Step2PaymentConfig } from './steps/Step2PaymentConfig'
import { Step3TerminalMerchant } from './steps/Step3TerminalMerchant'
import { Step4SettlementTerms } from './steps/Step4SettlementTerms'
import { Step5TeamFeatures } from './steps/Step5TeamFeatures'
import { Step6ReviewConfirm } from './steps/Step6ReviewConfirm'
import { useNavigate } from 'react-router-dom'

const STEPS = [
  { label: 'Organizacion y Venue' },
  { label: 'Pagos' },
  { label: 'Terminal' },
  { label: 'Liquidacion' },
  { label: 'Equipo' },
  { label: 'Revision' },
]

const OnboardingWizardPage: React.FC = () => {
  const navigate = useNavigate()
  const wizard = useOnboardingWizard()
  const [currentStep, setCurrentStep] = useState(0)
  const [results, setResults] = useState<StepResult[] | null>(null)
  const [wizardResponse, setWizardResponse] = useState<WizardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canContinue = () => {
    const { state } = wizard
    switch (currentStep) {
      case 0:
        if (state.organization.mode === 'existing' && !state.organization.id) return false
        if (state.organization.mode === 'new' && (!state.organization.name || !state.organization.email || !state.organization.phone)) return false
        return !!state.venue.name && !!state.venue.venueType
      case 1:
        return state.pricing.useOrgConfig || (state.pricing.debitRate > 0 && state.pricing.creditRate > 0)
      default:
        return true
    }
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await createVenueWizard(wizard.state)
      setResults(response.steps)
      setWizardResponse(response)
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al crear venue')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (currentStep === STEPS.length - 1) {
      if (!results) handleSubmit()
      return
    }
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  const handleBack = () => {
    if (results) {
      setResults(null)
      return
    }
    setCurrentStep((s) => Math.max(s - 1, 0))
  }

  const handleReset = () => {
    wizard.reset()
    setCurrentStep(0)
    setResults(null)
    setWizardResponse(null)
    setError(null)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Onboarding de Venue</h1>
        <p className="text-sm text-muted-foreground">Crea un venue completamente configurado en un solo flujo</p>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-2">
        {STEPS.map((step, index) => (
          <React.Fragment key={step.label}>
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                  index < currentStep && 'bg-emerald-500 text-emerald-50',
                  index === currentStep && 'bg-primary text-primary-foreground ring-4 ring-primary/20',
                  index > currentStep && 'bg-muted text-muted-foreground',
                )}
              >
                {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
              </div>
              <span className={cn('text-sm font-medium hidden lg:block', index <= currentStep ? 'text-foreground' : 'text-muted-foreground')}>
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div className={cn('flex-1 h-0.5 rounded-full mx-1', index < currentStep ? 'bg-emerald-500' : 'bg-muted')} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step Content */}
      <div className="min-h-[400px]">
        {currentStep === 0 && (
          <Step1OrgVenue
            organization={wizard.state.organization}
            venue={wizard.state.venue}
            onOrgChange={wizard.setOrganization}
            onVenueChange={wizard.setVenue}
          />
        )}
        {currentStep === 1 && (
          <Step2PaymentConfig
            pricing={wizard.state.pricing}
            venueType={wizard.state.venue.venueType}
            organizationId={wizard.state.organization.mode === 'existing' ? wizard.state.organization.id : undefined}
            isNewOrg={wizard.state.organization.mode === 'new'}
            onChange={wizard.setPricing}
          />
        )}
        {currentStep === 2 && (
          <Step3TerminalMerchant
            terminal={wizard.state.terminal}
            venueType={wizard.state.venue.venueType}
            merchantAccountId={wizard.state.pricing.merchantAccountId}
            onPricingChange={wizard.setPricing}
            onChange={wizard.setTerminal}
          />
        )}
        {currentStep === 3 && <Step4SettlementTerms settlement={wizard.state.settlement} onChange={wizard.setSettlement} />}
        {currentStep === 4 && (
          <Step5TeamFeatures
            team={wizard.state.team}
            features={wizard.state.features}
            modules={wizard.state.modules}
            onTeamChange={wizard.setTeam}
            onFeaturesChange={wizard.setFeatures}
            onModulesChange={wizard.setModules}
          />
        )}
        {currentStep === 5 && <Step6ReviewConfirm state={wizard.state} results={results} response={wizardResponse} loading={loading} onReset={handleReset} />}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">{error}</div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 && !results}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Atras
        </Button>
        <div className="flex gap-2">
          {results && (
            <Button variant="outline" onClick={() => navigate('/superadmin/venues')}>
              Ir a Venues
            </Button>
          )}
          {!results && (
            <Button onClick={handleNext} disabled={!canContinue() || loading}>
              {currentStep === STEPS.length - 1 ? 'Crear Venue' : 'Continuar'}
              {currentStep < STEPS.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}

export default OnboardingWizardPage
