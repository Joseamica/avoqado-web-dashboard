# Dashboard Customization Controls — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a gear icon in the dashboard header that opens a settings Sheet (KPI toggle + layout density + reset), plus an inline edit mode for dragging chart sections to reorder them — with fixed chart heights and localStorage persistence per venue.

**Architecture:** Preferences are an overlay on top of the existing dashboard engine registry. A `useDashboardPreferences` hook reads/writes localStorage keyed by venueId, returning filtered KPIs, reordered rows, and density. The Sheet handles settings; inline edit mode (with @dnd-kit) handles spatial reordering of sections directly on the dashboard.

**Tech Stack:** React 18, TypeScript, @dnd-kit/core + @dnd-kit/sortable (already installed), Radix Sheet, Tailwind CSS, i18next

**Spec:** `docs/superpowers/specs/2026-03-12-dashboard-customization-controls-design.md`

---

## File Structure

### New Files

| File | Responsibility |
|------|---------------|
| `src/hooks/use-dashboard-preferences.ts` | localStorage read/write, KPI filtering/ordering, row ordering, density, validation (min 2 KPIs), defaults fallback |
| `src/components/home/DashboardControlsSheet.tsx` | Right-side Sheet with 3 sections: KPI sortable checkboxes, density radio, edit-layout button + reset button |
| `src/components/home/DashboardEditMode.tsx` | DndContext + SortableContext wrapper for rows, draggable row containers with dashed borders + section labels |

### Modified Files

| File | What Changes |
|------|-------------|
| `src/pages/Home.tsx` | Add `useDashboardPreferences` hook, `isEditMode` state, pass preferences to renderer and header |
| `src/components/home/sections/DashboardHeader.tsx` | Gear icon button, receive preferences props for Sheet, conditional edit-mode header (badge + Cancel/Save) |
| `src/components/home/DashboardRenderer.tsx` | Accept `visibleKpis`, `orderedRows`, `density`, `isEditMode`; apply density-aware gaps + fixed heights; wrap rows in edit mode container when editing |
| `src/locales/en/home.json` | Add `controls.*` and `editMode.*` i18n keys |
| `src/locales/es/home.json` | Add `controls.*` and `editMode.*` i18n keys |
| `src/locales/fr/home.json` | Add `controls.*` and `editMode.*` i18n keys (English fallback) |

### NOT Modified

- `src/config/dashboard-engine/*` — Registry stays pure
- `src/hooks/useDashboardData.ts` — Data fetching unchanged
- `src/components/home/sections/DashboardMetrics.tsx` — Already data-driven
- Backend — No changes needed

---

## Chunk 1: Foundation (Preferences Hook + i18n)

### Task 1: Add i18n keys

**Files:**
- Modify: `src/locales/en/home.json`
- Modify: `src/locales/es/home.json`
- Modify: `src/locales/fr/home.json`

- [ ] **Step 1: Add English i18n keys**

Add the `controls` and `editMode` objects inside `en/home.json` (at the root level, after the last existing key). The exact JSON to add:

```json
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
```

- [ ] **Step 2: Add Spanish i18n keys**

Add to `es/home.json`:

```json
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
```

- [ ] **Step 3: Add French i18n keys (English fallback)**

Add to `fr/home.json` — identical to English keys.

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build passes with 0 errors.

- [ ] **Step 5: Commit**

```bash
git add src/locales/en/home.json src/locales/es/home.json src/locales/fr/home.json
git commit -m "feat(i18n): add dashboard customization control keys"
```

---

### Task 2: Create `useDashboardPreferences` hook

**Files:**
- Create: `src/hooks/use-dashboard-preferences.ts`

This is the core state management layer. It reads/writes localStorage and derives filtered KPIs + ordered rows from the resolved dashboard.

- [ ] **Step 1: Create the hook file**

```typescript
// src/hooks/use-dashboard-preferences.ts
import { useState, useMemo, useCallback, useEffect } from 'react'
import type { ResolvedDashboard, ResolvedRow, MetricDefinition } from '@/config/dashboard-engine'

// ── Types ──────────────────────────────────────────────
export interface KpiPreference {
  id: string
  visible: boolean
  order: number
}

export interface DashboardPreferences {
  version: 1
  kpis: KpiPreference[]
  rowOrder: string[]
  density: 'compact' | 'comfortable'
}

// ── Constants ──────────────────────────────────────────
const STORAGE_PREFIX = 'avoqado:dashboard:preferences'
const CURRENT_VERSION = 1
const MIN_VISIBLE_KPIS = 2
const MAX_VISIBLE_KPIS = 6

// ── Helpers ────────────────────────────────────────────
function getStorageKey(venueId: string): string {
  return `${STORAGE_PREFIX}:${venueId}`
}

function readFromStorage(venueId: string): DashboardPreferences | null {
  try {
    const raw = localStorage.getItem(getStorageKey(venueId))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (parsed?.version !== CURRENT_VERSION) return null
    return parsed as DashboardPreferences
  } catch {
    return null
  }
}

function writeToStorage(venueId: string, prefs: DashboardPreferences): void {
  try {
    localStorage.setItem(getStorageKey(venueId), JSON.stringify(prefs))
  } catch {
    // localStorage full or unavailable — silently fail
  }
}

function removeFromStorage(venueId: string): void {
  try {
    localStorage.removeItem(getStorageKey(venueId))
  } catch {
    // silently fail
  }
}

function buildDefaultPreferences(resolved: ResolvedDashboard): DashboardPreferences {
  return {
    version: CURRENT_VERSION,
    kpis: resolved.heroKpis.map((kpi, i) => ({
      id: kpi.id,
      visible: true,
      order: i,
    })),
    rowOrder: resolved.rows.map(r => r.id),
    density: 'comfortable',
  }
}

/**
 * Reconcile stored preferences against the current resolved dashboard.
 * Handles: unknown IDs removed, new IDs appended, min KPI enforcement.
 */
function reconcilePreferences(
  stored: DashboardPreferences,
  resolved: ResolvedDashboard
): DashboardPreferences {
  // ── KPIs ──
  const resolvedKpiIds = new Set(resolved.heroKpis.map(k => k.id))
  // Keep stored KPIs that still exist in resolved
  const reconciledKpis = stored.kpis.filter(k => resolvedKpiIds.has(k.id))
  // Find new KPIs not in stored prefs — append at end, visible by default
  const storedKpiIds = new Set(reconciledKpis.map(k => k.id))
  const newKpis = resolved.heroKpis
    .filter(k => !storedKpiIds.has(k.id))
    .map((k, i) => ({ id: k.id, visible: true, order: reconciledKpis.length + i }))
  let allKpis = [...reconciledKpis, ...newKpis]

  // Enforce min 2 visible
  const visibleCount = allKpis.filter(k => k.visible).length
  if (visibleCount < MIN_VISIBLE_KPIS) {
    let needed = MIN_VISIBLE_KPIS - visibleCount
    allKpis = allKpis.map(k => {
      if (!k.visible && needed > 0) {
        needed--
        return { ...k, visible: true }
      }
      return k
    })
  }

  // ── Rows ──
  const resolvedRowIds = new Set(resolved.rows.map(r => r.id))
  const reconciledRowOrder = stored.rowOrder.filter(id => resolvedRowIds.has(id))
  const storedRowIds = new Set(reconciledRowOrder)
  const newRowIds = resolved.rows.filter(r => !storedRowIds.has(r.id)).map(r => r.id)

  return {
    version: CURRENT_VERSION,
    kpis: allKpis,
    rowOrder: [...reconciledRowOrder, ...newRowIds],
    density: stored.density,
  }
}

// ── Hook ───────────────────────────────────────────────
export function useDashboardPreferences(
  venueId: string | null,
  resolvedDashboard: ResolvedDashboard
) {
  const [preferences, setPreferences] = useState<DashboardPreferences>(() => {
    if (!venueId) return buildDefaultPreferences(resolvedDashboard)
    const stored = readFromStorage(venueId)
    if (!stored) return buildDefaultPreferences(resolvedDashboard)
    return reconcilePreferences(stored, resolvedDashboard)
  })

  // Derive visible, ordered KPIs
  const visibleKpis = useMemo(() => {
    const kpiMap = new Map(resolvedDashboard.heroKpis.map(k => [k.id, k]))
    return preferences.kpis
      .filter(k => k.visible)
      .sort((a, b) => a.order - b.order)
      .map(k => kpiMap.get(k.id))
      .filter((k): k is MetricDefinition => !!k)
  }, [preferences.kpis, resolvedDashboard.heroKpis])

  // Derive ordered rows
  const orderedRows = useMemo(() => {
    const rowMap = new Map(resolvedDashboard.rows.map(r => [r.id, r]))
    return preferences.rowOrder
      .map(id => rowMap.get(id))
      .filter((r): r is ResolvedRow => !!r)
  }, [preferences.rowOrder, resolvedDashboard.rows])

  // Re-initialize when venueId or resolvedDashboard changes (venue switch, category change)
  useEffect(() => {
    if (!venueId) {
      setPreferences(buildDefaultPreferences(resolvedDashboard))
      return
    }
    const stored = readFromStorage(venueId)
    if (!stored) {
      setPreferences(buildDefaultPreferences(resolvedDashboard))
    } else {
      setPreferences(reconcilePreferences(stored, resolvedDashboard))
    }
  }, [venueId, resolvedDashboard])

  // ── Setters (functional form to avoid stale closures) ──
  const updateKpis = useCallback((kpis: KpiPreference[]) => {
    setPreferences(prev => {
      const next = { ...prev, kpis }
      if (venueId) writeToStorage(venueId, next)
      return next
    })
  }, [venueId])

  const updateRowOrder = useCallback((rowIds: string[]) => {
    setPreferences(prev => {
      const next = { ...prev, rowOrder: rowIds }
      if (venueId) writeToStorage(venueId, next)
      return next
    })
  }, [venueId])

  const updateDensity = useCallback((density: 'compact' | 'comfortable') => {
    setPreferences(prev => {
      const next = { ...prev, density }
      if (venueId) writeToStorage(venueId, next)
      return next
    })
  }, [venueId])

  const resetDefaults = useCallback(() => {
    const defaults = buildDefaultPreferences(resolvedDashboard)
    setPreferences(defaults)
    if (venueId) removeFromStorage(venueId)
  }, [resolvedDashboard, venueId])

  return {
    preferences,
    visibleKpis,
    orderedRows,
    density: preferences.density,
    updateKpis,
    updateRowOrder,
    updateDensity,
    resetDefaults,
  }
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes. The hook is not yet imported anywhere, so this just validates types.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/use-dashboard-preferences.ts
git commit -m "feat: add useDashboardPreferences hook with localStorage persistence"
```

---

## Chunk 2: Settings Sheet (KPI Toggle + Density)

### Task 3: Create `DashboardControlsSheet`

**Files:**
- Create: `src/components/home/DashboardControlsSheet.tsx`

**Reference files for patterns:**
- `src/components/draggable-multi-select.tsx` — dnd-kit sortable pattern (PointerSensor, closestCenter, arrayMove, useSortable, CSS transform)
- `src/pages/Reports/SalesSummary.tsx` — Sheet import pattern (`Sheet, SheetContent, SheetHeader, SheetTitle`)
- `src/components/ui/sheet.tsx` — Sheet component API
- `src/hooks/use-toast.ts` — `useToast()` for reset confirmation

- [ ] **Step 1: Create the Sheet component**

```typescript
// src/components/home/DashboardControlsSheet.tsx
import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  closestCenter,
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical, Pencil, RotateCcw } from 'lucide-react'

import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'

import type { MetricDefinition } from '@/config/dashboard-engine'
import type { KpiPreference } from '@/hooks/use-dashboard-preferences'

// ── Icon map (same as DashboardMetrics.tsx) ──
// We import this inline to keep the component self-contained.
// Only need the icon name → we render a small colored dot instead of the full icon.

// ── Sortable KPI Item ──
function SortableKpiItem({
  kpi,
  pref,
  onToggle,
  disableUncheck,
  t,
}: {
  kpi: MetricDefinition
  pref: KpiPreference
  onToggle: (id: string) => void
  disableUncheck: boolean
  t: (key: string) => string
}) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: kpi.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isCheckDisabled = disableUncheck && pref.visible

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 px-3 py-2.5 bg-muted/30 rounded-lg border border-input hover:bg-muted/50 transition-colors"
    >
      <button
        type="button"
        className="cursor-grab active:cursor-grabbing touch-none text-muted-foreground/40 hover:text-muted-foreground/70"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox
        checked={pref.visible}
        onCheckedChange={() => onToggle(kpi.id)}
        disabled={isCheckDisabled}
        className="cursor-pointer"
      />
      <span className="text-sm flex-1">{t(kpi.nameKey)}</span>
    </div>
  )
}

// ── Density Option ──
function DensityOption({
  value,
  label,
  isSelected,
  onSelect,
  gapClass,
}: {
  value: 'compact' | 'comfortable'
  label: string
  isSelected: boolean
  onSelect: (v: 'compact' | 'comfortable') => void
  gapClass: string
}) {
  return (
    <button
      type="button"
      onClick={() => onSelect(value)}
      className={cn(
        'flex-1 p-3 rounded-lg border text-center transition-all cursor-pointer',
        isSelected
          ? 'border-primary/50 bg-primary/10'
          : 'border-input bg-muted/30 hover:bg-muted/50'
      )}
    >
      <div className={cn('grid grid-cols-2 mb-2', gapClass)}>
        <div className="h-2 bg-primary/25 rounded-sm" />
        <div className="h-2 bg-primary/25 rounded-sm" />
        <div className="h-2 bg-primary/25 rounded-sm" />
        <div className="h-2 bg-primary/25 rounded-sm" />
      </div>
      <span className={cn('text-xs', isSelected ? 'font-semibold' : 'text-muted-foreground')}>
        {label}{isSelected ? ' ✓' : ''}
      </span>
    </button>
  )
}

// ── Main Sheet Component ──
interface DashboardControlsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  allKpis: MetricDefinition[]        // full list from resolvedDashboard.heroKpis
  kpiPrefs: KpiPreference[]          // current preferences
  density: 'compact' | 'comfortable'
  onUpdateKpis: (kpis: KpiPreference[]) => void
  onUpdateDensity: (d: 'compact' | 'comfortable') => void
  onResetDefaults: () => void
  onEditLayout: () => void           // closes sheet, activates edit mode
}

export function DashboardControlsSheet({
  open,
  onOpenChange,
  allKpis,
  kpiPrefs,
  density,
  onUpdateKpis,
  onUpdateDensity,
  onResetDefaults,
  onEditLayout,
}: DashboardControlsSheetProps) {
  const { t } = useTranslation('home')
  const { toast } = useToast()

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }))

  // Count visible KPIs to enforce min constraint
  const visibleCount = kpiPrefs.filter(k => k.visible).length
  const disableUncheck = visibleCount <= 2

  const handleToggleKpi = useCallback((id: string) => {
    const updated = kpiPrefs.map(k =>
      k.id === id ? { ...k, visible: !k.visible } : k
    )
    // Don't allow below min
    if (updated.filter(k => k.visible).length < 2) return
    onUpdateKpis(updated)
  }, [kpiPrefs, onUpdateKpis])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = kpiPrefs.findIndex(k => k.id === active.id)
    const newIndex = kpiPrefs.findIndex(k => k.id === over.id)
    if (oldIndex === -1 || newIndex === -1) return
    const reordered = arrayMove(kpiPrefs, oldIndex, newIndex).map((k, i) => ({ ...k, order: i }))
    onUpdateKpis(reordered)
  }, [kpiPrefs, onUpdateKpis])

  const handleReset = useCallback(() => {
    onResetDefaults()
    toast({ description: t('controls.reset.confirm') })
  }, [onResetDefaults, toast, t])

  const handleEditLayout = useCallback(() => {
    onOpenChange(false)
    // Small delay so Sheet closing animation completes before edit mode activates
    setTimeout(() => onEditLayout(), 200)
  }, [onOpenChange, onEditLayout])

  // Build KPI map for looking up MetricDefinition by id
  const kpiMap = new Map(allKpis.map(k => [k.id, k]))

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[400px] sm:w-[450px] flex flex-col">
        <SheetHeader>
          <SheetTitle>{t('controls.title')}</SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto space-y-6 py-4">
          {/* ── Section 1: KPI Selection ── */}
          <div>
            <h3 className="text-sm font-semibold mb-1">{t('controls.kpis.title')}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t('controls.kpis.desc')}</p>
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={kpiPrefs.map(k => k.id)} strategy={verticalListSortingStrategy}>
                <div className="space-y-1.5">
                  {kpiPrefs.map(pref => {
                    const kpi = kpiMap.get(pref.id)
                    if (!kpi) return null
                    return (
                      <SortableKpiItem
                        key={kpi.id}
                        kpi={kpi}
                        pref={pref}
                        onToggle={handleToggleKpi}
                        disableUncheck={disableUncheck}
                        t={t}
                      />
                    )
                  })}
                </div>
              </SortableContext>
            </DndContext>
            {disableUncheck && (
              <p className="text-xs text-amber-500 mt-2">{t('controls.kpis.minWarning')}</p>
            )}
          </div>

          <div className="h-px bg-border" />

          {/* ── Section 2: Layout Density ── */}
          <div>
            <h3 className="text-sm font-semibold mb-1">{t('controls.density.title')}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t('controls.density.desc')}</p>
            <div className="flex gap-3">
              <DensityOption
                value="compact"
                label={t('controls.density.compact')}
                isSelected={density === 'compact'}
                onSelect={onUpdateDensity}
                gapClass="gap-0.5"
              />
              <DensityOption
                value="comfortable"
                label={t('controls.density.comfortable')}
                isSelected={density === 'comfortable'}
                onSelect={onUpdateDensity}
                gapClass="gap-1.5"
              />
            </div>
          </div>

          <div className="h-px bg-border" />

          {/* ── Section 3: Edit Layout + Reset ── */}
          <div>
            <h3 className="text-sm font-semibold mb-1">{t('controls.order.title')}</h3>
            <p className="text-xs text-muted-foreground mb-3">{t('controls.order.desc')}</p>
            <Button
              variant="outline"
              className="w-full gap-2 border-primary/30 text-primary hover:bg-primary/10"
              onClick={handleEditLayout}
            >
              <Pencil className="h-4 w-4" />
              {t('controls.order.editLayout')}
            </Button>
            <p className="text-[11px] text-muted-foreground text-center mt-1.5">{t('controls.order.editLayoutDesc')}</p>
          </div>

          <div className="h-px bg-border" />

          {/* ── Reset ── */}
          <Button
            variant="destructive"
            className="w-full gap-2"
            onClick={handleReset}
          >
            <RotateCcw className="h-4 w-4" />
            {t('controls.reset.title')}
          </Button>
          <p className="text-[11px] text-muted-foreground text-center">{t('controls.reset.desc')}</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes. Component not yet imported.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/DashboardControlsSheet.tsx
git commit -m "feat: add DashboardControlsSheet with KPI sortable toggle + density picker"
```

---

## Chunk 3: Inline Edit Mode (Section Drag & Drop)

### Task 4: Create `DashboardEditMode`

**Files:**
- Create: `src/components/home/DashboardEditMode.tsx`

**Reference:** `src/pages/Menu/MenuOverview.tsx` for DndContext + SortableContext + KeyboardSensor + DragOverlay pattern.

- [ ] **Step 1: Create the edit mode component**

```typescript
// src/components/home/DashboardEditMode.tsx
import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import {
  closestCenter,
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { GripVertical } from 'lucide-react'

import { cn } from '@/lib/utils'
import type { ResolvedRow } from '@/config/dashboard-engine'

// ── Sortable Row Wrapper ──
function SortableRowWrapper({
  row,
  index,
  children,
  t,
}: {
  row: ResolvedRow
  index: number
  children: React.ReactNode
  t: (key: string, opts?: Record<string, unknown>) => string
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'relative rounded-xl p-1 transition-all',
        isDragging
          ? 'border-2 border-solid border-indigo-500/60 bg-indigo-500/8 shadow-lg shadow-indigo-500/10 scale-[1.005] z-10'
          : 'border-2 border-dashed border-indigo-500/30 hover:border-indigo-500/50 cursor-grab'
      )}
    >
      {/* Section label */}
      <div className="absolute -top-2.5 left-3 flex items-center gap-1.5 bg-indigo-500/20 px-2 py-0.5 rounded text-[10px] font-semibold tracking-wider text-indigo-300">
        <button
          type="button"
          className="cursor-grab active:cursor-grabbing touch-none"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-3 w-3" />
        </button>
        {t('controls.editMode.section', { n: index + 1 })}
      </div>

      <div className="pt-2">
        {children}
      </div>
    </div>
  )
}

// ── Row Preview for DragOverlay ──
function RowDragPreview({ row, index, t }: { row: ResolvedRow; index: number; t: (key: string, opts?: Record<string, unknown>) => string }) {
  // Render a simplified preview of the row being dragged
  const layoutLabel = row.layout === 'full' ? 'full' : row.layout === 'split' ? '½ + ½' : '4 + 3'
  const title = row.items[0]?.titleKey || row.id

  return (
    <div className="rounded-xl border-2 border-solid border-indigo-500/60 bg-background/95 shadow-2xl p-4 backdrop-blur-sm">
      <div className="flex items-center gap-2">
        <GripVertical className="h-4 w-4 text-indigo-400" />
        <span className="text-xs font-semibold text-indigo-300">
          {t('controls.editMode.section', { n: index + 1 })}
        </span>
        <span className="text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
          {layoutLabel}
        </span>
        <span className="text-xs text-muted-foreground ml-auto truncate max-w-[200px]">{title}</span>
      </div>
    </div>
  )
}

// ── Main Edit Mode Component ──
// NOTE: Row order state is lifted to the parent (Home.tsx) so the header's
// Save/Cancel buttons can access it. This component receives the order
// and an updater, not internal state.
interface DashboardEditModeProps {
  rows: ResolvedRow[]
  editOrder: string[]                    // controlled from parent
  onEditOrderChange: (order: string[]) => void  // update parent state
  renderRow: (row: ResolvedRow) => React.ReactNode
}

export function DashboardEditMode({
  rows,
  editOrder,
  onEditOrderChange,
  renderRow,
}: DashboardEditModeProps) {
  const { t } = useTranslation('home')
  const [activeId, setActiveId] = useState<string | null>(null)

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const rowMap = new Map(rows.map(r => [r.id, r]))
  const orderedRows = editOrder.map(id => rowMap.get(id)).filter((r): r is ResolvedRow => !!r)

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(String(event.active.id))
  }, [])

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = editOrder.indexOf(String(active.id))
    const newIndex = editOrder.indexOf(String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    onEditOrderChange(arrayMove(editOrder, oldIndex, newIndex))
  }, [editOrder, onEditOrderChange])

  const activeRow = activeId ? rowMap.get(activeId) : null
  const activeIndex = activeId ? editOrder.indexOf(activeId) : -1

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
      <SortableContext items={editOrder} strategy={verticalListSortingStrategy}>
        <div className="space-y-5">
          {orderedRows.map((row, index) => (
            <SortableRowWrapper key={row.id} row={row} index={index} t={t}>
              {renderRow(row)}
            </SortableRowWrapper>
          ))}
        </div>
      </SortableContext>

      <DragOverlay>
        {activeRow && (
          <RowDragPreview row={activeRow} index={activeIndex} t={t} />
        )}
      </DragOverlay>
    </DndContext>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 3: Commit**

```bash
git add src/components/home/DashboardEditMode.tsx
git commit -m "feat: add DashboardEditMode with inline dnd-kit section reordering"
```

---

## Chunk 4: Integration (Wire Everything Together)

### Task 5: Update DashboardRenderer

**Files:**
- Modify: `src/components/home/DashboardRenderer.tsx`

Changes: Accept `visibleKpis`, `orderedRows`, `density`, `isEditMode` props. Apply density-aware CSS classes + fixed heights on chart wrappers. When `isEditMode=true`, delegate to `DashboardEditMode`.

- [ ] **Step 1: Update DashboardRenderer interface and imports**

At the top of `DashboardRenderer.tsx`, add the import for `DashboardEditMode`:

```typescript
import { DashboardEditMode } from '@/components/home/DashboardEditMode'
```

Replace the `DashboardRendererProps` interface and the main export:

```typescript
interface DashboardRendererProps {
  resolvedDashboard: ResolvedDashboard
  dashboardData: ReturnType<typeof useDashboardData>
  // Preferences overlay
  visibleKpis?: MetricDefinition[]
  orderedRows?: ResolvedRow[]
  density?: 'compact' | 'comfortable'
  // Edit mode (row order state lifted to Home.tsx)
  isEditMode?: boolean
  editRowOrder?: string[]
  onEditRowOrderChange?: (order: string[]) => void
}
```

- [ ] **Step 2: Update density-aware classes in DashboardRowRenderer**

In `DashboardRowRenderer`, accept a `density` prop and apply it:

```typescript
const DashboardRowRenderer = ({
  row,
  venueId,
  selectedRange,
  dashboardData,
  density = 'comfortable',
}: {
  row: ResolvedRow
  venueId: string
  selectedRange: { from: Date; to: Date }
  dashboardData: ReturnType<typeof useDashboardData>
  density?: 'compact' | 'comfortable'
}) => {
  const isCompact = density === 'compact'
  const gap = isCompact ? 'gap-3' : 'gap-6'

  const layoutClasses: Record<string, string> = {
    full: `grid grid-cols-1 ${gap}`,
    split: `grid grid-cols-1 lg:grid-cols-2 ${gap}`,
    weighted: `grid grid-cols-1 lg:grid-cols-7 ${gap}`,
  }

  // Fixed height class based on density
  const chartHeight = isCompact ? 'lg:h-[300px]' : 'lg:h-[360px]'
  const metricHeight = isCompact ? 'lg:h-[340px]' : 'lg:h-[400px]'
  const tableMinHeight = isCompact ? 'lg:min-h-[260px]' : 'lg:min-h-[300px]'

  // ... rest of the component, applying height classes to wrappers
```

For each item in the row, determine the height class from `chartDef.skeletonType`:

```typescript
function getHeightClass(skeletonType: string, isCompact: boolean): string {
  switch (skeletonType) {
    case 'staff':
    case 'table-perf':
      return isCompact ? 'lg:h-[340px]' : 'lg:h-[400px]'
    case 'table':
      return isCompact ? 'lg:min-h-[260px]' : 'lg:min-h-[300px]'
    case 'chart':
    case 'product-list':
    default:
      return isCompact ? 'lg:h-[300px]' : 'lg:h-[360px]'
  }
}
```

Apply the height class on both `ProgressiveChartSection` and `PaymentMethodsPieSection` wrappers via their `className` prop. Add `overflow-hidden` to prevent content overflow.

- [ ] **Step 3: Update the main DashboardRenderer export**

Replace the existing `DashboardRenderer` component body:

```typescript
export const DashboardRenderer = ({
  resolvedDashboard,
  dashboardData,
  visibleKpis,
  orderedRows,
  density = 'comfortable',
  isEditMode = false,
  editRowOrder,
  onEditRowOrderChange,
}: DashboardRendererProps) => {
  const { venueId, selectedRange } = dashboardData
  const isCompact = density === 'compact'

  // Use preferences overlay if provided, else fall back to resolved dashboard
  const kpis = visibleKpis ?? resolvedDashboard.heroKpis
  const rows = orderedRows ?? resolvedDashboard.rows

  const renderRow = (row: ResolvedRow) => (
    <DashboardRowRenderer
      row={row}
      venueId={venueId}
      selectedRange={selectedRange}
      dashboardData={dashboardData}
      density={density}
    />
  )

  return (
    <div className={isCompact ? 'space-y-3' : 'space-y-6'}>
      {/* Hero KPI Cards — dimmed in edit mode */}
      <div className={isEditMode ? 'opacity-50 pointer-events-none' : ''}>
        <DashboardMetrics
          metricDefinitions={kpis}
          dashboardData={dashboardData}
          isBasicLoading={dashboardData.isBasicLoading}
          compareType={dashboardData.compareType}
          comparisonLabel={dashboardData.comparisonLabel}
          isCompareLoading={dashboardData.isCompareLoading}
        />
      </div>

      {/* Chart Rows — edit mode uses DashboardEditMode with lifted state */}
      {isEditMode && editRowOrder && onEditRowOrderChange ? (
        <DashboardEditMode
          rows={rows}
          editOrder={editRowOrder}
          onEditOrderChange={onEditRowOrderChange}
          renderRow={renderRow}
        />
      ) : (
        rows.map(row => (
          <DashboardRowRenderer
            key={row.id}
            row={row}
            venueId={venueId}
            selectedRange={selectedRange}
            dashboardData={dashboardData}
            density={density}
          />
        ))
      )}
    </div>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 5: Commit**

```bash
git add src/components/home/DashboardRenderer.tsx
git commit -m "feat: add density-aware layout + fixed heights + edit mode support to DashboardRenderer"
```

---

### Task 6: Update DashboardHeader

**Files:**
- Modify: `src/components/home/sections/DashboardHeader.tsx`

Changes: Add gear icon button. Manage Sheet open state internally. In edit mode, show the "EDITANDO LAYOUT" badge + Cancel/Save buttons instead of normal filters.

- [ ] **Step 1: Update imports and props**

Add these imports:

```typescript
import { useState } from 'react'
import { Settings } from 'lucide-react'
import { DashboardControlsSheet } from '@/components/home/DashboardControlsSheet'
import type { MetricDefinition } from '@/config/dashboard-engine'
import type { KpiPreference } from '@/hooks/use-dashboard-preferences'
```

Extend `DashboardHeaderProps`:

```typescript
interface DashboardHeaderProps {
  // ... existing props stay unchanged ...

  // Controls Sheet props
  allKpis?: MetricDefinition[]
  kpiPrefs?: KpiPreference[]
  density?: 'compact' | 'comfortable'
  onUpdateKpis?: (kpis: KpiPreference[]) => void
  onUpdateDensity?: (d: 'compact' | 'comfortable') => void
  onResetDefaults?: () => void

  // Edit mode
  isEditMode?: boolean
  onEditLayout?: () => void
  onCancelEditMode?: () => void
  onSaveEditMode?: () => void
}
```

- [ ] **Step 2: Add Sheet state + gear icon + edit mode header**

Inside the component, add:

```typescript
const [sheetOpen, setSheetOpen] = useState(false)
```

When `isEditMode` is true, render the edit mode header instead of the normal one:

```typescript
if (isEditMode) {
  return (
    <div className="sticky top-0 z-10 bg-gradient-to-r from-indigo-500/15 to-purple-500/10 border-b border-indigo-500/20 shadow-sm p-4">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          <PageTitleWithInfo title={t('title')} className="text-2xl font-bold text-foreground" />
          <span className="px-3 py-1 bg-indigo-500/25 rounded-full text-xs font-semibold tracking-wider text-indigo-300">
            {t('controls.editMode.badge')}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={onCancelEditMode}>
            {t('controls.editMode.cancel')}
          </Button>
          <Button size="sm" onClick={onSaveEditMode}>
            {t('controls.editMode.save')}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

In the normal header, add the gear icon button after the Export dropdown:

```typescript
{/* Gear icon — opens settings Sheet */}
{allKpis && kpiPrefs && onUpdateKpis && onUpdateDensity && onResetDefaults && onEditLayout && (
  <>
    <Button
      size="sm"
      variant="outline"
      onClick={() => setSheetOpen(true)}
      className="flex items-center"
    >
      <Settings className="h-4 w-4" />
    </Button>
    <DashboardControlsSheet
      open={sheetOpen}
      onOpenChange={setSheetOpen}
      allKpis={allKpis}
      kpiPrefs={kpiPrefs}
      density={density ?? 'comfortable'}
      onUpdateKpis={onUpdateKpis}
      onUpdateDensity={onUpdateDensity}
      onResetDefaults={onResetDefaults}
      onEditLayout={onEditLayout}
    />
  </>
)}
```

- [ ] **Step 3: Verify build**

Run: `npm run build`
Expected: Build passes.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/sections/DashboardHeader.tsx
git commit -m "feat: add gear icon + settings Sheet + edit mode header to DashboardHeader"
```

---

### Task 7: Wire up Home.tsx

**Files:**
- Modify: `src/pages/Home.tsx`

This is where everything connects.

- [ ] **Step 1: Add imports and hook**

Add import:

```typescript
import { useState, useCallback } from 'react'
import { useDashboardPreferences } from '@/hooks/use-dashboard-preferences'
```

Inside the component, after `useDashboardPack()`:

```typescript
const [isEditMode, setIsEditMode] = useState(false)
// Edit mode row order — lifted here so header Save button can access it
const [editRowOrder, setEditRowOrder] = useState<string[]>([])

const {
  preferences,
  visibleKpis,
  orderedRows,
  density,
  updateKpis,
  updateRowOrder,
  updateDensity,
  resetDefaults,
} = useDashboardPreferences(dashboardData.venueId, resolvedDashboard)

const handleEditLayout = useCallback(() => {
  setEditRowOrder(orderedRows.map(r => r.id))  // snapshot current order
  setIsEditMode(true)
}, [orderedRows])

const handleCancelEditMode = useCallback(() => setIsEditMode(false), [])

const handleSaveEditMode = useCallback(() => {
  updateRowOrder(editRowOrder)  // persist the dragged order
  setIsEditMode(false)
}, [editRowOrder, updateRowOrder])
```

- [ ] **Step 2: Thread props to DashboardHeader**

Update the `DashboardHeader` spread to include the new props:

```typescript
<DashboardHeader
  {...dashboardData}
  isBasicLoading={isBasicLoading}
  exportLoading={exportLoading}
  isBasicError={isBasicError}
  exportToJSON={exportToJSON}
  exportToCSV={exportToCSV}
  // Controls
  allKpis={resolvedDashboard.heroKpis}
  kpiPrefs={preferences.kpis}
  density={density}
  onUpdateKpis={updateKpis}
  onUpdateDensity={updateDensity}
  onResetDefaults={resetDefaults}
  // Edit mode
  isEditMode={isEditMode}
  onEditLayout={handleEditLayout}
  onCancelEditMode={handleCancelEditMode}
  onSaveEditMode={handleSaveEditMode}
/>
```

- [ ] **Step 3: Thread props to DashboardRenderer**

Replace the `DashboardRenderer` call:

```typescript
<DashboardRenderer
  resolvedDashboard={resolvedDashboard}
  dashboardData={dashboardData}
  visibleKpis={visibleKpis}
  orderedRows={orderedRows}
  density={density}
  isEditMode={isEditMode}
  editRowOrder={editRowOrder}
  onEditRowOrderChange={setEditRowOrder}
/>
```

- [ ] **Step 4: Remove `space-y-4` from parent container**

The `DashboardRenderer` now manages its own spacing via density. Change the parent div:

```diff
- <div className="flex-1 p-2 md:p-4 space-y-4 mx-auto w-full section-soft cards-tinted">
+ <div className="flex-1 p-2 md:p-4 mx-auto w-full section-soft cards-tinted">
```

- [ ] **Step 5: Verify build**

Run: `npm run build`
Expected: Build passes with 0 errors.

- [ ] **Step 6: Verify lint**

Run: `npm run lint`
Expected: Passes (or only pre-existing warnings).

- [ ] **Step 7: Commit**

```bash
git add src/pages/Home.tsx
git commit -m "feat: wire up dashboard preferences + edit mode in Home.tsx"
```

---

## Chunk 5: Visual QA + Final Polish

### Task 8: Visual verification

- [ ] **Step 1: Start dev server and verify normal mode**

Run: `npm run dev`

Open dashboard. Verify:
- Gear icon visible in header next to Export
- Clicking gear opens right-side Sheet
- KPI checkboxes are draggable and toggle correctly
- Min 2 KPIs enforced (warning shows)
- Density toggle changes spacing live
- Reset button restores defaults + shows toast
- Chart heights are consistent in split/weighted rows

- [ ] **Step 2: Verify edit mode**

1. Open Sheet → click "Edit layout"
2. Sheet closes, header changes to indigo gradient with "EDITANDO LAYOUT" badge
3. KPI cards dimmed
4. Chart rows have dashed indigo borders with section labels
5. Drag a row — preview appears, drop zone shows
6. Click "Guardar" — order persists, exit edit mode
7. Refresh page — order preserved from localStorage

- [ ] **Step 3: Verify dark + light mode**

Toggle theme. Both modes should look correct:
- Sheet styling uses semantic tokens (bg-muted, text-foreground, etc.)
- Edit mode borders visible in both themes
- Density illustrations render correctly

- [ ] **Step 4: Verify multiple venues**

Switch venue. Preferences should be independent per venue. Changing venue should load that venue's stored prefs or defaults.

- [ ] **Step 5: Final commit if any polish needed**

```bash
git add -A
git commit -m "fix: visual polish for dashboard customization controls"
```

---

## Dependency Order

```
Task 1 (i18n) ──────────────────────────┐
                                         ├── Task 5 (DashboardRenderer update)
Task 2 (useDashboardPreferences hook) ──┤
                                         ├── Task 6 (DashboardHeader update)
Task 3 (DashboardControlsSheet) ────────┤
                                         ├── Task 7 (Home.tsx wiring)
Task 4 (DashboardEditMode) ────────────┘
                                         │
                                         └── Task 8 (Visual QA)
```

Tasks 1-4 can be parallelized (they create independent files). Tasks 5-7 must be sequential (they integrate the pieces). Task 8 is the final verification.
