import { describe, it, expect } from 'vitest'
import { bundleToSetupState, type MerchantBundle } from '../useMerchantBundle'
import { DRAFT_SCHEMA_VERSION } from '../types'
import type { MerchantAccount, ProviderCostStructure, VenuePricingStructure, VenuePaymentConfig, TerminalWithVenue } from '@/services/paymentProvider.service'
import type { SettlementConfiguration } from '@/services/settlementConfiguration.service'
import type { MerchantRevenueShare } from '@/services/merchantRevenueShare.service'
import type { AngelPayUserAccount } from '@/services/superadmin-angelpay-user-account.service'

const fakeMerchant: MerchantAccount = {
  id: 'm1',
  providerId: 'p1',
  externalMerchantId: '9999999',
  alias: 'Acme MX',
  displayName: 'Acme MX Display',
  active: true,
  displayOrder: 0,
  hasCredentials: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  provider: { id: 'p1', code: 'ANGELPAY', name: 'AngelPay', type: 'PAYMENT_PROCESSOR' },
  angelpayUserAccountId: 'u1',
  venues: [{ id: 'v1', name: 'Venue One', slug: 'venue-one' }],
} as MerchantAccount

const fakeAngelPayAccount: AngelPayUserAccount = {
  id: 'u1',
  venueId: 'v1',
  email: 'login@example.com',
  environment: 'QA',
  status: 'ACTIVE',
  externalUserId: 1,
  statusReason: null,
  statusChangedAt: null,
  statusChangedBy: null,
  lastValidatedAt: null,
  lastValidationErr: null,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  createdBy: null,
}

const fakeCostStructure: ProviderCostStructure = {
  id: 'cs1',
  providerId: 'p1',
  merchantAccountId: 'm1',
  effectiveFrom: '2026-05-01T00:00:00Z',
  effectiveTo: null,
  debitRate: 0.011,
  creditRate: 0.018,
  amexRate: 0.032,
  internationalRate: 0.036,
  fixedCostPerTransaction: 0.5,
  monthlyFee: 100,
  active: true,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
  merchantAccount: { id: 'm1', provider: { id: 'p1', code: 'ANGELPAY', name: 'AngelPay' } },
} as ProviderCostStructure

const fakePricingStructure: VenuePricingStructure = {
  id: 'ps1',
  venueId: 'v1',
  // Match the SECONDARY slot from fakeVenuePaymentConfig (m1 is secondaryAccountId there)
  accountType: 'SECONDARY',
  effectiveFrom: '2026-05-01T00:00:00Z',
  effectiveTo: null,
  debitRate: 0.025,
  creditRate: 0.032,
  amexRate: 0.045,
  internationalRate: 0.055,
  fixedFeePerTransaction: 1,
  monthlyServiceFee: 200,
  active: true,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

const fakeSettlementRow = (cardType: SettlementConfiguration['cardType'], days: number): SettlementConfiguration => ({
  id: `sc-${cardType}`,
  merchantAccountId: 'm1',
  cardType,
  settlementDays: days,
  settlementDayType: 'BUSINESS_DAYS',
  cutoffTime: '22:30',
  cutoffTimezone: 'America/Mexico_City',
  effectiveFrom: '2026-05-01T00:00:00Z',
  effectiveTo: null,
  notes: null,
  createdBy: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
})

const fakeRevenueShare: MerchantRevenueShare = {
  id: 'rs1',
  merchantAccountId: 'm1',
  aggregatorPrice: { DEBIT: 0.014, CREDIT: 0.022, AMEX: 0.034, INTERNATIONAL: 0.04 },
  aggregatorPriceIncludesTax: false,
  avoqadoShareOfProviderMargin: '0.4',
  avoqadoShareOfAggregatorMargin: '0.6',
  taxRate: '0.16',
  active: true,
  notes: null,
  createdAt: '2026-05-01T00:00:00Z',
  updatedAt: '2026-05-01T00:00:00Z',
}

const fakeTerminal = (id: string): TerminalWithVenue => ({
  id,
  name: `Terminal ${id}`,
  serialNumber: `SN-${id}`,
  venue: { id: 'v1', name: 'Venue One', slug: 'venue-one' },
})

const fakeVenuePaymentConfig: VenuePaymentConfig = {
  id: 'vpc1',
  venueId: 'v1',
  primaryAccountId: 'mOther',
  secondaryAccountId: 'm1',
  tertiaryAccountId: null,
  preferredProcessor: 'ANGELPAY',
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
  venue: { id: 'v1', name: 'Venue One', slug: 'venue-one' },
  primaryAccount: { id: 'mOther' } as MerchantAccount,
} as VenuePaymentConfig

describe('bundleToSetupState · empty bundle', () => {
  it('returns sensible defaults when bundle is mostly empty', () => {
    const bundle: MerchantBundle = {
      merchant: { ...fakeMerchant, angelpayUserAccountId: null, venues: [] } as MerchantAccount,
      angelpayAccount: null,
      costStructures: [],
      pricingStructures: [],
      settlementConfigurations: [],
      revenueShare: null,
      attachedTerminals: [],
      venuePaymentConfig: null,
    }

    const s = bundleToSetupState(bundle)

    expect(s.schemaVersion).toBe(DRAFT_SCHEMA_VERSION)
    expect(s.idempotencyKey).toBeTruthy()
    // merchant: existing-mode pointing at the merchant id
    expect(s.merchant.mode).toBe('existing')
    expect(s.merchant.existingMerchantId).toBe('m1')
    // login: existing mode but with whatever id (or null-cast-to-empty-string)
    expect(s.login.mode).toBe('existing')
    // slot: no payment config → empty
    expect(s.slot.mode).toBe('empty')
    // cost/pricing/settlement default fresh
    expect(s.cost.skipped).toBe(false)
    expect(s.cost.debitRate).toBeUndefined()
    expect(s.pricing.debitRate).toBeUndefined()
    // settlement falls back to fresh defaults
    expect(s.settlement.daysDebit).toBe(1)
    expect(s.settlement.daysCredit).toBe(1)
    expect(s.settlement.daysAmex).toBe(3)
    expect(s.settlement.daysInternational).toBe(3)
    // revenue share → freshRevenueShare() (skipped=true)
    expect(s.revenueShare.skipped).toBe(true)
    expect(s.revenueShare.useAggregator).toBe(false)
    // terminals default
    expect(s.terminals.skipped).toBe(false)
    expect(s.terminals.terminalIds).toEqual([])
    // venue: missing — id is empty string (or whatever fallback we chose)
    expect(s.venue.id).toBe('')
  })
})

describe('bundleToSetupState · fully populated bundle', () => {
  it('hydrates full data into SetupState', () => {
    const bundle: MerchantBundle = {
      merchant: fakeMerchant,
      angelpayAccount: fakeAngelPayAccount,
      costStructures: [fakeCostStructure],
      pricingStructures: [fakePricingStructure],
      settlementConfigurations: [
        fakeSettlementRow('DEBIT', 1),
        fakeSettlementRow('CREDIT', 2),
        fakeSettlementRow('AMEX', 4),
        fakeSettlementRow('INTERNATIONAL', 5),
      ],
      revenueShare: fakeRevenueShare,
      attachedTerminals: [fakeTerminal('t1'), fakeTerminal('t2')],
      venuePaymentConfig: fakeVenuePaymentConfig,
    }

    const s = bundleToSetupState(bundle)

    // venue derived from merchant.venues[0]
    expect(s.venue.id).toBe('v1')
    expect(s.venue.name).toBe('Venue One')
    expect(s.venue.slug).toBe('venue-one')

    // login: existing mode with the user account id
    expect(s.login.mode).toBe('existing')
    if (s.login.mode === 'existing') expect(s.login.angelpayUserAccountId).toBe('u1')

    // merchant
    expect(s.merchant.mode).toBe('existing')
    expect(s.merchant.existingMerchantId).toBe('m1')

    // cost — all 4 rates hydrated from the active row
    expect(s.cost.skipped).toBe(false)
    expect(s.cost.debitRate).toBe(0.011)
    expect(s.cost.creditRate).toBe(0.018)
    expect(s.cost.amexRate).toBe(0.032)
    expect(s.cost.internationalRate).toBe(0.036)
    expect(s.cost.fixedCostPerTransaction).toBe(0.5)
    expect(s.cost.monthlyFee).toBe(100)
    expect(s.cost.effectiveFrom).toBe('2026-05-01')

    // pricing — all 4 rates
    expect(s.pricing.skipped).toBe(false)
    expect(s.pricing.debitRate).toBe(0.025)
    expect(s.pricing.creditRate).toBe(0.032)
    expect(s.pricing.amexRate).toBe(0.045)
    expect(s.pricing.internationalRate).toBe(0.055)
    expect(s.pricing.fixedFeePerTransaction).toBe(1)
    expect(s.pricing.monthlyServiceFee).toBe(200)

    // settlement — one count per card type pulled from rows
    expect(s.settlement.daysDebit).toBe(1)
    expect(s.settlement.daysCredit).toBe(2)
    expect(s.settlement.daysAmex).toBe(4)
    expect(s.settlement.daysInternational).toBe(5)
    expect(s.settlement.dayType).toBe('BUSINESS_DAYS')
    expect(s.settlement.cutoffTime).toBe('22:30')
    expect(s.settlement.cutoffTimezone).toBe('America/Mexico_City')

    // revenue share — useAggregator = true (aggregatorPrice present)
    expect(s.revenueShare.skipped).toBe(false)
    expect(s.revenueShare.useAggregator).toBe(true)
    expect(s.revenueShare.aggregatorDebitRate).toBe(0.014)
    expect(s.revenueShare.aggregatorCreditRate).toBe(0.022)
    expect(s.revenueShare.aggregatorAmexRate).toBe(0.034)
    expect(s.revenueShare.aggregatorInternationalRate).toBe(0.04)
    expect(s.revenueShare.aggregatorPriceIncludesTax).toBe(false)
    expect(s.revenueShare.avoqadoShareOfProviderMargin).toBe(0.4)
    expect(s.revenueShare.avoqadoShareOfAggregatorMargin).toBe(0.6)
    expect(s.revenueShare.taxRate).toBe(0.16)

    // terminals
    expect(s.terminals.skipped).toBe(false)
    expect(s.terminals.terminalIds).toEqual(['t1', 't2'])
  })
})

describe('bundleToSetupState · slot derivation', () => {
  it('derives SECONDARY slot when merchant.id matches venuePaymentConfig.secondaryAccountId', () => {
    const bundle: MerchantBundle = {
      merchant: fakeMerchant,
      angelpayAccount: fakeAngelPayAccount,
      costStructures: [],
      pricingStructures: [],
      settlementConfigurations: [],
      revenueShare: null,
      attachedTerminals: [],
      venuePaymentConfig: fakeVenuePaymentConfig, // m1 is secondaryAccountId here
    }
    const s = bundleToSetupState(bundle)
    expect(s.slot.mode).toBe('fill')
    expect(s.slot.accountType).toBe('SECONDARY')
  })

  it('derives PRIMARY slot when merchant.id matches venuePaymentConfig.primaryAccountId', () => {
    const bundle: MerchantBundle = {
      merchant: fakeMerchant,
      angelpayAccount: fakeAngelPayAccount,
      costStructures: [],
      pricingStructures: [],
      settlementConfigurations: [],
      revenueShare: null,
      attachedTerminals: [],
      venuePaymentConfig: { ...fakeVenuePaymentConfig, primaryAccountId: 'm1', secondaryAccountId: 'mOther' } as VenuePaymentConfig,
    }
    const s = bundleToSetupState(bundle)
    expect(s.slot.mode).toBe('fill')
    expect(s.slot.accountType).toBe('PRIMARY')
  })
})

describe('bundleToSetupState · partial settlement', () => {
  it('falls back to fresh defaults when a card type has no settlement row', () => {
    const bundle: MerchantBundle = {
      merchant: fakeMerchant,
      angelpayAccount: fakeAngelPayAccount,
      costStructures: [],
      pricingStructures: [],
      // Only DEBIT row → other 3 fall back to default constants from freshSettlement()
      settlementConfigurations: [fakeSettlementRow('DEBIT', 2)],
      revenueShare: null,
      attachedTerminals: [],
      venuePaymentConfig: null,
    }
    const s = bundleToSetupState(bundle)
    expect(s.settlement.daysDebit).toBe(2)     // from row
    expect(s.settlement.daysCredit).toBe(1)    // freshSettlement default
    expect(s.settlement.daysAmex).toBe(3)      // freshSettlement default
    expect(s.settlement.daysInternational).toBe(3) // freshSettlement default
    // cutoff/dayType pulled from the one row that DID exist
    expect(s.settlement.cutoffTime).toBe('22:30')
    expect(s.settlement.dayType).toBe('BUSINESS_DAYS')
  })
})
