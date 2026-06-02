# Sales Summary — Payment Method Filter (Design)

**Date:** 2026-06-02
**Author:** Claude + Jose
**Status:** Draft → Awaiting user review
**Repos affected:** `avoqado-server`, `avoqado-web-dashboard`

## Problem

The Sales Summary report (`/venues/:slug/reports/sales-summary`) currently has no way to filter by payment method or card type. The "Filtrar por" control exists in the UI but is wired to a TODO (`onClick={() => {/* TODO */}}`). Operators cannot answer common questions like:

- "How much did we collect in cash this week?"
- "How much AMEX volume did we process?"
- "What's the international card breakdown?"

A second, MindForm-specific bug is that this report does **not** merge MindForm's legacy QR payments (avo-pwa database). MindForm sees incomplete totals — every other dashboard surface (`/home`, `/payments` list) already merges them via `fetchPaymentsForAnalytics` / direct legacy reads, but the sales summary service goes straight to `prisma.payment.*`.

## Goals

1. Filter the Sales Summary report by payment method (Cash / Card / Other) and, when Card is selected, by card type (Credit / Debit / AMEX / International).
2. For MindForm only, also expose `QR Legacy` as a payment-method bucket and filter target.
3. Fix the MindForm legacy-merge gap so totals match the rest of the dashboard.
4. Keep the implementation consistent with existing canonical mappings (`determineTransactionCardType`) and existing filter plumbing (`merchantAccountId`).

## Non-goals

- No new BIN lookup or country-of-issue capture. "International" is read from the existing `Payment.processorData.isInternational` value already populated by Blumon/Stripe webhooks.
- No prorating of order amounts by payment method. Orders with mixed payments are counted whole on the order-level metrics when at least one payment matches the filter (same semantics already used by `merchantAccountId`).
- No new aggregate exports beyond what the existing CSV export covers (the filter just narrows the same export).
- No backfill of `isInternational` for historical payments missing the flag.

## Decisions (validated with user)

| # | Question | Decision |
|---|----------|----------|
| 1 | "International" definition | `Payment.processorData.isInternational === true` — reuse the canonical signal Blumon/Stripe already emit (also what `transactionCost.service.ts` uses). |
| 2 | Filter scope on order-level metrics (grossSales, discounts, taxes) | **Inclusive**: include the full order when it has ≥1 payment matching the filter. Same semantics as `merchantAccountId`. Documented in tooltip. |
| 3 | QR Legacy bucket (MindForm) | **Own bucket** in the payment-method breakdown and own filter target. Coherent with the existing `source: 'QR_LEGACY'` + `isLegacyQR: true` markers. |

## UX — Filtrar por panel

The Sheet panel pattern (`activePanel === 'filterBy'`) is already established in [SalesSummary.tsx](../../src/pages/Reports/SalesSummary.tsx). We replace the TODO `onClick` with a real sub-panel.

### Layout (hierarchical, 2 levels)

**Level 1 — Método de pago** (RadioGroup, single-select):
- Todos los métodos *(default)*
- Efectivo
- Tarjeta
- QR Legacy *(only visible when `venueId === MINDFORM_NEW_VENUE_ID`)*
- Otro *(Digital wallet, transfer, crypto)*

**Level 2 — Tipo de tarjeta** (RadioGroup, single-select; only rendered when Level 1 = "Tarjeta"):
- Todas las tarjetas *(default)*
- Crédito
- Débito
- AMEX
- Internacional

A single `ControlPill` in the toolbar reflects the selection:
- Inactive: `Filtrar por · Todos`
- Active: `Filtrar por · AMEX` (or `Filtrar por · Efectivo`, etc.)

Clicking the pill opens the sub-panel. Apply button respects the `hasPendingChange` pattern already used by other panels. Selection persists to `localStorage` under the existing `STORAGE_KEY` (`avoqado:salesSummary:preferences`), with two new fields: `paymentMethodFilter` and `cardTypeFilter`.

A small "Filtrado" badge appears in the page header next to "Beta" when any filter is active, to make the filtered state obvious.

### i18n keys (es + en + fr if namespace exists)

```json
"filterBy": {
  "label": "Filtrar por",
  "description": "Restringe el reporte a un método o tipo de tarjeta",
  "longDescription": "Aplica filtros para ver solo los pagos del método o tipo de tarjeta seleccionado. Las métricas a nivel orden incluyen órdenes con al menos un pago que coincida.",
  "active": "Filtrado",
  "clear": "Quitar filtro",
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
      "qrLegacyDesc": "Solo pagos del sistema QR previo (Mindform)",
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

## Backend

### Service contract (`SalesSummaryFilters`)

Add two new optional fields:

```ts
export type PaymentMethodFilter = 'CASH' | 'CARD' | 'QR_LEGACY' | 'OTHER'
export type CardTypeFilter = 'CREDIT' | 'DEBIT' | 'AMEX' | 'INTERNATIONAL'

export interface SalesSummaryFilters {
  startDate: string
  endDate: string
  groupBy?: 'none' | 'paymentMethod'
  reportType?: ReportType
  timezone?: string
  merchantAccountId?: string
  paymentMethod?: PaymentMethodFilter   // NEW
  cardType?: CardTypeFilter             // NEW — ignored unless paymentMethod === 'CARD'
}
```

### Controller validation

In [sales-summary.dashboard.controller.ts](../../../avoqado-server/src/controllers/dashboard/sales-summary.dashboard.controller.ts):

```ts
const validPaymentMethods: PaymentMethodFilter[] = ['CASH', 'CARD', 'QR_LEGACY', 'OTHER']
const validCardTypes: CardTypeFilter[] = ['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']

if (paymentMethod && !validPaymentMethods.includes(paymentMethod as PaymentMethodFilter)) {
  throw new BadRequestError(`Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`)
}
if (cardType && !validCardTypes.includes(cardType as CardTypeFilter)) {
  throw new BadRequestError(`Invalid cardType. Must be one of: ${validCardTypes.join(', ')}`)
}
// cardType without paymentMethod=CARD is silently ignored (defense-in-depth)
if (cardType && paymentMethod !== 'CARD') {
  logger.warn('cardType ignored because paymentMethod is not CARD', { paymentMethod, cardType })
}
if (paymentMethod === 'QR_LEGACY' && venueId !== MINDFORM_NEW_VENUE_ID) {
  throw new BadRequestError('QR_LEGACY filter is only available for MindForm')
}
```

### Service — payment-where builder

A new helper `buildPaymentWhereFilter(paymentMethod, cardType)` produces a partial `Prisma.PaymentWhereInput`:

```ts
function buildPaymentWhereFilter(
  paymentMethod?: PaymentMethodFilter,
  cardType?: CardTypeFilter,
): Prisma.PaymentWhereInput {
  if (!paymentMethod) return {}

  if (paymentMethod === 'CASH') return { method: 'CASH' }
  if (paymentMethod === 'OTHER') {
    return { method: { in: ['DIGITAL_WALLET', 'BANK_TRANSFER', 'CRYPTOCURRENCY', 'OTHER'] } }
  }
  // QR_LEGACY is handled outside Prisma (legacy DB), see "Legacy QR branch" below
  if (paymentMethod === 'QR_LEGACY') return { id: '__never_match__' } // ensures native query returns 0

  // paymentMethod === 'CARD'
  if (!cardType) {
    return { method: { in: ['CREDIT_CARD', 'DEBIT_CARD'] } }
  }
  if (cardType === 'AMEX') {
    return {
      cardBrand: 'AMERICAN_EXPRESS',
      NOT: { processorData: { path: ['isInternational'], equals: true } },
    }
  }
  if (cardType === 'INTERNATIONAL') {
    return { processorData: { path: ['isInternational'], equals: true } }
  }
  // CREDIT or DEBIT
  return {
    method: cardType === 'CREDIT' ? 'CREDIT_CARD' : 'DEBIT_CARD',
    cardBrand: { not: 'AMERICAN_EXPRESS' },
    NOT: { processorData: { path: ['isInternational'], equals: true } },
  }
}
```

This `paymentFilter` is then composed into every existing query:

- **Payment-level queries** (refunds, tips, transactionCount, by-period payment aggregates, byPaymentMethod groupBy): merge `paymentFilter` directly into the `where`.
- **Order-level queries** (grossSales, deferredSales, by-period order aggregates): wrap as `payments: { some: paymentFilter }` — same shape used today for `merchantAccountId` in `merchantOrderFilter`.
- **TransactionCost raw SQL** (platformFees): extend the existing query with a `JOIN Payment p` (already joined) and add the same conditions. For JSON path, use `(p."processorData"->>'isInternational')::boolean = true`. To avoid duplicating the where-builder, generate the SQL fragment from the same `paymentFilter` (or hand-write the corresponding SQL — there are only 5 distinct shapes).
- **CommissionCalculation**: already filters via `payment: { merchantAccountId }`; extend to `payment: { ...merchantFilter, ...paymentFilter }`.

### Time-period raw SQL (`calculateTimePeriodMetrics`)

Extend the existing `merchant*Clause` pattern with `payment*Clause`. To stay readable, generate the SQL `WHERE`-fragment via a small helper:

```ts
function buildPaymentSqlClause(
  paymentMethod?: PaymentMethodFilter,
  cardType?: CardTypeFilter,
  paramIdx: number = 5,
): { clause: string; params: any[] } { /* … */ }
```

The clause is appended after `merchantPaymentClause` in `paymentMetricsQuery`, `refundsQuery`, and `platformFeesQuery`. The order-level queries get the same clause via a `id IN (SELECT "orderId" FROM "Payment" WHERE …)` subselect — matching today's `merchantOrderClause` pattern.

### Legacy QR branch (MindForm only)

Inside `getSalesSummary`, after computing native totals, if `venueId === MINDFORM_NEW_VENUE_ID`:

1. Call `getLegacyPayments({ startDate, endDate })` → returns mapped payments with `method ∈ {CARD, CASH}` and `source: 'QR_LEGACY'`.
2. If `paymentMethod === 'QR_LEGACY'`:
   - Zero out the native summary (`paymentFilter` ensured native queries returned 0)
   - Compute summary entirely from legacy rows
3. Else (no filter, or non-QR-Legacy filter):
   - Filter legacy rows by the same `paymentFilter` logic (in-memory — legacy rows have `method`, `cardBrand`, no `processorData.isInternational` because Stripe legacy data is treated as `CARD`/non-AMEX/non-international by default)
   - Add legacy amounts into the summary metrics: `grossSales`, `netSales`, `tips`, `totalCollected`, `transactionCount` increment; `taxes`, `discounts`, `refunds`, `deferredSales`, `platformFees`, `staffCommissions` stay at 0 (legacy has no per-row tax/discount/fee data and no refunds today)
4. In `byPaymentMethod` (when requested):
   - Append a `{ method: 'QR_LEGACY', amount, count, percentage }` entry
   - Recompute all `percentage` fields against the new total
5. For time-period reports (`reportType !== 'summary'`), legacy rows are bucketed by `createdAt` using the same `groupByExpression` semantics, in JS (not SQL), and merged into `periodsToProcess`.

This branch is the **only** place that knows about `MINDFORM_NEW_VENUE_ID` inside this service. We add a one-line comment pointing to `mergedPayments.service.ts` so the future-cleanup grep finds this spot.

### byPaymentMethod for non-MindForm venues

No change to ordering. Buckets remain whatever `Payment.method` values exist in the data, sorted by amount desc. The frontend still groups them into `Tarjeta / Efectivo / Otro` for the chart, and now adds `QR Legacy` if a `QR_LEGACY` entry is present (always false for non-MindForm).

## Frontend wiring

### State (in `SalesSummary.tsx`)

```ts
const [paymentMethodFilter, setPaymentMethodFilter] = useState<PaymentMethodFilter | null>(
  () => savedPrefs?.paymentMethodFilter ?? null,
)
const [cardTypeFilter, setCardTypeFilter] = useState<CardTypeFilter | null>(
  () => savedPrefs?.cardTypeFilter ?? null,
)
const [pendingPaymentMethodFilter, setPendingPaymentMethodFilter] = useState<PaymentMethodFilter | null>(null)
const [pendingCardTypeFilter, setPendingCardTypeFilter] = useState<CardTypeFilter | null>(null)
```

The QR Legacy option is conditionally rendered when `venueId === MINDFORM_VENUE_ID`. The constant lives in `salesSummary.service.ts` (frontend) and mirrors `MINDFORM_NEW_VENUE_ID` from the backend's `qrPayments.legacy.service.ts`. We add a comment in both pointing at the other so they don't drift.

When `paymentMethodFilter !== 'CARD'`, automatically clear `cardTypeFilter` on apply.

### Service call

Extend `apiFilters` in the existing `useMemo`:

```ts
const apiFilters = useMemo(() => ({
  venueId,
  startDate: dateRange.from.toISOString(),
  endDate: dateRange.to.toISOString(),
  groupBy: 'paymentMethod' as ApiGroupBy,
  reportType,
  ...(merchantAccountId ? { merchantAccountId } : {}),
  ...(paymentMethodFilter ? { paymentMethod: paymentMethodFilter } : {}),
  ...(paymentMethodFilter === 'CARD' && cardTypeFilter ? { cardType: cardTypeFilter } : {}),
}), [venueId, dateRange.from, dateRange.to, reportType, merchantAccountId, paymentMethodFilter, cardTypeFilter])
```

`salesSummaryKeys.summary(apiFilters)` already keys on the whole filters object, so cache invalidation works for free.

### Service layer (`salesSummary.service.ts`)

Extend `SalesSummaryFilters` with the two new optional fields and forward them in `params`. Export the new union types so the page can import them.

### byPaymentMethod display

When `byPaymentMethod` contains a `QR_LEGACY` entry, the existing `data.paymentMethods` derivation gets a 4th bucket:

```ts
const qrLegacyPayment = paymentMethods.find(p => p.method === 'QR_LEGACY')
```

The `SalesBreakdownBar`, `SalesPieChart`, and `SalesTable` get a 4th segment when `qrLegacyPayment` exists (color: a 4th distinct color — `bg-violet-500`). The "Métodos de pago" list adds a 4th `PaymentMethodRow` with a QR icon (`QrCode` from lucide-react).

### CSV export

The export rows include the active filter in the header. When `paymentMethodFilter` is set, we print `Filtro: <label>` underneath the date range. The data rows themselves are already filtered (they're rendered from the same `data` object).

## Data flow

```
User picks "Tarjeta" → "AMEX" in Sheet panel
  → Apply button
  → setPaymentMethodFilter('CARD') + setCardTypeFilter('AMEX')
  → localStorage persists
  → apiFilters memo recomputes
  → TanStack Query refetches with new filters in queryKey
  → GET /api/v1/dashboard/reports/sales-summary?…&paymentMethod=CARD&cardType=AMEX
  → controller validates → service builds paymentFilter
  → all SQL/Prisma queries narrow to AMEX payments
  → response includes byPaymentMethod with AMEX-only volume
  → frontend renders filtered summary + breakdown
  → "Filtrado" badge appears in header
```

## Error handling

- Invalid `paymentMethod` / `cardType` values → `400 BadRequestError` with the valid list
- `cardType` without `paymentMethod=CARD` → silently ignored, logged
- `QR_LEGACY` on non-MindForm venue → `400 BadRequestError`
- Legacy DB unreachable on MindForm → log warning, fall back to native-only totals (existing behavior of `getLegacyPayments`)
- Empty `processorData` on a payment → JSON path query returns `null` ≠ `true`, so it's excluded from `INTERNATIONAL` and included in CREDIT/DEBIT — same behavior as the current `isInternationalPayment` helper in `Payments.tsx`

## Tests

### Backend (Jest, `sales-summary.dashboard.service.test.ts`)

Real database tests (we already have test infra hitting a real PG; mocks would mask the JSON path semantics that matter here).

| # | Scenario | Assertion |
|---|----------|-----------|
| 1 | No filter | All payments counted (baseline) |
| 2 | `paymentMethod=CASH` | Only `method=CASH` in totals; refunds, tips, txCount narrow |
| 3 | `paymentMethod=CARD` no cardType | `CREDIT_CARD + DEBIT_CARD` only |
| 4 | `paymentMethod=CARD&cardType=CREDIT` | Excludes AMEX, excludes international |
| 5 | `paymentMethod=CARD&cardType=DEBIT` | Excludes AMEX, excludes international |
| 6 | `paymentMethod=CARD&cardType=AMEX` | Only `cardBrand=AMERICAN_EXPRESS`; international AMEX is excluded (consistent with the canonical mapping) |
| 7 | `paymentMethod=CARD&cardType=INTERNATIONAL` | Only `processorData.isInternational=true` |
| 8 | `paymentMethod=OTHER` | Only digital wallet / transfer / crypto / other |
| 9 | Order-level metrics with filter | An order with mixed payments is fully counted if ≥1 matches |
| 10 | MindForm + no filter | Legacy QR payments add to totals + appear in `byPaymentMethod` |
| 11 | MindForm + `paymentMethod=QR_LEGACY` | Native totals are zero; legacy totals only |
| 12 | MindForm + `paymentMethod=CARD&cardType=AMEX` | Legacy ignored (legacy doesn't have AMEX records); native AMEX only |
| 13 | Non-MindForm + `paymentMethod=QR_LEGACY` | 400 BadRequestError |
| 14 | Invalid `paymentMethod` | 400 BadRequestError |
| 15 | `cardType` without `paymentMethod=CARD` | 200 OK, cardType ignored, warning logged |
| 16 | Time-period report with filter | Each period reflects the filter; empty periods stay $0 |

### Frontend (Playwright, `e2e/tests/reports/sales-summary-filter.spec.ts`)

| # | Scenario |
|---|----------|
| 1 | Default state: pill shows "Todos", no "Filtrado" badge |
| 2 | Open "Filtrar por" sub-panel from pill |
| 3 | Select "Tarjeta" → level 2 appears |
| 4 | Select "AMEX" → Apply → pill shows "AMEX", "Filtrado" badge appears |
| 5 | Refresh page → selection persists from localStorage |
| 6 | Mock API response → totals reflect the filter |
| 7 | MindForm venue: QR Legacy option visible |
| 8 | Non-MindForm venue: QR Legacy option NOT visible |
| 9 | "Quitar filtro" button clears and refetches |
| 10 | CSV export header includes filter label |

## Manual verification plan (localhost)

Backend + frontend on localhost, real demo DB.

**Setup**
- `cd avoqado-server && npm run dev`
- `cd avoqado-web-dashboard && npm run dev`
- Login as a venue with mixed payment methods (any real venue with TPV activity)

**Cases**
1. Default state — totals match current production behavior (regression check)
2. `Efectivo` filter — totals shrink to cash only; tips match `payments?method=CASH` row count
3. `Tarjeta` (no sub) — covers everything except cash, qr legacy, other
4. `Tarjeta → AMEX` — verify against a known AMEX payment in the demo data
5. `Tarjeta → Internacional` — pick a venue with `processorData.isInternational=true` rows
6. Login as **Mindform** (`/venues/mindform/reports/sales-summary`)
   - No filter: total > native-only total (proves legacy merge fix)
   - `QR Legacy` filter: only legacy amounts shown
   - `byPaymentMethod`: 4 buckets visible (or 3 + QR Legacy)
7. Switch to non-Mindform venue: QR Legacy filter option not rendered, but API rejects it if forged
8. Export CSV with filter active → header has `Filtro: AMEX`
9. Toggle dark mode → no contrast issues on the new sub-panel

## File-by-file change list

### avoqado-server
- `src/services/dashboard/sales-summary.dashboard.service.ts` — main changes (filter builder, where composition, legacy branch)
- `src/controllers/dashboard/sales-summary.dashboard.controller.ts` — validation + forwarding
- `src/services/dashboard/sales-summary.dashboard.service.test.ts` — new test file (or extend existing)

### avoqado-web-dashboard
- `src/services/reports/salesSummary.service.ts` — extend `SalesSummaryFilters`, export `MINDFORM_VENUE_ID`, export `PaymentMethodFilter` / `CardTypeFilter` types
- `src/pages/Reports/SalesSummary.tsx` — replace TODO with real `filterBy` sub-panel, state, pill, badge, persistence
- `src/locales/es/reports.json` + `src/locales/en/reports.json` (+ `fr` if exists) — new `filterBy.*` keys
- `e2e/tests/reports/sales-summary-filter.spec.ts` — new E2E

### Cross-repo
- The change is backwards-compatible. Old TPV/dashboards that don't send the new params keep working.

## Rollout

1. Backend PR → merge to `develop` → demo+staging auto-deploy
2. Smoke-test on demo with a Mindform-like venue
3. Frontend PR → merge to `develop`
4. Manual verification on demo
5. After 24h with no regressions, promote to `main`

## Open questions / risks

- **Legacy QR `cardBrand` data quality**: `qrPayments.legacy.service.ts` reads `cardBrand` from the legacy row but it's typically `null` (Stripe Charges legacy export didn't always set it). When a CardType filter is active in MindForm, legacy rows will mostly fall out of all card-type subsets except no-cardType "Tarjeta". Documented and OK.
- **JSON path index**: there's no index on `(processorData->>'isInternational')`. For very large venues this could regress. Mitigation: monitor query times; add a partial index later if needed (`CREATE INDEX … ON "Payment" ((processorData->>'isInternational')) WHERE (processorData ? 'isInternational')`).
- **Locale namespace `fr`**: confirm presence; if not present, add only `es` + `en`.
