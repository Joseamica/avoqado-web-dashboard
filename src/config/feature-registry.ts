/**
 * Feature Registry - Central catalog of all available features
 *
 * This registry defines all features that can be enabled in white-label dashboards.
 * Features are categorized by source:
 * - avoqado_core: Reusable Avoqado features (Commissions, Tips, etc.)
 * - module_specific: Features specific to certain modules (PlayTelecom, Jewelry, etc.)
 *
 * Each feature includes:
 * - Component paths for lazy loading
 * - Route definitions
 * - Configuration schema for dynamic form generation
 * - Default navigation item
 */

import type { FeatureDefinition, FeatureCategory } from '@/types/white-label'
import { StaffRole } from '@/types'

// ============================================
// Feature Registry
// ============================================

export const FEATURE_REGISTRY: Record<string, FeatureDefinition> = {
  // ============================================
  // AVOQADO CORE FEATURES
  // Reusable across all white-label dashboards
  // ============================================

  AVOQADO_DASHBOARD: {
    code: 'AVOQADO_DASHBOARD',
    name: 'Dashboard',
    description: 'Panel principal con métricas de ventas, órdenes y rendimiento del día',
    category: 'analytics',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Home',
    },

    routes: [{ path: '', element: 'Home', index: true }],

    configSchema: {
      type: 'object',
      properties: {
        showQuickActions: {
          type: 'boolean',
          default: true,
          title: 'Acciones rápidas',
          description: 'Mostrar botones de acciones rápidas',
        },
        showRecentOrders: {
          type: 'boolean',
          default: true,
          title: 'Órdenes recientes',
          description: 'Mostrar lista de órdenes recientes',
        },
      },
    },

    defaultNavItem: {
      label: 'Dashboard',
      icon: 'LayoutDashboard',
    },
  },

  AVOQADO_ORDERS: {
    code: 'AVOQADO_ORDERS',
    name: 'Órdenes',
    description: 'Gestión de órdenes, historial y detalles de transacciones',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Order/Orders',
    },

    routes: [
      { path: 'orders', element: 'Orders' },
      { path: 'orders/:orderId', element: 'OrderId' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showCancelled: {
          type: 'boolean',
          default: true,
          title: 'Mostrar canceladas',
          description: 'Incluir órdenes canceladas en la lista',
        },
        defaultDateRange: {
          type: 'string',
          enum: ['today', 'week', 'month'],
          default: 'today',
          title: 'Rango por defecto',
        },
      },
    },

    defaultNavItem: {
      label: 'Órdenes',
      icon: 'ClipboardList',
    },
  },

  AVOQADO_PAYMENTS: {
    code: 'AVOQADO_PAYMENTS',
    name: 'Pagos',
    description: 'Historial de pagos, métodos de pago y detalles de transacciones',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Payment/Payments',
    },

    routes: [
      { path: 'payments', element: 'Payments' },
      { path: 'payments/:paymentId', element: 'PaymentId' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showRefunds: {
          type: 'boolean',
          default: true,
          title: 'Mostrar reembolsos',
        },
        groupByMethod: {
          type: 'boolean',
          default: false,
          title: 'Agrupar por método',
        },
      },
    },

    defaultNavItem: {
      label: 'Pagos',
      icon: 'CreditCard',
    },
  },

  AVOQADO_MENU: {
    code: 'AVOQADO_MENU',
    name: 'Menú',
    description: 'Gestión de productos, categorías, modificadores y precios',
    category: 'inventory',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Menu/Menu',
    },

    routes: [
      { path: 'menu', element: 'Menu' },
      { path: 'menu/products', element: 'Products' },
      { path: 'menu/categories', element: 'Categories' },
      { path: 'menu/modifiers', element: 'Modifiers' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showPrices: {
          type: 'boolean',
          default: true,
          title: 'Mostrar precios',
        },
        allowModifiers: {
          type: 'boolean',
          default: true,
          title: 'Permitir modificadores',
        },
      },
    },

    defaultNavItem: {
      label: 'Menú',
      icon: 'UtensilsCrossed',
    },
  },

  AVOQADO_INVENTORY: {
    code: 'AVOQADO_INVENTORY',
    name: 'Inventario',
    description: 'Control de stock, ingredientes, recetas y alertas de inventario',
    category: 'inventory',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Inventory/Inventory',
    },

    routes: [
      { path: 'inventory', element: 'Inventory' },
      { path: 'inventory/ingredients', element: 'Ingredients' },
      { path: 'inventory/recipes', element: 'Recipes' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        lowStockAlerts: {
          type: 'boolean',
          default: true,
          title: 'Alertas de stock bajo',
        },
        trackWaste: {
          type: 'boolean',
          default: false,
          title: 'Rastrear merma',
        },
      },
    },

    defaultNavItem: {
      label: 'Inventario',
      icon: 'Warehouse',
    },
  },

  AVOQADO_TEAM: {
    code: 'AVOQADO_TEAM',
    name: 'Equipo',
    description: 'Gestión del personal, roles, permisos y horarios',
    category: 'team',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Team/Teams',
    },

    routes: [
      { path: 'team', element: 'Teams' },
      { path: 'team/:memberId', element: 'TeamId' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showSchedules: {
          type: 'boolean',
          default: true,
          title: 'Mostrar horarios',
        },
        allowRoleEdit: {
          type: 'boolean',
          default: false,
          title: 'Permitir editar roles',
          description: 'Solo administradores pueden editar roles',
        },
      },
    },

    defaultNavItem: {
      label: 'Equipo',
      icon: 'Users',
    },
  },

  AVOQADO_CUSTOMERS: {
    code: 'AVOQADO_CUSTOMERS',
    name: 'Clientes',
    description: 'Base de datos de clientes, historial de compras y contacto',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Customers/Customers',
    },

    routes: [
      { path: 'customers', element: 'Customers' },
      { path: 'customers/:customerId', element: 'CustomerDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showPurchaseHistory: {
          type: 'boolean',
          default: true,
          title: 'Historial de compras',
        },
        enableLoyalty: {
          type: 'boolean',
          default: false,
          title: 'Programa de lealtad',
        },
      },
    },

    defaultNavItem: {
      label: 'Clientes',
      icon: 'UserCircle',
    },
  },

  AVOQADO_TPVS: {
    code: 'AVOQADO_TPVS',
    name: 'Terminales',
    description: 'Gestión de terminales de punto de venta y dispositivos',
    category: 'analytics',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Tpv/Tpvs',
    },

    routes: [
      { path: 'tpvs', element: 'Tpvs' },
      { path: 'tpvs/:tpvId', element: 'TpvDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showStatus: {
          type: 'boolean',
          default: true,
          title: 'Mostrar estado',
        },
        allowRemoteCommands: {
          type: 'boolean',
          default: true,
          title: 'Comandos remotos',
        },
      },
    },

    defaultNavItem: {
      label: 'Terminales',
      icon: 'Smartphone',
    },
  },

  AVOQADO_BALANCE: {
    code: 'AVOQADO_BALANCE',
    name: 'Balance',
    description: 'Balance disponible, historial de depósitos y retiros',
    category: 'analytics',
    source: 'avoqado_core',

    component: {
      path: '@/pages/AvailableBalance/AvailableBalance',
    },

    routes: [{ path: 'balance', element: 'AvailableBalance' }],

    configSchema: {
      type: 'object',
      properties: {
        showPendingPayouts: {
          type: 'boolean',
          default: true,
          title: 'Pagos pendientes',
        },
        showTransactionHistory: {
          type: 'boolean',
          default: true,
          title: 'Historial de transacciones',
        },
      },
    },

    defaultNavItem: {
      label: 'Balance',
      icon: 'Wallet',
    },
  },

  AVOQADO_PROMOTIONS: {
    code: 'AVOQADO_PROMOTIONS',
    name: 'Promociones',
    description: 'Descuentos, cupones, promociones especiales y ofertas',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Promotions/Promotions',
    },

    routes: [
      { path: 'promotions', element: 'Promotions' },
      { path: 'promotions/discounts', element: 'Discounts' },
      { path: 'promotions/coupons', element: 'Coupons' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        enableCoupons: {
          type: 'boolean',
          default: true,
          title: 'Habilitar cupones',
        },
        enableAutoPromos: {
          type: 'boolean',
          default: false,
          title: 'Promociones automáticas',
        },
      },
    },

    defaultNavItem: {
      label: 'Promociones',
      icon: 'Tag',
    },
  },

  AVOQADO_ANALYTICS: {
    code: 'AVOQADO_ANALYTICS',
    name: 'Analítica',
    description: 'Análisis avanzado de ventas, tendencias y métricas del negocio',
    category: 'analytics',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Analytics/Analytics',
    },

    routes: [{ path: 'analytics', element: 'Analytics' }],

    configSchema: {
      type: 'object',
      properties: {
        showTrends: {
          type: 'boolean',
          default: true,
          title: 'Mostrar tendencias',
        },
        enableExport: {
          type: 'boolean',
          default: true,
          title: 'Permitir exportar',
        },
      },
    },

    defaultNavItem: {
      label: 'Analítica',
      icon: 'TrendingUp',
    },
  },

  AVOQADO_SHIFTS: {
    code: 'AVOQADO_SHIFTS',
    name: 'Turnos',
    description: 'Control de turnos, apertura y cierre de caja',
    category: 'team',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Shift/Shifts',
    },

    routes: [
      { path: 'shifts', element: 'Shifts' },
      { path: 'shifts/:shiftId', element: 'ShiftDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        requireCashCount: {
          type: 'boolean',
          default: true,
          title: 'Conteo de efectivo',
        },
        autoCloseShifts: {
          type: 'boolean',
          default: false,
          title: 'Cierre automático',
        },
      },
    },

    defaultNavItem: {
      label: 'Turnos',
      icon: 'Clock',
    },
  },

  AVOQADO_COMMISSIONS: {
    code: 'AVOQADO_COMMISSIONS',
    name: 'Comisiones',
    description: 'Sistema de comisiones para staff con configuración, aprobaciones y pagos',
    category: 'team',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Commissions/CommissionsPage',
    },

    routes: [
      { path: 'commissions', element: 'CommissionsPage' },
      { path: 'commissions/config/:configId', element: 'CommissionConfigDetailPage' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        payoutFrequency: {
          type: 'string',
          enum: ['weekly', 'biweekly', 'monthly'],
          default: 'weekly',
          title: 'Frecuencia de pago',
          description: 'Con qué frecuencia se procesan los pagos de comisiones',
        },
        requireApproval: {
          type: 'boolean',
          default: true,
          title: 'Requiere aprobación',
          description: 'Las comisiones requieren aprobación antes del pago',
        },
        autoCalculate: {
          type: 'boolean',
          default: true,
          title: 'Cálculo automático',
          description: 'Calcular comisiones automáticamente al cerrar periodos',
        },
      },
    },

    defaultNavItem: {
      label: 'Comisiones',
      icon: 'DollarSign',
    },
  },

  // NOTE: AVOQADO_TIPS is commented out because the page doesn't exist yet
  // TODO: Create @/pages/Tips/TipsPage and uncomment this feature
  // AVOQADO_TIPS: {
  //   code: 'AVOQADO_TIPS',
  //   name: 'Propinas',
  //   description: 'Gestión de propinas del equipo con distribución configurable',
  //   category: 'team',
  //   source: 'avoqado_core',
  //   component: { path: '@/pages/Tips/TipsPage' },
  //   routes: [{ path: 'tips', element: 'TipsPage' }],
  //   configSchema: {
  //     type: 'object',
  //     properties: {
  //       distributionMethod: { type: 'string', enum: ['equal', 'hours_worked', 'role_based', 'custom'], default: 'equal' },
  //       includeKitchen: { type: 'boolean', default: false },
  //     },
  //   },
  //   defaultNavItem: { label: 'Propinas', icon: 'HandCoins' },
  // },

  AVOQADO_LOYALTY: {
    code: 'AVOQADO_LOYALTY',
    name: 'Programa de Lealtad',
    description: 'Sistema de puntos y recompensas para clientes frecuentes',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Loyalty/LoyaltySettings',
    },

    routes: [{ path: 'loyalty', element: 'LoyaltySettings' }],

    configSchema: {
      type: 'object',
      properties: {
        pointsPerDollar: {
          type: 'number',
          default: 1,
          minimum: 0,
          title: 'Puntos por peso',
          description: 'Cuántos puntos gana el cliente por cada peso gastado',
        },
        redemptionRate: {
          type: 'number',
          default: 100,
          minimum: 1,
          title: 'Tasa de canje',
          description: 'Cuántos puntos equivalen a $1 de descuento',
        },
        enableExpiration: {
          type: 'boolean',
          default: false,
          title: 'Expiración de puntos',
          description: 'Los puntos expiran después de cierto tiempo',
        },
      },
    },

    defaultNavItem: {
      label: 'Lealtad',
      icon: 'Award',
    },
  },

  AVOQADO_REVIEWS: {
    code: 'AVOQADO_REVIEWS',
    name: 'Reseñas',
    description: 'Gestión de reseñas de clientes y Google Reviews',
    category: 'sales',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Review/Reviews',
    },

    routes: [{ path: 'reviews', element: 'Reviews' }],

    configSchema: {
      type: 'object',
      properties: {
        autoRespond: {
          type: 'boolean',
          default: false,
          title: 'Respuesta automática',
          description: 'Responder automáticamente a reseñas positivas',
        },
        notifyBadReviews: {
          type: 'boolean',
          default: true,
          title: 'Notificar reseñas negativas',
          description: 'Enviar alerta cuando llegue una reseña de 3 estrellas o menos',
        },
        minimumRatingAlert: {
          type: 'number',
          default: 3,
          minimum: 1,
          maximum: 5,
          title: 'Rating mínimo para alerta',
        },
      },
    },

    defaultNavItem: {
      label: 'Reseñas',
      icon: 'Star',
    },
  },

  AVOQADO_REPORTS: {
    code: 'AVOQADO_REPORTS',
    name: 'Reportes',
    description: 'Reportes de ventas, ingresos y análisis del negocio',
    category: 'analytics',
    source: 'avoqado_core',

    component: {
      path: '@/pages/Reports/SalesSummary',
    },

    routes: [
      { path: 'reports', element: 'SalesSummary' },
      { path: 'reports/payments', element: 'PaymentReports' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        defaultDateRange: {
          type: 'string',
          enum: ['today', 'week', 'month', 'quarter'],
          default: 'week',
          title: 'Rango de fecha por defecto',
        },
        showComparisons: {
          type: 'boolean',
          default: true,
          title: 'Mostrar comparaciones',
          description: 'Mostrar comparaciones con periodos anteriores',
        },
      },
    },

    defaultNavItem: {
      label: 'Reportes',
      icon: 'BarChart3',
    },
  },

  // ============================================
  // MODULE SPECIFIC: PLAYTELECOM
  // Features specific to telecom/retail businesses
  // ============================================

  COMMAND_CENTER: {
    code: 'COMMAND_CENTER',
    name: 'Centro de Comando',
    description: 'Dashboard principal con métricas en tiempo real para operaciones telecom',
    category: 'analytics',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/CommandCenter/CommandCenter',
    },

    routes: [{ path: '', element: 'CommandCenter', index: true }],

    configSchema: {
      type: 'object',
      properties: {
        refreshInterval: {
          type: 'number',
          default: 30,
          minimum: 10,
          maximum: 300,
          title: 'Intervalo de actualización (segundos)',
          description: 'Cada cuántos segundos se actualizan las métricas',
        },
        showRealtimeMetrics: {
          type: 'boolean',
          default: true,
          title: 'Métricas en tiempo real',
          description: 'Mostrar indicadores de actividad en tiempo real',
        },
        showMap: {
          type: 'boolean',
          default: true,
          title: 'Mostrar mapa',
          description: 'Mostrar mapa de ubicaciones de tiendas',
        },
      },
    },

    defaultNavItem: {
      label: 'Centro de Comando',
      icon: 'LayoutDashboard',
    },
  },

  SERIALIZED_STOCK: {
    code: 'SERIALIZED_STOCK',
    name: 'Inventario Serializado',
    description: 'Control de inventario con números de serie (IMEI, SKU único)',
    category: 'inventory',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/Stock/StockControl',
    },

    routes: [
      { path: 'stock', element: 'StockControl' },
      { path: 'stock/transfers', element: 'StockTransfers' },
      { path: 'stock/adjustments', element: 'StockAdjustments' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showIMEI: {
          type: 'boolean',
          default: true,
          title: 'Mostrar IMEI',
          description: 'Mostrar columna de IMEI en listas de inventario',
        },
        lowStockThreshold: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 100,
          title: 'Umbral de stock bajo',
          description: 'Alertar cuando el stock baje de esta cantidad',
        },
        requireSerialOnSale: {
          type: 'boolean',
          default: true,
          title: 'Requerir serial en venta',
          description: 'Obligar a seleccionar número de serie al vender',
        },
        trackWarranty: {
          type: 'boolean',
          default: true,
          title: 'Rastrear garantía',
          description: 'Registrar fecha de garantía por producto',
        },
      },
    },

    defaultNavItem: {
      label: 'Inventario',
      icon: 'Package',
    },
  },

  PROMOTERS_AUDIT: {
    code: 'PROMOTERS_AUDIT',
    name: 'Auditoría de Promotores',
    description: 'Seguimiento y auditoría de promotores de campo',
    category: 'team',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/Promoters/PromotersAudit',
    },

    routes: [
      { path: 'promoters', element: 'PromotersAudit', roles: [StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER] },
      { path: 'promoters/:promoterId', element: 'PromoterDetail', roles: [StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER] },
    ],

    configSchema: {
      type: 'object',
      properties: {
        trackLocation: {
          type: 'boolean',
          default: true,
          title: 'Rastrear ubicación',
          description: 'Registrar ubicación GPS de check-ins',
        },
        requireDailyCheckIn: {
          type: 'boolean',
          default: false,
          title: 'Check-in diario obligatorio',
          description: 'Promotores deben hacer check-in cada día',
        },
        photoRequired: {
          type: 'boolean',
          default: true,
          title: 'Foto requerida',
          description: 'Requerir foto en cada visita',
        },
        maxVisitsPerDay: {
          type: 'number',
          default: 10,
          minimum: 1,
          maximum: 50,
          title: 'Máximo de visitas por día',
        },
      },
    },

    defaultNavItem: {
      label: 'Promotores',
      icon: 'Users',
    },
  },

  STORES_ANALYSIS: {
    code: 'STORES_ANALYSIS',
    name: 'Análisis de Tiendas',
    description: 'Comparativas y métricas de rendimiento por tienda',
    category: 'analytics',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/Stores/StoresAnalysis',
    },

    routes: [
      { path: 'stores', element: 'StoresAnalysis', roles: [StaffRole.MANAGER, StaffRole.ADMIN, StaffRole.OWNER] },
      { path: 'stores/:storeId', element: 'StoreDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        showRanking: {
          type: 'boolean',
          default: true,
          title: 'Mostrar ranking',
          description: 'Mostrar ranking de tiendas por ventas',
        },
        compareMetrics: {
          type: 'array',
          default: ['revenue', 'units', 'tickets'],
          title: 'Métricas a comparar',
        },
        enableGoals: {
          type: 'boolean',
          default: true,
          title: 'Habilitar metas',
          description: 'Permitir establecer metas por tienda',
        },
      },
    },

    defaultNavItem: {
      label: 'Tiendas',
      icon: 'Store',
    },
  },

  MANAGERS_DASHBOARD: {
    code: 'MANAGERS_DASHBOARD',
    name: 'Gerentes',
    description: 'Dashboard de gerentes con métricas de desempeño, metas y equipos supervisados',
    category: 'team',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/Managers/ManagersDashboard',
    },

    routes: [{ path: 'managers', element: 'ManagersDashboard', roles: [StaffRole.ADMIN, StaffRole.OWNER] }],

    configSchema: {
      type: 'object',
      properties: {
        showGoalProgress: {
          type: 'boolean',
          default: true,
          title: 'Mostrar progreso de metas',
          description: 'Mostrar barras de progreso hacia metas mensuales',
        },
        showTeamHealth: {
          type: 'boolean',
          default: true,
          title: 'Mostrar salud del equipo',
          description: 'Mostrar métricas de productividad del equipo',
        },
        enableGoalSetting: {
          type: 'boolean',
          default: true,
          title: 'Permitir establecer metas',
          description: 'Permitir a administradores establecer metas para gerentes',
        },
      },
    },

    defaultNavItem: {
      label: 'Gerentes',
      icon: 'UserCog',
    },
  },

  SALES_REPORT: {
    code: 'SALES_REPORT',
    name: 'Reporte de Ventas',
    description: 'Reporte de ventas con evidencias de registro (proof of sale) y validación de transacciones',
    category: 'analytics',
    source: 'module_specific',

    component: {
      path: '@/pages/playtelecom/Sales/SalesReport',
    },

    routes: [{ path: 'sales', element: 'SalesReport' }],

    configSchema: {
      type: 'object',
      properties: {
        requireProofOfSale: {
          type: 'boolean',
          default: true,
          title: 'Requerir evidencia de venta',
          description: 'Obligar a adjuntar foto de evidencia en cada venta',
        },
        autoReconcile: {
          type: 'boolean',
          default: false,
          title: 'Conciliación automática',
          description: 'Marcar ventas como conciliadas automáticamente al validar ICCID',
        },
        showRevenueCharts: {
          type: 'boolean',
          default: true,
          title: 'Mostrar gráficas de ingresos',
          description: 'Mostrar tendencias de ingresos y volumen',
        },
        exportFormats: {
          type: 'array',
          default: ['csv', 'xlsx'],
          title: 'Formatos de exportación',
          description: 'Formatos disponibles para exportar reportes',
        },
      },
    },

    defaultNavItem: {
      label: 'Reporte de Ventas',
      icon: 'Receipt',
    },
  },

  // ============================================
  // MODULE SPECIFIC: JEWELRY
  // Features for jewelry businesses
  // ============================================

  APPRAISALS: {
    code: 'APPRAISALS',
    name: 'Avalúos',
    description: 'Sistema de avalúos y valuación de joyería',
    category: 'sales',
    source: 'module_specific',

    component: {
      path: '@/pages/jewelry/Appraisals/AppraisalsPage',
    },

    routes: [
      { path: 'appraisals', element: 'AppraisalsPage' },
      { path: 'appraisals/new', element: 'NewAppraisal' },
      { path: 'appraisals/:appraisalId', element: 'AppraisalDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        requireCertificate: {
          type: 'boolean',
          default: true,
          title: 'Requerir certificado',
          description: 'Requerir certificado de autenticidad',
        },
        defaultCurrency: {
          type: 'string',
          enum: ['MXN', 'USD'],
          default: 'MXN',
          title: 'Moneda por defecto',
        },
        trackGoldPrice: {
          type: 'boolean',
          default: true,
          title: 'Rastrear precio del oro',
          description: 'Actualizar automáticamente precios de referencia',
        },
      },
    },

    defaultNavItem: {
      label: 'Avalúos',
      icon: 'Gem',
    },
  },

  CONSIGNMENT: {
    code: 'CONSIGNMENT',
    name: 'Consignación',
    description: 'Gestión de productos en consignación',
    category: 'inventory',
    source: 'module_specific',

    component: {
      path: '@/pages/jewelry/Consignment/ConsignmentPage',
    },

    routes: [
      { path: 'consignment', element: 'ConsignmentPage' },
      { path: 'consignment/:itemId', element: 'ConsignmentDetail' },
    ],

    configSchema: {
      type: 'object',
      properties: {
        defaultCommissionRate: {
          type: 'number',
          default: 20,
          minimum: 0,
          maximum: 100,
          title: 'Comisión por defecto (%)',
        },
        autoRenewDays: {
          type: 'number',
          default: 90,
          title: 'Días para renovación',
          description: 'Días antes de que expire el contrato de consignación',
        },
      },
    },

    defaultNavItem: {
      label: 'Consignación',
      icon: 'Handshake',
    },
  },
}

// ============================================
// Helper Functions
// ============================================

/**
 * Get all features by category
 */
export function getFeaturesByCategory(category: FeatureCategory): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.category === category)
}

/**
 * Get all features by source
 */
export function getFeaturesBySource(source: 'avoqado_core' | 'module_specific'): FeatureDefinition[] {
  return Object.values(FEATURE_REGISTRY).filter(f => f.source === source)
}

/**
 * Get feature by code
 */
export function getFeatureByCode(code: string): FeatureDefinition | undefined {
  return FEATURE_REGISTRY[code]
}

/**
 * Get all avoqado core features
 */
export function getAvoqadoCoreFeatures(): FeatureDefinition[] {
  return getFeaturesBySource('avoqado_core')
}

/**
 * Get all module-specific features
 */
export function getModuleSpecificFeatures(): FeatureDefinition[] {
  return getFeaturesBySource('module_specific')
}

/**
 * Get feature categories with counts
 */
export function getFeatureCategoryCounts(): Record<FeatureCategory, number> {
  const counts: Record<FeatureCategory, number> = {
    analytics: 0,
    sales: 0,
    inventory: 0,
    team: 0,
    custom: 0,
  }

  Object.values(FEATURE_REGISTRY).forEach(feature => {
    counts[feature.category]++
  })

  return counts
}

/**
 * Validate that all dependencies exist
 */
export function validateFeatureDependencies(featureCodes: string[]): { valid: boolean; missing: string[] } {
  const missing: string[] = []

  featureCodes.forEach(code => {
    const feature = FEATURE_REGISTRY[code]
    if (feature?.dependencies) {
      feature.dependencies.forEach(dep => {
        if (!featureCodes.includes(dep) && !missing.includes(dep)) {
          missing.push(dep)
        }
      })
    }
  })

  return {
    valid: missing.length === 0,
    missing,
  }
}

// ============================================
// Category Metadata
// ============================================

export const FEATURE_CATEGORIES: Record<FeatureCategory, { label: string; icon: string; description: string }> = {
  analytics: {
    label: 'Analítica',
    icon: 'BarChart3',
    description: 'Reportes, dashboards y métricas',
  },
  sales: {
    label: 'Ventas',
    icon: 'ShoppingCart',
    description: 'Gestión de ventas y transacciones',
  },
  inventory: {
    label: 'Inventario',
    icon: 'Package',
    description: 'Control de stock y productos',
  },
  team: {
    label: 'Equipo',
    icon: 'Users',
    description: 'Gestión de personal y comisiones',
  },
  custom: {
    label: 'Personalizado',
    icon: 'Puzzle',
    description: 'Features personalizados',
  },
}
