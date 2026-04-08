import { NavUser } from '@/components/Sidebar/nav-user'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { useCurrentOrganization } from '@/hooks/use-current-organization'
import { useCurrentVenue } from '@/hooks/use-current-venue'
import { cn } from '@/lib/utils'
import { StaffRole, Venue } from '@/types'
import {
  BarChart3,
  Building2,
  ChevronRight,
  ChevronsUpDown,
  LayoutDashboard,
  MessageSquare,
  Package,
  ScrollText,
  Settings,
  Smartphone,
  Store,
  Target,
  Users,
} from 'lucide-react'
import React, { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { NavLink, useNavigate, useParams } from 'react-router-dom'

// Type for grouped venues by organization
interface OrgGroup {
  orgId: string
  orgName: string
  venues: Venue[]
  isCurrentOrg: boolean
}

type OrgSidebarProps = React.ComponentProps<typeof Sidebar>

const OrgSidebar: React.FC<OrgSidebarProps> = props => {
  const { t } = useTranslation('organization')
  const navigate = useNavigate()
  const { orgId } = useParams<{ orgId: string }>()
  const { organization, isOwner: _isOwner } = useCurrentOrganization()
  const { user, allVenues } = useAuth()
  const { venue: _activeVenue, venueSlug: _venueSlug } = useCurrentVenue()
  const { isMobile } = useSidebar()

  const [dropdownOpen, setDropdownOpen] = React.useState(false)

  // Group venues by organization - only show orgs where user is OWNER (or SUPERADMIN sees all)
  // Also collect standalone venues (where user has access but not OWNER in that org)
  const { orgGroups, standaloneVenues } = useMemo(() => {
    const isSuperadmin = user?.role === StaffRole.SUPERADMIN

    // Find organizations where user has OWNER role
    const orgsWithOwnerAccess = new Set<string>()
    allVenues.forEach(venue => {
      if (isSuperadmin || venue.role === StaffRole.OWNER) {
        orgsWithOwnerAccess.add(venue.organizationId || 'unknown')
      }
    })

    // Group venues by organizationId - only include orgs where user is OWNER
    const groups = new Map<string, OrgGroup>()
    const standalone: Venue[] = []

    allVenues.forEach(venue => {
      const venueOrgId = venue.organizationId || 'unknown'

      // If user is OWNER in this org, add to grouped orgs
      if (orgsWithOwnerAccess.has(venueOrgId)) {
        const venueOrgName = venue.organization?.name || 'Unknown Organization'

        if (!groups.has(venueOrgId)) {
          groups.set(venueOrgId, {
            orgId: venueOrgId,
            orgName: venueOrgName,
            venues: [],
            isCurrentOrg: venueOrgId === orgId,
          })
        }
        groups.get(venueOrgId)!.venues.push(venue)
      } else {
        // User has access to this venue but not OWNER in the org - standalone venue
        standalone.push(venue)
      }
    })

    // Sort: current org first, then alphabetically
    const sortedGroups = Array.from(groups.values())
      .sort((a, b) => {
        if (a.isCurrentOrg) return -1
        if (b.isCurrentOrg) return 1
        return a.orgName.localeCompare(b.orgName)
      })
      .map(group => ({
        ...group,
        venues: group.venues.sort((a, b) => a.name.localeCompare(b.name)),
      }))

    // Sort standalone venues alphabetically
    const sortedStandalone = standalone.sort((a, b) => a.name.localeCompare(b.name))

    return { orgGroups: sortedGroups, standaloneVenues: sortedStandalone }
  }, [allVenues, user?.role, orgId])

  // Check if user has multiple organizations
  const _hasMultipleOrgs = orgGroups.length > 1

  // Check if current org has white-label features enabled (any venue with WHITE_LABEL_DASHBOARD module)
  const isWhiteLabelOrg = useMemo(() => {
    return allVenues.some(v => v.organizationId === orgId && v.modules?.some(m => m.module?.code === 'WHITE_LABEL_DASHBOARD' && m.enabled))
  }, [allVenues, orgId])

  const navigationItems = useMemo(
    () => [
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
          { name: t('sidebar.terminals'), href: `/organizations/${orgId}/terminals`, icon: Smartphone },
          { name: t('sidebar.activityLog'), href: `/organizations/${orgId}/activity-log`, icon: ScrollText },
        ],
      },
      {
        title: t('sidebar.configuration'),
        items: [{ name: t('sidebar.settings'), href: `/organizations/${orgId}/settings`, icon: Settings }],
      },
      // White-label org config section (only shown for orgs with WL module)
      ...(isWhiteLabelOrg
        ? [
            {
              title: t('organization:sidebar.orgConfig', { defaultValue: 'Configuración Org.' }),
              items: [
                {
                  name: t('organization:sidebar.orgUsers', { defaultValue: 'Usuarios' }),
                  href: `/organizations/${orgId}/users`,
                  icon: Users,
                },
                {
                  name: t('organization:sidebar.orgTpvConfig', { defaultValue: 'Configuración TPV' }),
                  href: `/organizations/${orgId}/org-config`,
                  icon: Smartphone,
                },
                {
                  name: t('organization:sidebar.orgGoals', { defaultValue: 'Metas' }),
                  href: `/organizations/${orgId}/org-goals`,
                  icon: Target,
                },
                {
                  name: t('organization:sidebar.orgCategories', { defaultValue: 'Categorías' }),
                  href: `/organizations/${orgId}/org-categories`,
                  icon: Store,
                },
                {
                  name: t('organization:sidebar.orgMessages', { defaultValue: 'Mensajes' }),
                  href: `/organizations/${orgId}/org-messages`,
                  icon: MessageSquare,
                },
                {
                  name: t('organization:sidebar.orgStockControl', { defaultValue: 'Control de Stock' }),
                  href: `/organizations/${orgId}/stock-control`,
                  icon: Package,
                },
              ],
            },
          ]
        : []),
    ],
    [t, orgId, isWhiteLabelOrg],
  )

  const handleVenueClick = (slug: string) => {
    setDropdownOpen(false)
    navigate(`/venues/${slug}/home`)
  }

  const handleOrgClick = (targetOrgId: string) => {
    setDropdownOpen(false)
    navigate(`/organizations/${targetOrgId}`)
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
                  <div className="flex justify-center items-center bg-linear-to-r from-amber-400 to-pink-500 rounded-lg aspect-square size-8">
                    <Building2 className="size-4 text-primary-foreground" />
                  </div>
                  <div className="grid flex-1 text-sm leading-tight text-left">
                    <span className="font-semibold truncate">{organization?.name || t('myOrganization')}</span>
                    <span className="text-xs truncate text-muted-foreground">
                      {organization?.venueCount || 0} {t('venuesLabel')}
                    </span>
                  </div>
                  <ChevronsUpDown className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg max-h-[70vh] overflow-y-auto"
                align="start"
                side={isMobile ? 'bottom' : 'right'}
                sideOffset={5}
              >
                {/* Organizations and their venues grouped */}
                {orgGroups.map((group, groupIndex) => (
                  <div key={group.orgId}>
                    {groupIndex > 0 && <DropdownMenuSeparator />}

                    {/* Organization Header */}
                    <DropdownMenuItem
                      onClick={() => handleOrgClick(group.orgId)}
                      className={cn('gap-2 p-2 cursor-pointer', group.isCurrentOrg && 'bg-accent')}
                    >
                      <div className="flex justify-center items-center bg-linear-to-r from-amber-400 to-pink-500 rounded-lg size-6">
                        <Building2 className="size-4 text-primary-foreground" />
                      </div>
                      <span className="flex-1 font-medium truncate">{group.orgName}</span>
                      {group.isCurrentOrg && (
                        <span className="text-xs text-muted-foreground shrink-0">{t('common:venuesSwitcher.current')}</span>
                      )}
                    </DropdownMenuItem>

                    {/* Venues in this organization */}
                    {group.venues.map(venue => (
                      <DropdownMenuItem
                        key={venue.id}
                        onClick={() => handleVenueClick(venue.slug)}
                        className="gap-2 p-2 pl-6 cursor-pointer"
                      >
                        <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                          <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
                          <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{venue?.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                ))}

                {/* Standalone venues (where user has access but not OWNER in that org) */}
                {standaloneVenues.length > 0 && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuLabel className="text-xs text-muted-foreground">
                      {t('common:venuesSwitcher.otherVenues', 'Otras sucursales')}
                    </DropdownMenuLabel>
                    {standaloneVenues.map(venue => (
                      <DropdownMenuItem key={venue.id} onClick={() => handleVenueClick(venue.slug)} className="gap-2 p-2 cursor-pointer">
                        <Avatar className="flex justify-center items-center rounded-lg aspect-square size-6">
                          <AvatarImage src={venue?.logo} alt={`${venue?.name} Logo`} />
                          <AvatarFallback>{venue?.name?.charAt(0).toLocaleUpperCase() || 'V'}</AvatarFallback>
                        </Avatar>
                        <span className="flex-1 truncate">{venue?.name}</span>
                      </DropdownMenuItem>
                    ))}
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>

      <SidebarContent>
        {navigationItems.map(section => (
          <SidebarGroup key={section.title}>
            <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map(item => (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.href}
                        end={item.end}
                        className={({ isActive }) =>
                          cn('flex items-center gap-2', isActive && 'bg-sidebar-accent text-sidebar-accent-foreground')
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

        {/* Quick Access to Venues (only this org's venues) */}
        {(() => {
          const currentOrgVenues = orgGroups.find(g => g.isCurrentOrg)?.venues ?? []
          if (currentOrgVenues.length === 0) return null
          return (
            <SidebarGroup>
              <SidebarGroupLabel>{t('sidebar.quickAccess')}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {currentOrgVenues.slice(0, 5).map(venue => (
                    <SidebarMenuItem key={venue.id}>
                      <SidebarMenuButton asChild>
                        <NavLink to={`/venues/${venue.slug}/home`} className="flex items-center gap-2">
                          <Avatar className="h-4 w-4 rounded">
                            <AvatarImage src={venue.logo} alt={venue.name} />
                            <AvatarFallback className="text-[10px]">{venue.name?.charAt(0).toUpperCase() || 'V'}</AvatarFallback>
                          </Avatar>
                          <span className="truncate">{venue.name}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {currentOrgVenues.length > 5 && (
                    <SidebarMenuItem>
                      <SidebarMenuButton asChild>
                        <NavLink to={`/organizations/${orgId}/venues`} className="flex items-center gap-2 text-primary">
                          <ChevronRight className="size-4" />
                          <span>{t('sidebar.viewAll', { count: currentOrgVenues.length })}</span>
                        </NavLink>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          )
        })()}
      </SidebarContent>

      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

export default OrgSidebar
