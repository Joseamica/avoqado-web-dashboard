# Theme System Guidelines

## 🎯 **RULE #1: NEVER USE HARDCODED COLORS**

**❌ BAD - Hardcoded Colors:**
```tsx
<div className="bg-gray-50 text-gray-900 border-gray-200">
<p className="text-red-600">Error message</p>
<span className="text-blue-500">Link</span>
```

**✅ GOOD - Theme-Aware Colors:**
```tsx
<div className="bg-muted text-foreground border-border">
<p className="text-destructive">Error message</p>
<span className="text-primary">Link</span>
```

## 2. **Mandatory Color Mapping**

**ALWAYS use these theme-aware classes:**

### Background Colors
- `bg-white` → `bg-background`
- `bg-gray-50` → `bg-muted`
- `bg-gray-100` → `bg-accent`
- `bg-black` → `bg-background` (with dark theme support)

### Text Colors
- `text-black` → `text-foreground`
- `text-gray-900` → `text-foreground`
- `text-gray-700` → `text-foreground`
- `text-gray-600` → `text-muted-foreground`
- `text-gray-500` → `text-muted-foreground`
- `text-gray-400` → `text-muted-foreground`
- `text-white` → `text-foreground` (with dark theme)

### Border Colors
- `border-gray-200` → `border-border`
- `border-gray-300` → `border-border`
- `border` → `border border-border`

### State Colors
- `text-red-500/600` → `text-destructive`
- `bg-red-50` → `bg-destructive/10`
- `text-green-500/600` → `text-green-600 dark:text-green-400`
- `text-blue-500/600` → `text-blue-600 dark:text-blue-400`
- `text-orange-500/600` → `text-orange-600 dark:text-orange-400`

## 3. **Component Patterns**

### Cards & Containers
```tsx
// ❌ BAD
<div className="bg-white border border-gray-200 rounded-lg">
  <h3 className="text-gray-900 font-semibold">Title</h3>
  <p className="text-gray-600">Description</p>
</div>

// ✅ GOOD
<div className="bg-card border border-border rounded-lg">
  <h3 className="text-card-foreground font-semibold">Title</h3>
  <p className="text-muted-foreground">Description</p>
</div>
```

### Forms & Inputs
```tsx
// ❌ BAD
<input className="border-gray-300 bg-white text-gray-900" />
<label className="text-gray-700">Label</label>

// ✅ GOOD
<input className="border-input bg-background text-foreground" />
<label className="text-foreground">Label</label>
```

### Status & Feedback
```tsx
// ❌ BAD
<div className="bg-red-50 border-red-200 text-red-800">Error</div>
<div className="bg-green-50 border-green-200 text-green-800">Success</div>
<div className="bg-blue-50 border-blue-200 text-blue-800">Info</div>

// ✅ GOOD
<div className="bg-destructive/10 border-destructive/20 text-destructive">Error</div>
<div className="bg-green-50 dark:bg-green-950/50 border-green-200 dark:border-green-800 text-green-800 dark:text-green-200">Success</div>
<div className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">Info</div>
```

## 4. **Available Theme Colors**

Our CSS variables (defined in `src/index.css`):

```css
:root {
  --background: 0 0% 100%;        /* Main background */
  --foreground: 222.2 84% 4.9%;   /* Main text */
  --muted: 210 40% 96.1%;         /* Subtle backgrounds */
  --muted-foreground: 215.4 16.3% 46.9%; /* Subtle text */
  --popover: 0 0% 100%;           /* Popover backgrounds */
  --popover-foreground: 222.2 84% 4.9%; /* Popover text */
  --card: 0 0% 100%;              /* Card backgrounds */
  --card-foreground: 222.2 84% 4.9%; /* Card text */
  --border: 214.3 31.8% 91.4%;   /* Border colors */
  --input: 214.3 31.8% 91.4%;    /* Input borders */
  --primary: 222.2 47.4% 11.2%;  /* Primary brand */
  --primary-foreground: 210 40% 98%; /* Primary text */
  --secondary: 210 40% 96.1%;     /* Secondary brand */
  --secondary-foreground: 222.2 47.4% 11.2%; /* Secondary text */
  --accent: 210 40% 96.1%;        /* Accent colors */
  --accent-foreground: 222.2 47.4% 11.2%; /* Accent text */
  --destructive: 0 84.2% 60.2%;   /* Error/danger */
  --destructive-foreground: 210 40% 98%; /* Error text */
  --ring: 215 20.2% 65.1%;        /* Focus rings */
}

.dark {
  --background: 222.2 84% 4.9%;
  --foreground: 210 40% 98%;
  --muted: 217.2 32.6% 17.5%;
  --muted-foreground: 215 20.2% 65.1%;
  /* ... all dark variants */
}
```

## 5. **Development Checklist**

Before creating ANY component:

- [ ] ✅ Use only theme-aware color classes
- [ ] ✅ Test in both light and dark modes
- [ ] ✅ Use semantic color names (destructive, muted, etc.)
- [ ] ✅ For colored states, provide dark variants
- [ ] ❌ Never use `text-gray-*`, `bg-gray-*`, `border-gray-*`
- [ ] ❌ Never use hardcoded color values

## 6. **Quick Reference**

**Most Common Replacements:**
- `bg-white` → `bg-background` or `bg-card`
- `bg-gray-50` → `bg-muted`
- `text-gray-900` → `text-foreground`
- `text-gray-600` → `text-muted-foreground`
- `border-gray-200` → `border-border`
- `text-red-600` → `text-destructive`

## 7. **For Colored Elements (Blue, Green, Orange, etc.)**

When you need specific colors that aren't in the theme system:

```tsx
// ✅ GOOD - Always provide dark variants
<div className="bg-blue-50 dark:bg-blue-950/50 border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200">
  Blue themed content
</div>

<span className="text-green-600 dark:text-green-400">Success</span>
<span className="text-orange-600 dark:text-orange-400">Warning</span>
<span className="text-red-600 dark:text-red-400">Error</span>
```

---

**🚨 REMEMBER: If you use ANY hardcoded color, the component WILL break in dark mode!**