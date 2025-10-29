# Routing System

Complete guide to route protection and navigation in the Avoqado Web Dashboard.

## Overview

The application uses **React Router v6** with **nested routes** and **multiple layers of protection** to ensure proper access control. Routes follow the `/venues/:slug` pattern for venue-specific pages.

## Route Protection Layers

### Layer 1: Authentication-Based Routes

**Purpose**: Verify user is logged in before accessing any protected content.

**Components:**

1. **`ProtectedRoute`** - Requires authentication (any logged-in user)
   ```typescript
   <Route element={<ProtectedRoute />}>
     <Route path="/venues/:slug/*" element={<VenueLayout />} />
   </Route>
   ```

2. **`AdminProtectedRoute`** - Requires admin-level access
   ```typescript
   <Route element={<AdminProtectedRoute />}>
     <Route path="/admin/*" element={<AdminDashboard />} />
   </Route>
   ```

3. **`SuperProtectedRoute`** - Requires OWNER role or higher
   ```typescript
   <Route element={<SuperProtectedRoute />}>
     <Route path="/superadmin/*" element={<SuperadminDashboard />} />
   </Route>
   ```

**How It Works:**
```
User navigates to /venues/downtown/menu
  └─ ProtectedRoute checks: user.isAuthenticated?
      ├─ Yes → Render <Outlet /> (continue to next layer)
      └─ No → Redirect to /login
```

### Layer 2: Permission-Based Route Protection

**Purpose**: Prevent URL bypass attacks by requiring specific permissions to access entire page groups.

**Component: `PermissionProtectedRoute`**

**Usage Examples:**

**Single Permission (read access):**
```typescript
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

// Protect entire menu section
<Route element={<PermissionProtectedRoute permission="menu:read" />}>
  <Route path="menu" element={<MenuOverview />} />
  <Route path="categories" element={<Categories />} />
  <Route path="products" element={<Products />} />
</Route>
```

**Multiple Permissions (requires ANY):**
```typescript
// User needs EITHER orders:read OR orders:update
<Route element={<PermissionProtectedRoute permissions={['orders:read', 'orders:update']} />}>
  <Route path="orders" element={<Orders />} />
  <Route path="orders/:id" element={<OrderDetails />} />
</Route>
```

**Multiple Permissions (requires ALL):**
```typescript
// User needs BOTH admin:write AND admin:delete
<Route element={<PermissionProtectedRoute permissions={['admin:write', 'admin:delete']} requireAll />}>
  <Route path="dangerous" element={<DangerousAction />} />
</Route>
```

**How It Works:**
```
User navigates to /venues/:slug/menu
  └─ PermissionProtectedRoute checks permission 'menu:read'
      ├─ Has permission? → Render <Outlet /> (MenuOverview page)
      └─ No permission? → Show AccessDeniedPage
          └─ Message: "You don't have permission to access this page"
```

**Key Features:**
- **Prevents URL bypass**: Users can't access pages by typing URLs directly
- **Reduces backend load**: Blocks requests before they reach the server
- **Better UX**: Shows clear "Access Denied" message instead of 404 or errors
- **Synced with backend**: Uses same permission logic as `checkPermission` middleware

**⚠️ CRITICAL**: Frontend route protection prevents UX issues, but **backend middleware validation is still required** for security!

### Layer 3: Component-Level Permission Gates

**Purpose**: Control what users can SEE and DO within a page (buttons, sections, actions).

This layer is covered in detail in [permissions.md](./permissions.md).

## Route Structure

### Venue-Scoped Routes

All venue-specific features follow this pattern:

```
/venues/:slug/
  ├── home           # Dashboard overview
  ├── menu/          # Menu management
  │   ├── categories
  │   ├── products
  │   └── modifiers
  ├── orders/        # Order management
  │   └── :orderId
  ├── payments/      # Payment history
  ├── inventory/     # Stock tracking
  │   ├── raw-materials
  │   ├── recipes
  │   └── pricing
  ├── team/          # Staff management
  ├── analytics/     # Reports
  └── settings/      # Venue configuration
```

### Admin Routes

Cross-venue administrative features:

```
/admin/
  ├── venues/        # Venue management (OWNER)
  ├── features/      # Feature flags (OWNER)
  └── billing/       # Subscription management (OWNER)
```

### Superadmin Routes

System-wide administration:

```
/superadmin/
  ├── dashboard      # Platform analytics
  ├── organizations/ # Manage organizations
  ├── venues/        # Manage all venues
  ├── users/         # Manage all users
  └── features/      # Global feature management
```

### Public Routes

No authentication required:

```
/
  ├── login          # Email/password login
  ├── signup         # New user registration
  ├── auth/
  │   ├── verify-email      # Email verification
  │   ├── forgot-password   # Password reset request
  │   └── reset-password    # Password reset form
  └── google/callback       # OAuth callback
```

## Router Configuration

**Location**: `src/routes/router.tsx`

**Pattern: Nested Route Protection**

```typescript
import { createBrowserRouter } from 'react-router-dom'
import { ProtectedRoute } from './ProtectedRoute'
import { PermissionProtectedRoute } from './PermissionProtectedRoute'
import { SuperProtectedRoute } from './SuperProtectedRoute'

export const router = createBrowserRouter([
  // Public routes
  {
    path: '/login',
    element: <Login />,
  },
  {
    path: '/signup',
    element: <Signup />,
  },

  // Protected routes (requires authentication)
  {
    element: <ProtectedRoute />,
    children: [
      // Venue-scoped routes
      {
        path: '/venues/:slug',
        element: <VenueLayout />,
        children: [
          {
            path: 'home',
            element: <VenueDashboard />,
          },

          // Menu section (requires menu:read permission)
          {
            element: <PermissionProtectedRoute permission="menu:read" />,
            children: [
              { path: 'menu', element: <MenuOverview /> },
              { path: 'categories', element: <Categories /> },
              { path: 'products', element: <Products /> },
            ],
          },

          // Orders section (requires orders:read permission)
          {
            element: <PermissionProtectedRoute permission="orders:read" />,
            children: [
              { path: 'orders', element: <Orders /> },
              { path: 'orders/:orderId', element: <OrderDetails /> },
            ],
          },

          // Inventory section (requires inventory:read permission)
          {
            element: <PermissionProtectedRoute permission="inventory:read" />,
            children: [
              { path: 'inventory/raw-materials', element: <RawMaterials /> },
              { path: 'inventory/recipes', element: <Recipes /> },
              { path: 'inventory/pricing', element: <Pricing /> },
            ],
          },
        ],
      },

      // Admin routes (requires OWNER role)
      {
        element: <SuperProtectedRoute />,
        children: [
          {
            path: '/admin',
            element: <AdminLayout />,
            children: [
              { path: 'venues', element: <VenueManagement /> },
              { path: 'features', element: <FeatureManagement /> },
            ],
          },
        ],
      },

      // Superadmin routes (requires SUPERADMIN role)
      {
        element: <SuperProtectedRoute />,
        children: [
          {
            path: '/superadmin',
            element: <SuperadminLayout />,
            children: [
              { path: '', element: <SuperadminDashboard /> },
              { path: 'organizations', element: <Organizations /> },
              { path: 'venues', element: <AllVenues /> },
            ],
          },
        ],
      },
    ],
  },

  // Catch-all 404
  {
    path: '*',
    element: <NotFound />,
  },
])
```

## Navigation Patterns

### Programmatic Navigation

**Using `navigate` hook:**
```typescript
import { useNavigate } from 'react-router-dom'

function MyComponent() {
  const navigate = useNavigate()

  const goToMenu = () => {
    navigate(`/venues/${venueSlug}/menu`)
  }

  return <button onClick={goToMenu}>View Menu</button>
}
```

**Using `Link` component:**
```typescript
import { Link } from 'react-router-dom'

<Link to={`/venues/${venueSlug}/products`}>
  View Products
</Link>
```

### Venue Switching

**Flow:**
1. User selects different venue from switcher
2. `AuthContext.switchVenue()` called with new venue slug
3. Backend updates session to new venue
4. `queryClient.clear()` clears all cached data
5. Navigate to new venue: `/venues/new-slug/home`
6. All API calls now use new `venueId`

**Implementation:**
```typescript
const { switchVenue, activeVenue } = useAuth()

const handleVenueSwitch = async (newSlug: string) => {
  await switchVenue(newSlug)
  // Automatic redirect handled by AuthContext
}
```

### Route Guards

**Redirect Logic in AuthContext:**

```typescript
// Redirect from login to appropriate home
if (location.pathname === '/' || location.pathname === '/login') {
  if (user.role === 'SUPERADMIN') {
    navigate('/superadmin', { replace: true })
  } else {
    navigate(`/venues/${defaultVenue.slug}/home`, { replace: true })
  }
}

// Redirect to default venue if slug invalid
if (slug && !userVenues.find(v => v.slug === slug)) {
  navigate(`/venues/${defaultVenue.slug}/home`, { replace: true })
}
```

## Lazy Loading

**Dynamic imports for code splitting:**

**Location**: `src/routes/lazyComponents.ts`

```typescript
import { lazy } from 'react'

// Lazy load heavy pages
export const MenuOverview = lazy(() => import('@/pages/Menu/MenuOverview'))
export const Orders = lazy(() => import('@/pages/Orders/Orders'))
export const Inventory = lazy(() => import('@/pages/Inventory/RawMaterials'))

// Router usage
import { Suspense } from 'react'
import { MenuOverview } from './lazyComponents'

{
  path: 'menu',
  element: (
    <Suspense fallback={<LoadingScreen />}>
      <MenuOverview />
    </Suspense>
  ),
}
```

**Benefits:**
- Smaller initial bundle size
- Faster page load
- Load code only when needed

## Route State & Location

**Passing state between routes:**

```typescript
// Navigate with state
navigate('/venues/downtown/orders', {
  state: { from: location.pathname }
})

// Read state in target component
import { useLocation } from 'react-router-dom'

function Orders() {
  const location = useLocation()
  const from = location.state?.from

  return (
    <div>
      {from && <Link to={from}>Back</Link>}
    </div>
  )
}
```

**Use Cases:**
- Breadcrumb navigation
- "Back" button functionality
- Pre-fill forms from previous page

## URL Parameters

**Route params (`:slug`, `:id`):**
```typescript
import { useParams } from 'react-router-dom'

function OrderDetails() {
  const { slug, orderId } = useParams<{ slug: string; orderId: string }>()

  const { data } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => orderService.getOrder(venueId, orderId),
  })

  return <div>Order {orderId}</div>
}
```

**Query params (`?search=burger&category=mains`):**
```typescript
import { useSearchParams } from 'react-router-dom'

function Products() {
  const [searchParams, setSearchParams] = useSearchParams()

  const search = searchParams.get('search') || ''
  const category = searchParams.get('category') || ''

  const updateSearch = (value: string) => {
    setSearchParams({ search: value, category })
  }

  return <input value={search} onChange={e => updateSearch(e.target.value)} />
}
```

## AccessDeniedPage

Shown when user tries to access route without required permissions.

**Location**: `src/pages/AccessDenied.tsx`

**Features:**
- Clear message explaining lack of permission
- Link to go back to previous page
- Link to venue home
- Contact admin prompt

**Example:**
```typescript
function AccessDeniedPage() {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-2xl font-bold">Access Denied</h1>
      <p>You don't have permission to access this page.</p>
      <button onClick={() => navigate(-1)}>Go Back</button>
    </div>
  )
}
```

## Best Practices

1. **Use Permission Routes for Page Groups**: Protect entire sections with `PermissionProtectedRoute`
2. **Use Permission Gates for UI Elements**: Hide/show buttons with `<PermissionGate>` inside pages
3. **Always Provide Fallback**: Show loading screen during route transitions
4. **Sync Frontend & Backend**: Ensure route permissions match backend middleware
5. **Test All Roles**: Verify routes work correctly for VIEWER, WAITER, MANAGER, OWNER, SUPERADMIN
6. **Use Lazy Loading**: Split large pages to reduce initial bundle size
7. **Handle Invalid Slugs**: Redirect to default venue if slug doesn't exist
8. **Clear Cache on Venue Switch**: Call `queryClient.clear()` to avoid stale data

## Common Issues

**Issue: "Access Denied" shown incorrectly**
- **Cause**: Permission not in user's role defaults or custom permissions
- **Fix**: Add permission to `defaultPermissions.ts` or assign custom permission in database

**Issue: Route works for SUPERADMIN but not OWNER**
- **Cause**: Missing permission in OWNER defaults
- **Fix**: Add permission to OWNER role in `defaultPermissions.ts`

**Issue: Infinite redirect loop**
- **Cause**: Route guard redirects to itself
- **Fix**: Check AuthContext redirect logic, ensure valid default route

**Issue: Page loads but shows empty data**
- **Cause**: Venue switching didn't clear cache
- **Fix**: Ensure `queryClient.clear()` called in `switchVenue`

## Related Documentation

- [Permissions System](./permissions.md) - Granular permission checks
- [Architecture Overview](./overview.md) - Multi-tenant system design
- [Performance Guide](../guides/performance.md) - Route transition optimization
