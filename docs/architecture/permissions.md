# Permission System

Complete guide to the granular permission system that controls what users can SEE and DO within the Avoqado Web Dashboard.

## Overview

The dashboard implements a **granular permission system** that works alongside route protection to control UI elements within pages. This is **Layer 3** of the security model:

- **Layer 1**: Route authentication (`ProtectedRoute`)
- **Layer 2**: Route permissions (`PermissionProtectedRoute`)
- **Layer 3**: Component permissions (`usePermissions` + `PermissionGate`) ← THIS GUIDE

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

- **`src/lib/permissions/defaultPermissions.ts`**
  Default permissions by role (VIEWER, WAITER, MANAGER, etc.)

- **`src/hooks/usePermissions.ts`**
  React hook for permission checks

- **`src/components/PermissionGate.tsx`**
  Component for conditional rendering based on permissions

- **`src/types.ts`**
  Type definitions - `SessionVenue.permissions?: string[]`

### Data Model

```typescript
interface SessionVenue {
  id: string
  name: string
  slug: string
  role: StaffRole              // User's role in this venue
  permissions?: string[]       // Custom permission overrides
}

interface User {
  id: string
  email: string
  firstName: string
  lastName: string
  role: StaffRole              // Global role (SUPERADMIN only)
  venues: SessionVenue[]       // Venues user has access to
}
```

## usePermissions Hook

### Basic Usage

```typescript
import { usePermissions } from '@/hooks/usePermissions'

function TpvPage() {
  const { can } = usePermissions()

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
  can,           // (permission: string) => boolean
  canAny,        // (permissions: string[]) => boolean
  canAll,        // (permissions: string[]) => boolean
  cannot,        // (permission: string) => boolean
  permissions,   // string[] - All user permissions (resolved)
  role,          // StaffRole - User's role
} = usePermissions()
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
if (cannot('tpv:delete')) {
  // Show "Contact admin to delete" message
}
```

**Get all permissions:**
```typescript
console.log(permissions)
// ['home:read', 'menu:*', 'orders:create', 'tpv:read', ...]
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

**Location**: `src/hooks/usePermissions.ts` (lines 25-72)

```typescript
// 1. Get default permissions for role
const defaultPermissions = DEFAULT_PERMISSIONS[user.role]

// 2. SUPERADMIN exception (always wildcard)
if (user.role === 'SUPERADMIN') {
  return ['*:*']
}

// 3. Get custom permissions from database
const customPermissions = venueStaff?.permissions || []

// 4. Determine mode: MERGE or OVERRIDE
const hasWildcardDefaults = defaultPermissions.includes('*:*')
const hasCustomPermissions = customPermissions.length > 0

if (hasWildcardDefaults && hasCustomPermissions) {
  // OVERRIDE mode: custom permissions replace defaults
  basePermissions = customPermissions
} else {
  // MERGE mode: combine defaults + custom
  basePermissions = [...defaultPermissions, ...customPermissions]
}

// 5. Resolve implicit dependencies (e.g., orders:read implies products:read)
return resolvePermissions(basePermissions)
```

## Permission Flow

### Full Stack Check

```
1. User clicks "Create Terminal" button
   └─ Frontend: PermissionGate checks 'tpv:create'
       ├─ Has permission? → Show button
       └─ No permission? → Hide button

2. User submits create form
   └─ Frontend: API call to POST /api/v1/dashboard/venues/{venueId}/tpvs
       └─ Backend: checkPermission('tpv:create') middleware
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
- Enforce security
- Prevent API abuse
- Audit access attempts
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
  checkPermission('tpv:delete'),  // ← REQUIRED!
  tpvController.delete
)
// → 403 Forbidden
```

## Implementing Permission-Based Features

### Step-by-Step Guide

**Example: Adding "Reports" feature**

**1. Add permissions to defaults** (`src/lib/permissions/defaultPermissions.ts`):

```typescript
import { StaffRole } from '@/types'

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

**2. Use PermissionGate in component:**

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

**3. Add route protection** (`src/routes/router.tsx`):

```typescript
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

<Route element={<PermissionProtectedRoute permission="reports:read" />}>
  <Route path="reports" element={<ReportsPage />} />
  <Route path="reports/:id" element={<ReportDetails />} />
</Route>
```

**4. Add backend protection:**

See backend CLAUDE.md for implementation:
```typescript
router.post('/venues/:venueId/reports',
  authenticateTokenMiddleware,
  checkPermission('reports:create'),  // ← Backend validation
  reportController.create
)

router.get('/venues/:venueId/reports/:id/export',
  authenticateTokenMiddleware,
  checkPermission('reports:export'),
  reportController.export
)
```

**5. Keep in sync:** Ensure frontend `DEFAULT_PERMISSIONS` matches backend!

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

1. **Use PermissionGate for declarative UI**
   More readable than conditional rendering with `can()`

2. **Keep frontend/backend permissions synced**
   Same permissions in `defaultPermissions.ts` (frontend) and backend CLAUDE.md

3. **Test with different roles**
   Verify VIEWER can't see MANAGER buttons, WAITER can't access ADMIN pages

4. **Never skip backend validation**
   Frontend is UX, backend is security

5. **Document new permissions**
   Update this file and backend CLAUDE.md when adding permissions

6. **Prefer specific permissions over wildcards**
   Use `menu:create` not `menu:*` for granular control

7. **Use descriptive permission names**
   `analytics:export` is better than `analytics:download`

8. **Group related permissions**
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

## Related Documentation

- [Routing System](./routing.md) - Route-level permission protection
- [Architecture Overview](./overview.md) - Role hierarchy and data models
- [Development Guide](../guides/development.md) - Testing permissions
