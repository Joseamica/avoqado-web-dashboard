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

## Cursor Pointer on Icon Buttons

ALWAYS add `cursor-pointer` to icon buttons, especially inside Tooltip wrappers.

Radix `TooltipTrigger asChild` can interfere with default cursor.

## Clickable Selection Rows

When a row has a checkbox/radio, make the ENTIRE row clickable.

- Add `cursor-pointer hover:bg-muted/50` to row container
- Use `onClick={(e) => e.stopPropagation()}` on nested interactive elements
- **Reference**: `src/pages/Reports/SalesSummary.tsx`
