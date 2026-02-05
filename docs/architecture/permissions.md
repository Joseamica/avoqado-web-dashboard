# Permission System

Complete guide to the granular permission system that controls what users can SEE and DO within the Avoqado Web Dashboard.

## Overview

The dashboard implements a **centralized permission system** where the **backend is the SINGLE SOURCE OF TRUTH**. The frontend fetches resolved permissions from the backend and uses them for UI control only.

**Security model layers:**

- **Layer 1**: Route authentication (`ProtectedRoute`)
- **Layer 2**: Route permissions (`PermissionProtectedRoute`)
- **Layer 3**: Component permissions (`useAccess` + `PermissionGate`) ← THIS GUIDE

**Architecture:**
```
Backend (Single Source of Truth)
├── /api/v1/me/access → Returns resolved permissions
├── PERMISSION_TO_FEATURE_MAP → Maps permissions to white-label features
├── access.service.ts → Filters permissions based on white-label config
└── verifyAccess middleware → Enforces on API routes

Frontend (UI Only - No mapping logic)
├── useAccess() → Fetches from /me/access
├── can('permission') → Just checks, no mapping needed
└── PermissionGate → UI visibility only (NOT security)
```

## Permission Format

Permissions follow the `"resource:action"` pattern:

```typescript
"tpv:create"          // Create TPV terminals
"menu:update"         // Update menu items
"analytics:export"    // Export analytics data
"orders:*"            // All order actions
"*:read"              // Read all resources
"*:*"                 // All actions on all resources
```

**Structure:**
- **Resource**: The entity (tpv, menu, orders, analytics, etc.)
- **Action**: The operation (create, read, update, delete, export, etc.)
- **Wildcard**: `*` matches any resource or action

## Key Components

### Files

- **`src/hooks/use-access.ts`**
  Unified React hook for permission checks (replaces usePermissions)

- **`src/services/access.service.ts`**
  API client that fetches from `/me/access` endpoint

- **`src/components/PermissionGate.tsx`**
  Component for conditional rendering based on permissions

- **`src/lib/permissions/defaultPermissions.ts`**
  Legacy defaults (backend is now source of truth)

- **`src/types.ts`**
  Type definitions - `SessionVenue.permissions?: string[]`

### Data Model

```typescript
// Response from /api/v1/me/access
interface UserAccess {
  userId: string
  venueId: string
  organizationId: string
  role: StaffRole
  corePermissions: string[]      // Resolved permissions (already filtered for white-label)
  whiteLabelEnabled: boolean
  enabledFeatures: string[]
  featureAccess: Record<string, FeatureAccessResult>
}
```

## useAccess Hook

### Basic Usage

```typescript
import { useAccess } from '@/hooks/use-access'

function TpvPage() {
  const { can } = useAccess()

  return (
    <>
      {/* All users see the list */}
      <TpvList />

      {/* Only users with create permission see this button */}
      {can('tpv:create') && (
        <Button>Create Terminal</Button>
      )}

      {/* Disable edit if no permission */}
      <Button disabled={!can('tpv:update')}>
        Edit
      </Button>
    </>
  )
}
```

### Complete API

```typescript
const {
  can,              // (permission: string) => boolean
  canAny,           // (permissions: string[]) => boolean
  canAll,           // (permissions: string[]) => boolean
  canFeature,       // (featureCode: string) => boolean (white-label features)
  getDataScope,     // (featureCode: string) => 'venue' | 'user-venues' | 'organization'
  role,             // StaffRole - User's role
  isWhiteLabelEnabled,  // boolean
  enabledFeatures,  // string[] - List of enabled feature codes
  isLoading,        // boolean - Loading state
  error,            // Error | null
  refresh,          // () => void - Manually refresh permissions
} = useAccess()
```

### Examples

**Single permission check:**
```typescript
if (can('tpv:create')) {
  // Show create button
}
```

**Multiple permissions (OR - requires at least one):**
```typescript
if (canAny(['menu:create', 'menu:update'])) {
  // Show edit menu button
}
```

**Multiple permissions (AND - requires all):**
```typescript
if (canAll(['admin:write', 'admin:delete'])) {
  // Show dangerous action
}
```

**Negative check:**
```typescript
if (!can('tpv:delete')) {
  // Show "Contact admin to delete" message
}
```

**White-label feature check:**
```typescript
// Check if user can access a white-label feature
if (canFeature('STORES_ANALYSIS')) {
  // Show stores analysis button
}

// Get data scope for a feature
const scope = getDataScope('COMMAND_CENTER')
// → 'venue' | 'user-venues' | 'organization'
```

## PermissionGate Component

### Basic Usage

**Declarative UI control** (preferred method over `usePermissions`):

```typescript
import { PermissionGate } from '@/components/PermissionGate'

function TpvPage() {
  return (
    <>
      {/* Single permission */}
      <PermissionGate permission="tpv:create">
        <Button>Create Terminal</Button>
      </PermissionGate>

      {/* Multiple permissions (any) */}
      <PermissionGate permissions={['menu:create', 'menu:update']}>
        <EditButton />
      </PermissionGate>

      {/* Multiple permissions (all) */}
      <PermissionGate permissions={['admin:write', 'admin:delete']} requireAll={true}>
        <DangerousButton />
      </PermissionGate>

      {/* With fallback content */}
      <PermissionGate
        permission="analytics:export"
        fallback={<p>Upgrade to export data</p>}
      >
        <ExportButton />
      </PermissionGate>
    </>
  )
}
```

### Props

```typescript
interface PermissionGateProps {
  permission?: string               // Single permission to check
  permissions?: string[]            // Multiple permissions to check
  requireAll?: boolean              // If true, requires ALL permissions (default: false = ANY)
  fallback?: React.ReactNode        // Content to show when no permission
  children: React.ReactNode         // Content to show when has permission
}
```

### Examples

**Hide entire section:**
```typescript
<PermissionGate permission="inventory:read">
  <InventorySection />
</PermissionGate>
```

**Show/hide action buttons:**
```typescript
<PermissionGate permission="tpv:update">
  <Button onClick={edit}>Edit</Button>
</PermissionGate>

<PermissionGate permission="tpv:delete">
  <Button onClick={del}>Delete</Button>
</PermissionGate>
```

**Fallback for upgrade prompts:**
```typescript
<PermissionGate
  permission="analytics:export"
  fallback={
    <div className="p-4 bg-muted rounded-lg">
      <p>Upgrade to Business plan to export analytics</p>
      <Button>Upgrade Now</Button>
    </div>
  }
>
  <Button onClick={exportData}>Export CSV</Button>
</PermissionGate>
```

## Wildcard Permissions

### Full Access

```typescript
"*:*"  // All permissions (ADMIN, OWNER, SUPERADMIN have this)
```

Users with `*:*` permission can perform any action on any resource.

### Resource Wildcards

```typescript
"tpv:*"        // All TPV actions (create, read, update, delete, command)
"menu:*"       // All menu actions
"orders:*"     // All order actions
```

### Action Wildcards

```typescript
"*:read"       // Read access to all resources
"*:create"     // Create access to all resources
"*:delete"     // Delete access to all resources
```

### Wildcard Resolution

The `can()` function checks wildcards automatically:

```typescript
// User has permission "tpv:*"

can('tpv:create')  // ✅ true (matches tpv:*)
can('tpv:update')  // ✅ true (matches tpv:*)
can('tpv:delete')  // ✅ true (matches tpv:*)
can('menu:create') // ❌ false (no match)
```

## Default Permissions by Role

**Location**: `src/lib/permissions/defaultPermissions.ts`

### VIEWER (Read-only)

```typescript
[
  'home:read',
  'analytics:read',
  'menu:read',
  'orders:read',
  'payments:read',
  'shifts:read',
  'tpv:read',
]
```

**Use Case**: Report viewers, external auditors, read-only dashboards

### HOST (Customer-facing)

```typescript
[
  'home:read',
  'tables:read',
  'tables:update',  // Update table status (available/occupied)
  'orders:read',
]
```

**Use Case**: Front-of-house staff, greeters, table management

### WAITER (Order management)

```typescript
[
  'menu:read',
  'menu:create',
  'menu:update',
  'orders:*',           // All order actions
  'payments:read',
  'payments:create',
  'tables:*',           // All table actions
  'tpv:read',
]
```

**Use Case**: Waiters, servers taking orders

### CASHIER (Payment processing)

```typescript
[
  'home:read',
  'orders:read',
  'orders:update',      // Update order status
  'payments:*',         // All payment actions
  'shifts:read',
]
```

**Use Case**: Cashiers, payment processors

### KITCHEN (Kitchen operations)

```typescript
[
  'home:read',
  'orders:read',
  'orders:update',      // Mark orders as ready
  'menu:read',
]
```

**Use Case**: Kitchen staff, cooks

### MANAGER (Operations management)

```typescript
[
  'analytics:read',
  'analytics:export',
  'home:read',
  'menu:*',             // All menu actions
  'orders:*',           // All order actions
  'payments:read',
  'payments:refund',
  'shifts:*',           // All shift actions
  'team:read',
  'tpv:read',
  'tpv:create',
  'tpv:update',
  'tpv:command',        // Send commands to TPV
]
```

**Use Case**: Floor managers, shift supervisors

### ADMIN (Venue configuration)

```typescript
['*:*']  // Wildcard - all permissions
```

**Use Case**: IT administrators, system configurators

### OWNER (Full venue access)

```typescript
['*:*']  // Wildcard - all permissions
```

**Use Case**: Venue owners, business owners

### SUPERADMIN (System-wide access)

```typescript
['*:*']  // Wildcard - all permissions across ALL venues
```

**Use Case**: Platform administrators, support staff

## Custom Permissions

### Database Structure

Custom permissions are stored in the `StaffVenue` relationship:

```sql
CREATE TABLE staff_venues (
  staff_id UUID REFERENCES staff(id),
  venue_id UUID REFERENCES venues(id),
  role VARCHAR(50),
  permissions JSONB,  -- ["inventory:read", "analytics:export"]
  PRIMARY KEY (staff_id, venue_id)
);
```

### How It Works

**Scenario: WAITER with extra analytics access**

```typescript
// Default WAITER permissions:
[
  'menu:read',
  'orders:*',
  'payments:read',
  'tpv:read',
  // ...
]

// Database custom permissions:
{
  role: 'WAITER',
  permissions: ['analytics:read', 'analytics:export']
}

// Final resolved permissions (merged):
[
  'menu:read',
  'orders:*',
  'payments:read',
  'tpv:read',
  // + custom:
  'analytics:read',
  'analytics:export',
]
```

### Override Mode (Wildcard Roles)

For roles with wildcard defaults (ADMIN, OWNER, SUPERADMIN), custom permissions **override** defaults instead of merging:

```typescript
// OWNER default permissions:
['*:*']  // All permissions

// Database custom permissions:
{
  role: 'OWNER',
  permissions: ['menu:read', 'orders:read', 'analytics:read']
}

// Final permissions (OVERRIDE mode):
[
  'menu:read',      // Only these 3
  'orders:read',
  'analytics:read',
]
// ⚠️ OWNER now has LIMITED permissions!
```

**Use Case**: Restrict high-level role access (e.g., investor with OWNER role but read-only access)

### Permission Resolution Logic

**IMPORTANT: Backend is the single source of truth.**

The backend (`access.service.ts`) handles all permission resolution:

1. **Fetches user's role** in the target venue
2. **Gets custom permissions** from `VenueRolePermission` table
3. **Applies override/merge logic** (wildcard roles use override, others use merge)
4. **For white-label venues**: Filters permissions based on enabled features using `PERMISSION_TO_FEATURE_MAP`
5. **Returns resolved permissions** via `/me/access` endpoint

**Frontend just calls `can('permission')`** - no mapping or resolution logic needed.

```typescript
// Backend does all the work
// Example: User is MANAGER in a white-label venue with AVOQADO_TEAM feature disabled

// Backend resolution:
// 1. Default MANAGER permissions include 'teams:read', 'teams:write'
// 2. PERMISSION_TO_FEATURE_MAP maps 'teams:*' → 'AVOQADO_TEAM'
// 3. AVOQADO_TEAM is disabled → 'teams:read', 'teams:write' are filtered out
// 4. /me/access returns corePermissions WITHOUT team permissions

// Frontend:
const { can } = useAccess()
can('teams:read')  // false - backend already filtered it out
```

## Permission Flow

### Full Stack Check

```
1. Page load
   └─ Frontend: useAccess() fetches GET /me/access?venueId=xxx
       └─ Backend: access.service.ts resolves ALL permissions
           ├─ Gets role, custom permissions, white-label config
           ├─ Filters permissions for white-label if needed
           └─ Returns { corePermissions, featureAccess, ... }

2. User sees "Create Terminal" button
   └─ Frontend: PermissionGate checks can('tpv:create')
       ├─ Permission in corePermissions? → Show button
       └─ Not in corePermissions? → Hide button

3. User submits create form
   └─ Frontend: API call to POST /api/v1/dashboard/venues/{venueId}/tpvs
       └─ Backend: verifyAccess({ permission: 'tpv:create' }) middleware
           ├─ Has permission? → Process request
           └─ No permission? → 403 Forbidden error
```

**⚠️ CRITICAL**: Frontend permissions are for UX only! Backend ALWAYS validates.

### Why Both Frontend and Backend?

**Frontend Permissions:**
- Hide/disable UI elements users can't access
- Reduce clutter and confusion
- Prevent unnecessary API calls
- Improve user experience

**Backend Permissions:**
- **SINGLE SOURCE OF TRUTH**
- Enforce security
- Prevent API abuse
- Handle white-label feature mapping
- Protect against tampering

**Example: Direct API call bypass**

```typescript
// User doesn't have 'tpv:delete' permission

// Frontend correctly hides delete button:
<PermissionGate permission="tpv:delete">
  <Button>Delete</Button>  {/* Hidden */}
</PermissionGate>

// But malicious user can call API directly:
fetch('/api/v1/dashboard/venues/123/tpvs/456', { method: 'DELETE' })

// Backend blocks it:
router.delete('/venues/:id/tpvs/:tpvId',
  verifyAccess({ permission: 'tpv:delete' }),  // ← REQUIRED!
  tpvController.delete
)
// → 403 Forbidden
```

## Implementing Permission-Based Features

### Step-by-Step Guide

**Example: Adding "Reports" feature**

**1. Add permissions to backend** (`avoqado-server/src/lib/permissions.ts`):

```typescript
// Backend is the SINGLE SOURCE OF TRUTH
export const DEFAULT_PERMISSIONS: Record<StaffRole, string[]> = {
  [StaffRole.VIEWER]: [
    'home:read',
    'reports:read',  // ← Add read access
  ],
  [StaffRole.MANAGER]: [
    'analytics:read',
    'reports:read',
    'reports:create',  // ← Add create access
    'reports:export',  // ← Add export access
  ],
  [StaffRole.ADMIN]: ['*:*'],
  [StaffRole.OWNER]: ['*:*'],
  [StaffRole.SUPERADMIN]: ['*:*'],
}
```

**2. If this is a white-label feature**, add to `PERMISSION_TO_FEATURE_MAP` (`avoqado-server/src/services/access/access.service.ts`):

```typescript
const PERMISSION_TO_FEATURE_MAP: Record<string, string> = {
  // ... existing mappings
  'reports:read': 'AVOQADO_REPORTS',
  'reports:create': 'AVOQADO_REPORTS',
  'reports:export': 'AVOQADO_REPORTS',
}
```

**3. Add backend route protection:**

```typescript
import { verifyAccess } from '@/middlewares/verifyAccess.middleware'

router.post('/venues/:venueId/reports',
  authenticateTokenMiddleware,
  verifyAccess({ permission: 'reports:create' }),  // ← Backend validation
  reportController.create
)

router.get('/venues/:venueId/reports/:id/export',
  authenticateTokenMiddleware,
  verifyAccess({ permission: 'reports:export' }),
  reportController.export
)
```

**4. Use PermissionGate in frontend component:**

```typescript
// src/pages/Reports/Reports.tsx
import { PermissionGate } from '@/components/PermissionGate'

function ReportsPage() {
  return (
    <div>
      <h1>Reports</h1>

      <PermissionGate permission="reports:create">
        <Button onClick={createReport}>Create Report</Button>
      </PermissionGate>

      <ReportsList />

      <PermissionGate permission="reports:export">
        <Button onClick={exportReport}>Export CSV</Button>
      </PermissionGate>
    </div>
  )
}
```

**5. Add route protection** (`src/routes/router.tsx`):

```typescript
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

<Route element={<PermissionProtectedRoute permission="reports:read" />}>
  <Route path="reports" element={<ReportsPage />} />
  <Route path="reports/:id" element={<ReportDetails />} />
</Route>
```

**Note:** Frontend no longer needs to maintain its own `DEFAULT_PERMISSIONS` - backend handles all resolution.

## Common Patterns

### Conditional Rendering

**Hide entire section:**
```typescript
<PermissionGate permission="inventory:read">
  <InventorySection />
</PermissionGate>
```

**Show/hide action buttons:**
```typescript
<PermissionGate permission="tpv:update">
  <Button onClick={edit}>Edit</Button>
</PermissionGate>

<PermissionGate permission="tpv:delete">
  <Button onClick={del}>Delete</Button>
</PermissionGate>
```

**Multiple buttons with different permissions:**
```typescript
<div className="flex gap-2">
  <PermissionGate permission="menu:read">
    <Button variant="outline">View</Button>
  </PermissionGate>

  <PermissionGate permission="menu:update">
    <Button>Edit</Button>
  </PermissionGate>

  <PermissionGate permissions={['menu:delete', 'admin:delete']}>
    <Button variant="destructive">Delete</Button>
  </PermissionGate>
</div>
```

### Disable vs Hide

**Hide button (cleaner UI):**
```typescript
{can('tpv:create') && (
  <Button>Create Terminal</Button>
)}
```

**Disable button (show feature exists but locked):**
```typescript
import { Tooltip } from '@/components/ui/tooltip'

<Tooltip content={cannot('tpv:create') ? 'Manager access required' : ''}>
  <Button disabled={cannot('tpv:create')}>
    Create Terminal
  </Button>
</Tooltip>
```

### Complex Conditions

```typescript
const { can, canAny, canAll, role } = usePermissions()

const canModify = canAny(['menu:update', 'admin:write'])
const isOwner = role === 'OWNER'
const canDelete = canAll(['menu:delete', 'admin:delete'])

return (
  <>
    <PermissionGate permission="menu:update">
      {isOwner ? <OwnerEditForm /> : <BasicEditForm />}
    </PermissionGate>

    {canModify && (
      <div>
        <p>Modification tools</p>
        {canDelete && <DeleteButton />}
      </div>
    )}
  </>
)
```

## Best Practices

1. **Backend is the single source of truth**
   All permission definitions and resolution logic live in the backend.
   Frontend just calls `can('permission')` - no mapping needed.

2. **Use PermissionGate for declarative UI**
   More readable than conditional rendering with `can()`

3. **Always add backend protection first**
   Frontend is UX only, backend is security.
   Use `verifyAccess({ permission: '...' })` middleware.

4. **For white-label features, update PERMISSION_TO_FEATURE_MAP**
   In `avoqado-server/src/services/access/access.service.ts`

5. **Test with different roles**
   Verify VIEWER can't see MANAGER buttons, WAITER can't access ADMIN pages

6. **Test white-label scenarios**
   Verify permissions are filtered when features are disabled

7. **Prefer specific permissions over wildcards**
   Use `menu:create` not `menu:*` for granular control

8. **Use descriptive permission names**
   `analytics:export` is better than `analytics:download`

9. **Group related permissions**
   If you have `reports:create`, also define `reports:read`, `reports:update`, `reports:delete`

## Future: Admin Permission Management UI

The `SessionVenue.permissions` database field enables building an admin UI to assign custom permissions without code changes.

**Potential Features:**

**Checkbox Grid:**
```
Resource    | Create | Read | Update | Delete | Export
------------|--------|------|--------|--------|--------
Menu        |   ✓    |  ✓   |   ✓    |   ✗    |   ✗
Orders      |   ✗    |  ✓   |   ✓    |   ✗    |   ✗
Analytics   |   ✗    |  ✓   |   ✗    |   ✗    |   ✓
Inventory   |   ✗    |  ✓   |   ✗    |   ✗    |   ✗
```

**Visual Diff:**
```
WAITER default permissions:
  ✓ menu:read, menu:create, menu:update
  ✓ orders:*
  ✓ payments:read, payments:create

Custom overrides:
  + analytics:read       (added)
  + analytics:export     (added)
  - menu:create          (removed)
```

**Per-Staff Assignment:**
- Assign permissions to individual staff members
- Override role defaults for special cases
- Time-limited permissions (e.g., temporary manager access)

**Permission Templates/Presets:**
- "Basic Waiter" template
- "Senior Manager" template
- "Inventory Specialist" template

**Audit Log:**
- Track who changed what permissions
- When permissions were granted/revoked
- Compliance and security auditing

**Implementation Guide:**
See backend CLAUDE.md for API endpoint examples (`GET /staff/:id/permissions`, `PUT /staff/:id/permissions`)

## Common Issues

**Issue: Button not appearing**
- **Cause**: User doesn't have required permission
- **Debug**: Check `permissions` array in `usePermissions()`, verify role defaults
- **Fix**: Add permission to role in `defaultPermissions.ts`

**Issue: PermissionGate not updating after role change**
- **Cause**: AuthContext not refetching status
- **Debug**: Check `queryClient.invalidateQueries(['status'])`
- **Fix**: Ensure venue switching calls `queryClient.invalidateQueries`

**Issue: Frontend shows button but backend returns 403**
- **Cause**: Frontend/backend permission mismatch
- **Debug**: Compare `defaultPermissions.ts` (frontend) vs backend permissions file
- **Fix**: Sync permission lists

**Issue: OWNER role has limited permissions**
- **Cause**: Custom permissions in OVERRIDE mode
- **Debug**: Check `StaffVenue.permissions` in database
- **Fix**: Remove custom permissions or set to empty array to restore wildcard

## Centralized Permission Architecture

### Why Centralized?

Before centralization, there were two parallel permission systems:
- Core permissions (`resource:action`) with frontend resolution
- White-label features with separate `PERMISSION_TO_FEATURE_MAP` in frontend

This caused:
- Duplicate code and logic drift
- Frontend could show UI for features that backend would deny
- Complex white-label permission mapping in multiple places

### New Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│ BACKEND (Single Source of Truth)                                │
│                                                                  │
│ 1. access.service.ts:                                           │
│    - Resolves permissions from VenueRolePermission              │
│    - Contains PERMISSION_TO_FEATURE_MAP                         │
│    - Filters permissions for white-label venues                 │
│                                                                  │
│ 2. /api/v1/me/access endpoint:                                  │
│    - Returns already-resolved permissions                       │
│    - Frontend doesn't need to know about white-label            │
│                                                                  │
│ 3. verifyAccess middleware:                                     │
│    - Enforces permissions on API routes                         │
│    - Uses same access.service.ts                                │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│ FRONTEND (UI Only)                                              │
│                                                                  │
│ 1. useAccess() hook:                                            │
│    - Fetches from /me/access                                    │
│    - Caches with React Query (5 min staleTime)                  │
│    - Provides can(), canAny(), canAll()                         │
│                                                                  │
│ 2. PermissionGate component:                                    │
│    - Uses useAccess() internally                                │
│    - Just checks, no mapping logic                              │
│                                                                  │
│ 3. PermissionProtectedRoute:                                    │
│    - Uses useAccess() for route protection                      │
│    - Shows "Access Denied" or redirects                         │
└─────────────────────────────────────────────────────────────────┘
```

### Verification Script

Run `bash scripts/check-permission-migration.sh` in avoqado-server to verify centralization is complete.

## Related Documentation

- [Routing System](./routing.md) - Route-level permission protection
- [Architecture Overview](./overview.md) - Role hierarchy and data models
- [Backend Permission System](../../../avoqado-server/docs/PERMISSIONS_SYSTEM.md) - Backend implementation details
