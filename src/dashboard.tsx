import { Separator } from '@radix-ui/react-separator'
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { AppSidebar } from './components/Sidebar/app-sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { ThemeToggle } from './components/theme-toggle'
import { useAuth } from './context/AuthContext'
import { useEffect, useState, useRef } from 'react'
import { ChatBubble } from './components/Chatbot'
import { DemoBanner } from './components/DemoBanner'
import { TrialStatusBanner } from './components/TrialStatusBanner'
import { StaffRole } from './types'
import { useCurrentVenue } from './hooks/use-current-venue'
import { Button } from './components/ui/button'
import { Shield, ArrowLeft } from 'lucide-react'
import NotificationBell from './components/notifications/NotificationBell'
import LanguageSwitcher from './components/language-switcher'
import { useTranslation } from 'react-i18next'
import { BreadcrumbProvider, useBreadcrumb } from './context/BreadcrumbContext'
import { ChatReferencesProvider } from './context/ChatReferencesContext'

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
  const { user, authorizeVenue, allVenues, checkFeatureAccess } = useAuth()
  const { venue, venueSlug, isLoading, hasVenueAccess } = useCurrentVenue()
  const { customSegments } = useBreadcrumb()

  // Estado para manejar el cambio de venues y prevenir parpadeo de "acceso denegado"
  const [isVenueSwitching, setIsVenueSwitching] = useState(false)
  const [lastAccessibleVenueSlug, setLastAccessibleVenueSlug] = useState<string | null>(null)
  const prevVenueSlugRef = useRef(venueSlug)

  // Verificar si el usuario es SUPERADMIN o OWNER - ellos tienen acceso a más venues
  const isPrivilegedUser = user?.role === StaffRole.SUPERADMIN || user?.role === StaffRole.OWNER

  // Cuando el usuario accede a un venue al que tiene permisos, recordarlo como último válido
  useEffect(() => {
    if (venueSlug && hasVenueAccess && !isVenueSwitching) {
      setLastAccessibleVenueSlug(venueSlug)
    }
  }, [venueSlug, hasVenueAccess, isVenueSwitching])

  // Verificar autorización al montar y cuando cambia el slug
  useEffect(() => {
    if (venueSlug) {
      // Para usuarios privilegiados, asumir que tienen acceso pero verificar de todos modos
      // para actualizar el estado interno
      if (isPrivilegedUser) {
        // Forzar la autorización para estos roles
        authorizeVenue(venueSlug)
        setIsVenueSwitching(true)

        // Aún así dar un tiempo para que se actualice el estado
        const timer = setTimeout(() => {
          setIsVenueSwitching(false)
        }, 1000)

        return () => clearTimeout(timer)
      } else {
        // Para otros usuarios, comprobar acceso normalmente
        authorizeVenue(venueSlug)
      }
    }
  }, [venueSlug, authorizeVenue, isPrivilegedUser])

  // Detectar cambios en el venueSlug para identificar venue switching
  useEffect(() => {
    // Si el slug cambió, estamos en una transición
    if (prevVenueSlugRef.current !== venueSlug) {
      // Activar el estado de switching durante más tiempo (1 segundo)
      setIsVenueSwitching(true)

      // Dar tiempo extra para que se actualice el estado y los permisos
      const timer = setTimeout(() => {
        setIsVenueSwitching(false)
      }, 1000)

      // Actualizar la referencia para la próxima comparación
      prevVenueSlugRef.current = venueSlug

      return () => clearTimeout(timer)
    }
  }, [venueSlug, setIsVenueSwitching])

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

  // Los usuarios SUPERADMIN y OWNER tienen acceso especial a venues
  // Si estamos en un proceso de venue switching, dar tiempo para que se actualice el estado
  // Si no tiene acceso al venue pero es privilegiado (SUPERADMIN/OWNER), aun así mostrar contenido
  if (venueSlug && !hasVenueAccess && !isVenueSwitching && !isPrivilegedUser) {
    // Si tenemos un último venue válido y estamos en un usuario privilegiado, redirigir a ese venue
    if (lastAccessibleVenueSlug && lastAccessibleVenueSlug !== venueSlug) {
      // Redirigir al último venue válido en 500ms para dar tiempo de procesamiento
      setTimeout(() => {
        const currentPath = location.pathname
        const newPath = currentPath.replace(/venues\/[^/]+/, `venues/${lastAccessibleVenueSlug}`)
        navigate(newPath, { replace: true })
      }, 100)

      // Mientras tanto, mostrar pantalla de carga
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
          <p className="text-muted-foreground">
            {isPrivilegedUser ? t('dashboardShell.processingChange') : t('dashboardShell.noPermission')}
          </p>
        </div>
      </div>
    )
  }

  const pathSegments = location.pathname
    .split('/')
    .filter(segment => segment)
    .slice(1) // Remover 'venues' del inicio

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
            <Breadcrumb>
              <BreadcrumbList>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1
                  const linkPath = `/venues/${pathSegments.slice(0, index + 1).join('/')}`
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
                <span>{t('header.superadmin')}</span>
                <ArrowLeft className="w-3 h-3" />
              </Button>
            )}
            <LanguageSwitcher />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        {/* Onboarding Demo Banner - only show if venue is in onboarding demo mode */}
        {venue?.isOnboardingDemo && <DemoBanner />}

        {/* Trial Status Banner - show if venue has active trials */}
        {!venue?.isOnboardingDemo && <TrialStatusBanner />}

        <div className="flex flex-col flex-1 gap-4">
          {/* Main Content */}
          <div className={`min-h-screen flex-1 rounded-xl bg-background md:min-h-min transition-colors duration-200`}>
            <Outlet />
          </div>
        </div>

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
