---
paths:
  - "src/pages/**/*.tsx"
  - "src/components/**/*.tsx"
---

# UI Patterns (MANDATORY)

These patterns are mandatory for all page and component files. Use the reference files as source of truth for exact implementation.

## Pill-Style Tabs

ALWAYS use pill-style tabs with `rounded-full` styling. NEVER use default Radix tabs.

- TabsList: `rounded-full bg-muted/60 px-1 py-1 border border-border`
- TabsTrigger: `rounded-full` with `data-[state=active]:bg-foreground data-[state=active]:text-background`
- Badge counts inside triggers use `rounded-full` with matching active states
- **Reference**: `src/pages/Team/Teams.tsx`

## Stripe-Style Filters

ALWAYS use FilterPill components for table filters. NEVER use DataTable's built-in column customizer.

- Use `useState<string[]>([])` for multi-select filter state
- Use `FilterPill`, `CheckboxFilterContent`, `ColumnCustomizer` from `@/components/filters/`
- Filter columns with `useMemo` based on `visibleColumns` state
- Pass `showColumnCustomizer={false}` to DataTable
- **Reference**: `src/pages/Order/Orders.tsx`

## Expandable Search Bar

ALWAYS use the expandable/animated search pattern for table views.

- Separate `searchTerm` (UI) and `debouncedSearchTerm` (API) via `useDebounce(searchTerm, 300)`
- Toggle between icon button and full input with `isSearchOpen` state
- Animation: `animate-in fade-in slide-in-from-left-2 duration-200`
- Rounded styling: `rounded-full` for both button and input
- Active indicator dot when collapsed with active search
- **Reference**: `src/pages/Order/Orders.tsx`

## URL Hash-Based Tabs

Tabs representing page sections MUST persist state via URL hash.

- Read hash on mount with validated tab values
- Sync tab ↔ URL hash bidirectionally
- Use `navigate(\`\${location.pathname}#\${tab}\`, { replace: true })`
- **Reference**: `src/pages/Commissions/CommissionsPage.tsx`

## Superadmin Gradient

All SUPERADMIN-only UI elements in `/dashboard/` routes use the amber-to-pink gradient.

- Classes: `bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground`
- NOT used in `/superadmin/*` routes (those have their own styling)
- **Reference**: `src/pages/Tpv/Tpvs.tsx`

## FullScreenModal for Create/Edit/Upload (MANDATORY)

**ALL create, edit, and upload flows MUST use FullScreenModal — NEVER use regular Dialog.**

Regular Dialog is only appropriate for:
- Delete/destructive confirmations → use `AlertDialog`
- Quick inline confirmations (yes/no) → use `AlertDialog`
- Tiny single-field prompts (rare)

Everything else (create forms, edit forms, file uploads, wizards, detail views) → `FullScreenModal`.

### Form Pattern Inside FullScreenModal

Follow the ProductWizardDialog pattern:

- Header: Close (left), Title (center), Submit button (right) via `actions` prop
- Content: `contentClassName="bg-muted/30"` gray background
- Form sections: white cards with icon headers (`rounded-2xl border border-border/50 bg-card p-6`)
- Inputs: `className="h-12 text-base"` — transparent, NOT `bg-muted`
- Use `forwardRef` + `useImperativeHandle` to expose `submit()` to parent
- **Reference**: `src/pages/Inventory/components/ProductWizardDialog.tsx`

## Clearable Number Inputs (MANDATORY)

**Number inputs MUST be clearable.** A naive `parseFloat`/`parseInt`/`Number` fallback to a literal default (`|| 0`, `|| 1`, `: 0`) traps the field — the user types, hits backspace, and the value snaps back. They can't actually clear the field.

```tsx
// ❌ WRONG — locks the field. User can't backspace through "0".
<Input
  type="number"
  {...field}
  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
/>

// ❌ WRONG — same trap with local state.
onChange={e => setAmount(Number(e.target.value) || 0)}

// ❌ WRONG — `parseFloat('')` is NaN. NaN reaches form state silently.
onChange={e => field.onChange(parseFloat(e.target.value))}
```

```tsx
// ✅ CORRECT — empty input → undefined in state. Visual empty stays.
<Input
  type="number"
  {...field}
  value={field.value ?? ''}
  onChange={e => {
    const raw = e.target.value
    field.onChange(raw === '' ? undefined : parseFloat(raw))
  }}
/>
```

### Rules

1. `value={x ?? ''}` — never pass `undefined`/`null`/`NaN` to a controlled input's `value`.
2. `onChange` must early-return `undefined` (or `null`, depending on the schema) for `raw === ''`. Never coerce empty to a default number inside `onChange`.
3. The form's submit handler / mutation is responsible for defaulting (`amount ?? 0`) or for letting Zod/RHF `required` rules reject the empty value. Defaults belong at the boundary, not on every keystroke.
4. If TypeScript complains because the form/state field is typed strict `number`, **widen it to `number | undefined`** (preferred) or cast `as unknown as number` only when widening is unsafe (RHF + Zod schemas already accept `undefined` at runtime).

### Variations

**RHF Controller / `<FormField>`:** spread `{...field}`, then override `value={field.value ?? ''}` and `onChange`.

**Local `useState`:** widen state to `number | undefined`, default at usage points.

```tsx
// State widened
const [amount, setAmount] = useState<number | undefined>(20000)
const safeAmount = amount ?? 0  // for calculations / submit
```

**Nullable schemas (`number | null`):** map `''` → `null` (matches Zod `.nullable()`).

**RHF `register('x', { valueAsNumber: true })`:** also produces NaN on empty. Avoid for clearable fields, or pair with `value={x ?? ''}` via Controller.

**Reference fixes:** `src/pages/CreditPacks/CreditPackForm.tsx`, `src/pages/Order/Orders.tsx` (lines ~175, 1592, 1605), `src/components/Sidebar/enhanced-add-venue-dialog.tsx`.

## Cursor Pointer on Icon Buttons

ALWAYS add `cursor-pointer` to icon buttons, especially inside Tooltip wrappers.

Radix `TooltipTrigger asChild` can interfere with default cursor.

## Selection Summary Bar

When a table supports row selection, show a floating bottom bar with aggregated totals for selected rows.

- Fixed bottom-center, animated slide-in from bottom
- Shows count + configurable summary fields (totals, averages)
- Generic `<TData>` — works with any row type via `SummaryField[]` config
- **Reference**: `src/components/selection-summary-bar.tsx`

## Clickable Selection Rows

When a row has a checkbox/radio, make the ENTIRE row clickable.

- Add `cursor-pointer hover:bg-muted/50` to row container
- Use `onClick={(e) => e.stopPropagation()}` on nested interactive elements
- **Reference**: `src/pages/Reports/SalesSummary.tsx`

## Onboarding Tours: `data-tour` Attributes (MANDATORY)

The dashboard ships interactive step-by-step tours powered by [driver.js](https://driverjs.com/). Tours target DOM elements by a stable
`data-tour="<key>"` attribute — never by class, generated id, or text content.

**When building or modifying any of these, add `data-tour` in the SAME PR:**

- Primary CTAs ("Nuevo producto", "Crear", "Guardar")
- Every wizard / multi-step form field (name, price, category, toggles…)
- Destination radios / tiles when they determine the next flow branch (e.g. "Basado en Recetas")
- Section containers the tour needs to spotlight as a block

```tsx
// ✅ Stable + self-documenting + kebab-case + scoped to feature
<Button data-tour="product-new-btn">Nuevo producto</Button>
<Input data-tour="product-wizard-name" {...register('name')} />
<section data-tour="product-wizard-ingredients">...</section>

// ❌ Don't rely on these for tours
<Button className="bg-primary">...</Button>  // class can change
<Input id="price" />                          // id collisions across dialogs
```

Naming: `kebab-case`, scoped by feature: `product-new-btn`, `product-wizard-category`, `product-type-food`, `add-ingredient-qty`.

**Existing tours:** `src/hooks/useProductCreationTour.ts`, `src/hooks/useRecipeCreationTour.ts`.
**Full pattern + checklist:** `docs/guides/onboarding-tours.md`.

### Radix Popover/Dialog targeted by a tour — prevent auto-close

When a tour step targets content inside a `Popover` or `Dialog`, the driver.js overlay click would normally auto-close the Radix primitive. Fix with a body class:

```tsx
// In the Popover/Dialog component
<PopoverContent
  onInteractOutside={e => {
    if (document.body.classList.contains('tour-active')) e.preventDefault()
  }}
  onEscapeKeyDown={e => {
    if (document.body.classList.contains('tour-active')) e.preventDefault()
  }}
>

// In the tour hook
const start = useCallback(() => {
  document.body.classList.add('tour-active')
  driverRef.current = buildDriver()  // driver's onDestroyed removes the class
  driverRef.current.drive()
}, [buildDriver])
```

**Reference**: `src/pages/Inventory/InventorySummary.tsx` + `src/hooks/useStockAdjustmentTour.ts`.
