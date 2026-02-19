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
import { Check, ArrowLeft, ArrowRight, Boxes, Loader2, Info, X, Upload } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useBulkOnboardingState, clearDraft, INITIAL_DEFAULTS, INITIAL_PRICING, INITIAL_SETTLEMENT } from './useBulkOnboardingState'
import type { PricingConfig, BulkOnboardingState, BulkVenueEntry } from './types'
import { superadminAPI, type BulkCreateVenuesPayload, type BulkCreateVenuesResponse } from '@/services/superadmin.service'
import { Step1OrgDefaults } from './steps/Step1OrgDefaults'
import { Step2Pricing } from './steps/Step2Pricing'
import { Step3Venues } from './steps/Step3Venues'
import { Step4Review } from './steps/Step4Review'
import { Step5Results } from './steps/Step5Results'
import { FullTemplateImportDialog } from './components/FullTemplateImportDialog'

const STEPS = [
  { label: 'Organización' },
  { label: 'Pricing' },
  { label: 'Venues' },
  { label: 'Revisión' },
  { label: 'Resultados' },
]

/** Convert percentage rates (2.5) to decimals (0.025) for the API */
function toDecimalRates(p: PricingConfig) {
  return {
    debitRate: p.debitRate / 100,
    creditRate: p.creditRate / 100,
    amexRate: p.amexRate / 100,
    internationalRate: p.internationalRate / 100,
    fixedFeePerTransaction: p.fixedFeePerTransaction,
    monthlyServiceFee: p.monthlyServiceFee,
  }
}

function buildPayload(state: ReturnType<typeof useBulkOnboardingState>['state']): BulkCreateVenuesPayload {
  return {
    organizationId: state.organizationId,
    defaults: {
      type: state.defaults.venueType,
      timezone: state.defaults.timezone,
      currency: state.defaults.currency,
      country: state.defaults.country,
      entityType: state.defaults.entityType || undefined,
    },
    defaultMerchantAccountId: state.merchantAccountId || undefined,
    defaultPricing: toDecimalRates(state.pricing),
    defaultSettlement: {
      debitDays: state.settlement.debitDays,
      creditDays: state.settlement.creditDays,
      amexDays: state.settlement.amexDays,
      internationalDays: state.settlement.internationalDays,
      otherDays: state.settlement.otherDays,
      dayType: state.settlement.dayType,
      cutoffTime: state.settlement.cutoffTime,
      cutoffTimezone: state.settlement.cutoffTimezone,
    },
    venues: state.venues.map(v => ({
      name: v.name,
      type: v.type || undefined,
      address: v.address || undefined,
      city: v.city || undefined,
      state: v.state || undefined,
      country: v.country || undefined,
      zipCode: v.zipCode || undefined,
      phone: v.phone || undefined,
      email: v.email || undefined,
      website: v.website || undefined,
      latitude: v.latitude,
      longitude: v.longitude,
      entityType: v.entityType || undefined,
      rfc: v.rfc || undefined,
      legalName: v.legalName || undefined,
      terminals: v.terminals
        .filter(t => t.serialNumber && t.name)
        .map(t => ({
          serialNumber: t.serialNumber,
          name: t.name,
          type: t.type || 'TPV_ANDROID',
          brand: t.brand || undefined,
          model: t.model || undefined,
        })),
      pricing: v.pricingOverride ? toDecimalRates(v.pricingOverride) : undefined,
      settlement: v.settlementOverride || undefined,
    })),
  }
}

const BulkOnboardingPage: React.FC = () => {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { state, dispatch, reset, hasDraft, loadSavedDraft, dismissDraft } = useBulkOnboardingState()
  const [results, setResults] = useState<BulkCreateVenuesResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [fullImportOpen, setFullImportOpen] = useState(false)

  const currentStep = results ? 4 : state.currentStep

  const setStep = useCallback(
    (step: number) => {
      dispatch({ type: 'SET_STEP', step })
    },
    [dispatch],
  )

  const canContinue = () => {
    switch (state.currentStep) {
      case 0:
        return !!state.organizationId
      case 1:
        return state.pricing.debitRate > 0 && state.pricing.creditRate > 0
      case 2:
        return state.venues.length > 0 && state.venues.every(v => v.name.trim())
      case 3:
        return true
      default:
        return false
    }
  }

  const handleSubmit = async () => {
    setConfirmOpen(false)
    setLoading(true)
    setError(null)
    try {
      const payload = buildPayload(state)
      const response = await superadminAPI.bulkCreateVenues(payload)
      setResults(response)
      clearDraft()
    } catch (err: any) {
      setError(err?.response?.data?.error || err?.response?.data?.message || err.message || 'Error al crear venues')
    } finally {
      setLoading(false)
    }
  }

  const handleNext = () => {
    if (state.currentStep === 3) {
      setConfirmOpen(true)
      return
    }
    setStep(Math.min(state.currentStep + 1, 3))
  }

  const handleBack = () => {
    if (results) {
      setResults(null)
      return
    }
    setStep(Math.max(state.currentStep - 1, 0))
  }

  const handleReset = () => {
    reset()
    setResults(null)
    setError(null)
  }

  // Get cached organizations for template import resolution
  const cachedOrgs = (queryClient.getQueryData<{ organizations: Array<{ id: string; slug: string; name: string }> }>(
    ['superadmin', 'organizations-list'],
  )?.organizations || [])

  const handleFullJsonImport = useCallback(
    (partial: Partial<BulkOnboardingState>, warnings: string[]) => {
      const fullState: BulkOnboardingState = {
        currentStep: 2, // Jump to Venues step
        organizationId: partial.organizationId || '',
        defaults: { ...INITIAL_DEFAULTS, ...partial.defaults },
        pricing: { ...INITIAL_PRICING, ...partial.pricing },
        merchantAccountId: '',
        settlement: { ...INITIAL_SETTLEMENT, ...partial.settlement },
        venues: partial.venues || [],
      }
      if (!fullState.organizationId) fullState.currentStep = 0
      else if (fullState.venues.length === 0) fullState.currentStep = 2
      dispatch({ type: 'LOAD_DRAFT', state: fullState })
    },
    [dispatch],
  )

  const handleFullCsvImport = useCallback(
    (venues: BulkVenueEntry[]) => {
      dispatch({ type: 'ADD_VENUES_BATCH', venues })
      dispatch({ type: 'SET_STEP', step: 2 })
    },
    [dispatch],
  )

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Draft Recovery Banner */}
      {hasDraft && !results && (
        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-500" />
            <span className="text-sm">Se encontró un borrador guardado. ¿Deseas continuar donde lo dejaste?</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={dismissDraft} className="cursor-pointer">
              <X className="w-3 h-3 mr-1" /> Descartar
            </Button>
            <Button size="sm" onClick={loadSavedDraft} className="cursor-pointer">
              Restaurar borrador
            </Button>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-500/5">
            <Boxes className="h-6 w-6 text-violet-600 dark:text-violet-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Carga Masiva de Venues</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Crea múltiples venues completamente configurados en un solo flujo
            </p>
          </div>
        </div>
        {!results && (
          <Button variant="outline" onClick={() => setFullImportOpen(true)} className="cursor-pointer">
            <Upload className="w-4 h-4 mr-2" /> Cargar plantilla
          </Button>
        )}
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
                    index < currentStep && 'bg-green-500 text-primary-foreground',
                    index === currentStep && 'bg-foreground text-background ring-4 ring-foreground/20',
                    index > currentStep && 'bg-muted text-muted-foreground',
                  )}
                >
                  {index < currentStep ? <Check className="w-4 h-4" /> : index + 1}
                </div>
                <span
                  className={cn(
                    'text-sm font-medium hidden lg:block',
                    index <= currentStep ? 'text-foreground' : 'text-muted-foreground',
                  )}
                >
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
        {currentStep === 0 && <Step1OrgDefaults state={state} dispatch={dispatch} />}
        {currentStep === 1 && <Step2Pricing state={state} dispatch={dispatch} />}
        {currentStep === 2 && <Step3Venues state={state} dispatch={dispatch} />}
        {currentStep === 3 && <Step4Review state={state} />}
        {currentStep === 4 && results && <Step5Results results={results} onReset={handleReset} />}
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-destructive">{error}</div>
      )}

      {/* Footer */}
      {!results && (
        <div className="flex items-center justify-between pt-4 border-t border-border">
          <Button
            variant="outline"
            onClick={state.currentStep === 0 ? () => navigate('/superadmin/venues') : handleBack}
            className="rounded-full cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            {state.currentStep === 0 ? 'Volver' : 'Atrás'}
          </Button>
          <div className="flex gap-2">
            <Button onClick={handleNext} disabled={!canContinue() || loading} className="rounded-full cursor-pointer">
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {state.currentStep === 3 ? `Crear ${state.venues.length} Venues` : 'Continuar'}
              {state.currentStep < 3 && <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
          </div>
        </div>
      )}

      {/* Confirmation Dialog */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar creación masiva</AlertDialogTitle>
            <AlertDialogDescription>
              Se crearán <span className="font-semibold text-foreground">{state.venues.length} venues</span> con{' '}
              {state.venues.reduce((sum, v) => sum + v.terminals.length, 0)} terminales. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full cursor-pointer">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleSubmit} className="rounded-full cursor-pointer">
              Crear Venues
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Full Template Import Dialog */}
      <FullTemplateImportDialog
        open={fullImportOpen}
        onOpenChange={setFullImportOpen}
        organizations={cachedOrgs}
        onImportJson={handleFullJsonImport}
        onImportCsv={handleFullCsvImport}
      />
    </div>
  )
}

export default BulkOnboardingPage
