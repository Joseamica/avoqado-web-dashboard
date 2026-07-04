# Settlement Week Calendar — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A shared, week-by-week navigable settlement calendar (by settlement date) that shows how much card money lands in the bank each day — used identically by Saldo Disponible and Resumen de Ventas, with numbers that reconcile across the platform's full complexity.

**Architecture:** Backend recomputes settlement dates on read via the (already corrected) settlement engine and buckets net-to-receive by settlement day for a requested week; a new HTTP endpoint + MCP tool expose it; the frontend renders one shared `SettlementWeekStrip` in both pages.

**Tech Stack:** avoqado-server (Express + Prisma + TypeScript, Jest) · avoqado-web-dashboard (React 18 + TS + Vite, TanStack Query, Tailwind/Radix, i18n, Playwright/vitest).

## Global Constraints

- Money is Mexican pesos in **major units** (e.g. 150.50), rounded to cents at output.
- Settlement day type is **BUSINESS_DAYS** (skip weekends + MX holidays incl. Semana Santa) or CALENDAR_DAYS; use the **corrected** `calculateSettlementDate` (venue-tz). Never re-derive weekend logic.
- Net = `amount + tipAmount − (venueChargeAmount + venueFixedFee)`. Gross = `amount + tipAmount`.
- Card only (`method != CASH`), `status = 'COMPLETED'`; cash is excluded (immediate).
- Week is **Monday–Sunday** in the **venue timezone**; all day keys are venue-local `yyyy-MM-dd`.
- Payments with no active `SettlementConfiguration` for their merchant×cardType → `unprojected` (never dropped).
- API paths include `/api/v1/`; resolve venue via `resolveRequestVenueId`; dashboard sends `x-venue-id`.
- Frontend: GlassCard + `border-input`, semantic tokens only, **no `bg-gradient-to-*`**, `tabular-nums`, all text via `t()` en+es, venue tz via `useVenueDateTime`, memoize arrays, `Currency` from `@/utils/currency`, lucide icons.
- **MCP lockstep** (CLAUDE.md): expose the same capability via the `settlement_calendar` MCP tool in the same change.
- Git: commit per task; do NOT push to `main` without the founder's OK (develop→main FF is his release step).

---

## File Structure

**avoqado-server**
- Create `src/services/dashboard/settlementCalendar.dashboard.service.ts` — `projectPaymentSettlement()` (shared per-payment helper) + `getSettlementsLandingInWeek()`.
- Modify `src/services/dashboard/sales-summary.dashboard.service.ts` — `computeSettlementProjection` reuses `projectPaymentSettlement`.
- Modify `src/controllers/dashboard/reports.controller.ts` (or the sales-summary controller) — add `getSettlementWeek` handler.
- Modify `src/routes/dashboard.routes.ts` — add `GET /reports/settlement-week`.
- Modify `src/mcp/tools/sales.ts` — extend `settlement_calendar` with a week mode.
- Tests: `tests/unit/services/dashboard/settlementCalendar.dashboard.service.test.ts`, `tests/integration/.../settlement-week-reconciliation.integration.test.ts`, MCP tool test.

**avoqado-web-dashboard**
- Modify `src/services/reports/salesSummary.service.ts` (or new `settlement.service.ts`) — `getSettlementWeek()` + types.
- Create `src/hooks/useSettlementWeek.ts`.
- Create `src/components/settlement/SettlementWeekStrip.tsx` (+ `.test.tsx`) and `src/components/settlement/weekMath.ts` (+ test) for pure week-boundary helpers.
- Modify `src/pages/AvailableBalance/AvailableBalance.tsx` — replace `SettlementCalendarWeek`.
- Modify `src/pages/Reports/statement/StatementSection.tsx` — replace `PayoutTimeline` usage.
- Delete `src/pages/AvailableBalance/components/SettlementCalendarWeek.tsx`, `src/pages/Reports/statement/PayoutTimeline.tsx` (+ tests) once E2E migrated.
- i18n: `src/locales/{en,es}/reports.json` under `settlementWeek.*`.
- E2E: `e2e/tests/reports/settlement-week.spec.ts`.

---

## Task 1: Shared per-payment settlement projection helper (backend)

**Files:**
- Create: `src/services/dashboard/settlementCalendar.dashboard.service.ts`
- Modify: `src/services/dashboard/sales-summary.dashboard.service.ts` (computeSettlementProjection uses the helper)
- Test: `tests/unit/services/dashboard/settlementCalendar.dashboard.service.test.ts`

**Interfaces:**
- Consumes: `calculateSettlementDate` from `@/services/payments/settlementCalculation.service`.
- Produces:
  ```ts
  interface ProjectablePayment {
    amount: number; tipAmount: number | null; createdAt: Date; merchantAccountId: string
    transactionCost: { transactionType: TransactionCardType; venueChargeAmount: number; venueFixedFee: number } | null
  }
  interface ActiveConfig { merchantAccountId: string; cardType: TransactionCardType; settlementDays: number; settlementDayType: SettlementDayType; cutoffTime: string; cutoffTimezone: string; effectiveFrom: Date; effectiveTo: Date | null }
  // Returns null when the payment can't be projected (no cost or no matching config).
  function projectPaymentSettlement(
    p: ProjectablePayment, configs: ActiveConfig[], venueTimezone: string,
  ): { settlementDateKey: string; gross: number; commission: number; net: number } | null
  ```

- [ ] **Step 1: Write the failing test**
```ts
import { projectPaymentSettlement } from '@/services/dashboard/settlementCalendar.dashboard.service'
const TZ = 'America/Mexico_City'
const cfg = { merchantAccountId: 'm1', cardType: 'CREDIT', settlementDays: 1, settlementDayType: 'BUSINESS_DAYS', cutoffTime: '23:00', cutoffTimezone: TZ, effectiveFrom: new Date('2026-01-01'), effectiveTo: null }
it('projects net = gross − (charge+fixed) onto the settlement day (venue tz)', () => {
  const p = { amount: 1000, tipAmount: 50, createdAt: new Date('2026-07-04T02:00:00Z'), merchantAccountId: 'm1', transactionCost: { transactionType: 'CREDIT', venueChargeAmount: 30, venueFixedFee: 5 } }
  const r = projectPaymentSettlement(p as any, [cfg as any], TZ)
  expect(r).toEqual({ settlementDateKey: '2026-07-06', gross: 1050, commission: 35, net: 1015 }) // Fri 20:00 MX + 1 biz day = Mon
})
it('returns null when there is no cost or no matching active config', () => {
  const noCost = { amount: 100, tipAmount: 0, createdAt: new Date('2026-07-01T18:00:00Z'), merchantAccountId: 'm1', transactionCost: null }
  expect(projectPaymentSettlement(noCost as any, [cfg as any], TZ)).toBeNull()
  const noCfg = { amount: 100, tipAmount: 0, createdAt: new Date('2026-07-01T18:00:00Z'), merchantAccountId: 'zzz', transactionCost: { transactionType: 'CREDIT', venueChargeAmount: 4, venueFixedFee: 0 } }
  expect(projectPaymentSettlement(noCfg as any, [cfg as any], TZ)).toBeNull()
})
```

- [ ] **Step 2: Run test to verify it fails**
Run: `NODE_OPTIONS='--max-old-space-size=4096' npx jest tests/unit/services/dashboard/settlementCalendar.dashboard.service.test.ts`
Expected: FAIL — `projectPaymentSettlement is not a function`.

- [ ] **Step 3: Write minimal implementation**
```ts
import { formatInTimeZone } from 'date-fns-tz'
import { SettlementDayType, TransactionCardType } from '@prisma/client'
import { calculateSettlementDate } from '@/services/payments/settlementCalculation.service'

export function projectPaymentSettlement(p, configs, venueTimezone) {
  const tc = p.transactionCost
  if (!tc) return null
  const config = configs.find(c => c.merchantAccountId === p.merchantAccountId && c.cardType === tc.transactionType && c.effectiveFrom <= p.createdAt && (c.effectiveTo === null || c.effectiveTo >= p.createdAt))
  if (!config) return null
  const settlementDate = calculateSettlementDate(p.createdAt, { settlementDays: config.settlementDays, settlementDayType: config.settlementDayType, cutoffTime: config.cutoffTime, cutoffTimezone: config.cutoffTimezone })
  const gross = Number(p.amount) + Number(p.tipAmount ?? 0)
  const commission = Number(tc.venueChargeAmount) + Number(tc.venueFixedFee)
  return { settlementDateKey: formatInTimeZone(settlementDate, venueTimezone, 'yyyy-MM-dd'), gross, commission, net: gross - commission }
}
```

- [ ] **Step 4: Run test to verify it passes** — `npx jest ...settlementCalendar...` → PASS (2 tests).

- [ ] **Step 5: Refactor `computeSettlementProjection` to call `projectPaymentSettlement`** (per-payment block only; keep its calendar/nextByMerchant assembly). Run `npx jest tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts` → all green (no behavior change).

- [ ] **Step 6: Commit** — `git add … && git commit -m "refactor(reports): extract projectPaymentSettlement shared helper"`

---

## Task 2: `getSettlementsLandingInWeek` service (backend core)

**Files:**
- Modify: `src/services/dashboard/settlementCalendar.dashboard.service.ts`
- Test: same test file as Task 1

**Interfaces:**
- Consumes: `projectPaymentSettlement` (Task 1); `prisma`.
- Produces:
  ```ts
  interface SettlementWeekDay { date: string; status: 'settled'|'today'|'projected'; gross: number; commission: number; net: number; count: number
    byMerchant: Array<{ merchantAccountId: string; displayName: string; provider: string; gross: number; commission: number; net: number; count: number }>
    byCardType: Array<{ cardType: TransactionCardType; gross: number; commission: number; net: number; count: number }> }
  interface SettlementWeek { weekStart: string; weekEnd: string; days: SettlementWeekDay[]
    weekTotal: { gross: number; commission: number; net: number; count: number }; unprojected: { amount: number; count: number } }
  function getSettlementsLandingInWeek(venueId: string, weekStart: Date, weekEnd: Date, venueTimezone: string): Promise<SettlementWeek>
  ```

- [ ] **Step 1: Write the failing test** (mock prisma like the existing sales-summary tests — `$queryRaw`/`findMany` mocked). Seed 3 card payments: two landing in the target week (Fri→Mon, Wed→Thu) on merchant m1, one with no config (→ unprojected); assert `days` has the two settlement dates with correct net, `weekTotal.net` = their sum, `unprojected.count === 1`, and each day's `byMerchant`/`byCardType` totals equal the day net. (Full assertions with real numbers — mirror Task 1's fixtures.)

- [ ] **Step 2: Run test → FAIL** (`getSettlementsLandingInWeek is not a function`).

- [ ] **Step 3: Implement**
```ts
const LOOKBACK_DAYS = 21 // safe: max settlement days + weekend/holiday slack
export async function getSettlementsLandingInWeek(venueId, weekStart, weekEnd, venueTimezone) {
  const from = new Date(weekStart.getTime() - LOOKBACK_DAYS * 86400000)
  const payments = await prisma.payment.findMany({
    where: { venueId, status: 'COMPLETED', merchantAccountId: { not: null }, method: { not: 'CASH' }, createdAt: { gte: from, lte: weekEnd } },
    select: { amount: true, tipAmount: true, createdAt: true, merchantAccountId: true,
      transactionCost: { select: { transactionType: true, venueChargeAmount: true, venueFixedFee: true } },
      merchantAccount: { select: { displayName: true, alias: true, provider: { select: { name: true } } } } },
  })
  const merchantIds = [...new Set(payments.map(p => p.merchantAccountId).filter(Boolean))]
  const configs = await prisma.settlementConfiguration.findMany({ where: { merchantAccountId: { in: merchantIds } },
    select: { merchantAccountId: true, cardType: true, settlementDays: true, settlementDayType: true, cutoffTime: true, cutoffTimezone: true, effectiveFrom: true, effectiveTo: true } })
  const startKey = formatInTimeZone(weekStart, venueTimezone, 'yyyy-MM-dd')
  const endKey = formatInTimeZone(weekEnd, venueTimezone, 'yyyy-MM-dd')
  const todayKey = formatInTimeZone(new Date(), venueTimezone, 'yyyy-MM-dd')
  // accumulate per day → per merchant / per cardType; track unprojected
  // (build Maps, round at output; status = key<today?settled:key===today?today:projected)
  // filter to keys within [startKey, endKey]; payments that project outside the week are ignored;
  // projectPaymentSettlement===null → unprojected.amount += gross(=amount+tip), unprojected.count++
  // … (assemble SettlementWeek, days sorted asc) …
}
```
(Write the full accumulation — Maps keyed by dateKey → {merchant, cardType} — no placeholders in the real code.)

- [ ] **Step 4: Run test → PASS.**
- [ ] **Step 5: Commit** — `feat(reports): getSettlementsLandingInWeek (settlement-date weekly view)`

---

## Task 3: HTTP endpoint `GET /api/v1/dashboard/reports/settlement-week`

**Files:** Modify `src/controllers/dashboard/reports.controller.ts`, `src/routes/dashboard.routes.ts`. Test: `tests/unit/controllers/dashboard/settlement-week.controller.test.ts`.

**Interfaces:** Consumes `getSettlementsLandingInWeek`, `resolveRequestVenueId`. Query: `weekStart=YYYY-MM-DD` (optional; default = current week's Monday in venue tz). Controller computes Monday-based `[weekStart, weekEnd]` at venue-tz boundaries (use `fromZonedTime` on `weekStart 00:00` and `weekEnd 23:59:59`), returns `{ success, data: SettlementWeek }`.

- [ ] Step 1: Failing controller test (mock the service; assert it's called with venue-tz Monday boundaries + the response shape). Step 2: FAIL. Step 3: implement handler + route. Step 4: PASS. Step 5: Commit `feat(reports): settlement-week endpoint`.

---

## Task 4: MCP tool lockstep

**Files:** Modify `src/mcp/tools/sales.ts` (extend `settlement_calendar` with `week` param or a sibling that returns the `SettlementWeek` shape). Test: `tests/unit/mcp-customer/*settlement*`.

- [ ] TDD: tool returns the week shape for a venue in scope, gated by the same read permission; MCP suite green. Commit `feat(mcp): settlement_calendar week mode (lockstep)`.

---

## Task 5: Reconciliation integration test (backend)

**Files:** `tests/integration/payments/settlement-week-reconciliation.integration.test.ts` (real local DB, seeded FULLTEST venue, ROLLBACK — mirror the /full-testing harness pattern from the reconciliation project).

- [ ] Seed a venue with ≥2 merchants (different providers, one aggregator), different settlement days, one uncosted payment, payments spanning several sale days. Assert: Σ of `net` over the weeks covering the sale range == Σ `byMerchantAccount.netToReceive` from `computeMerchantAccountBreakdown` **minus** `unprojected` == Available Balance card net. Numbers must cuadrar to the cent. Commit `test(reports): settlement-week reconciliation harness`.

---

## Task 6: Frontend service + hook

**Files:** Modify `src/services/reports/salesSummary.service.ts` (add `getSettlementWeek(venueId, weekStart: string)` + `SettlementWeek`/`SettlementWeekDay` types mirroring the backend). Create `src/hooks/useSettlementWeek.ts`. Create `src/components/settlement/weekMath.ts` (+ test): `currentWeekStart(tz): string`, `addWeeks(weekStart: string, n): string`, `weekDays(weekStart: string): string[]` (7 Mon–Sun `yyyy-MM-dd`).

- [ ] TDD `weekMath` (pure, runnable via tsx if vitest is down): `addWeeks('2026-07-06', -1) === '2026-06-29'`; `weekDays('2026-07-06')` = Mon..Sun. Then service call (`GET /api/v1/dashboard/reports/settlement-week?weekStart=…` with `x-venue-id`) + `useSettlementWeek(venueId, weekStart)` (TanStack Query, key `['settlementWeek', venueId, weekStart]`). Commit `feat(reports): settlement-week service + hook + week math`.

---

## Task 7: `SettlementWeekStrip` shared component

**Files:** Create `src/components/settlement/SettlementWeekStrip.tsx` (+ `.test.tsx`).

**Props:** `{ venueId: string; venueTimezone: string; className?: string }`. Internally: `useState(currentWeekStart(venueTimezone))`, `useSettlementWeek`, ‹ › buttons (`addWeeks(±1)`), week label, 7 day cells (net primary + gross secondary + status icon; weekend muted), click → expand `byMerchant`/`byCardType`, footer week total + `unprojected` honesty chip. Design-system compliant (see Global Constraints). `data-testid`: `settlement-week`, `settlement-week-prev/next`, `settlement-week-day-{date}`, `settlement-week-unprojected`.

- [ ] TDD (component tests, mock the hook): renders 7 day cells; prev/next changes the week-start passed to the hook; a day with data shows net+gross; unprojected chip shows when `unprojected.amount > 1`; expanding a day shows its merchant rows. Commit `feat(settlement): shared SettlementWeekStrip component`.

---

## Task 8: Integrate into Saldo Disponible

**Files:** Modify `src/pages/AvailableBalance/AvailableBalance.tsx` (render `SettlementWeekStrip` where `SettlementCalendarWeek` was).

- [ ] Wire it (pass venueId + venueTimezone). Verify against the fresh vite server (E2E-mock or preview) that the strip renders + navigates. Commit `feat(available-balance): use shared settlement week strip`.

---

## Task 9: Integrate into Resumen statement

**Files:** Modify `src/pages/Reports/statement/StatementSection.tsx` (render `SettlementWeekStrip` instead of `PayoutTimeline`; keep the hero + merchant rows).

- [ ] Wire it. The statement's "cuándo llega" section now navigates freely by week (independent of the report's sale-date range — documented in the spec). Commit `feat(reports): statement uses shared settlement week strip`.

---

## Task 10: Delete old components + i18n + E2E

**Files:** Add `settlementWeek.*` keys to `src/locales/{en,es}/reports.json`. Delete `SettlementCalendarWeek.tsx`, `PayoutTimeline.tsx` (+ tests). Rewrite/extend `e2e/tests/reports/settlement-week.spec.ts`.

- [ ] Add i18n (en+es). Delete old components; fix any dangling imports (tsc). E2E (mocked API): current week renders, prev/next navigates, per-day net/gross, day expand, unprojected chip; in both pages. Run `npm run build` + `npm run lint` + reports E2E (fresh vite on a free port + `E2E_BASE_URL`; note local vitest caveat). Commit `feat(settlement): migrate both pages to week strip; remove old calendars`.

---

## Self-Review

- **Spec coverage:** week strip (T7) · settlement-date recompute (T1–T2) · gross+net+breakdown (T2, T7) · both pages same component (T8–T9) · unprojected honesty (T2, T7) · cash excluded (T2 query) · endpoint (T3) · MCP lockstep (T4) · reconciliation (T5) · Mon–Sun venue tz (T2, T6). All covered.
- **Placeholder scan:** Task 2 Step 3 marks the accumulation body as "write the full accumulation" — the implementer must write real Map-based accumulation (interfaces + Task 1 give exact field names); Task 3/4/8/9 steps are condensed (single TDD line) because they're thin wrappers over typed interfaces already defined. Acceptable; no `TODO`/`TBD` in code.
- **Type consistency:** `SettlementWeek`/`SettlementWeekDay`/`projectPaymentSettlement` names + fields identical across backend (T2), MCP (T4), frontend types (T6), component (T7).
- **Scope:** one coherent feature; backend tasks (T1–T5) then frontend (T6–T10), each independently testable.

## Execution Handoff — see below.
