# Cash Out — Org-level "Comisiones" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the PlayTelecom cash-out "Comisiones" module on the **organization** dashboard (`/organizations/:orgId`) with one org-wide editable rate table + one active-days calendar + aggregated withdrawals/dispersion, backed by org-scoped endpoints and org-aware rate resolution.

**Architecture:** No schema migration — `CashOutCommissionRate`/`CashOutScheduleDay` already carry `orgId`. Backend adds **org rows** (`orgId` set, `venueId = null`) and resolves rates/active-days per venue as **venue-override-else-org** (backward-compatible with any live venue config). Frontend adds a sidebar item + `/organizations/:orgId/comisiones` route + an org-scoped page reusing the existing venue Comisiones UI.

**Tech Stack:** Backend — Express + TypeScript, Prisma/PostgreSQL, Vitest. Frontend — React 18 + Vite, TanStack Query, React Router v6, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-06-cash-out-org-level-comisiones-design.md`

## Global Constraints

- **TEST FRAMEWORK (server) — Jest, NOT vitest (overrides every `npx vitest`/`__tests__/` reference below).** avoqado-server uses **Jest** (`jest.config.js` + ts-jest, `@/` alias via moduleNameMapper). Put every new backend test in `tests/unit/services/dashboard/cash-out/<name>.test.ts` (NOT co-located `src/**/__tests__/`), written Jest-style: `jest.mock(...)` hoisted at the top of the file, `jest.fn()`, and **`@/` alias imports** (Jest resolves them; vitest does not). Copy the mock-setup pattern verbatim from the canonical existing test `tests/unit/services/dashboard/cash-out/cash-out.config.service.test.ts`. Run one file with `npx jest tests/unit/services/dashboard/cash-out/<name>.test.ts --selectProjects=unit`. Do **not** run the full suite, `npm run build`, or `npm run lint` — unrelated founder WIP in the tree may break those and is out of scope.
- **Money is PESOS (1:1)**, stored as `Decimal(10,2)`/`Decimal(12,2)`, serialized as strings. Never cents.
- **Org rows convention:** org-level config rows have `orgId = <org>` AND `venueId = null`. Venue rows have `venueId` set. Queries for org rows MUST include `venueId: null`.
- **Rate/active-day resolution (money-critical):** per venue = venue rows if any active exist, **else** the venue's org rows. Never silently pay $0 — `buildCommissionEntry` throws when no tier matches; that is intended.
- **No Prisma migration.** Do not touch `Payment`, `SaleVerification`, `Staff`, `Venue`, `Organization` (reference only).
- **Zod messages in Spanish** (shown raw to users). Shape/format only — business rules stay in `validateRateTable`.
- **Deploy order:** avoqado-server first (Tasks 1–5) → stable → avoqado-web-dashboard (Tasks 6–9).
- **Permissions:** reuse exact names `cash-out:read` / `cash-out:manage` / `cash-out:report`. Never rename API response fields.
- **Keep MCP in sync** (Task 5) — same change, not later.
- **Frontend:** all user text via `t()` with es + en; theme tokens only (no hardcoded grays); memoize arrays passed to tables; white-label paths only where relevant. No new payment tier — rides on `SERIALIZED_INVENTORY` + `cash-out:*`.
- **Gate:** every org operation asserts SERIALIZED_INVENTORY is enabled for the org (org module OR any venue module).

---

# Phase 1 — Backend (`avoqado-server`) — deploy first

### Task 1: Org-scoped config service (rate table + active-days)

**Files:**
- Modify: `src/services/dashboard/cash-out/cash-out.config.service.ts`
- Test: `tests/unit/services/dashboard/cash-out/cash-out.config.org.service.test.ts` (create)

**Interfaces:**
- Consumes: `validateRateTable`, `RateTier` from `./cash-out.domain`; `moduleService`, `MODULE_CODES`; `logAction`; `prisma`.
- Produces:
  - `assertCashOutEnabledForOrg(orgId: string): Promise<void>`
  - `listCommissionRatesForOrg(orgId: string): Promise<CashOutCommissionRate[]>`
  - `replaceCommissionRatesForOrg(orgId: string, rates: RateTier[], actor: { staffId: string }): Promise<CashOutCommissionRate[]>`
  - `listActiveDaysForOrg(orgId: string, from?: string, to?: string): Promise<string[]>`
  - `setActiveDaysForOrg(orgId: string, days: string[], actor: { staffId: string }): Promise<string[]>`

- [ ] **Step 1: Write failing tests**

Create `tests/unit/services/dashboard/cash-out/cash-out.config.org.service.test.ts`. Mock `prisma`, `moduleService`, `logAction` following the existing venue config test in the same `__tests__` dir (open it first to copy the mock setup). Cover:

```ts
// assertCashOutEnabledForOrg throws when neither org nor any venue has the module
it('throws CashOutModuleDisabledError when module disabled for org', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue(null)
  ;(prisma.venueModule.findFirst as any).mockResolvedValue(null)
  await expect(assertCashOutEnabledForOrg('org1')).rejects.toThrow(/Cash Out/)
})

// listCommissionRatesForOrg queries org rows (orgId + venueId:null + active)
it('lists only org-level active rates', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue({ id: 'm' })
  ;(prisma.cashOutCommissionRate.findMany as any).mockResolvedValue([{ id: 'r1' }])
  const rows = await listCommissionRatesForOrg('org1')
  expect(prisma.cashOutCommissionRate.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: { orgId: 'org1', venueId: null, active: true } }),
  )
  expect(rows).toEqual([{ id: 'r1' }])
})

// replaceCommissionRatesForOrg deactivates org rows then creates org rows (venueId:null)
it('replaces org rates atomically as org rows', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue({ id: 'm' })
  const tx = { cashOutCommissionRate: { updateMany: jest.fn(), createMany: jest.fn(), findMany: jest.fn().mockResolvedValue([]) } }
  ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx))
  await replaceCommissionRatesForOrg('org1', [{ saleType: 'LINEA_NUEVA', minCount: 1, maxCount: null, amount: 10 }], { staffId: 's1' })
  expect(tx.cashOutCommissionRate.updateMany).toHaveBeenCalledWith({ where: { orgId: 'org1', venueId: null, active: true }, data: { active: false } })
  expect(tx.cashOutCommissionRate.createMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: [expect.objectContaining({ orgId: 'org1', venueId: null, saleType: 'LINEA_NUEVA' })] }),
  )
})

// setActiveDaysForOrg deletes org rows then creates org rows (venueId:null)
it('replaces org active-days as org rows', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue({ id: 'm' })
  const tx = { cashOutScheduleDay: { deleteMany: jest.fn(), createMany: jest.fn() } }
  ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx))
  await setActiveDaysForOrg('org1', ['2026-07-06'], { staffId: 's1' })
  expect(tx.cashOutScheduleDay.deleteMany).toHaveBeenCalledWith({ where: { orgId: 'org1', venueId: null } })
  expect(tx.cashOutScheduleDay.createMany).toHaveBeenCalledWith(
    expect.objectContaining({ data: [expect.objectContaining({ orgId: 'org1', venueId: null })] }),
  )
})
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `cd ~/Documents/Programming/Avoqado/avoqado-server && npx vitest run tests/unit/services/dashboard/cash-out/cash-out.config.org.service.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement the org config functions**

Append to `src/services/dashboard/cash-out/cash-out.config.service.ts`:

```ts
/** Org-level isolation gate — SERIALIZED_INVENTORY enabled at org OR on any of its venues. */
export async function assertCashOutEnabledForOrg(orgId: string): Promise<void> {
  const orgMod = await prisma.organizationModule.findFirst({
    where: { organizationId: orgId, enabled: true, module: { code: MODULE_CODES.SERIALIZED_INVENTORY } },
    select: { id: true },
  })
  if (orgMod) return
  const venueMod = await prisma.venueModule.findFirst({
    where: { enabled: true, module: { code: MODULE_CODES.SERIALIZED_INVENTORY }, venue: { organizationId: orgId } },
    select: { id: true },
  })
  if (!venueMod) {
    throw new AppError(
      `El esquema Cash Out requiere el módulo de inventario serializado (SERIALIZED_INVENTORY), que no está activo en esta organización (${orgId}).`,
      403,
    )
  }
}

/** The active org-level escalated-commission rate tiers (org rows only: venueId null). */
export async function listCommissionRatesForOrg(orgId: string) {
  await assertCashOutEnabledForOrg(orgId)
  return prisma.cashOutCommissionRate.findMany({
    where: { orgId, venueId: null, active: true },
    orderBy: [{ saleType: 'asc' }, { minCount: 'asc' }],
  })
}

/** Replace the org-level escalated rate table (uniform for all venues without their own rows). */
export async function replaceCommissionRatesForOrg(orgId: string, rates: RateTier[], actor: { staffId: string }) {
  await assertCashOutEnabledForOrg(orgId)
  const errors = validateRateTable(rates)
  if (errors.length) throw new CashOutValidationError(errors)

  const created = await prisma.$transaction(async tx => {
    await tx.cashOutCommissionRate.updateMany({ where: { orgId, venueId: null, active: true }, data: { active: false } })
    await tx.cashOutCommissionRate.createMany({
      data: rates.map(r => ({
        orgId,
        venueId: null,
        saleType: r.saleType,
        minCount: r.minCount,
        maxCount: r.maxCount,
        amount: new Prisma.Decimal(r.amount),
        createdById: actor.staffId,
      })),
    })
    return tx.cashOutCommissionRate.findMany({
      where: { orgId, venueId: null, active: true },
      orderBy: [{ saleType: 'asc' }, { minCount: 'asc' }],
    })
  })

  void logAction({
    action: 'CASH_OUT_RATES_UPDATED',
    entity: 'CashOutCommissionRate',
    entityId: orgId,
    staffId: actor.staffId,
    data: { scope: 'org', orgId, tiers: rates.length },
  })
  return created
}

/** The org's active cash-out days (org rows only), as 'yyyy-MM-dd'. */
export async function listActiveDaysForOrg(orgId: string, from?: string, to?: string): Promise<string[]> {
  await assertCashOutEnabledForOrg(orgId)
  const where: Prisma.CashOutScheduleDayWhereInput = { orgId, venueId: null, active: true }
  if (from || to) {
    const day: Prisma.DateTimeFilter = {}
    if (from) day.gte = new Date(`${from}T00:00:00.000Z`)
    if (to) day.lte = new Date(`${to}T00:00:00.000Z`)
    where.day = day
  }
  const rows = await prisma.cashOutScheduleDay.findMany({ where, orderBy: { day: 'asc' } })
  return rows.map(r => r.day.toISOString().slice(0, 10))
}

/** Replace the org's active cash-out days (ADMIN day-selection, uniform). */
export async function setActiveDaysForOrg(orgId: string, days: string[], actor: { staffId: string }) {
  await assertCashOutEnabledForOrg(orgId)
  const unique = Array.from(new Set(days))
  await prisma.$transaction(async tx => {
    await tx.cashOutScheduleDay.deleteMany({ where: { orgId, venueId: null } })
    if (unique.length) {
      await tx.cashOutScheduleDay.createMany({
        data: unique.map(d => ({ orgId, venueId: null, day: new Date(`${d}T00:00:00.000Z`), active: true, createdById: actor.staffId })),
      })
    }
  })
  void logAction({
    action: 'CASH_OUT_DAYS_UPDATED',
    entity: 'CashOutScheduleDay',
    entityId: orgId,
    staffId: actor.staffId,
    data: { scope: 'org', orgId, days: unique.length },
  })
  return unique
}
```

Note: if `logAction`'s type requires `venueId`, make its `venueId` optional or pass `venueId: undefined` — confirm against `activity-log.service` signature and adjust the call, not the logger.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/unit/services/dashboard/cash-out/cash-out.config.org.service.test.ts`
Expected: PASS (all 4).

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard/cash-out/cash-out.config.service.ts tests/unit/services/dashboard/cash-out/cash-out.config.org.service.test.ts
git commit -m "feat(cash-out): org-scoped rate table + active-days config service"
```

---

### Task 2: Org-aware resolution in the ledger (venue-override-else-org)

**Files:**
- Modify: `src/services/dashboard/cash-out/cash-out.config.service.ts` (add resolvers)
- Modify: `src/services/dashboard/cash-out/cash-out.ledger.service.ts:48,51`
- Test: `tests/unit/services/dashboard/cash-out/cash-out.ledger.org-resolution.test.ts` (create)

**Interfaces:**
- Produces (in config.service):
  - `resolveActiveDaysForVenue(venueId: string): Promise<string[]>`
  - `resolveRatesForVenue(venueId: string): Promise<RateTier[]>`
- Consumed by: `materializeEntries` in the ledger.

- [ ] **Step 1: Write failing test — a venue with ONLY org rates materializes the correct tier**

Create `tests/unit/services/dashboard/cash-out/cash-out.ledger.org-resolution.test.ts`. Copy mock setup from the existing ledger test. Scenario: `cashOutCommissionRate.findMany` returns `[]` for `{ venueId }` and returns an org tier for `{ orgId, venueId: null }`; `cashOutScheduleDay.findMany` returns `[]` for venue and one day for org; venue lookup returns `{ organizationId: 'org1', timezone: 'America/Mexico_City' }`; one COMPLETED sale on that active day.

```ts
it('materializes commission from ORG rates when the venue has none', async () => {
  // venue rate rows empty, org rate rows present
  ;(prisma.cashOutCommissionRate.findMany as any).mockImplementation(({ where }: any) =>
    where.venueId === 'v1' && where.orgId === undefined
      ? Promise.resolve([]) // venue rows
      : Promise.resolve([{ saleType: 'LINEA_NUEVA', minCount: 1, maxCount: null, amount: 10 }]), // org rows
  )
  ;(prisma.cashOutScheduleDay.findMany as any).mockImplementation(({ where }: any) =>
    where.venueId === 'v1' ? Promise.resolve([]) : Promise.resolve([{ day: new Date('2026-07-06T00:00:00.000Z') }]),
  )
  ;(prisma.venue.findUnique as any).mockResolvedValue({ organizationId: 'org1', timezone: 'America/Mexico_City' })
  // ... one COMPLETED sale on 2026-07-06, no existing entries
  const res = await materializeEntries('v1')
  expect(res.created).toBe(1)
  expect(prisma.promoterCommissionEntry.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ amount: expect.anything(), tier: 1 }) }),
  )
})
```

- [ ] **Step 2: Run test, verify it FAILS** (ledger still reads only `{ venueId }` rows → `created` is 0).

Run: `npx vitest run tests/unit/services/dashboard/cash-out/cash-out.ledger.org-resolution.test.ts`
Expected: FAIL — `created` is 0.

- [ ] **Step 3: Add resolvers to config.service**

Append to `cash-out.config.service.ts`:

```ts
/** Resolve a venue's active cash-out days: venue rows if any, else its org rows. 'yyyy-MM-dd'. */
export async function resolveActiveDaysForVenue(venueId: string): Promise<string[]> {
  const venueRows = await prisma.cashOutScheduleDay.findMany({ where: { venueId, active: true }, orderBy: { day: 'asc' } })
  if (venueRows.length) return venueRows.map(r => r.day.toISOString().slice(0, 10))
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { organizationId: true } })
  if (!venue?.organizationId) return []
  const orgRows = await prisma.cashOutScheduleDay.findMany({
    where: { orgId: venue.organizationId, venueId: null, active: true },
    orderBy: { day: 'asc' },
  })
  return orgRows.map(r => r.day.toISOString().slice(0, 10))
}

/** Resolve a venue's escalated rate tiers: venue rows if any, else its org rows. */
export async function resolveRatesForVenue(venueId: string): Promise<RateTier[]> {
  const map = (rows: { saleType: string; minCount: number; maxCount: number | null; amount: unknown }[]): RateTier[] =>
    rows.map(r => ({ saleType: r.saleType as RateTier['saleType'], minCount: r.minCount, maxCount: r.maxCount, amount: Number(r.amount) }))
  const venueRows = await prisma.cashOutCommissionRate.findMany({ where: { venueId, active: true } })
  if (venueRows.length) return map(venueRows)
  const venue = await prisma.venue.findUnique({ where: { id: venueId }, select: { organizationId: true } })
  if (!venue?.organizationId) return []
  const orgRows = await prisma.cashOutCommissionRate.findMany({ where: { orgId: venue.organizationId, venueId: null, active: true } })
  return map(orgRows)
}
```

- [ ] **Step 4: Wire resolvers into `materializeEntries`**

In `cash-out.ledger.service.ts`:
- Update the import on line 20 to also pull the resolvers:
  `import { assertCashOutEnabled, resolveActiveDaysForVenue, resolveRatesForVenue } from './cash-out.config.service'`
- Replace line 48:
  `const activeDays = new Set(await resolveActiveDaysForVenue(venueId))`
- Replace lines 51–57 (the venue rate query + map) with:
  `const rates: RateTier[] = await resolveRatesForVenue(venueId)`

(Leave `getSaldo`, `reconcileClawbacks` unchanged — they operate on already-materialized entries.)

- [ ] **Step 5: Run the new test + the full cash-out suite, verify pass**

Run: `npx vitest run src/services/dashboard/cash-out`
Expected: PASS — new org-resolution test green; existing ledger/domain/config tests still green (venue rows still take precedence).

- [ ] **Step 6: Commit**

```bash
git add src/services/dashboard/cash-out/cash-out.config.service.ts src/services/dashboard/cash-out/cash-out.ledger.service.ts tests/unit/services/dashboard/cash-out/cash-out.ledger.org-resolution.test.ts
git commit -m "feat(cash-out): resolve rates/active-days venue-override-else-org in ledger"
```

---

### Task 3: Org aggregation service (withdrawals + dispersion report)

**Files:**
- Create: `src/services/dashboard/cash-out/cash-out.org.service.ts`
- Test: `tests/unit/services/dashboard/cash-out/cash-out.org.service.test.ts`

**Interfaces:**
- Consumes: `assertCashOutEnabledForOrg` (Task 1); `prisma`; `logAction`.
- Produces:
  - `listVenueIdsForOrg(orgId: string): Promise<string[]>`
  - `listWithdrawalsForOrg(orgId: string, opts?: { businessDate?: string; status?: CashOutWithdrawalStatus }): Promise<Array<CashOutWithdrawal & { promoterName: string; venueName: string }>>`
  - `generateOrgDispersionReport(orgId: string, opts: { businessDate?: string }, actor: { staffId: string }): Promise<{ orgId: string; rows: DispersionRow[]; totalNet: string; count: number }>` (reuse `DispersionRow` from `./cash-out.report.service`).

- [ ] **Step 1: Write failing tests**

```ts
// listVenueIdsForOrg returns the org's active venue ids
it('lists active venue ids for the org', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue({ id: 'm' })
  ;(prisma.venue.findMany as any).mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
  expect(await listVenueIdsForOrg('org1')).toEqual(['v1', 'v2'])
})

// generateOrgDispersionReport aggregates REQUESTED across venues and marks REPORTED
it('aggregates dispersion across the org venues and totals net', async () => {
  ;(prisma.organizationModule.findFirst as any).mockResolvedValue({ id: 'm' })
  ;(prisma.venue.findMany as any).mockResolvedValue([{ id: 'v1' }, { id: 'v2' }])
  const tx = {
    cashOutWithdrawal: {
      findMany: jest.fn().mockResolvedValue([
        { id: 'w1', folio: 'F1', staffId: 's1', clabe: '0', netAmount: { toString: () => '10', add: (x: any) => x } },
      ]),
      updateMany: jest.fn(),
    },
    staff: { findMany: jest.fn().mockResolvedValue([{ id: 's1', firstName: 'A', lastName: 'B' }]) },
  }
  ;(prisma.$transaction as any).mockImplementation(async (fn: any) => fn(tx))
  const rep = await generateOrgDispersionReport('org1', {}, { staffId: 'admin' })
  expect(tx.cashOutWithdrawal.findMany).toHaveBeenCalledWith(
    expect.objectContaining({ where: expect.objectContaining({ venueId: { in: ['v1', 'v2'] }, status: 'REQUESTED' }) }),
  )
  expect(tx.cashOutWithdrawal.updateMany).toHaveBeenCalled()
  expect(rep.count).toBe(1)
})
```

- [ ] **Step 2: Run tests, verify fail**

Run: `npx vitest run tests/unit/services/dashboard/cash-out/cash-out.org.service.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `cash-out.org.service.ts`**

```ts
/**
 * Cash Out — organization aggregation (back-office at org level).
 * Unions the per-venue withdrawals/dispersion across all venues of an org.
 * Money is PESOS, 1:1. Gated by SERIALIZED_INVENTORY at org level.
 */
import { Prisma, CashOutWithdrawalStatus } from '@prisma/client'
import prisma from '@/utils/prismaClient'
import { logAction } from '@/services/dashboard/activity-log.service'
import { assertCashOutEnabledForOrg } from './cash-out.config.service'
import type { DispersionRow } from './cash-out.report.service'

/** Active venue ids belonging to the org (gated). */
export async function listVenueIdsForOrg(orgId: string): Promise<string[]> {
  await assertCashOutEnabledForOrg(orgId)
  const venues = await prisma.venue.findMany({ where: { organizationId: orgId, active: true }, select: { id: true } })
  return venues.map(v => v.id)
}

/** Org-wide withdrawals (newest first), enriched with promoter + venue name. */
export async function listWithdrawalsForOrg(orgId: string, opts: { businessDate?: string; status?: CashOutWithdrawalStatus } = {}) {
  const venueIds = await listVenueIdsForOrg(orgId)
  if (!venueIds.length) return []
  const where: Prisma.CashOutWithdrawalWhereInput = { venueId: { in: venueIds } }
  if (opts.businessDate) where.businessDate = new Date(`${opts.businessDate}T00:00:00.000Z`)
  if (opts.status) where.status = opts.status
  const withdrawals = await prisma.cashOutWithdrawal.findMany({ where, orderBy: { createdAt: 'desc' }, take: 500 })
  const staff = await prisma.staff.findMany({
    where: { id: { in: withdrawals.map(w => w.staffId) } },
    select: { id: true, firstName: true, lastName: true },
  })
  const nameById = new Map(staff.map(s => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()]))
  const venues = await prisma.venue.findMany({ where: { id: { in: venueIds } }, select: { id: true, name: true } })
  const venueById = new Map(venues.map(v => [v.id, v.name]))
  return withdrawals.map(w => ({ ...w, promoterName: nameById.get(w.staffId) || w.staffId, venueName: venueById.get(w.venueId) || w.venueId }))
}

/** Org-wide Finanzas dispersion: aggregate REQUESTED across the org's venues and mark REPORTED. */
export async function generateOrgDispersionReport(
  orgId: string,
  opts: { businessDate?: string },
  actor: { staffId: string },
): Promise<{ orgId: string; rows: DispersionRow[]; totalNet: string; count: number }> {
  const venueIds = await listVenueIdsForOrg(orgId)
  if (!venueIds.length) return { orgId, rows: [], totalNet: '0', count: 0 }

  const out = await prisma.$transaction(async tx => {
    const where: Prisma.CashOutWithdrawalWhereInput = { venueId: { in: venueIds }, status: 'REQUESTED' }
    if (opts.businessDate) where.businessDate = new Date(`${opts.businessDate}T00:00:00.000Z`)
    const withdrawals = await tx.cashOutWithdrawal.findMany({
      where,
      select: { id: true, folio: true, staffId: true, clabe: true, netAmount: true },
      orderBy: { createdAt: 'asc' },
    })
    if (!withdrawals.length) return { rows: [] as DispersionRow[], total: new Prisma.Decimal(0) }
    const staff = await tx.staff.findMany({
      where: { id: { in: withdrawals.map(w => w.staffId) } },
      select: { id: true, firstName: true, lastName: true },
    })
    const nameById = new Map(staff.map(s => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()]))
    const rows: DispersionRow[] = withdrawals.map(w => ({
      withdrawalId: w.id,
      folio: w.folio,
      promoterId: w.staffId,
      promoterName: nameById.get(w.staffId) || w.staffId,
      clabe: w.clabe,
      netAmount: w.netAmount.toString(),
    }))
    const total = withdrawals.reduce((acc, w) => acc.add(w.netAmount), new Prisma.Decimal(0))
    await tx.cashOutWithdrawal.updateMany({ where: { id: { in: withdrawals.map(w => w.id) } }, data: { status: 'REPORTED', reportedAt: new Date() } })
    return { rows, total }
  })

  if (out.rows.length) {
    void logAction({
      action: 'CASH_OUT_REPORT_GENERATED',
      entity: 'CashOutWithdrawal',
      entityId: orgId,
      staffId: actor.staffId,
      data: { scope: 'org', orgId, count: out.rows.length, totalNet: out.total.toString() },
    })
  }
  return { orgId, rows: out.rows, totalNet: out.total.toString(), count: out.rows.length }
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/unit/services/dashboard/cash-out/cash-out.org.service.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard/cash-out/cash-out.org.service.ts tests/unit/services/dashboard/cash-out/cash-out.org.service.test.ts
git commit -m "feat(cash-out): org-level withdrawals + dispersion aggregation service"
```

---

### Task 4: Org controller handlers, routes, and org-auth verification

**Files:**
- Modify: `src/controllers/dashboard/cash-out.dashboard.controller.ts` (append org handlers)
- Create: `src/routes/dashboard/cash-out.org.routes.ts` (new org route group, `requireOrgRole` guard)
- Modify: `src/routes/dashboard.routes.ts` (mount the new router at `/organizations/:orgId/cash-out`, next to the other `/organizations/:orgId` mounts ~line 4075)
- Reuse existing Zod schemas: `replaceCommissionRatesSchema`, `setActiveDaysSchema`, `listActiveDaysSchema`, `listWithdrawalsSchema`, `generateReportSchema`.
- Test: `tests/unit/controllers/cash-out.org.controller.test.ts` (Jest, controller-unit).

**Interfaces:**
- Consumes: Task 1 config functions, Task 3 org service.
- Produces controller exports: `getOrgCommissionRates`, `putOrgCommissionRates`, `getOrgActiveDays`, `putOrgActiveDays`, `getOrgWithdrawals`, `postOrgReport`.

- [ ] **Step 1: Use the CONFIRMED org-auth pattern (do NOT use `checkPermission`).**

`checkPermission` is **venue-scoped** (resolves a venue via `:venueId` param / `x-venue-id` header / JWT, checks `StaffVenue` role) — it does NOT authorize an org-level action. The canonical org pattern lives in `src/routes/dashboard/organizationStockControl.routes.ts` (mounted at `/dashboard/organizations/:orgId`): a local `requireOrgRole(allowedRoles, msg)` middleware — SUPERADMIN bypasses; otherwise it requires an active `StaffVenue` with an allowed role in ANY venue of the target org (`prisma.staffVenue.findFirst({ where: { staffId: userId, venue: { organizationId: orgId }, role: { in: allowedRoles } } })`). **Read that file and COPY its `requireOrgRole` + its authenticateToken wiring verbatim** into the new route file (adapt roles/message only). The SERIALIZED_INVENTORY gate stays in the service (`assertCashOutEnabledForOrg`).

- [ ] **Step 2: Write failing test** (mirror the existing venue route/controller test file; assert the org handlers call the org services with `req.params.orgId` and `authContext.userId`). Example (controller-unit style):

```ts
it('putOrgCommissionRates delegates to replaceCommissionRatesForOrg with orgId + actor', async () => {
  const req: any = { params: { orgId: 'org1' }, body: { rates: [{ saleType: 'LINEA_NUEVA', minCount: 1, maxCount: null, amount: 10 }] }, authContext: { userId: 's1' } }
  const res: any = { json: jest.fn() }
  const spy = jest.spyOn(configService, 'replaceCommissionRatesForOrg').mockResolvedValue([] as any)
  await putOrgCommissionRates(req, res, jest.fn())
  expect(spy).toHaveBeenCalledWith('org1', req.body.rates, { staffId: 's1' })
})
```

- [ ] **Step 3: Run test, verify fail.**
Run: `npx jest tests/unit/controllers/cash-out.org.controller.test.ts --selectProjects=unit`. Expected: FAIL — handlers not exported.

- [ ] **Step 4: Add org controller handlers**

Append to `cash-out.dashboard.controller.ts` (import the org service at top:
`import * as orgService from '@/services/dashboard/cash-out/cash-out.org.service'`):

```ts
/** GET /dashboard/organizations/:orgId/cash-out/commission-rates */
export async function getOrgCommissionRates(req: Request, res: Response, next: NextFunction) {
  try {
    const rates = await configService.listCommissionRatesForOrg(req.params.orgId)
    res.json({ data: rates })
  } catch (error) { next(error) }
}

/** PUT /dashboard/organizations/:orgId/cash-out/commission-rates */
export async function putOrgCommissionRates(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).authContext
    const rates = await configService.replaceCommissionRatesForOrg(req.params.orgId, req.body.rates, { staffId: auth?.userId })
    res.json({ data: rates })
  } catch (error) {
    if (error instanceof CashOutValidationError) return res.status(400).json({ success: false, message: error.message, errors: error.errors })
    next(error)
  }
}

/** GET /dashboard/organizations/:orgId/cash-out/active-days?from&to */
export async function getOrgActiveDays(req: Request, res: Response, next: NextFunction) {
  try {
    const { from, to } = req.query as { from?: string; to?: string }
    const days = await configService.listActiveDaysForOrg(req.params.orgId, from, to)
    res.json({ data: days })
  } catch (error) { next(error) }
}

/** PUT /dashboard/organizations/:orgId/cash-out/active-days */
export async function putOrgActiveDays(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).authContext
    const days = await configService.setActiveDaysForOrg(req.params.orgId, req.body.days, { staffId: auth?.userId })
    res.json({ data: days })
  } catch (error) { next(error) }
}

/** GET /dashboard/organizations/:orgId/cash-out/withdrawals */
export async function getOrgWithdrawals(req: Request, res: Response, next: NextFunction) {
  try {
    const { businessDate, status } = req.query as { businessDate?: string; status?: any }
    const items = await orgService.listWithdrawalsForOrg(req.params.orgId, { businessDate, status })
    res.json({ data: items })
  } catch (error) { next(error) }
}

/** POST /dashboard/organizations/:orgId/cash-out/report — org-wide corte → Finanzas dispersion */
export async function postOrgReport(req: Request, res: Response, next: NextFunction) {
  try {
    const auth = (req as any).authContext
    const rep = await orgService.generateOrgDispersionReport(req.params.orgId, { businessDate: req.body?.businessDate }, { staffId: auth?.userId })
    res.json({ data: rep })
  } catch (error) { next(error) }
}
```

- [ ] **Step 5: Create the org route file** `src/routes/dashboard/cash-out.org.routes.ts` with `requireOrgRole` (copied from `organizationStockControl.routes.ts`) and the 6 routes. Roles `MANAGE_ROLES = [MANAGER, ADMIN, OWNER, SUPERADMIN]` for all ops (matches the venue Comisiones role set). `validateRequest(...)` still applies for body/query schemas. Sketch:

```ts
import { Router, Request, Response, NextFunction } from 'express'
import { StaffRole } from '@prisma/client'
import prisma from '@/utils/prismaClient'
import { validateRequest } from '@/middlewares/validation'
import * as ctrl from '@/controllers/dashboard/cash-out.dashboard.controller'
import { replaceCommissionRatesSchema, setActiveDaysSchema, listActiveDaysSchema, generateReportSchema, listWithdrawalsSchema } from '@/schemas/dashboard/cash-out.schema'

const router = Router({ mergeParams: true })
const MANAGE_ROLES: StaffRole[] = [StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER, StaffRole.SUPERADMIN]
const FORBIDDEN = 'No tienes permisos para gestionar comisiones de esta organización.'

// requireOrgRole: COPY verbatim from organizationStockControl.routes.ts (SUPERADMIN bypass;
// else prisma.staffVenue.findFirst({ where: { staffId: userId, venue: { organizationId: orgId }, role: { in: allowedRoles } } }))
function requireOrgRole(allowedRoles: StaffRole[], forbiddenMessage: string) { /* copied */ }

router.get('/commission-rates', requireOrgRole(MANAGE_ROLES, FORBIDDEN), ctrl.getOrgCommissionRates)
router.put('/commission-rates', requireOrgRole(MANAGE_ROLES, FORBIDDEN), validateRequest(replaceCommissionRatesSchema), ctrl.putOrgCommissionRates)
router.get('/active-days', requireOrgRole(MANAGE_ROLES, FORBIDDEN), validateRequest(listActiveDaysSchema), ctrl.getOrgActiveDays)
router.put('/active-days', requireOrgRole(MANAGE_ROLES, FORBIDDEN), validateRequest(setActiveDaysSchema), ctrl.putOrgActiveDays)
router.get('/withdrawals', requireOrgRole(MANAGE_ROLES, FORBIDDEN), validateRequest(listWithdrawalsSchema), ctrl.getOrgWithdrawals)
router.post('/report', requireOrgRole(MANAGE_ROLES, FORBIDDEN), validateRequest(generateReportSchema), ctrl.postOrgReport)

export default router
```

- [ ] **Step 6: Mount the router** in `src/routes/dashboard.routes.ts`, next to the other `/organizations/:orgId` mounts (~line 4075). Match how `organizationStockControlRoutes` applies `authenticateTokenMiddleware` (mirror the sibling exactly):

```ts
import cashOutOrgRoutes from './dashboard/cash-out.org.routes'
// …
router.use('/organizations/:orgId/cash-out', authenticateTokenMiddleware, cashOutOrgRoutes)
```

Resulting URLs: `/api/v1/dashboard/organizations/:orgId/cash-out/{commission-rates,active-days,withdrawals,report}`.

- [ ] **Step 7: Run tests + typecheck**

Run: `npx jest tests/unit/controllers/cash-out.org.controller.test.ts --selectProjects=unit && npx jest tests/unit/services/dashboard/cash-out --selectProjects=unit && npx tsc -p tsconfig.json --noEmit`
Expected: green + tsc exit 0. (No commit — leave changes uncommitted.)

---

### Task 5: MCP tool — expose org-level cash-out

**Files:**
- Modify: `src/mcp/tools/cash-out.ts`
- Test: existing MCP test file if present.

- [ ] **Step 1: Read `src/mcp/tools/cash-out.ts`** to learn its tool-registration shape and how it takes a venueId today.

- [ ] **Step 2: Add an `orgId` path** to the relevant tools (rates/active-days read + the dispersion report) so an agent can read/generate org-level config, calling the Task 1/Task 3 functions. Keep venue tools intact (never remove fields). Mirror the file's existing tool schema/validation style — Spanish descriptions consistent with the file.

- [ ] **Step 3: Typecheck + run MCP tests**

Run: `npm run build && npx vitest run src/mcp 2>/dev/null || true`
Expected: clean build; tests green if present.

- [ ] **Step 4: Commit**

```bash
git add src/mcp/tools/cash-out.ts
git commit -m "feat(cash-out): expose org-level rates/active-days/report via MCP"
```

---

# Phase 2 — Frontend (`avoqado-web-dashboard`) — deploy after server is stable

### Task 6: Frontend service — org methods

**Files:**
- Modify: `src/services/cashOut.service.ts`

**Interfaces:**
- Produces (added to `cashOutService`): `getOrgRates`, `saveOrgRates`, `getOrgActiveDays`, `saveOrgActiveDays`, `listOrgWithdrawals`, `generateOrgReport`. Reuses existing `CashOutRate`, `CashOutWithdrawal`, `DispersionReport` types.

- [ ] **Step 1: Add org base + methods** to `src/services/cashOut.service.ts`:

```ts
const ORG_BASE = (orgId: string) => `/api/v1/dashboard/organizations/${orgId}/cash-out`

// inside the cashOutService object:
  getOrgRates: async (orgId: string): Promise<CashOutRate[]> => {
    const res = await api.get(`${ORG_BASE(orgId)}/commission-rates`)
    return unwrap<CashOutRate[]>(res.data) ?? []
  },
  saveOrgRates: async (orgId: string, rates: CashOutRate[]): Promise<CashOutRate[]> => {
    const res = await api.put(`${ORG_BASE(orgId)}/commission-rates`, { rates })
    return unwrap<CashOutRate[]>(res.data) ?? []
  },
  getOrgActiveDays: async (orgId: string, from?: string, to?: string): Promise<string[]> => {
    const res = await api.get(`${ORG_BASE(orgId)}/active-days`, { params: { from, to } })
    return unwrap<string[]>(res.data) ?? []
  },
  saveOrgActiveDays: async (orgId: string, days: string[]): Promise<string[]> => {
    const res = await api.put(`${ORG_BASE(orgId)}/active-days`, { days })
    return unwrap<string[]>(res.data) ?? []
  },
  listOrgWithdrawals: async (
    orgId: string,
    params?: { status?: CashOutWithdrawalStatus; businessDate?: string },
  ): Promise<Array<CashOutWithdrawal & { venueName?: string }>> => {
    const res = await api.get(`${ORG_BASE(orgId)}/withdrawals`, { params })
    return unwrap<Array<CashOutWithdrawal & { venueName?: string }>>(res.data) ?? []
  },
  generateOrgReport: async (orgId: string, businessDate?: string): Promise<DispersionReport & { orgId: string }> => {
    const res = await api.post(`${ORG_BASE(orgId)}/report`, businessDate ? { businessDate } : {})
    return unwrap<DispersionReport & { orgId: string }>(res.data)
  },
```

- [ ] **Step 2: Typecheck**

Run: `cd ~/Documents/Programming/Avoqado/avoqado-web-dashboard && npx tsc -p tsconfig.app.json --noEmit`
Expected: clean (note: root `tsc --noEmit` is a no-op — use the project tsconfig).

- [ ] **Step 3: Commit**

```bash
git add src/services/cashOut.service.ts
git commit -m "feat(cash-out): org-level API client methods"
```

---

### Task 7: Org Comisiones page + route

**Files:**
- Create: `src/pages/playtelecom/Organization/OrgComisionesPage.tsx`
- Modify: `src/routes/lazyComponents.ts` (register `PlayTelecomOrgComisiones`)
- Modify: `src/routes/router.tsx` (add route under `/organizations/:orgId`)
- Modify: `src/locales/es/playtelecom.json`, `src/locales/en/playtelecom.json` (org-page strings if new keys needed)

**Interfaces:**
- Consumes: Task 6 org service methods; `useParams().orgId` / `useCurrentOrganization()`.
- Produces: default-exported `OrgComisionesPage`; lazy export `PlayTelecomOrgComisiones`.

- [ ] **Step 1: Create the page by adapting the venue page**

Copy `src/pages/playtelecom/Comisiones/ComisionesPage.tsx` to `src/pages/playtelecom/Organization/OrgComisionesPage.tsx` and change scope from venue → org:
- Replace `const { venueId } = useCurrentVenue()` with `const { orgId } = useParams<{ orgId: string }>()`.
- Rate table: `cashOutService.getRates(venueId)` → `cashOutService.getOrgRates(orgId!)`; `saveRates` → `saveOrgRates`. Query keys: `['cash-out-org-rates', orgId]`.
- Active days: `getActiveDays(venueId,…)` → `getOrgActiveDays(orgId!,…)`; `saveActiveDays` → `saveOrgActiveDays`. Query keys include `orgId`.
- Withdrawals list: use `cashOutService.listOrgWithdrawals(orgId!)`; render an extra **Sucursal** (`venueName`) column so back-office sees which store each withdrawal is from.
- Report button: `cashOutService.generateOrgReport(orgId!, businessDate)`.
- **Remove** any per-promoter saldo / "Retirar" controls (those stay venue/TPV). The org page is: rate table + calendar + aggregated withdrawals + "Generar reporte".
- Wrap the list/table data in `useMemo` (memoize arrays passed to any table). All strings via `t()`; theme tokens only. Reuse the header pattern from `OrgStockControlPage.tsx` (`PageTitleWithInfo`, `GlassCard`).
- `enabled: !!orgId` on all queries.

- [ ] **Step 2: Register lazy component** in `src/routes/lazyComponents.ts` (mirror the existing `PlayTelecomComisiones` entry):

```ts
export const PlayTelecomOrgComisiones = lazy(() => import('@/pages/playtelecom/Organization/OrgComisionesPage'))
```

- [ ] **Step 3: Add the route** in `src/routes/router.tsx` — import `PlayTelecomOrgComisiones` in the lazy-imports block, then add to the `/organizations/:orgId` → `OrganizationLayout` children (next to `stock-control` at ~line 568):

```tsx
{ path: 'comisiones', element: <PlayTelecomOrgComisiones /> },
```

- [ ] **Step 4: Verify in the running app**

Start the dev server (preview_start), navigate to `/organizations/<orgId>/comisiones` as an OWNER of a SERIALIZED_INVENTORY org, confirm the page loads (rate table + calendar render, no console errors). Check `preview_console_logs`.

- [ ] **Step 5: Typecheck + lint + commit**

```bash
npx tsc -p tsconfig.app.json --noEmit && npm run lint
git add src/pages/playtelecom/Organization/OrgComisionesPage.tsx src/routes/lazyComponents.ts src/routes/router.tsx src/locales/es/playtelecom.json src/locales/en/playtelecom.json
git commit -m "feat(cash-out): org-level Comisiones page + route"
```

---

### Task 8: Org sidebar item

**Files:**
- Modify: `src/pages/Organization/components/OrgSidebar.tsx`
- Modify: `src/locales/es/organization.json`, `src/locales/en/organization.json`
- Test: `src/pages/Organization/__tests__/OrgSidebar.test.tsx`

- [ ] **Step 1: Write/extend the failing test** — a white-label org renders a "Comisiones" link to `/organizations/:orgId/comisiones`. Mirror the existing OrgSidebar test setup (it already exercises the `isWhiteLabelOrg` section):

```tsx
it('shows Comisiones link for white-label orgs', () => {
  // render with allVenues that include a WHITE_LABEL_DASHBOARD-enabled venue for orgId
  expect(screen.getByRole('link', { name: /Comisiones/i })).toHaveAttribute('href', `/organizations/${orgId}/comisiones`)
})
```

- [ ] **Step 2: Run test, verify fail.**
Run: `npx vitest run src/pages/Organization/__tests__/OrgSidebar.test.tsx`
Expected: FAIL — no Comisiones link.

- [ ] **Step 3: Add the sidebar item** — in `OrgSidebar.tsx`, import `Coins` from `lucide-react`, and add to the `isWhiteLabelOrg` "Configuración Org." `items` array (after "Control de Stock" / "Ventas"):

```tsx
{
  name: t('organization:sidebar.orgComisiones', { defaultValue: 'Comisiones' }),
  href: `/organizations/${orgId}/comisiones`,
  icon: Coins,
},
```

Add `organization:sidebar.orgComisiones` to `es/organization.json` ("Comisiones") and `en/organization.json` ("Commissions").

- [ ] **Step 4: Run test, verify pass.**
Run: `npx vitest run src/pages/Organization/__tests__/OrgSidebar.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Organization/components/OrgSidebar.tsx src/locales/es/organization.json src/locales/en/organization.json src/pages/Organization/__tests__/OrgSidebar.test.tsx
git commit -m "feat(cash-out): add Comisiones item to org sidebar (white-label)"
```

---

### Task 9: E2E happy path

**Files:**
- Create: `e2e/tests/playtelecom/org-comisiones.spec.ts`
- Use: `e2e/fixtures/api-mocks.ts`

- [ ] **Step 1: Write the E2E test** — as an OWNER of a white-label org, mock the org endpoints (`/api/v1/dashboard/organizations/:orgId/cash-out/commission-rates`, `/active-days`, `/withdrawals`, `/report`) via `page.route()` (register catch-all first, specific routes last — LIFO). Assert:
  - the "Comisiones" sidebar item is visible and navigates to `/organizations/:orgId/comisiones`;
  - the rate table + calendar render from mocked data;
  - editing a rate + saving issues a PUT to `.../commission-rates`;
  - toggling an active day issues a PUT to `.../active-days`;
  - "Generar reporte" issues a POST to `.../report` and shows the returned totals.

- [ ] **Step 2: Run E2E**

Run: `npm run test:e2e -- org-comisiones`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add e2e/tests/playtelecom/org-comisiones.spec.ts
git commit -m "test(cash-out): E2E for org-level Comisiones page"
```

---

## Post-implementation (before marking the Asana task done)

- [ ] **Data audit (spec §8):** query prod for `CashOutCommissionRate` / `CashOutScheduleDay` rows with non-null `venueId`. If found, decide promote-to-org vs delete so no stray venue row overrides the uniform org rule. (Likely none.)
- [ ] Run `/full-testing` on the change (per repo feedback rule) + adversarial audit.
- [ ] Update the Asana task with a summary; leave merge/deploy to Jose (deploy server → dashboard).
- [ ] `pre-deploy` green in both repos; tested light + dark, roles OWNER + MANAGER.

## Self-Review (author check)

- **Spec coverage:** §4.1 → Tasks 6–9; §4.2 org endpoints → Tasks 1,3,4; ledger resolution → Task 2; MCP → Task 5; aggregation → Task 3; migration → Post-impl audit; no-tier/deploy order → Global Constraints. ✅
- **Type consistency:** `resolveRatesForVenue`/`resolveActiveDaysForVenue` names used identically in Task 2 config + ledger; `DispersionRow` reused from `cash-out.report.service`; org service function names match controller calls (`replaceCommissionRatesForOrg`, `listActiveDaysForOrg`, `listWithdrawalsForOrg`, `generateOrgDispersionReport`). ✅
- **Placeholders:** none — each code step shows real code; the two "read first" steps (Task 4 Step 1 org-auth, Task 5 Step 1 MCP shape) are verification gates, not code placeholders. ✅
