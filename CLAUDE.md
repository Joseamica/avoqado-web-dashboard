# CLAUDE.md — Avoqado Web Dashboard

> **Reglas de entorno** — sesiones de IA en paralelo, y cuándo verificar según la carga de la
> máquina — están en el `CLAUDE.md` del workspace (`../CLAUDE.md`), que auto-carga junto con este
> archivo. Léelas antes de correr builds/tests o de tocar git.

## How This Configuration Works

| Layer     | Path                 | Loaded              | Purpose                  |
| --------- | -------------------- | ------------------- | ------------------------ |
| This file | `CLAUDE.md`          | Always              | Router + essentials      |
| Rules     | `.claude/rules/*.md` | Auto, every session | Mandatory coding rules   |
| Guides    | `docs/guides/*.md`   | On demand           | Deep-dive references     |
| Docs      | `docs/`              | On demand           | Full human documentation |

**Rules auto-load** — you don't need to read them manually. Guides are read on demand when working in the relevant area.

When rules conflict: `.claude/rules/` wins > this file > `docs/guides/` > `docs/`

## 🔴 CRITICAL — Ask which payment tier (and how it gets turned on) BEFORE building or changing anything

Avoqado is a tier-gated SaaS (**FREE · PRO · PREMIUM · ENTERPRISE**). Whenever you add a new
feature, modify existing behavior, or expose a new capability, **STOP and ask the founder which
paid tier it falls under** — then wire the gating to match. A change shipped without a tier
decision is unfinished: it either leaks paid value into a lower tier or hides a free capability
behind a paywall. **This is the one client that already enforces tiers** — wire the FeatureGate here.

- **Display/CTA map (this repo):** `src/config/plan-catalog.ts` (`TierId`, `PLAN_TIERS`,
  `getTierForFeature()` → FeatureGate upsell). Route guards: `FeatureProtectedRoute` / `ModuleProtectedRoute`.
- **Backend (authoritative):** `avoqado-server/src/services/access/basePlan.service.ts` +
  `avoqado-server/src/middlewares/checkFeatureAccess.middleware.ts`. Obligatory gating questions:
  `avoqado-server/.claude/rules/feature-gating.md`. PREMIUM-only codes: read `PREMIUM_ONLY_CODES` in `basePlan.service.ts` —
  never trust a copy in a doc (this line listed only 2 of them until 9-oct-2026).
- **Enforcement status:** ✅ this is still the ONLY client enforcing tiers; iOS/Android mirror the codes by exact name (mismatch = silent).
- **Activación (regla completa en `../CLAUDE.md`): aquí vive el switch canónico y la UI de apagado.** Un feature que el cliente debe activar
  y no tiene pantalla de activación en este repo está **incompleto** — un `UPDATE` en Postgres no cuenta como switch. Apagado se ve y se
  explica, nunca desaparece en silencio.

**Maintaining this file:** Short rules (1-3 lines) go directly here. Detailed content (code examples, tables, >10 lines) goes in `docs/` or
`.claude/rules/`. Keep this file under ~200 lines — it loads every session.

---

## 🔴 Comparar contra Square ANTES de juzgar una feature o un bug

Regla completa en `../CLAUDE.md` (auto-carga con este archivo). En corto: **investiga cómo lo hace
Square, compáralo con lo nuestro, y trae las dos versiones al reporte — la decisión se toma entre el
founder y tú.** Lo que parece un bug suele ser una decisión deliberada (caso real: el stock negativo,
que Square permite a propósito y nosotros bloqueábamos). Aquí aplica igual a reportes e historiales:
antes de "arreglar" cómo se ve un dato, verifica qué muestra Square y por qué.

## Identity & Tech Stack

**Avoqado Web Dashboard** — Multi-tenant SaaS dashboard for restaurant/retail management.

React 18 + TypeScript + Vite | Tailwind CSS + Radix UI | TanStack Query | React Router v6 | Firebase Auth | React Hook Form + Zod

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # TypeScript + Vite production build
npm run typecheck    # tsc -b (project references). NOT `npx tsc --noEmit`: the root tsconfig has files: [] and checks nothing
npm run lint         # ESLint
npm run preview      # Preview production build
npm run check:unused # Detect unimported files
npm run test:e2e     # Playwright E2E tests (needs dev server running or auto-starts)
npm run test:e2e:ui  # Playwright visual UI runner
npm run pre-commit   # lint + typecheck + full vitest suite
```

Database: see `.env` for connection credentials (never commit credentials).

**Cross-machine build checks:** `avq-verify` excludes `.env` from the Alienware snapshot; Vite embeds its `VITE_*` values, so different inputs change asset hashes. Compare with the same explicit public test values on both machines and run `npx tsc -b` separately; never transmit private `.env` values. A test-config build does not validate production configuration. Confirmed 9-oct-2026: run `9qUKoj` differed, controlled run `Roo1e8` matched.

## Project Structure

```
src/
├── components/   # Reusable UI (Radix + Tailwind)
├── pages/        # Route components by feature
├── context/      # AuthContext, SocketContext
├── hooks/        # useAccess, useVenueDateTime, useDebounce
├── services/     # API clients (axios)
├── routes/       # Router config + route protection
├── lib/          # Utils + shared libraries
├── locales/      # i18n JSON files (en/, es/; fr/ kept but unsupported since 2026-09-28)
└── types.ts      # Global TypeScript types
```

## Critical Rules (brief — details in `.claude/rules/`)

1. **i18n**: All user-facing text uses `t()`. Superadmin screens exempt. → `critical-warnings.md`
2. **Theme**: No hardcoded colors — use semantic tokens (`bg-muted`, not `bg-gray-200`). → `critical-warnings.md`
3. **Permissions**: `can()` + `<PermissionGate>`. Backend is source of truth. → `critical-warnings.md`
4. **Timezone**: `useVenueDateTime()` — never browser timezone. → `critical-warnings.md`
5. **API prefix**: ALL paths include `/api/v1/`. → `critical-warnings.md`
6. **White-label**: Use `fullBasePath` from `useCurrentVenue()`. → `critical-warnings.md`
7. **Performance**: Memoize DataTable arrays. Debounce search (300ms). → `critical-warnings.md`
8. **Superadmin loading**: `enabled: isSuperadmin` on queries; dynamic `import()`. → `critical-warnings.md`
9. **Route guards**: 6 types — pick the right one (Permission, KYC, Feature, Module, Admin, Super). → `critical-warnings.md`
10. **Control Plane vs App Plane**: Platform-wide → `/superadmin/`. Venue-specific → inline panel. → `critical-warnings.md`
11. **API client**: Don't duplicate retry/auth/offline logic already in `src/api.ts`. → `critical-warnings.md`
12. **UI patterns (READ FIRST)**: Before building ANY UI, read `ui-patterns.md`. Underline tabs (Stripe pattern), Stripe FilterPill filters,
    expandable search, hash tabs, gradient, FullScreenModal. → `ui-patterns.md`
13. **Address inputs**: Always use `<AddressAutocomplete>` (`src/components/address-autocomplete.tsx`) for address fields. Never plain
    `<Input>`. Auto-fills city, state, country, zipCode, lat/lng via Google Places.
14. **Design system**: GlassCard, StatusPulse, MetricCard, Bento grid. → `docs/guides/DESIGN_SYSTEM_GUIDE.md`
15. **No gradients**: NEVER use `bg-gradient-to-*` (deprecated in Tailwind v4). Prefer flat surfaces using semantic tokens. If a gradient is
    genuinely required, use the v4 canonical `bg-linear-to-*` syntax. Avoid creating new gradient surfaces — they tend to read as AI slop
    and are inconsistent with the design system.
16. **Onboarding tours (`driver.js`)**: the project ships interactive step-by-step tours via `driver.js`. Every new primary CTA, wizard
    field, form section, or destination the user is guided toward MUST have a stable `data-tour="<kebab-case-key>"` attribute so tours can
    target it reliably. Never target by class or generated id. Existing hooks: `useProductCreationTour`, `useRecipeCreationTour` (under
    `src/hooks/`). Create a new hook per long flow, reuse the `waitForElement` + `exists` + `onNextClick` pattern for flow-aware
    auto-advance. Full pattern + i18n keys live in `docs/guides/onboarding-tours.md`.
17. **Bounded data without hidden records**: New list components use aggregate endpoints for cards and server pagination/search for rows.
    Never download the full tenant dataset on mount and never silently truncate it; show totals plus pagination/`Cargar más`. Heavy-query
    retry/refetch settings are local, not global. → `.claude/rules/bounded-data-and-query-load.md`

## API Integration

```typescript
// All service calls include /api/v1/ prefix
const response = await api.get('/api/v1/dashboard/venues/{venueId}/resource')

// TanStack Query pattern
const { data } = useQuery({
  queryKey: ['resource', venueId],
  queryFn: () => service.getResource(venueId),
})
```

## Multi-Tenant Architecture

- Routes: `/venues/:slug/[feature]` (regular) or `/wl/venues/:slug/[feature]` (white-label)
- AuthContext manages venue switching and access control
- Each venue has role-based permissions + feature flags
- Control Plane (`/superadmin/`) manages ALL venues globally
- Application Plane (`/venues/:slug/`) is the per-venue experience
- **Feature Registry**: New pages that could be used in white-label dashboards MUST be added to `src/config/feature-registry.ts`. Not needed
  for internal/system pages (Auth, Onboarding, Superadmin, Settings). See: `docs/features/WHITE_LABEL_DASHBOARD.md`

### Auth & Routing Invariants

- **Canonical white-label venue route**: always `/wl/venues/:slug` (never `/wl/:slug`).
- **KYC redirects must be venue-scoped**: use `/:mode/:slug/kyc-required` under venue routes (`/venues/:slug/*` and `/wl/venues/:slug/*`).
- **SUPERADMIN is global**: can access all modules/features/orgs/venues.
- **OWNER is org-scoped**: OWNER access applies only inside organizations where the user is OWNER (not global by highest role).
- **Route guards must use effective venue role**: prefer `staffInfo.role` / `useAccess().role` over raw `user.role` for venue-level
  authorization.

### Recent Auth Hardening (2026-02)

- Fixed KYC guard redirect to route-aware destination for standard + white-label venue paths.
- Unified white-label path generation to `/wl/venues/:slug`.
- Added orgSlug-compatible owner guard behavior for `/wl/organizations/:orgSlug`.
- Hardened invitation acceptance flow to reliably establish session before redirecting from invite flow.
- Reduced stale venue context risk by prioritizing URL slug over stale `activeVenue` in venue resolution.

## Role Hierarchy

VIEWER → HOST → WAITER → CASHIER → KITCHEN → MANAGER → ADMIN → OWNER → SUPERADMIN

See: `docs/architecture/permissions.md`

## Documentation Router

**Architecture**: [overview](docs/architecture/overview.md) | [routing](docs/architecture/routing.md) |
[permissions](docs/architecture/permissions.md)

**Features**: [i18n](docs/features/i18n.md) | [theme](docs/features/theme.md) | [inventory](docs/features/inventory.md) |
[white-label](docs/features/WHITE_LABEL_DASHBOARD.md)

**Verticals**: [PlayTelecom (org vs venue white-label scopes)](.claude/rules/playtelecom-vertical.md)

**Capacity**: [bounded data and query load](.claude/rules/bounded-data-and-query-load.md)

**Guides**: [UI patterns](docs/guides/ui-patterns.md) | [performance](docs/guides/performance.md) |
[design system](docs/guides/DESIGN_SYSTEM_GUIDE.md) | [timezone](docs/guides/TIMEZONE_GUIDE.md) |
[real-time/Socket.IO](docs/guides/REALTIME_GUIDE.md)

**Troubleshooting**: [render loops](docs/troubleshooting/render-loops.md)

**Cross-repo**: [avoqado-server/docs/README.md](../avoqado-server/docs/README.md) — central hub for architecture, DB, payments, inventory
backend

## Environment & Deployment

One environment, deployed via GitHub Actions + Cloudflare Pages: **production** (`dashboard.avoqado.io` → `api.avoqado.io`),
auto-deployed on push to `main`. Push to `develop` only runs tests.

**Demo/staging retired (founder, 2026-10-04):** the Pages project `demo-avoqado-web-dashboard`
(`demo.dashboard.avoqado.io`, `staging.dashboard.avoqado.io`, its `pages.dev`) now serves only a 302 to
`https://dashboard.avoqado.io/signup`. Its production branch is `retirado-a-signup` and its Git previews are off, so a stray
`wrangler pages deploy --branch develop` can no longer replace the redirect. Don't re-add a demo deploy job.

Environment variables are in **GitHub Environments** (NOT Cloudflare Pages UI). Vite injects at build time.

## Cross-Repo Compatibility (TPV Android)

| Repo                     | Deploy Time                |
| ------------------------ | -------------------------- |
| Backend (avoqado-server) | Minutes                    |
| Dashboard (this repo)    | Minutes                    |
| **TPV (avoqado-tpv)**    | **3-5 days** (PAX signing) |

If a dashboard change affects TPV configuration: verify backend supports it, don't assume TPV has latest version.

## UX Design Principle

**Design for the least technical user.** Assume the person using this system has never used a software platform before — they could be
elderly, non-tech-savvy, or simply unfamiliar with SaaS dashboards. Every screen, component, and interaction must be immediately
understandable without a manual. Prefer fewer tabs, fewer options visible at once, and clear visual hierarchy. Labels must be
self-explanatory. When in doubt, simplify — fewer choices beat more flexibility. Beautiful, clean, and obvious always wins over
feature-dense and clever.

## Pre-Deploy Checklist

See `.claude/rules/testing-and-git.md` for full checklist. Minimum:

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] `npm run test:e2e` passes (Playwright E2E)
- [ ] Tested in light + dark modes
- [ ] Tested with multiple roles

> Reglas del workspace que aplican aquí también (MCP en sync, presentación de ventas, adjuntos de Asana, tier, sin red…):
> `../AGENTS.md` y `../CLAUDE.md`, que cargan siempre al abrir desde `Avoqado/`. Copias quitadas el 9-oct-2026 (fase 2b).
