# Sales Summary Payment Filter — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add payment method + card type filter to the Sales Summary report, an enriched payment-method breakdown with sub-buckets and platform commission per bucket, and fix the MindForm legacy-QR merge gap.

**Architecture:** Backend gets two new optional query params (`paymentMethod`, `cardType`); when active, the service computes only payment-derived metrics and skips order-derived ones (Square approach, intellectually honest for Mexican tax-inclusive pricing). Backend also gains a `byPaymentMethodDetailed` aggregation surfacing Card → {Credit, Debit, AMEX, International} with platform commission per sub-bucket. For MindForm only, legacy QR payments are merged into both totals and the breakdown; `QR_LEGACY` becomes a 4th bucket and a filter target. Frontend wires the existing TODO `filterBy` sub-panel, adds a filtered-state badge, and renders the enriched breakdown.

**Tech Stack:** TypeScript, Prisma 5, PostgreSQL, Express, React 18, Vite, TanStack Query, Radix UI, Tailwind, Playwright, Jest.

**Spec:** [`docs/superpowers/specs/2026-06-02-sales-summary-payment-filter-design.md`](../specs/2026-06-02-sales-summary-payment-filter-design.md)

**Repos involved:**
- `avoqado-server` — backend service + controller + tests (Tasks 1–13)
- `avoqado-web-dashboard` — frontend service + UI + i18n + E2E (Tasks 14–25)
- Manual verification (Task 26)

**Constraints / Project rules (read before starting):**
- Never commit without explicit user permission per `feedback_no_commits_without_permission` memory — the plan includes commit steps but pause for user before running them.
- Backend: real Prisma DB available for tests; no mocking of Prisma.
- All user-facing text uses `t()` with both `es` and `en` keys (`fr` is not configured for `reports` namespace — verify first).
- Frontend: no hardcoded colors; use semantic tokens. Pill-style + Stripe-filter pattern per `ui-patterns.md`.
- API paths include `/api/v1/`; the frontend service module already handles this.
- Co-Authored-By footer on commits: `Claude Opus 4.7 (1M context) <noreply@anthropic.com>` — no others.

---

## File Structure

### avoqado-server

| File | Responsibility | Change |
|---|---|---|
| `src/services/dashboard/sales-summary.dashboard.service.ts` | Core service: filter builder, payment-where composition, enriched breakdown, MindForm legacy merge | Modify |
| `src/controllers/dashboard/sales-summary.dashboard.controller.ts` | Validate `paymentMethod` + `cardType`, forward to service | Modify |
| `src/services/dashboard/sales-summary.dashboard.service.test.ts` | New test file covering filter scenarios, MindForm merge, enriched breakdown | Create |
| `src/services/legacy/qrPayments.legacy.service.ts` | Already exports `MINDFORM_NEW_VENUE_ID`, no change | (no change) |

### avoqado-web-dashboard

| File | Responsibility | Change |
|---|---|---|
| `src/services/reports/salesSummary.service.ts` | Extend filters, export `MINDFORM_VENUE_ID`, export new types and response shape additions | Modify |
| `src/pages/Reports/SalesSummary.tsx` | Filter state, sub-panel UI, pill+badge, hide-under-filter logic, enriched breakdown rendering | Modify |
| `src/locales/es/reports.json` | New `filterBy.*` keys | Modify |
| `src/locales/en/reports.json` | New `filterBy.*` keys | Modify |
| `e2e/tests/reports/sales-summary-filter.spec.ts` | Playwright E2E covering the filter flow + breakdown | Create |
| `e2e/fixtures/api-mocks.ts` | (Reuse existing mock helper — no structural change) | (no change) |

---

## Phase 0 — Setup

### Task 0: Prepare working copy

**Files:** none

- [ ] **Step 1: Confirm both repos clean and on `develop`**

Run:
```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server status
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard status
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server branch --show-current
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard branch --show-current
```

Expected: working trees clean (besides the already-committed spec); both on `develop`.

- [ ] **Step 2: Create feature branches in each repo**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server checkout -b feat/sales-summary-payment-filter
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard checkout -b feat/sales-summary-payment-filter
```

- [ ] **Step 3: Verify backend dev DB is reachable for tests**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run prisma -- db pull --print 2>&1 | head -3
```
Expected: prints the first few schema lines. Aborts with a clear error if DB unreachable.

---

## Phase 1 — Backend: Types & Validation

### Task 1: Extend `SalesSummaryFilters` interface

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts:82-92`

- [ ] **Step 1: Add new types and extend interface**

Replace the `ReportType` line and `SalesSummaryFilters` interface block with:

```ts
export type ReportType = 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum'

export type PaymentMethodFilter = 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER'
export type CardTypeFilter = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

export interface SalesSummaryFilters {
  startDate: string
  endDate: string
  groupBy?: 'none' | 'paymentMethod'
  reportType?: ReportType
  timezone?: string
  merchantAccountId?: string
  paymentMethod?: PaymentMethodFilter
  cardType?: CardTypeFilter
}
```

- [ ] **Step 2: Extend the response interface**

Find the `SalesSummaryMetrics` block (line ~37) and `SalesSummaryResponse` (line ~71). After `SalesSummaryMetrics`, add a `SalesSummaryDetailedBreakdown` type, and extend `SalesSummaryResponse`:

```ts
export interface PaymentMethodDetailedBreakdown {
  bucket: 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
  amount: number
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  subBuckets?: Array<{
    type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
    amount: number
    count: number
    percentage: number
    platformFees: number
  }>
}
```

Then add to `SalesSummaryResponse`:
```ts
export interface SalesSummaryResponse {
  // existing fields…
  /** When true, order-level metrics in summary are intentionally null (filter is active). */
  filtered: boolean
  /** Enriched breakdown — present when !filtered and groupBy === 'paymentMethod'. */
  byPaymentMethodDetailed?: PaymentMethodDetailedBreakdown[]
}
```

And update `SalesSummaryMetrics` so order-derived fields can be `null`:
```ts
export interface SalesSummaryMetrics {
  grossSales: number | null
  items: number | null
  serviceCosts: number | null
  discounts: number | null
  refunds: number
  netSales: number | null
  deferredSales: number | null
  taxes: number | null
  tips: number
  platformFees: number
  staffCommissions: number
  commissions: number
  totalCollected: number
  netProfit: number
  transactionCount: number
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```

Expected: PASS. If existing call sites break because they consumed `grossSales: number`, add a narrow `as number` at known callers that only run without filter (`nightly-sales-summary.job.ts`, `email.service.ts`). Verify by grepping `getSalesSummary` callers.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): add PaymentMethodFilter + CardTypeFilter types

Extends SalesSummaryFilters with paymentMethod and cardType optional
fields. Adds PaymentMethodDetailedBreakdown response shape for the
enriched breakdown. Order-derived metric fields become number | null so
the service can omit them honestly under a payment filter.

No runtime behavior change yet — wiring follows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 2: Controller validation

**Files:**
- Modify: `avoqado-server/src/controllers/dashboard/sales-summary.dashboard.controller.ts`

- [ ] **Step 1: Import new types and constant**

At the top of the file, change the existing import:
```ts
import {
  getSalesSummary,
  SalesSummaryFilters,
  ReportType,
  PaymentMethodFilter,
  CardTypeFilter,
} from '@/services/dashboard/sales-summary.dashboard.service'
import { MINDFORM_NEW_VENUE_ID } from '@/services/legacy/qrPayments.legacy.service'
```

- [ ] **Step 2: Add validation logic inside `salesSummaryReport`**

After the existing `validReportTypes` check (around line 51), add:

```ts
    const validPaymentMethods: PaymentMethodFilter[] = ['CASH', 'CARD', 'QR_LEGACY', 'OTHER']
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod as PaymentMethodFilter)) {
      throw new BadRequestError(`Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`)
    }

    const validCardTypes: CardTypeFilter[] = ['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']
    if (cardType && !validCardTypes.includes(cardType as CardTypeFilter)) {
      throw new BadRequestError(`Invalid cardType. Must be one of: ${validCardTypes.join(', ')}`)
    }

    if (cardType && paymentMethod !== 'CARD') {
      logger.warn('cardType ignored because paymentMethod is not CARD', { paymentMethod, cardType })
    }

    if (paymentMethod === 'QR_LEGACY' && venueId !== MINDFORM_NEW_VENUE_ID) {
      throw new BadRequestError('QR_LEGACY filter is only available for the MindForm venue')
    }
```

- [ ] **Step 3: Add the new fields to the destructure and forwarded filters**

Replace the `const { startDate, endDate, groupBy, reportType, merchantAccountId } = req.query` line with:
```ts
    const { startDate, endDate, groupBy, reportType, merchantAccountId, paymentMethod, cardType } = req.query
```

And update the `filters` object:
```ts
    const filters: SalesSummaryFilters = {
      startDate,
      endDate,
      groupBy: (groupBy as 'none' | 'paymentMethod') || 'none',
      reportType: (reportType as ReportType) || 'summary',
      timezone: venue?.timezone || 'America/Mexico_City',
      merchantAccountId: typeof merchantAccountId === 'string' ? merchantAccountId : undefined,
      paymentMethod: typeof paymentMethod === 'string' ? (paymentMethod as PaymentMethodFilter) : undefined,
      cardType: typeof cardType === 'string' ? (cardType as CardTypeFilter) : undefined,
    }
```

- [ ] **Step 4: Update the JSDoc comment block**

Replace the existing `Query params` doc (lines 20-26) with:
```ts
 * Query params:
 * - startDate: ISO date string (required)
 * - endDate: ISO date string (required)
 * - groupBy: 'none' | 'paymentMethod' (optional, default: 'none')
 * - reportType: 'summary' | 'hours' | 'days' | 'weeks' | 'months' | 'hourlySum' | 'dailySum' (optional, default: 'summary')
 * - merchantAccountId: CUID string (optional) - filter by specific merchant account
 * - paymentMethod: 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER' (optional) - filter to one method
 * - cardType: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL' (optional, only when paymentMethod=CARD)
```

- [ ] **Step 5: Type-check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 6: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/controllers/dashboard/sales-summary.dashboard.controller.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): validate paymentMethod and cardType query params

Adds enum validation for the two new optional filter params, plus a
guard rejecting QR_LEGACY for non-MindForm venues. cardType without
paymentMethod=CARD is logged and silently ignored (defense in depth).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — Backend: Filter Logic

### Task 3: Implement `buildPaymentWhereFilter` helper

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts` (top of the file, after imports)

- [ ] **Step 1: Add the helper function**

After the existing imports and types section, before `getSalesSummary`, insert:

```ts
import { Prisma } from '@prisma/client'

/**
 * Build a Prisma where fragment narrowing payments to a single method/card-type
 * bucket. Mirrors the canonical mapping in `transactionCost.service.ts`
 * (`determineTransactionCardType`) so a payment that counts as AMEX here
 * counts as AMEX everywhere else.
 *
 * QR_LEGACY is handled outside Prisma — see the MindForm branch in
 * getSalesSummary. We return a never-matches predicate so native queries
 * return zero rows.
 */
export function buildPaymentWhereFilter(
  paymentMethod?: PaymentMethodFilter,
  cardType?: CardTypeFilter,
): Prisma.PaymentWhereInput {
  if (!paymentMethod) return {}

  if (paymentMethod === 'CASH') return { method: 'CASH' }

  if (paymentMethod === 'OTHER') {
    return { method: { in: ['DIGITAL_WALLET', 'BANK_TRANSFER', 'CRYPTOCURRENCY', 'OTHER'] } }
  }

  if (paymentMethod === 'QR_LEGACY') {
    // Forces zero rows on the native Payment table; the MindForm branch
    // computes the QR_LEGACY summary entirely from the legacy DB.
    return { id: '__never_match__' }
  }

  // paymentMethod === 'CARD'
  if (!cardType) {
    return { method: { in: ['CREDIT_CARD', 'DEBIT_CARD'] } }
  }

  if (cardType === 'INTERNATIONAL') {
    return { processorData: { path: ['isInternational'], equals: true } }
  }

  if (cardType === 'AMEX') {
    return {
      cardBrand: 'AMERICAN_EXPRESS',
      NOT: { processorData: { path: ['isInternational'], equals: true } },
    }
  }

  // CREDIT or DEBIT — exclude AMEX brand and exclude international flag
  return {
    method: cardType === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD',
    cardBrand: { not: 'AMERICAN_EXPRESS' },
    NOT: { processorData: { path: ['isInternational'], equals: true } },
  }
}
```

- [ ] **Step 2: Add a raw-SQL twin for the time-period and platform-fees queries**

Below `buildPaymentWhereFilter`, add:

```ts
/**
 * Build a SQL WHERE-fragment (and parameter bindings) for the payment filter.
 * Mirrors `buildPaymentWhereFilter` semantics for raw SQL queries.
 * paramStart is the next $N to assign; returns the fragment + extra params.
 *
 * Important: the fragment is prefixed with " AND" so callers append it after
 * an existing WHERE. If the filter is empty the clause is "".
 */
export function buildPaymentSqlClause(
  paymentMethod: PaymentMethodFilter | undefined,
  cardType: CardTypeFilter | undefined,
  paramStart: number,
  columnPrefix = '',
): { clause: string; params: any[] } {
  if (!paymentMethod) return { clause: '', params: [] }

  const c = columnPrefix ? `${columnPrefix}.` : ''
  const pdJson = `${c}"processorData"`
  const pdIsIntl = `(${pdJson}->>'isInternational')::boolean = true`
  const pdNotIntl = `(${pdJson} IS NULL OR (${pdJson}->>'isInternational') IS NULL OR (${pdJson}->>'isInternational')::boolean = false)`

  if (paymentMethod === 'CASH') {
    return { clause: ` AND ${c}method = 'CASH'`, params: [] }
  }
  if (paymentMethod === 'OTHER') {
    return {
      clause: ` AND ${c}method IN ('DIGITAL_WALLET','BANK_TRANSFER','CRYPTOCURRENCY','OTHER')`,
      params: [],
    }
  }
  if (paymentMethod === 'QR_LEGACY') {
    return { clause: ` AND FALSE`, params: [] }
  }
  // CARD
  if (!cardType) {
    return { clause: ` AND ${c}method IN ('CREDIT_CARD','DEBIT_CARD')`, params: [] }
  }
  if (cardType === 'INTERNATIONAL') {
    return { clause: ` AND ${pdIsIntl}`, params: [] }
  }
  if (cardType === 'AMEX') {
    return {
      clause: ` AND ${c}"cardBrand" = 'AMERICAN_EXPRESS' AND ${pdNotIntl}`,
      params: [],
    }
  }
  // CREDIT or DEBIT
  const method = cardType === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD'
  return {
    clause: ` AND ${c}method = '${method}' AND (${c}"cardBrand" IS NULL OR ${c}"cardBrand" <> 'AMERICAN_EXPRESS') AND ${pdNotIntl}`,
    params: [],
  }
}
```

(Note: We hardcode enum strings into the SQL string because PaymentMethod / CardBrand enums are validated at the type-system level upstream. `paramStart` and `params` are kept for future flexibility — empty for now since enum values are constants.)

- [ ] **Step 3: Type-check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): add payment-filter where builders

Two helpers: buildPaymentWhereFilter (Prisma) and buildPaymentSqlClause
(raw SQL). Both encode the canonical mapping from (paymentMethod,
cardType) to the underlying Payment columns, mirroring
determineTransactionCardType in transactionCost.service.ts so a payment
classified as AMEX here matches AMEX in TransactionCost.

Not wired into getSalesSummary yet.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 4: Apply filter to `getSalesSummary` — payment-level queries

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts:100-205` (the body of `getSalesSummary`)

- [ ] **Step 1: Extract filter, compute `isFiltered`**

Replace the existing filter-extraction line in `getSalesSummary` with:

```ts
  const {
    startDate,
    endDate,
    groupBy = 'none',
    reportType = 'summary',
    timezone = 'America/Mexico_City',
    merchantAccountId,
    paymentMethod,
    cardType,
  } = filters

  const isFiltered = !!paymentMethod
  const paymentWhereFilter = buildPaymentWhereFilter(paymentMethod, cardType)
```

- [ ] **Step 2: Update the merchant filters to merge paymentWhereFilter**

Replace the existing two filter lines:

```ts
  // Payment-level filter combines merchant + payment-method filter
  const paymentLevelFilter = { ...(merchantAccountId ? { merchantAccountId } : {}), ...paymentWhereFilter }

  // Order-level filter narrows orders whose payments match the combined filter.
  // When isFiltered we skip order-level queries entirely (see below) but keep
  // this in case future order-only metrics ever need it.
  const merchantOrderFilter = merchantAccountId ? { payments: { some: { merchantAccountId } } } : {}
```

- [ ] **Step 3: Skip order-level queries when filtered**

Wrap the existing `grossSalesResult`, `deferredResult` queries (lines ~136-191) in:

```ts
  let grossSalesResult: Awaited<ReturnType<typeof prisma.order.aggregate>> | null = null
  let deferredResult: Awaited<ReturnType<typeof prisma.order.aggregate>> | null = null

  if (!isFiltered) {
    grossSalesResult = await prisma.order.aggregate({
      where: {
        venueId,
        ...dateFilter,
        status: { notIn: ['PENDING', 'CANCELLED', 'DELETED'] },
        paymentStatus: { notIn: ['REFUNDED'] },
        ...merchantOrderFilter,
      },
      _sum: { total: true, subtotal: true, taxAmount: true, tipAmount: true, discountAmount: true },
      _count: true,
    })

    deferredResult = await prisma.order.aggregate({
      where: {
        venueId,
        ...dateFilter,
        status: { notIn: ['PENDING', 'CANCELLED', 'DELETED'] },
        paymentStatus: { in: ['PENDING', 'PARTIAL'] },
        ...merchantOrderFilter,
      },
      _sum: { remainingBalance: true },
      _count: true,
    })
  }
```

- [ ] **Step 4: Merge `paymentWhereFilter` into payment-level queries**

Update each `prisma.payment.aggregate` / `count` call (refunds, tips, transaction count, etc.) to use `paymentLevelFilter`:

```ts
  const refundsResult = await prisma.payment.aggregate({
    where: {
      venueId,
      ...dateFilter,
      type: 'REFUND',
      ...paymentLevelFilter,
    },
    _sum: { amount: true, tipAmount: true },
    _count: true,
  })

  const tipsResult = await prisma.payment.aggregate({
    where: {
      venueId,
      ...dateFilter,
      status: 'COMPLETED',
      ...paymentLevelFilter,
    },
    _sum: { tipAmount: true },
  })

  const transactionCountResult = await prisma.payment.count({
    where: {
      venueId,
      ...dateFilter,
      status: 'COMPLETED',
      ...paymentLevelFilter,
    },
  })
```

- [ ] **Step 5: Update platform fees raw SQL to honor filter**

Replace the `platformFeesRows` block with a single parameterized query that conditionally appends the merchant + payment clauses:

```ts
  const { clause: paymentSqlClause } = buildPaymentSqlClause(paymentMethod, cardType, 4, 'p')
  const platformFeesRows = await prisma.$queryRawUnsafe<Array<{ sum_fee: number }>>(
    `
      SELECT COALESCE(SUM(tc."venueChargeAmount"), 0)::float AS sum_fee
      FROM "TransactionCost" tc
      JOIN "Payment" p ON p.id = tc."paymentId"
      WHERE p."venueId" = $1
        AND p."createdAt" >= $2
        AND p."createdAt" <= $3
        ${merchantAccountId ? 'AND p."merchantAccountId" = $4' : ''}
        ${paymentSqlClause}
    `,
    ...(merchantAccountId
      ? [venueId, parsedStartDate, parsedEndDate, merchantAccountId]
      : [venueId, parsedStartDate, parsedEndDate]),
  )
```

- [ ] **Step 6: Update staff commissions to honor filter**

Replace the `staffCommissionsResult` block:

```ts
  const paymentForCommissionFilter = { ...(merchantAccountId ? { merchantAccountId } : {}), ...paymentWhereFilter }
  const staffCommissionsResult = await prisma.commissionCalculation.aggregate({
    where: {
      venueId,
      createdAt: dateFilter.createdAt,
      status: { not: 'VOIDED' },
      ...(Object.keys(paymentForCommissionFilter).length > 0 ? { payment: paymentForCommissionFilter } : {}),
    },
    _sum: { netCommission: true },
  })
```

- [ ] **Step 7: Update the derived metrics block to handle null order-level results**

Replace the derived-metrics block:

```ts
  const grossSales = grossSalesResult ? Number(grossSalesResult._sum.subtotal || 0) : null
  const items = grossSalesResult ? Number(grossSalesResult._sum.subtotal || 0) : null
  const discounts = grossSalesResult ? Number(grossSalesResult._sum.discountAmount || 0) : null
  const taxes = grossSalesResult ? Number(grossSalesResult._sum.taxAmount || 0) : null
  const deferredSales = deferredResult ? Number(deferredResult._sum.remainingBalance || 0) : null
  const serviceCosts = grossSalesResult ? 0 : null

  const refunds = Math.abs(Number(refundsResult._sum.amount || 0) + Number(refundsResult._sum.tipAmount || 0))
  const tips = Number(tipsResult._sum.tipAmount || 0)
  const platformFees = Number(platformFeesRows[0]?.sum_fee || 0)
  const staffCommissions = Number(staffCommissionsResult._sum.netCommission || 0)

  // Net sales: only meaningful when we have grossSales.
  const netSales = grossSales !== null && discounts !== null
    ? grossSales - discounts - refunds
    : null

  // Total collected: when filtered, derive from refunds + tips + platformFees against payment volume.
  // When not filtered, use the canonical formula (netSales + tips - platformFees).
  const paymentVolumeForFiltered = isFiltered
    ? await prisma.payment.aggregate({
        where: { venueId, ...dateFilter, status: 'COMPLETED', ...paymentLevelFilter },
        _sum: { amount: true },
      }).then(r => Number(r._sum.amount || 0))
    : 0

  const totalCollected = isFiltered
    ? paymentVolumeForFiltered + tips - platformFees
    : (netSales !== null ? netSales + tips - platformFees : 0)

  const netProfit = isFiltered
    ? paymentVolumeForFiltered - platformFees - staffCommissions
    : (netSales !== null ? netSales - platformFees - staffCommissions : 0)
```

- [ ] **Step 8: Update the `summary` object and return value**

```ts
  const summary: SalesSummaryMetrics = {
    grossSales,
    items,
    serviceCosts,
    discounts,
    refunds,
    netSales,
    deferredSales,
    taxes,
    tips,
    platformFees,
    staffCommissions,
    commissions: platformFees,
    totalCollected,
    netProfit,
    transactionCount: transactionCountResult,
  }
```

And at the bottom, update the return:
```ts
  return {
    dateRange: { startDate: parsedStartDate, endDate: parsedEndDate },
    reportType,
    summary,
    byPaymentMethod,
    byPeriod,
    filtered: isFiltered,
  }
```

- [ ] **Step 9: Skip `byPaymentMethod` when filtered**

In the `if (groupBy === 'paymentMethod')` block, wrap with:

```ts
  if (groupBy === 'paymentMethod' && !isFiltered) {
    // existing aggregation…
  }
```

- [ ] **Step 10: Type-check + lint**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit && npm run lint -- --quiet src/services/dashboard/sales-summary.dashboard.service.ts
```
Expected: PASS.

- [ ] **Step 11: Smoke-test with a real query**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx ts-node -e "
import { getSalesSummary } from './src/services/dashboard/sales-summary.dashboard.service'
const VENUE = process.env.SMOKE_VENUE_ID || 'cmisvi38o001fhr2828ygmxi2'
getSalesSummary(VENUE, {
  startDate: new Date(Date.now() - 7*86400000).toISOString(),
  endDate: new Date().toISOString(),
  paymentMethod: 'CASH',
}).then(r => console.log(JSON.stringify({
  filtered: r.filtered,
  grossSales: r.summary.grossSales,
  netSales: r.summary.netSales,
  totalCollected: r.summary.totalCollected,
  txCount: r.summary.transactionCount,
}, null, 2))).catch(e => { console.error(e); process.exit(1) })
" 2>&1 | tail -20
```

Expected: `filtered: true`, `grossSales: null`, `totalCollected` >= 0, `txCount` integer.

- [ ] **Step 12: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): apply payment-method filter to summary metrics

Wires buildPaymentWhereFilter and buildPaymentSqlClause into
getSalesSummary. When the filter is active:
- Order-level queries (gross sales, deferred, taxes, discounts) are
  skipped and the corresponding fields return null in the summary.
- Payment-level queries (refunds, tips, txCount, platform fees, staff
  commissions) narrow to the filter.
- byPaymentMethod aggregation is skipped (tautological under filter).
- totalCollected / netProfit are recomputed from filtered payment
  volume + tips - platformFees.

filtered flag is surfaced on the response so the frontend can hide
hidden rows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 5: Apply filter to time-period raw SQL

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts` (`calculateTimePeriodMetrics`)

- [ ] **Step 1: Thread filter params through the helper signature**

Update the function signature:

```ts
async function calculateTimePeriodMetrics(
  venueId: string,
  startDate: Date,
  endDate: Date,
  reportType: ReportType,
  timezone: string,
  merchantAccountId?: string,
  paymentMethod?: PaymentMethodFilter,
  cardType?: CardTypeFilter,
): Promise<TimePeriodMetrics[]> {
  // existing …
  const isFiltered = !!paymentMethod
  const { clause: paymentSqlClause } = buildPaymentSqlClause(paymentMethod, cardType, 5)
  const { clause: paymentSqlClauseWithPrefix } = buildPaymentSqlClause(paymentMethod, cardType, 5, 'p')
```

And update the only caller (in `getSalesSummary`):
```ts
    byPeriod = await calculateTimePeriodMetrics(
      venueId,
      parsedStartDate,
      parsedEndDate,
      reportType,
      timezone,
      merchantAccountId,
      paymentMethod,
      cardType,
    )
```

- [ ] **Step 2: Skip order-level period queries when filtered**

Wrap `orderMetricsQuery` and `deferredQuery` executions in a conditional. When `isFiltered`, return an empty array for those.

Replace the `Promise.all` block with:

```ts
  const [orderMetrics, paymentMetrics, refundsMetrics, deferredMetrics, platformFeesMetrics, staffCommissionsMetrics] = await Promise.all([
    isFiltered
      ? Promise.resolve([] as Array<{ period: Date | number; gross_sales: number; taxes: number; discounts: number; order_count: bigint }>)
      : prisma.$queryRawUnsafe(orderMetricsQuery, ...queryParams),
    prisma.$queryRawUnsafe<Array<{ period: Date | number; payment_amount: number; tips: number; transaction_count: bigint }>>(
      paymentMetricsQuery + paymentSqlClause + ` GROUP BY ${groupByExpression} ORDER BY ${orderByExpression}`,
      ...queryParams,
    ),
    prisma.$queryRawUnsafe<Array<{ period: Date | number; refunds: number }>>(refundsQuery + paymentSqlClause + ` GROUP BY ${groupByExpression} ORDER BY ${orderByExpression}`, ...queryParams),
    isFiltered
      ? Promise.resolve([] as Array<{ period: Date | number; deferred_sales: number }>)
      : prisma.$queryRawUnsafe(deferredQuery, ...queryParams),
    prisma.$queryRawUnsafe<Array<{ period: Date | number; platform_fees: number }>>(
      platformFeesQuery + paymentSqlClauseWithPrefix + ` GROUP BY ${platformFeesGroupBy} ORDER BY ${platformFeesOrderBy}`,
      ...queryParams,
    ),
    prisma.$queryRawUnsafe<Array<{ period: Date | number; staff_commissions: number }>>(staffCommissionsQuery, ...queryParams),
  ])
```

You'll need to remove the existing `GROUP BY ${groupByExpression} ORDER BY ${orderByExpression}` from the `paymentMetricsQuery`, `refundsQuery`, and `platformFeesQuery` string definitions (move them after the optional clause).

- [ ] **Step 3: Update the `result.map` to handle null order metrics**

Inside the `periodsToProcess.map`, where the result is built:
```ts
    const grossSales = isFiltered ? null : Number(order?.gross_sales || 0)
    const discounts = isFiltered ? null : Number(order?.discounts || 0)
    const taxes = isFiltered ? null : Number(order?.taxes || 0)
    const deferredSales = isFiltered ? null : Number(deferred?.deferred_sales || 0)
    // …
    const netSales = grossSales !== null && discounts !== null
      ? grossSales - discounts - refunds
      : null
    const paymentAmount = Number(payment?.payment_amount || 0)
    const totalCollected = isFiltered
      ? paymentAmount + tips - platformFees
      : (netSales !== null ? netSales + tips - platformFees : 0)
    const netProfit = isFiltered
      ? paymentAmount - platformFees - staffCommissions
      : (netSales !== null ? netSales - platformFees - staffCommissions : 0)
```

Also update the `metrics` object: `items: grossSales`, `serviceCosts: grossSales !== null ? 0 : null`.

- [ ] **Step 4: Type-check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```
Expected: PASS.

- [ ] **Step 5: Smoke-test with a time-period report under filter**

```bash
npx ts-node -e "
import { getSalesSummary } from './src/services/dashboard/sales-summary.dashboard.service'
getSalesSummary('cmisvi38o001fhr2828ygmxi2', {
  startDate: new Date(Date.now() - 7*86400000).toISOString(),
  endDate: new Date().toISOString(),
  reportType: 'days',
  paymentMethod: 'CARD',
  cardType: 'AMEX',
}).then(r => console.log(JSON.stringify({ filtered: r.filtered, periods: r.byPeriod?.length, sample: r.byPeriod?.[0] }, null, 2))).catch(e => { console.error(e); process.exit(1) })
" 2>&1 | tail -25
```

Expected: `filtered: true`, periods >= 0, sample shows `grossSales: null, totalCollected: <num>`.

- [ ] **Step 6: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): apply payment filter to time-period breakdown

calculateTimePeriodMetrics now accepts paymentMethod + cardType and
appends the SQL clause to payment/refunds/platform-fees queries. Order-
level period queries are skipped under filter, and per-period metric
maps mirror the summary's null-when-filtered pattern.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Backend: MindForm Legacy QR Merge

### Task 6: Merge legacy QR into summary for MindForm

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts` (after summary computation, before return)

- [ ] **Step 1: Import the legacy helpers**

At the top of the file:
```ts
import { MINDFORM_NEW_VENUE_ID, getLegacyPayments } from '@/services/legacy/qrPayments.legacy.service'
```

- [ ] **Step 2: Add a helper to classify a legacy payment for filter**

After `buildPaymentWhereFilter`, add:

```ts
/**
 * Decide whether a legacy QR payment matches the active filter.
 * Legacy payments lack processorData.isInternational, so INTERNATIONAL
 * filter excludes them. AMEX excludes them too (Stripe legacy didn't
 * preserve AMEX brand reliably). CREDIT/DEBIT include them as CREDIT
 * (Stripe Connect default = credit-card-like).
 */
function legacyMatchesFilter(
  legacyMethod: string,
  paymentMethod: PaymentMethodFilter | undefined,
  cardType: CardTypeFilter | undefined,
): boolean {
  if (!paymentMethod) return true
  if (paymentMethod === 'QR_LEGACY') return true
  if (paymentMethod === 'CASH') return legacyMethod === 'CASH'
  if (paymentMethod === 'OTHER') return false
  // CARD
  if (legacyMethod !== 'CARD') return false
  if (!cardType) return true
  return cardType === 'CREDIT'
}
```

- [ ] **Step 3: After computing native summary, merge legacy for MindForm**

Insert this block right before the `byPaymentMethod` aggregation (around line 311):

```ts
  // ⚠️ MindForm legacy QR bridge. Mirrors the same gate used in
  // payment.dashboard.service.ts and mergedPayments.service.ts.
  // Delete this block when the native QR module ships (search for
  // MINDFORM_NEW_VENUE_ID across the repo to find all gates).
  let legacyAggregate: { amount: number; tips: number; count: number } | null = null
  if (venueId === MINDFORM_NEW_VENUE_ID) {
    const { rows: legacyRows } = await getLegacyPayments({
      startDate: parsedStartDate.toISOString(),
      endDate: parsedEndDate.toISOString(),
    })

    // status=COMPLETED, type=REGULAR (legacy maps ACCEPTED -> COMPLETED, no REFUND types yet)
    const eligible = legacyRows.filter(p => p.status === 'COMPLETED' && p.type !== 'REFUND')
    const matching = eligible.filter(p => legacyMatchesFilter(p.method, paymentMethod, cardType))

    legacyAggregate = {
      amount: matching.reduce((s, p) => s + Number(p.amount), 0),
      tips: matching.reduce((s, p) => s + Number(p.tipAmount), 0),
      count: matching.length,
    }

    // Add legacy amounts to the running totals. Legacy has no per-row
    // taxes/discounts/refunds/platform fees, so those stay at their
    // native value (the native query already excluded legacy rows by
    // virtue of being in a different DB).
    summary.tips += legacyAggregate.tips
    summary.transactionCount += legacyAggregate.count
    summary.totalCollected += legacyAggregate.amount + legacyAggregate.tips
    summary.netProfit += legacyAggregate.amount

    if (!isFiltered) {
      // grossSales / netSales include legacy revenue (it sold real food)
      summary.grossSales = (summary.grossSales ?? 0) + legacyAggregate.amount
      summary.items = (summary.items ?? 0) + legacyAggregate.amount
      summary.netSales = (summary.netSales ?? 0) + legacyAggregate.amount
    }
  }
```

- [ ] **Step 4: Add a QR_LEGACY entry to byPaymentMethod for MindForm**

In the `if (groupBy === 'paymentMethod' && !isFiltered)` block, after building `byPaymentMethod.sort(…)`, append:

```ts
    if (venueId === MINDFORM_NEW_VENUE_ID && legacyAggregate && legacyAggregate.count > 0) {
      const totalIncludingLegacy = (byPaymentMethod ?? []).reduce((s, p) => s + p.amount, 0) + legacyAggregate.amount + legacyAggregate.tips
      byPaymentMethod = [
        ...(byPaymentMethod ?? []),
        {
          method: 'QR_LEGACY',
          amount: legacyAggregate.amount + legacyAggregate.tips,
          count: legacyAggregate.count,
          percentage: 0,
        },
      ]
      // Recompute percentages against the legacy-inclusive total
      byPaymentMethod = byPaymentMethod.map(p => ({
        ...p,
        percentage: totalIncludingLegacy > 0
          ? Number(((p.amount / totalIncludingLegacy) * 100).toFixed(1))
          : 0,
      })).sort((a, b) => b.amount - a.amount)
    }
```

- [ ] **Step 5: When filter=QR_LEGACY, zero out native and use only legacy**

Above the running-totals merge, if `paymentMethod === 'QR_LEGACY'`, the native queries already returned zero (because `buildPaymentWhereFilter` produces `{id: '__never_match__'}`), so the summary additions naturally end up as legacy-only. **No additional code needed** — the existing structure handles it. Verify the smoke test in Task 9 confirms this.

- [ ] **Step 6: Type-check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```

- [ ] **Step 7: Smoke-test legacy merge on MindForm**

```bash
npx ts-node -e "
import { getSalesSummary } from './src/services/dashboard/sales-summary.dashboard.service'
const MINDFORM = 'cmisvi38o001fhr2828ygmxi2'
getSalesSummary(MINDFORM, {
  startDate: new Date(Date.now() - 30*86400000).toISOString(),
  endDate: new Date().toISOString(),
  groupBy: 'paymentMethod',
}).then(r => console.log(JSON.stringify({
  filtered: r.filtered,
  grossSales: r.summary.grossSales,
  totalCollected: r.summary.totalCollected,
  txCount: r.summary.transactionCount,
  buckets: r.byPaymentMethod?.map(b => ({ method: b.method, count: b.count, amount: b.amount })),
}, null, 2))).catch(e => { console.error(e); process.exit(1) })
" 2>&1 | tail -25
```

Expected: at least one `QR_LEGACY` bucket with `count > 0`. `grossSales` should be measurably higher than a pre-fix run.

- [ ] **Step 8: Smoke-test QR_LEGACY filter on MindForm**

```bash
npx ts-node -e "
import { getSalesSummary } from './src/services/dashboard/sales-summary.dashboard.service'
getSalesSummary('cmisvi38o001fhr2828ygmxi2', {
  startDate: new Date(Date.now() - 30*86400000).toISOString(),
  endDate: new Date().toISOString(),
  paymentMethod: 'QR_LEGACY',
}).then(r => console.log(JSON.stringify({
  filtered: r.filtered,
  totalCollected: r.summary.totalCollected,
  txCount: r.summary.transactionCount,
}, null, 2))).catch(e => { console.error(e); process.exit(1) })
" 2>&1 | tail -15
```

Expected: `filtered: true`, `totalCollected > 0` (legacy QR volume in last 30d), `txCount > 0`.

- [ ] **Step 9: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
fix(sales-summary): merge MindForm legacy QR payments into report

The sales-summary report skipped legacy QR data for MindForm (every
other dashboard surface already merged it). Aligns this report with
payment.dashboard.service and mergedPayments.service. QR_LEGACY also
becomes its own bucket in byPaymentMethod and a valid paymentMethod
filter value (MindForm-only — controller already rejects elsewhere).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Backend: Enriched breakdown

### Task 7: Implement `byPaymentMethodDetailed`

**Files:**
- Modify: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts` (new section after `byPaymentMethod`)

- [ ] **Step 1: Add a helper that buckets a payment**

After `legacyMatchesFilter`, add:

```ts
type BreakdownBucket = 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
type CardSubBucket = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

function bucketOf(method: string, cardBrand: string | null, isIntl: boolean): { bucket: BreakdownBucket; sub?: CardSubBucket } {
  if (method === 'CASH') return { bucket: 'CASH' }
  if (method === 'CREDIT_CARD' || method === 'DEBIT_CARD') {
    if (isIntl) return { bucket: 'CARD', sub: 'INTERNATIONAL' }
    if (cardBrand === 'AMERICAN_EXPRESS') return { bucket: 'CARD', sub: 'AMEX' }
    return { bucket: 'CARD', sub: method === 'CREDIT_CARD' ? 'CREDIT' : 'DEBIT' }
  }
  return { bucket: 'OTHER' }
}
```

- [ ] **Step 2: After `byPaymentMethod` block, build the detailed breakdown**

Replace the existing `byPaymentMethod` block with the structure that ALSO builds `byPaymentMethodDetailed` (under the same `groupBy === 'paymentMethod' && !isFiltered` gate). Add this AFTER the existing aggregation:

```ts
  let byPaymentMethodDetailed: PaymentMethodDetailedBreakdown[] | undefined

  if (groupBy === 'paymentMethod' && !isFiltered) {
    // Fetch the raw rows once with the columns we need to bucket.
    const rows = await prisma.payment.findMany({
      where: {
        venueId,
        ...dateFilter,
        status: 'COMPLETED',
        ...(merchantAccountId ? { merchantAccountId } : {}),
      },
      select: { id: true, method: true, cardBrand: true, processorData: true, amount: true, tipAmount: true },
    })

    // Platform fees per Payment (single raw query joined by paymentId).
    const feeRows = await prisma.$queryRaw<Array<{ payment_id: string; fee: number }>>`
      SELECT tc."paymentId" AS payment_id, tc."venueChargeAmount"::float AS fee
      FROM "TransactionCost" tc
      JOIN "Payment" p ON p.id = tc."paymentId"
      WHERE p."venueId" = ${venueId}
        AND p."createdAt" >= ${parsedStartDate}
        AND p."createdAt" <= ${parsedEndDate}
        ${merchantAccountId ? Prisma.sql`AND p."merchantAccountId" = ${merchantAccountId}` : Prisma.empty}
    `
    const feeMap = new Map(feeRows.map(f => [f.payment_id, Number(f.fee)]))

    // Refunds (negative-amount Payment rows of type=REFUND) — sum per bucket.
    const refundRows = await prisma.payment.findMany({
      where: {
        venueId,
        ...dateFilter,
        type: 'REFUND',
        ...(merchantAccountId ? { merchantAccountId } : {}),
      },
      select: { method: true, cardBrand: true, processorData: true, amount: true, tipAmount: true },
    })

    // Aggregate.
    type Acc = { amount: number; count: number; tips: number; refunds: number; platformFees: number }
    const buckets = new Map<BreakdownBucket, Acc>()
    const subs = new Map<CardSubBucket, Acc>()
    const ensure = <K>(map: Map<K, Acc>, k: K): Acc => {
      let a = map.get(k)
      if (!a) { a = { amount: 0, count: 0, tips: 0, refunds: 0, platformFees: 0 }; map.set(k, a) }
      return a
    }
    for (const r of rows) {
      const isIntl = !!(r.processorData as any)?.isInternational
      const { bucket, sub } = bucketOf(r.method, r.cardBrand, isIntl)
      const acc = ensure(buckets, bucket)
      acc.amount += Number(r.amount)
      acc.tips += Number(r.tipAmount)
      acc.count += 1
      acc.platformFees += feeMap.get(r.id) ?? 0
      if (sub) {
        const sa = ensure(subs, sub)
        sa.amount += Number(r.amount)
        sa.tips += Number(r.tipAmount)
        sa.count += 1
        sa.platformFees += feeMap.get(r.id) ?? 0
      }
    }
    for (const r of refundRows) {
      const isIntl = !!(r.processorData as any)?.isInternational
      const { bucket } = bucketOf(r.method, r.cardBrand, isIntl)
      const acc = ensure(buckets, bucket)
      acc.refunds += Math.abs(Number(r.amount) + Number(r.tipAmount))
    }

    // Append MindForm legacy as a CARD-less, OTHER-less own bucket.
    if (legacyAggregate && legacyAggregate.count > 0) {
      const acc = ensure(buckets, 'QR_LEGACY')
      acc.amount = legacyAggregate.amount
      acc.tips = legacyAggregate.tips
      acc.count = legacyAggregate.count
      // legacy has no platform fees recorded
    }

    const total = [...buckets.values()].reduce((s, a) => s + a.amount + a.tips, 0)
    byPaymentMethodDetailed = (['CARD', 'CASH', 'OTHER', 'QR_LEGACY'] as BreakdownBucket[])
      .filter(b => buckets.has(b))
      .map(b => {
        const a = buckets.get(b)!
        const entry: PaymentMethodDetailedBreakdown = {
          bucket: b,
          amount: a.amount + a.tips,
          count: a.count,
          percentage: total > 0 ? Number((((a.amount + a.tips) / total) * 100).toFixed(1)) : 0,
          tips: a.tips,
          refunds: a.refunds,
          platformFees: a.platformFees,
        }
        if (b === 'CARD') {
          const cardTotal = a.amount + a.tips
          entry.subBuckets = (['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL'] as CardSubBucket[])
            .filter(s => subs.has(s))
            .map(s => {
              const sa = subs.get(s)!
              return {
                type: s,
                amount: sa.amount + sa.tips,
                count: sa.count,
                percentage: cardTotal > 0 ? Number((((sa.amount + sa.tips) / cardTotal) * 100).toFixed(1)) : 0,
                platformFees: sa.platformFees,
              }
            })
        }
        return entry
      })
  }
```

- [ ] **Step 3: Add `byPaymentMethodDetailed` to the return**

```ts
  return {
    dateRange: { startDate: parsedStartDate, endDate: parsedEndDate },
    reportType,
    summary,
    byPaymentMethod,
    byPaymentMethodDetailed,
    byPeriod,
    filtered: isFiltered,
  }
```

- [ ] **Step 4: Smoke-test detailed breakdown on a TPV venue**

```bash
npx ts-node -e "
import { getSalesSummary } from './src/services/dashboard/sales-summary.dashboard.service'
const VENUE = process.env.SMOKE_VENUE_ID || 'cmisvi38o001fhr2828ygmxi2'
getSalesSummary(VENUE, {
  startDate: new Date(Date.now() - 30*86400000).toISOString(),
  endDate: new Date().toISOString(),
  groupBy: 'paymentMethod',
}).then(r => console.log(JSON.stringify(r.byPaymentMethodDetailed, null, 2))).catch(e => { console.error(e); process.exit(1) })
" 2>&1 | tail -40
```

Expected: an array of buckets; the CARD entry has `subBuckets` with up to 4 entries. Each shows count, amount, percentage, platformFees.

- [ ] **Step 5: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
feat(sales-summary): enriched byPaymentMethodDetailed breakdown

Adds Card → {Credit, Debit, AMEX, International} sub-buckets and
platform commission per bucket. Surfaces the most actionable signal —
e.g. AMEX really costing 4.5% — without needing to filter.

Always computed when groupBy=paymentMethod and no filter is active.
MindForm's QR_LEGACY is included as its own bucket.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Backend: Tests

### Task 8: Test scaffolding

**Files:**
- Create: `avoqado-server/src/services/dashboard/sales-summary.dashboard.service.test.ts`

- [ ] **Step 1: Find an existing service test to mirror the harness**

```bash
ls /Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/services/dashboard/*.test.ts 2>/dev/null | head -3
```

Open the first match to copy the imports / db-reset pattern. Most services in this repo use `beforeEach` with `prisma.$transaction([…truncations…])` against a real test DB, seeded with a small fixture.

- [ ] **Step 2: Create the file with scaffolding only**

```ts
import { getSalesSummary, buildPaymentWhereFilter } from './sales-summary.dashboard.service'
import prisma from '@/utils/prismaClient'

const TEST_VENUE_ID = 'test-sales-summary-venue'
const RANGE_START = '2026-01-01T00:00:00Z'
const RANGE_END = '2026-01-31T23:59:59Z'

beforeAll(async () => {
  // Create a deterministic venue + 6 orders + 8 payments fixture.
  // Caller-owned cleanup so we don't depend on db isolation.
  await prisma.payment.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.order.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.venue.deleteMany({ where: { id: TEST_VENUE_ID } })
  // …seed fixture here in next steps
})

afterAll(async () => {
  await prisma.payment.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.order.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.venue.deleteMany({ where: { id: TEST_VENUE_ID } })
})

describe('buildPaymentWhereFilter', () => {
  it('returns empty when paymentMethod undefined', () => {
    expect(buildPaymentWhereFilter(undefined, undefined)).toEqual({})
  })
  it('returns CASH method filter', () => {
    expect(buildPaymentWhereFilter('CASH', undefined)).toEqual({ method: 'CASH' })
  })
  it('returns AMEX brand filter excluding international', () => {
    expect(buildPaymentWhereFilter('CARD', 'AMEX')).toMatchObject({
      cardBrand: 'AMERICAN_EXPRESS',
      NOT: { processorData: { path: ['isInternational'], equals: true } },
    })
  })
  it('returns INTERNATIONAL via JSON path', () => {
    expect(buildPaymentWhereFilter('CARD', 'INTERNATIONAL')).toEqual({
      processorData: { path: ['isInternational'], equals: true },
    })
  })
})
```

- [ ] **Step 3: Run the unit tests**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest src/services/dashboard/sales-summary.dashboard.service.test.ts -t buildPaymentWhereFilter
```
Expected: PASS (4 tests).

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.test.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
test(sales-summary): scaffold + unit tests for buildPaymentWhereFilter

Covers the four most-distinctive mappings: empty, CASH, AMEX
(non-international), INTERNATIONAL. Integration tests follow.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 9: Integration tests — filter scenarios

**Files:**
- Modify: same test file

- [ ] **Step 1: Add a fixture seeder helper**

Add at the top of the file (after imports):

```ts
async function seedFixture() {
  // 1 venue, 4 orders, 6 payments designed to cover every filter branch.
  await prisma.venue.create({
    data: {
      id: TEST_VENUE_ID,
      slug: 'sales-summary-test',
      name: 'Sales Summary Test Venue',
      timezone: 'America/Mexico_City',
      organizationId: (await prisma.organization.findFirst({ select: { id: true } }))!.id,
      // Fields the schema requires — fill from a successful Venue.create elsewhere if needed.
    } as any,
  })

  // Helper to create an order + payment pair at a fixed date.
  const at = (day: number) => new Date(`2026-01-${String(day).padStart(2, '0')}T12:00:00Z`)
  const mkOrder = async (i: number, total: number) =>
    prisma.order.create({
      data: {
        venueId: TEST_VENUE_ID,
        orderNumber: `T-${i}`,
        subtotal: total - total * 0.16,
        taxAmount: total * 0.16,
        total,
        discountAmount: 0,
        tipAmount: 0,
        paidAmount: total,
        remainingBalance: 0,
        paymentStatus: 'COMPLETED',
        status: 'COMPLETED',
        createdAt: at(i + 1),
      } as any,
    })

  const o1 = await mkOrder(0, 1000) // CASH
  const o2 = await mkOrder(1, 1500) // CREDIT VISA
  const o3 = await mkOrder(2, 800)  // DEBIT VISA
  const o4 = await mkOrder(3, 2000) // AMEX (national)

  const mkPay = async (orderId: string, day: number, args: any) =>
    prisma.payment.create({
      data: {
        venueId: TEST_VENUE_ID,
        orderId,
        amount: args.amount,
        tipAmount: args.tip ?? 0,
        method: args.method,
        status: 'COMPLETED',
        type: 'REGULAR',
        feePercentage: 0,
        feeAmount: 0,
        netAmount: args.amount,
        createdAt: at(day + 1),
        cardBrand: args.cardBrand ?? null,
        processorData: args.processorData ?? null,
        source: 'TPV',
        splitType: 'FULLPAYMENT',
      } as any,
    })

  await mkPay(o1.id, 0, { amount: 1000, method: 'CASH' })
  await mkPay(o2.id, 1, { amount: 1500, method: 'CREDIT_CARD', cardBrand: 'VISA' })
  await mkPay(o3.id, 2, { amount: 800,  method: 'DEBIT_CARD',  cardBrand: 'VISA' })
  await mkPay(o4.id, 3, { amount: 2000, method: 'CREDIT_CARD', cardBrand: 'AMERICAN_EXPRESS' })
  // International credit
  const o5 = await mkOrder(4, 1200)
  await mkPay(o5.id, 4, { amount: 1200, method: 'CREDIT_CARD', cardBrand: 'VISA', processorData: { isInternational: true } })
  // Digital wallet
  const o6 = await mkOrder(5, 700)
  await mkPay(o6.id, 5, { amount: 700, method: 'DIGITAL_WALLET' })
}
```

(Adjust the `Venue.create` args to whatever the schema actually requires — if the test bombs on a missing required field, copy from another passing test.)

Then update `beforeAll` to call it after the cleanup:
```ts
beforeAll(async () => {
  await prisma.payment.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.order.deleteMany({ where: { venueId: TEST_VENUE_ID } })
  await prisma.venue.deleteMany({ where: { id: TEST_VENUE_ID } })
  await seedFixture()
})
```

- [ ] **Step 2: Add the filter test cases**

Append this `describe` block:

```ts
describe('getSalesSummary filter behaviour', () => {
  const range = { startDate: RANGE_START, endDate: RANGE_END }

  it('no filter: filtered=false, all metrics present', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, range)
    expect(r.filtered).toBe(false)
    expect(r.summary.grossSales).not.toBeNull()
    expect(r.summary.transactionCount).toBeGreaterThan(0)
  })

  it('CASH filter: only the $1000 cash payment counts', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CASH' })
    expect(r.filtered).toBe(true)
    expect(r.summary.grossSales).toBeNull()
    expect(r.summary.discounts).toBeNull()
    expect(r.summary.taxes).toBeNull()
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(1000, 2)
  })

  it('CARD only (no cardType): credit + debit + AMEX + international all count', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CARD' })
    expect(r.summary.transactionCount).toBe(4)
    expect(r.summary.totalCollected).toBeCloseTo(1500 + 800 + 2000 + 1200, 2)
  })

  it('CARD + CREDIT: excludes AMEX and international', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CARD', cardType: 'CREDIT' })
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(1500, 2)
  })

  it('CARD + DEBIT: excludes AMEX and international', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CARD', cardType: 'DEBIT' })
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(800, 2)
  })

  it('CARD + AMEX: only the national AMEX payment', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CARD', cardType: 'AMEX' })
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(2000, 2)
  })

  it('CARD + INTERNATIONAL: only the international VISA payment', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CARD', cardType: 'INTERNATIONAL' })
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(1200, 2)
  })

  it('OTHER: only the digital wallet payment', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'OTHER' })
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(700, 2)
  })

  it('byPaymentMethod is skipped when filtered', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CASH', groupBy: 'paymentMethod' })
    expect(r.byPaymentMethod).toBeUndefined()
  })

  it('byPaymentMethodDetailed present when not filtered + groupBy=paymentMethod', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, groupBy: 'paymentMethod' })
    expect(r.byPaymentMethodDetailed).toBeDefined()
    const card = r.byPaymentMethodDetailed!.find(b => b.bucket === 'CARD')
    expect(card?.subBuckets?.map(s => s.type).sort()).toEqual(['AMEX', 'CREDIT', 'DEBIT', 'INTERNATIONAL'])
  })
})
```

- [ ] **Step 3: Run the integration tests**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest src/services/dashboard/sales-summary.dashboard.service.test.ts -t 'getSalesSummary filter behaviour'
```

Expected: 10 tests pass.

If `seedFixture` fails on a missing required `Venue` field, copy from another integration test that already creates a venue. The schema has evolved; whatever lives in another `*.test.ts` is the current contract.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.test.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
test(sales-summary): integration coverage for payment filters

Seeds a 6-payment fixture spanning CASH, CREDIT (VISA), DEBIT (VISA),
AMEX, INTERNATIONAL VISA, and DIGITAL_WALLET. Each filter combination
is asserted against the deterministic totals.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 10: Controller tests + edge cases

**Files:**
- Modify: same test file (append) — or create a separate controller test if the project has them.

- [ ] **Step 1: Add edge-case tests**

```ts
describe('getSalesSummary edge cases', () => {
  const range = { startDate: RANGE_START, endDate: RANGE_END }

  it('cardType without paymentMethod=CARD is silently accepted (no error, no narrowing)', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'CASH', cardType: 'AMEX' })
    // CASH wins; cardType ignored at the service layer (controller logs warn but doesn't reject)
    expect(r.summary.transactionCount).toBe(1)
    expect(r.summary.totalCollected).toBeCloseTo(1000, 2)
  })

  it('QR_LEGACY filter on a non-MindForm venue yields zero (controller would reject; service is defensive)', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, paymentMethod: 'QR_LEGACY' })
    expect(r.summary.transactionCount).toBe(0)
    expect(r.summary.totalCollected).toBe(0)
  })

  it('returns daily byPeriod under filter with grossSales=null per period', async () => {
    const r = await getSalesSummary(TEST_VENUE_ID, { ...range, reportType: 'days', paymentMethod: 'CARD' })
    expect(r.byPeriod).toBeDefined()
    expect(r.byPeriod!.length).toBeGreaterThan(0)
    expect(r.byPeriod![0].metrics.grossSales).toBeNull()
  })
})
```

- [ ] **Step 2: Run all tests in the file**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest src/services/dashboard/sales-summary.dashboard.service.test.ts
```
Expected: all green.

- [ ] **Step 3: Lint + full build sanity**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run lint -- --quiet && npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server add src/services/dashboard/sales-summary.dashboard.service.test.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-server commit -m "$(cat <<'EOF'
test(sales-summary): edge cases — cardType-without-CARD, non-mindform QR_LEGACY, byPeriod under filter

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 6 — Frontend: Service & State

### Task 11: Extend frontend service module

**Files:**
- Modify: `avoqado-web-dashboard/src/services/reports/salesSummary.service.ts`

- [ ] **Step 1: Extend types and constant**

Add at the top:
```ts
// Mirrors avoqado-server/src/services/legacy/qrPayments.legacy.service.ts
// Kept in sync manually; comment in the other file points here.
export const MINDFORM_VENUE_ID = 'cmisvi38o001fhr2828ygmxi2'

export type PaymentMethodFilter = 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER'
export type CardTypeFilter = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
```

Extend `SalesSummaryFilters`:
```ts
export interface SalesSummaryFilters {
  venueId?: string
  startDate: string
  endDate: string
  groupBy?: GroupBy
  reportType?: ReportType
  merchantAccountId?: string
  paymentMethod?: PaymentMethodFilter
  cardType?: CardTypeFilter
}
```

Extend metrics + response:
```ts
export interface SalesSummaryMetrics {
  grossSales: number | null
  items: number | null
  serviceCosts: number | null
  discounts: number | null
  refunds: number
  netSales: number | null
  deferredSales: number | null
  taxes: number | null
  tips: number
  platformFees: number
  staffCommissions: number
  commissions: number
  totalCollected: number
  netProfit: number
  transactionCount: number
}

export interface PaymentMethodDetailedBreakdown {
  bucket: 'CARD' | 'CASH' | 'OTHER' | 'QR_LEGACY'
  amount: number
  count: number
  percentage: number
  tips: number
  refunds: number
  platformFees: number
  subBuckets?: Array<{
    type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
    amount: number
    count: number
    percentage: number
    platformFees: number
  }>
}

export interface SalesSummaryResponse {
  dateRange: { startDate: string; endDate: string }
  reportType: ReportType
  summary: SalesSummaryMetrics
  byPaymentMethod?: PaymentMethodBreakdown[]
  byPaymentMethodDetailed?: PaymentMethodDetailedBreakdown[]
  byPeriod?: TimePeriodMetrics[]
  filtered: boolean
}
```

- [ ] **Step 2: Forward new params in `fetchSalesSummary`**

```ts
export async function fetchSalesSummary(filters: SalesSummaryFilters): Promise<SalesSummaryResponse> {
  const response = await api.get<ApiResponse<SalesSummaryResponse>>(
    '/api/v1/dashboard/reports/sales-summary',
    {
      params: {
        startDate: filters.startDate,
        endDate: filters.endDate,
        groupBy: filters.groupBy || 'none',
        reportType: filters.reportType || 'summary',
        ...(filters.merchantAccountId ? { merchantAccountId: filters.merchantAccountId } : {}),
        ...(filters.paymentMethod ? { paymentMethod: filters.paymentMethod } : {}),
        ...(filters.paymentMethod === 'CARD' && filters.cardType ? { cardType: filters.cardType } : {}),
      },
      withCredentials: true,
    },
  )
  return response.data.data
}
```

- [ ] **Step 3: Build + lint**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc --noEmit && npm run lint -- --quiet src/services/reports/salesSummary.service.ts
```
Expected: PASS.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/services/reports/salesSummary.service.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
feat(reports): sales-summary service supports paymentMethod + cardType filters

Adds PaymentMethodFilter, CardTypeFilter types; extends
SalesSummaryFilters; surfaces the filtered flag and the new
byPaymentMethodDetailed shape. Exports MINDFORM_VENUE_ID for UI gating.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 12: i18n keys

**Files:**
- Modify: `avoqado-web-dashboard/src/locales/es/reports.json`
- Modify: `avoqado-web-dashboard/src/locales/en/reports.json`

- [ ] **Step 1: Find the existing `filterBy` block in `es` and replace**

In `es/reports.json`, replace the existing `"filterBy"` block (lines 166-170 according to earlier grep) with:

```json
      "filterBy": {
        "label": "Filtrar por",
        "description": "Restringe el reporte a un método o tipo de tarjeta",
        "longDescription": "Aplica filtros para ver solo los pagos del método o tipo de tarjeta seleccionado. Al filtrar, se ocultan las métricas a nivel orden (ventas brutas, impuestos, descuentos) porque no se pueden atribuir a un método de pago específico.",
        "active": "Filtrado",
        "clear": "Quitar filtro",
        "none": "Todos",
        "filteredMessage": "Quita el filtro para ver la distribución completa",
        "hiddenMetricsMessage": "Métricas a nivel orden ocultas bajo filtro",
        "paymentMethod": {
          "label": "Método de pago",
          "options": {
            "all": "Todos los métodos",
            "allDesc": "Sin filtro de método de pago",
            "cash": "Efectivo",
            "cashDesc": "Solo pagos en efectivo",
            "card": "Tarjeta",
            "cardDesc": "Solo pagos con tarjeta de crédito o débito",
            "qrLegacy": "QR Legacy",
            "qrLegacyDesc": "Solo pagos del sistema QR previo",
            "other": "Otro",
            "otherDesc": "Wallet digital, transferencia, cripto"
          }
        },
        "cardType": {
          "label": "Tipo de tarjeta",
          "options": {
            "all": "Todas las tarjetas",
            "allDesc": "Sin filtro por tipo de tarjeta",
            "credit": "Crédito",
            "creditDesc": "Tarjetas de crédito nacionales (Visa, Mastercard)",
            "debit": "Débito",
            "debitDesc": "Tarjetas de débito nacionales (Visa, Mastercard)",
            "amex": "AMEX",
            "amexDesc": "American Express (todas)",
            "international": "Internacional",
            "internationalDesc": "Tarjetas emitidas en el extranjero"
          }
        }
      }
```

- [ ] **Step 2: Mirror in `en/reports.json`**

```json
      "filterBy": {
        "label": "Filter by",
        "description": "Restrict the report to a payment method or card type",
        "longDescription": "Filter to show only payments matching the chosen method or card type. Order-level metrics (gross sales, taxes, discounts) are hidden under filter because they cannot be attributed to a single payment method.",
        "active": "Filtered",
        "clear": "Clear filter",
        "none": "All",
        "filteredMessage": "Clear the filter to see the full distribution",
        "hiddenMetricsMessage": "Order-level metrics hidden under filter",
        "paymentMethod": {
          "label": "Payment method",
          "options": {
            "all": "All methods",
            "allDesc": "No payment method filter",
            "cash": "Cash",
            "cashDesc": "Cash payments only",
            "card": "Card",
            "cardDesc": "Credit or debit card payments only",
            "qrLegacy": "QR Legacy",
            "qrLegacyDesc": "Payments from the previous QR system",
            "other": "Other",
            "otherDesc": "Digital wallet, transfer, crypto"
          }
        },
        "cardType": {
          "label": "Card type",
          "options": {
            "all": "All cards",
            "allDesc": "No card type filter",
            "credit": "Credit",
            "creditDesc": "Domestic credit cards (Visa, Mastercard)",
            "debit": "Debit",
            "debitDesc": "Domestic debit cards (Visa, Mastercard)",
            "amex": "AMEX",
            "amexDesc": "American Express (all)",
            "international": "International",
            "internationalDesc": "Foreign-issued cards"
          }
        }
      }
```

- [ ] **Step 3: Check if `fr/reports.json` exists**

```bash
ls /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/locales/fr/reports.json 2>/dev/null && echo "exists" || echo "not present"
```

If `exists`, mirror the `en` block translated to French. If `not present`, skip — the namespace isn't configured for French.

- [ ] **Step 4: ESLint check for missing translation keys**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run lint -- --quiet src/locales 2>&1 | tail -5
```
Expected: no missing-key errors.

- [ ] **Step 5: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/locales/es/reports.json src/locales/en/reports.json
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
i18n(reports): add filterBy keys for sales-summary payment filter

Two-level filter labels (method + card type) plus the
filtered/clear/active strings used by the new pill, badge, and empty
states.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 7 — Frontend: Filter Panel UI

### Task 13: Filter state and persistence

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Reports/SalesSummary.tsx`

- [ ] **Step 1: Import new types and constant**

Find the existing import from `salesSummary.service` and extend:
```ts
import {
  fetchSalesSummary,
  salesSummaryKeys,
  type ReportType,
  type GroupBy as ApiGroupBy,
  type PaymentMethodFilter,
  type CardTypeFilter,
  MINDFORM_VENUE_ID,
} from '@/services/reports/salesSummary.service'
```

- [ ] **Step 2: Extend the preferences shape and `loadPreferences`**

Update the `SalesSummaryPreferences` interface:
```ts
interface SalesSummaryPreferences {
  selectedMetrics: MetricKey[]
  chartMetric: MetricKey
  viewType: string
  reportType: string
  groupBy: string
  paymentMethodFilter?: PaymentMethodFilter | null
  cardTypeFilter?: CardTypeFilter | null
}
```

- [ ] **Step 3: Add state**

Inside `SalesSummary` after the existing `useState` blocks:
```ts
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter | null>(
    () => savedPrefs?.paymentMethodFilter ?? null,
  )
  const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter | null>(
    () => savedPrefs?.cardTypeFilter ?? null,
  )
  const [pendingPaymentMethodFilter, setPendingPaymentMethodFilter] = useState<PaymentMethodFilter | null>(null)
  const [pendingCardTypeFilter, setPendingCardTypeFilter] = useState<CardTypeFilter | null>(null)

  const isFiltered = paymentMethodFilter !== null
  const isMindform = venueId === MINDFORM_VENUE_ID
```

- [ ] **Step 4: Persist new fields**

Update the existing persistence `useEffect`:
```ts
  useEffect(() => {
    savePreferences({
      selectedMetrics,
      chartMetric,
      viewType,
      reportType,
      groupBy,
      paymentMethodFilter,
      cardTypeFilter,
    })
  }, [selectedMetrics, chartMetric, viewType, reportType, groupBy, paymentMethodFilter, cardTypeFilter])
```

- [ ] **Step 5: Wire filter into the API request**

Update `apiFilters`:
```ts
  const apiFilters = useMemo(() => ({
    venueId,
    startDate: dateRange.from.toISOString(),
    endDate: dateRange.to.toISOString(),
    groupBy: 'paymentMethod' as ApiGroupBy,
    reportType: reportType as ReportType,
    ...(merchantAccountId ? { merchantAccountId } : {}),
    ...(paymentMethodFilter ? { paymentMethod: paymentMethodFilter } : {}),
    ...(paymentMethodFilter === 'CARD' && cardTypeFilter ? { cardType: cardTypeFilter } : {}),
  }), [venueId, dateRange.from, dateRange.to, reportType, merchantAccountId, paymentMethodFilter, cardTypeFilter])
```

- [ ] **Step 6: Add panel kind + apply/clear callbacks**

Extend `activePanel`'s union to include `'filterBy'`:
```ts
const [activePanel, setActivePanel] = useState<'main' | 'reportType' | 'viewType' | 'groupBy' | 'terminal' | 'metrics' | 'merchant' | 'filterBy' | null>('main')
```

Add helpers:
```ts
  const hasFilterByChange =
    pendingPaymentMethodFilter !== paymentMethodFilter ||
    pendingCardTypeFilter !== cardTypeFilter

  const applyFilterBy = () => {
    setPaymentMethodFilter(pendingPaymentMethodFilter)
    // Clear card sub if not on CARD anymore
    setCardTypeFilter(pendingPaymentMethodFilter === 'CARD' ? pendingCardTypeFilter : null)
    setControlsOpen(false)
    setActivePanel('main')
  }

  const clearFilterBy = () => {
    setPaymentMethodFilter(null)
    setCardTypeFilter(null)
  }
```

Update the existing `openControlPanel` to initialize pending values from current:
```ts
  // …existing code…
  setPendingPaymentMethodFilter(paymentMethodFilter)
  setPendingCardTypeFilter(cardTypeFilter)
```

- [ ] **Step 7: Type-check**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc --noEmit
```

- [ ] **Step 8: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/pages/Reports/SalesSummary.tsx
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
feat(reports): sales-summary filter state + persistence

State, pending/applied separation, localStorage persistence, and
apiFilters wiring for paymentMethod + cardType. UI rendering follows.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 14: Filter Sub-Panel UI

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Reports/SalesSummary.tsx`

- [ ] **Step 1: Replace the TODO `onClick` on the main panel ControlRow**

Find the `ControlRow` for `filterBy` (currently `onClick={() => {/* TODO: Implement filter panel */}}`) and replace:
```tsx
                  <ControlRow
                    label={t('salesSummary.controls.filterBy.label')}
                    description={t('salesSummary.controls.filterBy.description')}
                    value={
                      paymentMethodFilter === null
                        ? t('salesSummary.controls.filterBy.none')
                        : paymentMethodFilter === 'CARD' && cardTypeFilter
                          ? t(`salesSummary.controls.filterBy.cardType.options.${cardTypeFilter.toLowerCase()}`)
                          : t(`salesSummary.controls.filterBy.paymentMethod.options.${paymentMethodFilter.toLowerCase()}`)
                    }
                    onClick={() => setActivePanel('filterBy')}
                  />
```

- [ ] **Step 2: Add the new sub-panel JSX**

Inside the `<SheetContent>`, after the existing Metrics sub-panel, add a new sub-panel block. Mirror the existing pattern (`reportType` panel structure). Use this exact block:

```tsx
              {/* Filter By Sub-Panel */}
              <div
                className={cn(
                  'absolute inset-0 transition-transform duration-300 ease-in-out bg-background flex flex-col',
                  activePanel === 'filterBy' ? 'translate-x-0' : 'translate-x-full'
                )}
              >
                <div className="flex items-center justify-between p-4 border-b">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-10 w-10 rounded-full cursor-pointer"
                    onClick={() => setActivePanel('main')}
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </Button>
                  <Button
                    className="rounded-full px-6 cursor-pointer"
                    disabled={!hasFilterByChange}
                    onClick={applyFilterBy}
                  >
                    {t('salesSummary.controls.apply')}
                  </Button>
                </div>
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  <div className="space-y-3">
                    <h2 className="text-2xl font-bold">{t('salesSummary.controls.filterBy.label')}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {t('salesSummary.controls.filterBy.longDescription')}
                    </p>
                  </div>

                  {/* Level 1: Payment Method */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t('salesSummary.controls.filterBy.paymentMethod.label')}
                    </h3>
                    <RadioGroup
                      value={pendingPaymentMethodFilter ?? 'all'}
                      onValueChange={(v) => {
                        const next = v === 'all' ? null : (v.toUpperCase() as PaymentMethodFilter)
                        setPendingPaymentMethodFilter(next)
                        if (next !== 'CARD') setPendingCardTypeFilter(null)
                      }}
                      className="space-y-1"
                    >
                      <ControlOption
                        value="all"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.all')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.allDesc')}
                        isSelected={pendingPaymentMethodFilter === null}
                      />
                      <ControlOption
                        value="cash"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.cash')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.cashDesc')}
                        isSelected={pendingPaymentMethodFilter === 'CASH'}
                        icon={<Banknote className="w-4 h-4 text-muted-foreground" />}
                      />
                      <ControlOption
                        value="card"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.card')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.cardDesc')}
                        isSelected={pendingPaymentMethodFilter === 'CARD'}
                        icon={<CreditCard className="w-4 h-4 text-muted-foreground" />}
                      />
                      {isMindform && (
                        <ControlOption
                          value="qr_legacy"
                          label={t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacy')}
                          description={t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacyDesc')}
                          isSelected={pendingPaymentMethodFilter === 'QR_LEGACY'}
                        />
                      )}
                      <ControlOption
                        value="other"
                        label={t('salesSummary.controls.filterBy.paymentMethod.options.other')}
                        description={t('salesSummary.controls.filterBy.paymentMethod.options.otherDesc')}
                        isSelected={pendingPaymentMethodFilter === 'OTHER'}
                        icon={<Smartphone className="w-4 h-4 text-muted-foreground" />}
                      />
                    </RadioGroup>
                  </div>

                  {/* Level 2: Card Type — only when CARD selected */}
                  {pendingPaymentMethodFilter === 'CARD' && (
                    <div className="space-y-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {t('salesSummary.controls.filterBy.cardType.label')}
                      </h3>
                      <RadioGroup
                        value={pendingCardTypeFilter ?? 'all'}
                        onValueChange={(v) => setPendingCardTypeFilter(v === 'all' ? null : (v.toUpperCase() as CardTypeFilter))}
                        className="space-y-1"
                      >
                        <ControlOption value="all" label={t('salesSummary.controls.filterBy.cardType.options.all')} description={t('salesSummary.controls.filterBy.cardType.options.allDesc')} isSelected={pendingCardTypeFilter === null} />
                        <ControlOption value="credit" label={t('salesSummary.controls.filterBy.cardType.options.credit')} description={t('salesSummary.controls.filterBy.cardType.options.creditDesc')} isSelected={pendingCardTypeFilter === 'CREDIT'} />
                        <ControlOption value="debit" label={t('salesSummary.controls.filterBy.cardType.options.debit')} description={t('salesSummary.controls.filterBy.cardType.options.debitDesc')} isSelected={pendingCardTypeFilter === 'DEBIT'} />
                        <ControlOption value="amex" label={t('salesSummary.controls.filterBy.cardType.options.amex')} description={t('salesSummary.controls.filterBy.cardType.options.amexDesc')} isSelected={pendingCardTypeFilter === 'AMEX'} />
                        <ControlOption value="international" label={t('salesSummary.controls.filterBy.cardType.options.international')} description={t('salesSummary.controls.filterBy.cardType.options.internationalDesc')} isSelected={pendingCardTypeFilter === 'INTERNATIONAL'} />
                      </RadioGroup>
                    </div>
                  )}
                </div>
              </div>
```

- [ ] **Step 3: Wire the pill in the Control Pills row**

Replace the existing "More filters" Button (the trailing one with Filter icon) with a real `ControlPill`:
```tsx
        <ControlPill
          label={t('salesSummary.controls.filterBy.label')}
          value={
            paymentMethodFilter === null
              ? t('salesSummary.controls.filterBy.none')
              : paymentMethodFilter === 'CARD' && cardTypeFilter
                ? t(`salesSummary.controls.filterBy.cardType.options.${cardTypeFilter.toLowerCase()}`)
                : t(`salesSummary.controls.filterBy.paymentMethod.options.${paymentMethodFilter.toLowerCase()}`)
          }
          onClick={() => openControlPanel('filterBy')}
        />
```

- [ ] **Step 4: Add the "Filtrado" badge + X button in the header**

In the page header (after the existing `Beta` badge), add:
```tsx
            {isFiltered && (
              <Badge variant="outline" className="text-xs font-normal gap-1 pl-2 pr-1 py-0.5">
                {t('salesSummary.controls.filterBy.active')}: {' '}
                {paymentMethodFilter === 'CARD' && cardTypeFilter
                  ? t(`salesSummary.controls.filterBy.cardType.options.${cardTypeFilter.toLowerCase()}`)
                  : t(`salesSummary.controls.filterBy.paymentMethod.options.${paymentMethodFilter!.toLowerCase()}`)}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-4 w-4 ml-0.5 cursor-pointer"
                  onClick={clearFilterBy}
                  aria-label={t('salesSummary.controls.filterBy.clear')}
                >
                  <X className="w-3 h-3" />
                </Button>
              </Badge>
            )}
```

Add the `X` import at the top:
```ts
import { …, X } from 'lucide-react'
```

- [ ] **Step 5: Verify dev server renders**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run dev &
echo $! > /tmp/sales-summary-dev.pid
sleep 5
curl -s http://localhost:5173 -o /dev/null -w "%{http_code}\n"
```
Expected: `200`. Stop with `kill $(cat /tmp/sales-summary-dev.pid)` when done with this step (or leave running for the next phase).

- [ ] **Step 6: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/pages/Reports/SalesSummary.tsx
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
feat(reports): filterBy sub-panel UI with 2-level selection

Replaces the TODO onClick on the filterBy control with a real Sheet
sub-panel: level 1 = method, level 2 (only on CARD) = card type.
Adds a "Filtrado" badge with one-click clear in the page header.
QR Legacy option is conditional on venueId === MINDFORM_VENUE_ID.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 8 — Frontend: Hide-under-filter + Enriched Breakdown

### Task 15: Hide order-level rows and chart under filter

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Reports/SalesSummary.tsx`

- [ ] **Step 1: Gate the "big number" card visualizations**

Find the GlassCard wrapping the top sales number and `viewType ===` chart conditionals. Wrap the entire chart block (gauge/pie/table) in `{!isFiltered && (`:
```tsx
        {!isFiltered && viewType === 'gauge' && (
          <SalesBreakdownBar segments={…} />
        )}
        {!isFiltered && viewType === 'pie' && (…)}
        {!isFiltered && viewType === 'table' && (…)}

        {isFiltered && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
            <Filter className="w-4 h-4" />
            <span>{t('salesSummary.controls.filterBy.filteredMessage')}</span>
          </div>
        )}
```

- [ ] **Step 2: Gate every Order-derived `SummaryRow` in the Summary section**

For each of these rows, wrap the existing block with `{!isFiltered && …}`: `grossSales`, `items`, `serviceCosts`, `discounts`, `taxes`, `deferredSales`, `netSales`.

The `netSales` row uses `data.summary.netSales`; show only when non-null:
```tsx
              {!isFiltered && selectedMetrics.includes('netSales') && data.summary.netSales !== null && (
                <>
                  <div className="h-px bg-border/30 mx-4 my-2" />
                  <SummaryRow
                    label={t('salesSummary.rows.netSales')}
                    value={data.summary.netSales}
                    type="neutral"
                    bold
                    tooltip={t('salesSummary.tooltips.netSales')}
                  />
                </>
              )}
```

The `totalSales` row in the Mexico-model block uses `data.summary.netSales` — same gating; only show when `netSales !== null`.

Add a "hidden under filter" hint at the end of the Summary section:
```tsx
              {isFiltered && (
                <div className="px-4 pt-2 pb-1 text-xs text-muted-foreground italic">
                  {t('salesSummary.controls.filterBy.hiddenMetricsMessage')}
                </div>
              )}
```

- [ ] **Step 3: Update the `data` derivation to honour null fields**

In the `useMemo(() => { … })` that builds `data` (around line 916), reflect the null-permissive shape:
```ts
    return {
      summary: {
        totalGross: apiResponse.summary.grossSales,
        items: apiResponse.summary.items,
        serviceCosts: apiResponse.summary.serviceCosts,
        discounts: apiResponse.summary.discounts,
        refunds: apiResponse.summary.refunds,
        netSales: apiResponse.summary.netSales,
        deferredSales: apiResponse.summary.deferredSales,
        taxes: apiResponse.summary.taxes,
        tips: apiResponse.summary.tips,
        platformFees: apiResponse.summary.platformFees,
        staffCommissions: apiResponse.summary.staffCommissions,
        totalCollected: apiResponse.summary.totalCollected,
        netProfit: apiResponse.summary.netProfit,
      },
      // …
```

Where any of those are used in CSV export, replace direct `.toFixed(2)` calls with `(data.summary.grossSales ?? 0).toFixed(2)` and skip the row when null.

- [ ] **Step 4: Run lint + dev server, eyeball the report under filter**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run lint -- --quiet src/pages/Reports/SalesSummary.tsx
```

Then in a real browser tab pointing at `http://localhost:5173/venues/<slug>/reports/sales-summary`, choose "Tarjeta → AMEX" and verify:
- The big chart disappears with a small message.
- The "Ventas brutas / Impuestos / Descuentos / Ventas netas" rows disappear.
- "Total cobrado / Propinas / Devoluciones / Comisiones / Ganancia neta / # Transacciones" remain.

- [ ] **Step 5: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/pages/Reports/SalesSummary.tsx
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
feat(reports): hide order-level rows + distribution chart under filter

Mexico-aware Square approach: when a payment filter is active, order-
derived metrics (gross sales, items, service costs, discounts, taxes,
deferred, net sales) are hidden because they cannot be attributed
honestly to a single payment method. The distribution chart hides too;
a small "Clear the filter to see distribution" message takes its place.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

### Task 16: Enriched breakdown rendering

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Reports/SalesSummary.tsx`

- [ ] **Step 1: Add a `DetailedBreakdownRow` component**

Above `SalesSummary`, after `PaymentMethodRow`:

```tsx
const DetailedBreakdownRow: React.FC<{
  icon: React.ReactNode
  label: string
  amount: number
  count: number
  percentage: number
  platformFees: number
  subBuckets?: Array<{
    type: 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'
    amount: number
    count: number
    percentage: number
    platformFees: number
  }>
  feesLabel: string
  subLabels: Record<'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL', string>
}> = ({ icon, label, amount, count, percentage, platformFees, subBuckets, feesLabel, subLabels }) => {
  const [open, setOpen] = useState(false)
  const hasSubs = subBuckets && subBuckets.length > 0
  return (
    <div className="space-y-1">
      <div
        className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 px-4 py-3 hover:bg-muted/30 rounded-lg transition-colors cursor-pointer"
        onClick={() => hasSubs && setOpen(o => !o)}
      >
        <div className="p-2 rounded-lg bg-muted/50">{icon}</div>
        <div className="flex flex-col">
          <span className="text-sm font-medium flex items-center gap-1">
            {hasSubs && (
              <ChevronDown className={cn('w-3 h-3 text-muted-foreground transition-transform', !open && '-rotate-90')} />
            )}
            {label}
          </span>
          {platformFees > 0 && (
            <span className="text-[11px] text-muted-foreground mt-0.5">{feesLabel}: {Currency(platformFees)}</span>
          )}
        </div>
        <span className="text-sm text-muted-foreground text-right">{count} trans.</span>
        <span className="text-sm text-muted-foreground text-right min-w-[50px]">{percentage.toFixed(1)}%</span>
        <span className="text-sm font-mono text-right min-w-[100px]">{Currency(amount)}</span>
      </div>
      {hasSubs && open && (
        <div className="pl-12 space-y-1">
          {subBuckets!.map(sb => (
            <div key={sb.type} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-4 px-4 py-2 text-sm hover:bg-muted/20 rounded-lg">
              <div className="flex flex-col">
                <span>{subLabels[sb.type]}</span>
                {sb.platformFees > 0 && (
                  <span className="text-[11px] text-muted-foreground">{feesLabel}: {Currency(sb.platformFees)}</span>
                )}
              </div>
              <span className="text-muted-foreground text-right">{sb.count} trans.</span>
              <span className="text-muted-foreground text-right min-w-[50px]">{sb.percentage.toFixed(1)}%</span>
              <span className="font-mono text-right min-w-[100px]">{Currency(sb.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Render the detailed breakdown when present**

Inside the existing "Métodos de pago" CollapsibleContent, replace the three `<PaymentMethodRow …>` calls with:

```tsx
              {apiResponse?.byPaymentMethodDetailed && !isFiltered ? (
                apiResponse.byPaymentMethodDetailed.map(b => {
                  const icon = b.bucket === 'CARD'
                    ? <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    : b.bucket === 'CASH'
                      ? <Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />
                      : b.bucket === 'QR_LEGACY'
                        ? <QrCode className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                        : <Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />
                  const label = b.bucket === 'CARD'
                    ? t('salesSummary.paymentTypes.card')
                    : b.bucket === 'CASH'
                      ? t('salesSummary.paymentTypes.cash')
                      : b.bucket === 'QR_LEGACY'
                        ? t('salesSummary.controls.filterBy.paymentMethod.options.qrLegacy')
                        : t('salesSummary.paymentTypes.other')
                  return (
                    <DetailedBreakdownRow
                      key={b.bucket}
                      icon={icon}
                      label={label}
                      amount={b.amount}
                      count={b.count}
                      percentage={b.percentage}
                      platformFees={b.platformFees}
                      subBuckets={b.subBuckets}
                      feesLabel={t('salesSummary.rows.platformFees')}
                      subLabels={{
                        CREDIT: t('salesSummary.controls.filterBy.cardType.options.credit'),
                        DEBIT: t('salesSummary.controls.filterBy.cardType.options.debit'),
                        AMEX: t('salesSummary.controls.filterBy.cardType.options.amex'),
                        INTERNATIONAL: t('salesSummary.controls.filterBy.cardType.options.international'),
                      }}
                    />
                  )
                })
              ) : !isFiltered ? (
                <>
                  <PaymentMethodRow icon={<CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />} label={t('salesSummary.paymentTypes.card')} amount={data.paymentMethods.card.amount} count={data.paymentMethods.card.count} percentage={data.paymentMethods.card.percentage} settlementLabel={settlementLabels.card} />
                  <PaymentMethodRow icon={<Banknote className="w-4 h-4 text-green-600 dark:text-green-400" />} label={t('salesSummary.paymentTypes.cash')} amount={data.paymentMethods.cash.amount} count={data.paymentMethods.cash.count} percentage={data.paymentMethods.cash.percentage} settlementLabel={settlementLabels.cash} />
                  <PaymentMethodRow icon={<Smartphone className="w-4 h-4 text-orange-600 dark:text-orange-400" />} label={t('salesSummary.paymentTypes.other')} amount={data.paymentMethods.other.amount} count={data.paymentMethods.other.count} percentage={data.paymentMethods.other.percentage} />
                </>
              ) : (
                <div className="px-4 py-3 text-sm text-muted-foreground italic">
                  {t('salesSummary.controls.filterBy.filteredMessage')}
                </div>
              )}
```

Add the imports:
```ts
import { …, QrCode } from 'lucide-react'
```

- [ ] **Step 3: Type-check, lint, dev-server eyeball**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc --noEmit && npm run lint -- --quiet src/pages/Reports/SalesSummary.tsx
```

In the browser, verify a venue with TPV activity: the "Métodos de pago" section shows expandable rows; clicking "Tarjeta" reveals AMEX with its commission.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add src/pages/Reports/SalesSummary.tsx
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
feat(reports): enriched breakdown with sub-buckets and platform commission

Replaces the flat 3-row payment-methods section with an expandable list.
CARD rows now expand to show Crédito / Débito / AMEX / Internacional
with platform commission per sub-bucket — surfacing the AMEX ~4.5%
reality to the venue owner. MindForm's QR Legacy gets its own row with
a QrCode icon and purple tone (matches the existing badge in
/payments).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 9 — Tests

### Task 17: Playwright E2E

**Files:**
- Create: `avoqado-web-dashboard/e2e/tests/reports/sales-summary-filter.spec.ts`

- [ ] **Step 1: Read an existing report E2E for the mocking pattern**

```bash
ls /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/e2e/tests/ 2>/dev/null | head
```

Open one of those + `e2e/fixtures/api-mocks.ts` to understand `setupApiMocks` so the new test can mock `/api/v1/dashboard/reports/sales-summary`.

- [ ] **Step 2: Write the E2E**

```ts
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

const MOCK_SUMMARY_BASE = {
  dateRange: { startDate: '2026-01-01T00:00:00Z', endDate: '2026-01-31T23:59:59Z' },
  reportType: 'summary',
  summary: {
    grossSales: 10000, items: 10000, serviceCosts: 0,
    discounts: 500, refunds: 200, netSales: 9300, deferredSales: 0,
    taxes: 1600, tips: 800, platformFees: 150, staffCommissions: 50,
    commissions: 150, totalCollected: 9950, netProfit: 9100,
    transactionCount: 23,
  },
  byPaymentMethod: [
    { method: 'CREDIT_CARD', amount: 6000, count: 12, percentage: 60 },
    { method: 'CASH', amount: 3000, count: 8, percentage: 30 },
    { method: 'DEBIT_CARD', amount: 1000, count: 3, percentage: 10 },
  ],
  byPaymentMethodDetailed: [
    {
      bucket: 'CARD', amount: 7000, count: 15, percentage: 70, tips: 600, refunds: 200, platformFees: 150,
      subBuckets: [
        { type: 'CREDIT', amount: 4000, count: 8, percentage: 57, platformFees: 80 },
        { type: 'DEBIT', amount: 1000, count: 3, percentage: 14, platformFees: 20 },
        { type: 'AMEX', amount: 1500, count: 3, percentage: 21, platformFees: 40 },
        { type: 'INTERNATIONAL', amount: 500, count: 1, percentage: 7, platformFees: 10 },
      ],
    },
    { bucket: 'CASH', amount: 3000, count: 8, percentage: 30, tips: 200, refunds: 0, platformFees: 0 },
  ],
  filtered: false,
}

const MOCK_SUMMARY_FILTERED_AMEX = {
  ...MOCK_SUMMARY_BASE,
  summary: {
    ...MOCK_SUMMARY_BASE.summary,
    grossSales: null, items: null, serviceCosts: null,
    discounts: null, netSales: null, deferredSales: null, taxes: null,
    refunds: 0, tips: 100, platformFees: 40,
    totalCollected: 1500, netProfit: 1460, transactionCount: 3,
  },
  byPaymentMethod: undefined,
  byPaymentMethodDetailed: undefined,
  filtered: true,
}

test.describe('Sales Summary filter', () => {
  test.beforeEach(async ({ page }) => {
    await setupApiMocks(page, { userRole: 'OWNER' })
  })

  test('default state: filterBy pill shows "All"', async ({ page }) => {
    await page.route('**/api/v1/dashboard/reports/sales-summary*', r =>
      r.fulfill({ status: 200, body: JSON.stringify({ success: true, data: MOCK_SUMMARY_BASE }) }),
    )
    await page.goto('/venues/demo/reports/sales-summary')
    await expect(page.getByRole('button', { name: /Filtrar por.*Todos/i })).toBeVisible()
  })

  test('open sub-panel, choose Tarjeta -> AMEX, apply: pill + filtered badge update', async ({ page }) => {
    let lastQuery = ''
    await page.route('**/api/v1/dashboard/reports/sales-summary*', r => {
      const url = new URL(r.request().url())
      lastQuery = url.search
      const body = url.searchParams.get('paymentMethod') === 'CARD'
        ? MOCK_SUMMARY_FILTERED_AMEX
        : MOCK_SUMMARY_BASE
      return r.fulfill({ status: 200, body: JSON.stringify({ success: true, data: body }) })
    })
    await page.goto('/venues/demo/reports/sales-summary')

    await page.getByRole('button', { name: /Filtrar por.*Todos/i }).click()
    await page.getByText('Tarjeta', { exact: true }).first().click()
    await page.getByText('AMEX', { exact: true }).click()
    await page.getByRole('button', { name: /Aplicar/i }).click()

    await expect(page.getByText('Filtrado: AMEX')).toBeVisible()
    expect(lastQuery).toContain('paymentMethod=CARD')
    expect(lastQuery).toContain('cardType=AMEX')
  })

  test('under filter, gross sales row is hidden and chart is hidden', async ({ page }) => {
    await page.route('**/api/v1/dashboard/reports/sales-summary*', r =>
      r.fulfill({ status: 200, body: JSON.stringify({ success: true, data: MOCK_SUMMARY_FILTERED_AMEX }) }),
    )
    await page.goto('/venues/demo/reports/sales-summary?_filter=1')

    await expect(page.getByText('Ventas brutas')).toHaveCount(0)
    await expect(page.getByText('Quita el filtro')).toBeVisible()
  })

  test('enriched breakdown: clicking Tarjeta row expands sub-buckets', async ({ page }) => {
    await page.route('**/api/v1/dashboard/reports/sales-summary*', r =>
      r.fulfill({ status: 200, body: JSON.stringify({ success: true, data: MOCK_SUMMARY_BASE }) }),
    )
    await page.goto('/venues/demo/reports/sales-summary')

    await page.getByText('Tarjeta', { exact: true }).first().click()
    await expect(page.getByText('AMEX')).toBeVisible()
    await expect(page.getByText('Internacional')).toBeVisible()
  })

  test('non-MindForm venue: QR Legacy option absent from filter panel', async ({ page }) => {
    await page.route('**/api/v1/dashboard/reports/sales-summary*', r =>
      r.fulfill({ status: 200, body: JSON.stringify({ success: true, data: MOCK_SUMMARY_BASE }) }),
    )
    await page.goto('/venues/demo/reports/sales-summary')
    await page.getByRole('button', { name: /Filtrar por/i }).click()
    await expect(page.getByText('QR Legacy')).toHaveCount(0)
  })
})
```

- [ ] **Step 3: Run the E2E**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx playwright test e2e/tests/reports/sales-summary-filter.spec.ts
```
Expected: 5 tests pass. If selectors don't match (the Sheet panel might use different aria), use `page.locator(...)` to introspect; tweak selectors.

- [ ] **Step 4: Commit (pause for user)**

```bash
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard add e2e/tests/reports/sales-summary-filter.spec.ts
git -C /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard commit -m "$(cat <<'EOF'
test(e2e): sales-summary filter + enriched breakdown

Covers the default pill, open-sub-panel-apply flow (with API call
shape assertion), hidden order rows under filter, breakdown
expansion, and MindForm-only QR Legacy gating.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Phase 10 — Manual verification on localhost

### Task 18: Real-world smoke

**Files:** none

- [ ] **Step 1: Start both servers**

```bash
# Terminal 1
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run dev
# Terminal 2
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run dev
```

- [ ] **Step 2: Sign in as MindForm OWNER, open the report**

URL: `http://localhost:5173/venues/mindform/reports/sales-summary`

Verify:
- Default (no filter): the "Métodos de pago" section shows 4 rows (Tarjeta, Efectivo, QR Legacy, Otro if applicable).
- The "Tarjeta" row expands to show Crédito/Débito/AMEX/Internacional with each commission.
- The QR Legacy row appears with the purple `QrCode` icon.
- Total cobrado is higher than what production currently shows (legacy merge fix).

- [ ] **Step 3: Apply filter "Efectivo"**

- Pill becomes `Filtrar por · Efectivo`.
- Header shows `Filtrado: Efectivo` with `X` icon.
- "Ventas brutas / Impuestos / Descuentos / Ventas diferidas" rows disappear.
- "Total cobrado" matches the Efectivo column from the breakdown (before filter).
- Chart disappears; "Quita el filtro" message appears.

- [ ] **Step 4: Apply filter "Tarjeta → AMEX"**

- Same UX. Total cobrado should match AMEX sub-bucket from breakdown.

- [ ] **Step 5: Apply filter "QR Legacy"**

- Should show legacy-only totals. txCount > 0 (assuming legacy data in date range).

- [ ] **Step 6: Click `X` on the badge — filter clears**

- All rows return; chart returns.

- [ ] **Step 7: Refresh page — filter selection persists**

- localStorage round-trip works.

- [ ] **Step 8: Switch to a non-MindForm venue**

- QR Legacy option is not visible in the filter panel.
- API still works (no QR_LEGACY bucket in the response).

- [ ] **Step 9: Toggle dark mode**

- New rows / badge / panel render correctly in dark mode (no hardcoded colors).

- [ ] **Step 10: Pre-deploy checks**

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npm run lint -- --quiet && npm run build
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run lint -- --quiet && npm run build
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx playwright test e2e/tests/reports/sales-summary-filter.spec.ts
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest src/services/dashboard/sales-summary.dashboard.service.test.ts
```
Expected: every command exits 0.

- [ ] **Step 11: Open two PRs (pause for user)**

The user requests PR creation explicitly — do not run `gh pr create` proactively. Have the branches and clean local builds ready.

---

## Self-review (run before finishing)

- ✅ Spec coverage: every decision in `2026-06-02-sales-summary-payment-filter-design.md` § "Decisions" has a task (Task 4 hides order-level under filter; Task 6 merges legacy QR; Task 7 builds the enriched breakdown; Task 11/13/14 wire the filter UI; Task 12 adds i18n; Task 17 covers E2E).
- ✅ No placeholders: every step includes actual code or commands.
- ✅ Type consistency: `PaymentMethodFilter`, `CardTypeFilter`, `PaymentMethodDetailedBreakdown`, `MINDFORM_VENUE_ID`, `buildPaymentWhereFilter`, `buildPaymentSqlClause`, `legacyMatchesFilter`, `bucketOf` are all defined exactly once and used identically downstream.
- ✅ Order-level metric nullability is consistent: schema (Task 1), service (Task 4, 5, 6), frontend service (Task 11), UI (Task 15), CSV export (Task 15).
- ✅ Commit safety: every commit step is gated "pause for user" per project policy.

---

## Risks and rollback

- **Performance**: the JSON-path filter (`processorData->>'isInternational'`) is unindexed. For venues with > 200k Payment rows, the international branch could regress. Mitigation: monitor query times after deploy; add a partial index later (`CREATE INDEX … ON "Payment" ((processorData->>'isInternational')) WHERE (processorData ? 'isInternational')`).
- **MindForm totals change**: this is a bug fix but the report's numbers WILL increase for MindForm. Communicate to the MindForm team before deploying.
- **Rollback**: each phase is its own commit. Revert any failing commit individually; the backend changes are additive, so reverting only the controller commit is enough to remove the feature without breaking other code paths.
