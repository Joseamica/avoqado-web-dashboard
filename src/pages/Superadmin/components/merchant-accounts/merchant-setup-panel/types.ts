/**
 * Shared types for the MerchantSetupPanel. All cards read/write a slice of
 * `SetupState`. Treat this file as the single source of truth for state shape.
 *
 * Spec: docs/superpowers/specs/2026-05-23-merchant-setup-panel-design.md
 */

export type CardType = 'DEBIT' | 'CREDIT' | 'AMEX' | 'INTERNATIONAL'

export type AccountSlot = 'PRIMARY' | 'SECONDARY' | 'TERTIARY'

/** Schema version for localStorage draft. Bump when SetupState shape changes
 *  incompatibly; older drafts are silently discarded on load. */
export const DRAFT_SCHEMA_VERSION = 1

// ─── Per-card slices ────────────────────────────────────────────

export interface VenueSlice {
  id: string | null
  name: string | null
  slug: string | null
}

export type LoginSlice =
  | { mode: 'existing'; angelpayUserAccountId: string }
  | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  | { mode: 'empty' } // sentinel, no choice yet

export interface MerchantSlice {
  mode: 'create' | 'existing' | 'empty'
  // create-mode fields
  externalMerchantId: string
  name: string
  affiliation: string
  displayName: string
  idConfirmed: boolean
  // existing-mode fields
  existingMerchantId?: string
  existingMerchantLabel?: string
}

export interface SlotSlice {
  accountType: AccountSlot
  mode: 'fill' | 'replace' | 'empty'
  replacedAccountId?: string
  fromSlot?: AccountSlot
  moveStrategy?: 'swap' | 'vacate'
}

export interface CostSlice {
  skipped: boolean
  aggregatorId?: string
  debitRate?: number      // decimals (0.015 = 1.5%)
  creditRate?: number
  amexRate?: number
  internationalRate?: number
  fixedCostPerTransaction?: number
  monthlyFee?: number
  includesTax: boolean
  taxRate: number
  effectiveFrom: string   // YYYY-MM-DD (or '' for today)
}

export interface PricingSlice {
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

export interface SettlementSlice {
  skipped: boolean
  daysDebit?: number          // default 1 once user opens the card
  daysCredit?: number
  daysAmex?: number           // default 3 (typically slower)
  daysInternational?: number  // default 3
  dayType: 'BUSINESS_DAYS' | 'CALENDAR_DAYS'
  cutoffTime: string          // 'HH:mm' or ''
  cutoffTimezone: string      // IANA tz or ''
  effectiveFrom: string
}

export interface RevenueShareSlice {
  skipped: boolean
  useAggregator: boolean
  aggregatorDebitRate?: number
  aggregatorCreditRate?: number
  aggregatorAmexRate?: number
  aggregatorInternationalRate?: number
  aggregatorPriceIncludesTax: boolean
  avoqadoShareOfProviderMargin: number   // 0..1, default 0.5
  avoqadoShareOfAggregatorMargin?: number
  taxRate: number
}

export interface TerminalsSlice {
  skipped: boolean
  terminalIds: string[]
}

// ─── Aggregate panel state ───────────────────────────────────────

export interface SetupState {
  schemaVersion: number
  idempotencyKey: string
  venue: VenueSlice
  login: LoginSlice
  merchant: MerchantSlice
  slot: SlotSlice
  cost: CostSlice
  pricing: PricingSlice
  settlement: SettlementSlice
  revenueShare: RevenueShareSlice
  terminals: TerminalsSlice
}

/** Identifies which cards are required for "Activar merchant" to be enabled.
 *  Optional cards still appear in the panel but never block activation. */
export const REQUIRED_CARDS = [
  'venue',
  'login',
  'merchant',
  'slot',
  'cost',
  'pricing',
  'settlement',
] as const

export type RequiredCardKey = (typeof REQUIRED_CARDS)[number]
