import { z } from 'zod'

const minor = z.string().regex(/^(0|[1-9][0-9]{0,18})$/)
const timestamp = z.string().datetime({ offset: true })

const moneyBreakdown = z
  .object({
    listSubtotalMinor: minor,
    discountMinor: minor,
    subtotalMinor: minor,
    taxMinor: minor,
    totalMinor: minor,
  })
  .strict()

const line = z
  .object({
    lineKey: z.string().min(1),
    targetType: z.enum(['PRODUCT', 'BUNDLE']),
    targetCode: z.string().min(1),
    priceCode: z.string().min(1),
    quantity: z.number().int().positive(),
    productKind: z.enum(['PLAN', 'POS', 'MODULE', 'BUNDLE']),
    name: z.string().min(1),
    billingUnit: z.enum(['VENUE_MONTH', 'VENUE_YEAR']),
    listUnitAmountMinor: minor,
    listSubtotalMinor: minor,
    discountMinor: minor,
    subtotalMinor: minor,
    taxMinor: minor,
    totalMinor: minor,
    promotionalCycles: z.number().int().positive().nullable(),
    renewalSubtotalMinor: minor,
    renewalTaxMinor: minor,
    renewalTotalMinor: minor,
  })
  .strict()

const receipt = z
  .object({
    id: z.string().min(1),
    provider: z.enum(['STRIPE', 'MANUAL_SPEI', 'AUTOMATIC_SPEI']),
    entryType: z.enum(['PAYMENT', 'REFUND', 'REVERSAL']),
    amountMinor: minor,
    currency: z.literal('MXN'),
    observedAt: timestamp,
    createdAt: timestamp,
  })
  .strict()

const obligation = z
  .object({
    periodId: z.string().min(1),
    scheduleKey: z.enum(['SAAS_MONTHLY', 'SAAS_ANNUAL']),
    cadence: z.enum(['MONTHLY', 'ANNUAL']),
    sequence: z.number().int().positive(),
    startsAt: timestamp,
    endsAt: timestamp,
    dueAt: timestamp,
    graceEndsAt: timestamp,
    periodStatus: z.enum(['OPEN', 'PAST_DUE', 'EXPIRED']),
    receivableId: z.string().min(1),
    reference: z.string().min(1),
    receivableStatus: z.enum(['OPEN', 'PARTIALLY_PAID', 'PAST_DUE', 'EXPIRED']),
    amountDueMinor: minor,
    allocatedMinor: minor,
    outstandingMinor: minor,
    currency: z.literal('MXN'),
    paymentProvider: z.enum(['STRIPE', 'MANUAL_SPEI', 'AUTOMATIC_SPEI']).nullable(),
    paymentState: z.enum(['REQUIRED', 'PENDING', 'UNDER_REVIEW', 'FAILED']),
  })
  .strict()

const readyOverview = z
  .object({
    schemaVersion: z.literal(1),
    state: z.literal('READY'),
    collectionState: z.enum([
      'CURRENT',
      'PAYMENT_REQUIRED',
      'PAYMENT_PENDING',
      'PAYMENT_UNDER_REVIEW',
      'PAYMENT_FAILED',
      'PAST_DUE',
      'CANCELED',
    ]),
    contract: z
      .object({
        id: z.string().min(1),
        status: z.enum(['DRAFT', 'PENDING_PAYMENT', 'ACTIVE', 'PAUSED', 'CANCELED', 'COMPLETED']),
        cadence: z.enum(['MONTHLY', 'ANNUAL', 'MIXED']),
        currency: z.literal('MXN'),
        timezone: z.string().min(1),
        startsAt: timestamp,
        endedAt: timestamp.nullable(),
        quoteId: z.string().min(1),
        lines: z.array(line).max(50),
        today: moneyBreakdown,
        renewal: moneyBreakdown,
        entitlements: z.array(z.string().regex(/^[A-Z][A-Z0-9_]{1,63}$/)).max(256),
      })
      .strict(),
    obligations: z.array(obligation).max(3),
    latestPaidPeriod: z
      .object({
        id: z.string().min(1),
        scheduleKey: z.enum(['SAAS_MONTHLY', 'SAAS_ANNUAL']),
        endsAt: timestamp,
        paidAt: timestamp,
      })
      .strict()
      .nullable(),
    nextRenewalAt: timestamp.nullable(),
    recentReceipts: z.array(receipt).max(5),
    receiptHistoryHasMore: z.boolean(),
  })
  .strict()

const noContractOverview = z.object({ schemaVersion: z.literal(1), state: z.literal('NO_COMMERCIAL_CONTRACT') }).strict()

const incompatibleOverview = z
  .object({
    schemaVersion: z.literal(1),
    state: z.literal('INCOMPATIBLE'),
    supportCode: z.enum(['COMMERCIAL_BILLING_SCHEMA_UNSUPPORTED', 'COMMERCIAL_BILLING_INTEGRITY_MISMATCH']),
  })
  .strict()

const overview = z.discriminatedUnion('state', [readyOverview, noContractOverview, incompatibleOverview])

const readyReceiptPage = z
  .object({
    schemaVersion: z.literal(1),
    state: z.literal('READY'),
    items: z.array(receipt).max(100),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict()

const noContractReceiptPage = z.object({ schemaVersion: z.literal(1), state: z.literal('NO_COMMERCIAL_CONTRACT') }).strict()

const receiptPage = z.discriminatedUnion('state', [readyReceiptPage, noContractReceiptPage, incompatibleOverview])

export type CommercialBillingOverview = z.infer<typeof overview>
export type CommercialBillingReadyOverview = z.infer<typeof readyOverview>
export type CommercialBillingReceipt = z.infer<typeof receipt>
export type CommercialBillingReceiptPage = z.infer<typeof receiptPage>

export function parseCommercialBillingOverview(value: unknown): CommercialBillingOverview {
  const parsed = overview.safeParse(value)
  if (!parsed.success) throw new Error('COMMERCIAL_BILLING_CONTRACT_INCOMPATIBLE')
  return parsed.data
}

export function parseCommercialBillingReceiptPage(value: unknown): CommercialBillingReceiptPage {
  const parsed = receiptPage.safeParse(value)
  if (!parsed.success) throw new Error('COMMERCIAL_BILLING_CONTRACT_INCOMPATIBLE')
  return parsed.data
}
