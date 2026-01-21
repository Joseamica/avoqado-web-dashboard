# 🎨 Avoqado Design Quick Reference

**One-page cheat sheet for rapid development**

---

## 🚨 CRITICAL RULES (NO EXCEPTIONS)

```tsx
// ❌ FORBIDDEN
<Button>Save</Button>                    // No hardcoded text
<div className="bg-gray-50">            // No hardcoded colors
<div className="mt-[13px]">             // No arbitrary spacing
const filtered = data.filter(...)        // No unmemoized arrays
<DataTable data={filtered} />

// ✅ REQUIRED
const { t } = useTranslation()
<Button>{t('save')}</Button>            // i18n always
<div className="bg-muted">              // Semantic tokens
<div className="mt-3">                  // Tailwind scale
const filtered = useMemo(() =>          // Memoize everything
  data.filter(...), [data]
)
```

---

## 🎨 COLOR TOKENS

### Backgrounds
```tsx
bg-background          // Main page background
bg-card                // Card surfaces
bg-muted               // Subtle backgrounds (gray-like)
bg-primary             // Primary button
bg-secondary           // Secondary button
bg-destructive         // Error/danger
bg-success             // Success (custom)
bg-warning             // Warning (custom)
```

### Text
```tsx
text-foreground             // Primary text (black/white)
text-muted-foreground       // Secondary text (gray)
text-primary-foreground     // Text on primary buttons
text-card-foreground        // Text on cards
text-destructive            // Error text
```

### Borders & Focus
```tsx
border-border          // Standard borders
border-input           // Input borders
ring-ring              // Focus rings
```

### Status Colors (Use Utilities)
```tsx
// Replace: text-green-600 dark:text-green-400
// With: status-badge status-success

.status-badge          // Base badge styles
.status-success        // Green (active, success)
.status-warning        // Amber (pending, warning)
.status-error          // Red (error, failed)
.status-info           // Blue (info)
.status-pending        // Gray (inactive, pending)
```

---

## 📏 SPACING SCALE

**Use ONLY these values** (no mt-[13px]):

```tsx
0    →  0px     // No space
1    →  4px     // Micro (icon+text gap)
2    →  8px     // Small (button icon gap)
3    →  12px    // Medium
4    →  16px    // Standard (form fields, sections)
6    →  24px    // Large (card padding, sections)
8    →  32px    // XL sections
12   →  48px    // Major sections
16   →  64px    // Page sections
24   →  96px    // Hero spacing

// Common patterns
gap-2           // Icon + text
gap-4           // Form elements
space-y-4       // Vertical lists
space-y-6       // Sections
p-6             // Card padding
px-4 py-2       // Button
px-3 py-1       // Input
```

---

## 📱 RESPONSIVE BREAKPOINTS

```tsx
// Mobile-first (base = mobile, scale up)
sm:   640px    // Mobile landscape
md:   768px    // Tablet
lg:   1024px   // Laptop
xl:   1280px   // Desktop
2xl:  1536px   // Large desktop

// Common patterns
grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4
flex flex-col md:flex-row
p-4 md:p-6 lg:p-8
text-base md:text-sm
hidden md:block        // Desktop only
block md:hidden        // Mobile only
```

---

## ✨ REQUIRED STATES

**Every interactive element needs ALL these:**

```tsx
<button className="
  /* Base */
  bg-primary text-primary-foreground px-4 py-2 rounded-md

  /* Transitions (REQUIRED) */
  transition-all duration-200 ease-in-out

  /* Hover (REQUIRED) */
  hover:bg-primary/90 hover:-translate-y-0.5

  /* Active (REQUIRED) */
  active:translate-y-0

  /* Focus (REQUIRED for a11y) */
  focus:outline-none focus:ring-4 focus:ring-ring

  /* Disabled (REQUIRED) */
  disabled:opacity-50 disabled:cursor-not-allowed
">
```

---

## 🌐 i18n PATTERN

```tsx
// 1. Import hook
import { useTranslation } from 'react-i18next'

// 2. Get t function
const { t } = useTranslation('namespace')

// 3. Use for ALL text
<h1>{t('title')}</h1>
<Button>{t('actions.save')}</Button>
<p>{t('description', { name: 'John' })}</p>

// Translation file: src/locales/en/namespace.json
{
  "title": "My Title",
  "actions": { "save": "Save Changes" },
  "description": "Hello {{name}}"
}

// Register in src/i18n.ts
import namespaceEn from './locales/en/namespace.json'
// ... import es, fr
i18n.addResourceBundle('en', 'namespace', namespaceEn, true, true)
```

---

## ♿ ACCESSIBILITY CHECKLIST

```tsx
// Semantic HTML
<header>, <nav>, <main>, <section>, <footer>
<button> for actions, <a> for links

// ARIA labels (icon-only buttons)
<Button aria-label={t('common.close')}>
  <X className="w-4 h-4" />
</Button>

// Alt text (descriptive)
<img src="..." alt="Revenue chart showing 25% growth" />

// Form labels
<label htmlFor="email">{t('form.email')}</label>
<input id="email" ... />

// Error messages
<Input aria-describedby="error-email" ... />
<span id="error-email">{error}</span>

// Focus rings (always visible)
focus:outline-none focus:ring-4 focus:ring-ring
```

---

## ⚡ PERFORMANCE

```tsx
// Memoize arrays/objects
const filtered = useMemo(
  () => data.filter(item => item.active),
  [data]
)

// Memoize callbacks
const handleClick = useCallback(() => {
  doSomething(id)
}, [id])

// Memoize expensive computations
const total = useMemo(
  () => items.reduce((sum, item) => sum + item.price, 0),
  [items]
)
```

---

## 🎯 COMMON COMPONENT PATTERNS

### Button with Loading
```tsx
<Button disabled={loading}>
  {loading && <Loader2 className="w-4 h-4 animate-spin" />}
  {t('common.save')}
</Button>
```

### Card
```tsx
<Card>
  <CardHeader>
    <CardTitle>{t('title')}</CardTitle>
    <CardDescription>{t('description')}</CardDescription>
  </CardHeader>
  <CardContent>
    {/* Content */}
  </CardContent>
</Card>
```

### Status Badge
```tsx
<Badge className="status-badge status-success">
  {t('statuses.active')}
</Badge>
```

### Responsive Grid
```tsx
<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
  {items.map(item => <Card key={item.id}>...</Card>)}
</div>
```

### Permission Gate
```tsx
<PermissionGate permission="tpv:create">
  <Button onClick={create}>{t('create')}</Button>
</PermissionGate>
```

---

## 🎨 TYPOGRAPHY

```tsx
// Sizes
text-xs     // 12px - Badges, timestamps
text-sm     // 14px - Body, inputs
text-base   // 16px - Default
text-lg     // 18px - Subheadings
text-xl     // 20px - Section headers
text-2xl    // 24px - Page titles

// Weights
font-normal     // 400 - Body
font-medium     // 500 - Labels
font-semibold   // 600 - Headings
font-bold       // 700 - Titles

// Patterns
<h1 className="text-2xl font-bold">
<h2 className="text-xl font-semibold">
<p className="text-sm text-muted-foreground">
```

---

## 🌓 DARK MODE

```tsx
// Automatic (semantic tokens)
bg-background text-foreground    // ✅ Just works

// Explicit when needed
<div className="
  bg-green-50 text-green-800
  dark:bg-green-950/50 dark:text-green-200
">

// Never do this
<div className="bg-white text-black">  // ❌ Broken in dark
```

---

## 📂 FILE LOCATIONS

```
Components:      src/components/ui/
Pages:           src/pages/
Translations:    src/locales/{en,es}/
i18n config:     src/i18n.ts
Theme:           src/index.css (@theme directive)
Theme guide:     THEME-GUIDELINES.md
Critical rules:  CLAUDE.md
Full agent:      DESIGN_AGENT.md
```

---

## 🔥 COMMON IMPORTS

```tsx
// UI Components
import { Button } from '@/components/ui/button'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

// Utils
import { cn } from '@/lib/utils'

// i18n
import { useTranslation } from 'react-i18next'

// Icons
import { Loader2, Check, X } from 'lucide-react'

// React
import { useMemo, useCallback } from 'react'
```

---

## ✅ PRE-COMMIT CHECKLIST

```
[ ] i18n: All text uses t()
[ ] Colors: Only semantic tokens (no bg-gray-*)
[ ] Spacing: Only Tailwind scale (no mt-[13px])
[ ] States: hover, focus, active, disabled
[ ] Dark mode: Works in both themes
[ ] Responsive: Mobile (320px+) to desktop (1920px+)
[ ] Accessibility: ARIA labels, semantic HTML, focus rings
[ ] Performance: Arrays memoized, callbacks memoized
[ ] Types: No TypeScript errors or `any`
```

---

**For full details, see**: `DESIGN_AGENT.md`

**Quick fixes**:
- Hardcoded color → Check THEME-GUIDELINES.md for mapping
- Missing translation → Add to src/locales/{en,es}/[namespace].json
- Performance issue → Add useMemo/useCallback
- Accessibility issue → Add ARIA label or semantic HTML

**Need help?** Read CLAUDE.md for critical rules and .claude/docs/ for architecture.
