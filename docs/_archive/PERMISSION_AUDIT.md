# Permission Audit Report - Frontend vs Backend
**Generated**: October 14, 2025
**Issue**: Frontend routes allow access to pages that backend blocks with 403 errors

## Critical Mismatches Found

### 1. ❌ TPV Management (`/venues/:slug/tpv`)
**Backend Permission** (`dashboard.routes.ts:1297`):
- ✅ SUPERADMIN
- ✅ OWNER
- ✅ ADMIN
- ✅ MANAGER
- ❌ WAITER (blocked)
- ❌ CASHIER (blocked)
- ❌ KITCHEN (blocked)
- ❌ HOST (blocked)
- ❌ VIEWER (blocked)

**Frontend Route** (`router.tsx:384-386`):
```typescript
{ path: 'tpv', element: <Tpv /> },  // NO PROTECTION!
```
- Currently accessible to ALL authenticated users

**Frontend Sidebar** (`app-sidebar.tsx:46`):
- Currently visible to ALL users

**Impact**: WAITER, CASHIER, KITCHEN, HOST, VIEWER see menu item → click → 403 error

**Fix Required**:
- Add `AdminProtectedRoute` with `AdminAccessLevel.MANAGER`
- Hide from sidebar for roles below MANAGER

---

### 2. ❌ Analytics (`/analytics`, `/venues/:slug/analytics`)
**Backend Permission** (`analytics.routes.ts:57`):
- ✅ SUPERADMIN
- ✅ OWNER
- ✅ ADMIN
- ✅ MANAGER
- ✅ VIEWER
- ❌ WAITER (blocked)
- ❌ CASHIER (blocked)
- ❌ KITCHEN (blocked)
- ❌ HOST (blocked)

**Frontend Route** (`router.tsx:120, 370`):
```typescript
{ path: '/analytics', element: <AnalyticsLayout /> },  // Only ProtectedRoute
{ path: 'analytics', element: <AnalyticsLayout /> },   // Only ProtectedRoute
```
- Currently accessible to ALL authenticated users

**Frontend Sidebar** (`app-sidebar.tsx:37`):
- Currently visible to ALL users

**Impact**: WAITER, CASHIER, KITCHEN, HOST see menu item → click → 403 error

**Fix Required**:
- Create custom route protection for MANAGER+ and VIEWER
- Hide from sidebar for WAITER, CASHIER, KITCHEN, HOST

---

### 3. ✅ Inventory (`/venues/:slug/inventory/*`)
**Backend Permission** (`dashboard.routes.ts:398`):
- ✅ SUPERADMIN
- ✅ OWNER
- ✅ ADMIN
- ❌ MANAGER (blocked)
- ❌ All others (blocked)

**Frontend Route** (`router.tsx:398`):
```typescript
element: <AdminProtectedRoute requiredRole={AdminAccessLevel.ADMIN} />  // ✅ CORRECT
```

**Frontend Sidebar** (`app-sidebar.tsx:40`):
```typescript
...((['ADMIN', 'OWNER', 'SUPERADMIN'] as const).includes(user.role) ? [...] : [])  // ✅ CORRECT
```

**Status**: ✅ FIXED (aligned properly)

---

## Complete Permission Matrix

| Feature | Backend Roles | Frontend Route Protection | Sidebar Visibility | Status |
|---------|---------------|---------------------------|-------------------|--------|
| **Home** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **Analytics** | MANAGER+, VIEWER | ⚠️ ProtectedRoute only | ⚠️ All users | ❌ MISMATCH |
| **Menu** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **Inventory** | ADMIN+ | ✅ AdminProtectedRoute(ADMIN) | ✅ ADMIN+ only | ✅ FIXED |
| **Payments** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **Orders** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **Shifts** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **TPV Management** | MANAGER+ | ⚠️ No protection | ⚠️ All users | ❌ MISMATCH |
| **Reviews** | All authenticated | ProtectedRoute | All users | ✅ OK |
| **Edit Venue** | ADMIN+ | ✅ AdminProtectedRoute(ADMIN) | Settings submenu | ✅ OK |
| **Teams** | All authenticated | ProtectedRoute | All users | ✅ OK |

---

## Role Hierarchy Reference

1. **VIEWER** - Read-only access, analytics viewing
2. **HOST** - Customer-facing operations
3. **KITCHEN** - Kitchen operations
4. **WAITER** - Order management
5. **CASHIER** - Payment processing
6. **MANAGER** - Staff, shifts, TPV management
7. **ADMIN** - Venue configuration, inventory
8. **OWNER** - Full venue access
9. **SUPERADMIN** - System-wide access

---

## Recommended Fixes

### Fix 1: TPV Management Routes
```typescript
// router.tsx - Add protection for TPV routes
{
  path: 'tpv',
  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.MANAGER} />,
  children: [
    { index: true, element: <Tpv /> },
    { path: 'create', element: <CreateTpv /> },
    { path: ':tpvId', element: <TpvId /> },
  ],
},
```

### Fix 2: Analytics Routes
```typescript
// Create new protection level in AdminProtectedRoute.tsx
export enum AdminAccessLevel {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',  // New level
  OWNER = 'OWNER',
  SUPERADMIN = 'SUPERADMIN',
}

// Add MANAGER check in AdminProtectedRoute
const isManager = user.role === StaffRole.MANAGER || isAdmin || user.role === StaffRole.VIEWER

// Apply to analytics routes
{
  path: '/analytics',
  element: <AdminProtectedRoute requiredRole={AdminAccessLevel.MANAGER} />,
  children: [
    { element: <AnalyticsLayout />, children: [...] },
  ],
},
```

### Fix 3: Sidebar Visibility
```typescript
// app-sidebar.tsx - Update TPV and Analytics visibility
{ title: t('sidebar:analytics'), isActive: true, url: 'analytics', icon: TrendingUp },
// Conditionally show only for MANAGER+, VIEWER
...((['MANAGER', 'ADMIN', 'OWNER', 'SUPERADMIN', 'VIEWER'] as const).includes(user.role)
  ? [{ title: t('sidebar:analytics'), isActive: true, url: 'analytics', icon: TrendingUp }]
  : []),

// TPV - show only for MANAGER+
...((['MANAGER', 'ADMIN', 'OWNER', 'SUPERADMIN'] as const).includes(user.role)
  ? [{ title: t('routes.tpv'), isActive: true, url: 'tpv', icon: Smartphone }]
  : []),
```

---

## Testing Checklist

After applying fixes, test with each role:

- [ ] **VIEWER**: Can access Analytics ✅, Cannot access TPV ❌
- [ ] **HOST**: Cannot access Analytics ❌, Cannot access TPV ❌
- [ ] **KITCHEN**: Cannot access Analytics ❌, Cannot access TPV ❌
- [ ] **WAITER**: Cannot access Analytics ❌, Cannot access TPV ❌
- [ ] **CASHIER**: Cannot access Analytics ❌, Cannot access TPV ❌
- [ ] **MANAGER**: Can access Analytics ✅, Can access TPV ✅
- [ ] **ADMIN**: Can access Analytics ✅, Can access TPV ✅, Can access Inventory ✅
- [ ] **OWNER**: Full access ✅
- [ ] **SUPERADMIN**: Full access ✅

---

## Impact Assessment

**High Priority - Immediate Fix Required:**
- **Security**: Frontend allows access to protected resources (bad)
- **UX**: Users see menu items they can't use (confusing, unprofessional)
- **Support**: Increases user confusion and support requests

**Affected Users:**
- WAITER: Cannot use Analytics, TPV (shows 403 errors)
- CASHIER: Cannot use Analytics, TPV (shows 403 errors)
- KITCHEN: Cannot use Analytics, TPV (shows 403 errors)
- HOST: Cannot use Analytics, TPV (shows 403 errors)

**Estimated Fix Time**: 30 minutes
**Testing Time**: 15 minutes per role (9 roles = 2.25 hours)

---

## Files to Modify

1. `src/routes/AdminProtectedRoute.tsx` - Add MANAGER access level
2. `src/routes/router.tsx` - Add route protection for TPV and Analytics
3. `src/components/Sidebar/app-sidebar.tsx` - Update visibility logic
4. `src/routes/lazyComponents.ts` - No changes needed
5. `src/types.ts` - No changes needed (roles already defined)

---

## Related Documentation

- Backend permissions: `avoqado-server/src/routes/dashboard.routes.ts`
- Backend analytics: `avoqado-server/src/routes/analytics.routes.ts`
- Frontend routes: `avoqado-web-dashboard/src/routes/router.tsx`
- Route protection: `avoqado-web-dashboard/src/routes/AdminProtectedRoute.tsx`
