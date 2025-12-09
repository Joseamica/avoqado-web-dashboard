import React, { useMemo } from 'react'
import { useParams, NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard,
  Building2,
  Settings,
  Users,
  Store,
  BarChart3,
  ChevronsUpDown,
  ChevronRight,
} from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useAuth } from '@/context/AuthContext'
import { useCurrentVenue } from '@/hooks/use-current-venue'
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

interface OrgSidebarProps extends React.ComponentProps<typeof Sidebar> {}

const OrgSidebar: React.FC<OrgSidebarProps> = (props) => {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { orgId } = useParams<{ orgId: string }>()
  const { organization, isOwner } = useCurrentOrganization()
  const { user, allVenues } = useAuth()
  const { venue: activeVenue, venueSlug } = useCurrentVenue()
  const { isMobile } = useSidebar()

  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  const navigationItems = useMemo(() => [
    {
      title: t('sidebar.overview'),
      items: [
        { name: t('sidebar.dashboard'), href: `/organizations/${orgId}`, icon: LayoutDashboard, end: true },
        { name: t('sidebar.analytics'), href: `/organizations/${orgId}/analytics`, icon: BarChart3 },
      ],
    },
    {
      title: t('sidebar.management'),
      items: [
        { name: t('sidebar.venues'), href: `/organizations/${orgId}/venues`, icon: Store },
        { name: t('sidebar.team'), href: `/organizations/${orgId}/team`, icon: Users },
      ],
    },
    {
      title: t('sidebar.configuration'),
      items: [
        { name: t('sidebar.settings'), href: `/organizations/${orgId}/settings`, icon: Settings },
      ],
    },
  ], [t, orgId])

  const handleVenueClick = (slug: string) => {
    setDropdownOpen(false)
    navigate(`/venues/${slug}/home`)
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
                  <div className="flex justify-center items-center bg-gradient-to-r from-amber-400 to-pink-500 rounded-lg aspect-square size-8">
                    <Building2 className="size-4 text-white" />
                  </div>
                  <div className="grid flex-1 text-sm leading-tight text-left">
                    <span className="font-semibold truncate">
                      {organization?.name || t('myOrganization')}
                    </span>
                    <span className="text-xs truncate text-muted-foreground">
                      {organization?.venueCount || 0} {t('venues')}
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
                  <div className="flex justify-center items-center bg-gradient-to-r from-amber-400 to-pink-500 rounded-lg size-6">
                    <Building2 className="size-4 text-white" />
                  </div>
                  <span className="flex-1 font-medium">
                    {organization?.name || t('myOrganization')}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('common:venuesSwitcher.current')}</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />

                {/* Venues List */}
                <DropdownMenuLabel className="text-xs text-muted-foreground">
                  {t('common:venuesSwitcher.title')}
                </DropdownMenuLabel>
                {allVenues.map((venue) => (
                  <DropdownMenuItem
                    key={venue.id}
                    onClick={() => handleVenueClick(venue.slug)}
                    className="gap-2 p-2 cursor-pointer"
                  >
                    <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                      <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
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
        {allVenues.length > 0 && (
          <SidebarGroup>
            <SidebarGroupLabel>{t('sidebar.quickAccess')}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {allVenues.slice(0, 5).map((venue) => (
                  <SidebarMenuItem key={venue.id}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/venues/${venue.slug}/home`}
                        className="flex items-center gap-2"
                      >
                        <Avatar className="h-4 w-4 rounded">
                          <AvatarImage src={venue.logo} alt={venue.name} />
                          <AvatarFallback className="text-[10px]">
                            {venue.name?.charAt(0).toUpperCase() || 'V'}
                          </AvatarFallback>
                        </Avatar>
                        <span className="truncate">{venue.name}</span>
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {allVenues.length > 5 && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={`/organizations/${orgId}/venues`}
                        className="flex items-center gap-2 text-primary"
                      >
                        <ChevronRight className="size-4" />
                        <span>{t('sidebar.viewAll', { count: allVenues.length })}</span>
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

export default OrgSidebar
