# 🎨 Design Agent - Usage Examples

This document shows you how to effectively use the Avoqado Design Agent for various tasks.

---

## 🚀 HOW TO ACTIVATE THE DESIGN AGENT

### Method 1: Slash Command (Recommended)
```
/design "Create a status badge component for orders"
```

### Method 2: Direct Reference
```
"Use the design agent to fix hardcoded colors in src/pages/Home.tsx"
```

### Method 3: Context Mode
```
"I want to improve the analytics dashboard. Please switch to design mode
and follow the guidelines in DESIGN_AGENT.md"
```

---

## 📋 EXAMPLE TASKS

### 1. Creating a New Component

**Task**: Create a status badge component

```
/design "Create a reusable StatusBadge component for order statuses.
Statuses: pending, processing, completed, cancelled, refunded.
Should work in light/dark mode and be translatable."
```

**What the agent will do**:
1. Create `/src/components/ui/status-badge.tsx`
2. Define TypeScript types for status enum
3. Add status color utilities to `src/index.css`
4. Create translation keys in `src/locales/{en,es,fr}/orders.json`
5. Provide usage examples
6. Ensure dark mode support

**Expected output**:
- Component file with full TypeScript types
- Status utilities (`.status-pending`, `.status-completed`, etc.)
- Translation files for all languages
- Example usage code

---

### 2. Enhancing Existing Components

**Task**: Add better hover states to cards

```
/design "Enhance the KPI cards on the dashboard with world-class hover effects.
Add lift animation, subtle shadow, and smooth transitions. File: src/components/analytics/KpiCard.tsx"
```

**What the agent will do**:
1. Read the existing `KpiCard.tsx` file
2. Add hover effects (lift, shadow, scale)
3. Ensure transitions are smooth (200ms)
4. Maintain dark mode compatibility
5. Keep accessibility (focus states)
6. Explain the changes made

**Expected changes**:
```tsx
// Before
<Card>...</Card>

// After
<Card className="
  transition-all duration-200 ease-in-out
  hover:-translate-y-1 hover:shadow-xl
  cursor-pointer
">...</Card>
```

---

### 3. Fixing Color Issues

**Task**: Migrate hardcoded colors to semantic tokens

```
/design "Fix the hardcoded colors in src/pages/Home.tsx. There are green, red,
and yellow hardcoded colors on lines 37-40 and 81-86. Use semantic tokens or
status utilities."
```

**What the agent will do**:
1. Read `src/pages/Home.tsx`
2. Identify all hardcoded color instances
3. Replace with semantic tokens or status utilities
4. Ensure dark mode works correctly
5. Show before/after comparison
6. Verify no visual regression

**Expected fixes**:
```tsx
// Before
<span className="text-green-600">Active</span>
<div className="bg-red-50 text-red-800">Error</div>

// After
<span className="text-success">Active</span>
<div className="bg-destructive/10 text-destructive">Error</div>
```

---

### 4. Building Layouts

**Task**: Create a responsive hero section

```
/design "Create a hero section for the landing page. Should have:
- Heading and subheading
- 2 CTA buttons (primary + secondary)
- Right side: illustration/image
- Fully responsive (mobile stacks vertically)
- Dark mode support
- All text translatable"
```

**What the agent will do**:
1. Create responsive grid layout (mobile → desktop)
2. Add proper heading hierarchy (h1, p)
3. Create CTAs with all states (hover, focus, active)
4. Implement responsive image handling
5. Add i18n keys
6. Provide translation files

**Expected result**:
```tsx
<section className="py-12 md:py-24">
  <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <div className="grid lg:grid-cols-2 gap-12 items-center">
      <div className="space-y-6">
        <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold">
          {t('hero.title')}
        </h1>
        <p className="text-lg text-muted-foreground">
          {t('hero.subtitle')}
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Button size="lg">{t('hero.cta.primary')}</Button>
          <Button size="lg" variant="outline">
            {t('hero.cta.secondary')}
          </Button>
        </div>
      </div>
      <div className="relative h-[400px] lg:h-[500px]">
        <img src="..." alt={t('hero.imageAlt')} />
      </div>
    </div>
  </div>
</section>
```

---

### 5. Accessibility Audits

**Task**: Audit and fix accessibility issues

```
/design "Audit src/pages/Team/Teams.tsx for accessibility issues.
Check for: ARIA labels, semantic HTML, keyboard navigation, focus states,
color contrast, and screen reader support."
```

**What the agent will do**:
1. Read the file
2. Identify accessibility issues
3. Provide detailed report
4. Suggest fixes with code examples
5. Explain WCAG compliance

**Example findings**:
```markdown
## Accessibility Issues Found

### 🔴 Critical
- Line 145: Icon-only button missing aria-label
- Line 203: Non-semantic `<div onClick>` should be `<button>`
- Line 287: Focus ring not visible in dark mode

### ⚠️ Warnings
- Line 156: Image missing descriptive alt text
- Line 234: Color-only status indicator (add icon)

### ✅ Fixes
[Provides code fixes for each issue]
```

---

### 6. Performance Optimization

**Task**: Optimize component for performance

```
/design "Optimize src/pages/Dashboard/Dashboard.tsx for performance.
The page has multiple data transformations and is re-rendering frequently.
Add proper memoization."
```

**What the agent will do**:
1. Identify unmemoized computations
2. Find unnecessary re-renders
3. Add `useMemo` and `useCallback`
4. Explain performance impact
5. Suggest additional optimizations

**Expected changes**:
```tsx
// Before
function Dashboard() {
  const filteredData = data.filter(item => item.active)
  const sortedData = filteredData.sort((a, b) => b.date - a.date)
  return <DataTable data={sortedData} />
}

// After
function Dashboard() {
  const processedData = useMemo(() => {
    return data
      .filter(item => item.active)
      .sort((a, b) => b.date - a.date)
  }, [data])

  return <DataTable data={processedData} />
}
```

---

### 7. Form Components

**Task**: Create a form with validation

```
/design "Create a user profile edit form with:
- Name, email, phone inputs
- Role dropdown
- Save/Cancel buttons
- Form validation with Zod
- Loading states
- Error messages
- All translatable"
```

**What the agent will do**:
1. Create form with React Hook Form + Zod
2. Add proper field validation
3. Implement loading/error states
4. Add ARIA for error messages
5. Style with Avoqado theme
6. Add i18n for all labels/errors

---

### 8. Data Visualization

**Task**: Create a chart component

```
/design "Create a revenue chart component using Recharts.
- Line chart showing last 12 months
- Tooltip on hover
- Responsive (adapts to container)
- Dark mode colors
- Loading skeleton
- Empty state"
```

**What the agent will do**:
1. Set up Recharts with theme tokens
2. Configure responsive container
3. Add dark mode color mappings
4. Create loading skeleton
5. Add empty state UI
6. Ensure accessibility (aria-label)

---

### 9. Navigation Components

**Task**: Enhance mobile navigation

```
/design "Improve the mobile navigation in src/components/Sidebar/app-sidebar.tsx.
Add smooth animations, better touch targets (min 44px), and improved
accessibility for screen readers."
```

**What the agent will do**:
1. Audit current mobile nav
2. Increase touch target sizes
3. Add animations (slide-in/out)
4. Improve ARIA labels
5. Test keyboard navigation
6. Ensure focus management

---

### 10. Theming Tasks

**Task**: Implement a theme switcher

```
/design "Create an enhanced theme switcher component with:
- Light / Dark / System options
- Smooth transition animation
- Keyboard accessible
- Tooltip on hover
- Persist choice to localStorage
- i18n labels"
```

**What the agent will do**:
1. Read existing `ThemeContext.tsx`
2. Create enhanced switcher component
3. Add smooth theme transition CSS
4. Implement keyboard controls
5. Add tooltips with Radix
6. Create translations

---

## 💡 TIPS FOR EFFECTIVE USAGE

### Be Specific
```
❌ "Make it look better"
✅ "Add hover effects, increase spacing, and improve color contrast"
```

### Provide Context
```
❌ "Fix this component"
✅ "Fix src/pages/Home.tsx - it has hardcoded colors on lines 37-40
   that break dark mode"
```

### Reference Files
```
✅ "Following the pattern in src/components/ui/card.tsx, create a
   similar container component for forms"
```

### Specify Constraints
```
✅ "Create a modal dialog, but keep it under 500px width and ensure
   it's keyboard accessible"
```

### Ask for Explanations
```
✅ "Create a button component and explain why each state is necessary
   for accessibility"
```

---

## 🎯 TASK CATEGORIES

### Component Creation
- New UI components from scratch
- Following Avoqado patterns
- With full TypeScript types

### Component Enhancement
- Adding states (hover, focus, loading)
- Improving animations
- Better responsive design

### Bug Fixes
- Hardcoded colors → semantic tokens
- Missing dark mode support
- Broken responsive layouts

### Accessibility
- ARIA labels
- Keyboard navigation
- Screen reader support
- Focus management

### Performance
- Memoization (useMemo, useCallback)
- Render optimization
- Code splitting suggestions

### Internationalization
- Adding translation keys
- Creating translation files
- i18n best practices

### Layout Design
- Responsive grids
- Hero sections
- Page layouts
- Container components

---

## 📚 REFERENCE DOCUMENTS

While using the design agent, you can reference:

- **`DESIGN_AGENT.md`**: Comprehensive agent specification (500 lines)
- **`AVOQADO_DESIGN_QUICK_REF.md`**: One-page cheat sheet
- **`THEME-GUIDELINES.md`**: Color token mappings
- **`CLAUDE.md`**: Critical project rules
- **`.claude/docs/`**: Architecture documentation

---

## 🔄 ITERATIVE WORKFLOW

The design agent works well iteratively:

```
You: "/design Create a status badge component"
Agent: [Creates component]

You: "Great! Now add an optional icon prop"
Agent: [Enhances component with icon support]

You: "Can you add size variants (sm, md, lg)?"
Agent: [Adds size variants using CVA]

You: "Perfect! Now create usage examples for the docs"
Agent: [Provides comprehensive usage examples]
```

---

## ✅ QUALITY CHECKLIST

After the agent completes a task, verify:

- [ ] **i18n**: All text uses `t('...')`
- [ ] **Colors**: No hardcoded colors (bg-gray-*, text-blue-*)
- [ ] **Spacing**: Only Tailwind scale (no arbitrary values)
- [ ] **States**: hover, focus, active, disabled all present
- [ ] **Dark mode**: Works perfectly in both themes
- [ ] **Responsive**: Mobile (320px) to desktop (1920px+)
- [ ] **Accessibility**: ARIA labels, semantic HTML, keyboard nav
- [ ] **Performance**: Memoization where needed
- [ ] **TypeScript**: Proper types, no errors

---

## 🚀 GETTING STARTED

Try these starter tasks:

### Easy
```
/design "Fix the CardDescription hardcoded color in src/components/ui/card.tsx"
```

### Medium
```
/design "Create a loading skeleton component for the analytics dashboard"
```

### Advanced
```
/design "Build a complete data table filter system with search, date range,
and status filters. Make it reusable and fully accessible."
```

---

## 🤝 WORKING WITH THE AGENT

The design agent is a **guided assistant**, not a strict enforcer:

- **Suggests** best practices
- **Warns** about potential issues
- **Flexible** when constraints require pragmatism
- **Educational** - explains WHY, not just WHAT
- **Proactive** - anticipates issues

If you disagree with a suggestion, you can discuss:
```
You: "The agent suggested using useMemo here, but I don't think
     the array changes often. Can we skip it?"

Agent: "You're right - if `data` is stable and rarely changes,
       memoization adds complexity without benefit. Let's skip it
       unless profiling shows it's an issue."
```

---

## 🎉 SUCCESS STORIES

### Before Design Agent
```tsx
// Hardcoded, non-responsive, not accessible
<div className="bg-gray-50 text-gray-900 mt-[15px]">
  <button onClick={save}>Save</button>
</div>
```

### After Design Agent
```tsx
// Semantic, responsive, accessible, i18n, dark mode
<Card className="bg-card text-card-foreground mt-4">
  <Button
    onClick={handleSave}
    disabled={loading}
    aria-label={t('common.save')}
    className="
      hover:-translate-y-0.5 hover:shadow-lg
      focus:ring-4 focus:ring-ring
      disabled:opacity-50
      transition-all duration-200
    "
  >
    {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
    {t('common.save')}
  </Button>
</Card>
```

---

**Ready to create world-class interfaces? Start with `/design` and describe what you need!** 🚀
