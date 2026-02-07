/**
 * KYCProtectedRoute - Route guard for operational features
 *
 * Wraps routes that require KYC verification (Orders, Payments, TPV, Shifts, Analytics, Inventory).
 * Redirects to KYCSetupRequired page if venue's KYC status is not VERIFIED.
 *
 * RULES:
 * - Demo venues: Always allowed (bypass KYC check)
 * - VERIFIED venues: Full access
 * - PENDING_REVIEW / IN_REVIEW / REJECTED / null: Blocked → redirect
 *
 * Usage:
 * ```tsx
 * <Route element={<KYCProtectedRoute />}>
 *   <Route path="orders" element={<Orders />} />
 *   <Route path="payments" element={<Payments />} />
 *   <Route path="tpv" element={<TPV />} />
 * </Route>
 * ```
 */

import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { canAccessOperationalFeatures } from '@/lib/kyc-utils'
import { StaffRole } from '@/types'

export function KYCProtectedRoute() {
  const { activeVenue, user } = useAuth()
  const location = useLocation()
  const { slug } = useParams<{ slug: string }>()

  // SUPERADMIN bypass: global operational access for audit/recovery tasks.
  if (user?.role === StaffRole.SUPERADMIN) {
    return <Outlet />
  }

  const isWhiteLabelVenueRoute = location.pathname.startsWith('/wl/venues/')
  const kycRequiredPath = slug
    ? isWhiteLabelVenueRoute
      ? `/wl/venues/${slug}/kyc-required`
      : `/venues/${slug}/kyc-required`
    : '/kyc-required'

  // Check if venue can access operational features
  if (!canAccessOperationalFeatures(activeVenue)) {
    // Redirect to KYC setup required page
    // Preserve current location in state for potential redirect back after KYC completion
    return (
      <Navigate
        to={kycRequiredPath}
        replace
        state={{ from: `${location.pathname}${location.search}` }}
      />
    )
  }

  // Venue has access - render nested routes
  return <Outlet />
}
