# Desglose por comercio + tira "¿Dónde está tu dinero?" — Entrega 1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an additive per-merchant-account card breakdown (`Cobrado · Comisión · Neto a recibir`) plus a simple "¿Dónde está tu dinero?" strip to the Sales Summary report, so a venue owner sees money split by merchant and what they paid in commissions — without breaking the existing report.

**Architecture:** Backend (`avoqado-server`) gains one new optional response field `byMerchantAccount[]`, computed only when `includeMerchantBreakdown=true` (default off → existing payload unchanged). Frontend (`avoqado-web-dashboard`) consumes it: a `MerchantBreakdownPanel` (mirrors `CardTypeBreakdownStrip`) and a `MoneyLocationStrip` composed entirely from data already in the response. The settlement mini-calendar ("cuándo cae") is **Entrega 2**, a separate plan.

**Tech Stack:** Backend: Express + TypeScript + Prisma + Jest. Frontend: React 18 + Vite + TanStack Query + Vitest + Playwright + Tailwind/Radix.

**Spec:** `avoqado-web-dashboard/docs/superpowers/specs/2026-06-04-sales-reporting-merchant-reconciliation-design.md`

---

## File Structure

### avoqado-server (backend — deploy first)
- Modify: `src/services/dashboard/sales-summary.dashboard.service.ts` — add `MerchantAccountBreakdown` type, `byMerchantAccount?` on response, `includeMerchantBreakdown?` on filters, `computeMerchantAccountBreakdown()` helper, wire into `getSalesSummary`.
- Modify: `src/controllers/dashboard/sales-summary.dashboard.controller.ts` — parse `includeMerchantBreakdown` query param.
- Test: `tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts` — add tests for the breakdown helper.
- Modify: `src/mcp/tools/sales.ts` — add `byMerchantAccount` to `daily_sales` (repo rule: MCP in sync).

### avoqado-web-dashboard (frontend — deploy after backend is live)
- Modify: `src/services/reports/salesSummary.service.ts` — add types + param.
- Create: `src/pages/Reports/MerchantBreakdownPanel.tsx` — the per-merchant table.
- Create: `src/pages/Reports/MoneyLocationStrip.tsx` — the "¿Dónde está tu dinero?" strip.
- Create: `src/pages/Reports/MerchantBreakdownPanel.test.tsx` + `MoneyLocationStrip.test.tsx`.
- Modify: `src/pages/Reports/SalesSummary.tsx` — request the breakdown + render both at line ~2250.
- Modify: `src/locales/es/reports.json` + `src/locales/en/reports.json` — new keys.

---

## PHASE A — Backend (`avoqado-server`)

> Run all backend commands from `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`.

### Task 1: Add types for the merchant breakdown

**Files:**
- Modify: `src/services/dashboard/sales-summary.dashboard.service.ts` (types block lines 100-127)

- [ ] **Step 1: Add the `MerchantAccountBreakdown` interface and response field**

In `src/services/dashboard/sales-summary.dashboard.service.ts`, immediately **after** the `SalesSummaryResponse` interface (ends at line 111), add:

```typescript
export interface MerchantAccountBreakdown {
  merchantAccountId: string
  displayName: string // "Amaena - A" / alias / provider name fallback
  provider: string // "AngelPay (Nexgo)" / "Blumon PAX"
  affiliation: string | null // angelpayAffiliation when present
  collectedOnCard: number // SUM(Payment.amount) — card only (merchantAccountId IS NOT NULL)
  platformFee: number // SUM(TransactionCost.venueChargeAmount)
  netToReceive: number // collectedOnCard - platformFee
  transactionCount: number
}
```

Then add the optional field to `SalesSummaryResponse` (after `byPeriod?: TimePeriodMetrics[]`):

```typescript
  byMerchantAccount?: MerchantAccountBreakdown[] // additive; present only when includeMerchantBreakdown=true
```

- [ ] **Step 2: Add the request flag to `SalesSummaryFilters`**

In the `SalesSummaryFilters` interface (lines 118-127), after `cardType?: CardTypeFilter`, add:

```typescript
  includeMerchantBreakdown?: boolean // additive opt-in; default off preserves existing payload
```

- [ ] **Step 3: Verify it compiles**

Run: `npx tsc --noEmit`
Expected: no new type errors in this file.

- [ ] **Step 4: Commit**

```bash
git add src/services/dashboard/sales-summary.dashboard.service.ts
git commit -m "feat(sales-summary): add MerchantAccountBreakdown types (additive)"
```

---

### Task 2: Implement `computeMerchantAccountBreakdown` (TDD)

**Files:**
- Modify: `src/services/dashboard/sales-summary.dashboard.service.ts`
- Test: `tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts`:

```typescript
import { computeMerchantAccountBreakdown } from '@/services/dashboard/sales-summary.dashboard.service'
import { prismaMock } from '@tests/__helpers__/setup'

describe('computeMerchantAccountBreakdown', () => {
  const VENUE = 'venue-amaena'
  const START = new Date('2026-05-01T00:00:00.000Z')
  const END = new Date('2026-05-31T23:59:59.999Z')

  it('groups card payments by merchant, computes net = collected - fee, sorted desc', async () => {
    // raw aggregation rows (cash excluded — merchantAccountId IS NOT NULL in SQL)
    ;(prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
      { merchantAccountId: 'ma-A', collected: 1823, fee: 65.6, txns: 5 },
      { merchantAccountId: 'ma-ext', collected: 13827, fee: 497.7, txns: 17 },
    ])
    ;(prismaMock.merchantAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 'ma-A', displayName: 'Amaena - A', alias: null, angelpayAffiliation: '7494104', displayOrder: 0, provider: { name: 'AngelPay (Nexgo)' } },
      { id: 'ma-ext', displayName: 'Amaena - Externo', alias: null, angelpayAffiliation: null, displayOrder: 2, provider: { name: 'Blumon PAX' } },
    ])

    const result = await computeMerchantAccountBreakdown(VENUE, START, END)

    expect(result).toHaveLength(2)
    // sorted by collectedOnCard desc → Externo first
    expect(result[0]).toEqual({
      merchantAccountId: 'ma-ext',
      displayName: 'Amaena - Externo',
      provider: 'Blumon PAX',
      affiliation: null,
      collectedOnCard: 13827,
      platformFee: 497.7,
      netToReceive: 13329.3,
      transactionCount: 17,
    })
    expect(result[1].merchantAccountId).toBe('ma-A')
    expect(result[1].netToReceive).toBeCloseTo(1757.4, 2)
  })

  it('returns [] when there are no card payments', async () => {
    ;(prismaMock.$queryRaw as jest.Mock).mockResolvedValue([])
    const result = await computeMerchantAccountBreakdown(VENUE, START, END)
    expect(result).toEqual([])
    expect(prismaMock.merchantAccount.findMany).not.toHaveBeenCalled()
  })

  it('falls back to alias then generic label when displayName is missing', async () => {
    ;(prismaMock.$queryRaw as jest.Mock).mockResolvedValue([
      { merchantAccountId: 'ma-x', collected: 100, fee: 4, txns: 1 },
    ])
    ;(prismaMock.merchantAccount.findMany as jest.Mock).mockResolvedValue([
      { id: 'ma-x', displayName: null, alias: 'Cuenta vieja', angelpayAffiliation: null, displayOrder: 0, provider: { name: 'AngelPay (Nexgo)' } },
    ])
    const result = await computeMerchantAccountBreakdown(VENUE, START, END)
    expect(result[0].displayName).toBe('Cuenta vieja')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm run test:unit -- tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts -t computeMerchantAccountBreakdown`
Expected: FAIL — `computeMerchantAccountBreakdown is not a function` (not exported yet).

- [ ] **Step 3: Implement the helper**

In `src/services/dashboard/sales-summary.dashboard.service.ts`, add (near the other helpers, above `getSalesSummary`). Confirm `Prisma` is imported from `@prisma/client` at the top — it already is (used by existing raw queries at line ~834).

```typescript
export async function computeMerchantAccountBreakdown(
  venueId: string,
  startDate: Date,
  endDate: Date,
): Promise<MerchantAccountBreakdown[]> {
  // Card money only: cash has merchantAccountId = NULL, so IS NOT NULL excludes it.
  // Mirrors the date bounds used by the platform-fees raw query (createdAt >= start AND <= end, status COMPLETED).
  const rows = await prisma.$queryRaw<
    Array<{ merchantAccountId: string; collected: number; fee: number; txns: number }>
  >(Prisma.sql`
    SELECT p."merchantAccountId" AS "merchantAccountId",
           COALESCE(SUM(p.amount), 0)::float AS collected,
           COALESCE(SUM(tc."venueChargeAmount"), 0)::float AS fee,
           COUNT(*)::int AS txns
    FROM "Payment" p
    LEFT JOIN "TransactionCost" tc ON tc."paymentId" = p.id
    WHERE p."venueId" = ${venueId}
      AND p."createdAt" >= ${startDate}
      AND p."createdAt" <= ${endDate}
      AND p.status = 'COMPLETED'
      AND p."merchantAccountId" IS NOT NULL
    GROUP BY p."merchantAccountId"
  `)

  if (rows.length === 0) return []

  const accounts = await prisma.merchantAccount.findMany({
    where: { id: { in: rows.map(r => r.merchantAccountId) } },
    select: {
      id: true,
      displayName: true,
      alias: true,
      angelpayAffiliation: true,
      displayOrder: true,
      provider: { select: { name: true } },
    },
  })
  const byId = new Map(accounts.map(a => [a.id, a]))

  return rows
    .map(r => {
      const a = byId.get(r.merchantAccountId)
      const collected = Number(r.collected)
      const fee = Number(r.fee)
      return {
        merchantAccountId: r.merchantAccountId,
        displayName: a?.displayName || a?.alias || 'Comercio',
        provider: a?.provider?.name ?? '',
        affiliation: a?.angelpayAffiliation ?? null,
        collectedOnCard: collected,
        platformFee: fee,
        netToReceive: collected - fee,
        transactionCount: Number(r.txns),
      }
    })
    .sort((x, y) => y.collectedOnCard - x.collectedOnCard)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run test:unit -- tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts -t computeMerchantAccountBreakdown`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard/sales-summary.dashboard.service.ts tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts
git commit -m "feat(sales-summary): computeMerchantAccountBreakdown helper + tests"
```

---

### Task 3: Wire the breakdown into `getSalesSummary` + controller param

**Files:**
- Modify: `src/services/dashboard/sales-summary.dashboard.service.ts` (`getSalesSummary`, after byPaymentMethod ~line 790; return object)
- Modify: `src/controllers/dashboard/sales-summary.dashboard.controller.ts` (lines 42-101)

- [ ] **Step 1: Compute the breakdown inside `getSalesSummary`**

In `getSalesSummary`, after the `byPaymentMethod` block closes (~line 790) and before the enriched/detailed breakdown section, add the snippet below.

**Anchor (do this first):** open the existing platform-fees raw query in this same function (Task 2 mirrors it — it has `p."createdAt" >= $2 AND p."createdAt" <= $3`). Note the two exact `Date` expressions passed as `$2` and `$3`. Pass those SAME two expressions here. Do NOT re-parse the raw `startDate`/`endDate` strings — reuse the parsed bounds so the window matches the rest of the report 1:1.

```typescript
  let byMerchantAccount: MerchantAccountBreakdown[] | undefined
  if (filters.includeMerchantBreakdown) {
    byMerchantAccount = await computeMerchantAccountBreakdown(
      venueId,
      /* the $2 Date from the platform-fees query */,
      /* the $3 Date from the platform-fees query */,
    )
  }
```

Then add `byMerchantAccount` to the returned object (find the `return { dateRange, reportType, summary, byPaymentMethod, ... }` and add the key):

```typescript
    byMerchantAccount,
```

- [ ] **Step 2: Parse the param in the controller**

In `src/controllers/dashboard/sales-summary.dashboard.controller.ts`, add `includeMerchantBreakdown` to the `req.query` destructure (line ~45):

```typescript
    const { startDate, endDate, groupBy, reportType, merchantAccountId, paymentMethod, cardType, includeMerchantBreakdown } = req.query
```

Then in the `filters` object (lines ~92-101), add:

```typescript
      includeMerchantBreakdown: includeMerchantBreakdown === 'true',
```

- [ ] **Step 3: Assert the flag gates the field (extend existing test, don't rebuild)**

Look for an existing happy-path `describe('getSalesSummary', ...)` in this file that already wires the full prisma mock set.
- **If it exists:** add two assertions to (or duplicate) that test — one call with `includeMerchantBreakdown` unset asserting `expect(result.byMerchantAccount).toBeUndefined()`, and one with `includeMerchantBreakdown: true` asserting `expect(Array.isArray(result.byMerchantAccount)).toBe(true)`. Reuse its existing arrange block verbatim; only add the flag + assertions.
- **If no such test exists:** skip this step — the helper unit test (Task 2) plus the e2e (Task 10) already cover the behavior. Do not invent a new full-mock harness just for this.

The gating code itself is a single `if (filters.includeMerchantBreakdown)`, so this is a low-risk guard, not core logic.

- [ ] **Step 4: Run tests + typecheck**

Run: `npm run test:unit -- tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 5: Commit**

```bash
git add src/services/dashboard/sales-summary.dashboard.service.ts src/controllers/dashboard/sales-summary.dashboard.controller.ts tests/unit/services/dashboard/sales-summary.dashboard.service.test.ts
git commit -m "feat(sales-summary): return byMerchantAccount when includeMerchantBreakdown=true"
```

---

### Task 4: Keep the MCP in sync — add `byMerchantAccount` to `daily_sales`

**Files:**
- Modify: `src/mcp/tools/sales.ts` (tool def lines 40-63 + the `summarizeSales` helper / response shape ~line 31)

- [ ] **Step 1: Extend the query select + response**

In `src/mcp/tools/sales.ts`, add `merchantAccountId: true` to the `payment.findMany` select, and after building `summary`, attach a per-merchant net map. Add to the returned `text({...})`:

```typescript
    // group net amount by merchant account (card only)
    const byMerchantAccount: Record<string, number> = {}
    for (const p of payments) {
      if (!p.merchantAccountId) continue
      byMerchantAccount[p.merchantAccountId] = (byMerchantAccount[p.merchantAccountId] ?? 0) + Number(p.amount)
    }
```

Then include `byMerchantAccount` in the `text({ ... })` payload. (Labels by id are enough for the MCP; the dashboard does the display labeling.)

- [ ] **Step 2: Build the MCP to verify it compiles**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add src/mcp/tools/sales.ts
git commit -m "feat(mcp): add byMerchantAccount to daily_sales (keep MCP in sync)"
```

> **Backend deploy gate:** push to `develop`, confirm demo/staging API is healthy before starting Phase B against it. Per ecosystem rule, backend ships before the dashboard consumes it.

---

## PHASE B — Frontend (`avoqado-web-dashboard`)

> Run all frontend commands from `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`.

### Task 5: Service types + request param

**Files:**
- Modify: `src/services/reports/salesSummary.service.ts` (interfaces lines 26-107; `fetchSalesSummary` 124-143)

- [ ] **Step 1: Add the breakdown type + response field + filter flag**

After the `SalesSummaryResponse` interface (ends line 94), add:

```typescript
export interface MerchantAccountBreakdown {
  merchantAccountId: string
  displayName: string
  provider: string
  affiliation: string | null
  collectedOnCard: number
  platformFee: number
  netToReceive: number
  transactionCount: number
}
```

Add to `SalesSummaryResponse` (after `byPeriod?`):

```typescript
  byMerchantAccount?: MerchantAccountBreakdown[]
```

Add to `SalesSummaryFilters` (after `cardType?`):

```typescript
  includeMerchantBreakdown?: boolean
```

- [ ] **Step 2: Send the param in `fetchSalesSummary`**

In the `params` object of `fetchSalesSummary` (lines 130-138), add:

```typescript
        ...(filters.includeMerchantBreakdown ? { includeMerchantBreakdown: 'true' } : {}),
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/services/reports/salesSummary.service.ts
git commit -m "feat(reports): salesSummary service types for byMerchantAccount"
```

---

### Task 6: `MerchantBreakdownPanel` component (TDD)

**Files:**
- Create: `src/pages/Reports/MerchantBreakdownPanel.tsx`
- Test: `src/pages/Reports/MerchantBreakdownPanel.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/Reports/MerchantBreakdownPanel.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MerchantBreakdownPanel } from './MerchantBreakdownPanel'
import type { MerchantAccountBreakdown } from '@/services/reports/salesSummary.service'

const items: MerchantAccountBreakdown[] = [
  { merchantAccountId: 'ext', displayName: 'Amaena - Externo', provider: 'Blumon PAX', affiliation: null, collectedOnCard: 13827, platformFee: 497.7, netToReceive: 13329.3, transactionCount: 17 },
  { merchantAccountId: 'a', displayName: 'Amaena - A', provider: 'AngelPay (Nexgo)', affiliation: '7494104', netToReceive: 1757.4, collectedOnCard: 1823, platformFee: 65.6, transactionCount: 5 },
]

describe('MerchantBreakdownPanel', () => {
  it('renders one row per merchant with its net to receive', () => {
    render(<MerchantBreakdownPanel items={items} formatCurrency={n => `$${n.toFixed(2)}`} />)
    expect(screen.getByText('Amaena - Externo')).toBeInTheDocument()
    expect(screen.getByText('Amaena - A')).toBeInTheDocument()
    expect(screen.getByText('$13329.30')).toBeInTheDocument()
    expect(screen.getByText('$1757.40')).toBeInTheDocument()
  })

  it('renders nothing when there are no card merchants', () => {
    const { container } = render(<MerchantBreakdownPanel items={[]} formatCurrency={n => `$${n}`} />)
    expect(container).toBeEmptyDOMElement()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Reports/MerchantBreakdownPanel.test.tsx`
Expected: FAIL — cannot find module `./MerchantBreakdownPanel`.

- [ ] **Step 3: Implement the component** (mirrors `CardTypeBreakdownStrip.tsx`)

Create `src/pages/Reports/MerchantBreakdownPanel.tsx`:

```tsx
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'
import type { MerchantAccountBreakdown } from '@/services/reports/salesSummary.service'

interface Props {
  items: MerchantAccountBreakdown[]
  formatCurrency: (n: number) => string
  className?: string
}

export function MerchantBreakdownPanel({ items, formatCurrency, className }: Props) {
  const { t } = useTranslation('reports')
  const total = useMemo(() => items.reduce((s, m) => s + m.netToReceive, 0), [items])

  if (items.length === 0) return null

  return (
    <GlassCard className={cn('p-4 sm:p-5 space-y-4 border-input', className)}>
      <header className="flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.merchantBreakdown.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('salesSummary.merchantBreakdown.description')}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {t('salesSummary.merchantBreakdown.totalNet')}
          </p>
          <p className="text-base font-semibold tabular-nums">{formatCurrency(total)}</p>
        </div>
      </header>

      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border/40 text-[10px] uppercase tracking-wider text-muted-foreground">
            <th className="py-2 pr-2 text-left font-medium">{t('salesSummary.merchantBreakdown.cols.merchant')}</th>
            <th className="py-2 px-2 text-right font-medium">{t('salesSummary.merchantBreakdown.cols.collected')}</th>
            <th className="hidden py-2 px-2 text-right font-medium md:table-cell">{t('salesSummary.merchantBreakdown.cols.commission')}</th>
            <th className="py-2 pl-2 text-right font-medium">{t('salesSummary.merchantBreakdown.cols.net')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map(m => (
            <tr key={m.merchantAccountId} className="border-b border-border/20 last:border-0">
              <td className="py-2 pr-2">
                <div className="flex flex-col">
                  <span className="font-medium">{m.displayName}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {[m.provider, m.affiliation && `${t('salesSummary.controls.merchant.affiliation')}: ${m.affiliation}`].filter(Boolean).join(' · ')}
                  </span>
                </div>
              </td>
              <td className="py-2 px-2 text-right tabular-nums">{formatCurrency(m.collectedOnCard)}</td>
              <td className="hidden py-2 px-2 text-right tabular-nums text-muted-foreground md:table-cell">
                -{formatCurrency(m.platformFee)}
              </td>
              <td className="py-2 pl-2 text-right font-medium tabular-nums">{formatCurrency(m.netToReceive)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </GlassCard>
  )
}
```

> If `@/components/ui/glass-card` export name differs, match the import used at the top of `CardTypeBreakdownStrip.tsx` (verify the exact import line there).

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/Reports/MerchantBreakdownPanel.test.tsx`
Expected: PASS (2 tests). The `useTranslation` mock returns the key as text, so assertions on currency values pass regardless of labels.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reports/MerchantBreakdownPanel.tsx src/pages/Reports/MerchantBreakdownPanel.test.tsx
git commit -m "feat(reports): MerchantBreakdownPanel component + tests"
```

---

### Task 7: `MoneyLocationStrip` component (TDD)

**Files:**
- Create: `src/pages/Reports/MoneyLocationStrip.tsx`
- Test: `src/pages/Reports/MoneyLocationStrip.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `src/pages/Reports/MoneyLocationStrip.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MoneyLocationStrip } from './MoneyLocationStrip'

describe('MoneyLocationStrip', () => {
  it('shows cash in hand, card net to receive, and commissions paid', () => {
    render(
      <MoneyLocationStrip
        cashInHand={9070}
        cardNetToReceive={18133}
        commissionsPaid={564}
        formatCurrency={n => `$${n.toFixed(2)}`}
      />,
    )
    expect(screen.getByText('$9070.00')).toBeInTheDocument() // efectivo en mano
    expect(screen.getByText('$18133.00')).toBeInTheDocument() // tarjeta neto a recibir
    expect(screen.getByText('$564.00')).toBeInTheDocument() // comisiones
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/pages/Reports/MoneyLocationStrip.test.tsx`
Expected: FAIL — cannot find module `./MoneyLocationStrip`.

- [ ] **Step 3: Implement the component**

Create `src/pages/Reports/MoneyLocationStrip.tsx`:

```tsx
import { useTranslation } from 'react-i18next'
import { Wallet, Landmark } from 'lucide-react'
import { cn } from '@/lib/utils'
import { GlassCard } from '@/components/ui/glass-card'

interface Props {
  cashInHand: number
  cardNetToReceive: number
  commissionsPaid: number
  formatCurrency: (n: number) => string
  className?: string
}

export function MoneyLocationStrip({ cashInHand, cardNetToReceive, commissionsPaid, formatCurrency, className }: Props) {
  const { t } = useTranslation('reports')
  const total = cashInHand + cardNetToReceive

  return (
    <GlassCard className={cn('p-4 sm:p-5 space-y-3 border-input', className)}>
      <h3 className="text-sm font-semibold tracking-tight">{t('salesSummary.moneyLocation.title')}</h3>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-lg border border-input p-3">
          <span className="flex items-center gap-2 text-sm">
            <Wallet className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t('salesSummary.moneyLocation.cashInHand')}
          </span>
          <span className="font-semibold tabular-nums">{formatCurrency(cashInHand)}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-input p-3">
          <span className="flex items-center gap-2 text-sm">
            <Landmark className="h-4 w-4 text-muted-foreground" aria-hidden />
            {t('salesSummary.moneyLocation.cardNetToReceive')}
          </span>
          <span className="font-semibold tabular-nums">{formatCurrency(cardNetToReceive)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        {t('salesSummary.moneyLocation.summaryLine', {
          commissions: formatCurrency(commissionsPaid),
          net: formatCurrency(total),
        })}
      </p>
    </GlassCard>
  )
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -- src/pages/Reports/MoneyLocationStrip.test.tsx`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reports/MoneyLocationStrip.tsx src/pages/Reports/MoneyLocationStrip.test.tsx
git commit -m "feat(reports): MoneyLocationStrip component + tests"
```

---

### Task 8: i18n keys (es + en)

**Files:**
- Modify: `src/locales/es/reports.json`
- Modify: `src/locales/en/reports.json`

- [ ] **Step 1: Add ES keys**

Inside the `salesSummary` object in `src/locales/es/reports.json` (sibling of `rows`, `controls`, `tooltips`), add:

```json
"merchantBreakdown": {
  "title": "Desglose por comercio",
  "description": "Dinero de tarjeta por cada cuenta. El efectivo se muestra arriba (ya en tu mano).",
  "totalNet": "Total a recibir",
  "cols": {
    "merchant": "Comercio",
    "collected": "Cobrado",
    "commission": "Comisión",
    "net": "Neto a recibir"
  }
},
"moneyLocation": {
  "title": "¿Dónde está tu dinero?",
  "cashInHand": "En tu mano (efectivo)",
  "cardNetToReceive": "Tarjeta · neto a recibir",
  "summaryLine": "Pagaste {{commissions}} de comisión · te queda {{net}}"
}
```

- [ ] **Step 2: Add EN keys** (same structure) in `src/locales/en/reports.json`:

```json
"merchantBreakdown": {
  "title": "Breakdown by merchant",
  "description": "Card money per account. Cash is shown above (already in hand).",
  "totalNet": "Total to receive",
  "cols": {
    "merchant": "Merchant",
    "collected": "Collected",
    "commission": "Commission",
    "net": "Net to receive"
  }
},
"moneyLocation": {
  "title": "Where is your money?",
  "cashInHand": "In hand (cash)",
  "cardNetToReceive": "Card · net to receive",
  "summaryLine": "You paid {{commissions}} in fees · you keep {{net}}"
}
```

- [ ] **Step 3: Lint to confirm no missing keys**

Run: `npm run lint`
Expected: no `local/no-missing-translation-keys` errors for the new keys.

- [ ] **Step 4: Commit**

```bash
git add src/locales/es/reports.json src/locales/en/reports.json
git commit -m "i18n(reports): merchantBreakdown + moneyLocation keys (es/en)"
```

---

### Task 9: Wire into `SalesSummary.tsx`

**Files:**
- Modify: `src/pages/Reports/SalesSummary.tsx` (query filters ~1038-1061; render ~2250; imports)

- [ ] **Step 1: Request the breakdown in the query filters**

Find where `apiFilters` (the object passed to `fetchSalesSummary`) is built (~line 1038). Add:

```typescript
    includeMerchantBreakdown: true,
```

This makes the summary view always request the breakdown. (Existing single-merchant filter still works: the backend returns just that merchant's row.)

- [ ] **Step 2: Import the two components + derive their props**

Add imports near the top with the other `./` imports:

```typescript
import { MerchantBreakdownPanel } from './MerchantBreakdownPanel'
import { MoneyLocationStrip } from './MoneyLocationStrip'
```

Just before the JSX return (near the other `useMemo`s, after `data` is built ~line 1106), derive the strip inputs:

```typescript
  const merchantBreakdown = apiResponse?.byMerchantAccount ?? []
  const cashInHand = useMemo(() => {
    const cash = apiResponse?.byPaymentMethodDetailed?.find(b => b.bucket === 'CASH')
    return cash ? cash.amount : 0
  }, [apiResponse])
  const cardNetToReceive = useMemo(
    () => merchantBreakdown.reduce((s, m) => s + m.netToReceive, 0),
    [merchantBreakdown],
  )
  const commissionsPaid = useMemo(
    () => merchantBreakdown.reduce((s, m) => s + m.platformFee, 0),
    [merchantBreakdown],
  )
```

- [ ] **Step 3: Render both at the insertion point (line ~2250)**

Immediately **after** the closing `)}` of the `netProfit` block (the `{selectedMetrics.includes('netProfit') && ( ... )}` ending ~line 2250) and **before** the `{isFiltered && (` order-level-metrics note, insert:

```tsx
              {merchantBreakdown.length > 0 && !isFiltered && (
                <div className="px-4 pt-4 space-y-4">
                  <MoneyLocationStrip
                    cashInHand={cashInHand}
                    cardNetToReceive={cardNetToReceive}
                    commissionsPaid={commissionsPaid}
                    formatCurrency={Currency}
                  />
                  <MerchantBreakdownPanel items={merchantBreakdown} formatCurrency={Currency} />
                </div>
              )}
```

`Currency` is already imported (line 18).

- [ ] **Step 4: Typecheck + build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 5: Commit**

```bash
git add src/pages/Reports/SalesSummary.tsx
git commit -m "feat(reports): show money strip + merchant breakdown in Sales Summary"
```

---

### Task 10: E2E happy-path + full verification

**Files:**
- Create/Modify: an e2e spec under `e2e/tests/` covering the sales-summary breakdown render (follow existing `setupApiMocks` pattern; register the catch-all first, then a specific `**/reports/sales-summary*` route returning a `byMerchantAccount` payload).

- [ ] **Step 1: Add an e2e test that mocks the response and asserts the panel renders**

Create `e2e/tests/reports/sales-summary-merchant-breakdown.spec.ts`. Register `setupApiMocks` FIRST (catch-all), then the specific sales-summary route LAST (LIFO → highest priority). Fill the venue slug/login navigation by copying an existing report or dashboard spec in `e2e/tests/` (the login + venue-route helper differs per suite — reuse what those specs already do).

```typescript
import { test, expect } from '@playwright/test'
import { setupApiMocks } from '../../fixtures/api-mocks'

test('sales summary shows money strip + merchant breakdown', async ({ page }) => {
  await setupApiMocks(page, { userRole: 'OWNER' }) // catch-all first (LIFO)

  // specific route registered AFTER → wins
  await page.route('**/api/v1/dashboard/reports/sales-summary*', route =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: {
          dateRange: { startDate: '2026-05-01', endDate: '2026-05-31' },
          reportType: 'summary',
          filtered: false,
          summary: { grossSales: 18697, items: null, serviceCosts: null, discounts: 0, netSales: 18697, deferredSales: null, taxes: 0, refunds: 0, tips: 0, platformFees: 563.3, staffCommissions: 0, commissions: 563.3, totalCollected: 27767, netProfit: 27203.7, transactionCount: 28 },
          byPaymentMethodDetailed: [{ bucket: 'CASH', amount: 9070, count: 12, percentage: 32.7, tips: 0, refunds: 0, platformFees: 0 }],
          byMerchantAccount: [
            { merchantAccountId: 'ext', displayName: 'Amaena - Externo', provider: 'Blumon PAX', affiliation: null, collectedOnCard: 13827, platformFee: 497.7, netToReceive: 13329.3, transactionCount: 17 },
            { merchantAccountId: 'a', displayName: 'Amaena - A', provider: 'AngelPay (Nexgo)', affiliation: '7494104', collectedOnCard: 1823, platformFee: 65.6, netToReceive: 1757.4, transactionCount: 5 },
          ],
        },
      }),
    }),
  )

  // Navigate to the report (reuse the login + venue-slug navigation from a sibling spec)
  await page.goto('/venues/<mock-slug>/reports/sales-summary')

  await expect(page.getByText('Amaena - Externo')).toBeVisible()
  await expect(page.getByText('Amaena - A')).toBeVisible()
  // "¿Dónde está tu dinero?" title (es) — assert by role/heading text the page renders for OWNER
})
```

Replace `<mock-slug>` with the slug `setupApiMocks` provisions (check `VENUE_ALPHA` in `e2e/fixtures/api-mocks.ts`).

- [ ] **Step 2: Run the e2e test**

Run: `npm run test:e2e -- e2e/tests/<your-spec>.spec.ts`
Expected: PASS.

- [ ] **Step 3: Full local verification (no regressions)**

Run each, expect green:
```bash
npm run build
npm run lint
npm run test:run
npm run test:e2e
```

- [ ] **Step 4: Manual check against demo/staging**
- Impersonate Amaena, open Sales Summary, pick a range covering May.
- Confirm: strip shows Efectivo en mano + Tarjeta neto a recibir + "pagaste X de comisión"; the merchant table lists Externo / B / A and the sum of `Neto a recibir` is consistent with the existing Net Profit (minus cash/tips per the model).
- Toggle light + dark; check `border-input` reads correctly in dark.
- Select a single merchant in the filter → panel collapses to that one row, page does not break.
- Old behavior intact: with the breakdown off-path (e.g., a payment-method filter active) the report renders exactly as before.

- [ ] **Step 5: Commit**

```bash
git add e2e/tests/<your-spec>.spec.ts
git commit -m "test(e2e): sales-summary merchant breakdown happy path"
```

---

## Done = Entrega 1 shipped
- `byMerchantAccount` is additive; existing report payload unchanged when the flag is off.
- Owner sees money split by merchant + commissions paid + cash clearly "in hand".
- MCP `daily_sales` exposes the same breakdown.
- Build + lint + unit + e2e green; light/dark + roles checked; no regressions.

**Entrega 2 (separate plan):** range-driven per-merchant settlement mini-calendar ("cuándo cae"), gated per-venue on the `merchantAccountId`-null check (Amaena already passed: 0 null on card).
