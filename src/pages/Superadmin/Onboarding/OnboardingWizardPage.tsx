import React, { useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Check, ArrowLeft, ArrowRight, Rocket, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useOnboardingWizard, loadStep, saveStep, clearWizardStorage } from './useOnboardingWizard'
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
  const [currentStep, setCurrentStepRaw] = useState(loadStep)
  const [results, setResults] = useState<StepResult[] | null>(null)
  const [wizardResponse, setWizardResponse] = useState<WizardResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const setCurrentStep = useCallback((updater: number | ((prev: number) => number)) => {
    setCurrentStepRaw((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater
      saveStep(next)
      return next
    })
  }, [])

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
    setConfirmOpen(false)
    setLoading(true)
    setError(null)
    try {
      const response = await createVenueWizard(wizard.state)
      setResults(response.steps)
      setWizardResponse(response)
      // Clear draft from localStorage on successful creation
      clearWizardStorage()
    } catch (err: any) {
      setError(err?.response?.data?.error || err.message || 'Error al crear venue')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (currentStep === STEPS.length - 1) {
      if (!results) setConfirmOpen(true)
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
      <div className="flex items-center gap-4">
        <div className="p-3 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-500/5">
          <Rocket className="h-6 w-6 text-blue-600 dark:text-blue-400" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Onboarding de Venue</h1>
          <p className="text-sm text-muted-foreground mt-1">Crea un venue completamente configurado en un solo flujo</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2">
          {STEPS.map((step, index) => (
            <React.Fragment key={step.label}>
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-all',
                    index < currentStep && 'bg-green-500 text-white',
                    index === currentStep && 'bg-foreground text-background ring-4 ring-foreground/20',
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
                <div className={cn('flex-1 h-0.5 rounded-full mx-1', index < currentStep ? 'bg-green-500' : 'bg-muted')} />
              )}
            </React.Fragment>
          ))}
        </div>
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
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-border">
        <Button variant="outline" onClick={handleBack} disabled={currentStep === 0 && !results} className="rounded-full cursor-pointer">
          <ArrowLeft className="w-4 h-4 mr-2" /> Atras
        </Button>
        <div className="flex gap-2">
          {results && (
            <Button variant="outline" onClick={() => navigate('/superadmin/venues')} className="rounded-full cursor-pointer">
              Ir a Venues
            </Button>
          )}
          {!results && (
            <Button onClick={handleNext} disabled={!canContinue() || loading} className="rounded-full cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {currentStep === STEPS.length - 1 ? 'Crear Venue' : 'Continuar'}
              {currentStep < STEPS.length - 1 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          )}
        </div>
      </div>

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Crear venue</AlertDialogTitle>
            <AlertDialogDescription>
              Se creara el venue <span className="font-semibold text-foreground">{wizard.state.venue.name || 'sin nombre'}</span> con toda la configuracion indicada. Esta accion no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} className="rounded-full cursor-pointer">
              Crear Venue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

export default OnboardingWizardPage
