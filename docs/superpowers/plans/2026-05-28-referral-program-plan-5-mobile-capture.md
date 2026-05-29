# Referral Program — Plan 5: Mobile Capture (TPV + Android + iOS)

> **Status:** Plan documented. Implementation NOT started.
>
> **For agentic workers:** Each platform is its own implementation sub-task. Pick the highest-leverage platform first based on actual venue usage.

**Goal:** Add "¿Te recomendó alguien?" field to the payment/cobrar flow in **3 mobile codebases**, calling the backend endpoints from Plan 1 (`POST /referrals/validate` + `POST /referrals/capture`).

**Architecture:** Each mobile app already has a "Cobrar" / payment flow. Add a single optional text field "¿Te recomendó alguien?" above the payment confirmation. On submit: call `validate`, show referrer name if valid, apply 10% discount if validation passes. If validation fails (CODE_NOT_FOUND / EXISTING_CUSTOMER / SELF_REFERRAL), show explicit error. For EXISTING_CUSTOMER specifically, offer manager-override flow (requires `referral:override-existing-customer` permission).

**Backend endpoints (Plan 1, already live):**

```
POST /api/v1/dashboard/venues/:venueId/referrals/validate
  body: { referralCode, newCustomerId }
  → { valid, reason?, referrer?, discountPercent? }

POST /api/v1/dashboard/venues/:venueId/referrals/capture
  body: { referralCode, newCustomerId, capturedByStaffVenueId, intendedOrderId? }
  → Referral

POST /api/v1/dashboard/venues/:venueId/referrals/force-override
  body: { referralCode, existingCustomerId, capturedByStaffVenueId, reason }
  → Referral (with forcedOverride=true)
```

---

## Phase 5A — avoqado-tpv (PAX terminals, Kotlin/Compose)

**Repo:** `/Users/amieva/Documents/Programming/Avoqado/avoqado-tpv`

**Package:** `com.jaac.avoqado_tpv.features.payments` + `.payment` + `.checkout`

**Deploy cycle:** 3-5 days (PAX device signing). Plan first to deploy.

**UX flow in TPV "Cobrar":**

```
┌──────────────────────────────────────────┐
│  Cobrar                                  │
│  Cliente: María López, 5511224455 [+]    │
│                                          │
│  ¿Te recomendó alguien? (opcional)       │
│  ┌────────────────────────────────────┐ │
│  │ AVOQADOW-JOSE2K7  [✓ Validar]     │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ✓ Referido por Jose Pérez               │
│  Se aplicó 10% de descuento ($50 MXN)    │
│                                          │
│  Total: $450 MXN                         │
│  [Cobrar]                                │
└──────────────────────────────────────────┘
```

### Tasks

1. **Data layer**: add `ReferralsApiService` Retrofit interface with `validate`, `capture`, `forceOverride` methods.
2. **Domain**: `ValidateReferralUseCase`, `CaptureReferralUseCase` returning sealed `ValidationResult { Valid, Invalid(reason) }`.
3. **UI**: extend the Compose payment screen with a new `OutlinedTextField` for the code + "Validar" button. State machine: `Idle → Validating → Valid(referrerName, discountPercent) → Captured`. On Valid, modify the order total via existing discount mechanism.
4. **Manager override flow**: if validation returns `EXISTING_CUSTOMER`, show a `Dialog` requiring manager PIN + reason text field. Submit calls `force-override`. Gate by `staffPermission == "referral:override-existing-customer"`.
5. **Search by name fallback**: if staff doesn't have code, button "Buscar por nombre" opens a `BottomSheet` with search → calls `GET /customers/search?q=`. Tap result → fills code field.
6. **Apply discount to Order**: the Order being charged needs the 10% discount applied. Investigate the existing Order discount mechanism in TPV (where promotions / coupons / manager discounts already integrate). Add referral discount as a new source.
7. **Espresso tests**: cover happy path + 4 rejection cases + override path. Use mocked API responses.

### Estimated effort
- 1-2 days dev + 3-5 days PAX signing/deploy cycle = ~1 week total.

---

## Phase 5B — avoqado-android (POS on Android phones/tablets, Kotlin/Compose)

**Repo:** `/Users/amieva/Documents/Programming/Avoqado/avoqado-android`

**Package:** `com.avoqado.pos` with feature modules: `addons`, `articles`, `auth`, `cashdrawer`, `core`, `customers`, `designsystem`, `estimates`, etc.

**Deploy cycle:** Play Store ~1-3 days (faster than TPV — no PAX signing).

**UX flow in Android POS "Checkout":**

Same as TPV — the field appears in the cobrar screen. Additionally, since Android POS handles full order flow (menu → cart → checkout), the field could appear at the cart-confirmation step (before payment method selection) to show the discounted total before card swipe.

### Tasks

1. **Data layer**: add `ReferralsRepository` + Retrofit API service to whatever module hosts API clients (likely `core` or a new `referrals` module).
2. **ViewModel**: `ReferralValidationViewModel` exposing `StateFlow<ValidationState>` for the UI to observe.
3. **UI**: add a Compose section to the existing checkout screen. Place inline after cliente selection, before payment method.
4. **Apply discount**: integrate with the existing Order discount/promotion model in this app.
5. **Manager override**: same as TPV — dialog with manager PIN + reason.
6. **Tests**: ViewModel unit tests + Compose UI tests for the validation flow.

### Estimated effort
- 2-3 days dev (richer surface than TPV: more screens to touch in the order flow).

---

## Phase 5C — avoqado-ios (POS on iPad/iPhone, SwiftUI)

**Repo:** `/Users/amieva/Documents/Programming/Avoqado/avoqado-ios`

**Architecture:** SwiftUI flat-ish structure. Files at root level: `EmailLoginView.swift`, `VenueSwitcherView.swift`, `BluetoothService.swift`, `LoginView.swift`, `avoqado_iosApp.swift`. Investigate further before implementing.

**Deploy cycle:** App Store ~2-7 days review.

### Tasks

1. **Networking**: add `ReferralsService` with `validate`, `capture`, `forceOverride` methods using `URLSession` + `Codable` models.
2. **Models**: `ReferralValidationResult`, `Referrer`, `ValidationReason` enums.
3. **ViewModel** (`@Observable` or `ObservableObject`): `ReferralCheckoutViewModel`.
4. **SwiftUI**: add a `Section` to the checkout view with the code field + validation feedback. Use `.task` or `.refreshable` to call validate.
5. **Apply discount**: integrate with existing Order model in iOS.
6. **Manager override**: native `.alert` with TextField + manager PIN.
7. **Tests**: XCTest for ViewModel + ViewInspector for SwiftUI (if used).

### Estimated effort
- 3-5 days dev (iOS team likely smaller/less familiar with referral patterns).

---

## Priority recommendation

**Sequence by impact:**

1. **5A TPV first** (highest volume — most venues that pay via terminal will use TPV cobrar)
2. **5B Android second** (full POS — many venues use Android tablets, broader UX surface)
3. **5C iOS last** (smaller install base, longest deploy cycle, plus iOS dev usually requires Mac/Xcode environment)

**Alternative parallel approach:** if multiple developers / multiple AI sessions available, dispatch all 3 in parallel since the platforms are independent. Each takes ~3-5 days. Backend coordination cost is zero (same endpoints already live and stable from Plan 1).

---

## Cross-platform invariants

All 3 mobile implementations MUST:

1. **Send `X-App-Version-Code` header** so backend can gate by min version (already a CLAUDE.md ecosystem rule).
2. **Handle `409 PROGRAM_INACTIVE`** by hiding the field entirely (the venue paused referrals).
3. **Handle network errors gracefully** — the field is optional; if validate fails for network reasons, allow proceeding without referrer (don't block payment).
4. **Audit log**: include `capturedByStaffVenueId` in every capture (logged-in staff's ID).
5. **i18n**: prepare strings for Spanish (Mexico) as primary. iOS + Android should use their respective `Localizable.strings` / `strings.xml` files.

---

## NOT in scope of Plan 5

- Card PNG display IN the mobile apps (PNG is for email/social share; mobile apps just need text feedback "Referido por X")
- WhatsApp Business send from mobile (Plan 4 already provides wa.me deep links if needed — mobile can open them via `Intent.ACTION_VIEW` / `UIApplication.shared.open`)
- Offline support for capture (if device is offline, just skip the validation — capture can be retried server-side OR captured later via dashboard)
- Tier-up celebration UI in mobile (the tier celebration is in dashboard for the MANAGER, not in mobile for the customer)

---

## Status across the full feature

| Plan | Repo | Status |
|---|---|---|
| 1 — Backend foundation | avoqado-server | ✅ DONE |
| 2 MVP — Dashboard UI activate flow | avoqado-web-dashboard | ✅ DONE |
| 2 Ext — Dashboard UI Hall of Fame + CustomerDetail card + table | avoqado-web-dashboard | ✅ DONE |
| 3 — Card PNG + Email | avoqado-server | ✅ DONE |
| 4 — WhatsApp helpers (wa.me deep links) | avoqado-server | ✅ DONE |
| **5A — TPV capture** | **avoqado-tpv** | ❌ This plan |
| **5B — Android POS capture** | **avoqado-android** | ❌ This plan |
| **5C — iOS POS capture** | **avoqado-ios** | ❌ This plan |
