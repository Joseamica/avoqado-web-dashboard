# Provider × Aggregator Fee Template — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A reusable fee template keyed by `(provider, aggregator)` that holds three stacked fee layers (processor / aggregator / Avoqado) and prefills the AngelPay wizard's cost + pricing steps.

**Architecture:** New additive Prisma model `ProviderAggregatorFee` + CRUD API. A config UI in the existing Aggregators page manages templates. The AngelPay wizard reads the matching template client-side and prefills `ProviderCostStructure` (processor layer) and `VenuePricingStructure` (sum of all 3 layers). The per-transaction fee calculation is NOT touched.

**Tech Stack:** Backend — Express + Prisma + TypeScript + Zod + Jest. Frontend — React 18 + TypeScript + Vite + TanStack Query + Vitest.

**Spec:** `docs/superpowers/specs/2026-05-22-provider-aggregator-fee-template-design.md`

**Repos:** Backend `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`, Frontend `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`.

**Commit policy:** This project requires explicit per-commit user permission ("nunca commites"). The "Commit" steps are checkpoints — pause and ask the user before running `git commit`.

---

## File structure

**Backend (`avoqado-server`):**
- `prisma/schema.prisma` — new `ProviderAggregatorFee` model + back-relations.
- `prisma/migrations/<ts>_provider_aggregator_fee/migration.sql` — additive create-table.
- `src/schemas/dashboard/provider-aggregator-fee.schema.ts` — Zod create/update schema.
- `src/services/superadmin/providerAggregatorFee.service.ts` — CRUD.
- `src/controllers/superadmin/providerAggregatorFee.controller.ts` — HTTP handlers.
- `src/routes/superadmin/providerAggregatorFee.routes.ts` — routes; mounted in the superadmin router.

**Frontend (`avoqado-web-dashboard`):**
- `src/services/providerAggregatorFee.service.ts` — client API.
- `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/feeTemplate.ts` — pure layer-stacking + IVA math.
- `src/pages/Superadmin/Aggregators.tsx` — add a "Tarifas por proveedor" section/dialog.
- `src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/AngelPayWizard.tsx` — Cost step prefills from the template.

---

## Phase A — Backend: model + API

### Task A1: Prisma model + migration

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma`

- [ ] **Step 1: Add the model** after the `Aggregator` model (~line 9593)

```prisma
model ProviderAggregatorFee {
  id           String          @id @default(cuid())
  providerId   String
  provider     PaymentProvider @relation(fields: [providerId], references: [id])
  aggregatorId String
  aggregator   Aggregator      @relation(fields: [aggregatorId], references: [id])

  // Three stacked layers — each {DEBIT,CREDIT,AMEX,INTERNATIONAL} decimal rates.
  processorFees  Json // cost the processor (AngelPay/Blumon) charges
  aggregatorFees Json // the aggregator's margin
  avoqadoFees    Json // Avoqado's margin

  processorIncludesTax  Boolean @default(false)
  aggregatorIncludesTax Boolean @default(false)
  avoqadoIncludesTax    Boolean @default(false)
  taxRate               Decimal @default(0.16) @db.Decimal(5, 4)

  active    Boolean  @default(true)
  notes     String?
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([providerId, aggregatorId])
  @@index([providerId])
  @@index([aggregatorId])
}
```

- [ ] **Step 2: Add back-relations**

In `model PaymentProvider`, add: `providerAggregatorFees ProviderAggregatorFee[]`
In `model Aggregator`, add: `providerAggregatorFees ProviderAggregatorFee[]`

- [ ] **Step 3: Generate and apply the migration (local DB)**

Run: `cd avoqado-server && npx prisma migrate dev --name provider_aggregator_fee`
Expected: migration created (a pure `CREATE TABLE`), applied, `prisma generate` runs.
Verify the generated `migration.sql` is only `CREATE TABLE "ProviderAggregatorFee"` + indexes — no `ALTER`/`DROP` on existing tables.

- [ ] **Step 4: Apply to the test DB**

Run: `DATABASE_URL=$(grep '^TEST_DATABASE_URL=' .env | cut -d'=' -f2- | tr -d '"') npx prisma migrate deploy`
Expected: migration applied to `av-db-25-test`.

- [ ] **Step 5: Commit** (ask user first)

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat: add ProviderAggregatorFee model"
```

### Task A2: Zod schema

**Files:**
- Create: `avoqado-server/src/schemas/dashboard/provider-aggregator-fee.schema.ts`

- [ ] **Step 1: Write the schema** — messages in Spanish (they reach users raw).

```ts
import { z } from 'zod'

const cardRates = z.object({
  DEBIT: z.number().min(0).max(1),
  CREDIT: z.number().min(0).max(1),
  AMEX: z.number().min(0).max(1),
  INTERNATIONAL: z.number().min(0).max(1),
})

export const createProviderAggregatorFeeSchema = z.object({
  providerId: z.string().min(1, 'providerId es requerido'),
  aggregatorId: z.string().min(1, 'aggregatorId es requerido'),
  processorFees: cardRates,
  aggregatorFees: cardRates,
  avoqadoFees: cardRates,
  processorIncludesTax: z.boolean().default(false),
  aggregatorIncludesTax: z.boolean().default(false),
  avoqadoIncludesTax: z.boolean().default(false),
  taxRate: z.number().min(0).max(1).default(0.16),
  active: z.boolean().default(true),
  notes: z.string().optional(),
})

export const updateProviderAggregatorFeeSchema = createProviderAggregatorFeeSchema
  .partial()
  .omit({ providerId: true, aggregatorId: true })

export type CreateProviderAggregatorFeeInput = z.infer<typeof createProviderAggregatorFeeSchema>
export type UpdateProviderAggregatorFeeInput = z.infer<typeof updateProviderAggregatorFeeSchema>
```

- [ ] **Step 2: Commit** (ask first): `git commit -m "feat: add provider-aggregator-fee schema"`

### Task A3: CRUD service

**Files:**
- Create: `avoqado-server/src/services/superadmin/providerAggregatorFee.service.ts`
- Reference pattern: `avoqado-server/src/services/superadmin/aggregator.service.ts` (same standalone-function CRUD style — `prisma`, error classes, P2002 → ConflictError).

- [ ] **Step 1: Implement standalone CRUD functions** matching the `aggregator.service.ts` style:
  - `listProviderAggregatorFees(filters?: { providerId?: string; aggregatorId?: string; active?: boolean })` → `findMany` with `include: { provider: true, aggregator: true }`.
  - `getProviderAggregatorFeeByPair(providerId, aggregatorId)` → `findUnique` on the compound unique.
  - `createProviderAggregatorFee(input: CreateProviderAggregatorFeeInput)` → `prisma.providerAggregatorFee.create`; catch Prisma `P2002` → `throw new ConflictError('Ya existe una tarifa para ese proveedor y agregador')`.
  - `updateProviderAggregatorFee(id, input: UpdateProviderAggregatorFeeInput)` → `update`.
  - `deleteProviderAggregatorFee(id)` → `delete`.
  Use the exact `prisma` import and error classes (`ConflictError`, `NotFoundError`) used by `aggregator.service.ts`.

- [ ] **Step 2: Build** — `npm run build` → passes. **Step 3: Commit** (ask first).

### Task A4: Controller + routes

**Files:**
- Create: `avoqado-server/src/controllers/superadmin/providerAggregatorFee.controller.ts`
- Create: `avoqado-server/src/routes/superadmin/providerAggregatorFee.routes.ts`
- Modify: the superadmin router that mounts `aggregator.routes.ts` — mount the new router next to it.
- Reference pattern: `aggregator.controller.ts` + `aggregator.routes.ts`.

- [ ] **Step 1: Controller** — handlers `getProviderAggregatorFees`, `getProviderAggregatorFeeByPair` (query `providerId`+`aggregatorId`), `createProviderAggregatorFee`, `updateProviderAggregatorFee`, `deleteProviderAggregatorFee`. Parse bodies with the Zod schemas via `.safeParse`; on failure `throw new BadRequestError(issues[0].message)`. Response envelope `{ success: true, data }` (match `aggregator.controller.ts`).

- [ ] **Step 2: Routes** — `GET /`, `GET /by-pair`, `POST /`, `PUT /:id`, `DELETE /:id`. Base path mirrors aggregators: `/api/v1/dashboard/superadmin/provider-aggregator-fees`. Mount the router where `aggregator.routes.ts` is mounted.

- [ ] **Step 3: Build + manual smoke** — `npm run build`; `curl` the `GET /` endpoint against the dev server → `200 { data: [] }`.

- [ ] **Step 4: Commit** (ask first): `git commit -m "feat: expose provider-aggregator-fee CRUD API"`

---

## Phase B — Frontend: client service + config UI

### Task B1: Client service

**Files:**
- Create: `avoqado-web-dashboard/src/services/providerAggregatorFee.service.ts`
- Reference: `src/services/aggregator.service.ts` (same `aggregatorAPI`-style object, `api` import, `BASE` const).

- [ ] **Step 1: Implement** — type `ProviderAggregatorFee` (mirror the Prisma model; `taxRate` arrives as string), input types, and a `providerAggregatorFeeAPI` object: `getAll(filters?)`, `getByPair(providerId, aggregatorId)`, `create(input)`, `update(id, input)`, `remove(id)`. `BASE = '/api/v1/dashboard/superadmin'`, endpoints `/provider-aggregator-fees...`.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → passes. **Step 3: Commit** (ask first).

### Task B2: Config UI in the Aggregators page

**Files:**
- Modify: `avoqado-web-dashboard/src/pages/Superadmin/Aggregators.tsx`
- Reference: the existing aggregator + venue-commission dialogs in that same file (form-dialog pattern).

- [ ] **Step 1: Add a "Tarifas por proveedor × agregador" section** to `Aggregators.tsx`: lists `providerAggregatorFeeAPI.getAll()` rows (provider name × aggregator name + the 3 layers summarized), with create/edit/delete dialogs. The form: provider select (from `paymentProviderAPI.getAllPaymentProviders`), aggregator select, and 3 layer groups (4 card-type rate inputs each, entered as % and stored as decimals — mirror the existing `baseFees` ×100 / ÷100 handling in this file) + per-layer IVA checkbox + taxRate. Superadmin screen → hardcoded Spanish.

- [ ] **Step 2: Build + lint** — `npm run build && npm run lint` → pass. **Step 3: Commit** (ask first).

---

## Phase C — Frontend: wizard prefill

### Task C1: Layer-stacking + IVA math

**Files:**
- Create: `.../angelpay-wizard/feeTemplate.ts`
- Test: `.../angelpay-wizard/__tests__/feeTemplate.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect } from 'vitest'
import { effectiveRate, computeWizardPrefill, type ProviderAggregatorFeeLike } from '../feeTemplate'

describe('feeTemplate', () => {
  it('effectiveRate adds IVA only when the layer is tax-exclusive', () => {
    expect(effectiveRate(0.015, false, 0.16)).toBeCloseTo(0.0174) // +16%
    expect(effectiveRate(0.015, true, 0.16)).toBe(0.015) // already tax-inclusive
  })

  it('computeWizardPrefill: cost = processor layer, pricing = sum of 3 effective layers', () => {
    const tpl: ProviderAggregatorFeeLike = {
      processorFees: { DEBIT: 0.015, CREDIT: 0.015, AMEX: 0.015, INTERNATIONAL: 0.015 },
      aggregatorFees: { DEBIT: 0.01, CREDIT: 0.01, AMEX: 0.01, INTERNATIONAL: 0.01 },
      avoqadoFees: { DEBIT: 0.005, CREDIT: 0.005, AMEX: 0.005, INTERNATIONAL: 0.005 },
      processorIncludesTax: false,
      aggregatorIncludesTax: true,
      avoqadoIncludesTax: true,
      taxRate: 0.16,
    }
    const { cost, pricing } = computeWizardPrefill(tpl)
    // cost = raw processor layer, with its own includesTax flag
    expect(cost.debitRate).toBe(0.015)
    expect(cost.includesTax).toBe(false)
    // pricing debit = 0.015*1.16 + 0.01 + 0.005 = 0.0324
    expect(pricing.debitRate).toBeCloseTo(0.0324)
    expect(pricing.includesTax).toBe(true)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** — `npx vitest run feeTemplate` → module not found.

- [ ] **Step 3: Implement `feeTemplate.ts`**

```ts
export type CardRates = { DEBIT: number; CREDIT: number; AMEX: number; INTERNATIONAL: number }

export interface ProviderAggregatorFeeLike {
  processorFees: CardRates
  aggregatorFees: CardRates
  avoqadoFees: CardRates
  processorIncludesTax: boolean
  aggregatorIncludesTax: boolean
  avoqadoIncludesTax: boolean
  taxRate: number
}

/** Tax-inclusive rate: base rates get IVA added; tax-inclusive rates pass through. */
export const effectiveRate = (rate: number, includesTax: boolean, taxRate: number): number =>
  includesTax ? rate : rate * (1 + taxRate)

const CARD_KEYS: (keyof CardRates)[] = ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL']

export interface WizardPrefill {
  cost: { debitRate: number; creditRate: number; amexRate: number; internationalRate: number; includesTax: boolean; taxRate: number }
  pricing: { debitRate: number; creditRate: number; amexRate: number; internationalRate: number; includesTax: boolean; taxRate: number }
}

/**
 * Cost  = the processor layer verbatim (its own includesTax).
 * Pricing = per card type, the sum of all 3 layers' effective (tax-inclusive)
 *           rates → stored tax-inclusive (includesTax: true).
 */
export function computeWizardPrefill(tpl: ProviderAggregatorFeeLike): WizardPrefill {
  const venue = {} as Record<keyof CardRates, number>
  for (const k of CARD_KEYS) {
    venue[k] =
      effectiveRate(tpl.processorFees[k], tpl.processorIncludesTax, tpl.taxRate) +
      effectiveRate(tpl.aggregatorFees[k], tpl.aggregatorIncludesTax, tpl.taxRate) +
      effectiveRate(tpl.avoqadoFees[k], tpl.avoqadoIncludesTax, tpl.taxRate)
  }
  return {
    cost: {
      debitRate: tpl.processorFees.DEBIT,
      creditRate: tpl.processorFees.CREDIT,
      amexRate: tpl.processorFees.AMEX,
      internationalRate: tpl.processorFees.INTERNATIONAL,
      includesTax: tpl.processorIncludesTax,
      taxRate: tpl.taxRate,
    },
    pricing: {
      debitRate: venue.DEBIT,
      creditRate: venue.CREDIT,
      amexRate: venue.AMEX,
      internationalRate: venue.INTERNATIONAL,
      includesTax: true,
      taxRate: tpl.taxRate,
    },
  }
}
```

- [ ] **Step 4: Run — expect PASS.** **Step 5: Commit** (ask first).

### Task C2: Wizard Cost step prefills from the template

**Files:**
- Modify: `.../angelpay-wizard/AngelPayWizard.tsx`

- [ ] **Step 1: Fetch templates** — add a `useQuery` for `providerAggregatorFeeAPI.getAll({ active: true })` (enabled when `open`). Filter to the ANGELPAY provider (look up the ANGELPAY `PaymentProvider.id` from the providers list, or filter by `provider.code === 'ANGELPAY'` if the API includes the relation).

- [ ] **Step 2: Replace the aggregator-pick handler** — in `handleAggregatorPick`, after resolving the chosen aggregator, find the `ProviderAggregatorFee` for `(ANGELPAY, aggregatorId)`. If found, call `computeWizardPrefill(template)` and dispatch `SET_COST` with the `cost` result AND `SET_PRICING` with the `pricing` result (rates + `includesTax`). Keep `aggregatorId` on `cost`. If no template, fall back to the current `Aggregator.baseFees` prefill (cost only).

- [ ] **Step 3: Build + lint** — `npm run build && npm run lint` → pass.

- [ ] **Step 4: E2E regression** — `npm run test:e2e -- angelpay-wizard` → the existing 2 tests still pass (they don't pick an aggregator → no template path).

- [ ] **Step 5: Commit** (ask first): `git commit -m "feat(angelpay-wizard): prefill cost+pricing from provider-aggregator fee template"`

---

## Phase D — Backend integration test

### Task D1: CRUD integration test

**Files:**
- Create: `avoqado-server/tests/integration/dashboard/provider-aggregator-fee.test.ts`
- Reference: `avoqado-server/tests/integration/dashboard/angelpay-full-setup.test.ts` (real-DB test harness; `beforeAll` creates fixtures, `afterAll` cleans up).

- [ ] **Step 1: Write tests** — `beforeAll`: upsert an ANGELPAY `PaymentProvider` and create a test `Aggregator`. Tests:
  - create → row exists with the 3 layer JSONs.
  - create a duplicate `(providerId, aggregatorId)` → throws `ConflictError`.
  - `getByPair` returns the row; unknown pair returns null.
  - update changes a layer; delete removes the row.
  `afterAll`: delete the test `ProviderAggregatorFee` rows + the test Aggregator (do not delete the ANGELPAY provider).

- [ ] **Step 2: Run** — `npx jest --selectProjects integration --testPathPattern='provider-aggregator-fee'` → passes.

- [ ] **Step 3: Commit** (ask first).

---

## Self-review notes

- **Spec coverage:** §5 schema → A1; §10 backend API → A2-A4; §10 client service → B1; §7 config UI → B2; §4 layer math + §6 prefill → C1-C2; §11 testing → C1 (math) + D1 (CRUD) + C2 step 4 (E2E regression). §8 safety holds: A1 is a pure `CREATE TABLE`; the wizard prefill only acts when a template exists; `transactionCost.service.ts` is never touched.
- **Type consistency:** `ProviderAggregatorFeeLike` / `CardRates` / `computeWizardPrefill` / `effectiveRate` (C1) are the names used by C2. Backend `CreateProviderAggregatorFeeInput` (A2) is used by A3/A4.
- **Open implementer lookups (flagged, not placeholders):** the exact superadmin router file that mounts `aggregator.routes.ts`; the error-class import paths (match `aggregator.service.ts`); whether `getAllMerchantAccounts`-style endpoints include the `provider` relation (for the ANGELPAY filter in C2).
- **NOT in scope (from spec §9):** per-transaction split recording, consolidating `Aggregator.baseFees`/`VenueCommission`, retroactive re-pricing, Blumon wizard.
