// ── Bulk Onboarding Types ────────────────────────────────────────────

export interface PricingConfig {
  debitRate: number
  creditRate: number
  amexRate: number
  internationalRate: number
  fixedFeePerTransaction?: number
  monthlyServiceFee?: number
}

export interface SettlementConfig {
  debitDays: number
  creditDays: number
  amexDays: number
  internationalDays: number
  otherDays: number
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime?: string
  cutoffTimezone?: string
}

export interface BulkVenueTerminal {
  clientId: string
  serialNumber: string
  name: string
  type: string
  brand?: string
  model?: string
}

export interface BulkVenueEntry {
  clientId: string
  name: string
  address?: string
  city?: string
  state?: string
  country?: string
  zipCode?: string
  phone?: string
  email?: string
  website?: string
  latitude?: number
  longitude?: number
  type?: string
  entityType?: string
  rfc?: string
  legalName?: string
  timezone?: string
  currency?: string
  terminals: BulkVenueTerminal[]
  pricingOverride?: PricingConfig
  settlementOverride?: SettlementConfig
}

export interface BulkOnboardingDefaults {
  venueType: string
  timezone: string
  currency: string
  country: string
  entityType: string
}

export interface BulkOnboardingState {
  currentStep: number
  organizationId: string
  defaults: BulkOnboardingDefaults
  pricing: PricingConfig
  merchantAccountId: string
  settlement: SettlementConfig
  venues: BulkVenueEntry[]
}

// ── Actions ──────────────────────────────────────────────────────────

export type BulkOnboardingAction =
  | { type: 'SET_STEP'; step: number }
  | { type: 'SET_ORG'; organizationId: string }
  | { type: 'SET_DEFAULTS'; defaults: Partial<BulkOnboardingDefaults> }
  | { type: 'SET_PRICING'; pricing: Partial<PricingConfig> }
  | { type: 'SET_MERCHANT'; merchantAccountId: string }
  | { type: 'SET_SETTLEMENT'; settlement: Partial<SettlementConfig> }
  | { type: 'ADD_VENUE'; venue: BulkVenueEntry }
  | { type: 'ADD_VENUES_BATCH'; venues: BulkVenueEntry[] }
  | { type: 'UPDATE_VENUE'; clientId: string; updates: Partial<BulkVenueEntry> }
  | { type: 'REMOVE_VENUE'; clientId: string }
  | { type: 'DUPLICATE_VENUE'; clientId: string }
  | { type: 'RESET' }
  | { type: 'LOAD_DRAFT'; state: BulkOnboardingState }

// ── Validation ───────────────────────────────────────────────────────

export interface ValidationError {
  venueClientId?: string
  field: string
  message: string
}
