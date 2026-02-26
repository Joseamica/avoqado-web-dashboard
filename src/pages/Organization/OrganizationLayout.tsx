import React from 'react'
import { Outlet, useLocation, useParams, Link } from 'react-router-dom'
import { Separator } from '@radix-ui/react-separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useAuth } from '@/context/AuthContext'
import { StaffRole } from '@/types'
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from '@/components/ui/breadcrumb'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ShieldAlert } from 'lucide-react'
import OrgSidebar from './components/OrgSidebar'

const OrganizationLayout: React.FC = () => {
  const { t } = useTranslation('organization')
  const location = useLocation()
  const { orgId } = useParams<{ orgId: string }>()
  const { organization } = useCurrentOrganization()
  const { user, allVenues, isLoading: isAuthLoading } = useAuth()

  // Organization pages require OWNER or SUPERADMIN role IN THIS ORGANIZATION
  // SUPERADMIN can access any org, OWNER can only access their own org
  const isSuperadmin = user?.role === StaffRole.SUPERADMIN
  const isOwnerInThisOrg = allVenues.some(venue => venue.organizationId === orgId && venue.role === StaffRole.OWNER)
  const canAccessOrg = isSuperadmin || isOwnerInThisOrg

  // Build breadcrumb from path
  const pathSegments = location.pathname.split('/').filter(segment => segment && segment !== 'organizations' && segment !== orgId)

  // Map route segments to display names
  const getDisplayName = (segment: string): string => {
    const routeMap: Record<string, string> = {
      dashboard: t('breadcrumb.dashboard'),
      venues: t('breadcrumb.venues'),
      team: t('breadcrumb.team'),
      settings: t('breadcrumb.settings'),
      analytics: t('breadcrumb.analytics'),
      terminals: t('breadcrumb.terminals'),
      'activity-log': t('breadcrumb.activityLog'),
    }
    return routeMap[segment.toLowerCase()] || segment
  }

  // Wait for auth to load before checking permissions
  if (isAuthLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  // Show access denied if user doesn't have permission for this organization
  if (!canAccessOrg) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <Card className="max-w-md mx-4">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="p-3 bg-destructive/10 rounded-full">
                <ShieldAlert className="h-8 w-8 text-destructive" />
              </div>
            </div>
            <CardTitle>{t('accessDenied.title', 'Acceso denegado')}</CardTitle>
          </CardHeader>
          <CardContent className="text-center text-muted-foreground">
            <p>
              {t(
                'accessDenied.message',
                'No tienes permisos para ver esta organización. Solo los propietarios (OWNER) pueden acceder a las páginas de organización.',
              )}
            </p>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <SidebarProvider className="theme-scaled">
      <OrgSidebar variant="inset" />
      <SidebarInset
        style={
          {
            '--font-sans': 'var(--font-inter)',
          } as React.CSSProperties
        }
      >
        <header className="flex h-16 shrink-0 items-center justify-between transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 px-4 text-foreground">
          <div className="flex items-center gap-2">
            <SidebarTrigger className="-ml-1" />
            <Separator orientation="vertical" className="h-4 mr-2" />

            {/* Breadcrumb */}
            <Breadcrumb>
              <BreadcrumbList>
                <BreadcrumbItem>
                  <BreadcrumbLink as={Link} to={`/organizations/${orgId}`}>
                    {organization?.name || t('myOrganization')}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1
                  const linkPath = `/organizations/${orgId}/${pathSegments.slice(0, index + 1).join('/')}`

                  return (
                    <BreadcrumbItem key={segment}>
                      <BreadcrumbSeparator />
                      {isLast ? (
                        <BreadcrumbPage className="capitalize">{getDisplayName(segment)}</BreadcrumbPage>
                      ) : (
                        <BreadcrumbLink as={Link} to={linkPath} className="capitalize">
                          {getDisplayName(segment)}
                        </BreadcrumbLink>
                      )}
                    </BreadcrumbItem>
                  )
                })}
              </BreadcrumbList>
            </Breadcrumb>
          </div>

          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <NotificationBell />
            <ThemeToggle />
          </div>
        </header>

        <div className="flex flex-col flex-1 gap-4">
          {/* Main Content */}
          <div className="min-h-screen flex-1 rounded-xl bg-background md:min-h-min transition-colors duration-200">
            <div className="p-6">
              <Outlet />
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  )
}

export default OrganizationLayout
