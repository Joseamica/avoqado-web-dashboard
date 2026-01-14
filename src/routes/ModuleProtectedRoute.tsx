/**
 * ModuleProtectedRoute - Route guard for module-gated functionality
 *
 * Wraps routes that require a specific module to be enabled for the venue.
 * Optionally restricts access to specific roles.
 * Redirects to home page with toast notification if module is not enabled or role is not allowed.
 *
 * Usage:
 * ```tsx
 * // Module-only protection
 * <Route element={<ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY" />}>
 *   <Route path="playtelecom" element={<CommandCenter />} />
 * </Route>
 *
 * // Module + Role protection
 * <Route element={<ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY" allowedRoles={['MANAGER', 'ADMIN', 'OWNER']} />}>
 *   <Route path="stores" element={<StoresAnalysis />} />
 * </Route>
 * ```
 */

import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { StaffRole } from '@/types'

interface ModuleProtectedRouteProps {
  /** Module code to check (e.g., 'SERIALIZED_INVENTORY') */
  requiredModule: string
  /** Optional: Restrict to specific roles */
  allowedRoles?: StaffRole[]
  /** Optional: Additional permission check */
  permission?: string
}

export function ModuleProtectedRoute({
  requiredModule,
  allowedRoles,
  permission,
}: ModuleProtectedRouteProps) {
  const { checkModuleAccess, activeVenue, staffInfo, user } = useAuth()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { toast } = useToast()
  const { t } = useTranslation()

  // Check module access using checkModuleAccess (VenueModule table)
  const hasModuleAccess = checkModuleAccess(requiredModule)

  // Get effective role (venue-specific role from staffInfo)
  const effectiveRole = staffInfo?.role || user?.role

  // Check role access if allowedRoles specified
  const hasRoleAccess = !allowedRoles || (effectiveRole && allowedRoles.includes(effectiveRole as StaffRole))

  // Debug logging
  console.log('[ModuleProtectedRoute]', {
    requiredModule,
    hasModuleAccess,
    allowedRoles,
    effectiveRole,
    hasRoleAccess,
    activeVenueModules: activeVenue?.modules,
    path: location.pathname,
  })

  // Show toast when redirecting due to missing module
  useEffect(() => {
    if (!hasModuleAccess && activeVenue) {
      toast({
        title: t('common:module_not_available', { defaultValue: 'Module not available' }),
        description: t('common:module_not_available_desc', {
          module: requiredModule,
          defaultValue: 'This module is not enabled for your venue. Please contact support to activate it.',
        }),
        variant: 'destructive',
      })
    }
  }, [hasModuleAccess, requiredModule, activeVenue, toast, t])

  // Show toast when redirecting due to insufficient role
  useEffect(() => {
    if (hasModuleAccess && !hasRoleAccess && activeVenue) {
      toast({
        title: t('common:access_denied', { defaultValue: 'Access denied' }),
        description: t('common:insufficient_role', {
          defaultValue: 'You do not have the required role to access this section.',
        }),
        variant: 'destructive',
      })
    }
  }, [hasModuleAccess, hasRoleAccess, activeVenue, toast, t])

  // Redirect to venue home if module is not enabled
  if (!hasModuleAccess) {
    return (
      <Navigate
        to={`/venues/${slug || activeVenue?.slug}/home`}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  // Redirect to playtelecom root if role is not allowed
  if (!hasRoleAccess) {
    return (
      <Navigate
        to={`/venues/${slug || activeVenue?.slug}/playtelecom`}
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  // Module is enabled and role is allowed - render nested routes
  return <Outlet />
}
