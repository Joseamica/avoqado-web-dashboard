# UI Patterns Guide

This guide documents common UI patterns used throughout the Avoqado Dashboard. These patterns ensure consistency, improve user experience, and maintain visual coherence across the application.

## Table of Contents

- [Pill-Style Tabs (MANDATORY)](#pill-style-tabs-mandatory)
- [Icon-Based Radio Group Selection](#icon-based-radio-group-selection)
- [Horizontal Navigation (VenueEditLayout Pattern)](#horizontal-navigation-venueeditlayout-pattern)
- [Multi-Step Wizard Dialog](#multi-step-wizard-dialog)
- [Form Input Patterns](#form-input-patterns)
- [Select/MultipleSelector Patterns](#selectmultipleselector-with-empty-state-and-create-button-mandatory)

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

<Tabs defaultValue="items" className="space-y-4">
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

  <TabsContent value="items">
    {/* Content */}
  </TabsContent>
  <TabsContent value="history">
    {/* Content */}
  </TabsContent>
</Tabs>
```

### Key Classes Breakdown

| Element | Classes | Purpose |
|---------|---------|---------|
| `TabsList` | `rounded-full bg-muted/60 border border-border` | Pill-shaped container |
| `TabsTrigger` | `rounded-full px-4 py-2` | Pill-shaped buttons |
| `TabsTrigger` active | `data-[state=active]:bg-foreground data-[state=active]:text-background` | Inverted colors when active |
| Count badge | `bg-foreground/10 group-data-[state=active]:bg-background/20` | Subtle badge that adapts to state |

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

## Multi-Step Wizard Dialog

**When to use:** Complex forms with many fields that need to be broken into logical steps to reduce cognitive load and guide users through the process.

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

<div className="flex items-center gap-2">
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
            <p className="text-xs text-blue-800 dark:text-blue-200 mt-1">
              {t('wizard.hints.field.exampleText')}
            </p>
          </div>
        </div>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
</div>
```

### Tooltip Color Conventions

| Color | Use Case | Classes |
|-------|----------|---------|
| **Blue** | General information, examples | `bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800` |
| **Green** | Positive effects, enabled states | `bg-green-50 dark:bg-green-950/30 border-green-200 dark:border-green-800` |
| **Yellow** | Warnings, important notes | `bg-yellow-50 dark:bg-yellow-950/30 border-yellow-200 dark:border-yellow-800` |
| **Orange** | Advanced features, special cases | `bg-orange-50 dark:bg-orange-950/30 border-orange-200 dark:border-orange-800` |
| **Red** | Disabled states, destructive effects | `bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800` |

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
    value: 0,  // Input starts with "0" that user can't clear
  },
})

// ✅ CORRECT
const form = useForm({
  defaultValues: {
    value: undefined,  // Input starts empty
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
      <div className="py-6 text-center text-sm text-muted-foreground">
        {tCommon('no_results')}
      </div>
    ) : (
      options.map((option) => (
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
  emptyIndicator={
    <p className="py-6 text-center text-sm text-muted-foreground">
      {tCommon('no_results')}
    </p>
  }
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
      '[&:has([data-state=checked])]:border-primary'
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

## Contributing

When adding new UI patterns:

1. **Document thoroughly**: Include "when to use", code examples, and accessibility notes
2. **Provide real examples**: Link to existing implementations in the codebase
3. **Show variations**: Cover light/dark mode, responsive design
4. **Add to CLAUDE.md**: Reference the pattern in the main documentation file
