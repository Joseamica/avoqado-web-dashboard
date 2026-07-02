import { Navigate } from 'react-router-dom'
import { useCurrentVenue } from '@/hooks/use-current-venue'

/**
 * Redirects a legacy venue-scoped path to its new home, preserving
 * white-label mode via fullBasePath. `to` is relative to the venue root
 * (e.g. "settings/profile").
 */
export default function LegacyRedirect({ to }: { to: string }) {
  const { fullBasePath } = useCurrentVenue()
  return <Navigate to={`${fullBasePath}/${to}`} replace />
}
