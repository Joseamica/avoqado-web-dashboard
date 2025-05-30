import { Separator } from '@radix-ui/react-separator'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { AppSidebar } from './components/Sidebar/app-sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { useAuth } from './context/AuthContext'
import { themeClasses } from './lib/theme-utils'
import { useEffect } from 'react'
import { ChatBubble } from './components/Chatbot'

// Route path segment to display name mapping
const routeDisplayNames: Record<string, string> = {
  payments: 'Pagos',
  bills: 'Cuentas',
  home: 'Inicio',
  menu: 'Menú',
  settings: 'Configuración',
  shifts: 'Turnos',
  categories: 'Categorías',
  products: 'Productos',
  users: 'Usuarios',
  waiters: 'Meseros',
  tpv: 'Terminales',
  overview: 'Resumen',
  menumaker: 'Creación de menú',
  editvenue: 'Editar restaurante',
}

export default function Dashboard() {
  const location = useLocation()
  const { user, authorizeVenue, allVenues } = useAuth()
  const { venueId } = useParams()

  // Check venue authorization on mount and when venueId changes
  // Skip for SUPERADMIN users
  useEffect(() => {
    if (venueId && user?.role !== 'SUPERADMIN') {
      authorizeVenue(venueId)
    }
  }, [venueId, authorizeVenue, user?.role])

  const pathSegments = location.pathname
    .split('/')
    .filter(segment => segment)
    .slice(1)

  // Get the display name for a path segment
  const getDisplayName = (segment: string, _index: number) => {
    // First check if this segment matches any venue ID
    // For superadmin, check in the allVenues list
    if (user?.role === 'SUPERADMIN' && allVenues?.length) {
      const venue = allVenues.find(v => v.id === segment)
      if (venue) return venue.name
    }
    // For regular users, check in their venues list
    else if (user?.venues?.length) {
      const venue = user.venues.find(v => v.id === segment)
      if (venue) return venue.name
    }

    // Check if we have a predefined display name for this segment
    const lowerSegment = segment.toLowerCase()
    if (routeDisplayNames[lowerSegment]) {
      return routeDisplayNames[lowerSegment]
    }

    // Otherwise return the segment as is
    return segment
  }

  return (
    <SidebarProvider>
      <AppSidebar user={user} />
      <SidebarInset>
        <header
          className={`flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 ${themeClasses.text}`}
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
                    <BreadcrumbItem key={segment}>
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
          <div className="flex items-center">
            <ThemeToggle />
          </div>
        </header>
        <div className="flex flex-col flex-1 gap-4">
          {/* Main Content */}
          <div className={`min-h-[100vh] flex-1 rounded-xl ${themeClasses.contentBg} md:min-h-min transition-colors duration-200`}>
            <Outlet />
          </div>
        </div>
        {/* Chatbot component */}
        <ChatBubble />
      </SidebarInset>
    </SidebarProvider>
  )
}
