# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `npm run dev` - Starts Vite dev server at http://localhost:5173
- **Build**: `npm run build` - TypeScript compilation and Vite build
- **Linting**: `npm run lint` - Run ESLint across the codebase
- **Preview**: `npm run preview` - Preview production build locally

## Architecture Overview

### Tech Stack

- **Framework**: React 18 with TypeScript and Vite
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: TanStack Query for server state, React Context for global UI state
- **Routing**: React Router v6 with nested routes and protected routes
- **Backend**: Firebase authentication with Socket.io for real-time features
- **Forms**: React Hook Form with Zod validation

### Project Structure

```
src/
├── components/     # Reusable UI components and Radix UI wrappers
├── pages/         # Route components organized by feature (Menu, Orders, etc.)
├── context/       # React Context providers (Auth, Socket, Theme)
├── hooks/         # Custom React hooks and API hooks
├── services/      # API service functions and external integrations
├── routes/        # Router configuration and route protection
├── lib/           # Utility functions and shared libraries
└── types.ts       # Global TypeScript interfaces and enums
```

### Key Architecture Patterns

#### Multi-tenant Venue System

- Routes follow `/venues/:slug` pattern for venue-specific pages
- AuthContext manages venue switching and access control
- Each venue has its own role-based permissions and feature flags

#### Route Protection System

The application uses multiple layers of route protection to ensure proper access control:

**Authentication & Role-Based Routes:**

- `ProtectedRoute`: Requires authentication (any logged-in user)
- `AdminProtectedRoute`: Requires admin-level access with role checking
- `SuperProtectedRoute`: Requires OWNER role or higher
- Routes are nested with role-based access control

**Permission-Based Route Protection:**

- `PermissionProtectedRoute`: Requires specific permissions to access entire pages
- Works in conjunction with backend `checkPermission` middleware
- Prevents URL bypass attacks (users directly accessing URLs without permission)
- Shows "Access Denied" page instead of rendering protected content

**Usage Example:**

```typescript
import { PermissionProtectedRoute } from '@/routes/PermissionProtectedRoute'

// In router.tsx:
<Route element={<PermissionProtectedRoute permission="menu:read" />}>
  <Route path="menu" element={<MenuOverview />} />
  <Route path="categories" element={<Categories />} />
  <Route path="products" element={<Products />} />
</Route>

// Multiple permissions (requires ANY):
<Route element={<PermissionProtectedRoute permissions={['orders:read', 'orders:update']} />}>
  <Route path="orders" element={<Orders />} />
</Route>

// Multiple permissions (requires ALL):
<Route element={<PermissionProtectedRoute permissions={['admin:write', 'admin:delete']} requireAll />}>
  <Route path="dangerous" element={<DangerousAction />} />
</Route>
```

**How it works:**

```
1. User navigates to /venues/:slug/menu
   └─ PermissionProtectedRoute checks 'menu:read' permission
       ├─ Has permission? → Render <Outlet /> (MenuOverview page)
       └─ No permission? → Show AccessDeniedPage

2. User tries direct URL access
   └─ Same permission check occurs
       └─ No backend request if no permission (saves API calls)
```

**Key Features:**

- **Prevents URL bypass**: Users can't access pages by typing URLs directly
- **Reduces backend load**: Blocks requests before they reach the server
- **Better UX**: Shows clear "Access Denied" message instead of errors
- **Synced with backend**: Uses same permission logic as `checkPermission` middleware

**⚠️ Critical:** Both frontend route protection AND backend middleware validation are required. Frontend prevents UX issues, backend ensures
security.

#### Granular Permission System (UI Controls)

The dashboard implements a **granular permission system** that works alongside route protection to control what users can SEE and DO within
each page.

**Permission Format**: `"resource:action"` (e.g., `"tpv:create"`, `"menu:update"`, `"analytics:export"`)

**Key Components**:

- `src/lib/permissions/defaultPermissions.ts` - Default permissions by role
- `src/hooks/usePermissions.ts` - React hook for permission checks
- `src/components/PermissionGate.tsx` - Component for conditional rendering
- `src/types.ts` - SessionVenue includes `permissions?: string[]` field

##### usePermissions Hook

**Basic usage**:

```typescript
import { usePermissions } from '@/hooks/usePermissions'

function TpvPage() {
  const { can } = usePermissions()

  return (
    <>
      {/* All users see the list */}
      <TpvList />

      {/* Only users with create permission see this button */}
      {can('tpv:create') && <Button>Create Terminal</Button>}

      {/* Disable edit if no permission */}
      <Button disabled={!can('tpv:update')}>Edit</Button>
    </>
  )
}
```

**Hook API**:

```typescript
const {
  can, // (permission: string) => boolean
  canAny, // (permissions: string[]) => boolean
  canAll, // (permissions: string[]) => boolean
  cannot, // (permission: string) => boolean
  permissions, // string[] - All user permissions
  role, // StaffRole - User's role
} = usePermissions()

// Examples:
can('tpv:create') // Single permission
canAny(['menu:create', 'menu:update']) // Has at least one
canAll(['admin:write', 'admin:delete']) // Has all
```

##### PermissionGate Component

**Declarative UI control** (preferred method):

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

      {/* With fallback */}
      <PermissionGate permission="analytics:export" fallback={<p>Upgrade to export data</p>}>
        <ExportButton />
      </PermissionGate>
    </>
  )
}
```

##### Wildcard Permissions

- `"*:*"` - All permissions (ADMIN, OWNER, SUPERADMIN)
- `"tpv:*"` - All TPV actions
- `"*:read"` - Read access to all resources

##### Default Permissions by Role

From `src/lib/permissions/defaultPermissions.ts`:

```typescript
// VIEWER - Read-only
'home:read', 'analytics:read', 'menu:read', 'orders:read', 'payments:read', 'shifts:read', 'tpv:read'

// WAITER - Order and table management
'menu:read', 'menu:create', 'menu:update', 'orders:*', 'payments:read', 'payments:create', 'tables:*', 'tpv:read'

// MANAGER - Operations
'analytics:read',
  'analytics:export',
  'menu:*',
  'orders:*',
  'payments:refund',
  'shifts:*',
  'tpv:read',
  'tpv:create',
  'tpv:update',
  'tpv:command'

// ADMIN, OWNER, SUPERADMIN - Full access
;('*:*')
```

##### Custom Permissions (Database)

Venues can assign custom permissions to staff via `SessionVenue.permissions`:

```typescript
interface SessionVenue {
  id: string
  name: string
  role: StaffRole
  permissions?: string[] // Custom overrides/additions
}
```

**How it works**:

```typescript
// Default WAITER permissions:
['menu:read', 'orders:create', 'tpv:read', ...]

// WAITER with custom permissions:
{
  role: 'WAITER',
  permissions: ['inventory:read', 'analytics:export']  // Extra permissions
}

// Final permissions = Default + Custom:
['menu:read', 'orders:create', 'tpv:read', ..., 'inventory:read', 'analytics:export']
```

##### Permission Flow

**Full stack permission check**:

```
1. User clicks "Create Terminal"
   └─ Frontend: PermissionGate checks 'tpv:create'
       ├─ Has permission? Show button
       └─ No permission? Hide button

2. User submits form
   └─ API call: POST /api/v1/dashboard/venues/{venueId}/tpvs
       └─ Backend: checkPermission('tpv:create') middleware
           ├─ Has permission? Process request
           └─ No permission? 403 Forbidden
```

**⚠️ Important**: Frontend permissions are for UX only! Backend ALWAYS validates.

##### Implementing Permission-Based Features

**Step-by-step example** (Adding permission to new feature):

1. **Add permission to defaults** (`src/lib/permissions/defaultPermissions.ts`):

```typescript
[StaffRole.MANAGER]: [
  // ... existing permissions
  'reports:create',
  'reports:export',
]
```

2. **Use PermissionGate in component**:

```typescript
<PermissionGate permission="reports:create">
  <Button onClick={createReport}>Create Report</Button>
</PermissionGate>

<PermissionGate permission="reports:export">
  <Button onClick={exportReport}>Export</Button>
</PermissionGate>
```

3. **Backend protection** (see backend CLAUDE.md):

```typescript
router.post('/venues/:venueId/reports', authenticateTokenMiddleware, checkPermission('reports:create'), reportController.create)
```

4. **Keep in sync**: Ensure frontend and backend DEFAULT_PERMISSIONS match exactly!

##### Common Patterns

**Conditional rendering**:

```typescript
// Hide entire section
<PermissionGate permission="inventory:read">
  <InventorySection />
</PermissionGate>

// Show/hide action buttons
<PermissionGate permission="tpv:update">
  <Button onClick={edit}>Edit</Button>
</PermissionGate>
<PermissionGate permission="tpv:delete">
  <Button onClick={del}>Delete</Button>
</PermissionGate>
```

**Disable vs Hide**:

```typescript
// Hide button (better UX - less clutter)
{
  can('tpv:create') && <Button>Create</Button>
}

// Disable button (shows feature exists but locked)
;<Tooltip content="Manager access required">
  <Button disabled={!can('tpv:create')}>Create</Button>
</Tooltip>
```

**Complex conditions**:

```typescript
const canModify = canAny(['menu:update', 'admin:write'])
const isOwner = role === 'OWNER'
const canDelete = canAll(['menu:delete', 'admin:delete'])

<PermissionGate permission="menu:update">
  {isOwner ? <OwnerEditForm /> : <BasicEditForm />}
</PermissionGate>
```

##### Best Practices

1. **Use PermissionGate for declarative UI** - More readable than conditionals
2. **Keep frontend/backend permissions synced** - Same permissions in both files
3. **Test with different roles** - Verify WAITER can't see MANAGER buttons
4. **Never skip backend validation** - Frontend is UX, backend is security
5. **Document new permissions** - Update CLAUDE.md when adding permissions

##### Future: Admin Permission Management UI

The `SessionVenue.permissions` field enables building an admin UI to assign custom permissions:

**Potential features**:

- Checkbox grid: Resources (rows) × Actions (columns)
- Visual diff: Role defaults vs custom overrides
- Per-staff permission assignment
- Permission templates/presets
- Audit log of permission changes

**Implementation guide**: See backend CLAUDE.md for API endpoint examples.

#### State Management Strategy

- **Server State**: TanStack Query for API data with caching and invalidation
- **Authentication**: AuthContext with venue switching and role management
- **UI State**: Individual component state and React Context where needed
- **Real-time**: SocketContext for live order updates and notifications

#### API Service Pattern

- Centralized API client in `api.ts` with axios
- Feature-specific service files (e.g., `menu.service.ts`, `auth.service.ts`)
- Consistent error handling and response transformation
- Services use venue-scoped endpoints: `/api/v1/dashboard/venues/{venueId}/{resource}`

### Data Models

#### Core Entities

- **Organization**: Multi-tenant container for venues
- **Venue**: Individual business location with settings and features
- **Staff**: User accounts with role-based venue access
- **Order**: Customer orders with items, payments, and status tracking
- **Menu/Product**: Menu structure with categories, products, and modifiers

#### Role Hierarchy (lowest to highest)

1. `VIEWER` - Read-only access
2. `HOST` - Customer-facing operations
3. `WAITER` - Order management
4. `CASHIER` - Payment processing
5. `KITCHEN` - Kitchen operations
6. `MANAGER` - Staff and shift management
7. `ADMIN` - Venue configuration
8. `OWNER` - Full venue access
9. `SUPERADMIN` - System-wide access

#### Feature System

- Venues have configurable features through `VenueFeature` relationships
- Feature access checked via `checkFeatureAccess(featureCode)` in AuthContext
- Features include chatbot, advanced analytics, inventory tracking, etc.

### Component Guidelines

#### UI Components

- Use Radix UI primitives in `components/ui/` for accessibility
- Tailwind classes for styling with consistent design system
- Shadcn UI patterns for form components and data tables
- Use `skeleton.tsx` components while `isLoading`

#### Form Patterns

- React Hook Form with Zod schemas for validation
- Consistent error handling and loading states
- Use `LoadingButton` component for form submissions

#### Data Display

- `DataTable` component with TanStack Table for complex data
- Pagination, sorting, and filtering built-in
- Skeleton loaders during data fetching

### Development Guidelines

#### TypeScript Usage

- Strict mode enabled with comprehensive type definitions in `types.ts`
- Use interfaces over types for object definitions
- Avoid enums, prefer const assertions or union types
- Functional components with proper TypeScript interfaces

#### Code Organization

- Group related functionality in feature directories
- Use named exports for components
- Prefer functional programming patterns
- Descriptive variable names with auxiliary verbs (e.g., `isLoading`, `hasError`)

#### API Integration

- Use TanStack Query hooks for data fetching
- Implement proper error boundaries and loading states
- Cache invalidation strategies for real-time data
- Venue context switching requires query invalidation

### Environment and Configuration

#### Required Environment Variables

- Firebase configuration for authentication
- API base URL for backend services
- Socket.io server URL for real-time features

#### Build Configuration

- Vite for development and production builds
- PostCSS with Tailwind CSS processing
- TypeScript with strict mode and path aliases (@/ for src/)
- ESLint with React and TypeScript rules

### Testing Strategy

Currently no automated test suite is configured. Code quality is maintained through:

- TypeScript strict mode compilation
- ESLint static analysis
- Manual testing with development server

### Deployment & Environment Variables

#### Deployment Architecture

The dashboard uses **GitHub Actions + Cloudflare Pages** for automated deployments. There are **three separate environments**:

1. **Demo** (`demo.dashboard.avoqado.io`) - Connected to demo API (`demo.api.avoqado.io`)
2. **Staging** (`staging.dashboard.avoqado.io`) - Connected to staging API
3. **Production** (`dashboardv2.avoqado.io`) - Connected to production API

Each environment is deployed as a **separate Cloudflare Pages project**:

- `demo-avoqado-web-dashboard` (demo environment)
- `avoqado-web-dashboard` (staging + production)

#### ⚠️ CRITICAL: Environment Variables Flow

**The Problem:** Cloudflare Pages with GitHub integration **does NOT use** Cloudflare Pages UI variables for auto-deploys. It uses **GitHub
Environments** instead.

**Why This Matters:**

```
❌ WRONG ASSUMPTION:
Cloudflare Pages → Settings → Environment Variables
  └─ These variables are ONLY used for manual wrangler deploys
  └─ Auto-deploys from GitHub IGNORE these variables!

✅ CORRECT FLOW:
GitHub Push → GitHub Actions Workflow → GitHub Environment Secrets
  └─ Workflow uses secrets from GitHub Environment (demo/staging/production)
  └─ Passes secrets to build command via `env:` in workflow YAML
  └─ Vite injects variables at BUILD TIME (not runtime)
  └─ Deploys compiled dist/ to Cloudflare Pages
```

**Evidence from Build Logs:**

```bash
# Cloudflare auto-deploy (NO GitHub Actions):
22:34:43.782    Build environment variables: (none found)
# ❌ No variables available because Cloudflare doesn't inject them for auto-deploys

# GitHub Actions deploy (CORRECT):
env:
  VITE_API_URL: ${{ secrets.VITE_API_URL }}
  VITE_GOOGLE_CLIENT_ID: ${{ secrets.VITE_GOOGLE_CLIENT_ID }}
# ✅ Variables injected from GitHub Environment secrets
```

#### GitHub Environments Configuration

**Three GitHub Environments exist** (configured in GitHub repo settings):

1. **demo** → `demo.dashboard.avoqado.io`

   - `VITE_API_URL` = `https://demo.api.avoqado.io`
   - `VITE_FRONTEND_URL` = `https://demo.dashboard.avoqado.io`
   - - Firebase/Google OAuth secrets

2. **staging** → `staging.dashboard.avoqado.io`

   - `VITE_STAGING_API_URL` = `https://avoqado-server-staging-cm35.onrender.com`
   - `VITE_STAGING_FRONTEND_URL` = `https://staging.dashboard.avoqado.io`
   - - Firebase/Google OAuth secrets

3. **production** → `dashboardv2.avoqado.io`
   - `VITE_PRODUCTION_API_URL` = `https://api.avoqado.io`
   - `VITE_PRODUCTION_FRONTEND_URL` = `https://dashboardv2.avoqado.io`
   - - Firebase/Google OAuth secrets

**To view/edit:**

```bash
# View GitHub secrets
gh secret list --env demo
gh secret list --env staging
gh secret list --env production

# Set a secret
gh secret set VITE_API_URL --env demo --body "https://demo.api.avoqado.io"
```

Or via GitHub UI: **Repository Settings → Environments → [demo/staging/production] → Environment secrets**

#### GitHub Actions Workflow (`.github/workflows/ci-cd.yml`)

The CI/CD pipeline has **four jobs**:

**1. `test-and-build`** (runs on every push/PR)

- Lints, TypeScript check, test build
- Produces build artifacts

**2. `deploy-demo`** (runs on push to `develop` branch OR manual trigger)

- Uses `demo` GitHub Environment
- Builds with demo environment variables
- Deploys to `demo-avoqado-web-dashboard` Cloudflare Pages project
- Health checks `https://demo.dashboard.avoqado.io`

**3. `deploy-staging`** (runs on push to `develop` branch OR manual trigger)

- Uses `staging` GitHub Environment
- Builds with staging environment variables
- Deploys to `avoqado-web-dashboard` Cloudflare Pages project (develop branch)
- Health checks `https://staging.dashboard.avoqado.io`

**4. `deploy-production`** (runs on push to `main` branch OR manual trigger)

- Uses `production` GitHub Environment
- Builds with production environment variables
- Deploys to `avoqado-web-dashboard` Cloudflare Pages project (main branch)
- Health checks `https://dashboardv2.avoqado.io`

**Trigger Conditions:**

```yaml
# Auto-deploy on push to develop
if: github.ref == 'refs/heads/develop' && github.event_name == 'push'

# OR manual trigger via GitHub UI
if: github.event_name == 'workflow_dispatch' && github.event.inputs.environment == 'demo'
```

**Manual Deployment:**

```bash
# Via GitHub CLI (from any branch)
gh workflow run ci-cd.yml --field environment=demo
gh workflow run ci-cd.yml --field environment=staging
gh workflow run ci-cd.yml --field environment=production
```

Or via GitHub UI: **Actions → CI/CD Pipeline → Run workflow → Select environment**

#### How Vite Environment Variables Work

**Build-time injection** (NOT runtime):

```typescript
// src/api.ts
const api = axios.create({
  baseURL:
    import.meta.env.MODE === 'production'
      ? import.meta.env.VITE_API_URL // Replaced at BUILD TIME
      : import.meta.env.VITE_API_DEV_URL,
  withCredentials: true,
})
```

**During build:**

```bash
# GitHub Actions runs:
VITE_API_URL="https://demo.api.avoqado.io" npm run build

# Vite replaces:
baseURL: import.meta.env.VITE_API_URL
# With:
baseURL: "https://demo.api.avoqado.io"

# Final compiled code (in dist/assets/utils-*.js):
const api = axios.create({
  baseURL: "https://demo.api.avoqado.io",  // Hardcoded in bundle!
  withCredentials: true,
})
```

**⚠️ This means:**

- You **CANNOT change API URL** after build (it's compiled into JS)
- Each environment needs its **own build** with different variables
- Cloudflare Pages UI variables **do NOT work** because they're not available at build time for auto-deploys

#### Common Issues & Solutions

**Problem: "POST /api/v1/dashboard/auth/login 405 (Method Not Allowed)"**

- **Symptom**: Frontend sends API calls to itself (`demo.dashboard.avoqado.io/api/...`)
- **Cause**: `VITE_API_URL` was `undefined` during build
- **Why**: GitHub Environment secret missing or workflow not using environment
- **Fix**: Verify GitHub Environment has the secret + workflow references correct environment

**Problem: "Build environment variables: (none found)" in Cloudflare logs**

- **Symptom**: Cloudflare Pages auto-deploy shows no variables
- **Cause**: Using Cloudflare auto-deploy without GitHub Actions
- **Why**: Cloudflare auto-deploys don't inject variables from Cloudflare UI
- **Fix**: Disable auto-deploy in Cloudflare, rely on GitHub Actions instead

**Problem: Variables updated in GitHub but not reflected**

- **Symptom**: Changed secret in GitHub Environment but build still uses old value
- **Cause**: Old build artifacts cached
- **Fix**: Trigger new deployment via GitHub Actions

**Problem: Demo using staging/production variables**

- **Symptom**: Demo environment connecting to wrong API
- **Cause**: Workflow job not using `demo` environment
- **Fix**: Verify job has `environment: name: demo` in YAML

#### Deployment Checklist

**Adding a new environment:**

1. ✅ Create GitHub Environment in repo settings
2. ✅ Add all required secrets to environment:
   - `VITE_API_URL`
   - `VITE_FRONTEND_URL`
   - `VITE_GOOGLE_CLIENT_ID`
   - `VITE_FIREBASE_API_KEY`
   - `VITE_FIREBASE_AUTH_DOMAIN`
   - `VITE_FIREBASE_RECAPTCHA_SITE_KEY`
3. ✅ Add deployment job to `.github/workflows/ci-cd.yml`
4. ✅ Create Cloudflare Pages project if needed
5. ✅ Test deployment via GitHub Actions
6. ✅ Verify environment variables in build logs
7. ✅ Health check deployed URL

**Updating environment variables:**

1. ✅ Update secret in GitHub Environment (NOT Cloudflare Pages UI)
2. ✅ Trigger new deployment via GitHub Actions
3. ✅ Verify in build logs that new value is used
4. ✅ Test deployed application

**Debugging deployment issues:**

1. ✅ Check GitHub Actions logs for build errors
2. ✅ Verify environment secrets are set correctly
3. ✅ Check Cloudflare Pages deployment logs
4. ✅ Inspect compiled JavaScript bundle for hardcoded URLs
5. ✅ Test with browser dev tools network tab

#### Best Practices

1. **Never use Cloudflare Pages UI variables** for environments with GitHub integration
2. **Always use GitHub Environments** for all environment-specific secrets
3. **Keep variable names consistent** across environments (e.g., `VITE_API_URL`)
4. **Document all required variables** in this file when adding new ones
5. **Test deployments** in non-production environments first
6. **Monitor GitHub Actions logs** for build-time variable injection
7. **Use `workflow_dispatch`** for emergency production deployments

## 📦 Inventory Management System

### Overview

The inventory management system tracks raw materials, recipes, stock batches, and provides FIFO (First-In-First-Out) inventory costing. This
is a **core business feature** that automatically deducts stock when orders are paid.

### Architecture

```
Raw Materials (Ingredients)
  ├─ Stock Batches (FIFO tracking)
  │   ├─ Batch 1 (oldest - used first)
  │   ├─ Batch 2
  │   └─ Batch 3 (newest - used last)
  ├─ Stock Movements (audit trail)
  └─ Low Stock Alerts

Recipes (Product composition)
  ├─ Recipe Lines (ingredients + quantities)
  └─ Total Cost calculation

Products
  ├─ Has Recipe? → Recipe-based inventory
  ├─ Simple Stock? → Count-based inventory
  └─ No Inventory? → Services/digital products
```

### Key Components

**Pages:**

- `src/pages/Inventory/RawMaterials.tsx` - Manage raw materials/ingredients
- `src/pages/Inventory/Recipes.tsx` - Manage product recipes
- `src/pages/Inventory/Pricing.tsx` - Pricing analysis & profitability
- `src/pages/Menu/Products/createProduct.tsx` - Product wizard with inventory

**Dialogs:**

- `src/pages/Inventory/components/RawMaterialDialog.tsx` - Add/edit raw materials
- `src/pages/Inventory/components/RecipeDialog.tsx` - Add/edit recipes
- `src/pages/Inventory/components/AdjustStockDialog.tsx` - Manual stock adjustments
- `src/pages/Inventory/components/StockMovementsDialog.tsx` - View movement history
- `src/pages/Inventory/components/ProductWizardDialog.tsx` - Guided product creation

**Services:**

- `src/services/inventory.service.ts` - API client for inventory operations

**Constants:**

- `src/lib/inventory-constants.ts` - Units, categories, enums

### Data Flow: Order → Inventory Deduction

**Important:** The dashboard displays inventory data but does NOT trigger deductions directly. Stock deduction happens automatically on the
**backend** when an order is fully paid.

```
1. Dashboard: Create Product with Recipe
   └─ Define ingredients and quantities

2. Dashboard or TPV: Create Order
   └─ Order status: PENDING

3. TPV: Process Payment
   └─ Backend: Automatically deducts stock (FIFO)

4. Dashboard: View Results
   ├─ Updated stock levels (RawMaterials page)
   ├─ Stock movements (AdjustStockDialog)
   ├─ Low stock alerts (if any)
   └─ Batch depletion (oldest batches used first)
```

### Raw Material Fields

| Field           | Description         | Required | Notes                            |
| --------------- | ------------------- | -------- | -------------------------------- |
| `name`          | Ingredient name     | ✅       | e.g., "Hamburger Buns"           |
| `sku`           | Stock keeping unit  | ✅       | Unique identifier                |
| `category`      | Ingredient category | ✅       | MEAT, DAIRY, VEGETABLES, etc.    |
| `unit`          | Measurement unit    | ✅       | KILOGRAM, LITER, UNIT, etc.      |
| `currentStock`  | Current quantity    | ✅       | Auto-calculated from batches     |
| `minimumStock`  | Safety stock level  | ✅       | Alert threshold                  |
| `reorderPoint`  | Reorder trigger     | ✅       | When to reorder                  |
| `costPerUnit`   | Purchase cost       | ✅       | Used in recipe costing           |
| `perishable`    | Has expiration?     | ⬜       | Enables batch tracking           |
| `shelfLifeDays` | Days until expiry   | ⬜       | Auto-calculates batch expiration |

**Critical:** `expirationDate` is NOT on RawMaterial! It's calculated per batch:

```typescript
// Each StockBatch has its own expiration:
batch.expirationDate = batch.receivedDate + rawMaterial.shelfLifeDays
```

### Recipe System

**Recipe Structure:**

```typescript
Recipe {
  productId: string           // One recipe per product
  portionYield: number        // How many servings
  totalCost: Decimal          // Calculated from ingredients
  lines: RecipeLine[] {       // Individual ingredients
    rawMaterialId: string
    quantity: Decimal         // Amount needed
    unit: Unit
    isOptional: boolean       // Skip if unavailable?
  }
}
```

**Example: Hamburger Recipe**

```typescript
{
  productId: "prod_123",
  portionYield: 1,            // Makes 1 burger
  totalCost: 3.60,            // Sum of ingredients
  lines: [
    { rawMaterialId: "buns_001", quantity: 1, unit: UNIT },      // $0.50
    { rawMaterialId: "beef_001", quantity: 1, unit: UNIT },      // $2.00
    { rawMaterialId: "cheese_001", quantity: 2, unit: UNIT },    // $0.60
    { rawMaterialId: "lettuce_001", quantity: 50, unit: GRAM },  // $0.50
  ]
}
```

**When Order Paid:**

```typescript
// Backend automatically:
for (const line of recipe.lines) {
  const needed = line.quantity * order.quantity
  deductStockFIFO(line.rawMaterialId, needed)
}
```

### FIFO Batch Tracking

**Why FIFO?**

- Uses oldest inventory first (prevents waste)
- Accurate cost tracking per batch
- Proper expiration management
- Compliance with accounting standards

**How It Works:**

```typescript
// User receives 3 shipments of buns:
Batch 1: 50 units @ $0.50, received Oct 4, expires Oct 9
Batch 2: 100 units @ $0.50, received Oct 9, expires Oct 14
Batch 3: 150 units @ $0.50, received Oct 14, expires Oct 19

// Order requires 60 buns:
Step 1: Use 50 from Batch 1 (oldest) → Batch 1 DEPLETED
Step 2: Use 10 from Batch 2 → Batch 2 has 90 remaining
Step 3: Batch 3 untouched

// Result: Oldest stock used first, reducing waste!
```

**Visual in Dashboard:**

- `StockMovementsDialog` shows which batches were used
- `RawMaterials` page shows current stock (sum of active batches)
- Low stock alerts appear when stock ≤ reorderPoint

### Pricing & Profitability

**Cost Calculation:**

```typescript
// Recipe cost (from ingredients):
const recipeCost = recipe.lines.reduce((sum, line) => sum + line.quantity * line.rawMaterial.costPerUnit, 0)

// Product profit:
const profit = product.price - recipeCost
const margin = (profit / product.price) * 100

// Example:
// Hamburger: $12.99 price - $3.60 cost = $9.39 profit (72% margin)
```

**Pricing Analysis Page:**

- Shows cost vs price for all products
- Identifies unprofitable items (cost > price)
- Suggests pricing adjustments
- Tracks margin percentages

### Common UI Tasks

**Add New Raw Material:**

1. Navigate to Inventory → Raw Materials
2. Click "Add Raw Material"
3. Fill required fields (name, SKU, unit, costs, stock levels)
4. If perishable: Set `shelfLifeDays` (NOT `expirationDate`!)
5. Save → Backend creates initial stock batch

**Create Product Recipe:**

1. Navigate to Menu → Products
2. Find product → Click "Edit" → "Recipe" tab
3. Add ingredients with quantities
4. System calculates total cost
5. Save → Recipe active for inventory deduction

**Adjust Stock Manually:**

1. Navigate to Inventory → Raw Materials
2. Find item → Click "..." → "Adjust Stock"
3. Enter quantity (positive or negative)
4. Select reason (PURCHASE, SPOILAGE, COUNT, etc.)
5. Save → Creates movement + updates batches

**View Stock Movements:**

1. Navigate to Inventory → Raw Materials
2. Find item → Click "..." → "View Movements"
3. See complete audit trail:
   - PURCHASE (received from supplier)
   - USAGE (used in order)
   - ADJUSTMENT (manual change)
   - SPOILAGE (waste/expiry)
   - COUNT (inventory count correction)

### Translation Keys (i18n)

All inventory UI uses the `inventory` namespace:

```typescript
import { useTranslation } from 'react-i18next'
const { t } = useTranslation('inventory')

// Examples:
t('rawMaterials.add') // "Add Raw Material"
t('rawMaterials.fields.shelfLifeDays') // "Shelf Life (days)"
t('rawMaterials.fieldHelp.unit') // Help text for unit field
t('recipes.ingredients.quantity') // "Quantity"
```

**Namespace location:** `src/locales/[en|es]/inventory.json`

### Testing Inventory Flow

**Manual Test:**

1. **Setup:**

   - Create raw material: "Test Buns" with stock 100
   - Create product: "Test Burger" at $10
   - Create recipe: 1 bun per burger
   - Note initial stock: 100 buns

2. **Create Order:**

   - Add "Test Burger" (qty: 5)
   - Total: $50

3. **Process Payment:**

   - Pay full amount ($50)
   - Order status → COMPLETED

4. **Verify Deduction:**

   - Go to Inventory → Raw Materials
   - Find "Test Buns"
   - Stock should be: 95 (100 - 5)
   - Click "View Movements" → See USAGE entry

5. **Check FIFO:**
   - If multiple batches exist, oldest should be used first
   - View movements to see batch references

**API Testing:**

```bash
# From browser console (dashboard must be logged in):
// Check raw material stock
fetch('/api/v1/dashboard/venues/{venueId}/raw-materials')
  .then(r => r.json())
  .then(console.log)

// View stock movements
fetch('/api/v1/dashboard/venues/{venueId}/raw-materials/{id}/movements')
  .then(r => r.json())
  .then(console.log)
```

### Common Issues

**Stock Not Updating:**

- ✅ Check: Payment status is "PAID" (not PENDING)
- ✅ Check: Product has a recipe defined
- ✅ Check: Recipe has ingredients
- ✅ Check: Raw materials have sufficient stock
- ✅ Check: Backend logs for errors

**Wrong Cost Calculation:**

- ✅ Check: Raw material `costPerUnit` is correct
- ✅ Check: Recipe quantities match reality
- ✅ Check: Units match (don't mix KILOGRAM with GRAM)

**FIFO Not Working:**

- ✅ Check: Multiple batches exist with different `receivedDate`
- ✅ Check: Batches have status "ACTIVE" (not DEPLETED)
- ✅ Check: `receivedDate` ordering in database

### Best Practices

1. **Always set `shelfLifeDays` for perishables** - Enables automatic expiration tracking
2. **Use consistent units** - Don't mix grams and kilograms in same recipe
3. **Set realistic reorder points** - Account for delivery time + buffer
4. **Test recipes before going live** - Verify costs and quantities
5. **Review low stock alerts daily** - Prevents stockouts
6. **Use optional ingredients sparingly** - Only for true substitutions

### Theme System Guidelines (Summary)

Follow the design-token based theme system to ensure light/dark mode compatibility. See full details in `THEME-GUIDELINES.md`.

- Rule #1: Never use hardcoded Tailwind grays (e.g., `bg-gray-*`, `text-gray-*`) or raw color values.
- Use semantic, theme-aware classes:
  - Backgrounds: `bg-background`, `bg-card`, `bg-muted`, `bg-accent`
  - Text: `text-foreground`, `text-muted-foreground`, `text-card-foreground`, `text-accent-foreground`
  - Borders/Inputs: `border-border`, `border-input`
  - States: `text-destructive`, `bg-destructive`, `text-primary`, `bg-primary`, `text-secondary`, `bg-secondary`
  - Rings: `ring` color derives from `--ring`

Common replacements:

- `bg-white` → `bg-background` or `bg-card`
- `bg-gray-50` → `bg-muted`
- `text-gray-900` → `text-foreground`
- `text-gray-600/500/400` → `text-muted-foreground`
- `border-gray-200/300` → `border-border`
- `text-red-600` → `text-destructive`

Status/feedback examples:

- Error: `bg-destructive/10 border border-destructive/20 text-destructive`
- Success: `bg-green-50 dark:bg-green-950/50 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-200`
- Info: `bg-blue-50 dark:bg-blue-950/50 border border-blue-200 dark:border-blue-800 text-blue-800 dark:text-blue-200`

Forms:

- Inputs should use `border-input bg-background text-foreground`
- Labels/text should use `text-foreground` or `text-muted-foreground`

Checklist:

- Use only theme-aware classes
- Test in both light and dark modes
- Provide dark variants for custom colored elements (blue/green/orange)

### ⚠️ MANDATORY: Internationalization (i18n) Policy - NO EXCEPTIONS

**EVERY user‑facing change requires complete i18n implementation.** This is not optional - it's a core requirement for ANY UI work. When
creating, modifying, or updating any user interface element, i18n support MUST be included before the task is considered complete.

- Use `react-i18next` with `useTranslation()` and `t('...')` for every user‑visible string. Do not hardcode copy in components.
- Add translation keys for both English (`en`) and Spanish (`es`) in `src/i18n.ts` under the appropriate group (e.g., `header`, `sidebar`,
  `dashboard`, `revenue`, `featureMgmt`, `venueMgmt`, `detailsView`, `categories`, `featureStatuses`).
- Prefer interpolation and pluralization over manual string concatenation (e.g., `t('revenue.features.meta', { count, amount })`).
- For dynamic labels (statuses, categories, pricing models), map values to translation keys instead of rendering raw enum values.
- Format dates, numbers, and currency using locale‑aware APIs (`Intl.*`, `date-fns` with the selected locale) based on `i18n.language`.
- Respect the existing language selector (`src/components/language-switcher.tsx`). Do not duplicate this control.

**Task completion requirements (i18n) - ALL must be verified:**

- [ ] **No hardcoded text**: All strings use `t('...')` - zero exceptions
- [ ] **Bilingual support**: Keys added for both `en` and `es` in `src/i18n.ts`
- [ ] **Quality translations**: Spanish versions are culturally appropriate
- [ ] **Dynamic content**: Interpolation/pluralization used instead of concatenation
- [ ] **Proper formatting**: Locale‑aware display for dates/numbers/currency
- [ ] **User testing**: Interface verified in both languages
- [ ] **Clean enums**: No raw status/category codes displayed to users

**CRITICAL**: When asked to create ANY UI element (component, dialog, form, button, etc.), i18n implementation is automatically part of that
request. Never deliver UI work without complete translation support.

### Namespace-Based Translation Architecture

To improve maintainability and reduce the size of the central `i18n.ts` file, translations are organized using **namespaces** for large
feature domains. This approach creates modular, self-contained translation bundles that are dynamically registered.

#### When to Use Namespaces

Use namespace-based translations for:

- **Large feature modules** with 50+ translation keys (e.g., Menu, Venue, Payment management)
- **Self-contained domains** with minimal cross-references to other features
- **Complex nested structures** (forms, tables, dialogs, workflows within a single domain)

Keep in main `i18n.ts` for:

- **Shared/common translations** (buttons, actions, statuses)
- **Small features** with <30 translation keys
- **Cross-cutting concerns** (navigation, authentication, notifications)

#### Implementation Pattern

**1. Create separate translation files:**

```typescript
// src/i18n/namespaces/menu.ts
export const menuTranslations = {
  en: {
    menu: {
      overview: {
        title: 'Menu Overview',
        subtitle: 'Manage products and categories',
      },
      categories: {
        title: 'Categories',
        addButton: 'Add Category',
        // ...
      },
      products: {
        title: 'Products',
        columns: {
          name: 'Name',
          price: 'Price',
          // ...
        },
      },
    },
  },
  es: {
    menu: {
      overview: {
        title: 'Vista General del Menú',
        subtitle: 'Administrar productos y categorías',
      },
      // ... Spanish translations
    },
  },
}
```

**2. Register namespace in `i18n.ts`:**

```typescript
import { menuTranslations } from './i18n/namespaces/menu'

// After i18n initialization
i18n.addResourceBundle('en', 'menu', menuTranslations.en.menu)
i18n.addResourceBundle('es', 'menu', menuTranslations.es.menu)
```

**3. Use namespace in components:**

```typescript
// Before (default namespace):
const { t } = useTranslation()
return <h1>{t('menu.overview.title')}</h1>

// After (menu namespace):
const { t } = useTranslation('menu')
return <h1>{t('overview.title')}</h1> // Simplified key path
```

#### Translation Structure Best Practices

Organize translations hierarchically by UI structure:

```typescript
{
  featureName: {
    // Page/section level
    title: 'Feature Title',
    subtitle: 'Feature description',

    // Table columns
    columns: {
      name: 'Name',
      status: 'Status',
      actions: 'Actions',
    },

    // Status/enum mappings
    status: {
      active: 'Active',
      inactive: 'Inactive',
    },

    // User feedback
    toasts: {
      success: 'Success',
      createSuccess: 'Created successfully',
      updateSuccess: 'Updated successfully',
      deleteSuccess: 'Deleted successfully',
      error: 'Error',
      createError: 'Failed to create',
    },

    // Confirmation dialogs
    confirmations: {
      delete: 'Are you sure you want to delete this item?',
      deactivate: 'Are you sure you want to deactivate this item?',
    },

    // Forms
    form: {
      fields: {
        name: 'Name',
        description: 'Description',
      },
      placeholders: {
        name: 'Enter name...',
      },
      validation: {
        nameRequired: 'Name is required',
      },
    },
  },
}
```

#### Migration Checklist

When converting a component to use namespace translations:

1. **Read component** - Identify all hardcoded strings (titles, labels, toasts, confirmations, table columns)
2. **Create namespace structure** - Organize translations by UI section (overview, table, form, etc.)
3. **Add English translations** - Add complete English key structure to namespace file
4. **Add Spanish translations** - Add corresponding Spanish translations (verify quality)
5. **Register namespace** - Add `i18n.addResourceBundle()` calls in `i18n.ts`
6. **Update component** - Change `useTranslation()` to `useTranslation('namespace')`
7. **Update translation keys** - Remove namespace prefix from all `t()` calls (e.g., `t('menu.title')` → `t('title')`)
8. **Test in both languages** - Verify all strings display correctly in English and Spanish
9. **Build verification** - Run `npm run build` to ensure no TypeScript errors

#### Current Namespace Organization

**Active namespaces:**

- `menu` - Menu management (categories, products, modifiers)
- `venue` - Venue management and configuration
- `payment` - Payment provider and cost structure management
- `sidebar` - Sidebar navigation and menu items
- `testing` - Testing and payment analytics

**Main i18n.ts contains:**

- Common translations (buttons, actions, statuses)
- Dashboard overview
- Orders and shifts
- Staff management
- Reports and analytics
- Superadmin features (except payment management)

#### Benefits of Namespace Approach

- **Reduced file size**: Main `i18n.ts` reduced from 6,012 to ~5,000 lines
- **Better organization**: Related translations grouped together
- **Easier maintenance**: Changes to a feature only affect its namespace file
- **Simplified keys**: Shorter translation key paths in components
- **Lazy loading potential**: Namespaces can be loaded on-demand in future
- **Team collaboration**: Multiple developers can work on different namespaces without conflicts

### JSON-Based Translation Architecture (Modern Pattern)

To further improve scalability and maintainability, translations are now organized using **JSON files** in a dedicated `locales/` directory.
This approach provides better tooling support, easier collaboration, and cleaner separation of concerns.

#### Directory Structure

```
src/
├── locales/
│   ├── en/
│   │   ├── common.json        # Shared strings (buttons, actions, validation)
│   │   ├── sidebar.json       # Navigation menu
│   │   ├── menu.json          # Menu management
│   │   ├── venue.json         # Venue configuration
│   │   ├── payment.json       # Payment providers
│   │   ├── inventory.json     # Inventory management
│   │   ├── settings.json      # Settings pages
│   │   ├── testing.json       # Testing features
│   │   └── superadmin.json    # Superadmin dashboard
│   ├── es/
│   │   ├── common.json
│   │   ├── sidebar.json
│   │   └── ... (mirrors en/ structure)
│   └── fr/
│       ├── common.json
│       └── ... (mirrors en/ structure)
└── i18n.ts                    # i18next configuration
```

#### i18n.ts Configuration Pattern

```typescript
// Import JSON files
import commonEn from '@/locales/en/common.json'
import commonEs from '@/locales/es/common.json'
import menuEn from '@/locales/en/menu.json'
import menuEs from '@/locales/es/menu.json'
// ... other imports

// Base namespace uses 'common' translations (not feature-specific)
const resources = {
  en: {
    translation: commonEn as Record<string, unknown>,
  },
  es: {
    translation: commonEs as Record<string, unknown>,
  },
  fr: {
    translation: commonFr as Record<string, unknown>,
  },
}

i18n
  .use(simpleDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en',
    supportedLngs: ['en', 'es', 'fr'],
    interpolation: {
      escapeValue: false,
    },
  })

// Register feature-specific namespaces
;(
  [
    ['en', menuEn],
    ['es', menuEs],
    ['fr', menuFr],
  ] as const
).forEach(([lng, bundle]) => {
  i18n.addResourceBundle(lng, 'menu', bundle as Record<string, unknown>, true, true)
})

// Repeat for other namespaces (venue, payment, inventory, etc.)
```

#### Component Usage Patterns

**Using default namespace (common):**

```typescript
import { useTranslation } from 'react-i18next'

function MyComponent() {
  const { t } = useTranslation() // Uses 'translation' (common.json)

  return (
    <div>
      <button>{t('save')}</button> {/* "Save" */}
      <button>{t('cancel')}</button> {/* "Cancel" */}
      <p>{t('optional')}</p> {/* "Optional" */}
    </div>
  )
}
```

**Using feature namespace:**

```typescript
import { useTranslation } from 'react-i18next'

function MenuPage() {
  const { t } = useTranslation('menu') // Uses menu.json namespace

  return (
    <div>
      <h1>{t('overview.title')}</h1> {/* "Menu Overview" */}
      <button>{t('categories.addButton')}</button> {/* "Add Category" */}
    </div>
  )
}
```

**Using multiple namespaces:**

```typescript
import { useTranslation } from 'react-i18next'

function ComplexComponent() {
  const { t } = useTranslation(['menu', 'common']) // Array of namespaces

  return (
    <div>
      {/* Explicit namespace prefix */}
      <h1>{t('menu:overview.title')}</h1> {/* "Menu Overview" */}
      <button>{t('common:save')}</button> {/* "Save" */}
      {/* Implicit - uses first namespace (menu) */}
      <p>{t('overview.subtitle')}</p> {/* "Manage products..." */}
    </div>
  )
}
```

#### JSON File Structure Best Practices

**common.json** (shared strings only):

```json
{
  "cancel": "Cancel",
  "save": "Save",
  "saving": "Saving...",
  "delete": "Delete",
  "deleting": "Deleting...",
  "success": "Success",
  "error": "Error",
  "optional": "Optional",
  "none": "None"
}
```

**menu.json** (feature-specific hierarchy):

```json
{
  "overview": {
    "title": "Menu Overview",
    "subtitle": "Manage products and categories"
  },
  "categories": {
    "title": "Categories",
    "addButton": "Add Category",
    "table": {
      "columns": {
        "name": "Name",
        "productsCount": "Products"
      }
    }
  },
  "products": {
    "title": "Products",
    "form": {
      "fields": {
        "name": "Name",
        "price": "Price"
      },
      "placeholders": {
        "name": "Enter product name..."
      },
      "validation": {
        "nameRequired": "Name is required",
        "pricePositive": "Price must be positive"
      }
    }
  },
  "toasts": {
    "createSuccess": "Product created successfully",
    "updateSuccess": "Product updated successfully",
    "deleteSuccess": "Product deleted successfully",
    "error": "Failed to save product"
  }
}
```

#### Critical Rules for JSON-Based i18n

**❌ WRONG - Base namespace using feature translations:**

```typescript
const resources = {
  en: {
    translation: superadminEn, // ❌ Only superadmin strings available globally!
  },
}
```

**✅ CORRECT - Base namespace using common translations:**

```typescript
const resources = {
  en: {
    translation: commonEn, // ✅ Common strings available everywhere
  },
}

// Then register superadmin as separate namespace
i18n.addResourceBundle('en', 'superadmin', superadminEn, true, true)
```

#### When to Split JSON Files

**Create separate namespace when:**

- Feature has 50+ translation keys
- Feature is self-contained (menu, venue, payment, inventory)
- Translations form logical hierarchy (page → sections → fields)

**Keep in common.json when:**

- Strings used across multiple features (buttons, validation, status labels)
- Fewer than 20 keys
- Generic UI components (dialogs, toasts, confirmations)

**Split large JSON files when:**

- Single JSON file exceeds 500 lines
- Multiple distinct sub-features exist (e.g., split `superadmin.json` into `home.json`, `analytics.json`, `profitAnalytics.json`)

#### Migration Checklist (TypeScript → JSON)

When converting hardcoded TypeScript translations to JSON files:

1. **Audit current state** - Check `i18n.ts` for embedded translation objects
2. **Create JSON structure** - Extract translations to `src/locales/[lang]/[feature].json`
3. **Import JSON files** - Add imports to `i18n.ts`
4. **Update base namespace** - Ensure `resources.translation` uses `common` (not feature-specific)
5. **Register namespaces** - Add `addResourceBundle()` for each feature namespace
6. **Update components** - Change `useTranslation()` to use correct namespace
7. **Verify completeness** - Ensure required languages (en, es) have matching keys
8. **Test language switching** - Verify UI updates correctly when language changes
9. **Build verification** - Run `npm run build` to catch missing translation errors

#### File Size Guidelines

**Target sizes:**

- `common.json`: < 50 keys (shared essentials only)
- Feature namespaces: 50-300 keys (menu, venue, payment, etc.)
- Large features: Split into sub-namespaces if > 500 keys

**Example refactoring:**

```
Before: superadmin.json (2,855 lines)
After:
  ├── common.json (14 lines)
  ├── superadmin/home.json (200 lines)
  ├── superadmin/analytics.json (150 lines)
  └── superadmin/profitAnalytics.json (180 lines)
```

#### Benefits of JSON-Based Architecture

- **Editor support**: JSON validation, autocomplete, and formatting
- **Version control**: Easier diffs and merge conflict resolution
- **Translation tools**: Compatible with Crowdin, Lokalise, POEditor
- **Type safety**: Can generate TypeScript types from JSON schemas
- **Smaller bundles**: Tree-shaking potential with dynamic imports
- **CI/CD checks**: Automated validation of missing keys across languages
- **Team collaboration**: Translators can work directly in JSON files without touching code

#### Common Pitfalls to Avoid

**❌ Mixing namespaces in base translation:**

```typescript
const resources = {
  en: {
    translation: { ...commonEn, ...menuEn, ...venueEn }, // ❌ Don't merge!
  },
}
```

**✅ Keep namespaces separate:**

```typescript
const resources = {
  en: { translation: commonEn }, // ✅ Only common
}
i18n.addResourceBundle('en', 'menu', menuEn)
i18n.addResourceBundle('en', 'venue', venueEn)
```

**❌ Hardcoding strings in JSON:**

```json
{
  "title": "Dashboard",
  "subtitle": "Welcome back, {{name}}" // ❌ Missing interpolation docs
}
```

**✅ Document interpolation:**

```json
{
  "title": "Dashboard",
  "subtitle": "Welcome back, {{name}}",
  "_subtitleComment": "{{name}} = User's first name"
}
```

#### Internationalization Best Practices Summary

1. **Always use JSON files** - No hardcoded strings in TypeScript
2. **Base namespace = common** - Feature namespaces separate
3. **Match all languages** - Every key in `en/` must exist in `es/` and `fr/`
4. **Use interpolation** - `t('greeting', { name })` not string concatenation
5. **Document complex keys** - Add `_comment` keys for translators
6. **Test language switching** - Verify UI in all supported languages
7. **Keep files focused** - One namespace per feature domain
8. **Split large files** - Maximum 500 lines per JSON file
