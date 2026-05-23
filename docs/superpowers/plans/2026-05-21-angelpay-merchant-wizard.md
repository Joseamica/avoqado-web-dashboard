# AngelPay Merchant Wizard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A guided superadmin wizard ("Agregar AngelPay") that creates a fully configured AngelPay payment account in one atomic backend transaction.

**Architecture:** A new transactional backend endpoint (`fullSetupAngelPayMerchant`) does all DB writes inline in one Prisma interactive transaction. A 9-step linear React wizard in a `FullScreenModal` collects state in a single `useReducer`, makes zero writes until the final Confirm, and calls the endpoint once. AngelPay account PINs move from encrypted to plaintext storage (separate backend migration).

**Tech Stack:** Backend — Express + Prisma + TypeScript + Zod + Jest. Frontend — React 18 + TypeScript + Vite + TanStack Query + Playwright.

**Spec:** `docs/superpowers/specs/2026-05-21-angelpay-merchant-wizard-design.md`

**Repos:**
- Backend: `/Users/amieva/Documents/Programming/Avoqado/avoqado-server`
- Frontend: `/Users/amieva/Documents/Programming/Avoqado/avoqado-web-dashboard`

**Commit policy:** This project requires explicit per-commit user permission. The "Commit" steps below are checkpoints — pause and ask the user before running `git commit`. As of this progress note, NOTHING has been committed — all changes are uncommitted working-tree edits.

---

## Implementation progress (2026-05-21)

- **Phase A — DONE & verified.** PIN plaintext lazy-migration. See the Phase A STATUS note below for the revised (single-deploy-safe) approach actually built.
- **Phase B — DONE & build-verified.** Endpoint `POST /api/v1/superadmin/merchant-accounts/full-setup-angelpay` (note: prefix is `/superadmin/`, not `/dashboard/superadmin/` — matches the Blumon full-setup precedent). Files: `src/lib/angelpayValidators.ts` (+ unit test, passing), `src/schemas/dashboard/angelpay-full-setup.schema.ts`, `src/services/superadmin/angelpayFullSetup.service.ts`, controller `fullSetupAngelPayMerchant` + route in `merchantAccount.controller.ts` / `merchantAccount.routes.ts`. **B3 idempotency:** resolved WITHOUT a dedicated table — relies on the `MerchantAccount`/`AngelPayUserAccount` unique constraints + a conditional slot guard + frontend button-disable; `idempotencyKey` is optional/traceability-only. **OUTSTANDING:** B4 integration tests (transaction rollback, P2002 conflict, replace-without-pricing) — not written; needs the project's `tests/integration/` harness.
- **Phase C — DONE & typecheck-verified.** `fullSetupAngelPayMerchant` client fn + `FullSetupAngelPayPayload`/`FullSetupAngelPayResult` types in `paymentProvider.service.ts`, added to `paymentProviderAPI`.
- **Phase D — DONE & tested.** `angelpay-wizard/wizardReducer.ts` — `AngelPayWizardState`, `initialState()`, `wizardReducer`, `isPricingRequired`. 7 vitest tests pass (`__tests__/wizardReducer.test.ts`): RESET_DOWNSTREAM on venue change, same-venue preserves downstream, replace-mode forces pricing required, non-invalidating slot change preserves typed rates.
- **Phase E — DONE & build-verified.** `angelpay-wizard/AngelPayWizard.tsx` — full 9-step wizard (Venue, Login, Merchant, Slot, Terminals, Cost, Pricing, Settlement, Summary) in one cohesive file: `FullScreenModal` shell, step indicator, live summary panel, wired to `wizardReducer` + `paymentProviderAPI.fullSetupAngelPayMerchant`. "Agregar AngelPay" button (indigo, `data-tour="angelpay-wizard-btn"`) added to the `MerchantAccounts.tsx` header. `npm run build` passes. **NOT yet browser-verified** — needs `npm run dev` click-through (project rule). Pragmatic deviation from the plan: steps live in one file instead of 9, and rate inputs take decimals directly (0.025) — both fine for v1, polish candidates.
- **Phase F — DONE & tests pass.** `e2e/tests/superadmin/angelpay-wizard.spec.ts` — 2 Playwright tests pass: full happy-path (open → venue → new login → merchant → PRIMARY slot → skip optional → confirm, asserts the captured `full-setup-angelpay` payload) and a "wizard hidden until button clicked" check.
- **Extra (post-plan, user-requested) — DONE.** AngelPay account management from the wizard: each existing-login row in the Login step has a "Gestionar" gear button that opens the existing `AngelPayAccountManageSheet` over the FullScreenModal (view data, rotate PIN, suspend, delete with email-retype confirmation). The wizard auto-resets the login selection if the selected account is deleted/suspended.

**B4 backend integration tests — DONE & passing.** `avoqado-server/tests/integration/dashboard/angelpay-full-setup.test.ts` — 4 tests pass against the real test DB: happy-path atomic create, full rollback on an intermediate failure, replace-without-pricing rejection, and existing-merchant reuse (no duplicate). Note: the test DB (`av-db-25-test`) had to be brought current with `prisma migrate deploy`.

**OUTSTANDING:** Browser click-through verification of the wizard (project rule) — recommended before shipping. Phase G (TPV live discovery) below.

---

## Phase G — TPV live discovery (DONE — frontend; needs live verification)

Built in `AngelPayWizard.tsx` step 3 (when an existing login is selected):
- **"Buscar en TPV" button** — dispatches `fetchAngelPayMerchantsFromTpv`, then polls
  the merchant list for ~30s; discovered merchants surface in the step-3 picker
  (`loginMerchants`) so the operator picks one (existing-merchant mode).
- **TPV online detection** — a NEXGO terminal with `status === 'ACTIVE'` is treated as
  reachable; the panel shows "en línea" vs "sin terminal NEXGO activa" and disables the
  button when none.
- **Fetch feedback** — `fetching` / `done` / `error` states with a message
  (success count, 30s timeout, or dispatch failure).

Build + lint + E2E pass. **NOT verified against a live TPV** — the async round-trip
needs a real NEXGO terminal online; verify manually before relying on it. Possible
refinement: use a recent `lastHeartbeat` window for a stricter "online" signal than
`status === 'ACTIVE'`.

The original notes (kept for reference):

- **"Buscar en TPV" button** on each existing login in the wizard's Login step. Calls
  `fetchAngelPayMerchantsFromTpv` (dispatches `FETCH_ANGELPAY_MERCHANTS`), then surfaces
  the discovered merchants so the operator picks one → `merchant.mode = 'existing'` →
  step 3 auto-satisfied.
- **TPV online detection** — before offering/enabling the fetch, show whether the venue
  has a NEXGO terminal online. Source: `Terminal.status` + `Terminal.lastHeartbeat`
  (terminals already carry these). Optionally driven by webhooks/heartbeat so the wizard
  reflects live state.
- **Fetch result feedback** — the fetch is async (202 + commandId, then the TPV reports
  back). The wizard must show success/error: poll the discovered-merchants endpoint, or
  receive a webhook/socket event, with a clear "descubrimiento exitoso / falló" state.
- This is async + needs a live TPV to verify — do it in a focused session.

The "Falta info" badge (login rows + details dialog) for accounts without a configured
merchant is DONE.

---

## Phase A — Backend: AngelPay PIN → plaintext

> **STATUS: IMPLEMENTED (2026-05-21).** Approach revised from the original A1-A4 below
> for **single-deploy safety** — a column drop + mandatory backfill would lose
> production PINs if both migrations applied in one `prisma migrate deploy`. As built:
> - One migration `20260522014803_angelpay_pin_plaintext` — **adds** `pin String?`,
>   **keeps** `pinEncrypted` (no drop).
> - Writers (`angelpayUserAccount.service.ts`) store plaintext `pin`, stop encrypting.
> - Readers (`terminal.tpv.controller.ts`) use **lazy fallback**:
>   `account.pin ?? decryptCredentials(account.pinEncrypted)` — old rows keep working
>   with no backfill, new rows use `pin`.
> - `sanitize` (`angelpayUserAccount.controller.ts`) strips both `pin` + `pinEncrypted`.
> - Result: a single merge deploys safely to production. No manual backfill, no data
>   loss. `pinEncrypted` lingers (unused for new writes) and is droppable later once
>   all rows have `pin`. An optional one-off backfill script can plaintext-migrate old
>   rows immediately but is not required for correctness.
>
> The A1-A4 tasks below are kept for historical context; the implemented approach
> above supersedes them.

The AngelPay account PIN was stored encrypted (`AngelPayUserAccount.pinEncrypted` JSON) and decrypted by the TPV auth path. Per spec §6.1 it becomes plaintext. It does not require a TPV/PAX deploy — the TPV already receives a plain PIN in the auth payload.

### Task A1: Prisma schema — replace `pinEncrypted` with `pin`

**Files:**
- Modify: `avoqado-server/prisma/schema.prisma` (model `AngelPayUserAccount`, ~line 3414)

- [ ] **Step 1: Edit the model**

Replace the `pinEncrypted` field:

```prisma
  // BEFORE:
  // pinEncrypted Json?
  // AFTER:
  pin String? // 6-digit AngelPay account PIN, plaintext. null = not provisioned yet (status=PENDING_PIN). Plaintext by decision — see specs/2026-05-21-angelpay-merchant-wizard-design.md §6.1. Unrelated to StaffVenue.pin.
```

- [ ] **Step 2: Create the migration with a data backfill**

Run: `cd avoqado-server && npx prisma migrate dev --create-only --name angelpay_pin_plaintext`

Edit the generated migration SQL to: (1) add `pin TEXT`, (2) leave `pinEncrypted` in place for now (dropped in A4 after the backfill script runs), so the column rename is non-destructive.

```sql
ALTER TABLE "AngelPayUserAccount" ADD COLUMN "pin" TEXT;
```

- [ ] **Step 3: Apply the migration**

Run: `npx prisma migrate dev`
Expected: migration applies, `npx prisma generate` runs, `pin` column exists.

- [ ] **Step 4: Commit** (ask user first)

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(angelpay): add plaintext pin column to AngelPayUserAccount"
```

### Task A2: Data backfill script — decrypt existing PINs

**Files:**
- Create: `avoqado-server/scripts/temp-backfill-angelpay-pin.ts` (delete after running)

- [ ] **Step 1: Write the backfill script**

```ts
import { PrismaClient } from '@prisma/client'
import { decryptCredentials } from '../src/services/superadmin/merchantAccount.service'

const prisma = new PrismaClient()

async function main() {
  const rows = await prisma.$queryRaw<Array<{ id: string; pinEncrypted: unknown }>>`
    SELECT id, "pinEncrypted" FROM "AngelPayUserAccount" WHERE "pinEncrypted" IS NOT NULL AND "pin" IS NULL
  `
  console.log(`Backfilling ${rows.length} rows`)
  for (const row of rows) {
    const plain = decryptCredentials(row.pinEncrypted as any) as string
    await prisma.$executeRaw`UPDATE "AngelPayUserAccount" SET "pin" = ${plain} WHERE id = ${row.id}`
  }
  console.log('Done')
}

main().finally(() => prisma.$disconnect())
```

- [ ] **Step 2: Run it**

Run: `cd avoqado-server && npx tsx scripts/temp-backfill-angelpay-pin.ts`
Expected: logs `Backfilling N rows` then `Done`. Verify with `SELECT count(*) FROM "AngelPayUserAccount" WHERE "pinEncrypted" IS NOT NULL AND "pin" IS NULL` → 0.

- [ ] **Step 3: Delete the script**

```bash
rm scripts/temp-backfill-angelpay-pin.ts
```

### Task A3: Update writers — stop encrypting

**Files:**
- Modify: `avoqado-server/src/services/superadmin/angelpayUserAccount.service.ts`
  (`createAngelPayUserAccount` ~line 65, `setAngelPayUserAccountPin` ~line 131, `updateAngelPayUserAccountCredentials` ~line 159)

- [ ] **Step 1: Update the failing test first**

In `avoqado-server/src/services/superadmin/__tests__/angelpayUserAccount.service.test.ts` (create if absent), assert the stored value is the raw PIN:

```ts
it('stores the AngelPay account PIN as plaintext', async () => {
  const account = await createAngelPayUserAccount({
    venueId: testVenueId, email: 'a@b.com', pin: '123456', environment: 'QA',
  })
  const row = await prisma.angelPayUserAccount.findUniqueOrThrow({ where: { id: account.id } })
  expect(row.pin).toBe('123456')
})
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `cd avoqado-server && npx jest angelpayUserAccount.service`
Expected: FAIL (`pin` is null / field is still `pinEncrypted`).

- [ ] **Step 3: Replace `encryptCredentials(pin)` with the raw `pin`**

In all three functions, replace every `pinEncrypted: encryptCredentials(input.pin)` (and `... : null`) construction with a plain `pin: input.pin ?? null`. Keep the `PIN_REGEX` 6-digit validation. The `status` logic (`pin ? ACTIVE : PENDING_PIN`) is unchanged. Remove the now-unused `encryptCredentials` import from this file.

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest angelpayUserAccount.service`
Expected: PASS.

- [ ] **Step 5: Commit** (ask user first)

```bash
git add src/services/superadmin/angelpayUserAccount.service.ts src/services/superadmin/__tests__/angelpayUserAccount.service.test.ts
git commit -m "refactor(angelpay): store account PIN as plaintext, stop encrypting"
```

### Task A4: Update readers + drop `pinEncrypted`

**Files:**
- Modify: `avoqado-server/src/controllers/tpv/terminal.tpv.controller.ts` (~lines 406-442)
- Modify: `avoqado-server/src/controllers/superadmin/angelpayUserAccount.controller.ts` (any `pinEncrypted` reference)
- Modify: `avoqado-server/prisma/schema.prisma` + new migration

- [ ] **Step 1: Update the TPV controller**

At ~lines 406 and 438, replace `account.pinEncrypted` guards and `decryptCredentials(account.pinEncrypted)` with the plain field:

```ts
// BEFORE: if (account.status === 'ACTIVE' && account.pinEncrypted) { ... pin: decryptCredentials(account.pinEncrypted) as string ... }
// AFTER:
if (account.status === 'ACTIVE' && account.pin) {
  // ... pin: account.pin ...
}
```

Apply the same to the `legacyAccount` branch (~438). Remove the `decryptCredentials` import if no longer used in this file.

- [ ] **Step 2: Update `angelpayUserAccount.controller.ts`**

Grep for `pinEncrypted` in that file; for any response shaping, ensure the PIN is never returned in API responses (it was never meant to be). If a field was being stripped, strip `pin` the same way.

- [ ] **Step 3: Drop the old column**

Run: `npx prisma migrate dev --create-only --name drop_angelpay_pinencrypted`, edit SQL to:

```sql
ALTER TABLE "AngelPayUserAccount" DROP COLUMN "pinEncrypted";
```

Run: `npx prisma migrate dev`.

- [ ] **Step 4: Build + full test run**

Run: `cd avoqado-server && npm run build && npm test`
Expected: build passes, tests pass.

- [ ] **Step 5: Commit** (ask user first)

```bash
git add -A
git commit -m "refactor(angelpay): read plaintext PIN in TPV auth, drop pinEncrypted column"
```

---

## Phase B — Backend: `fullSetupAngelPayMerchant` endpoint

One transactional endpoint that creates the login, merchant account, venue-config slot, terminals, cost, pricing and settlement. All writes inline inside one Prisma interactive transaction.

### Task B1: Shared pure validators

**Files:**
- Create: `avoqado-server/src/lib/angelpayValidators.ts`
- Test: `avoqado-server/src/lib/__tests__/angelpayValidators.test.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { isValidEmail, isValidPin, isNumericMerchantId } from '../angelpayValidators'

describe('angelpayValidators', () => {
  it('validates email', () => {
    expect(isValidEmail('a@b.com')).toBe(true)
    expect(isValidEmail('nope')).toBe(false)
  })
  it('validates 6-digit pin', () => {
    expect(isValidPin('123456')).toBe(true)
    expect(isValidPin('12345')).toBe(false)
    expect(isValidPin('12345a')).toBe(false)
  })
  it('validates numeric merchant id', () => {
    expect(isNumericMerchantId('9814275')).toBe(true)
    expect(isNumericMerchantId('98a')).toBe(false)
    expect(isNumericMerchantId('')).toBe(false)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** — `npx jest angelpayValidators` → module not found.

- [ ] **Step 3: Implement**

```ts
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PIN_REGEX = /^\d{6}$/
const NUMERIC_REGEX = /^\d+$/

export const isValidEmail = (v: string): boolean => EMAIL_REGEX.test(v)
export const isValidPin = (v: string): boolean => PIN_REGEX.test(v)
export const isNumericMerchantId = (v: string): boolean => v.length > 0 && NUMERIC_REGEX.test(v)
```

- [ ] **Step 4: Run — expect PASS.** **Step 5: Commit** (ask first): `git commit -m "feat(angelpay): add shared pure validators"`

### Task B2: Zod schema for the endpoint

**Files:**
- Create: `avoqado-server/src/schemas/dashboard/angelpay-full-setup.schema.ts`

- [ ] **Step 1: Write the schema**

All messages in Spanish (per project memory — Zod messages reach users raw). Shape mirrors spec §7.1.

```ts
import { z } from 'zod'

const rateFields = {
  debitRate: z.number().min(0).max(1),
  creditRate: z.number().min(0).max(1),
  amexRate: z.number().min(0).max(1),
  internationalRate: z.number().min(0).max(1),
  includesTax: z.boolean(),
  taxRate: z.number().min(0).max(1),
  effectiveFrom: z.string().datetime(),
}

export const fullSetupAngelPaySchema = z.object({
  idempotencyKey: z.string().uuid({ message: 'idempotencyKey inválido' }),
  venueId: z.string().min(1, 'venueId es requerido'),
  login: z.discriminatedUnion('mode', [
    z.object({ mode: z.literal('existing'), angelpayUserAccountId: z.string().min(1) }),
    z.object({
      mode: z.literal('new'),
      email: z.string().email('Correo inválido'),
      pin: z.string().regex(/^\d{6}$/, 'El PIN debe tener 6 dígitos'),
      environment: z.enum(['QA', 'PROD']),
    }),
  ]),
  merchant: z.object({
    externalMerchantId: z.string().regex(/^\d+$/, 'El ID del merchant debe ser numérico'),
    name: z.string().min(1, 'Nombre requerido'),
    affiliation: z.string().min(1, 'Afiliación requerida'),
    displayName: z.string().min(1, 'Nombre para mostrar requerido'),
  }),
  slot: z.object({
    accountType: z.enum(['PRIMARY', 'SECONDARY', 'TERTIARY']),
    mode: z.enum(['fill', 'replace']),
    replacedAccountId: z.string().optional(),
  }),
  terminalIds: z.array(z.string()).optional(),
  cost: z.object({ ...rateFields, fixedCostPerTransaction: z.number().min(0).optional(), monthlyFee: z.number().min(0).optional() }).optional(),
  pricing: z.object({ ...rateFields, fixedFeePerTransaction: z.number().min(0).optional(), monthlyServiceFee: z.number().min(0).optional() }).optional(),
  settlement: z.object({}).passthrough().optional(), // shape finalized in B4 from SettlementConfiguration fields
})
.refine(d => d.slot.mode !== 'replace' || !!d.slot.replacedAccountId, {
  message: 'replacedAccountId es requerido al reemplazar un slot', path: ['slot', 'replacedAccountId'],
})
.refine(d => d.slot.mode !== 'replace' || !!d.pricing, {
  message: 'El pricing es obligatorio al reemplazar un slot', path: ['pricing'],
})

export type FullSetupAngelPayInput = z.infer<typeof fullSetupAngelPaySchema>
```

- [ ] **Step 2: Commit** (ask first): `git commit -m "feat(angelpay): add full-setup request schema"`

### Task B3: Idempotency store

**Files:**
- Inspect first: `grep -rln "idempotenc" avoqado-server/src` — if a mechanism exists, reuse it and skip to B4.
- If none: Create migration for an `IdempotencyKey` table (`key String @id`, `responseJson Json`, `createdAt`), and `avoqado-server/src/lib/idempotency.ts` with `getCached(key)` / `storeResult(key, result)`.

- [ ] **Step 1: Decide reuse vs create** — run the grep, record the decision in a comment in `idempotency.ts` or the reused file.
- [ ] **Step 2: If creating, write a test** asserting `storeResult` then `getCached` returns the stored value and an unknown key returns null.
- [ ] **Step 3: Implement, run tests, Step 4: Commit** (ask first): `git commit -m "feat: add idempotency key store"`

### Task B4: `fullSetupAngelPayMerchant` service — the transaction

**Files:**
- Create: `avoqado-server/src/services/superadmin/angelpayFullSetup.service.ts`
- Test: `avoqado-server/src/services/superadmin/__tests__/angelpayFullSetup.service.test.ts`
- Inspect first: `SettlementConfiguration` model in `schema.prisma` and how `fullSetupBlumonMerchant` (`merchantAccount.controller.ts:1673+`, ~line 2021 for settlement) builds settlement defaults — replicate the default shape.

- [ ] **Step 1: Write failing tests**

```ts
describe('fullSetupAngelPayMerchant', () => {
  it('creates login + merchant + config slot atomically (happy path)', async () => {
    const res = await fullSetupAngelPayMerchant(validInput())
    expect(res.merchantAccount.id).toBeDefined()
    const cfg = await prisma.venuePaymentConfig.findUnique({ where: { venueId: testVenueId } })
    expect(cfg?.primaryAccountId).toBe(res.merchantAccount.id)
  })

  it('rolls back fully when an intermediate write fails', async () => {
    const before = await prisma.merchantAccount.count()
    await expect(fullSetupAngelPayMerchant(inputWithBadTerminalId())).rejects.toThrow()
    expect(await prisma.merchantAccount.count()).toBe(before) // nothing created
  })

  it('replays the same idempotencyKey without creating duplicates', async () => {
    const input = validInput()
    const first = await fullSetupAngelPayMerchant(input)
    const second = await fullSetupAngelPayMerchant(input) // same idempotencyKey
    expect(second.merchantAccount.id).toBe(first.merchantAccount.id)
    expect(await prisma.merchantAccount.count({ where: { externalMerchantId: input.merchant.externalMerchantId } })).toBe(1)
  })

  it('aborts when the slot changed under the operator (replace mode)', async () => {
    const input = replaceModeInput({ replacedAccountId: 'stale-id' })
    await expect(fullSetupAngelPayMerchant(input)).rejects.toThrow(/slot cambió/i)
  })

  it('rejects replace mode without pricing', async () => {
    await expect(fullSetupAngelPayMerchant(replaceModeInput({ pricing: undefined })))
      .rejects.toThrow(/pricing es obligatorio/i)
  })
})
```

- [ ] **Step 2: Run — expect FAIL** — `npx jest angelpayFullSetup` → module not found.

- [ ] **Step 3: Implement the service**

```ts
import { prisma } from '@/lib/prisma'
import { ConflictError, ValidationError, NotFoundError } from '@/errors' // match project's error classes
import { isNumericMerchantId } from '@/lib/angelpayValidators'
import { getCached, storeResult } from '@/lib/idempotency'
import type { FullSetupAngelPayInput } from '@/schemas/dashboard/angelpay-full-setup.schema'

export async function fullSetupAngelPayMerchant(input: FullSetupAngelPayInput, createdBy?: string) {
  const cached = await getCached(input.idempotencyKey)
  if (cached) return cached

  if (!isNumericMerchantId(input.merchant.externalMerchantId)) {
    throw new ValidationError('El ID del merchant debe ser numérico')
  }
  if (input.slot.mode === 'replace' && !input.pricing) {
    throw new ValidationError('El pricing es obligatorio al reemplazar un slot')
  }

  const angelpayProvider = await prisma.paymentProvider.findUnique({ where: { code: 'ANGELPAY' } })
  if (!angelpayProvider) throw new NotFoundError('PaymentProvider ANGELPAY no encontrado')

  const result = await prisma.$transaction(async tx => {
    // 1. Login
    let angelpayUserAccountId: string
    if (input.login.mode === 'new') {
      const login = await tx.angelPayUserAccount.create({
        data: {
          venueId: input.venueId, email: input.login.email, pin: input.login.pin,
          environment: input.login.environment, status: 'ACTIVE',
          statusChangedAt: new Date(), statusChangedBy: createdBy ?? null, createdBy: createdBy ?? null,
        },
      })
      angelpayUserAccountId = login.id
    } else {
      const login = await tx.angelPayUserAccount.findUnique({ where: { id: input.login.angelpayUserAccountId } })
      if (!login) throw new NotFoundError('Cuenta AngelPay no encontrada')
      if (login.status !== 'ACTIVE') throw new ValidationError('La cuenta AngelPay no está activa')
      if (login.lastValidationErr) throw new ValidationError('La cuenta AngelPay tiene un error de validación pendiente')
      angelpayUserAccountId = login.id
    }

    // 2. Merchant account
    const merchantAccount = await tx.merchantAccount.create({
      data: {
        providerId: angelpayProvider.id,
        externalMerchantId: input.merchant.externalMerchantId,
        displayName: input.merchant.displayName,
        angelpayMerchantName: input.merchant.name,
        angelpayAffiliation: input.merchant.affiliation,
        angelpayUserAccountId,
        active: true,
        credentialsEncrypted: {}, // placeholder; AngelPay auth lives on the login
      },
    })

    // 3. Venue payment config slot
    const slotField = `${input.slot.accountType.toLowerCase()}AccountId` as
      'primaryAccountId' | 'secondaryAccountId' | 'tertiaryAccountId'
    const existingCfg = await tx.venuePaymentConfig.findUnique({ where: { venueId: input.venueId } })
    if (!existingCfg) {
      await tx.venuePaymentConfig.create({
        data: { venueId: input.venueId, primaryAccountId: merchantAccount.id },
      })
    } else {
      if (input.slot.mode === 'replace') {
        // conditional guard: the slot must still hold the expected account
        if ((existingCfg as any)[slotField] !== input.slot.replacedAccountId) {
          throw new ConflictError('El slot cambió, reintenta')
        }
      }
      await tx.venuePaymentConfig.update({
        where: { venueId: input.venueId },
        data: { [slotField]: merchantAccount.id },
      })
    }

    // 4. Terminals (assign to merchant account — replicate the assignment pattern from
    //    merchantAccount.service.ts ~line 1533; assign each terminalId to merchantAccount.id)
    if (input.terminalIds?.length) {
      for (const terminalId of new Set(input.terminalIds)) {
        await tx.terminal.update({ where: { id: terminalId }, data: { /* merchant-account link field */ } })
      }
    }

    // 5. Cost structure
    if (input.cost) {
      await tx.providerCostStructure.create({
        data: { providerId: angelpayProvider.id, merchantAccountId: merchantAccount.id, ...mapCost(input.cost) },
      })
    }

    // 6. Pricing — deactivate any active structure for this venue+accountType first
    if (input.pricing) {
      await tx.venuePricingStructure.updateMany({
        where: { venueId: input.venueId, accountType: input.slot.accountType, active: true },
        data: { active: false },
      })
      await tx.venuePricingStructure.create({
        data: { venueId: input.venueId, accountType: input.slot.accountType, ...mapPricing(input.pricing) },
      })
    }

    // 7. Settlement
    if (input.settlement) {
      await tx.settlementConfiguration.create({
        data: { merchantAccountId: merchantAccount.id, ...mapSettlement(input.settlement) },
      })
    }

    return { merchantAccount, angelpayUserAccountId }
  }, { timeout: 10_000 })

  await storeResult(input.idempotencyKey, result)
  return result
}
```

Implementer notes embedded in the task:
- `mapCost` / `mapPricing` / `mapSettlement` are small local pure functions converting the request shape to the Prisma `create` data — define them in this file.
- The Terminal→MerchantAccount link field name: confirm by reading `merchantAccount.service.ts` ~line 1533 (the existing terminal-assignment code) and the `Terminal` model. Use the exact field there.
- `SettlementConfiguration` defaults: read how `fullSetupBlumonMerchant` builds them (`merchantAccount.controller.ts` ~line 2021) and mirror.
- Use the project's actual error classes / import paths (`grep "class ConflictError" avoqado-server/src`).

- [ ] **Step 4: Run tests — expect PASS.** Iterate until green.
- [ ] **Step 5: Commit** (ask first): `git commit -m "feat(angelpay): add fullSetupAngelPayMerchant transactional service"`

### Task B5: Controller + route

**Files:**
- Modify: `avoqado-server/src/controllers/superadmin/merchantAccount.controller.ts` (add `fullSetupAngelPayMerchant` controller next to `fullSetupBlumonMerchant`)
- Modify: `avoqado-server/src/routes/superadmin/merchantAccount.routes.ts`

- [ ] **Step 1: Controller** — parse `req.body` with `fullSetupAngelPaySchema`, call the service with `req.user?.id` as `createdBy`, return `201` + result. Follow the error-handling pattern of the surrounding controllers (`next(err)`).

- [ ] **Step 2: Route** — `router.post('/merchant-accounts/full-setup-angelpay', fullSetupAngelPayMerchant)` next to the Blumon full-setup route. Confirm the mounted prefix yields `/api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay`.

- [ ] **Step 3: Build** — `npm run build` → passes.

- [ ] **Step 4: Manual smoke** — `curl` the endpoint with a valid body against the dev server; expect `201`.

- [ ] **Step 5: Commit** (ask first): `git commit -m "feat(angelpay): expose full-setup-angelpay endpoint"`

---

## Phase C — Frontend: service client

### Task C1: `fullSetupAngelPayMerchant` client function

**Files:**
- Modify: `avoqado-web-dashboard/src/services/paymentProvider.service.ts` (add the function + add to the `paymentProviderAPI` export object at the bottom)

- [ ] **Step 1: Add the function**

```ts
export interface FullSetupAngelPayPayload {
  idempotencyKey: string
  venueId: string
  login: { mode: 'existing'; angelpayUserAccountId: string }
       | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant: { externalMerchantId: string; name: string; affiliation: string; displayName: string }
  slot: { accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'; mode: 'fill' | 'replace'; replacedAccountId?: string }
  terminalIds?: string[]
  cost?: Record<string, number | boolean | string>
  pricing?: Record<string, number | boolean | string>
  settlement?: Record<string, unknown>
}

export async function fullSetupAngelPayMerchant(payload: FullSetupAngelPayPayload) {
  const response = await api.post('/api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay', payload)
  return response.data.data
}
```

Add `fullSetupAngelPayMerchant` to the `paymentProviderAPI` object.

- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → passes. **Step 3: Commit** (ask first).

---

## Phase D — Frontend: wizard reducer

### Task D1: Reducer + state model

**Files:**
- Create: `avoqado-web-dashboard/src/pages/Superadmin/components/merchant-accounts/angelpay-wizard/wizardReducer.ts`
- Test: `.../angelpay-wizard/__tests__/wizardReducer.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
import { wizardReducer, initialState } from '../wizardReducer'

describe('wizardReducer', () => {
  it('RESET_DOWNSTREAM clears everything below venue when venue changes', () => {
    let s = wizardReducer(initialState(), { type: 'SET_MERCHANT', merchant: { externalMerchantId: '123', name: 'X', affiliation: 'A', displayName: 'X', idConfirmed: true } })
    s = wizardReducer(s, { type: 'SET_VENUE', venue: { id: 'v2', name: 'V2', slug: 'v2' } })
    expect(s.merchant.externalMerchantId).toBe('')   // downstream reset
  })

  it('switching slot to replace mode makes pricing required', () => {
    let s = wizardReducer(initialState(), { type: 'SET_SLOT', slot: { accountType: 'PRIMARY', mode: 'replace', replacedAccountId: 'acc1' } })
    expect(s.pricing.skipped).toBe(false)            // cannot skip pricing in replace mode
  })

  it('non-invalidating slot change keeps typed pricing rates', () => {
    let s = wizardReducer(initialState(), { type: 'SET_PRICING', pricing: { skipped: false, debitRate: 0.02 } as any })
    s = wizardReducer(s, { type: 'SET_SLOT', slot: { accountType: 'SECONDARY', mode: 'fill' } })
    expect((s.pricing as any).debitRate).toBe(0.02)  // rates preserved
  })
})
```

- [ ] **Step 2: Run — expect FAIL.** `npx vitest wizardReducer` (or the project's test runner).

- [ ] **Step 3: Implement** `wizardReducer.ts` with the `AngelPayWizardState` from spec §6, an `initialState()` factory (generates `idempotencyKey` via `crypto.randomUUID()`), and action handlers: `SET_VENUE` (→ `RESET_DOWNSTREAM`), `SET_LOGIN`, `SET_MERCHANT`, `SET_SLOT` (when `mode==='replace'` force `pricing.skipped=false`), `SET_TERMINALS`, `SET_COST`, `SET_PRICING`, `SET_SETTLEMENT`. Slot changes must NOT clear typed rate fields.

- [ ] **Step 4: Run — expect PASS.** **Step 5: Commit** (ask first).

---

## Phase E — Frontend: wizard UI

### Task E1: Step components

**Files (create, one per step):** under `.../angelpay-wizard/steps/` — `VenueStep.tsx`, `LoginStep.tsx`, `MerchantStep.tsx`, `SlotStep.tsx`, `TerminalsStep.tsx`, `CostStep.tsx`, `PricingStep.tsx`, `SettlementStep.tsx`, `SummaryStep.tsx`.

Each step is a controlled component: receives the relevant slice of wizard state + a dispatch callback + the derived venue context, renders the fields, and exposes a `validate()` result the wizard reads before allowing "Siguiente".

- [ ] **Step 1: Build each step** following the existing `wizard-steps/` components (`CostStructureStep`, `VenuePricingStep`, `TerminalStep`, `SettlementStep`) for field layout and the `FullScreenModal` form-section pattern from `docs/guides` / `ProductWizardDialog`. Read those files first; reuse their field sub-components where possible. Key per-step rules from spec §5:
  - `VenueStep`: searchable single-select; on select, the parent loads venue context.
  - `LoginStep`: existing logins selectable only when `status==='ACTIVE' && !lastValidationErr`; "nueva" requires email + 6-digit PIN + environment. Reuse `AngelPayConnectDialog` validation.
  - `MerchantStep`: numeric `externalMerchantId`; require id confirmation; show affiliation + name for cross-check. `data-tour` attributes on each field.
  - `SlotStep`: show slot occupancy; allow fill or replace; replace sets `slot.mode='replace'` + `replacedAccountId`.
  - `CostStep`/`PricingStep`/`SettlementStep`: clearable number inputs (project rule); `PricingStep` shows the cost side-by-side; settlement prefilled with defaults.
- [ ] **Step 2: Typecheck** — `npx tsc --noEmit` → passes. **Step 3: Commit** (ask first).

### Task E2: Live summary panel

**Files:** Create `.../angelpay-wizard/SummaryPanel.tsx`

- [ ] **Step 1: Build** a read-only panel that renders the full wizard state (venue, login, merchant, slot, terminals, cost, pricing, settlement) with "pendiente" badges for skipped optional steps. **Step 2: Typecheck. Step 3: Commit** (ask first).

### Task E3: Wizard shell

**Files:** Create `.../angelpay-wizard/AngelPayWizard.tsx`; export from `merchant-accounts/index.ts`.

- [ ] **Step 1: Build** the `FullScreenModal` two-column shell: left = current step, right = `SummaryPanel`. Holds the `useReducer`, step index, "Atrás"/"Siguiente" (gated on the step's `validate()`), and on the Summary step a "Confirmar" button. Confirm builds the `FullSetupAngelPayPayload` from state and calls `paymentProviderAPI.fullSetupAngelPayMerchant` via a TanStack Query `useMutation`; on success invalidates `['merchant-accounts-all']` and closes; on error shows a toast. Clears reducer state (incl. PIN) on close/unmount.
- [ ] **Step 2: Typecheck. Step 3: Commit** (ask first).

### Task E4: "Agregar AngelPay" button

**Files:** Modify `avoqado-web-dashboard/src/pages/Superadmin/MerchantAccounts.tsx` (header button group ~line 266, add wizard open state + render `<AngelPayWizard>`).

- [ ] **Step 1: Add** a 5th header button "Agregar AngelPay" (wallet icon, indigo styling — flat, no gradient per project rule), wire `useState` open flag, render `<AngelPayWizard open=... onOpenChange=... />`.
- [ ] **Step 2: Build + lint** — `npm run build && npm run lint` → pass. **Step 3: Commit** (ask first).

---

## Phase F — End-to-end test

### Task F1: Playwright happy-path

**Files:** Create `avoqado-web-dashboard/e2e/tests/angelpay-wizard.spec.ts`

- [ ] **Step 1: Write** an E2E test using `setupApiMocks` (mock the new endpoint with `page.route`, catch-all registered first per project rule): open the wizard, fill venue → new login → merchant (with id confirmation) → PRIMARY slot → skip terminals/cost/pricing/settlement → Confirm → assert the success toast and that the mocked endpoint received one POST with the expected payload.
- [ ] **Step 2: Run** — `npm run test:e2e -- angelpay-wizard` → passes. **Step 3: Commit** (ask first).

---

## Self-review notes

- **Spec coverage:** Phase A = §6.1; B = §7; C/D/E = §4-6, §5 steps; F = §10 E2E. Slot replace + pricing-required → B2 refines + B4 + D1. Idempotency → B3 + B4. All §5 steps have a component in E1.
- **Type consistency:** `FullSetupAngelPayInput` (Zod, B2) ↔ `FullSetupAngelPayPayload` (client, C1) ↔ `AngelPayWizardState` (D1) — keep field names identical (`externalMerchantId`, `angelpayUserAccountId`, `accountType`, `idempotencyKey`).
- **Open implementer lookups (explicitly flagged, not placeholders):** Terminal→MerchantAccount link field (`merchantAccount.service.ts` ~1533), `SettlementConfiguration` default shape (`merchantAccount.controller.ts` ~2021), project error classes, the test runner (`jest` backend; vitest/jest frontend — check `package.json`).
