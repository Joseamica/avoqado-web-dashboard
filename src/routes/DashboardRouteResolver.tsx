import { LoadingScreen } from '@/components/spinner'
import { useAuth } from '@/context/AuthContext'
import type { SessionVenue, Venue } from '@/types'
import { Navigate, useLocation } from 'react-router-dom'

type DashboardVenue = SessionVenue | Venue

const roleHierarchy: Record<string, number> = {
  SUPERADMIN: 100,
  OWNER: 90,
  ADMIN: 80,
  MANAGER: 70,
  CASHIER: 60,
  WAITER: 50,
  KITCHEN: 40,
  HOST: 30,
  VIEWER: 10,
}

function getRequestedRoute(pathname: string) {
  const rawRoute = pathname.replace(/^\/go\/?/, '')

  return rawRoute
    .split('/')
    .map(segment => segment.trim())
    .filter(segment => segment && segment !== '.' && segment !== '..')
    .join('/')
}

function pickDefaultVenue(userVenues: DashboardVenue[], allVenues: DashboardVenue[]) {
  const accessibleVenues = userVenues.length > 0 ? userVenues : allVenues
  const lastUsedSlug = localStorage.getItem('avoqado_current_venue_slug')

  if (lastUsedSlug) {
    const lastUsedVenue = accessibleVenues.find(venue => venue.slug === lastUsedSlug)
    if (lastUsedVenue) return lastUsedVenue
  }

  const sortedByRole = [...accessibleVenues].sort((a, b) => {
    const roleA = roleHierarchy[a.role ?? ''] ?? 0
    const roleB = roleHierarchy[b.role ?? ''] ?? 0
    return roleB - roleA
  })

  return sortedByRole[0] ?? null
}

export function DashboardRouteResolver() {
  const { user, allVenues, getVenueBasePath, isLoading } = useAuth()
  const location = useLocation()

  if (isLoading || !user) {
    return <LoadingScreen message="Abriendo Dashboard..." />
  }

  const route = getRequestedRoute(location.pathname) || 'home'

  if (route === 'login') {
    return <Navigate to="/login" replace />
  }

  const userVenues = user.role === 'SUPERADMIN' ? [] : user.venues ?? []
  const defaultVenue = pickDefaultVenue(userVenues, allVenues)

  if (!defaultVenue) {
    return <Navigate to={user.role === 'SUPERADMIN' ? '/superadmin' : '/venues/new'} replace />
  }

  return <Navigate to={`${getVenueBasePath(defaultVenue)}/${route}${location.search}${location.hash}`} replace />
}
