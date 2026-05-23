import type { SetupState } from './types'
import type { FullSetupAngelPayPayload } from '@/services/paymentProvider.service'

/**
 * Pure mapper: SetupState → endpoint payload. Skipped/empty cards yield
 * `undefined` in the payload so the backend treats them as omitted. Settlement
 * always populates settlementDaysByCard (the per-card-type field added during
 * the wizard fixes).
 */
export function assemblePayload(s: SetupState): FullSetupAngelPayPayload {
  if (!s.venue.id) throw new Error('assemblePayload: venue.id required')

  const iso = (d: string) => (d ? new Date(`${d}T00:00:00`).toISOString() : new Date().toISOString())

  return {
    idempotencyKey: s.idempotencyKey,
    venueId: s.venue.id,
    aggregatorId: s.cost.skipped ? undefined : s.cost.aggregatorId,
    login:
      s.login.mode === 'existing'
        ? { mode: 'existing', angelpayUserAccountId: s.login.angelpayUserAccountId }
        : s.login.mode === 'new'
          ? { mode: 'new', email: s.login.email, pin: s.login.pin, environment: s.login.environment }
          : (() => {
              throw new Error('assemblePayload: login is empty')
            })(),
    merchant:
      s.merchant.mode === 'existing'
        ? { mode: 'existing', merchantAccountId: s.merchant.existingMerchantId ?? '' }
        : s.merchant.mode === 'create'
          ? {
              mode: 'create',
              externalMerchantId: s.merchant.externalMerchantId,
              name: s.merchant.name,
              affiliation: s.merchant.affiliation,
              displayName: s.merchant.displayName,
            }
          : (() => {
              throw new Error('assemblePayload: merchant is empty')
            })(),
    slot: s.slot,
    terminalIds: s.terminals.skipped || s.terminals.terminalIds.length === 0 ? undefined : s.terminals.terminalIds,
    cost: s.cost.skipped
      ? undefined
      : {
          debitRate: s.cost.debitRate ?? 0,
          creditRate: s.cost.creditRate ?? 0,
          amexRate: s.cost.amexRate ?? 0,
          internationalRate: s.cost.internationalRate ?? 0,
          includesTax: s.cost.includesTax,
          taxRate: s.cost.taxRate,
          fixedCostPerTransaction: s.cost.fixedCostPerTransaction,
          monthlyFee: s.cost.monthlyFee,
          effectiveFrom: iso(s.cost.effectiveFrom),
        },
    pricing: s.pricing.skipped
      ? undefined
      : {
          debitRate: s.pricing.debitRate ?? 0,
          creditRate: s.pricing.creditRate ?? 0,
          amexRate: s.pricing.amexRate ?? 0,
          internationalRate: s.pricing.internationalRate ?? 0,
          includesTax: s.pricing.includesTax,
          taxRate: s.pricing.taxRate,
          fixedFeePerTransaction: s.pricing.fixedFeePerTransaction,
          monthlyServiceFee: s.pricing.monthlyServiceFee,
          effectiveFrom: iso(s.pricing.effectiveFrom),
        },
    settlement: s.settlement.skipped
      ? undefined
      : {
          // Scalar legacy required by backend — use daysDebit as the canonical scalar.
          settlementDays: s.settlement.daysDebit ?? 1,
          settlementDaysByCard: {
            DEBIT: s.settlement.daysDebit,
            CREDIT: s.settlement.daysCredit,
            AMEX: s.settlement.daysAmex,
            INTERNATIONAL: s.settlement.daysInternational,
          },
          settlementDayType: s.settlement.dayType,
          cutoffTime: s.settlement.cutoffTime || '23:00',
          cutoffTimezone: s.settlement.cutoffTimezone || 'America/Mexico_City',
          effectiveFrom: iso(s.settlement.effectiveFrom),
        },
  }
}
