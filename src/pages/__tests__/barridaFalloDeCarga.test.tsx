/**
 * D4, última barrida: con la consulta caída o en pausa una pantalla pintaba $0 o «Sin…» como si fuera dato. La pantalla y TanStack son
 * de verdad: sólo se finge la red (`@/api`) y quién mira. Lista completa: docs/audit/2026-11-03-d4-numeros-y-tablas/.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Ruta = [RegExp, unknown]

const red = vi.hoisted(() => {
  const venue = {
    id: 'v1',
    name: 'Mi negocio',
    slug: 'mi-negocio',
    organizationId: 'o1',
    role: 'OWNER',
    timezone: 'America/Mexico_City',
    currency: 'MXN',
    modules: [],
    features: [],
  }
  return {
    rutas: [] as Array<[RegExp, unknown]>,
    caida: null as RegExp | null,
    estatus: 500,
    params: {} as Record<string, string>,
    venue,
    toast: (_: { title?: string; description?: string; variant?: string }) => undefined as unknown,
    t: (k: string) => k,
    cuerpoVacio: { success: true, data: [], items: [], rows: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string, config?: { params?: Record<string, unknown> }) => {
    const clave = config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>)}` : url
    if (red.caida?.test(clave)) throw Object.assign(new Error('Request failed with status code 500'), { response: { status: red.estatus, data: {} } })
    const ruta = red.rutas.find(([patron]) => patron.test(clave))
    return { data: ruta ? ruta[1] : red.cuerpoVacio }
  }
  const cliente = { get: responder, post: responder, put: responder, patch: responder, delete: responder, interceptors: { request: { use() {} }, response: { use() {} } } }
  return { default: cliente, publicApi: cliente, getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }), subscribeToConnection: () => () => {} }
})
vi.mock('@/context/AuthContext', () => ({
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  useAuth: () => ({
    user: { id: 'u1', role: 'SUPERADMIN', venues: [red.venue] },
    staffInfo: { id: 'u1', role: 'OWNER' },
    isAuthenticated: true,
    isLoading: false,
    activeVenue: red.venue,
    allVenues: [red.venue],
    checkFeatureAccess: () => true,
    checkModuleAccess: () => true,
    getVenueBySlug: () => red.venue,
  }),
}))
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }) }))
vi.mock('@/hooks/use-current-venue', async original => ({
  ...(await original<typeof import('@/hooks/use-current-venue')>()),
  useCurrentVenue: () => ({ venueId: 'v1', venueSlug: 'mi-negocio', venue: red.venue, fullBasePath: '/venues/mi-negocio', basePath: '/venues/mi-negocio', isLoading: false }),
}))
vi.mock('@/hooks/use-access', async original => ({
  ...(await original<typeof import('@/hooks/use-access')>()),
  useAccess: () => ({ role: 'OWNER', can: () => true, canAny: () => true, canAll: () => true, getDataScope: () => 'venue', isLoading: false }),
}))
vi.mock('@/hooks/use-tier-feature-access', async original => ({
  ...(await original<typeof import('@/hooks/use-tier-feature-access')>()),
  useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false, isResolved: true, requiredTier: null }),
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false, isResolved: true }),
}))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: (o: { title?: string }) => red.toast(o) }), toast: () => undefined }))
vi.mock('@/context/BreadcrumbContext', async original => ({
  ...(await original<typeof import('@/context/BreadcrumbContext')>()),
  useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }),
}))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('react-router-dom', async original => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => red.params,
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))
// Lee su propia consulta y tiene su prueba; aquí sólo estorba al saldo.
vi.mock('@/components/settlement/SettlementWeekStrip', () => ({ SettlementWeekStrip: () => null }))
vi.mock('recharts', async original => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="grafica">{children}</div>,
}))

import { IncidentsQueue } from '@/pages/AreaTickets/components/IncidentsQueue'
import { SettlementsQueue } from '@/pages/AreaTickets/components/SettlementsQueue'
import AvailableBalance from '@/pages/AvailableBalance/AvailableBalance'
import { PayrollReport } from '@/pages/Attendance/PayrollReport'
import { PunctualityReport } from '@/pages/Attendance/PunctualityReport'
import { ShiftPlanner } from '@/pages/Attendance/ShiftPlanner'
import { CustomersAwaitingApproval } from '@/pages/Customers/components/CustomersAwaitingApproval'
import Ecommerce from '@/pages/Ecommerce/Ecommerce'
import { GiftCardReports } from '@/pages/GiftCards/components/GiftCardReports'
import { InventoryMovementsDialog } from '@/pages/Inventory/components/InventoryMovementsDialog'
import { RawMaterialDetailDialog } from '@/pages/Inventory/components/RawMaterialDetailDialog'
import { RecipeUsageDialog } from '@/pages/Inventory/components/RecipeUsageDialog'
import { StockMovementsDialog } from '@/pages/Inventory/components/StockMovementsDialog'
import { InvoiceSection } from '@/pages/Inventory/PurchaseOrders/components/InvoiceSection'
import StockCountDetailPage from '@/pages/Inventory/StockCounts/StockCountDetailPage'
import TransferDetailPage from '@/pages/Inventory/Transfers/TransferDetailPage'
import MerchantRoutingRules from '@/pages/Payment/MerchantRoutingRules'
import Upsell from '@/pages/Promotions/Upsell'
import SalesSummary from '@/pages/Reports/SalesSummary'
import ReservationCalendar from '@/pages/Reservations/ReservationCalendar'
import SerializedSalesDemo from '@/pages/SerializedSalesDemo/SerializedSalesDemo'
import { RoutingTab } from '@/pages/Settings/components/printStations/RoutingTab'
import { DesglosePersona } from '@/pages/StaffPay/components/DesglosePersona'
import { ExcepcionesSheet, HuerfanasSheet } from '@/pages/StaffPay/components/ListasDelPeriodo'
import RevenueShareReportSection from '@/pages/Superadmin/components/RevenueShareReportSection'
import VenueRosterPanel from '@/pages/Superadmin/components/merchant-accounts/VenueRosterPanel'
import SettlementCard from '@/pages/Superadmin/components/merchant-accounts/merchant-setup-panel/cards/SettlementCard'
import CampaignDetail from '@/pages/Superadmin/Marketing/CampaignDetail'
import MarketingPage from '@/pages/Superadmin/Marketing/MarketingPage'
import PartnerKeys from '@/pages/Superadmin/PartnerKeys'
import PaymentAnalytics from '@/pages/Superadmin/PaymentAnalytics'
import PaymentProviders from '@/pages/Superadmin/PaymentProviders'
import RevenueDashboard from '@/pages/Superadmin/RevenueDashboard'
import VenueManagement from '@/pages/Superadmin/VenueManagement'
import { StaffDocuments } from '@/pages/Team/components/StaffDocuments'
import { CommandHistoryTable } from '@/pages/Tpv/components/CommandHistoryTable'
import DeviceMenusTab from '@/pages/Tpv/components/DeviceMenusTab'
import { TpvMessagesList } from '@/pages/Tpv/components/TpvMessagesList'
import Integrations from '@/pages/Venue/Edit/Integrations'
import EcommerceMerchants from '@/pages/Venue/EcommerceMerchants'
import VenueMerchantAccounts from '@/pages/Venue/VenueMerchantAccounts'
import LiveLocation from '@/pages/organizations/LiveLocation/LiveLocation'
import TiendasList from '@/pages/organizations/TiendasList/TiendasList'
import VisionGlobal from '@/pages/organizations/VisionGlobal/VisionGlobal'
import PromotersAudit from '@/pages/playtelecom/Promoters/PromotersAudit'
import { PromoterCharts } from '@/pages/playtelecom/PromotersAudit/components/PromoterCharts'
import { CategoryManagement } from '@/pages/playtelecom/Stock/components/CategoryManagement'
import { StockVsSalesChart } from '@/pages/playtelecom/Stock/components/StockVsSalesChart'
import { VenueSimCustodyPanel } from '@/pages/playtelecom/Stock/components/VenueSimCustodyPanel'
import { PaymentActivationCard } from '@/components/onboarding/PaymentActivationCard'

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const AVISO = 'loadFailure.empty'
const nada = () => undefined
const SIN_PAGINAS = { items: [], nextCursor: null }
const RECIBO = { renglones: [], total: '0', cantidad: 0, totalesPorTipo: {}, nextCursor: null }
const CUSTODIA = {
  items: [],
  summary: { total: 0, almacen: 0, pendientes: 0, aceptados: 0, rechazados: 0, vendidos: 0, estancados: 0 },
  promoterRanking: [],
  pagination: { page: 1, totalPages: 1, total: 0 },
}
const MATERIAL = { id: 'm1', name: 'Harina', sku: 'H1', currentStock: 1, minimumStock: 0, reorderPoint: 0, costPerUnit: 1, unit: 'KILOGRAM', active: true, category: 'OTHER', _count: { recipeLines: 0 } }
const PRODUCTO = { id: 'p1', name: 'Café', sku: 'C1', unit: 'UNIT', inventory: { currentStock: 1 } }
const CALENDARIO = { reservations: [], grouped: null }

type Caso = {
  nombre: string
  pantalla: () => ReactElement
  caida: RegExp
  /** Lo que se ve con la respuesta buena en cero o vacía, y que sin haberla leído no debe salir. */
  miente: string[]
  /** Respuesta buena en cero o vacía. */
  rutas?: Ruta[]
  aviso?: string
  /** Lo que sigue a la vista con el fallo: los filtros, lo que sí llegó. */
  sigue?: string[]
  /** Lo de otra consulta: sigue sólo si cae ésta, porque sin internet todas se pausan. */
  sigueSiSoloCaeEsta?: string[]
  params?: Record<string, string>
  /** Para llegar a lo que se prueba. `preparar` (la caída o la pausa) va justo antes del último paso. */
  abrir?: (preparar: () => void) => Promise<void>
}

const casos: Caso[] = [
  // ─── Grupo 1: el esqueleto eterno (ya arreglado en su padre) ───
  {
    nombre: 'Resumen de Ventas',
    pantalla: () => <SalesSummary />,
    caida: /sales-summary/,
    rutas: [[/sales-summary/, { data: { dateRange: {}, reportType: 'summary', summary: {}, byPaymentMethod: [], byMerchantAccount: [] } }]],
    miente: [],
  },

  // ─── Grupo 2: sin internet mentían ───
  {
    nombre: 'Incidencias de caja externa',
    pantalla: () => <IncidentsQueue venueId="v1" areas={[]} />,
    caida: /external-incidents/,
    rutas: [[/external-incidents/, { data: SIN_PAGINAS }]],
    miente: ['areaTickets.externalSettlements.incidentEmptyDefault'],
    aviso: 'areaTickets.externalSettlements.loadError',
    sigue: ['areaTickets.externalSettlements.filters.date'],
  },
  {
    nombre: 'Cobros por confirmar',
    pantalla: () => <SettlementsQueue venueId="v1" areas={[]} />,
    caida: /external-settlements/,
    rutas: [[/external-settlements/, { data: SIN_PAGINAS }]],
    miente: ['areaTickets.externalSettlements.emptyDefault'],
    aviso: 'areaTickets.externalSettlements.loadError',
    sigue: ['areaTickets.externalSettlements.filters.date'],
  },
  {
    nombre: 'Clases del periodo abierto de una persona',
    pantalla: () => <DesglosePersona staffId="s1" staffName="Ana" clases={0} total="0" fecha="2026-10-15" onClose={nada} />,
    caida: /report\/staff\/s1/,
    rutas: [
      [/report\/staff\/s1/, SIN_PAGINAS],
      [/staff\/s1\/receipt/, RECIBO],
    ],
    miente: ['period.detailEmpty'],
    aviso: 'period.listError',
  },
  {
    nombre: 'Recibo cerrado: el total en $0',
    pantalla: () => <DesglosePersona staffId="s1" staffName="Ana" clases={0} total="0" fecha="2026-10-15" cerrado onClose={nada} />,
    caida: /staff\/s1\/receipt/,
    rutas: [[/staff\/s1\/receipt/, RECIBO]],
    miente: ['period.total'],
    aviso: 'period.listError',
  },
  {
    nombre: 'Excepciones del periodo',
    pantalla: () => <ExcepcionesSheet onClose={nada} />,
    caida: /report\/exceptions/,
    rutas: [[/report\/exceptions/, SIN_PAGINAS]],
    miente: ['period.listEmpty'],
    aviso: 'period.listError',
  },
  {
    nombre: 'Reservas huérfanas',
    pantalla: () => <HuerfanasSheet onClose={nada} />,
    caida: /report\/orphans/,
    rutas: [[/report\/orphans/, { items: [], total: 0 }]],
    miente: ['period.listEmpty'],
    aviso: 'period.listError',
  },
  {
    nombre: 'Reporte de nómina',
    pantalla: () => <PayrollReport venueId="v1" startDate="2026-10-01" endDate="2026-10-31" />,
    caida: /payroll-summary/,
    rutas: [[/payroll-summary/, { rows: [] }]],
    miente: ['payroll.empty'],
    aviso: 'loadError.title',
  },
  {
    nombre: 'Reporte de puntualidad',
    pantalla: () => <PunctualityReport venueId="v1" startDate="2026-10-01" endDate="2026-10-31" />,
    caida: /attendance\/report/,
    rutas: [[/attendance\/report/, { rows: [], graceMinutes: 10 }]],
    miente: ['report.empty.title'],
    aviso: 'loadError.title',
  },
  {
    nombre: 'Cuadrante: el equipo',
    pantalla: () => <ShiftPlanner venueId="v1" todayIso="2026-11-03" enabled canManage settingsPath="/x" />,
    caida: /\/team\b/,
    rutas: [[/work-shifts\/assignments/, { data: [] }]],
    miente: ['shifts.week.noTeam'],
    aviso: 'loadError.title',
  },
  {
    nombre: 'Cuadrante: los turnos de la semana',
    pantalla: () => <ShiftPlanner venueId="v1" todayIso="2026-11-03" enabled canManage settingsPath="/x" />,
    caida: /work-shifts\/assignments/,
    miente: ['shifts.week.noTeam'],
    aviso: 'loadError.title',
  },
  {
    nombre: 'Tarjetas de regalo: pendientes de contabilizar',
    pantalla: () => <GiftCardReports venueId="v1" />,
    caida: /pending-accounting/,
    rutas: [
      [/pending-accounting/, { data: { items: [], total: 0, notice: null } }],
      [/\/summary/, { data: { sold: { cards: 0, amount: 0 }, redeemed: { movements: 0, net: 0 }, cancelled: { cards: 0, amount: 0 }, liveBalance: { cards: 0, amount: 0 }, adjustments: { increments: 0, decrements: 0 } } }],
      [/\/aging/, { data: { buckets: [], total: { cards: 0, amount: 0 } } }],
    ],
    miente: ['reports.pending.empty'],
    aviso: 'reports.pending.error',
  },
  {
    nombre: 'Canales de e-commerce',
    pantalla: () => <EcommerceMerchants />,
    caida: /ecommerce-merchants/,
    rutas: [[/ecommerce-merchants/, { data: { merchants: [] } }]],
    miente: ['noChannels'],
  },
  {
    nombre: 'Historial de comandos',
    pantalla: () => <CommandHistoryTable venueId="v1" terminalId="t1" />,
    caida: /tpv-commands/,
    rutas: [[/tpv-commands/, { data: [], meta: { total: 0 } }]],
    miente: ['commands.noHistory'],
    aviso: 'commands.historyError',
    sigue: ['commands.history'],
  },
  {
    nombre: 'Menú del aparato',
    pantalla: () => <DeviceMenusTab />,
    caida: /tpvs\/menus\?/,
    rutas: [
      [/tpvs\/menus\/options/, { menus: [], total: 0 }],
      [/tpvs\/menus\?/, { terminals: [], total: 0 }],
    ],
    miente: ['deviceMenus.sinAparatos'],
    aviso: 'deviceMenus.error',
  },
  {
    nombre: 'Reparto de ingresos (superadmin)',
    pantalla: () => <RevenueShareReportSection />,
    caida: /merchant-revenue-shares\/report/,
    rutas: [[/merchant-revenue-shares\/report/, { data: [], meta: {} }]],
    miente: ['Los merchants sin config aparecen igual aquí (default: 100% Avoqado).'],
  },
  {
    nombre: 'SIMs del supervisor',
    pantalla: () => <VenueSimCustodyPanel orgId="o1" venueId="v1" />,
    caida: /stock-control\/custody/,
    rutas: [[/stock-control\/custody/, { data: CUSTODIA }]],
    miente: ['Aún no tienes SIMs asignados. Pide al Admin que te asigne un lote.', 'Total'],
    sigue: ['En almacén'],
    aviso: 'No pudimos cargar tus SIMs. Intenta recargar.',
  },
  {
    nombre: 'Inventario serializado',
    pantalla: () => <SerializedSalesDemo />,
    caida: /serialized-inventory\/summary/,
    rutas: [
      [/serialized-inventory\/summary/, { data: { totals: { available: 0, sold: 0 }, categories: [] } }],
      [/serialized-inventory\/recent-sales/, { data: { sales: [] } }],
    ],
    miente: ['No hay categorías de productos configuradas'],
  },

  // ─── Grupo 3: sin internet, página en blanco ───
  {
    nombre: 'Detalle del conteo',
    pantalla: () => <StockCountDetailPage />,
    params: { countId: 'c1' },
    caida: /stock-counts\/c1/,
    rutas: [[/stock-counts\/c1/, { data: { id: 'c1', createdAt: '2026-10-01T00:00:00.000Z', type: 'FULL', status: 'COMPLETED', items: [], totals: {} } }]],
    miente: ['Fecha'],
    aviso: 'No se pudo cargar el conteo. Verifica el enlace o inténtalo de nuevo.',
  },
  {
    nombre: 'Detalle de la transferencia',
    pantalla: () => <TransferDetailPage />,
    params: { transferId: 't1' },
    caida: /inventory\/transfers\/t1/,
    rutas: [[/inventory\/transfers\/t1/, { data: { id: 't1', fromLocationName: 'Origen', toLocationName: 'Destino', status: 'COMPLETED', createdAt: '2026-10-01T00:00:00.000Z', items: [] } }]],
    miente: ['Origen'],
    aviso: 'No se pudo cargar la transferencia. Verifica el enlace o inténtalo de nuevo.',
  },
  {
    nombre: 'Ruteo: categorías',
    pantalla: () => <RoutingTab venueId="v1" />,
    caida: /section=categories/,
    rutas: [
      [/section=categories/, { data: { categories: [], unroutedCategories: 0, hasDefault: true, pagination: { page: 1, totalPages: 1, total: 0 } } }],
      [/print-stations\/$/, { data: [] }],
    ],
    miente: ['routing.empty', 'routing.allRouted'],
    aviso: 'routing.lists.loadError',
  },
  {
    nombre: 'Ruteo: productos de una categoría',
    pantalla: () => <RoutingTab venueId="v1" />,
    caida: /section=products/,
    rutas: [
      [/section=categories/, { data: { categories: [{ id: 'c1', name: 'Bebidas', printStationId: null, productCount: 0 }], unroutedCategories: 0, hasDefault: true, pagination: { page: 1, totalPages: 1, total: 1 } } }],
      [/section=products/, { data: { products: [], pagination: { page: 1, totalPages: 1, total: 0 } } }],
      [/print-stations\/$/, { data: [] }],
    ],
    miente: ['routing.lists.emptyProducts'],
    aviso: 'routing.lists.loadError',
    abrir: async preparar => {
      const expandir = await screen.findByRole('button', { name: 'routing.expandProducts' })
      preparar()
      fireEvent.click(expandir)
    },
  },

  // ─── Grupo 4: números y estados ───
  {
    nombre: 'Clientes por aprobar',
    pantalla: () => <CustomersAwaitingApproval venueId="v1" />,
    caida: /customers\/awaiting-approval/,
    rutas: [[/customers\/awaiting-approval/, { data: [], meta: { total: 0 } }]],
    miente: [],
  },
  {
    nombre: 'Pagos en línea: procesadores',
    pantalla: () => <Ecommerce />,
    caida: /ecommerce-merchants/,
    rutas: [[/ecommerce-merchants/, { data: { merchants: [] } }]],
    miente: ['paymentWidget.noProcessors', 'paymentWidget.needsProcessor'],
    sigue: ['paymentWidget.processorsTitle'],
  },
  {
    nombre: 'Facturas de la orden de compra',
    pantalla: () => <InvoiceSection venueId="v1" purchaseOrderId="p1" />,
    caida: /purchase-orders\/p1\/invoices/,
    rutas: [[/purchase-orders\/p1\/invoices/, { data: [] }]],
    miente: ['invoices.empty'],
  },
  {
    nombre: 'Movimientos del producto',
    pantalla: () => <InventoryMovementsDialog open onOpenChange={nada} product={PRODUCTO as never} />,
    caida: /inventory\/products\/p1\/movements/,
    rutas: [[/inventory\/products\/p1\/movements/, []]],
    miente: ['noData'],
  },
  {
    nombre: 'Movimientos del insumo',
    pantalla: () => <StockMovementsDialog open onOpenChange={nada} rawMaterial={MATERIAL as never} />,
    caida: /raw-materials\/m1\/movements/,
    rutas: [[/raw-materials\/m1\/movements/, { data: [] }]],
    miente: ['noData'],
  },
  {
    nombre: 'Detalle del insumo: recetas',
    pantalla: () => <RawMaterialDetailDialog open onOpenChange={nada} rawMaterial={MATERIAL as never} />,
    caida: /raw-materials\/m1\/recipes/,
    rutas: [[/raw-materials\/m1\/recipes/, { data: [] }]],
    miente: ['Este ingrediente aún no se usa en ninguna receta.'],
  },
  {
    nombre: 'Recetas que usan el insumo',
    pantalla: () => <RecipeUsageDialog open onOpenChange={nada} rawMaterial={MATERIAL as never} onRecipeClick={nada} />,
    caida: /raw-materials\/m1\/recipes/,
    rutas: [[/raw-materials\/m1\/recipes/, { data: [] }]],
    miente: ['rawMaterials.usage.noRecipes', 'rawMaterials.usage.goToRecipes'],
  },
  {
    nombre: 'Reglas de cuentas de comercio',
    pantalla: () => <MerchantRoutingRules />,
    caida: /merchant-routing-rules/,
    rutas: [[/merchant-routing-rules/, { data: { merchants: [] } }]],
    miente: ['empty'],
  },
  {
    nombre: 'Sugerencias de venta: desempeño',
    pantalla: () => <Upsell />,
    caida: /upsell-performance/,
    rutas: [[/upsell-performance/, { data: { hasData: false } }]],
    miente: ['Todavía no hay datos. Aparecerán cuando el POS empiece a mostrar sugerencias.'],
  },
  {
    nombre: 'Expediente del personal',
    pantalla: () => <StaffDocuments venueId="v1" staffId="s1" />,
    caida: /team\/s1\/documents/,
    rutas: [[/team\/s1\/documents/, { data: [] }]],
    miente: ['documents.empty'],
    sigue: ['documents.upload'],
  },
  {
    nombre: 'Mensajes a las terminales',
    pantalla: () => <TpvMessagesList venueId="v1" />,
    caida: /venues\/v1\/messages/,
    rutas: [[/venues\/v1\/messages/, { data: [] }]],
    miente: ['No hay mensajes'],
    sigue: ['Fecha'],
  },
  {
    nombre: 'Cuentas de comercio del negocio: la configuración',
    pantalla: () => <VenueMerchantAccounts />,
    caida: /venue-pricing\/config/,
    rutas: [
      [/venue-pricing\/config/, { data: null }],
      [/superadmin\/terminals/, { data: [] }],
    ],
    miente: ['No hay cuentas asociadas', 'Config de pago'],
    sigueSiSoloCaeEsta: ['Terminales'],
  },
  {
    nombre: 'Cuentas de comercio del negocio: las terminales',
    pantalla: () => <VenueMerchantAccounts />,
    caida: /superadmin\/terminals/,
    rutas: [
      [/venue-pricing\/config/, { data: null }],
      [/superadmin\/terminals/, { data: [] }],
    ],
    miente: ['No hay cuentas asociadas', 'Terminales'],
  },
  {
    nombre: 'Ubicación en vivo',
    pantalla: () => <LiveLocation />,
    params: { orgId: 'o1' },
    caida: /organizations\/o1\/terminals-locations/,
    rutas: [[/organizations\/o1\/terminals-locations/, { data: { terminals: [] } }]],
    miente: ['playtelecom:location.empty'],
  },
  {
    nombre: 'Categorías de stock',
    pantalla: () => <CategoryManagement open onOpenChange={nada} />,
    caida: /item-categories/,
    rutas: [[/item-categories/, { data: { categories: [] } }]],
    miente: ['playtelecom:categories.empty'],
  },
  {
    nombre: 'Stock contra ventas',
    pantalla: () => <StockVsSalesChart />,
    caida: /stock\/chart/,
    rutas: [[/stock\/chart/, { data: { days: [] } }]],
    miente: ['0 uds', '0 días'],
  },
  {
    nombre: 'Activa tus cobros',
    pantalla: () => <PaymentActivationCard />,
    caida: /payment-activation/,
    rutas: [[/payment-activation/, { data: { profile: { complete: false }, terminalsCount: 0, onlinePaymentsConnected: false, kycStatus: null } }]],
    miente: ['paymentActivation.progress', 'paymentActivation.items.profile'],
    sigue: ['paymentActivation.title'],
  },
  {
    nombre: 'Llaves de socios (superadmin)',
    pantalla: () => <PartnerKeys />,
    caida: /partner-keys/,
    rutas: [
      [/partner-keys/, { data: [] }],
      [/organizations/, { data: [] }],
    ],
    miente: ['No hay API keys', 'Total Keys'],
    sigue: ['Crear API Key'],
  },
  {
    nombre: 'Analítica de pagos (superadmin)',
    pantalla: () => <PaymentAnalytics />,
    caida: /profit-metrics/,
    rutas: [[/profit-metrics/, { data: { totalVolume: 0, totalTransactions: 0, totalProfit: 0, totalProviderCost: 0, averageMargin: 0, averageTransactionSize: 0 } }]],
    miente: ['paymentAnalytics.metrics.totalVolume'],
    sigue: ['paymentAnalytics.title'],
  },
  {
    nombre: 'Proveedores de pago (superadmin)',
    pantalla: () => <PaymentProviders />,
    caida: /superadmin\/payment-providers/,
    rutas: [[/superadmin\/payment-providers/, { data: [] }]],
    miente: ['No hay proveedores', 'Total Proveedores'],
    sigue: ['Nuevo Proveedor'],
  },
  {
    nombre: 'Ingresos de la plataforma: métricas (superadmin)',
    pantalla: () => <RevenueDashboard />,
    caida: /revenue\/metrics/,
    rutas: [
      [/revenue\/metrics/, { data: { totalRevenue: 0, commissionRevenue: 0, subscriptionRevenue: 0, featureRevenue: 0, transactionCount: 0, averageOrderValue: 0 } }],
      [/revenue\/breakdown/, { data: {} }],
    ],
    miente: ['Ingresos Totales', 'Transacciones Completadas'],
    sigueSiSoloCaeEsta: ['Por Venue'],
  },
  {
    nombre: 'Ingresos de la plataforma: desglose (superadmin)',
    pantalla: () => <RevenueDashboard />,
    caida: /revenue\/breakdown/,
    rutas: [
      [/revenue\/metrics/, { data: { totalRevenue: 0, commissionRevenue: 0, subscriptionRevenue: 0, featureRevenue: 0, transactionCount: 0, averageOrderValue: 0 } }],
      [/revenue\/breakdown/, { data: {} }],
    ],
    miente: ['Por Venue'],
    sigueSiSoloCaeEsta: ['Ingresos Totales'],
  },
  {
    nombre: 'Negocios (superadmin)',
    pantalla: () => <VenueManagement />,
    caida: /superadmin\/venues/,
    rutas: [
      [/superadmin\/venues/, { data: [] }],
      [/organizations/, { data: [], organizations: [] }],
    ],
    miente: ['Ingresos Totales', 'Venues Activos'],
    sigue: ['Crear Venue'],
  },
  {
    nombre: 'Roster de cuentas (superadmin)',
    pantalla: () => <VenueRosterPanel venueId="v1" />,
    caida: /venue-pricing\/roster/,
    rutas: [[/venue-pricing\/roster/, { data: { accounts: [], count: 0, rosterRolloutEnabled: false, hasConfig: true } }]],
    miente: ['Sin cuentas en el roster todavía.', '0 cuentas', 'Slots (legacy)'],
    sigue: ['Motor de cobro por roster'],
  },

  // ─── Grupo 5: lo que quedó dudoso ───
  {
    nombre: 'Tiendas: las tarjetas en 0',
    pantalla: () => <TiendasList />,
    params: { orgId: 'o1' },
    caida: /organizations\/o1\/venues/,
    rutas: [[/organizations\/o1\/venues/, []]],
    miente: ['organization:tiendas.noStores', 'organization:tiendas.totalStores'],
  },
  {
    nombre: 'Visión global: los números de la organización',
    pantalla: () => <VisionGlobal />,
    params: { orgId: 'o1' },
    caida: /organizations\/o1\/venues/,
    rutas: [[/organizations\/o1\/venues/, []]],
    miente: ['organization:metrics.totalSales', 'organization:storePerformance.noStores'],
  },
  {
    nombre: 'Campañas: las tarjetas en 0 (superadmin)',
    pantalla: () => <MarketingPage />,
    caida: /\/campaigns/,
    rutas: [[/\/campaigns/, { campaigns: [], total: 0 }]],
    miente: ['No hay campañas', 'Total Campañas'],
    sigue: ['Refrescar'],
  },
  {
    nombre: 'Promotores',
    pantalla: () => <PromotersAudit />,
    caida: /venues\/v1\/promoters/,
    rutas: [[/venues\/v1\/promoters/, { data: { promoters: [], summary: { total: 0, active: 0, todayTotalSales: 0, todayTotalCommissions: 0 } } }]],
    miente: ['playtelecom:promoters.total'],
    aviso: 'common:error.loadingFailed',
  },
]

let client: QueryClient
function pintar(caso: Pick<Caso, 'pantalla' | 'rutas' | 'params' | 'abrir'>, preparar: () => void = nada) {
  red.params = caso.params ?? {}
  red.rutas = caso.rutas ?? []
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  if (!caso.abrir) preparar()
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{caso.pantalla()}</MemoryRouter>
    </QueryClientProvider>,
  )
  return caso.abrir?.(preparar)
}
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
const noSeVe = (textos: string[]) => {
  for (const texto of textos) expect(screen.queryAllByText(texto)).toHaveLength(0)
}
const seVe = (textos: string[]) => {
  for (const texto of textos) expect(screen.getAllByText(texto).length).toBeGreaterThan(0)
}

beforeEach(() => {
  onlineManager.setOnline(true)
  red.caida = null
  red.estatus = 500
  red.toast = () => undefined
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(casos)('$nombre', caso => {
  const aviso = caso.aviso ?? AVISO

  it('con la consulta caída: aviso, y no el número ni el vacío', async () => {
    await pintar(caso, () => {
      red.caida = caso.caida
    })
    await screen.findAllByText(aviso)
    noSeVe(caso.miente)
    seVe([...(caso.sigue ?? []), ...(caso.sigueSiSoloCaeEsta ?? [])])
  })

  it('sin internet: aviso, y no el número ni el vacío', async () => {
    await pintar(caso, () => onlineManager.setOnline(false))
    await screen.findAllByText(aviso)
    noSeVe(caso.miente)
    seVe(caso.sigue ?? [])
  })

  it('respuesta buena en cero o vacía: lo de hoy, sin aviso', async () => {
    await pintar(caso)
    await sinConsultasEnCamino()
    if (caso.miente.length) await screen.findAllByText(caso.miente[0])
    seVe(caso.miente)
    expect(screen.queryAllByText(aviso)).toHaveLength(0)
  })
})

describe('Saldo disponible (carga con useState, no con TanStack)', () => {
  const SALDO: Ruta[] = [
    [/available-balance\/by-card-type/, { data: [] }],
    [/available-balance\/timeline/, { data: [] }],
    [/available-balance\/settlement-calendar/, { data: [] }],
    [/available-balance\/settlement-week/, { data: { days: [] } }],
    [/available-balance/, { data: { totalSales: 0, totalFees: 0, availableNow: 0, pendingSettlement: 0, estimatedNextSettlement: null } }],
    [/cash-closeouts\/expected/, { data: { needsCloseout: false, daysSinceLastCloseout: 0, hasCloseouts: false, expectedAmount: 0 } }],
  ]

  it('con el servidor caído: el aviso común con «Reintentar», sin el texto crudo de axios, y reintentar lo carga', async () => {
    await pintar({ pantalla: () => <AvailableBalance />, rutas: SALDO }, () => {
      red.caida = /available-balance(\?|$)/
    })
    await screen.findByText(AVISO)
    expect(screen.queryByText(/Request failed/)).toBeNull()
    expect(screen.queryByText(/error\.prefix/)).toBeNull()

    red.caida = null
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    await screen.findAllByText('description')
  })

  it('sin leer el último corte: lo dice, y el saldo que sí llegó se queda', async () => {
    await pintar({ pantalla: () => <AvailableBalance />, rutas: SALDO }, () => {
      red.caida = /cash-closeouts\/expected/
    })
    await screen.findByText(AVISO)
    expect(screen.getAllByText('tabs.all').length).toBeGreaterThan(0)
  })

  it('con todo leído en cero: sin aviso', async () => {
    await pintar({ pantalla: () => <AvailableBalance />, rutas: SALDO })
    await screen.findAllByText('tabs.all')
    await sinConsultasEnCamino()
    expect(screen.queryByText(AVISO)).toBeNull()
  })
})

describe('Ningún aviso pinta el texto crudo del error', () => {
  const crudo = /Request failed/
  it.each([
    ['Canales de e-commerce', () => <EcommerceMerchants />, /ecommerce-merchants/],
    ['Reparto de ingresos', () => <RevenueShareReportSection />, /merchant-revenue-shares\/report/],
    ['Inventario serializado', () => <SerializedSalesDemo />, /serialized-inventory\/summary/],
    ['Visión global (estadísticas de la organización)', () => <VisionGlobal />, /organizations\/o1\/stats|organizations\/o1$/],
    ['Tiendas (estadísticas de la organización)', () => <TiendasList />, /organizations\/o1\/stats|organizations\/o1$/],
  ] as Array<[string, () => ReactElement, RegExp]>)('%s', async (_nombre, pantalla, caida) => {
    await pintar({ pantalla, params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, []]] }, () => {
      red.caida = caida
    })
    await sinConsultasEnCamino()
    expect(screen.queryByText(crudo)).toBeNull()
  })
})

describe('Las gráficas del promotor avisan por fuente', () => {
  const TENDENCIA: Ruta = [/sales-trend/, { data: { salesData: [] } }]
  const MEZCLA: Ruta = [/sales-mix/, { data: { salesMix: [] } }]
  const ASISTENCIA: Ruta = [/attendance-calendar/, { data: { calendar: [], stats: { present: 0, absent: 0 } } }]
  const pantalla = () => <PromoterCharts promoterId="p1" promoterName="Ana" />

  it('la asistencia caída no dice 0 faltas, y lo que sí llegó se queda', async () => {
    await pintar({ pantalla, rutas: [TENDENCIA, MEZCLA, ASISTENCIA] }, () => {
      red.caida = /attendance-calendar/
    })
    await screen.findByText(AVISO)
    expect(screen.queryByText('Faltas')).toBeNull()
    await screen.findAllByText('Sin datos de ventas')
  })

  it('la tendencia caída no dice «Sin datos de ventas» en su tarjeta', async () => {
    await pintar({ pantalla, rutas: [TENDENCIA, MEZCLA, ASISTENCIA] }, () => {
      red.caida = /sales-trend/
    })
    await screen.findByText(AVISO)
    expect(screen.getAllByText('Sin datos de ventas')).toHaveLength(1)
    expect(screen.getByText('Faltas')).toBeInTheDocument()
  })

  it('sin internet: un aviso por tarjeta, y ningún vacío', async () => {
    await pintar({ pantalla, rutas: [TENDENCIA, MEZCLA, ASISTENCIA] }, () => onlineManager.setOnline(false))
    expect(await screen.findAllByText(AVISO)).toHaveLength(3)
    noSeVe(['Sin datos de ventas', 'Faltas'])
  })

  it('todo leído en cero: lo de hoy, sin aviso', async () => {
    await pintar({ pantalla, rutas: [TENDENCIA, MEZCLA, ASISTENCIA] })
    await screen.findAllByText('Sin datos de ventas')
    await sinConsultasEnCamino()
    expect(screen.queryByText(AVISO)).toBeNull()
    expect(screen.getByText('Faltas')).toBeInTheDocument()
  })
})

describe('Calendario de reservas', () => {
  const RUTAS: Ruta[] = [
    [/reservations\/settings/, { data: {} }],
    [/calendar/, CALENDARIO],
    [/class-sessions/, []],
    [/busy-blocks/, { data: [] }],
  ]
  const pantalla = () => <ReservationCalendar />
  const CUADRICULA = () => document.querySelector('[class*="overflow-auto"]')

  it('sin leer las reservas: aviso en lugar de la cuadrícula vacía', async () => {
    await pintar({ pantalla, rutas: RUTAS }, () => {
      red.caida = /reservations.*calendar|calendar/
    })
    await screen.findByText(AVISO)
    expect(CUADRICULA()).toBeNull()
  })

  it('sin leer las clases: aviso, y las reservas que sí llegaron se quedan', async () => {
    await pintar({ pantalla, rutas: RUTAS }, () => {
      red.caida = /class-sessions/
    })
    await screen.findByText(AVISO)
    expect(CUADRICULA()).not.toBeNull()
  })

  it('sin internet: aviso, sin cuadrícula', async () => {
    await pintar({ pantalla, rutas: RUTAS }, () => onlineManager.setOnline(false))
    await screen.findAllByText(AVISO)
    expect(CUADRICULA()).toBeNull()
  })

  it('calendario vacío de verdad: la cuadrícula de hoy, sin aviso', async () => {
    await pintar({ pantalla, rutas: RUTAS })
    await sinConsultasEnCamino()
    expect(CUADRICULA()).not.toBeNull()
    expect(screen.queryByText(AVISO)).toBeNull()
  })
})

describe('Integraciones: una lectura caída no dice «Disponible»', () => {
  const RUTAS: Ruta[] = [
    [/integrations\/google\/status/, { connected: true }],
    [/chat\/status/, { mode: 'QR' }],
    [/ecommerce-merchants/, { data: { merchants: [{ id: 'e1' }] } }],
    [/financial-connections/, { data: [{ id: 'b1', status: 'CONNECTED' }] }],
    [/pass-integrations/, { data: { planActive: true, connections: [], classProducts: { items: [], total: 0 } } }],
    [/shopify/, { data: { connection: null } }],
    [/venues\/v1$/, { id: 'v1' }],
  ]
  const tarjeta = (nombre: string) => document.querySelector(`[data-tour="integration-card-${nombre}"]`)?.textContent ?? ''
  const CONECTADA = 'edit.integrations.catalog.status.connected'
  const DISPONIBLE = 'edit.integrations.catalog.status.available'
  const SIN_LEER = 'edit.integrations.catalog.status.loadError'

  it.each([
    ['google', /integrations\/google\/status/],
    ['whatsapp', /chat\/status/],
    ['ecommerce', /ecommerce-merchants/],
    ['banks', /financial-connections/],
  ] as Array<[string, RegExp]>)('%s con su lectura caída', async (nombre, caida) => {
    await pintar({ pantalla: () => <Integrations />, rutas: RUTAS }, () => {
      red.caida = caida
    })
    await waitFor(() => expect(tarjeta(nombre)).toContain(SIN_LEER))
    expect(tarjeta(nombre)).not.toContain(DISPONIBLE)
  })

  it('un 404 de Google sigue siendo «no conectada», y lo leído se ve igual', async () => {
    await pintar({ pantalla: () => <Integrations />, rutas: RUTAS }, () => {
      red.caida = /integrations\/google\/status/
      red.estatus = 404
    })
    await waitFor(() => expect(tarjeta('google')).toContain(DISPONIBLE))
    await waitFor(() => expect(tarjeta('whatsapp')).toContain(CONECTADA))
    expect(document.body.textContent).not.toContain(SIN_LEER.split('.').pop() as string)
  })
})

describe('Detalle de campaña: el contador de entregas (superadmin)', () => {
  const CAMPANA = { id: 'c1', name: 'Campaña', subject: 'Asunto', status: 'COMPLETED', totalRecipients: 0, sentCount: 0, openedCount: 0, clickedCount: 0, failedCount: 0, createdAt: '2026-10-01T00:00:00.000Z', creator: { firstName: 'A', lastName: 'B' }, targetAllVenues: true, targetVenueIds: [], targetStaffRoles: [], bodyHtml: '' }
  const RUTAS: Ruta[] = [
    [/campaigns\/c1\/deliveries/, { deliveries: [], total: 0 }],
    [/campaigns\/c1/, { campaign: CAMPANA }],
  ]
  const pestana = () => screen.findByRole('tab', { name: /Entregas/ })

  it('sin leer las entregas: no dice 0', async () => {
    await pintar({ pantalla: () => <CampaignDetail />, params: { campaignId: 'c1' }, rutas: RUTAS }, () => {
      red.caida = /campaigns\/c1\/deliveries/
    })
    await sinConsultasEnCamino()
    expect((await pestana()).textContent).toBe('Entregas')
  })

  it('leídas en cero: dice 0', async () => {
    await pintar({ pantalla: () => <CampaignDetail />, params: { campaignId: 'c1' }, rutas: RUTAS })
    await sinConsultasEnCamino()
    expect((await pestana()).textContent).toBe('Entregas0')
  })
})

describe('Liquidación: «actualizada» sólo si de verdad se guardó', () => {
  const state = { settlement: { skipped: false, daysDebit: 1, daysCredit: 3, daysAmex: 3, daysInternational: 3, dayType: 'BUSINESS_DAYS', cutoffTime: '23:00', cutoffTimezone: 'America/Mexico_City' } } as never
  const fila = (cardType: string) => ({ id: `s-${cardType}`, cardType, effectiveTo: null })
  const guardar = async (filas: unknown[]) => {
    const avisos: Array<{ title?: string; description?: string }> = []
    pintar({ pantalla: () => <SettlementCard state={state} dispatch={nada} mode="edit" merchantAccountId="ma1" />, rutas: [[/settlement-configurations/, { data: filas }]] })
    red.toast = o => void avisos.push(o)
    fireEvent.click(screen.getByRole('button', { name: /Liquidación/ }))
    const boton = await screen.findByRole('button', { name: 'Guardar cambios' })
    await waitFor(() => expect(boton).toBeEnabled())
    fireEvent.click(boton)
    await waitFor(() => expect(avisos.length).toBeGreaterThan(0))
    return avisos
  }

  it('lectura buena y vacía: nada que actualizar, y lo dice', async () => {
    const [aviso] = await guardar([])
    expect(aviso.title).toBe('No se pudo actualizar la liquidación')
  })

  it('con una tarjeta sin fila: guarda las demás y dice cuál no', async () => {
    const [aviso] = await guardar([fila('DEBIT'), fila('CREDIT'), fila('AMEX')])
    expect(aviso.title).toBe('Liquidación actualizada')
    expect(aviso.description).toContain('INTERNATIONAL')
  })

  it('con todas sus filas: «actualizada», sin más', async () => {
    const [aviso] = await guardar([fila('DEBIT'), fila('CREDIT'), fila('AMEX'), fila('INTERNATIONAL')])
    expect(aviso.title).toBe('Liquidación actualizada')
    expect(aviso.description).toBeUndefined()
  })
})
