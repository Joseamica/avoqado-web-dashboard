import { useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { useQuery } from '@tanstack/react-query'
import { getOrganizationStats, OrganizationStats } from '@/services/organization.service'
import { useCurrentVenue } from './use-current-venue'

interface UseCurrentOrganizationReturn {
  organization: OrganizationStats | null
  orgId: string | null
  isLoading: boolean
  isOwner: boolean
  error: Error | null
}

/**
 * Hook to get the current organization context.
 *
 * - In /organizations/:orgId/* routes: uses the orgId from URL params
 * - In /venues/:slug/* routes: uses the venue's organizationId or user's organizationId
 *
 * Only returns data for OWNER or SUPERADMIN users.
 */
export const useCurrentOrganization = (): UseCurrentOrganizationReturn => {
  const params = useParams<{ orgId?: string }>()
  const { user, isAuthenticated } = useAuth()
  const { venue } = useCurrentVenue()

  // Get orgId from URL params (organization routes) or from venue/user context (venue routes)
  const orgIdFromUrl = params.orgId
  const orgIdFromVenue = venue?.organizationId
  const orgIdFromUser = user?.organizationId

  // Priority: URL param > venue's org > user's org
  const orgId = orgIdFromUrl || orgIdFromVenue || orgIdFromUser || null

  // Check if user is OWNER or SUPERADMIN
  const isOwner = user?.role === 'OWNER' || user?.role === 'SUPERADMIN'

  // Only fetch organization stats if:
  // 1. User is authenticated
  // 2. User is OWNER or SUPERADMIN
  // 3. We have an orgId
  const shouldFetch = isAuthenticated && isOwner && !!orgId

  const {
    data: organization,
    isLoading,
    error,
  } = useQuery({
    queryKey: ['organization', 'stats', orgId],
    queryFn: () => getOrganizationStats(orgId!),
    enabled: shouldFetch,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  return {
    organization: organization || null,
    orgId,
    isLoading: shouldFetch && isLoading,
    isOwner,
    error: error as Error | null,
  }
}
