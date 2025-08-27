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

**EVERY user‑facing change requires complete i18n implementation.** This is not optional - it's a core requirement for ANY UI work. When creating, modifying, or updating any user interface element, i18n support MUST be included before the task is considered complete.

- Use `react-i18next` with `useTranslation()` and `t('...')` for every user‑visible string. Do not hardcode copy in components.
- Add translation keys for both English (`en`) and Spanish (`es`) in `src/i18n.ts` under the appropriate group (e.g., `header`, `sidebar`, `dashboard`, `revenue`, `featureMgmt`, `venueMgmt`, `detailsView`, `categories`, `featureStatuses`).
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

**CRITICAL**: When asked to create ANY UI element (component, dialog, form, button, etc.), i18n implementation is automatically part of that request. Never deliver UI work without complete translation support.
