import api, { publicApi } from '@/api'
import type { CancellationInput } from '@/services/features.service'
import { z } from 'zod'
export type HybridTerms = {
  currency: 'MXN'
  interval: 'MONTHLY'
  price: number
  taxIncluded: true
  promotionCycles: number | null
  renewal: { kind: 'SAME_PRICE' | 'END' } | { kind: 'REPRICE'; price: number }
}
export type HybridDefinition = { schemaVersion: 1; terms: HybridTerms } & (
  | { kind: 'PLAN'; planTier: 'PRO' | 'PREMIUM' }
  | { kind: 'FEATURES'; featureCodes: string[] }
  | { kind: 'CHOICE_BUNDLE'; choiceCount: number; eligibleFeatureCodes: string[] }
)
export type HybridOffer = {
  id: string
  name: string
  slug: string
  definition: HybridDefinition
  includedFeatureCodes: string[]
  purchaseAvailable: boolean
  placesRemaining: number
  endsAt: string
}
export type HybridPage<T> = { items: T[]; total: number; page: number; pageSize: number; totalPages?: number }
export type HybridLineInput = { publicationId: string; selectedFeatureCodes: string[] }
export type HybridQuote = {
  schemaVersion: 1
  lines: { publicationId: string; name: string; kind: HybridDefinition['kind']; featureCodes: string[]; terms: HybridTerms }[]
  total: string
  credit: string
  dueNow: string
  creditBalanceAfter: string
  existingBalance: string
  replaces: string[]
  droppedFeatureCodes: string[]
  featureCodes: string[]
}
export type HybridPurchase = {
  id: string
  status: string
  quote: HybridQuote
  quoteHash: string
  quoteExpiresAt: string
  paymentExpiresAt: string | null
  lastIssue: string | null
}
export type HybridPayment = { purchaseId: string; status: string; paymentUrl?: string | null }
export type HybridContract = {
  paymentIssue?: string | null
  id: string
  purchaseId: string
  name: string
  kind: HybridDefinition['kind']
  definition: HybridDefinition
  featureCodes: string[]
  startsAt: string | null
  paidThrough: string | null
  cancelAt: string | null
  endedAt: string | null
  pendingFeatureCodes: string[]
  pendingEffectiveAt: string | null
  revision: number
}
export type FeatureAccessSource = 'GRANDFATHERED' | 'FREE' | 'PLAN' | 'CONTRACT' | 'STANDALONE' | 'NONE'
export type FeatureGridOffer = {
  publicationId: string
  campaignId: string
  name: string
  kind: 'PLAN' | 'FEATURES'
  planTier: 'PRO' | 'PREMIUM' | null
  price: number
  renewal: 'SAME_PRICE' | 'REPRICE' | 'END'
  renewalPrice: number | null
  promotionCycles: number | null
  includedFeatureCodes: string[]
}
export type FeatureGridEntry = {
  id: string
  featureCode: string | null
  names: { es: string; en: string; fr: string }
  description: string
  category: 'sell' | 'customers' | 'inventory' | 'money' | 'team' | 'ai' | 'custom'
  minimumTier: 'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE' | null
  offering: 'INCLUDED' | 'CONFIGURABLE' | 'CONTACT'
  access: { source: FeatureAccessSource; contractId: string | null; paidThrough: string | null; cancelAt: string | null }
  offer: FeatureGridOffer | null
}
export type FeatureGrid = {
  catalogVersion: string
  purchasesEnabled: boolean
  plans: { PRO: FeatureGridOffer | null; PREMIUM: FeatureGridOffer | null }
  entries: FeatureGridEntry[]
}
export type HybridReplacementOptions = {
  standaloneFeatureCodes: string[]
  items: { subscriptionId: string; featureCodes: string[]; replaceable: boolean }[]
  total: number
}
export type HybridQuoteBody = {
  lines: HybridLineInput[]
  replaceSubscriptionIds: string[]
  dropFeatureCodes: string[]
  /** "Who stays" if this purchase leaves the venue on Gratis (spec §4.1). */
  keepStaffVenueIds?: string[]
}
// This client supports v1 only; unknown terms must show the existing retry/error state.
const amount = z
  .number()
  .finite()
  .min(10)
  .max(100000)
  .refine(value => Number(value.toFixed(2)) === value)
const codes = z
  .array(z.string().regex(/^[A-Z][A-Z0-9_]{0,63}$/))
  .max(100)
  .refine(values => new Set(values).size === values.length)
const terms = z
  .object({
    currency: z.literal('MXN'),
    interval: z.literal('MONTHLY'),
    price: amount,
    taxIncluded: z.literal(true),
    promotionCycles: z.number().int().min(1).max(24).nullable(),
    renewal: z.discriminatedUnion('kind', [
      z.object({ kind: z.literal('SAME_PRICE') }),
      z.object({ kind: z.literal('END') }),
      z.object({ kind: z.literal('REPRICE'), price: amount }),
    ]),
  })
  .refine(value => value.promotionCycles !== null || value.renewal.kind === 'SAME_PRICE')
const definition = z
  .discriminatedUnion('kind', [
    z.object({ schemaVersion: z.literal(1), kind: z.literal('PLAN'), planTier: z.enum(['PRO', 'PREMIUM']), terms }),
    z.object({ schemaVersion: z.literal(1), kind: z.literal('FEATURES'), featureCodes: codes.refine(values => values.length > 0), terms }),
    z.object({
      schemaVersion: z.literal(1),
      kind: z.literal('CHOICE_BUNDLE'),
      eligibleFeatureCodes: codes,
      choiceCount: z.number().int().positive(),
      terms,
    }),
  ])
  .refine(value => value.kind !== 'CHOICE_BUNDLE' || value.choiceCount <= value.eligibleFeatureCodes.length)
const hybridOfferSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().trim().min(1).max(120),
  slug: z.string().regex(/^[a-z0-9][a-z0-9-]{0,99}$/),
  definition,
  includedFeatureCodes: codes,
  purchaseAvailable: z.boolean(),
  placesRemaining: z.number().int().nonnegative(),
  endsAt: z.string().datetime(),
})
// Required fields are runtime-validated; this project's non-strict TS mode makes Zod infer optional keys.
export const parseHybridOffer = (value: unknown): HybridOffer => hybridOfferSchema.parse(value) as HybridOffer
const money = z.string().regex(/^\d{1,12}\.\d{2}$/)
const identifier = z.string().min(1).max(100)
const kind = z.enum(['PLAN', 'FEATURES', 'CHOICE_BUNDLE'])
const hybridPurchaseSchema = z.object({
  id: identifier,
  status: z.enum([
    'QUOTED',
    'ACCEPTED',
    'PROVISIONING',
    'PAYMENT_PENDING',
    'PAID',
    'DELIVERING',
    'REQUIRES_REVIEW',
    'COMPLETED',
    'CANCELLED',
    'EXPIRED',
  ]),
  quoteHash: z.string().min(1),
  quoteExpiresAt: z.string().datetime(),
  paymentExpiresAt: z.string().datetime().nullable(),
  lastIssue: z.string().nullable(),
  quote: z.object({
    schemaVersion: z.literal(1),
    lines: z
      .array(z.object({ publicationId: identifier, name: z.string().min(1), kind, featureCodes: codes, terms }))
      .min(1)
      .max(8),
    total: money,
    credit: money,
    dueNow: money,
    creditBalanceAfter: money,
    existingBalance: z.string().regex(/^-?\d{1,12}\.\d{2}$/),
    replaces: z.array(identifier).max(100),
    droppedFeatureCodes: codes,
    featureCodes: codes,
  }),
})
export const parseHybridPurchase = (value: unknown): HybridPurchase => hybridPurchaseSchema.parse(value) as HybridPurchase
const hybridContractSchema = z
  .object({
    paymentIssue: z.string().max(100).nullable().optional().default(null),
    id: identifier,
    purchaseId: identifier,
    name: z.string().min(1),
    kind,
    definition,
    featureCodes: codes,
    startsAt: z.string().datetime().nullable(),
    paidThrough: z.string().datetime().nullable(),
    cancelAt: z.string().datetime().nullable(),
    endedAt: z.string().datetime().nullable(),
    pendingFeatureCodes: codes.nullable().transform(value => value ?? []),
    pendingEffectiveAt: z.string().datetime().nullable(),
    revision: z.number().int().positive(),
  })
  .refine(value => value.kind === value.definition.kind)
export const parseHybridContract = (value: unknown): HybridContract => hybridContractSchema.parse(value) as HybridContract
const gridOffer = z.object({
  publicationId: identifier,
  campaignId: identifier,
  name: z.string().min(1),
  kind: z.enum(['PLAN', 'FEATURES']),
  planTier: z.enum(['PRO', 'PREMIUM']).nullable(),
  price: amount,
  renewal: z.enum(['SAME_PRICE', 'REPRICE', 'END']),
  renewalPrice: amount.nullable(),
  promotionCycles: z.number().int().min(1).max(24).nullable(),
  includedFeatureCodes: codes,
})
const featureGridSchema = z.object({
  catalogVersion: z.string().min(1),
  purchasesEnabled: z.boolean(),
  plans: z.object({ PRO: gridOffer.nullable(), PREMIUM: gridOffer.nullable() }),
  entries: z
    .array(
      z.object({
        id: z.string().min(1).max(100),
        featureCode: z
          .string()
          .regex(/^[A-Z][A-Z0-9_]{0,63}$/)
          .nullable(),
        names: z.object({ es: z.string(), en: z.string(), fr: z.string() }),
        description: z.string(),
        category: z.enum(['sell', 'customers', 'inventory', 'money', 'team', 'ai', 'custom']),
        minimumTier: z.enum(['FREE', 'PRO', 'PREMIUM', 'ENTERPRISE']).nullable(),
        offering: z.enum(['INCLUDED', 'CONFIGURABLE', 'CONTACT']),
        access: z.object({
          source: z.enum(['GRANDFATHERED', 'FREE', 'PLAN', 'CONTRACT', 'STANDALONE', 'NONE']),
          contractId: identifier.nullable(),
          paidThrough: z.string().datetime().nullable(),
          cancelAt: z.string().datetime().nullable(),
        }),
        offer: gridOffer.nullable(),
      }),
    )
    .max(100),
})
export const parseFeatureGrid = (value: unknown): FeatureGrid => featureGridSchema.parse(value) as FeatureGrid
const base = (venueId: string) => `/api/v1/dashboard/venues/${encodeURIComponent(venueId)}/hybrid-billing`
const data = <T>(response: { data: { data: T } }) => response.data.data
export const hybridBilling = {
  offers: (params: { page: number; pageSize: number; q?: string }, signal?: AbortSignal) =>
    publicApi
      .get<{ data: HybridPage<HybridOffer> }>('/api/v1/public/hybrid-offers', { params, signal })
      .then(data)
      .then(page => ({ ...page, items: page.items.map(parseHybridOffer) })),
  offer: (slug: string, signal?: AbortSignal) =>
    publicApi
      .get<{ data: HybridOffer }>(`/api/v1/public/hybrid-offers/${encodeURIComponent(slug)}`, { signal })
      .then(data)
      .then(parseHybridOffer),
  quote: (venueId: string, body: HybridQuoteBody) =>
    api
      .post<{ data: HybridPurchase }>(`${base(venueId)}/quotes`, body)
      .then(data)
      .then(parseHybridPurchase),
  current: (venueId: string) =>
    api
      .get<{ data: HybridPurchase | null }>(`${base(venueId)}/purchases/current`)
      .then(data)
      .then(value => (value === null ? null : parseHybridPurchase(value))),
  purchase: (venueId: string, id: string) =>
    api
      .get<{ data: HybridPurchase }>(`${base(venueId)}/purchases/${encodeURIComponent(id)}`)
      .then(data)
      .then(parseHybridPurchase),
  accept: (venueId: string, id: string, body: { quoteHash: string; clientKey: string }) =>
    api.post<{ data: HybridPayment }>(`${base(venueId)}/purchases/${encodeURIComponent(id)}/accept`, body).then(data),
  resume: (venueId: string, id: string) =>
    api.post<{ data: HybridPayment }>(`${base(venueId)}/purchases/${encodeURIComponent(id)}/resume`).then(data),
  cancel: (venueId: string, id: string) =>
    api.post<{ data: HybridPayment }>(`${base(venueId)}/purchases/${encodeURIComponent(id)}/cancel`).then(data),
  replacements: (venueId: string) => api.get<{ data: HybridReplacementOptions }>(`${base(venueId)}/replacement-options`).then(data),
  contracts: (venueId: string, page: number) =>
    api
      .get<{ data: HybridPage<HybridContract> }>(`${base(venueId)}/contracts`, { params: { page, pageSize: 10 } })
      .then(data)
      .then(page => ({ ...page, items: page.items.map(parseHybridContract) })),
  selection: (venueId: string, id: string, expectedRevision: number, featureCodes: string[] | null) =>
    api.post(`${base(venueId)}/contracts/${encodeURIComponent(id)}/selection`, { expectedRevision, featureCodes }),
  cancelContract: (venueId: string, id: string, expectedRevision: number, input: CancellationInput = {}) =>
    api.post(`${base(venueId)}/contracts/${encodeURIComponent(id)}/cancel`, { expectedRevision, ...input }),
  featureGrid: (venueId: string) =>
    api
      .get<{ data: FeatureGrid }>(`${base(venueId)}/feature-grid`)
      .then(data)
      .then(parseFeatureGrid),
}
