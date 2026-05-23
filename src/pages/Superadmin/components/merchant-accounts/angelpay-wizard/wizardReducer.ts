/**
 * AngelPay wizard state — single source of truth (useReducer).
 *
 * Strict acyclic dependency: data flows downward only. Changing the venue
 * resets every downstream step (RESET_DOWNSTREAM, folded into SET_VENUE).
 * Changing the slot to `replace` mode forces the pricing step to be required
 * (pricing keyed by venueId+accountType — a replaced merchant must not inherit
 * the displaced merchant's pricing) without discarding already-typed rates.
 *
 * See specs/2026-05-21-angelpay-merchant-wizard-design.md §6.
 */

export interface AngelPayVenue {
  id: string
  name: string
  slug: string
}

export type AngelPayLogin =
  | { mode: 'existing'; angelpayUserAccountId: string }
  | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }

export interface AngelPayMerchant {
  /** 'create' = capture a new merchant; 'existing' = reuse one already linked to the login. */
  mode: 'create' | 'existing'
  // create-mode fields
  externalMerchantId: string
  name: string
  affiliation: string
  displayName: string
  /** The operator must explicitly confirm the merchant id before advancing (create mode). */
  idConfirmed: boolean
  // existing-mode fields
  existingMerchantId?: string
  existingMerchantLabel?: string
}

export type AngelPayAccountType = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

export interface AngelPaySlot {
  accountType: AngelPayAccountType
  mode: 'fill' | 'replace'
  /** Set only in `replace` mode — the account currently in the slot. */
  replacedAccountId?: string
  /** When the merchant is being MOVED from a slot it already occupies. */
  fromSlot?: AngelPayAccountType
  /** What happens to `fromSlot`: 'swap' (gets the new slot's displaced account) or 'vacate' (emptied). */
  moveStrategy?: 'swap' | 'vacate'
}

export interface AngelPayTerminals {
  skipped: boolean
  terminalIds: string[]
}

/** Rate fields are `number | undefined` — clearable number inputs (project rule). */
export interface AngelPayCost {
  skipped: boolean
  /** Aggregator chosen to prefill the rates (and linked to the merchant). */
  aggregatorId?: string
  debitRate?: number
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string
}

export interface AngelPayPricing {
  skipped: boolean
  debitRate?: number
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string
}

export interface AngelPaySettlement {
  skipped: boolean
  /**
   * Días de liquidación por tipo de tarjeta. El schema de Prisma soporta una
   * `SettlementConfiguration` distinta por `(merchantAccountId, cardType,
   * effectiveFrom)`, así que cada tipo puede liquidar a un T+N distinto.
   * Caso común: débito/crédito T+1, AMEX y Internacional T+3.
   * El backend cae al `settlementDays` legacy si estos están todos undefined,
   * para mantener compatibilidad con el endpoint v1.
   */
  settlementDaysDebit?: number
  settlementDaysCredit?: number
  settlementDaysAmex?: number
  settlementDaysInternational?: number
  settlementDayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string
  cutoffTimezone: string
  effectiveFrom: string
}

/**
 * Revenue-share split between Avoqado, an aggregator (optional), and the
 * underlying processor margin. Captured at wizard time and persisted as a
 * `MerchantRevenueShare` row AFTER the main fullSetup transaction completes
 * (additive — failure here doesn't roll back the merchant). When `skipped`
 * is true, NO row is created and the merchant falls back to the legacy
 * 100%-to-Avoqado behavior, identical to today.
 *
 * Rates are decimals (0.04 = 4%) to match how `MerchantRevenueShare.aggregatorPrice`
 * is stored. The UI converts user-typed percentages via `percentToDecimal`.
 */
export interface AngelPayRevenueShare {
  skipped: boolean
  /** When true, also capture `aggregatorPrice` + `avoqadoShareOfAggregatorMargin`. */
  useAggregator: boolean
  /** Per-card rates the aggregator charges Avoqado (decimal). */
  aggregatorDebitRate?: number
  aggregatorCreditRate?: number
  aggregatorAmexRate?: number
  aggregatorInternationalRate?: number
  /** If true, `aggregatorPrice` is treated as IVA-inclusive (else +IVA). */
  aggregatorPriceIncludesTax: boolean
  /** Share of (provider→aggregator) margin that goes to Avoqado. 0..1. */
  avoqadoShareOfProviderMargin: number
  /** Share of (aggregator→venue) margin that goes to Avoqado. 0..1. Only used when useAggregator. */
  avoqadoShareOfAggregatorMargin?: number
  taxRate: number
}

export interface AngelPayWizardState {
  idempotencyKey: string
  venue: AngelPayVenue | null
  login: AngelPayLogin
  merchant: AngelPayMerchant
  slot: AngelPaySlot
  terminals: AngelPayTerminals
  cost: AngelPayCost
  pricing: AngelPayPricing
  settlement: AngelPaySettlement
  revenueShare: AngelPayRevenueShare
}

const freshLogin = (): AngelPayLogin => ({ mode: 'new', email: '', pin: '', environment: 'QA' })
const freshMerchant = (): AngelPayMerchant => ({
  mode: 'create',
  externalMerchantId: '',
  name: '',
  affiliation: '',
  displayName: '',
  idConfirmed: false,
})
const freshSlot = (): AngelPaySlot => ({ accountType: 'PRIMARY', mode: 'fill' })
const freshTerminals = (): AngelPayTerminals => ({ skipped: false, terminalIds: [] })
const freshCost = (): AngelPayCost => ({ skipped: false, includesTax: true, taxRate: 0.16, effectiveFrom: '' })
const freshPricing = (): AngelPayPricing => ({ skipped: false, includesTax: true, taxRate: 0.16, effectiveFrom: '' })
const freshSettlement = (): AngelPaySettlement => ({
  skipped: false,
  settlementDayType: 'BUSINESS_DAYS',
  cutoffTime: '',
  cutoffTimezone: '',
  effectiveFrom: '',
})
// Default: SKIPPED. Operators opt in per merchant. When opted-in the defaults
// match the most common arrangement we discussed with the user: 50/50 direct
// split, IVA 16%, no aggregator.
const freshRevenueShare = (): AngelPayRevenueShare => ({
  skipped: true,
  useAggregator: false,
  aggregatorPriceIncludesTax: true,
  avoqadoShareOfProviderMargin: 0.5,
  taxRate: 0.16,
})

/** Build a fresh wizard state. Generates a new idempotencyKey each call. */
export function initialState(): AngelPayWizardState {
  return {
    idempotencyKey: crypto.randomUUID(),
    venue: null,
    login: freshLogin(),
    merchant: freshMerchant(),
    slot: freshSlot(),
    terminals: freshTerminals(),
    cost: freshCost(),
    pricing: freshPricing(),
    settlement: freshSettlement(),
    revenueShare: freshRevenueShare(),
  }
}

export type AngelPayWizardAction =
  | { type: 'SET_VENUE'; venue: AngelPayVenue }
  | { type: 'SET_LOGIN'; login: AngelPayLogin }
  | { type: 'SET_MERCHANT'; merchant: AngelPayMerchant }
  | { type: 'SET_SLOT'; slot: AngelPaySlot }
  | { type: 'SET_TERMINALS'; terminals: AngelPayTerminals }
  | { type: 'SET_COST'; cost: AngelPayCost }
  | { type: 'SET_PRICING'; pricing: AngelPayPricing }
  | { type: 'SET_SETTLEMENT'; settlement: AngelPaySettlement }
  | { type: 'SET_REVENUE_SHARE'; revenueShare: AngelPayRevenueShare }
  | { type: 'RESET' }

export function wizardReducer(state: AngelPayWizardState, action: AngelPayWizardAction): AngelPayWizardState {
  switch (action.type) {
    case 'SET_VENUE': {
      // Same venue re-selected — keep downstream state untouched.
      if (state.venue?.id === action.venue.id) {
        return { ...state, venue: action.venue }
      }
      // Venue changed — reset every downstream step (acyclic: only the venue
      // is foundational). idempotencyKey is preserved for the wizard session.
      return {
        ...state,
        venue: action.venue,
        login: freshLogin(),
        merchant: freshMerchant(),
        slot: freshSlot(),
        terminals: freshTerminals(),
        cost: freshCost(),
        pricing: freshPricing(),
        settlement: freshSettlement(),
        revenueShare: freshRevenueShare(),
      }
    }
    case 'SET_LOGIN':
      // Login is upstream of merchant — changing it invalidates any merchant
      // selection (a picked existing merchant belongs to the previous login).
      return { ...state, login: action.login, merchant: freshMerchant() }
    case 'SET_MERCHANT':
      return { ...state, merchant: action.merchant }
    case 'SET_SLOT': {
      // Replace mode makes pricing required: force `skipped` false but keep any
      // rates the operator already typed (non-destructive downstream update).
      const pricing =
        action.slot.mode === 'replace' ? { ...state.pricing, skipped: false } : state.pricing
      return { ...state, slot: action.slot, pricing }
    }
    case 'SET_TERMINALS':
      return { ...state, terminals: action.terminals }
    case 'SET_COST':
      return { ...state, cost: action.cost }
    case 'SET_PRICING':
      return { ...state, pricing: action.pricing }
    case 'SET_SETTLEMENT':
      return { ...state, settlement: action.settlement }
    case 'SET_REVENUE_SHARE':
      return { ...state, revenueShare: action.revenueShare }
    case 'RESET':
      return initialState()
    default:
      return state
  }
}

/** True when the pricing step cannot be skipped (slot is in replace mode). */
export const isPricingRequired = (state: AngelPayWizardState): boolean => state.slot.mode === 'replace'
