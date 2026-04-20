**Date:** 2026-04-20 **Owner:** Jaime (SUPERADMIN support workflows) **Status:** Design approved, ready for plan

## Superadmin Impersonation (Read-Only) — Design

## 1. Goal

Allow a logged-in SUPERADMIN to view the dashboard "as" another user (or another role) within the current venue, **without** asking the
customer for their password. Use case: customer reports "I can't see/do X". Today, SUPERADMIN has to either (a) ask for the user's password
(insecure, awkward), or (b) guess at permission config from screenshots. This feature lets SUPERADMIN reproduce the customer's exact
experience instantly.

**Non-goal:** This is NOT a general delegation or "act on behalf of" feature for non-admin users. Only SUPERADMIN.

## 2. Scope & Hard Constraints

| Constraint                 | Decision                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------- |
| Who can impersonate        | Only `StaffRole.SUPERADMIN`                                                                                 |
| Who can be impersonated    | Any non-SUPERADMIN staff active in the current venue + any of the 8 non-SUPERADMIN roles (role-only mode)   |
| Writes while impersonating | **Blocked** (read-only session) — any mutation returns 403                                                  |
| Cross-venue                | Impersonation is scoped to ONE venue; switching venues ends impersonation                                   |
| Session length             | 15 min initial, up to 2×15 min extensions (45 min max)                                                      |
| Persistence                | Cookie is session-scoped (ends on tab close); absolute expiry also enforced server-side                     |
| Audit                      | Every `/start /stop /extend` writes `ActivityLog`; server-side validation always consults `expiresAt` claim |
| Nesting                    | Not supported — must exit before impersonating again                                                        |

## 3. Architecture Decision: Token Model

### 3.1 Why a single cookie + `act` claim (RFC 8693 pattern)

We issue a new `accessToken` with the existing single cookie. The JWT keeps the existing schema and adds one optional claim: `act` (actor).
The `sub` becomes the **impersonated user**; `act.sub` is the **real actor (SUPERADMIN)**.

This reverses the naive design (where `sub` stays as SUPERADMIN and an `imp` claim points to the target). The reason is **failure-mode
safety**: if any code path downstream forgets to check the impersonation state, it defaults to treating the caller as the impersonated user
(less privilege, safer) rather than as the SUPERADMIN (more privilege, unsafe). This aligns with OAuth 2.0 Token Exchange (RFC 8693) and the
design used by Pigment, Salesforce "Login As" (via their "Delegate User" column), and GitHub Enterprise.

### 3.2 JWT shape

**Normal (no impersonation):**

```json
{
  "sub": "staff-superadmin-id",
  "orgId": "...",
  "venueId": "...",
  "role": "SUPERADMIN",
  "jti": "uuid",
  "iat": 0,
  "exp": 86400
}
```

**Impersonating a specific user:**

```json
{
  "sub": "staff-juan-id",
  "orgId": "...",
  "venueId": "...",
  "role": "WAITER",
  "jti": "uuid",
  "act": {
    "sub": "staff-superadmin-id",
    "role": "SUPERADMIN",
    "mode": "user",
    "expiresAt": 1713628800,
    "extensionsUsed": 0,
    "reason": "Ticket #123 - cliente reporta que no ve pagos"
  }
}
```

**Impersonating a role (permission lens, no specific user):**

```json
{
  "sub": "staff-superadmin-id",
  "orgId": "...",
  "venueId": "...",
  "role": "MANAGER",
  "jti": "uuid",
  "act": {
    "sub": "staff-superadmin-id",
    "role": "SUPERADMIN",
    "mode": "role",
    "expiresAt": 1713628800,
    "extensionsUsed": 0
  }
}
```

In role-only mode, `sub === act.sub` (both are SUPERADMIN's staffId). The `act` claim's _presence_ signals "impersonation is active"
regardless of mode; downstream checks key off `act`, not mode.

### 3.3 AuthContext fields

After `authenticateToken` middleware, `req.authContext` gains three derived fields:

```typescript
interface AuthContext {
  // Existing fields
  userId: string // = payload.sub (= impersonated user id when impersonating user)
  orgId: string
  venueId: string
  role: StaffRole // = payload.role (= impersonated role when impersonating)

  // NEW fields (always present, null when not impersonating)
  realUserId: string // = payload.act?.sub ?? payload.sub
  realRole: StaffRole // = payload.act?.role ?? payload.role
  impersonation: {
    mode: 'user' | 'role'
    expiresAt: number
    extensionsUsed: number
    reason?: string
  } | null
}
```

Use semantic helpers (not raw field access) to reduce mistake surface:

- `authContext.userId` → "who do we pretend to be" (for queries, scoping)
- `authContext.realUserId` → "who is physically acting" (for audit logs)
- `authContext.isImpersonating` → boolean helper derived from `!!impersonation`

## 4. Backend Changes

### 4.1 `authenticateToken.middleware.ts`

Add `act` claim decoding:

1. Verify JWT as today (`verifyAccessToken`, HS256).
2. If `payload.act` present:
   - Validate `payload.act.expiresAt > Date.now()`. If expired → 401 `{ code: 'IMPERSONATION_EXPIRED' }`.
   - Populate `realUserId`, `realRole`, `impersonation` from `payload.act`.
3. If not present: `realUserId = sub`, `realRole = role`, `impersonation = null`.

### 4.2 New `impersonationGuard.middleware.ts` (mount AFTER authenticateToken)

Single source of truth for "can this request run under impersonation?"

```
if (!authContext.isImpersonating) → next()

// Time check (defense-in-depth; authenticateToken already did this)
if (Date.now() > impersonation.expiresAt) → 401 IMPERSONATION_EXPIRED

// Allowlist of paths that must work DURING impersonation
const ALLOWLIST = [
  'POST /api/v1/dashboard/impersonation/stop',
  'POST /api/v1/dashboard/impersonation/extend',
  'GET  /api/v1/dashboard/impersonation/status'
]
if (method-path matches ALLOWLIST) → next()

// Block /superadmin/* routes (impersonation should not expose admin-only data)
if (url.startsWith('/api/v1/dashboard/superadmin')) → 403 IMPERSONATION_BLOCKED_ROUTE

// Default-deny: any mutation is blocked
if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') → 403 IMPERSONATION_READ_ONLY

next()
```

This default-deny model means new write endpoints are automatically protected without developer action. Explicit allowlist for impersonation
control endpoints only.

### 4.3 `access.service.ts` — minimal change

Two existing `SUPERADMIN` bypass checks become impersonation-aware:

```typescript
// Before
if (role === StaffRole.SUPERADMIN) {
  bypass
}

// After — only bypass if genuinely SUPERADMIN (not impersonating)
if (effectiveRole === StaffRole.SUPERADMIN && !isImpersonating) {
  bypass
}
```

The 7 occurrences in `access.service.ts` (lines ~144, 190, 284, 368, 384, 440, 471 per 2026-04-20 snapshot) all get the same treatment.
Because `sub` (and therefore `userId` in authContext) is the impersonated user's id during user-mode impersonation, the existing
`getUserAccess(userId, venueId)` call correctly resolves the target's permissions with **zero** changes to the service body for that path.

For role-only mode, we need a small tweak: after `getUserAccess(superadminId, venueId)` returns, override the `role` and re-resolve
`corePermissions` based on the effective role. This can be done in one spot at the tail of `getUserAccess` guarded by
`if (isImpersonating && mode === 'role')`.

### 4.4 New endpoints (`src/routes/dashboard/impersonation.routes.ts`)

| Method | Path                                                           | Permission                          | Body                                                                            | Response                                                                        |
| ------ | -------------------------------------------------------------- | ----------------------------------- | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| `POST` | `/api/v1/dashboard/impersonation/start`                        | Real SUPERADMIN only                | `{ mode: 'user'\|'role', targetUserId?, targetRole?, venueId, reason: string }` | Sets `accessToken` cookie with `act` claim. Returns `{ impersonation: {...} }`. |
| `POST` | `/api/v1/dashboard/impersonation/extend`                       | Must be IN an impersonation session | `{}`                                                                            | Re-issues cookie with new `expiresAt`. Rejects if `extensionsUsed >= 2`.        |
| `POST` | `/api/v1/dashboard/impersonation/stop`                         | Must be IN an impersonation session | `{}`                                                                            | Re-issues cookie WITHOUT `act` claim (back to SUPERADMIN).                      |
| `GET`  | `/api/v1/dashboard/impersonation/eligible-targets?venueId=...` | Real SUPERADMIN only                | —                                                                               | `{ users: [...], roles: [...] }` for the venue's staff + non-SUPERADMIN roles.  |
| `GET`  | `/api/v1/dashboard/impersonation/status`                       | Any authenticated                   | —                                                                               | Current session state (for frontend polling or recovery).                       |

### 4.5 Validation rules in `/start`

Enforced in the service layer, in order:

1. Caller's `realRole === SUPERADMIN`. (Not just `role` — defends against nested impersonation attempts.)
2. `reason` is present and ≥ 10 chars (force meaningful audit).
3. `venueId === authContext.venueId` (can only impersonate within your current session's venue).
4. If `mode === 'user'`:
   - `targetUserId` is required.
   - Target has an active `StaffVenue` at `venueId` (not deleted, not pending invitation).
   - Target's role ≠ `SUPERADMIN`.
   - Target is not the caller (`targetUserId !== realUserId`).
5. If `mode === 'role'`:
   - `targetRole` is required.
   - `targetRole !== SUPERADMIN`.
   - `targetRole` is a valid `StaffRole` enum.

### 4.6 Token revocation (JTI list)

On `/stop` and `/extend`, revoke the previous JWT's `jti` in Redis. `authenticateToken` adds a Redis `SISMEMBER` check for revoked JTIs (TTL
= remaining token lifetime, capped at 24h). Avoqado already has Redis. This prevents:

- Extending a session doesn't leave the pre-extension token valid.
- Stopping impersonation doesn't leave the impersonation token valid until its natural exp.

### 4.7 Audit logging

Every `/start`, `/extend`, `/stop` writes an `ActivityLog`:

```typescript
{
  staffId: realUserId,          // The superadmin (NOT the impersonated user)
  venueId,
  action: 'impersonation.start' | 'impersonation.extend' | 'impersonation.stop',
  entity: 'Staff',
  entityId: sub,                 // The impersonated user (or SUPERADMIN if mode=role)
  data: {
    mode,
    targetUserId,
    targetRole,
    expiresAt,
    extensionsUsed,
    reason,
    ipAddress,
    userAgent
  }
}
```

For future v2: an additional log on EVERY request during impersonation (heavy — defer to feature flag).

### 4.8 Socket.IO

Socket connections authenticate via the same cookie. On `/start` and `/stop`:

- Server emits `impersonation:changed` to the affected user's existing sockets.
- Client-side `SocketContext` listens, disconnects, reconnects (with the new cookie) — this pattern already exists for venue switching.

## 5. Frontend Changes

### 5.1 Picker entry points

**Primary: header button**

- Location: `dashboard.tsx` header (~line 244), to the left of `NotificationBell`.
- Visibility: only when the authenticated user's `realRole === SUPERADMIN`. The button is ALWAYS rendered for SUPERADMIN; its label/style
  transforms based on `isImpersonating` (see 5.2).
- Style (not impersonating): amber→pink gradient pill button, `UserCog` icon (lucide-react), label "Impersonar".
- Tooltip: "Impersonar usuario o rol (⌘⇧I)".

**Secondary: command palette (`DashboardCommandPalette.tsx`)**

- Add two commands: "Impersonar usuario" and "Impersonar rol". Both open the same popover with the correct tab pre-selected.

### 5.2 While impersonating — button behavior

When `authContext.isImpersonating`, the header button transforms into a **red outlined "Salir impersonación"** button (NOT gradient),
destructive styling. Clicking it calls `/stop`.

### 5.3 Picker popover

Radix `Popover` (~420px wide) with:

- Title: "Impersonar en: {venue.name}" with superadmin gradient header.
- Pill-style tabs "Usuario" / "Rol" (matches `.claude/rules/ui-patterns.md` pill-tabs pattern).
- Tab "Usuario":
  - Search input with `useDebounce(300)`.
  - List of eligible staff (from `GET /impersonation/eligible-targets`): avatar + name + role badge + email.
  - Selected row highlighted.
- Tab "Rol":
  - List of 8 non-SUPERADMIN `StaffRole` values with a 1-line description each. Descriptions live in i18n (`es/en/fr` namespaces:
    `impersonation.roles.{ROLE}.description`).
- Shared footer:
  - Textarea: `reason` (required, placeholder "Ej: Ticket #123 - cliente reporta...", min 10 chars).
  - Primary button (amber→pink): "Impersonar" — disabled until a target is selected and reason is valid.

### 5.4 Banner while impersonating

Replaces `SuperadminBanner` (the existing banner element) temporarily when `isImpersonating`:

```
┌─────────────────────────────────────────────────────────────────────┐
│ 🎭 Viendo como Juan Pérez (WAITER) · Read-only · Expira en 28:14  │
│    Motivo: Ticket #123 ...                [Extender +15] [Salir ✕] │
│ ████████████████████░░░░░░░░░░                                      │
└─────────────────────────────────────────────────────────────────────┘
```

Features:

- Sticky top, pushes content down. Diagonal-striped amber→pink gradient (animated) for clear visual distinction from the regular
  SuperadminBanner.
- Countdown updates every second. Color states: default amber/pink → yellow at 3:00 → red at 0:30.
- `Extender` button: `POST /impersonation/extend`. Disabled + tooltip "Máximo 2 extensiones" when `extensionsUsed >= 2`.
- `Salir` button: `POST /impersonation/stop`.
- Mode: "Rol" instead of user name + role when `mode === 'role'`.

### 5.5 Whole-screen visual affordance

When `isImpersonating`, wrap the app shell in a `ring-2 ring-amber-400/40` border with a 2-3px padding buffer. This provides a continuous
peripheral-vision reminder independent of the banner.

### 5.6 Global hook: `useImpersonation`

```typescript
interface StartImpersonationArgs {
  mode: 'user' | 'role'
  targetUserId?: string // required when mode='user'
  targetRole?: StaffRole // required when mode='role'
  reason: string // min 10 chars
}

interface ImpersonationState {
  isImpersonating: boolean
  mode: 'user' | 'role' | null
  targetUserId: string | null
  targetRole: StaffRole | null
  expiresAt: number | null
  extensionsUsed: number
  reason: string | null
  timeRemaining: number | null // ms, updates every second
  startImpersonation: (args: StartImpersonationArgs) => Promise<void>
  extendImpersonation: () => Promise<void>
  stopImpersonation: () => Promise<void>
}
```

State is sourced from `GET /impersonation/status` on mount and kept in React Query. The `timeRemaining` field is computed client-side from
`expiresAt` with a `setInterval(1000)` — NOT polled from backend.

### 5.7 Error and edge states

| Condition                                       | Frontend response                                                                                                                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mutation returns `403 IMPERSONATION_READ_ONLY`  | Toast: "No puedes editar en modo impersonación". The banner's "Salir" button pulses once to draw attention.                                                          |
| Any request returns `401 IMPERSONATION_EXPIRED` | Clear local impersonation state + reload auth status + toast "Sesión de impersonación expiró" + navigate to `/venues/{slug}`.                                        |
| `403 IMPERSONATION_BLOCKED_ROUTE`               | Toast: "Debes salir de impersonación para acceder aquí" with inline "Salir" button.                                                                                  |
| `403 IMPERSONATION_TARGET_INVALID`              | Auto-stop + toast "El usuario que estabas viendo ya no existe".                                                                                                      |
| 404 on a route the target can't see             | A dedicated "NoAccessForImpersonatedUser" component (NOT the generic 404) with: "Este usuario no tiene acceso a esta página. Salir de impersonación para continuar." |

### 5.8 Locale independence (Pigment pattern)

The dashboard's UI language stays in SUPERADMIN's locale — we do NOT switch to the impersonated user's preference. Rationale: the superadmin
is the one debugging; they need the UI in the language they read comfortably. Only _content_ (data) reflects the user's scope.

Implementation: `useTranslation()` hook's language is sourced from SUPERADMIN's `user.locale`, independent of `authContext.userId`.

### 5.9 Auto-exit triggers (client side)

| Trigger                           | Action                                                                          |
| --------------------------------- | ------------------------------------------------------------------------------- |
| Timer reaches 0                   | Auto-call `/stop`, toast, redirect to superadmin dashboard                      |
| User clicks `switchVenue`         | Auto-call `/stop`, then proceed with venue switch                               |
| User navigates to `/superadmin/*` | Modal: "Debes salir de impersonación" [Salir y continuar] [Cancelar]            |
| Tab closed                        | Cookie is session-scoped; on reopen, backend rejects expired `act` claim anyway |
| Logout                            | Cookie destroyed as usual                                                       |

### 5.10 Keyboard shortcut

`⌘⇧I` (Ctrl+Shift+I on non-Mac) opens the picker when available, or triggers "Salir" confirmation when already impersonating. Registered in
a global `useKeyboardShortcuts` hook so it works anywhere in the app.

## 6. Security Model Recap

| Concern                                 | Mitigation                                                                                                                                                   |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Forgotten session leaks elevated access | `sub` = target (safe failure mode); 15 min + max 45 min; session-scoped cookie; auto-exit on venue switch                                                    |
| Bad actor steals SUPERADMIN token       | Existing JWT protections (HS256, HTTP-only cookie, `jti` revocation). Impersonation doesn't weaken this.                                                     |
| Nested impersonation                    | `/start` validates `realRole === SUPERADMIN` (not `role`). Cannot compound.                                                                                  |
| Privilege escalation via target role    | Target role cannot be `SUPERADMIN`. Enforced in `/start` and in `access.service` (SUPERADMIN bypass checks `!isImpersonating`).                              |
| Silent edits under impersonation        | Default-deny middleware + narrow allowlist. New write endpoints auto-protected.                                                                              |
| Audit completeness                      | Every start/extend/stop logged with full context; `ActivityLog.staffId = superadminId` so queries "what did this admin do" capture all impersonation events. |
| Token replay after `/stop`              | `jti` revocation in Redis. Short windows only.                                                                                                               |
| Client lies about timer                 | `expiresAt` is server-signed in the JWT; server validates every request. Client countdown is cosmetic only.                                                  |

## 7. Edge Cases

| Case                                                                | Behavior                                                                                                                                                                                                                                                                                                                                                                   |
| ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Impersonated staff deleted mid-session                              | `impersonationGuard` middleware adds a check for user-mode sessions: before allowing the request, verify that `sub` still has an active `StaffVenue` at `venueId`. If not, return `403 IMPERSONATION_TARGET_INVALID`. Frontend auto-stops. Query is cached per-request to avoid DB hit on every call (Redis cache with 60s TTL is acceptable given short session windows). |
| Impersonated staff's permissions change mid-session                 | Not refetched; session is a snapshot at `/start`. Acceptable given short windows.                                                                                                                                                                                                                                                                                          |
| Impersonated staff is active on TPV simultaneously                  | No conflict — independent sessions (mobile/web).                                                                                                                                                                                                                                                                                                                           |
| SUPERADMIN's own session expires (24h refresh) during impersonation | Refresh flow re-issues JWT _preserving_ `act` claim if `expiresAt` still valid. If `act` expired, re-issues without it.                                                                                                                                                                                                                                                    |
| Two tabs with SUPERADMIN, one starts impersonation                  | Cookie changes in both tabs. Second tab's next request sees impersonated state. Handle gracefully: React Query invalidates `useImpersonation` on `visibilitychange`; banner appears in both.                                                                                                                                                                               |
| Impersonating across white-label vs standard dashboard              | Impersonation respects the current route mode (`/wl/venues/:slug` vs `/venues/:slug`). If target has white-label access disabled, they see a more restricted UI — exactly what we want.                                                                                                                                                                                    |

## 8. Testing Plan

### 8.1 Unit tests (backend)

- `impersonationGuard.middleware.test.ts`: GET allowed, POST blocked, allowlist endpoints allowed, expired → 401, `/superadmin/*` → 403.
- `impersonation.service.test.ts`: all validation rules in `/start`, `extensionsUsed` limit, target validation.
- `access.service.test.ts` (update existing): SUPERADMIN bypass respects `!isImpersonating`, role-mode permission resolution.

### 8.2 Integration tests (backend)

- Full lifecycle: `/start` → `/status` → navigate GET routes → `/extend` → `/stop`.
- Attempt `/start` as non-SUPERADMIN → 403.
- Attempt `/start` with target=SUPERADMIN → 400.
- Timeout: wait past `expiresAt` → any request returns 401.
- `/stop` revokes `jti`: old token rejected on next request.

### 8.3 E2E tests (Playwright)

- SUPERADMIN impersonates WAITER → cannot see "Crear TPV" button → can see tables the WAITER is scoped to → clicks "Salir" → button
  reappears.
- Attempt to submit a form while impersonating → toast appears, form does not submit.
- Impersonation survives page refresh (before expiry).
- Impersonation ends on venue switch.

### 8.4 Security tests

- JWT forgery: craft a token with `act` claim as non-SUPERADMIN → backend rejects.
- Extend without prior `/start` → 400.
- Impersonate self → 400.

## 9. Rollout Plan

### Phase 1 (v1 — this spec)

- Backend middleware, endpoints, audit log.
- Frontend picker, banner, hook.
- Feature flag: `IMPERSONATION_ENABLED` as a new `Module` in the config system (or a simple env var
  `FEATURE_SUPERADMIN_IMPERSONATION=true`).
- Deploy backend first (off). Deploy dashboard next (off).
- Enable in staging for 1 week with internal team testing.
- Enable in demo for 2-3 days.
- Enable in production behind flag for one SUPERADMIN for a week.
- Full rollout to all SUPERADMINs.

### Phase 2 (future, not in this spec)

- Email notification to impersonated user.
- Nested impersonation (if real use case arises).
- Per-request audit logging during impersonation (all GETs too).
- Direct switching between targets without `/stop`.
- Write-capable impersonation with dual-audit (if demand is clear — currently rejected for safety).

## 10. Risks & Open Questions

1. **Hidden `req.user` / deprecated patterns**: the codebase has some legacy `req.user` reads (per memory). Audit every occurrence; ensure
   they read from `authContext` properly. Impersonation doesn't break these, but a missed conversion could leak real-vs-effective identity
   inconsistencies.
2. **`jti` revocation storage size**: 15-45 min windows × expected usage rate → expected <1k keys in Redis concurrently. Acceptable.
3. **WebSocket state sync on `/start` mid-stream**: reconnection pattern exists; verify it propagates the new JWT correctly.
4. **Extensions interplay with refresh tokens**: refresh token is unaffected by impersonation. When the JWT is re-issued via refresh, `act`
   claim is preserved if still within `expiresAt`. This is a small addition in the existing refresh logic.
5. **TPV impersonation**: out of scope. TPV auth is different (device-bound tokens). Future consideration.
6. **Mobile app impersonation**: out of scope. Same reason.

## 11. References

- [RFC 8693 OAuth 2.0 Token Exchange](https://www.rfc-editor.org/rfc/rfc8693.html) — `act` claim spec
- [Pigment: Safe User Impersonation](https://engineering.pigment.com/2026/04/08/safe-user-impersonation/) — read-only enforcement, UI
  affordances, locale rule
- [Salesforce "Login As" with Delegate User audit column](https://developer.salesforce.com/docs/atlas.en-us.securityImplGuide.meta/securityImplGuide/security_overview_auditing.htm)
- [GitHub Enterprise impersonation audit pattern](https://docs.github.com/en/enterprise-server@3.15/admin/managing-accounts-and-repositories/managing-users-in-your-enterprise/impersonating-a-user)
- [Authress: risks of user impersonation](https://authress.io/knowledge-base/academy/topics/user-impersonation-risks)
