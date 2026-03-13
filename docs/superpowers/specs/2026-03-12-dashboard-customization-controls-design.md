# Dashboard Customization Controls — Design Spec

## Problem

The dashboard engine renders a tailored layout per business category, but users cannot personalize their view. Charts in side-by-side rows have inconsistent heights, creating visual misalignment. There is no way to toggle KPIs, reorder sections, or adjust density — features standard in professional dashboards (Square, Toast, Stripe, Geckoboard).

## Design Decisions (Confirmed)

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Philosophy | Smart defaults + toggle controls | Engine provides great defaults; user overrides are optional |
| Control placement | Gear icon in sticky header | Always accessible, never in the way (Square/Toast pattern) |
| Chart alignment | Fixed height per section type | Consistent visual rhythm in split/weighted rows |
| Controls included | KPI selection, layout density, section reorder, reset defaults | User chose 4 of 5 options; excluded show/hide sections |
| Reorder UX | Hybrid: inline edit mode for sections (Shopify/Grafana pattern) | Dragging actual sections > dragging a list of names in a drawer |

## Architecture

### State Shape

```typescript
interface DashboardPreferences {
  version: 1
  kpis: { id: string; visible: boolean; order: number }[]
  rowOrder: string[]       // row IDs in user's preferred order
  density: 'compact' | 'comfortable'
}
```

### Persistence

localStorage keyed by `avoqado:dashboard:preferences:{venueId}` (namespaced colon-separated format, matching SalesSummary's `avoqado:salesSummary:preferences` pattern). No backend changes needed. Version bumps discard old prefs (no migration).

### Hook: `useDashboardPreferences`

```typescript
function useDashboardPreferences(
  venueId: string | null,  // null when no venue selected — returns engine defaults
  resolvedDashboard: ResolvedDashboard
): {
  preferences: DashboardPreferences
  visibleKpis: MetricDefinition[]
  orderedRows: ResolvedRow[]
  density: 'compact' | 'comfortable'
  updateKpis: (kpis: DashboardPreferences['kpis']) => void
  updateRowOrder: (rowIds: string[]) => void
  updateDensity: (density: 'compact' | 'comfortable') => void
  resetDefaults: () => void
}
```

**Behavior:**
- When `venueId` is null, returns engine defaults with no persistence (read-only mode)
- On mount, reads `localStorage.getItem(`avoqado:dashboard:preferences:${venueId}`)`
- If no stored prefs or version mismatch, returns engine defaults
- `visibleKpis` = filtered and reordered MetricDefinitions (min 2, max 6)
- `orderedRows` = resolvedDashboard.rows reordered by `rowOrder`, with new rows (not in stored prefs) appended at the end
- Each setter updates state + writes to localStorage immediately
- `resetDefaults` removes the localStorage key

### Integration Points

**1. DashboardHeader** — Add gear icon button (Settings icon from lucide-react) next to the Export dropdown. Opens a Sheet for KPI/density settings. Also has an "Edit layout" button inside the Sheet that closes the Sheet and activates edit mode.

**2. DashboardRenderer** — Receives `visibleKpis`, `orderedRows`, `density`, and `isEditMode` instead of raw `resolvedDashboard`. Applies density-aware CSS classes. When `isEditMode=true`, wraps each row in a draggable container with dashed borders + section labels.

**3. DashboardMetrics** — Already accepts `metricDefinitions[]`, so it receives the filtered/reordered array from the hook. No changes needed.

**4. Home.tsx** — Adds `useDashboardPreferences` call, manages `isEditMode` state, threads preferences through to DashboardRenderer and DashboardHeader.

## UI Components

### Gear Icon (in DashboardHeader)

- `<Settings className="h-4 w-4" />` icon
- `Button` with `variant="outline"` and `size="sm"`, matching the Export button style
- Positioned after the Export dropdown
- Opens `Sheet` with `side="right"`

### Sheet Panel: `DashboardControlsSheet`

Right-side Sheet (`w-[400px] sm:w-[450px]`, matching existing SalesSummary Sheet pattern). Three sections stacked vertically. Sheet open/close state is managed inside `DashboardHeader` to avoid prop bloat.

**Section 1: KPI Cards**

Title: "Metricas visibles" / "Visible metrics"

Shows the full list of KPIs available for the current category (from `resolvedDashboard.heroKpis`). Each item has:
- Drag handle (GripVertical icon, for reordering within KPIs)
- Checkbox (toggle visibility)
- Metric name (from i18n)
- Metric icon

Uses `@dnd-kit/sortable` for drag-and-drop reorder within the Sheet. Validation: min 2 checked, max 6. If user tries to uncheck below 2, the checkbox is disabled with a tooltip.

Applied vs. Pending pattern: Changes are applied immediately (no Apply button). Each toggle/reorder writes to localStorage via the hook. This is simpler than SalesSummary's pending pattern because the dashboard re-renders cheaply.

**Section 2: Layout Density**

Title: "Densidad del layout" / "Layout density"

Two radio-style options:
- **Compacta** — Tighter gaps (`gap-3`), compact card padding, smaller chart heights (300px)
- **Comoda** — Current defaults (`gap-6`, standard padding, 360px charts)

Visual preview: small inline illustration showing the grid density difference (4 colored rectangles with different spacing).

Applied immediately on selection.

**Section 3: Edit Layout + Reset**

Title: "Orden de secciones" / "Section order"

An "Edit layout" button that:
1. Closes the Sheet
2. Activates inline edit mode on the dashboard (sets `isEditMode=true`)

Below it, a `Button` with `variant="destructive"`:
- Label: "Restaurar defaults" / "Reset to defaults"
- Clears localStorage for this venue
- Resets all controls to engine defaults
- Shows a brief toast confirmation

### Inline Edit Mode (Section Reorder)

When `isEditMode=true`, the dashboard enters a visual editing state (Shopify/Grafana/Datadog pattern):

**Header changes:**
- Date filters, export, and gear icon are hidden
- An indigo gradient badge "EDITANDO LAYOUT" appears
- Two buttons: "Cancelar" (discards changes, exits edit mode) and "Guardar" (persists row order, exits edit mode)

**Dashboard body changes:**
- KPI cards are dimmed (opacity 0.5, not interactive)
- Each chart row gets:
  - A dashed indigo border (`border-2 border-dashed border-indigo-500/35`)
  - A section label at top-left ("SECCION 1", "SECCION 2"...) with drag handle icon
  - `cursor-grab` on hover
- The actively dragged section gets:
  - Solid indigo border + shadow + slight scale
  - A drop zone indicator (indigo line) between rows

**Implementation:**
- Uses `@dnd-kit/sortable` with `DndContext` + `SortableContext` + `KeyboardSensor` + `sortableKeyboardCoordinates` for keyboard accessibility (follow pattern in `Step4Preview.tsx`)
- Items are identified by `row.id`
- On "Guardar": calls `updateRowOrder()` with the new order, exits edit mode
- On "Cancelar": reverts to stored order, exits edit mode
- Edit mode state (`isEditMode`) lives in `Home.tsx`, passed down to `DashboardHeader` and `DashboardRenderer`

### Fixed Chart Heights

Applied as CSS classes on the **wrapper div** inside `ProgressiveChartSection` and `PaymentMethodsPieSection` (the `<div ref={ref}>` and the `<Card>` respectively). Chart components remain untouched — height is enforced at the row-renderer level via `overflow-hidden` on the wrapper.

Heights are responsive — fixed heights only apply at `lg:` breakpoint and above. On mobile, charts use natural height.

| Section Type | Comfortable (lg+) | Compact (lg+) | Mobile |
|-------------|-------------|---------|--------|
| Chart (Recharts) | `lg:h-[360px]` | `lg:h-[300px]` | auto |
| Metric panel (Staff/Table/Product) | `lg:h-[400px]` | `lg:h-[340px]` | auto |
| Table (StaffRanking) | `lg:min-h-[300px]` | `lg:min-h-[260px]` | auto |
| Payment Methods Pie | `lg:h-[360px]` | `lg:h-[300px]` | auto |

Both items in a `split` or `weighted` row share the same fixed height, eliminating the misalignment issue.

Density also affects:
- Inter-section spacing: `DashboardRenderer` wraps rows in a container with `space-y-6` (comfortable) or `space-y-3` (compact), replacing the parent `space-y-4` from Home.tsx
- Row gap within split/weighted: `gap-6` (comfortable) vs `gap-3` (compact)
- KPI card gap: `gap-4` (comfortable) vs `gap-2` (compact)

**Note on render cost during drag reorder:** Progressive chart sections use intersection observer + staleTime. Row reordering only changes DOM order; existing queries keep their cache via staleTime (5 minutes), so reorder does not trigger refetches.

## i18n Keys

Add to `en/home.json` and `es/home.json`:

```json
{
  "controls": {
    "title": "Customize Dashboard",
    "kpis": {
      "title": "Visible metrics",
      "desc": "Choose which KPI cards to show (min 2, max 6)",
      "minWarning": "At least 2 metrics must be visible"
    },
    "density": {
      "title": "Layout density",
      "desc": "Adjust spacing between sections",
      "compact": "Compact",
      "comfortable": "Comfortable"
    },
    "order": {
      "title": "Section order",
      "desc": "Reorder dashboard chart sections",
      "editLayout": "Edit dashboard layout",
      "editLayoutDesc": "Closes this panel and activates edit mode"
    },
    "editMode": {
      "badge": "EDITING LAYOUT",
      "cancel": "Cancel",
      "save": "Save",
      "section": "SECTION {{n}}"
    },
    "reset": {
      "title": "Reset to defaults",
      "desc": "Restore the original dashboard layout",
      "confirm": "Dashboard reset to defaults"
    }
  }
}
```

Spanish translations in `es/home.json`:

```json
{
  "controls": {
    "title": "Personalizar Dashboard",
    "kpis": {
      "title": "Metricas visibles",
      "desc": "Elige que tarjetas de KPI mostrar (min 2, max 6)",
      "minWarning": "Al menos 2 metricas deben estar visibles"
    },
    "density": {
      "title": "Densidad del layout",
      "desc": "Ajusta el espaciado entre secciones",
      "compact": "Compacto",
      "comfortable": "Comodo"
    },
    "order": {
      "title": "Orden de secciones",
      "desc": "Reordena las graficas del dashboard",
      "editLayout": "Editar layout del dashboard",
      "editLayoutDesc": "Cierra este panel y activa el modo de edicion"
    },
    "editMode": {
      "badge": "EDITANDO LAYOUT",
      "cancel": "Cancelar",
      "save": "Guardar",
      "section": "SECCION {{n}}"
    },
    "reset": {
      "title": "Restaurar valores por defecto",
      "desc": "Restaura el layout original del dashboard",
      "confirm": "Dashboard restaurado a valores por defecto"
    }
  }
}
```

French translations in `fr/home.json` (English fallback):

```json
{
  "controls": {
    "title": "Customize Dashboard",
    "kpis": {
      "title": "Visible metrics",
      "desc": "Choose which KPI cards to show (min 2, max 6)",
      "minWarning": "At least 2 metrics must be visible"
    },
    "density": {
      "title": "Layout density",
      "desc": "Adjust spacing between sections",
      "compact": "Compact",
      "comfortable": "Comfortable"
    },
    "order": {
      "title": "Section order",
      "desc": "Reorder dashboard chart sections",
      "editLayout": "Edit dashboard layout",
      "editLayoutDesc": "Closes this panel and activates edit mode"
    },
    "editMode": {
      "badge": "EDITING LAYOUT",
      "cancel": "Cancel",
      "save": "Save",
      "section": "SECTION {{n}}"
    },
    "reset": {
      "title": "Reset to defaults",
      "desc": "Restore the original dashboard layout",
      "confirm": "Dashboard reset to defaults"
    }
  }
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/hooks/use-dashboard-preferences.ts` | Preferences hook (localStorage read/write, validation) |
| `src/components/home/DashboardControlsSheet.tsx` | Sheet panel with KPI selection, density, edit-layout button, reset |
| `src/components/home/DashboardEditMode.tsx` | Inline edit mode wrapper: dnd-kit context, draggable row wrappers, section labels |

## Files to Modify

| File | Change |
|------|--------|
| `src/components/home/sections/DashboardHeader.tsx` | Add gear icon + Sheet. In edit mode: hide filters, show "EDITANDO LAYOUT" badge + Cancel/Guardar |
| `src/components/home/DashboardRenderer.tsx` | Accept preferences + isEditMode, apply density classes + fixed heights, delegate to DashboardEditMode when editing |
| `src/pages/Home.tsx` | Wire up `useDashboardPreferences`, manage `isEditMode` state, pass to header and renderer |
| `src/locales/en/home.json` | Add `controls.*` keys |
| `src/locales/es/home.json` | Add `controls.*` keys |
| `src/locales/fr/home.json` | Add `controls.*` keys (English fallback) |

## Files NOT Modified

- `src/config/dashboard-engine/*` — Registry stays pure; preferences are an overlay
- `src/hooks/useDashboardData.ts` — Data fetching unchanged
- `src/components/home/sections/DashboardMetrics.tsx` — Already data-driven, no changes
- Backend (avoqado-server) — No backend changes needed

## Edge Cases

1. **Venue type changes** — If venue changes category, stored prefs may reference KPIs/rows that no longer exist. The hook filters out unknown IDs and appends new ones from the resolved dashboard.

2. **Engine adds new sections** — New rows not in stored `rowOrder` get appended at the end. User sees them on next load.

3. **Min KPI constraint** — Processing order: (1) filter out unknown IDs from stored prefs, (2) apply visibility prefs, (3) if <2 visible, force the first 2 from the resolved list visible. This ensures the constraint is always met even after category changes.

4. **Multiple venues** — Each venue has its own localStorage key, so preferences are independent.

5. **localStorage unavailable** — Falls back to engine defaults (no persistence, no error).

## Non-Goals

- Backend-stored preferences (future enhancement, not this iteration)
- Show/hide entire chart sections (user explicitly excluded this)
- Custom date range persistence (handled by existing DashboardHeader state)
- KPI pill indicators below header (SalesSummary has these, but dashboard doesn't need them — the gear icon is sufficient)
