# AngelPay Merchant Wizard — Design

**Date:** 2026-05-21
**Status:** Approved (pending spec review)
**Repos affected:** `avoqado-web-dashboard` (frontend), `avoqado-server` (backend)

## 1. Problem

The superadmin Merchant Accounts page (`/superadmin/merchant-accounts`) has no guided
way to create an AngelPay payment account. AngelPay setup is multi-layered and the
current path forces the operator to touch several disconnected dialogs (manual account
dialog, assign-to-venue dialog, cost dialog, terminal dialog) with no enforced order
and no single coherent view. The goal: one **"Agregar AngelPay"** button that opens a
guided wizard which produces a fully (or near-fully) configured AngelPay account, and
that is **immediately understandable for a non-expert superadmin**.

## 2. Domain background (how an AngelPay account is formed)

AngelPay is layered across several models in `avoqado-server/prisma/schema.prisma`:

- **`AngelPayUserAccount`** — the *login*. Per-venue credentials: `email` + encrypted
  `PIN` (6 digits) + `environment` (`QA` | `PROD`). `status` (`PENDING_PIN` → `ACTIVE`).
  Unique on `(venueId, email)`. A venue may have multiple logins.
- **`MerchantAccount`** (provider `ANGELPAY`) — the payment-routing entity.
  `externalMerchantId` holds the numeric AngelPay merchant id. Linked to a login via
  `angelpayUserAccountId`. Display caches: `angelpayMerchantName`, `angelpayAffiliation`.
  Credentials column is a placeholder for AngelPay (auth lives on the login).
  Unique on `(providerId, externalMerchantId, angelpayUserAccountId)`.
- **`VenuePaymentConfig`** — links a venue to merchant accounts via
  `primaryAccountId` / `secondaryAccountId` / `tertiaryAccountId`. One row per venue.
- **`ProviderCostStructure`** — what the **processor charges us**. Rate fields
  (`debitRate`, `creditRate`, `amexRate`, `internationalRate`), `fixedCostPerTransaction`,
  `monthlyFee`, `includesTax`, `taxRate`, `effectiveFrom`. Per `merchantAccountId`.
- **`VenuePricingStructure`** — what **we charge the venue** (cost + our margin). Same
  rate shape plus `fixedFeePerTransaction`, `monthlyServiceFee`. Keyed by `venueId` +
  `accountType` (`PRIMARY` | `SECONDARY` | `TERTIARY`).
- **`Terminal`** — physical devices, belong to a venue, assigned to a merchant account.

### Decision: manual merchant entry, not TPV discovery

AngelPay merchant ids are normally *discovered*: the TPV runs the
`FETCH_ANGELPAY_MERCHANTS` socket command, the SDK authenticates with the login, and
`getUserMerchants()` returns each merchant. Discovery yields exactly three fields:
`angelpayId` → `externalMerchantId`, `name` → `angelpayMerchantName`,
`affiliationNumber` → `angelpayAffiliation`.

Because discovery requires an **online NEXGO terminal** and yields only those three
simple values, the wizard uses **manual entry** of those three fields. This removes the
TPV dependency entirely. The backend already accepts manual AngelPay merchant creation
(numeric `externalMerchantId`). Automatic discovery remains available separately via the
existing `DiscoveredMerchantsSubsection` and is a possible future enhancement, out of
scope here.

## 3. Scope

**Required steps** (the account does not route payments without these): Venue, AngelPay
login, Merchant, Venue slot.

**Optional steps** (each has a visible "Configurar después" / skip; a "pendiente" badge
keeps them from being forgotten): Terminals, Cost structure, Venue pricing.

Out of scope: live TPV discovery, editing existing AngelPay accounts (existing dialogs
remain), organization-level payment config.

## 4. Approach

A **linear guided wizard** in a `FullScreenModal` (mandatory pattern for create flows).
Two-column layout: the current step on the left, a **live summary panel** on the right
that is always visible and updates on every step. This makes the wizard's state
permanently visible — directly addressing the "hidden state breaks on Next" concern.

Rejected alternatives: single collapsible-section form (too dense, easy to miss a
field); mini-wizard + post-creation checklist (splits the experience in two).

### 4.1 Dependency model

Steps form a strict **DAG — all edges point backward**. Each step depends only on
earlier steps, never later ones, so advancing can never de-configure an earlier step.

| Step | Depends on |
|------|-----------|
| 1 Venue | — (root) |
| 2 Login | Venue |
| 3 Merchant | Venue + Login |
| 4 Slot | Venue + Merchant |
| 5 Terminals | Venue + Merchant |
| 6 Cost | Merchant |
| 7 Pricing | Venue + **Slot** (`accountType` = chosen slot) |
| 8 Summary | all |

Steps 5/6/7 are leaves — they do **not** depend on each other. Configuring one never
disturbs another. The only upstream change that invalidates downstream data is changing
the **Venue**; that triggers an explicit `RESET_DOWNSTREAM` with a user-facing warning.
Non-invalidating upstream changes (e.g. slot `PRIMARY`→`SECONDARY`) only relabel
dependent fields (pricing `accountType`) and preserve typed values.

## 5. Wizard steps

Entry point: a 5th button **"Agregar AngelPay"** in the `MerchantAccounts` page header
(wallet icon, indigo styling to distinguish from Blumon's yellow). Superadmin screens
are i18n-exempt — hardcoded Spanish.

1. **Venue** — searchable single-select. On selection the wizard loads venue context:
   existing `AngelPayUserAccount` rows, existing `VenuePaymentConfig` (which slots are
   taken), and the venue's terminals.
2. **Login AngelPay** — if the venue has ACTIVE login(s), the operator picks one or
   chooses "Conectar nueva". A new login requires `email` + `PIN` (exactly 6 digits) +
   `environment` (`QA` | `PROD`). A new login **must** include a PIN: without a PIN the
   login is `PENDING_PIN` and the backend blocks merchant creation. Email/PIN validation
   reuses `AngelPayConnectDialog` logic.
3. **Merchant** — manual entry: `externalMerchantId` (numeric string, validated),
   `angelpayMerchantName`, `angelpayAffiliation`. Plus `displayName` for our UI
   (defaults to the merchant name).
4. **Venue slot** — assign the account as `PRIMARY` / `SECONDARY` / `TERTIARY`. Shows
   which slots the venue already uses. If the venue has no `VenuePaymentConfig`, this
   account becomes `PRIMARY` and a config row is created.
5. **Terminals** *(optional)* — multi-select of the venue's terminals to route through
   this account. Skippable.
6. **Cost structure** *(optional)* — "cuánto nos cobra AngelPay":
   `debitRate`, `creditRate`, `amexRate`, `internationalRate`, `fixedCostPerTransaction`,
   `monthlyFee`, `includesTax`, `taxRate`, `effectiveFrom`. Skippable.
7. **Venue pricing** *(optional)* — "cuánto le cobramos al venue": same rate shape +
   `fixedFeePerTransaction`, `monthlyServiceFee`, `accountType` = step 4 slot,
   `effectiveFrom`. The step shows the step-6 cost alongside for at-a-glance margin.
   Skippable.
8. **Summary / Confirm** — full review. The single commit happens here.

Number inputs across steps 6/7 follow the clearable-number-input rule (empty → undefined
in state, default applied at the boundary).

## 6. State model

A single `useReducer` is the only source of truth (same pattern as
`PaymentSetupWizard`).

```ts
interface AngelPayWizardState {
  venue: { id: string; name: string; slug: string } | null
  login:
    | { mode: 'existing'; existingId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant: {
    externalMerchantId: string
    name: string
    affiliation: string
    displayName: string
  }
  slot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  terminals: { skipped: boolean; terminalIds: string[] }
  cost: { skipped: boolean; debitRate?: number; creditRate?: number; amexRate?: number
          internationalRate?: number; fixedCostPerTransaction?: number; monthlyFee?: number
          includesTax: boolean; taxRate: number; effectiveFrom: string }
  pricing: { skipped: boolean; debitRate?: number; creditRate?: number; amexRate?: number
             internationalRate?: number; fixedFeePerTransaction?: number
             monthlyServiceFee?: number; includesTax: boolean; taxRate: number
             effectiveFrom: string }
}
```

Per-step options (logins, terminals, free slots) are **derived** from the loaded venue
context, never copied into state — so they cannot go stale. Changing the venue
dispatches `RESET_DOWNSTREAM`.

**No backend writes occur until step 8.** Navigating the wizard only mutates local
state.

## 7. Commit: single transactional backend endpoint

The commit is 6 dependent writes. Frontend orchestration of multi-step writes is an
anti-pattern (no rollback, partial state on network failure). Instead, a **new
transactional backend endpoint** performs all writes in one DB transaction.

### 7.1 New endpoint

`POST /api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay`

Request body:

```ts
{
  venueId: string
  login:
    | { mode: 'existing'; angelpayUserAccountId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant: { externalMerchantId: string; name: string; affiliation: string
              displayName: string }
  slot: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
  terminalIds?: string[]            // omitted/empty = skip
  cost?: { debitRate; creditRate; amexRate; internationalRate
           fixedCostPerTransaction?; monthlyFee?; includesTax; taxRate; effectiveFrom }
  pricing?: { debitRate; creditRate; amexRate; internationalRate
              fixedFeePerTransaction?; monthlyServiceFee?; includesTax; taxRate
              effectiveFrom }
}
```

Response: the created `MerchantAccount` (enriched) plus ids of the created login,
config, cost and pricing rows.

### 7.2 Transaction strategy

Use a Prisma **interactive transaction**: `prisma.$transaction(async (tx) => { ... })`.
The array form is unsuitable — the writes are dependent (each needs the previous id).

- Every write inside the callback uses `tx`, never the global `prisma` client.
- The reused service helpers (`createAngelPayUserAccount`, AngelPay-branch of
  `createMerchantAccount`, cost/pricing/config creators) currently use the global
  `prisma`. They are **parameterized** to accept an optional client:
  `db: Prisma.TransactionClient | PrismaClient = prisma`. This reuses their validation
  logic transactionally. Callers that pass nothing are unaffected.
- `timeout` raised to ~10s (default 5s); `maxWait` left default.
- **No external/network calls inside the transaction.** AngelPay full-setup has none
  (manual entry). This is the deliberate difference from `fullSetupBlumonMerchant`,
  which is *not* transactional precisely because it calls Blumon's API mid-flow.

### 7.3 Commit order (inside the transaction)

1. If `login.mode === 'new'`: create `AngelPayUserAccount` (PIN present → status
   `ACTIVE`). If `existing`: load and assert it is `ACTIVE`.
2. Create the `ANGELPAY` `MerchantAccount` (`externalMerchantId`, `venueId`,
   `angelpayUserAccountId`, `angelpayMerchantName`, `angelpayAffiliation`,
   placeholder credentials).
3. Create or update `VenuePaymentConfig` to point the chosen slot at the new account.
4. If `terminalIds` non-empty: assign terminals to the merchant account.
5. If `cost` present: create `ProviderCostStructure`.
6. If `pricing` present: create `VenuePricingStructure`.

Any failure rolls the whole transaction back — no partial state.

## 8. Error handling & edge cases

Validated inside the wizard before Confirm where possible; the backend re-validates and
is the source of truth.

- **All 3 slots occupied** — step 4 warns and forces choosing a slot to replace, or
  cancel.
- **Duplicate login `(venueId, email)`** — ACTIVE: reuse. DELETED: backend reactivates.
  Other status: explicit error, operator must resolve first.
- **Duplicate merchant `(providerId, externalMerchantId, angelpayUserAccountId)`** —
  caught and explained ("este merchant ya está registrado bajo esta cuenta AngelPay").
- **Non-numeric `externalMerchantId`** — step 3 validation.
- **New login without PIN** — disallowed; the wizard requires a PIN for a new login.
- **Transaction failure** — surfaced as a single error toast; nothing was created.

## 9. Components

**Backend (`avoqado-server`):**
- `fullSetupAngelPayMerchant` — service function (interactive transaction).
- Controller + route + Zod schema for the new endpoint.
- Parameterize reused helpers with an optional `db` client.

**Frontend (`avoqado-web-dashboard`):**
- `AngelPayWizard.tsx` + step components under
  `src/pages/Superadmin/components/merchant-accounts/` (reuse `wizard-steps/`
  `CostStructureStep`, `VenuePricingStep`, `TerminalStep` patterns).
- Live summary panel component.
- "Agregar AngelPay" button in `MerchantAccounts.tsx` header.
- `fullSetupAngelPayMerchant` client function in `paymentProvider.service.ts`.
- Reuse: `AngelPayConnectDialog` validation, `FullScreenModal`, `useReducer` pattern,
  `superadmin-angelpay-user-account.service.ts`.

## 10. Testing

- **Backend:** service test for the transaction — full success path, and rollback when
  an intermediate write fails (assert no rows created).
- **Frontend:** unit test of the reducer (step transitions; `RESET_DOWNSTREAM` clears
  downstream state when venue changes; non-invalidating upstream change preserves typed
  values). E2E happy-path test for the wizard.

## 11. Open questions

None. All design decisions are resolved.
