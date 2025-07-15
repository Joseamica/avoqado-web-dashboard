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
  const { venueSlug } = useParams<{ venueSlug: string }>()
  const { activeVenue, getVenueBySlug, checkVenueAccess, isAuthenticated } = useAuth()

  // Si no hay activeVenue en el contexto, intentar obtenerlo por slug
  const venue = activeVenue || (venueSlug ? getVenueBySlug(venueSlug) : null)

  // Verificar si el usuario tiene acceso al venue actual
  const hasVenueAccess = venueSlug && isAuthenticated ? checkVenueAccess(venueSlug) : false

  return {
    venue,
    venueId: venue?.id || null,
    venueSlug: venue?.slug || null,
    isLoading: !venue && !!venueSlug, // Está cargando si hay slug pero no venue
    hasVenueAccess,
  }
}
