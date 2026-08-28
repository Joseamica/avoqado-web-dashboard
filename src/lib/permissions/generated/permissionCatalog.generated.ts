/**
 * Catálogo de permisos — QUÉ puede otorgar el admin desde la pantalla de roles.
 *
 * 🔴 ARCHIVO GENERADO — NO LO EDITES A MANO. Se regenera con:
 * ```
 * node scripts/regenerar-catalogo-permisos.mjs          # reescribe este archivo
 * node scripts/regenerar-catalogo-permisos.mjs --check  # exit 1 si el servidor se movió
 * ```
 * Un cambio hecho aquí a mano lo borra la siguiente regeneración, y mientras tanto
 * el `--check` se pone rojo. Si lo que quieres es mover una categoría de lugar o
 * renombrarla, edita `CURACION` en ese script. Si lo que quieres es agregar un
 * permiso, agrégalo en `avoqado-server/src/lib/permissions.ts` — aquí llega solo.
 *
 * Deriva de `INDIVIDUAL_PERMISSIONS_BY_RESOURCE` de avoqado-server, que es la misma
 * lista con la que el backend expande los comodines (`orders:*`) al evaluar un
 * permiso. Por eso lo que se ve aquí es exactamente lo que el backend puede conceder.
 *
 * 🔴 POR QUÉ NO SE ESCRIBE A MANO: esto fue una copia manual y no cuadraba — el
 * servidor exponía 233 permisos y esta lista 170. Los 63 que faltaban eran
 * INASIGNABLES: no aparecían en la pantalla, así que ningún admin podía dárselos a
 * nadie, ni siquiera armando un rol personalizado. Una copia a mano no se queda
 * desactualizada con ruido, se queda desactualizada en silencio.
 *
 * 70 categorías · 230 permisos · derivado de avoqado-server · huella ddc32d6dbb2433bc.
 */

export const PERMISSION_CATEGORIES = {
  HOME: {
    label: 'Home Dashboard',
    permissions: ['home:read'],
  },
  ANALYTICS: {
    label: 'Analytics',
    permissions: ['analytics:read', 'analytics:export'],
  },
  REPORTS: {
    label: 'Reports',
    permissions: ['reports:read', 'reports:export'],
  },
  SETTLEMENTS: {
    label: 'Settlements',
    permissions: ['settlements:read', 'settlements:simulate'],
  },
  ACCOUNTING: {
    label: 'Contabilidad',
    permissions: ['accounting:read', 'accounting:reconcile', 'accounting:manage'],
  },
  CASH_OUT: {
    label: 'Retiros de efectivo',
    permissions: ['cash-out:read', 'cash-out:view_own', 'cash-out:withdraw', 'cash-out:manage', 'cash-out:report'],
  },
  ACTIVITY: {
    label: 'Activity Log',
    permissions: ['activity:read'],
  },
  MENU: {
    label: 'Menu Management',
    permissions: ['menu:read', 'menu:create', 'menu:update', 'menu:delete', 'menu:import'],
  },
  PRODUCTS: {
    label: 'Products',
    permissions: ['products:read', 'products:create', 'products:update', 'products:delete'],
  },
  ORDERS: {
    label: 'Orders',
    permissions: [
      'orders:read',
      'orders:create',
      'orders:update',
      'orders:cancel',
      'orders:cancel-unpaid',
      'orders:comp',
      'orders:void',
      'orders:merge',
    ],
  },
  ESTIMATES: {
    label: 'Cotizaciones',
    permissions: ['estimates:create'],
  },
  MANUAL_SALES: {
    label: 'Ventas manuales',
    permissions: ['manual-sales:create'],
  },
  PAYMENTS: {
    label: 'Payments',
    permissions: [
      'payments:read',
      'payments:create',
      'payments:refund',
      'payments:routing-read',
      'payments:routing-manage',
      'payment:create-manual',
    ],
  },
  PAYMENT_LINK: {
    label: 'Links de pago',
    permissions: ['payment-link:read', 'payment-link:create', 'payment-link:update'],
  },
  TENDER_TYPES: {
    label: 'Tipos de pago',
    permissions: ['tender-types:read', 'tender-types:manage'],
  },
  SALE_VERIFICATIONS: {
    label: 'Verificación de ventas',
    permissions: ['sale-verifications:review', 'sale-verifications:reopen', 'sale-verifications:edit'],
  },
  UPSELLS: {
    label: 'Sugerencias de venta',
    permissions: ['upsells:read', 'upsells:create', 'upsells:update', 'upsells:delete'],
  },
  AREA_TICKETS: {
    label: 'Vales por área',
    permissions: [
      'area-tickets:issue',
      'area-tickets:checkout',
      'area-tickets:cancel',
      'area-tickets:deliver',
      'area-tickets:configure',
      'area-tickets:confirm-external',
    ],
  },
  SHIFTS: {
    label: 'Shifts',
    permissions: ['shifts:read', 'shifts:create', 'shifts:update', 'shifts:delete', 'shifts:close'],
  },
  CASH_DRAWER: {
    label: 'Cash drawer',
    permissions: ['cash-drawer:view-expected'],
  },
  TPV: {
    label: 'TPV Management',
    permissions: [
      'tpv:read',
      'tpv:create',
      'tpv:update',
      'tpv:delete',
      'tpv:command',
      'tpv:command:lock',
      'tpv:command:maintenance',
      'tpv:command:restart',
      'tpv:command:shutdown',
      'tpv:command:config',
      'tpv:command:wipe',
      'tpv:command:bulk',
      'tpv:command:schedule',
      'tpv:command:geofence',
    ],
  },
  INVENTORY: {
    label: 'Inventory',
    permissions: ['inventory:read', 'inventory:create', 'inventory:update', 'inventory:delete', 'inventory:adjust', 'inventory:org-manage'],
  },
  INVENTORY_TRANSFERS: {
    label: 'Inter-venue Transfers',
    permissions: [
      'inventory-transfers:read',
      'inventory-transfers:request',
      'inventory-transfers:approve',
      'inventory-transfers:dispatch',
      'inventory-transfers:receive',
    ],
  },
  PRINTERS: {
    label: 'Impresoras',
    permissions: ['printers:read', 'printers:manage'],
  },
  SCALES: {
    label: 'Básculas',
    permissions: ['scale:use', 'scale:configure'],
  },
  DELIVERY_CHANNELS: {
    label: 'Canales de entrega',
    permissions: ['delivery-channels:read', 'delivery-channels:manage', 'delivery-channels:request', 'delivery-channels:snooze'],
  },
  CATALOG_VENUE: {
    label: 'Catálogo del negocio',
    permissions: ['catalog-venue:read', 'catalog-venue:request-override'],
  },
  SERIALIZED_INVENTORY: {
    label: 'Serialized Inventory',
    permissions: ['serialized-inventory:sell', 'serialized-inventory:create'],
  },
  REVIEWS: {
    label: 'Reviews',
    permissions: ['reviews:read', 'reviews:respond'],
  },
  TABLES: {
    label: 'Table Management',
    permissions: ['tables:read', 'tables:update', 'tables:manage-all', 'tables:pay-any'],
  },
  RESERVATIONS: {
    label: 'Reservations',
    permissions: ['reservations:read', 'reservations:create', 'reservations:update', 'reservations:cancel'],
  },
  CLASS_SESSIONS: {
    label: 'Clases asignadas',
    permissions: ['class-sessions:read-assigned'],
  },
  CALENDAR: {
    label: 'Calendario',
    permissions: ['calendar:manage_venue', 'calendar:connect_self', 'calendar:disconnect_staff', 'calendar:view_status'],
  },
  TEAMS: {
    label: 'Team Management',
    permissions: ['teams:read', 'teams:create', 'teams:update', 'teams:delete', 'teams:invite'],
  },
  ATTENDANCE: {
    label: 'Asistencia',
    permissions: ['attendance:read', 'attendance:manage'],
  },
  STAFF_DOCUMENTS: {
    label: 'Expediente del personal',
    permissions: ['staff-documents:read', 'staff-documents:write'],
  },
  ROLE_CONFIG: {
    label: 'Role Configuration',
    permissions: ['role-config:read', 'role-config:update'],
  },
  COMMISSIONS: {
    label: 'Commission Management',
    permissions: [
      'commissions:read',
      'commissions:create',
      'commissions:update',
      'commissions:delete',
      'commissions:view_own',
      'commissions:approve',
      'commissions:payout',
      'commissions:org-manage',
    ],
  },
  GOALS: {
    label: 'Org-Level Goals',
    permissions: ['goals:org-manage'],
  },
  SETTINGS: {
    label: 'Settings',
    permissions: ['settings:read', 'settings:manage'],
  },
  VENUES: {
    label: 'Venue Settings',
    permissions: ['venues:read', 'venues:update'],
  },
  FEATURES: {
    label: 'Feature Flags',
    permissions: ['features:read', 'features:update'],
  },
  NOTIFICATIONS: {
    label: 'Notifications',
    permissions: ['notifications:send'],
  },
  BILLING: {
    label: 'Billing & Subscriptions',
    permissions: [
      'billing:read',
      'billing:subscriptions:read',
      'billing:subscriptions:manage',
      'billing:history:read',
      'billing:payment-methods:read',
      'billing:payment-methods:manage',
      'billing:tokens:read',
      'billing:tokens:purchase',
    ],
  },
  PLATFORM_BILLING: {
    label: 'Facturación de plataforma',
    permissions: ['platform-billing:view', 'platform-billing:configure', 'platform-billing:issue', 'platform-billing:delete'],
  },
  CFDI: {
    label: 'Facturación CFDI',
    permissions: ['cfdi:configure', 'cfdi:issue', 'cfdi:view'],
  },
  VENUE_FISCAL_PROFILE: {
    label: 'Perfil fiscal',
    permissions: ['venue-fiscal-profile:manage'],
  },
  CUSTOMERS: {
    label: 'Customer Management',
    permissions: [
      'customers:read',
      'customers:create',
      'customers:update',
      'customers:delete',
      'customers:settle-balance',
      'customers:approve',
    ],
  },
  CUSTOMER_GROUPS: {
    label: 'Customer Groups',
    permissions: ['customer-groups:read', 'customer-groups:create', 'customer-groups:update', 'customer-groups:delete'],
  },
  LOYALTY: {
    label: 'Loyalty Program',
    permissions: [
      'loyalty:read',
      'loyalty:create',
      'loyalty:update',
      'loyalty:delete',
      'loyalty:redeem',
      'loyalty:adjust',
      'loyalty:expire',
    ],
  },
  REFERRAL: {
    label: 'Referral Program',
    permissions: [
      'referral:read',
      'referral:configure',
      'referral:override-existing-customer',
      'referral:void-manual',
      'referral:export-csv',
      'referral:fulfill-courtesy',
    ],
  },
  DISCOUNTS: {
    label: 'Discounts',
    permissions: ['discounts:read', 'discounts:create', 'discounts:update', 'discounts:delete', 'discounts:apply'],
  },
  COUPONS: {
    label: 'Coupons',
    permissions: ['coupons:read', 'coupons:create', 'coupons:update', 'coupons:delete', 'coupons:redeem'],
  },
  CREDIT_PACKS: {
    label: 'Paquetes y membresías',
    permissions: [
      'creditPacks:read',
      'creditPacks:create',
      'creditPacks:update',
      'creditPacks:delete',
      'creditPacks:sell',
      'creditPacks:redeem',
    ],
  },
  TPV_TERMINAL: {
    label: 'Terminal Configuration',
    permissions: ['tpv-terminal:settings'],
  },
  TPV_DEVICES: {
    label: 'TPV Devices',
    permissions: ['tpv-devices:manage'],
  },
  TPV_SHIFTS: {
    label: 'TPV Shifts',
    permissions: ['tpv-shifts:create', 'tpv-shifts:close'],
  },
  TPV_KIOSK: {
    label: 'Kiosk Mode',
    permissions: ['tpv-kiosk:enable'],
  },
  TPV_FACTORY_RESET: {
    label: 'Factory Reset (CRITICAL)',
    permissions: ['tpv-factory-reset:execute'],
  },
  TPV_ORDERS: {
    label: 'TPV Orders (Advanced)',
    permissions: ['tpv-orders:comp', 'tpv-orders:void', 'tpv-orders:discount'],
  },
  TPV_PAYMENTS: {
    label: 'TPV Payments (Advanced)',
    permissions: ['tpv-payments:send-receipt', 'tpv-payments:pay-later'],
  },
  TPV_TABLES: {
    label: 'TPV Tables',
    permissions: ['tpv-tables:assign', 'tpv-tables:write', 'tpv-tables:delete'],
  },
  TPV_FLOOR_ELEMENTS: {
    label: 'Floor Elements',
    permissions: ['tpv-floor-elements:read', 'tpv-floor-elements:write', 'tpv-floor-elements:delete'],
  },
  TPV_CUSTOMERS: {
    label: 'TPV Customers',
    permissions: ['tpv-customers:read', 'tpv-customers:create'],
  },
  TPV_PRODUCTS: {
    label: 'TPV Products (Scan & Go)',
    permissions: ['tpv-products:read', 'tpv-products:write'],
  },
  TPV_TIME_ENTRIES: {
    label: 'Time Clock',
    permissions: ['tpv-time-entries:read', 'tpv-time-entries:write'],
  },
  TPV_REPORTS: {
    label: 'TPV Reports',
    permissions: ['tpv-reports:read', 'tpv-reports:export', 'tpv-reports:pay-later-aging'],
  },
  TPV_MESSAGES: {
    label: 'TPV Messages',
    permissions: ['tpv-messages:read', 'tpv-messages:send'],
  },
  TPV_SETTINGS: {
    label: 'TPV Settings',
    permissions: ['tpv-settings:read', 'tpv-settings:update'],
  },
  VENUE_CRYPTO: {
    label: 'Venue Crypto Config',
    permissions: ['venue-crypto:manage'],
  },
} as const satisfies Record<string, { label: string; permissions: readonly string[] }>

export type PermissionCategoryKey = keyof typeof PERMISSION_CATEGORIES

/**
 * Qué categorías pinta cada super-categoría, en orden.
 *
 * 🔴 ESTO ES LO QUE HACE IMPOSIBLE UNA CATEGORÍA HUÉRFANA. Antes, las
 * super-categorías de `permissionGroups.ts` traían la lista de claves escrita a
 * mano, y una categoría que nadie mencionaba existía en el dato pero no se pintaba
 * en ninguna pantalla: 7 estaban así (AREA_TICKETS, SCALES, INVENTORY_TRANSFERS,
 * COMMISSIONS, GOALS, INVENTORY_ORG, ACTIVITY). Al salir las dos mitades de la
 * misma `CURACION`, una categoría sin super-categoría ya no se puede construir.
 */
export const SUPER_CATEGORY_KEYS = {
  'core-operations': ['HOME', 'ANALYTICS', 'REPORTS', 'SETTLEMENTS', 'ACCOUNTING', 'CASH_OUT', 'ACTIVITY'],
  'sales-orders': [
    'MENU',
    'PRODUCTS',
    'ORDERS',
    'ESTIMATES',
    'MANUAL_SALES',
    'PAYMENTS',
    'PAYMENT_LINK',
    'TENDER_TYPES',
    'SALE_VERIFICATIONS',
    'UPSELLS',
    'AREA_TICKETS',
  ],
  'operations': [
    'SHIFTS',
    'CASH_DRAWER',
    'TPV',
    'INVENTORY',
    'INVENTORY_TRANSFERS',
    'PRINTERS',
    'SCALES',
    'DELIVERY_CHANNELS',
    'CATALOG_VENUE',
    'SERIALIZED_INVENTORY',
  ],
  'customer-experience': ['REVIEWS', 'TABLES', 'RESERVATIONS', 'CLASS_SESSIONS', 'CALENDAR'],
  'team-settings': [
    'TEAMS',
    'ATTENDANCE',
    'STAFF_DOCUMENTS',
    'ROLE_CONFIG',
    'COMMISSIONS',
    'GOALS',
    'SETTINGS',
    'VENUES',
    'FEATURES',
    'NOTIFICATIONS',
    'BILLING',
    'PLATFORM_BILLING',
    'CFDI',
    'VENUE_FISCAL_PROFILE',
  ],
  'marketing-loyalty': ['CUSTOMERS', 'CUSTOMER_GROUPS', 'LOYALTY', 'REFERRAL', 'DISCOUNTS', 'COUPONS', 'CREDIT_PACKS'],
  'terminal-operations': ['TPV_TERMINAL', 'TPV_DEVICES', 'TPV_SHIFTS', 'TPV_KIOSK', 'TPV_FACTORY_RESET'],
  'tpv-orders-payments': ['TPV_ORDERS', 'TPV_PAYMENTS'],
  'floor-management': ['TPV_TABLES', 'TPV_FLOOR_ELEMENTS'],
  'staff-customers': ['TPV_CUSTOMERS', 'TPV_PRODUCTS', 'TPV_TIME_ENTRIES', 'TPV_REPORTS', 'TPV_MESSAGES', 'TPV_SETTINGS', 'VENUE_CRYPTO'],
} as const satisfies Record<string, readonly PermissionCategoryKey[]>

/** Huella del catálogo del servidor del que salió este archivo. */
export const CATALOG_DIGEST = 'ddc32d6dbb2433bc'
