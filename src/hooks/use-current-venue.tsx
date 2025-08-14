import { useParams } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { Venue } from '@/types'

interface UseCurrentVenueReturn {
  venue: Venue | null
  venueId: string | null
  venueSlug: string | null
  isLoading: boolean
  hasVenueAccess: boolean
}

export const useCurrentVenue = (): UseCurrentVenueReturn => {
  const params = useParams<{ slug?: string; venueSlug?: string }>()
  const venueSlugParam = params.venueSlug ?? params.slug ?? null
  const { activeVenue, getVenueBySlug, checkVenueAccess, isAuthenticated } = useAuth()

  // Si no hay activeVenue en el contexto, intentar obtenerlo por slug
  const venue = activeVenue || (venueSlugParam ? getVenueBySlug(venueSlugParam) : null)

  // Verificar si el usuario tiene acceso al venue actual
  const hasVenueAccess = !!venueSlugParam && isAuthenticated ? checkVenueAccess(venueSlugParam) : false

  return {
    venue,
    venueId: venue?.id || null,
    venueSlug: venue?.slug || null,
    isLoading: !venue && !!venueSlugParam, // Está cargando si hay slug pero no venue
    hasVenueAccess,
  }
}
