# Plan de Refactor: AuthContext World-Class Architecture

## Contexto del Proyecto

**Proyecto**: Avoqado - Dashboard multi-tenant para restaurantes/retail (similar a Square/Toast)
**Stack**: React 18 + TypeScript + Vite + TanStack Query + React Router v6
**Problema**: AuthContext es un "God Object" de 788 líneas que viola separación de responsabilidades

---

## 1. Estado Actual (Problema)

### AuthContext.tsx (788 líneas) hace TODO:

```typescript
interface AuthContextType {
  // Auth state
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  loginError: string | null

  // Auth mutations
  login: (data: LoginData) => void
  signup: (data: SignupData) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithOneTap: (credential: string) => Promise<void>
  logout: (returnTo?: string) => void
  clearLoginError: () => void

  // Venue state (NO DEBERÍA ESTAR AQUÍ)
  activeVenue: Venue | null
  allVenues: Venue[]

  // Venue operations (NO DEBERÍA ESTAR AQUÍ)
  switchVenue: (newVenueSlug: string) => Promise<void>
  authorizeVenue: (venueSlug: string) => boolean
  checkVenueAccess: (venueSlug: string) => boolean
  getVenueBySlug: (slug: string) => Venue | null
  getVenueBasePath: (venue: Venue) => string

  // Feature checks (NO DEBERÍA ESTAR AQUÍ)
  checkFeatureAccess: (featureCode: string) => boolean
  checkModuleAccess: (moduleCode: string) => boolean

  // Mixed concerns
  staffInfo: any | null
}
```

### Problemas Específicos:

1. **Race condition en login**: El redirect post-login compite entre `onSuccess` y `useEffect`
2. **Re-renders innecesarios**: Cambiar venue re-renderiza TODO lo que usa `useAuth`
3. **Difícil de testear**: 788 líneas con muchas dependencias
4. **Lógica de negocio en auth**: Venues, features, modules mezclados con auth
5. **Navigation imperativa**: Redirects hardcodeados en `onSuccess` del login

### Métricas de Impacto:
- 96 archivos usan `useAuth`
- 333 usos de funciones de venue (`activeVenue`, `switchVenue`, etc.)
- 73 archivos afectados por lógica de venue

---

## 2. Arquitectura Target (World-Class)

### Principios a Seguir:
- **Kent C. Dodds pattern**: Conditional rendering, no redirects imperativos
- **Auth0/Clerk pattern**: Auth provider puro, callbacks configurables
- **Single Responsibility**: Cada contexto hace UNA cosa

### Nueva Estructura de Contextos:

```
src/context/
├── AuthContext.tsx      (~150 líneas) - Solo auth state y mutations
├── VenueContext.tsx     (~200 líneas) - Venue state y operations
├── FeatureContext.tsx   (~100 líneas) - Feature/module checks
└── providers.tsx        (~50 líneas)  - Composición de providers
```

### Diagrama de Dependencias:

```
                    ┌─────────────────┐
                    │   AuthContext   │
                    │   (auth puro)   │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              ▼              ▼              ▼
    ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
    │  VenueContext   │ │ FeatureContext  │ │     App.tsx     │
    │ (depende auth)  │ │ (depende venue) │ │ (conditional    │
    │                 │ │                 │ │  rendering)     │
    └─────────────────┘ └─────────────────┘ └─────────────────┘
```

---

## 3. Cambios Específicos por Archivo

### FASE 1: Crear VenueContext (Nuevo Archivo)

**Archivo**: `src/context/VenueContext.tsx`

```typescript
// Responsabilidades ÚNICAS:
// - activeVenue state
// - allVenues (derived from user.venues)
// - switchVenue mutation
// - getVenueBasePath utility
// - authorizeVenue / checkVenueAccess

import { createContext, useContext, useState, useCallback, useMemo, ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { Venue } from '@/types'

interface VenueContextType {
  activeVenue: Venue | null
  allVenues: Venue[]
  switchVenue: (slug: string) => Promise<void>
  getVenueBasePath: (venue: Venue) => string
  getVenueBySlug: (slug: string) => Venue | null
  checkVenueAccess: (slug: string) => boolean
  authorizeVenue: (slug: string) => boolean
}

const VenueContext = createContext<VenueContextType | undefined>(undefined)

export const useVenue = (): VenueContextType => {
  const context = useContext(VenueContext)
  if (!context) {
    throw new Error('useVenue must be used within VenueProvider')
  }
  return context
}

export const VenueProvider = ({ children }: { children: ReactNode }) => {
  const { user, isAuthenticated } = useAuth()
  const [activeVenue, setActiveVenue] = useState<Venue | null>(null)

  // Derive allVenues from user
  const allVenues = useMemo(() => {
    if (!user) return []
    if (user.role === 'SUPERADMIN') {
      // SUPERADMIN logic - fetch all venues separately
      return user.venues || []
    }
    return user.venues || []
  }, [user])

  // ... rest of implementation moved from AuthContext
}
```

### FASE 2: Crear FeatureContext (Nuevo Archivo)

**Archivo**: `src/context/FeatureContext.tsx`

```typescript
// Responsabilidades ÚNICAS:
// - checkFeatureAccess (billing features)
// - checkModuleAccess (configurable modules)

import { createContext, useContext, useCallback, ReactNode } from 'react'
import { useVenue } from './VenueContext'

interface FeatureContextType {
  checkFeatureAccess: (featureCode: string) => boolean
  checkModuleAccess: (moduleCode: string) => boolean
}

const FeatureContext = createContext<FeatureContextType | undefined>(undefined)

export const useFeatures = (): FeatureContextType => {
  const context = useContext(FeatureContext)
  if (!context) {
    throw new Error('useFeatures must be used within FeatureProvider')
  }
  return context
}

export const FeatureProvider = ({ children }: { children: ReactNode }) => {
  const { activeVenue } = useVenue()

  const checkFeatureAccess = useCallback((featureCode: string): boolean => {
    if (!activeVenue?.features) return false
    const feature = activeVenue.features.find(f => f.feature.code === featureCode)
    return feature?.active ?? false
  }, [activeVenue?.features])

  const checkModuleAccess = useCallback((moduleCode: string): boolean => {
    if (!activeVenue?.modules) return false
    const module = activeVenue.modules.find(m => m.module.code === moduleCode)
    return module?.enabled ?? false
  }, [activeVenue?.modules])

  return (
    <FeatureContext.Provider value={{ checkFeatureAccess, checkModuleAccess }}>
      {children}
    </FeatureContext.Provider>
  )
}
```

### FASE 3: Simplificar AuthContext

**Archivo**: `src/context/AuthContext.tsx` (MODIFICAR - reducir de 788 a ~150 líneas)

```typescript
// ELIMINAR:
// - activeVenue, allVenues state
// - switchVenue, authorizeVenue, checkVenueAccess
// - getVenueBySlug, getVenueBasePath
// - checkFeatureAccess, checkModuleAccess
// - Redirects en onSuccess (mover a App.tsx)
// - staffInfo (mover a VenueContext o eliminar)

// MANTENER:
interface AuthContextType {
  isAuthenticated: boolean
  user: User | null
  isLoading: boolean
  loginError: string | null

  login: (data: LoginData) => void
  signup: (data: SignupData) => Promise<void>
  loginWithGoogle: () => Promise<void>
  loginWithOneTap: (credential: string) => Promise<void>
  logout: (returnTo?: string) => void
  clearLoginError: () => void
}

// Login mutation simplificado:
const loginMutation = useMutation({
  mutationFn: (credentials: LoginData) => authService.login(credentials),
  onSuccess: async (data) => {
    // SOLO refetch status y clear errors
    // NO navigation aquí
    await queryClient.refetchQueries({ queryKey: ['status'] })
    setLoginError(null)

    // Pending invitations se maneja con callback opcional
    if (data?.pendingInvitations?.length > 0) {
      onPendingInvitations?.(data.pendingInvitations)
    }
  },
  onError: (error) => {
    // Error handling (mantener igual)
  }
})
```

### FASE 4: Refactor App.tsx (Conditional Rendering)

**Archivo**: `src/App.tsx` o `src/root.tsx` (MODIFICAR)

```typescript
// PATRÓN KENT C. DODDS: Conditional rendering, NO redirects imperativos

function App() {
  const { isAuthenticated, isLoading, user } = useAuth()
  const { allVenues } = useVenue()

  // 1. Loading state
  if (isLoading) {
    return <LoadingScreen />
  }

  // 2. Not authenticated → show login/signup
  if (!isAuthenticated || !user) {
    return <UnauthenticatedApp />
  }

  // 3. SUPERADMIN → superadmin dashboard
  if (user.role === 'SUPERADMIN') {
    return <SuperadminApp />
  }

  // 4. No venues → onboarding
  if (allVenues.length === 0) {
    return <OnboardingApp />
  }

  // 5. Normal user with venues → venue dashboard
  return <AuthenticatedApp />
}

// Cada "App" maneja sus propias rutas
function UnauthenticatedApp() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/invite/:token" element={<InviteAccept />} />
      <Route path="/auth/*" element={<AuthRoutes />} />
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}

function AuthenticatedApp() {
  return (
    <VenueProvider>
      <FeatureProvider>
        <Routes>
          <Route path="/venues/:slug/*" element={<VenueLayout />} />
          <Route path="/wl/venues/:slug/*" element={<WhiteLabelLayout />} />
          <Route path="/organizations/:orgId/*" element={<OrgLayout />} />
          <Route path="*" element={<DefaultVenueRedirect />} />
        </Routes>
      </FeatureProvider>
    </VenueProvider>
  )
}
```

### FASE 5: Actualizar Imports en Archivos Consumidores

**Patrón de migración**:

```typescript
// ANTES (96 archivos)
import { useAuth } from '@/context/AuthContext'
const { activeVenue, checkFeatureAccess, isAuthenticated } = useAuth()

// DESPUÉS
import { useAuth } from '@/context/AuthContext'
import { useVenue } from '@/context/VenueContext'
import { useFeatures } from '@/context/FeatureContext'

const { isAuthenticated } = useAuth()
const { activeVenue } = useVenue()
const { checkFeatureAccess } = useFeatures()
```

**Archivos a modificar** (lista parcial de alto impacto):

| Archivo | Cambio |
|---------|--------|
| `src/components/Sidebar/app-sidebar.tsx` | useAuth → useAuth + useVenue |
| `src/components/Sidebar/venues-switcher.tsx` | useAuth → useVenue |
| `src/pages/Settings/RolePermissions.tsx` | useAuth → useVenue + useFeatures |
| `src/routes/FeatureProtectedRoute.tsx` | useAuth → useFeatures |
| `src/routes/ModuleProtectedRoute.tsx` | useAuth → useFeatures |
| `src/hooks/use-current-venue.tsx` | useAuth → useVenue |
| `src/pages/Order/Orders.tsx` | useAuth → useVenue |
| ... (~90 archivos más) | Similar pattern |

---

## 4. Orden de Ejecución

```
FASE 1 (3-4 horas)
├── Crear VenueContext.tsx
├── Mover lógica de venues desde AuthContext
├── Actualizar ~40 archivos que usan activeVenue/switchVenue
└── Tests de VenueContext

FASE 2 (1-2 horas)
├── Crear FeatureContext.tsx
├── Mover checkFeatureAccess/checkModuleAccess
├── Actualizar ~15 archivos que usan features
└── Tests de FeatureContext

FASE 3 (2-3 horas)
├── Simplificar AuthContext
├── Eliminar redirects de onSuccess
├── Crear callbacks configurables
└── Tests de AuthContext simplificado

FASE 4 (2-3 horas)
├── Refactor App.tsx con conditional rendering
├── Crear UnauthenticatedApp, AuthenticatedApp, etc.
├── Eliminar useEffect de routing en AuthContext
└── Integration tests

FASE 5 (2-3 horas)
├── Actualizar imports restantes
├── Fix TypeScript errors
├── Manual testing de todos los flujos
└── Code review
```

---

## 5. Archivos Nuevos a Crear

| Archivo | Líneas Est. | Descripción |
|---------|-------------|-------------|
| `src/context/VenueContext.tsx` | ~200 | Venue state y operations |
| `src/context/FeatureContext.tsx` | ~100 | Feature/module checks |
| `src/context/providers.tsx` | ~50 | Composición de providers |
| `src/apps/UnauthenticatedApp.tsx` | ~50 | Rutas para no autenticados |
| `src/apps/AuthenticatedApp.tsx` | ~80 | Rutas para autenticados |
| `src/apps/SuperadminApp.tsx` | ~50 | Rutas para superadmin |
| `src/apps/OnboardingApp.tsx` | ~30 | Rutas para onboarding |

---

## 6. Archivos a Modificar (Lista Completa)

### Críticos (routing/providers):
- `src/root.tsx`
- `src/App.tsx` (si existe)
- `src/context/AuthContext.tsx`
- `src/routes/router.tsx`

### Protected Routes:
- `src/routes/ProtectedRoute.tsx`
- `src/routes/AdminProtectedRoute.tsx`
- `src/routes/ManagerProtectedRoute.tsx`
- `src/routes/OwnerProtectedRoute.tsx`
- `src/routes/SuperProtectedRoute.tsx`
- `src/routes/FeatureProtectedRoute.tsx`
- `src/routes/ModuleProtectedRoute.tsx`
- `src/routes/KYCProtectedRoute.tsx`

### Sidebar/Navigation:
- `src/components/Sidebar/app-sidebar.tsx`
- `src/components/Sidebar/venues-switcher.tsx`
- `src/components/Sidebar/nav-user.tsx`

### Hooks:
- `src/hooks/use-current-venue.tsx`
- `src/hooks/use-current-organization.tsx`
- `src/hooks/usePermissions.ts`
- `src/hooks/useWhiteLabelConfig.ts`

### Pages (muestra):
- `src/pages/Order/Orders.tsx`
- `src/pages/Payment/Payments.tsx`
- `src/pages/Team/Teams.tsx`
- `src/pages/Settings/RolePermissions.tsx`
- ... (~80 archivos más)

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|--------------|------------|
| Regresiones en login flow | Alta | Tests exhaustivos antes y después |
| Romper venue switching | Media | Mantener backward compatibility temporal |
| Performance degradation | Baja | Memoization en nuevos contextos |
| Merge conflicts | Media | Hacer en branch dedicado, mergear rápido |

---

## 8. Criterios de Éxito

- [ ] AuthContext reducido a <200 líneas
- [ ] Zero race conditions en login
- [ ] Tests passing (unit + integration)
- [ ] Sin regresiones en flujos críticos:
  - [ ] Login normal → venue home
  - [ ] Login SUPERADMIN → /superadmin
  - [ ] Login sin venues → /onboarding
  - [ ] Login con pending invitations → /invite/:token
  - [ ] Venue switching
  - [ ] Feature/module gating
- [ ] Build passing sin warnings nuevos

---

## 9. Rollback Plan

Si algo sale mal:
1. Revertir PR completo
2. Hotfix actual sigue funcionando
3. Re-evaluar approach

---

## 10. Preguntas para Review

1. ¿Es correcto separar VenueContext de AuthContext o deberían estar juntos?
2. ¿El pattern de conditional rendering en App.tsx es mejor que route guards?
3. ¿Debería FeatureContext depender de VenueContext o recibir venue como prop?
4. ¿Hay algún edge case que no estoy considerando?
5. ¿El orden de ejecución de fases es correcto?

---

## Referencias

- [Kent C. Dodds - Authentication in React](https://kentcdodds.com/blog/authentication-in-react-applications)
- [Auth0 React SDK](https://github.com/auth0/auth0-react)
- [Clerk Provider](https://github.com/clerk/javascript)
- [XState Authentication](https://xstatebyexample.com/authentication/)
