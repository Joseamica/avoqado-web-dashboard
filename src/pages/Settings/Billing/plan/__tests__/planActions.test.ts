// src/pages/Settings/Billing/plan/__tests__/planActions.test.ts
import { describe, expect, it } from 'vitest'
import type { PlanOrigin, PlanState } from '@/services/features.service'
import type { FeatureAccessSource, FeatureGrid, FeatureGridEntry, FeatureGridOffer } from '@/services/hybridBilling.service'
import {
  NO_ORIGIN,
  chosenOffer,
  chosenPlanOffer,
  classicPrice,
  currentTarget,
  dependencyFix,
  gridMode,
  isMarkable,
  mixedChange,
  originOf,
  planOperation,
  planPillPrice,
  summarizeSelection,
  tierFeatureCount,
} from '../planActions'

const offer = (id: string, price: number, extra: Partial<FeatureGridOffer> = {}): FeatureGridOffer => ({
  publicationId: `pub_${id}`,
  campaignId: `camp_${id}`,
  name: id,
  kind: 'FEATURES',
  planTier: null,
  price,
  renewal: 'SAME_PRICE',
  renewalPrice: null,
  promotionCycles: null,
  includedFeatureCodes: [id],
  ...extra,
})
const entry = (
  id: string,
  minimumTier: FeatureGridEntry['minimumTier'],
  source: FeatureAccessSource = 'NONE',
  price: number | null = null,
  offering: FeatureGridEntry['offering'] = minimumTier === 'FREE' ? 'INCLUDED' : 'CONFIGURABLE',
): FeatureGridEntry => ({
  id,
  featureCode: id.startsWith('BASE_') ? null : id,
  names: { es: id, en: id, fr: id },
  description: '',
  category: 'sell',
  minimumTier,
  offering,
  access: { source, contractId: null, paidThrough: null, cancelAt: null },
  offer: price == null ? null : offer(id, price),
})
const PLANS = {
  PRO: offer('PRO', 999, { kind: 'PLAN', planTier: 'PRO', includedFeatureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'] }),
  PREMIUM: offer('PREMIUM', 1999, { kind: 'PLAN', planTier: 'PREMIUM', includedFeatureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS', 'CFDI'] }),
}
const ENTRIES = [
  entry('BASE_POS', 'FREE', 'FREE'),
  entry('CHATBOT', 'FREE', 'FREE'),
  entry('LOYALTY_PROGRAM', 'PRO', 'NONE', 199),
  entry('RESERVATIONS', 'PRO', 'NONE', 129),
  entry('CFDI', 'PREMIUM', 'NONE', 249),
  entry('COMMISSIONS', 'PREMIUM'),
  entry('WHITE_LABEL_DASHBOARD', 'ENTERPRISE', 'NONE', null, 'CONTACT'),
]
const grid = (entries = ENTRIES, over: Partial<FeatureGrid> = {}): FeatureGrid => ({
  catalogVersion: 'v',
  purchasesEnabled: true,
  plans: PLANS,
  entries,
  ...over,
})
const origin = (over: Partial<PlanOrigin>): PlanOrigin => ({ ...NO_ORIGIN, ...over })
const CLASSIC_PRO = origin({ kind: 'CLASSIC', tier: 'PRO', subscriptionId: 'sub_classic' })
// A plan bought through a hybrid contract, on the same subscription id the classic fixtures use: the cases that
// test the replacement itself (spec §4.5), now that a classic plan changing tier is an assisted change (§4.2 (c)).
const CONTRACT_PRO = origin({ kind: 'CONTRACT', tier: 'PRO', subscriptionId: 'sub_classic', contractId: 'hc_pro', contractRevision: 1 })
const CONTRACT_PREMIUM = origin({
  kind: 'CONTRACT',
  tier: 'PREMIUM',
  subscriptionId: 'sub_contract',
  contractId: 'hc_1',
  contractRevision: 3,
})
const replacements = (items: { subscriptionId: string; featureCodes: string[]; replaceable: boolean }[]) => ({
  standaloneFeatureCodes: ['CHATBOT'],
  items,
  total: items.length,
})
const base = { grandfathered: false, marked: [] as string[], grid: grid(), replacements: replacements([]), classicRejected: false }
const classicSource = replacements([
  { subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true },
])
const PRO_CODES = ['LOYALTY_PROGRAM', 'RESERVATIONS']
const contractOrigin = (tier: 'PRO' | 'PREMIUM', subscriptionId: string) =>
  origin({ kind: 'CONTRACT', tier, subscriptionId, contractId: `hc_${subscriptionId}`, contractRevision: 1 })
const planOffer = (tier: 'PRO' | 'PREMIUM', price: number, publicationId = `pub_${tier}`) =>
  offer(tier, price, { publicationId, kind: 'PLAN', planTier: tier, includedFeatureCodes: PLANS[tier].includedFeatureCodes })
/** A function whose best offer is a promotion and whose list is another publication. */
const promoWithList = (code: string, minimumTier: FeatureGridEntry['minimumTier'] = 'PREMIUM'): FeatureGridEntry => ({
  ...entry(code, minimumTier),
  offer: offer(code, 479.2, {
    publicationId: 'pub_promo',
    listPrice: 599,
    renewal: 'REPRICE',
    renewalPrice: 599,
    promotionCycles: 3,
  }),
  listOffer: offer(code, 599, { publicationId: 'pub_list', listPrice: 599 }),
})
const INVENTORY = promoWithList('INVENTORY_TRACKING')

describe('originOf', () => {
  it('uses the server origin when there is one', () => {
    expect(originOf({ origin: CONTRACT_PREMIUM } as PlanState)).toBe(CONTRACT_PREMIUM)
  })

  it('rebuilds a classic plan from the fields every server sends (a server without origin)', () => {
    const plan = {
      hasPlan: true,
      state: 'active',
      planTier: 'PRO',
      stripeSubscriptionId: 'sub_1',
      cancelAtPeriodEnd: false,
      currentPeriodEnd: '2026-10-27T00:00:00.000Z',
      price: { base: 999, gross: 1158.84, currency: 'MXN' },
      interval: 'month',
    } as PlanState
    expect(originOf(plan)).toMatchObject({ kind: 'CLASSIC', tier: 'PRO', subscriptionId: 'sub_1', cancelAt: null })
    expect(currentTarget(originOf(plan))).toBe('PRO')
  })

  it('an ended or absent plan is Gratis', () => {
    expect(originOf(undefined)).toEqual(NO_ORIGIN)
    expect(originOf({ hasPlan: true, state: 'canceled', stripeSubscriptionId: 'sub_1' } as PlanState).kind).toBe('NONE')
  })
})

describe('planOperation — the table of spec §4.1', () => {
  it('Gratis → Pro goes to the classic checkout', () => {
    expect(planOperation({ ...base, origin: NO_ORIGIN, target: 'PRO' })).toEqual({ kind: 'CLASSIC_CHECKOUT', tier: 'PRO' })
  })

  it('when the classic checkout refused (PLAN_ABSORBE_SUELTA), replaces the absorbed function with credit', () => {
    const op = planOperation({
      ...base,
      origin: NO_ORIGIN,
      target: 'PRO',
      classicRejected: true,
      replacements: replacements([{ subscriptionId: 'sub_loyalty', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }]),
    })
    expect(op).toEqual({
      kind: 'HYBRID_REPLACE',
      tier: 'PRO',
      lines: [{ publicationId: 'pub_PRO', selectedFeatureCodes: [] }],
      replaceSubscriptionIds: ['sub_loyalty'],
      dropFeatureCodes: [],
    })
  })

  it('… and without a purchasable Pro offer it is an assisted change', () => {
    const op = planOperation({
      ...base,
      origin: NO_ORIGIN,
      target: 'PRO',
      classicRejected: true,
      grid: grid(ENTRIES, { plans: { PRO: null, PREMIUM: null } }),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'PRO' })
  })

  it('Pro (classic) → Premium is an assisted change in phase 1: the classic subscription may be annual (§4.2 (c))', () => {
    expect(planOperation({ ...base, origin: CLASSIC_PRO, target: 'PREMIUM', replacements: classicSource })).toEqual({
      kind: 'ASSISTED',
      tier: 'PREMIUM',
    })
  })

  it('Pro (contract) → Premium replaces the plan subscription; Premium keeps everything', () => {
    expect(planOperation({ ...base, origin: CONTRACT_PRO, target: 'PREMIUM', replacements: classicSource })).toEqual({
      kind: 'HYBRID_REPLACE',
      tier: 'PREMIUM',
      lines: [{ publicationId: 'pub_PREMIUM', selectedFeatureCodes: [] }],
      replaceSubscriptionIds: ['sub_classic'],
      dropFeatureCodes: [],
    })
  })

  it('Pro (contract) → Premium also replaces a standalone function Premium absorbs', () => {
    const op = planOperation({
      ...base,
      origin: CONTRACT_PRO,
      target: 'PREMIUM',
      replacements: replacements([
        { subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true },
        { subscriptionId: 'sub_cfdi', featureCodes: ['CFDI'], replaceable: true },
      ]),
    })
    expect(op).toMatchObject({ kind: 'HYBRID_REPLACE', tier: 'PREMIUM', dropFeatureCodes: [] })
    const ids = op.kind === 'HYBRID_REPLACE' ? op.replaceSubscriptionIds : []
    expect(ids).toEqual(expect.arrayContaining(['sub_classic', 'sub_cfdi']))
    expect(ids).toHaveLength(2)
  })

  it('a standalone function the new plan does not include is neither replaced nor dropped (spec §4.5)', () => {
    // Commissions (Premium) bought alone stays on its own subscription at its own rate; loyalty, in Pro, is absorbed.
    const op = planOperation({
      ...base,
      origin: NO_ORIGIN,
      classicRejected: true,
      target: 'PRO',
      replacements: replacements([
        { subscriptionId: 'sub_loyalty', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true },
        { subscriptionId: 'sub_commissions', featureCodes: ['COMMISSIONS'], replaceable: true },
      ]),
    })
    expect(op).toMatchObject({ kind: 'HYBRID_REPLACE', replaceSubscriptionIds: ['sub_loyalty'], dropFeatureCodes: [] })
  })

  it('a plan that cannot be replaced stays assisted even if a standalone function could be absorbed', () => {
    const op = planOperation({
      ...base,
      origin: CONTRACT_PRO,
      target: 'PREMIUM',
      replacements: replacements([
        { subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: false },
        { subscriptionId: 'sub_cfdi', featureCodes: ['CFDI'], replaceable: true },
      ]),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'PREMIUM' })
  })

  it('more than eight subscriptions to replace is an assisted change (the server takes at most eight)', () => {
    const standalone = Array.from({ length: 8 }, (_, index) => ({
      subscriptionId: `sub_cfdi_${index}`,
      featureCodes: ['CFDI'],
      replaceable: true,
    }))
    const op = planOperation({
      ...base,
      origin: CONTRACT_PRO,
      target: 'PREMIUM',
      replacements: replacements([
        { subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true },
        ...standalone,
      ]),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'PREMIUM' })
  })

  it('Premium (contract) → Pro drops what Pro does not include', () => {
    const op = planOperation({
      ...base,
      origin: CONTRACT_PREMIUM,
      target: 'PRO',
      replacements: replacements([
        { subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS', 'CFDI'], replaceable: true },
      ]),
    })
    expect(op).toMatchObject({ kind: 'HYBRID_REPLACE', replaceSubscriptionIds: ['sub_contract'], dropFeatureCodes: ['CFDI'] })
  })

  it('a plan whose subscription cannot be replaced is an assisted change (never "Cambiar selección")', () => {
    const op = planOperation({
      ...base,
      origin: CONTRACT_PRO,
      target: 'PREMIUM',
      replacements: replacements([{ subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM'], replaceable: false }]),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'PREMIUM' })
  })

  it('with sales closed there is no replacement: assisted', () => {
    expect(
      planOperation({
        ...base,
        origin: CONTRACT_PRO,
        target: 'PREMIUM',
        replacements: classicSource,
        grid: grid(ENTRIES, { purchasesEnabled: false }),
      }),
    ).toEqual({
      kind: 'ASSISTED',
      tier: 'PREMIUM',
    })
  })

  it('Pro (classic) → Gratis schedules the classic downgrade', () => {
    expect(planOperation({ ...base, origin: CLASSIC_PRO, target: 'FREE' })).toEqual({ kind: 'DOWNGRADE_CLASSIC' })
  })

  it('Premium (contract) → Gratis cancels that contract renewal', () => {
    expect(planOperation({ ...base, origin: CONTRACT_PREMIUM, target: 'FREE' })).toEqual({
      kind: 'CANCEL_CONTRACT',
      contractId: 'hc_1',
      revision: 3,
    })
  })

  it('Pro → Gratis keeping a function replaces the plan by that function today', () => {
    expect(planOperation({ ...base, origin: CLASSIC_PRO, target: 'FREE', marked: ['RESERVATIONS'], replacements: classicSource })).toEqual({
      kind: 'HYBRID_DROP',
      lines: [{ publicationId: 'pub_RESERVATIONS', selectedFeatureCodes: [] }],
      replaceSubscriptionIds: ['sub_classic'],
      dropFeatureCodes: ['LOYALTY_PROGRAM'],
    })
  })

  it('keeping a function when the plan cannot be replaced is an assisted change', () => {
    expect(planOperation({ ...base, origin: CLASSIC_PRO, target: 'FREE', marked: ['RESERVATIONS'] })).toEqual({
      kind: 'ASSISTED',
      tier: 'FREE',
    })
  })

  it('a comped plan has no self-serve change, and a founder never pays', () => {
    expect(planOperation({ ...base, origin: origin({ kind: 'COMP', tier: 'PRO' }), target: 'FREE' })).toEqual({ kind: 'COMP' })
    expect(planOperation({ ...base, origin: NO_ORIGIN, target: 'PRO', grandfathered: true })).toEqual({ kind: 'FOUNDER' })
  })

  it('adding functions without changing plan quotes one line per function; nothing chosen is nothing to do', () => {
    expect(planOperation({ ...base, origin: NO_ORIGIN, target: 'FREE', marked: ['LOYALTY_PROGRAM', 'CFDI'] })).toEqual({
      kind: 'FEATURES',
      lines: [
        { publicationId: 'pub_LOYALTY_PROGRAM', selectedFeatureCodes: [] },
        { publicationId: 'pub_CFDI', selectedFeatureCodes: [] },
      ],
    })
    expect(planOperation({ ...base, origin: NO_ORIGIN, target: 'FREE' })).toEqual({ kind: 'NONE' })
  })
})

describe('mixed changes are assisted in phase 1 (spec §4.2)', () => {
  it('(c) a classic plan changing tier stays assisted even with a plan LIST offer', () => {
    const op = planOperation({
      ...base,
      origin: origin({ kind: 'CLASSIC', tier: 'PRO', subscriptionId: 'sub_c' }),
      target: 'PREMIUM',
      grid: grid(ENTRIES, { plans: { PRO: null, PREMIUM: planOffer('PREMIUM', 1970.84) } }),
      replacements: replacements([{ subscriptionId: 'sub_c', featureCodes: PRO_CODES, replaceable: true }]),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'PREMIUM' })
  })

  it('(a) the plan subscription also carrying a standalone function is assisted', () => {
    const op = planOperation({
      ...base,
      origin: contractOrigin('PRO', 'sub_h'),
      target: 'PREMIUM',
      grid: grid(ENTRIES, { plans: { PRO: null, PREMIUM: planOffer('PREMIUM', 1970.84) } }),
      replacements: replacements([{ subscriptionId: 'sub_h', featureCodes: [...PRO_CODES, 'COMMISSIONS'], replaceable: true }]),
    })
    expect(op.kind).toBe('ASSISTED')
  })

  it('(a) … also when going to Gratis keeping a function: the replacement would take the standalone one along', () => {
    const op = planOperation({
      ...base,
      origin: contractOrigin('PRO', 'sub_h'),
      target: 'FREE',
      marked: ['RESERVATIONS'],
      replacements: replacements([{ subscriptionId: 'sub_h', featureCodes: [...PRO_CODES, 'COMMISSIONS'], replaceable: true }]),
    })
    expect(op).toEqual({ kind: 'ASSISTED', tier: 'FREE' })
  })

  it('(b) an unabsorbed subscription holding a plan function is assisted', () => {
    const op = planOperation({
      ...base,
      origin: NO_ORIGIN,
      classicRejected: true,
      target: 'PRO',
      grid: grid([...ENTRIES, entry('INVENTORY_TRACKING', 'PREMIUM')], { plans: { PRO: planOffer('PRO', 1158.84), PREMIUM: null } }),
      replacements: replacements([
        { subscriptionId: 'sub_mix', featureCodes: ['LOYALTY_PROGRAM', 'INVENTORY_TRACKING'], replaceable: true },
        { subscriptionId: 'sub_res', featureCodes: ['RESERVATIONS'], replaceable: true },
      ]),
    })
    expect(op.kind).toBe('ASSISTED')
  })

  it('classic plan dropping to Gratis keeping a function is HYBRID_DROP', () => {
    const op = planOperation({
      ...base,
      origin: origin({ kind: 'CLASSIC', tier: 'PRO', subscriptionId: 'sub_c' }),
      target: 'FREE',
      marked: ['LOYALTY_PROGRAM'],
      replacements: replacements([{ subscriptionId: 'sub_c', featureCodes: PRO_CODES, replaceable: true }]),
    })
    expect(op.kind).toBe('HYBRID_DROP')
  })

  it('… also when the classic subscription lists what every plan has and quote-only functions (server projection)', () => {
    // The server's projection of a classic plan carries the free functions (CHATBOT) and, before 2026-09-29, a quote-only
    // one: none of them is a function bought alone, so (a) does not apply.
    const op = planOperation({
      ...base,
      origin: CLASSIC_PRO,
      target: 'FREE',
      marked: ['RESERVATIONS'],
      replacements: replacements([
        { subscriptionId: 'sub_classic', featureCodes: [...PRO_CODES, 'CHATBOT', 'WHITE_LABEL_DASHBOARD'], replaceable: true },
      ]),
    })
    expect(op.kind).toBe('HYBRID_DROP')
    expect(mixedChange({ ...base, origin: CLASSIC_PRO, target: 'FREE', marked: ['RESERVATIONS'] })).toBe(false)
  })
})

describe('the chosen offer: the promotion, or its list when the owner asked for it', () => {
  it('preferList swaps a marked function to its list offer', () => {
    const op = planOperation({
      ...base,
      origin: NO_ORIGIN,
      target: 'FREE',
      marked: ['INVENTORY_TRACKING'],
      preferList: ['INVENTORY_TRACKING'],
      grid: grid([INVENTORY]),
    })
    expect(op).toEqual({ kind: 'FEATURES', lines: [{ publicationId: 'pub_list', selectedFeatureCodes: [] }] })
    expect(chosenOffer(INVENTORY)).toBe(INVENTORY.offer)
    expect(chosenOffer(INVENTORY, ['INVENTORY_TRACKING'])).toBe(INVENTORY.listOffer)
  })

  it('… and the summary shows that same offer: its price and no promotion condition', () => {
    const model = summarizeSelection({
      ...base,
      origin: NO_ORIGIN,
      target: 'FREE',
      marked: ['INVENTORY_TRACKING'],
      preferList: ['INVENTORY_TRACKING'],
      grid: grid([INVENTORY]),
      interval: 'monthly',
    })
    expect(model.lines[1]).toMatchObject({ offer: { publicationId: 'pub_list' }, price: 599 })
    expect(model.monthlyTotal).toBe(599)
  })

  it('preferList PLAN swaps the plan line, the summary and the pill to the plan list offer', () => {
    const proList = planOffer('PRO', 1158.84, 'pub_pro_list')
    const input = {
      ...base,
      origin: NO_ORIGIN,
      classicRejected: true,
      grid: grid(ENTRIES, {
        plans: { PRO: planOffer('PRO', 899, 'pub_pro_promo'), PREMIUM: null },
        planListOffers: { PRO: proList, PREMIUM: null },
      }),
      replacements: replacements([{ subscriptionId: 'sub_loyalty', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }]),
    }
    expect(planOperation({ ...input, target: 'PRO' })).toMatchObject({ lines: [{ publicationId: 'pub_pro_promo' }] })
    expect(planOperation({ ...input, target: 'PRO', preferList: ['PLAN'] })).toMatchObject({
      kind: 'HYBRID_REPLACE',
      lines: [{ publicationId: 'pub_pro_list', selectedFeatureCodes: [] }],
    })
    const model = summarizeSelection({ ...input, target: 'PRO', preferList: ['PLAN'], interval: 'monthly' })
    expect(model.lines[0]).toMatchObject({ plan: 'PRO', offer: proList, price: 1158.84 })
    expect(planPillPrice('PRO', { ...input, interval: 'monthly' }).amount).toBe(899)
    expect(planPillPrice('PRO', { ...input, preferList: ['PLAN'], interval: 'monthly' }).amount).toBe(1158.84)
    expect(chosenPlanOffer(input.grid, 'PRO', ['PLAN'])).toBe(proList)
    // A server without plan lists: the plan offer stays.
    expect(chosenPlanOffer(grid(), 'PRO', ['PLAN'])).toBe(PLANS.PRO)
  })
})

describe('dependencyFix — what a refused dependency term offers (spec §5)', () => {
  const issue = (unit: Parameters<typeof dependencyFix>[0]['unit']) => ({
    featureCode: 'AUTO_REORDER',
    requiredFeatureCode: 'INVENTORY_TRACKING',
    requiredUntil: null,
    unit,
  })
  const cart = { ...base, origin: NO_ORIGIN, target: 'FREE' as const, marked: ['INVENTORY_TRACKING', 'AUTO_REORDER'] }
  const reorder = entry('AUTO_REORDER', 'PREMIUM', 'NONE', 199)

  it('a cart line with a list: use the list of THAT function', () => {
    const fix = dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_promo' }), { ...cart, grid: grid([INVENTORY, reorder]) })
    expect(fix).toEqual({ kind: 'LIST', prefer: 'INVENTORY_TRACKING', entry: INVENTORY, price: 599 })
  })

  it('a plan line with a plan list: use the list of the plan, never a loose function on top', () => {
    const proList = planOffer('PRO', 1158.84, 'pub_pro_list')
    const fix = dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_pro_promo' }), {
      ...base,
      origin: NO_ORIGIN,
      classicRejected: true,
      target: 'PRO',
      grid: grid(ENTRIES, {
        plans: { PRO: planOffer('PRO', 899, 'pub_pro_promo'), PREMIUM: null },
        planListOffers: { PRO: proList, PREMIUM: null },
      }),
    })
    expect(fix).toEqual({ kind: 'LIST', prefer: 'PLAN', plan: 'PRO', price: 1158.84 })
  })

  it('a line without a list asks to remove the function that cannot outlast it (spec §5)', () => {
    const plain = entry('INVENTORY_TRACKING', 'PREMIUM', 'NONE', 599)
    const withPlain = { ...cart, grid: grid([plain, reorder]) }
    // Removing the dependency itself would only turn the refusal into «add it»: what leaves is the dependent function.
    expect(dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_INVENTORY_TRACKING' }), withPlain)).toEqual({
      kind: 'REMOVE',
      code: 'AUTO_REORDER',
      entry: reorder,
    })
    // A plan line without a plan list: the same.
    const promoPlan = {
      ...base,
      origin: NO_ORIGIN,
      classicRejected: true,
      target: 'PRO' as const,
      marked: ['AUTO_REORDER'],
      grid: grid([...ENTRIES, reorder], { plans: { PRO: planOffer('PRO', 899, 'pub_pro_promo'), PREMIUM: null } }),
    }
    expect(dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_pro_promo' }), promoPlan)).toEqual({
      kind: 'REMOVE',
      code: 'AUTO_REORDER',
      entry: reorder,
    })
    // The dependent function is kept, not bought: nothing in the cart to remove, only the server's message.
    expect(
      dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_INVENTORY_TRACKING' }), { ...withPlain, marked: ['INVENTORY_TRACKING'] }),
    ).toBeNull()
  })

  it('already on the list offers nothing; a kept contract is assisted; nothing at all asks to add it', () => {
    const plain = entry('INVENTORY_TRACKING', 'PREMIUM', 'NONE', 599)
    const withPlain = { ...cart, grid: grid([plain, reorder]) }
    const preferred = { ...cart, preferList: ['INVENTORY_TRACKING'], grid: grid([INVENTORY, reorder]) }
    expect(dependencyFix(issue({ kind: 'LINE', publicationId: 'pub_list' }), preferred)).toBeNull()
    expect(dependencyFix(issue({ kind: 'RETAINED', source: 'sub_inv' }), withPlain)).toEqual({
      kind: 'RETAINED',
      code: 'INVENTORY_TRACKING',
      entry: plain,
    })
    expect(dependencyFix(issue(null), withPlain)).toEqual({ kind: 'MISSING', code: 'INVENTORY_TRACKING', entry: plain })
  })
})

describe('which tiles can be marked', () => {
  it('without a plan change: only functions the venue lacks and that have an offer', () => {
    expect(isMarkable(entry('RESERVATIONS', 'PRO', 'NONE', 129), 'ADD')).toBe(true)
    expect(isMarkable(entry('RESERVATIONS', 'PRO', 'PLAN', 129), 'ADD')).toBe(false)
    expect(isMarkable(entry('COMMISSIONS', 'PREMIUM'), 'ADD')).toBe(false)
  })

  it('dropping to Gratis: only what the plan gives today, to keep it', () => {
    expect(isMarkable(entry('RESERVATIONS', 'PRO', 'PLAN', 129), 'DROP')).toBe(true)
    expect(isMarkable(entry('CFDI', 'PREMIUM', 'NONE', 249), 'DROP')).toBe(false)
    expect(gridMode('FREE', 'PRO', true)).toBe('DROP')
    expect(gridMode('FREE', 'PRO', false)).toBe('VIEW')
    expect(gridMode('PREMIUM', 'PRO', true)).toBe('VIEW')
    expect(gridMode('PRO', 'PRO', true)).toBe('ADD')
  })
})

describe('summarizeSelection', () => {
  it('Gratis + two functions: the plan line at $0, the total, and the Pro comparison', () => {
    const model = summarizeSelection({
      ...base,
      origin: NO_ORIGIN,
      target: 'FREE',
      marked: ['LOYALTY_PROGRAM', 'RESERVATIONS'],
      interval: 'monthly',
    })
    expect(model.lines.map(line => line.price)).toEqual([0, 199, 129])
    expect(model.monthlyTotal).toBe(328)
    expect(model.payToday).toBeNull()
    expect(model.hint).toEqual({ tier: 'PRO', covered: 2, more: 2, price: 1158.84 })
  })

  it('Gratis → Pro yearly pays the classic first charge today, IVA included', () => {
    const model = summarizeSelection({ ...base, origin: NO_ORIGIN, target: 'PRO', interval: 'annual' })
    expect(model.payToday).toBe(11588.4)
    expect(model.lines).toEqual([{ key: 'plan-PRO', plan: 'PRO', offer: undefined, price: 11588.4 }])
  })

  it('dropping to Gratis lists what stops and shows the seat rule', () => {
    const inPlan = [
      entry('LOYALTY_PROGRAM', 'PRO', 'PLAN', 199),
      entry('RESERVATIONS', 'PRO', 'PLAN', 129),
      entry('CHATBOT', 'FREE', 'FREE'),
    ]
    const model = summarizeSelection({ ...base, origin: CLASSIC_PRO, target: 'FREE', grid: grid(inPlan), interval: 'monthly' })
    expect(model.operation).toEqual({ kind: 'DOWNGRADE_CLASSIC' })
    expect(model.lose.map(item => item.id)).toEqual(['LOYALTY_PROGRAM', 'RESERVATIONS'])
    expect(model.seatNotice).toBe(true)
  })

  it('dropping to Gratis keeping a function lists exactly what the quote drops', () => {
    const contractPro = origin({ kind: 'CONTRACT', tier: 'PRO', subscriptionId: 'sub_contract', contractId: 'hc_2', contractRevision: 1 })
    const inContract = [
      entry('LOYALTY_PROGRAM', 'PRO', 'PLAN', 199),
      entry('RESERVATIONS', 'PRO', 'PLAN', 129),
      entry('CFDI', 'PREMIUM', 'CONTRACT', 249),
      entry('CHATBOT', 'FREE', 'FREE'),
    ]
    const model = summarizeSelection({
      ...base,
      origin: contractPro,
      target: 'FREE',
      marked: ['RESERVATIONS'],
      grid: grid(inContract),
      // Loyalty is also held standalone, so only what nothing else keeps leaves.
      replacements: {
        ...replacements([{ subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true }]),
        standaloneFeatureCodes: ['CHATBOT', 'LOYALTY_PROGRAM'],
      },
      interval: 'monthly',
    })
    expect(model.operation).toMatchObject({ kind: 'HYBRID_DROP', dropFeatureCodes: [] })
    expect(model.lose).toEqual([])
    const alone = summarizeSelection({
      ...base,
      origin: contractPro,
      target: 'FREE',
      marked: ['RESERVATIONS'],
      grid: grid(inContract),
      replacements: replacements([
        { subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS'], replaceable: true },
      ]),
      interval: 'monthly',
    })
    expect(alone.operation).toMatchObject({ kind: 'HYBRID_DROP', dropFeatureCodes: ['LOYALTY_PROGRAM'] })
    expect(alone.lose.map(item => item.id)).toEqual(['LOYALTY_PROGRAM'])
  })

  it('a contract plan sharing its subscription with a CFDI package cannot drop to Gratis by itself (§4.2 (a))', () => {
    // The replacement would take the CFDI package along: a function with CONTRACT access cannot be marked in DROP.
    const contractPro = origin({ kind: 'CONTRACT', tier: 'PRO', subscriptionId: 'sub_contract', contractId: 'hc_2', contractRevision: 1 })
    const model = summarizeSelection({
      ...base,
      origin: contractPro,
      target: 'FREE',
      marked: ['RESERVATIONS'],
      grid: grid([
        entry('LOYALTY_PROGRAM', 'PRO', 'PLAN', 199),
        entry('RESERVATIONS', 'PRO', 'PLAN', 129),
        entry('CFDI', 'PREMIUM', 'CONTRACT', 249),
      ]),
      replacements: replacements([
        { subscriptionId: 'sub_contract', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS', 'CFDI'], replaceable: true },
      ]),
      interval: 'monthly',
    })
    expect(model.operation).toEqual({ kind: 'ASSISTED', tier: 'FREE' })
    expect(model.lose).toEqual([])
  })

  it('Pro → Premium never says you lose a function you never had', () => {
    // Live test 2026-09-29: the server lists WHITE_LABEL_DASHBOARD under the classic Pro subscription while the grid
    // says the venue has no access to it. The quote must still drop it (the server checks the exact set), but
    // «Dejas de tener» only names what the venue has today.
    const inPro = [
      entry('LOYALTY_PROGRAM', 'PRO', 'PLAN', 199),
      entry('RESERVATIONS', 'PRO', 'PLAN', 129),
      entry('CFDI', 'PREMIUM', 'NONE', 249),
      entry('WHITE_LABEL_DASHBOARD', 'ENTERPRISE', 'NONE', null, 'CONTACT'),
    ]
    const model = summarizeSelection({
      ...base,
      origin: CONTRACT_PRO,
      target: 'PREMIUM',
      grid: grid(inPro),
      replacements: replacements([
        { subscriptionId: 'sub_classic', featureCodes: ['LOYALTY_PROGRAM', 'RESERVATIONS', 'WHITE_LABEL_DASHBOARD'], replaceable: true },
      ]),
      interval: 'monthly',
    })
    expect(model.operation).toMatchObject({ kind: 'HYBRID_REPLACE', dropFeatureCodes: ['WHITE_LABEL_DASHBOARD'] })
    expect(model.lose).toEqual([])
  })

  it('more than eight offers cannot be reviewed', () => {
    const many = Array.from({ length: 9 }, (_, index) => entry(`FEATURE_${index}`, 'PRO', 'NONE', 99))
    const model = summarizeSelection({
      ...base,
      origin: NO_ORIGIN,
      target: 'FREE',
      grid: grid(many),
      marked: many.map(item => item.id),
      interval: 'monthly',
    })
    expect(model.tooMany).toBe(true)
  })
})

describe('prices and counts', () => {
  it('classic prices carry IVA: Pro $1,158.84 and Premium $1,970.84 a month', () => {
    expect(classicPrice('PRO', 'monthly')).toBe(1158.84)
    expect(classicPrice('PREMIUM', 'monthly')).toBe(1970.84)
    expect(classicPrice('PRO', 'annual')).toBe(11588.4)
  })

  it('counts a plan functions from the catalog, never the quoted ones', () => {
    expect(tierFeatureCount(ENTRIES, 'FREE')).toBe(2)
    expect(tierFeatureCount(ENTRIES, 'PRO')).toBe(4)
    expect(tierFeatureCount(ENTRIES, 'PREMIUM')).toBe(6)
  })
})

describe('planPillPrice: ivaAparte', () => {
  const pill = (tier: 'FREE' | 'PRO' | 'PREMIUM', over: Record<string, unknown> = {}) =>
    planPillPrice(tier, { ...base, origin: NO_ORIGIN, interval: 'monthly', ...over } as Parameters<typeof planPillPrice>[1])
  const proFrom = (planOfferPro: FeatureGridOffer) => ({
    classicRejected: true,
    replacements: replacements([{ subscriptionId: 'sub_loyalty', featureCodes: ['LOYALTY_PROGRAM'], replaceable: true }]),
    grid: grid(ENTRIES, { plans: { PRO: planOfferPro, PREMIUM: null } }),
  })

  it('la lista de un plan que no tienes va + IVA, y amount sigue con IVA', () => {
    expect(pill('PRO')).toMatchObject({ amount: 1158.84, ivaAparte: true })
  })
  it('el plan actual con promoción de $22 sigue con IVA incluido', () => {
    const o = origin({ kind: 'CLASSIC', tier: 'PRO', subscriptionId: 's', price: { gross: 22 } as PlanOrigin['price'], interval: 'month' })
    expect(pill('PRO', { origin: o })).toMatchObject({ amount: 22, ivaAparte: false })
  })
  it('oferta REPRICE: con IVA incluido', () => {
    expect(pill('PRO', proFrom(planOffer('PRO', 899, 'x'))).amount).toBe(899)
    expect(pill('PRO', proFrom({ ...planOffer('PRO', 899), renewal: 'REPRICE' })).ivaAparte).toBe(false)
  })
  it('SAME_PRICE sin lista: con IVA incluido; con lista igual: + IVA', () => {
    expect(pill('PRO', proFrom(planOffer('PRO', 899))).ivaAparte).toBe(false)
    expect(pill('PRO', proFrom({ ...planOffer('PRO', 899), listPrice: 899 })).ivaAparte).toBe(true)
  })
  it('Gratis: no', () => expect(pill('FREE')).toEqual({ amount: 0, per: 'month', ivaAparte: false }))
})

describe('al pagar se cobra con IVA', () => {
  it('el checkout clásico de Pro cobra 1158.84 y el anual de Premium 19708.4', () => {
    const model = summarizeSelection({ ...base, origin: NO_ORIGIN, target: 'PRO', interval: 'monthly' })
    expect(model.operation.kind).toBe('CLASSIC_CHECKOUT')
    expect(model.payToday).toBe(1158.84)
    expect(model.monthlyTotal).toBe(1158.84)
    expect(model.lines[0].price).toBe(1158.84)
    expect(classicPrice('PREMIUM', 'annual')).toBe(19708.4)
  })
})

// D3 (5-nov-2026): con una prueba REGALADA (cortesía con fecha) el dueño puede quedarse con SU plan poniendo la tarjeta;
// el primer cobro es el día que termina la prueba («como Shopify»). `firstChargeAt` lo decide el SERVIDOR.
describe('quedarse con el plan durante una prueba regalada (D3)', () => {
  const FIN = '2026-12-05T17:19:24.498Z'
  const pruebaPro = origin({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: FIN, firstChargeAt: FIN })

  it('mismo plan, sin funciones marcadas → compra clásica SIN cobro hoy, con la fecha del primer cobro', () => {
    expect(planOperation({ ...base, origin: pruebaPro, target: 'PRO' })).toEqual({
      kind: 'CLASSIC_CHECKOUT',
      tier: 'PRO',
      firstChargeAt: FIN,
    })
  })

  it('🔴 otro plan durante la prueba sigue en «escríbenos» (Premium→Pro le quitaría Premium ese día)', () => {
    expect(planOperation({ ...base, origin: pruebaPro, target: 'PREMIUM' })).toEqual({ kind: 'COMP' })
    const pruebaPremium = origin({ kind: 'COMP', tier: 'PREMIUM', currentPeriodEnd: FIN, firstChargeAt: FIN })
    expect(planOperation({ ...base, origin: pruebaPremium, target: 'PRO' })).toEqual({ kind: 'COMP' })
  })

  it('sin `firstChargeAt` (cortesía permanente, o le quedan menos de 3 días) → igual que hoy', () => {
    const sinFecha = origin({ kind: 'COMP', tier: 'PRO', currentPeriodEnd: FIN })
    expect(planOperation({ ...base, origin: sinFecha, target: 'PRO' })).toEqual({ kind: 'NONE' })
    expect(planOperation({ ...base, origin: origin({ kind: 'COMP', tier: 'PRO' }), target: 'PRO' })).toEqual({ kind: 'NONE' })
  })

  it('con funciones marcadas sigue comprando funciones (no mezcla las dos cosas)', () => {
    expect(planOperation({ ...base, origin: pruebaPro, target: 'PRO', marked: ['RESERVATIONS'] })).toMatchObject({ kind: 'FEATURES' })
  })

  it('el resumen lleva la línea del plan, hoy $0 y el primer cobro; anual cuenta por año', () => {
    const mensual = summarizeSelection({ ...base, origin: pruebaPro, target: 'PRO', interval: 'monthly' })
    expect(mensual.lines).toEqual([expect.objectContaining({ plan: 'PRO', price: classicPrice('PRO', 'monthly') })])
    expect(mensual.payToday).toBe(0)
    expect(mensual.firstChargeAt).toBe(FIN)
    expect(mensual.monthlyTotal).toBe(classicPrice('PRO', 'monthly'))
    const anual = summarizeSelection({ ...base, origin: pruebaPro, target: 'PRO', interval: 'annual' })
    expect(anual.lines[0]).toMatchObject({ price: classicPrice('PRO', 'annual') })
    expect(anual.payToday).toBe(0)
  })

  it('REGRESIÓN: la compra clásica desde Gratis sigue cobrando hoy y sin fecha diferida', () => {
    const model = summarizeSelection({ ...base, origin: NO_ORIGIN, target: 'PRO', interval: 'monthly' })
    expect(model.operation).toEqual({ kind: 'CLASSIC_CHECKOUT', tier: 'PRO' })
    expect(model.payToday).toBe(classicPrice('PRO', 'monthly'))
    expect(model.firstChargeAt).toBeNull()
  })
})

// D5 (5-nov-2026): con un cupón vigente, la píldora del plan actual dice lo que de verdad paga.
describe('planPillPrice con cupón (D5)', () => {
  const conPrecio = origin({
    kind: 'CLASSIC',
    tier: 'PRO',
    subscriptionId: 'sub_1',
    interval: 'month',
    price: { base: 999, gross: 1158.84, currency: 'MXN' },
  })
  it('el plan actual con cupón muestra el precio con descuento', () => {
    const conCupon = {
      ...conPrecio,
      discount: { gross: 811.19, percentOff: 30, duration: 'repeating' as const, endsAt: '2027-02-05T17:00:00.000Z' },
    }
    expect(planPillPrice('PRO', { ...base, origin: conCupon, interval: 'monthly' }).amount).toBe(811.19)
  })
  it('REGRESIÓN: sin cupón, el precio de su plan', () => {
    expect(planPillPrice('PRO', { ...base, origin: conPrecio, interval: 'monthly' }).amount).toBe(1158.84)
  })
})
