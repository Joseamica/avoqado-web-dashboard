// src/pages/Settings/Billing/plan/planActions.ts
import { getTierDef } from '@/config/plan-catalog'
import type { PlanOrigin, PlanState } from '@/services/features.service'
import type {
  FeatureGrid,
  FeatureGridEntry,
  FeatureGridOffer,
  HybridLineInput,
  HybridReplacementOptions,
} from '@/services/hybridBilling.service'

/** A plan choice on the page. Enterprise is sold by talking to sales, never here. */
export type PlanTarget = 'FREE' | 'PRO' | 'PREMIUM'
/** A hybrid quote takes at most eight offers (the server's `hybridQuoteBody`). */
export const MAX_OFFERS = 8
const IVA_RATE = 0.16
export const TIER_RANK = { FREE: 0, PRO: 1, PREMIUM: 2, ENTERPRISE: 3 } as const

export const NO_ORIGIN: PlanOrigin = {
  kind: 'NONE',
  tier: null,
  price: null,
  interval: null,
  currentPeriodEnd: null,
  cancelAt: null,
  contractId: null,
  contractRevision: null,
  subscriptionId: null,
  paymentIssue: null,
}

/** The one obligation behind "Tu plan". A server that predates `origin` still sends the classic fields. */
export function originOf(plan: PlanState | undefined): PlanOrigin {
  if (plan?.origin) return plan.origin
  if (plan?.hasPlan && plan.stripeSubscriptionId && plan.state !== 'canceled')
    return {
      ...NO_ORIGIN,
      kind: 'CLASSIC',
      tier: plan.planTier === 'PREMIUM' ? 'PREMIUM' : 'PRO',
      price: plan.price,
      interval: plan.interval,
      currentPeriodEnd: plan.currentPeriodEnd,
      cancelAt: plan.cancelAtPeriodEnd ? plan.currentPeriodEnd : null,
      subscriptionId: plan.stripeSubscriptionId,
    }
  return NO_ORIGIN
}

export const currentTarget = (origin: PlanOrigin): PlanTarget => (origin.kind === 'NONE' ? 'FREE' : (origin.tier ?? 'FREE'))

/** The classic checkout's first charge, IVA included: PLAN_TIERS carries prices before IVA. */
export function classicPrice(tier: 'PRO' | 'PREMIUM', interval: 'monthly' | 'annual'): number {
  const def = getTierDef(tier)
  const beforeIva = (interval === 'annual' ? def.priceAnnual : def.priceMonthly) ?? 0
  return Math.round(beforeIva * (1 + IVA_RATE) * 100) / 100
}

/** How many functions a plan brings, counted from the catalog (functions sold by quote don't count). */
export function tierFeatureCount(entries: FeatureGridEntry[], tier: PlanTarget): number {
  return entries.filter(entry => entry.offering !== 'CONTACT' && entry.minimumTier && TIER_RANK[entry.minimumTier] <= TIER_RANK[tier])
    .length
}

/** Functions of the replaced subscriptions that nothing else keeps: the quote must list them as dropped. */
export function leavingFeatureCodes(
  replacements: HybridReplacementOptions | undefined,
  replaceIds: string[],
  keptCodes: string[],
): string[] {
  if (!replacements) return []
  const stays = new Set([
    ...replacements.standaloneFeatureCodes,
    ...replacements.items.filter(item => !replaceIds.includes(item.subscriptionId)).flatMap(item => item.featureCodes),
    ...keptCodes,
  ])
  const replaced = replacements.items.filter(item => replaceIds.includes(item.subscriptionId)).flatMap(item => item.featureCodes)
  return [...new Set(replaced)].filter(code => !stays.has(code))
}

export interface SelectionInput {
  origin: PlanOrigin
  grandfathered: boolean
  target: PlanTarget
  marked: string[]
  grid: FeatureGrid | undefined
  replacements: HybridReplacementOptions | undefined
  /** The classic checkout answered PLAN_ABSORBE_SUELTA: the plan absorbs a function bought alone. */
  classicRejected: boolean
  /** Function codes (and `'PLAN'` for the plan) quoted at their list offer instead of the best one (spec §5). */
  preferList?: string[]
}

/** The offer a function is quoted with: its list when the owner asked for it and it has one, else the best offer. */
export const chosenOffer = (entry: FeatureGridEntry, preferList?: string[]) =>
  (entry.featureCode && preferList?.includes(entry.featureCode) && entry.listOffer) || entry.offer

/** The same for a plan: `'PLAN'` in preferList picks the plan's list. */
export const chosenPlanOffer = (grid: FeatureGrid | undefined, tier: 'PRO' | 'PREMIUM', preferList?: string[]) =>
  (preferList?.includes('PLAN') && grid?.planListOffers?.[tier]) || grid?.plans[tier] || null

/** A function the plan grants as part of it (the catalog tier), as opposed to one sold only alone or by quote. */
const inPlan = (grid: FeatureGrid, tier: 'PRO' | 'PREMIUM', code: string) => {
  const e = grid.entries.find(x => x.featureCode === code)
  return (
    !!e &&
    e.offering === 'CONFIGURABLE' &&
    e.minimumTier !== null &&
    e.minimumTier !== 'ENTERPRISE' &&
    TIER_RANK[e.minimumTier] <= TIER_RANK[tier]
  )
}
const sellable = (grid: FeatureGrid, code: string) => grid.entries.some(e => e.featureCode === code && e.offering === 'CONFIGURABLE')

/** Replaceable subscriptions a plan offer covers whole: its replacement takes them along (spec §4.1). */
const absorbedBy = (offer: FeatureGridOffer, replacements: HybridReplacementOptions | undefined) =>
  (replacements?.items ?? [])
    .filter(
      item =>
        item.replaceable && item.featureCodes.length > 0 && item.featureCodes.every(code => offer.includedFeatureCodes.includes(code)),
    )
    .map(item => item.subscriptionId)

export type PlanOperation =
  | { kind: 'NONE' }
  | { kind: 'FOUNDER' }
  | { kind: 'COMP' }
  | { kind: 'ASSISTED'; tier: PlanTarget }
  | { kind: 'FEATURES'; lines: HybridLineInput[] }
  | { kind: 'CLASSIC_CHECKOUT'; tier: 'PRO' | 'PREMIUM' }
  | {
      kind: 'HYBRID_REPLACE'
      tier: 'PRO' | 'PREMIUM'
      lines: HybridLineInput[]
      replaceSubscriptionIds: string[]
      dropFeatureCodes: string[]
    }
  | { kind: 'HYBRID_DROP'; lines: HybridLineInput[]; replaceSubscriptionIds: string[]; dropFeatureCodes: string[] }
  | { kind: 'DOWNGRADE_CLASSIC' }
  | { kind: 'CANCEL_CONTRACT'; contractId: string; revision: number }

/** The replaceable subscription behind the current plan, when there is one. */
function ownSource(origin: PlanOrigin, replacements: HybridReplacementOptions | undefined): string[] {
  return (replacements?.items ?? [])
    .filter(item => item.replaceable && item.subscriptionId === origin.subscriptionId)
    .map(item => item.subscriptionId)
}

/** Whether dropping to Gratis can keep functions: the current plan must be replaceable today. */
export const canDropWithFeatures = (origin: PlanOrigin, replacements: HybridReplacementOptions | undefined) =>
  origin.kind !== 'NONE' && ownSource(origin, replacements).length > 0

/**
 * A change self-service would get wrong in phase 1, so it is "Cambio asistido" (spec §4.2, §4.5):
 * (a) the current plan's subscription also carries a function bought alone — replacing it takes that function along;
 * (b) a subscription the new plan does not absorb whole holds a function the plan includes — the server refuses the overlap;
 * (c) a classic plan to another paid plan — the classic subscription may be annual or carry the intro coupon (phase 2).
 */
export function mixedChange(input: SelectionInput): boolean {
  const { origin, target, grid } = input
  const current = currentTarget(origin)
  if (origin.kind === 'CLASSIC' && target !== 'FREE' && target !== current) return true
  if (!grid) return false
  const items = input.replacements?.items ?? []
  const own = ownSource(origin, input.replacements)
  // Only functions sold alone count: a plan's subscription also lists the free functions (and, on servers before
  // 2026-09-29, quote-only ones), which no plan grants as CONFIGURABLE.
  if (
    current !== 'FREE' &&
    items.some(
      item => own.includes(item.subscriptionId) && item.featureCodes.some(code => sellable(grid, code) && !inPlan(grid, current, code)),
    )
  )
    return true
  if (target === 'FREE') return false
  const offer = chosenPlanOffer(grid, target, input.preferList)
  const absorbed = offer ? absorbedBy(offer, input.replacements) : []
  return items.some(
    item =>
      !own.includes(item.subscriptionId) &&
      !absorbed.includes(item.subscriptionId) &&
      item.featureCodes.some(code => inPlan(grid, target, code)),
  )
}

/** Which server operation a choice maps to (spec §4.1). Without one, it is "Cambio asistido", never an invented path. */
export function planOperation(input: SelectionInput): PlanOperation {
  if (input.grandfathered) return { kind: 'FOUNDER' }
  const current = currentTarget(input.origin)
  const offers = input.marked.flatMap(code => {
    const found = input.grid?.entries.find(entry => entry.featureCode === code)
    const offer = found && chosenOffer(found, input.preferList)
    return offer ? [offer] : []
  })
  const lines = offers.map(offer => ({ publicationId: offer.publicationId, selectedFeatureCodes: [] as string[] }))
  if (input.target === current) return lines.length ? { kind: 'FEATURES', lines } : { kind: 'NONE' }
  if (input.origin.kind === 'COMP') return { kind: 'COMP' }
  const own = ownSource(input.origin, input.replacements)
  if (input.target === 'FREE') {
    if (lines.length) {
      if (!own.length || mixedChange(input)) return { kind: 'ASSISTED', tier: 'FREE' }
      const kept = offers.flatMap(offer => offer.includedFeatureCodes)
      return {
        kind: 'HYBRID_DROP',
        lines,
        replaceSubscriptionIds: own,
        dropFeatureCodes: leavingFeatureCodes(input.replacements, own, kept),
      }
    }
    if (input.origin.kind === 'CLASSIC') return { kind: 'DOWNGRADE_CLASSIC' }
    if (input.origin.kind === 'CONTRACT' && input.origin.contractId && input.origin.contractRevision != null)
      return { kind: 'CANCEL_CONTRACT', contractId: input.origin.contractId, revision: input.origin.contractRevision }
    return { kind: 'ASSISTED', tier: 'FREE' }
  }
  if (input.origin.kind === 'NONE' && !input.classicRejected) return { kind: 'CLASSIC_CHECKOUT', tier: input.target }
  const offer = input.grid?.purchasesEnabled ? chosenPlanOffer(input.grid, input.target, input.preferList) : null
  if (!offer) return { kind: 'ASSISTED', tier: input.target }
  // The plan's own subscription must be replaceable; standalone functions the new plan absorbs go with it (spec §4.1).
  if ((input.origin.kind !== 'NONE' && !own.length) || mixedChange(input)) return { kind: 'ASSISTED', tier: input.target }
  const sources = [...new Set([...own, ...absorbedBy(offer, input.replacements)])]
  // The server takes at most eight subscriptions to replace in one quote.
  if (!sources.length || sources.length > MAX_OFFERS) return { kind: 'ASSISTED', tier: input.target }
  return {
    kind: 'HYBRID_REPLACE',
    tier: input.target,
    lines: [{ publicationId: offer.publicationId, selectedFeatureCodes: [] }],
    replaceSubscriptionIds: sources,
    dropFeatureCodes: leavingFeatureCodes(input.replacements, sources, offer.includedFeatureCodes),
  }
}

/** ADD: no plan change (buy functions) · DROP: going to Gratis keeping functions · VIEW: a plan change (no marks). */
export type GridMode = 'ADD' | 'DROP' | 'VIEW'

export function gridMode(target: PlanTarget, current: PlanTarget, dropReady: boolean): GridMode {
  if (target === current) return 'ADD'
  if (target === 'FREE') return dropReady ? 'DROP' : 'VIEW'
  return 'VIEW'
}

/** ADD: what the venue lacks and has an offer · DROP: only what the plan gives today, to keep it. */
export function isMarkable(entry: FeatureGridEntry, mode: GridMode): boolean {
  if (!entry.offer) return false
  if (mode === 'ADD') return entry.access.source === 'NONE'
  if (mode === 'DROP') return entry.access.source === 'PLAN'
  return false
}

/** The price a plan pill shows: the one its operation would charge (classic, replacement offer, or the list as reference). */
export function planPillPrice(
  tier: PlanTarget,
  input: Omit<SelectionInput, 'target' | 'marked'> & { interval: 'monthly' | 'annual' },
): { amount: number; per: 'month' | 'year' } {
  if (tier === 'FREE') return { amount: 0, per: 'month' }
  if (tier === currentTarget(input.origin) && input.origin.price)
    return { amount: input.origin.price.gross, per: input.origin.interval === 'year' ? 'year' : 'month' }
  const op = planOperation({ ...input, target: tier, marked: [] })
  if (op.kind === 'CLASSIC_CHECKOUT')
    return { amount: classicPrice(tier, input.interval), per: input.interval === 'annual' ? 'year' : 'month' }
  const offer = op.kind === 'HYBRID_REPLACE' ? chosenPlanOffer(input.grid, tier, input.preferList) : null
  if (offer) return { amount: offer.price, per: 'month' }
  return { amount: classicPrice(tier, 'monthly'), per: 'month' }
}

export interface SummaryLine {
  key: string
  plan?: PlanTarget
  entry?: FeatureGridEntry
  offer?: FeatureGridOffer
  price: number | null
}

export interface SelectionSummaryModel {
  operation: PlanOperation
  current: PlanTarget
  target: PlanTarget
  lines: SummaryLine[]
  /** Sum of first charges, IVA included; null when there is nothing to buy. */
  monthlyTotal: number | null
  /** Only the classic checkout's first charge; a hybrid purchase shows `quote.dueNow` at review. */
  payToday: number | null
  lose: FeatureGridEntry[]
  hint: { tier: 'PRO' | 'PREMIUM'; covered: number; more: number; price: number } | null
  seatNotice: boolean
  tooMany: boolean
}

/** "Pro includes these N and M more": a comparison, never a price guarantee (spec §4.2). */
function includedHint(entries: FeatureGridEntry[], marked: string[], current: PlanTarget): SelectionSummaryModel['hint'] {
  if (!marked.length) return null
  for (const tier of ['PRO', 'PREMIUM'] as const) {
    if (TIER_RANK[tier] <= TIER_RANK[current]) continue
    const covered = marked.filter(code => {
      const found = entries.find(item => item.featureCode === code)
      return !!found?.minimumTier && TIER_RANK[found.minimumTier] <= TIER_RANK[tier]
    }).length
    if (covered === marked.length)
      return { tier, covered, more: Math.max(0, tierFeatureCount(entries, tier) - covered), price: classicPrice(tier, 'monthly') }
  }
  return null
}

export function summarizeSelection(input: SelectionInput & { interval: 'monthly' | 'annual' }): SelectionSummaryModel {
  const operation = planOperation(input)
  const current = currentTarget(input.origin)
  const entries = input.grid?.entries ?? []
  const features: SummaryLine[] = input.marked.flatMap(code => {
    const found = entries.find(item => item.featureCode === code)
    const offer = found && chosenOffer(found, input.preferList)
    return found && offer ? [{ key: found.id, entry: found, offer, price: offer.price }] : []
  })
  const planLine: SummaryLine = {
    key: `plan-${input.target}`,
    plan: input.target,
    offer: operation.kind === 'HYBRID_REPLACE' ? (chosenPlanOffer(input.grid, operation.tier, input.preferList) ?? undefined) : undefined,
    price: planPillPrice(input.target, input).amount,
  }
  const lines = input.target === current && current !== 'FREE' ? features : [planLine, ...features]
  const priced = !['NONE', 'FOUNDER', 'COMP'].includes(operation.kind)
  // A replacement drops exactly what its quote lists; ending the plan stops what the plan gives. Only held functions
  // show: a server older than 2026-09-29 listed a classic plan's quote-only functions (white label, master catalog) too.
  const lose =
    operation.kind === 'HYBRID_REPLACE' || operation.kind === 'HYBRID_DROP'
      ? entries.filter(item => item.featureCode && item.access.source !== 'NONE' && operation.dropFeatureCodes.includes(item.featureCode))
      : operation.kind === 'DOWNGRADE_CLASSIC' || operation.kind === 'CANCEL_CONTRACT'
        ? entries.filter(item => item.access.source === 'PLAN')
        : []
  return {
    operation,
    current,
    target: input.target,
    lines,
    monthlyTotal: priced ? lines.reduce((sum, line) => sum + (line.price ?? 0), 0) : null,
    payToday: operation.kind === 'CLASSIC_CHECKOUT' ? planLine.price : null,
    lose,
    hint: operation.kind === 'FEATURES' ? includedHint(entries, input.marked, current) : null,
    seatNotice: input.target === 'FREE' && current !== 'FREE',
    tooMany: input.marked.length > MAX_OFFERS,
  }
}

/** One detail of the server's HYBRID_DEPENDENCY_TERM refusal (`DependencyTermIssue`, dates as ISO). */
export interface DependencyIssue {
  featureCode: string
  requiredFeatureCode: string
  requiredUntil?: string | null
  /** What brings the dependency: a cart line (by publication), something the venue keeps, or nothing. */
  unit: { kind: 'LINE'; publicationId: string } | { kind: 'RETAINED'; source?: string } | null
}

export type DependencyFix =
  | { kind: 'LIST'; prefer: string; plan?: 'PRO' | 'PREMIUM'; entry?: FeatureGridEntry; price: number }
  | { kind: 'RETAINED' | 'MISSING'; code: string; entry?: FeatureGridEntry }

/**
 * Spec §5: a cart line that brings the dependency for too short is redone at ITS list (the plan's, for a plan line — never
 * a loose function on top of it); a kept contract that ends first is an assisted change; nothing bringing it asks to add
 * it. A line without a list, or already on it, offers nothing beyond the server's message.
 */
export function dependencyFix(issue: DependencyIssue, input: SelectionInput): DependencyFix | null {
  const entries = input.grid?.entries ?? []
  const code = issue.requiredFeatureCode
  const required = entries.find(entry => entry.featureCode === code)
  if (!issue.unit) return { kind: 'MISSING', code, entry: required }
  if (issue.unit.kind === 'RETAINED') return { kind: 'RETAINED', code, entry: required }
  const { publicationId } = issue.unit
  const tier = input.target === 'FREE' ? null : input.target
  if (tier && chosenPlanOffer(input.grid, tier, input.preferList)?.publicationId === publicationId) {
    const list = input.grid?.planListOffers?.[tier]
    return list && list.publicationId !== publicationId ? { kind: 'LIST', prefer: 'PLAN', plan: tier, price: list.price } : null
  }
  const line = entries.find(
    entry =>
      !!entry.featureCode &&
      input.marked.includes(entry.featureCode) &&
      chosenOffer(entry, input.preferList)?.publicationId === publicationId,
  )
  const list = line?.listOffer
  return line?.featureCode && list && list.publicationId !== publicationId
    ? { kind: 'LIST', prefer: line.featureCode, entry: line, price: list.price }
    : null
}
