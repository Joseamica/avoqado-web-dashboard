import { Navigate, useLocation, useParams } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

interface LegacyRedirectContext {
  fullBasePath: string
  params: Readonly<Record<string, string | undefined>>
}

interface LegacyRedirectProps {
  to: string | ((context: LegacyRedirectContext) => string)
  preserveSearchAndHash?: boolean
}

/**
 * Redirects a legacy venue-scoped path to its new home, preserving
 * white-label mode via fullBasePath. A string `to` is relative to the venue
 * root; a callback receives the base path and current route params.
 */
export default function LegacyRedirect({ to, preserveSearchAndHash = false }: LegacyRedirectProps) {
  const { fullBasePath } = useCurrentVenue()
  const params = useParams()
  const location = useLocation()
  const destination = typeof to === 'function' ? to({ fullBasePath, params }) : `${fullBasePath}/${to}`
  const suffix = preserveSearchAndHash ? `${location.search}${location.hash}` : ''

  return <Navigate to={`${destination}${suffix}`} replace />
}
