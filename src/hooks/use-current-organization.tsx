import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationStats, OrganizationStats, OrganizationVenue, getOrganizationVenues } from '@/services/organization.service'
import { useCurrentVenue } from './use-current-venue'
import { StaffRole } from '@/types'

interface UseCurrentOrganizationReturn {
  organization: OrganizationStats | null
  orgId: string | null
  /** Organization slug for URL routing (from /wl/organizations/:orgSlug routes) */
  orgSlug: string | null
  /** Base path for organization-level navigation: '/wl/organizations/{orgSlug}' */
  basePath: string
  /** List of venues in this organization (for venue selector) */
  venues: OrganizationVenue[]
  isLoading: boolean
  isOwner: boolean
  error: Error | null
}

/**
 * Hook to get the current organization context.
 *
 * Route patterns supported:
 * - /wl/organizations/:orgSlug/* - Organization-level white-label routes (NEW)
 * - /organizations/:orgId/* - Legacy organization routes (by ID)
 * - /venues/:slug/* - Uses venue's organizationId
 *
 * Returns:
 * - organization: Basic org stats
 * - orgId: Organization UUID
 * - orgSlug: URL-friendly slug (from route params or org data)
 * - basePath: For navigation: '/wl/organizations/{orgSlug}'
 * - venues: List of venues for selector
 *
 * Only returns data for OWNER or SUPERADMIN users.
 *
 * @example
 * ```tsx
 * const { basePath, venues, orgSlug } = useCurrentOrganization()
 * // Navigate to venues list
 * navigate(`${basePath}/venues`)
 * // Navigate to specific venue
 * navigate(`/wl/venues/${selectedVenue.slug}`)
 * ```
 */
export const useCurrentOrganization = (): UseCurrentOrganizationReturn => {
  const params = useParams<{ orgId?: string; orgSlug?: string }>()
  const location = useLocation()
  const { user, isAuthenticated, staffInfo: _staffInfo, allVenues } = useAuth()
  const { venue } = useCurrentVenue()

  // Get orgSlug from URL params (new /wl/organizations/:orgSlug routes)
  const orgSlugFromUrl = params.orgSlug

  // Get orgId from URL params (legacy /organizations/:orgId routes) or from venue/user context
  const orgIdFromUrl = params.orgId
  const orgIdFromVenue = venue?.organizationId
  const orgIdFromUser = user?.organizationId

  // Priority: URL param > venue's org > user's org
  const orgId = orgIdFromUrl || orgIdFromVenue || orgIdFromUser || null

  // Check if we're on an organization route (not a venue route)
  const _isOnOrgRoute = location.pathname.startsWith('/organizations/') || location.pathname.startsWith('/wl/organizations/')

  // TWO DIFFERENT ROLE CHECKS:
  // 1. isOwner (user.role): For UI decisions like venue grouping in switcher
  //    - Based on user's HIGHEST role across all venues
  //    - A user who is OWNER somewhere should see all their venues grouped
  // 2. canFetchOrgData: For API call permissions
  //    - If on org route: Check if user is OWNER in the TARGET organization
  //    - If on venue route: Check current venue's role
  const isOwner = !!user?.role && (user.role === 'OWNER' || user.role === 'SUPERADMIN')

  // Check if user is SUPERADMIN
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  // Check if user is OWNER in the organization being viewed (for org routes)
  const isOwnerInTargetOrg = orgId ? allVenues.some(
    v => v.organizationId === orgId && v.role === StaffRole.OWNER
  ) : false

  // For API calls, determine if we can fetch org data:
  // - SUPERADMIN can always fetch
  // - Others: must be OWNER in the TARGET organization (checked via allVenues)
  // IMPORTANT: We always use isOwnerInTargetOrg instead of currentVenueRole because:
  // - staffInfo might not be loaded yet (race condition)
  // - user.role is the HIGHEST role across all venues, not the current venue's role
  // - allVenues is always available from AuthContext and contains accurate role per venue
  const canFetchOrgData = isSuperadmin || isOwnerInTargetOrg

  // Only fetch organization stats if:
  // 1. User is authenticated
  // 2. User has permission to fetch org data for this organization
  // 3. We have an orgId or orgSlug
  const shouldFetch = isAuthenticated && canFetchOrgData && (!!orgId || !!orgSlugFromUrl)

  // Fetch organization stats
  const {
    data: organization,
    isLoading: isLoadingOrg,
    error: orgError,
  } = useQuery({
    queryKey: ['organization', 'stats', orgId || orgSlugFromUrl],
    queryFn: () => getOrganizationStats(orgId!),
    enabled: shouldFetch && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Fetch organization venues (for venue selector)
  const {
    data: venues,
    isLoading: isLoadingVenues,
  } = useQuery({
    queryKey: ['organization', 'venues', orgId || orgSlugFromUrl],
    queryFn: () => getOrganizationVenues(orgId!),
    enabled: shouldFetch && !!orgId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  // Determine orgSlug: from URL or from organization data (future: when org has slug field)
  // For now, use URL param or fall back to orgId
  const orgSlug = orgSlugFromUrl || orgId

  // Build base path for organization-level navigation
  // If we're in /wl/organizations/:orgSlug, use that pattern
  // Otherwise use legacy /organizations/:orgId pattern
  const isNewOrgRoute = location.pathname.startsWith('/wl/organizations/')
  const basePath = isNewOrgRoute && orgSlug
    ? `/wl/organizations/${orgSlug}`
    : orgId
      ? `/organizations/${orgId}`
      : '/organizations'

  return {
    organization: organization || null,
    orgId,
    orgSlug,
    basePath,
    venues: venues || [],
    isLoading: shouldFetch && (isLoadingOrg || isLoadingVenues),
    isOwner,
    error: orgError as Error | null,
  }
}
