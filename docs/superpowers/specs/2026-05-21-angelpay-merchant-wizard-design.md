# AngelPay Merchant Wizard — Design

**Date:** 2026-05-21
**Status:** Approved (pending spec review) — revised after plan-eng-review + Codex review
**Repos affected:** `avoqado-web-dashboard` (frontend), `avoqado-server` (backend)

## 1. Problem

The superadmin Merchant Accounts page (`/superadmin/merchant-accounts`) has no guided
way to create an AngelPay payment account. AngelPay setup is multi-layered and the
current path forces the operator to touch several disconnected dialogs with no enforced
order and no single coherent view. The goal: one **"Agregar AngelPay"** button that
opens a guided wizard which produces a fully (or near-fully) configured AngelPay
account, and that is **immediately understandable for a non-expert superadmin**.

## 2. Domain background

AngelPay is layered across several models in `avoqado-server/prisma/schema.prisma`:

- **`AngelPayUserAccount`** — the *login*. Per-venue: `email` + `PIN` (6 digits, stored
  plaintext — see §6.1) + `environment` (`QA` | `PROD`). `status` (`PENDING_PIN` →
  `ACTIVE`). Also `lastValidatedAt`, `lastValidationErr`. Unique on `(venueId, email)`.
  This account PIN is unrelated to `StaffVenue.pin` (the TPV-access PIN), which this
  design does not touch.
- **`MerchantAccount`** (provider `ANGELPAY`) — the payment-routing entity.
  `externalMerchantId` = numeric AngelPay merchant id. Linked to a login via
  `angelpayUserAccountId`. Display caches: `angelpayMerchantName`, `angelpayAffiliation`.
  Unique on `(providerId, externalMerchantId, angelpayUserAccountId)`.
- **`VenuePaymentConfig`** — links a venue to merchant accounts via
  `primaryAccountId` / `secondaryAccountId` / `tertiaryAccountId`. One row per venue.
- **`ProviderCostStructure`** — what the **processor charges us**. Per `merchantAccountId`.
- **`VenuePricingStructure`** — what **we charge the venue** (cost + margin). Keyed by
  `venueId` + `accountType` (`PRIMARY`/`SECONDARY`/`TERTIARY`) — **not by merchant**.
- **`SettlementConfiguration`** — payout timing/config. Per `merchantAccountId`.
- **`Terminal`** — physical devices, belong to a venue, assigned to a merchant account.

### 2.1 Decision: manual merchant entry

AngelPay merchant ids can be *discovered* via the TPV `FETCH_ANGELPAY_MERCHANTS` socket
command (yields `angelpayId`, `name`, `affiliationNumber`). The wizard instead uses
**manual entry** of those three fields — confirmed decision. This removes the online-
NEXGO-terminal dependency. The account is created **active and routed to its slot
immediately**.

**Residual risk (accepted):** manual entry has no authoritative check that the merchant
id belongs to the chosen login/environment. A typo can route payments to a wrong or
nonexistent merchant ("looks configured, fails at payment time"). **Mitigation:** step 3
requires the operator to confirm the merchant id and shows the affiliation + name for
cross-check before advancing. Automatic discovery remains available separately via the
existing `DiscoveredMerchantsSubsection` and is out of scope here.

## 3. Scope

**Required:** Venue, AngelPay login, Merchant, Venue slot.
**Optional** (visible "Configurar después" + "pendiente" badge): Terminals, Cost
structure, Venue pricing, Settlement. **Exception:** pricing becomes **required** when
the slot step replaces an occupied slot (see §5 step 4 and §8).

Out of scope: live TPV discovery, editing existing AngelPay accounts, organization-level
payment config.

## 4. Approach

A **linear guided wizard** in a `FullScreenModal` (mandatory pattern for create flows).
Two-column layout: current step on the left, a **live summary panel** on the right that
is always visible and updates on every step.

### 4.1 Dependency model

Steps form a strict **DAG — all edges point backward**. Advancing can never de-configure
an earlier step.

| Step | Depends on |
|------|-----------|
| 1 Venue | — (root) |
| 2 Login | Venue |
| 3 Merchant | Venue + Login |
| 4 Slot | Venue + Merchant |
| 5 Terminals | Venue + Merchant |
| 6 Cost | Merchant |
| 7 Pricing | Venue + Slot |
| 8 Settlement | Merchant |
| 9 Summary | all |

Steps 5/6/7/8 are leaves — they do not depend on each other. The only upstream change
that invalidates downstream data is changing the **Venue** → explicit `RESET_DOWNSTREAM`
with a user-facing warning. Changing the **Slot** relabels pricing `accountType` and, if
it switches to/from replace-mode, toggles whether step 7 is required.

## 5. Wizard steps

Entry point: a 5th button **"Agregar AngelPay"** in the `MerchantAccounts` header
(wallet icon, indigo styling). Superadmin screens are i18n-exempt — hardcoded Spanish.

1. **Venue** — searchable single-select. On selection the wizard loads venue context:
   existing `AngelPayUserAccount` rows, existing `VenuePaymentConfig` (slot occupancy),
   the venue's terminals.
2. **Login AngelPay** — pick an existing login or "Conectar nueva". An existing login is
   selectable only when `status === 'ACTIVE'` **and** `lastValidationErr` is null; a row
   with a validation error is shown disabled with the error. A new login requires
   `email` + `PIN` (exactly 6 digits) + `environment` (`QA`/`PROD`); a PIN is mandatory
   (without it the login is `PENDING_PIN` and merchant creation is blocked).
3. **Merchant** — manual entry: `externalMerchantId` (numeric string), `angelpayMerchantName`,
   `angelpayAffiliation`, `displayName` (defaults to merchant name). The operator must
   **confirm the merchant id** (re-entry or an explicit confirmation control) with the
   affiliation + name shown for cross-check before advancing.
4. **Venue slot** — assign as `PRIMARY` / `SECONDARY` / `TERTIARY`.
   - Empty slot → fill it. If the venue has no `VenuePaymentConfig`, this account becomes
     `PRIMARY` and a config row is created.
   - All slots occupied → the operator may **replace** one. Replace mode: the displaced
     account is only **unlinked** from the slot (not deleted). Because pricing is keyed
     `venueId + accountType`, replacing a slot makes **step 7 (pricing) required** — the
     operator must re-capture pricing for that `accountType` so the new merchant does not
     inherit the displaced merchant's pricing.
5. **Terminals** *(optional)* — multi-select of the venue's terminals to route through
   this account. The list is **prefiltered to compatible ACTIVE terminals**; selection is
   de-duplicated. Skippable.
6. **Cost structure** *(optional)* — "cuánto nos cobra AngelPay": `debitRate`,
   `creditRate`, `amexRate`, `internationalRate`, `fixedCostPerTransaction`, `monthlyFee`,
   `includesTax`, `taxRate`, `effectiveFrom`. Skippable.
7. **Venue pricing** *(optional, required in slot-replace mode)* — "cuánto le cobramos al
   venue": same rate shape + `fixedFeePerTransaction`, `monthlyServiceFee`, `accountType`
   = step 4 slot, `effectiveFrom`. Shows the step-6 cost alongside for margin.
8. **Settlement** *(optional)* — `SettlementConfiguration` for the merchant account, with
   sensible defaults prefilled (mirroring the Blumon full-setup defaults). Skippable.
9. **Summary / Confirm** — full review. The single commit happens here.

Number inputs (steps 6/7/8) follow the clearable-number-input rule (empty → undefined in
state, default applied at the boundary).

## 6. State model

A single `useReducer` is the only source of truth.

```ts
interface AngelPayWizardState {
  idempotencyKey: string                       // generated once at wizard open
  venue: { id: string; name: string; slug: string } | null
  login:
    | { mode: 'existing'; angelpayUserAccountId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant: { externalMerchantId: string; name: string; affiliation: string
              displayName: string; idConfirmed: boolean }
  slot: { accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
          mode: 'fill' | 'replace'; replacedAccountId?: string }
  terminals: { skipped: boolean; terminalIds: string[] }
  cost: { skipped: boolean; /* rate fields */ }
  pricing: { skipped: boolean; /* rate fields */ }
  settlement: { skipped: boolean; /* settlement fields */ }
}
```

Per-step options (logins, terminals, free slots) are **derived** from the loaded venue
context, never copied into state. Changing the venue dispatches `RESET_DOWNSTREAM`.

**No backend writes occur until step 9.** `idempotencyKey` is generated once when the
wizard opens and travels with the final request.

### 6.1 AngelPay credential handling — plaintext (decision)

Per decision, AngelPay account credentials are **not encrypted**: `email`,
`angelpayAffiliation` and the **account PIN** are stored in plaintext. Email and
affiliation are already plaintext columns; this changes only the PIN.

This is a backend change wider than the wizard, because the PIN is currently stored
encrypted as `AngelPayUserAccount.pinEncrypted` and decrypted by the TPV auth path.
Required changes (all AngelPay account-PIN handling, not just the wizard):

- **Writers stop encrypting:** `createAngelPayUserAccount`, `setAngelPayUserAccountPin`,
  `updateAngelPayUserAccountCredentials` (`angelpayUserAccount.service.ts`).
- **Readers stop decrypting:** `terminal.tpv.controller.ts` (~lines 410/442) reads the
  plain PIN instead of `decryptCredentials(...)`. Also `angelpayUserAccount.controller.ts`.
- The `pinEncrypted` JSON column is replaced by a plain `pin` string column (Prisma
  migration); a data migration decrypts existing rows into the new column.
- **No TPV/PAX deploy needed** — the TPV already receives the plain PIN in the auth
  payload (the server decrypts before sending); only at-rest DB storage changes.

This matches the storage model of `StaffVenue.pin` (the separate TPV-access PIN), which
is plaintext by design for fast login. The TPV-access PIN is unrelated and untouched.

Frontend hygiene still applies: the PIN lives only in reducer state, is never written to
`localStorage`/URL, is not logged, and is cleared when the wizard closes/unmounts.

**Accepted risk:** a plaintext payment-login PIN at rest is weaker than encrypted.
Decision owned by the product owner; consistent with the `StaffVenue.pin` precedent.

**Unrelated pre-existing issue (separate TODO, not this scope):** `encryptCredentials`
(`merchantAccount.service.ts`) falls back to a default key when its env var is absent
and should hard-fail. Still relevant for Blumon `MerchantAccount.credentialsEncrypted`,
which keeps encryption.

## 7. Commit: single transactional backend endpoint

### 7.1 New endpoint

`POST /api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay`

Request body:

```ts
{
  idempotencyKey: string
  venueId: string
  login:
    | { mode: 'existing'; angelpayUserAccountId: string }
    | { mode: 'new'; email: string; pin: string; environment: 'QA' | 'PROD' }
  merchant: { externalMerchantId: string; name: string; affiliation: string
              displayName: string }
  slot: { accountType: 'PRIMARY' | 'SECONDARY' | 'TERTIARY'
          mode: 'fill' | 'replace'; replacedAccountId?: string }
  terminalIds?: string[]
  cost?:    { /* rate fields */ }
  pricing?: { /* rate fields */ }      // required by the backend when slot.mode='replace'
  settlement?: { /* settlement fields */ }
}
```

Response: the created `MerchantAccount` (enriched) plus ids of the created login,
config, cost, pricing and settlement rows.

### 7.2 Transaction strategy — inline writes

`fullSetupAngelPayMerchant` performs **all writes directly inside one Prisma interactive
transaction**: `prisma.$transaction(async (tx) => { ... })`.

- The existing DB-writing helpers (`createAngelPayUserAccount`, the AngelPay branch of
  `createMerchantAccount`, cost/pricing/config/settlement creators) are **not reused** for
  the writes. Some of them call the global `prisma` client and some open their *own*
  `$transaction` (e.g. `venuePricing.service.ts`), which cannot be nested cleanly inside
  an interactive transaction. Reusing them would not give one atomic transaction, and
  parameterizing every one of them with an optional `tx` client is a large refactor that
  risks regressions in the Blumon and discovery callers.
- Instead: the **pure validators** only (email regex, 6-digit PIN regex, numeric
  `externalMerchantId` check) are extracted into shared pure functions and reused. The DB
  writes are written inline in the new service, every one using `tx`.
- The `MerchantAccount` row is created **explicitly with `angelpayUserAccountId`** so the
  `(providerId, externalMerchantId, angelpayUserAccountId)` uniqueness and the login link
  are correct (the legacy `createMerchantAccount` helper does neither).
- `timeout` raised to ~10s; `maxWait` default. **No external/network calls inside the
  transaction** — AngelPay full-setup has none (manual entry).
- **Idempotency:** before opening the transaction, the endpoint checks `idempotencyKey`
  against a processed-keys store; a repeated key returns the prior result instead of
  creating duplicates. The slot write additionally uses a conditional guard (assert the
  slot still holds the expected account) so two concurrent operators cannot silently
  overwrite each other.

### 7.3 Commit order (inside the transaction)

1. If `login.mode === 'new'`: create `AngelPayUserAccount` (PIN stored plaintext per
   §6.1, present → `ACTIVE`). If `existing`: load and assert `status === 'ACTIVE'` and
   `lastValidationErr` null.
2. Create the `ANGELPAY` `MerchantAccount` with `externalMerchantId`, `venueId`,
   `angelpayUserAccountId`, `angelpayMerchantName`, `angelpayAffiliation`, placeholder
   credentials.
3. Create or update `VenuePaymentConfig`: point the chosen slot at the new account. In
   `replace` mode, assert the slot still references `replacedAccountId` (conditional
   guard) before repointing; the displaced account is only unlinked.
4. If `terminalIds` non-empty: assign terminals to the merchant account.
5. If `cost` present: create `ProviderCostStructure`.
6. If `pricing` present: create `VenuePricingStructure` (deactivating any existing active
   structure for the same `venueId + accountType`). Required when `slot.mode === 'replace'`.
7. If `settlement` present: create `SettlementConfiguration`.

Any failure rolls the whole transaction back — no partial state.

## 8. Error handling & edge cases

- **All 3 slots occupied** — step 4 offers replace mode; replacing forces step 7.
- **Slot race** — conditional guard in commit step 3; if the slot changed under the
  operator, the transaction aborts with a clear "el slot cambió, reintenta" error.
- **Duplicate idempotency key** — returns the prior result, no duplicate rows.
- **Duplicate login `(venueId, email)`** — ACTIVE: reuse. DELETED: backend reactivates.
  Other status: explicit error.
- **Duplicate merchant `(providerId, externalMerchantId, angelpayUserAccountId)`** —
  caught and explained.
- **Existing login with `lastValidationErr`** — not selectable; shown disabled.
- **Non-numeric `externalMerchantId`** — step 3 validation.
- **Unconfirmed merchant id** — cannot advance past step 3.
- **New login without PIN** — disallowed.
- **Transaction failure** — single error toast; nothing was created.

## 9. Components

**Backend (`avoqado-server`):**
- `fullSetupAngelPayMerchant` service (interactive transaction, inline writes).
- Controller + route + Zod schema for the new endpoint.
- Extract shared pure validators (email, PIN, numeric id).
- Idempotency-key store (reuse an existing mechanism if one exists; otherwise a small
  table/keyed cache).
- **AngelPay PIN → plaintext (§6.1):** Prisma migration replacing `pinEncrypted` with a
  plain `pin` column + data migration to decrypt existing rows; update the 3 writers in
  `angelpayUserAccount.service.ts` and the readers in `terminal.tpv.controller.ts` /
  `angelpayUserAccount.controller.ts`.
- Separate TODO (not this scope): make `encryptCredentials` hard-fail without a key.

**Frontend (`avoqado-web-dashboard`):**
- `AngelPayWizard.tsx` + step components under
  `src/pages/Superadmin/components/merchant-accounts/` (reuse `wizard-steps/` patterns).
- Live summary panel component.
- "Agregar AngelPay" button in `MerchantAccounts.tsx` header.
- `fullSetupAngelPayMerchant` client function in `paymentProvider.service.ts`.
- Reuse: `AngelPayConnectDialog` validation, `FullScreenModal`, `useReducer` pattern,
  `superadmin-angelpay-user-account.service.ts`.

## 10. Testing

- **Backend:** service test for the transaction — full success path; rollback when an
  intermediate write fails (assert zero rows created); idempotency-key replay returns the
  same result without duplicates; slot-race conditional guard aborts cleanly;
  `slot.mode='replace'` without `pricing` is rejected.
- **Frontend:** reducer unit tests (step transitions; `RESET_DOWNSTREAM` on venue change;
  slot change toggling pricing-required; non-invalidating upstream change preserves typed
  values); E2E happy-path wizard test.

## 11. NOT in scope

- Live TPV discovery of merchants (manual entry chosen; discovery stays in the existing
  `DiscoveredMerchantsSubsection`).
- Editing existing AngelPay accounts (existing dialogs remain).
- Organization-level payment config.
- Full parameterization of shared service helpers with a `tx` client (rejected in favor
  of inline writes — see §7.2).
- Fixing the `encryptCredentials` fallback-key issue (flagged as a separate TODO).

## 12. What already exists (reused, not rebuilt)

- `superadmin-angelpay-user-account.service.ts` — AngelPay login CRUD client functions.
- `AngelPayConnectDialog` — email/PIN/environment validation logic.
- `wizard-steps/{CostStructureStep,VenuePricingStep,TerminalStep,SettlementStep}` —
  patterns to base steps 5/6/7/8 on.
- `paymentProvider.service.ts` — cost/pricing/config client functions (referenced for
  payload shapes; the wizard calls the new full-setup endpoint instead).
- `fullSetupBlumonMerchant` — precedent for a full-setup endpoint and settlement defaults.

## 13. Open questions / accepted risks

- **Accepted risk:** manual merchant entry has no authoritative validation that the id
  belongs to the login/environment. Mitigated by the step-3 confirmation, not eliminated.
  If payment-time failures become common, revisit with a post-create validation gate.
- No other open questions.
