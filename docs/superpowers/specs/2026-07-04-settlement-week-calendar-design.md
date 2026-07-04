# Settlement Week Calendar — design spec

**Date:** 2026-07-04
**Repos:** avoqado-server (backend + MCP) · avoqado-web-dashboard (frontend)
**Status:** design approved; pending implementation plan.

## Context / problem

Venue owners need to know **how much money lands in their bank each day**, and be able
to page back through past weeks to see **how much should have landed** on previous days.
Today this lives in two disconnected places with different logic:

- **Saldo Disponible** — `SettlementCalendarWeek` (fixed next-30-days) + `SettlementTimelineTable` + `NextDepositHero`.
- **Resumen de Ventas** — `PayoutTimeline` (scoped to the report's sale-date range; no free navigation).

Neither lets you freely navigate week-by-week by **settlement date**, and the two don't
agree. The founder's priority: **the numbers must be REAL** across the platform's full
complexity (multiple merchant accounts, aggregators, providers, per-cardType settlement
rules, `venueFixedFee`, uncosted/no-config payments, cash-vs-card, corrected settlement
dates). The settlement-date engine was just fixed (weekends/holidays/Semana Santa/venue-tz),
so this spec is about **presenting** those correct numbers as a navigable weekly calendar,
shared identically by both pages.

## Decisions (locked with the founder)

1. **Per-day amount = gross + net, nicely broken down** (by merchant and by card type), with commission (incl. `venueFixedFee`) visible.
2. **Week strip** (7 days, ‹ › prev/next), starts on the current week, navigates freely. **Monday–Sunday**, in the venue timezone.
3. **By SETTLEMENT date** — each day shows money **landing in the bank that day**, regardless of when the sale happened (a Friday sale landing Monday appears on Monday). Same component + same numbers in both pages.
4. **Cash is NOT in the deposit calendar** — it's immediate (in hand the sale day), not a bank deposit. It stays shown separately where it already is.
5. **Compute-on-read** (recompute settlement dates live via the corrected engine) — no dependency on stored `estimatedSettlementDate` (old rows were computed with the pre-fix bug; recompute guarantees correct numbers with no backfill).
6. **Honesty:** card money that can't be projected (no active `SettlementConfiguration`) is surfaced as a "sin fecha estimada" total, never silently dropped.

## Architecture

### Backend — `avoqado-server`

New service function (new file `src/services/dashboard/settlementCalendar.dashboard.service.ts`,
or alongside `availableBalance.dashboard.service.ts`):

```
getSettlementsLandingInWeek(venueId, weekStartUtc, weekEndUtc, timezone) → {
  weekStart, weekEnd,                     // venue-local yyyy-MM-dd
  days: Array<{
    date,                                 // yyyy-MM-dd (venue-local settlement day)
    status,                               // 'settled' (past) | 'today' | 'projected' (future)
    gross, commission, net, count,        // day totals (gross = amount+tip; commission = venueCharge+fixedFee)
    byMerchant: Array<{ merchantAccountId, displayName, provider, gross, commission, net, count }>,
    byCardType: Array<{ cardType, gross, commission, net, count }>,
  }>,
  weekTotal: { gross, commission, net, count },
  unprojected: { amount, count },         // card money with no settlement rule (no landing date)
}
```

**Algorithm (correctness core):**
1. Load COMPLETED card payments (`method != CASH`) whose `createdAt` is in a lookback window
   wide enough to catch anything landing in the week: `[weekStart − LOOKBACK, weekEnd]`
   (`LOOKBACK` ≥ maxSettlementDays translated to calendar days + weekend/holiday slack; use a
   safe constant, e.g. 21 days). Include `transactionCost` + `merchantAccount` (name/provider).
2. For each payment: resolve the active `SettlementConfiguration` for its `merchantAccountId ×
   cardType` effective at `createdAt`; compute the settlement date via the **corrected**
   `calculateSettlementDate`. No config → add to `unprojected`, skip.
3. Keep only payments whose settlement day (venue-local `yyyy-MM-dd`) ∈ `[weekStart, weekEnd]`.
4. Group by settlement day → per-day gross/commission/net/count + `byMerchant` + `byCardType`.
5. Status per day vs venue-local today. Round money at the output boundary (cents).

This **reuses the same per-payment projection logic** as `computeSettlementProjection`
(sale-range-scoped); factor the shared per-payment "resolve config → project date → net"
step into one helper so both call sites can't drift.

**Endpoint:** `GET /api/v1/dashboard/reports/settlement-week?weekStart=YYYY-MM-DD` (server derives
weekEnd + does venue-tz boundary math). Resolve venue via `resolveRequestVenueId` (param →
`x-venue-id` → JWT), same as the other reports. Gating: readable by both pages — a basic
venue read permission; the Resumen page keeps its `ADVANCED_REPORTS` FeatureGate at the UI
layer, Saldo Disponible keeps its KYC/balance guard. (Confirm exact permission during planning.)

**MCP lockstep (CLAUDE.md rule):** extend/replace the `settlement_calendar` tool so an agent
can ask "what lands the week of X" with the same shape.

### Frontend — `avoqado-web-dashboard`

- **Service:** `getSettlementWeek(venueId, weekStart)` in a reports/balance service + types.
- **Hook:** `useSettlementWeek(venueId, weekStart)` — TanStack Query, keyed by `[venueId, weekStart]`.
- **Component:** `src/components/settlement/SettlementWeekStrip.tsx` (shared):
  - Week state + ‹ › (prev/next week), label "Semana del … al …", defaults to current week.
  - 7 day cells (Mon–Sun): **net** primary + **gross** secondary + status icon
    (✓ ya debió caer · ● hoy · ◇ proyectado); weekend cells rendered muted/empty.
  - Click a day → expand detail: `byMerchant` + `byCardType` with commission.
  - Footer: week total (gross/net) + "sin fecha estimada: $X" honesty chip when `unprojected > 1`.
  - Design-system compliant: GlassCard/`border-input`, semantic tokens, no gradients,
    `tabular-nums`, `t()` en+es, venue tz via `useVenueDateTime`, memoized arrays.
- **Integration:** used identically in **Saldo Disponible** (replaces `SettlementCalendarWeek`)
  and in the **Resumen statement** (replaces `PayoutTimeline`). Old components deleted once
  E2E migrated.

## Correctness guarantees ("números reales")

- Corrected settlement engine (weekends + MX holidays + Semana Santa + venue tz).
- Net = `amount + tip − (venueChargeAmount + venueFixedFee)`.
- Per merchant×cardType rules (different days) resolved per payment at its sale date.
- Multi-merchant / aggregator / provider handled (grouped by merchant).
- Recompute-on-read → no stale stored dates.
- Uncosted / no-config money surfaced as `unprojected`, never dropped.
- Cash excluded (immediate; not a deposit).

## Testing

- **Backend unit:** Friday sale lands Monday and appears in Monday's week; a payment with no
  config → `unprojected`; fees netted (fixed fee included); week-boundary edges (payment landing
  exactly on weekStart/weekEnd); a week spanning Semana Santa; multi-merchant grouping.
- **Reconciliation test** (harness-style, like the /full-testing run): for a seeded venue, the
  sum of `net` across the weeks covering a sale range equals the per-merchant breakdown's card
  net (minus any `unprojected`), and ties to Available Balance. Numbers must cuadrar.
- **Frontend:** component tests (week nav, day expand, honesty chip, empty week) + E2E (mocked
  API): prev/next week, per-day gross/net, breakdown expand, unprojected chip. (Note: local
  vitest is broken — Node 21 vs jsdom 27; run in CI. Pure logic proven via tsx if needed.)
- **MCP:** tool test for the week shape.

## Non-goals (YAGNI)

- No month-grid view (week strip chosen).
- No mixing cash into the deposit calendar.
- No backfill of historical `estimatedSettlementDate` (recompute-on-read makes it unnecessary).
- No manual "confirmar liquidación" flow (already made automatic by date).
- No actual-vs-estimated bank reconciliation (no bank API yet; "should have landed" = estimate).

## Rollout

Backend + frontend land on `develop` → demo/staging → `main` (prod) via the normal
develop→main FF. MCP updated in the same change. Presentation deck: exempt (internal
report UX, no new customer-visible capability beyond what's already sold).
