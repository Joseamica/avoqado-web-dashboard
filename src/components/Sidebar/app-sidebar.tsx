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
  Link2,
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
  Zap,
  Search,
  LucideIcon,
  AlertCircle,
  RefreshCw,
  Monitor,
} from 'lucide-react'
import * as React from 'react'
import { useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'

import { NavMain } from '@/components/Sidebar/nav-main'
import { NavUser } from '@/components/Sidebar/nav-user'
import { VenuesSwitcher } from '@/components/Sidebar/venues-switcher'
import { ChatBubble } from '@/components/Chatbot'
import { AcceptPaymentTrigger } from '@/components/Sidebar/AcceptPaymentTrigger'
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
  TPV_CONFIGURATION: 'Smartphone',
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

    // ── Helper: check white-label feature + role access ──
    const canWL = (featureCode: string) => {
      if (!isWhiteLabelVenue) return true
      return isFeatureEnabled(featureCode) && canFeature(featureCode)
    }

    // ===================================================================
    // Sub-Sidebar Sections
    // Each section defines items shown when user clicks a trigger in the
    // main sidebar. Items with `items` array render as collapsible
    // dropdowns within the sub-sidebar.
    // ===================================================================

    // ── Menu / Carta ──
    const menuSubItems = [
      { title: t('menu:menumaker.nav.overview'), url: 'menumaker/overview', permission: 'menu:read' },
      { title: t('menu:menumaker.nav.menus'), url: 'menumaker/menus', permission: 'menu:read' },
      { title: t('menu:menumaker.nav.categories'), url: 'menumaker/categories', permission: 'menu:read', keywords: ['secciones', 'grupos'] },
      { title: t('menu:menumaker.nav.products'), url: 'menumaker/products', permission: 'menu:read', keywords: ['platillos', 'articulos', 'items'] },
      { title: t('menu:menumaker.nav.services'), url: 'menumaker/services', permission: 'menu:read' },
      { title: t('menu:menumaker.nav.modifierGroups'), url: 'menumaker/modifier-groups', permission: 'menu:read' },
      { title: t('sidebar:creditPacks'), url: 'menumaker/credit-packs', permission: 'creditPacks:read', keywords: ['creditos', 'paquetes', 'bundles', 'prepagados'] },
    ].filter(item => !item.permission || can(item.permission)) as any[]

    // ── Inventario ──
    const inventorySubItems = checkFeatureAccess('INVENTORY_TRACKING') ? [
      { title: 'Resumen de existencias', url: 'inventory/stock-overview', permission: 'inventory:read', keywords: ['stock', 'materia prima', 'almacen'] },
      { title: 'Historial', url: 'inventory/history', permission: 'inventory:read', keywords: ['movimientos', 'registro'] },
      { title: 'Pedidos', url: 'inventory/purchase-orders', permission: 'inventory:read', keywords: ['ordenes de compra', 'abastecimiento'] },
      { title: 'Proveedores', url: 'inventory/suppliers', permission: 'inventory:read', keywords: ['suppliers', 'compras', 'abastecimiento'] },
      { title: 'Ingredientes', url: 'inventory/ingredients', permission: 'inventory:read', keywords: ['materia prima', 'insumos', 'materiales'] },
      { title: t('sidebar:routes.recipes', { defaultValue: 'Recetas' }), url: 'inventory/recipes', permission: 'inventory:read', keywords: ['preparaciones', 'formulas', 'costos'] },
      { title: 'Modificadores', url: 'inventory/modifier-analytics', permission: 'inventory:read' },
      { title: 'Conteos de inventario', url: 'inventory/stock-counts', permission: 'inventory:read', keywords: ['recuentos', 'conteo fisico', 'auditoria'] },
      { title: 'Transferencias', url: 'inventory/transfers', permission: 'inventory:read', keywords: ['traslados', 'movimientos entre ubicaciones'] },
      { title: 'Reabastecimientos pendientes', url: 'inventory/restocks', permission: 'inventory:read', comingSoon: true },
    ].filter(item => !item.permission || can(item.permission)) as any[] : []

    // ── Ventas ──
    const salesSubItems = [
      {
        title: t('sidebar:salesMenu.transactions', { defaultValue: 'Transacciones' }),
        url: 'payments',
        permission: 'payments:read',
        locked: !hasKYCAccess,
        keywords: ['cobros', 'pagos', 'dinero'],
      },
      {
        title: t('sidebar:salesMenu.orders', { defaultValue: 'Pedidos' }),
        url: 'orders',
        permission: 'orders:read',
        locked: !hasKYCAccess,
        keywords: ['ordenes', 'comandas', 'tickets'],
      },
      {
        title: t('sidebar:salesMenu.paymentLinks', { defaultValue: 'Ligas de Pago' }),
        url: '#payment-links',
        icon: Link2,
        permission: 'payment-link:read',
        locked: !hasKYCAccess,
        keywords: ['ligas de pago', 'cobrar', 'link', 'whatsapp', 'qr', 'liga'],
        items: [
          { title: t('sidebar:paymentLinksMenu.links'), url: 'payment-links', permission: 'payment-link:read' },
          { title: t('sidebar:paymentLinksMenu.settings'), url: 'payment-links/settings', permission: 'payment-link:read' },
          { title: t('sidebar:paymentLinksMenu.branding'), url: 'payment-links/branding', permission: 'payment-link:read' },
        ],
      },
      {
        title: t('sidebar:salesMenu.virtualTerminal', { defaultValue: 'Terminal Virtual' }),
        url: 'virtual-terminal',
        icon: Monitor,
        permission: 'payments:read',
        locked: !hasKYCAccess,
        comingSoon: true,
        keywords: ['cobrar', 'tarjeta', 'manual', 'terminal'],
      },
      {
        title: t('sidebar:salesMenu.subscriptions', { defaultValue: 'Suscripciones' }),
        url: 'subscriptions',
        icon: RefreshCw,
        permission: 'payments:read',
        locked: !hasKYCAccess,
        comingSoon: true,
        keywords: ['membresia', 'recurrente', 'plan', 'mensual'],
      },
      {
        title: t('sidebar:salesMenu.disputes', { defaultValue: 'Disputas' }),
        url: 'disputes',
        icon: AlertCircle,
        permission: 'payments:read',
        locked: !hasKYCAccess,
        comingSoon: true,
        keywords: ['contracargos', 'reclamos', 'fraude'],
      },
    ].filter(item => {
      if (item.permission && !can(item.permission)) return false
      if (isWhiteLabelVenue) {
        if (item.url === 'payments' && !canWL('AVOQADO_PAYMENTS')) return false
        if (item.url === 'orders' && !canWL('AVOQADO_ORDERS')) return false
        if (item.url === '#payment-links' && !canWL('AVOQADO_PAYMENT_LINKS')) return false
      }
      return true
    }) as any[]

    // ── Reservaciones ──
    const reservationsSubItems = [
      { title: t('sidebar:reservationsMenu.overview'), url: 'reservations', permission: 'reservations:read' },
      { title: t('sidebar:reservationsMenu.calendar'), url: 'reservations/calendar', permission: 'reservations:read' },
      { title: t('sidebar:reservationsMenu.waitlist'), url: 'reservations/waitlist', permission: 'reservations:read', keywords: ['lista de espera', 'fila'] },
      {
        title: t('sidebar:reservationsMenu.onlineBookingGroup', { defaultValue: 'Reservas en línea' }),
        url: '#reservations-online',
        items: [
          {
            title: t('sidebar:reservationsMenu.channels', { defaultValue: 'Canales' }),
            url: 'reservations/online-booking',
            permission: 'reservations:read',
            keywords: ['link', 'reservar', 'booking', 'embed', 'widget', 'wordpress', 'sitio web', 'codigo', 'snippet'],
          },
          {
            title: t('sidebar:reservationsMenu.onlineSettings', { defaultValue: 'Ajustes' }),
            url: 'reservations/settings',
            permission: 'reservations:read',
            keywords: ['reservas online', 'public booking', 'depositos', 'horarios'],
          },
          {
            title: t('sidebar:reservationsMenu.advancedWidget', { defaultValue: 'Widget avanzado' }),
            url: 'reservations/widget-advanced',
            permission: 'reservations:read',
            comingSoon: true,
            keywords: ['widget avanzado', 'personalizar widget'],
          },
          {
            title: t('sidebar:reservationsMenu.inviteClients', { defaultValue: 'Invitar clientes' }),
            url: 'reservations/invite-clients',
            permission: 'reservations:read',
            comingSoon: true,
            keywords: ['invitar clientes', 'whatsapp', 'campaña'],
          },
        ],
      },
      {
        title: t('sidebar:reservationsMenu.settingsGroup', { defaultValue: 'Ajustes' }),
        url: '#reservations-settings',
        items: [
          { title: t('sidebar:reservationsMenu.general', { defaultValue: 'General' }), url: 'reservations/settings', permission: 'reservations:read' },
          { title: t('sidebar:reservationsMenu.communications', { defaultValue: 'Comunicaciones' }), url: 'reservations/communications', permission: 'reservations:read', comingSoon: true },
        ],
      },
    ].filter(item => !item.permission || can(item.permission)) as any[]

    // ── Equipo ──
    const teamSubItems = [
      { title: t('sidebar:teamMenu.members', { defaultValue: 'Miembros' }), url: 'team', permission: 'teams:read', keywords: ['empleados', 'meseros', 'personal', 'staff', 'recursos humanos'] },
      ...(activeVenue?.settings?.enableShifts ? [
        { title: t('sidebar:routes.shifts'), url: 'shifts', permission: 'shifts:read', locked: !hasKYCAccess, keywords: ['horarios', 'turnos', 'reloj checador', 'cortes de caja', 'caja', 'cierre', 'arqueo'] },
      ] : []),
      { title: t('sidebar:routes.commissions'), url: 'commissions', permission: 'commissions:read', locked: !hasKYCAccess, keywords: ['propinas', 'bonos', 'metas', 'goals'] },
    ].filter(item => {
      if (item.permission && !can(item.permission)) return false
      if (isWhiteLabelVenue) {
        if (item.url === 'team' && !canWL('AVOQADO_TEAM')) return false
        if (item.url === 'shifts' && !canWL('AVOQADO_SHIFTS')) return false
        if (item.url === 'commissions' && !canWL('AVOQADO_COMMISSIONS')) return false
      }
      return true
    }) as any[]

    // ── Clientes ──
    const customersSubItems = (() => {
      const items: any[] = [
        { title: t('sidebar:customersMenu.all'), url: 'customers', permission: 'customers:read', keywords: ['consumidores', 'comensales'] },
        { title: t('sidebar:customersMenu.groups'), url: 'customers/groups', permission: 'customer-groups:read', keywords: ['segmentos'] },
      ]

      if (checkFeatureAccess('LOYALTY_PROGRAM') && canWL('AVOQADO_LOYALTY')) {
        items.push({ title: t('sidebar:customersMenu.loyalty'), url: 'loyalty', permission: 'loyalty:read', keywords: ['lealtad', 'puntos', 'fidelidad'] })
      }

      if (canWL('AVOQADO_REVIEWS')) {
        items.push({ title: t('sidebar:routes.reviews'), url: 'reviews', permission: 'reviews:read', keywords: ['comentarios', 'opiniones', 'calificaciones', 'feedback', 'ratings'] })
      }

      // Promotions dropdown
      const promoItems = [
        { title: t('sidebar:promotionsMenu.discounts'), url: 'promotions/discounts', permission: 'discounts:read', keywords: ['ofertas', 'promociones'] },
        { title: t('sidebar:promotionsMenu.coupons'), url: 'promotions/coupons', permission: 'coupons:read', keywords: ['codigos', 'vouchers'] },
      ].filter(sub => !sub.permission || can(sub.permission))

      if (promoItems.length > 0 && canWL('AVOQADO_PROMOTIONS')) {
        items.push({
          title: t('sidebar:promotionsMenu.title'),
          url: '#promotions',
          items: promoItems,
        })
      }

      return items.filter(item => {
        if ('permission' in item && item.permission && !can(item.permission)) return false
        if (isWhiteLabelVenue && item.url === 'customers' && !canWL('AVOQADO_CUSTOMERS')) return false
        return true
      })
    })() as any[]

    // ── Reportes ──
    const reportsSubItems = [
      { title: t('sidebar:availableBalance'), url: 'available-balance', icon: Wallet, permission: 'settlements:read', locked: !hasKYCAccess, keywords: ['balance', 'liquidaciones', 'depositos', 'transferencias'] },
      { title: t('sidebar:reportsMenu.payLaterAging', { defaultValue: 'Cuentas por Cobrar' }), url: 'reports/pay-later-aging', icon: HandCoins, permission: 'tpv-reports:pay-later-aging', keywords: ['pay later', 'fiado', 'deudas'] },
      { title: t('sidebar:reportsMenu.salesSummary'), url: 'reports/sales-summary', icon: BarChart3, permission: 'reports:read', keywords: ['reporte', 'ventas diarias', 'ganancias', 'ingresos'] },
      { title: t('sidebar:reportsMenu.salesByItem'), url: 'reports/sales-by-item', icon: Receipt, permission: 'reports:read', keywords: ['reporte de productos', 'items vendidos'] },
      { title: t('sidebar:reportsMenu.homeCharts', { defaultValue: 'Gráficas (Home)' }), url: 'reports/home-charts', icon: TrendingUp, permission: 'reports:read', keywords: ['dashboard', 'graficas', 'home legacy'] },
      { title: t('sidebar:reportsMenu.salesByCategory'), url: 'reports/sales-by-category', icon: Receipt, permission: 'reports:read', comingSoon: true },
      { title: t('sidebar:reportsMenu.paymentMethods'), url: 'reports/payment-methods', icon: CreditCard, permission: 'reports:read', comingSoon: true },
      { title: t('sidebar:reportsMenu.taxes'), url: 'reports/taxes', icon: FileSpreadsheet, permission: 'reports:read', comingSoon: true },
      { title: t('sidebar:reportsMenu.voids'), url: 'reports/voids', icon: Receipt, permission: 'reports:read', comingSoon: true },
      { title: t('sidebar:reportsMenu.modifiers'), url: 'reports/modifiers', icon: Receipt, permission: 'reports:read', comingSoon: true },
    ].filter(item => {
      if (item.permission && !can(item.permission)) return false
      if (isWhiteLabelVenue) {
        if (item.url === 'available-balance' && !canWL('AVOQADO_BALANCE')) return false
        if (item.url.startsWith('reports/') && !canWL('AVOQADO_REPORTS')) return false
      }
      return true
    }) as any[]

    // ── Configuracion ──
    const settingsSubItems = [
      { title: t('sidebar:routes.editvenue'), url: 'edit', icon: Store, permission: 'venues:read', keywords: ['ajustes', 'settings', 'negocio'] },
      // Direct shortcut to integrations (Stripe Connect, Google, Crypto, POS).
      // The page itself still lives at /edit/integrations (inside VenueEditLayout)
      // — this is just a one-click entry from the Configuración group.
      {
        title: t('sidebar:routes.integrations', { defaultValue: 'Integraciones' }),
        url: 'edit/integrations',
        icon: Link2,
        permission: 'venues:read',
        keywords: ['stripe', 'connect', 'pagos', 'google', 'integraciones', 'integrations', 'pos'],
      },
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:rolePermissions'), url: 'settings/role-permissions', icon: Shield }]
        : []),
      ...(['ADMIN', 'OWNER', 'SUPERADMIN'].includes(effectiveRole)
        ? [{ title: t('sidebar:routes.billing'), url: 'settings/billing', icon: CreditCard, permission: 'billing:read', keywords: ['facturacion', 'plan', 'suscripcion', 'cobro'] }]
        : []),
      { title: t('sidebar:routes.notifications', { defaultValue: 'Notificaciones' }), url: 'notifications/preferences', icon: Settings2, permission: 'settings:read', keywords: ['alertas', 'avisos', 'preferencias'] },
      ...(effectiveRole === 'SUPERADMIN' ? [{
        title: t('sidebar:superadminTools'),
        url: '#superadmin-venue',
        icon: Shield,
        superadminOnly: true,
        items: [
          { title: t('sidebar:paymentConfig'), url: 'payment-config', superadminOnly: true },
          { title: t('sidebar:ecommerceChannels'), url: 'ecommerce-merchants', superadminOnly: true },
          { title: t('sidebar:merchantAccounts'), url: 'merchant-accounts', superadminOnly: true },
        ],
      }] : []),
    ].filter(item => {
      if ('permission' in item && item.permission && !can(item.permission as string)) return false
      if (isWhiteLabelVenue && !canWL('AVOQADO_SETTINGS')) return false
      return true
    }) as any[]

    // ===================================================================
    // Build Main Sidebar Items (triggers + direct links)
    // ===================================================================
    const mainItems: any[] = []

    // Home
    if (can('home:read') && canWL('AVOQADO_DASHBOARD')) {
      mainItems.push({
        title: t('sidebar:routes.home'), url: 'home', icon: Home,
        keywords: ['inicio', 'dashboard', 'resumen', 'panel'],
      })
    }

    // Menu / Carta
    if (menuSubItems.length > 0 && canWL('AVOQADO_MENU')) {
      mainItems.push({
        title: term('menu'), url: '#menu', icon: BookOpen, subSidebar: 'menu',
        keywords: ['carta', 'menu', 'platillos'],
      })
    }

    // Inventario
    if (inventorySubItems.length > 0 && canWL('AVOQADO_INVENTORY')) {
      mainItems.push({
        title: t('sidebar:routes.inventory'), url: '#inventory', icon: Package, subSidebar: 'inventory',
        locked: !hasKYCAccess,
        keywords: ['almacen', 'bodega', 'stock'],
      })
    }

    // Ventas
    if (salesSubItems.length > 0) {
      mainItems.push({
        title: t('sidebar:salesMenu.title', { defaultValue: 'Ventas' }), url: '#sales', icon: ShoppingCart, subSidebar: 'sales',
        locked: !hasKYCAccess,
        keywords: ['pedidos', 'cobros', 'pagos', 'ventas', 'transacciones'],
      })
    }

    // Reservaciones
    if (reservationsSubItems.length > 0 && canWL('AVOQADO_RESERVATIONS')) {
      mainItems.push({
        title: t('sidebar:routes.reservations'), url: '#reservations', icon: CalendarDays, subSidebar: 'reservations',
        keywords: ['reservas', 'mesas', 'booking'],
      })
    }

    // TPV (direct link, no sub-sidebar)
    if (can('tpv:read') && canWL('AVOQADO_TPVS')) {
      mainItems.push({
        title: t('sidebar:routes.tpv'), url: 'tpv', icon: Smartphone,
        locked: !hasKYCAccess,
        keywords: ['terminal', 'punto de venta', 'pos', 'dispositivo'],
      })
    }

    // Equipo
    if (teamSubItems.length > 0) {
      mainItems.push({
        title: t('sidebar:teamMenu.title', { defaultValue: 'Equipo' }), url: '#team', icon: Users, subSidebar: 'team',
        keywords: ['usuarios', 'empleados', 'personal', 'staff'],
      })
    }

    // Clientes
    if (customersSubItems.length > 0) {
      mainItems.push({
        title: t('sidebar:customersMenu.title'), url: '#customers', icon: Handshake, subSidebar: 'customers',
        keywords: ['consumidores', 'comensales', 'clientes'],
      })
    }

    // Reportes
    if (reportsSubItems.length > 0) {
      mainItems.push({
        title: t('sidebar:reportsMenu.title', { defaultValue: 'Reportes' }), url: '#reports', icon: BarChart3, subSidebar: 'reports',
        keywords: ['reportes', 'analytics', 'estadisticas'],
      })
    }

    // Configuracion
    if (settingsSubItems.length > 0) {
      mainItems.push({
        title: t('sidebar:settingsMenu.title', { defaultValue: 'Configuración' }), url: '#settings', icon: Settings, subSidebar: 'settings',
        keywords: ['ajustes', 'configuracion'],
      })
    }

    // Mark Avoqado core items with badge when WL module items are present
    if (isWhiteLabelVenue && whiteLabelModuleItems.length > 0) {
      mainItems.forEach(item => {
        ;(item as any).isAvoqadoCore = true
      })
    }

    // Build sub-sidebar sections map
    const allSubSidebarSections: Record<string, any[]> = {}
    if (menuSubItems.length > 0) allSubSidebarSections.menu = menuSubItems
    if (inventorySubItems.length > 0) allSubSidebarSections.inventory = inventorySubItems
    if (salesSubItems.length > 0) allSubSidebarSections.sales = salesSubItems
    if (reservationsSubItems.length > 0) allSubSidebarSections.reservations = reservationsSubItems
    if (teamSubItems.length > 0) allSubSidebarSections.team = teamSubItems
    if (customersSubItems.length > 0) allSubSidebarSections.customers = customersSubItems
    if (reportsSubItems.length > 0) allSubSidebarSections.reports = reportsSubItems
    if (settingsSubItems.length > 0) allSubSidebarSections.settings = settingsSubItems

    // Combine: WL module items first, then Avoqado core items
    return {
      items: [...whiteLabelModuleItems, ...mainItems],
      subSidebarSections: allSubSidebarSections,
    }
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
  // Include sub-sidebar items in navItems for search/command palette discoverability
  const allNavItems = React.useMemo(() => {
    const subItems = Object.values(navMain.subSidebarSections).flat()
    return [...navMain.items, ...subItems]
  }, [navMain])

  React.useEffect(() => {
    onSidebarReady?.({ navItems: allNavItems, hiddenSidebarItems, isSuperadmin })
  }, [allNavItems, hiddenSidebarItems, isSuperadmin, onSidebarReady])

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
          items={navMain.items}
          superadminItems={user.role === 'SUPERADMIN' ? superAdminRoutes : []}
          hiddenSidebarItems={hiddenSidebarItems}
          isSuperadmin={isSuperadmin}
          onToggleVisibility={isSuperadmin ? handleToggleVisibility : undefined}
          subSidebarSections={navMain.subSidebarSections}
        />
        {/* <NavProjects projects={data.projects} /> */}
      </SidebarContent>
      <SidebarFooter className="p-0 border-t border-sidebar-border">
        {/* Chatbot trigger is always visible in the sidebar. Backend endpoints
            still enforce feature access and return 403 when the venue is not
            subscribed. */}
        <ChatBubble variant="sidebar" />
        <AcceptPaymentTrigger />
        <NavUser user={navUser} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
