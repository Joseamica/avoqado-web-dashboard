# E-commerce Merchant Wizard — Design

**Status:** Approved (brainstorming complete) — pending implementation plan
**Date:** 2026-05-11
**Author:** Jose Antonio Amieva + Claude

## Context & Motivation

The current per-venue create flow at `/venues/:slug/ecommerce-merchants` uses
`EcommerceMerchantDialog.tsx` (357 LOC), which:

- Is a regular Radix `Dialog` (UI rules mandate `FullScreenModal` for create flows).
- Asks for raw JSON `providerCredentials` — terrible UX for non-technical users.
- Has no provider-specific UX. Stripe Connect (which needs hosted onboarding,
  not manual credentials) falls into the same generic JSON form as every other
  provider.
- Quietly defaults `businessType: 'company'` for Stripe Connect when the user
  leaves credentials empty — the user has no idea this happened.

Separately, the Superadmin `ManualAccountDialog.tsx` (~660 LOC) lists
`STRIPE_CONNECT` in its provider dropdown but, when selected, falls into a
generic Blumon-style credentials form (merchantId, apiKey, customerId,
terminalId) — none of which apply to Stripe Connect. The form also lets the
browser autofill the "Nombre para mostrar" field with the logged-in user's
email because the input has no `autoComplete` attribute.

The backend already supports the canonical Stripe Connect flow end-to-end:

| Endpoint | Purpose |
|---|---|
| `POST /api/v1/dashboard/venues/:venueId/ecommerce-merchants` | Create merchant record (status `NOT_STARTED`) |
| `POST /api/v1/dashboard/venues/:venueId/ecommerce-merchants/:id/stripe-onboard` | Create Stripe Connect account + return hosted onboarding URL |
| `GET /api/v1/dashboard/venues/:venueId/ecommerce-merchants/:id/onboarding-status` | Poll status + sync with Stripe |

The frontend simply isn't wired up to use this flow correctly. This spec
describes the redesign.

## Goals

1. Stripe Connect uses its canonical hosted-onboarding flow: pick provider →
   minimal form (channelName + email + businessType) → click "Conectar con
   Stripe" → redirect to Stripe → Stripe redirects back → page shows success
   banner + polls until `COMPLETED`.
2. One UI (a wizard) handles create, edit, and "continue/resume" for any
   Stripe Connect state (`NOT_STARTED`, `IN_PROGRESS`, `RESTRICTED`,
   `COMPLETED`).
3. Other providers (Blumon eCommerce, etc.) use a schema-driven form with
   typed inputs (no raw JSON).
4. Superadmin's `ManualAccountDialog` no longer pretends to support Stripe
   Connect manually — it filters STRIPE_CONNECT out of its dropdown and points
   the admin to the per-venue flow.
5. The browser autofill bug in `ManualAccountDialog` is fixed.

## Non-goals

- Full redesign of the Superadmin `ManualAccountDialog`. Blumon/AngelPay/Generic
  branches stay as-is.
- Migrating `EcommerceMerchant` to use the `MerchantAccount` model. Two
  parallel systems remain (`EcommerceMerchant` for online checkout,
  `MerchantAccount` for TPV).
- Building a new provider beyond what's seeded (Stripe Connect + Blumon).
- White-label specific tweaks beyond using `fullBasePath` for navigation.

## Architecture

### Wizard component

New file: `src/pages/Venue/components/EcommerceMerchantWizard.tsx`

- Implemented as a `FullScreenModal` per UI rules.
- Two steps for create. For edit/resume, opens directly to a state-aware view.
- Provider-aware: step 2 swaps between Stripe Connect minimal form and
  schema-driven generic form based on the provider picked in step 1.
- Replaces `EcommerceMerchantDialog.tsx`, which is deleted.

### Step structure

```
Step 1: ¿Cómo quieres recibir pagos?
  - Provider tiles (visual cards, not dropdown)
  - Stripe Connect tile marked "Recomendado"
  - Disabled in edit mode (provider cannot change after creation)

Step 2A: Configura Stripe Connect (when provider = STRIPE_CONNECT)
  - channelName (required, internal identifier)
  - contactEmail (required)
  - businessType (radio: persona moral / persona física)
  - Info card explaining the hosted onboarding flow
  - Submit button label: "Conectar con Stripe →"

Step 2B: Configura {provider.name} (when provider != STRIPE_CONNECT)
  - channelName, businessName, RFC, contactEmail, contactPhone, website
  - Credential fields driven by provider.configSchema (typed inputs, password
    masks for secrets, show/hide eye)
  - sandboxMode toggle
  - Submit button label: "Crear canal"
```

### Resume / edit mode

When the wizard opens with an existing `merchant`, step 1 is skipped (provider
locked) and step 2 renders a state-aware view:

| `merchant.onboardingStatus` | View |
|---|---|
| `NOT_STARTED` | Same as step 2A but pre-filled. Button "Conectar con Stripe →". |
| `IN_PROGRESS` | Summary card: "Tu cuenta está pendiente de verificación". Button "Continuar onboarding" → regenerates URL → redirects. |
| `RESTRICTED` | Summary card with `requirementsDue` list: "Stripe necesita más información". Button "Completar en Stripe" → regenerates URL → redirects. |
| `COMPLETED` | Green summary card "✓ Tu cuenta está activa". Buttons "Editar info local" (channelName, contactEmail, website only — Stripe owns the rest), "Ir a Stripe Dashboard" (opens external), "Desconectar" (destructive). |

For non-Stripe providers, edit mode shows the same form as create, but
credentials are masked (empty input + placeholder "Deja vacío para mantener").

### Sequence: Stripe Connect create

```
User                Wizard              Backend             Stripe
 │ pick tile         │                    │                   │
 │ fill 3 fields     │                    │                   │
 │ click "Conectar"  │                    │                   │
 │──────────────────>│                    │                   │
 │                   │ POST /ecommerce-merchants               │
 │                   │  (channelName, contactEmail,            │
 │                   │   providerId=STRIPE_CONNECT,            │
 │                   │   providerCredentials.businessType,     │
 │                   │   sandboxMode=false)                    │
 │                   │───────────────────>│                   │
 │                   │                    │ create record     │
 │                   │                    │ status=NOT_STARTED│
 │                   │<───────────────────│ { id, ... }       │
 │                   │                                         │
 │                   │ POST /:id/stripe-onboard                │
 │                   │  { businessType }                       │
 │                   │───────────────────>│                   │
 │                   │                    │ create Stripe acc │
 │                   │                    │──────────────────>│
 │                   │                    │<──────────────────│ acct_XXX
 │                   │                    │ persist connectAccountId
 │                   │                    │ create accountLink│
 │                   │                    │──────────────────>│
 │                   │                    │<──────────────────│ url, expires
 │                   │                    │ status=IN_PROGRESS│
 │                   │<───────────────────│ { url, expiresAt }│
 │                   │                                         │
 │                   │ window.location.href = url             │
 │ <─── browser navigates away from dashboard ────────────────│
 │                                                             │
 │   User completes Stripe-hosted onboarding (5-10 min)        │
 │                                                             │
 │ Stripe redirects to:                                        │
 │  /venues/:slug/ecommerce-merchants?status=success&merchantId=X
 │ <───────────────────────────────────────────────────────────│
 │                                                             │
 │ EcommerceMerchants page detects URL params:                 │
 │  1. Show green banner "✓ Conexión completada"               │
 │  2. Poll GET /:id/onboarding-status every 3s (timeout 30s)  │
 │  3. Update merchant row badge as status changes             │
 │  4. Clear URL params via navigate(pathname, replace=true)   │
```

### List-page return handling

`EcommerceMerchants.tsx` reads `useSearchParams` on mount:

- `?status=success&merchantId=X` → success banner + polling for that merchant
- `?status=retry&merchantId=X` → amber banner "Onboarding incompleto" + auto-open
  wizard for X in resume mode
- No params → normal page

Polling uses TanStack Query with `refetchInterval` until status is
`COMPLETED` or `RESTRICTED`, or 10 polls have elapsed. URL params are
cleared after the first detection so a refresh doesn't re-trigger.

### Superadmin `ManualAccountDialog` changes

Minimal scope, three targeted edits:

1. Filter `STRIPE_CONNECT` out of the providers dropdown.
2. Add a small banner above the dialog body: _"¿Buscas Stripe Connect? Se
   configura por venue → ver venues"_ with a link to the venues listing.
3. Add `autoComplete="off"` (and `data-1p-ignore` for 1Password) to inputs
   that the browser misinterprets: `alias`, `displayName`,
   `externalMerchantId`. For credential inputs already typed `"password"`,
   add `autoComplete="new-password"` as defence-in-depth.

Existing Blumon, AngelPay, and Generic branches are untouched.

## Data flow & state

### Wizard internal state

- `step: 1 | 2` for create mode (skipped to 2 when editing).
- `providerId: string | null` from step 1.
- A single `formData` object with all possible fields; only the relevant ones
  are rendered per provider. (Same pattern as existing `ManualAccountDialog`.)

### Backend payload shape

For Stripe Connect create:

```json
POST /api/v1/dashboard/venues/:venueId/ecommerce-merchants
{
  "channelName": "Web Principal",
  "contactEmail": "pagos@negocio.com",
  "providerId": "<stripe-connect-id>",
  "providerCredentials": { "businessType": "company" },
  "sandboxMode": false,
  "active": true
}
```

For Blumon eCommerce create:

```json
POST /api/v1/dashboard/venues/:venueId/ecommerce-merchants
{
  "channelName": "Tienda Online",
  "businessName": "Mi Negocio SA de CV",
  "rfc": "ABC123456XYZ",
  "contactEmail": "pagos@negocio.com",
  "contactPhone": "+52551234...",
  "website": "https://...",
  "providerId": "<blumon-id>",
  "providerCredentials": { "merchantId": "...", "apiKey": "...", "posId": "..." },
  "sandboxMode": true,
  "active": true
}
```

### Backend validation relaxation

The current schema may require `providerCredentials.merchantId` and
`providerCredentials.apiKey` regardless of provider. We need it to be
conditional on `provider.code`:

- `STRIPE_CONNECT` → only `businessType` is required (everything else comes
  from hosted onboarding).
- Others → driven by `provider.configSchema.required`.

Affected files (backend):
- `src/schemas/dashboard/ecommerceMerchant.schema.ts`
- `src/controllers/dashboard/ecommerceMerchant.controller.ts`
- `src/services/dashboard/ecommerceMerchant.service.ts` (validation pass)

## Error handling

| Failure point | Behavior |
|---|---|
| Backend rejects create (e.g. invalid email) | Inline field errors in wizard step 2A/2B. No redirect. |
| Stripe onboarding link creation fails (network, API error) | Toast error, wizard stays open with retry button. Merchant record exists in `NOT_STARTED` — user can retry from list. |
| User closes Stripe tab mid-onboarding | Merchant stays `IN_PROGRESS`. List row shows amber badge + "Continuar onboarding" button. |
| Stripe returns with restricted status (missing docs) | Status sync sets `RESTRICTED` + `requirementsDue`. Banner and wizard resume view list the pending requirements. |
| Stripe link expired (5 min lifetime) | "Continuar onboarding" always regenerates a fresh link. Expiration is invisible to the user. |
| `paramsSerializer` regression on Stripe v2 API | Already fixed in `stripe-connect.provider.ts` (`paramsSerializer: { indexes: true }`). Keep the V1 fallback codes `non_connect_platform_accounts_v2_access_blocked` and `v1_account_instead_of_v2_account` in `V1_FALLBACK_ERROR_CODES`. |
| Providers dropdown empty (no STRIPE_CONNECT seeded) | Add a seed verification step before testing. If missing, run `prisma db seed` or apply the existing migration `20260501013000_seed_stripe_connect_provider`. |

## Testing strategy

### Unit / component

- Render wizard step 1, assert tiles render in order with "Recomendado" badge
  on Stripe Connect.
- Render wizard step 2A (Stripe), validate businessType radio enforces a
  selection before submit.
- Render wizard in resume mode for each `onboardingStatus` and assert the
  correct view + button label render.
- Verify `autoComplete="off"` is present on the patched inputs in
  `ManualAccountDialog`.

### Integration (Playwright)

- E2E happy path: open list → click "Crear canal" → step 1 pick Stripe →
  step 2A fill → click "Conectar con Stripe" → mock backend to return a fake
  onboarding URL → assert `window.location.href` was set.
- E2E return path: navigate directly to
  `?status=success&merchantId=<id>` → assert success banner renders, polling
  kicks off, banner clears after status flips to COMPLETED.

API mocks live in `e2e/fixtures/api-mocks.ts` per project pattern.

### Manual verification

- Test in light + dark mode.
- Test with `OWNER` and `ADMIN` roles (the only roles that can create).
- Verify in white-label mode (`/wl/venues/:slug/...`) that the navigation uses
  `fullBasePath`.

## Tour integration

Per CLAUDE.md rule 16, add `data-tour` attributes to the wizard's primary
elements so a future onboarding tour can target them:

- `data-tour="ecommerce-merchant-create-btn"` on the "Crear canal" CTA in
  `EcommerceMerchants.tsx`.
- `data-tour="ecommerce-wizard-provider-stripe"` on the Stripe Connect tile.
- `data-tour="ecommerce-wizard-provider-blumon"` on the Blumon tile.
- `data-tour="ecommerce-wizard-business-type"` on the businessType radio
  group in step 2A.
- `data-tour="ecommerce-wizard-connect-stripe"` on the "Conectar con Stripe"
  button.

No tour hook is created in this work — the attributes are just placed so a
future tour hook can target them without DOM churn.

## i18n

All user-facing strings use `t()` in `src/locales/{en,es,fr}/ecommerce.json`.
Estimated ~40 new keys, e.g.:

- `wizard.title.create`, `wizard.title.editingState.{notStarted,inProgress,restricted,completed}`
- `wizard.step1.title`, `wizard.step1.providers.stripeConnect.{title,subtitle,recommended}`
- `wizard.step2a.{channelNameLabel,emailLabel,businessTypeLabel,businessTypeCompany,businessTypePersonal,info,submitButton}`
- `wizard.return.{successBanner,retryBanner}`
- `wizard.resume.{inProgressTitle,restrictedTitle,completedTitle,continueButton,stripeDashboardButton,disconnectButton}`

Superadmin strings are out of scope (Superadmin uses hardcoded Spanish per
CLAUDE.md).

## Files touched

| File | Change | LOC delta |
|---|---|---|
| `src/pages/Venue/components/EcommerceMerchantWizard.tsx` | **new** | +600 |
| `src/pages/Venue/components/EcommerceMerchantDialog.tsx` | **delete** | -357 |
| `src/pages/Venue/EcommerceMerchants.tsx` | Use wizard, handle URL params, add resume button | ~80 changes |
| `src/services/ecommerceMerchant.service.ts` | Adjust types if needed | ~10 |
| `src/locales/{en,es,fr}/ecommerce.json` | +~40 keys × 3 | +120 |
| `src/pages/Superadmin/components/merchant-accounts/ManualAccountDialog.tsx` | Filter STRIPE_CONNECT, add autoComplete, add banner | ~25 |
| `avoqado-server/src/schemas/dashboard/ecommerceMerchant.schema.ts` | Conditional credentials requirement | ~10 |
| `avoqado-server/src/controllers/dashboard/ecommerceMerchant.controller.ts` | Pass through new optional fields | ~5 |
| `avoqado-server/src/services/dashboard/ecommerceMerchant.service.ts` | Validation pass | ~5 |

## Out of scope (future work)

- A driver.js tour hook for the wizard (attributes are placed, hook is later).
- Migrating Blumon eCommerce specific UI improvements (the schema-driven form
  is generic — Blumon-specific polish can come later).
- Webhook secret management UI inside the wizard (today it's in
  `providerConfig` JSON — keep as advanced field outside the create flow).
- Disconnecting a Stripe Connect account is a button placeholder in the
  COMPLETED resume view. Wiring it to the backend offboarding endpoint
  (`stripeConnectOffboarding.controller.ts`) is a follow-up.

## Risks

| Risk | Mitigation |
|---|---|
| `STRIPE_CONNECT` provider not seeded in dev DB | Verify and run seed before testing |
| Backend schema still hard-rejects Stripe Connect without merchantId/apiKey | First change in implementation: adjust schema. Verify with manual curl before frontend work |
| Onboarding URL returns `?status=retry` with stale merchantId after the user navigated elsewhere | The retry banner only renders if the merchantId is still in the user's accessible venue; otherwise show a generic "tu onboarding está pendiente" without auto-opening wizard |
| Stripe rate limits when many users hit "Continuar onboarding" simultaneously | Stripe SDK handles 429s with retries built-in; just surface errors as a toast |
| User changes provider after step 1, then goes back | Step 1 wipes all step 2 form state on provider change. Document this in the component (no draft persistence between providers) |
