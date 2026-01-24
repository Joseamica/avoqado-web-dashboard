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

export function ModuleProtectedRoute({ requiredModule, allowedRoles, permission: _permission }: ModuleProtectedRouteProps) {
  const { checkModuleAccess, activeVenue, staffInfo, user, isLoading } = useAuth()
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

  // Determine if we're waiting for venue to load
  // This prevents premature redirects when activeVenue hasn't been set yet
  const isVenueLoading = isLoading || (slug && !activeVenue)

  // Show toast when redirecting due to missing module
  // Only show when we're NOT loading and activeVenue is set
  useEffect(() => {
    if (!isVenueLoading && !hasModuleAccess && activeVenue) {
      toast({
        title: t('common:module_not_available', { defaultValue: 'Module not available' }),
        description: t('common:module_not_available_desc', {
          module: requiredModule,
          defaultValue: 'This module is not enabled for your venue. Please contact support to activate it.',
        }),
        variant: 'destructive',
      })
    }
  }, [isVenueLoading, hasModuleAccess, requiredModule, activeVenue, toast, t])

  // Show toast when redirecting due to insufficient role
  useEffect(() => {
    if (!isVenueLoading && hasModuleAccess && !hasRoleAccess && activeVenue) {
      toast({
        title: t('common:access_denied', { defaultValue: 'Access denied' }),
        description: t('common:insufficient_role', {
          defaultValue: 'You do not have the required role to access this section.',
        }),
        variant: 'destructive',
      })
    }
  }, [isVenueLoading, hasModuleAccess, hasRoleAccess, activeVenue, toast, t])

  // Show loading state while venue is being resolved
  // This prevents redirecting before we know if the module is enabled
  if (isVenueLoading) {
    return (
      <div className="flex items-center justify-center min-h-[200px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  // Redirect to venue home if module is not enabled
  if (!hasModuleAccess) {
    return <Navigate to={`/venues/${slug || activeVenue?.slug}/home`} replace state={{ from: location.pathname }} />
  }

  // Redirect to playtelecom root if role is not allowed
  if (!hasRoleAccess) {
    return <Navigate to={`/venues/${slug || activeVenue?.slug}/playtelecom`} replace state={{ from: location.pathname }} />
  }

  // Module is enabled and role is allowed - render nested routes
  return <Outlet />
}
