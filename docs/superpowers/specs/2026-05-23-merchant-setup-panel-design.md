# Merchant Setup Panel — Design Spec

> **Status**: Approved (2026-05-23) · Pending implementation plan.
> **Scope**: Frontend redesign of the AngelPay merchant configuration flow only. Backend untouched. Blumon untouched.

## TL;DR

Replace the 9-step linear AngelPay wizard with an **object-centric panel** showing all merchant configuration as a grid of cards. The same component serves both **setup** (atomic create at the end) and **edit** (per-card save). State is held in a useReducer + localStorage during setup so the operator never loses work to a browser crash or a server error. The backend endpoint that performs the atomic create is unchanged, and no Blumon code is touched.

## Goal

Replace the current `AngelPayWizard.tsx` (linear 9-step back/next) with a panel UX that fixes the actual pain points the operator hit during use:

- Errors at the last step (e.g., 409 "slot ocupado") wasted the prior 8 steps of work.
- The big picture of a merchant's configuration was never visible while filling it in.
- Editing one piece later required re-running the wizard or calling the API directly.
- Multi-merchant per venue felt awkward in a single linear flow.

The replacement must also satisfy a hard constraint: **zero impact on the Blumon flow or any shared dependency**.

## Background

The operator (Jose) is doing this 3-4 times per week during onboarding cycles, then mostly editing single pieces during steady state. The wizard pattern fits poorly for both — too rigid for setup (a mid-flow error loses everything) and too clumsy for edit (a single change requires re-running the wizard or calling the API directly).

Architectural context already in place from prior work:

- `MerchantRevenueShare` model + `computeRevenueSplit` pure function (revenue-share spec, 2026-05-22).
- The `full-setup-angelpay` atomic backend endpoint that creates the AngelPay account, merchant, slot binding, terminal links, cost structure, pricing structure and settlement configurations in one transaction.
- Per-piece CRUD endpoints: `/cost-structures`, `/venue-pricing-structures`, `/settlement-configurations`, `/merchant-revenue-shares`.
- Shared edit dialogs already built: `CostStructureDialog`, `VenuePricingStructureDialog`, `RevenueShareEditDialog`, `SettlementCardDialog` (with 4 inputs per card type).
- Existing fix: slot validation in the wizard's `stepValid` (we just shipped this in the AngelPay wizard fixes).

## Decisions

### Primary use case · setup-first with edit-friendly second

Most invocations are first-time setup; editing is the secondary use case but must still be smooth. Design priority: optimize setup completion; ensure individual edits don't require re-running the setup.

### Required vs optional pieces at setup

Six pieces are required to consider a merchant operational. Two are optional with visible status:

| Piece | Required? | Default behavior if not configured |
|---|---|---|
| Venue | Required | n/a — can't operate without venue |
| AngelPay user account (email + PIN) | Required | n/a — TPV can't log in |
| Merchant (externalMerchantId + affiliation) | Required | n/a — transactions can't route |
| Slot (PRIMARY / SECONDARY / TERTIARY) | Required | n/a — VenuePaymentConfig incomplete |
| Cost structure (provider → Avoqado) | Required | n/a — TransactionCost would have providerRate=0 |
| Pricing structure (Avoqado → venue) | Required | n/a — venue would pay $0 |
| Settlement (T+N per card type) | Required *with default T+1 pre-filled* | If missing entirely, settlement job has no config for this merchant. Pre-filling T+1 hábiles + 23:00 MX prevents the operator from omitting it accidentally |
| Revenue share (Avoqado / aggregator split) | Optional | Falls back to "100% Avoqado" (legacy behavior). Visible "configurar" badge until set |
| Terminal assignment | Optional | Configured later via the terminals page when the physical device ships. Visible "asignar terminales" badge |

### Layout · hub-and-spoke (object-centric panel)

The panel is the single screen. It shows a grid of cards, one per piece, each card showing status (✓ done · pending · ⚠ blocked · default value applied · skipped). Clicking a card opens a focused modal scoped to that piece. Saving in the modal returns the operator to the panel; the card status updates.

A header at the top of the panel shows progress ("4 de 7 obligatorios ✓ · 1 opcional configurado") and the Activar merchant button, which is enabled only when all 7 required cards are valid.

This is the pattern AWS, Vercel, Linear and Notion use for complex resource configuration. The user understands the whole system at a glance, can fix any piece in isolation, and the same component serves both setup and edit.

### Atomicity · atomic at the end with localStorage draft

While in setup mode the panel keeps all state in a `useReducer`, mirrored to localStorage with a 500 ms debounce. Nothing is committed to the database until the operator clicks **Activar merchant**, at which point the full payload goes to the existing `full-setup-angelpay` endpoint as a single atomic transaction. If any piece fails, the backend rolls back and the panel stays open with state intact.

In edit mode (the merchant already exists), each card commits individually via the per-piece CRUD endpoints.

### Scope · AngelPay only · same entry point

The panel replaces the AngelPay wizard at the existing entry point: the **+ Agregar AngelPay** button on `/superadmin/merchant-accounts`. Clicking on an existing merchant in the same page opens the panel in edit mode. No new routes, no nav-bar changes, no impact on the Blumon "Add Account" or "Blumon Auto-Fetch" buttons.

If the panel proves successful, generalizing it to Blumon / Stripe / Mercado Pago is a follow-up — out of scope here.

## Architecture

Five layers from user click to database:

1. **Entry points** (unchanged): `/superadmin/merchant-accounts` page. Two triggers open the panel:
   - **+ Agregar AngelPay** → opens panel in `mode="create"`.
   - Click on an existing merchant card → opens panel in `mode="edit"` with the merchant id.

2. **`MerchantSetupPanel`** (new component, replaces `AngelPayWizard.tsx`): a `FullScreenModal` with a header showing progress + action buttons, and a grid of 9 cards (7 required + 2 optional). Each card opens its own focused modal on click.

3. **Draft storage** (new, used only in setup mode): a `useDraftStorage` hook backed by localStorage. Key shape: `merchant-setup-draft:{venueId}:{userAccountId}`. Saves debounced 500 ms. Cleared on successful activate. Banner on reopen: "Tienes un borrador de [Doña Simona] con 4 de 6 listos. ¿Continuar o descartar?"

4. **Backend** (no changes): the existing `POST /api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay` endpoint is used for the atomic create. Per-card edit dispatches `PUT` to the existing per-piece endpoints (`/cost-structures/:id`, `/venue-pricing-structures/:id`, `/settlement-configurations/:id`, `/merchant-revenue-shares/:id`, `/venue-payment-configs`).

5. **Edit mode hydration**: on opening the panel with a `merchantId`, six TanStack queries in parallel fetch the merchant + AngelPay account + cost + pricing + settlement (4 rows, one per card type) + revenue share. While loading, each card renders a skeleton. When the data lands, each card pre-fills.

### Files

**Created** under `src/pages/Superadmin/components/merchant-accounts/`:

- `MerchantSetupPanel.tsx` — the FullScreenModal with header + grid + footer.
- `merchant-setup-panel/cards/VenueCard.tsx`
- `merchant-setup-panel/cards/AngelPayLoginCard.tsx`
- `merchant-setup-panel/cards/MerchantCard.tsx`
- `merchant-setup-panel/cards/SlotCard.tsx`
- `merchant-setup-panel/cards/CostCard.tsx` — wraps `CostStructureDialog` (reused).
- `merchant-setup-panel/cards/PricingCard.tsx` — wraps `VenuePricingStructureDialog` (reused).
- `merchant-setup-panel/cards/SettlementCard.tsx` — uses the per-card-type settlement dialog already built in the wizard fixes.
- `merchant-setup-panel/cards/RevenueShareCard.tsx` — wraps `RevenueShareEditDialog` (reused).
- `merchant-setup-panel/cards/TerminalsCard.tsx`
- `merchant-setup-panel/useSetupReducer.ts` — reducer with one action type per card + ACTIVATE + LOAD_DRAFT + RESET.
- `merchant-setup-panel/useDraftStorage.ts` — localStorage save/load/clear with debounce and schema-version discard.
- `merchant-setup-panel/types.ts` — shared types for panel state.
- `merchant-setup-panel/__tests__/` — vitest tests for reducer, draft hook, per-card validation.

**Modified** (single targeted change):

- `src/pages/Superadmin/MerchantAccounts.tsx` — change the `onClick` of the **+ Agregar AngelPay** button to open `MerchantSetupPanel` with `mode="create"`. Add a separate handler for clicking on an existing merchant card to open the panel with `mode="edit"`. **The Add Account button and the Blumon Auto-Fetch button are not changed.**

**Deleted** (only after the panel is validated in staging):

- `angelpay-wizard/AngelPayWizard.tsx`
- `angelpay-wizard/wizardReducer.ts`
- `angelpay-wizard/feeTemplate.ts` — its two helpers (`decimalToPercent`, `percentToDecimal`) move to a small `utils/fees.ts` file so the existing tests keep working.
- `angelpay-wizard/AngelPayAccountDetailsDialog.tsx` — moves to `merchant-setup-panel/AngelPayAccountDetailsDialog.tsx`.

**Reused by the panel without modification** (the protection for Blumon's shared dependencies):

- `CostStructureDialog`, `VenuePricingStructureDialog`, `RevenueShareEditDialog`, `MerchantAccountCard`, `AssignAccountToVenueDialog`, `AttachTerminalDialog`, `DeleteConfirmDialog`, `AngelPayCreateTerminalDialog`.

**Not used by the panel, continues to operate independently** (this is what makes the Blumon flow safe):

- `BlumonAutoFetchWizard`, `BatchAutoFetchDialog` — invoked from their own buttons on the same `MerchantAccounts.tsx` page; the panel does not import them.
- Backend `/merchant-accounts/blumon/full-setup` endpoint and the `blumon` service — no calls from the panel.

### Blumon non-impact

Explicit verification that no Blumon code is touched:

- `BlumonAutoFetchWizard.tsx` — not imported by the new panel. Untouched.
- `BatchAutoFetchDialog.tsx` — same. Untouched.
- The Blumon endpoint `/merchant-accounts/blumon/full-setup` and its service — untouched. The new panel uses only the AngelPay endpoint.
- The Blumon services in the backend and the TPV-side services — untouched.
- Shared dialogs (`CostStructureDialog`, etc.) — reused, not modified. If any of these need a change later, it would be a separate PR with explicit regression testing on Blumon.

A regression Playwright test for the Blumon flow is part of the testing strategy below and is a blocking gate before merging.

## Data flow

### Create mode

1. Operator clicks **+ Agregar AngelPay**. `<MerchantSetupPanel mode="create" />` opens.
2. `useDraftStorage` checks localStorage:
   - If a draft exists for this user, show a banner: "Tienes un borrador. ¿Continuarlo o empezar de cero?"
   - If accepted, hydrate the reducer from the draft.
3. Operator fills cards in any order. Each card click opens a focused modal; on save, the modal closes and the reducer updates. Every reducer change debounces a write to localStorage (500 ms).
4. The **Activar merchant** button in the header is enabled when all 7 required cards have valid state. Header shows "4 de 7 listos · Activar habilitado cuando completes los 7".
5. On click, the reducer assembles a `FullSetupAngelPayPayload` and dispatches a POST to `/api/v1/dashboard/superadmin/merchant-accounts/full-setup-angelpay`. If the backend rolls back, see Error handling.
6. On success, if the Revenue Share card was filled, a follow-up non-blocking POST goes to `/merchant-revenue-shares`. A failure here surfaces as a yellow toast but does not block.
7. The draft is cleared, a success toast is shown, the panel closes, and the merchant accounts list re-fetches.

### Edit mode

1. Operator clicks on an existing merchant. `<MerchantSetupPanel mode="edit" merchantId="cm..." />` opens.
2. Six TanStack queries fire in parallel: merchant, AngelPay account, cost structures (4 rows), venue pricing structures (4 rows), settlement configurations (4 rows), revenue share. Each card renders a skeleton while loading.
3. When data arrives, cards pre-fill. Cards for optional pieces that have no row show "+ Configurar".
4. Click a card → modal pre-filled → edit → "Guardar cambios" dispatches a single `PUT` to the corresponding endpoint.
5. On save, the relevant query is invalidated. The card re-renders with the fresh server response. No "Save all" button.

### Validation tiers

- **Card-level**: each modal blocks "Guardar" if its piece is invalid. PIN must be 6 digits. Email regex. Rates 0..100. Slot in `fill` mode must not be occupied. Etc.
- **Panel-level**: the **Activar** button uses a reducer selector that requires all 7 required cards to be in a valid state.
- **Backend Zod + Prisma**: last line of defense. Race conditions (slot gets taken between open and click), malformed data, etc. The toast surfaces the backend's exact error message and the affected card is highlighted.

## Error handling

The principle: **never lose what the operator captured** and **specific errors get specific recoveries**.

### Create mode failures

| Failure | Visible behavior | Recovery |
|---|---|---|
| localStorage corrupt / unreadable | Blue banner: "No pudimos leer tu borrador anterior. Empezamos desde cero." | Continue from empty state. Log to Sentry. |
| Draft schema mismatch (version bump) | Silent discard + same banner as above. | Continue from empty state. |
| Network down at click "Activar" | Red toast: "Sin conexión. Reintenta cuando vuelva." Panel stays open. | localStorage intact. Retry when network returns. |
| Server 500 / timeout | Red toast with backend message if present. Panel stays open. | localStorage intact. Retry. |
| 409 — slot occupied (race condition) | Yellow toast: "El slot PRIMARY se ocupó mientras llenabas. Vuelve a elegir." Auto-scroll to slot card. Slot card reverts to pending. | Reopen slot modal, choose another slot or explicit replace. |
| 409 — externalMerchantId duplicate | Toast: "Ya existe un merchant con ID X. Si es el mismo, usa 'Reusar merchant existente'." Merchant card reverts to pending. | Switch the merchant card to `mode='existing'`. |
| Zod validation error from backend | Red banner at panel top with the validation message. Affected card highlighted with red border + auto-scroll + modal auto-opens. | Fix the offending field. |
| Backend transaction rolled back | Toast with backend detail. Panel open, state intact. DB is clean (nothing partial). | Resolve, retry. |
| Follow-up revenue share POST fails after success | Yellow (not red) toast: "Merchant activado pero el reparto no se guardó: <error>. Lo configuras desde el panel del merchant cuando puedas." Panel closes. | Edit later in edit mode. |
| Browser crash / tab closed | On reopen: banner "Tienes un borrador con N de 6 listos. ¿Continuar o descartar?" | Resume or discard. |
| Accidental "Borrar borrador" click | AlertDialog confirm: "¿Borrar todo lo que tienes capturado? Esto no se puede deshacer." | Cancel or confirm. |

### Edit mode failures

| Failure | Visible behavior |
|---|---|
| One of the six initial queries fails to load | That specific card renders an error state with a "Reintentar" button. Other cards render normally. |
| Individual PUT fails | Modal stays open. Red toast. Form state is preserved (not cleared). Save button re-enables for retry. |
| Race condition — another session edited the same piece | Last-write-wins. Optimistic locking with `updatedAt` is explicitly out of scope (single SUPERADMIN operator in practice). |
| Session expired | The existing Axios interceptor redirects to `/login`. localStorage draft survives the re-login. |
| 403 Permission denied | Panel shows "Solo SUPERADMIN puede editar esto". Already protected at the route level so this shouldn't trigger in practice. |

### TPV-related failures

| Failure | Visible behavior |
|---|---|
| TPV offline | Merchant card shows "TPV no responde. Captura los datos manualmente abajo." Manual entry remains available. |
| Auto-fetch timeout (30 s) | Card shows "No encontramos merchants en este TPV en 30s. ¿Está online el TPV? Reintenta o captura manual." |
| TPV logged in with a different AngelPay account | Banner: "El TPV tiene otra cuenta. Re-loguea en el TPV físico y reintenta." (This is the operational issue surfaced during the recent wizard testing.) |

## Testing strategy

Test pyramid scoped to the new code, plus regression gates.

| Layer | What | Tool |
|---|---|---|
| Unit · reducer | Each reducer action: SET_VENUE clears downstream, SET_SLOT detects conflict against `paymentConfig`, ACTIVATE requires 6 valid, LOAD_DRAFT hydrates correctly, RESET clears state. ~15 cases, TDD. | vitest |
| Unit · draft hook | save / load / clear, 500 ms debounce, schema-version discard, localStorage unavailable (private browsing). | vitest + jsdom |
| Unit · per-card validation | `isValid` of each card — PIN, email, rates 0..1, slot occupancy, etc. | vitest |
| Component · individual cards | Each card renders empty / partial / complete / error states. Click → modal opens. Save → state updates. | vitest + RTL |
| Component · panel | Create vs edit modes. Activar enable/disable. Draft banner. Auto-scroll on 409. | vitest + RTL |
| Backend integration | The existing four integration tests for `full-setup-angelpay` keep passing. Zero changes to the endpoint. | jest existente |
| E2E · happy path | Login → /merchant-accounts → + Agregar AngelPay → fill 6 cards → Activar → verify DB. | Playwright |
| E2E · edit path | Click existing merchant → cards pre-fill → change a rate → save → verify PUT + UI updates. | Playwright |
| E2E · draft recovery | Fill 3 cards → close panel without activating → reopen → banner shows → continue → cards restored. | Playwright |
| E2E · error recovery | Force a 409 by occupying the slot via psql between panel open and click → assert specific toast + slot card highlighted + other cards intact. | Playwright + psql |
| **Regression · Blumon flow** | Add Account button opens the existing Blumon flow OK. Blumon Auto-Fetch works. Blumon merchants appear in the list. **Blocks merge if this fails.** | Playwright |
| **Regression · reports** | available-balance + sales-summary for a venue return identical numbers before and after the change. | curl + diff |

## Migration plan

### Phase 1 · development (isolated worktree)

- Branch `feat/merchant-setup-panel` off `develop`.
- Build the panel + all tests + E2E.
- The old wizard stays in place during development, eligible for deletion at the end of the PR.

### Phase 2 · feature flag decision

Recommendation: **no feature flag**. The current AngelPay wizard is not yet deployed to production (we just finished its fixes in this same branch family). A clean replacement is preferable to permanent dual-code maintenance. If staging surfaces issues, revert is straightforward.

### Phase 3 · pre-deploy verification checklist

- `npm run build` green in both repos
- `npm run lint` green
- vitest suite green (target: 30+ new tests)
- Playwright E2E green (happy + edit + draft + error)
- Playwright Blumon regression green
- Reports regression checked (available-balance + sales-summary unchanged)
- Manual smoke in local: full AngelPay setup with real data
- Manual smoke in local: edit a configured merchant

### Phase 4 · deploy

- Merge to `develop` → auto-deploy to demo + staging.
- Smoke in staging: configure one test merchant + edit one existing + verify Blumon flow + verify reports.
- If green for 24 h on staging, merge `develop` → `main` → production.
- Monitor errors in betterstack for one week post-deploy.

### Phase 5 · cleanup (1-2 weeks post-deploy)

- Delete `angelpay-wizard/AngelPayWizard.tsx` and sibling files (still committed at this point for safety, just unreferenced).
- Update `docs/guides/SETUP_MERCHANT_TUTORIAL.md` with screenshots of the panel.

## Rollback plan

If something breaks in production:

1. Identify whether the failure is in the new panel or in a regressed shared dependency. Blumon regression Playwright would have caught most of the latter, but verify.
2. Mitigate: operator can still configure merchants via direct API call to `full-setup-angelpay` (unchanged endpoint) if urgent. Edit may still be possible via the panel if the bug is only in CREATE.
3. Rollback: `git revert` the panel PR and redeploy the frontend. Cloudflare Pages redeploy is fast (~10 minutes). No backend rollback needed since the endpoint did not change. No schema drift.

The endpoint that performs the atomic create is unchanged through this entire project. That is the rollback guarantee.

## Out of scope

These were considered and explicitly deferred:

- Generalizing the panel to Blumon, Stripe and Mercado Pago. Each provider has quirks (Blumon has an auto-fetch path that differs from AngelPay; Stripe and Mercado Pago have OAuth flows). Doing all in one PR would over-extend scope and risk all of them; we ship AngelPay first.
- A new venue-centric route at `/superadmin/venues/:slug/payments`. Worth doing later but adds nav-bar surface area; not needed to deliver the user's stated value.
- Optimistic locking with `updatedAt` / `If-Match` on edit endpoints. Last-write-wins is acceptable for a single SUPERADMIN operator.
- A draft DB state (`MerchantAccount.status='DRAFT'`). Schema migration in production is risk we don't need to take when localStorage covers the same use case.
- Bulk apply of a revenue share configuration across multiple merchants of an aggregator. Inline edit dialog covers per-merchant configuration adequately.
