import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  Building,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileSpreadsheet,
  FlaskConical,
  Gem,
  HandCoins,
  Handshake,
  Home,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Settings2,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Store,
  Tag,
  TrendingUp,
  Ungroup,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
  Zap,
  Search,
  LucideIcon,
} from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail, useSidebar } from '@/components/ui/sidebar'
import { useAuth } from '@/context/AuthContext'
import { SessionVenue, User, Venue } from '@/types'
import { useTranslation } from 'react-i18next'
import { useAccess } from '@/hooks/use-access'
import { canAccessOperationalFeatures } from '@/lib/kyc-utils'
import { useWhiteLabelConfig, getFeatureRoute } from '@/hooks/useWhiteLabelConfig'
import { useTerminology } from '@/hooks/use-terminology'
import api from '@/api'
import { cn } from '@/lib/utils'

// ============================================
// Icon Mapping for White-Label Navigation
// ============================================

const ICON_MAP: Record<string, LucideIcon> = {
  Award,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  CreditCard,
  DollarSign,
  Eye,
  FileSpreadsheet,
  Gem,
  HandCoins,
  Handshake,
  Home,
  LayoutDashboard,
  Package,
  Receipt,
  Settings,
  Settings2,
  Shield,
  ShoppingCart,
  Smartphone,
  Star,
  Store,
  Tag,
  TrendingUp,
  UserCog,
  Users,
  UtensilsCrossed,
  Wallet,
  Warehouse,
}

/**
 * Default icon per feature code — used when the WL config doesn't specify one.
 * Mirrors the icons defined in feature-registry.ts.
 */
const FEATURE_DEFAULT_ICON: Record<string, string> = {
  // Avoqado core
  AVOQADO_DASHBOARD: 'LayoutDashboard',
  AVOQADO_ORDERS: 'ClipboardList',
  AVOQADO_PAYMENTS: 'CreditCard',
  AVOQADO_MENU: 'UtensilsCrossed',
  AVOQADO_INVENTORY: 'Warehouse',
  AVOQADO_TEAM: 'Users',
  AVOQADO_CUSTOMERS: 'Users',
  AVOQADO_TPVS: 'Smartphone',
  AVOQADO_BALANCE: 'Wallet',
  AVOQADO_PROMOTIONS: 'Tag',
  AVOQADO_ANALYTICS: 'TrendingUp',
  AVOQADO_SHIFTS: 'Clock',
  AVOQADO_COMMISSIONS: 'DollarSign',
  AVOQADO_LOYALTY: 'Award',
  AVOQADO_REVIEWS: 'Star',
  AVOQADO_REPORTS: 'BarChart3',
  AVOQADO_RESERVATIONS: 'CalendarDays',
  AVOQADO_SETTINGS: 'Settings2',
  // Module-specific
  COMMAND_CENTER: 'LayoutDashboard',
  SERIALIZED_STOCK: 'Package',
  PROMOTERS_AUDIT: 'Users',
  STORES_ANALYSIS: 'Store',
  MANAGERS_DASHBOARD: 'UserCog',
  SALES_REPORT: 'Receipt',
  SUPERVISOR_DASHBOARD: 'Eye',
  TPV_CONFIGURATION: 'Settings',
  CLOSING_REPORT: 'FileSpreadsheet',
  USERS_MANAGEMENT: 'Users',
  APPRAISALS: 'Gem',
  CONSIGNMENT: 'Handshake',
}

/**
 * Get icon component by name from the registry.
 * Falls back to a feature-code-specific default, then to LayoutDashboard.
 */
function getIconComponent(iconName: string | undefined, featureCode?: string): LucideIcon {
  // 1. Explicit icon name from WL config
  if (iconName && ICON_MAP[iconName]) return ICON_MAP[iconName]
  // 2. Default icon for this feature code
  if (featureCode) {
    const defaultName = FEATURE_DEFAULT_ICON[featureCode]
    if (defaultName && ICON_MAP[defaultName]) return ICON_MAP[defaultName]
  }
  // 3. Ultimate fallback
  return LayoutDashboard
}

/**
 * Maps feature codes to sidebar translation keys.
 * Translation takes priority over the database label so that
 * names stay in sync with i18n and code changes (e.g. renaming
 * "Config TPV" → "Configuración") without needing a DB migration.
 */
const FEATURE_CODE_TO_TRANSLATION_KEY: Record<string, string> = {
  COMMAND_CENTER: 'playtelecom.commandCenter',
  SERIALIZED_STOCK: 'playtelecom.stock',
  PROMOTERS_AUDIT: 'playtelecom.promoters',
  STORES_ANALYSIS: 'playtelecom.stores',
  MANAGERS_DASHBOARD: 'playtelecom.managers',
  USERS_MANAGEMENT: 'playtelecom.users',
  TPV_CONFIGURATION: 'playtelecom.tpvConfig',
  SALES_REPORT: 'playtelecom.sales',
}

export type SidebarMeta = {
  navItems: any[]
  hiddenSidebarItems: string[]
  isSuperadmin: boolean
}

export function AppSidebar({
  user,
  onSidebarReady,
  onSearchClick,
  ...props
}: React.ComponentProps<typeof Sidebar> & {
  user: User
  onSidebarReady?: (meta: SidebarMeta) => void
  onSearchClick?: () => void
}) {
  const { allVenues, activeVenue, staffInfo, checkFeatureAccess } = useAuth()
  const { t } = useTranslation(['translation', 'sidebar'])
  const { can, canFeature } = useAccess()

  // Use venue-specific role from staffInfo (properly derived from active venue)
  const effectiveRole = staffInfo?.role || user.role

  // Check if venue can access operational features (KYC verification)
  const hasKYCAccess = React.useMemo(() => canAccessOperationalFeatures(activeVenue), [activeVenue])

  // ========== Sector-Aware Terminology ==========
  const { term } = useTerminology()

  const queryClient = useQueryClient()

  // ========== Sidebar Visibility (Superadmin Toggle) ==========
  const isSuperadmin = effectiveRole === 'SUPERADMIN'
  const [hiddenSidebarItems, setHiddenSidebarItems] = React.useState<string[]>(activeVenue?.settings?.hiddenSidebarItems ?? [])

  // Sync local state when venue changes
  React.useEffect(() => {
    setHiddenSidebarItems(activeVenue?.settings?.hiddenSidebarItems ?? [])
  }, [activeVenue?.id, activeVenue?.settings?.hiddenSidebarItems])

  const handleToggleVisibility = React.useCallback(
    async (url: string) => {
      if (!activeVenue?.id) return

      const current = hiddenSidebarItems
      const updated = current.includes(url) ? current.filter(u => u !== url) : [...current, url]

      // Optimistic update
      setHiddenSidebarItems(updated)

      try {
        await api.put(`/api/v1/dashboard/venues/${activeVenue.id}/settings`, {
          hiddenSidebarItems: updated,
        })
        // Refresh venue data so other components stay in sync
        await queryClient.refetchQueries({ queryKey: ['status'] })
      } catch {
        // Revert on failure
        setHiddenSidebarItems(current)
      }
    },
    [activeVenue?.id, hiddenSidebarItems, queryClient],
  )

  // ========== White-Label Dashboard Mode ==========
  const { isWhiteLabelEnabled, navigation: wlNavigation, isFeatureEnabled } = useWhiteLabelConfig()

  const location = useLocation()

  const navMain = React.useMemo(() => {
    // ========== Unified Sidebar ==========
    // WL venues show: WL module items (Supervisor, Gerentes…) + Avoqado core items (with badge)
    // Regular venues show: Avoqado core items only
    const isWhiteLabelVenue = isWhiteLabelEnabled

    // ── White-Label Module Items (non-AVOQADO_* features like Supervisor, Gerentes) ──
    // These routes ONLY exist under /wl/venues/:slug, so URLs must be absolute.
    const wlBasePath = activeVenue?.slug ? `/wl/venues/${activeVenue.slug}` : ''
    const whiteLabelModuleItems: Array<any> = []
    if (isWhiteLabelVenue && wlNavigation.length > 0 && wlBasePath) {
      const enabledModuleItems = wlNavigation.filter(navItem => {
        const featureCode = navItem.featureCode || ''
        if (!featureCode) return false
        // Skip AVOQADO_* features — they are handled by the Avoqado core section below
        if (featureCode.startsWith('AVOQADO_')) return false
        if (!isFeatureEnabled(featureCode)) return false
        return canFeature(featureCode)
      })

      for (const navItem of enabledModuleItems) {
        const featureCode = navItem.featureCode || ''
        const translationKey = FEATURE_CODE_TO_TRANSLATION_KEY[featureCode]
        const title = translationKey
          ? t(`sidebar:${translationKey}`, { orgName: activeVenue?.organization?.name || 'White Label' })
          : navItem.label || featureCode || 'Untitled'

        whiteLabelModuleItems.push({
          title,
          url: `${wlBasePath}/${getFeatureRoute(featureCode)}`,
          icon: getIconComponent(navItem.icon, featureCode),
          isActive: true,
          locked: false,
          isAvoqadoCore: false,
        })
      }
    }

    // ── Avoqado Core Items ──

    // Define all possible items with their required permissions and features
    const allItems = [
      // ── Main (no group label) ──
      { title: t('sidebar:routes.home'), isActive: true, url: 'home', icon: Home, permission: 'home:read', locked: false, group: 'main' },

      // ── Operaciones ──
      {
        title: term('menu'),
        isActive: location.pathname.includes('/menumaker'),
        url: 'menumaker/overview',
        icon: BookOpen,
        permission: 'menu:read',
        locked: false,
        group: 'operations',
        items: [
          { title: t('menu:menumaker.nav.overview'), url: 'menumaker/overview', permission: 'menu:read' },
          { title: t('menu:menumaker.nav.menus'), url: 'menumaker/menus', permission: 'menu:read' },
          { title: t('menu:menumaker.nav.categories'), url: 'menumaker/categories', permission: 'menu:read' },
          { title: t('menu:menumaker.nav.products'), url: 'menumaker/products', permission: 'menu:read' },
          { title: t('menu:menumaker.nav.services'), url: 'menumaker/services', permission: 'menu:read' },
          { title: t('menu:menumaker.nav.modifierGroups'), url: 'menumaker/modifier-groups', permission: 'menu:read' },
        ],
      },
      {
        title: t('sidebar:routes.inventory'),
        isActive: location.pathname.startsWith('/inventory'),
        url: 'inventory/raw-materials',
        icon: Package,
        permission: 'inventory:read',
        locked: !hasKYCAccess,
        requiredFeature: 'INVENTORY_TRACKING',
        group: 'operations',
        items: [
          { title: 'Resumen de existencias', url: 'inventory/stock-overview', permission: 'inventory:read' },
          { title: 'Historial', url: 'inventory/history', permission: 'inventory:read' },
          { title: 'Pedidos', url: 'inventory/purchase-orders', permission: 'inventory:read' },
          { title: 'Proveedores', url: 'inventory/suppliers', permission: 'inventory:read' },
          { title: 'Ingredientes', url: 'inventory/ingredients', permission: 'inventory:read' },
          { title: t('sidebar:routes.recipes', { defaultValue: 'Recetas' }), url: 'inventory/recipes', permission: 'inventory:read' },
          { title: 'Precios', url: 'inventory/pricing', permission: 'inventory:read' },
          { title: 'Modificadores', url: 'inventory/modifier-analytics', permission: 'inventory:read' },
          { title: 'Recuentos de existencias', url: 'inventory/counts', permission: 'inventory:read', comingSoon: true },
          { title: 'Reabastecimientos pendientes', url: 'inventory/restocks', permission: 'inventory:read', comingSoon: true },
        ],
      },
      // NOTE: Sales (Ventas) collapsible section inserted below via splice
      {
        title: t('sidebar:routes.shifts'),
        isActive: true,
        url: 'shifts',
        icon: Ungroup,
        permission: 'shifts:read',
        locked: !hasKYCAccess,
        requiresShiftsEnabled: true,
        group: 'operations',
      },
      {
        title: t('sidebar:routes.tpv'),
        isActive: true,
        url: 'tpv',
        icon: Smartphone,
        permission: 'tpv:read',
        locked: !hasKYCAccess,
        group: 'operations',
      },
      {
        title: t('sidebar:routes.reservations'),
        isActive: true,
        url: 'reservations',
        icon: CalendarDays,
        permission: 'reservations:read',
        locked: false,
        group: 'operations',
        items: [
          { title: t('sidebar:reservationsMenu.overview'), url: 'reservations', permission: 'reservations:read' },
          { title: t('sidebar:reservationsMenu.calendar'), url: 'reservations/calendar', permission: 'reservations:read' },
          { title: t('sidebar:reservationsMenu.waitlist'), url: 'reservations/waitlist', permission: 'reservations:read' },
          { title: t('sidebar:reservationsMenu.settings'), url: 'reservations/settings', permission: 'reservations:read' },
        ],
      },

      // ── Personas ──
      {
        title: t('sidebar:routes.teams'),
        isActive: true,
        url: 'team',
        icon: Users,
        permission: 'teams:read',
        locked: false,
        group: 'people',
      },
      {
        title: t('sidebar:routes.commissions'),
        isActive: true,
        url: 'commissions',
        icon: DollarSign,
        permission: 'commissions:read',
        locked: !hasKYCAccess,
        group: 'people',
      },
      { title: t('sidebar:routes.reviews'), isActive: true, url: 'reviews', icon: Star, permission: 'reviews:read', locked: false, group: 'people' },
    ]

    // Map of standard sidebar URLs to their white-label feature codes
    // EVERY Avoqado core item must be here so white-label venues only show explicitly-enabled features
    const urlToWhiteLabelFeature: Record<string, string> = {
      home: 'AVOQADO_DASHBOARD',
      'menumaker/overview': 'AVOQADO_MENU',
      'inventory/raw-materials': 'AVOQADO_INVENTORY',
      team: 'AVOQADO_TEAM',
      reviews: 'AVOQADO_REVIEWS',
      tpv: 'AVOQADO_TPVS',
      commissions: 'AVOQADO_COMMISSIONS',
      'available-balance': 'AVOQADO_BALANCE',
      shifts: 'AVOQADO_SHIFTS',
      reservations: 'AVOQADO_RESERVATIONS',
    }

    // Filter items based on permissions AND active features
    const filteredItems = allItems.filter(item => {
      // Check permission
      if (!can(item.permission)) return false

      // For white-label venues in "Full" mode, check BOTH:
      // 1. Feature is enabled in white-label config
      // 2. User's role has access to the feature
      if (isWhiteLabelVenue) {
        const whiteLabelFeatureCode = urlToWhiteLabelFeature[item.url]
        if (whiteLabelFeatureCode) {
          // Check if feature is enabled
          if (!isFeatureEnabled(whiteLabelFeatureCode)) {
            return false
          }
          // Check if user's role can access this feature
          if (!canFeature(whiteLabelFeatureCode)) {
            return false
          }
        }
      }

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
      { title: term('orderPlural'), url: 'orders', permission: 'orders:read', whiteLabelFeature: 'AVOQADO_ORDERS' },
      {
        title: t('sidebar:salesMenu.transactions', { defaultValue: 'Transacciones' }),
        url: 'payments',
        permission: 'payments:read',
        whiteLabelFeature: 'AVOQADO_PAYMENTS',
      },
    ].filter(item => {
      // Check permission
      if (item.permission && !can(item.permission)) return false
      // For white-label venues, check if feature is enabled
      if (isWhiteLabelVenue && item.whiteLabelFeature && !isFeatureEnabled(item.whiteLabelFeature)) return false
      return true
    })

    // Only show Sales menu if user has at least one subitem
    if (salesSubItems.length > 0 && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_ORDERS') || isFeatureEnabled('AVOQADO_PAYMENTS'))) {
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
        group: 'operations',
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

    // Only show Customers menu if user has at least one subitem AND (not white-label OR customers feature enabled)
    if (customersSubItems.length > 0 && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_CUSTOMERS'))) {
      // Find index after Teams to insert Customers menu (before Commissions)
      const teamsIndex = filteredItems.findIndex(item => item.url === 'team')
      const insertIndex = teamsIndex !== -1 ? teamsIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:customersMenu.title'),
        url: '#customers',
        icon: Users,
        locked: false,
        items: customersSubItems,
        permission: null as any,
        group: 'people',
      } as any)
    }

    // Promotions submenu - filter subitems based on permissions
    const promotionsSubItems = [
      { title: t('sidebar:promotionsMenu.discounts'), url: 'promotions/discounts', permission: 'discounts:read' },
      { title: t('sidebar:promotionsMenu.coupons'), url: 'promotions/coupons', permission: 'coupons:read' },
    ].filter(item => !item.permission || can(item.permission))

    // Only show Promotions menu if user has at least one subitem AND (not white-label OR promotions feature enabled)
    if (promotionsSubItems.length > 0 && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_PROMOTIONS'))) {
      // Find index after Reviews to insert Promotions menu
      const reviewsIndex = filteredItems.findIndex(item => item.url === 'reviews')
      const insertIndex = reviewsIndex !== -1 ? reviewsIndex + 1 : filteredItems.length
      filteredItems.splice(insertIndex, 0, {
        title: t('sidebar:promotionsMenu.title'),
        url: '#promotions',
        icon: Tag,
        locked: false,
        items: promotionsSubItems,
        permission: null as any,
        group: 'people',
      } as any)
    }

    // Available Balance — first item in Reportes group
    if (can('settlements:read') && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_BALANCE'))) {
      filteredItems.push({
        title: t('sidebar:availableBalance'),
        isActive: true,
        url: 'available-balance',
        icon: Wallet,
        permission: 'settlements:read',
        locked: !hasKYCAccess,
        group: 'reports',
      } as any)
    }

    // Reports — flat items (no collapsible parent) under "Reportes" group
    const reportItems = [
      {
        title: t('sidebar:reportsMenu.payLaterAging', { defaultValue: 'Cuentas por Cobrar' }),
        url: 'reports/pay-later-aging',
        icon: HandCoins,
        permission: 'tpv-reports:pay-later-aging',
        group: 'reports',
      },
      { title: t('sidebar:reportsMenu.salesSummary'), url: 'reports/sales-summary', icon: BarChart3, permission: 'reports:read', group: 'reports' },
      { title: t('sidebar:reportsMenu.salesByItem'), url: 'reports/sales-by-item', icon: Receipt, permission: 'reports:read', group: 'reports' },
      { title: t('sidebar:reportsMenu.salesByCategory'), url: 'reports/sales-by-category', icon: Receipt, permission: 'reports:read', group: 'reports', comingSoon: true },
      { title: t('sidebar:reportsMenu.paymentMethods'), url: 'reports/payment-methods', icon: CreditCard, permission: 'reports:read', group: 'reports', comingSoon: true },
      { title: t('sidebar:reportsMenu.taxes'), url: 'reports/taxes', icon: FileSpreadsheet, permission: 'reports:read', group: 'reports', comingSoon: true },
      { title: t('sidebar:reportsMenu.voids'), url: 'reports/voids', icon: Receipt, permission: 'reports:read', group: 'reports', comingSoon: true },
      { title: t('sidebar:reportsMenu.modifiers'), url: 'reports/modifiers', icon: Receipt, permission: 'reports:read', group: 'reports', comingSoon: true },
    ].filter(item => !item.permission || can(item.permission))

    // Only add reports if user has permissions AND (not white-label OR reports feature enabled)
    if (reportItems.length > 0 && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_REPORTS'))) {
      for (const report of reportItems) {
        filteredItems.push({
          ...report,
          isActive: true,
          locked: !hasKYCAccess,
        } as any)
      }
    }

    // Settings — flat items under "Configuración" group (no collapsible parent)
    const settingsItems = [
      { title: t('sidebar:routes.editvenue'), url: 'edit', icon: Store, permission: 'venues:read' },
      // Role permissions only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', icon: Shield, permission: null }]
        : []),
      // Billing only for ADMIN+
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:routes.billing'), url: 'settings/billing', icon: CreditCard, permission: 'billing:read' }]
        : []),
      // Notifications preferences
      { title: t('sidebar:routes.notifications'), url: 'notifications/preferences', icon: Settings2, permission: 'settings:read' },
    ].filter(item => !item.permission || can(item.permission))

    // Only add settings if user has at least one item AND (not white-label OR settings feature enabled)
    if (settingsItems.length > 0 && (!isWhiteLabelVenue || isFeatureEnabled('AVOQADO_SETTINGS'))) {
      for (const setting of settingsItems) {
        filteredItems.push({
          ...setting,
          isActive: true,
          locked: false,
          group: 'settings',
        } as any)
      }
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
        group: 'settings',
      } as any)
    }

    // Mark Avoqado core items with badge when WL module items are present
    if (isWhiteLabelVenue && whiteLabelModuleItems.length > 0) {
      filteredItems.forEach(item => {
        ;(item as any).isAvoqadoCore = true
      })
    }

    // Combine: WL module items first, then Avoqado core items
    return [...whiteLabelModuleItems, ...filteredItems]
  }, [
    t,
    term,
    effectiveRole,
    can,
    hasKYCAccess,
    checkFeatureAccess,
    activeVenue,
    location.pathname,
    isWhiteLabelEnabled,
    wlNavigation,
    isFeatureEnabled,
    canFeature,
  ])

  // Expose sidebar data to parent for command palette
  React.useEffect(() => {
    onSidebarReady?.({ navItems: navMain, hiddenSidebarItems, isSuperadmin })
  }, [navMain, hiddenSidebarItems, isSuperadmin, onSidebarReady])

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

  const { state: sidebarState, isMobile } = useSidebar()
  const isSidebarCollapsed = sidebarState === 'collapsed' && !isMobile
  const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.userAgent)

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="p-0 border-b border-sidebar-border">
        {defaultVenue && <VenuesSwitcher venues={venuesToShow} defaultVenue={defaultVenue} />}
      </SidebarHeader>
      {/* Search trigger for command palette */}
      <div className="px-2 py-2">
        <button
          type="button"
          onClick={onSearchClick}
          className={cn(
            'flex w-full items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/50 px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground',
            isSidebarCollapsed && 'justify-center px-0',
          )}
        >
          <Search className="h-4 w-4 shrink-0" />
          {!isSidebarCollapsed && (
            <>
              <span className="flex-1 text-left">Buscar...</span>
              <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-0.5 rounded border border-sidebar-border bg-sidebar px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
                {isMac ? '⌘' : 'Ctrl+'} K
              </kbd>
            </>
          )}
        </button>
      </div>
      <SidebarContent>
        <NavMain
          items={navMain}
          superadminItems={user.role === 'SUPERADMIN' ? superAdminRoutes : []}
          hiddenSidebarItems={hiddenSidebarItems}
          isSuperadmin={isSuperadmin}
          onToggleVisibility={isSuperadmin ? handleToggleVisibility : undefined}
        />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-sidebar-border">
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
