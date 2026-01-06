# Quick Reference

Essential information for working with the Avoqado Web Dashboard.

## Development Commands

```bash
npm run dev      # Start dev server (http://localhost:5173)
npm run build    # TypeScript + Vite build
npm run lint     # ESLint
npm run preview  # Preview production build
```

## Tech Stack

- **Framework**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + Radix UI
- **State**: TanStack Query + React Context
- **Routing**: React Router v6 (nested + protected routes)
- **Backend**: Firebase Auth + REST API
- **Forms**: React Hook Form + Zod

## Critical Rules ⚠️

### 1. Internationalization (i18n)

**MANDATORY**: ALL user-facing text MUST use `t('...')` - NO EXCEPTIONS

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
- See: [Complete i18n guide](./features/i18n.md)

### 2. Performance & Memoization

**CRITICAL**: Always memoize filtered/transformed arrays passed to DataTable

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

See: [Performance guide](./guides/performance.md) | [Render loops troubleshooting](./troubleshooting/render-loops.md)

### 3. Permissions

**Frontend + Backend validation required**

```typescript
// UI control (hide/show)
<PermissionGate permission="tpv:create">
  <Button>Create</Button>
</PermissionGate>

// Backend must validate too
router.post('/tpvs', checkPermission('tpv:create'), controller.create)
```

See: [Permission system guide](./architecture/permissions.md)

### 4. Theme System

**NEVER use hardcoded colors** (e.g., `bg-gray-200`, `text-gray-600`)

```typescript
// ❌ WRONG
<div className="bg-gray-50 text-gray-900">

// ✅ CORRECT
<div className="bg-muted text-foreground">
```

See: [Theme guide](./features/theme.md)

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

## Common Patterns

### API Integration

```typescript
// Use TanStack Query
const { data, isLoading } = useQuery({
  queryKey: ['venues', venueId],
  queryFn: () => venueService.getVenue(venueId),
})
```

### Forms

```typescript
// React Hook Form + Zod
const schema = z.object({
  name: z.string().min(1, t('validation.nameRequired')),
})

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema),
})
```

### Role-Based Access

```typescript
// Multi-tenant venue system
const { venueId } = useCurrentVenue()
const { staffInfo } = useAuth()

// Routes: /venues/:slug/[feature]
```

## Need More Info?

- **Architecture**: [Overview](./architecture/overview.md) | [Routing](./architecture/routing.md) | [Permissions](./architecture/permissions.md) | [State Management](./architecture/state-management.md)
- **Features**: [Inventory](./features/inventory.md) | [i18n](./features/i18n.md) | [Theme](./features/theme.md)
- **Guides**: [Development](./guides/development.md) | [Performance](./guides/performance.md) | [Deployment](./guides/deployment.md)
- **Troubleshooting**: [Render Loops](./troubleshooting/render-loops.md)
