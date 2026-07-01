# Reasignar SIMs — header button

**Asana:** [1216095149541817](https://app.asana.com/1/12709793723059/project/1213523434401320/task/1216095149541817) (Isaac Mayoral, Bait ↔ Play Telecom)
**Status:** Approved, ready for implementation plan

## Problem

Isaac asked for a dedicated `Reasignar SIMs` entry point on the org-level **Control de Stock** page (`/organizations/:orgId/stock-control`), per his approved mockup: an orange button, positioned immediately to the left of the existing black `Asignar SIMs` button, in the page header toolbar (not inside a tab).

The reassign-promoter functionality itself already exists and ships in production, but only as a plain "outline" button (`Reasignar a Promotor`) buried inside the "Detalle SIMs" tab. Isaac's ask is about **discoverability/placement**, not new business logic — confirmed by re-reading the task's comment thread: he moved the task back to "Pendiente" without further comment after a prior session replied that the feature "already exists," meaning that answer didn't satisfy the request. He wants the button built where his mockup shows it.

## Non-goals

- No changes to the reassign-promoter backend, `reassignSimsToPromoter` service, or `ReassignPromoterDialog`'s internal logic.
- No new "Cambiar Categoría" header button — Isaac's mockup and comment only call for `Reasignar SIMs`.
- No changes to the existing "Reasignar a Promotor" button inside the "Detalle SIMs" tab — it stays as an alternate, tab-local entry point to the same dialog.

## Design

### 1. Unlock the `warning` (orange) semantic color

`src/index.css` already defines raw `--warning` / `--warning-foreground` / `--warning-muted` / `--warning-border` custom properties in both `:root` and `.dark`, but they were never aliased into the `@theme` block with the `--color-` prefix Tailwind v4 requires to generate utility classes (`bg-warning`, `text-warning-foreground`, etc.) — the existing `--color-success`/`--color-destructive`/`--color-info` mappings show the expected pattern, but no `--color-warning*` equivalent exists.

Add 4 lines to the `@theme` block, next to `--color-destructive`:

```css
--color-warning: var(--warning);
--color-warning-foreground: var(--warning-foreground);
--color-warning-muted: var(--warning-muted);
--color-warning-border: var(--warning-border);
```

Side effect (not a separate refactor — same root cause, same fix): this also repairs the currently-dead `.status-warning` badge utility class in the same file, which references `var(--color-warning-muted)` etc. that resolve to nothing today. Verified zero usages of `.status-warning` anywhere in `src/**/*.tsx`, so this is zero-risk.

### 2. Add a `warning` Button variant

`src/components/ui/button.tsx` — add one line to the `buttonVariants` CVA `variant` map, mirroring the existing `destructive` entry:

```ts
warning: 'bg-warning text-warning-foreground shadow hover:bg-warning/90',
```

Reusable, semantic (no hardcoded Tailwind color classes), matches the "no hardcoded colors" rule.

### 3. Wire the button into `OrgStockControlPage.tsx`

File: `src/pages/playtelecom/Organization/OrgStockControlPage.tsx`

- Import `ReassignPromoterDialog` from `./StockControl/components/ReassignPromoterDialog` (already used elsewhere with the same 3-prop shape: `open`, `onOpenChange`, `orgId`).
- Add `isAdminOrAbove` — same computation `OrgDetalleSimsTab.tsx` already uses: `['SUPERADMIN', 'OWNER', 'ADMIN'].includes(currentUserRole ?? '')`, reusing the page's existing `currentUserRole` variable.
- Add `canReassignPromoter = can('sim-custody:reassign') || isAdminOrAbove` — this gates on the actual permission the reassign action requires, matching `OrgDetalleSimsTab.tsx`'s `canReassignPromoter` exactly. (Deliberately *not* reusing `canAssignToSupervisor` — that's a different permission for a different action, `Asignar SIMs`.)
- Add `const [reassignOpen, setReassignOpen] = useState(false)`.
- In the header toolbar `<div className="flex flex-wrap items-center gap-3">`, insert immediately before the `Asignar SIMs` button:
  ```tsx
  {canReassignPromoter && (
    <Button variant="warning" onClick={() => setReassignOpen(true)}>
      Reasignar SIMs
    </Button>
  )}
  ```
- Mount the dialog alongside the existing `AssignToSupervisorDialog` mount:
  ```tsx
  {orgId && canReassignPromoter && (
    <ReassignPromoterDialog open={reassignOpen} onOpenChange={setReassignOpen} orgId={orgId} />
  )}
  ```
  No `preselectedSerials` passed — the dialog's default `mode` is `'search'` and `searchSerials` defaults to `preselectedSerials ?? []`, so it opens on the "Buscar" tab with the `SimMultiSelect` picker empty, ready for the user to search/pick SIMs and a target promoter from scratch. This is existing, already-shipped dialog behavior — verified by reading `ReassignPromoterDialog.tsx` lines 35-67.

### Label / i18n

Hardcoded Spanish string `"Reasignar SIMs"`, matching every sibling button in the same header row (`Asignar SIMs`, `Cargar Items`) and the tab's `Reasignar a Promotor` / `Cambiar Categoría` buttons — none of which use `t()`. This entire PlayTelecom Organization/StockControl module hardcodes Spanish with no `useTranslation` import anywhere in it. Introducing `t()` for only this one new button would be inconsistent with its 3 visual siblings and out of scope for this task (would require touching unrelated files to stay consistent). Confirmed with the founder.

## Data flow

No new data flow. Clicking the header button just opens the same dialog, calling the same already-tested `reassignSimsToPromoter` service on submit, which already has its own success/error toast handling and per-row `BulkResponse` result summary inside `ReassignPromoterDialog`.

## Error handling

Unchanged — inherited entirely from `ReassignPromoterDialog`'s existing mutation/error handling. Nothing new to add.

## Testing

Manual verification only (no new business logic to unit-test):

1. As OWNER/ADMIN/SUPERADMIN or a role with `sim-custody:reassign`: confirm the orange `Reasignar SIMs` button renders immediately left of `Asignar SIMs` in the Control de Stock header.
2. As a role without that permission (e.g. VIEWER): confirm the button does not render.
3. Click it → dialog opens on the "Buscar" tab, empty selection, `SimMultiSelect` searchable.
4. Search a promoter + pick SIMs → submit → confirm the same bulk-result summary UI as the existing tab-local "Reasignar a Promotor" button.
5. Light + dark mode: confirm the orange reads correctly in both (tokens already have light/dark values).
6. `npm run build` + `npm run lint` pass.
