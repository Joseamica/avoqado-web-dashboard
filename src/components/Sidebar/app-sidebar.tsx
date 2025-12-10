import {
  AlertTriangle,
  Banknote,
  BarChart3,
  BookOpen,
  Building,
  CreditCard,
  DollarSign,
  FlaskConical,
  Frame,
  Home,
  Package,
  Settings2,
  Shield,
  Smartphone,
  Star,
  Store,
  Tag,
  TrendingUp,
  Ungroup,
  Users,
  Wallet,
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
import { canAccessOperationalFeatures } from '@/lib/kyc-utils'

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues, activeVenue } = useAuth()
  const { t } = useTranslation(['translation', 'sidebar'])
  const { can } = usePermissions()

  // Check if venue can access operational features (KYC verification)
  const hasKYCAccess = React.useMemo(() => canAccessOperationalFeatures(activeVenue), [activeVenue])

  const navMain = React.useMemo(() => {
    // Define all possible items with their required permissions
    const allItems = [
      { title: t('sidebar:routes.home'), isActive: true, url: 'home', icon: Home, permission: 'home:read', locked: false },
      {
        title: t('sidebar:analytics'),
        isActive: true,
        url: 'analytics',
        icon: TrendingUp,
        permission: 'analytics:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:availableBalance'),
        isActive: true,
        url: 'available-balance',
        icon: Wallet,
        permission: 'settlements:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.menu'),
        isActive: true,
        url: 'menumaker/overview',
        icon: BookOpen,
        permission: 'menu:read',
        locked: false,
      },
      {
        title: t('sidebar:routes.inventory'),
        isActive: true,
        url: 'inventory/raw-materials',
        icon: Package,
        permission: 'inventory:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.payments'),
        isActive: true,
        url: 'payments',
        icon: Banknote,
        permission: 'payments:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.orders'),
        isActive: true,
        url: 'orders',
        icon: Frame,
        permission: 'orders:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.shifts'),
        isActive: true,
        url: 'shifts',
        icon: Ungroup,
        permission: 'shifts:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.tpv'),
        isActive: true,
        url: 'tpv',
        icon: Smartphone,
        permission: 'tpv:read',
        locked: !hasKYCAccess,
      },
      { title: t('sidebar:routes.reviews'), isActive: true, url: 'reviews', icon: Star, permission: 'reviews:read', locked: false },
    ]

    // Filter items based on permissions
    const filteredItems = allItems.filter(item => can(item.permission))

    // Customers submenu - filter subitems based on permissions
    const customersSubItems = [
      { title: t('sidebar:customersMenu.all'), url: 'customers', permission: 'customers:read' },
      { title: t('sidebar:customersMenu.groups'), url: 'customers/groups', permission: 'customer-groups:read' },
      { title: t('sidebar:customersMenu.loyalty'), url: 'loyalty', permission: 'loyalty:read' },
    ].filter(item => !item.permission || can(item.permission))

    // Only show Customers menu if user has at least one subitem
    if (customersSubItems.length > 0) {
      // Find index after Reviews to insert Customers menu
      const reviewsIndex = filteredItems.findIndex(item => item.url === 'reviews')
      const insertIndex = reviewsIndex !== -1 ? reviewsIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:customersMenu.title'),
        url: '#customers',
        icon: Users,
        locked: false,
        items: customersSubItems,
        permission: null as any,
      } as any)
    }

    // Promotions submenu - filter subitems based on permissions
    const promotionsSubItems = [
      { title: t('sidebar:promotionsMenu.discounts'), url: 'promotions/discounts', permission: 'discounts:read' },
      { title: t('sidebar:promotionsMenu.coupons'), url: 'promotions/coupons', permission: 'coupons:read' },
    ].filter(item => !item.permission || can(item.permission))

    // Only show Promotions menu if user has at least one subitem
    if (promotionsSubItems.length > 0) {
      // Find index after Customers menu to insert Promotions menu
      const customersIndex = filteredItems.findIndex(item => item.url === '#customers')
      const insertIndex = customersIndex !== -1 ? customersIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:promotionsMenu.title'),
        url: '#promotions',
        icon: Tag,
        locked: false,
        items: promotionsSubItems,
        permission: null as any,
      } as any)
    }

    // Settings submenu - filter subitems based on permissions
    // NOTE: Superadmin-specific items (payment-config, ecommerce-merchants) moved to separate Superadmin dropdown
    const settingsSubItems = [
      { title: t('sidebar:routes.editvenue'), url: 'edit', permission: 'venues:read' },
      { title: t('sidebar:routes.teams'), url: 'teams', permission: 'teams:read' },
      // Role permissions only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', permission: null }]
        : []),
      // Billing only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(user.role)
        ? [{ title: t('sidebar:routes.billing'), url: 'settings/billing', permission: null }]
        : []),
    ].filter(item => !item.permission || can(item.permission))

    // Only show Settings menu if user has at least one subitem
    if (settingsSubItems.length > 0) {
      filteredItems.push({
        title: t('sidebar:routes.settings'),
        url: '#',
        icon: Settings2,
        locked: false,
        items: settingsSubItems,
        permission: null as any,
      } as any)
    }

    // Superadmin Venue Tools dropdown - only for SUPERADMIN
    // These are venue-specific superadmin actions (not global /superadmin routes)
    if (user.role === 'SUPERADMIN') {
      const superadminVenueItems = [
        { title: t('sidebar:paymentConfig'), url: 'payment-config', superadminOnly: true },
        { title: t('sidebar:ecommerceChannels'), url: 'ecommerce-merchants', superadminOnly: true },
        { title: t('sidebar:merchantAccounts'), url: 'merchant-accounts', superadminOnly: true },
      ]

      filteredItems.push({
        title: t('sidebar:superadminTools'),
        url: '#superadmin-venue',
        icon: Shield,
        locked: false,
        items: superadminVenueItems,
        superadminOnly: true,
        permission: null as any,
      } as any)
    }

    return filteredItems
  }, [t, user.role, can, hasKYCAccess])

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

  // Use all venues for SUPERADMIN and OWNER (consistent with AuthContext), otherwise use user's assigned venues
  const venuesToShow: Array<Venue | SessionVenue> =
    (user.role === 'SUPERADMIN' || user.role === 'OWNER') && allVenues.length > 0 ? allVenues : user.venues
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
