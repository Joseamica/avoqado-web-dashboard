# Architecture Overview

Complete architectural design of the Avoqado Web Dashboard.

## Tech Stack

- **Framework**: React 18 with TypeScript and Vite
- **Styling**: Tailwind CSS with Radix UI components
- **State Management**: TanStack Query for server state, React Context for global UI state
- **Routing**: React Router v6 with nested routes and protected routes
- **Backend**: Firebase authentication with Socket.io for real-time features
- **Forms**: React Hook Form with Zod validation

## Project Structure

```
src/
├── components/     # Reusable UI components and Radix UI wrappers
├── pages/         # Route components organized by feature (Menu, Orders, etc.)
├── context/       # React Context providers (Auth, Socket, Theme)
├── hooks/         # Custom React hooks and API hooks
├── services/      # API service functions and external integrations
├── routes/        # Router configuration and route protection
├── lib/           # Utility functions and shared libraries
├── locales/       # i18n JSON files (en/, es/, fr/)
└── types.ts       # Global TypeScript interfaces and enums
```

## Key Architecture Patterns

### Multi-tenant Venue System

The dashboard supports multiple venues per organization with isolated data and settings:

- **Routes**: Follow `/venues/:slug` pattern for venue-specific pages
- **Context Management**: AuthContext manages venue switching and access control
- **Venue Features**: Each venue has its own role-based permissions and feature flags
- **Data Isolation**: All API calls scoped to current venue: `/api/v1/dashboard/venues/{venueId}/{resource}`

**Example Flow:**
```
User logs in
  └─ Has access to 3 venues: "downtown", "uptown", "airport"
     └─ Navigates to /venues/downtown/menu
        └─ AuthContext sets activeVenue = downtown
           └─ All API calls now use venueId from downtown
              └─ User sees only downtown's menu
```

### State Management Strategy

**Server State (TanStack Query):**
- API data caching and automatic revalidation
- Optimistic updates for better UX
- Query invalidation on mutations
- Real-time sync with WebSocket events

**Global UI State (React Context):**
- `AuthContext` - Authentication, user info, venue switching
- `SocketContext` - WebSocket connection for live updates
- `ThemeContext` - Light/dark mode preference

**Component State:**
- Local UI state (modals, forms, filters)
- Ephemeral state that doesn't need persistence

**Real-time Updates:**
- SocketContext broadcasts events (new orders, payments)
- Components listen via `useSocketEvents` hook
- TanStack Query refetches data on socket events

**Example:**
```typescript
// Server state with TanStack Query
const { data: orders, refetch } = useQuery({
  queryKey: ['orders', venueId],
  queryFn: () => orderService.getOrders(venueId),
})

// Listen to real-time updates
useSocketEvents(venueId, (event) => {
  if (event.type === 'ORDER_CREATED') {
    refetch() // Sync with backend
  }
})
```

### API Service Pattern

**Centralized Configuration:**
- Base API client in `src/api.ts` (axios instance)
- Configured with `withCredentials: true` for cookie-based auth
- Automatic error handling and response transformation

**Service Layer:**
- Feature-specific service files: `menu.service.ts`, `auth.service.ts`, etc.
- Pure functions that return promises
- Consistent error handling

**Endpoint Structure:**
```
/api/v1/dashboard/
  ├── auth/          # Authentication (login, signup, status)
  ├── venues/:id/    # Venue-scoped resources
      ├── menu/
      ├── orders/
      ├── payments/
      ├── inventory/
      └── tpvs/
```

**Example Service:**
```typescript
// src/services/menu.service.ts
import api from '@/api'

export const getProducts = async (venueId: string) => {
  const response = await api.get(`/api/v1/dashboard/venues/${venueId}/products`)
  return response.data
}

export const createProduct = async (venueId: string, data: ProductInput) => {
  const response = await api.post(`/api/v1/dashboard/venues/${venueId}/products`, data)
  return response.data
}
```

## Data Models

### Core Entities

**Organization:**
- Multi-tenant container for venues
- Billing and subscription management
- Admin users with cross-venue access

**Venue:**
- Individual business location
- Unique slug for routing (`/venues/:slug`)
- Settings: timezone, currency, business hours
- Feature flags: inventory, chatbot, advanced analytics

**Staff:**
- User accounts with email/password or OAuth
- Multiple venue access with different roles
- Role-based permissions per venue
- Custom permission overrides

**Order:**
- Customer orders with line items
- Status tracking: PENDING → IN_PROGRESS → READY → COMPLETED
- Payment integration with multiple methods
- Table/QR/TPV source tracking

**Menu/Product:**
- Hierarchical structure: Categories → Products → Modifiers
- Recipe-based inventory tracking
- Dynamic pricing and availability
- Multi-language support

### Role Hierarchy

Roles determine default permissions (lowest to highest):

1. `VIEWER` - Read-only access to reports
2. `HOST` - Customer-facing operations (seating)
3. `WAITER` - Order and table management
4. `CASHIER` - Payment processing
5. `KITCHEN` - Kitchen display operations
6. `MANAGER` - Staff and shift management
7. `ADMIN` - Venue configuration
8. `OWNER` - Full venue access
9. `SUPERADMIN` - System-wide access across all venues

**Permission Inheritance:**
- Higher roles include all permissions from lower roles
- ADMIN, OWNER, SUPERADMIN have wildcard `*:*` (all permissions)
- Custom permissions can extend or override defaults

See [permissions.md](./permissions.md) for detailed permission system.

### Feature System

Venues can enable/disable features via database flags:

```typescript
interface VenueFeature {
  featureCode: string    // 'CHATBOT', 'INVENTORY', 'ADVANCED_ANALYTICS'
  active: boolean        // Feature enabled/disabled
  config?: any           // Feature-specific configuration
}
```

**Feature Check:**
```typescript
const { checkFeatureAccess } = useAuth()

if (checkFeatureAccess('INVENTORY')) {
  // Show inventory management UI
}
```

**Available Features:**
- `CHATBOT` - AI assistant for orders
- `INVENTORY` - Stock tracking and recipes
- `ADVANCED_ANALYTICS` - Detailed reports
- `LOYALTY_PROGRAM` - Customer rewards
- `MULTI_CURRENCY` - International payments

## Component Guidelines

### UI Components

**Radix UI Primitives:**
- Use components from `components/ui/` for accessibility
- Examples: `Dialog`, `DropdownMenu`, `Select`, `Tooltip`
- Always use keyboard navigation and ARIA labels

**Styling:**
- Tailwind CSS with theme-aware classes
- **NEVER hardcode colors** (e.g., `bg-gray-200`) - use `bg-muted`
- Use semantic tokens: `bg-background`, `text-foreground`, `border-border`
- See [theme.md](../features/theme.md) for complete guide

**Loading States:**
- Use `<Skeleton />` components while loading
- Show loading spinners for long operations
- Disable buttons during mutations

**Example:**
```typescript
import { Skeleton } from '@/components/ui/skeleton'

function ProductList() {
  const { data, isLoading } = useQuery(...)

  if (isLoading) {
    return <Skeleton className="h-20 w-full" />
  }

  return <DataTable data={data} />
}
```

### Form Patterns

**React Hook Form + Zod:**
- Define schema with Zod for validation
- Use `zodResolver` for integration
- Consistent error handling

**Example:**
```typescript
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  name: z.string().min(1, t('validation.nameRequired')),
  price: z.number().positive(),
})

function ProductForm() {
  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input {...register('name')} />
      {errors.name && <p>{errors.name.message}</p>}
    </form>
  )
}
```

**Best Practices:**
- Use `LoadingButton` for submit buttons
- Show validation errors inline
- Disable form during submission
- Toast notifications for success/error

### Data Display

**DataTable Component:**
- Built on TanStack Table v8
- Features: pagination, sorting, filtering, search
- **CRITICAL**: Always memoize data arrays (see [performance.md](../guides/performance.md))

**Example:**
```typescript
const columns = useMemo<ColumnDef<Product>[]>(() => [
  {
    accessorKey: 'name',
    header: t('columns.name'),
  },
  {
    accessorKey: 'price',
    header: t('columns.price'),
    cell: ({ cell }) => Currency(cell.getValue() as number),
  },
], [t])

const filteredData = useMemo(
  () => data?.filter(item => item.active),
  [data]
)

return (
  <DataTable
    data={filteredData}
    columns={columns}
    isLoading={isLoading}
    enableSearch={true}
  />
)
```

## Development Guidelines

### TypeScript Usage

**Strict Mode:**
- Enabled in `tsconfig.json`
- No implicit `any` types
- Null checking required

**Best Practices:**
- Use interfaces for object shapes (not `type`)
- Avoid enums - prefer union types or const assertions
- Use TypeScript inference where possible
- Define props with `interface ComponentProps`

**Example:**
```typescript
// ✅ GOOD
interface ProductCardProps {
  product: Product
  onEdit: (id: string) => void
  isLoading?: boolean
}

const ProductCard: React.FC<ProductCardProps> = ({ product, onEdit, isLoading = false }) => {
  // ...
}

// ❌ AVOID
type ProductCardProps = {
  product: any  // Don't use any
}

enum Status {  // Don't use enums
  ACTIVE,
  INACTIVE
}
```

### Code Organization

**Feature-Based Structure:**
- Group related files by feature (Menu, Orders, Inventory)
- Keep components close to where they're used
- Shared components in `src/components/`

**Naming Conventions:**
- Components: PascalCase (`ProductCard.tsx`)
- Hooks: camelCase with `use` prefix (`usePermissions.ts`)
- Services: camelCase with `.service.ts` suffix
- Utils: camelCase in `lib/` folder

**Import Organization:**
```typescript
// 1. External libraries
import React, { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

// 2. Internal imports (absolute paths with @/)
import { DataTable } from '@/components/data-table'
import { usePermissions } from '@/hooks/usePermissions'
import { productService } from '@/services/product.service'

// 3. Types
import { Product } from '@/types'
```

### API Integration

**TanStack Query Patterns:**

**Queries (Read Operations):**
```typescript
const { data, isLoading, error, refetch } = useQuery({
  queryKey: ['products', venueId],
  queryFn: () => productService.getProducts(venueId),
  staleTime: 5 * 60 * 1000, // 5 minutes
})
```

**Mutations (Write Operations):**
```typescript
const createMutation = useMutation({
  mutationFn: (data: ProductInput) => productService.create(venueId, data),
  onSuccess: () => {
    toast({ title: t('toast.success') })
    queryClient.invalidateQueries({ queryKey: ['products', venueId] })
  },
  onError: (error) => {
    toast({ title: t('toast.error'), variant: 'destructive' })
  },
})

// Usage
createMutation.mutate(formData)
```

**Cache Invalidation:**
- Invalidate queries after mutations
- Venue switching requires clearing all queries: `queryClient.clear()`
- Real-time updates trigger selective invalidation

**Error Handling:**
- Backend returns consistent error format
- Show user-friendly messages with toasts
- Log errors to console for debugging

## Testing Strategy

Currently no automated test suite configured. Quality maintained through:

- **TypeScript strict mode** - Catches type errors at compile time
- **ESLint** - Enforces code quality and best practices
- **Manual testing** - Comprehensive testing with dev server
- **Role-based testing** - Verify permissions work for all roles
- **Browser DevTools** - React DevTools, Network tab, Console

**Future Testing:**
- Vitest for unit tests
- React Testing Library for component tests
- Playwright for E2E tests

## Related Documentation

- [Routing System](./routing.md) - Route protection and navigation
- [Permission System](./permissions.md) - Granular access control
- [State Management](./state-management.md) - Detailed state patterns
- [Performance Guide](../guides/performance.md) - Optimization patterns
- [i18n Guide](../features/i18n.md) - Internationalization
