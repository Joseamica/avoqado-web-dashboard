import {
  AlertTriangle,
  BarChart3,
  BookOpen,
  Building,
  DollarSign,
  FlaskConical,
  Gem,
  HandCoins,
  Handshake,
  Home,
  LayoutDashboard,
  Package,
  Receipt,
  Settings2,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Store,
  Tag,
  TrendingUp,
  Ungroup,
  Users,
  Wallet,
  Zap,
  LucideIcon,
} from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { SessionVenue, User, Venue } from '@/types'
import { useTranslation } from 'react-i18next'
import { usePermissions } from '@/hooks/usePermissions'
import { canAccessOperationalFeatures } from '@/lib/kyc-utils'
import { useWhiteLabelConfig, getFeatureRoute } from '@/hooks/useWhiteLabelConfig'

// ============================================
// Icon Mapping for White-Label Navigation
// ============================================

const ICON_MAP: Record<string, LucideIcon> = {
  LayoutDashboard,
  DollarSign,
  HandCoins,
  BarChart3,
  Package,
  Users,
  Store,
  Gem,
  Handshake,
  Home,
  Receipt,
  Settings2,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Tag,
  TrendingUp,
  Wallet,
}

/**
 * Get icon component by name from the registry
 */
function getIconComponent(iconName: string | undefined): LucideIcon {
  if (!iconName) return LayoutDashboard
  return ICON_MAP[iconName] || LayoutDashboard
}

/**
 * DEPRECATED: This mapping overrides database labels with hardcoded translations.
 * We now prioritize the database label (set via White-Label Wizard) over translations.
 * Only use translations as fallback if no custom label is set.
 */
const FEATURE_CODE_TO_TRANSLATION_KEY: Record<string, string> = {
  // Commented out - we now use database labels first
  // COMMAND_CENTER: 'playtelecom.commandCenter',
  // SERIALIZED_STOCK: 'playtelecom.stock',
  // PROMOTERS_AUDIT: 'playtelecom.promoters',
  // STORES_ANALYSIS: 'playtelecom.stores',
  // MANAGERS_DASHBOARD: 'playtelecom.managers',
  // USERS_MANAGEMENT: 'playtelecom.users',
  // TPV_CONFIGURATION: 'playtelecom.tpvConfig',
  // SALES_DASHBOARD: 'playtelecom.sales',
}

export function AppSidebar({ user, ...props }: React.ComponentProps<typeof Sidebar> & { user: User }) {
  const { allVenues, activeVenue, staffInfo, checkFeatureAccess } = useAuth()
  const { t } = useTranslation(['translation', 'sidebar'])
  const { can } = usePermissions()

  // Use venue-specific role from staffInfo (properly derived from active venue)
  const effectiveRole = staffInfo?.role || user.role

  // Check if venue can access operational features (KYC verification)
  const hasKYCAccess = React.useMemo(() => canAccessOperationalFeatures(activeVenue), [activeVenue])

  // ========== White-Label Dashboard Mode ==========
  const { isWhiteLabelEnabled, navigation: wlNavigation, isFeatureEnabled } = useWhiteLabelConfig()

  const location = useLocation()

  // Detect white-label mode from URL: /wl/:slug/* activates white-label mode
  // This replaces localStorage-based toggle - now the URL determines the mode
  const isWhiteLabelMode = React.useMemo(() => {
    // Check if we're in /wl/ route
    const isWlRoute = location.pathname.startsWith('/wl/')
    // Only enable white-label mode if the venue has the module enabled AND we're in /wl/ route
    return isWlRoute && isWhiteLabelEnabled
  }, [location.pathname, isWhiteLabelEnabled])

  const navMain = React.useMemo(() => {
    // ========== White-Label Mode: Show only configured dashboard items ==========
    // Uses direct routes (not /wl/) - white-label just filters the sidebar
    if (isWhiteLabelMode && isWhiteLabelEnabled && wlNavigation.length > 0) {
      // Filter navigation to only show enabled features
      // Also filter out items without featureCode (legacy data)
      const enabledNavItems = wlNavigation.filter(navItem => {
        const featureCode = navItem.featureCode || ''

        // If no featureCode, we can't verify - filter it out
        if (!featureCode) return false

        return isFeatureEnabled(featureCode)
      })

      const whiteLabelItems = enabledNavItems.map(navItem => {
        // Use translation if available for PlayTelecom features, otherwise use database label
        const translationKey = FEATURE_CODE_TO_TRANSLATION_KEY[navItem.featureCode || '']
        const title = translationKey ? t(`sidebar:${translationKey}`) : navItem.label || navItem.featureCode || 'Untitled'

        return {
          title,
          url: getFeatureRoute(navItem.featureCode || ''),
          icon: getIconComponent(navItem.icon),
          isActive: true,
          locked: false,
        }
      })

      // Add Settings for white-label mode (always need access to venue settings)
      const settingsSubItems = [
        { title: t('sidebar:routes.editvenue'), url: 'edit', permission: 'venues:read' },
        ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
          ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', permission: null }]
          : []),
        ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
          ? [{ title: t('sidebar:routes.billing'), url: 'settings/billing', permission: 'billing:read' }]
          : []),
      ].filter(item => !item.permission || can(item.permission))

      if (settingsSubItems.length > 0) {
        whiteLabelItems.push({
          title: t('sidebar:routes.settings'),
          url: '#',
          icon: Settings2,
          locked: false,
          items: settingsSubItems,
          isActive: true,
        } as any)
      }

      return whiteLabelItems
    }

    // ========== Normal Avoqado Dashboard Mode ==========
    // Define all possible items with their required permissions and features
    const allItems = [
      { title: t('sidebar:routes.home'), isActive: true, url: 'home', icon: Home, permission: 'home:read', locked: false },
      // {
      //   title: t('sidebar:analytics'),
      //   isActive: true,
      //   url: 'analytics',
      //   icon: TrendingUp,
      //   permission: 'analytics:read',
      //   locked: !hasKYCAccess,
      // },
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
        isActive: location.pathname.startsWith('/inventory'),
        url: 'inventory/raw-materials', // Keep base URL active for parent match
        icon: Package,
        permission: 'inventory:read',
        locked: !hasKYCAccess,
        requiredFeature: 'INVENTORY_TRACKING',
        items: [
          { title: 'Resumen de existencias', url: 'inventory/stock-overview', permission: 'inventory:read' },
          { title: 'Historial', url: 'inventory/history', permission: 'inventory:read' },
          { title: 'Recuentos de existencias', url: 'inventory/counts', permission: 'inventory:read' },
          { title: 'Pedidos', url: 'inventory/purchase-orders', permission: 'inventory:read' },
          { title: 'Proveedores', url: 'inventory/suppliers', permission: 'inventory:read' },
          { title: 'Reabastecimientos pendientes', url: 'inventory/restocks', permission: 'inventory:read' },
          { title: 'Seguimiento de ingredientes', url: 'inventory/ingredients', permission: 'inventory:read' },
          { title: t('sidebar:routes.recipes', { defaultValue: 'Recetas' }), url: 'inventory/recipes', permission: 'inventory:read' },
          { title: 'Precios', url: 'inventory/pricing', permission: 'inventory:read' },
          { title: 'Modificadores', url: 'inventory/modifier-analytics', permission: 'inventory:read' },
        ],
      },
      // NOTE: Payments and Orders moved to "Ventas" collapsible section below
      {
        title: t('sidebar:routes.shifts'),
        isActive: true,
        url: 'shifts',
        icon: Ungroup,
        permission: 'shifts:read',
        locked: !hasKYCAccess,
        requiresShiftsEnabled: true, // Only show if venue has shifts enabled
      },
      {
        title: t('sidebar:routes.tpv'),
        isActive: true,
        url: 'tpv',
        icon: Smartphone,
        permission: 'tpv:read',
        locked: !hasKYCAccess,
      },
      {
        title: t('sidebar:routes.teams'),
        isActive: true,
        url: 'team',
        icon: Users,
        permission: 'teams:read',
        locked: false,
      },
      {
        title: t('sidebar:routes.commissions'),
        isActive: true,
        url: 'commissions',
        icon: DollarSign,
        permission: 'commissions:read',
        locked: !hasKYCAccess,
      },
      { title: t('sidebar:routes.reviews'), isActive: true, url: 'reviews', icon: Star, permission: 'reviews:read', locked: false },
    ]

    // Filter items based on permissions AND active features
    const filteredItems = allItems.filter(item => {
      // Check permission
      if (!can(item.permission)) return false

      // Check required feature (if specified)
      if ('requiredFeature' in item && item.requiredFeature) {
        return checkFeatureAccess(item.requiredFeature)
      }

      // Check if shifts are enabled (for shifts menu item)
      if ('requiresShiftsEnabled' in item && item.requiresShiftsEnabled) {
        return activeVenue?.settings?.enableShifts === true
      }

      return true
    })

    // Sales submenu (Ventas) - Orders and Transactions grouped together
    // Following Square's "Orders & payments" pattern for better UX
    const salesSubItems = [
      { title: t('sidebar:salesMenu.orders', { defaultValue: 'Órdenes' }), url: 'orders', permission: 'orders:read' },
      { title: t('sidebar:salesMenu.transactions', { defaultValue: 'Transacciones' }), url: 'payments', permission: 'payments:read' },
    ].filter(item => {
      // Check permission
      if (item.permission && !can(item.permission)) return false
      return true
    })

    // Only show Sales menu if user has at least one subitem
    if (salesSubItems.length > 0) {
      // Find index after Inventory to insert Sales menu
      const inventoryIndex = filteredItems.findIndex(item => item.url === 'inventory/raw-materials')
      const insertIndex = inventoryIndex !== -1 ? inventoryIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:salesMenu.title', { defaultValue: 'Ventas' }),
        url: '#sales',
        icon: ShoppingCart,
        locked: !hasKYCAccess,
        items: salesSubItems,
        permission: null as any,
      } as any)
    }

    // Customers submenu - filter subitems based on permissions AND features
    const customersSubItems = [
      { title: t('sidebar:customersMenu.all'), url: 'customers', permission: 'customers:read' },
      { title: t('sidebar:customersMenu.groups'), url: 'customers/groups', permission: 'customer-groups:read' },
      { title: t('sidebar:customersMenu.loyalty'), url: 'loyalty', permission: 'loyalty:read', requiredFeature: 'LOYALTY_PROGRAM' },
    ].filter(item => {
      // Check permission
      if (item.permission && !can(item.permission)) return false
      // Check required feature
      if ('requiredFeature' in item && item.requiredFeature) {
        return checkFeatureAccess(item.requiredFeature)
      }
      return true
    })

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

    // Reports submenu - filter subitems based on permissions
    const reportsSubItems = [
      {
        title: t('sidebar:reportsMenu.payLaterAging', { defaultValue: 'Cuentas por Cobrar' }),
        url: 'reports/pay-later-aging',
        permission: 'tpv-reports:pay-later-aging',
      },
      { title: t('sidebar:reportsMenu.salesSummary'), url: 'reports/sales-summary', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.salesByItem'), url: 'reports/sales-by-item', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.salesByCategory'), url: 'reports/sales-by-category', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.paymentMethods'), url: 'reports/payment-methods', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.taxes'), url: 'reports/taxes', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.voids'), url: 'reports/voids', permission: 'reports:read' },
      { title: t('sidebar:reportsMenu.modifiers'), url: 'reports/modifiers', permission: 'reports:read' },
    ].filter(item => !item.permission || can(item.permission))

    // Only show Reports menu if user has at least one subitem
    if (reportsSubItems.length > 0) {
      // Find index after Promotions menu to insert Reports menu
      const promotionsIndex = filteredItems.findIndex(item => item.url === '#promotions')
      const insertIndex = promotionsIndex !== -1 ? promotionsIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:reportsMenu.title', { defaultValue: 'Reportes' }),
        url: '#reports',
        icon: Receipt,
        locked: !hasKYCAccess,
        items: reportsSubItems,
        permission: null as any,
      } as any)
    }

    // Settings submenu - filter subitems based on permissions
    // NOTE: Superadmin-specific items (payment-config, ecommerce-merchants) moved to separate Superadmin dropdown
    const settingsSubItems = [
      { title: t('sidebar:routes.editvenue'), url: 'edit', permission: 'venues:read' },
      // Role permissions only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', permission: null }]
        : []),
      // Billing only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:routes.billing'), url: 'settings/billing', permission: 'billing:read' }]
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
    if (effectiveRole === 'SUPERADMIN') {
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
  }, [
    t,
    effectiveRole,
    can,
    hasKYCAccess,
    checkFeatureAccess,
    activeVenue,
    isWhiteLabelMode,
    isWhiteLabelEnabled,
    wlNavigation,
    isFeatureEnabled,
  ])

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
    (effectiveRole === 'SUPERADMIN' || effectiveRole === 'OWNER') && allVenues.length > 0 ? allVenues : user.venues
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
