# UI Patterns Guide

This guide documents common UI patterns used throughout the Avoqado Dashboard. These patterns ensure consistency, improve user experience,
and maintain visual coherence across the application.

## Table of Contents

- [Pill-Style Tabs (MANDATORY)](#pill-style-tabs-mandatory)
- [URL Hash-Based Tabs (MANDATORY)](#url-hash-based-tabs-mandatory)
- [Stripe-Style Filters (MANDATORY)](#stripe-style-filters-mandatory)
- [Clickable Elements Inside DataTable (MANDATORY)](#clickable-elements-inside-datatable-mandatory)
- [Icon-Based Radio Group Selection](#icon-based-radio-group-selection)
- [Horizontal Navigation (VenueEditLayout Pattern)](#horizontal-navigation-venueeditlayout-pattern)
- [Multi-Step Wizard Dialog](#multi-step-wizard-dialog)
- [Form Input Patterns](#form-input-patterns)
- [Select/MultipleSelector Patterns](#selectmultipleselector-with-empty-state-and-create-button-mandatory)
- [SearchableSelect Component](#searchable-dropdown-rule-mandatory)
- [Searchable Multi-Select (Long Lists)](#searchable-multi-select-long-lists)
- [Live Preview Layout (Bento Grid)](#live-preview-layout-bento-grid)
- [Unit Translation (MANDATORY)](#unit-translation-mandatory)
- [FullScreenModal (Table Detail View Pattern)](#fullscreenmodal-table-detail-view-pattern)

---

## Pill-Style Tabs (MANDATORY)

**⚠️ ALWAYS use this pattern for tabs. DO NOT use the default Radix tabs styling.**

**When to use:** Any interface with tab navigation (2+ tabs) for switching between content sections.

**Reference implementation:** `/src/pages/Team/Teams.tsx` (lines 372-392)

### Visual Specifications

- **Container**: Rounded-full with subtle background (`rounded-full bg-muted/60`)
- **Border**: 1px border (`border border-border`)
- **Padding**: 4px container padding (`px-1 py-1`)
- **Tab Triggers**: Rounded-full pills with hover and active states
- **Count Badge**: Inline rounded badge showing item counts

### Code Example

```typescript
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
;<Tabs defaultValue="items" className="space-y-4">
  <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
    <TabsTrigger
      value="items"
      className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
    >
      <span>{t('tabs.items')}</span>
      <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
        {itemCount}
      </span>
    </TabsTrigger>
    <TabsTrigger
      value="history"
      className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
    >
      <span>{t('tabs.history')}</span>
      <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
        {historyCount}
      </span>
    </TabsTrigger>
  </TabsList>

  <TabsContent value="items">{/* Content */}</TabsContent>
  <TabsContent value="history">{/* Content */}</TabsContent>
</Tabs>
```

### Key Classes Breakdown

| Element              | Classes                                                                 | Purpose                           |
| -------------------- | ----------------------------------------------------------------------- | --------------------------------- |
| `TabsList`           | `rounded-full bg-muted/60 border border-border`                         | Pill-shaped container             |
| `TabsTrigger`        | `rounded-full px-4 py-2`                                                | Pill-shaped buttons               |
| `TabsTrigger` active | `data-[state=active]:bg-foreground data-[state=active]:text-background` | Inverted colors when active       |
| Count badge          | `bg-foreground/10 group-data-[state=active]:bg-background/20`           | Subtle badge that adapts to state |

### Without Count Badge

If you don't need count badges, simplify the trigger:

```typescript
<TabsTrigger
  value="items"
  className="rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
>
  {t('tabs.items')}
</TabsTrigger>
```

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Team/Teams.tsx` (lines 372-392) - **Reference implementation**
- `/src/pages/Customers/CustomerDetail.tsx` (lines 417-437)

**Where to apply:**

- ✅ ALL tab interfaces in the application
- ✅ Page sections (Orders/History, Members/Invitations)
- ✅ Detail views with multiple content sections
- ❌ Do NOT use default Radix `TabsList` styling

---

## URL Hash-Based Tabs (MANDATORY)

**⚠️ Tabs that represent page sections MUST persist state via URL hash** to survive page reloads and enable direct linking.

**When to use:** Any page with tabs that users might want to bookmark, share, or return to after a reload.

**Reference implementation:** `/src/pages/Commissions/CommissionsPage.tsx`, `/src/pages/Inventory/InventorySummary.tsx`

### Why This Pattern?

| Benefit | Description |
|---------|-------------|
| **Survives reload** | Tab state persists when user presses F5 or refreshes |
| **Deep linking** | Users can share URLs like `/inventory/summary#recipe-based` |
| **Browser history** | Back/forward buttons navigate between tabs |
| **Bookmarks** | Users can bookmark specific tabs |

### Code Example

```typescript
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

// Define valid tabs as const array for type safety
const VALID_TABS = ['accounting', 'recipe-based'] as const
type TabValue = typeof VALID_TABS[number]

export default function InventorySummary() {
  const location = useLocation()
  const navigate = useNavigate()

  // Get tab from URL hash, default to first tab
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'accounting'
  }

  const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

  // Sync tab with URL hash on hash change (browser back/forward)
  useEffect(() => {
    const tabFromHash = getTabFromHash()
    if (tabFromHash !== activeTab) {
      setActiveTab(tabFromHash)
    }
  }, [location.hash])

  // Update URL hash when tab changes
  const handleTabChange = (value: string) => {
    const tab = value as TabValue
    setActiveTab(tab)
    navigate(`${location.pathname}#${tab}`, { replace: true })
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
        <TabsTrigger value="accounting" className="...">
          {t('inventory.accountingArticles')}
          <span className="ml-2 ...">{accountingCount}</span>
        </TabsTrigger>
        <TabsTrigger value="recipe-based" className="...">
          {t('inventory.recipeBased')}
          <span className="ml-2 ...">{recipeCount}</span>
        </TabsTrigger>
      </TabsList>

      <TabsContent value="accounting">{/* Content */}</TabsContent>
      <TabsContent value="recipe-based">{/* Content */}</TabsContent>
    </Tabs>
  )
}
```

### Key Implementation Details

| Aspect | Implementation |
|--------|----------------|
| **Type safety** | Use `as const` array + type to validate tab values |
| **Default tab** | Return first valid tab if hash is invalid/empty |
| **Hash sync** | `useEffect` syncs state when hash changes externally |
| **Navigation** | `navigate(..., { replace: true })` prevents history spam |
| **URL format** | `/venues/my-venue/inventory/summary#recipe-based` |

### Common Mistakes

```typescript
// ❌ WRONG - Tab state lost on reload
const [activeTab, setActiveTab] = useState('overview')

<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* Tab state lost when user presses F5 */}
</Tabs>

// ❌ WRONG - Missing hash sync for browser back/forward
const [activeTab, setActiveTab] = useState(getTabFromHash())
// User can't use browser back button to navigate tabs

// ✅ CORRECT - Full implementation with hash sync
const [activeTab, setActiveTab] = useState<TabValue>(getTabFromHash)

useEffect(() => {
  const tabFromHash = getTabFromHash()
  if (tabFromHash !== activeTab) {
    setActiveTab(tabFromHash)
  }
}, [location.hash])

const handleTabChange = (value: string) => {
  const tab = value as TabValue
  setActiveTab(tab)
  navigate(`${location.pathname}#${tab}`, { replace: true })
}
```

### When NOT to Use

- ❌ Tabs inside dialogs/modals (they close on navigation)
- ❌ Ephemeral UI states (filters, collapsed sections)
- ❌ Tabs that require form state preservation

---

## Stripe-Style Filters (MANDATORY)

**⚠️ ALWAYS use this pattern for table/list filters. DO NOT use the DataTable's built-in column customizer.**

**When to use:** Any page with a data table or list that needs filtering (e.g., Orders, Payments, Team, Customers).

**Reference implementation:** `/src/pages/Order/Orders.tsx`

### Filter Order Rule (MANDATORY)

**⚠️ CRITICAL: Filter pills MUST be ordered in the same sequence as the table columns.**

This creates visual consistency and predictability for users - filters appear in the same order as the columns they filter.

**Example from Orders.tsx:**

```
Table Columns:          Filter Pills (same order):
1. Date                 1. Date filter
2. Order Number         (no filter - ID field)
3. Customer             (no filter - text field)
4. Type                 2. Type filter
5. Table                3. Table filter
6. Waiter               4. Waiter filter
7. Status               5. Status filter
8. Tip                  6. Tip filter
9. Total                7. Total filter
```

**Example from InventoryHistory.tsx:**

```
Table Columns:          Filter Pills (same order):
1. Date                 1. Date filter
2. Name                 (no filter - text search)
3. SKU                  2. SKU filter
4. Provider             3. Provider filter
5. Total Cost           4. Total Cost filter
6. Adjustment           5. Type filter (filters adjustment types)
```

**How to implement:**

```typescript
// ✅ CORRECT - Filter state ordered by column position
const [dateFilter, setDateFilter] = useState<DateFilter | null>(null)      // Column 1
const [typeFilter, setTypeFilter] = useState<string[]>([])                 // Column 2
const [tableFilter, setTableFilter] = useState<string[]>([])               // Column 3
const [statusFilter, setStatusFilter] = useState<string[]>([])             // Column 4

// ✅ CORRECT - Filter pills in same order as columns
<FilterPill label="Date" ... />      {/* Column 1 */}
<FilterPill label="Type" ... />      {/* Column 2 */}
<FilterPill label="Table" ... />     {/* Column 3 */}
<FilterPill label="Status" ... />    {/* Column 4 */}

// ❌ WRONG - Random order, unrelated to columns
<FilterPill label="Status" ... />
<FilterPill label="Date" ... />
<FilterPill label="Type" ... />
```

**Benefits:**
- **Predictability**: Users can mentally map filters to columns
- **Visual scanning**: Left-to-right reading matches filter order
- **Consistency**: Same pattern across all pages

### Visual Specifications - Single-Row with Responsive Wrap

Inspired by Stripe's filter bar: filters on the left, action buttons on the right (wrap to new line when space runs out).

```
WIDE SCREEN (everything fits in one row):
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐  Borrar   ┌──────────┐ ┌──────────┐ │
│ │+ Fecha ▼│ │+ Tipo ▼ │ │+ Mesa ▼ │ │+ Estado▼│  filtros  │▼ Exportar│ │⚙ Columnas│ │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘           └──────────┘ └──────────┘ │
│ ←─── Filter pills (rounded-full) ────────────→   ←───ml-auto pushes right──────────→│
└──────────────────────────────────────────────────────────────────────────────────────┘

NARROW SCREEN (action buttons wrap to new line, LEFT-aligned):
┌──────────────────────────────────────────────────────┐
│ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐     │
│ │+ Fecha ▼│ │+ Tipo ▼ │ │+ Mesa ▼ │ │+ Estado▼│     │
│ └─────────┘ └─────────┘ └─────────┘ └─────────┘     │
│ ┌─────────┐  Borrar filtros                         │
│ │+ Total ▼│                                         │
│ └─────────┘                                         │
│                          ↑ gap-y-3 spacing          │
│ ┌──────────────────┐ ┌──────────┐ ┌────────────┐   │
│ │⏱ Cuentas x Cobrar│ │▼ Exportar│ │⚙ Columnas │   │
│ └──────────────────┘ └──────────┘ └────────────┘   │
│ ←─ Action buttons wrap LEFT (natural flex) ──────→ │
└──────────────────────────────────────────────────────┘
```

### Key Styling Rules

| Element                  | Style                               | Example Classes                                                    |
| ------------------------ | ----------------------------------- | ------------------------------------------------------------------ |
| **Filter Pills**         | Rounded-full (pill shape)           | `rounded-full border-dashed`                                       |
| **Reset Filters Button** | Rounded-full, white bg in dark mode | `rounded-full dark:bg-white dark:text-black dark:hover:text-black` |
| **Action Buttons**       | Default rounded (squared)           | `rounded-md` (default, NO `rounded-full`)                          |
| **ColumnCustomizer**     | Squared like other actions          | No `rounded-full` class                                            |

### Single-Row Layout with Responsive Wrap

```typescript
{/* Stripe-style Filter Bar */}
<div className="mb-4">
  {/* Single row: Filters left, Actions right (wrap when space runs out) */}
  <div className="flex flex-wrap items-center gap-x-2 gap-y-3">
    {/* Search input */}
    <div className="relative flex-shrink-0">
      <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        placeholder={t('search.placeholder')}
        value={searchQuery}
        onChange={e => setSearchQuery(e.target.value)}
        className="h-8 w-[200px] rounded-full pl-8"
      />
    </div>

    {/* Filter Pills - rounded-full style */}
    <FilterPill label={t('filters.date')} {...dateFilterProps}>
      <DateFilterContent {...} />
    </FilterPill>

    <FilterPill label={t('filters.status')} {...statusFilterProps}>
      <CheckboxFilterContent {...} />
    </FilterPill>

    {/* Reset filters - white background button with X icon */}
    {activeFiltersCount > 0 && (
      <Button
        variant="outline"
        size="sm"
        onClick={resetFilters}
        className="h-8 gap-1.5 rounded-full bg-background dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black"
      >
        <X className="h-3.5 w-3.5" />
        {t('filters.reset', { defaultValue: 'Borrar filtros' })}
      </Button>
    )}

    {/* Action buttons - pushed right with ml-auto, wrap left when space runs out */}
    <div className="ml-auto flex flex-wrap items-center gap-2">
      {/* Custom action buttons - NO rounded-full (squared style) */}
      <Button variant="outline" size="sm" className="h-8 gap-2">
        <Clock className="h-3.5 w-3.5" />
        {t('customAction.button')}
      </Button>

      {/* Export dropdown - NO rounded-full */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t('export.button')}
          </Button>
        </DropdownMenuTrigger>
        {/* ... dropdown content */}
      </DropdownMenu>

      {/* Column customizer - NO rounded-full */}
      <ColumnCustomizer columns={columnOptions} onApply={setVisibleColumns} />
    </div>
  </div>
</div>
```

**Key points:**

- **Single row** with `flex-wrap` and `gap-x-2 gap-y-3` (different horizontal/vertical gaps)
- **Filter pills** on the left with `rounded-full` style
- **"Borrar filtros"** button with X icon, white background, and `rounded-full`
- **Action buttons** pushed to the right with `ml-auto` wrapper
- **When space runs out:** Action buttons wrap to a new line and stay LEFT-aligned (natural flex behavior)

### Reset Filters Button (Dark Mode Styling)

The "Borrar filtros" button has special styling to stand out in dark mode with a white background:

```typescript
{
  activeFiltersCount > 0 && (
    <Button
      variant="outline"
      size="sm"
      onClick={resetFilters}
      className="h-8 gap-1.5 rounded-full bg-background dark:bg-white dark:text-black dark:hover:bg-gray-100 dark:hover:text-black"
    >
      <X className="h-3.5 w-3.5" />
      {t('filters.reset', { defaultValue: 'Borrar filtros' })}
    </Button>
  )
}
```

**Key classes:**

- `rounded-full` - Pill shape to match other filter pills
- `gap-1.5` - Space between X icon and text
- `dark:bg-white` - White background in dark mode
- `dark:text-black` - Black text in dark mode
- `dark:hover:bg-gray-100` - Slight gray on hover in dark mode
- `dark:hover:text-black` - Keep text black on hover (prevents default hover text color)

- **Filter Pills**: Rounded-full buttons with dropdown popovers
- **Action Buttons**: Default rounded (squared), NOT rounded-full
- **Multi-select**: Filters use arrays, not single values
- **Column Customizer**: Separate component, NOT DataTable's built-in
- **Clear Button**: Shows "×" with white bg in dark mode when filter is active

### Components

| Component               | Location                                     | Purpose                          |
| ----------------------- | -------------------------------------------- | -------------------------------- |
| `FilterPill`            | `@/components/filters/FilterPill`            | Pill button with popover trigger |
| `CheckboxFilterContent` | `@/components/filters/CheckboxFilterContent` | Multi-select checkbox list       |
| `ColumnCustomizer`      | `@/components/filters/ColumnCustomizer`      | Column visibility toggles        |

### Code Example - Filter State

```typescript
// ✅ CORRECT - Use arrays for multi-select
const [statusFilter, setStatusFilter] = useState<string[]>([])
const [typeFilter, setTypeFilter] = useState<string[]>([])
const [paymentMethodFilter, setPaymentMethodFilter] = useState<string[]>([])

// ✅ CORRECT - Column visibility state
const [visibleColumns, setVisibleColumns] = useState<string[]>([
  'select',
  'orderNumber',
  'customer',
  'date',
  'type',
  'items',
  'paymentMethod',
  'total',
  'status',
  'actions',
])

// ❌ WRONG - Single value filters
const [statusFilter, setStatusFilter] = useState<string>('')
```

### Code Example - Filter Options Extraction

```typescript
// Extract unique filter options from data
const statusOptions = useMemo(() => {
  const uniqueStatuses = [...new Set(orders.map(o => o.status))]
  return uniqueStatuses.map(status => ({
    value: status,
    label: t(`statuses.${status}`),
  }))
}, [orders, t])

// For sale types based on orderNumber prefix (FAST vs REGULAR)
const saleTypes = useMemo(() => {
  const saleTypesSet = new Set<string>()
  orders.forEach(o => {
    const isFastSale = o.orderNumber?.startsWith('FAST-')
    saleTypesSet.add(isFastSale ? 'FAST' : 'REGULAR')
  })
  return Array.from(saleTypesSet)
}, [orders])
```

### Code Example - Filtering Logic

```typescript
const filteredData = useMemo(() => {
  return orders.filter(order => {
    // Status filter (multi-select)
    if (statusFilter.length > 0 && !statusFilter.includes(order.status)) {
      return false
    }

    // Type filter based on orderNumber prefix
    if (typeFilter.length > 0) {
      const isFastSale = order.orderNumber?.startsWith('FAST-')
      const orderType = isFastSale ? 'FAST' : 'REGULAR'
      if (!typeFilter.includes(orderType)) {
        return false
      }
    }

    // Payment method filter
    if (paymentMethodFilter.length > 0 && !paymentMethodFilter.includes(order.paymentMethod)) {
      return false
    }

    return true
  })
}, [orders, statusFilter, typeFilter, paymentMethodFilter])
```

### Code Example - Column Filtering

```typescript
// Filter columns based on visibility settings
const filteredColumns = useMemo(() => {
  return columns.filter(col => {
    const colId = col.id || (col as any).accessorKey
    if (!colId) return true // Keep columns without ID
    return visibleColumns.includes(colId)
  })
}, [columns, visibleColumns])

// Pass filtered columns to DataTable
<DataTable
  data={filteredData}
  columns={filteredColumns}  // ← Use filtered columns
  showColumnCustomizer={false}  // ← IMPORTANT: Disable built-in customizer
/>
```

### Code Example - Filter Pills UI

```typescript
import { FilterPill, CheckboxFilterContent, ColumnCustomizer } from '@/components/filters'

// Helper to format filter display label
const getFilterDisplayLabel = (selectedValues: string[], options: { value: string; label: string }[]): string | undefined => {
  if (selectedValues.length === 0) return undefined
  if (selectedValues.length === 1) {
    return options.find(o => o.value === selectedValues[0])?.label
  }
  return `${selectedValues.length} seleccionados`
}

// Filter Pills Row
;<div className="flex flex-wrap items-center gap-2">
  {/* Status Filter */}
  <FilterPill
    label={t('columns.status')}
    activeValue={getFilterDisplayLabel(statusFilter, statusOptions)}
    isActive={statusFilter.length > 0}
    onClear={() => setStatusFilter([])}
  >
    <CheckboxFilterContent title={t('columns.status')} options={statusOptions} selectedValues={statusFilter} onApply={setStatusFilter} />
  </FilterPill>

  {/* Type Filter */}
  <FilterPill
    label={t('columns.type')}
    activeValue={getFilterDisplayLabel(
      typeFilter,
      saleTypes.map(st => ({
        value: st,
        label:
          st === 'FAST'
            ? t('types.FAST', { defaultValue: 'Venta sin productos' })
            : t('types.REGULAR', { defaultValue: 'Venta con productos' }),
      })),
    )}
    isActive={typeFilter.length > 0}
    onClear={() => setTypeFilter([])}
  >
    <CheckboxFilterContent
      title={t('columns.type')}
      options={saleTypes.map(st => ({
        value: st,
        label:
          st === 'FAST'
            ? t('types.FAST', { defaultValue: 'Venta sin productos' })
            : t('types.REGULAR', { defaultValue: 'Venta con productos' }),
      }))}
      selectedValues={typeFilter}
      onApply={setTypeFilter}
    />
  </FilterPill>

  {/* Column Customizer */}
  <ColumnCustomizer columns={columnOptions} onApply={setVisibleColumns} label={t('columns.customize', { defaultValue: 'Columnas' })} />
</div>
```

### DataTable Configuration

**CRITICAL: Disable the built-in column customizer when using FilterPill-based filters.**

```typescript
// ❌ WRONG - Uses built-in customizer (duplicate UI)
<DataTable
  data={filteredData}
  columns={columns}
  // showColumnCustomizer defaults to true
/>

// ✅ CORRECT - Disable built-in, use FilterPill-based customizer
<DataTable
  data={filteredData}
  columns={filteredColumns}  // ← Already filtered by visibility
  showColumnCustomizer={false}  // ← Disable built-in
/>
```

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Order/Orders.tsx` - **Reference implementation**

**Where to apply (needs migration):**

- ❌ `/src/pages/Payment/Payments.tsx` - Still uses old filter pattern
- ❌ `/src/pages/Customers/Customers.tsx` - Still uses old filter pattern
- ❌ `/src/pages/Inventory/Inventory.tsx` - Still uses old filter pattern

**Checklist for implementing:**

- [ ] Import filter components from `@/components/filters`
- [ ] Change filter state from single value to array (`useState<string[]>([])`)
- [ ] Create `filteredColumns` useMemo based on `visibleColumns`
- [ ] Add `showColumnCustomizer={false}` to DataTable
- [ ] Pass `filteredColumns` to DataTable instead of `columns`
- [ ] Memoize filter options extraction

### Accessibility

- Filter pills are keyboard accessible (Tab, Enter to open)
- Checkboxes support Space to toggle
- Focus traps work correctly in popovers
- Clear button has aria-label for screen readers

---

## Clickable Elements Inside DataTable (MANDATORY)

**⚠️ ALWAYS add underline styling to clickable elements inside DataTable cells to indicate interactivity. ALWAYS use `stopPropagation()` to prevent row click events.**

**When to use:** Any clickable element inside a DataTable cell that performs an action different from the row click (e.g., opening a dialog, navigating to a sub-page, triggering a specific action).

### Why This Pattern

DataTable rows are often clickable themselves (to view details). When a cell contains an interactive element like a button or link that does something different:
1. **Visual affordance**: Users need to know the element is clickable (underline indicates this)
2. **Event isolation**: Clicking the element should NOT also trigger the row click (`stopPropagation()`)

### Visual Specifications

- **Underline**: Solid underline with offset (`underline underline-offset-4`)
- **Decoration color**: Use 50% opacity for subtlety (`decoration-foreground/50` or `decoration-muted-foreground/50`)
- **Cursor**: Always `cursor-pointer`
- **No dotted underline**: Use solid underline, NOT `decoration-dotted`

### Code Example - Clickable Values

```typescript
// In column definition
{
  accessorKey: 'currentStock',
  header: t('columns.stock'),
  cell: ({ row }) => {
    const item = row.original
    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={e => {
          e.stopPropagation()  // ← CRITICAL: Prevents row click
          setSelectedItem(item)
          setDialogOpen(true)
        }}
        className="px-1"
      >
        <span className="text-sm font-semibold underline underline-offset-4 decoration-foreground/50 cursor-pointer">
          {formatNumber(item.currentStock)}
        </span>
      </Button>
    )
  },
},
```

### Code Example - Recipe Usage Button

```typescript
{
  id: 'recipeUsage',
  header: t('columns.usage'),
  cell: ({ row }) => {
    const material = row.original
    const recipeCount = material.recipeCount || 0

    return (
      <Button
        variant="ghost"
        size="sm"
        onClick={e => {
          e.stopPropagation()  // ← CRITICAL
          setSelectedMaterial(material)
          setRecipeUsageDialogOpen(true)
        }}
        className="gap-1 whitespace-nowrap px-1"
      >
        <ChefHat className="h-4 w-4 shrink-0" />
        {recipeCount > 0 ? (
          <span className="text-sm underline underline-offset-4 decoration-foreground/50">
            {t('usage.inRecipes', { count: recipeCount })}
          </span>
        ) : (
          <span className="text-sm text-muted-foreground underline underline-offset-4 decoration-muted-foreground/50">
            {t('usage.notUsed')}
          </span>
        )}
      </Button>
    )
  },
},
```

### Key Classes Breakdown

| Element | Classes | Purpose |
|---------|---------|---------|
| Active values | `underline underline-offset-4 decoration-foreground/50` | Visible underline with good spacing |
| Muted values | `underline underline-offset-4 decoration-muted-foreground/50` | Subtle underline for secondary actions |
| Button wrapper | `variant="ghost" size="sm" px-1` | Minimal styling, clickable area |

### stopPropagation() Rule (CRITICAL)

**⚠️ ALWAYS call `e.stopPropagation()` in the `onClick` handler of interactive elements inside DataTable cells.**

```typescript
// ❌ WRONG - Clicking button also triggers row click
onClick={() => {
  setDialogOpen(true)
}}

// ✅ CORRECT - Only button action fires
onClick={e => {
  e.stopPropagation()  // ← Add this FIRST
  setDialogOpen(true)
}}
```

**Why `stopPropagation()`?**
- DataTable rows have their own click handlers (e.g., `onRowClick`)
- Without it, clicking a cell button triggers BOTH the button action AND the row action
- This causes confusing behavior (e.g., dialog opens AND navigation happens)

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Inventory/RawMaterials.tsx` (lines 478-530) - Stock values and recipe usage buttons

**Where to apply:**

- ✅ Stock/quantity values that open adjustment dialogs
- ✅ Recipe usage indicators that open recipe lists
- ✅ Status badges that open status change dialogs
- ✅ Any cell value that triggers an action different from row click
- ❌ Cell values that are purely display (no interaction)
- ❌ Row actions in the "actions" column (those already have proper styling)

### Checklist

When adding clickable elements to DataTable cells:

- [ ] Add `onClick` with `e.stopPropagation()` as first line
- [ ] Add underline classes: `underline underline-offset-4 decoration-foreground/50`
- [ ] Use `cursor-pointer` (usually inherited from Button)
- [ ] Use `variant="ghost"` for Button wrapper to avoid visual clutter
- [ ] Test that clicking the element does NOT also trigger row click
- [ ] Use solid underline (NOT `decoration-dotted`)

---

## Icon-Based Radio Group Selection

**When to use:** Selection interfaces where users choose between 2-4 mutually exclusive options, especially for:

- Progressive disclosure scenarios (different form fields based on selection)
- Feature configuration (tracking methods, settings)
- Mode selection (view modes, filtering options)

**Why this pattern:** Provides visual hierarchy and makes options more scannable than plain text radio buttons. Icons serve as visual
anchors that help users quickly identify and remember options.

### Visual Specifications

- **Icon Container**: 40x40px (`w-10 h-10`) with rounded corners (`rounded-lg`)
- **Icon Size**: 20x20px (`h-5 w-5`)
- **Spacing**: 12px gap between icon and text (`gap-3`)
- **Padding**: 16px all around the option container (`p-4`)
- **Border**: 1px solid border with hover state
- **Background**: Card background with hover accent (`bg-card hover:bg-accent/50`)

### Color Conventions

Use semantic color coding to reinforce option meanings:

| Color          | Use Case                              | Example                        | Classes                                                                        |
| -------------- | ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------ |
| **Gray/Muted** | Neutral, disabled, or "none" options  | No tracking, Default view      | `bg-muted` + `text-muted-foreground`                                           |
| **Green**      | Positive, simple, or standard actions | Quantity tracking, Basic mode  | `bg-green-100 dark:bg-green-950/50` + `text-green-600 dark:text-green-400`     |
| **Orange**     | Advanced, complex, or warning states  | Recipe tracking, Advanced mode | `bg-orange-100 dark:bg-orange-950/50` + `text-orange-600 dark:text-orange-400` |
| **Blue**       | Information, primary actions          | Report generation, Export      | `bg-blue-100 dark:bg-blue-950/50` + `text-blue-600 dark:text-blue-400`         |
| **Red**        | Destructive, critical states          | Delete mode, Critical alerts   | `bg-red-100 dark:bg-red-950/50` + `text-red-600 dark:text-red-400`             |

### Code Example

```typescript
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Store, Package, Beef } from 'lucide-react'
;<RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
  {/* Option 1: No Tracking (Gray/Neutral) */}
  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
    <RadioGroupItem value="none" id="no-tracking" />
    <Label htmlFor="no-tracking" className="flex-1 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-muted">
          <Store className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t('noTracking')}</p>
          <p className="text-xs text-muted-foreground">{t('noTrackingDesc')}</p>
        </div>
      </div>
    </Label>
  </div>

  {/* Option 2: Quantity Tracking (Green/Simple) */}
  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
    <RadioGroupItem value="QUANTITY" id="track-quantity" />
    <Label htmlFor="track-quantity" className="flex-1 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-green-100 dark:bg-green-950/50">
          <Package className="h-5 w-5 text-green-600 dark:text-green-400" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t('trackByQuantity')}</p>
          <p className="text-xs text-muted-foreground">{t('trackByQuantityDesc')}</p>
        </div>
      </div>
    </Label>
  </div>

  {/* Option 3: Recipe Tracking (Orange/Advanced) */}
  <div className="flex items-center space-x-2 p-4 rounded-lg border border-border bg-card hover:bg-accent/50 transition-colors cursor-pointer">
    <RadioGroupItem value="RECIPE" id="track-recipe" />
    <Label htmlFor="track-recipe" className="flex-1 cursor-pointer">
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-orange-100 dark:bg-orange-950/50">
          <Beef className="h-5 w-5 text-orange-600 dark:text-orange-400" />
        </div>
        <div>
          <p className="font-medium text-foreground">{t('trackByRecipe')}</p>
          <p className="text-xs text-muted-foreground">{t('trackByRecipeDesc')}</p>
        </div>
      </div>
    </Label>
  </div>
</RadioGroup>
```

### Icon Selection Guidelines

Choose icons that clearly represent the option:

- **Store/Building**: Default state, basic mode, no special features
- **Package/Box**: Standard tracking, inventory, quantity-based
- **Beef/Utensils**: Recipe-based, ingredient tracking, cooking
- **FileText/Document**: Report generation, documentation
- **Settings/Sliders**: Configuration, advanced settings
- **Trash/AlertTriangle**: Destructive actions, warnings

### Accessibility

- Always pair `RadioGroupItem` with `Label` using matching `id` attributes
- Use `cursor-pointer` on the entire clickable area
- Provide descriptive text for each option (title + description)
- Ensure color is not the only indicator (use icons + text)
- Test with keyboard navigation (Tab, Space, Arrow keys)

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Inventory/components/ProductWizardDialog.tsx` (lines 1273-1302)
- `/src/pages/Menu/Products/productId.tsx` (lines 765-812)

**Where to apply:**

- ✅ Inventory tracking method selection
- ✅ View mode selection (grid/list/calendar)
- ✅ Report type selection
- ✅ Export format selection
- ❌ Simple yes/no toggles (use Switch component instead)
- ❌ More than 5 options (consider Dropdown/Select instead)

---

## Horizontal Navigation (VenueEditLayout Pattern)

**When to use:** Multi-section pages where users need to navigate between related content areas (tabs/subpages).

**Pattern characteristics:**

- Sticky horizontal navigation bar
- Border-bottom indicator for active tab
- Hash-based routing (`#details`, `#inventory`) or nested routes
- Consistent spacing and transitions

### Visual Specifications

- **Height**: 56px (`h-14`)
- **Border**: Bottom border on container (`border-b border-border`)
- **Active Indicator**: 2px bottom border (`border-b-2 border-primary`)
- **Spacing**: 24-32px between items (`space-x-6 lg:space-x-8`)
- **Padding**: 24px horizontal (`px-6`)
- **Position**: Sticky with appropriate z-index

### Code Example

```typescript
import { cn } from '@/lib/utils'
import { useLocation } from 'react-router-dom'

const currentTab = location.hash.replace('#', '') || 'details'

<nav className="sticky top-14 bg-card h-14 z-10 shadow-sm flex items-center space-x-6 lg:space-x-8 border-b border-border px-6">
  <a
    href="#details"
    className={cn(
      'text-sm font-medium transition-colors py-4 border-b-2',
      currentTab === 'details'
        ? 'text-foreground border-primary'
        : 'text-muted-foreground border-transparent hover:text-primary'
    )}
  >
    {t('details')}
  </a>

  <a
    href="#inventory"
    className={cn(
      'text-sm font-medium transition-colors py-4 border-b-2',
      currentTab === 'inventory'
        ? 'text-foreground border-primary'
        : 'text-muted-foreground border-transparent hover:text-primary'
    )}
  >
    {t('inventory')}
  </a>

  <a
    href="#modifiers"
    className={cn(
      'text-sm font-medium transition-colors py-4 border-b-2',
      currentTab === 'modifiers'
        ? 'text-foreground border-primary'
        : 'text-muted-foreground border-transparent hover:text-primary'
    )}
  >
    {t('modifiers')}
  </a>
</nav>
```

### When to Use Hash-Based vs Nested Routes

**Hash-based (`#details`):**

- ✅ Single-page forms with multiple sections
- ✅ All data loaded at once
- ✅ No separate API calls per section
- ✅ Example: Product detail page, settings page

**Nested routes (`/edit/basic-info`):**

- ✅ Each section has distinct data requirements
- ✅ Separate API calls per section
- ✅ Deep linking to specific sections required
- ✅ Example: Venue settings, multi-step wizards

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Venue/VenueEditLayout.tsx` (nested routes version)
- `/src/pages/Menu/Products/productId.tsx` (hash-based version)

**Sticky positioning stack:**

1. Main header: `top-0` (z-10)
2. Navigation: `top-14` (56px, z-10)
3. Content: scrollable below navigation

### Accessibility

- Use semantic `<nav>` element
- Ensure keyboard navigation works (Tab, Enter)
- Provide clear visual feedback for active state
- Test with screen readers
- Consider adding `aria-current="page"` to active tab

---

## Multi-Step Wizard Dialog

**When to use:** Complex forms with many fields that need to be broken into logical steps to reduce cognitive load and guide users through
the process.

**Pattern characteristics:**

- Dialog-based wizard with step counter and progress bar
- Each step has its own form with validation
- Rich tooltips on complex fields to explain what the user is configuring
- Navigation between steps with Previous/Next buttons
- Submit only on final step

### Visual Specifications

- **Dialog**: Max width 600-700px (`max-w-2xl` or `max-w-3xl`)
- **Progress Bar**: Full width with 8px height (`h-2`)
- **Step Counter**: "Step X of Y" badge with muted styling
- **Navigation Buttons**: Previous (secondary) + Next/Submit (primary)
- **Rich Tooltips**: Colored backgrounds with icons and examples

### Code Example - Main Wizard Component

```typescript
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Progress } from '@/components/ui/progress'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'

type WizardStep = 1 | 2 | 3 | 4
const TOTAL_STEPS = 4

interface WizardProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  venueId: string
  onSuccess: (id: string) => void
}

export function CreateWizard({ open, onOpenChange, venueId, onSuccess }: WizardProps) {
  const { t } = useTranslation('namespace')
  const [currentStep, setCurrentStep] = useState<WizardStep>(1)

  // Separate form for each step
  const step1Form = useForm<Step1Data>({ resolver: zodResolver(step1Schema) })
  const step2Form = useForm<Step2Data>({ resolver: zodResolver(step2Schema) })
  // ... more forms

  // Accumulated data from previous steps
  const [step1Data, setStep1Data] = useState<Step1Data | null>(null)
  const [step2Data, setStep2Data] = useState<Step2Data | null>(null)

  const handleStep1Submit = async (data: Step1Data) => {
    setStep1Data(data)
    setCurrentStep(2)
  }

  const handleFinalSubmit = async (data: FinalStepData) => {
    // Combine all step data and submit
    const fullData = { ...step1Data, ...step2Data, ...data }
    await createMutation.mutateAsync(fullData)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader className="space-y-4">
          {/* Step Counter */}
          <div className="flex items-center justify-between">
            <DialogTitle>{t('wizard.title')}</DialogTitle>
            <span className="text-sm text-muted-foreground bg-muted px-3 py-1 rounded-full">
              {t('wizard.progress', { current: currentStep, total: TOTAL_STEPS })}
            </span>
          </div>

          {/* Progress Bar */}
          <Progress value={(currentStep / TOTAL_STEPS) * 100} className="h-2" />
        </DialogHeader>

        {/* Step Content */}
        {currentStep === 1 && (
          <Form {...step1Form}>
            <form onSubmit={step1Form.handleSubmit(handleStep1Submit)} className="space-y-6">
              <WizardStep1 form={step1Form} />

              {/* Navigation */}
              <div className="flex justify-end pt-4 border-t">
                <Button type="submit">
                  {t('wizard.next')}
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              </div>
            </form>
          </Form>
        )}

        {/* More steps... */}

        {currentStep === TOTAL_STEPS && (
          <Form {...finalForm}>
            <form onSubmit={finalForm.handleSubmit(handleFinalSubmit)} className="space-y-6">
              <WizardStepFinal form={finalForm} />

              {/* Navigation with Previous and Submit */}
              <div className="flex justify-between pt-4 border-t">
                <Button type="button" variant="outline" onClick={() => setCurrentStep(prev => prev - 1)}>
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  {t('wizard.previous')}
                </Button>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t('wizard.create')}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  )
}
```

### Rich Tooltips Pattern

Use colored backgrounds in tooltips to explain complex fields:

```typescript
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Info } from 'lucide-react'
;<div className="flex items-center gap-2">
  <Label>{t('form.fields.complexField')}</Label>
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <Info className="h-4 w-4 text-muted-foreground cursor-help" />
      </TooltipTrigger>
      <TooltipContent className="max-w-sm" side="right">
        <div className="space-y-2">
          <p className="font-semibold">{t('wizard.hints.field.title')}</p>
          <p className="text-sm text-muted-foreground">{t('wizard.hints.field.description')}</p>

          {/* Colored example box */}
          <div className="bg-blue-50 dark:bg-blue-950/30 p-2 rounded-md border border-blue-200 dark:border-blue-800">
            <p className="text-xs text-blue-900 dark:text-blue-100">
              <strong>{t('wizard.hints.field.example')}</strong>
            </p>
            <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">{t('wizard.hints.field.exampleText')}</p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

### Tooltip Color Conventions

| Color      | Use Case                             | Classes                                                                       |
| ---------- | ------------------------------------ | ----------------------------------------------------------------------------- |
| **Blue**   | General information, examples        | `bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800`         |
| **Green**  | Positive effects, enabled states     | `bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800`     |
| **Yellow** | Warnings, important notes            | `bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800` |
| **Orange** | Advanced features, special cases     | `bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800` |
| **Red**    | Disabled states, destructive effects | `bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800`             |

### Wizard Step File Organization

Organize wizard steps in a dedicated folder:

```
src/pages/Feature/
├── Feature.tsx              # Main page with wizard state
├── components/
│   ├── FeatureWizard.tsx    # Main wizard component
│   └── wizard-steps/
│       ├── WizardStep1BasicInfo.tsx
│       ├── WizardStep2Configuration.tsx
│       ├── WizardStep3Rules.tsx
│       └── WizardStep4Advanced.tsx
```

### Translation Structure

```json
{
  "wizard": {
    "title": "Create New Item",
    "subtitle": "Follow the steps to create your item",
    "progress": "Step {{current}} of {{total}}",
    "previous": "Previous",
    "next": "Next",
    "create": "Create Item",
    "step1": {
      "title": "Basic Information",
      "description": "Start by setting up the basic details"
    },
    "step2": {
      "title": "Configuration",
      "description": "Configure the behavior"
    },
    "hints": {
      "field": {
        "title": "What is this?",
        "description": "Detailed explanation...",
        "example": "Example:",
        "exampleText": "Concrete example of how it works"
      }
    }
  }
}
```

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Promotions/components/DiscountWizard.tsx` - **Reference implementation**
- `/src/pages/Inventory/components/ProductWizardDialog.tsx` - Product creation wizard
- `/src/components/ConversionWizard.tsx` - Onboarding conversion wizard

**Where to apply:**

- ✅ Complex form creation with 5+ fields
- ✅ Forms with conditional sections based on selections
- ✅ Multi-step processes (onboarding, setup)
- ✅ When users need guidance through configuration
- ❌ Simple forms with 2-3 fields (use modal form instead)
- ❌ Edit forms where users need quick access to all fields

### Accessibility

- Ensure step navigation works with keyboard (Tab, Enter)
- Announce step changes to screen readers
- Provide clear error messages per step
- Allow users to go back and correct previous steps
- Focus management: move focus to first field of each step

---

## Form Input Patterns

### Number Input Styling - Hide Spinners (MANDATORY)

**⚠️ ALWAYS hide the spinner arrows on number inputs for a cleaner, more modern appearance.**

Number inputs show increment/decrement arrows by default in most browsers. These should be hidden using Tailwind's arbitrary variant syntax.

```typescript
// ❌ WRONG - Shows spinner arrows
<Input type="number" className="w-16" />

// ✅ CORRECT - Hides spinner arrows
<Input
  type="number"
  className="w-16 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
/>
```

**Classes breakdown:**
- `[appearance:textfield]` - Hides spinners in Firefox
- `[&::-webkit-outer-spin-button]:appearance-none` - Hides outer spinner in Chrome/Safari
- `[&::-webkit-inner-spin-button]:appearance-none` - Hides inner spinner in Chrome/Safari

**When to use:**
- ✅ ALL number inputs in forms, tables, and dialogs
- ✅ Quantity inputs in purchase orders, inventory
- ✅ Price and numeric configuration fields
- ❌ Never show spinner arrows (no exceptions)

**Reference:** `/src/pages/Inventory/PurchaseOrders/components/LabelPrintDialog.tsx`

### Number Input with React Hook Form (CRITICAL)

**⚠️ NEVER use `|| 0` or `{...field}` spread for number inputs** - this prevents users from clearing the field with backspace.

```typescript
// ❌ WRONG - User can't delete the value with backspace
<Input
  type="number"
  {...field}
  onChange={e => field.onChange(parseFloat(e.target.value) || 0)}
/>

// ❌ STILL WRONG - {...field} spreads field.value which shows 0 when undefined
<Input
  type="number"
  {...field}
  onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
/>

// ✅ CORRECT - Explicit value handling with ?? ''
<Input
  type="number"
  name={field.name}
  ref={field.ref}
  onBlur={field.onBlur}
  value={field.value ?? ''}  // ← KEY: Shows empty when undefined
  onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
/>
```

**Also set defaultValue to `undefined`, NOT `0`:**

```typescript
// ❌ WRONG
const form = useForm({
  defaultValues: {
    value: 0, // Input starts with "0" that user can't clear
  },
})

// ✅ CORRECT
const form = useForm({
  defaultValues: {
    value: undefined, // Input starts empty
  },
})
```

**Why this matters:**

- `{...field}` spreads `field.value` which shows `0` even when you want empty
- `value ?? ''` converts `undefined`/`null` to empty string for display
- `defaultValue: 0` means the input always has a value the user can't fully clear
- Required validation should be handled by form schema, not UI hacks

### Required Field Validation

**Always use form validation (react-hook-form + zod) for required fields:**

```typescript
// Form schema handles required validation
const schema = z.object({
  value: z.number({ required_error: t('validation.required') }).min(0),
})

// Input allows clearing, validation catches missing values
<Input
  type="number"
  value={field.value ?? ''}
  onChange={e => field.onChange(e.target.value === '' ? undefined : parseFloat(e.target.value))}
/>
```

### Select/MultipleSelector with Empty State and Create Button (MANDATORY)

**⚠️ ALWAYS include "no results" message and "+ Create" button in Select and MultipleSelector components.**

#### For Select Component:

```typescript
<Select onValueChange={field.onChange} value={field.value}>
  <SelectTrigger>
    <SelectValue placeholder={t('selectPlaceholder')} />
  </SelectTrigger>
  <SelectContent>
    {/* Show "No results" if empty */}
    {options.length === 0 ? (
      <div className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</div>
    ) : (
      options.map(option => (
        <SelectItem key={option.value} value={option.value}>
          {option.label}
        </SelectItem>
      ))
    )}

    {/* ALWAYS include Create button at bottom */}
    <div className="border-t p-1">
      <Button variant="ghost" className="w-full justify-start" asChild>
        <Link to="/path/to/create">
          <Plus className="mr-2 h-4 w-4" />
          {tCommon('create')} {t('entityName')}
        </Link>
      </Button>
    </div>
  </SelectContent>
</Select>
```

#### For MultipleSelector Component:

```typescript
<MultipleSelector
  value={field.value}
  onChange={field.onChange}
  options={options}
  placeholder={t('selectPlaceholder')}
  emptyIndicator={<p className="py-6 text-center text-sm text-muted-foreground">{tCommon('no_results')}</p>}
  footer={
    <Button variant="ghost" className="w-full justify-start" asChild>
      <Link to="/path/to/create">
        <Plus className="mr-2 h-4 w-4" />
        {tCommon('create')} {t('entityName')}
      </Link>
    </Button>
  }
/>
```

**Key points:**

- **Empty state**: Always show `{tCommon('no_results')}` when no options available
- **Create button**: Always add `+ Create [Entity]` at the bottom that links to the create page
- **Link destination**: Use the actual create route (e.g., `/menu/products/create`, `/customers/groups/create`)
- **Styling**: Use `border-t p-1` for separator, `variant="ghost"` and `justify-start` for button

**Common create routes:**

- Products: `/menu/products/create`
- Categories: `/menu/categories/create`
- Customer Groups: `/customers/groups/create`
- Modifiers: `/menu/modifiers/create`

### Radio Card Selection with Gradient Background

**When creating card-based radio selections, use consistent styling:**

```typescript
<div key={option.value} className="h-full">
  <RadioGroupItem value={option.value} id={option.value} className="peer sr-only" />
  <Label
    htmlFor={option.value}
    className={cn(
      // Base styles with gradient matching inputs
      'flex flex-col items-center justify-center rounded-lg border border-input p-4 cursor-pointer transition-all h-full',
      'bg-linear-to-b from-muted to-muted/70 dark:from-zinc-900 dark:to-zinc-950',
      // Hover and selected states
      'hover:border-primary/50',
      'peer-data-[state=checked]:border-primary peer-data-[state=checked]:ring-2 peer-data-[state=checked]:ring-primary/20',
      '[&:has([data-state=checked])]:border-primary',
    )}
  >
    {/* Card content */}
  </Label>
</div>
```

**Key points:**

- Use `h-full` on both wrapper div and Label for equal heights
- Apply same gradient as inputs: `bg-linear-to-b from-muted to-muted/70 dark:from-zinc-900 dark:to-zinc-950`
- Use `border-input` for consistent border color
- Add ring effect on selection for visual feedback

---

## Consistent Card Actions Layout (MANDATORY)

**When to use:** Any card grid where cards may have variable content height but action buttons need to stay visually aligned across the
grid.

**Pattern characteristics:**

- Cards use `flex flex-col` to enable vertical layout control
- Dynamic/optional content (like messages, notes, or expandable sections) goes in a `flex-1` container
- Action buttons use `mt-auto` to always stick to the bottom

### Why This Pattern

When displaying cards in a grid (e.g., `grid-cols-2`), if one card has extra content (like a dispute message) and another doesn't, the
action buttons will be at different vertical positions. This creates visual inconsistency and makes the UI feel broken.

**The fix:** Use flexbox to push actions to the bottom regardless of content height.

### Visual Example

```
❌ WITHOUT pattern (buttons misaligned):
┌────────────────┐  ┌────────────────┐
│ Header         │  │ Header         │
│                │  │                │
│ Amounts        │  │ Amounts        │
│                │  │                │
│ [Extra content]│  │ ─────────────  │
│                │  │ [Actions]      │
│ ─────────────  │  └────────────────┘
│ [Actions]      │
└────────────────┘

✅ WITH pattern (buttons aligned):
┌────────────────┐  ┌────────────────┐
│ Header         │  │ Header         │
│                │  │                │
│ Amounts        │  │ Amounts        │
│                │  │                │
│ [Extra content]│  │                │
│                │  │                │
│ ─────────────  │  │ ─────────────  │
│ [Actions]      │  │ [Actions]      │
└────────────────┘  └────────────────┘
```

### Code Example

```typescript
<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
  {items.map(item => (
    <Card key={item.id} className="p-5 flex flex-col">
      {/* Fixed content - Always in same position */}
      <div className="flex items-start justify-between mb-4">
        <h3 className="font-semibold">{item.title}</h3>
        <Badge>{item.status}</Badge>
      </div>

      {/* More fixed content */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <MetricBox label="Metric 1" value={item.metric1} />
        <MetricBox label="Metric 2" value={item.metric2} />
        <MetricBox label="Metric 3" value={item.metric3} />
      </div>

      {/* FLEXIBLE AREA - Dynamic content goes here */}
      <div className="flex-1">
        {item.hasExtraContent && (
          <div className="mb-4 p-3 rounded-lg bg-muted">
            <p>{item.extraContent}</p>
          </div>
        )}
      </div>

      {/* ACTIONS - Always at bottom with mt-auto */}
      <div className="flex items-center gap-2 pt-4 border-t border-border/50 mt-auto">
        <Button size="sm" onClick={() => handleAction(item.id)}>
          {t('action.primary')}
        </Button>
        <Button size="sm" variant="outline">
          {t('action.secondary')}
        </Button>
      </div>
    </Card>
  ))}
</div>
```

### Key Classes Breakdown

| Element                 | Classes         | Purpose                                    |
| ----------------------- | --------------- | ------------------------------------------ |
| Card container          | `flex flex-col` | Enable vertical flex layout                |
| Dynamic content wrapper | `flex-1`        | Takes remaining space, pushes actions down |
| Actions container       | `mt-auto`       | Sticks to bottom of card                   |

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Commissions/components/SummaryApprovalList.tsx` - Approval cards with optional dispute messages

**Where to apply:**

- ✅ Card grids where some cards have conditional content
- ✅ Approval/review interfaces with notes or messages
- ✅ Product cards with variable descriptions
- ✅ Any two-column card layout with action buttons
- ❌ Single-column layouts where alignment doesn't matter
- ❌ Cards with no action buttons

### Accessibility

- Ensure action buttons have consistent tab order
- Screen readers should announce card content in logical order
- Focus management should work consistently regardless of card height

---

---

## Live Preview Layout (Bento Grid)

**When to use:** Creation or editing forms for entities where visual feedback is valuable (e.g., Categories, Menus, Modifier Groups,
Promotions). It helps the user understand how the configuration will look in the final interface.

**Pattern characteristics:**

- **Responsive Grid**: Stacks vertically on smaller screens and uses a 2-column bento layout on desktop (`xl` breakpoint+).
- **Proportions**: Left column (form) is wider than the right column (preview) - usually `1.35fr` vs `1fr`.
- **Live Sync**: Changes in the form are reflected instantly in the preview card on the right.
- **ExampleCard**: Uses a specialized wrapper with a dashed border and a "PREVIEW" indicator.

### Visual Specifications

- **Desktop Layout**: `grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6` (use `xl` to prevent overlap).
- **Preview Card**: `ExampleCard` component with a dashed border (`border-dashed`).
- **Indicator**: A subtle "VISTA PREVIA" or "EJEMPLO" label at the top with a `Sparkles` icon.

### Code Example

```typescript
import { ExampleCard } from '@/components/example-card'
import { Card, CardContent } from '@/components/ui/card'

{
  /* Grid starts stacking as column and becomes grid at xl */
}
;<div className="grid grid-cols-1 xl:grid-cols-[1.35fr_1fr] gap-6">
  {/* Left: Input Form */}
  <Card className="border-border/60">
    <CardContent className="space-y-4 pt-6">
      <FormField
        control={form.control}
        name="name"
        render={({ field }) => (
          <FormItem>
            <FormLabel>{t('forms.name')}</FormLabel>
            <FormControl>
              <Input placeholder={t('labels.placeholder')} {...field} />
            </FormControl>
          </FormItem>
        )}
      />
      {/* ... other fields */}
    </CardContent>
  </Card>

  {/* Right: Live Preview */}
  <ExampleCard title={t('preview.label')}>
    <div className="space-y-3">
      <p className="text-sm font-semibold">{form.watch('name') || t('placeholder.name')}</p>
      {/* Visualization of other fields */}
    </div>
  </ExampleCard>
</div>
```

### Key Practices

1. **Responsive First**: Always use `xl:` for the grid layout. Using `lg:` often leads to overlap on medium/tablet screens if labels are
   long (e.g., "Disponible hasta").
2. **Watch Values**: Use `form.watch()` to get real-time data for the preview.
3. **Fallbacks**: Provide meaningful fallback text in the preview if the form fields are empty.
4. **Consistency**: Use the `ExampleCard` component to maintain the same dashed border and sparkles icon across the app.

### Real-World Usage

**Examples in codebase:**

- `src/pages/Menu/Modifiers/components/CreateModifierGroupWizard.tsx` - **Original Pattern**
- `src/pages/Menu/Categories/components/CategoryWizardDialog.tsx`
- `src/components/example-card.tsx` - **Reference Component**

**Where to apply:**

- ✅ Entity creation wizards (Step-by-step)
- ✅ Entity edit pages (Main configuration section)
- ✅ Promotion creation (Previewing the discount banner)
- ✅ Ticket/Invoice design configuration

---

## Contributing

When adding new UI patterns:

1. **Document thoroughly**: Include "when to use", code examples, and accessibility notes
2. **Provide real examples**: Link to existing implementations in the codebase
3. **Show variations**: Cover light/dark mode, responsive design

---

## Searchable Multi-Select (Long Lists)

**When to use:** Multi-select inputs where the list of options is long (10+) and requires searching/filtering for better usability.

**Why this pattern:** The standard `MultipleSelector` can be overwhelming with too many options. This pattern uses a `Popover` + `Command`
combination to keep the interface clean while offering powerful search capabilities.

### Visual Specifications

- **Trigger**: Looks like a standard input/button, displays selected items as badges.
- **Dropdown**: Searchable command list inside a popover.
- **Badges**: Removable tags directly in the trigger area.

### Code Example

```typescript
import { MultiSelectCombobox } from '@/components/multi-select-combobox'
;<FormField
  control={form.control}
  name="categories"
  render={({ field }) => (
    <FormItem>
      <FormLabel>{t('fields.categories')}</FormLabel>
      <FormControl>
        <MultiSelectCombobox
          options={categories.map(c => ({ label: c.name, value: c.id }))}
          selected={(field.value || []).map((c: any) => ({ label: c.label, value: c.value }))}
          onChange={value => field.onChange(value)}
          placeholder={t('placeholders.selectCategories')}
          emptyText={t('empty.noCategories')}
          isLoading={isLoading}
        />
      </FormControl>
      <FormMessage />
    </FormItem>
  )}
/>
```

### Real-World Usage

**Examples in codebase:**

- `src/components/multi-select-combobox.tsx` - **Reference Component**
- `CategoryWizardDialog.tsx`
- `createMenu.tsx`
- `menuId.tsx`

**Where to apply:**

- ✅ Selecting items from a large catalog (Products, Ingredients)
- ✅ Selecting categories or tags when there are many options
- ✅ Any multi-select scenario where search is crucial

---

## Searchable Dropdown Rule (MANDATORY)

**⚠️ MANDATORY: Dropdowns with more than 4 options MUST include a search/filter input.**

**When to apply:**
- ✅ Category selectors (typically 10-30 options)
- ✅ Unit selectors (20+ measurement units)
- ✅ Country/region selectors
- ✅ Any dropdown with 5+ options

**When NOT needed:**
- ❌ Status filters (2-4 options: Active, Inactive, etc.)
- ❌ Boolean selections (Yes/No, Enabled/Disabled)
- ❌ Small fixed lists (payment methods, order types)

### Preferred Approach: SearchableSelect Component

**⚠️ USE THE REUSABLE COMPONENT** instead of implementing the Popover + Command pattern manually.

```typescript
import { SearchableSelect, type SearchableSelectOption } from '@/components/ui/searchable-select'

// Transform options for SearchableSelect
const categoryOptions = useMemo<SearchableSelectOption[]>(
  () => CATEGORY_OPTIONS.map(cat => ({
    value: cat.value,
    label: t(`categories.${cat.value}`),
    icon: cat.icon,  // Optional: supports React nodes
  })),
  [t]
)

// Usage
<SearchableSelect
  options={categoryOptions}
  value={selectedCategory}
  onValueChange={value => setValue('category', value)}
  placeholder={t('selectCategory')}
  searchPlaceholder={t('searchCategory')}
  emptyMessage={t('noCategoryFound')}
/>
```

**Component Props:**

| Prop | Type | Required | Description |
|------|------|----------|-------------|
| `options` | `SearchableSelectOption[]` | ✅ | Array of options with `value`, `label`, and optional `icon` |
| `value` | `string` | ✅ | Current selected value |
| `onValueChange` | `(value: string) => void` | ✅ | Callback when selection changes |
| `placeholder` | `string` | | Placeholder when no selection |
| `searchPlaceholder` | `string` | | Placeholder for search input |
| `emptyMessage` | `string` | | Message when no results match search |
| `className` | `string` | | Additional CSS classes for trigger button |
| `disabled` | `boolean` | | Disable the dropdown |
| `filterFn` | `(option, search) => boolean` | | Custom filter function (default: label search) |

**Benefits:**
- **Consistent UX**: Same look and behavior across the app
- **Less code**: ~5 lines vs ~50 lines for manual implementation
- **Built-in features**: Search, icons, scroll, modal support (for dialogs)
- **Accessible**: Keyboard navigation, ARIA attributes

**Reference:** `/src/components/ui/searchable-select.tsx`

**Real-world usage:** `/src/pages/Inventory/components/RawMaterialDialog.tsx` (Category and Unit dropdowns)

---

### Manual Implementation (For Custom Cases)

If you need custom behavior not supported by `SearchableSelect`, use `Popover` + `Command` + `ScrollArea`:

```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Check, ChevronsUpDown } from 'lucide-react'

const [open, setOpen] = useState(false)
const [search, setSearch] = useState('')

// Filter options based on search
const filteredOptions = useMemo(() => {
  if (!search) return options
  return options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )
}, [options, search])

<Popover open={open} onOpenChange={setOpen} modal={true}>
  <PopoverTrigger asChild>
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      className="w-full justify-between"
    >
      {selectedOption ? (
        <span className="flex items-center gap-2">
          {selectedOption.icon && <span>{selectedOption.icon}</span>}
          <span>{selectedOption.label}</span>
        </span>
      ) : (
        <span className="text-muted-foreground">{t('select')}</span>
      )}
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-[300px] p-0" align="start">
    <Command shouldFilter={false}>
      <CommandInput
        placeholder={t('search')}
        value={search}
        onValueChange={setSearch}
      />
      <CommandList>
        <CommandEmpty>{t('noResults')}</CommandEmpty>
        <ScrollArea className="h-[300px]">
          <CommandGroup>
            {filteredOptions.map(option => (
              <CommandItem
                key={option.value}
                value={option.value}
                onSelect={() => {
                  setValue(option.value)
                  setOpen(false)
                  setSearch('')
                }}
                className="flex items-center gap-3 cursor-pointer"
              >
                <Check
                  className={cn(
                    'h-4 w-4',
                    selectedValue === option.value ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {option.icon && <span>{option.icon}</span>}
                <span>{option.label}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        </ScrollArea>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### Key Points

| Rule | Implementation |
|------|----------------|
| **When inside Dialog/Modal** | Use `modal={true}` on Popover |
| **Filtering** | Use `shouldFilter={false}` on Command, filter manually with useMemo |
| **Scroll support** | Wrap CommandGroup with `ScrollArea` |
| **Selection indicator** | Use Check icon with conditional opacity |
| **Clear on select** | Reset search to empty string after selection |

### Real-World Usage

**Examples in codebase:**
- `/src/pages/Inventory/components/RawMaterialDialog.tsx` - Category and Unit searchable dropdowns

---

## Scrollable Select/Combobox with Mouse Wheel (CRITICAL)

**⚠️ CRITICAL: When creating a Select or Combobox with scrollable options, you MUST use `ScrollArea` and `modal={true}` for mouse wheel scrolling to work.**

### The Problem

Radix UI's Popover component blocks mouse wheel scrolling when:
1. The Popover is **inside a Dialog** (modal context)
2. Using native CSS overflow (`overflow-y-auto`) instead of ScrollArea
3. Using `modal={false}` (incorrect for nested modals)

This is a known issue in Radix UI primitives that affects Command components inside Popovers within Dialogs.

**User impact:** Users can only scroll by dragging the scrollbar, not with mouse wheel - very frustrating UX.

### The Solution

Use **two key fixes together**:

1. **`modal={true}`** on the Popover (when inside Dialog)
2. **`ScrollArea`** component from Radix UI (not CSS overflow)

### Code Example - Material Combobox (Correct Pattern)

```typescript
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { Check, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ComboboxProps {
  value: string
  onChange: (value: string) => void
  options: Array<{ id: string; name: string; unit: string }>
  placeholder: string
  emptyText: string
}

export function MaterialCombobox({ value, onChange, options, placeholder, emptyText }: ComboboxProps) {
  const [open, setOpen] = useState(false)
  const [searchValue, setSearchValue] = useState('')

  const filteredOptions = useMemo(() => {
    return options.filter((option) =>
      option.name.toLowerCase().includes(searchValue.toLowerCase())
    )
  }, [options, searchValue])

  const selectedOption = options.find((o) => o.id === value)

  return (
    {/* ✅ CRITICAL: modal={true} when Popover is inside Dialog */}
    <Popover open={open} onOpenChange={setOpen} modal={true}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between',
            !value && 'text-muted-foreground'
          )}
        >
          {selectedOption ? selectedOption.name : placeholder}
          <Search className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            placeholder={placeholder}
            value={searchValue}
            onValueChange={setSearchValue}
          />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {/* ✅ CRITICAL: Use ScrollArea instead of overflow-y-auto div */}
            <ScrollArea className="h-[300px]">
              <CommandGroup>
                {filteredOptions.map((option) => (
                  <CommandItem
                    key={option.id}
                    value={option.id}
                    onSelect={() => {
                      onChange(option.id)
                      setOpen(false)
                      setSearchValue('')
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        option.id === value ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <div className="flex-1">
                      <p className="font-medium">{option.name}</p>
                      <p className="text-xs text-muted-foreground">{option.unit}</p>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            </ScrollArea>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
```

### ❌ Common Mistakes

```typescript
// ❌ WRONG - modal={false} doesn't work inside Dialog
<Popover open={open} onOpenChange={setOpen} modal={false}>
  <PopoverContent>
    <Command>
      <CommandList>
        {/* ❌ WRONG - CSS overflow doesn't enable mouse wheel */}
        <div className="max-h-[300px] overflow-y-auto">
          <CommandGroup>
            {/* items */}
          </CommandGroup>
        </div>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>

// ❌ WRONG - No scrolling at all
<Popover open={open} onOpenChange={setOpen}>
  <PopoverContent>
    <Command>
      <CommandList className="max-h-[300px] overflow-y-auto">
        {/* CommandList with overflow classes doesn't work */}
        <CommandGroup>
          {/* items */}
        </CommandGroup>
      </CommandList>
    </Command>
  </PopoverContent>
</Popover>
```

### Why This Works

According to [Radix UI documentation](https://github.com/radix-ui/primitives/issues/1159):

1. **`modal={true}`**: When a Popover is inside a Dialog (which is modal), it needs to be modal too. This creates a new layer of modal interaction that maintains accessibility and allows proper event handling.

2. **`ScrollArea`**: Radix UI's ScrollArea component properly handles wheel events, while native CSS `overflow` can be blocked by the portal system.

3. **Portal behavior**: The combination prevents the Dialog's modal overlay from blocking scroll events on the nested Popover content.

### Key Rules

| Scenario | Popover modal prop | Scroll solution |
|----------|-------------------|-----------------|
| Popover inside Dialog | `modal={true}` ✅ | `ScrollArea` ✅ |
| Popover standalone (not in Dialog) | `modal={false}` or omit | `ScrollArea` or CSS overflow |
| Any long list in Command | N/A | Always use `ScrollArea` |

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Inventory/PurchaseOrders/components/PurchaseOrderWizard.tsx` - **Reference implementation** (Material combobox with mouse wheel scroll)

**Where to apply:**

- ✅ **ALWAYS** when creating Select/Combobox inside Dialog
- ✅ **ALWAYS** when using Command component with long lists
- ✅ Multi-select dropdowns in modal forms
- ✅ Searchable selects in wizards

**Checklist:**

- [ ] Popover has `modal={true}` when inside Dialog
- [ ] Long lists use `<ScrollArea className="h-[300px]">` wrapper
- [ ] ScrollArea wraps CommandGroup, not CommandList
- [ ] Tested mouse wheel scrolling works
- [ ] No `overflow-y-auto` on divs inside Command

### Related Issues & Sources

This is a documented issue in the Radix UI ecosystem:

- [CommandInput + scroll not working when inside a popover within a dialog](https://github.com/radix-ui/primitives/issues/3423) - Radix UI Primitives issue
- [Dialog/Popover Scrolling issue when Popover inside Dialog](https://github.com/radix-ui/primitives/issues/1159) - Popover modal solution
- [Can't scroll commandList inside a Dialog using mouse wheel](https://github.com/dip/cmdk/issues/272) - cmdk library issue
- [Popover scrolling issue with mouse wheel](https://github.com/shadcn-ui/ui/discussions/4175) - shadcn/ui discussion
- [Radix Popover + ScrollArea - CodeSandbox](https://codesandbox.io/s/radix-popover-scrollarea-fm9qyz) - Working example

### Accessibility

- Mouse wheel scrolling improves accessibility for users who can't easily drag scrollbars
- ScrollArea component includes proper ARIA attributes
- Keyboard navigation (Arrow keys) works independently of scroll method
- Focus management works correctly with `modal={true}`

---

## Unit Translation (MANDATORY)

**⚠️ ALWAYS translate unit enum values using `useUnitTranslation()` hook. NEVER display raw enum values (e.g., "KILOGRAM", "LITER") to users.**

**When to use:** Any interface displaying measurement units from inventory raw materials, purchase orders, recipes, or stock movements.

**Reference implementation:** `/src/pages/Inventory/RawMaterials.tsx` (line 55)

### Why This Matters

Users should see "kilogramos" or "kilograms" instead of "KILOGRAM". This improves UX by:
- **Localized units**: Shows units in the user's language (Spanish/English)
- **Professional appearance**: Avoids technical enum values in the UI
- **Proper pluralization**: "1 kilogramo" vs "2 kilogramos"

### The Hook

```typescript
import { useUnitTranslation } from '@/hooks/use-unit-translation'

const { formatUnit, getShortLabel, getFullName, formatUnitWithQuantity } = useUnitTranslation()
```

### Available Functions

| Function | Input | Output Example (ES) | Output Example (EN) | Use Case |
|----------|-------|---------------------|---------------------|----------|
| `formatUnit(unitEnum)` | `"KILOGRAM"` | `"kg (Kilogramo)"` | `"kg (Kilogram)"` | Labels with abbreviation |
| `getShortLabel(unitEnum)` | `"KILOGRAM"` | `"kg"` | `"kg"` | Short form only |
| `getFullName(unitEnum)` | `"KILOGRAM"` | `"kilogramo"` | `"kilogram"` | Full name only |
| `formatUnitWithQuantity(qty, enum)` | `2, "KILOGRAM"` | `"kilogramos"` | `"kilograms"` | Full name with pluralization |
| `formatUnitWithQuantity(qty, enum, true)` | `2, "KILOGRAM", true` | `"kgs"` | `"kgs"` | **Abbreviated** form with pluralization |

### Code Examples

#### ❌ WRONG - Raw enum displayed

```typescript
<TableCell>{item.quantityOrdered} {item.rawMaterial.unit}</TableCell>
// Output: "2 KILOGRAM" ❌
```

#### ✅ CORRECT - With automatic pluralization (RECOMMENDED)

```typescript
const { formatUnitWithQuantity } = useUnitTranslation()

<TableCell>{item.quantityOrdered} {formatUnitWithQuantity(item.quantityOrdered, item.rawMaterial.unit)}</TableCell>
// Output: "1 kilogramo" ✅ or "2 kilogramos" ✅
// Output: "1 kilogram" ✅ or "2 kilograms" ✅
```

#### ✅ CORRECT - Full name only (no pluralization)

```typescript
const { getFullName } = useUnitTranslation()

<TableCell>{getFullName(item.rawMaterial.unit)}</TableCell>
// Output: "kilogramo" ✅ (Spanish) or "kilogram" ✅ (English)
// Use when displaying unit without quantity
```

#### ✅ CORRECT - Dialog with unit label (reactive pluralization)

```typescript
const { formatUnitWithQuantity } = useUnitTranslation()
const [quantity, setQuantity] = useState(0)

<div className="flex items-center gap-2">
  <Input
    type="number"
    value={quantity}
    onChange={(e) => setQuantity(Number(e.target.value))}
  />
  <span className="text-sm text-muted-foreground uppercase">
    {rawMaterial.unit ? formatUnitWithQuantity(quantity, rawMaterial.unit) : ''}
  </span>
</div>
// Shows "1 KILOGRAMO" or "2 KILOGRAMOS" reactively as user types ✅
// Shows "1 KILOGRAM" or "2 KILOGRAMS" in English ✅
```

#### ✅ CORRECT - Abbreviated form for compact views (RECOMMENDED for tables)

```typescript
const { formatUnitWithQuantity } = useUnitTranslation()

// In table "Cantidad" column
<TableCell className="text-right">
  {item.quantityOrdered} {formatUnitWithQuantity(item.quantityOrdered, item.rawMaterial.unit, true)}
</TableCell>
// Output: "2 kgs" ✅ or "1 kg" ✅ (Spanish)
// Output: "2 kgs" ✅ or "1 kg" ✅ (English)

// In dialog label next to input
<div className="flex items-center gap-2">
  <Input type="number" value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} />
  <span className="text-sm text-muted-foreground uppercase">
    {formatUnitWithQuantity(quantity, rawMaterial.unit, true)}
  </span>
</div>
// Output: "1 kg" or "2 kgs" reactively ✅
```

**When to use abbreviated form:**
- ✅ Table columns with limited space (e.g., "Cantidad" column)
- ✅ Dialog labels next to input fields
- ✅ Compact views where full name would be too verbose
- ❌ First-time user onboarding or configuration (use full name for clarity)

### Real-World Usage

**Examples in codebase:**

- `/src/pages/Inventory/RawMaterials.tsx` (lines 482, 521) - **Reference implementation**
- `/src/pages/Inventory/PurchaseOrders/PurchaseOrderDetailPage.tsx` (lines 449, 623, 627) - Purchase order receive dialog

**Where to apply:**

- ✅ Raw materials table (current stock, confirmed stock)
- ✅ Purchase order items (quantity ordered/received)
- ✅ Recipe ingredient lists
- ✅ Stock adjustment dialogs
- ✅ Stock movement history
- ✅ Any UI displaying measurement units

### Translation File Structure

Units are translated in `/src/locales/[en|es]/inventory.json`:

```json
{
  "units": {
    "KILOGRAM": "kilogramo",
    "KILOGRAM_plural": "kilogramos",
    "KILOGRAM_abbr": "kg",
    "KILOGRAM_abbr_plural": "kgs",
    "LITER": "litro",
    "LITER_plural": "litros",
    "LITER_abbr": "L",
    "LITER_abbr_plural": "L",
    "UNIT": "unidad",
    "UNIT_plural": "unidades",
    "UNIT_abbr": "ud",
    "UNIT_abbr_plural": "uds",
    "GRAM": "gramo",
    "GRAM_plural": "gramos",
    "GRAM_abbr": "g",
    "GRAM_abbr_plural": "gs"
  }
}
```

**Translation key patterns:**
- `{UNIT}`: Full singular name (e.g., "kilogramo")
- `{UNIT}_plural`: Full plural name (e.g., "kilogramos")
- `{UNIT}_abbr`: Abbreviated singular (e.g., "kg")
- `{UNIT}_abbr_plural`: Abbreviated plural (e.g., "kgs")

### Checklist

When displaying units in your component:

- [ ] Import `useUnitTranslation()` hook
- [ ] Use `formatUnitWithQuantity(qty, unit)` when displaying units WITH quantity (recommended)
- [ ] Use `formatUnitWithQuantity(qty, unit, true)` for abbreviated form in compact views (tables, labels)
- [ ] Use `getFullName(unit)` only when displaying unit WITHOUT quantity
- [ ] Never display raw enum values like "KILOGRAM"
- [ ] Test in both Spanish and English
- [ ] Verify singular/plural forms work correctly:
  - Full: "1 kilogramo" vs "2 kilogramos"
  - Abbreviated: "1 kg" vs "2 kgs"

### Common Mistakes

❌ **Displaying enum directly**
```typescript
<span>{item.unit}</span> // Shows "KILOGRAM"
```

❌ **Hardcoding units**
```typescript
<span>kg</span> // Not localized
```

❌ **Wrong pluralization**
```typescript
<span>{qty} {unit}s</span> // "2 KILOGRAMs"
```

✅ **Correct approach (with pluralization)**
```typescript
const { formatUnitWithQuantity } = useUnitTranslation()
<span>{qty} {formatUnitWithQuantity(qty, unit)}</span>
// "1 kilogramo" or "2 kilogramos" ✅
```

---

## FullScreenModal (Table Detail View Pattern)

**When to use:** Instead of navigating from a table row to a detail route (e.g., `/promoters/:id`), use FullScreenModal to show detailed information in an overlay that slides up from the bottom.

**Why this pattern:**
- **Context preservation**: User stays on the same page, can easily close and continue browsing the table
- **No route change**: Avoids additional navigation state, back button complexity
- **Visual continuity**: Square-style UX where detail views feel like part of the current flow
- **Mobile-friendly**: Slide-up animation is natural for mobile users

**Pattern characteristics:**
- Full-screen overlay covering everything (header, sidebar, content)
- Slide-up animation from bottom to top (300ms)
- Highest z-index (`z-[9999]`) to cover all UI elements
- Sticky header with: close button (left), title (center), action buttons (right)
- Scrollable content area
- ESC key to close

### Visual Specifications

```
┌──────────────────────────────────────────────────────────────┐
│  [X Close]           Title                    [Save] [More]  │  ← Sticky header
├──────────────────────────────────────────────────────────────┤
│                                                              │
│                                                              │
│                     Scrollable Content                       │
│                                                              │
│              (Charts, forms, details, etc.)                  │
│                                                              │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

- **Header Height**: 64px (`h-16`)
- **Close Button**: 48x48px rounded-full (`h-12 w-12`), `variant="secondary"` (always shows hover state)
- **Header Border**: Subtle border (`border-b border-border/30`)
- **Animation**: `translate-y-full` → `translate-y-0` (300ms ease-out)
- **Z-Index**: `z-[9999]` (covers everything)

### When to Use FullScreenModal vs Route Navigation

| Scenario | Pattern | Why |
|----------|---------|-----|
| **Table → Quick view** | FullScreenModal ✅ | User will return to table quickly |
| **Table → Full edit page** | Route (`/:id`) | Complex editing with sub-navigation |
| **Table → View + possible edit** | FullScreenModal ✅ | Keep context, show details first |
| **Dashboard → Deep detail** | Route (`/:id`) | Needs URL sharing, bookmarking |
| **Audit/Review workflows** | FullScreenModal ✅ | Review multiple items without losing place |

### Code Example - Component Usage

```typescript
import { FullScreenModal } from '@/components/ui/full-screen-modal'
import { Button } from '@/components/ui/button'
import { useState } from 'react'

export function MyTablePage() {
  const [selectedItem, setSelectedItem] = useState<Item | null>(null)
  const [modalOpen, setModalOpen] = useState(false)

  const handleRowClick = (item: Item) => {
    setSelectedItem(item)
    setModalOpen(true)
  }

  return (
    <>
      <DataTable
        data={items}
        columns={columns}
        onRowClick={handleRowClick}
      />

      <FullScreenModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedItem?.name || ''}
        actions={
          <>
            <Button variant="outline" size="sm">
              {t('export')}
            </Button>
            <Button size="sm">
              {t('save')}
            </Button>
          </>
        }
      >
        {selectedItem && (
          <div className="p-6 max-w-7xl mx-auto space-y-6">
            {/* Detail content: charts, info cards, forms, etc. */}
            <PromoterCharts data={selectedItem} />
            <DetailCards item={selectedItem} />
          </div>
        )}
      </FullScreenModal>
    </>
  )
}
```

### Component Props

```typescript
interface FullScreenModalProps {
  /** Controls modal visibility */
  open: boolean
  /** Callback when modal should close (X button, ESC key) */
  onClose: () => void
  /** Title displayed in center of header */
  title: string
  /** Modal content */
  children: React.ReactNode
  /** Optional action buttons for the right side of the header */
  actions?: React.ReactNode
  /** Optional className for the content container */
  contentClassName?: string
}
```

### Component Implementation

The component uses React Portal to render outside the DOM hierarchy, ensuring it covers all UI elements:

```typescript
import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function FullScreenModal({
  open,
  onClose,
  title,
  children,
  actions,
  contentClassName,
}: FullScreenModalProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [isAnimating, setIsAnimating] = useState(false)

  useEffect(() => {
    if (open) {
      setIsVisible(true)
      // Trigger animation after mount (next frame)
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setIsAnimating(true)
        })
      })
      document.body.style.overflow = 'hidden'
    } else {
      setIsAnimating(false)
      // Wait for animation before unmounting
      const timer = setTimeout(() => {
        setIsVisible(false)
        document.body.style.overflow = ''
      }, 300)
      return () => clearTimeout(timer)
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open])

  // ESC key handler
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && open) onClose()
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [open, onClose])

  if (!isVisible) return null

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 z-[9999] flex flex-col bg-background',
        'transition-transform duration-300 ease-out',
        isAnimating ? 'translate-y-0' : 'translate-y-full'
      )}
    >
      {/* Header */}
      <header className="sticky top-0 z-10 flex h-16 items-center justify-between bg-background px-4 border-b border-border/30">
        <Button
          variant="secondary"
          size="icon"
          onClick={onClose}
          className="h-12 w-12 rounded-full"
        >
          <X className="h-6 w-6" />
          <span className="sr-only">Cerrar</span>
        </Button>

        <h1 className="absolute left-1/2 -translate-x-1/2 text-lg font-semibold">
          {title}
        </h1>

        <div className="flex items-center gap-2">
          {actions}
        </div>
      </header>

      {/* Content */}
      <main className={cn('flex-1 overflow-y-auto', contentClassName)}>
        {children}
      </main>
    </div>,
    document.body
  )
}
```

### Key Implementation Details

| Feature | Implementation | Why |
|---------|----------------|-----|
| **React Portal** | `createPortal(..., document.body)` | Renders outside React tree to cover sidebar/header |
| **Double RAF** | `requestAnimationFrame` twice | Ensures DOM is ready before animation starts |
| **Body scroll lock** | `document.body.style.overflow = 'hidden'` | Prevents background scrolling |
| **Animation timing** | 300ms timeout matches CSS duration | Smooth unmount after exit animation |
| **ESC key** | `document.addEventListener('keydown', ...)` | Standard modal UX |

### Real-World Usage

**Examples in codebase:**

- `/src/components/ui/full-screen-modal.tsx` - **Component implementation**
- `/src/pages/playtelecom/PromotersAudit/PromotersAuditPage.tsx` - **Reference usage** (promoter detail view)

**Where to apply:**

- ✅ Staff audit/attendance table → detail view
- ✅ Transaction table → receipt/detail view
- ✅ Order table → quick order review
- ✅ Any table where clicking a row shows extended info
- ❌ Complex edit flows requiring sub-navigation
- ❌ Pages that need to be bookmarkable/shareable via URL
- ❌ Multi-step wizards (use Dialog with steps instead)

### Accessibility

- **ESC key**: Closes modal (standard behavior)
- **Focus trap**: Content is scrollable, header stays fixed
- **Screen reader**: Close button has `sr-only` label
- **Body scroll lock**: Prevents confusing scroll behavior
- **High z-index**: Ensures modal is always on top

### Migration Checklist

When converting a `table → /:id` pattern to FullScreenModal:

- [ ] Import `FullScreenModal` from `@/components/ui/full-screen-modal`
- [ ] Add state: `const [selectedItem, setSelectedItem] = useState(null)`
- [ ] Add state: `const [modalOpen, setModalOpen] = useState(false)`
- [ ] Replace `clickableRow` with `onRowClick` handler
- [ ] Move detail page content into `FullScreenModal` children
- [ ] Add action buttons to `actions` prop if needed
- [ ] Test ESC key closes modal
- [ ] Test animation is smooth
- [ ] Test scrolling works in content area
