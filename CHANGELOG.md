# Changelog - Avoqado Web Dashboard

All notable changes to the web dashboard frontend will be documented in this file.

## [Unreleased]

### Added

- **Dashboard per-terminal scoping for AngelPay approval**: when a venue has >1 ACTIVE NEXGO terminal, each discovered AngelPay merchant row in `DiscoveredMerchantsSubsection` gains a chip strip ("Disponible en terminales") below the slot picker. Default = all eligible terminals selected (= "no per-terminal restriction"). Admin deselects to narrow scope. On Aprobar, the mutation only forwards `terminalIds` to the backend when the admin actually narrowed (selected ≥1 but <total) — selecting all or none = no restriction (sent as `undefined`) so the merchant remains available on every brand-compatible terminal via VenuePaymentConfig inheritance. Falsy "none selected" is treated as "no restriction" instead of "exclude from all terminals" to avoid orphaning the merchant. The chip strip is hidden entirely when there's ≤1 NEXGO terminal (single-terminal venues don't need scoping). `approveDiscoveredAngelPayMerchant` API client refactored to take an object payload `{ venueId, merchantAccountId, slot?, terminalIds? }` (was 3 positional args) — callers in `AngelPayAccount.tsx` and `DiscoveredMerchantsSubsection.tsx` updated. Backend's existing `assertMerchantTerminalCompatible` (Task 11) enforces brand-compat — admins can't accidentally assign an AngelPay merchant to a PAX terminal (server returns HTTP 409). Invalidation extended to refresh `superadmin-terminals-for-angelpay-scoping` / `superadmin-terminals` / `terminals` query keys so the chip strip reflects the new `Terminal.assignedMerchantIds` immediately. Solves the multi-TPV venue case (e.g. Madre Café with rooftop + cafecito + main floor wanting different AngelPay merchants per terminal).
- **Dashboard Option B closure**: "Merchants descubiertos" approve flow now mirrors Blumon — default assigns the merchant to the venue's PRIMARY `VenuePaymentConfig` slot, optional dropdown picker per row to override to Secundario/Terciario. Calls the new backend endpoint `POST /api/v1/superadmin/venues/:venueId/angelpay-merchants/:merchantAccountId/approve` (atomic flip-active + slot-write inside a single Prisma transaction) instead of the bare `PATCH MerchantAccount {active:true}`. Section now shows a top "Slots de pago del venue" Alert banner listing current occupancy (Principal/Secundario/Terciario merchant names, or "vacío") so the admin can see what's taken BEFORE choosing a slot. New `angelpayUserAccountAPI.approveDiscoveredMerchant(venueId, merchantAccountId, slot)` API client method + exported `AngelPayVenuePaymentSlot` type. 409 ConflictError (slot already occupied by another merchant) surfaces a destructive "Slot ocupado" toast with the backend's hint message + suggestion to try another slot. 400 (no config yet + SECONDARY/TERTIARY chosen) surfaces the backend's message verbatim — the picker also disables SECONDARY/TERTIARY items when no `VenuePaymentConfig` exists yet (banner text reinforces "primera aprobación deberá ser al slot Principal"). On success, invalidates `venue-payment-config-for-angelpay-approval`, `merchant-accounts-discovered-angelpay`, `merchant-accounts-all`, `merchant-accounts`, and `venue-payment-config` queries so the row disappears, the occupancy banner refreshes, and the merchant immediately appears on global MerchantAccounts.
- **Dashboard Option B workaround**: `AngelPayAccount.tsx` gains "Merchants descubiertos" section (mounted only when the AngelPay user account is `ACTIVE`) listing every `MerchantAccount` row with `provider.code === 'ANGELPAY'` and `active === false`. Each row shows AngelPay merchant name + affiliation + external ID + "PENDIENTE" yellow badge, with Aprobar (calls `paymentProviderAPI.updateMerchantAccount(id, { active: true })`) and Rechazar (calls `paymentProviderAPI.deleteMerchantAccount(id)`) buttons. Both mutations invalidate `merchant-accounts-discovered-angelpay`, `merchant-accounts-all`, and `merchant-accounts` query keys so approved merchants appear immediately on the global MerchantAccounts page. `paymentProvider.service.ts` `MerchantAccount` interface gains optional `angelpayAffiliation` + `angelpayMerchantName` fields to match the backend display caches added in Task 5. **MVP shortcut**: list is fetched globally (filtered by `providerId=ANGELPAY` + `active=false`) rather than per-venue — the backend `MerchantAccount` model has no direct `venueId` column (venue ↔ merchant link lives in `VenuePaymentConfig`), so per-venue filtering would require either a new audit table tracking `discoveredAt` or persisting the reporting terminal's venue on first discovery — both out of scope for the workaround. Eliminates the need to manually enter AngelPay merchant IDs when onboarding new venues — the TPV bootstraps the merchant list and admin reviews.

### Fixed
- **Dashboard UX**: `ManualAccountDialog` now renders an inline venue picker when AngelPay is selected from the "Todos" page-level venue filter. Previously the operator had to cancel the dialog, change the page filter, and reopen — now they can pick the venue inside the dialog and the existing DeviceCompatibilityBanner + AngelPayUserAccount prerequisite check kick in normally. Fixes the gap flagged in Task 17's report.
- **Dashboard UX**: AngelPay flow renamed "Crear" → "Conectar" (AngelPay creates the account, we connect to it). DeviceCompatibilityBanner gets a "Registrar terminal NEXGO" inline action that opens TerminalDialog without leaving the create-account flow. "Cuenta AngelPay no activa" alert replaces the navigation link with an inline "Conectar cuenta AngelPay" button that opens the new shared `AngelPayConnectDialog`. CreateAccountDialog extracted from AngelPayAccount.tsx → `components/angelpay/AngelPayConnectDialog.tsx` for reuse.

### Added

#### AngelPay multi-merchant — Phase 2 close: assignment filter + nav + sync test (Tasks 18-20 — Phase 2, 2026-05-18)
- **Dashboard UI (Phase 2 close)**: 3 final dashboard tasks. (Task 18) Terminal assignment UI now filters the merchant picker by `getCompatibleBrandsFor(providerCode)` against `terminal.brand` — incompatible merchants hidden in both `TerminalDialog` (superadmin terminal create/edit) and `TerminalAssignmentsDialog` (superadmin merchant-account "Vincular Terminal" flow). Unconstrained providers (STRIPE, MENTA, etc.) and PENDING_ACTIVATION terminals (no brand) remain permissive — matches backend `assertMerchantTerminalCompatible` contract (Task 11). Each surface shows a small inline hint when items are hidden ("N comercio(s) ocultos por incompatibilidad con terminal NEXGO" / "N terminal(es) ocultas: este procesador requiere PAX"). (Task 19) AngelPay account page (Task 16) gets a visible nav entry: new "AngelPay" action button in the `VenueManagement` detail panel, next to existing "Features" / "Cambiar Estado" / "Revisar KYC" — operators reach `/superadmin/venues/:venueId/angelpay-account` without typing the URL. (Task 20) Cross-repo sync test pins `PROVIDER_DEVICE_COMPATIBILITY` between dashboard and `avoqado-server` — regex-extracts and JSON-coerces the backend literal, asserts byte-equivalence, skips gracefully with a warning when the sibling repo isn't checked out (solo dashboard dev not blocked).
- **src/pages/Superadmin/components/TerminalDialog.tsx**: `MerchantPickerSection` gains optional `terminalBrand` prop; merchants whose `provider.code` is in the compatibility map but doesn't include the terminal brand are filtered out before the search filter runs. `MerchantOption.provider` extended with optional `code`. Hint line below the search input reports how many merchants were hidden. Brand change in the form propagates immediately (Select's `onValueChange` already updates `formData.brand`, useMemo recomputes filter).
- **src/pages/Superadmin/components/merchant-accounts/TerminalAssignmentsDialog.tsx**: `availableTerminals` filter now combines the existing "already-assigned" guard with a compatibility check against the merchant account's `provider.code`. Empty-state message reports the hidden-by-brand count and the required brand list ("este procesador requiere PAX o NEXGO").
- **src/pages/Superadmin/VenueManagement.tsx**: new outline action button "AngelPay" using `CreditCard` icon — navigates to `/superadmin/venues/:venueId/angelpay-account`. Placed next to "Features" in the venue detail action row so it follows the established pattern (single-click access to a per-venue subpage).
- **src/lib/__tests__/providerDeviceCompatibility.sync.test.ts** (new): single vitest case that reads `../../../../avoqado-server/src/lib/providerDeviceCompatibility.ts`, extracts the `PROVIDER_DEVICE_COMPATIBILITY` literal via regex, sanitizes (strip comments, strip trailing commas, quote bare keys, single→double quotes), `JSON.parse`s, then `expect(dashboard).toEqual(backend)`. When the sibling repo is missing, the test logs a console.warn and returns (no failure). When the backend literal uses syntax the sanitizer can't handle, the parse failure throws with an explicit "needs an update" message — which is the correct signal that the contract shape changed.

#### AngelPay multi-merchant — MerchantAccount form fields + DeviceCompatibilityBanner (Task 17 — Phase 2, 2026-05-18)
- **Dashboard UI**: MerchantAccount form gains AngelPay-specific path. New `<AngelPayFields>` (externalMerchantId numeric input, affiliation, optional display name) replaces the legacy email/PIN/affiliation/commerceToken block when provider is ANGELPAY — credentials now live on `AngelPayUserAccount` (Task 16), not on `MerchantAccount`. New `<DeviceCompatibilityBanner>` counts active terminals of the compatible brand for the selected venue and gates submit when count is 0 (informational neutral Alert when ≥1, destructive Alert when 0). Form also blocks submit if the venue's `AngelPayUserAccount` is not ACTIVE, with a link to the account management page at `/superadmin/venues/:venueId/angelpay-account` (Task 16). New constant `src/lib/providerDeviceCompatibility.ts` mirrors the backend canonical mapping (`BLUMON: ['PAX']`, `ANGELPAY: ['NEXGO']`) — drift verified by a dedicated CI sync test in Task 20.
- **src/lib/providerDeviceCompatibility.ts** (new): mirror of the backend `PROVIDER_DEVICE_COMPATIBILITY` constant + `getCompatibleBrandsFor(providerCode)` helper.
- **src/pages/Superadmin/components/merchant-accounts/AngelPayFields.tsx** (new): pure presentational component owning no state — `externalMerchantId` input strips non-digits at the source so the value matches the backend `/^\d+$/` regex enforced in Task 10; affiliation + display-name fields posted to the server as `providerConfig.angelpayAffiliation` + `providerConfig.angelpayMerchantName`.
- **src/pages/Superadmin/components/merchant-accounts/DeviceCompatibilityBanner.tsx** (new): fetches `terminalAPI.getAllTerminals({ venueId })` only when the provider is in the constraint map AND a venue is selected; filters to ACTIVE terminals whose `brand` is in the compatible set; emits `onCompatibilityChange(compatible: boolean)` so the parent form can disable submit. Also exports `<ProviderCompatibilityHint>` for inline lightweight uses (kept for Task 18 terminal-assignment view).
- **src/pages/Superadmin/components/merchant-accounts/ManualAccountDialog.tsx**: accepts new optional `venueId` prop. When the provider is ANGELPAY: mounts the banner + a prereq Alert that queries `angelpayUserAccountAPI.get(venueId)` and blocks the form until status is ACTIVE; renders `<AngelPayFields>` in place of the legacy AngelPay block; suppresses the generic External Merchant ID input (AngelPayFields owns it inline). When editing an existing AngelPay account, shows a read-only summary directing the operator to the AngelPay account page for PIN rotation / email changes. AngelPay path forwards `venueId` in the create payload so the backend Task 10 + Task 17 service guard fires (`assertVenueHasCompatibleTerminal` + ACTIVE `AngelPayUserAccount` check).
- **src/pages/Superadmin/MerchantAccounts.tsx**: passes the page-level `selectedVenueId` (when not `'all'`) into `<ManualAccountDialog venueId=...>` so the AngelPay path has a venue context.

#### AngelPay multi-merchant — Account management page (Task 16 — Phase 2, 2026-05-17)
- **Dashboard UI**: AngelPay account management page at `/superadmin/venues/:venueId/angelpay-account`. Empty state with "Crear cuenta AngelPay" CTA when no account exists; detail view with status chip, last-validation info, and action buttons (rotate PIN, mark for rotation, suspend, delete) gated by current status. Consumes the API client added in Task 15. PIN inputs enforce 6-digit numeric. Status transitions DELETED and ACTIVE-restore are intentionally NOT exposed in the UI (restore requires PIN rotation via `setPin()` which is audit-worthy; DELETE is a separate destructive action).
- **src/pages/Superadmin/Venues/AngelPayAccount.tsx** (new): page component plus three co-located sub-components — `CreateAccountDialog`, `RotatePinDialog`, `ReasonDialog` (shared by "mark for rotation" and "suspend"). Status chip color mapping follows the spec (green=ACTIVE, yellow=PIN_ROTATION_REQUIRED, gray=PENDING_PIN, red=SUSPENDED, light-gray=DELETED). `lastValidationErr` truncates at 120 chars with an inline "Ver completo" toggle. Action-button enablement matrix: rotate PIN allowed when status ∈ {PENDING_PIN, PIN_ROTATION_REQUIRED, ACTIVE}; mark-for-rotation only when ACTIVE; suspend blocked when already SUSPENDED or DELETED; delete blocked when already DELETED.
- **src/routes/lazyComponents.ts**: registered new direct export `SuperadminAngelPayAccount`.
- **src/routes/router.tsx**: wired `/superadmin/venues/:venueId/angelpay-account` route under the existing `SuperadminLayout` + `AdminProtectedRoute(SUPERADMIN)` guard.

#### AngelPay multi-merchant — API client + Terminal brand dropdown (Task 15 — Phase 2, 2026-05-17)
- **src/services/superadmin-angelpay-user-account.service.ts** (new): typed wrapper for the 6 backend AngelPay user account superadmin endpoints — `get(venueId)`, `create(venueId, payload)`, `setPin(id, pin)`, `markRotationRequired(id, reason)`, `suspend(id, reason)`, `delete(id)`. Exposes both individual function exports and a grouped `angelpayUserAccountAPI` namespace (matching the `terminalAPI` / `paymentProviderAPI` convention). `pinEncrypted` is intentionally absent from the response type — the server strips ciphertext before responding; PIN is set/rotated only through the dedicated `setPin()` endpoint.
- **src/pages/Superadmin/components/TerminalDialog.tsx**: replaced the free-text `<Input>` for `Terminal.brand` with a `<Select>` restricted to the canonical enum `PAX | NEXGO | INGENICO | VERIFONE`. Exports `TERMINAL_BRAND_OPTIONS` const + `TerminalBrand` type for reuse. Backend data migration (server Task 6) has already normalized all existing brand values to this set.
- **src/pages/Superadmin/Terminals.tsx**: added brand-change warning dialog. When the backend rejects a brand mutation with HTTP 409 + `code: 'TERMINAL_BRAND_CHANGE_BLOCKED'` (server Task 12 — would orphan currently-assigned merchants), the dashboard reads `details.incompatibleMerchants` from the response, opens an AlertDialog titled "Estos merchants quedarán sin asignar" listing each `{ name, code }`, and on "Continuar y desasignar" re-issues the same PATCH with `forceUnassign: true` — letting the backend prune the incompatible merchants atomically with the brand change. Cancel keeps the brand select intact (no extra round-trip needed since the original value is still in `TerminalDialog`'s form state).

#### Merchant Account Deletion UX Improvements (2025-01-06)
- **src/pages/Superadmin/MerchantAccounts.tsx** (lines 85-111, 197-260): Enhanced merchant account deletion handling
  - Added toggle mutation for activating/deactivating accounts
  - Improved error handling to display specific backend error messages
  - Added tooltips to explain action availability
  - Disabled delete button when account is in use (cost structures or venue configs)
  - Added toggle button with visual status indicator (green/muted)
  - Added venue configs count column to table
  - Shows detailed usage information in tooltip ("In use by X cost structure(s), Y venue config(s)")

- **src/services/paymentProvider.service.ts** (lines 38-41): Updated MerchantAccount type
  - Added `venueConfigs` count to `_count` interface

- **src/components/ui/tooltip.tsx**: Imported Radix UI Tooltip components
  - TooltipProvider, Tooltip, TooltipTrigger, TooltipContent

- **.github/workflows/ci-cd.yml** (lines 124, 211, 298): Added Stripe publishable key to all environments
  - Added `VITE_STRIPE_PUBLISHABLE_KEY` to demo, staging, and production builds
  - Fixes Stripe initialization error on deployed environments

#### Activation Code Feature (2025-01-03)
- **src/services/tpv.service.ts** (lines 21-30): Added `generateActivationCode` API service
  - POST endpoint to `/api/v1/dashboard/venues/{venueId}/tpv/{terminalId}/activation-code`
  - Returns activation code with expiration data

- **src/locales/en/tpv.json** (lines 13, 52-53, 150-169): Added English translations for activation feature
  - `actions.generateCode`: "Generate Activation Code"
  - `status.activated`: "Activated"
  - `status.notActivated`: "Not Activated"
  - Complete `activation` namespace with dialog translations, instructions, and messages

- **src/locales/es/tpv.json** (lines 13, 52-53, 150-169): Added Spanish translations for activation feature
  - `actions.generateCode`: "Generar Código de Activación"
  - `status.activated`: "Activado"
  - `status.notActivated`: "Sin Activar"
  - Complete `activation` namespace with dialog translations, instructions, and messages

- **src/pages/Tpv/ActivationCodeDialog.tsx** (NEW FILE - 127 lines): Created activation code dialog component
  - Large, copyable activation code display (text-3xl, monospace font)
  - Copy to clipboard with visual feedback (Check/Copy icon toggle)
  - Expiration date display with format (using date-fns)
  - Days until expiry badge
  - Step-by-step activation instructions with serial number interpolation
  - Toast notifications for copy success/error
  - Responsive dialog layout with muted card background

- **src/pages/Tpv/TpvId.tsx** (lines 25, 45-46, 90-97, 277-305, 861-871, 924-929): Integrated activation code generation
  - Added Key icon import from lucide-react
  - Added imports for ActivationCodeDialog component and generateActivationCode service
  - Added state management for activation dialog (open/close, activation data)
  - Added `generateActivationCodeMutation` with success/error handling
  - Added "Generate Activation Code" button in Quick Actions section (PermissionGate: tpv:update)
  - Button shows loading state during API call
  - ActivationCodeDialog component integration at end of component

- **src/pages/Tpv/Tpvs.tsx** (lines 140-183): Added activation status badge to terminal list
  - Displays "Activated" (green) or "Not Activated" (amber) badge next to operational status
  - Uses `activatedAt` field from API response to determine activation status
  - Styled with theme-aware colors (emerald-50/700 for activated, amber-50/700 for not activated)
  - Small text size (text-xs) for secondary importance

### Technical Details
- All user-facing text uses i18n translations (mandatory per CLAUDE.md)
- Components follow Radix UI + Tailwind CSS pattern
- Mutation uses TanStack Query for state management
- Permission-gated with "tpv:update" permission
- Theme-aware colors (no hardcoded grays)
- Clipboard API for modern copy functionality
- Toast notifications for user feedback
