# Sales Summary Rich Export — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled client-side CSV popover on the Sales Summary report with a full-screen "how do you want to export?" dialog backed by one cohesive server endpoint that emits CSV/XLSX/PDF for both summary-totals and PREMIUM-gated transaction-detail modes.

**Architecture:** A new `GET /api/v1/dashboard/reports/sales-summary/export` endpoint reuses the proven `export.helpers.ts` toolkit (`encodeExport`/`sendExport`/`getRowCapForFormat`) and the existing `sales-summary.dashboard.service.ts` query layer (`getSalesSummary` for summary mode; `buildPaymentWhereFilter` + a new capped `payment.findMany` for detailed mode). Detailed mode is gated by a brand-new PREMIUM feature code `TRANSACTION_EXPORT` (registered in `basePlan.service.ts` + mirrored in the dashboard `plan-catalog.ts`). The dashboard gets a tailored `SalesSummaryExportDialog` (FullScreenModal + FilterPill) that downloads via the same `withCredentials` blob pattern; the generic `export-dialog.tsx` stays untouched. The MCP and sales presentation are updated in lockstep.

**Tech Stack:** avoqado-server (Express + TypeScript, Prisma, Jest, `xlsx`, `pdfkit`, `@modelcontextprotocol/sdk`) · avoqado-web-dashboard (React 18 + Vite, TanStack Query, Radix UI, i18next, Playwright) · marketing presentation (static HTML + Chrome-headless PDF).

> **⚠️ Commit policy (repo rule):** Every `git commit` step below requires the founder Jose's explicit per-commit approval. Keep the commit steps in the workflow but DO NOT run them without per-commit sign-off (`.claude/rules/testing-and-git.md`, `.claude/rules/bug-fix-workflow.md`). Co-Authored-By in any commit MUST be exactly `Claude Opus 4.6 (1M context) <noreply@anthropic.com>`.

> **⚠️ Co-Authored-By identity — confirm before committing:** The plan's commit blocks use `Claude Opus 4.6 (1M context)` per the repo rule (`.claude/rules/testing-and-git.md` lists 4.6 as the ONLY allowed identity). The current execution harness footer reports Opus 4.8. These disagree. Keep `4.6` as written (the committed rule wins) but Jose should confirm at commit time which value applies — if the repo rule has since been updated to 4.8, swap the string in every commit block below before running it.

> **⚠️ Tier decision (workspace rule):** This plan assumes the founder confirmed detailed transaction export = **PREMIUM** (`TRANSACTION_EXPORT`), per the approved spec. Summary export is NOT separately gated (Free = today-only via `clampSalesSummaryRangeToToday`; Pro+ = any range). Re-confirm before shipping if in doubt.

---

## File Structure

### avoqado-server (backend)

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/services/access/basePlan.service.ts` | Modify (lines 24–32) | Add `'TRANSACTION_EXPORT'` to `PREMIUM_ONLY_CODES`; every gate reads this const, so PREMIUM-only semantics propagate automatically. |
| `src/services/dashboard/sales-summary.dashboard.service.ts` | Modify (add exports near line 745+) | New `SalesSummaryExportFilters` interface, `buildSalesSummaryExportWhereClause()`, `countSalesSummaryDetailRows()`, `fetchSalesSummaryDetailRows()`, and `flattenSalesSummaryForExport()`. Reuses `buildPaymentWhereFilter` + `getSalesSummary`. |
| `src/controllers/dashboard/sales-summary.dashboard.controller.ts` | Modify (add `salesSummaryExport`, imports at lines 8–22) | New thin controller: param validation, venue/timezone resolution, PREMIUM gate for detailed mode → 403, pre-flight count → 413, build rows + `allColumns`/sections, `encodeExport` + `sendExport`. |
| `src/routes/dashboard/reports.routes.ts` | Modify (import line ~18; route after line 103) | Register `GET /sales-summary/export` with `checkPermission('reports:read')` → `clampSalesSummaryRangeToToday` → `salesSummaryExport`. Declared BEFORE any `/:id` sibling. |
| `src/mcp/tools/sales.ts` | Modify (import lines 1–11; new `server.tool` before line 394) | New `export_sales_summary` MCP tool mirroring `settlement_calendar`: gate + timezone + service call + `text()`. Detailed mode honors `TRANSACTION_EXPORT`; summary uses `ADVANCED_REPORTS`. |
| `tests/unit/services/access/basePlan.transactionExport.test.ts` | Create | Unit test: `TRANSACTION_EXPORT` resolves PREMIUM-only (PREMIUM venue ✓, PRO venue ✗ without own grant). |
| `tests/unit/services/dashboard/salesSummaryExport.service.test.ts` | Create | Unit test: summary flattening honors sections; detailed where-clause honors filters; row-cap counting. |
| `tests/api-tests/dashboard/salesSummaryExport.api.test.ts` | Create | API test: format/columns/mode params; detailed PREMIUM gate → 403 (platform feature-gate contract); pre-flight count → 413; content-type per format. |
| `tests/unit/mcp-customer/export-sales-summary.test.ts` | Create | MCP behavioral test: detailed denied for non-Premium (no `TRANSACTION_EXPORT`, no fetch); summary returns rows for an entitled venue. |

### avoqado-web-dashboard (frontend)

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `src/config/plan-catalog.ts` | Modify (line 66) | Add `'TRANSACTION_EXPORT'` to the PREMIUM tier `includes` array → `getTierForFeature('TRANSACTION_EXPORT')` returns `'PREMIUM'`. |
| `src/locales/es/reports.json` | Modify (extend `salesSummary.export.*` ~lines 95–103) | New ES keys for mode toggle, **editable filter pills (`filters.*` — payment method, card type, merchant, staff, shift + their options)**, sections (incl. `cardTypesDisabledHint`), columns, format, estimated count, 413 error, Premium upsell. |
| `src/locales/en/reports.json` | Modify (extend `salesSummary.export.*` ~lines 95–103) | EN keys in lockstep with ES — same `filters.*` + `cardTypesDisabledHint` (ESLint `no-missing-translation-keys` enforces parity). |
| `src/pages/Reports/components/SalesSummaryExportDialog.tsx` | Create | New tailored dialog: FullScreenModal + FilterPill + mode toggle + sections/column picker + format radio + estimated count + blob download + 413 handling + FeatureGate on detailed mode. |
| `src/pages/Reports/SalesSummary.tsx` | Modify (remove popover 1276–1332 + `handleExportCSV` 1015–1069 + state 775–776; add dialog trigger) | Replace the old popover/builder with the new dialog; Export button gets `data-tour="sales-summary-export"`. |
| `e2e/tests/reports/sales-summary-export.spec.ts` | Create | Playwright: open dialog → summary CSV happy path; detailed mode shows Premium upsell (non-Premium) and column picker (Premium). |

### Avoqado-HQ (marketing — separate repo/folder)

| File | Create/Modify | Responsibility |
|------|---------------|----------------|
| `~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/avoqado-presentacion.html` | Modify (Slide 11 line ~421, Slide 13 line ~471) | Add a `feat` row for the detailed multi-format export, marked PREMIUM. |
| `~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/avoqado-one-pager.html` | Modify (Analítica chip line ~92) | Extend the Analítica chip to mention multi-format export. |
| `…/Avoqado-Presentacion-Plataforma.pdf` + `…/Avoqado-One-Pager.pdf` | Regenerate | Re-run the two Chrome-headless commands from the folder's README. |

---

### Task 1: Backend — register PREMIUM feature code `TRANSACTION_EXPORT`

Adding the string to `PREMIUM_ONLY_CODES` is the single authoritative edit: `venueHasFeatureAccess`, `venuesWithFeatureAccess`, and `checkFeatureAccess.middleware.ts` all iterate this const, so PREMIUM-only semantics propagate with zero changes to the gate functions.

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/services/access/basePlan.service.ts` (lines 24–32)
- Test (create): `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/tests/unit/services/access/basePlan.transactionExport.test.ts`

Steps:

- [ ] Write the failing unit test. It mirrors the self-contained prisma mock style of `basePlan.tierAware.test.ts` (the `feature.code` router on `findFirst`/`findMany`). Create `tests/unit/services/access/basePlan.transactionExport.test.ts`:

```typescript
/**
 * TRANSACTION_EXPORT is a PREMIUM-only differentiator (detailed sales export).
 * PLAN_PREMIUM venues get it; PLAN_PRO venues do NOT (unless they hold their own
 * active VenueFeature grant). Mirrors basePlan.tierAware.test.ts mocking style.
 */
jest.mock('../../../../src/utils/prismaClient', () => ({
  __esModule: true,
  default: {
    venue: { findUnique: jest.fn() },
    venueFeature: { findFirst: jest.fn(), findMany: jest.fn() },
  },
}))
import prisma from '../../../../src/utils/prismaClient'
import { venueHasFeatureAccess, PREMIUM_ONLY_CODES } from '../../../../src/services/access/basePlan.service'

const findFirst = (prisma as any).venueFeature.findFirst as jest.Mock
const findMany = (prisma as any).venueFeature.findMany as jest.Mock
const venueFindUnique = (prisma as any).venue.findUnique as jest.Mock
const ACTIVE = { active: true, suspendedAt: null, endDate: null }

function codeFilter(where: any): { single?: string; list?: string[] } {
  const code = where?.feature?.code
  if (typeof code === 'string') return { single: code }
  if (code && Array.isArray(code.in)) return { list: code.in }
  return {}
}

/** Describe a non-grandfathered venue with a single active tier row (PLAN_PRO or PLAN_PREMIUM). */
function mockTierVenue(tierCode: string) {
  venueFindUnique.mockResolvedValue({ id: 'v1', seatCapExempt: false, status: 'ACTIVE' })
  findFirst.mockResolvedValue(null) // no own grant for TRANSACTION_EXPORT
  findMany.mockImplementation(async ({ where }: any) => {
    const { list } = codeFilter(where)
    if (list && list.includes(tierCode)) return [{ ...ACTIVE, feature: { code: tierCode } }]
    return []
  })
}

beforeEach(() => jest.clearAllMocks())

describe('TRANSACTION_EXPORT premium gating', () => {
  it('is registered as a Premium-only differentiator', () => {
    expect(PREMIUM_ONLY_CODES).toContain('TRANSACTION_EXPORT')
  })

  it('grants TRANSACTION_EXPORT to a PLAN_PREMIUM venue', async () => {
    mockTierVenue('PLAN_PREMIUM')
    await expect(venueHasFeatureAccess('v1', 'TRANSACTION_EXPORT')).resolves.toBe(true)
  })

  it('denies TRANSACTION_EXPORT to a PLAN_PRO venue with no own grant', async () => {
    mockTierVenue('PLAN_PRO')
    await expect(venueHasFeatureAccess('v1', 'TRANSACTION_EXPORT')).resolves.toBe(false)
  })
})
```

- [ ] Run it and confirm it FAILS (the const does not yet contain the code):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/access/basePlan.transactionExport.test.ts
```
Expected: FAIL — `expect(PREMIUM_ONLY_CODES).toContain('TRANSACTION_EXPORT')` fails, and the PRO test returns `true` (PRO blanket-grants any non-premium-only code).

- [ ] Implement: add `'TRANSACTION_EXPORT'` to `PREMIUM_ONLY_CODES` in `basePlan.service.ts`. The array becomes:

```typescript
export const PREMIUM_ONLY_CODES = [
  'CFDI',
  'INVENTORY_TRACKING',
  'TRANSACTION_EXPORT',
  'ADVANCED_ANALYTICS',
  'COMMISSIONS',
  'ATTENDANCE_TRACKING',
  'SERIALIZED_INVENTORY',
  'AUTO_REORDER',
] as const
```

- [ ] Re-run the test and confirm it PASSES:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/access/basePlan.transactionExport.test.ts
```
Expected: PASS — all 3 assertions green.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
git add src/services/access/basePlan.service.ts tests/unit/services/access/basePlan.transactionExport.test.ts
git commit -m "feat(access): register TRANSACTION_EXPORT as a PREMIUM-only feature code

Detailed sales-summary transaction export is gated to PREMIUM. Adding the
code to PREMIUM_ONLY_CODES auto-enforces it across venueHasFeatureAccess,
venuesWithFeatureAccess, and checkFeatureAccess.middleware.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Backend — sales-summary export SERVICE methods (summary flattening + detailed rows + caps)

Two modes: **summary** flattens `getSalesSummary()`'s already-computed numbers into labeled rows by section; **detailed** runs a capped `payment.findMany` reusing `buildPaymentWhereFilter` so it honors the active payment-method/card-type filter (unlike the in-report `byPaymentMethodDetailed` block which is gated to `!isFiltered`).

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/services/dashboard/sales-summary.dashboard.service.ts` (add exports after the existing `getSalesSummary`/`buildPaymentWhereFilter`; reuse `round2`, `bucketOf`)
- Test (create): `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/tests/unit/services/dashboard/salesSummaryExport.service.test.ts`

Steps:

- [ ] Write the failing unit test. It covers: (a) summary flattening returns labeled rows and only the requested sections; (b) the detailed where-clause spreads `buildPaymentWhereFilter` + merchant + staff + date + `status: 'COMPLETED'`. Create `tests/unit/services/dashboard/salesSummaryExport.service.test.ts`:

```typescript
/**
 * Sales-summary export service: summary flattening + detailed where-clause.
 * getSalesSummary is mocked so we test the flattener shape, not the aggregation.
 */
jest.mock('../../../../src/utils/prismaClient', () => ({
  __esModule: true,
  default: { payment: { count: jest.fn(), findMany: jest.fn() } },
}))
import prisma from '../../../../src/utils/prismaClient'
import * as svc from '../../../../src/services/dashboard/sales-summary.dashboard.service'

const paymentCount = (prisma as any).payment.count as jest.Mock
const paymentFindMany = (prisma as any).payment.findMany as jest.Mock

beforeEach(() => jest.clearAllMocks())

describe('flattenSalesSummaryForExport', () => {
  const report: svc.SalesSummaryResponse = {
    dateRange: { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-07') },
    reportType: 'summary',
    summary: {
      grossSales: 1000, items: 50, serviceCosts: 0, discounts: 100, refunds: 25,
      netSales: 875, deferredSales: 0, taxes: 140, tips: 60, platformFees: 12,
      staffCommissions: 0, commissions: 12, totalCollected: 935, netProfit: 863,
      transactionCount: 42,
    },
    byPaymentMethod: [{ method: 'CARD', amount: 700, count: 30, percentage: 70 }],
    filtered: false,
  }

  it('emits totals rows and the payment-method section when requested', () => {
    const { rows } = svc.flattenSalesSummaryForExport(report, ['totals', 'paymentMethods'])
    expect(rows.some(r => r.label === 'Ventas brutas' && r.amount === 1000)).toBe(true)
    expect(rows.some(r => r.section === 'paymentMethods' && r.label === 'CARD')).toBe(true)
  })

  it('omits sections the user did not request', () => {
    const { rows } = svc.flattenSalesSummaryForExport(report, ['totals'])
    expect(rows.some(r => r.section === 'paymentMethods')).toBe(false)
  })
})

describe('detailed rows where-clause + cap', () => {
  it('countSalesSummaryDetailRows scopes to venue+date+COMPLETED and honors payment filter', async () => {
    paymentCount.mockResolvedValue(5)
    const total = await svc.countSalesSummaryDetailRows('v1', {
      startDate: '2026-06-01', endDate: '2026-06-07', paymentMethod: 'CASH',
    })
    expect(total).toBe(5)
    const where = paymentCount.mock.calls[0][0].where
    expect(where.venueId).toBe('v1')
    expect(where.status).toBe('COMPLETED')
    expect(where.method).toBe('CASH') // from buildPaymentWhereFilter('CASH')
    expect(where.createdAt.gte).toBeInstanceOf(Date)
  })

  it('fetchSalesSummaryDetailRows passes take=limit and a stable orderBy', async () => {
    paymentFindMany.mockResolvedValue([])
    await svc.fetchSalesSummaryDetailRows('v1', { startDate: '2026-06-01', endDate: '2026-06-07' }, 1000)
    const arg = paymentFindMany.mock.calls[0][0]
    expect(arg.take).toBe(1000)
    expect(arg.orderBy).toEqual({ createdAt: 'desc' })
    expect(arg.where.status).toBe('COMPLETED')
  })

  it('threads staff (processedById) + shift (shiftId) + merchant into the WHERE when provided', async () => {
    paymentFindMany.mockResolvedValue([])
    await svc.fetchSalesSummaryDetailRows(
      'v1',
      {
        startDate: '2026-06-01',
        endDate: '2026-06-07',
        staffIds: ['staff-1', 'staff-2'],
        shiftId: 'shift-9',
        merchantAccountId: 'ma-7',
      },
      1000,
    )
    const where = paymentFindMany.mock.calls[0][0].where
    expect(where.processedById).toEqual({ in: ['staff-1', 'staff-2'] })
    expect(where.shiftId).toBe('shift-9')
    expect(where.merchantAccountId).toBe('ma-7')
  })

  it('omits staff/shift/merchant from the WHERE when not provided', async () => {
    paymentFindMany.mockResolvedValue([])
    await svc.fetchSalesSummaryDetailRows('v1', { startDate: '2026-06-01', endDate: '2026-06-07' }, 1000)
    const where = paymentFindMany.mock.calls[0][0].where
    expect(where.processedById).toBeUndefined()
    expect(where.shiftId).toBeUndefined()
    expect(where.merchantAccountId).toBeUndefined()
  })
})
```

- [ ] Run it and confirm it FAILS (the functions don't exist yet):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/salesSummaryExport.service.test.ts
```
Expected: FAIL — `svc.flattenSalesSummaryForExport is not a function`, etc.

- [ ] Implement in `sales-summary.dashboard.service.ts`. Add near the other exported helpers (after `getSalesSummary`). Reuse the exported `buildPaymentWhereFilter(paymentMethod, cardType)` (line 249) and `round2` convention. The flattener consumes the already-computed `SalesSummaryResponse`; the detailed fetch mirrors the canonical findMany at lines 1096–1099 but uses `paymentLevelFilter` (honors the active filter) and an extended `select`:

```typescript
/** Section ids the summary export can include. */
export type SalesSummaryExportSection = 'totals' | 'paymentMethods' | 'cardTypes' | 'merchantAccounts' | 'byPeriod'

/** One flattened row for the summary-mode export (rendered by encodeExport columns). */
export interface SalesSummaryExportRow {
  section: SalesSummaryExportSection
  label: string
  count: number | null
  amount: number | null
  percentage: number | null
}

/** Detailed-mode + summary-mode filter inputs (superset of SalesSummaryFilters used by the report). */
export interface SalesSummaryExportFilters {
  startDate: string
  endDate: string
  paymentMethod?: PaymentMethodFilter
  cardType?: CardTypeFilter
  merchantAccountId?: string
  /** Detailed mode only — single or multi staff. */
  staffIds?: string[]
  /** Detailed mode only — cash-session / shift scope. */
  shiftId?: string
}

const round2x = (n: number | null | undefined): number | null => (n == null ? null : Math.round(n * 100) / 100)

/**
 * Flatten an already-computed SalesSummaryResponse into labeled rows, one per requested section.
 * Order-derived totals can be null under a payment-method filter — preserved as null (the
 * export columns render null as '').
 */
export function flattenSalesSummaryForExport(
  report: SalesSummaryResponse,
  sections: SalesSummaryExportSection[],
): { rows: SalesSummaryExportRow[] } {
  const want = new Set(sections)
  const rows: SalesSummaryExportRow[] = []
  const s = report.summary

  if (want.has('totals')) {
    const t = (label: string, amount: number | null, count: number | null = null): SalesSummaryExportRow => ({
      section: 'totals', label, count, amount: round2x(amount), percentage: null,
    })
    rows.push(t('Ventas brutas', s.grossSales, s.transactionCount))
    rows.push(t('Descuentos', s.discounts == null ? null : -s.discounts))
    rows.push(t('Reembolsos', -s.refunds))
    rows.push(t('Ventas netas', s.netSales))
    rows.push(t('Impuestos', s.taxes))
    rows.push(t('Propinas', s.tips))
    rows.push(t('Comisiones de plataforma', -s.platformFees))
    rows.push(t('Total cobrado', s.totalCollected))
  }
  if (want.has('paymentMethods') && report.byPaymentMethod) {
    for (const m of report.byPaymentMethod) {
      rows.push({ section: 'paymentMethods', label: m.method, count: m.count, amount: round2x(m.amount), percentage: round2x(m.percentage) })
    }
  }
  // NOTE (see Task 6 FIX 7): getSalesSummary only populates byPaymentMethodDetailed when
  // groupBy==='paymentMethod' AND no paymentMethod filter is active (it is the unfiltered
  // card-type sub-bucketing). So when the caller has an active paymentMethod filter, this
  // section is silently empty — the dialog disables the "Card-type detail" checkbox in that
  // case so the user can never select a section that yields nothing.
  if (want.has('cardTypes') && report.byPaymentMethodDetailed) {
    for (const b of report.byPaymentMethodDetailed) {
      for (const sub of b.subBuckets ?? []) {
        rows.push({ section: 'cardTypes', label: sub.type, count: sub.count, amount: round2x(sub.amount), percentage: round2x(sub.percentage) })
      }
    }
  }
  if (want.has('merchantAccounts') && report.byMerchantAccount) {
    for (const ma of report.byMerchantAccount) {
      rows.push({ section: 'merchantAccounts', label: ma.displayName, count: ma.transactionCount, amount: round2x(ma.netToReceive), percentage: null })
    }
  }
  if (want.has('byPeriod') && report.byPeriod) {
    for (const p of report.byPeriod) {
      rows.push({ section: 'byPeriod', label: p.periodLabel || p.period, count: p.metrics.transactionCount, amount: round2x(p.metrics.totalCollected), percentage: null })
    }
  }
  return { rows }
}

/** Shared WHERE used by both count + fetch for detailed-mode rows (honors the active filter). */
function buildSalesSummaryDetailWhere(venueId: string, filters: SalesSummaryExportFilters): Prisma.PaymentWhereInput {
  const paymentWhereFilter = buildPaymentWhereFilter(filters.paymentMethod, filters.cardType)
  const where: Prisma.PaymentWhereInput = {
    venueId,
    status: 'COMPLETED',
    createdAt: { gte: new Date(filters.startDate), lte: new Date(filters.endDate) },
    ...(filters.merchantAccountId ? { merchantAccountId: filters.merchantAccountId } : {}),
    ...(filters.staffIds && filters.staffIds.length > 0 ? { processedById: { in: filters.staffIds } } : {}),
    ...(filters.shiftId ? { shiftId: filters.shiftId } : {}),
    ...paymentWhereFilter,
  }
  return where
}

/** Pre-flight count for detailed-mode export (caller compares against the row cap before fetching). */
export async function countSalesSummaryDetailRows(venueId: string, filters: SalesSummaryExportFilters): Promise<number> {
  return prisma.payment.count({ where: buildSalesSummaryDetailWhere(venueId, filters) })
}

/** Fetch capped detailed-mode payment rows; flat select with everything the export columns pluck. */
export async function fetchSalesSummaryDetailRows(venueId: string, filters: SalesSummaryExportFilters, limit: number) {
  return prisma.payment.findMany({
    where: buildSalesSummaryDetailWhere(venueId, filters),
    select: {
      id: true, createdAt: true, method: true, cardBrand: true, maskedPan: true,
      processorData: true, amount: true, tipAmount: true, status: true, source: true, orderId: true,
      processedBy: { select: { firstName: true, lastName: true } },
      merchantAccount: { select: { displayName: true, externalMerchantId: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })
}
```

> NOTE (CONFIRMED): `Payment.processedById` (Staff?, schema line 2696-2697), `Payment.shiftId` (Shift?, line 2693-2694) and `Payment.merchantAccountId` (line 2702-2703) ALL exist as direct `Payment` columns — verified against `avoqado-server/prisma/schema.prisma`. There is NO deferral: the staff (`processedById: { in: staffIds }`) and shift (`shiftId`) WHERE branches above are correct as written, and the staff/shift FilterPills (detailed-mode only) in Task 6 are in scope, not deferred.

- [ ] Re-run the test and confirm it PASSES:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard/salesSummaryExport.service.test.ts
```
Expected: PASS — flattening + where-clause assertions green.

- [ ] Run the broader sales-summary service suite to confirm no regression:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/services/dashboard --silent
```
Expected: PASS — existing tests unaffected.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
git add src/services/dashboard/sales-summary.dashboard.service.ts tests/unit/services/dashboard/salesSummaryExport.service.test.ts
git commit -m "feat(reports): sales-summary export service (summary flatten + detailed rows)

flattenSalesSummaryForExport reuses getSalesSummary numbers; detailed rows
reuse buildPaymentWhereFilter so an active payment-method/card-type filter is
honored. Pre-flight count + capped findMany for row-cap enforcement.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Backend — export CONTROLLER + ROUTE

Thin controller mirroring `salesSummaryReport` (venue resolution, param validation, English-for-param-errors convention) AND `exportPaymentsData` (parse helpers, pre-flight count → 413, `allColumns` registry, `encodeExport` + `sendExport`). Detailed mode adds an inline PREMIUM gate → 403 reusing the platform-wide feature-gate contract (`{ error, message, featureCode, subscriptionRequired }`, verbatim from `checkFeatureAccess.middleware.ts`). Summary mode honors the SAME `reconciliationAllowed` tier gate the report uses, so the `merchantAccounts` section never leaks PRO-tier per-merchant reconciliation to a non-entitled venue. Editable filters (paymentMethod, cardType, merchantAccountId, and — detailed mode only — staffId/staffIds + shiftId) are parsed from query params and threaded into the service. The route reuses the SAME `clampSalesSummaryRangeToToday` middleware (Free-tier clamp).

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/controllers/dashboard/sales-summary.dashboard.controller.ts` (add `salesSummaryExport` + imports)
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/routes/dashboard/reports.routes.ts` (import + route after line 103)
- Test (create): `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/tests/api-tests/dashboard/salesSummaryExport.api.test.ts`

Steps:

- [ ] Write the failing API test. Mirror existing dashboard api-tests (e.g. `saleVerificationEdit.api.test.ts`) for the supertest + auth-mock harness. The 4 cases from the spec: summary CSV 200 + content-type; detailed mode for non-PREMIUM venue → 403; row-cap exceeded → 413; detailed CSV for PREMIUM venue → 200. Create `tests/api-tests/dashboard/salesSummaryExport.api.test.ts`:

```typescript
import request from 'supertest'
import app from '../../../src/app'
import * as access from '../../../src/services/access/basePlan.service'
import * as svc from '../../../src/services/dashboard/sales-summary.dashboard.service'
// reuse this suite's existing auth/venue test harness (see saleVerificationEdit.api.test.ts):
import { authHeadersFor, seedVenue } from '../helpers/auth-test-harness' // adjust to the real helper used in this folder

const RANGE = 'startDate=2026-06-01T00:00:00.000Z&endDate=2026-06-07T23:59:59.999Z'

describe('GET /api/v1/dashboard/reports/sales-summary/export', () => {
  beforeEach(() => jest.restoreAllMocks())

  it('summary mode returns a CSV (200, text/csv)', async () => {
    jest.spyOn(access, 'venueHasFeatureAccess').mockResolvedValue(true) // ADVANCED_REPORTS
    // Minimally-valid SalesSummaryResponse — the flattener reads `summary` (all
    // SalesSummaryMetrics fields) + byPaymentMethod. Mirrors the real shape from
    // sales-summary.dashboard.service.ts (SalesSummaryMetrics @48-70, SalesSummaryResponse @144-157).
    const fakeReport: svc.SalesSummaryResponse = {
      dateRange: { startDate: new Date('2026-06-01'), endDate: new Date('2026-06-07') },
      reportType: 'summary',
      summary: {
        grossSales: 1000,
        items: 1000,
        serviceCosts: 0,
        discounts: 100,
        refunds: 25,
        netSales: 875,
        deferredSales: 0,
        taxes: 140,
        tips: 60,
        platformFees: 12,
        staffCommissions: 0,
        commissions: 12,
        totalCollected: 935,
        netProfit: 863,
        transactionCount: 42,
      },
      byPaymentMethod: [{ method: 'CARD', amount: 700, count: 30, percentage: 70 }],
      filtered: false,
    }
    jest.spyOn(svc, 'getSalesSummary').mockResolvedValue(fakeReport)
    const venueId = await seedVenue()
    const res = await request(app)
      .get(`/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export?mode=summary&format=csv&${RANGE}`)
      .set(await authHeadersFor(venueId, 'OWNER'))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
    expect(res.headers['content-disposition']).toContain('attachment')
  })

  it('detailed mode is PREMIUM-gated: 403 for a non-entitled venue', async () => {
    jest.spyOn(access, 'venueHasFeatureAccess').mockImplementation(async (_v, code) => code === 'ADVANCED_REPORTS')
    const venueId = await seedVenue()
    const res = await request(app)
      .get(`/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export?mode=detailed&format=csv&${RANGE}`)
      .set(await authHeadersFor(venueId, 'OWNER'))
    expect(res.status).toBe(403)
    // Must match the platform-wide feature-gate contract verbatim (checkFeatureAccess.middleware.ts:113-118)
    // — NOT an invented `code`. featureCode + subscriptionRequired are what the dashboard's
    // FeatureGate / upsell + the export dialog's catch block read.
    expect(res.body.featureCode).toBe('TRANSACTION_EXPORT')
    expect(res.body.subscriptionRequired).toBe(true)
  })

  it('row-cap exceeded returns 413', async () => {
    jest.spyOn(access, 'venueHasFeatureAccess').mockResolvedValue(true)
    jest.spyOn(svc, 'countSalesSummaryDetailRows').mockResolvedValue(20_000)
    const venueId = await seedVenue()
    const res = await request(app)
      .get(`/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export?mode=detailed&format=csv&${RANGE}`)
      .set(await authHeadersFor(venueId, 'OWNER'))
    expect(res.status).toBe(413)
    expect(res.body.success).toBe(false)
  })

  it('detailed CSV for a PREMIUM venue returns 200', async () => {
    jest.spyOn(access, 'venueHasFeatureAccess').mockResolvedValue(true)
    jest.spyOn(svc, 'countSalesSummaryDetailRows').mockResolvedValue(3)
    jest.spyOn(svc, 'fetchSalesSummaryDetailRows').mockResolvedValue([] as any)
    const venueId = await seedVenue()
    const res = await request(app)
      .get(`/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export?mode=detailed&format=csv&${RANGE}`)
      .set(await authHeadersFor(venueId, 'OWNER'))
    expect(res.status).toBe(200)
    expect(res.headers['content-type']).toContain('text/csv')
  })
})
```

> The `authHeadersFor`/`seedVenue` helpers above are placeholders for the harness this api-tests folder already uses — during implementation, copy the auth/venue setup verbatim from a sibling spec (e.g. `saleVerificationEdit.api.test.ts`) rather than inventing one.

- [ ] Run it and confirm it FAILS (route 404 / controller missing):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/api-tests/dashboard/salesSummaryExport.api.test.ts
```
Expected: FAIL — 404 (route not registered) on every case.

- [ ] Implement the controller. Extend the import block in `sales-summary.dashboard.controller.ts` (lines 8–22) to add the export helpers + the new service functions:

```typescript
import {
  getSalesSummary,
  SalesSummaryFilters,
  ReportType,
  PaymentMethodFilter,
  CardTypeFilter,
  SalesSummaryExportFilters,
  SalesSummaryExportSection,
  SalesSummaryExportRow,
  flattenSalesSummaryForExport,
  countSalesSummaryDetailRows,
  fetchSalesSummaryDetailRows,
} from '@/services/dashboard/sales-summary.dashboard.service'
import {
  encodeExport,
  sendExport,
  parseColumnsParam,
  parseFormatParam,
  getRowCapForFormat,
  type ExportColumnDef,
} from '@/services/dashboard/export.helpers'
```

Then add the controller fn (after `salesSummaryReport`). It validates params English-style via `BadRequestError`, gates detailed mode (SUPERADMIN bypass OR `venueHasFeatureAccess(venueId, 'TRANSACTION_EXPORT')`) → 403 using the platform feature-gate contract, gates the summary `merchantAccounts` section on `ADVANCED_REPORTS`, pre-flight counts → 413 (Spanish), then encodes:

```typescript
/**
 * GET /api/v1/dashboard/reports/sales-summary/export
 *
 * Streams a CSV/XLSX/PDF of the sales summary. mode=summary flattens getSalesSummary();
 * mode=detailed (PREMIUM, TRANSACTION_EXPORT) emits per-payment rows. Free-tier range clamp
 * is enforced by clampSalesSummaryRangeToToday in the route chain.
 *
 * Query params (all optional unless noted):
 * - mode: 'summary' (default) | 'detailed'
 * - format: 'csv' (default) | 'xlsx' | 'pdf'
 * - startDate / endDate: ISO date strings (required)
 * - sections: comma list (summary mode) — totals,paymentMethods,cardTypes,merchantAccounts,byPeriod
 * - columns: comma list (detailed mode) — column ids from the registry below
 * - paymentMethod / cardType / merchantAccountId: filter passthrough (both modes)
 * - staffId (single) | staffIds (comma list) / shiftId: DETAILED MODE ONLY
 *
 * @permission reports:read
 */
export async function salesSummaryExport(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const venueId = resolveRequestVenueId(req, req.authContext!)
    if (!venueId) throw new BadRequestError('No venue context for the request')

    const { startDate, endDate, merchantAccountId, paymentMethod, cardType, staffIds, shiftId } = req.query
    const mode = req.query.mode === 'detailed' ? 'detailed' : 'summary'
    const format = parseFormatParam(req.query.format) // 'csv' | 'xlsx' | 'pdf'

    if (!startDate || typeof startDate !== 'string') throw new BadRequestError('startDate is required (ISO date string)')
    if (!endDate || typeof endDate !== 'string') throw new BadRequestError('endDate is required (ISO date string)')

    const validPaymentMethods: PaymentMethodFilter[] = ['CASH', 'CARD', 'QR_LEGACY', 'OTHER']
    if (paymentMethod && !validPaymentMethods.includes(paymentMethod as PaymentMethodFilter)) {
      throw new BadRequestError(`Invalid paymentMethod. Must be one of: ${validPaymentMethods.join(', ')}`)
    }
    const validCardTypes: CardTypeFilter[] = ['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']
    if (cardType && !validCardTypes.includes(cardType as CardTypeFilter)) {
      throw new BadRequestError(`Invalid cardType. Must be one of: ${validCardTypes.join(', ')}`)
    }
    if (paymentMethod === 'QR_LEGACY' && venueId !== MINDFORM_NEW_VENUE_ID) {
      throw new BadRequestError('QR_LEGACY filter is only available for the MindForm venue')
    }

    const cap = getRowCapForFormat(format)
    const parseList = (raw: unknown): string[] | undefined => {
      if (typeof raw !== 'string') return undefined
      const list = raw.split(',').map(s => s.trim()).filter(Boolean)
      return list.length > 0 ? list : undefined
    }
    // `staffId` (single) is accepted as an alias for `staffIds` (comma list) — the dialog can send either.
    const staffIdList = parseList(staffIds) ?? (typeof req.query.staffId === 'string' ? [req.query.staffId] : undefined)

    // ── DETAILED MODE — PREMIUM gate + per-payment rows ───────────────────────
    if (mode === 'detailed') {
      const allowed =
        req.authContext?.role === 'SUPERADMIN' || (await venueHasFeatureAccess(venueId, 'TRANSACTION_EXPORT'))
      if (!allowed) {
        // REUSE the platform-wide feature-gate 403 contract (verbatim shape from
        // checkFeatureAccess.middleware.ts:113-118) — NOT an invented `code`. The dashboard's
        // FeatureGate/upsell + this dialog's catch read `featureCode` + `subscriptionRequired`.
        res.status(403).json({
          error: 'Feature not available',
          message: `This venue does not have access to the TRANSACTION_EXPORT feature. Please subscribe to enable this feature.`,
          featureCode: 'TRANSACTION_EXPORT',
          subscriptionRequired: true,
        })
        return
      }

      const filters: SalesSummaryExportFilters = {
        startDate,
        endDate,
        paymentMethod: typeof paymentMethod === 'string' ? (paymentMethod as PaymentMethodFilter) : undefined,
        cardType: typeof cardType === 'string' ? (cardType as CardTypeFilter) : undefined,
        merchantAccountId: typeof merchantAccountId === 'string' ? merchantAccountId : undefined,
        staffIds: staffIdList,
        shiftId: typeof shiftId === 'string' ? shiftId : undefined,
      }

      const total = await countSalesSummaryDetailRows(venueId, filters)
      if (total > cap) {
        res.status(413).json({
          success: false,
          message:
            format === 'pdf'
              ? `El rango contiene ${total.toLocaleString()} transacciones. PDF está limitado a ${cap.toLocaleString()}. Usa CSV o Excel, o reduce el rango con filtros.`
              : `El rango contiene ${total.toLocaleString()} transacciones. El máximo por export es ${cap.toLocaleString()}. Reduce el rango con filtros.`,
        })
        return
      }

      const rows = await fetchSalesSummaryDetailRows(venueId, filters, cap)
      type Row = (typeof rows)[number]

      // Column registry — order here is the order in the output file.
      const allColumns: ExportColumnDef<Row>[] = [
        { id: 'createdAt', label: 'Fecha', value: r => r.createdAt?.toISOString() ?? '' },
        { id: 'paymentId', label: 'ID', value: r => r.id },
        {
          id: 'waiterName',
          label: 'Mesero',
          value: r => (r.processedBy ? `${r.processedBy.firstName ?? ''} ${r.processedBy.lastName ?? ''}`.trim() : ''),
        },
        {
          id: 'merchantAccount',
          label: 'Cuenta Comercial',
          value: r => r.merchantAccount?.displayName || r.merchantAccount?.externalMerchantId || '',
        },
        { id: 'method', label: 'Método', value: r => r.method ?? '' },
        { id: 'cardBrand', label: 'Marca', value: r => r.cardBrand ?? '' },
        { id: 'last4', label: 'Últimos 4', value: r => (r.maskedPan ? r.maskedPan.slice(-4) : '') },
        {
          id: 'international',
          label: 'Internacional',
          value: r => (!!(r.processorData as { isInternational?: boolean } | null)?.isInternational ? 'Sí' : 'No'),
        },
        { id: 'amount', label: 'Subtotal', value: r => Number(r.amount) || 0 },
        { id: 'tipAmount', label: 'Propina', value: r => Number(r.tipAmount) || 0 },
        { id: 'totalAmount', label: 'Total', value: r => (Number(r.amount) || 0) + (Number(r.tipAmount) || 0) },
        { id: 'status', label: 'Estatus', value: r => r.status ?? '' },
        { id: 'source', label: 'Origen', value: r => r.source ?? '' },
      ]

      const requestedColumnIds = parseColumnsParam(req.query.columns)
      const encoded = await encodeExport(format, {
        allColumns,
        requestedColumnIds: requestedColumnIds.length > 0 ? requestedColumnIds : allColumns.map(c => c.id),
        rows,
        title: 'Ventas detalladas',
      })
      logger.info('[SalesSummary export detailed]', { venueId, total, format, columns: requestedColumnIds.length })
      sendExport(res, encoded, 'ventas-detalladas')
      return
    }

    // ── SUMMARY MODE — flatten getSalesSummary numbers ────────────────────────
    // Fetch the venue timezone here (summary mode is the only branch that needs it —
    // for period labels + the getSalesSummary tz arg). Detailed mode does not use it.
    const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { timezone: true } })

    const validSections: SalesSummaryExportSection[] = ['totals', 'paymentMethods', 'cardTypes', 'merchantAccounts', 'byPeriod']
    const requestedSections = parseColumnsParam(req.query.sections).filter(s =>
      validSections.includes(s as SalesSummaryExportSection),
    ) as SalesSummaryExportSection[]
    const sections = requestedSections.length > 0 ? requestedSections : ['totals', 'paymentMethods']

    // 🔴 TIER GATE (mirrors salesSummaryReport lines 116-130, decision Jose 2026-06-10):
    // the merchant-reconciliation block (byMerchantAccount) rides ADVANCED_REPORTS (PRO tier).
    // Only request includeMerchantBreakdown when the user actually selected the
    // 'merchantAccounts' section AND the venue is entitled (SUPERADMIN bypass OR
    // ADVANCED_REPORTS). NEVER pass it unconditionally — that leaks PRO-tier per-merchant
    // reconciliation data into non-entitled venues. When dropped, getSalesSummary omits
    // byMerchantAccount, so the flattener silently produces no 'merchantAccounts' rows
    // (mirrors the report's additive "silently drop the flag" behavior — no 403 in summary mode).
    const wantsMerchantBreakdown = sections.includes('merchantAccounts')
    const reconciliationAllowed =
      wantsMerchantBreakdown &&
      (req.authContext?.role === 'SUPERADMIN' || (await venueHasFeatureAccess(venueId, 'ADVANCED_REPORTS')))

    const filters: SalesSummaryFilters = {
      startDate,
      endDate,
      groupBy: 'paymentMethod',
      reportType: 'summary',
      timezone: venue?.timezone || 'America/Mexico_City',
      merchantAccountId: typeof merchantAccountId === 'string' ? merchantAccountId : undefined,
      paymentMethod: typeof paymentMethod === 'string' ? (paymentMethod as PaymentMethodFilter) : undefined,
      cardType: typeof cardType === 'string' ? (cardType as CardTypeFilter) : undefined,
      includeMerchantBreakdown: reconciliationAllowed,
    }
    const report = await getSalesSummary(venueId, filters)

    const { rows } = flattenSalesSummaryForExport(report, sections)
    type Row = SalesSummaryExportRow

    const allColumns: ExportColumnDef<Row>[] = [
      { id: 'section', label: 'Sección', value: r => r.section },
      { id: 'label', label: 'Concepto', value: r => r.label },
      { id: 'count', label: 'Cantidad', value: r => r.count },
      { id: 'amount', label: 'Monto', value: r => r.amount },
      { id: 'percentage', label: 'Porcentaje', value: r => r.percentage },
    ]

    const encoded = await encodeExport(format, {
      allColumns,
      requestedColumnIds: allColumns.map(c => c.id),
      rows,
      title: 'Resumen de ventas',
    })
    logger.info('[SalesSummary export summary]', { venueId, format, sections })
    sendExport(res, encoded, 'resumen-ventas')
  } catch (error) {
    logger.error('Sales summary export error:', error)
    next(error)
  }
}
```

- [ ] Implement the route. In `reports.routes.ts`, extend the controller import (line 18) and register the route immediately after line 103 (the `/sales-summary` route), BEFORE any `/:id` sibling — mirror the dual bare + `/venues/:venueId/...` registration used by pay-later-aging (lines 84–85):

```typescript
import { salesSummaryReport, salesSummaryExport } from '@/controllers/dashboard/sales-summary.dashboard.controller'
```

```typescript
/**
 * GET /api/v1/dashboard/reports/sales-summary/export
 * Streams CSV/XLSX/PDF. mode=summary (Free=today via clamp) | mode=detailed (PREMIUM TRANSACTION_EXPORT).
 * @permission reports:read
 */
router.get('/sales-summary/export', checkPermission('reports:read'), clampSalesSummaryRangeToToday, salesSummaryExport)
router.get('/venues/:venueId/sales-summary/export', checkPermission('reports:read'), clampSalesSummaryRangeToToday, salesSummaryExport)
```

- [ ] Re-run the API test and confirm it PASSES:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/api-tests/dashboard/salesSummaryExport.api.test.ts
```
Expected: PASS — 200 CSV, 403 detailed-non-premium, 413 over-cap, 200 detailed-premium.

- [ ] Confirm TypeScript builds:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit
```
Expected: no errors.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
git add src/controllers/dashboard/sales-summary.dashboard.controller.ts src/routes/dashboard/reports.routes.ts tests/api-tests/dashboard/salesSummaryExport.api.test.ts
git commit -m "feat(reports): GET /sales-summary/export endpoint (summary + PREMIUM detailed)

Reuses export.helpers (encodeExport/sendExport/getRowCapForFormat) and the
sales-summary service. Detailed mode gated on TRANSACTION_EXPORT (403 if
non-entitled); pre-flight count -> 413; Free-tier range clamp via shared middleware.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Backend — MCP tool `export_sales_summary`

Mirror `settlement_calendar` (sales.ts:368–393): full gate + venue timezone + service call + `text()`. The MCP cannot stream a file, so the tool returns the flattened summary rows (and, for detailed mode, a capped row count + first-N rows) plus a note. Summary mode gates on `ADVANCED_REPORTS`; detailed mode additionally gates on `TRANSACTION_EXPORT`.

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/src/mcp/tools/sales.ts` (import lines 1–11; new `server.tool` before the closing `}` at line 394)
- Test (create): `/Users/amieva/Documents/Programming/Avoqado/avoqado-server/tests/unit/mcp-customer/export-sales-summary.test.ts`

Steps:

- [ ] Extend the import block in `sales.ts` (lines 1–11) to pull the new service functions and `getSalesSummary`:

```typescript
import {
  computeSettlementProjection,
  getSalesSummary,
  flattenSalesSummaryForExport,
  countSalesSummaryDetailRows,
  fetchSalesSummaryDetailRows,
  type SalesSummaryExportSection,
} from '@/services/dashboard/sales-summary.dashboard.service'
```

- [ ] Add the new tool INSIDE `registerSalesTools(server, scope)`, after the `settlement_calendar` block (line 393) and before the function's closing `}` (line 394). It reuses the established `guard.venueFilter` + `planGateMessage` preamble:

```typescript
  server.tool(
    'export_sales_summary',
    'Export the sales summary for a venue you can access ("exporta mis ventas"). mode=summary returns the flattened totals + chosen sections; mode=detailed (Premium) returns the matching per-transaction rows. Honors the same date range + payment-method/card-type/merchant filters as the dashboard report. Pass venueId; optionally fromDate/toDate (YYYY-MM-DD), mode, sections (comma list), paymentMethod, cardType, merchantAccountId.',
    {
      venueId: z.string().describe('Venue to export (must be in your scope)'),
      mode: z.enum(['summary', 'detailed']).optional().describe('summary totals (default) or detailed transactions (Premium)'),
      fromDate: z.string().optional().describe('Start date YYYY-MM-DD (default: 7 days ago)'),
      toDate: z.string().optional().describe('End date YYYY-MM-DD (default: today)'),
      sections: z.string().optional().describe('Summary sections, comma-separated: totals,paymentMethods,cardTypes,merchantAccounts,byPeriod'),
      paymentMethod: z.enum(['CASH', 'CARD', 'QR_LEGACY', 'OTHER']).optional().describe('Filter to one payment bucket'),
      cardType: z.enum(['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']).optional().describe('Card sub-filter (only when paymentMethod=CARD)'),
      merchantAccountId: z.string().optional().describe('Filter to one merchant account'),
    },
    async ({ venueId, mode, fromDate, toDate, sections, paymentMethod, cardType, merchantAccountId }) => {
      guard.venueFilter(venueId) // throws ScopeError if out of scope
      const reportGate = await planGateMessage(venueId, 'ADVANCED_REPORTS', 'La exportación de ventas')
      if (reportGate) return text({ ok: false, planRequired: true, error: reportGate })

      const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { timezone: true } })
      const tz = venue?.timezone || 'America/Mexico_City'
      const start = venueStartOfDay(tz, fromDate ? new Date(`${fromDate}T12:00:00`) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000))
      const end = venueEndOfDay(tz, toDate ? new Date(`${toDate}T12:00:00`) : undefined)
      const range = { startDate: start.toISOString(), endDate: end.toISOString() }

      if (mode === 'detailed') {
        const detailGate = await planGateMessage(venueId, 'TRANSACTION_EXPORT', 'La exportación detallada de transacciones')
        if (detailGate) return text({ ok: false, planRequired: true, error: detailGate })
        const filters = { ...range, paymentMethod, cardType, merchantAccountId }
        const total = await countSalesSummaryDetailRows(venueId, filters)
        const rows = await fetchSalesSummaryDetailRows(venueId, filters, 200) // cap MCP payload
        return text({ venueId, mode: 'detailed', window: range, timezone: tz, total, returned: rows.length, rows })
      }

      const requested = (sections ?? 'totals,paymentMethods')
        .split(',').map(s => s.trim()).filter(Boolean) as SalesSummaryExportSection[]
      // includeMerchantBreakdown: true is SAFE here (no tier leak) — the whole tool already
      // gated on ADVANCED_REPORTS via `reportGate` at the top and returned early if the venue
      // is not entitled. So by this line the venue holds ADVANCED_REPORTS (the same code that
      // unlocks byMerchantAccount). This is the MCP analogue of the report controller's
      // reconciliationAllowed gate — kept in lockstep, never an afterthought.
      const report = await getSalesSummary(venueId, {
        ...range, groupBy: 'paymentMethod', reportType: 'summary', timezone: tz,
        paymentMethod, cardType, merchantAccountId, includeMerchantBreakdown: true,
      })
      const { rows } = flattenSalesSummaryForExport(report, requested)
      return text({ venueId, mode: 'summary', window: range, timezone: tz, sections: requested, rows })
    },
  )
```

- [ ] Add a behavioral test for the tool (FIX 8). Mirror the handler-capture pattern of `tests/unit/mcp-customer/serialized-gating.test.ts` (register the tools against a fake `server` that stores each handler, then invoke by name). Mock `planGateMessage` to deny `TRANSACTION_EXPORT` for the non-Premium case and allow everything for the entitled case. Assert: (a) detailed mode is DENIED for a venue without `TRANSACTION_EXPORT` (returns `{ ok: false, planRequired: true }`, no fetch); (b) summary mode returns flattened rows for an entitled venue. Create `tests/unit/mcp-customer/export-sales-summary.test.ts`:

```typescript
/**
 * export_sales_summary MCP tool: summary gates on ADVANCED_REPORTS, detailed additionally on
 * TRANSACTION_EXPORT (Premium). Mirrors serialized-gating.test.ts handler-capture style.
 */
import { registerSalesTools } from '../../../src/mcp/tools/sales'
import type { McpScope } from '../../../src/mcp/scope'

const mockPlanGate = jest.fn()
const mockGetSalesSummary = jest.fn()
const mockFlatten = jest.fn()
const mockCount = jest.fn()
const mockFetch = jest.fn()

jest.mock('@/mcp/planGate', () => ({ planGateMessage: (...a: unknown[]) => mockPlanGate(...(a as [])) }))
jest.mock('@/services/dashboard/sales-summary.dashboard.service', () => ({
  computeSettlementProjection: jest.fn(),
  getSalesSummary: (...a: unknown[]) => mockGetSalesSummary(...(a as [])),
  flattenSalesSummaryForExport: (...a: unknown[]) => mockFlatten(...(a as [])),
  countSalesSummaryDetailRows: (...a: unknown[]) => mockCount(...(a as [])),
  fetchSalesSummaryDetailRows: (...a: unknown[]) => mockFetch(...(a as [])),
}))
jest.mock('@/mcp/guard', () => ({
  createGuard: () => ({ venueFilter: (v?: string) => (v ? { venueId: { in: [v] } } : { venueId: { in: ['v1'] } }) }),
}))
jest.mock('@/utils/prismaClient', () => ({
  __esModule: true,
  default: { venue: { findUnique: jest.fn().mockResolvedValue({ timezone: 'America/Mexico_City' }) } },
}))

const handlers = new Map<string, (a: Record<string, unknown>, e: unknown) => Promise<{ content: Array<{ text: string }> }>>()
const scope = { staffId: 'staff-1', activeOrg: 'o1', allowedVenueIds: ['v1'], perVenueAccess: new Map() } as McpScope
const call = (n: string, args: Record<string, unknown>) => handlers.get(n)!(args, {})
const parse = (r: { content: Array<{ text: string }> }) => JSON.parse(r.content[0].text)

beforeAll(() => {
  registerSalesTools({ tool: (...a: unknown[]) => handlers.set(a[0] as string, a[a.length - 1] as never) } as never, scope)
})
beforeEach(() => jest.clearAllMocks())

describe('export_sales_summary — plan gating', () => {
  it('detailed mode is DENIED for a non-Premium (no TRANSACTION_EXPORT) venue', async () => {
    // ADVANCED_REPORTS allowed (null) but TRANSACTION_EXPORT denied (returns a message).
    mockPlanGate.mockImplementation(async (_v: string, code: string) =>
      code === 'TRANSACTION_EXPORT' ? 'La exportación detallada de transacciones requiere el plan Premium.' : null,
    )
    const out = parse(await call('export_sales_summary', { venueId: 'v1', mode: 'detailed' }))
    expect(out.planRequired).toBe(true)
    expect(out.ok).toBe(false)
    expect(mockCount).not.toHaveBeenCalled()
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('summary mode returns flattened rows for an entitled venue', async () => {
    mockPlanGate.mockResolvedValue(null) // ADVANCED_REPORTS granted
    mockGetSalesSummary.mockResolvedValue({ summary: { grossSales: 100, transactionCount: 3 }, byPaymentMethod: [] })
    mockFlatten.mockReturnValue({ rows: [{ section: 'totals', label: 'Ventas brutas', amount: 100, count: 3, percentage: null }] })
    const out = parse(await call('export_sales_summary', { venueId: 'v1', mode: 'summary' }))
    expect(out.mode).toBe('summary')
    expect(out.rows).toHaveLength(1)
    expect(mockGetSalesSummary).toHaveBeenCalled()
  })
})
```

- [ ] Run the new MCP test and confirm it PASSES:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx jest tests/unit/mcp-customer/export-sales-summary.test.ts
```
Expected: PASS — detailed denied (no fetch), summary returns rows. (Before the tool exists, `handlers.get('export_sales_summary')` is undefined → the calls throw, so the test fails first; TDD satisfied.)

- [ ] Verify it registers (build + the full MCP suite):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit && npx jest tests/unit/mcp-customer --silent
```
Expected: no TS errors; existing MCP tests still pass + the new one is green (no registration array to update — the `server.tool()` call inside `registerSalesTools` is auto-wired by `server.ts:42`).

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server
git add src/mcp/tools/sales.ts tests/unit/mcp-customer/export-sales-summary.test.ts
git commit -m "feat(mcp): export_sales_summary tool (summary + Premium detailed)

Mirrors settlement_calendar: scope guard + plan gate + venue timezone. Summary
gated on ADVANCED_REPORTS; detailed additionally on TRANSACTION_EXPORT. Keeps
the MCP in lockstep with the new export endpoint.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Frontend — `TRANSACTION_EXPORT` → PREMIUM in plan-catalog + i18n keys

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/config/plan-catalog.ts` (line 66)
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/locales/es/reports.json` (`salesSummary.export.*`)
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/locales/en/reports.json` (`salesSummary.export.*`)

Steps:

- [ ] Add `'TRANSACTION_EXPORT'` to the PREMIUM tier `includes` array in `plan-catalog.ts` (line 66). The array becomes:

```typescript
    includes: ['CFDI', 'INVENTORY_TRACKING', 'TRANSACTION_EXPORT', 'ADVANCED_ANALYTICS', 'COMMISSIONS', 'ATTENDANCE_TRACKING', 'SERIALIZED_INVENTORY', 'AUTO_REORDER'],
```

- [ ] Verify the catalog mapping resolves with a quick node check (no test framework needed):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsx -e "import { getTierForFeature } from './src/config/plan-catalog'; console.log(getTierForFeature('TRANSACTION_EXPORT'))"
```
Expected output: `PREMIUM`

- [ ] Extend `src/locales/es/reports.json` `salesSummary.export` block (the existing block ends at the `"button"` key ~line 102). Replace the closing of the export object to add the new keys (keep `exportAll`/`exportView` — they are reused for the mode toggle):

```json
    "export": {
      "title": "Exportar",
      "subtitle": "Ajustes",
      "exportAll": "Exportar todos los datos",
      "exportAllDesc": "Incluye resumen y métodos de pago",
      "exportView": "Exportar vista",
      "exportViewDesc": "Solo incluye la vista actual",
      "button": "Exportar",
      "mode": {
        "label": "¿Qué quieres exportar?",
        "summary": "Resumen",
        "summaryDesc": "Totales y desgloses agregados",
        "detailed": "Transacciones detalladas",
        "detailedDesc": "Una fila por transacción"
      },
      "sections": {
        "label": "Secciones a incluir",
        "totals": "Totales",
        "paymentMethods": "Desglose por método de pago",
        "cardTypes": "Detalle por tipo de tarjeta",
        "cardTypesDisabledHint": "Quita el filtro de método de pago para incluir el detalle por tipo de tarjeta.",
        "merchantAccounts": "Desglose por comercio",
        "byPeriod": "Por periodo"
      },
      "filters": {
        "label": "Filtros",
        "paymentMethod": "Método de pago",
        "paymentMethodOptions": {
          "all": "Todos",
          "cash": "Efectivo",
          "card": "Tarjeta",
          "other": "Otro"
        },
        "cardType": "Tipo de tarjeta",
        "cardTypeOptions": {
          "all": "Todas",
          "credit": "Crédito",
          "debit": "Débito",
          "amex": "Amex",
          "international": "Internacional"
        },
        "merchant": "Comercio",
        "merchantOptions": {
          "all": "Todos"
        },
        "staff": "Mesero",
        "shift": "Turno",
        "shiftOptions": {
          "all": "Todos"
        }
      },
      "columns": {
        "label": "Columnas a incluir",
        "createdAt": "Fecha",
        "paymentId": "ID",
        "waiterName": "Mesero",
        "merchantAccount": "Cuenta comercial",
        "method": "Método",
        "cardBrand": "Marca",
        "last4": "Últimos 4",
        "international": "Internacional",
        "amount": "Subtotal",
        "tipAmount": "Propina",
        "totalAmount": "Total",
        "status": "Estatus",
        "source": "Origen"
      },
      "format": {
        "label": "Formato",
        "csv": "CSV",
        "csvHint": "Ligero. Compatible con Excel y Google Sheets.",
        "xlsx": "Excel",
        "xlsxHint": "Con formato, ideal para contabilidad.",
        "pdf": "PDF",
        "pdfHint": "Imprimible. Límite de 1,000 filas."
      },
      "estimatedCount": "≈ {{count}} transacciones",
      "tooLarge": "Demasiados resultados",
      "tooLargeHint": "Reduce el rango con filtros o usa CSV/Excel.",
      "premium": {
        "title": "La exportación detallada requiere Premium",
        "body": "Exporta una fila por transacción con todas las columnas en CSV, Excel o PDF.",
        "cta": "Mejorar a Premium"
      }
    },
```

- [ ] Extend `src/locales/en/reports.json` `salesSummary.export` block at the SAME path in lockstep (ESLint `no-missing-translation-keys` requires parity):

```json
    "export": {
      "title": "Export",
      "subtitle": "Settings",
      "exportAll": "Export all data",
      "exportAllDesc": "Include summary and payment methods",
      "exportView": "Export view",
      "exportViewDesc": "Only include the current view",
      "button": "Export",
      "mode": {
        "label": "What do you want to export?",
        "summary": "Summary",
        "summaryDesc": "Aggregated totals and breakdowns",
        "detailed": "Detailed transactions",
        "detailedDesc": "One row per transaction"
      },
      "sections": {
        "label": "Sections to include",
        "totals": "Totals",
        "paymentMethods": "Payment-method breakdown",
        "cardTypes": "Card-type detail",
        "cardTypesDisabledHint": "Remove the payment-method filter to include card-type detail.",
        "merchantAccounts": "Merchant-account breakdown",
        "byPeriod": "By period"
      },
      "filters": {
        "label": "Filters",
        "paymentMethod": "Payment method",
        "paymentMethodOptions": {
          "all": "All",
          "cash": "Cash",
          "card": "Card",
          "other": "Other"
        },
        "cardType": "Card type",
        "cardTypeOptions": {
          "all": "All",
          "credit": "Credit",
          "debit": "Debit",
          "amex": "Amex",
          "international": "International"
        },
        "merchant": "Merchant",
        "merchantOptions": {
          "all": "All"
        },
        "staff": "Server",
        "shift": "Shift",
        "shiftOptions": {
          "all": "All"
        }
      },
      "columns": {
        "label": "Columns to include",
        "createdAt": "Date",
        "paymentId": "ID",
        "waiterName": "Server",
        "merchantAccount": "Merchant account",
        "method": "Method",
        "cardBrand": "Brand",
        "last4": "Last 4",
        "international": "International",
        "amount": "Subtotal",
        "tipAmount": "Tip",
        "totalAmount": "Total",
        "status": "Status",
        "source": "Source"
      },
      "format": {
        "label": "Format",
        "csv": "CSV",
        "csvHint": "Lightweight. Works with Excel and Google Sheets.",
        "xlsx": "Excel",
        "xlsxHint": "Formatted, ideal for accounting.",
        "pdf": "PDF",
        "pdfHint": "Printable. Limited to 1,000 rows."
      },
      "estimatedCount": "≈ {{count}} transactions",
      "tooLarge": "Too many results",
      "tooLargeHint": "Narrow the range with filters or use CSV/Excel.",
      "premium": {
        "title": "Detailed export requires Premium",
        "body": "Export one row per transaction with every column in CSV, Excel or PDF.",
        "cta": "Upgrade to Premium"
      }
    },
```

> If a `fr/reports.json` namespace exists with a `salesSummary` block, add the same keys there too (CLAUDE.md: "add fr if namespace exists"). Confirm with `ls src/locales/fr/reports.json` first.

- [ ] Confirm build + lint pass (the i18n ESLint rule validates key parity):

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run build && npm run lint
```
Expected: build + lint green (no missing-translation-key errors).

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
git add src/config/plan-catalog.ts src/locales/es/reports.json src/locales/en/reports.json
git commit -m "feat(reports): map TRANSACTION_EXPORT to PREMIUM + export-dialog i18n

plan-catalog PREMIUM.includes gains TRANSACTION_EXPORT (mirrors server
PREMIUM_ONLY_CODES). Adds en+es keys for the new export dialog (mode toggle,
sections, columns, format, estimated count, 413 error, Premium upsell).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Frontend — `SalesSummaryExportDialog` component

A tailored dialog (the generic `export-dialog.tsx` stays untouched). Composes `FullScreenModal` (outer shell, Save action in `actions`) + `FilterPill` (editable filters) + a mode toggle + sections/column picker + format radio + estimated count + blob download + 413 handling + `FeatureGate`/`useTierFeatureAccess` on detailed mode. Downloads via the proven `api.get(endpoint, { params, responseType: 'blob' })` pattern from `export-dialog.tsx:100-167`.

**Files:**
- Create: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/pages/Reports/components/SalesSummaryExportDialog.tsx`

Steps:

- [ ] Create the component. It is controlled by `open`/`onClose`, receives `venueId`, the page's current date range + filter values (paymentMethod/cardType/merchantAccountId) as SEED values, the loaded `merchantAccounts` list (already on the page), and `estimatedCount`. Detailed mode is gated via `useTierFeatureAccess('TRANSACTION_EXPORT')` — when not entitled, the detailed mode option is disabled with a Premium badge and selecting it shows the upsell (never silently usable). The dialog holds LOCAL EDITABLE state for every filter (FilterPill pattern, prefilled from the page but changeable inside the dialog): payment method + card type (both modes), merchant account (both modes), and staff + shift (detailed mode only). Their current values are threaded into the export request params. Reuse the download + 413 logic verbatim from `export-dialog.tsx`:

```tsx
import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { DateTime } from 'luxon'
import { Download, FileText, FileSpreadsheet, FileType2, Loader2, Crown } from 'lucide-react'

import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { FilterPill, FilterPopoverHeader, FilterPopoverFooter } from '@/components/filters/FilterPill'
import { DateRangePicker } from '@/components/date-range-picker'
import { useToast } from '@/hooks/use-toast'
import { useTierFeatureAccess } from '@/hooks/use-tier-feature-access'
import { teamService } from '@/services/team.service'
import type { MerchantAccount } from '@/services/paymentProvider.service'
import type { PaymentMethodFilter, CardTypeFilter } from '@/types/reports' // adjust to the real export location used by SalesSummary.tsx (these unions are declared in the report service/types; copy the import the page already uses)
import api from '@/api'

export type SalesExportFormat = 'csv' | 'xlsx' | 'pdf'
export type SalesExportMode = 'summary' | 'detailed'

interface SalesSummaryExportDialogProps {
  open: boolean
  onClose: () => void
  venueId?: string
  initialDateFrom: Date
  initialDateTo: Date
  /** Seed values from the page's current filters — editable inside the dialog. */
  initialPaymentMethod?: PaymentMethodFilter | null
  initialCardType?: CardTypeFilter | null
  initialMerchantAccountId?: string | null
  /** Merchant accounts already loaded on the page (getVenueMerchantAccountsByVenueId). */
  merchantAccounts?: MerchantAccount[]
  estimatedCount?: number
}

const SUMMARY_SECTIONS = ['totals', 'paymentMethods', 'cardTypes', 'merchantAccounts', 'byPeriod'] as const
const DETAIL_COLUMNS = [
  'createdAt', 'paymentId', 'waiterName', 'merchantAccount', 'method',
  'cardBrand', 'last4', 'international', 'amount', 'tipAmount', 'totalAmount', 'status', 'source',
] as const
const REQUIRED_COLUMNS = new Set<string>(['createdAt', 'amount'])

const PAYMENT_METHODS: PaymentMethodFilter[] = ['CASH', 'CARD', 'OTHER']
const CARD_TYPES: CardTypeFilter[] = ['CREDIT', 'DEBIT', 'AMEX', 'INTERNATIONAL']

export function SalesSummaryExportDialog({
  open, onClose, venueId, initialDateFrom, initialDateTo,
  initialPaymentMethod, initialCardType, initialMerchantAccountId, merchantAccounts = [], estimatedCount,
}: SalesSummaryExportDialogProps) {
  const { t } = useTranslation('reports')
  const { toast } = useToast()
  const { hasAccess: canDetailedExport } = useTierFeatureAccess('TRANSACTION_EXPORT')

  const [mode, setMode] = useState<SalesExportMode>('summary')
  const [format, setFormat] = useState<SalesExportFormat>('csv')
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({ from: initialDateFrom, to: initialDateTo })
  const [sections, setSections] = useState<Set<string>>(() => new Set(['totals', 'paymentMethods']))
  const [columns, setColumns] = useState<Set<string>>(() => new Set(DETAIL_COLUMNS))
  const [isExporting, setIsExporting] = useState(false)

  // ── EDITABLE FILTER STATE (seeded from the page, changeable in the dialog) ──
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethodFilter | null>(initialPaymentMethod ?? null)
  const [cardType, setCardType] = useState<CardTypeFilter | null>(initialCardType ?? null)
  const [merchantAccountId, setMerchantAccountId] = useState<string | null>(initialMerchantAccountId ?? null)
  const [staffIds, setStaffIds] = useState<string[]>([]) // detailed mode only
  const [shiftId, setShiftId] = useState<string | null>(null) // detailed mode only

  // Staff list — only fetch when the staff pill can be shown (detailed mode, dialog open).
  const { data: teamResp } = useQuery({
    queryKey: ['exportDialogTeam', venueId],
    queryFn: () => teamService.getTeamMembers(venueId!, 1, 100),
    enabled: open && mode === 'detailed' && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  const staffList = teamResp?.data ?? []

  // Shift list — GET /venues/:id/shifts (paginated). Same gate as staff.
  const { data: shiftsResp } = useQuery({
    queryKey: ['exportDialogShifts', venueId],
    queryFn: async () => {
      const res = await api.get(`/api/v1/dashboard/venues/${venueId}/shifts`, { params: { page: 1, pageSize: 100 } })
      return res.data as { data: Array<{ id: string; startTime?: string; staff?: { firstName?: string; lastName?: string } }> }
    },
    enabled: open && mode === 'detailed' && !!venueId,
    staleTime: 5 * 60 * 1000,
  })
  const shiftList = shiftsResp?.data ?? []

  const endpoint = useMemo(
    () => `/api/v1/dashboard/reports/venues/${venueId}/sales-summary/export`,
    [venueId],
  )

  // FIX 7: card-type detail (summary section) is only produced when NO paymentMethod filter is
  // active (getSalesSummary builds byPaymentMethodDetailed for the unfiltered view only). Disable
  // the checkbox + drop the section when a paymentMethod filter is set, so the user can't pick a
  // section that silently yields nothing.
  const cardTypesSectionDisabled = mode === 'summary' && paymentMethod !== null

  const toggle = (set: Set<string>, setter: (s: Set<string>) => void, id: string, required = false) => {
    if (required) return
    const next = new Set(set)
    next.has(id) ? next.delete(id) : next.add(id)
    setter(next)
  }

  const showPdfWarning = format === 'pdf' && mode === 'detailed' && estimatedCount !== undefined && estimatedCount > 1000

  // Active-filter labels for the pills (theme-aware inverted pill renders the value).
  const merchantLabel = merchantAccountId
    ? merchantAccounts.find(m => m.id === merchantAccountId)?.displayName
      || merchantAccounts.find(m => m.id === merchantAccountId)?.alias
      || merchantAccounts.find(m => m.id === merchantAccountId)?.provider?.name
      || merchantAccountId
    : null
  const paymentLabel = paymentMethod
    ? t(`salesSummary.export.filters.paymentMethodOptions.${paymentMethod.toLowerCase()}`)
    : null
  const cardLabel = cardType ? t(`salesSummary.export.filters.cardTypeOptions.${cardType.toLowerCase()}`) : null
  const staffLabel = staffIds.length > 0 ? String(staffIds.length) : null
  const shiftLabel = shiftId
    ? (shiftList.find(s => s.id === shiftId)?.startTime
        ? DateTime.fromISO(shiftList.find(s => s.id === shiftId)!.startTime!).toFormat('dd LLL HH:mm')
        : shiftId)
    : null

  const handleExport = async () => {
    if (mode === 'detailed' && !canDetailedExport) return // gated; UI shows upsell
    setIsExporting(true)
    try {
      // Drop the card-type detail section if a payment filter is active (see FIX 7).
      const effectiveSections = cardTypesSectionDisabled
        ? Array.from(sections).filter(s => s !== 'cardTypes')
        : Array.from(sections)
      const params: Record<string, string> = {
        mode,
        format,
        startDate: dateRange.from.toISOString(),
        endDate: dateRange.to.toISOString(),
        // Editable filters (both modes):
        ...(paymentMethod ? { paymentMethod } : {}),
        ...(paymentMethod === 'CARD' && cardType ? { cardType } : {}),
        ...(merchantAccountId ? { merchantAccountId } : {}),
        // Detailed-mode-only filters:
        ...(mode === 'detailed' && staffIds.length > 0 ? { staffIds: staffIds.join(',') } : {}),
        ...(mode === 'detailed' && shiftId ? { shiftId } : {}),
        ...(mode === 'summary' ? { sections: effectiveSections.join(',') } : { columns: Array.from(columns).join(',') }),
      }
      const response = await api.get(endpoint, { params, responseType: 'blob' })
      const ext = format === 'xlsx' ? 'xlsx' : format
      const stamp = DateTime.now().toFormat('yyyy-LL-dd')
      const stem = mode === 'detailed' ? 'ventas-detalladas' : 'resumen-ventas'
      const filename = `${stem}-${stamp}.${ext}`
      const url = window.URL.createObjectURL(response.data as Blob)
      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
      toast({ title: t('salesSummary.export.button') })
      onClose()
    } catch (err: any) {
      // responseType:'blob' -> error body is a Blob; pull the message out.
      let message = t('salesSummary.export.tooLargeHint') as string
      const status = err?.response?.status
      const data = err?.response?.data
      if (data instanceof Blob) {
        try {
          const parsed = JSON.parse(await data.text())
          if (parsed?.message) message = parsed.message
        } catch { /* keep fallback */ }
      } else if (data?.message) {
        message = data.message
      }
      toast({
        title: status === 413 ? t('salesSummary.export.tooLarge') : message,
        description: status === 413 ? message : undefined,
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  const detailedDisabled = !canDetailedExport

  return (
    <FullScreenModal
      open={open}
      onClose={onClose}
      title={t('salesSummary.export.title')}
      contentClassName="bg-muted/30"
      actions={
        <Button
          onClick={handleExport}
          disabled={isExporting || (mode === 'detailed' && detailedDisabled)}
          className="cursor-pointer"
          data-tour="export-dialog-submit"
        >
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          {t('salesSummary.export.button')}
        </Button>
      }
    >
      <div className="mx-auto max-w-2xl space-y-4 p-6">
        {/* Mode toggle */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.mode.label')}</h3>
          <RadioGroup value={mode} onValueChange={v => setMode(v as SalesExportMode)} className="grid gap-3 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === 'summary' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
              <RadioGroupItem value="summary" id="mode-summary" className="mt-1" />
              <div>
                <Label htmlFor="mode-summary" className="cursor-pointer font-semibold">{t('salesSummary.export.mode.summary')}</Label>
                <p className="mt-1 text-xs text-muted-foreground">{t('salesSummary.export.mode.summaryDesc')}</p>
              </div>
            </label>
            <label className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${detailedDisabled ? 'opacity-70' : ''} ${mode === 'detailed' ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
              <RadioGroupItem value="detailed" id="mode-detailed" className="mt-1" disabled={detailedDisabled} />
              <div>
                <div className="flex items-center gap-2">
                  <Label htmlFor="mode-detailed" className="cursor-pointer font-semibold">{t('salesSummary.export.mode.detailed')}</Label>
                  <Badge variant="outline" className="h-4 px-1.5 text-[10px]"><Crown className="mr-0.5 h-2.5 w-2.5" />PREMIUM</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{t('salesSummary.export.mode.detailedDesc')}</p>
              </div>
            </label>
          </RadioGroup>
          {mode === 'detailed' && detailedDisabled && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              {t('salesSummary.export.premium.body')}
            </p>
          )}
        </section>

        {/* Date range filter pill */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <DateRangePicker
            initialDateFrom={dateRange.from}
            initialDateTo={dateRange.to}
            onUpdate={({ range }) => range?.from && range?.to && setDateRange({ from: range.from, to: range.to })}
          />
        </section>

        {/* Editable filter pills (FilterPill pattern) — seeded from the page, changeable here.
            payment method + card type + merchant = both modes; staff + shift = detailed only. */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.filters.label')}</h3>
          <div className="flex flex-wrap items-center gap-2">
            {/* Payment method + card type */}
            <FilterPill
              label={t('salesSummary.export.filters.paymentMethod')}
              activeLabel={paymentLabel}
              onClear={() => { setPaymentMethod(null); setCardType(null) }}
            >
              <div>
                <FilterPopoverHeader title={t('salesSummary.export.filters.paymentMethod')} />
                <div className="p-2">
                  <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                    <input
                      type="radio"
                      name="export-pm"
                      checked={paymentMethod === null}
                      onChange={() => { setPaymentMethod(null); setCardType(null) }}
                    />
                    <span className="text-sm">{t('salesSummary.export.filters.paymentMethodOptions.all')}</span>
                  </label>
                  {PAYMENT_METHODS.map(pm => (
                    <label key={pm} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input
                        type="radio"
                        name="export-pm"
                        checked={paymentMethod === pm}
                        onChange={() => { setPaymentMethod(pm); if (pm !== 'CARD') setCardType(null) }}
                      />
                      <span className="text-sm">{t(`salesSummary.export.filters.paymentMethodOptions.${pm.toLowerCase()}`)}</span>
                    </label>
                  ))}
                </div>
              </div>
            </FilterPill>

            {/* Card type — only relevant when paymentMethod=CARD */}
            {paymentMethod === 'CARD' && (
              <FilterPill
                label={t('salesSummary.export.filters.cardType')}
                activeLabel={cardLabel}
                onClear={() => setCardType(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.cardType')} />
                  <div className="p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-ct" checked={cardType === null} onChange={() => setCardType(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.cardTypeOptions.all')}</span>
                    </label>
                    {CARD_TYPES.map(ct => (
                      <label key={ct} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-ct" checked={cardType === ct} onChange={() => setCardType(ct)} />
                        <span className="text-sm">{t(`salesSummary.export.filters.cardTypeOptions.${ct.toLowerCase()}`)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}

            {/* Merchant account — only when the venue has >1 */}
            {merchantAccounts.length > 1 && (
              <FilterPill
                label={t('salesSummary.export.filters.merchant')}
                activeLabel={merchantLabel}
                onClear={() => setMerchantAccountId(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.merchant')} />
                  <div className="max-h-64 overflow-auto p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-ma" checked={merchantAccountId === null} onChange={() => setMerchantAccountId(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.merchantOptions.all')}</span>
                    </label>
                    {merchantAccounts.map(ma => (
                      <label key={ma.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-ma" checked={merchantAccountId === ma.id} onChange={() => setMerchantAccountId(ma.id)} />
                        <span className="text-sm">{ma.displayName || ma.alias || ma.provider?.name || ma.id}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}

            {/* Staff/waiter — DETAILED MODE ONLY (multi-select). getSalesSummary filters by
                bucket, not by individual staff, so this pill is hidden in summary mode. */}
            {mode === 'detailed' && (
              <FilterPill
                label={t('salesSummary.export.filters.staff')}
                activeCount={staffIds.length}
                onClear={() => setStaffIds([])}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.staff')} />
                  <div className="max-h-64 overflow-auto p-2">
                    {staffList.map(s => {
                      const checked = staffIds.includes(s.id)
                      return (
                        <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                          <Checkbox
                            checked={checked}
                            onCheckedChange={() =>
                              setStaffIds(prev => (checked ? prev.filter(id => id !== s.id) : [...prev, s.id]))
                            }
                          />
                          <span className="text-sm">{`${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.id}</span>
                        </label>
                      )
                    })}
                  </div>
                  <FilterPopoverFooter onApply={() => {}} onClear={() => setStaffIds([])} showClear={staffIds.length > 0} />
                </div>
              </FilterPill>
            )}

            {/* Shift — DETAILED MODE ONLY */}
            {mode === 'detailed' && (
              <FilterPill
                label={t('salesSummary.export.filters.shift')}
                activeLabel={shiftLabel}
                onClear={() => setShiftId(null)}
              >
                <div>
                  <FilterPopoverHeader title={t('salesSummary.export.filters.shift')} />
                  <div className="max-h-64 overflow-auto p-2">
                    <label className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                      <input type="radio" name="export-shift" checked={shiftId === null} onChange={() => setShiftId(null)} />
                      <span className="text-sm">{t('salesSummary.export.filters.shiftOptions.all')}</span>
                    </label>
                    {shiftList.map(s => (
                      <label key={s.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-muted/50">
                        <input type="radio" name="export-shift" checked={shiftId === s.id} onChange={() => setShiftId(s.id)} />
                        <span className="text-sm">
                          {s.startTime ? DateTime.fromISO(s.startTime).toFormat('dd LLL HH:mm') : s.id}
                          {s.staff ? ` · ${`${s.staff.firstName ?? ''} ${s.staff.lastName ?? ''}`.trim()}` : ''}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </FilterPill>
            )}
          </div>
        </section>

        {/* Section / column picker */}
        <section className="rounded-2xl border border-input bg-card p-6">
          {mode === 'summary' ? (
            <>
              <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.sections.label')}</h3>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {SUMMARY_SECTIONS.map(id => {
                  // FIX 7: card-type detail needs the unfiltered view — disable under a payment filter.
                  const disabled = id === 'cardTypes' && cardTypesSectionDisabled
                  return (
                    <label
                      key={id}
                      className={`flex flex-col gap-0.5 rounded-lg border px-3 py-2 ${disabled ? 'opacity-50' : 'cursor-pointer'} ${sections.has(id) && !disabled ? 'border-primary/40 bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={sections.has(id) && !disabled}
                          disabled={disabled}
                          onCheckedChange={() => toggle(sections, setSections, id, disabled)}
                        />
                        <span className="text-sm">{t(`salesSummary.export.sections.${id}`)}</span>
                      </div>
                      {disabled && (
                        <span className="ml-7 text-xs text-muted-foreground">{t('salesSummary.export.sections.cardTypesDisabledHint')}</span>
                      )}
                    </label>
                  )
                })}
              </div>
            </>
          ) : (
            <>
              <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.columns.label')}</h3>
              {estimatedCount !== undefined && (
                <p className="mb-3 text-sm text-muted-foreground">{t('salesSummary.export.estimatedCount', { count: estimatedCount })}</p>
              )}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {DETAIL_COLUMNS.map(id => {
                  const required = REQUIRED_COLUMNS.has(id)
                  return (
                    <label key={id} className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2 ${columns.has(id) ? 'border-primary/40 bg-primary/5' : 'border-input bg-background hover:bg-muted/40'} ${required ? 'opacity-70' : ''}`}>
                      <Checkbox checked={columns.has(id)} onCheckedChange={() => toggle(columns, setColumns, id, required)} disabled={required} />
                      <span className="text-sm">{t(`salesSummary.export.columns.${id}`)}</span>
                    </label>
                  )
                })}
              </div>
            </>
          )}
        </section>

        {/* Format radio */}
        <section className="rounded-2xl border border-input bg-card p-6">
          <h3 className="mb-4 text-base font-semibold">{t('salesSummary.export.format.label')}</h3>
          <RadioGroup value={format} onValueChange={v => setFormat(v as SalesExportFormat)} className="grid gap-3 sm:grid-cols-3">
            {([['csv', FileText], ['xlsx', FileSpreadsheet], ['pdf', FileType2]] as const).map(([fmt, Icon]) => (
              <label key={fmt} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${format === fmt ? 'border-primary bg-primary/5' : 'border-input bg-background hover:bg-muted/40'}`}>
                <RadioGroupItem value={fmt} id={`fmt-${fmt}`} className="mt-1" />
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    <Label htmlFor={`fmt-${fmt}`} className="cursor-pointer font-semibold">{t(`salesSummary.export.format.${fmt}`)}</Label>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{t(`salesSummary.export.format.${fmt}Hint`)}</p>
                </div>
              </label>
            ))}
          </RadioGroup>
          {showPdfWarning && (
            <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-200">
              {t('salesSummary.export.tooLargeHint')}
            </p>
          )}
        </section>
      </div>
    </FullScreenModal>
  )
}
```

> Notes for the implementer:
> - `FilterPill`, `FilterPopoverHeader`, and `FilterPopoverFooter` are NOW USED by the editable pills above — no unused imports (this resolves the prior self-defeating lint failure). Verify against `src/components/filters/FilterPill.tsx`: `FilterPill` takes `label`, `activeLabel` (string|null), `activeCount` (number, for multi-select), `onClear`, and `children`; `FilterPopoverFooter` takes `onApply`/`onClear`/`showClear`.
> - Staff (`Payment.processedById`) and shift (`Payment.shiftId`) are CONFIRMED real columns (schema lines 2693-2697) — their pills are in scope (detailed mode only), NOT deferred.
> - Confirm `DateRangePicker`'s exact `onUpdate` signature against `src/components/date-range-picker.tsx`.
> - Confirm the `PaymentMethodFilter`/`CardTypeFilter` import path — `SalesSummary.tsx:129-130` already imports these unions; reuse the SAME import (they originate from the report service/types). The `@/types/reports` import above is a placeholder — replace it with whatever `SalesSummary.tsx` actually imports.
> - Confirm the `getTeamMembers` response shape: `teamService.getTeamMembers` returns `PaginatedTeamResponse` whose `.data` is the member array (each has `id`/`firstName`/`lastName`) — verify the exact field name against `src/types/team.ts` / `src/services/team.service.ts` during implementation.
> - The shift list shape (`res.data.data`) mirrors `src/pages/Shift/Shifts.tsx:64-75` (GET `/venues/:id/shifts`, paginated). Verify each row exposes `id` + `startTime` (+ optional `staff`) before relying on the label format; fall back to `s.id` when absent (already coded).

- [ ] Confirm the component type-checks:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run build
```
Expected: build green.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
git add src/pages/Reports/components/SalesSummaryExportDialog.tsx
git commit -m "feat(reports): SalesSummaryExportDialog (mode toggle + sections/columns + format)

FullScreenModal-based tailored dialog. Summary vs PREMIUM-gated detailed mode
(useTierFeatureAccess('TRANSACTION_EXPORT')), section/column pickers, format
radio, blob download + 413 handling reused from export-dialog.tsx.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Frontend — wire dialog into `SalesSummary.tsx`, remove old popover + builder

**Files:**
- Modify: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/src/pages/Reports/SalesSummary.tsx`
  - Remove: export Popover JSX (lines 1276–1332), `handleExportCSV` (lines 1015–1069), export state (lines 775–776)
  - Add: import for `SalesSummaryExportDialog`, dialog open-state, Download trigger button with `data-tour="sales-summary-export"`, render `<SalesSummaryExportDialog />`

Steps:

- [ ] Remove `handleExportCSV` (lines 1016–1069) entirely. Remove the export-only state declarations at lines 775–776 (`exportOpen`/`setExportOpen` are replaced by a new dialog-open state; `exportType` is gone — the dialog owns mode now).

- [ ] Replace the export Popover block (lines 1276–1332) with the new Download trigger button. Keep the `hasAccess` guard (line 1274) and the sibling Controls `<Sheet>` (starts line 1335) intact. The new trigger:

```tsx
        {hasAccess && (
        <div className="flex items-center gap-2">
          {/* Export trigger — opens the rich export dialog */}
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 cursor-pointer"
            data-tour="sales-summary-export"
            onClick={() => setExportDialogOpen(true)}
            aria-label={t('salesSummary.export.title')}
          >
            <Download className="w-4 h-4" />
          </Button>
          {/* Controls Sheet — unchanged, starts below */}
```

- [ ] Add the dialog-open state near the other UI state (replacing the removed `exportOpen`):

```tsx
  const [exportDialogOpen, setExportDialogOpen] = useState(false)
```

- [ ] Add the import (top of file, alongside other component imports):

```tsx
import { SalesSummaryExportDialog } from '@/pages/Reports/components/SalesSummaryExportDialog'
```

- [ ] Render the dialog once (e.g. near the page root, inside the `hasAccess` region or at the end of the JSX). Seed the dialog's editable filters from the page's current filter state (the dialog then lets the user change them), pass the already-loaded `merchantAccounts` list, and the estimated transaction count from the loaded report. NOTE: `fetchSalesSummary` unwraps to `apiResponse` directly (the page reads `apiResponse.summary.grossSales`, `apiResponse.byMerchantAccount`, etc. — see SalesSummary.tsx ~1151), so the count is `apiResponse?.summary?.transactionCount`, NOT `apiResponse?.data?.summary?.…`:

```tsx
      {hasAccess && (
        <SalesSummaryExportDialog
          open={exportDialogOpen}
          onClose={() => setExportDialogOpen(false)}
          venueId={venueId}
          initialDateFrom={dateRange.from}
          initialDateTo={dateRange.to}
          initialPaymentMethod={paymentMethodFilter}
          initialCardType={cardTypeFilter}
          initialMerchantAccountId={merchantAccountId}
          merchantAccounts={merchantAccounts}
          estimatedCount={apiResponse?.summary?.transactionCount ?? undefined}
        />
      )}
```

> VERIFY during implementation: the exact unwrap shape of `apiResponse` (grep `apiResponse?.summary` / `apiResponse.summary.grossSales` in SalesSummary.tsx — it is the unwrapped `SalesSummaryResponse`, NOT `{ data }`). If the local query keeps the `{ success, data }` envelope, use `apiResponse?.data?.summary?.transactionCount` instead. `merchantAccounts` is the `getVenueMerchantAccountsByVenueId` query result already in scope (line ~818).

- [ ] Remove now-unused imports if the Popover/RadioGroup are no longer referenced anywhere else in the file. GREP first — `RadioGroup`/`Label`/`Separator` are reused by the Controls Sheet, so KEEP those; `Popover`/`PopoverContent`/`PopoverTrigger` (line 12) may be removable:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && grep -nE 'Popover|PopoverContent|PopoverTrigger' src/pages/Reports/SalesSummary.tsx
```
Expected: if zero remaining references after the edit, remove the import at line 12; otherwise keep it.

- [ ] Confirm build + lint + unused-check pass:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run build && npm run lint
```
Expected: green; no "exportType is declared but never read" or unused-import errors.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
git add src/pages/Reports/SalesSummary.tsx
git commit -m "feat(reports): replace client-side CSV popover with SalesSummaryExportDialog

Removes handleExportCSV + the 2-radio popover; Export icon now opens the rich
dialog (data-tour=sales-summary-export). All export flows through the backend
endpoint so numbers stay consistent with the on-screen report.

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Frontend — Playwright E2E

**Files:**
- Create: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard/e2e/tests/reports/sales-summary-export.spec.ts`

Mirror `sales-summary-merchant-breakdown.spec.ts` (has both a request-assertion happy path and a gate test). Register the sales-summary GET mock AND the NEW `/export` mock AFTER `setupApiMocks` (LIFO).

> 🔴 CRITICAL — the tier-gate signal source (verified 2026-06-15): the dialog's detailed-mode gate is `useTierFeatureAccess('TRANSACTION_EXPORT')`, which reads **GET `/api/v1/dashboard/venues/:id/plan-tier`** (`getVenuePlanTierInfo` → `{ tier, exempt }`), NOT `GET /plan`. `api-mocks.ts` does NOT mock `/plan-tier`, so it falls through to the catch-all (`**/api/**` → `{}`), which makes `getVenuePlanTierInfo` resolve to `undefined` → the hook FAILS OPEN (`planTierInfo === undefined → hasAccess=true`). That means overriding only `planState` (the `/plan` body) does NOT change the gate — the PRO test would wrongly see detailed mode ENABLED. So this spec MUST register its OWN `**/plan-tier` route returning `{ success: true, data: { tier, grandfathered: false, exempt: false } }` (after `setupApiMocks`, LIFO) to deterministically drive the gate. Tier values come from `VenuePlanTierInfo.tier` = `'FREE' | 'PRO' | 'PREMIUM' | 'ENTERPRISE'` (note: this `tier` enum uses `FREE`, while `MockPlanState.planTier` uses the legacy `GRATIS`; the gate reads the `/plan-tier` `tier`, so use `PRO` / `PREMIUM` here).

> 🔴 Selector disambiguation: there are TWO "Export"-named controls (the page trigger + the dialog submit). Using `getByRole('button', { name: /Export/i })` is a strict-mode violation once the dialog is open. Use the stable `data-tour` locators instead: trigger = `[data-tour="sales-summary-export"]`, submit = `[data-tour="export-dialog-submit"]`.

Steps:

- [ ] Write the spec. Three tests: (1) open dialog + summary CSV happy path asserts the `/export` request fires with `mode=summary`; (2) PRO (non-Premium) venue: detailed mode disabled + Premium upsell shown; (3) PREMIUM venue: detailed mode selectable + column picker visible. Create `e2e/tests/reports/sales-summary-export.spec.ts`:

```typescript
import { test, expect, type Page } from '@playwright/test'
import { setupApiMocks, type SetupApiMocksOptions } from '../../fixtures/api-mocks'
import { StaffRole, createMockVenue } from '../../fixtures/mock-data'

test.setTimeout(45_000)
test.use({ viewport: { width: 1280, height: 900 } })

/**
 * @param tier the value the /plan-tier endpoint reports — drives useTierFeatureAccess.
 *   undefined → do NOT register a /plan-tier route (hook fails open → detailed enabled),
 *   used by the permissive happy-path test. 'PRO'/'PREMIUM' → deterministic gate.
 */
async function setupMocks(page: Page, tier?: 'PRO' | 'PREMIUM', extra: Partial<SetupApiMocksOptions> = {}) {
  const venue = createMockVenue({ id: 'venue-alpha', name: 'Restaurante Alpha', slug: 'venue-alpha' })
  await setupApiMocks(page, { userRole: StaffRole.OWNER, venues: [venue], ...extra })
  const state: { exportUrl: string | null } = { exportUrl: null }

  // Deterministic tier-gate signal (the gate reads /plan-tier, NOT /plan — see CRITICAL note).
  if (tier) {
    await page.route('**/api/v1/dashboard/venues/*/plan-tier', route =>
      route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ success: true, data: { tier, grandfathered: false, exempt: false } }),
      }),
    )
  }

  // GET sales-summary report (drives the on-screen view + estimated count)
  await page.route('**/api/v1/dashboard/reports/**/sales-summary?**', route =>
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: JSON.stringify({ success: true, data: { summary: { transactionCount: 42, refunds: 0, tips: 0, platformFees: 0, totalCollected: 0 }, byPaymentMethod: [], filtered: false } }),
    }),
  )
  // NEW: the export endpoint — returns a tiny CSV blob
  await page.route('**/api/v1/dashboard/reports/**/sales-summary/export*', route => {
    state.exportUrl = route.request().url()
    return route.fulfill({
      status: 200,
      headers: { 'content-type': 'text/csv', 'content-disposition': 'attachment; filename="resumen-ventas-2026-06-15.csv"' },
      body: 'Sección,Concepto,Cantidad,Monto,Porcentaje\r\n',
    })
  })
  return state
}

async function gotoReport(page: Page) {
  await page.goto('/venues/venue-alpha/reports/sales-summary')
  await page.waitForLoadState('networkidle').catch(() => {})
  await page.addStyleTag({ content: `.tsqd-parent-container, [class*="tsqd-"] { display: none !important; pointer-events: none !important; }` })
  await expect(page.getByRole('heading', { name: /Sales Summary/i })).toBeVisible({ timeout: 15_000 })
}

test('summary CSV happy path: opens dialog and hits the export endpoint with mode=summary', async ({ page }) => {
  const state = await setupMocks(page) // permissive (no /plan-tier override → fail open)
  await gotoReport(page)
  await page.locator('[data-tour="sales-summary-export"]').click()
  await expect(page.getByRole('heading', { name: /Export/i })).toBeVisible()
  const [req] = await Promise.all([
    page.waitForRequest(r => r.url().includes('/sales-summary/export') && r.url().includes('mode=summary'), { timeout: 10_000 }),
    page.locator('[data-tour="export-dialog-submit"]').click(),
  ])
  expect(req.url()).toContain('format=csv')
  expect(state.exportUrl).toContain('mode=summary')
})

test('PRO (non-Premium) venue: detailed mode is disabled and shows the Premium upsell', async ({ page }) => {
  await setupMocks(page, 'PRO')
  await gotoReport(page)
  await page.locator('[data-tour="sales-summary-export"]').click()
  await expect(page.getByText(/Detailed transactions/i)).toBeVisible()
  // The detailed radio is disabled (TRANSACTION_EXPORT is PREMIUM; PRO < PREMIUM).
  await expect(page.getByRole('radio', { name: /Detailed transactions/i })).toBeDisabled()
})

test('PREMIUM venue: detailed mode selectable and shows the column picker', async ({ page }) => {
  await setupMocks(page, 'PREMIUM')
  await gotoReport(page)
  await page.locator('[data-tour="sales-summary-export"]').click()
  await page.getByText(/Detailed transactions/i).click()
  await expect(page.getByText(/Columns to include/i)).toBeVisible()
})
```

> Verified shapes (confirmed against the repo, 2026-06-15): `MockPlanState` (`grandfathered`/`hasPlan`/`state`/`planTier: 'GRATIS'|'PRO'|'PREMIUM'|'ENTERPRISE'|null`) lives in `e2e/fixtures/mock-data.ts:299-315`; `VenuePlanTierInfo` (`tier: 'FREE'|'PRO'|'PREMIUM'|'ENTERPRISE'`, `grandfathered`, `exempt`) in `src/services/features.service.ts:168-173`. The gate reads `tier` from `/plan-tier`, so the spec drives it via the explicit `/plan-tier` route above (do NOT rely on `planState.planTier`). The FREE→GRATIS naming mismatch only matters for the `/plan` body, which this gate ignores.

- [ ] Run the new spec and confirm it PASSES:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run test:e2e -- sales-summary-export
```
Expected: 3 tests pass. (If the report heading text differs in English locale, adjust the `name` matcher to the actual rendered heading.)

- [ ] Run the full reports E2E suite to confirm no regression:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run test:e2e -- reports/
```
Expected: all reports specs green.

- [ ] (Per-commit approval required) Commit:

```bash
cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard
git add e2e/tests/reports/sales-summary-export.spec.ts
git commit -m "test(reports): E2E for sales-summary export dialog + Premium gate

Opens the dialog, asserts the summary CSV export request fires (mode=summary),
verifies detailed mode is disabled+upsold for non-Premium and shows the column
picker for Premium venues. Export endpoint mocked via page.route (LIFO).

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Sales presentation — deck + one-pager + regenerate PDFs

The detailed multi-format transaction export is a new customer-visible, Premium-packaged capability. Both HTML deliverables AND both PDFs must be updated in the same change (folder confirmed to exist at `~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/`).

**Files:**
- Modify: `~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/avoqado-presentacion.html` (Slide 11 ~line 421, Slide 13 ~line 471)
- Modify: `~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/avoqado-one-pager.html` (Analítica chip ~line 92)
- Regenerate: `Avoqado-Presentacion-Plataforma.pdf` + `Avoqado-One-Pager.pdf`

Steps:

- [ ] In `avoqado-presentacion.html`, Slide 11 (`📊 Analítica` card), add a new `feat` row after the "Cuentas por cobrar" row (~line 421). Mark it PREMIUM using the deck's existing `<b class="hl">` convention:

```html
        <div class="feat"><span class="mk"></span><span><b class="hl">PREMIUM:</b> exporta tus ventas en CSV, Excel o PDF — resumen agregado o transacción por transacción.</span></div>
```

- [ ] In `avoqado-presentacion.html`, Slide 13 (`Dashboard Web`), add a sibling `feat` row right after the existing "Reportes y analítica..." row (~line 471):

```html
        <div class="feat"><span class="mk"></span><span>Exportación de reportes en CSV, Excel y PDF.</span></div>
```

- [ ] In `avoqado-one-pager.html`, extend the existing Analítica chip (~line 92) — prefer extending over adding a new chip (the sheet is tight, `overflow:hidden`):

```html
      <span class="chip"><b>Analítica</b> · ventas en vivo, reportes, exporta Excel/CSV/PDF</span>
```

- [ ] Regenerate BOTH PDFs from the platform-presentation folder (verbatim from the folder README, step 2). Verify the Chrome path first:

```bash
cd ~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation
CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=15000 \
  --print-to-pdf="Avoqado-Presentacion-Plataforma.pdf" "file://$PWD/avoqado-presentacion.html"
"$CHROME" --headless --disable-gpu --no-pdf-header-footer \
  --run-all-compositor-stages-before-draw --virtual-time-budget=15000 \
  --print-to-pdf="Avoqado-One-Pager.pdf" "file://$PWD/avoqado-one-pager.html"
```
Expected: both PDFs regenerate without error.

- [ ] QC the affected pages (Slide 11 = page 11, Slide 13 = page 13) for clipping — slides use `overflow:hidden`:

```bash
cd ~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation
mkdir -p .qc && pdftoppm -png -r 60 Avoqado-Presentacion-Plataforma.pdf .qc/f
```
Expected: review `.qc/f-11.png` and `.qc/f-13.png` — nothing cut off. Then `rm -rf .qc`.

- [ ] (Per-commit approval required — separate repo) Commit in the Avoqado-HQ repo if it is version-controlled:

```bash
cd ~/Documents/Programming/Avoqado-HQ
git add operations/marketing/platform-presentation/avoqado-presentacion.html operations/marketing/platform-presentation/avoqado-one-pager.html operations/marketing/platform-presentation/Avoqado-Presentacion-Plataforma.pdf operations/marketing/platform-presentation/Avoqado-One-Pager.pdf
git commit -m "docs(presentation): add Premium multi-format transaction export to deck + one-pager

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>"
```

---

## Final verification (before any PR)

- [ ] Backend: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-server && npx tsc --noEmit && npx jest tests/unit/services/access tests/unit/services/dashboard tests/unit/mcp-customer/export-sales-summary.test.ts tests/api-tests/dashboard/salesSummaryExport.api.test.ts` — all green.
- [ ] Dashboard: `cd /Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard && npm run build && npm run lint && npm run test:e2e -- reports/` — all green.
- [ ] **Tier-leak check (FIX 1):** export `mode=summary` with `sections=merchantAccounts` on a venue WITHOUT `ADVANCED_REPORTS` (and not SUPERADMIN) → the output contains NO `merchantAccounts` rows (the flag is silently dropped, mirroring the report). On an ADVANCED_REPORTS venue (or SUPERADMIN) the rows ARE present.
- [ ] **Premium-gate check:** OWNER on a PRO venue → detailed mode disabled + upsell; OWNER/SUPERADMIN on a PREMIUM venue → detailed mode usable. Also verify the detailed-mode 403 body is the platform contract `{ error, message, featureCode: 'TRANSACTION_EXPORT', subscriptionRequired: true }` (NOT an invented `code`).
- [ ] **Negative role check (FIX 9):** a user WITHOUT `reports:read` (e.g. a VIEWER/HOST whose role lacks it, or a role with `reports:read` removed) → BOTH `GET /sales-summary/export` routes return 403 from `checkPermission('reports:read')` BEFORE the controller runs (i.e. neither summary nor detailed export is reachable). This is the same guard the existing report route uses; confirm the export routes carry `checkPermission('reports:read')` exactly as registered in Task 3.
- [ ] **Editable-filters check (FIX 2):** inside the dialog, change payment method / card type / merchant (both modes) and staff / shift (detailed mode) away from the page defaults → the resulting `/sales-summary/export` request carries the EDITED values (`paymentMethod`/`cardType`/`merchantAccountId`/`staffIds`/`shiftId`), not the page's originals.
- [ ] **Card-type-section UX check (FIX 7):** in summary mode, set a payment-method filter → the "Card-type detail" section checkbox is disabled with the hint, and the export request omits `cardTypes` from `sections`.
- [ ] Manual: test in light + dark mode; spot-check OWNER (sees both modes) vs MANAGER on a PRO venue (detailed disabled + upsell).
- [ ] Confirm `TRANSACTION_EXPORT` is identical by exact name in `basePlan.service.ts` (`PREMIUM_ONLY_CODES`) and `plan-catalog.ts` (PREMIUM `includes`) — a mismatch fails silently.
