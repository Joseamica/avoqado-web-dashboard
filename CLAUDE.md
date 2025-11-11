# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Quick Start

**Essential reading:** [Quick Reference](.claude/docs/quick-reference.md) - Dev commands, critical rules, common patterns

## Development Commands

- `npm run dev` - Start Vite dev server at http://localhost:5173
- `npm run build` - TypeScript compilation + Vite build
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build

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
- **Guides**: [Performance](.claude/docs/guides/performance.md)
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
