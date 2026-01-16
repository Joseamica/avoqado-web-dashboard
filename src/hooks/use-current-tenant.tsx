/**
 * useCurrentTenant Hook
 *
 * Determines the current tenant context based on URL path.
 * Use this hook in layouts and headers where you need to detect
 * whether the user is in organization mode or venue mode.
 *
 * Hook Responsibilities (from plan):
 * - useCurrentTenant() - For routing/layout decisions ONLY
 * - useCurrentVenue() - For venue-level pages (existing)
 * - useCurrentOrganization() - For org-level pages (separate hook)
 *
 * URL Patterns:
 * - /wl/organizations/:orgSlug/* → Organization mode
 * - /wl/venues/:slug/* → Venue mode (white-label)
 * - /venues/:slug/* → Venue mode (standard)
 */

import { useLocation } from 'react-router-dom'

export type TenantType = 'organization' | 'venue'

interface UseCurrentTenantReturn {
  /** The type of tenant context: 'organization' or 'venue' */
  tenantType: TenantType
  /** Whether we're in organization-level routes (/wl/organizations/*) */
  isOrganizationMode: boolean
  /** Whether we're in venue-level routes (/venues/* or /wl/venues/*) */
  isVenueMode: boolean
  /** Whether we're in any white-label route (/wl/*) */
  isWhiteLabelMode: boolean
  /** The org slug if in organization mode, null otherwise */
  orgSlug: string | null
}

/**
 * Hook to determine current tenant context based on URL.
 *
 * Use when: Determining which layout to show, conditional rendering based on context
 *
 * @example
 * ```tsx
 * const { tenantType, isOrganizationMode, isVenueMode } = useCurrentTenant()
 *
 * if (isOrganizationMode) {
 *   return <OrganizationLayout />
 * }
 * return <VenueLayout />
 * ```
 */
export function useCurrentTenant(): UseCurrentTenantReturn {
  const location = useLocation()
  const pathname = location.pathname

  // Check if we're in organization mode: /wl/organizations/:orgSlug/*
  const orgMatch = pathname.match(/^\/wl\/organizations\/([^/]+)/)
  const isOrganizationMode = !!orgMatch
  const orgSlug = orgMatch ? orgMatch[1] : null

  // Check if we're in venue mode: /venues/:slug/* or /wl/venues/:slug/*
  const isVenueMode =
    pathname.startsWith('/venues/') ||
    pathname.startsWith('/wl/venues/') ||
    // Legacy pattern: /wl/:slug (will be deprecated)
    (pathname.startsWith('/wl/') && !pathname.startsWith('/wl/organizations/') && !pathname.startsWith('/wl/venues/'))

  // Check if we're in any white-label route
  const isWhiteLabelMode = pathname.startsWith('/wl/')

  // Determine tenant type
  const tenantType: TenantType = isOrganizationMode ? 'organization' : 'venue'

  return {
    tenantType,
    isOrganizationMode,
    isVenueMode,
    isWhiteLabelMode,
    orgSlug,
  }
}
