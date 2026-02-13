import { Separator } from '@radix-ui/react-separator'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppSidebar } from './components/Sidebar/app-sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { ThemeToggle } from './components/theme-toggle'
import { useAuth } from './context/AuthContext'
import { useEffect, useState } from 'react'
import { ChatBubble } from './components/Chatbot'
import { DemoBanner } from './components/DemoBanner'
import { TrialStatusBanner } from './components/TrialStatusBanner'
import { PaymentSetupAlert } from './components/PaymentSetupAlert'
import { VenueSuspendedScreen } from './components/VenueSuspendedScreen'
import { StaffRole } from './types'
import { useCurrentVenue } from './hooks/use-current-venue'
import { Button } from './components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'
import NotificationBell from './components/notifications/NotificationBell'
import LanguageSwitcher from './components/language-switcher'
import { useTranslation } from 'react-i18next'
import { BreadcrumbProvider, useBreadcrumb } from './context/BreadcrumbContext'
import { ChatReferencesProvider } from './context/ChatReferencesContext'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import api from './api'

// Route segment -> i18n key mapping
const routeKeyMap: Record<string, string> = {
  payments: 'sidebar:routes.payments',
  orders: 'sidebar:routes.orders',
  home: 'sidebar:routes.home',
  menu: 'sidebar:routes.menu',
  settings: 'sidebar:routes.settings',
  shifts: 'sidebar:routes.shifts',
  categories: 'sidebar:routes.categories',
  products: 'sidebar:routes.products',
  users: 'sidebar:routes.users',
  waiters: 'sidebar:routes.waiters',
  tpv: 'sidebar:routes.tpv',
  overview: 'sidebar:routes.overview',
  menumaker: 'sidebar:routes.menumaker',
  editvenue: 'sidebar:routes.editvenue',
}

function DashboardContent() {
  const { t } = useTranslation()
  const location = useLocation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { user, authorizeVenue, allVenues, checkFeatureAccess } = useAuth()
  const { venue, venueSlug, isLoading, hasVenueAccess } = useCurrentVenue()
  const { customSegments } = useBreadcrumb()

  // Record the last venue slug where the user had access, to recover from invalid deep links.
  const [lastAccessibleVenueSlug, setLastAccessibleVenueSlug] = useState<string | null>(null)

  // SUPERADMIN tiene acceso global entre venues; OWNER queda limitado a su scope backend.
  const hasGlobalVenueAccess = user?.role === StaffRole.SUPERADMIN

  // Cuando el usuario accede a un venue al que tiene permisos, recordarlo como último válido
  useEffect(() => {
    if (venueSlug && hasVenueAccess) {
      setLastAccessibleVenueSlug(venueSlug)
    }
  }, [venueSlug, hasVenueAccess])

  // Verificar autorización al montar y cuando cambia el slug
  useEffect(() => {
    if (venueSlug) {
      authorizeVenue(venueSlug)
    }
  }, [venueSlug, authorizeVenue])

  // Restore to the last valid venue without artificial delays.
  useEffect(() => {
    if (!venueSlug || hasVenueAccess || hasGlobalVenueAccess || isLoading) {
      return
    }

    if (!lastAccessibleVenueSlug || lastAccessibleVenueSlug === venueSlug) {
      return
    }

    const currentPath = location.pathname
    const newPath = currentPath.startsWith('/wl/')
      ? currentPath.replace(/wl\/venues\/[^/]+/, `wl/venues/${lastAccessibleVenueSlug}`)
      : currentPath.replace(/venues\/[^/]+/, `venues/${lastAccessibleVenueSlug}`)

    if (newPath !== currentPath) {
      navigate(newPath, { replace: true })
    }
  }, [venueSlug, hasVenueAccess, hasGlobalVenueAccess, isLoading, lastAccessibleVenueSlug, location.pathname, navigate])

  // Mutation para reactivar venue suspendido
  const reactivateVenueMutation = useMutation({
    mutationFn: async () => {
      await api.post(`/api/v1/dashboard/venues/${venue?.id}/reactivate`)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['status'] })
      window.location.reload()
    },
  })

  // Si está cargando el venue, mostrar estado de carga
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
          <p className="mt-4 text-muted-foreground">{t('dashboardShell.loadingVenue')}</p>
        </div>
      </div>
    )
  }

  // Verificar si el venue está suspendido/cerrado (bloquear acceso completo)
  // SUPERADMIN puede acceder a cualquier venue, incluso suspendido
  const isVenueSuspended = venue?.status === 'SUSPENDED'
  const isVenueAdminSuspended = venue?.status === 'ADMIN_SUSPENDED'
  const isVenueClosed = venue?.status === 'CLOSED'
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN

  if (venue && (isVenueSuspended || isVenueAdminSuspended || isVenueClosed) && !isSuperadmin) {
    const canReactivate = isVenueSuspended && [StaffRole.OWNER, StaffRole.ADMIN].includes(user?.role as StaffRole)

    return (
      <VenueSuspendedScreen
        status={venue.status as 'SUSPENDED' | 'ADMIN_SUSPENDED' | 'CLOSED'}
        venueName={venue.name}
        suspensionReason={venue.suspensionReason}
        canReactivate={canReactivate}
        onReactivate={() => reactivateVenueMutation.mutate()}
        isReactivating={reactivateVenueMutation.isPending}
        otherVenuesAvailable={(user?.venues?.length || 0) > 1}
      />
    )
  }

  // Si el usuario NO tiene acceso al slug, restaurar al último venue válido o mostrar acceso denegado.
  if (venueSlug && !hasVenueAccess && !hasGlobalVenueAccess) {
    // Mientras se restaura al último slug válido, mostrar estado de transición.
    if (lastAccessibleVenueSlug && lastAccessibleVenueSlug !== venueSlug) {
      return (
        <div className="flex items-center justify-center min-h-screen">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-foreground mx-auto"></div>
            <p className="mt-4 text-muted-foreground">{t('dashboardShell.restoringAccess')}</p>
          </div>
        </div>
      )
    }

    // Si no hay venue válido anterior o no es privilegiado, mostrar mensaje de acceso denegado
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-2">{t('dashboardShell.accessDenied')}</h2>
          <p className="text-muted-foreground">{t('dashboardShell.noPermission')}</p>
        </div>
      </div>
    )
  }

  // Determine the route prefix based on current location
  const isWhiteLabelRoute = location.pathname.startsWith('/wl/')
  const routePrefix = isWhiteLabelRoute ? '/wl' : '/venues'

  const pathSegments = location.pathname
    .split('/')
    .filter(segment => segment)
    .slice(1) // Remover 'venues' o 'wl' del inicio

  // Get the display name for a path segment
  const getDisplayName = (segment: string, index: number): string => {
    // Check for custom breadcrumb first
    if (customSegments[segment]) {
      return customSegments[segment]
    }

    // Si es el primer segmento (slug del venue), usar el nombre del venue actual
    if (index === 0 && venue && segment === venueSlug) {
      return venue.name
    }

    // Para otros segmentos, verificar si corresponde a un slug de venue
    // Para propietarios (OWNER), buscar en allVenues
    if (user?.role === StaffRole.OWNER && allVenues?.length) {
      const venueMatch = allVenues.find(v => v.slug === segment)
      if (venueMatch) return venueMatch.name
    }
    // Para usuarios regulares, buscar en su lista de venues
    else if (user?.venues?.length) {
      const venueMatch = user.venues.find(v => v.slug === segment)
      if (venueMatch) return venueMatch.name
    }

    // Check if we have a predefined display name for this segment
    const lowerSegment = segment.toLowerCase()
    if (routeKeyMap[lowerSegment]) {
      return t(routeKeyMap[lowerSegment])
    }

    // Otherwise return the segment as is
    return segment
  }

  return (
    <SidebarProvider className="theme-scaled">
      <AppSidebar user={user} variant="inset" />
      <SidebarInset
        style={
          {
            '--font-sans': 'var(--font-inter)',
          } as React.CSSProperties
        }
      >
        <header
          className={`flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 text-foreground`}
        >
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4 mr-2" />
            {/* Breadcrumb: Shows venue name + path segments */}
            <Breadcrumb>
              <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1
                  const linkPath = `${routePrefix}/${pathSegments.slice(0, index + 1).join('/')}`
                  const displayName = getDisplayName(segment, index)

                  return (
                    <BreadcrumbItem key={`${segment}-${index}`}>
                      {isLast ? (
                        <BreadcrumbPage className="capitalize">{displayName}</BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink as={Link} to={linkPath} className="capitalize">
                            {displayName}
                          </BreadcrumbLink>
                          <BreadcrumbSeparator />
                        </>
                      )}
                    </BreadcrumbItem>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center gap-2">
            {/* Superadmin Navigation Button - only show for SUPERADMIN users */}
            {user?.role === StaffRole.SUPERADMIN && (
              <Button variant="outline" size="sm" onClick={() => navigate('/superadmin')} className="flex items-center space-x-2">
                <Shield className="w-4 h-4" />
                <span>{t('header.superadmin', { ns: 'superadmin' })}</span>
                <ArrowLeft className="w-3 h-3" />
              </Button>
            )}
            <LanguageSwitcher />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Onboarding Demo Banner - only show if venue is in TRIAL status */}
        {venue?.status === 'TRIAL' && <DemoBanner />}

        {/* Trial Status Banner - show for non-demo venues with active feature trials */}
        {venue?.status !== 'TRIAL' && venue?.status !== 'LIVE_DEMO' && <TrialStatusBanner />}

        <div className="flex flex-col flex-1 gap-4 p-4">
          {/* Main Content */}
          <div className={`flex-1 rounded-xl bg-background transition-colors duration-200`}>
            <Outlet />
          </div>
        </div>

        {/* Payment Setup Alert for SUPERADMIN - shows when venue needs payment configuration */}
        {venue && <PaymentSetupAlert venueId={venue.id} className="bottom-20" />}

        {/* ChatBubble positioned at bottom-right edge */}
        {venue && checkFeatureAccess('CHATBOT') && (
          <div className="fixed bottom-4 right-4 z-50">
            <ChatBubble />
          </div>
        )}
      </SidebarInset>
    </SidebarProvider>
  )
}

export default function Dashboard() {
  return (
    <BreadcrumbProvider>
      <ChatReferencesProvider>
        <DashboardContent />
      </ChatReferencesProvider>
    </BreadcrumbProvider>
  )
}
