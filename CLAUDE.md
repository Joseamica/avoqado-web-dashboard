# CLAUDE.md — Avoqado Web Dashboard

## How This Configuration Works

| Layer | Path | Loaded | Purpose |
|-------|------|--------|---------|
| This file | `CLAUDE.md` | Always | Router + essentials |
| Rules | `.claude/rules/*.md` | Auto, every session | Mandatory coding rules |
| Guides | `docs/guides/*.md` | On demand | Deep-dive references |
| Docs | `docs/` | On demand | Full human documentation |

**Rules auto-load** — you don't need to read them manually. Guides are read on demand when working in the relevant area.

When rules conflict: `.claude/rules/` wins > this file > `docs/guides/` > `docs/`

**Maintaining this file:** Short rules (1-3 lines) go directly here. Detailed content (code examples, tables, >10 lines) goes in `docs/` or `.claude/rules/`. Keep this file under ~200 lines — it loads every session.

---

## Identity & Tech Stack

**Avoqado Web Dashboard** — Multi-tenant SaaS dashboard for restaurant/retail management.

React 18 + TypeScript + Vite | Tailwind CSS + Radix UI | TanStack Query | React Router v6 | Firebase Auth | React Hook Form + Zod

## Commands

```bash
npm run dev          # Vite dev server at http://localhost:5173
npm run build        # TypeScript + Vite production build
npm run lint         # ESLint
npm run preview      # Preview production build
npm run check:unused # Detect unimported files
```

Database: see `.env` for connection credentials (never commit credentials).

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
├── locales/      # i18n JSON files (en/, es/, fr/)
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
12. **UI patterns**: Pill tabs, Stripe filters, expandable search, hash tabs, gradient, FullScreenModal. → `ui-patterns.md`
13. **Address inputs**: Always use `<AddressAutocomplete>` (`src/components/address-autocomplete.tsx`) for address fields. Never plain `<Input>`. Auto-fills city, state, country, zipCode, lat/lng via Google Places.
14. **Design system**: GlassCard, StatusPulse, MetricCard, Bento grid. → `docs/guides/DESIGN_SYSTEM_GUIDE.md`

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
- **Feature Registry**: New pages that could be used in white-label dashboards MUST be added to `src/config/feature-registry.ts`. Not needed for internal/system pages (Auth, Onboarding, Superadmin, Settings). See: `docs/features/WHITE_LABEL_DASHBOARD.md`

### Auth & Routing Invariants

- **Canonical white-label venue route**: always `/wl/venues/:slug` (never `/wl/:slug`).
- **KYC redirects must be venue-scoped**: use `/:mode/:slug/kyc-required` under venue routes (`/venues/:slug/*` and `/wl/venues/:slug/*`).
- **SUPERADMIN is global**: can access all modules/features/orgs/venues.
- **OWNER is org-scoped**: OWNER access applies only inside organizations where the user is OWNER (not global by highest role).
- **Route guards must use effective venue role**: prefer `staffInfo.role` / `useAccess().role` over raw `user.role` for venue-level authorization.

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

**Architecture**: [overview](docs/architecture/overview.md) | [routing](docs/architecture/routing.md) | [permissions](docs/architecture/permissions.md)

**Features**: [i18n](docs/features/i18n.md) | [theme](docs/features/theme.md) | [inventory](docs/features/inventory.md) | [white-label](docs/features/WHITE_LABEL_DASHBOARD.md)

**Guides**: [UI patterns](docs/guides/ui-patterns.md) | [performance](docs/guides/performance.md) | [design system](docs/guides/DESIGN_SYSTEM_GUIDE.md) | [timezone](docs/guides/TIMEZONE_GUIDE.md) | [real-time/Socket.IO](docs/guides/REALTIME_GUIDE.md)

**Troubleshooting**: [render loops](docs/troubleshooting/render-loops.md)

**Cross-repo**: [avoqado-server/docs/README.md](../avoqado-server/docs/README.md) — central hub for architecture, DB, payments, inventory backend

## Environment & Deployment

Three environments deployed via GitHub Actions + Cloudflare Pages:

| Env | URL | API |
|-----|-----|-----|
| Demo | `demo.dashboard.avoqado.io` | `demo.api.avoqado.io` |
| Staging | `staging.dashboard.avoqado.io` | Render staging |
| Production | `dashboardv2.avoqado.io` | `api.avoqado.io` |

Auto-deploy: push to `develop` (demo + staging), push to `main` (production).
Manual: `gh workflow run ci-cd.yml --field environment=demo`

Environment variables are in **GitHub Environments** (NOT Cloudflare Pages UI). Vite injects at build time.

## Cross-Repo Compatibility (TPV Android)

| Repo | Deploy Time |
|------|-------------|
| Backend (avoqado-server) | Minutes |
| Dashboard (this repo) | Minutes |
| **TPV (avoqado-tpv)** | **3-5 days** (PAX signing) |

If a dashboard change affects TPV configuration: verify backend supports it, don't assume TPV has latest version.

## Pre-Deploy Checklist

See `.claude/rules/testing-and-git.md` for full checklist. Minimum:

- [ ] `npm run build` passes
- [ ] `npm run lint` passes
- [ ] Tested in light + dark modes
- [ ] Tested with multiple roles
