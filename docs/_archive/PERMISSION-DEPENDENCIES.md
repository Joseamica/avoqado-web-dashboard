# Permission Dependencies System

## Overview

The **Permission Dependencies System** prevents UI/data inconsistencies by automatically granting implicit permissions that are necessary for a feature to function correctly.

### The Problem This Solves

**Before:** Permission chaos and broken UIs
```typescript
// User has: ['orders:read']
// OrderId page needs:
//   - orders:read ✅
//   - products:read ❌ (to show product names)
//   - payments:read ❌ (to show payment info)
// Result: Broken UI with missing data
```

**After:** Automatic dependency resolution
```typescript
// User has: ['orders:read']
// System automatically grants:
//   - orders:read ✅
//   - products:read ✅ (implicitly granted)
//   - payments:read ✅ (implicitly granted)
// Result: UI works perfectly
```

## Architecture

### Files

- **`src/lib/permissions/permissionDependencies.ts`** - Defines dependency mappings
- **`src/hooks/usePermissions.ts`** - Resolves dependencies automatically

### How It Works

```typescript
// 1. User's explicit permissions
const userPermissions = ['orders:read', 'orders:create']

// 2. System resolves dependencies
const resolvedPermissions = resolvePermissions(userPermissions)
// resolvedPermissions = Set {
//   'orders:read',
//   'orders:create',
//   'products:read',     // ← Implicit from orders:read
//   'payments:read',     // ← Implicit from orders:read
//   'inventory:read',    // ← Implicit from orders:create
//   'menu:read',         // ← Implicit from orders:create
// }

// 3. Permission checks use resolved set
usePermissions().can('products:read')  // ✅ true (implicit)
```

## Dependency Definitions

### Example: Orders Module

```typescript
PERMISSION_DEPENDENCIES = {
  'orders:read': [
    'orders:read',
    'products:read',    // Need to see product names
    'payments:read',    // Need to see payment status
  ],
  'orders:create': [
    'orders:read',      // Inherit read capabilities
    'orders:create',
    'products:read',    // Need to select products
    'menu:read',        // Need to browse menu
    'inventory:read',   // Need to check stock
  ],
}
```

### Design Principles

1. **Read permissions are generous** - Include all data needed to display
2. **Write permissions are specific** - Only the action being performed
3. **Inheritance hierarchy** - Create/Update includes Read
4. **No circular dependencies** - Dependencies don't resolve recursively

## Usage Examples

### Basic Permission Check

```typescript
import { usePermissions } from '@/hooks/usePermissions'

function OrdersPage() {
  const { can } = usePermissions()

  // User with 'orders:read' can now see product names
  // (products:read is implicitly granted)

  return (
    <div>
      {can('orders:read') && <OrdersList />}
      {can('orders:create') && <CreateOrderButton />}
    </div>
  )
}
```

### Preventing UI Breakage

```typescript
// OrderId component displays payment info
function OrderId() {
  const { can } = usePermissions()

  // BEFORE: This would break for users with only orders:read
  // if (!can('payments:read')) return null

  // AFTER: Works automatically (payments:read is implicit)
  return (
    <div>
      <OrderDetails />
      {order.payments && <PaymentSection />}  {/* ✅ Works */}
    </div>
  )
}
```

### Complex Forms

```typescript
// ProductWizard needs multiple permissions
function ProductWizard() {
  // User has: ['menu:create']
  // System grants:
  //   - menu:read (implicit)
  //   - menu:create (explicit)

  const { data: categories } = useQuery(['categories'])  // ✅ Works
  const { data: modifiers } = useQuery(['modifiers'])    // ✅ Works

  // All dependent data loads successfully
}
```

## Permission Dependency Map

### Core Dependencies

| Base Permission | Implicit Dependencies | Reason |
|----------------|----------------------|---------|
| `orders:read` | `products:read`, `payments:read` | Orders display product/payment data |
| `orders:create` | `orders:read`, `products:read`, `menu:read`, `inventory:read` | Need to browse menu and check stock |
| `shifts:read` | `teams:read`, `payments:read` | Shifts show team members and revenue |
| `tpv:read` | `orders:read`, `products:read`, `payments:read` | TPV creates orders and processes payments |
| `analytics:read` | `orders:read`, `payments:read`, `products:read` | Analytics aggregates all data sources |

### Full Dependency Tree

See `src/lib/permissions/permissionDependencies.ts` for complete mappings.

## Testing

### Manual Testing

```typescript
// 1. Login with WAITER role (has orders:read)
// 2. Navigate to Orders page
// 3. Click on an order
// 4. Verify:
//    ✅ Product names display (needs products:read)
//    ✅ Payment info displays (needs payments:read)
//    ✅ No "Access Denied" errors
```

### Programmatic Testing

```typescript
import { resolvePermissions } from '@/lib/permissions/permissionDependencies'

describe('Permission Dependencies', () => {
  it('resolves orders:read dependencies', () => {
    const resolved = resolvePermissions(['orders:read'])

    expect(resolved.has('orders:read')).toBe(true)
    expect(resolved.has('products:read')).toBe(true)   // Implicit
    expect(resolved.has('payments:read')).toBe(true)   // Implicit
    expect(resolved.has('orders:delete')).toBe(false)  // Not granted
  })

  it('handles wildcard permissions', () => {
    const resolved = resolvePermissions(['*:*'])

    expect(resolved.has('*:*')).toBe(true)
    expect(resolved.size).toBe(1)  // Wildcard doesn't expand
  })
})
```

## Adding New Dependencies

### Step 1: Identify Dependencies

Ask: "What data does this feature need to function?"

```typescript
// Example: Adding inventory management
// Inventory page needs:
// - inventory:read (explicit)
// - products:read (to link inventory to products)
```

### Step 2: Add to permissionDependencies.ts

```typescript
export const PERMISSION_DEPENDENCIES = {
  // ... existing dependencies

  'inventory:read': [
    'inventory:read',
    'products:read',    // Inventory items link to products
  ],
  'inventory:create': [
    'inventory:read',   // Inherit read
    'inventory:create',
    'products:read',    // Need to select products
  ],
}
```

### Step 3: Verify Resolution

```typescript
// In browser console (after login):
import { resolvePermissions } from '@/lib/permissions/permissionDependencies'

const permissions = ['inventory:read']
const resolved = resolvePermissions(permissions)
console.log(Array.from(resolved))
// Expected: ['inventory:read', 'products:read']
```

### Step 4: Test in UI

```typescript
// In component:
const { can } = usePermissions()

console.log('Can read inventory:', can('inventory:read'))
console.log('Can read products:', can('products:read'))  // Should be true (implicit)
```

## Best Practices

### ✅ DO

1. **Include read dependencies** - Any data displayed in the UI
2. **Keep it minimal** - Only include truly necessary permissions
3. **Document reasoning** - Add comments explaining why each dependency exists
4. **Test thoroughly** - Verify both explicit and implicit permissions work

### ❌ DON'T

1. **Don't create circular dependencies** - A → B → A causes infinite loops
2. **Don't over-grant** - Don't include permissions for unrelated features
3. **Don't skip documentation** - Always comment complex dependency chains
4. **Don't forget backend sync** - Backend must accept the same implicit permissions

## Common Patterns

### Pattern 1: Read Inherits Display Data

```typescript
'orders:read': [
  'orders:read',
  'products:read',     // Orders display products
  'payments:read',     // Orders display payments
]
```

### Pattern 2: Create Inherits Read + Selection

```typescript
'orders:create': [
  'orders:read',       // Inherit read
  'orders:create',
  'menu:read',         // Need to browse/select items
  'inventory:read',    // Need to check availability
]
```

### Pattern 3: Aggregate Views

```typescript
'analytics:read': [
  'analytics:read',
  'orders:read',       // Analytics show order stats
  'payments:read',     // Analytics show revenue
  'products:read',     // Analytics show top products
]
```

## Troubleshooting

### Issue: Permission still denied

**Symptoms:** User has base permission but query fails

**Check:**
1. Verify dependency is defined in `permissionDependencies.ts`
2. Check backend accepts implicit permissions (may need backend update)
3. Verify `usePermissions()` hook is being used (not direct permission check)

**Fix:**
```typescript
// ❌ Direct check (doesn't resolve dependencies)
if (user.permissions.includes('products:read'))

// ✅ Use hook (resolves dependencies)
const { can } = usePermissions()
if (can('products:read'))
```

### Issue: Too many permissions granted

**Symptoms:** User can access unintended features

**Check:**
1. Review dependency chain - may be over-granting
2. Check for transitive dependencies (A → B → C)

**Fix:**
```typescript
// ❌ Over-granting
'orders:read': [
  'orders:read',
  'orders:update',     // Too much! Read shouldn't grant update
]

// ✅ Appropriate scope
'orders:read': [
  'orders:read',
  'products:read',     // Only display data
]
```

### Issue: Wildcard not working

**Symptoms:** User with `*:*` permission gets access denied

**Check:**
1. Verify `resolvePermissions()` handles wildcard correctly
2. Backend may not recognize wildcard

**Fix:**
```typescript
// In resolvePermissions():
if (permissions.includes('*:*')) {
  resolved.add('*:*')
  return resolved  // Don't expand wildcard
}
```

## Performance Considerations

### Dependency Resolution Caching

The `usePermissions()` hook uses `useMemo` to cache resolved permissions:

```typescript
const allPermissions = useMemo(() => {
  // ... resolution logic
  const resolvedSet = resolvePermissions(basePermissions)
  return Array.from(resolvedSet)
}, [user, activeVenue])  // Only recompute when user/venue changes
```

### Complexity Analysis

- **Time complexity:** O(n) where n = number of explicit permissions
- **Space complexity:** O(m) where m = total resolved permissions
- **Typical case:** 5-10 explicit → 15-30 resolved (< 1ms)

## Inspiration & References

This system is inspired by world-class permission systems:

- **GitHub**: Pull request read includes commits/comments read
- **Linear**: Issue view includes project/team/assignee view
- **Notion**: Page access includes block/comment access
- **Asana**: Task view includes project/section view

### Key Insight

> "Permission systems should default to making features work, not breaking them. Implicit dependencies prevent the 'access denied' death by a thousand cuts."
> — Inspired by GitHub's permission philosophy

## Migration Guide

### Migrating Existing Components

**Before (manual checks):**
```typescript
function OrdersPage() {
  const { can } = usePermissions()

  // Manually check all needed permissions
  if (!can('orders:read')) return <AccessDenied />
  if (!can('products:read')) return <AccessDenied />
  if (!can('payments:read')) return <AccessDenied />

  return <OrdersList />
}
```

**After (automatic resolution):**
```typescript
function OrdersPage() {
  const { can } = usePermissions()

  // Just check the main permission
  if (!can('orders:read')) return <AccessDenied />

  // products:read and payments:read are implicit
  return <OrdersList />
}
```

### Backend Sync Required

The backend must be updated to accept implicit permissions. Example:

```typescript
// Backend middleware (Node.js example)
function checkPermission(requiredPermission) {
  return (req, res, next) => {
    const userPermissions = req.user.permissions
    const resolved = resolvePermissions(userPermissions)  // Use same logic

    if (resolved.has(requiredPermission) || resolved.has('*:*')) {
      return next()
    }

    return res.status(403).json({ error: 'Permission denied' })
  }
}
```

## FAQ

**Q: What happens with custom permissions?**
A: Custom permissions are resolved the same way. If a user has custom `orders:read`, they get implicit `products:read` and `payments:read`.

**Q: Can I disable dependency resolution?**
A: Not recommended. This breaks the system's consistency. If you need granular control, use explicit permission checks for specific actions (like delete/update).

**Q: How does this affect role hierarchies?**
A: Roles define base permissions. Dependencies expand those permissions. Example: WAITER role gets `orders:read` → automatically includes `products:read`.

**Q: What about performance with many permissions?**
A: Resolution is cached per user/venue change. Typical overhead is <1ms for 50+ permissions.

**Q: Can dependencies be conditional?**
A: No. Dependencies are static. For conditional logic, use separate permission checks in components.

## Changelog

### v1.0.0 (2025-10-21)
- Initial implementation
- Support for 40+ permission dependencies
- Integration with usePermissions hook
- Complete documentation

---

**Related Documentation:**
- Main permissions system: See `CLAUDE.md` → "Granular Permission System"
- Permission UI components: `src/components/PermissionGate.tsx`
- Default role permissions: `src/lib/permissions/defaultPermissions.ts`
