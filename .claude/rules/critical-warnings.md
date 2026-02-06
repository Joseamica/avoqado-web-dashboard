# Critical Warnings (NO EXCEPTIONS)

These rules apply to ALL files in the dashboard. Violations cause production bugs.

## i18n: All User-Facing Text Must Use `t()`

```typescript
// WRONG
<Button>Save</Button>

// CORRECT
const { t } = useTranslation()
<Button>{t('save')}</Button>
```

- Add translations for BOTH `en` and `es` (and `fr` if namespace exists)
- Use interpolation: `t('greeting', { name })` — never concatenate strings
- **Superadmin exception**: `src/pages/Superadmin/**` uses hardcoded Spanish, no i18n
- ESLint rule `no-missing-translation-keys.js` validates keys match JSON files — don't suppress it
- See: `docs/features/i18n.md`

## Theme: No Hardcoded Colors

```typescript
// WRONG
<div className="bg-gray-50 text-gray-900">

// CORRECT
<div className="bg-muted text-foreground">
```

Common replacements: `bg-white` → `bg-background`, `bg-gray-50` → `bg-muted`, `text-gray-600` → `text-muted-foreground`, `border-gray-200` → `border-border`

See: `docs/features/theme.md`

## Permissions: Backend is Source of Truth

```typescript
// UI control
const { can } = useAccess()
{can('tpv:create') && <Button>Create</Button>}

// Or declarative
<PermissionGate permission="tpv:create">
  <Button>Create</Button>
</PermissionGate>
```

- Frontend `can()` is for UX only — backend ALWAYS validates
- New permissions: add to backend first (`avoqado-server/src/lib/permissions.ts`)
- If white-label feature: also add mapping in `avoqado-server/src/services/access/access.service.ts` (`PERMISSION_TO_FEATURE_MAP`)
- See: `docs/architecture/permissions.md`

## Timezone: Venue Timezone, Never Browser

```typescript
// WRONG
new Date(dateString).toLocaleDateString('es-ES', {...})

// CORRECT
import { useVenueDateTime } from '@/utils/datetime'
const { formatDate } = useVenueDateTime()
<span>{formatDate(payment.createdAt)}</span>
```

- Never use `new Date().toLocaleString()` without timezone
- For non-React code: accept timezone parameter, use Luxon
- See: `docs/guides/TIMEZONE_GUIDE.md`

## API Prefix: All Paths Must Include `/api/v1/`

```typescript
// WRONG
api.get('/dashboard/superadmin/campaigns')

// CORRECT
api.get('/api/v1/dashboard/superadmin/campaigns')
```

`VITE_API_URL` does NOT include `/api/v1/`.

## API Client Behavior (src/api.ts)

The axios client has built-in behavior you must not duplicate:

- **Auth**: Uses `withCredentials: true` (HTTP-only cookies) — never add token headers manually
- **401 handling**: Auto-redirects to `/login` on 401 — don't add your own redirect logic
- **Network retry**: Retries once after 1s on network errors — don't add retry wrappers
- **Offline detection**: Tracks `isOnline` + `isServerReachable` → `OfflineBanner` component. Use `getConnectionStatus()` / `subscribeToConnection()` if you need connection state

## White-Label Navigation: Use `fullBasePath`

```typescript
// WRONG — breaks white-label mode
navigate(`/venues/${slug}/settings`)

// CORRECT — works in /venues/ and /wl/ modes
const { fullBasePath } = useCurrentVenue()
navigate(`${fullBasePath}/settings`)
```

ESLint rule `no-hardcoded-venue-paths.js` catches violations.

## Performance: Memoize DataTable Arrays

```typescript
// WRONG — new reference every render → infinite re-renders
<DataTable data={someFunction(data)} />

// CORRECT
const filtered = useMemo(() => someFunction(data), [data])
<DataTable data={filtered} />
```

- `useMemo` for filtered/mapped/sorted arrays and column definitions
- `useCallback` for search handlers
- `useDebounce(searchTerm, 300)` for search inputs triggering API calls

## Superadmin Lazy Loading

```typescript
// WRONG — loads for ALL users
import { getAllFeatures } from '@/services/superadmin.service'

// CORRECT — only loads for superadmin
const { data } = useQuery({
  queryKey: ['superadmin', 'features'],
  queryFn: async () => {
    const svc = await import('@/services/superadmin.service')
    return svc.getAllFeatures()
  },
  enabled: isSuperadmin, // Key: only runs for superadmin
})
```

## Route Protection: Pick the Right Guard

Multiple route guards exist — use the correct one:

| Guard | When to Use | File |
|-------|-------------|------|
| `PermissionProtectedRoute` | Page requires a permission (`menu:read`, `tpv:create`) | `routes/PermissionProtectedRoute.tsx` |
| `KYCProtectedRoute` | Page requires venue KYC verification (payments, billing) | `routes/KYCProtectedRoute.tsx` |
| `FeatureProtectedRoute` | Page requires a venue feature/module to be active | `routes/FeatureProtectedRoute.tsx` |
| `ModuleProtectedRoute` | Page requires module + optional role + optional feature code | `routes/ModuleProtectedRoute.tsx` |
| `AdminProtectedRoute` | Page requires ADMIN role or higher | `routes/AdminProtectedRoute.tsx` |
| `SuperProtectedRoute` | Page requires OWNER role or higher | `routes/SuperProtectedRoute.tsx` |

- `ProtectedRoute` wraps all authenticated routes (handles login redirect, email verification, venue assignment)
- SUPERADMIN bypasses all guards
- Demo venues bypass KYC checks
- See: `docs/architecture/routing.md`

## Control Plane vs Application Plane

| Question | Answer | Where to Build |
|----------|--------|---------------|
| Affects ALL venues / platform-wide? | Yes | `/superadmin/` page |
| Affects ONE specific venue? | Yes | Inline panel in `/venues/:slug/` with amber-pink gradient |

```typescript
// GLOBAL action → /superadmin/features
// "Create new feature Chatbot with base price $50/month"

// VENUE-SPECIFIC action → inline in /venues/:slug/settings
{isSuperadmin && (
  <Card className="bg-gradient-to-r from-amber-400 to-pink-500">
    <Button>Activar Chatbot para ESTE venue</Button>
  </Card>
)}
```

Never put venue-specific superadmin actions in `/superadmin/` — it forces context switching.
