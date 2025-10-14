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

- `ProtectedRoute`: Requires authentication
- `AdminProtectedRoute`: Requires admin-level access with role checking
- `SuperProtectedRoute`: Requires OWNER role or higher
- Routes are nested with role-based access control

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

### Deployment Notes

- Built artifacts in `dist/` directory
- Static assets served from `public/`
- Production build requires environment variables
- Firebase authentication requires proper domain configuration

## 📦 Inventory Management System

### Overview

The inventory management system tracks raw materials, recipes, stock batches, and provides FIFO (First-In-First-Out) inventory costing. This is a **core business feature** that automatically deducts stock when orders are paid.

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

**Important:** The dashboard displays inventory data but does NOT trigger deductions directly. Stock deduction happens automatically on the **backend** when an order is fully paid.

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

| Field | Description | Required | Notes |
|-------|-------------|----------|-------|
| `name` | Ingredient name | ✅ | e.g., "Hamburger Buns" |
| `sku` | Stock keeping unit | ✅ | Unique identifier |
| `category` | Ingredient category | ✅ | MEAT, DAIRY, VEGETABLES, etc. |
| `unit` | Measurement unit | ✅ | KILOGRAM, LITER, UNIT, etc. |
| `currentStock` | Current quantity | ✅ | Auto-calculated from batches |
| `minimumStock` | Safety stock level | ✅ | Alert threshold |
| `reorderPoint` | Reorder trigger | ✅ | When to reorder |
| `costPerUnit` | Purchase cost | ✅ | Used in recipe costing |
| `perishable` | Has expiration? | ⬜ | Enables batch tracking |
| `shelfLifeDays` | Days until expiry | ⬜ | Auto-calculates batch expiration |

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
const recipeCost = recipe.lines.reduce((sum, line) =>
  sum + (line.quantity * line.rawMaterial.costPerUnit), 0
)

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
t('rawMaterials.add')                    // "Add Raw Material"
t('rawMaterials.fields.shelfLifeDays')   // "Shelf Life (days)"
t('rawMaterials.fieldHelp.unit')         // Help text for unit field
t('recipes.ingredients.quantity')         // "Quantity"
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

To improve maintainability and reduce the size of the central `i18n.ts` file, translations are organized using **namespaces** for large feature domains. This approach creates modular, self-contained translation bundles that are dynamically registered.

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
};
```

**2. Register namespace in `i18n.ts`:**

```typescript
import { menuTranslations } from './i18n/namespaces/menu';

// After i18n initialization
i18n.addResourceBundle('en', 'menu', menuTranslations.en.menu);
i18n.addResourceBundle('es', 'menu', menuTranslations.es.menu);
```

**3. Use namespace in components:**

```typescript
// Before (default namespace):
const { t } = useTranslation();
return <h1>{t('menu.overview.title')}</h1>;

// After (menu namespace):
const { t } = useTranslation('menu');
return <h1>{t('overview.title')}</h1>;  // Simplified key path
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
