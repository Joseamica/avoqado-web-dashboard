/**
 * WLOrganizationLayout - White-Label Organization Dashboard Layout
 *
 * Layout for organization-level pages in white-label mode (/wl/organizations/:orgSlug).
 * Provides navigation between organization-level features like:
 * - Vision Global (aggregate KPIs)
 * - Venues list (store performance)
 * - Managers overview
 * - Cross-store reports
 *
 * Uses orgSlug for URL-friendly routing instead of orgId.
 */

import React from 'react'
import { Outlet, useLocation, Link, useNavigate } from 'react-router-dom'
import { Separator } from '@radix-ui/react-separator'
import { SidebarInset, SidebarProvider, SidebarTrigger } from '@/components/ui/sidebar'
import { ThemeToggle } from '@/components/theme-toggle'
import LanguageSwitcher from '@/components/language-switcher'
import NotificationBell from '@/components/notifications/NotificationBell'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import WLOrgSidebar from './components/WLOrgSidebar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Store } from 'lucide-react'

const WLOrganizationLayout: React.FC = () => {
  const { t } = useTranslation(['organization', 'common'])
  const location = useLocation()
  const navigate = useNavigate()
  const { organization, orgSlug, basePath, venues, isLoading } = useCurrentOrganization()

  // Build breadcrumb from path
  const pathSegments = location.pathname
    .split('/')
    .filter(segment => segment && segment !== 'wl' && segment !== 'organizations' && segment !== orgSlug)

  // Map route segments to display names
  const getDisplayName = (segment: string): string => {
    const routeMap: Record<string, string> = {
      venues: t('organization:breadcrumb.venues', { defaultValue: 'Tiendas' }),
      managers: t('organization:breadcrumb.managers', { defaultValue: 'Gerentes' }),
      reports: t('organization:breadcrumb.reports', { defaultValue: 'Reportes' }),
    }
    return routeMap[segment.toLowerCase()] || segment
  }

  // Handle venue selection from dropdown
  const handleVenueSelect = (venueSlug: string) => {
    navigate(`/wl/venues/${venueSlug}`)
  }

  return (
    <SidebarProvider className="theme-scaled">
      <WLOrgSidebar variant="inset" />
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
                  <BreadcrumbLink as={Link} to={basePath}>
                    {organization?.name || t('organization:myOrganization', { defaultValue: 'Mi Organización' })}
                  </BreadcrumbLink>
                </BreadcrumbItem>
                {pathSegments.map((segment, index) => {
                  const isLast = index === pathSegments.length - 1
                  const linkPath = `${basePath}/${pathSegments.slice(0, index + 1).join('/')}`

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
            {/* Venue Selector Dropdown */}
            {venues.length > 0 && (
              <Select onValueChange={handleVenueSelect}>
                <SelectTrigger className="w-[200px] h-9">
                  <Store className="w-4 h-4 mr-2 text-muted-foreground" />
                  <SelectValue placeholder={t('organization:selectVenue', { defaultValue: 'Ir a tienda...' })} />
                </SelectTrigger>
                <SelectContent>
                  {venues.map((venue) => (
                    <SelectItem key={venue.id} value={venue.slug}>
                      {venue.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

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

export default WLOrganizationLayout
