# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## 🔴 MANDATORY: Documentation Update Rule (READ FIRST)

**When implementing or modifying ANY feature, you MUST:**

1. **Check if documentation exists** for the feature/area you're modifying
2. **Update the documentation** if your changes affect documented behavior
3. **Create new documentation** if implementing a new significant feature
4. **Update references in CLAUDE.md** if you create new docs
5. **Cross-repo features** → Update `avoqado-server/docs/` (central hub)
6. **New pages/functionality** → Add to Feature Registry (`src/config/feature-registry.ts`)

**This is NOT optional.** Documentation debt causes confusion and bugs.

### Feature Registry Rule

When creating a **new page or major functionality** that could be used in white-label dashboards:

```typescript
// src/config/feature-registry.ts
AVOQADO_NEW_FEATURE: {
  code: 'AVOQADO_NEW_FEATURE',
  name: 'Nombre del Feature',
  description: 'Descripción breve',
  category: 'sales' | 'analytics' | 'inventory' | 'team' | 'custom',
  source: 'avoqado_core',  // or 'module_specific' for vertical-specific features
  component: { path: '@/pages/NewFeature/NewFeaturePage' },
  routes: [{ path: 'new-feature', element: 'NewFeaturePage' }],
  configSchema: { /* JSON Schema for configuration options */ },
  defaultNavItem: { label: 'New Feature', icon: 'IconName' },
}
```

**When to add to Feature Registry:**
- ✅ New page in `src/pages/` that represents a business feature
- ✅ Functionality that venues might want to enable/disable
- ❌ Internal/system pages (Auth, Onboarding, Superadmin)
- ❌ Settings or configuration pages

**See:** [White-Label Dashboard docs](docs/features/WHITE_LABEL_DASHBOARD.md) for full feature list.

```
✅ DO: Implement feature → Update docs → Commit both together
❌ DON'T: Implement feature → "I'll document it later" → Never document it
```

**Central hub:** `avoqado-server/docs/README.md` is the master index for ALL cross-repo documentation.

---

## Quick Start

**Essential reading:** [Quick Reference](docs/quick-reference.md) - Dev commands, critical rules, common patterns

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

### Documentation Structure

```
avoqado-server/docs/           ← CENTRAL HUB (cross-repo)
├── README.md                  ← Master index of ALL documentation
├── architecture/              ← Cross-repo architecture
├── features/                  ← Cross-repo features
└── ...

avoqado-web-dashboard/docs/    ← Frontend-specific ONLY (this repo)
├── README.md                  ← Frontend docs index
├── architecture/              ← React routing, overview
├── features/                  ← i18n, theme, inventory UI
├── guides/                    ← UI patterns, performance
└── troubleshooting/           ← React-specific issues

avoqado-tpv/docs/              ← Android-specific ONLY
├── android/                   ← Kotlin/Compose patterns
└── devices/                   ← PAX hardware guides
```

### Where to Document

| Type of Documentation | Location |
|-----------------------|----------|
| Cross-repo features (payments, inventory logic) | `avoqado-server/docs/features/` |
| Architecture, DB schema, API | `avoqado-server/docs/` |
| React/UI patterns, components | `docs/` (this repo) |
| Android/Kotlin patterns | `avoqado-tpv/docs/` |

### When Creating New Documentation

1. **Frontend-specific**: Place in `docs/` directory
   - ✅ CORRECT: `docs/features/NEW_FEATURE.md`
   - ❌ WRONG: `NEW_FEATURE.md` (root level)
   - Follow structure: `architecture/`, `features/`, `guides/`, `troubleshooting/`

2. **Cross-repo features**: Place in `avoqado-server/docs/`
   - Features affecting multiple repos → `avoqado-server/docs/features/`
   - Architecture changes → `avoqado-server/docs/`

3. **Reference in CLAUDE.md**: Add link in relevant section
   - Format: `- [Title](docs/category/filename.md) - Brief description`

### Cross-Repo Documentation (Central Hub)

**Master index:** [`avoqado-server/docs/README.md`](../avoqado-server/docs/README.md)

| Topic | Location |
|-------|----------|
| Architecture, APIs, DB | `avoqado-server/docs/` |
| Payment integrations (Blumon, Stripe) | `avoqado-server/docs/blumon-*/` |
| Business Types & MCC | `avoqado-server/docs/BUSINESS_TYPES.md` |
| Database schema | `avoqado-server/docs/DATABASE_SCHEMA.md` |
| Inventory system (backend) | `avoqado-server/docs/INVENTORY_REFERENCE.md` |
| Settlement incidents | `avoqado-server/docs/features/SETTLEMENT_INCIDENTS.md` |
| Frontend components, routing | `docs/` (this repo) |

### When to Update Docs

| Change Type | Action |
|-------------|--------|
| New VenueType | Update `avoqado-server/docs/BUSINESS_TYPES.md` |
| Payment flow changes | Update `avoqado-server/docs/PAYMENT_ARCHITECTURE.md` |
| API/DB changes | Update `avoqado-server/docs/DATABASE_SCHEMA.md` |
| UI pattern changes | Update `docs/` (this repo) |
| React performance patterns | Update `docs/guides/performance.md` |

### Documentation Update Checklist

> **See "🔴 MANDATORY: Documentation Update Rule" at the top of this file.**

**Checklist before committing:**
- [ ] Does this change affect any existing documentation?
- [ ] Did I update line number references if file structure changed?
- [ ] Did I update progress percentages if completing phases?
- [ ] Did I add new documentation if this is a new feature?

**Avoid fragile line number references.** Instead of `"See file.ts lines 100-200"`, use:
- Function/class names: `"See createOrder() in order.service.ts"`
- Section headers: `"See ## Authentication section in AUTH.md"`

## 🚨 Critical Rules (NO EXCEPTIONS)

### 1. Internationalization (i18n)

**ALL user-facing text MUST use `t('...')` - EXCEPT Superadmin screens.**

**Superadmin exception:** In `src/pages/Superadmin/**`, do NOT use i18n. Keep text hardcoded (Spanish) and do not add translations for superadmin UI.

```typescript
// ❌ WRONG
<Button>Save</Button>

// ✅ CORRECT
const { t } = useTranslation()
<Button>{t('save')}</Button>
```

**Requirements:**
- Add translations for BOTH `en` and `es`
- Use interpolation: `t('greeting', { name })`
- No hardcoded strings in JSX
 - Superadmin UI is the only exception (see note above)

**See:** [Complete i18n guide](docs/features/i18n.md)

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

**See:** [Performance guide](docs/guides/performance.md) | [Render loops troubleshooting](docs/troubleshooting/render-loops.md)

### 3. Permissions

**Backend is the SINGLE SOURCE OF TRUTH. Frontend just calls `can('permission')`.**

```typescript
// UI control (hide/show) - uses useAccess hook
import { useAccess } from '@/hooks/use-access'

const { can } = useAccess()
{can('tpv:create') && <Button>Create</Button>}

// Or use PermissionGate component
<PermissionGate permission="tpv:create">
  <Button>Create</Button>
</PermissionGate>

// Backend validates with verifyAccess middleware
router.post('/tpvs', verifyAccess({ permission: 'tpv:create' }), controller.create)
```

**🔴 MANDATORY: When adding NEW features with permissions:**

1. **Add permission to backend** (`avoqado-server/src/lib/permissions.ts` - `DEFAULT_PERMISSIONS`)
2. **If white-label feature**: Add mapping in `avoqado-server/src/services/access/access.service.ts` (`PERMISSION_TO_FEATURE_MAP`)
3. **Add route protection** in backend with `verifyAccess({ permission: '...' })`
4. **Use in frontend** with `can()` or `<PermissionGate>` - no mapping needed
5. **Update docs** if adding new permission categories

**See:** [Permission system guide](docs/architecture/permissions.md)

### 4. Theme System

**NEVER use hardcoded colors** (e.g., `bg-gray-200`, `text-gray-600`)

```typescript
// ❌ WRONG
<div className="bg-gray-50 text-gray-900">

// ✅ CORRECT
<div className="bg-muted text-foreground">
```

**See:** [Theme guide](docs/features/theme.md)

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

**See:** [Complete UI Patterns guide](docs/guides/ui-patterns.md#pill-style-tabs-mandatory)

### 6. Stripe-Style Filters (MANDATORY)

**ALWAYS use Stripe-style filter pills for table/list filters. NEVER use DataTable's built-in column customizer.**

```typescript
// ❌ WRONG - Old pattern with single value filters
const [statusFilter, setStatusFilter] = useState<string>('')
<DataTable columns={columns} showColumnCustomizer={true} />

// ✅ CORRECT - Stripe-style with multi-select arrays
const [statusFilter, setStatusFilter] = useState<string[]>([])
const [visibleColumns, setVisibleColumns] = useState<string[]>([...])

// Filter columns based on visibility
const filteredColumns = useMemo(() =>
  columns.filter(col => visibleColumns.includes(col.id || col.accessorKey)),
  [columns, visibleColumns]
)

// Use FilterPill components
<FilterPill label={t('status')} isActive={statusFilter.length > 0} onClear={() => setStatusFilter([])}>
  <CheckboxFilterContent options={statusOptions} selectedValues={statusFilter} onApply={setStatusFilter} />
</FilterPill>

<DataTable columns={filteredColumns} showColumnCustomizer={false} />
```

**Components:** `@/components/filters/FilterPill`, `CheckboxFilterContent`, `ColumnCustomizer`

**Reference:** `/src/pages/Order/Orders.tsx`

**Pages needing migration:** `Payments.tsx`, `Customers.tsx`, `Inventory.tsx`

**See:** [Complete UI Patterns guide](docs/guides/ui-patterns.md#stripe-style-filters-mandatory)

#### Expandable Search Bar (MANDATORY)

**ALWAYS use the expandable/animated search pattern from Orders.tsx for search bars in table/list views.**

This pattern provides a clean, space-efficient search experience with smooth animations and proper state management.

```typescript
// ❌ WRONG - Static search bar always visible
<div className="relative">
  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2" />
  <Input
    placeholder={t('search.placeholder')}
    value={searchQuery}
    onChange={(e) => setSearchQuery(e.target.value)}
    className="pl-9"
  />
</div>

// ✅ CORRECT - Expandable search with animation
import { useDebounce } from '@/hooks/useDebounce'

const [searchTerm, setSearchTerm] = useState('')
const debouncedSearchTerm = useDebounce(searchTerm, 300)
const [isSearchOpen, setIsSearchOpen] = useState(false)

// Expandable search UI
<div className="relative flex items-center">
  {isSearchOpen ? (
    <div className="flex items-center gap-1 animate-in fade-in slide-in-from-left-2 duration-200">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={e => setSearchTerm(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Escape') {
              if (!searchTerm) setIsSearchOpen(false)
            }
          }}
          className="h-8 w-[200px] pl-8 pr-8 text-sm rounded-full"
          autoFocus
        />
        {searchTerm && (
          <button
            onClick={() => setSearchTerm('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-full"
        onClick={() => {
          setSearchTerm('')
          setIsSearchOpen(false)
        }}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  ) : (
    <Button
      variant={searchTerm ? 'secondary' : 'ghost'}
      size="icon"
      className="h-8 w-8 rounded-full"
      onClick={() => setIsSearchOpen(true)}
    >
      <Search className="h-4 w-4" />
      {searchTerm && <span className="sr-only">{t('filters.searchActive')}</span>}
    </Button>
  )}
  {/* Active search indicator dot */}
  {searchTerm && !isSearchOpen && (
    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary" />
  )}
</div>
```

**Key Features:**
- **State management**: Separate `searchTerm` (UI) and `debouncedSearchTerm` (API calls)
- **Expandable UI**: Toggles between icon button and full input with `isSearchOpen` state
- **Animation**: Uses Tailwind's `animate-in fade-in slide-in-from-left-2 duration-200`
- **Rounded styling**: `rounded-full` for both button and input
- **Clear button**: X icon appears when search has value
- **Active indicator**: Dot badge shows when collapsed with active search
- **Keyboard support**: Escape key to close (when empty)
- **Auto-focus**: Input focuses automatically when opened
- **Debouncing**: Required for API calls (see Rule #11)

**Reference:** `src/pages/Order/Orders.tsx` (lines 1016-1068)

### 7. URL Hash-Based Tabs (MANDATORY)

**Tabs that represent page sections MUST persist state via URL hash** to survive page reloads and enable direct linking.

```typescript
// ❌ WRONG - Tab state lost on reload
const [activeTab, setActiveTab] = useState('overview')

<Tabs value={activeTab} onValueChange={setActiveTab}>
  {/* Tabs lost on F5/reload */}
</Tabs>

// ✅ CORRECT - Tab state persists via URL hash
import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

const VALID_TABS = ['overview', 'config', 'approvals', 'payouts'] as const
type TabValue = typeof VALID_TABS[number]

export default function MyPage() {
  const location = useLocation()
  const navigate = useNavigate()

  // Get tab from URL hash, default to first tab
  const getTabFromHash = (): TabValue => {
    const hash = location.hash.replace('#', '')
    return VALID_TABS.includes(hash as TabValue) ? (hash as TabValue) : 'overview'
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
      {/* Tab content */}
    </Tabs>
  )
}
```

**Benefits:**
- Tab survives page reload (F5)
- Users can bookmark/share specific tabs: `/venues/my-venue/commissions#config`
- Browser back/forward navigates between tabs
- Enables deep linking from notifications or other pages

**Reference:** `src/pages/Commissions/CommissionsPage.tsx`

### 8. SUPERADMIN Gradient (MANDATORY)

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

### 9. Control Plane vs Application Plane (Architecture)

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

### 10. Superadmin Lazy Loading (Performance)

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

### 11. Search Input Debouncing (MANDATORY)

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

### 12. Modern Dashboard Design System (2025/2026)

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

#### Icon Buttons & Cursor:
**ALWAYS add `cursor-pointer` to icon buttons**, especially when wrapped in Tooltip components.

Radix UI's `TooltipTrigger` with `asChild` can interfere with default button cursor. Explicit `cursor-pointer` ensures consistent UX.

```typescript
// ❌ WRONG - Cursor may not show as pointer
<TooltipTrigger asChild>
  <Button variant="ghost" size="icon" className="h-7 w-7">
    <Pencil className="w-3.5 h-3.5" />
  </Button>
</TooltipTrigger>

// ✅ CORRECT - Explicit cursor-pointer
<TooltipTrigger asChild>
  <Button variant="ghost" size="icon" className="h-7 w-7 cursor-pointer">
    <Pencil className="w-3.5 h-3.5" />
  </Button>
</TooltipTrigger>
```

**Reference:** `src/pages/Superadmin/components/merchant-accounts/MerchantAccountCard.tsx`

**Reference:** `src/pages/Venue/VenuePaymentConfig.tsx`

#### Clickable Selection Rows (MANDATORY)

**When a row contains a checkbox or radio button, make the ENTIRE row clickable**, not just the checkbox/radio itself. Users expect to click anywhere on the row to toggle selection.

```typescript
// ❌ WRONG - Only checkbox is clickable
<div className="flex items-center p-4">
  <div className="flex-1">
    <p className="font-semibold">{label}</p>
    <p className="text-muted-foreground">{description}</p>
  </div>
  <Checkbox
    checked={isSelected}
    onCheckedChange={() => toggleItem(item.key)}
  />
</div>

// ✅ CORRECT - Entire row is clickable with cursor-pointer
<div
  className="flex items-center p-4 cursor-pointer hover:bg-muted/50"
  onClick={() => toggleItem(item.key)}
>
  <div className="flex-1">
    <p className="font-semibold">{label}</p>
    <p className="text-muted-foreground">{description}</p>
  </div>
  <Checkbox
    checked={isSelected}
    onClick={(e) => e.stopPropagation()}  // Prevent double-toggle
    className="cursor-pointer"
  />
</div>
```

**Key points:**
- Add `cursor-pointer` to the clickable container
- Add `hover:bg-muted/50` for visual feedback
- Use `onClick={(e) => e.stopPropagation()}` on nested interactive elements to prevent double actions
- Remove `onCheckedChange` from Checkbox when row handles the toggle

**Reference:** `src/pages/Reports/SalesSummary.tsx` (metrics selection panel)

### 13. Timezone Handling (MANDATORY)

**ALL date/time displays MUST use venue timezone, NOT browser timezone.**

This follows the industry-standard pattern used by Stripe and Toast (NOT Square, which has documented problems with browser timezone).

```typescript
// ❌ WRONG - Uses browser timezone
new Date(dateString).toLocaleDateString('es-ES', {...})
format(date, 'PPp', { locale }) // date-fns
new Date().toLocaleString() // no timezone

// ✅ CORRECT - Uses useVenueDateTime hook
import { useVenueDateTime } from '@/utils/datetime'

const { formatDate, formatTime, formatDateTime, venueTimezone } = useVenueDateTime()
<span>{formatDate(payment.createdAt)}</span>
<span>{formatTime(order.updatedAt)}</span>
```

**For services/utilities (non-React):**
```typescript
// ❌ WRONG - No timezone parameter
export function formatNotificationTime(dateString: string) {
  return new Date(dateString).toLocaleString('es-ES')
}

// ✅ CORRECT - Accept timezone as parameter, use Luxon
import { DateTime } from 'luxon'
import { getIntlLocale } from '@/utils/i18n-locale'

export function formatNotificationTime(
  dateString: string,
  locale: string = 'es',
  timezone: string = 'America/Mexico_City'
): string {
  return DateTime.fromISO(dateString, { zone: 'utc' })
    .setZone(timezone)
    .setLocale(getIntlLocale(locale))
    .toLocaleString(DateTime.DATETIME_MED)
}
```

**For relative times:**
```typescript
// ❌ WRONG - date-fns formatDistanceToNow (no timezone)
import { formatDistanceToNow } from 'date-fns'
{formatDistanceToNow(new Date(date))}

// ✅ CORRECT - Luxon toRelative with venue timezone
DateTime.fromISO(date, { zone: 'utc' })
  .setZone(venueTimezone)
  .setLocale(localeCode)
  .toRelative()
```

**For currency formatting:**
```typescript
// ❌ WRONG - Hardcoded locale
new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' })

// ✅ CORRECT - Use getIntlLocale for user's language
import { getIntlLocale } from '@/utils/i18n-locale'
const localeCode = getIntlLocale(i18n.language)
new Intl.NumberFormat(localeCode, { style: 'currency', currency: 'MXN' })
```

**Backend date calculations (CRITICAL):**

Backend also has timezone utilities in `avoqado-server/src/utils/datetime.ts` using `date-fns-tz`.

```typescript
// ❌ WRONG - Using raw Date() without timezone handling
const today = new Date()
const weekStart = new Date(today)
weekStart.setDate(today.getDate() - today.getDay())
weekStart.setHours(0, 0, 0, 0)
// Problem: This calculates dates in server's local timezone, not venue timezone!

// ✅ CORRECT - Use date-fns-tz utilities
import { toZonedTime, fromZonedTime } from 'date-fns-tz'

const timezone = 'America/Mexico_City'
const today = new Date()
const nowVenue = toZonedTime(today, timezone)

// Calculate dates in venue timezone
const weekStartVenue = new Date(nowVenue)
weekStartVenue.setDate(nowVenue.getDate() - nowVenue.getDay())
weekStartVenue.setHours(0, 0, 0, 0)

// Convert back to UTC for database queries
const weekStart = fromZonedTime(weekStartVenue, timezone)

// Use in Prisma queries (Prisma expects UTC)
const orders = await prisma.order.findMany({
  where: {
    createdAt: { gte: weekStart, lt: weekEnd }
  }
})
```

**Architecture:**
```
BACKEND → Calculate dates in venue timezone (date-fns-tz)
       → Convert to UTC (fromZonedTime)
       → Query database (Prisma, expects UTC)
       → Send ISO 8601 with Z suffix
                    ↓
FRONTEND → useVenueDateTime() hook
                    ↓
           DateTime.fromISO(utc, { zone: 'utc' })
             .setZone(venue.timezone)  // NOT browser timezone
             .setLocale(i18n.language)
                    ↓
           Display: "20 oct 2025, 12:30 PM" (venue timezone)
```

**Why venue timezone (not browser/server)?**
- All team members see consistent times regardless of physical location
- Financial reports match the business's operating timezone
- Compliance: Transactions must reflect where the business operates
- **Charts/analytics**: "Today" means today in the venue's timezone, not UTC or server time

**Common mistake example:**
```typescript
// User in Mexico City (UTC-6) views chart for "this week"
// Without timezone handling:
//   Server calculates "Sunday 00:00 UTC" as week start
//   But venue's Sunday starts 6 hours later!
//   Result: Charts show wrong data, offset by 6 hours

// With timezone handling:
//   Server calculates "Sunday 00:00 CST" → converts to "Sunday 06:00 UTC"
//   Queries database with UTC range
//   Charts show correct data for venue's timezone ✅
```

**Reference:**
- Frontend: `src/utils/datetime.ts` (Luxon)
- Backend: `avoqado-server/src/utils/datetime.ts` (date-fns-tz)
- **BOTH files MUST stay in sync** - see comments in backend file

### 14. White-Label Navigation Paths (MANDATORY)

**NEVER hardcode `/venues/` in navigation paths.** Use `fullBasePath` from `useCurrentVenue()` hook.

This ensures components work correctly in both regular mode (`/venues/:slug`) and white-label mode (`/wl/:slug`).

```typescript
// ❌ WRONG - Breaks white-label mode
navigate(`/venues/${venueSlug}/settings`)
<Link to={`/venues/${venueSlug}/orders`}>Orders</Link>

// ✅ CORRECT - Works in both modes
const { fullBasePath } = useCurrentVenue()
navigate(`${fullBasePath}/settings`)
<Link to={`${fullBasePath}/orders`}>Orders</Link>
```

**What `fullBasePath` returns:**
- In `/venues/my-venue/*` routes → `/venues/my-venue`
- In `/wl/my-venue/*` routes → `/wl/my-venue`

**When to use `/venues/` directly (exceptions):**
- ✅ Organization pages navigating TO a venue (cross-context navigation)
- ✅ API calls using `venueId` (e.g., `/api/v1/dashboard/venues/${venueId}/...`)
- ❌ Any navigation WITHIN a venue's pages

**ESLint Rule:** `eslint-rules/no-hardcoded-venue-paths.js` catches violations.

**Reference:** `src/hooks/use-current-venue.tsx`

### 15. FullScreenModal Form Pattern (MANDATORY)

**Forms in FullScreenModal MUST follow the ProductWizardDialog design pattern.**

**Visual Requirements:**
1. **Header**: Dark background with Close (left), Title (center), Submit button (right)
2. **Content**: Gray background (`contentClassName="bg-muted/30"`)
3. **Form**: Organized in white cards with icon section headers
4. **Inputs**: `className="h-12 text-base"` (transparent, NOT `bg-muted`)

```typescript
// ✅ CORRECT - Submit button in header, gray content background
<FullScreenModal
  open={isOpen}
  onClose={() => setIsOpen(false)}
  title="Create Item"
  contentClassName="bg-muted/30"
  actions={
    <Button onClick={() => formRef.current?.submit()} disabled={!isValid}>
      Save
    </Button>
  }
>
  <div className="max-w-2xl mx-auto px-6 py-8">
    {/* Card sections with icon headers */}
    <div className="rounded-2xl border border-border/50 bg-card p-6">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 rounded-xl bg-primary/10">
          <Package className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold">Section Title</h3>
          <p className="text-sm text-muted-foreground">Description</p>
        </div>
      </div>
      <Input className="h-12 text-base" />
    </div>
  </div>
</FullScreenModal>

// ❌ WRONG - Submit at bottom, no gray background, bg-muted on inputs
<FullScreenModal open={isOpen} onClose={...} title="...">
  <Input className="bg-muted" />
  <Button type="submit">Save</Button>  {/* Button at bottom */}
</FullScreenModal>
```

**Key Points:**
- Use `forwardRef` + `useImperativeHandle` to expose `submit()` method
- Parent tracks `isSubmitting` and `isFormValid` states
- Cards use `rounded-2xl border border-border/50 bg-card p-6`
- Section icons: `bg-{color}/10` background with matching `text-{color}`

**See:** [Complete FullScreenModal Form Pattern guide](docs/guides/ui-patterns.md#fullscreenmodal-form-pattern-mandatory)

**Reference:** `src/pages/Inventory/components/ProductWizardDialog.tsx`, `src/pages/Team/components/InviteTeamMemberForm.tsx`

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
- [Architecture Overview](docs/architecture/overview.md) - Tech stack, data models, component guidelines
- [Routing System](docs/architecture/routing.md) - Route protection layers, navigation patterns
- [Permission System](docs/architecture/permissions.md) - Granular access control (UI controls)
- [Business Types & Categories](../avoqado-server/docs/BUSINESS_TYPES.md) - VenueType enum, MCC mapping (cross-repo)

## Feature Documentation

**Major features:**
- [White-Label Dashboard](docs/features/WHITE_LABEL_DASHBOARD.md) - Custom branded dashboards for enterprise clients (visual builder, feature registry)
- [Inventory Management](docs/features/inventory.md) - FIFO stock tracking UI, recipes, pricing
- [Internationalization (i18n)](docs/features/i18n.md) - Translation system with JSON namespaces
- [Theme System](docs/features/theme.md) - Light/dark mode with semantic colors
- [Settlement Incidents](../avoqado-server/docs/features/SETTLEMENT_INCIDENTS.md) - Settlement monitoring (cross-repo)

## Development Guides

**Best practices:**
- [UI Patterns](docs/guides/ui-patterns.md) - Icon-based selections, horizontal navigation, common UI patterns
- [Performance Optimization](docs/guides/performance.md) - React performance patterns, memoization
- [Troubleshooting Render Loops](docs/troubleshooting/render-loops.md) - Debug infinite re-renders

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

**🔴 IMPORTANT: Backend is the single source of truth. Start there.**

1. **Add permission to BACKEND** (`avoqado-server/src/lib/permissions.ts`):
   ```typescript
   [StaffRole.MANAGER]: [
     // ... existing
     'reports:create',
     'reports:export',
   ]
   ```

2. **If white-label feature, add to PERMISSION_TO_FEATURE_MAP** (`avoqado-server/src/services/access/access.service.ts`):
   ```typescript
   const PERMISSION_TO_FEATURE_MAP = {
     // ... existing
     'reports:read': 'AVOQADO_REPORTS',
     'reports:create': 'AVOQADO_REPORTS',
     'reports:export': 'AVOQADO_REPORTS',
   }
   ```

3. **Add backend route protection**:
   ```typescript
   router.post('/reports', verifyAccess({ permission: 'reports:create' }), controller.create)
   ```

4. **Protect frontend route** (`src/routes/router.tsx`):
   ```typescript
   <Route element={<PermissionProtectedRoute permission="reports:read" />}>
     <Route path="reports" element={<ReportsPage />} />
   </Route>
   ```

5. **Use PermissionGate in component** (just calls `can()` - no mapping needed):
   ```typescript
   <PermissionGate permission="reports:create">
     <Button onClick={createReport}>Create Report</Button>
   </PermissionGate>
   ```

**Note:** Frontend no longer needs its own `DEFAULT_PERMISSIONS` - backend handles all resolution.

### Adding Translations

1. **Create JSON structure** (`src/locales/[en|es]/feature.json`):
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

- **Quick reference**: [Quick Reference](docs/quick-reference.md)
- **Architecture**: [Overview](docs/architecture/overview.md) | [Routing](docs/architecture/routing.md) | [Permissions](docs/architecture/permissions.md)
- **Features**: [Inventory](docs/features/inventory.md) | [i18n](docs/features/i18n.md) | [Theme](docs/features/theme.md)
- **Guides**: [UI Patterns](docs/guides/ui-patterns.md) | [Performance](docs/guides/performance.md)
- **Troubleshooting**: [Render Loops](docs/troubleshooting/render-loops.md)
- **Cross-repo docs**: [avoqado-server/docs/README.md](../avoqado-server/docs/README.md)

## Contributing

**Before deploying:**
- [ ] All user-facing text uses `t('...')`
- [ ] Translations added for en, es
- [ ] Arrays/objects memoized with `useMemo`/`useCallback`
- [ ] Theme-aware colors used (no hardcoded grays)
- [ ] Permissions synced between frontend and backend
- [ ] Tested in both light and dark modes
- [ ] Tested with different roles (VIEWER, WAITER, MANAGER, OWNER)
- [ ] No React warnings in console
- [ ] Build succeeds: `npm run build`
