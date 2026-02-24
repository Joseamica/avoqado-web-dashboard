import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react'
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  paymentProviderAPI,
  type MerchantAccount,
} from '@/services/paymentProvider.service'
import {
  setOrganizationPaymentConfig,
  setOrganizationPricing,
} from '@/services/superadmin-organizations.service'
import { bulkCreateSettlementConfigurations } from '@/services/settlementConfiguration.service'
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
  Save,
  Store,
} from 'lucide-react'

import { MerchantStep } from './wizard-steps/MerchantStep'
import { TerminalStep } from './wizard-steps/TerminalStep'
import { CostStructureStep } from './wizard-steps/CostStructureStep'
import { VenuePricingStep } from './wizard-steps/VenuePricingStep'
import { SettlementStep } from './wizard-steps/SettlementStep'
import { VenueOverridesStep } from './wizard-steps/VenueOverridesStep'
import { SummaryStep } from './wizard-steps/SummaryStep'

// ===== TYPES =====

export interface WizardContext {
  organizationId: string
  orgName: string
  orgType?: string
  initialVenueId?: string
  initialVenueName?: string
  initialVenueSlug?: string
}

export interface PaymentSetupWizardProps {
  open: boolean
  onClose: () => void
  context: WizardContext
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

export interface VenueOverride {
  venueId: string
  venueName: string
  venueSlug: string
  enabled: boolean
  pricing?: PricingData
  settlement?: SettlementData
  existingPricingId?: string
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
  venueOverrides: Record<string, VenueOverride>
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
  | { type: 'INIT_VENUE_OVERRIDES'; venues: Array<{ id: string; name: string; slug: string }> }
  | { type: 'TOGGLE_VENUE_OVERRIDE'; venueId: string }
  | { type: 'SET_VENUE_PRICING'; venueId: string; data: PricingData; existingPricingId?: string }
  | { type: 'SET_VENUE_SETTLEMENT'; venueId: string; data: SettlementData }
  | { type: 'SET_VENUE_EXISTING_PRICING_ID'; venueId: string; existingPricingId: string | null }
  | { type: 'RESET' }

const DEFAULT_SETTLEMENT: SettlementData = {
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
  debitDays: 1,
  creditDays: 1,
  amexDays: 3,
  internationalDays: 3,
  otherDays: 2,
}

export const DEFAULT_PRICING: PricingData = {
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
  venueOverrides: {},
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
    case 'INIT_VENUE_OVERRIDES': {
      const overrides: Record<string, VenueOverride> = {}
      for (const v of action.venues) {
        // Preserve existing override state if already initialized
        if (state.venueOverrides[v.id]) {
          overrides[v.id] = state.venueOverrides[v.id]
        } else {
          overrides[v.id] = {
            venueId: v.id,
            venueName: v.name,
            venueSlug: v.slug,
            enabled: false,
          }
        }
      }
      return { ...state, venueOverrides: overrides }
    }
    case 'TOGGLE_VENUE_OVERRIDE': {
      const existing = state.venueOverrides[action.venueId]
      if (!existing) return state
      return {
        ...state,
        venueOverrides: {
          ...state.venueOverrides,
          [action.venueId]: {
            ...existing,
            enabled: !existing.enabled,
            // When enabling, seed with org defaults
            ...(!existing.enabled
              ? {
                  pricing: existing.pricing || { ...DEFAULT_PRICING },
                  settlement: existing.settlement || { ...state.settlement },
                }
              : {}),
          },
        },
      }
    }
    case 'SET_VENUE_PRICING': {
      const existing = state.venueOverrides[action.venueId]
      if (!existing) return state
      return {
        ...state,
        venueOverrides: {
          ...state.venueOverrides,
          [action.venueId]: {
            ...existing,
            pricing: action.data,
            ...(action.existingPricingId ? { existingPricingId: action.existingPricingId } : {}),
          },
        },
      }
    }
    case 'SET_VENUE_SETTLEMENT': {
      const existing = state.venueOverrides[action.venueId]
      if (!existing) return state
      return {
        ...state,
        venueOverrides: {
          ...state.venueOverrides,
          [action.venueId]: { ...existing, settlement: action.data },
        },
      }
    }
    case 'SET_VENUE_EXISTING_PRICING_ID': {
      const existing = state.venueOverrides[action.venueId]
      if (!existing) return state
      const updated = { ...existing }
      if (action.existingPricingId === null) {
        delete updated.existingPricingId
      } else {
        updated.existingPricingId = action.existingPricingId
      }
      return {
        ...state,
        venueOverrides: {
          ...state.venueOverrides,
          [action.venueId]: updated,
        },
      }
    }
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
  { key: 'pricing', label: 'Pricing', icon: CreditCard, description: 'Tarifas org. default' },
  { key: 'settlement', label: 'Liquidación', icon: Calendar, description: 'Plazos de pago' },
  { key: 'venues', label: 'Sucursales', icon: Store, description: 'Tarifas por sucursal' },
  { key: 'summary', label: 'Resumen', icon: ClipboardCheck, description: 'Revisar y confirmar' },
]

// ===== MAIN COMPONENT =====

export const PaymentSetupWizard: React.FC<PaymentSetupWizardProps> = ({ open, onClose, context }) => {
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [state, dispatch] = useReducer(wizardReducer, initialState)
  const [saving, setSaving] = useState(false)

  // Fetch existing config for pre-fill
  const { data: existingSummary } = useQuery({
    queryKey: ['payment-setup-summary', 'organization', context.organizationId],
    queryFn: () => paymentProviderAPI.getPaymentSetupSummary('organization', context.organizationId),
    enabled: open,
  })

  // Fetch all merchant accounts for selection
  const { data: allMerchants = [] } = useQuery({
    queryKey: ['merchant-accounts-list-active'],
    queryFn: () => paymentProviderAPI.getMerchantAccountsList({ active: true }),
    enabled: open,
  })

  // Pre-fill wizard with existing data when reopening
  const prefilled = useRef(false)
  useEffect(() => {
    if (!open) {
      prefilled.current = false
      return
    }
    if (prefilled.current || !existingSummary?.config || allMerchants.length === 0) return
    prefilled.current = true

    const config = existingSummary.config

    // Pre-select merchants
    if (config.primaryAccountId) {
      const m = allMerchants.find(a => a.id === config.primaryAccountId)
      if (m) {
        dispatch({ type: 'SET_PRIMARY_MERCHANT', merchant: { mode: 'existing', merchantId: m.id, merchant: m as any } })
      }
    }
    if (config.secondaryAccountId) {
      const m = allMerchants.find(a => a.id === config.secondaryAccountId)
      if (m) {
        dispatch({ type: 'SET_SECONDARY_MERCHANT', merchant: { mode: 'existing', merchantId: m.id, merchant: m as any } })
      }
    }
    if (config.tertiaryAccountId) {
      const m = allMerchants.find(a => a.id === config.tertiaryAccountId)
      if (m) {
        dispatch({ type: 'SET_TERTIARY_MERCHANT', merchant: { mode: 'existing', merchantId: m.id, merchant: m as any } })
      }
    }

    // Pre-fill terminal assignments from existing data
    const terminals = existingSummary.terminals || []
    const terminalMap: Record<string, string[]> = {}
    for (const t of terminals) {
      const assignedIds = t.assignedMerchantIds || []
      for (const merchantId of assignedIds) {
        if (!terminalMap[merchantId]) terminalMap[merchantId] = []
        terminalMap[merchantId].push(t.id)
      }
    }
    for (const [merchantId, terminalIds] of Object.entries(terminalMap)) {
      dispatch({ type: 'SET_TERMINAL_ASSIGNMENTS', merchantId, terminalIds })
    }

    // Pre-fill cost structures from nested merchant data
    const round4 = (n: number) => Math.round(n * 10000) / 10000
    const accounts = [
      { account: config.primaryAccount, merchantIdKey: 'primaryAccountId' },
      { account: config.secondaryAccount, merchantIdKey: 'secondaryAccountId' },
      { account: config.tertiaryAccount, merchantIdKey: 'tertiaryAccountId' },
    ]
    for (const { account } of accounts) {
      if (!account?.costStructures?.length) continue
      const cs = account.costStructures[0] // Most recent active
      dispatch({
        type: 'SET_COST_STRUCTURE',
        merchantId: account.id,
        data: {
          mode: 'existing',
          existingId: cs.id,
          debitRate: round4(Number(cs.debitRate) * 100),
          creditRate: round4(Number(cs.creditRate) * 100),
          amexRate: round4(Number(cs.amexRate) * 100),
          internationalRate: round4(Number(cs.internationalRate) * 100),
          fixedCostPerTransaction: Number(cs.fixedCostPerTransaction || 0),
          monthlyFee: Number(cs.monthlyFee || 0),
        },
      })
    }

    // Pre-fill settlement from primary account's settlement configs
    const primaryAccount = config.primaryAccount
    if (primaryAccount?.settlementConfigs?.length > 0) {
      const configs = primaryAccount.settlementConfigs as Array<{
        cardType: string
        settlementDays: number
        settlementDayType: string
        cutoffTime: string
        cutoffTimezone?: string
      }>
      const find = (type: string) => configs.find(c => c.cardType === type)
      const debit = find('DEBIT')
      const credit = find('CREDIT')
      const amex = find('AMEX')
      const intl = find('INTERNATIONAL')
      const other = find('OTHER')
      if (debit) {
        dispatch({
          type: 'SET_SETTLEMENT',
          data: {
            dayType: (debit.settlementDayType as 'BUSINESS_DAYS' | 'CALENDAR_DAYS') || 'BUSINESS_DAYS',
            cutoffTime: debit.cutoffTime || '23:00',
            cutoffTimezone: debit.cutoffTimezone || 'America/Mexico_City',
            debitDays: debit.settlementDays,
            creditDays: credit?.settlementDays ?? 1,
            amexDays: amex?.settlementDays ?? 3,
            internationalDays: intl?.settlementDays ?? 3,
            otherDays: other?.settlementDays ?? 2,
          },
        })
      }
    }

    // Pre-fill pricing from existing org pricing structures
    const pricingStructures = existingSummary.pricingStructures || []
    for (const ps of pricingStructures) {
      const slot = ps.accountType as 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
      dispatch({
        type: 'SET_PRICING',
        slot,
        data: {
          debitRate: round4(Number(ps.debitRate) * 100),
          creditRate: round4(Number(ps.creditRate) * 100),
          amexRate: round4(Number(ps.amexRate) * 100),
          internationalRate: round4(Number(ps.internationalRate) * 100),
          fixedFeePerTransaction: Number(ps.fixedFeePerTransaction || 0),
          monthlyServiceFee: Number(ps.monthlyServiceFee || 0),
        },
      })
    }

    // Pre-fill venue overrides from existing venue pricing structures
    const summaryVenues = existingSummary.venues || []
    const venuePricingList = existingSummary.venuePricingStructures || []
    if (summaryVenues.length > 0) {
      // Group venue pricing by venueId (take most recent per venue)
      const venuePricingMap: Record<string, any> = {}
      for (const vps of venuePricingList) {
        // First one per venue is most recent (ordered by effectiveFrom desc)
        if (!venuePricingMap[vps.venueId]) {
          venuePricingMap[vps.venueId] = vps
        }
      }

      // Init all venues, enable those with existing pricing
      dispatch({
        type: 'INIT_VENUE_OVERRIDES',
        venues: summaryVenues.map((v: any) => ({ id: v.id, name: v.name, slug: v.slug })),
      })

      for (const [venueId, vps] of Object.entries(venuePricingMap)) {
        const venue = summaryVenues.find((v: any) => v.id === venueId)
        if (!venue) continue
        // Enable the override and set its pricing (with existing ID for upsert)
        dispatch({ type: 'TOGGLE_VENUE_OVERRIDE', venueId })
        dispatch({
          type: 'SET_VENUE_PRICING',
          venueId,
          data: {
            debitRate: round4(Number((vps as any).debitRate) * 100),
            creditRate: round4(Number((vps as any).creditRate) * 100),
            amexRate: round4(Number((vps as any).amexRate) * 100),
            internationalRate: round4(Number((vps as any).internationalRate) * 100),
            fixedFeePerTransaction: Number((vps as any).fixedFeePerTransaction || 0),
            monthlyServiceFee: Number((vps as any).monthlyServiceFee || 0),
          },
          existingPricingId: (vps as any).id,
        })
      }
    }
  }, [open, existingSummary, allMerchants])

  const handleClose = useCallback(() => {
    dispatch({ type: 'RESET' })
    onClose()
  }, [onClose])

  const isStepConfigured = (stepIndex: number): boolean => {
    switch (stepIndex) {
      case 0:
        return !!state.merchants.primary
      case 1:
        return Object.values(state.terminalAssignments).some(ids => ids.length > 0)
      case 2:
        return Object.keys(state.costStructures).length > 0
      case 3:
        return !!state.pricing.PRIMARY
      case 4:
        return state.settlement.debitDays > 0
      case 5: {
        const total = Object.keys(state.venueOverrides).length
        return total > 0
      }
      case 6:
        return false // Summary is never "configured"
      default:
        return false
    }
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
      case 5: {
        const enabledCount = Object.values(state.venueOverrides).filter(v => v.enabled).length
        const totalCount = Object.keys(state.venueOverrides).length
        if (totalCount === 0) return '—'
        return enabledCount > 0 ? `${enabledCount} personalizada${enabledCount > 1 ? 's' : ''}` : 'Todas usan org'
      }
      case 6:
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
        return true // Venue overrides are optional
      case 6:
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
        // 1. Batch assign terminals for ALL configured merchants + reconcile orphans
        const configuredMerchants = [
          state.merchants.primary,
          state.merchants.secondary,
          state.merchants.tertiary,
        ].filter(Boolean)
        const configuredMerchantIds = new Set(configuredMerchants.map(m => m!.merchantId))

        // Phase 1a: Assign terminals per merchant
        for (const merchant of configuredMerchants) {
          if (!merchant) continue
          const tIds = state.terminalAssignments[merchant.merchantId] || []
          if (tIds.length > 0) {
            await paymentProviderAPI.batchAssignTerminals(merchant.merchantId, tIds)
          }
        }

        // Phase 1b: Reconcile — remove orphaned merchant assignments from org terminals
        const orgTerminals = existingSummary?.terminals || []
        for (const terminal of orgTerminals) {
          const currentAssignments: string[] = terminal.assignedMerchantIds || []
          for (const merchantId of currentAssignments) {
            if (!configuredMerchantIds.has(merchantId)) {
              // Merchant is assigned to terminal but NOT in org config → remove
              await paymentProviderAPI.removeMerchantFromTerminal(merchantId, terminal.id)
            } else if (!(state.terminalAssignments[merchantId] || []).includes(terminal.id)) {
              // Merchant IS in config but terminal is NOT checked for it → remove
              await paymentProviderAPI.removeMerchantFromTerminal(merchantId, terminal.id)
            }
          }
        }

        // 2. Create/update OrganizationPaymentConfig
        await setOrganizationPaymentConfig(context.organizationId, {
          primaryAccountId: primary.merchantId,
          secondaryAccountId: state.merchants.secondary?.merchantId,
          tertiaryAccountId: state.merchants.tertiary?.merchantId,
        })

        // 3. Create/update cost structure if provided
        const costData = state.costStructures[primary.merchantId]
        if (costData) {
          if (costData.mode === 'existing' && costData.existingId) {
            // Update existing cost structure
            await paymentProviderAPI.updateProviderCostStructure(costData.existingId, {
              debitRate: costData.debitRate / 100,
              creditRate: costData.creditRate / 100,
              amexRate: costData.amexRate / 100,
              internationalRate: costData.internationalRate / 100,
              fixedCostPerTransaction: costData.fixedCostPerTransaction,
              monthlyFee: costData.monthlyFee,
            })
          } else {
            // Create new cost structure — capture ID for subsequent saves
            const createdCS = await paymentProviderAPI.createProviderCostStructure({
              merchantAccountId: primary.merchantId,
              debitRate: costData.debitRate / 100,
              creditRate: costData.creditRate / 100,
              amexRate: costData.amexRate / 100,
              internationalRate: costData.internationalRate / 100,
              fixedCostPerTransaction: costData.fixedCostPerTransaction,
              monthlyFee: costData.monthlyFee,
              effectiveFrom: new Date().toISOString(),
            })
            // Update state so a second save uses update instead of create
            dispatch({
              type: 'SET_COST_STRUCTURE',
              merchantId: primary.merchantId,
              data: { ...costData, mode: 'existing', existingId: createdCS.id },
            })
          }
        }

        // 4. Create org-level pricing structure
        const pricingData = state.pricing.PRIMARY
        if (pricingData) {
          await setOrganizationPricing(context.organizationId, {
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

        // 6. Handle venue-level pricing overrides
        // NOTE: VenuePaymentConfig is NOT created — venues inherit merchant accounts from org.
        // Only VenuePricingStructure is created when a venue has different rates than the org.
        const allOverrides = Object.values(state.venueOverrides)

        for (const override of allOverrides) {
          if (!override.enabled) {
            // Toggle OFF: if venue had an existing override, deactivate it (return to inheritance)
            if (override.existingPricingId) {
              await paymentProviderAPI.deactivateVenuePricingStructure(override.existingPricingId)
              // Clear stale ID so re-saving won't try to update a deactivated record
              dispatch({ type: 'SET_VENUE_EXISTING_PRICING_ID', venueId: override.venueId, existingPricingId: null })
            }
            continue
          }

          // Toggle ON: check if pricing actually differs from org
          if (!override.pricing) continue

          const orgP = pricingData
          const vP = override.pricing
          const isIdentical = orgP &&
            vP.debitRate === orgP.debitRate &&
            vP.creditRate === orgP.creditRate &&
            vP.amexRate === orgP.amexRate &&
            vP.internationalRate === orgP.internationalRate &&
            (vP.fixedFeePerTransaction || 0) === (orgP.fixedFeePerTransaction || 0) &&
            (vP.monthlyServiceFee || 0) === (orgP.monthlyServiceFee || 0)

          if (isIdentical && override.existingPricingId) {
            // Same as org — deactivate existing override (cleanup)
            await paymentProviderAPI.deactivateVenuePricingStructure(override.existingPricingId)
            // Clear stale ID so re-saving won't try to update a deactivated record
            dispatch({ type: 'SET_VENUE_EXISTING_PRICING_ID', venueId: override.venueId, existingPricingId: null })
          } else if (!isIdentical) {
            if (override.existingPricingId) {
              await paymentProviderAPI.updateVenuePricingStructure(override.existingPricingId, {
                debitRate: vP.debitRate / 100,
                creditRate: vP.creditRate / 100,
                amexRate: vP.amexRate / 100,
                internationalRate: vP.internationalRate / 100,
                fixedFeePerTransaction: vP.fixedFeePerTransaction,
                monthlyServiceFee: vP.monthlyServiceFee,
              })
            } else {
              // Create new — capture the returned ID for subsequent saves
              const created = await paymentProviderAPI.createVenuePricingStructure({
                venueId: override.venueId,
                accountType: 'PRIMARY',
                debitRate: vP.debitRate / 100,
                creditRate: vP.creditRate / 100,
                amexRate: vP.amexRate / 100,
                internationalRate: vP.internationalRate / 100,
                fixedFeePerTransaction: vP.fixedFeePerTransaction,
                monthlyServiceFee: vP.monthlyServiceFee,
                effectiveFrom: new Date().toISOString(),
              })
              // Store the new ID so a second save uses update instead of create
              dispatch({ type: 'SET_VENUE_EXISTING_PRICING_ID', venueId: override.venueId, existingPricingId: created.id })
            }
          }
        }
      }

      toast({
        title: 'Configuración guardada',
        description: `Configuración de organización guardada. ${Object.values(state.venueOverrides).filter(v => v.enabled).length} sucursal(es) con tarifa personalizada.`,
      })

      // Invalidate queries
      queryClient.invalidateQueries({ queryKey: ['payment-setup-summary'] })
      queryClient.invalidateQueries({ queryKey: ['venue-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['merchant-accounts'] })
      queryClient.invalidateQueries({ queryKey: ['settlement-configs'] })
      queryClient.invalidateQueries({ queryKey: ['superadmin-organizations'] })
      queryClient.invalidateQueries({ queryKey: ['org-payment-config'] })
      queryClient.invalidateQueries({ queryKey: ['cost-structures'] })
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
            context={context}
            onMerchantsRefresh={() => queryClient.invalidateQueries({ queryKey: ['merchant-accounts-list-active'] })}
          />
        )
      case 1:
        return (
          <TerminalStep
            state={state}
            dispatch={dispatch}
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
          <VenueOverridesStep
            state={state}
            dispatch={dispatch}
            context={context}
          />
        )
      case 6:
        return (
          <SummaryStep
            state={state}
            context={context}
          />
        )
      default:
        return null
    }
  }

  const lastStepIndex = STEPS.length - 1

  return (
    <FullScreenModal
      open={open}
      onClose={handleClose}
      title={`Configuración de Pagos — ${context.orgName}`}
      contentClassName="bg-muted/30"
    >
      <div className="flex h-full">
        {/* Left Sidebar */}
        <aside className="w-60 shrink-0 border-r border-border/30 bg-card/50 p-4 overflow-y-auto">
          <nav className="space-y-1">
            {STEPS.map((step, index) => {
              const isCurrent = index === state.currentStep
              const configured = isStepConfigured(index)
              const Icon = step.icon
              const summary = getStepSummary(index)

              return (
                <button
                  key={step.key}
                  onClick={() => dispatch({ type: 'SET_STEP', step: index })}
                  className={cn(
                    'w-full flex items-start gap-3 px-3 py-3 rounded-xl text-left transition-all',
                    isCurrent && 'bg-primary/10 border-l-2 border-primary',
                    !isCurrent && configured && 'text-foreground hover:bg-muted/50',
                    !isCurrent && !configured && 'text-muted-foreground hover:bg-muted/30',
                  )}
                >
                  <div
                    className={cn(
                      'shrink-0 w-8 h-8 rounded-lg flex items-center justify-center',
                      configured && 'bg-green-500/10 text-green-600',
                      !configured && isCurrent && 'bg-primary text-primary-foreground',
                      !configured && !isCurrent && 'bg-muted text-muted-foreground',
                    )}
                  >
                    {configured ? (
                      <CheckCircle2 className="w-4 h-4" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <p
                      className={cn(
                        'text-sm font-medium truncate',
                        isCurrent && 'text-primary',
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

              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  onClick={handleSave}
                  disabled={saving || !state.merchants.primary}
                >
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Guardando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Guardar
                    </>
                  )}
                </Button>

                {state.currentStep < lastStepIndex && (
                  <Button onClick={handleNext} disabled={!canProceed()}>
                    Siguiente
                    <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </FullScreenModal>
  )
}
