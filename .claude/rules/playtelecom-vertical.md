# PlayTelecom — White-Label Vertical (org vs venue dashboard scopes)

`PlayTelecom` is a custom white-label enterprise client, not a platform feature. Full
business context (who they are, Bait, Walmart/Bodega Aurrerá Express) lives in
`avoqado-server/.claude/rules/playtelecom-vertical.md` — this file covers the dashboard-side
architecture only, in particular **the two white-label dashboard scopes** the founder refers
to as "organizational" and "venue" white-label.

## The two white-label scopes (current routes, verified in `src/routes/router.tsx`)

| Scope | Route | Layout | Gate | What it's for |
|---|---|---|---|---|
| **Organizational** | `/wl/organizations/:orgSlug/*` | `WLOrganizationLayout` | `OwnerProtectedRoute` (org OWNER) | Cross-venue command center: Vision Global, Tiendas List (venue list), Managers Dashboard, Sales Executive/Detail, Reports (coming soon) |
| **Venue** | `/wl/venues/:slug/*` | `Dashboard` (shared `createVenueRoutes()` + WL-only pages) | `ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD"` | Single-store WL dashboard: command-center, stock, sales, promoters, stores, managers, users, tpv-config, supervisor |
| Legacy embed (still live) | `/venues/:slug/playtelecom/*` | `PlayTelecomLayout` | `ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY"` (not `WHITE_LABEL_DASHBOARD`) | Older mount point for the same PT pages, predates the two rows above — don't build new features only here |
| Non-WL org (legacy) | `/organizations/:orgId/*` | — | org membership | Non-white-label org dashboard (e.g. Ventas approval). `useCurrentOrganization().basePath` auto-picks this vs the WL path |

**Detecting "is this org white-label"**: `useIsOrgWhiteLabel(orgId)`
(`src/hooks/useIsOrgWhiteLabel.ts`) — true if ANY venue belonging to that org has the
`WHITE_LABEL_DASHBOARD` module enabled. Needed because org-level pages have no single
"active venue" context to read `activeVenue.modules` from.

## Generic mechanism vs today's bespoke reality

The underlying system is built to be **reusable for a future second white-label client**,
not PT-only:

- `src/config/feature-registry.ts` — catalog of features (`avoqado_core` = reusable, vs
  `module_specific` = vertical-specific), each with lazy component path, routes, config
  schema, default access.
- `src/config/white-label-presets.ts` — per-industry presets (`telecom`, `jewelry`, `retail`,
  `custom`). PT is currently the only real tenant on the `telecom` preset.
- Superadmin `WhiteLabelBuilder` wizard (`src/pages/Superadmin/WhiteLabelBuilder/`, 4 steps:
  Setup → Features → Configuration → Preview) — configures a `Module` row + per-venue
  `VenueModule.config`, no code changes needed for a new client on an existing preset.
- Deep dive on this generic mechanism: `docs/features/WHITE_LABEL_DASHBOARD.md`.

**But today's actual rendered pages are still hardcoded PT components** — `src/pages/
playtelecom/*` (CommandCenter, Stock, Sales, Stores, Promoters, Comisiones, Managers, Users,
TpvConfig, Supervisor, Reporte) are imported by literal name in `router.tsx`, not composed
generically via the feature registry / `DynamicFeatureLoader` for the org-level surface. The
newer `src/pages/organizations/*` (`WLOrganizationLayout`, `WLVisionGlobal`, `WLTiendasList`,
`WLManagersDashboard`, `WLSalesExecutive`, `WLSalesDetail`) is the generalization-in-progress
for the **organizational** scope specifically — still PT's only tenant, but named generically
(`WL...`, not `PlayTelecom...`).

## The rule that matters

Never gate or branch on `venue.slug === 'playtelecom'` or an org name — use the Module
system (`checkModuleAccess`, `ModuleProtectedRoute`, `useWhiteLabelConfig`/
`useIsOrgWhiteLabel`) so a second white-label client (or PT losing the module) doesn't
require new hardcoded branches. Mirrors the same rule in
`avoqado-server/.claude/rules/critical-warnings.md`.

**Never hardcode `/venues/` or `/organizations/` in navigation either** — always
`fullBasePath` (from `useCurrentVenue()`) or `useCurrentOrganization().basePath`, which
already resolve to the correct WL vs non-WL prefix. See `critical-warnings.md` White-Label
rule + the ESLint rule `no-hardcoded-venue-paths.js`.
