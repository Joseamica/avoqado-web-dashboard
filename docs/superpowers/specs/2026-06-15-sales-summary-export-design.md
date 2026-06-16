# Sales Summary — Rich Export Dialog (Design Spec)

**Date:** 2026-06-15
**Status:** Approved design → ready for implementation plan
**Repos:** `avoqado-web-dashboard` (UI) + `avoqado-server` (export endpoint, gating, MCP)
**Route affected:** `/venues/:slug/reports/sales-summary`

## Problem

Today, clicking **Export** on the Sales Summary report opens a small `Popover` with two
radio options ("all data" vs "current view") and builds a CSV by hand, client-side
([`src/pages/Reports/SalesSummary.tsx`](../../../src/pages/Reports/SalesSummary.tsx) ~lines 1015–1069 and 1277–1332).

The founder wants: **when exporting, show a "how do you want to export?" dialog with many
filters** — choice of what comes out, which filters apply, and which file format.

## Decisions (locked)

| Question | Decision |
|----------|----------|
| What comes out | **Both** summary numbers *and* transaction-level detail, selectable via a mode toggle in the dialog |
| Formats | **CSV, Excel (.xlsx), PDF** — all three |
| Filters | Date range, payment method + card type, merchant account, staff/waiter + shift |
| Delivery | **All at once** — build the backend export endpoint as part of this change |
| Architecture | **One cohesive endpoint** `GET /api/v1/dashboard/reports/sales-summary/export` with a `mode=summary\|detailed` param |
| Tier gating | **Detailed** transaction export = new **PREMIUM** feature code `TRANSACTION_EXPORT`. Summary export keeps existing report gating (Free = today-only, Pro = any range) |

## UX flow

Clicking **Export** opens a full-screen dialog (`FullScreenModal` pattern). Top to bottom:

1. **Mode toggle** — `Resumen` (Summary) vs `Transacciones detalladas` (Detailed). The
   Detailed option shows a **PREMIUM** badge; for non-Premium venues it shows the
   FeatureGate upsell instead of being silently usable.
2. **Filter pills** (editable, `FilterPill` pattern), prefilled from the page's current
   filters but changeable inside the dialog:
   - **Date range** — both modes.
   - **Payment method + card type** — both modes (CASH / CARD / QR / OTHER, and for cards
     CREDIT / DEBIT / AMEX / INTERNATIONAL).
   - **Merchant account** — both modes.
   - **Staff/waiter + shift** — **detailed mode only** (hidden/greyed in summary, because
     `getSalesSummary()` filters by bucket, not by individual staff/shift).
3. **What to include**
   - Summary mode: checkboxes for *sections* — Totals, Payment-method breakdown,
     Card-type detail, Merchant-account breakdown, By-period.
   - Detailed mode: **column picker** — date, payment id, waiter, merchant, method, card
     brand/type, last4, amount, tip, total, status, shift, source, international.
4. **Estimated count** — e.g. "≈ 1,234 transacciones" (detailed mode) so the user knows
   the size before exporting.
5. **Format** — CSV / Excel / PDF radio.
6. Header action **Exportar** → downloads the file.

Filters that don't apply to the active mode are hidden so the user can never build an
impossible combination.

## Frontend (`avoqado-web-dashboard`)

- **New component** `SalesSummaryExportDialog` under `src/pages/Reports/`. It composes
  `FullScreenModal` + `FilterPill` + format/column/section sections. The generic
  [`src/components/export-dialog.tsx`](../../../src/components/export-dialog.tsx) stays
  **untouched** — it is read-only w.r.t. filters and has no mode toggle, so a tailored
  dialog is the right call rather than overloading the shared component.
- **Replaces** the current popover + `handleExportCSV` in `SalesSummary.tsx`. The
  client-side CSV builder is removed; all export now flows through the backend endpoint so
  numbers are guaranteed consistent with the on-screen report.
- **Download** via the same `withCredentials` blob + `Content-Disposition` pattern already
  proven in `export-dialog.tsx`. Handle **413** with a friendly "demasiados resultados,
  reduce el rango o usa CSV" message.
- **Conventions**: all text via `t()` with **en + es** keys; theme tokens only (no
  hardcoded grays); `data-tour="sales-summary-export"` on the Export button; memoize any
  arrays passed to lists; reuse `useVenueDateTime()` for date formatting.
- **Gating**: detailed mode wrapped so non-Premium venues see the FeatureGate upsell
  (`getTierForFeature('TRANSACTION_EXPORT')` → PREMIUM).

## Backend (`avoqado-server`)

- **New route** `GET /api/v1/dashboard/reports/sales-summary/export` registered next to the
  existing report route in
  [`src/routes/dashboard/reports.routes.ts`](../../../../avoqado-server/src/routes/dashboard/reports.routes.ts)
  (~lines 87–103). Same middleware as the report:
  `authenticateTokenMiddleware` → `checkPermission('reports:read')` →
  `clampSalesSummaryRangeToToday`.
- **Query params**: `mode` (`summary`\|`detailed`), `format` (`csv`\|`xlsx`\|`pdf`),
  `columns` / `sections` (comma-separated), plus the existing report filter params
  (`startDate`, `endDate`, `paymentMethod`, `cardType`, `merchantAccountId`) and, for
  detailed mode, `staffId`/`staffIds` and `shiftId`.
- **New controller** in `src/controllers/dashboard/sales-summary.dashboard.controller.ts`
  and **service method** in `src/services/dashboard/sales-summary.dashboard.service.ts`:
  - `mode=summary` → call existing `getSalesSummary()`, flatten the totals + chosen
    sections into labeled rows, encode via `encodeExport()`.
  - `mode=detailed` → **PREMIUM-gated** (`checkFeatureAccess('TRANSACTION_EXPORT')` or
    inline entitlement check, mirroring how `ADVANCED_REPORTS` is checked in the report
    controller). Reuse `buildPaymentWhereFilter(paymentMethod, cardType)` (service ~line
    249) plus merchant/staff/shift/date where-clauses, fetch payments, map to chosen
    columns, encode via `encodeExport()`.
- **Row caps**: reuse `EXPORT_ROW_CAP` (10k csv/xlsx) and `EXPORT_PDF_ROW_CAP` (1k) from
  [`src/services/dashboard/export.helpers.ts`](../../../../avoqado-server/src/services/dashboard/export.helpers.ts);
  pre-flight count → **413** when exceeded.
- **Reuse everything** in `export.helpers.ts` for encoding (CSV with UTF-8 BOM, XLSX
  auto-fit, PDF landscape) and `sendExport()` for headers. This is the same path the
  payments/orders exports already use.

## Tier gating

- **New feature code `TRANSACTION_EXPORT` (PREMIUM)**:
  - Backend authority: add to `src/services/access/basePlan.service.ts` and ensure
    `checkFeatureAccess.middleware.ts` recognizes it (alongside existing PREMIUM codes
    `CFDI`, `INVENTORY_TRACKING`).
  - Dashboard display/CTA: add to `src/config/plan-catalog.ts` (`getTierForFeature()` →
    PREMIUM) so the FeatureGate upsell renders correctly.
  - Treat the code like a permission: mirrored by **exact name** on both sides — a
    mismatch fails silently.
- **Summary export** is not separately gated beyond the report itself: Free venues are
  already clamped to today-only by `clampSalesSummaryRangeToToday`; Pro+ get any range.

## MCP (required — keep in lockstep)

- **New MCP tool** `export_sales_summary` in
  [`avoqado-server/src/mcp/tools/sales.ts`](../../../../avoqado-server/src/mcp/tools/sales.ts)
  exposing the same params (`mode`, filters, `format`, `columns`/`sections`). Detailed mode
  honors the same PREMIUM entitlement check.

## Sales presentation (required — keep in lockstep)

Detailed multi-format transaction export is a new customer-visible, Premium-packaged
capability. Update **both** deliverables in
`~/Documents/Programming/Avoqado-HQ/operations/marketing/platform-presentation/`:
the deck (`avoqado-presentacion.html`) and the one-pager (`avoqado-one-pager.html`), then
regenerate both PDFs per that folder's `README.md`.

## Testing

- **Backend unit tests**: summary-mode flattening (sections honored); detailed-mode
  filter/column mapping; PREMIUM gate returns 403 for non-entitled venue; row-cap → 413;
  CSV/XLSX/PDF each produce a valid buffer with correct content-type.
- **Dashboard E2E (Playwright)**: open dialog → summary CSV happy path downloads; detailed
  mode shows the Premium upsell for a non-Premium venue and the column picker for a Premium
  venue. Mock the export endpoint via `page.route()`.
- Pre-deploy: `npm run build`, `npm run lint`, `npm run test:e2e` green; light + dark; spot
  roles (OWNER vs MANAGER) for the gate.

## Out of scope (YAGNI)

- Scheduled / emailed exports.
- Saved export presets.
- Async/background jobs for very large exports — the row cap + 413 message covers this for
  now; revisit only if users hit it.

## Key reference paths (from exploration)

**Dashboard**
- Report page: `src/pages/Reports/SalesSummary.tsx` (export popover ~1277–1332, builder ~1015–1069, filter state ~774–813)
- Generic export dialog (reference, leave intact): `src/components/export-dialog.tsx`
- Full-screen modal: `src/components/ui/full-screen-modal.tsx`
- Filter pill: `src/components/filters/FilterPill.tsx`
- Client export utils (reference): `src/utils/export.ts`
- Plan catalog: `src/config/plan-catalog.ts`

**Server**
- Report route: `src/routes/dashboard/reports.routes.ts` (~87–103)
- Report controller: `src/controllers/dashboard/sales-summary.dashboard.controller.ts` (~44–143)
- Report service (filters at ~249/315/358/375/395): `src/services/dashboard/sales-summary.dashboard.service.ts`
- Export helpers (CSV/XLSX/PDF): `src/services/dashboard/export.helpers.ts`
- Payments export (proven pattern): `src/controllers/dashboard/payment.dashboard.controller.ts` (~268–386)
- Access/plan: `src/services/access/basePlan.service.ts`, `src/middlewares/checkFeatureAccess.middleware.ts`
- MCP sales tools: `src/mcp/tools/sales.ts`
