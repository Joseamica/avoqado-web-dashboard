import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpen,
  Building,
  DollarSign,
  FlaskConical,
  Frame,
  Home,
  Package,
  Settings2,
  Smartphone,
  Star,
  TrendingUp,
  Ungroup,
  Zap,
} from 'lucide-react'
import * as React from 'react'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { SessionVenue, User, Venue } from '@/types'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '@/hooks/usePermissions'

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues } = useAuth()
  const { t } = useTranslation(['translation', 'sidebar'])
  const { can } = usePermissions()

  const navMain = React.useMemo(() => {
    // Define all possible items with their required permissions
    const allItems = [
      { title: t('routes.home'), isActive: true, url: 'home', icon: Home, permission: 'home:read' },
      { title: t('sidebar:analytics'), isActive: true, url: 'analytics', icon: TrendingUp, permission: 'analytics:read' },
      { title: t('routes.menu'), isActive: true, url: 'menumaker/overview', icon: BookOpen, permission: 'menu:read' },
      { title: t('routes.inventory'), isActive: true, url: 'inventory/raw-materials', icon: Package, permission: 'inventory:read' },
      { title: t('routes.payments'), isActive: true, url: 'payments', icon: Banknote, permission: 'payments:read' },
      { title: t('routes.orders'), isActive: true, url: 'orders', icon: Frame, permission: 'orders:read' },
      { title: t('routes.shifts'), isActive: true, url: 'shifts', icon: Ungroup, permission: 'shifts:read' },
      { title: t('routes.tpv'), isActive: true, url: 'tpv', icon: Smartphone, permission: 'tpv:read' },
      { title: t('routes.reviews'), isActive: true, url: 'reviews', icon: Star, permission: 'reviews:read' },
    ]

    // Filter items based on permissions
    const filteredItems = allItems.filter(item => can(item.permission))

    // Settings submenu - filter subitems based on permissions
    const settingsSubItems = [
      { title: t('routes.editvenue'), url: 'edit', permission: 'venues:read' },
      { title: t('routes.teams'), url: 'teams', permission: 'teams:read' },
      // Role permissions only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', permission: null }]
        : []),
      // Payment config only for SUPERADMIN
      ...(user.role === 'SUPERADMIN'
        ? [{ title: t('sidebar:paymentConfig'), url: 'payment-config', permission: null, superadminOnly: true }]
        : []),
      // Billing only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('routes.billing'), url: 'settings/billing', permission: null }]
        : []),
      { title: t('routes.limits'), url: '#limits', permission: null },
    ].filter(item => !item.permission || can(item.permission))

    // Only show Settings menu if user has at least one subitem
    if (settingsSubItems.length > 0) {
      filteredItems.push({
        title: t('routes.settings'),
        url: '#',
        icon: Settings2,
        items: settingsSubItems,
        permission: null as any,
      })
    }

    return filteredItems
  }, [t, user.role, can])

  const superAdminRoutes = React.useMemo(
    () => [
      { title: t('sidebar:summary'), isActive: true, url: '/superadmin', icon: BarChart3 },
      { title: t('sidebar:venues'), isActive: true, url: '/superadmin/venues', icon: Building },
      { title: t('sidebar:features'), isActive: true, url: '/superadmin/features', icon: Zap },
      { title: t('sidebar:revenue'), isActive: true, url: '/superadmin/revenue', icon: DollarSign },
      { title: t('sidebar:analytics'), isActive: true, url: '/superadmin/analytics', icon: TrendingUp },
      { title: t('sidebar:alerts'), isActive: true, url: '/superadmin/alerts', icon: AlertTriangle },
      { title: t('sidebar:testing'), isActive: true, url: '/superadmin/testing', icon: FlaskConical },
      { title: t('sidebar:legacy_admin'), isActive: true, url: '/admin', icon: Settings2, superadminOnly: true },
    ],
    [t],
  )

  // Use all venues for SUPERADMIN, otherwise use user's assigned venues
  const venuesToShow: Array<Venue | SessionVenue> = user.role === 'SUPERADMIN' && allVenues.length > 0 ? allVenues : user.venues
  const defaultVenue: Venue | SessionVenue | null = venuesToShow.length > 0 ? venuesToShow[0] : null

  // Map app User -> NavUser expected shape
  const navUser = React.useMemo(
    () => ({
      name: `${user.firstName} ${user.lastName}`.trim(),
      email: user.email,
      image: user.photoUrl ?? '',
    }),
    [user.firstName, user.lastName, user.email, user.photoUrl],
  )

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>{defaultVenue && <VenuesSwitcher venues={venuesToShow} defaultVenue={defaultVenue} />}</SidebarHeader>
      <SidebarContent>
        <NavMain items={navMain} superadminItems={user.role === 'SUPERADMIN' ? superAdminRoutes : []} />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
