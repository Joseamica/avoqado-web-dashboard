/**
 * ModuleProtectedRoute - Route guard for module-gated functionality
 *
 * Wraps routes that require a specific module to be enabled for the venue.
 * Supports two modes for role-based access:
 * 1. White-label mode: Uses `featureCode` to check permissions from white-label configuration
 * 2. Static mode: Uses `allowedRoles` for traditional role checking
 *
 * Usage:
 * ```tsx
 * // Module-only protection
 * <Route element={<ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY" />}>
 *   <Route path="playtelecom" element={<CommandCenter />} />
 * </Route>
 *
 * // White-label feature protection (recommended for white-label routes)
 * <Route element={<ModuleProtectedRoute requiredModule="WHITE_LABEL_DASHBOARD" featureCode="SUPERVISOR_DASHBOARD" />}>
 *   <Route path="supervisor" element={<SupervisorDashboard />} />
 * </Route>
 *
 * // Static role protection (fallback when white-label is not configured)
 * <Route element={<ModuleProtectedRoute requiredModule="SERIALIZED_INVENTORY" allowedRoles={['MANAGER', 'ADMIN', 'OWNER']} />}>
 *   <Route path="stores" element={<StoresAnalysis />} />
 * </Route>
 * ```
 */

import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useToast } from '@/hooks/use-toast'
import { useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { StaffRole } from '@/types'
import { useAccess } from '@/hooks/use-access'

interface ModuleProtectedRouteProps {
  /** Module code to check (e.g., 'SERIALIZED_INVENTORY', 'WHITE_LABEL_DASHBOARD') */
  requiredModule: string
  /** Optional: White-label feature code for permission checking (e.g., 'SUPERVISOR_DASHBOARD') */
  featureCode?: string
  /** Optional: Restrict to specific roles (fallback when white-label not configured) */
  allowedRoles?: StaffRole[]
  /** Optional: Additional permission check */
  permission?: string
}

export function ModuleProtectedRoute({ requiredModule, featureCode, allowedRoles, permission: _permission }: ModuleProtectedRouteProps) {
  const { checkModuleAccess, activeVenue, staffInfo, user, isLoading } = useAuth()
  const { canFeature, isLoading: isAccessLoading, role } = useAccess()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()
  const { toast } = useToast()
  const { t } = useTranslation()

  const isSuperAdmin = role === 'SUPERADMIN'

  // Check module access using checkModuleAccess (VenueModule table)
  const hasModuleAccess = checkModuleAccess(requiredModule)

  // Get effective role (venue-specific role from staffInfo)
  const effectiveRole = staffInfo?.role || user?.role

  // Check role access: prioritize white-label feature permissions over static allowedRoles
  const hasRoleAccess = useMemo(() => {
    // If featureCode is provided, use white-label access check
    // canFeature returns true if white-label is disabled (allowing normal dashboard mode)
    if (featureCode) {
      return canFeature(featureCode)
    }

    // Fallback to static allowedRoles if no featureCode
    return !allowedRoles || (effectiveRole && allowedRoles.includes(effectiveRole as StaffRole))
  }, [featureCode, canFeature, allowedRoles, effectiveRole])

  // Determine if we're waiting for venue or access to load
  // This prevents premature redirects when activeVenue or permissions haven't been set yet
  const isVenueLoading = isLoading || isAccessLoading || (slug && !activeVenue)

  // Show toast when redirecting due to missing module
  // Only show when we're NOT loading and activeVenue is set
  useEffect(() => {
    if (isSuperAdmin) return
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
  }, [isVenueLoading, isSuperAdmin, hasModuleAccess, requiredModule, activeVenue, toast, t])

  // Show toast when redirecting due to insufficient role
  useEffect(() => {
    if (isSuperAdmin) return
    if (!isVenueLoading && hasModuleAccess && !hasRoleAccess && activeVenue) {
      toast({
        title: t('common:access_denied', { defaultValue: 'Access denied' }),
        description: t('common:insufficient_role', {
          defaultValue: 'You do not have the required role to access this section.',
        }),
        variant: 'destructive',
      })
    }
  }, [isVenueLoading, isSuperAdmin, hasModuleAccess, hasRoleAccess, activeVenue, toast, t])

  // SUPERADMIN always has access to everything
  if (isSuperAdmin) {
    return <Outlet />
  }

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
