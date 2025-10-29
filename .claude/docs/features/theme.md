# Theme System

Complete guide to the design-token based theme system for light/dark mode compatibility.

## Core Principle

**NEVER use hardcoded colors.** Always use semantic, theme-aware Tailwind classes.

## Critical Rule #1: No Hardcoded Grays

**❌ WRONG:**
```tsx
<div className="bg-gray-50 text-gray-900 border-gray-200">
  <p className="text-gray-600">Content</p>
</div>
```

**✅ CORRECT:**
```tsx
<div className="bg-muted text-foreground border-border">
  <p className="text-muted-foreground">Content</p>
</div>
```

## Semantic Color Classes

### Backgrounds

| Class | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `bg-background` | Page background | White | Dark gray |
| `bg-card` | Card/panel background | White | Slightly lighter dark |
| `bg-muted` | Subtle background | Light gray | Darker gray |
| `bg-accent` | Accent background | Soft blue | Muted blue |
| `bg-popover` | Dropdown/tooltip background | White | Dark gray |

**Examples:**
```tsx
// Page background
<div className="bg-background min-h-screen">

// Card component
<div className="bg-card rounded-lg border border-border">

// Subtle section
<div className="bg-muted p-4 rounded">
```

### Text Colors

| Class | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `text-foreground` | Primary text | Black | White |
| `text-muted-foreground` | Secondary text | Gray | Light gray |
| `text-card-foreground` | Text on cards | Black | White |
| `text-accent-foreground` | Text on accent | Dark | Light |
| `text-popover-foreground` | Text in popovers | Black | White |

**Examples:**
```tsx
// Primary heading
<h1 className="text-foreground font-bold">

// Secondary text
<p className="text-muted-foreground text-sm">

// Card content
<div className="bg-card text-card-foreground">
```

### Borders & Inputs

| Class | Usage | Light Mode | Dark Mode |
|-------|-------|------------|-----------|
| `border-border` | Standard border | Light gray | Dark gray |
| `border-input` | Input border | Medium gray | Lighter dark |
| `ring` | Focus ring | Derives from `--ring` | Derives from `--ring` |

**Examples:**
```tsx
// Standard border
<div className="border border-border">

// Input field
<input className="border-input bg-background text-foreground">

// Focus ring
<button className="focus:ring-2 ring-offset-2">
```

### State Colors

| Class | Usage | Description |
|-------|-------|-------------|
| `bg-primary` | Primary button | Main brand color |
| `text-primary` | Primary text/icons | Main brand color |
| `bg-secondary` | Secondary button | Subtle alternative |
| `text-secondary` | Secondary text | Subtle alternative |
| `bg-destructive` | Delete/danger button | Red/destructive |
| `text-destructive` | Error text | Red/destructive |
| `bg-success` | Success state | Green (custom) |
| `text-success` | Success text | Green (custom) |

**Examples:**
```tsx
// Primary button
<button className="bg-primary text-primary-foreground">

// Danger button
<button className="bg-destructive text-destructive-foreground">

// Error message
<p className="text-destructive">Error: Something went wrong</p>
```

## Common Replacements

### Background Colors

| ❌ Hardcoded | ✅ Theme-Aware |
|-------------|----------------|
| `bg-white` | `bg-background` or `bg-card` |
| `bg-gray-50` | `bg-muted` |
| `bg-gray-100` | `bg-muted` |
| `bg-slate-50` | `bg-muted` |

### Text Colors

| ❌ Hardcoded | ✅ Theme-Aware |
|-------------|----------------|
| `text-black` | `text-foreground` |
| `text-gray-900` | `text-foreground` |
| `text-gray-700` | `text-foreground` |
| `text-gray-600` | `text-muted-foreground` |
| `text-gray-500` | `text-muted-foreground` |
| `text-gray-400` | `text-muted-foreground` |
| `text-slate-600` | `text-muted-foreground` |

### Border Colors

| ❌ Hardcoded | ✅ Theme-Aware |
|-------------|----------------|
| `border-gray-200` | `border-border` |
| `border-gray-300` | `border-border` |
| `border-slate-200` | `border-border` |

### Destructive/Error States

| ❌ Hardcoded | ✅ Theme-Aware |
|-------------|----------------|
| `text-red-600` | `text-destructive` |
| `bg-red-50` | `bg-destructive/10` |
| `border-red-200` | `border-destructive/20` |

## Status & Feedback Colors

For custom status colors (success, info, warning), use explicit dark mode variants:

### Error State

```tsx
<div className="bg-destructive/10 border border-destructive/20 text-destructive rounded-lg p-4">
  <p>Error: Something went wrong</p>
</div>
```

### Success State

```tsx
<div className="bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200 rounded-lg p-4">
  <p>Success: Changes saved</p>
</div>
```

### Info State

```tsx
<div className="bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200 rounded-lg p-4">
  <p>Info: New features available</p>
</div>
```

### Warning State

```tsx
<div className="bg-yellow-50 dark:bg-yellow-950/50 border border-yellow-200 dark:border-yellow-800 text-yellow-800 dark:text-yellow-200 rounded-lg p-4">
  <p>Warning: Please review</p>
</div>
```

## Form Components

### Input Fields

```tsx
<input
  className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 ring-offset-2"
  placeholder="Enter value..."
/>
```

### Labels

```tsx
<label className="text-foreground font-medium">
  Field Name
</label>
```

### Helper Text

```tsx
<p className="text-muted-foreground text-sm">
  This field is optional
</p>
```

### Error Message

```tsx
<p className="text-destructive text-sm">
  This field is required
</p>
```

## Buttons

### Primary Button

```tsx
<button className="bg-primary text-primary-foreground hover:bg-primary/90">
  Save
</button>
```

### Secondary Button

```tsx
<button className="bg-secondary text-secondary-foreground hover:bg-secondary/80">
  Cancel
</button>
```

### Destructive Button

```tsx
<button className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
  Delete
</button>
```

### Ghost Button

```tsx
<button className="hover:bg-accent hover:text-accent-foreground">
  View Details
</button>
```

### Outline Button

```tsx
<button className="border border-input bg-background hover:bg-accent hover:text-accent-foreground">
  Edit
</button>
```

## Cards & Panels

### Basic Card

```tsx
<div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm">
  <h3 className="text-foreground font-semibold mb-2">Card Title</h3>
  <p className="text-muted-foreground">Card content</p>
</div>
```

### Highlighted Card

```tsx
<div className="bg-muted border border-border rounded-lg p-4">
  <p className="text-foreground">Highlighted content</p>
</div>
```

## Tables

### Table Row

```tsx
<tr className="border-b border-border hover:bg-muted/50">
  <td className="text-foreground">Data</td>
  <td className="text-muted-foreground">Secondary data</td>
</tr>
```

### Table Header

```tsx
<th className="bg-muted text-foreground font-semibold border-b border-border">
  Column Name
</th>
```

## Dropdowns & Popovers

### Dropdown Menu

```tsx
<div className="bg-popover text-popover-foreground border border-border rounded-md shadow-lg">
  <button className="hover:bg-accent hover:text-accent-foreground w-full text-left px-3 py-2">
    Menu Item
  </button>
</div>
```

### Tooltip

```tsx
<div className="bg-popover text-popover-foreground border border-border rounded px-2 py-1 text-sm">
  Tooltip content
</div>
```

## Icons

Use `text-muted-foreground` for secondary icons, `text-foreground` for primary:

```tsx
// Secondary icon
<SearchIcon className="text-muted-foreground" />

// Primary icon
<MenuIcon className="text-foreground" />

// Destructive icon
<TrashIcon className="text-destructive" />
```

## Badge Components

### Default Badge

```tsx
<span className="bg-secondary text-secondary-foreground px-2 py-1 rounded-full text-xs">
  Badge
</span>
```

### Destructive Badge

```tsx
<span className="bg-destructive text-destructive-foreground px-2 py-1 rounded-full text-xs">
  Error
</span>
```

### Custom Status Badge

```tsx
// Active status
<span className="bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 px-2 py-1 rounded-full text-xs">
  Active
</span>

// Pending status
<span className="bg-yellow-100 dark:bg-yellow-950/50 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-800 px-2 py-1 rounded-full text-xs">
  Pending
</span>
```

## Dark Mode Testing Checklist

Before deploying:

- [ ] ✅ Test component in light mode
- [ ] ✅ Test component in dark mode
- [ ] ✅ Verify text is readable in both modes
- [ ] ✅ Check borders are visible in both modes
- [ ] ✅ Verify hover states work in both modes
- [ ] ✅ Test focus states (ring colors) in both modes
- [ ] ✅ Check custom colors have dark variants

## Complete Examples

### Complete Form

```tsx
function MyForm() {
  return (
    <form className="space-y-4">
      <div>
        <label className="text-foreground font-medium mb-2 block">
          Product Name
        </label>
        <input
          className="border-input bg-background text-foreground placeholder:text-muted-foreground focus:ring-2 ring-offset-2 w-full rounded-md px-3 py-2"
          placeholder="Enter product name..."
        />
        <p className="text-muted-foreground text-sm mt-1">
          This will be displayed to customers
        </p>
      </div>

      <div>
        <label className="text-foreground font-medium mb-2 block">
          Price
        </label>
        <input
          type="number"
          className="border-input bg-background text-foreground focus:ring-2 ring-offset-2 w-full rounded-md px-3 py-2"
        />
        <p className="text-destructive text-sm mt-1">
          Price is required
        </p>
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          className="bg-primary text-primary-foreground hover:bg-primary/90 px-4 py-2 rounded-md"
        >
          Save Product
        </button>
        <button
          type="button"
          className="bg-secondary text-secondary-foreground hover:bg-secondary/80 px-4 py-2 rounded-md"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
```

### Complete Card Component

```tsx
function ProductCard({ product }: { product: Product }) {
  return (
    <div className="bg-card text-card-foreground border border-border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-foreground font-semibold">{product.name}</h3>
        <span className="bg-green-100 dark:bg-green-950/50 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800 px-2 py-1 rounded-full text-xs">
          Active
        </span>
      </div>

      <p className="text-muted-foreground text-sm mb-4">
        {product.description}
      </p>

      <div className="flex justify-between items-center">
        <span className="text-foreground font-bold text-lg">
          ${product.price}
        </span>

        <div className="flex gap-2">
          <button className="hover:bg-accent hover:text-accent-foreground p-2 rounded">
            <EditIcon className="w-4 h-4" />
          </button>
          <button className="hover:bg-destructive/10 hover:text-destructive p-2 rounded">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
```

## CSS Variables (Advanced)

Theme colors are defined as CSS variables in `globals.css`:

```css
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96.1%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    /* ... */
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    /* ... */
  }
}
```

**DO NOT modify these directly unless changing the entire theme.**

## Common Mistakes

### Mistake #1: Using Gray Classes

**❌ WRONG:**
```tsx
<div className="bg-gray-100 text-gray-800">
  // Breaks in dark mode
</div>
```

**✅ CORRECT:**
```tsx
<div className="bg-muted text-foreground">
  // Works in both modes
</div>
```

### Mistake #2: Missing Dark Variants

**❌ WRONG:**
```tsx
<div className="bg-green-50 text-green-800 border-green-200">
  // Unreadable in dark mode
</div>
```

**✅ CORRECT:**
```tsx
<div className="bg-green-50 dark:bg-green-950/50 text-green-800 dark:text-green-200 border-green-200 dark:border-green-800">
  // Readable in both modes
</div>
```

### Mistake #3: Hardcoded White/Black

**❌ WRONG:**
```tsx
<div className="bg-white text-black">
  // Breaks in dark mode
</div>
```

**✅ CORRECT:**
```tsx
<div className="bg-background text-foreground">
  // Adapts to theme
</div>
```

## Related Documentation

- [Architecture Overview](../architecture/overview.md) - Component guidelines
- [i18n Guide](./i18n.md) - Translation system
- [Radix UI Documentation](https://www.radix-ui.com/) - Accessible components
