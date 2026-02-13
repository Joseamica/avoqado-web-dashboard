import { useParams, useLocation } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Venue } from '@/types'

interface UseCurrentVenueReturn {
  venue: Venue | null
  venueId: string | null
  venueSlug: string | null
  isLoading: boolean
  hasVenueAccess: boolean
  /** Whether we're in white-label mode (/wl/ routes) */
  isWhiteLabelMode: boolean
  /** Base path for venue routes: '/wl/venues' or '/venues' depending on current URL */
  venueBasePath: string
  /** Full base path including slug: '/wl/venues/{slug}' or '/venues/{slug}' */
  fullBasePath: string
}

export const useCurrentVenue = (): UseCurrentVenueReturn => {
  const params = useParams<{ slug?: string; venueSlug?: string }>()
  const location = useLocation()
  const venueSlugParam = params.venueSlug ?? params.slug ?? null
  const { activeVenue, getVenueBySlug, checkVenueAccess, isAuthenticated, isLoading: isAuthLoading } = useAuth()

  // URL slug takes priority to avoid stale venue context when path and activeVenue diverge.
  const venue = venueSlugParam ? getVenueBySlug(venueSlugParam) : activeVenue

  // Verificar si el usuario tiene acceso al venue actual
  const hasVenueAccess = !!venueSlugParam && isAuthenticated ? checkVenueAccess(venueSlugParam) : false

  // Detect white-label mode based on URL
  const isWhiteLabelMode = location.pathname.startsWith('/wl/')

  // Base path for venue routes (without slug)
  const venueBasePath = isWhiteLabelMode ? '/wl/venues' : '/venues'

  // Full base path including the venue slug
  const slug = venue?.slug || venueSlugParam || activeVenue?.slug || null
  const fullBasePath = slug ? `${venueBasePath}/${slug}` : venueBasePath

  // Loading when: we have a slug AND either auth is still loading OR venue access confirmed but object not resolved.
  // The isAuthLoading check prevents the "Access Denied" flash on hard refresh — during optimistic auth render,
  // user.venues hasn't been populated yet so checkVenueAccess returns false prematurely.
  const isLoading = !!venueSlugParam && (isAuthLoading || (isAuthenticated && !venue && hasVenueAccess))

  return {
    venue,
    venueId: venue?.id || null,
    venueSlug: slug,
    isLoading,
    hasVenueAccess,
    isWhiteLabelMode,
    venueBasePath,
    fullBasePath,
  }
}
