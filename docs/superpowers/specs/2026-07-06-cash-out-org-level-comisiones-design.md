# Cash Out — Org-level "Comisiones" section (Dashboard) — Design

**Date:** 2026-07-06
**Author:** Jose Antonio Amieva + Claude
**Repos:** `avoqado-server` (backend) + `avoqado-web-dashboard` (frontend)
**Asana:** "Comisión Cash out" — Bait ↔ Play Telecom, Prioridad Alta, Plataforma Dashboard y TPV (task `1216051980279864`, sección "En Revisión por Isaac").
**Builds on / supersedes the dashboard surface of:** `~/Documents/Programming/Avoqado-HQ/specs/2026-06-25-cash-out-promoter-commissions.md`

---

## 1. Problem / Root cause

The cash-out module shipped, but on the wrong navigation level. Isaac reviews from the
**organization dashboard** (`/organizations/:orgId` — "PlayTelecom · 43 sucursales"), whose
sidebar is `OrgSidebar.tsx`. The Comisiones page + sidebar link (commit `088a53e9`) were added
**only** to the per-venue trees:

- `/venues/:slug/playtelecom/comisiones`
- `/wl/venues/:slug/comisiones` — and the sidebar link only renders in white-label **venue** mode
  (`isWhiteLabelVenue && checkModuleAccess('SERIALIZED_INVENTORY') && role MANAGER+`).

`OrgSidebar.tsx` never got a Comisiones entry, and there is no `/organizations/:orgId/comisiones`
route. Compounding: "Acceso Rápido" in the org sidebar sends the user to `/venues/:slug/home`
(standard mode), where the venue-level Comisiones item is **also** hidden (it requires `/wl/` mode).
Net: from where Isaac sits, the module does not exist.

The original spec (2026-06-25 §166) already prescribed *"Dashboard: new 'Comisiones' section in
white-label sidebar/router (reuse PlayTelecom org page patterns)"* — i.e. **org-level**. Commit
`088a53e9` deviated to venue-level. This design realigns to the original intent.

## 2. Goal

Deliver the **org-level** "Comisiones" section exactly as Isaac's task specifies: one editable
escalated commission table + one ADMIN-defined active-days calendar for the whole PlayTelecom
operation (43 venues), plus an aggregated withdrawals view and a single Finanzas dispersion report.

## 3. Scope decision — Org-only uniform (confirmed from Isaac's materials)

All 9 task images were reviewed. Every one shows **one** table, **one** ADMIN-defined calendar, and
**one** daily dispersion report aggregating all promoters. Nothing asks for per-store tables.

- **Decision:** rules (rate table + active-days) are **org-scoped and uniform** across all venues.
- **No per-venue override UI in v1.** The schema keeps `venueId` columns latent so overrides remain
  possible later with **no migration**.
- **Withdrawals / saldo** stay per-promoter (a promoter belongs to a venue); the org report
  **aggregates** across the org's venues.

### Business rules (from slides 01, 02, 04, 05)

- Only **APROBADA** sales generate `saldo disponible`. Saldo = sale type × its escalated commission.
- ADMIN picks the active days; measured in whole **Lun–Dom** weeks; cash-out and "concurso" are
  mutually exclusive (enforced by day selection).
- Daily corte **18:15**; Finanzas dispersion **19:00**; promoter chooses **Retirar** or **Acumular**
  (accumulated saldo is paid the following Tuesday via the normal cycle).
- Dispersion report rows: promotor, CLABE, monto neto, folios.

## 4. Architecture

### 4.1 Frontend (`avoqado-web-dashboard`)

- **Sidebar:** add a `Comisiones` item to `src/pages/Organization/components/OrgSidebar.tsx`, inside
  the `isWhiteLabelOrg` "Configuración Org." section (next to Control de Stock / Ventas), pointing to
  `/organizations/${orgId}/comisiones`. Icon: `Coins` (or `DollarSign`). i18n keys under
  `organization:sidebar.*`.
- **Route:** add `{ path: 'comisiones', element: <PlayTelecomOrgComisiones /> }` to the
  `/organizations/:orgId` children in `src/routes/router.tsx` (already wrapped by
  `OwnerProtectedRoute` + `OrganizationLayout`). Register the lazy component in
  `src/routes/lazyComponents.ts`.
- **Page:** new `src/pages/playtelecom/Organization/OrgComisionesPage.tsx`, reusing the existing
  venue page UI (`src/pages/playtelecom/Comisiones/ComisionesPage.tsx`) but **org-scoped**:
  - Reads `orgId` from `useParams` / `useCurrentOrganization()` (not `useCurrentVenue`).
  - Editable escalated rate table (Línea Nueva / Portabilidad × accumulated-count tiers).
  - Active-days calendar (ADMIN day-selection).
  - Aggregated withdrawals list + "Generar reporte" (Finanzas dispersion across the org's venues).
  - Reuse existing patterns from `OrgStockControlPage.tsx` (PageTitleWithInfo, GlassCard, tabs).
- **Service:** extend `src/services/cashOut.service.ts` with an org base
  `(orgId) => /api/v1/dashboard/cash-out/orgs/${orgId}` and org variants of getRates/putRates/
  getActiveDays/putActiveDays/getWithdrawals/generateReport. Do **not** duplicate axios/auth/retry
  logic (handled by `src/api.ts`).
- **i18n:** es + en for every new string (superadmin exemption does not apply here). Memoize arrays
  passed to any table. Theme tokens only.

### 4.2 Backend (`avoqado-server`) — no migration required

The schema already carries `orgId` on both config models
(`CashOutCommissionRate`, `CashOutScheduleDay`; `prisma/schema.prisma` ~11481, ~11504) — comment:
*"Org-level config … or venue-level override … Backs the Dashboard 'Comisiones' editable table."*

- **New org endpoints** in `src/routes/dashboard/cash-out.routes.ts`
  (mounted at `/api/v1/dashboard/cash-out`):
  - `GET  /orgs/:orgId/commission-rates`   — `cash-out:read`
  - `PUT  /orgs/:orgId/commission-rates`   — `cash-out:manage`
  - `GET  /orgs/:orgId/active-days`        — `cash-out:read`
  - `PUT  /orgs/:orgId/active-days`        — `cash-out:manage`
  - `GET  /orgs/:orgId/withdrawals`        — `cash-out:read`  (aggregated across org venues)
  - `POST /orgs/:orgId/report`             — `cash-out:report` (aggregated dispersion)
  - Keep the existing `/venues/:venueId/*` endpoints (saldo/withdrawals are legitimately per-venue).
    **But** to preserve the "uniform" guarantee, the venue-level **rate/calendar editing** must not
    write venue-override rows in v1 — make that config read-only on the venue page (or route its
    writes to the org). Only the org page mutates the rate table + calendar.
- **Config service** (`src/services/dashboard/cash-out/cash-out.config.service.ts`): add org-scoped
  read/write that operate on `{ orgId }` rows (mirror the existing venue functions). Module gate
  (`SERIALIZED_INVENTORY`) resolved via any venue in the org.
- **Money-critical — rate & schedule resolution:**
  `cash-out.ledger.service.ts:51` currently reads
  `cashOutCommissionRate.findMany({ where: { venueId, active: true } })` and schedule days by
  `venueId`. Change resolution to **venue-override-if-present, else org** (look up the sale's
  venue → its `organizationId`, read `{ orgId }` rows). In v1 only org rows exist, so this is
  effectively uniform, and the override path is future-proof. **If this is not changed in lockstep,
  promoters resolve to no tier and the domain throws (never silently $0) — no saldo is generated.**
  Apply the same org resolution wherever active-days are read for saldo/withdraw eligibility.
- **Aggregation:** org withdrawals list and dispersion report union across all venues where the org
  has the module, reusing the venue report builder per venue and summing (`totalNet`, `count`).
- **MCP:** update `src/mcp/tools/cash-out.ts` to expose org-level rates/active-days/report (keep-MCP-
  in-sync rule).
- **Zod schemas** (`src/schemas/dashboard/cash-out.schema.ts`): org variants, **Spanish** messages
  (users see them raw), shape/format only — no business logic in Zod.

## 5. Data flow

1. ADMIN (Isaac, OWNER) opens `/organizations/:orgId/comisiones`.
2. Page GETs org rates + active-days → renders editable table + calendar.
3. ADMIN edits → PUT org rates / active-days (writes `{ orgId }` rows).
4. TPV sale APROBADA → ledger materializes a `PromoterCommissionEntry` using **org-resolved** rates
   (venue → org). Saldo accrues per promoter.
5. Promoter chooses Retirar (TPV/back-office) → `CashOutWithdrawal` (per venue/promoter).
6. Corte 18:15 (cron + manual "Generar reporte") → org dispersion report aggregates REQUESTED→REPORTED
   withdrawals across all org venues (promotor, CLABE, monto neto, folios) for Finanzas SPEI at 19:00.

## 6. Testing

- **Backend unit:** org rate resolution (venue→org, override precedence, no-tier→throw), org config
  read/write, org report aggregation across ≥2 venues. Keep the pure-domain tests green.
- **Regression (money):** a sale in a venue with **only org rates** materializes the correct tier
  (this fails before the ledger change, passes after).
- **Frontend E2E (Playwright):** org OWNER sees the Comisiones sidebar item, loads the page, edits a
  rate, toggles an active day, generates a report. Mock APIs per `e2e/fixtures/api-mocks.ts`.
- Build + lint + `test:e2e` green before PR (`.claude/rules/testing-and-git.md`).

## 7. Out of scope (v1)

- Per-venue override **UI** (schema supports it; deferred, no migration).
- Changing the module gate away from `SERIALIZED_INVENTORY` (shipped founder decision; the
  2026-06-25 spec's dedicated `CASH_OUT` module was superseded).
- TPV changes ("Mis Comisiones" already live).

## 8. Migration / data check

Before enabling org resolution, audit prod for any existing `CashOutCommissionRate` /
`CashOutScheduleDay` rows with a non-null `venueId` (likely none — the venue page was effectively
unreachable for Isaac). If found, decide: promote to `orgId` or delete, so no stray venue row
silently overrides the uniform org rule.

## 9. Deploy sequence & cross-repo rules

Server first (endpoints + ledger resolution + tests) → wait stable → dashboard (sidebar + route +
page). Never remove/rename API response fields. Mirror `cash-out:*` permission names exactly across
backend + clients. Update the **MCP tool** in the same change. Cash-out is white-label/free — **no
tier packaging change**, so the sales presentation sync rule does **not** trigger (internal, no new
customer-visible tier).

## 10. Affected files (reference)

**Frontend:** `src/pages/Organization/components/OrgSidebar.tsx`, `src/routes/router.tsx`,
`src/routes/lazyComponents.ts`, `src/pages/playtelecom/Organization/OrgComisionesPage.tsx` (new),
`src/services/cashOut.service.ts`, `src/locales/{es,en}/{organization,playtelecom}.json`, E2E.

**Backend:** `src/routes/dashboard/cash-out.routes.ts`,
`src/services/dashboard/cash-out/cash-out.config.service.ts`,
`src/services/dashboard/cash-out/cash-out.ledger.service.ts`,
`src/controllers/dashboard/cash-out.dashboard.controller.ts`,
`src/schemas/dashboard/cash-out.schema.ts`, `src/mcp/tools/cash-out.ts`, tests.
No Prisma migration.
