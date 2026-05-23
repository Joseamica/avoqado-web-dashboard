import type {
  SetupState,
  VenueSlice,
  LoginSlice,
  MerchantSlice,
  SlotSlice,
  CostSlice,
  PricingSlice,
  SettlementSlice,
  RevenueShareSlice,
  TerminalsSlice,
  RequiredCardKey,
} from './types'
import { DRAFT_SCHEMA_VERSION, REQUIRED_CARDS } from './types'

const freshVenue = (): VenueSlice => ({ id: null, name: null, slug: null })
const freshLogin = (): LoginSlice => ({ mode: 'empty' })
const freshMerchant = (): MerchantSlice => ({
  mode: 'empty',
  externalMerchantId: '',
  name: '',
  affiliation: '',
  displayName: '',
  idConfirmed: false,
})
const freshSlot = (): SlotSlice => ({ accountType: 'PRIMARY', mode: 'empty' })
const freshCost = (): CostSlice => ({
  skipped: false,
  includesTax: true,
  taxRate: 0.16,
  effectiveFrom: '',
})
const freshPricing = (): PricingSlice => ({
  skipped: false,
  includesTax: true,
  taxRate: 0.16,
  effectiveFrom: '',
})
const freshSettlement = (): SettlementSlice => ({
  skipped: false,
  daysDebit: 1,
  daysCredit: 1,
  daysAmex: 3,
  daysInternational: 3,
  dayType: 'BUSINESS_DAYS',
  cutoffTime: '23:00',
  cutoffTimezone: 'America/Mexico_City',
  effectiveFrom: '',
})
const freshRevenueShare = (): RevenueShareSlice => ({
  skipped: true,
  useAggregator: false,
  aggregatorPriceIncludesTax: true,
  avoqadoShareOfProviderMargin: 0.5,
  taxRate: 0.16,
})
const freshTerminals = (): TerminalsSlice => ({ skipped: false, terminalIds: [] })

export function initialState(): SetupState {
  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    idempotencyKey: crypto.randomUUID(),
    venue: freshVenue(),
    login: freshLogin(),
    merchant: freshMerchant(),
    slot: freshSlot(),
    cost: freshCost(),
    pricing: freshPricing(),
    settlement: freshSettlement(),
    revenueShare: freshRevenueShare(),
    terminals: freshTerminals(),
  }
}

export type SetupAction =
  | { type: 'SET_VENUE'; venue: VenueSlice }
  | { type: 'SET_LOGIN'; login: LoginSlice }
  | { type: 'SET_MERCHANT'; merchant: MerchantSlice }
  | { type: 'SET_SLOT'; slot: SlotSlice }
  | { type: 'SET_COST'; cost: CostSlice }
  | { type: 'SET_PRICING'; pricing: PricingSlice }
  | { type: 'SET_SETTLEMENT'; settlement: SettlementSlice }
  | { type: 'SET_REVENUE_SHARE'; revenueShare: RevenueShareSlice }
  | { type: 'SET_TERMINALS'; terminals: TerminalsSlice }
  | { type: 'LOAD_DRAFT'; state: SetupState }
  | { type: 'RESET' }

export function setupReducer(state: SetupState, action: SetupAction): SetupState {
  switch (action.type) {
    case 'SET_VENUE': {
      if (state.venue.id === action.venue.id) {
        return { ...state, venue: action.venue }
      }
      return {
        ...state,
        venue: action.venue,
        login: freshLogin(),
        merchant: freshMerchant(),
        slot: freshSlot(),
        cost: freshCost(),
        pricing: freshPricing(),
        settlement: freshSettlement(),
        revenueShare: freshRevenueShare(),
        terminals: freshTerminals(),
      }
    }
    case 'SET_LOGIN':
      return { ...state, login: action.login, merchant: freshMerchant() }
    case 'SET_MERCHANT':
      return { ...state, merchant: action.merchant }
    case 'SET_SLOT': {
      const pricing = action.slot.mode === 'replace' ? { ...state.pricing, skipped: false } : state.pricing
      return { ...state, slot: action.slot, pricing }
    }
    case 'SET_COST':
      return { ...state, cost: action.cost }
    case 'SET_PRICING':
      return { ...state, pricing: action.pricing }
    case 'SET_SETTLEMENT':
      return { ...state, settlement: action.settlement }
    case 'SET_REVENUE_SHARE':
      return { ...state, revenueShare: action.revenueShare }
    case 'SET_TERMINALS':
      return { ...state, terminals: action.terminals }
    case 'LOAD_DRAFT':
      return action.state
    case 'RESET':
      return initialState()
  }
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PIN_RE = /^\d{6}$/
const MERCHANT_ID_RE = /^\d+$/

export function isCardValid(s: SetupState, card: RequiredCardKey): boolean {
  switch (card) {
    case 'venue':
      return !!s.venue.id
    case 'login':
      if (s.login.mode === 'empty') return false
      if (s.login.mode === 'existing') return !!s.login.angelpayUserAccountId
      return EMAIL_RE.test(s.login.email) && PIN_RE.test(s.login.pin)
    case 'merchant':
      if (s.merchant.mode === 'empty') return false
      if (s.merchant.mode === 'existing') return !!s.merchant.existingMerchantId
      return (
        MERCHANT_ID_RE.test(s.merchant.externalMerchantId) &&
        !!s.merchant.name.trim() &&
        !!s.merchant.affiliation.trim() &&
        !!s.merchant.displayName.trim() &&
        s.merchant.idConfirmed
      )
    case 'slot':
      if (s.slot.mode === 'empty') return false
      if (s.slot.mode === 'replace') return !!s.slot.replacedAccountId
      return true
    case 'cost':
      if (s.cost.skipped) return false
      return (
        s.cost.debitRate !== undefined &&
        s.cost.creditRate !== undefined &&
        s.cost.amexRate !== undefined &&
        s.cost.internationalRate !== undefined
      )
    case 'pricing':
      if (s.pricing.skipped) return false
      return (
        s.pricing.debitRate !== undefined &&
        s.pricing.creditRate !== undefined &&
        s.pricing.amexRate !== undefined &&
        s.pricing.internationalRate !== undefined
      )
    case 'settlement':
      if (s.settlement.skipped) return false
      return (
        s.settlement.daysDebit !== undefined &&
        s.settlement.daysCredit !== undefined &&
        s.settlement.daysAmex !== undefined &&
        s.settlement.daysInternational !== undefined
      )
  }
}

export function isRequiredComplete(state: SetupState): boolean {
  return REQUIRED_CARDS.every(k => isCardValid(state, k))
}
