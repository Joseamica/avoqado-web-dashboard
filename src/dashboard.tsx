import { Separator } from '@radix-ui/react-separator'
import { Link, Outlet, useLocation, useParams } from 'react-router-dom'
import { AppSidebar } from './components/Sidebar/app-sidebar'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from './components/ui/breadcrumb'
import { SidebarInset, SidebarProvider, SidebarTrigger } from './components/ui/sidebar'
import { ThemeToggle } from './components/ThemeToggle'
import { useAuth } from './context/AuthContext'
import { themeClasses } from './lib/theme-utils'
import { useEffect } from 'react'

export default function Dashboard() {
  const location = useLocation()
  const { user, authorizeVenue } = useAuth()
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

                  return (
                    <BreadcrumbItem key={segment}>
                      {isLast ? (
                        <BreadcrumbPage className="capitalize">{segment}</BreadcrumbPage>
                      ) : (
                        <>
                          <BreadcrumbLink as={Link} to={linkPath} className="capitalize">
                            {segment}
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
      </SidebarInset>
    </SidebarProvider>
  )
}
