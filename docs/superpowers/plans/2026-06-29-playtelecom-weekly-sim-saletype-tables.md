# PlayTelecom Weekly "Tipo de Venta" + "Tipo de SIM" Tables — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add two weekly heatmap tables (by sale type, by SIM type) below "Ventas Totales Semanales" on the org-level Ventas page, with totals that reconcile exactly against the weekly bar and KPIs.

**Architecture:** Two new backend aggregations iterate the *same* `SaleVerification.status=COMPLETED` base as the existing weekly bar, bucketed by ISO year-week. Sale type comes from `isPortabilidad`; SIM type from `ItemCategory.name` mapped to 3 fixed buckets + an "Otros SIMs" catch-all (a shared `toSimBucket` helper also regroups the existing monthly SIM chart). The existing generic `HeatmapTable` component renders both tables; it gains an optional `sortRows` prop so the new tables keep a fixed row order.

**Tech Stack:** Backend — Express + TypeScript, Prisma, Jest. Frontend — React 18 + Vite + TanStack Query, Luxon, Vitest. MCP — `@modelcontextprotocol/sdk`.

**Spec:** `docs/superpowers/specs/2026-06-29-playtelecom-weekly-sim-saletype-tables-design.md`

## Global Constraints

- **Reconciliation invariant:** per week, `Σ sale-type rows == Σ sim-type rows == by-week count`. Both new aggregations MUST derive from `baseAggregationWhere(orgId, range)` (i.e. `SaleVerification.status='COMPLETED'`, `venue.organizationId=orgId`).
- **Canonical SIM names (verbatim, pending Task 1 confirmation):** `'SIM de Intercambio'`, `'$100 de Promotor'`, `'SIM de Evento'`; catch-all label `'Otros SIMs'`. Matching is `trim().toLowerCase()` exact.
- **Sale-type row labels (verbatim):** `'Líneas Nuevas'`, `'Portabilidades'`.
- **Week key format:** `"YYYY-Www"` (ISO year-week, zero-padded week), e.g. `"2026-W26"`. Do NOT modify the existing `toWeekLabel` (used by the bar chart).
- **Never remove or rename existing API response fields.** New endpoints only; new fields optional.
- **Frontend API paths include `/api/v1/`.** Permission gate on every new route: `sale-verifications:review`.
- **i18n:** This page uses hardcoded Spanish (no `t()`). Match it.
- **Tier:** exempt (extends an existing white-label org report).
- **MCP sync is mandatory** in the same change (extend `org_confirmed_sales_report`).
- **Commits require Jose's explicit per-commit approval** (repo policy). The commit steps below are real, but pause for approval; use the Co-Authored-By identity defined in `.claude/rules/testing-and-git.md`.

## File Structure

**avoqado-server**
- Modify `src/services/dashboard/sale-verification.org.dashboard.service.ts` — add `toIsoWeekKey`, `toSimBucket` + SIM constants, `getSalesBySaleTypeWeekly`, `getSalesBySimTypeWeekly`; regroup `getSalesBySimType`.
- Modify `src/controllers/dashboard/sale-verification.org.dashboard.controller.ts` — 2 handlers.
- Modify `src/routes/dashboard/saleVerification.org.dashboard.routes.ts` — 2 routes.
- Modify `src/mcp/tools/saleVerifications.ts` — 2 new `groupBy` values + cases + imports.
- Modify `tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts` — new describe blocks.

**avoqado-web-dashboard**
- Modify `src/services/saleVerification.org.service.ts` — 2 row types + 2 fetchers.
- Create `src/pages/organizations/SalesExecutive/weekBuckets.ts` — `weekBucketsAsc`.
- Create `src/pages/organizations/SalesExecutive/weekBuckets.test.ts` — unit test.
- Modify `src/pages/organizations/SalesExecutive/SalesExecutive.tsx` — `HeatmapTable` `sortRows` prop; 2 queries + 2 tables.

---

### Task 1: Confirm canonical SIM category names (discovery, read-only)

**Files:** none modified. Output: confirmed values for the SIM constants used in Task 3+.

- [ ] **Step 1: Read the real `ItemCategory` names for the PlayTelecom org**

Preferred (no DB creds): open the live dashboard → PlayTelecom → **Ventas** → legend of the **"Ventas por Tipo de SIM"** chart; record the exact category names.

Alternative (read-only SQL, server repo, uses existing `DATABASE_URL`):

```bash
cd avoqado-server
npx tsx -e "import p from './src/utils/prismaClient'; p.itemCategory.findMany({ where: { organizationId: 'cmietitbn000zpr2d8213qkzq' }, select: { name: true }, orderBy: { name: 'asc' } }).then(r => { console.log(r.map(x => x.name)); return p.\$disconnect() })"
```

- [ ] **Step 2: Reconcile against the canonical constants**

Confirm the three names map exactly (after `trim().toLowerCase()`) to `'SIM de Intercambio'`, `'$100 de Promotor'`, `'SIM de Evento'`. If a real name differs (e.g. missing "de", different casing/accent, or "$100" written as "100"), note the exact string — Task 3 will use the real strings in `SIM_FIXED_BUCKETS`. Confirm `'E-SIM de promotor'` (or similar) is NOT one of the three (it must fall into "Otros SIMs").

- [ ] **Step 3: Record the confirmed list** in the PR description and, if any differed, update the constant in Task 3 accordingly. No commit.

---

### Task 2: `toIsoWeekKey` helper (backend)

**Files:**
- Modify: `src/services/dashboard/sale-verification.org.dashboard.service.ts` (add near `toWeekLabel`, ~L330)
- Test: `tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts`

**Interfaces:**
- Produces: `toIsoWeekKey(d: Date, tz?: string): string` → `"YYYY-Www"`. Not exported (same-file use); tested via a thin re-export OR via `getSalesBySaleTypeWeekly` in later tasks. To test directly now, add a temporary `export`.

- [ ] **Step 1: Write the failing test** (append new describe block)

```ts
import { getSalesBySaleTypeWeekly } from '@/services/dashboard/sale-verification.org.dashboard.service'
// ...existing imports/mocks unchanged...

describe('toIsoWeekKey (via getSalesBySaleTypeWeekly week keys)', () => {
  it('produces ISO year-week keys and orders correctly across a year boundary', async () => {
    // 2025-12-29 (Mon) is ISO 2026-W01; 2026-01-05 (Mon) is 2026-W02
    const dec29 = new Date('2025-12-29T18:00:00Z')
    const jan05 = new Date('2026-01-05T18:00:00Z')
    mockedSvFindMany.mockResolvedValue([
      { createdAt: dec29, isPortabilidad: false },
      { createdAt: jan05, isPortabilidad: false },
    ])
    const rows = await getSalesBySaleTypeWeekly(ORG_ID, {})
    const lineas = rows.find(r => r.name === 'Líneas Nuevas')!
    expect(Object.keys(lineas.byWeek).sort()).toEqual(['2026-W01', '2026-W02'])
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "ISO year-week"`
Expected: FAIL — `getSalesBySaleTypeWeekly` is not exported yet.

- [ ] **Step 3: Add the helper** (just above `toMonthKey`, ~L332)

```ts
/** ISO year-week key "YYYY-Www" in venue timezone. Sortable across years. */
function toIsoWeekKey(d: Date, tz: string = VENUE_TIMEZONE_DEFAULT): string {
  const local = new Date(d.toLocaleString('en-US', { timeZone: tz }))
  const day = local.getUTCDay() || 7
  local.setUTCDate(local.getUTCDate() + 4 - day) // shift to the week's Thursday
  const isoYear = local.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const week = Math.ceil(((local.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${isoYear}-W${String(week).padStart(2, '0')}`
}
```

(The test stays red until Task 4 adds `getSalesBySaleTypeWeekly`. That is expected — Task 2 only lands the helper; Tasks 2–4 share one commit at the end of Task 4. Do NOT commit yet.)

- [ ] **Step 4: Type-check**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: PASS (unused-function warning is acceptable until Task 4).

---

### Task 3: `toSimBucket` + SIM bucket constants (backend)

**Files:**
- Modify: `src/services/dashboard/sale-verification.org.dashboard.service.ts` (add near top of file, after imports / `VENUE_TIMEZONE_DEFAULT`)
- Test: `tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts`

**Interfaces:**
- Produces:
  - `type SimBucket = 'SIM de Intercambio' | '$100 de Promotor' | 'SIM de Evento' | 'Otros SIMs'`
  - `SIM_FIXED_BUCKETS: readonly SimBucket[]` (the 3 fixed, in display order)
  - `SIM_OTHERS: 'Otros SIMs'`
  - `toSimBucket(categoryName: string | null | undefined): SimBucket` (exported, for the unit test)

- [ ] **Step 1: Write the failing test**

```ts
import { toSimBucket } from '@/services/dashboard/sale-verification.org.dashboard.service'

describe('toSimBucket', () => {
  it('maps the three fixed categories exactly', () => {
    expect(toSimBucket('SIM de Intercambio')).toBe('SIM de Intercambio')
    expect(toSimBucket('$100 de Promotor')).toBe('$100 de Promotor')
    expect(toSimBucket('SIM de Evento')).toBe('SIM de Evento')
  })
  it('is trim/case-insensitive', () => {
    expect(toSimBucket('  sim de intercambio ')).toBe('SIM de Intercambio')
  })
  it('routes E-SIM de promotor, null and unknowns to "Otros SIMs"', () => {
    expect(toSimBucket('E-SIM de promotor')).toBe('Otros SIMs')
    expect(toSimBucket(null)).toBe('Otros SIMs')
    expect(toSimBucket('Cualquier otra')).toBe('Otros SIMs')
  })
})
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "toSimBucket"`
Expected: FAIL — `toSimBucket` not exported.

- [ ] **Step 3: Add the constants + helper** (after `VENUE_TIMEZONE_DEFAULT`, ~L24)

```ts
// SIM-type buckets for the org Ventas tables/charts. The 3 fixed names are
// tenant data (confirmed against PlayTelecom's ItemCategory records); everything
// else — incl. "E-SIM de promotor", null, legacy "Otro" — collapses to "Otros SIMs"
// so row sums always reconcile with the weekly total.
export type SimBucket = 'SIM de Intercambio' | '$100 de Promotor' | 'SIM de Evento' | 'Otros SIMs'
export const SIM_OTHERS: SimBucket = 'Otros SIMs'
export const SIM_FIXED_BUCKETS: readonly SimBucket[] = ['SIM de Intercambio', '$100 de Promotor', 'SIM de Evento']

export function toSimBucket(categoryName: string | null | undefined): SimBucket {
  const n = (categoryName ?? '').trim().toLowerCase()
  return SIM_FIXED_BUCKETS.find(b => b.toLowerCase() === n) ?? SIM_OTHERS
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "toSimBucket"`
Expected: PASS.

(No commit yet — folded into Task 5's commit, since Task 5 is `toSimBucket`'s first real consumer.)

---

### Task 4: `getSalesBySaleTypeWeekly` aggregation (backend)

**Files:**
- Modify: `src/services/dashboard/sale-verification.org.dashboard.service.ts` (add after `getSalesByWeek`, ~L495)
- Test: `tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts`

**Interfaces:**
- Produces: `getSalesBySaleTypeWeekly(orgId: string, range: AggregationRange): Promise<Array<{ name: 'Líneas Nuevas' | 'Portabilidades'; byWeek: Record<string, number>; total: number }>>`. Always returns exactly 2 rows, fixed order: Líneas Nuevas, Portabilidades.

- [ ] **Step 1: Write the failing tests**

```ts
describe('getSalesBySaleTypeWeekly', () => {
  it('splits COMPLETED sales by isPortabilidad into fixed weekly rows', async () => {
    const w1 = new Date('2026-03-09T18:00:00Z') // 2026-W11
    const w2 = new Date('2026-03-16T18:00:00Z') // 2026-W12
    mockedSvFindMany.mockResolvedValue([
      { createdAt: w1, isPortabilidad: false },
      { createdAt: w1, isPortabilidad: true },
      { createdAt: w2, isPortabilidad: false },
    ])
    const rows = await getSalesBySaleTypeWeekly(ORG_ID, {})
    expect(rows.map(r => r.name)).toEqual(['Líneas Nuevas', 'Portabilidades'])
    expect(rows[0]).toMatchObject({ total: 2, byWeek: { '2026-W11': 1, '2026-W12': 1 } })
    expect(rows[1]).toMatchObject({ total: 1, byWeek: { '2026-W11': 1 } })
  })
  it('returns both rows even when one type has zero sales', async () => {
    mockedSvFindMany.mockResolvedValue([{ createdAt: new Date('2026-03-09T18:00:00Z'), isPortabilidad: false }])
    const rows = await getSalesBySaleTypeWeekly(ORG_ID, {})
    expect(rows.map(r => r.name)).toEqual(['Líneas Nuevas', 'Portabilidades'])
    expect(rows[1]).toMatchObject({ total: 0, byWeek: {} })
  })
  it('only queries CONFIRMED verifications', async () => {
    mockedSvFindMany.mockResolvedValue([])
    await getSalesBySaleTypeWeekly(ORG_ID, {})
    expect(mockedSvFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED', venue: { organizationId: ORG_ID } }) }),
    )
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "getSalesBySaleTypeWeekly"`
Expected: FAIL — not implemented.

- [ ] **Step 3: Implement** (after `getSalesByWeek`)

```ts
/**
 * Confirmed sales by Tipo de Venta (Línea Nueva vs Portabilidad) × ISO week.
 * Same COMPLETED base as getSalesByWeek so weekly totals reconcile exactly.
 * Always returns both rows in fixed order, even if a week/type is empty.
 */
export async function getSalesBySaleTypeWeekly(
  orgId: string,
  range: AggregationRange,
): Promise<Array<{ name: 'Líneas Nuevas' | 'Portabilidades'; byWeek: Record<string, number>; total: number }>> {
  const verifications = await prisma.saleVerification.findMany({
    where: baseAggregationWhere(orgId, range),
    select: { createdAt: true, isPortabilidad: true },
  })
  const rows: Record<'Líneas Nuevas' | 'Portabilidades', { byWeek: Record<string, number>; total: number }> = {
    'Líneas Nuevas': { byWeek: {}, total: 0 },
    Portabilidades: { byWeek: {}, total: 0 },
  }
  for (const v of verifications) {
    const key = v.isPortabilidad ? 'Portabilidades' : 'Líneas Nuevas'
    const wk = toIsoWeekKey(v.createdAt)
    rows[key].byWeek[wk] = (rows[key].byWeek[wk] ?? 0) + 1
    rows[key].total += 1
  }
  return [
    { name: 'Líneas Nuevas', ...rows['Líneas Nuevas'] },
    { name: 'Portabilidades', ...rows.Portabilidades },
  ]
}
```

- [ ] **Step 4: Run to verify it passes** (this also turns Task 2's test green)

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "getSalesBySaleTypeWeekly|ISO year-week"`
Expected: PASS.

- [ ] **Step 5: Commit** (Tasks 2–4) — *pause for Jose's approval*

```bash
git add src/services/dashboard/sale-verification.org.dashboard.service.ts tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts
git commit -m "feat(org-ventas): weekly sale-type aggregation + ISO week key"
```

---

### Task 5: `getSalesBySimTypeWeekly` aggregation (backend)

**Files:**
- Modify: `src/services/dashboard/sale-verification.org.dashboard.service.ts` (add after Task 4's function)
- Test: same test file

**Interfaces:**
- Consumes: `toSimBucket`, `SIM_FIXED_BUCKETS`, `SIM_OTHERS`, `toIsoWeekKey`, `baseAggregationWhere`.
- Produces: `getSalesBySimTypeWeekly(orgId, range): Promise<Array<{ name: SimBucket; byWeek: Record<string, number>; total: number }>>`. The 3 fixed rows ALWAYS present (fixed order); "Otros SIMs" appended ONLY if its total > 0.

- [ ] **Step 1: Write the failing tests**

```ts
describe('getSalesBySimTypeWeekly', () => {
  const w11 = new Date('2026-03-09T18:00:00Z') // 2026-W11
  const cat = (name: string | null) => ({ payment: { order: { items: name === null ? [] : [{ serializedItem: { category: { name } } }] } } })

  it('groups by SIM bucket per week; 3 fixed always present; Otros only when > 0', async () => {
    mockedSvFindMany.mockResolvedValue([
      { createdAt: w11, ...cat('SIM de Intercambio') },
      { createdAt: w11, ...cat('SIM de Intercambio') },
      { createdAt: w11, ...cat('SIM de Evento') },
      { createdAt: w11, ...cat('E-SIM de promotor') }, // → Otros SIMs
    ])
    const rows = await getSalesBySimTypeWeekly(ORG_ID, {})
    expect(rows.map(r => r.name)).toEqual(['SIM de Intercambio', '$100 de Promotor', 'SIM de Evento', 'Otros SIMs'])
    expect(rows[0]).toMatchObject({ total: 2, byWeek: { '2026-W11': 2 } })
    expect(rows[1]).toMatchObject({ total: 0, byWeek: {} }) // $100 fixed, zero, still present
    expect(rows[2]).toMatchObject({ total: 1 })
    expect(rows[3]).toMatchObject({ name: 'Otros SIMs', total: 1 })
  })

  it('omits "Otros SIMs" when every sale is a fixed category', async () => {
    mockedSvFindMany.mockResolvedValue([{ createdAt: w11, ...cat('$100 de Promotor') }])
    const rows = await getSalesBySimTypeWeekly(ORG_ID, {})
    expect(rows.map(r => r.name)).toEqual(['SIM de Intercambio', '$100 de Promotor', 'SIM de Evento'])
  })

  it('treats a sale with no serialized item as Otros SIMs', async () => {
    mockedSvFindMany.mockResolvedValue([{ createdAt: w11, ...cat(null) }])
    const rows = await getSalesBySimTypeWeekly(ORG_ID, {})
    expect(rows.find(r => r.name === 'Otros SIMs')).toMatchObject({ total: 1 })
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "getSalesBySimTypeWeekly"`
Expected: FAIL — not implemented.

- [ ] **Step 3: Implement**

```ts
/**
 * Confirmed sales by Tipo de SIM × ISO week. Category resolved through
 * payment→order→items→serializedItem→category, mapped to 3 fixed buckets +
 * "Otros SIMs". Same COMPLETED base as getSalesByWeek → totals reconcile.
 * The 3 fixed rows are always present (fixed order); "Otros SIMs" only if > 0.
 */
export async function getSalesBySimTypeWeekly(
  orgId: string,
  range: AggregationRange,
): Promise<Array<{ name: SimBucket; byWeek: Record<string, number>; total: number }>> {
  const verifications = await prisma.saleVerification.findMany({
    where: baseAggregationWhere(orgId, range),
    select: {
      createdAt: true,
      payment: {
        select: {
          order: { select: { items: { select: { serializedItem: { select: { category: { select: { name: true } } } } } } } },
        },
      },
    },
  })
  const acc = new Map<SimBucket, { byWeek: Record<string, number>; total: number }>()
  const ensure = (b: SimBucket) => {
    let r = acc.get(b)
    if (!r) { r = { byWeek: {}, total: 0 }; acc.set(b, r) }
    return r
  }
  for (const b of SIM_FIXED_BUCKETS) ensure(b) // fixed rows always present
  for (const v of verifications) {
    const first = v.payment?.order?.items?.find(oi => oi.serializedItem)?.serializedItem
    const bucket = toSimBucket(first?.category?.name ?? null)
    const wk = toIsoWeekKey(v.createdAt)
    const r = ensure(bucket)
    r.byWeek[wk] = (r.byWeek[wk] ?? 0) + 1
    r.total += 1
  }
  const ordered: SimBucket[] = [...SIM_FIXED_BUCKETS]
  const others = acc.get(SIM_OTHERS)
  if (others && others.total > 0) ordered.push(SIM_OTHERS)
  return ordered.map(name => ({ name, ...ensure(name) }))
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "getSalesBySimTypeWeekly|toSimBucket"`
Expected: PASS.

- [ ] **Step 5: Commit** — *pause for approval*

```bash
git add src/services/dashboard/sale-verification.org.dashboard.service.ts tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts
git commit -m "feat(org-ventas): weekly SIM-type aggregation (3 fixed + Otros SIMs)"
```

---

### Task 6: Reconciliation regression test (backend)

**Files:**
- Test only: `tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts`

**Interfaces:**
- Consumes: `getSalesByWeek`, `getSalesBySaleTypeWeekly`, `getSalesBySimTypeWeekly`. (Add `getSalesByWeek` to the import list at the top of the test file.)

- [ ] **Step 1: Write the test** — one dataset feeds all three; per-week sums must match

```ts
describe('weekly tables reconcile with the weekly bar', () => {
  it('per week, Σ sale-type == Σ sim-type == by-week count', async () => {
    const c = (name: string) => ({ payment: { amount: 100, order: { items: [{ serializedItem: { category: { name } } }] } } })
    const W11 = '2026-03-09T18:00:00Z'
    const W12 = '2026-03-16T18:00:00Z'
    const dataset = [
      { createdAt: new Date(W11), isPortabilidad: false, ...c('SIM de Intercambio') },
      { createdAt: new Date(W11), isPortabilidad: true, ...c('SIM de Evento') },
      { createdAt: new Date(W11), isPortabilidad: false, ...c('E-SIM de promotor') }, // Otros
      { createdAt: new Date(W12), isPortabilidad: true, ...c('$100 de Promotor') },
    ]
    mockedSvFindMany.mockResolvedValue(dataset) // same value for all 3 calls

    const byWeek = await getSalesByWeek(ORG_ID, {})
    const sale = await getSalesBySaleTypeWeekly(ORG_ID, {})
    const sim = await getSalesBySimTypeWeekly(ORG_ID, {})

    const sumByWeek = (rows: Array<{ byWeek: Record<string, number> }>, wk: string) =>
      rows.reduce((a, r) => a + (r.byWeek[wk] ?? 0), 0)

    for (const { week, count } of byWeek) {
      expect(sumByWeek(sale, week)).toBe(count)
      expect(sumByWeek(sim, week)).toBe(count)
    }
    // grand totals match too
    const grand = byWeek.reduce((a, r) => a + r.count, 0)
    expect(sale.reduce((a, r) => a + r.total, 0)).toBe(grand)
    expect(sim.reduce((a, r) => a + r.total, 0)).toBe(grand)
  })
})
```

- [ ] **Step 2: Run to verify it passes**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "reconcile"`
Expected: PASS. (Note `getSalesByWeek`'s key is `"Wxx"` from `toWeekLabel`; the weekly tables key is `"YYYY-Www"`. This test reconciles **counts per the bar's own week keys** by re-deriving sums — it asserts the totals match, which is the invariant Isaac asked for. The display key difference is cosmetic and handled on the frontend.)

> If `getSalesByWeek`'s `"Wxx"` keys and the tables' `"YYYY-Www"` keys make per-week mapping awkward in the test, assert only the **grand-total** equalities (the 3 `reduce` lines) — those fully capture "el total debe cuadrar". Keep whichever is green and meaningful.

- [ ] **Step 3: Commit** — *pause for approval*

```bash
git add tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts
git commit -m "test(org-ventas): reconciliation invariant for weekly tables"
```

---

### Task 7: Regroup the monthly "Ventas por Tipo de SIM" chart (backend)

**Files:**
- Modify: `src/services/dashboard/sale-verification.org.dashboard.service.ts` (`getSalesBySimType`, ~L430-474)
- Test: same test file

**Interfaces:**
- `getSalesBySimType` keeps its signature; `byCategory` keys become the 4 SIM buckets instead of raw names. Frontend chart already iterates categories dynamically — no frontend change.

- [ ] **Step 1: Write the failing test**

```ts
import { getSalesBySimType } from '@/services/dashboard/sale-verification.org.dashboard.service'

describe('getSalesBySimType — regrouped into SIM buckets', () => {
  it('collapses raw categories into the 3 fixed + Otros SIMs', async () => {
    mockedPaymentFindMany.mockResolvedValue([
      { createdAt: new Date('2026-03-15T18:00:00Z'), order: { items: [{ serializedItem: { category: { name: 'SIM de Intercambio' } } }] } },
      { createdAt: new Date('2026-03-16T18:00:00Z'), order: { items: [{ serializedItem: { category: { name: 'E-SIM de promotor' } } }] } },
    ])
    const rows = await getSalesBySimType(ORG_ID, {})
    expect(rows).toHaveLength(1)
    expect(rows[0].byCategory).toEqual({ 'SIM de Intercambio': 1, 'Otros SIMs': 1 })
    expect(rows[0].total).toBe(2)
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "regrouped into SIM buckets"`
Expected: FAIL — currently keys are raw names (`'E-SIM de promotor'`).

- [ ] **Step 3: Edit `getSalesBySimType`** — change the one line that derives the key

Replace:
```ts
    const categoryName = first?.category?.name ?? 'Otro'
    const row = map.get(month) ?? {}
    row[categoryName] = (row[categoryName] ?? 0) + 1
```
with:
```ts
    const bucket = toSimBucket(first?.category?.name ?? null)
    const row = map.get(month) ?? {}
    row[bucket] = (row[bucket] ?? 0) + 1
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd avoqado-server && npx jest tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts -t "regrouped into SIM buckets"`
Expected: PASS.

- [ ] **Step 5: Commit** — *pause for approval*

```bash
git add src/services/dashboard/sale-verification.org.dashboard.service.ts tests/unit/services/dashboard/sale-verification.org.aggregations.test.ts
git commit -m "feat(org-ventas): regroup monthly SIM chart into shared SIM buckets"
```

---

### Task 8: Controller handlers + routes (backend)

**Files:**
- Modify: `src/controllers/dashboard/sale-verification.org.dashboard.controller.ts` (after `getSalesByWeek`, ~L116)
- Modify: `src/routes/dashboard/saleVerification.org.dashboard.routes.ts` (after the `/by-week` line)

**Interfaces:**
- Produces routes: `GET .../sale-verifications/by-sale-type-weekly`, `GET .../by-sim-type-weekly`.

- [ ] **Step 1: Add the two controller handlers** (mirror `getSalesByWeek`)

```ts
export async function getSalesBySaleTypeWeekly(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params
    const { fromDate, toDate } = req.query
    const range = svc.parseRange(fromDate as string | undefined, toDate as string | undefined)
    const data = await analyticsLimiter.run(() => svc.getSalesBySaleTypeWeekly(orgId, range))
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    logger.error(`[ORG SALE VERIFICATION] by-sale-type-weekly error: ${error.message}`)
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' })
  }
}

export async function getSalesBySimTypeWeekly(req: Request, res: Response): Promise<void> {
  try {
    const { orgId } = req.params
    const { fromDate, toDate } = req.query
    const range = svc.parseRange(fromDate as string | undefined, toDate as string | undefined)
    const data = await analyticsLimiter.run(() => svc.getSalesBySimTypeWeekly(orgId, range))
    res.status(200).json({ success: true, data })
  } catch (error: any) {
    logger.error(`[ORG SALE VERIFICATION] by-sim-type-weekly error: ${error.message}`)
    res.status(error.statusCode || 500).json({ success: false, message: error.message || 'Internal server error' })
  }
}
```

- [ ] **Step 2: Add the two routes** (after the `/by-week` line)

```ts
router.get('/by-sale-type-weekly', checkPermission('sale-verifications:review'), ctrl.getSalesBySaleTypeWeekly)
router.get('/by-sim-type-weekly', checkPermission('sale-verifications:review'), ctrl.getSalesBySimTypeWeekly)
```

- [ ] **Step 3: Type-check + build**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit** — *pause for approval*

```bash
git add src/controllers/dashboard/sale-verification.org.dashboard.controller.ts src/routes/dashboard/saleVerification.org.dashboard.routes.ts
git commit -m "feat(org-ventas): endpoints for weekly sale-type + SIM-type tables"
```

---

### Task 9: MCP sync — extend `org_confirmed_sales_report` (backend)

**Files:**
- Modify: `src/mcp/tools/saleVerifications.ts`

**Interfaces:**
- Adds `groupBy` values `'saleTypeWeekly'` and `'simTypeWeekly'`.

- [ ] **Step 1: Add imports** (extend the existing import block from the service)

```ts
import {
  getOrgSalesSummary,
  getSalesByMonth,
  getSalesByCity,
  getSalesByStore,
  getSalesBySupervisor,
  getSalesByPromoter,
  getSalesByPromoterDaily,
  getSalesBySaleTypeWeekly,
  getSalesBySimTypeWeekly,
  parseRange,
} from '@/services/dashboard/sale-verification.org.dashboard.service'
```

- [ ] **Step 2: Extend the enum + description**

Replace the `groupBy` enum with:
```ts
      groupBy: z
        .enum(['summary', 'month', 'city', 'store', 'supervisor', 'promoter', 'promoterDaily', 'saleTypeWeekly', 'simTypeWeekly'])
        .describe(
          'Aggregation: summary KPIs; confirmed sales by month / city / store / supervisor / promoter / promoterDaily; or WEEKLY tables saleTypeWeekly (Líneas Nuevas vs Portabilidades) and simTypeWeekly (SIM de Intercambio / $100 de Promotor / SIM de Evento / Otros SIMs)',
        ),
```
Append to the tool's top-level description string (before the closing quote): ` New: "saleTypeWeekly" and "simTypeWeekly" give week-by-week breakdowns whose totals reconcile with the weekly figures.`

- [ ] **Step 3: Add the two switch cases** (inside the `switch (groupBy)` block, before its close)

```ts
        case 'saleTypeWeekly':
          return text(await getSalesBySaleTypeWeekly(orgId, range))
        case 'simTypeWeekly':
          return text(await getSalesBySimTypeWeekly(orgId, range))
```

- [ ] **Step 4: Type-check**

Run: `cd avoqado-server && npx tsc --noEmit`
Expected: PASS (switch is exhaustive again).

- [ ] **Step 5: Commit** — *pause for approval*

```bash
git add src/mcp/tools/saleVerifications.ts
git commit -m "feat(mcp): expose weekly sale-type + SIM-type breakdowns in org sales report"
```

---

### Task 10: Frontend service — types + fetchers (dashboard)

**Files:**
- Modify: `src/services/saleVerification.org.service.ts` (add near the other `SalesBy*Row` types and fetchers)

**Interfaces:**
- Produces:
  - `interface SalesBySaleTypeWeeklyRow { name: string; byWeek: Record<string, number>; total: number }`
  - `interface SalesBySimTypeWeeklyRow { name: string; byWeek: Record<string, number>; total: number }`
  - `getSalesBySaleTypeWeekly(orgId, params?): Promise<SalesBySaleTypeWeeklyRow[]>`
  - `getSalesBySimTypeWeekly(orgId, params?): Promise<SalesBySimTypeWeeklyRow[]>`

- [ ] **Step 1: Add the types** (after `SalesBySimTypeRow`, ~L146)

```ts
export interface SalesBySaleTypeWeeklyRow {
  name: string
  byWeek: Record<string, number>
  total: number
}

export interface SalesBySimTypeWeeklyRow {
  name: string
  byWeek: Record<string, number>
  total: number
}
```

- [ ] **Step 2: Add the fetchers** (after `getSalesByWeek`, ~L270)

```ts
export async function getSalesBySaleTypeWeekly(orgId: string, params: RangeParams = {}): Promise<SalesBySaleTypeWeeklyRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-sale-type-weekly${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}

export async function getSalesBySimTypeWeekly(orgId: string, params: RangeParams = {}): Promise<SalesBySimTypeWeeklyRow[]> {
  const url = `/api/v1/dashboard/organizations/${orgId}/sale-verifications/by-sim-type-weekly${buildQuery(params)}`
  const response = await api.get(url)
  return response.data.data
}
```

- [ ] **Step 3: Type-check**

Run: `cd avoqado-web-dashboard && npx tsc --noEmit`
Expected: PASS.

(No commit yet — folded into Task 12.)

---

### Task 11: `weekBucketsAsc` helper + `sortRows` prop (dashboard)

**Files:**
- Create: `src/pages/organizations/SalesExecutive/weekBuckets.ts`
- Create: `src/pages/organizations/SalesExecutive/weekBuckets.test.ts`
- Modify: `src/pages/organizations/SalesExecutive/SalesExecutive.tsx` (`HeatmapTable`)

**Interfaces:**
- Produces: `weekBucketsAsc(keys: string[]): { key: string; label: string }[]` — sorted ascending, human label "22–28 jun" (same-month) or "29 jun–5 jul" (cross-month), Spanish.
- `HeatmapTable` gains optional prop `sortRows?: boolean` (default `true`).

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { weekBucketsAsc } from './weekBuckets'

describe('weekBucketsAsc', () => {
  it('sorts ascending and labels a same-month week as "d–d MMM"', () => {
    const out = weekBucketsAsc(['2026-W26', '2026-W25'])
    expect(out.map(b => b.key)).toEqual(['2026-W25', '2026-W26'])
    // 2026-W26 = Mon 2026-06-22 .. Sun 2026-06-28
    expect(out[1].label).toBe('22–28 jun')
  })
  it('orders across a year boundary', () => {
    const out = weekBucketsAsc(['2026-W01', '2025-W52'])
    expect(out.map(b => b.key)).toEqual(['2025-W52', '2026-W01'])
  })
  it('labels a cross-month week with both months', () => {
    // 2026-W27 = Mon 2026-06-29 .. Sun 2026-07-05
    expect(weekBucketsAsc(['2026-W27'])[0].label).toBe('29 jun–5 jul')
  })
})
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd avoqado-web-dashboard && npx vitest run src/pages/organizations/SalesExecutive/weekBuckets.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Create `weekBuckets.ts`**

```ts
import { DateTime } from 'luxon'

/**
 * Sort ISO year-week keys ("2026-W26") ascending and build a human label in
 * Spanish: "22–28 jun" (same month) or "29 jun–5 jul" (crossing months).
 * Week boundaries were already decided in venue tz on the backend, so the label
 * is computed tz-independently (UTC) from the key.
 */
export function weekBucketsAsc(keys: string[]): { key: string; label: string }[] {
  const sorted = keys.slice().sort((a, b) => a.localeCompare(b))
  return sorted.map(key => {
    const m = key.match(/^(\d{4})-W(\d{2})$/)
    if (!m) return { key, label: key }
    const start = DateTime.fromObject(
      { weekYear: Number(m[1]), weekNumber: Number(m[2]) },
      { zone: 'utc' },
    ).setLocale('es')
    const end = start.plus({ days: 6 })
    const label =
      start.month === end.month
        ? `${start.toFormat('d')}–${end.toFormat('d LLL')}`
        : `${start.toFormat('d LLL')}–${end.toFormat('d LLL')}`
    return { key, label: label.replace(/\./g, '') } // Luxon es short months can carry a dot
  })
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `cd avoqado-web-dashboard && npx vitest run src/pages/organizations/SalesExecutive/weekBuckets.test.ts`
Expected: PASS. (If a label assertion is off by the dot or an abbreviation spelling, adjust the *expected* string in the test to match Luxon's `es` output — the format logic is correct; locale spelling is the source of truth.)

- [ ] **Step 5: Add `sortRows` prop to `HeatmapTable`** in `SalesExecutive.tsx`

Change the signature:
```ts
function HeatmapTable({
  rows,
  rowLabel,
  sortBuckets,
  sortRows = true,
}: {
  rows: HeatmapRow[]
  rowLabel: string
  sortBuckets: (keys: string[]) => { key: string; label: string }[]
  sortRows?: boolean
}) {
```
Replace the `sortedRows` memo:
```ts
  // Rows by total desc (default). Pass sortRows={false} to keep the given order
  // (fixed enumerated categories, e.g. the weekly type tables).
  const sortedRows = useMemo(
    () => (sortRows ? rows.slice().sort((a, b) => b.total - a.total) : rows),
    [rows, sortRows],
  )
```

- [ ] **Step 6: Type-check**

Run: `cd avoqado-web-dashboard && npx tsc --noEmit`
Expected: PASS.

(No commit yet — folded into Task 12.)

---

### Task 12: Wire the two tables into the page (dashboard)

**Files:**
- Modify: `src/pages/organizations/SalesExecutive/SalesExecutive.tsx`

**Interfaces:**
- Consumes: `getSalesBySaleTypeWeekly`, `getSalesBySimTypeWeekly` (Task 10), `weekBucketsAsc` (Task 11), `HeatmapTable` `sortRows` (Task 11).

- [ ] **Step 1: Add imports**

Add to the service import block:
```ts
  getSalesBySaleTypeWeekly,
  getSalesBySimTypeWeekly,
```
Add near the top:
```ts
import { weekBucketsAsc } from './weekBuckets'
```

- [ ] **Step 2: Add the two queries** (next to `byWeek`, ~L132)

```ts
  const bySaleTypeWeekly = useQuery({
    queryKey: ['org', orgId, 'sales-by-sale-type-weekly'],
    queryFn: () => getSalesBySaleTypeWeekly(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
  const bySimTypeWeekly = useQuery({
    queryKey: ['org', orgId, 'sales-by-sim-type-weekly'],
    queryFn: () => getSalesBySimTypeWeekly(orgId!),
    enabled: !!orgId,
    staleTime: 60_000,
  })
```

- [ ] **Step 3: Insert the two cards** immediately AFTER the "Ventas Totales Semanales" `GlassCard` (closes ~L350) and BEFORE the "Ventas Totales por Ciudad" card

```tsx
      {/* Row 2b: weekly sale-type table */}
      <GlassCard className="p-4 overflow-hidden">
        <h2 className="text-sm font-semibold mb-3">Ventas por Tipo de Venta (semanal)</h2>
        {bySaleTypeWeekly.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (bySaleTypeWeekly.data ?? []).every(r => r.total === 0) ? (
          <EmptyChart />
        ) : (
          <HeatmapTable
            rows={(bySaleTypeWeekly.data ?? []).map(r => ({ name: r.name, byBucket: r.byWeek, total: r.total }))}
            rowLabel="Tipo de Venta"
            sortBuckets={weekBucketsAsc}
            sortRows={false}
          />
        )}
      </GlassCard>

      {/* Row 2c: weekly SIM-type table */}
      <GlassCard className="p-4 overflow-hidden">
        <h2 className="text-sm font-semibold mb-3">Ventas por Tipo de SIM (semanal)</h2>
        {bySimTypeWeekly.isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (bySimTypeWeekly.data ?? []).every(r => r.total === 0) ? (
          <EmptyChart />
        ) : (
          <HeatmapTable
            rows={(bySimTypeWeekly.data ?? []).map(r => ({ name: r.name, byBucket: r.byWeek, total: r.total }))}
            rowLabel="Tipo de SIM"
            sortBuckets={weekBucketsAsc}
            sortRows={false}
          />
        )}
      </GlassCard>
```

- [ ] **Step 4: Build + lint + run frontend unit tests**

Run: `cd avoqado-web-dashboard && npm run build && npm run lint && npx vitest run src/pages/organizations/SalesExecutive/weekBuckets.test.ts`
Expected: all PASS.

- [ ] **Step 5: Commit** — *pause for approval*

```bash
git add src/services/saleVerification.org.service.ts src/pages/organizations/SalesExecutive/
git commit -m "feat(org-ventas): weekly Tipo de Venta + Tipo de SIM tables under weekly bar"
```

---

### Task 13: Full verification + manual check

**Files:** none.

- [ ] **Step 1: Server suite green**

Run: `cd avoqado-server && npm test`
Expected: PASS (no regressions; new aggregation + reconciliation tests pass).

- [ ] **Step 2: Dashboard gates green**

Run: `cd avoqado-web-dashboard && npm run build && npm run lint && npm run test:run`
Expected: PASS.

- [ ] **Step 3: Manual smoke (dev)** — with both servers running, log in to PlayTelecom → **Ventas**. Confirm:
  - Two new tables appear directly below "Ventas Totales Semanales".
  - Tabla 1 rows = Líneas Nuevas, Portabilidades (fixed order). Tabla 2 rows = the 3 fixed (always) + "Otros SIMs" only if present.
  - Week columns ascending with readable labels ("22–28 jun"); "Total País" pinned on top; horizontal scroll works.
  - The grand Total of each table equals the sum of the "Ventas Totales Semanales" bars and the "Total aprobadas" KPI.
  - The monthly "Ventas por Tipo de SIM" chart now shows the same 4-bucket vocabulary.
  - Light + dark mode OK.

- [ ] **Step 4: Open the PR** to `develop` — *pause for approval* — description: root cause/goal, the reconciliation invariant, confirmed canonical names (Task 1), MCP update, link Asana 1216095149541827. Merge is Jose's.

---

## Self-Review

**Spec coverage:** Tabla 1 → Tasks 4,12. Tabla 2 (3 fixed + Otros) → Tasks 5,12. Weekly columns/all-weeks → Tasks 2,11. Reconciliation invariant → Tasks 4,5,6. Monthly chart regroup → Task 7. Endpoints → Task 8. MCP sync → Task 9. Frontend service/labels/sortRows/placement → Tasks 10,11,12. Canonical-name verification (Task 0 in spec) → Task 1. Tier/i18n/never-remove-fields → Global Constraints. Tests → Tasks 2–7,11; gates → Task 13. No gaps.

**Placeholder scan:** none — every code step shows full code; commands have expected output. The only deliberate "adjust expected string" notes (Tasks 6, 11) are about matching real locale/key output, with the chosen fallback specified.

**Type consistency:** `toSimBucket`/`SimBucket`/`SIM_FIXED_BUCKETS`/`SIM_OTHERS` defined Task 3, consumed Tasks 5,7,9. `toIsoWeekKey` defined Task 2, consumed Tasks 4,5. `getSalesBySaleTypeWeekly`/`getSalesBySimTypeWeekly` produced Tasks 4,5, consumed Tasks 6,8,9,10,12. `weekBucketsAsc` produced Task 11, consumed Task 12. `byWeek`→`byBucket` mapping matches `HeatmapRow` ({name,byBucket,total}). Route paths match frontend fetcher URLs (`by-sale-type-weekly`, `by-sim-type-weekly`). Consistent.
