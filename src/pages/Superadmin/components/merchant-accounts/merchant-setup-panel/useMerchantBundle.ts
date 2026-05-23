/**
 * useMerchantBundle — fetches every server-side record needed to hydrate the
 * MerchantSetupPanel in `mode='edit'`, then offers a pure `bundleToSetupState`
 * transformer that maps that bundle into the reducer's `SetupState` shape.
 *
 * Edit-mode flow:
 *   1. Panel mounts with merchantAccountId
 *   2. useMerchantBundle fires 8 parallel queries → resolves into MerchantBundle
 *   3. MerchantSetupPanel calls bundleToSetupState(bundle) and dispatches LOAD_DRAFT
 *
 * The mapper is deliberately defensive — every relationship may be null, missing,
 * or empty, and the function MUST NOT throw. When a slice has no server data,
 * it falls back to the corresponding `fresh*` defaults from useSetupReducer.
 *
 * Per-card edit-save lives in Task 4.2, NOT here.
 */
import { useQueries } from '@tanstack/react-query'
import {
  paymentProviderAPI,
  type MerchantAccount,
  type ProviderCostStructure,
  type VenuePricingStructure,
  type VenuePaymentConfig,
  type TerminalWithVenue,
} from '@/services/paymentProvider.service'
import {
  getSettlementConfigurations,
  type SettlementConfiguration,
  type TransactionCardType,
} from '@/services/settlementConfiguration.service'
import { merchantRevenueShareAPI, type MerchantRevenueShare } from '@/services/merchantRevenueShare.service'
import {
  listAngelPayUserAccountsForVenue,
  type AngelPayUserAccount,
} from '@/services/superadmin-angelpay-user-account.service'
import { DRAFT_SCHEMA_VERSION, type SetupState, type AccountSlot } from './types'

// ───────────────────────────────────────────────────────────────
// Public types
// ───────────────────────────────────────────────────────────────

export interface MerchantBundle {
  merchant: MerchantAccount
  angelpayAccount: AngelPayUserAccount | null
  /** Active provider-cost rows for this merchant. Usually 1 (single row covers all 4 card types). */
  costStructures: ProviderCostStructure[]
  /** Pricing rows for the venue (filtered by accountType once we know the slot). */
  pricingStructures: VenuePricingStructure[]
  /** Settlement configurations — one per card type. */
  settlementConfigurations: SettlementConfiguration[]
  revenueShare: MerchantRevenueShare | null
  /** Terminals already attached to this merchant (id only matters). */
  attachedTerminals: TerminalWithVenue[]
  /** Venue PaymentConfig — needed to know which slot (PRIMARY/SECONDARY/TERTIARY) this merchant occupies. */
  venuePaymentConfig: VenuePaymentConfig | null
}

// ───────────────────────────────────────────────────────────────
// Local defaults (mirror useSetupReducer · fresh*)
// ───────────────────────────────────────────────────────────────
// Duplicated locally to keep this mapper a pure function with no side effects
// from the reducer module. If freshSettlement defaults change in
// useSetupReducer.ts these must be kept in sync.

const DEFAULT_SETTLEMENT_DAYS: Record<TransactionCardType, number | undefined> = {
  DEBIT: 1,
  CREDIT: 1,
  AMEX: 3,
  INTERNATIONAL: 3,
  OTHER: undefined,
}
const DEFAULT_DAY_TYPE: SettlementConfiguration['settlementDayType'] = 'BUSINESS_DAYS'
const DEFAULT_CUTOFF_TIME = '23:00'
const DEFAULT_CUTOFF_TZ = 'America/Mexico_City'

// ───────────────────────────────────────────────────────────────
// Pure mapper
// ───────────────────────────────────────────────────────────────

/** Pick the most relevant row from a list of effective-dated rows. Prefer the
 *  active row(s), then take the one with the latest effectiveFrom. */
function pickActive<T extends { active?: boolean; effectiveFrom?: string }>(rows: T[]): T | undefined {
  if (!rows || rows.length === 0) return undefined
  const actives = rows.filter(r => r.active !== false)
  const candidates = actives.length > 0 ? actives : rows
  return candidates.slice().sort((a, b) => (b.effectiveFrom ?? '').localeCompare(a.effectiveFrom ?? ''))[0]
}

/** Slice an ISO-ish date string to YYYY-MM-DD; safe on undefined/empty. */
function dateOnly(value: string | null | undefined): string {
  if (!value) return ''
  // Already YYYY-MM-DD?
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  return value.slice(0, 10)
}

function deriveSlot(merchantId: string, vpc: VenuePaymentConfig | null): { mode: 'fill' | 'empty'; slot: AccountSlot } {
  if (!vpc) return { mode: 'empty', slot: 'PRIMARY' }
  if (vpc.primaryAccountId === merchantId) return { mode: 'fill', slot: 'PRIMARY' }
  if (vpc.secondaryAccountId === merchantId) return { mode: 'fill', slot: 'SECONDARY' }
  if (vpc.tertiaryAccountId === merchantId) return { mode: 'fill', slot: 'TERTIARY' }
  return { mode: 'empty', slot: 'PRIMARY' }
}

function num(value: string | number | null | undefined, fallback: number): number {
  if (value === null || value === undefined) return fallback
  if (typeof value === 'number') return Number.isFinite(value) ? value : fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

/** Pure transformer: server bundle → reducer state. Never throws. */
export function bundleToSetupState(bundle: MerchantBundle): SetupState {
  const { merchant, costStructures, pricingStructures, settlementConfigurations, revenueShare, attachedTerminals, venuePaymentConfig } = bundle

  // Venue
  const venueRel = merchant.venues?.[0] ?? null
  const venueId = venueRel?.id ?? venuePaymentConfig?.venueId ?? ''
  const venueName = venueRel?.name ?? venuePaymentConfig?.venue?.name ?? ''
  const venueSlug = venueRel?.slug ?? venuePaymentConfig?.venue?.slug ?? ''

  // Slot
  const slotDerived = deriveSlot(merchant.id, venuePaymentConfig)

  // Cost
  const activeCost = pickActive(costStructures)
  const cost: SetupState['cost'] = activeCost
    ? {
        skipped: false,
        debitRate: activeCost.debitRate,
        creditRate: activeCost.creditRate,
        amexRate: activeCost.amexRate,
        internationalRate: activeCost.internationalRate,
        fixedCostPerTransaction: activeCost.fixedCostPerTransaction ?? undefined,
        monthlyFee: activeCost.monthlyFee ?? undefined,
        includesTax: true,
        taxRate: 0.16,
        effectiveFrom: dateOnly(activeCost.effectiveFrom),
      }
    : {
        skipped: false,
        includesTax: true,
        taxRate: 0.16,
        effectiveFrom: '',
      }

  // Pricing — filter by the slot we just derived
  const pricingForSlot =
    slotDerived.mode === 'fill'
      ? pricingStructures.filter(p => p.accountType === slotDerived.slot)
      : pricingStructures
  const activePricing = pickActive(pricingForSlot)
  const pricing: SetupState['pricing'] = activePricing
    ? {
        skipped: false,
        debitRate: activePricing.debitRate,
        creditRate: activePricing.creditRate,
        amexRate: activePricing.amexRate,
        internationalRate: activePricing.internationalRate,
        fixedFeePerTransaction: activePricing.fixedFeePerTransaction ?? undefined,
        monthlyServiceFee: activePricing.monthlyServiceFee ?? undefined,
        includesTax: true,
        taxRate: 0.16,
        effectiveFrom: dateOnly(activePricing.effectiveFrom),
      }
    : {
        skipped: false,
        includesTax: true,
        taxRate: 0.16,
        effectiveFrom: '',
      }

  // Settlement — one row per card type. Use the rows we have; fall back to defaults per missing card type.
  const byCard: Partial<Record<TransactionCardType, SettlementConfiguration>> = {}
  for (const row of settlementConfigurations) {
    // Prefer active row per card type; otherwise keep the most recent.
    const prev = byCard[row.cardType]
    if (!prev) {
      byCard[row.cardType] = row
    } else {
      const prevScore = (prev.effectiveTo === null ? 1 : 0) * 10 + (prev.effectiveFrom ?? '').localeCompare(row.effectiveFrom ?? '')
      if (prevScore < 0) byCard[row.cardType] = row
    }
  }
  // Pull dayType / cutoffTime / cutoffTimezone / effectiveFrom from any row (they should match).
  const anyRow = settlementConfigurations[0]
  const settlement: SetupState['settlement'] = {
    skipped: false,
    daysDebit: byCard.DEBIT?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS.DEBIT,
    daysCredit: byCard.CREDIT?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS.CREDIT,
    daysAmex: byCard.AMEX?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS.AMEX,
    daysInternational: byCard.INTERNATIONAL?.settlementDays ?? DEFAULT_SETTLEMENT_DAYS.INTERNATIONAL,
    dayType: anyRow?.settlementDayType ?? DEFAULT_DAY_TYPE,
    cutoffTime: anyRow?.cutoffTime ?? DEFAULT_CUTOFF_TIME,
    cutoffTimezone: anyRow?.cutoffTimezone ?? DEFAULT_CUTOFF_TZ,
    effectiveFrom: dateOnly(anyRow?.effectiveFrom),
  }

  // Revenue share
  const revenueShareSlice: SetupState['revenueShare'] = revenueShare
    ? {
        skipped: false,
        useAggregator: !!revenueShare.aggregatorPrice,
        aggregatorDebitRate: revenueShare.aggregatorPrice?.DEBIT,
        aggregatorCreditRate: revenueShare.aggregatorPrice?.CREDIT,
        aggregatorAmexRate: revenueShare.aggregatorPrice?.AMEX,
        aggregatorInternationalRate: revenueShare.aggregatorPrice?.INTERNATIONAL,
        aggregatorPriceIncludesTax: revenueShare.aggregatorPriceIncludesTax,
        avoqadoShareOfProviderMargin: num(revenueShare.avoqadoShareOfProviderMargin, 0.5),
        avoqadoShareOfAggregatorMargin:
          revenueShare.avoqadoShareOfAggregatorMargin === null || revenueShare.avoqadoShareOfAggregatorMargin === undefined
            ? undefined
            : num(revenueShare.avoqadoShareOfAggregatorMargin, 0.5),
        taxRate: num(revenueShare.taxRate, 0.16),
      }
    : {
        skipped: true,
        useAggregator: false,
        aggregatorPriceIncludesTax: true,
        avoqadoShareOfProviderMargin: 0.5,
        taxRate: 0.16,
      }

  // Terminals
  const terminals: SetupState['terminals'] = {
    skipped: false,
    terminalIds: attachedTerminals.map(t => t.id),
  }

  // Login: existing mode. Backend `angelpayUserAccountId` may be null/undefined for
  // legacy rows — keep a string-or-empty fallback so the typed union stays satisfied.
  const angelpayUserAccountId = merchant.angelpayUserAccountId ?? ''

  return {
    schemaVersion: DRAFT_SCHEMA_VERSION,
    idempotencyKey: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `edit-${merchant.id}`,
    venue: { id: venueId, name: venueName, slug: venueSlug },
    login: { mode: 'existing', angelpayUserAccountId },
    merchant: {
      mode: 'existing',
      externalMerchantId: merchant.externalMerchantId ?? '',
      name: '',
      affiliation: '',
      displayName: merchant.displayName ?? '',
      idConfirmed: true,
      existingMerchantId: merchant.id,
      existingMerchantLabel: merchant.displayName ?? merchant.alias ?? merchant.externalMerchantId,
    },
    slot: {
      accountType: slotDerived.slot,
      mode: slotDerived.mode,
    },
    cost,
    pricing,
    settlement,
    revenueShare: revenueShareSlice,
    terminals,
  }
}

// ───────────────────────────────────────────────────────────────
// React hook · 8 parallel TanStack queries
// ───────────────────────────────────────────────────────────────

export interface UseMerchantBundleResult {
  bundle: MerchantBundle | null
  isLoading: boolean
  isError: boolean
  errors: unknown[]
}

export function useMerchantBundle(merchantAccountId: string | undefined, enabled: boolean): UseMerchantBundleResult {
  const id = merchantAccountId ?? ''
  const isEnabled = enabled && !!id

  const queries = useQueries({
    queries: [
      // 0. Merchant
      {
        queryKey: ['merchant', id],
        queryFn: () => paymentProviderAPI.getMerchantAccount(id),
        enabled: isEnabled,
      },
      // 1. AngelPay user account (depends on merchant — derive once it resolves)
      {
        queryKey: ['merchant-angelpay-account', id],
        queryFn: async (): Promise<AngelPayUserAccount | null> => {
          const m = await paymentProviderAPI.getMerchantAccount(id)
          if (!m.angelpayUserAccountId) return null
          const venueId = m.venues?.[0]?.id
          if (!venueId) return null
          const accounts = await listAngelPayUserAccountsForVenue(venueId)
          return accounts.find(a => a.id === m.angelpayUserAccountId) ?? null
        },
        enabled: isEnabled,
      },
      // 2. Cost structures
      {
        queryKey: ['cost-structures-by-merchant', id],
        queryFn: () => paymentProviderAPI.getProviderCostStructuresByMerchantAccount(id),
        enabled: isEnabled,
      },
      // 3. Venue pricing structures (filtered by venueId; further filtered by slot in the mapper)
      {
        queryKey: ['venue-pricing-by-merchant', id],
        queryFn: async (): Promise<VenuePricingStructure[]> => {
          const m = await paymentProviderAPI.getMerchantAccount(id)
          const venueId = m.venues?.[0]?.id
          if (!venueId) return []
          return paymentProviderAPI.getVenuePricingStructures({ venueId, active: true })
        },
        enabled: isEnabled,
      },
      // 4. Settlement configurations
      {
        queryKey: ['settlement-configs-by-merchant', id],
        queryFn: () => getSettlementConfigurations({ merchantAccountId: id }),
        enabled: isEnabled,
      },
      // 5. Revenue share
      {
        queryKey: ['merchant-revenue-share', id],
        queryFn: () => merchantRevenueShareAPI.getByMerchant(id),
        enabled: isEnabled,
      },
      // 6. Terminals attached
      {
        queryKey: ['terminals-by-merchant', id],
        queryFn: () => paymentProviderAPI.getTerminalsByMerchantAccount(id),
        enabled: isEnabled,
      },
      // 7. Venue payment config (needed to derive slot)
      {
        queryKey: ['venue-payment-config-by-merchant', id],
        queryFn: async (): Promise<VenuePaymentConfig | null> => {
          const m = await paymentProviderAPI.getMerchantAccount(id)
          const venueId = m.venues?.[0]?.id
          if (!venueId) return null
          return paymentProviderAPI.getVenuePaymentConfig(venueId)
        },
        enabled: isEnabled,
      },
    ],
  })

  const [merchantQ, angelpayQ, costQ, pricingQ, settlementQ, revenueShareQ, terminalsQ, vpcQ] = queries

  const isLoading = queries.some(q => q.isLoading)
  const isError = queries.some(q => q.isError)
  const errors = queries.filter(q => q.isError).map(q => q.error)

  const allDone = queries.every(q => q.isSuccess)

  const bundle: MerchantBundle | null = allDone
    ? {
        merchant: merchantQ.data as MerchantAccount,
        angelpayAccount: (angelpayQ.data as AngelPayUserAccount | null) ?? null,
        costStructures: (costQ.data as ProviderCostStructure[]) ?? [],
        pricingStructures: (pricingQ.data as VenuePricingStructure[]) ?? [],
        settlementConfigurations: (settlementQ.data as SettlementConfiguration[]) ?? [],
        revenueShare: (revenueShareQ.data as MerchantRevenueShare | null) ?? null,
        attachedTerminals: (terminalsQ.data as TerminalWithVenue[]) ?? [],
        venuePaymentConfig: (vpcQ.data as VenuePaymentConfig | null) ?? null,
      }
    : null

  return { bundle, isLoading, isError, errors }
}
