import React, { useCallback, useReducer, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  paymentProviderAPI,
  type FullSetupRequest,
  type MerchantAccount,
  type PaymentSetupSummary,
} from '@/services/paymentProvider.service'
import {
  Building2,
  CheckCircle2,
  CreditCard,
  DollarSign,
  Calendar,
  ClipboardCheck,
  Smartphone,
  Loader2,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react'

import { MerchantStep } from './wizard-steps/MerchantStep'
import { TerminalStep } from './wizard-steps/TerminalStep'
import { CostStructureStep } from './wizard-steps/CostStructureStep'
import { VenuePricingStep } from './wizard-steps/VenuePricingStep'
import { SettlementStep } from './wizard-steps/SettlementStep'
import { SummaryStep } from './wizard-steps/SummaryStep'

// ===== TYPES =====

export interface PaymentSetupWizardProps {
  open: boolean
  onClose: () => void
  target:
    | { type: 'venue'; venueId: string; venueName: string; venueSlug: string }
    | { type: 'organization'; organizationId: string; orgName: string }
}

export interface MerchantSelection {
  mode: 'existing'
  merchantId: string
  merchant: MerchantAccount
}

export interface NewMerchantData {
  provider: string
  serialNumber: string
  brand: string
  model: string
  displayName: string
  environment: 'SANDBOX' | 'PRODUCTION'
  businessCategory: string
}

export interface CostStructureData {
  mode: 'existing' | 'new'
  existingId?: string
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedCostPerTransaction: number
  monthlyFee: number
}

export interface PricingData {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction: number
  monthlyServiceFee: number
}

export interface SettlementData {
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string
  cutoffTimezone: string
  debitDays: number
  creditDays: number
  amexDays: number
  internationalDays: number
  otherDays: number
}

export interface WizardState {
  currentStep: number
  merchants: {
    primary: MerchantSelection | null
    secondary: MerchantSelection | null
    tertiary: MerchantSelection | null
  }
  newMerchant: NewMerchantData | null
  terminalAssignments: Record<string, string[]>
  costStructures: Record<string, CostStructureData>
  pricing: {
    PRIMARY?: PricingData
    SECONDARY?: PricingData
    TERTIARY?: PricingData
  }
  settlement: SettlementData
}

type WizardAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_PRIMARY_MERCHANT'; merchant: MerchantSelection | null }
  | { type: 'SET_SECONDARY_MERCHANT'; merchant: MerchantSelection | null }
  | { type: 'SET_TERTIARY_MERCHANT'; merchant: MerchantSelection | null }
  | { type: 'SET_NEW_MERCHANT'; data: NewMerchantData | null }
  | { type: 'SET_TERMINAL_ASSIGNMENTS'; merchantId: string; terminalIds: string[] }
  | { type: 'SET_COST_STRUCTURE'; merchantId: string; data: CostStructureData }
  | { type: 'SET_PRICING'; slot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'; data: PricingData }
  | { type: 'SET_SETTLEMENT'; data: SettlementData }
  | { type: 'RESET' }

const DEFAULT_SETTLEMENT: SettlementData = {
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
  debitDays: 1,
  creditDays: 2,
  amexDays: 3,
  internationalDays: 3,
  otherDays: 2,
}

const DEFAULT_PRICING: PricingData = {
  debitRate: 2.2,
  creditRate: 2.5,
  amexRate: 3.5,
  internationalRate: 3.8,
  fixedFeePerTransaction: 0,
  monthlyServiceFee: 0,
}

const initialState: WizardState = {
  currentStep: 0,
  merchants: { primary: null, secondary: null, tertiary: null },
  newMerchant: null,
  terminalAssignments: {},
  costStructures: {},
  pricing: { PRIMARY: { ...DEFAULT_PRICING } },
  settlement: { ...DEFAULT_SETTLEMENT },
}

function wizardReducer(state: WizardState, action: WizardAction): WizardState {
  switch (action.type) {
    case 'SET_STEP':
      return { ...state, currentStep: action.step }
    case 'SET_PRIMARY_MERCHANT':
      return { ...state, merchants: { ...state.merchants, primary: action.merchant } }
    case 'SET_SECONDARY_MERCHANT':
      return { ...state, merchants: { ...state.merchants, secondary: action.merchant } }
    case 'SET_TERTIARY_MERCHANT':
      return { ...state, merchants: { ...state.merchants, tertiary: action.merchant } }
    case 'SET_NEW_MERCHANT':
      return { ...state, newMerchant: action.data }
    case 'SET_TERMINAL_ASSIGNMENTS':
      return {
        ...state,
        terminalAssignments: { ...state.terminalAssignments, [action.merchantId]: action.terminalIds },
      }
    case 'SET_COST_STRUCTURE':
      return {
        ...state,
        costStructures: { ...state.costStructures, [action.merchantId]: action.data },
      }
    case 'SET_PRICING':
      return { ...state, pricing: { ...state.pricing, [action.slot]: action.data } }
    case 'SET_SETTLEMENT':
      return { ...state, settlement: action.data }
    case 'RESET':
      return { ...initialState }
    default:
      return state
  }
}

// ===== STEP DEFINITIONS =====

const STEPS = [
  { key: 'merchants', label: 'Cuentas', icon: Building2, description: 'Cuentas de cobro' },
  { key: 'terminals', label: 'Terminales', icon: Smartphone, description: 'Asignar terminales' },
  { key: 'costs', label: 'Costos', icon: DollarSign, description: 'Costos del proveedor' },
  { key: 'pricing', label: 'Pricing', icon: CreditCard, description: 'Tarifas al venue' },
  { key: 'settlement', label: 'Liquidación', icon: Calendar, description: 'Plazos de pago' },
  { key: 'summary', label: 'Resumen', icon: ClipboardCheck, description: 'Revisar y confirmar' },
]

// ===== MAIN COMPONENT =====

export const PaymentSetupWizard: React.FC<PaymentSetupWizardProps> = ({ open, onClose, target }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const [saving, setSaving] = useState(false)

  const targetName = target.type === 'venue' ? target.venueName : target.orgName
  const targetId = target.type === 'venue' ? target.venueId : target.organizationId

  // Fetch existing config for pre-fill
  const { data: existingSummary } = useQuery({
    queryKey: ['payment-setup-summary', target.type, targetId],
    queryFn: () => paymentProviderAPI.getPaymentSetupSummary(target.type, targetId),
    enabled: open,
  })

  // Fetch all merchant accounts for selection
  const { data: allMerchants = [] } = useQuery({
    queryKey: ['merchant-accounts-list-active'],
    queryFn: () => paymentProviderAPI.getMerchantAccountsList({ active: true }),
    enabled: open,
  })

  const handleClose = useCallback(() => {
    dispatch({ type: 'RESET' })
    onClose()
  }, [onClose])

  const getStepStatus = (stepIndex: number): 'completed' | 'current' | 'pending' => {
    if (stepIndex < state.currentStep) return 'completed'
    if (stepIndex === state.currentStep) return 'current'
    return 'pending'
  }

  const getStepSummary = (stepIndex: number): string => {
    switch (stepIndex) {
      case 0: {
        const count = [state.merchants.primary, state.merchants.secondary, state.merchants.tertiary].filter(Boolean).length
        return count > 0 ? `${count} cuenta${count > 1 ? 's' : ''}` : '—'
      }
      case 1: {
        const total = Object.values(state.terminalAssignments).reduce((sum, ids) => sum + ids.length, 0)
        return total > 0 ? `${total} terminal${total > 1 ? 'es' : ''}` : '—'
      }
      case 2: {
        const count = Object.keys(state.costStructures).length
        return count > 0 ? `${count} estructura${count > 1 ? 's' : ''}` : '—'
      }
      case 3: {
        const p = state.pricing.PRIMARY
        if (p) {
          const avgMargin = ((p.debitRate + p.creditRate) / 2).toFixed(1)
          return `~${avgMargin}%`
        }
        return '—'
      }
      case 4:
        return state.settlement.debitDays > 0 ? `${state.settlement.debitDays}-${state.settlement.amexDays} días` : '—'
      case 5:
        return ''
      default:
        return '—'
    }
  }

  const canProceed = (): boolean => {
    switch (state.currentStep) {
      case 0:
        return !!state.merchants.primary
      case 1:
        return true // Terminals are optional
      case 2:
        return true // Cost structures are optional (can auto-create)
      case 3:
        return true // Pricing is optional
      case 4:
        return true // Settlement has defaults
      case 5:
        return !!state.merchants.primary
      default:
        return false
    }
  }

  const handleNext = () => {
    if (state.currentStep < STEPS.length - 1) {
      dispatch({ type: 'SET_STEP', step: state.currentStep + 1 })
    }
  }

  const handlePrev = () => {
    if (state.currentStep > 0) {
      dispatch({ type: 'SET_STEP', step: state.currentStep - 1 })
    }
  }

  const handleSave = async () => {
    if (!state.merchants.primary) return

    setSaving(true)
    try {
      const primary = state.merchants.primary

      if (primary.mode === 'existing') {
        // For existing merchant, use individual API calls
        // 1. Batch assign terminals
        const terminalIds = state.terminalAssignments[primary.merchantId] || []
        if (terminalIds.length > 0) {
          await paymentProviderAPI.batchAssignTerminals(primary.merchantId, terminalIds)
        }

        // 2. Create/update VenuePaymentConfig
        const configTarget = target.type === 'venue' ? { venueId: target.venueId } : {}
        if (target.type === 'venue') {
          try {
            await paymentProviderAPI.createVenuePaymentConfig({
              venueId: target.venueId,
              primaryAccountId: primary.merchantId,
              secondaryAccountId: state.merchants.secondary?.merchantId,
              tertiaryAccountId: state.merchants.tertiary?.merchantId,
            })
          } catch {
            // May already exist, try update
            await paymentProviderAPI.updateVenuePaymentConfig(target.venueId, {
              primaryAccountId: primary.merchantId,
              secondaryAccountId: state.merchants.secondary?.merchantId,
              tertiaryAccountId: state.merchants.tertiary?.merchantId,
            })
          }
        }

        // 3. Create cost structure if provided
        const costData = state.costStructures[primary.merchantId]
        if (costData && costData.mode === 'new') {
          await paymentProviderAPI.createProviderCostStructure({
            merchantAccountId: primary.merchantId,
            debitRate: costData.debitRate / 100,
            creditRate: costData.creditRate / 100,
            amexRate: costData.amexRate / 100,
            internationalRate: costData.internationalRate / 100,
            fixedCostPerTransaction: costData.fixedCostPerTransaction,
            monthlyFee: costData.monthlyFee,
            effectiveFrom: new Date().toISOString(),
          })
        }

        // 4. Create pricing structure
        const pricingData = state.pricing.PRIMARY
        if (pricingData && target.type === 'venue') {
          await paymentProviderAPI.createVenuePricingStructure({
            venueId: target.venueId,
            accountType: 'PRIMARY',
            debitRate: pricingData.debitRate / 100,
            creditRate: pricingData.creditRate / 100,
            amexRate: pricingData.amexRate / 100,
            internationalRate: pricingData.internationalRate / 100,
            fixedFeePerTransaction: pricingData.fixedFeePerTransaction,
            monthlyServiceFee: pricingData.monthlyServiceFee,
            effectiveFrom: new Date().toISOString(),
          })
        }

        // 5. Create settlement configs
        const { bulkCreateSettlementConfigurations } = await import('@/services/settlementConfiguration.service')
        await bulkCreateSettlementConfigurations({
          merchantAccountId: primary.merchantId,
          configs: [
            { cardType: 'DEBIT', settlementDays: state.settlement.debitDays, settlementDayType: state.settlement.dayType, cutoffTime: state.settlement.cutoffTime, cutoffTimezone: state.settlement.cutoffTimezone },
            { cardType: 'CREDIT', settlementDays: state.settlement.creditDays, settlementDayType: state.settlement.dayType, cutoffTime: state.settlement.cutoffTime, cutoffTimezone: state.settlement.cutoffTimezone },
            { cardType: 'AMEX', settlementDays: state.settlement.amexDays, settlementDayType: state.settlement.dayType, cutoffTime: state.settlement.cutoffTime, cutoffTimezone: state.settlement.cutoffTimezone },
            { cardType: 'INTERNATIONAL', settlementDays: state.settlement.internationalDays, settlementDayType: state.settlement.dayType, cutoffTime: state.settlement.cutoffTime, cutoffTimezone: state.settlement.cutoffTimezone },
            { cardType: 'OTHER', settlementDays: state.settlement.otherDays, settlementDayType: state.settlement.dayType, cutoffTime: state.settlement.cutoffTime, cutoffTimezone: state.settlement.cutoffTimezone },
          ],
          effectiveFrom: new Date().toISOString(),
        })
      }

      toast({
        title: 'Configuración guardada',
        description: 'La configuración de pagos se guardó exitosamente',
      })

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['payment-setup-summary'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['settlement-configs'] })

      handleClose()
    } catch (error: any) {
      console.error('Save error:', error)
      toast({
        variant: 'destructive',
        title: 'Error al guardar',
        description: error.response?.data?.message || error.message || 'Error desconocido',
      })
    } finally {
      setSaving(false)
    }
  }

  const renderStepContent = () => {
    switch (state.currentStep) {
      case 0:
        return (
          <MerchantStep
            state={state}
            dispatch={dispatch}
            allMerchants={allMerchants}
            existingSummary={existingSummary ?? null}
          />
        )
      case 1:
        return (
          <TerminalStep
            state={state}
            dispatch={dispatch}
            target={target}
          />
        )
      case 2:
        return (
          <CostStructureStep
            state={state}
            dispatch={dispatch}
          />
        )
      case 3:
        return (
          <VenuePricingStep
            state={state}
            dispatch={dispatch}
          />
        )
      case 4:
        return (
          <SettlementStep
            state={state}
            dispatch={dispatch}
          />
        )
      case 5:
        return (
          <SummaryStep
            state={state}
            target={target}
          />
        )
      default:
        return null
    }
  }

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={`Configuración de Pagos — ${targetName}`}
      contentClassName="bg-muted/30"
      actions={
        state.currentStep === 5 ? (
          <Button onClick={handleSave} disabled={saving || !canProceed()}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Guardando...
              </>
            ) : (
              'Guardar Configuración'
            )}
          </Button>
        ) : undefined
      }
    >
      <div className="flex h-full">
        {/* Left Sidebar */}
        <aside className="w-60 flex-shrink-0 border-r border-border/30 bg-card/50 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {STEPS.map((step, index) => {
              const status = getStepStatus(index)
              const Icon = step.icon
              const summary = getStepSummary(index)

              return (
                <button
                  key={step.key}
                  onClick={() => dispatch({ type: 'SET_STEP', step: index })}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all',
                    status === 'current' && 'bg-primary/10 border-l-2 border-primary',
                    status === 'completed' && 'text-foreground hover:bg-muted/50',
                    status === 'pending' && 'text-muted-foreground hover:bg-muted/30',
                  )}
                >
                  <div
                    className={cn(
                      'flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      status === 'current' && 'bg-primary text-primary-foreground',
                      status === 'completed' && 'bg-green-500/10 text-green-600',
                      status === 'pending' && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        status === 'current' && 'text-primary',
                      )}
                    >
                      {step.label}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {summary || step.description}
                    </p>
                  </div>
                </button>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 overflow-y-auto">
            <div className="max-w-3xl mx-auto px-6 py-8">
              {renderStepContent()}
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="sticky bottom-0 border-t border-border/30 bg-card/80 backdrop-blur-sm px-6 py-4">
            <div className="max-w-3xl mx-auto flex items-center justify-between">
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={state.currentStep === 0}
              >
                <ChevronLeft className="mr-2 h-4 w-4" />
                Anterior
              </Button>

              <span className="text-sm text-muted-foreground">
                Paso {state.currentStep + 1} de {STEPS.length}
              </span>

              {state.currentStep < STEPS.length - 1 ? (
                <Button onClick={handleNext} disabled={!canProceed()}>
                  Siguiente
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSave} disabled={saving || !canProceed()}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    'Guardar Configuración'
                  )}
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}
