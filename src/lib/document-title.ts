type TranslateOptions = {
  defaultValue?: string
  [key: string]: unknown
}

type Translate = (key: string, options?: TranslateOptions) => string

type RouteTitleTranslators = {
  sidebarT: Translate
  organizationT: Translate
  commonT: Translate
  menuT: Translate
}

const APP_NAME = 'Avoqado'

const decodePathSegment = (segment: string): string => {
  try {
    return decodeURIComponent(segment)
  } catch {
    return segment
  }
}

const humanizePathSegment = (segment: string): string =>
  segment
    .replace(/[-_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b\w/g, char => char.toUpperCase())

const getDecodedPathSegments = (pathname: string): string[] =>
  pathname
    .split('/')
    .filter(Boolean)
    .map(decodePathSegment)

export const getEnvironmentTitleSuffix = (): string => {
  if (typeof document === 'undefined') {
    return ''
  }

  const env = document.documentElement.getAttribute('data-env')

  if (env === 'development') return ' (DEV)'
  if (env === 'staging') return ' (STAGING)'

  return ''
}

export const buildDocumentTitle = (pageTitle?: string | null): string => {
  const normalizedTitle = pageTitle?.replace(/\s+/g, ' ').trim()
  const suffix = getEnvironmentTitleSuffix()

  if (!normalizedTitle || normalizedTitle === APP_NAME) {
    return `${APP_NAME}${suffix}`
  }

  return `${normalizedTitle} | ${APP_NAME}${suffix}`
}

const resolvePublicTitle = (segments: string[], sidebarT: Translate): string => {
  const [root, second] = segments

  if (root === 'login') return 'Login'
  if (root === 'signup') return 'Signup'
  if (root === 'terms') return 'Terms'
  if (root === 'privacy') return 'Privacy'
  if (root === 'onboarding') return 'Onboarding'
  if (root === 'invite') return 'Invitation'
  if (root === 'analytics') return sidebarT('analytics', { defaultValue: 'Analytics' })
  if (root === 'venues') return sidebarT('venues', { defaultValue: 'Venues' })
  if (root === 'receipts') return 'Receipt'

  if (root === 'auth') {
    if (second === 'forgot-password') return 'Forgot Password'
    if (second === 'reset-password') return 'Reset Password'
    if (second === 'verify-email') return 'Verify Email'
    if (second === 'google') return 'Google Sign-In'
  }

  if (root === 'admin') {
    const adminMap: Record<string, string> = {
      '': sidebarT('admin', { defaultValue: 'Administration' }),
      general: sidebarT('admin', { defaultValue: 'Administration' }),
      users: 'Users',
      venues: sidebarT('venues', { defaultValue: 'Venues' }),
      settings: sidebarT('config', { defaultValue: 'Settings' }),
      system: sidebarT('system', { defaultValue: 'System Status' }),
      global: 'Global Settings',
      superadmins: 'Superadmins',
    }

    return adminMap[second ?? ''] ?? humanizePathSegment(second ?? root)
  }

  return humanizePathSegment(root)
}

const resolveOrganizationTitle = (segments: string[], organizationT: Translate): string => {
  const section = segments[0]
  const organizationMap: Record<string, string> = {
    '': organizationT('breadcrumb.dashboard', { defaultValue: 'Dashboard' }),
    dashboard: organizationT('breadcrumb.dashboard', { defaultValue: 'Dashboard' }),
    venues: organizationT('breadcrumb.venues', { defaultValue: 'Venues' }),
    team: organizationT('breadcrumb.team', { defaultValue: 'Team' }),
    settings: organizationT('breadcrumb.settings', { defaultValue: 'Settings' }),
    analytics: organizationT('breadcrumb.analytics', { defaultValue: 'Analytics' }),
  }

  return organizationMap[section ?? ''] ?? humanizePathSegment(section ?? 'organization')
}

const resolveWlOrganizationTitle = (segments: string[], organizationT: Translate): string => {
  const section = segments[0]
  const organizationMap: Record<string, string> = {
    '': organizationT('sidebar.overview', { defaultValue: 'Overview' }),
    venues: organizationT('breadcrumb.venues', { defaultValue: 'Venues' }),
    managers: organizationT('breadcrumb.managers', { defaultValue: 'Managers' }),
    reports: organizationT('breadcrumb.reports', { defaultValue: 'Reports' }),
  }

  return organizationMap[section ?? ''] ?? humanizePathSegment(section ?? 'organization')
}

const resolvePlayTelecomTitle = (segments: string[], sidebarT: Translate): string => {
  const section = segments[0] ?? 'command-center'
  const playTelecomMap: Record<string, string> = {
    'command-center': sidebarT('playtelecom.commandCenter', { defaultValue: 'Global Overview' }),
    stock: sidebarT('playtelecom.stock', { defaultValue: 'Stock Control' }),
    sales: sidebarT('playtelecom.sales', { defaultValue: 'Sales' }),
    stores: sidebarT('playtelecom.stores', { defaultValue: 'Stores' }),
    managers: sidebarT('playtelecom.managers', { defaultValue: 'Managers' }),
    promoters: sidebarT('playtelecom.promoters', { defaultValue: 'Sales Force' }),
    users: sidebarT('playtelecom.users', { defaultValue: 'Users' }),
    'tpv-config': sidebarT('playtelecom.tpvConfig', { defaultValue: 'TPV Configuration' }),
    supervisor: 'Supervisor',
    reporte: 'Reporte',
  }

  return playTelecomMap[section] ?? humanizePathSegment(section)
}

const resolveInventoryTitle = (segments: string[], sidebarT: Translate): string => {
  const section = segments[0]
  const inventoryMap: Record<string, string> = {
    '': sidebarT('routes.inventory', { defaultValue: 'Inventory' }),
    'stock-overview': 'Stock Overview',
    'raw-materials': 'Raw Materials',
    history: 'Inventory History',
    counts: 'Counts',
    'purchase-orders': 'Purchase Orders',
    vendors: 'Vendors',
    suppliers: 'Suppliers',
    restocks: 'Restocks',
    ingredients: 'Ingredients',
    'product-stock': 'Product Stock',
    recipes: sidebarT('routes.recipes', { defaultValue: 'Recipes' }),
    pricing: 'Pricing',
    modifiers: 'Modifier Inventory',
    'modifier-analytics': 'Modifier Analytics',
  }

  return inventoryMap[section ?? ''] ?? humanizePathSegment(section ?? 'inventory')
}

const resolveVenueTitle = ({ sidebarT, commonT, menuT }: RouteTitleTranslators, segments: string[]): string => {
  const [section, subsection, thirdSection] = segments

  if (!section) return sidebarT('routes.home', { defaultValue: 'Home' })

  const baseRouteMap: Record<string, string> = {
    home: sidebarT('routes.home', { defaultValue: 'Home' }),
    account: commonT('sidebar.account', { defaultValue: 'Account' }),
    shifts: sidebarT('routes.shifts', { defaultValue: 'Shifts' }),
    payments: sidebarT('salesMenu.transactions', { defaultValue: 'Transactions' }),
    orders: sidebarT('salesMenu.orders', { defaultValue: 'Orders' }),
    analytics: sidebarT('analytics', { defaultValue: 'Analytics' }),
    'available-balance': sidebarT('availableBalance', { defaultValue: 'Available Balance' }),
    edit: sidebarT('routes.editvenue', { defaultValue: 'Edit Venue' }),
    tpv: sidebarT('routes.tpv', { defaultValue: 'Terminals' }),
    reviews: sidebarT('routes.reviews', { defaultValue: 'Reviews' }),
    team: sidebarT('routes.teams', { defaultValue: 'Teams' }),
    commissions: sidebarT('routes.commissions', { defaultValue: 'Commissions' }),
    customers: sidebarT('customersMenu.title', { defaultValue: 'Customers' }),
    loyalty: sidebarT('customersMenu.loyalty', { defaultValue: 'Loyalty Program' }),
    notifications: commonT('notifications.title', { defaultValue: 'Notifications' }),
    'payment-config': sidebarT('paymentConfig', { defaultValue: 'Payment Config' }),
    'merchant-accounts': sidebarT('merchantAccounts', { defaultValue: 'Merchant Accounts' }),
    'ecommerce-merchants': sidebarT('ecommerceChannels', { defaultValue: 'E-commerce Channels' }),
    'serialized-sales-demo': 'Serialized Sales Demo',
  }

  if (section === 'playtelecom') {
    return resolvePlayTelecomTitle([subsection, thirdSection], sidebarT)
  }

  if (
    section === 'command-center' ||
    section === 'stock' ||
    section === 'sales' ||
    section === 'stores' ||
    section === 'managers' ||
    section === 'promoters' ||
    section === 'users' ||
    section === 'tpv-config' ||
    section === 'supervisor' ||
    section === 'reporte'
  ) {
    return resolvePlayTelecomTitle([section], sidebarT)
  }

  if (section === 'menumaker') {
    const menuMap: Record<string, string> = {
      '': sidebarT('routes.menumaker', { defaultValue: 'Products' }),
      overview: menuT('menumaker.nav.overview', { defaultValue: 'Overview' }),
      menus: menuT('menumaker.nav.menus', { defaultValue: 'Menus' }),
      categories: menuT('menumaker.nav.categories', { defaultValue: 'Categories' }),
      products: menuT('menumaker.nav.products', { defaultValue: 'Products' }),
      'modifier-groups': menuT('menumaker.nav.modifierGroups', { defaultValue: 'Modifier Groups' }),
    }

    return menuMap[subsection ?? ''] ?? sidebarT('routes.menumaker', { defaultValue: 'Products' })
  }

  if (section === 'reports') {
    const reportsMap: Record<string, string> = {
      '': sidebarT('reports', { defaultValue: 'Reports' }),
      'pay-later-aging': sidebarT('reportsMenu.payLaterAging', { defaultValue: 'Accounts Receivable' }),
      'sales-summary': sidebarT('reportsMenu.salesSummary', { defaultValue: 'Sales Summary' }),
      'sales-by-item': sidebarT('reportsMenu.salesByItem', { defaultValue: 'Sales by Item' }),
      'sales-by-category': sidebarT('reportsMenu.salesByCategory', { defaultValue: 'Sales by Category' }),
    }

    return reportsMap[subsection ?? ''] ?? sidebarT('reports', { defaultValue: 'Reports' })
  }

  if (section === 'promotions') {
    const promotionsMap: Record<string, string> = {
      discounts: sidebarT('promotionsMenu.discounts', { defaultValue: 'Discounts' }),
      coupons: sidebarT('promotionsMenu.coupons', { defaultValue: 'Coupon Codes' }),
    }

    return promotionsMap[subsection ?? ''] ?? sidebarT('promotionsMenu.title', { defaultValue: 'Promotions' })
  }

  if (section === 'settings') {
    if (subsection === 'role-permissions') {
      return sidebarT('rolePermissions', { defaultValue: 'Role Permissions' })
    }

    if (subsection === 'billing') {
      const billingMap: Record<string, string> = {
        subscriptions: 'Subscriptions',
        history: 'Billing History',
        'payment-methods': 'Payment Methods',
        tokens: 'Tokens',
      }

      return billingMap[thirdSection ?? ''] ?? sidebarT('routes.billing', { defaultValue: 'Billing' })
    }

    return sidebarT('config', { defaultValue: 'Settings' })
  }

  if (section === 'inventory') {
    return resolveInventoryTitle([subsection], sidebarT)
  }

  if (section === 'customers' && subsection === 'groups') {
    return sidebarT('customersMenu.groups', { defaultValue: 'Customer Groups' })
  }

  if (section === 'notifications' && subsection === 'preferences') {
    return commonT('notifications.preferences', { defaultValue: 'Notification Preferences' })
  }

  return baseRouteMap[section] ?? humanizePathSegment(section)
}

const resolveSuperadminTitle = (segments: string[], sidebarT: Translate): string => {
  const section = segments[0]
  const secondSection = segments[1]

  if (!section) return sidebarT('main', { defaultValue: 'Main Dashboard' })

  if (section === 'kyc') {
    return 'KYC Review'
  }

  if (section === 'marketing') {
    if (secondSection === 'templates') {
      return 'Marketing Templates'
    }

    return 'Marketing'
  }

  const superadminMap: Record<string, string> = {
    venues: sidebarT('venues', { defaultValue: 'Venues' }),
    analytics: sidebarT('analytics', { defaultValue: 'Analytics' }),
    alerts: sidebarT('alerts', { defaultValue: 'Alerts' }),
    features: sidebarT('features', { defaultValue: 'Features' }),
    revenue: sidebarT('revenue', { defaultValue: 'Revenue' }),
    'profit-analytics': 'Profit Analytics',
    customers: sidebarT('customers', { defaultValue: 'Customers' }),
    growth: sidebarT('growth', { defaultValue: 'Growth' }),
    'payment-providers': sidebarT('paymentProviders', { defaultValue: 'Payment Providers' }),
    'merchant-accounts': sidebarT('merchantAccounts', { defaultValue: 'Merchant Accounts' }),
    terminals: sidebarT('terminals', { defaultValue: 'Terminals' }),
    'payment-analytics': sidebarT('paymentAnalytics', { defaultValue: 'Payment Analytics' }),
    'cost-structures': sidebarT('costStructures', { defaultValue: 'Cost Structures' }),
    'settlement-terms': sidebarT('settlementTerms', { defaultValue: 'Settlement Terms' }),
    'venue-pricing': sidebarT('venuePricing', { defaultValue: 'Venue Pricing' }),
    testing: sidebarT('testing', { defaultValue: 'Testing' }),
    webhooks: sidebarT('webhooks', { defaultValue: 'Webhooks' }),
    'credit-assessment': sidebarT('creditAssessment', { defaultValue: 'Credit Assessment' }),
    modules: sidebarT('modules', { defaultValue: 'Modules' }),
    organizations: sidebarT('organizations', { defaultValue: 'Organizations' }),
    'master-totp': 'Master TOTP',
    'tpv-updates': 'TPV Updates',
    'push-notifications': 'Push Notifications',
    reports: sidebarT('reports', { defaultValue: 'Reports' }),
    support: sidebarT('support', { defaultValue: 'Support' }),
    settings: sidebarT('config', { defaultValue: 'Settings' }),
    onboarding: 'Onboarding',
  }

  return superadminMap[section] ?? humanizePathSegment(section)
}

export const resolveRouteDocumentTitle = (pathname: string, translators: RouteTitleTranslators): string => {
  const segments = getDecodedPathSegments(pathname)
  const [rootSegment] = segments

  if (!rootSegment) {
    return APP_NAME
  }

  if (rootSegment === 'superadmin') {
    return resolveSuperadminTitle(segments.slice(1), translators.sidebarT)
  }

  if (rootSegment === 'organizations' && segments.length >= 2) {
    return resolveOrganizationTitle(segments.slice(2), translators.organizationT)
  }

  if (rootSegment === 'venues') {
    if (segments.length === 1) {
      return translators.sidebarT('venues', { defaultValue: 'Venues' })
    }

    return resolveVenueTitle(translators, segments.slice(2))
  }

  if (rootSegment === 'wl' && segments[1] === 'organizations' && segments.length >= 3) {
    return resolveWlOrganizationTitle(segments.slice(3), translators.organizationT)
  }

  if (rootSegment === 'wl' && segments[1] === 'venues' && segments.length >= 3) {
    return resolveVenueTitle(translators, segments.slice(3))
  }

  return resolvePublicTitle(segments, translators.sidebarT)
}
