/**
 * WLOrgSidebar - White-Label Organization Sidebar
 *
 * Sidebar navigation for organization-level white-label pages.
 * Uses dynamic basePath from useCurrentOrganization() hook.
 */

import React, { useMemo } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Store,
  Users,
  BarChart3,
  ChevronsUpDown,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useAuth } from '@/context/AuthContext'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  useSidebar,
} from '@/components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { NavUser } from '@/components/Sidebar/nav-user'
import { cn } from '@/lib/utils'

type WLOrgSidebarProps = React.ComponentProps<typeof Sidebar>

const WLOrgSidebar: React.FC<WLOrgSidebarProps> = (props) => {
  const { t } = useTranslation(['organization', 'common'])
  const navigate = useNavigate()
  const { organization, basePath, venues } = useCurrentOrganization()
  const { user } = useAuth()
  const { isMobile } = useSidebar()

  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  // Navigation items using dynamic basePath
  const navigationItems = useMemo(() => [
    {
      title: t('organization:sidebar.overview', { defaultValue: 'General' }),
      items: [
        {
          name: t('organization:sidebar.visionGlobal', { defaultValue: 'Visión Global' }),
          href: basePath,
          icon: LayoutDashboard,
          end: true,
        },
        {
          name: t('organization:sidebar.reports', { defaultValue: 'Reportes' }),
          href: `${basePath}/reports`,
          icon: BarChart3,
        },
      ],
    },
    {
      title: t('organization:sidebar.management', { defaultValue: 'Gestión' }),
      items: [
        {
          name: t('organization:sidebar.venues', { defaultValue: 'Tiendas' }),
          href: `${basePath}/venues`,
          icon: Store,
        },
        {
          name: t('organization:sidebar.managers', { defaultValue: 'Gerentes' }),
          href: `${basePath}/managers`,
          icon: Users,
        },
      ],
    },
  ], [t, basePath])

  // Navigate to venue in white-label mode
  const handleVenueClick = (slug: string) => {
    setDropdownOpen(false)
    navigate(`/wl/venues/${slug}`)
  }

  // Map app User -> NavUser expected shape
  const navUser = useMemo(
    () => ({
      name: `${user?.firstName || ''} ${user?.lastName || ''}`.trim(),
      email: user?.email || '',
      image: user?.photoUrl ?? '',
    }),
    [user?.firstName, user?.lastName, user?.email, user?.photoUrl],
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {/* Organization/Venue Switcher */}
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen} modal={false}>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton
                  size="lg"
                  className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground cursor-pointer"
                >
                  <div className="flex justify-center items-center bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg aspect-square size-8">
                    <Building2 className="size-4 text-primary-foreground" />
                  </div>
                  <div className="grid flex-1 text-sm leading-tight text-left">
                    <span className="font-semibold truncate">
                      {organization?.name || t('organization:myOrganization', { defaultValue: 'Mi Organización' })}
                    </span>
                    <span className="text-xs truncate text-muted-foreground">
                      {venues.length} {t('organization:venues', { defaultValue: 'tiendas' })}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
                align="start"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={5}
              >
                {/* Current Organization */}
                <DropdownMenuItem className="gap-2 p-2 bg-accent cursor-default">
                  <div className="flex justify-center items-center bg-gradient-to-r from-orange-500 to-amber-500 rounded-lg size-6">
                    <Building2 className="size-4 text-primary-foreground" />
                  </div>
                  <span className="flex-1 font-medium">
                    {organization?.name || t('organization:myOrganization', { defaultValue: 'Mi Organización' })}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {t('common:venuesSwitcher.current', { defaultValue: 'Actual' })}
                  </span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Venues List */}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t('common:venuesSwitcher.title', { defaultValue: 'Tiendas' })}
                </DropdownMenuLabel>
                {venues.map((venue) => (
                  <DropdownMenuItem
                    key={venue.id}
                    onClick={() => handleVenueClick(venue.slug)}
                    className="gap-2 p-2 cursor-pointer"
                  >
                    <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                      <AvatarImage src={venue?.logo || undefined} alt={`${venue?.name} Logo`} />
                      <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                    </Avatar>
                    <span className="flex-1 truncate">{venue?.name}</span>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map((section) => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        end={item.end}
                        className={({ isActive }) =>
                          cn(
                            'flex items-center gap-2',
                            isActive && 'bg-sidebar-accent text-sidebar-accent-foreground'
                          )
                        }
                      >
                        <item.icon className="size-4" />
                        <span>{item.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}

        {/* Quick Access to Venues */}
        {venues.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>
              {t('organization:sidebar.quickAccess', { defaultValue: 'Acceso Rápido' })}
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {venues.slice(0, 5).map((venue) => (
                  <SidebarMenuItem key={venue.id}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/wl/venues/${venue.slug}`}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-4 w-4 rounded">
                          <AvatarImage src={venue.logo || undefined} alt={venue.name} />
                          <AvatarFallback className="text-[10px]">
                            {venue.name?.charAt(0).toUpperCase() || 'V'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{venue.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {venues.length > 5 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`${basePath}/venues`}
                        className="flex items-center gap-2 text-primary"
                      >
                        <ChevronRight className="size-4" />
                        <span>
                          {t('organization:sidebar.viewAll', {
                            defaultValue: 'Ver todas ({{count}})',
                            count: venues.length,
                          })}
                        </span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default WLOrgSidebar
