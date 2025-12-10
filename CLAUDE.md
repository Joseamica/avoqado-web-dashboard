# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Essential reading:** [Quick Reference](.claude/docs/quick-reference.md) - Dev commands, critical rules, common patterns

## Development Commands

- `npm run dev` - Start Vite dev server at http://localhost:5173
- `npm run build` - TypeScript compilation + Vite build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

**⚠️ NEVER kill or restart dev servers manually.** Both frontend (Vite) and backend (nodemon) automatically detect file changes and hot-reload. Do NOT use `pkill`, `kill`, or restart commands - just save the file and the servers will reload automatically.

### Database Access (Local Development)

When you need to verify data in the database (e.g., debugging issues with missing fields):

```bash
PGPASSWORD=exitosoy777 psql -h localhost -U postgres -d av-db-25 -c "SELECT * FROM \"Venue\" WHERE slug = 'avoqado-full';"
```

**Database Connection:**
- URL: `postgresql://postgres:exitosoy777@localhost:5432/av-db-25`
- Host: `localhost:5432`
- User: `postgres`
- Password: `exitosoy777`
- Database: `av-db-25`

**Common queries:**
```bash
# Check venue data
PGPASSWORD=exitosoy777 psql -h localhost -U postgres -d av-db-25 -c "SELECT id, name, slug, address, city, state, \"zipCode\", country, email, phone FROM \"Venue\" WHERE slug = 'venue-slug';"

# List all tables
PGPASSWORD=exitosoy777 psql -h localhost -U postgres -d av-db-25 -c "\dt"

# Describe table structure
PGPASSWORD=exitosoy777 psql -h localhost -U postgres -d av-db-25 -c "\d \"Venue\""
```

### Unused Code Detection

- `npm run check:unused` - Detect unimported files (fast)
- `npm run check:dead-code` - Comprehensive dead code analysis (slower)
- `npm run check:all` - Run both checks
- `npm run update:unused-ignore` - Auto-update ignore list for pending files

**⚠️ PENDING IMPLEMENTATION MARKER SYSTEM:**

When you create components or files that are fully implemented but not yet integrated into the application, mark them with the `@pending-implementation` marker at the top:

```typescript
/**
 * @pending-implementation
 * [Component/Feature Name]
 *
 * STATUS: Implemented but not yet integrated into [where it will be used].
 * This [component/file type] is ready to use but hasn't been [integration action] yet.
 * It will be gradually applied to [target locations].
 *
 * [Additional context or usage examples]
 */
```

**Example:**
```typescript
/**
 * @pending-implementation
 * Enhanced Search Component
 *
 * STATUS: Implemented but not yet integrated into the main dashboard.
 * This component is ready to use but hasn't been added to the search bar yet.
 * It will be gradually applied to all data tables with advanced filtering needs.
 *
 * Usage:
 * <EnhancedSearch onSearch={handleSearch} filters={filterConfig} />
 */
```

**When to use this marker:**
- ✅ Component/file is completely implemented and tested
- ✅ Will be integrated soon but not immediately
- ✅ Should be excluded from unused code detection
- ✅ You want to document implementation status for future developers

**How it works:**
1. Add `@pending-implementation` marker in the first 500 characters of the file
2. Run `npm run update:unused-ignore` to automatically add the file to `.unimportedrc.json`
3. The file will be ignored by `npm run check:unused` until you remove the marker
4. When you integrate the file, remove the marker and run `npm run update:unused-ignore` again

**Auto-update script:** `scripts/update-unused-ignore.js` scans for files with this marker and updates `.unimportedrc.json` automatically.

**⚠️ Important:** This marker is for files that are **READY to use** but not yet integrated. Don't use it for incomplete implementations or work-in-progress files.

## 📚 Documentation Policy

**Managing Documentation Files:**

When creating new documentation:

1. **Location**: ALWAYS place new .md files in the `.claude/docs/` directory
   - ✅ CORRECT: `.claude/docs/features/NEW_FEATURE.md`
   - ❌ WRONG: `NEW_FEATURE.md` (root level)
   - Follow the existing structure: `architecture/`, `features/`, `guides/`, `troubleshooting/`

2. **Reference in CLAUDE.md**: ALWAYS add a reference to the new file in the relevant section
   - Architecture docs → Link in "Architecture Documentation" section
   - Feature docs → Link in "Feature Documentation" section
   - Guide docs → Link in "Development Guides" section
   - Format: `- [Title](.claude/docs/category/filename.md) - Brief description`

3. **Keep Documentation Updated**: When making changes to code covered by documentation:
   - If the change affects architecture/design patterns → Update the relevant .md file
   - If the change only modifies implementation details → Update code comments, no .md update needed
   - Always check: Does this change invalidate any statements in the docs?

**Examples of changes requiring doc updates:**
- ✅ New permission system behavior → Update `.claude/docs/architecture/permissions.md`
- ✅ Changed theme color tokens → Update `.claude/docs/features/theme.md`
- ✅ New i18n namespace → Update `.claude/docs/features/i18n.md`
- ❌ Fixed typo in component → No doc update needed
- ❌ Refactored function names → No doc update needed

## 🚨 Critical Rules (NO EXCEPTIONS)

### 1. Internationalization (i18n)

**ALL user-facing text MUST use `t('...')` - ZERO exceptions.**

```typescript
// ❌ WRONG
<Button>Save</Button>

// ✅ CORRECT
const { t } = useTranslation()
<Button>{t('save')}</Button>
```

**Requirements:**
- Add translations for BOTH `en` and `es` (and `fr` if applicable)
- Use interpolation: `t('greeting', { name })`
- No hardcoded strings in JSX

**See:** [Complete i18n guide](.claude/docs/features/i18n.md)

### 2. Performance & Memoization

**CRITICAL: Always memoize filtered/transformed arrays passed to DataTable.**

```typescript
// ❌ WRONG - Creates new reference every render
const filteredData = someFunction(data)
<DataTable data={filteredData} />

// ✅ CORRECT - Stable reference
const filteredData = useMemo(
  () => someFunction(data),
  [data]
)
<DataTable data={filteredData} />
```

**When to memoize:**
- ✅ Filtered/mapped/sorted arrays → `useMemo`
- ✅ Search handlers → `useCallback`
- ✅ Column definitions → `useMemo`

**See:** [Performance guide](.claude/docs/guides/performance.md) | [Render loops troubleshooting](.claude/docs/troubleshooting/render-loops.md)

### 3. Permissions

**Both frontend AND backend validation required.**

```typescript
// UI control (hide/show)
<PermissionGate permission="tpv:create">
  <Button>Create</Button>
</PermissionGate>

// Backend MUST validate too
router.post('/tpvs', checkPermission('tpv:create'), controller.create)
```

**See:** [Permission system guide](.claude/docs/architecture/permissions.md)

### 4. Theme System

**NEVER use hardcoded colors** (e.g., `bg-gray-200`, `text-gray-600`)

```typescript
// ❌ WRONG
<div className="bg-gray-50 text-gray-900">

// ✅ CORRECT
<div className="bg-muted text-foreground">
```

**See:** [Theme guide](.claude/docs/features/theme.md)

### 5. Pill-Style Tabs (MANDATORY)

**ALWAYS use pill-style tabs. NEVER use default Radix tabs styling.**

```typescript
// ❌ WRONG - Default styling
<TabsList>
  <TabsTrigger value="tab1">Tab 1</TabsTrigger>
</TabsList>

// ✅ CORRECT - Pill-style from Teams.tsx
<TabsList className="inline-flex h-10 items-center justify-start rounded-full bg-muted/60 px-1 py-1 text-muted-foreground border border-border">
  <TabsTrigger
    value="tab1"
    className="group rounded-full px-4 py-2 text-sm font-medium transition-colors border border-transparent hover:bg-muted/80 hover:text-foreground data-[state=active]:bg-foreground data-[state=active]:text-background data-[state=active]:border-foreground"
  >
    <span>{t('tabs.tab1')}</span>
    <span className="ml-2 inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1 text-xs text-foreground bg-foreground/10 group-hover:bg-foreground/20 group-data-[state=active]:bg-background/20 group-data-[state=active]:text-background">
      {count}
    </span>
  </TabsTrigger>
</TabsList>
```

**Reference:** `/src/pages/Team/Teams.tsx` (lines 372-392)

**See:** [Complete UI Patterns guide](.claude/docs/guides/ui-patterns.md#pill-style-tabs-mandatory)

### 6. SUPERADMIN Gradient (MANDATORY)

**All SUPERADMIN-only UI elements in `/dashboard/` routes MUST use the amber-to-pink gradient.**

This creates visual consistency and clearly identifies superadmin-exclusive functionality.

```typescript
// ✅ CORRECT - SUPERADMIN buttons/elements in regular dashboard
<Button
  className="bg-gradient-to-r from-amber-400 to-pink-500 hover:from-amber-500 hover:to-pink-600 text-primary-foreground"
>
  <Shield className="w-4 h-4 mr-2" />
  Crear Rápido
</Button>

// ✅ CORRECT - SUPERADMIN icon/avatar background
<div className="p-2 rounded-lg bg-gradient-to-r from-amber-400 to-pink-500">
  <Shield className="h-4 w-4 text-primary-foreground" />
</div>

// ❌ WRONG - Using regular button styles for SUPERADMIN features
<Button variant="default">Crear Rápido</Button>
```

**When to use:**
- ✅ SUPERADMIN-only buttons in `/venues/:slug/*` pages (e.g., quick terminal creation)
- ✅ SUPERADMIN-only action elements visible to superadmins in normal dashboard
- ❌ NOT in `/superadmin/*` routes (those have their own styling)

**Reference:**
- Example usage: `src/pages/Tpv/Tpvs.tsx` (quick create button)
- Dialog example: `src/pages/Tpv/components/SuperadminTerminalDialog.tsx`

### 7. Control Plane vs Application Plane (Architecture)

**This is the industry-standard pattern for multi-tenant SaaS (AWS, Microsoft, Stripe).**

```
┌─────────────────────────────────────────────────────────────────┐
│ CONTROL PLANE (/superadmin/)                                    │
│ NOT multi-tenant. Manages ALL venues globally.                  │
├─────────────────────────────────────────────────────────────────┤
│ • Platform revenue & analytics                                  │
│ • Global feature catalog (create/edit feature definitions)      │
│ • KYC queue for ALL venues                                      │
│ • Venue list & onboarding                                       │
│ • Platform-wide settings                                        │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│ APPLICATION PLANE (/venues/:slug/)                              │
│ Multi-tenant. The venue-specific experience.                    │
├─────────────────────────────────────────────────────────────────┤
│ • Venue dashboard, payments, orders                             │
│ • Venue settings & billing                                      │
│ • {isSuperadmin && <InlinePanel />} for THIS venue actions      │
│   - Approve KYC for THIS venue                                  │
│   - Enable feature for THIS venue                               │
│   - Override pricing for THIS venue                             │
└─────────────────────────────────────────────────────────────────┘
```

**Decision Rule:**

| Question | Answer | Where |
|----------|--------|-------|
| Does this affect ALL venues/platform? | Yes | `/superadmin/` |
| Does this affect ONE specific venue? | Yes | Inline in `/venues/:slug/` with amber-pink gradient |

**Examples:**

```typescript
// ✅ GLOBAL → /superadmin/features
// Create new feature "Chatbot" with base price $50/month
// This defines the feature for ALL venues

// ✅ VENUE-SPECIFIC → Inline in /venues/:slug/settings/billing
{isSuperadmin && (
  <Card className="gradient-superadmin">
    <Button>Activar Chatbot para ESTE venue</Button>
    <Button>Extender trial para ESTE venue</Button>
    <p className="text-xs">⚠️ Solo afecta a {venue.name}</p>
  </Card>
)}
```

**Why this pattern?**
- [AWS SaaS Architecture](https://docs.aws.amazon.com/whitepapers/latest/saas-architecture-fundamentals/control-plane-vs.-application-plane.html): "The control plane is not multi-tenant. It manages the environment."
- [Microsoft Azure](https://learn.microsoft.com/en-us/azure/architecture/guide/multitenant/considerations/control-planes): "Control plane isolation reduces security vulnerabilities."
- Reduces context switching for superadmins working on a specific venue

### 8. Superadmin Lazy Loading (Performance)

**NEVER load superadmin modules, services, or make API calls for non-superadmin users.**

When adding superadmin functionality to shared components (Application Plane), use lazy loading to ensure:
- Non-superadmin users don't download superadmin code
- No superadmin API calls are made for regular users
- Components remain lightweight for the majority of users

```typescript
// ✅ CORRECT - Lazy load superadmin service
const loadSuperadminService = () => import('@/services/superadmin.service')

// ✅ CORRECT - Only query when superadmin
const { data: platformFeatures } = useQuery({
  queryKey: ['superadmin', 'features'],
  queryFn: async () => {
    const service = await loadSuperadminService()
    return service.getAllFeatures()
  },
  enabled: isSuperadmin, // ← Key: Only runs for superadmin
})

// ✅ CORRECT - Only render UI for superadmin
{isSuperadmin && (
  <SuperadminPanel features={platformFeatures} />
)}

// ❌ WRONG - Static import loads for ALL users
import { getAllFeatures } from '@/services/superadmin.service'

// ❌ WRONG - Query runs for all users (even if UI is hidden)
const { data } = useQuery({
  queryKey: ['features'],
  queryFn: getAllFeatures,
  // Missing enabled: isSuperadmin
})
```

**Checklist for superadmin features in shared components:**
- [ ] Use dynamic `import()` for superadmin services
- [ ] Add `enabled: isSuperadmin` to all superadmin queries
- [ ] Wrap superadmin UI with `{isSuperadmin && ...}`
- [ ] Use `useMutation` with lazy-loaded service functions

**Reference:** `src/pages/Settings/Billing/Subscriptions.tsx` (superadmin feature management)

### 9. Search Input Debouncing (MANDATORY)

**ALL search inputs that trigger API calls MUST use debouncing.**

This prevents making a backend request on every keystroke, which would cause performance issues and unnecessary server load.

```typescript
// ❌ WRONG - Makes API call on every keystroke
const [searchTerm, setSearchTerm] = useState('')

const { data } = useQuery({
  queryKey: ['items', searchTerm],  // Triggers on every keystroke!
  queryFn: () => fetchItems(searchTerm),
})

// ✅ CORRECT - Uses debounced value for API calls
import { useDebounce } from '@/hooks/useDebounce'

const [searchTerm, setSearchTerm] = useState('')
const debouncedSearchTerm = useDebounce(searchTerm, 300)

const { data } = useQuery({
  queryKey: ['items', debouncedSearchTerm],  // Only triggers after 300ms of inactivity
  queryFn: () => fetchItems(debouncedSearchTerm),
})
```

**Requirements:**
- Use `useDebounce` hook from `@/hooks/useDebounce`
- Default delay: 300ms (industry standard used by Stripe, Google, etc.)
- Keep `searchTerm` for the input value (instant UI feedback)
- Use `debouncedSearchTerm` in `queryKey` and `queryFn`

**Reference:** `src/hooks/useDebounce.ts` | `src/pages/Payment/Payments.tsx`

### 10. Modern Dashboard Design System (2025/2026)

**Use this design system for configuration pages, settings, and data visualization.**

Inspired by: Stripe Dashboard, Linear, Vercel. Reference implementation: `src/pages/Venue/VenuePaymentConfig.tsx`

#### Components:

**1. GlassCard - Glassmorphism wrapper**
```typescript
const GlassCard: React.FC<{
  children: React.ReactNode
  className?: string
  hover?: boolean
  onClick?: () => void
}> = ({ children, className, hover = false, onClick }) => (
  <div
    onClick={onClick}
    className={cn(
      'relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm',
      'shadow-sm transition-all duration-300',
      hover && 'cursor-pointer hover:shadow-md hover:border-border hover:bg-card/90 hover:-translate-y-0.5',
      onClick && 'cursor-pointer',
      className
    )}
  >
    {children}
  </div>
)
```

**2. StatusPulse - Animated status indicator**
```typescript
const StatusPulse: React.FC<{ status: 'success' | 'warning' | 'error' | 'neutral' }> = ({ status }) => {
  const colors = {
    success: 'bg-green-500',
    warning: 'bg-yellow-500',
    error: 'bg-red-500',
    neutral: 'bg-gray-400',
  }
  return (
    <span className="relative flex h-3 w-3">
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', colors[status])} />
      <span className={cn('relative inline-flex rounded-full h-3 w-3', colors[status])} />
    </span>
  )
}
```

**3. MetricCard - Bento grid metric display**
```typescript
// Icon with gradient background + large value + label
<div className="p-2 rounded-xl bg-gradient-to-br from-green-500/20 to-green-500/5">
  <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
</div>
<p className="text-2xl font-bold tracking-tight">{value}</p>
<p className="text-sm text-muted-foreground">{label}</p>
```

**4. Collapsible sections for progressive disclosure**
```typescript
<Collapsible open={isOpen} onOpenChange={setIsOpen}>
  <GlassCard>
    <CollapsibleTrigger asChild>
      <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-purple-500/20 to-purple-500/5">
            <Calculator className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="font-medium text-sm">Section Title</h3>
            <p className="text-xs text-muted-foreground">Description</p>
          </div>
        </div>
        <ChevronRight className={cn('w-4 h-4 text-muted-foreground transition-transform', isOpen && 'rotate-90')} />
      </div>
    </CollapsibleTrigger>
    <CollapsibleContent>
      <div className="px-4 pb-4 space-y-4">
        <div className="h-px bg-border/50" />
        {/* Content */}
      </div>
    </CollapsibleContent>
  </GlassCard>
</Collapsible>
```

**5. Aligned grid rows (for tables/comparisons)**
```typescript
// Header and rows MUST use same grid template
<div className="grid grid-cols-[1fr_auto_auto] items-center gap-4 px-4 py-2">
  <div>Column 1</div>
  <div className="text-right min-w-[120px]">Column 2</div>
  <div className="text-right min-w-[70px]">Column 3</div>
</div>
```

#### Color Accents:
- **Green**: Success, positive margins, profit → `from-green-500/20 to-green-500/5 text-green-600`
- **Blue**: Info, primary data → `from-blue-500/20 to-blue-500/5 text-blue-600`
- **Purple**: Features, tools → `from-purple-500/20 to-purple-500/5 text-purple-600`
- **Orange**: Warnings, international → `from-orange-500/20 to-orange-500/5 text-orange-600`

#### Layout:
- Use **12-column Bento Grid**: `grid grid-cols-12 gap-4`
- Main content: `col-span-12 lg:col-span-8`
- Side metrics: `col-span-12 lg:col-span-4`

**Reference:** `src/pages/Venue/VenuePaymentConfig.tsx`

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI
- **State**: TanStack Query + React Context
- **Routing**: React Router v6 (nested + protected routes)
- **Backend**: Firebase Auth + REST API
- **Forms**: React Hook Form + Zod

## Project Structure

```
src/
├── components/     # Reusable UI (Radix UI + Tailwind)
├── pages/         # Route components by feature
├── context/       # AuthContext, SocketContext
├── hooks/         # Custom hooks (usePermissions, etc.)
├── services/      # API clients (axios)
├── routes/        # Router config + protection
├── lib/           # Utils + shared libraries
├── locales/       # i18n JSON files (en/, es/, fr/)
└── types.ts       # Global TypeScript types
```

## Common Tasks

### API Integration

```typescript
const { data, isLoading } = useQuery({
  queryKey: ['venues', venueId],
  queryFn: () => venueService.getVenue(venueId),
})
```

### Forms

```typescript
const schema = z.object({
  name: z.string().min(1, t('validation.nameRequired')),
})

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema),
})
```

### Role-Based Access

```typescript
const { venueId } = useCurrentVenue()
const { staffInfo } = useAuth()

// Routes: /venues/:slug/[feature]
```

## Architecture Documentation

**Core concepts:**
- [Architecture Overview](.claude/docs/architecture/overview.md) - Tech stack, data models, component guidelines
- [Routing System](.claude/docs/architecture/routing.md) - Route protection layers, navigation patterns
- [Permission System](.claude/docs/architecture/permissions.md) - Granular access control (UI controls)

## Feature Documentation

**Major features:**
- [Inventory Management](.claude/docs/features/inventory.md) - FIFO stock tracking, recipes, pricing
- [Internationalization (i18n)](.claude/docs/features/i18n.md) - Translation system with JSON namespaces
- [Theme System](.claude/docs/features/theme.md) - Light/dark mode with semantic colors
- [Settlement Incident Tracking](.claude/docs/features/settlement-incidents.md) - Automated settlement monitoring and risk management for SOFOM partnership

## Development Guides

**Best practices:**
- [UI Patterns](.claude/docs/guides/ui-patterns.md) - Icon-based selections, horizontal navigation, common UI patterns
- [Performance Optimization](.claude/docs/guides/performance.md) - React performance patterns, memoization
- [Troubleshooting Render Loops](.claude/docs/troubleshooting/render-loops.md) - Debug infinite re-renders

## Key Patterns

### Multi-tenant Venue System

- Routes: `/venues/:slug/[feature]`
- AuthContext manages venue switching
- Each venue has role-based permissions + feature flags

### Role Hierarchy

1. `VIEWER` - Read-only
2. `HOST` - Customer-facing
3. `WAITER` - Order management
4. `CASHIER` - Payment processing
5. `KITCHEN` - Kitchen operations
6. `MANAGER` - Staff management
7. `ADMIN` - Venue configuration
8. `OWNER` - Full venue access
9. `SUPERADMIN` - System-wide access

### Permission Format

```typescript
"resource:action"

// Examples:
"tpv:create"          // Create TPV terminals
"menu:update"         // Update menu items
"analytics:export"    // Export analytics data
"*:*"                 // All permissions (ADMIN, OWNER, SUPERADMIN)
```

## Common Workflows

### Creating a New Feature with Permissions

1. **Add permission to defaults** (`src/lib/permissions/defaultPermissions.ts`):
   ```typescript
   [StaffRole.MANAGER]: [
     // ... existing
     'reports:create',
     'reports:export',
   ]
   ```

2. **Protect route** (`src/routes/router.tsx`):
   ```typescript
   <Route element={<PermissionProtectedRoute permission="reports:read" />}>
     <Route path="reports" element={<ReportsPage />} />
   </Route>
   ```

3. **Use PermissionGate in component**:
   ```typescript
   <PermissionGate permission="reports:create">
     <Button onClick={createReport}>Create Report</Button>
   </PermissionGate>
   ```

4. **Add backend protection** (see backend CLAUDE.md):
   ```typescript
   router.post('/reports', checkPermission('reports:create'), controller.create)
   ```

5. **Keep in sync**: Frontend and backend permissions MUST match!

### Adding Translations

1. **Create JSON structure** (`src/locales/[en|es|fr]/feature.json`):
   ```json
   {
     "feature": {
       "title": "Feature Title",
       "form": {
         "fields": {
           "name": "Name"
         }
       }
     }
   }
   ```

2. **Register namespace** (`src/i18n.ts`):
   ```typescript
   i18n.addResourceBundle('en', 'feature', featureEn, true, true)
   ```

3. **Use in component**:
   ```typescript
   const { t } = useTranslation('feature')
   return <h1>{t('title')}</h1>
   ```

## Testing

Currently no automated tests. Quality maintained through:
- TypeScript strict mode
- ESLint static analysis
- Manual testing with dev server
- Role-based testing (verify permissions for all roles)

## Environment & Deployment

**Three environments:**
- **Demo** (`demo.dashboard.avoqado.io`) → `demo.api.avoqado.io`
- **Staging** (`staging.dashboard.avoqado.io`) → Render staging API
- **Production** (`dashboardv2.avoqado.io`) → `api.avoqado.io`

**Deployment:**
- GitHub Actions + Cloudflare Pages
- Auto-deploy on push to `develop` (demo + staging) or `main` (production)
- Environment variables stored in **GitHub Environments** (NOT Cloudflare Pages UI)

**Manual deploy:**
```bash
gh workflow run ci-cd.yml --field environment=demo
```

## Need Help?

- **Quick reference**: [Quick Reference](.claude/docs/quick-reference.md)
- **Architecture**: [Overview](.claude/docs/architecture/overview.md) | [Routing](.claude/docs/architecture/routing.md) | [Permissions](.claude/docs/architecture/permissions.md)
- **Features**: [Inventory](.claude/docs/features/inventory.md) | [i18n](.claude/docs/features/i18n.md) | [Theme](.claude/docs/features/theme.md)
- **Guides**: [UI Patterns](.claude/docs/guides/ui-patterns.md) | [Performance](.claude/docs/guides/performance.md)
- **Troubleshooting**: [Render Loops](.claude/docs/troubleshooting/render-loops.md)

## Contributing

**Before deploying:**
- [ ] All user-facing text uses `t('...')`
- [ ] Translations added for en, es, fr
- [ ] Arrays/objects memoized with `useMemo`/`useCallback`
- [ ] Theme-aware colors used (no hardcoded grays)
- [ ] Permissions synced between frontend and backend
- [ ] Tested in both light and dark modes
- [ ] Tested with different roles (VIEWER, WAITER, MANAGER, OWNER)
- [ ] No React warnings in console
- [ ] Build succeeds: `npm run build`
