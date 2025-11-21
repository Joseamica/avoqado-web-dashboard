# UI Patterns Guide

This guide documents common UI patterns used throughout the Avoqado Dashboard. These patterns ensure consistency, improve user experience, and maintain visual coherence across the application.

## Table of Contents

- [Icon-Based Radio Group Selection](#icon-based-radio-group-selection)
- [Horizontal Navigation (VenueEditLayout Pattern)](#horizontal-navigation-venueeditlayout-pattern)

---

## Icon-Based Radio Group Selection

**When to use:** Selection interfaces where users choose between 2-4 mutually exclusive options, especially for:
- Progressive disclosure scenarios (different form fields based on selection)
- Feature configuration (tracking methods, settings)
- Mode selection (view modes, filtering options)

**Why this pattern:** Provides visual hierarchy and makes options more scannable than plain text radio buttons. Icons serve as visual anchors that help users quickly identify and remember options.

### Visual Specifications

- **Icon Container**: 40x40px (`w-10 h-10`) with rounded corners (`rounded-lg`)
- **Icon Size**: 20x20px (`h-5 w-5`)
- **Spacing**: 12px gap between icon and text (`gap-3`)
- **Padding**: 16px all around the option container (`p-4`)
- **Border**: 1px solid border with hover state
- **Background**: Card background with hover accent (`bg-card hover:bg-accent/50`)

### Color Conventions

Use semantic color coding to reinforce option meanings:

| Color | Use Case | Example | Classes |
|-------|----------|---------|---------|
| **Gray/Muted** | Neutral, disabled, or "none" options | No tracking, Default view | `bg-muted` + `text-muted-foreground` |
| **Green** | Positive, simple, or standard actions | Quantity tracking, Basic mode | `bg-green-100 dark:bg-green-950/50` + `text-green-600 dark:text-green-400` |
| **Orange** | Advanced, complex, or warning states | Recipe tracking, Advanced mode | `bg-orange-100 dark:bg-orange-950/50` + `text-orange-600 dark:text-orange-400` |
| **Blue** | Information, primary actions | Report generation, Export | `bg-blue-100 dark:bg-blue-950/50` + `text-blue-600 dark:text-blue-400` |
| **Red** | Destructive, critical states | Delete mode, Critical alerts | `bg-red-100 dark:bg-red-950/50` + `text-red-600 dark:text-red-400` |

### Code Example

```typescript
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Label } from '@/components/ui/label'
import { Store, Package, Beef } from 'lucide-react'

<RadioGroup value={selectedValue} onValueChange={setSelectedValue}>
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

## Contributing

When adding new UI patterns:

1. **Document thoroughly**: Include "when to use", code examples, and accessibility notes
2. **Provide real examples**: Link to existing implementations in the codebase
3. **Show variations**: Cover light/dark mode, responsive design
4. **Add to CLAUDE.md**: Reference the pattern in the main documentation file
