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

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues } = useAuth()
  const { t } = useTranslation(['translation', 'sidebar'])

  const navMain = React.useMemo(
    () => [
      { title: t('routes.home'), isActive: true, url: 'home', icon: Home },
      // Analytics only visible for MANAGER+, VIEWER (matches ManagerProtectedRoute with allowViewer)
      ...(['MANAGER', 'ADMIN', 'OWNER', 'SUPERADMIN', 'VIEWER'].includes(user.role)
        ? [{ title: t('sidebar:analytics'), isActive: true, url: 'analytics', icon: TrendingUp }]
        : []),
      { title: t('routes.menu'), isActive: true, url: 'menumaker/overview', icon: BookOpen },
      // Inventory only visible for ADMIN, OWNER, SUPERADMIN (matches AdminAccessLevel.ADMIN route protection)
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('routes.inventory'), isActive: true, url: 'inventory/raw-materials', icon: Package }]
        : []),
      { title: t('routes.payments'), isActive: true, url: 'payments', icon: Banknote },
      { title: t('routes.orders'), isActive: true, url: 'orders', icon: Frame },
      { title: t('routes.shifts'), isActive: true, url: 'shifts', icon: Ungroup },
      // TPV Management visible for WAITER+ (WAITER can view, MANAGER+ can manage)
      ...(['WAITER', 'MANAGER', 'ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('routes.tpv'), isActive: true, url: 'tpv', icon: Smartphone }]
        : []),
      { title: t('routes.reviews'), isActive: true, url: 'reviews', icon: Star },
      {
        title: t('routes.settings'),
        url: '#',
        icon: Settings2,
        items: [
          { title: t('routes.editvenue'), url: 'editVenue' },
          { title: t('routes.teams'), url: 'teams' },
          ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
            ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions' }]
            : []),
          ...(user.role === 'SUPERADMIN' ? [{ title: t('sidebar:paymentConfig'), url: 'payment-config' }] : []),
          { title: t('routes.billing'), url: '#billing' },
          { title: t('routes.limits'), url: '#limits' },
        ],
      },
    ],
    [t, user.role],
  )

  const superAdminRoutes = React.useMemo(
    () => [
      { title: t('sidebar:summary'), isActive: true, url: '/superadmin', icon: BarChart3 },
      { title: t('sidebar:venues'), isActive: true, url: '/superadmin/venues', icon: Building },
      { title: t('sidebar:features'), isActive: true, url: '/superadmin/features', icon: Zap },
      { title: t('sidebar:revenue'), isActive: true, url: '/superadmin/revenue', icon: DollarSign },
      { title: t('sidebar:analytics'), isActive: true, url: '/superadmin/analytics', icon: TrendingUp },
      { title: t('sidebar:alerts'), isActive: true, url: '/superadmin/alerts', icon: AlertTriangle },
      { title: t('sidebar:testing'), isActive: true, url: '/superadmin/testing', icon: FlaskConical },
      { title: t('sidebar:legacy_admin'), isActive: true, url: '/admin', icon: Settings2 },
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
