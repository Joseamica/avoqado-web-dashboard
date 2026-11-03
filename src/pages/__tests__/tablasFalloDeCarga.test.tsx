/**
 * Una tabla hecha a mano decía «Sin…», «No hay…» o «Aún no…» cuando en realidad su consulta falló. Sin internet era peor: la
 * consulta queda en pausa, con `isError` en falso. El aviso sustituye al vacío; una lista vacía de verdad se ve igual que hoy.
 *
 * La pantalla y TanStack son de verdad: sólo se finge la red (`@/api`) y quién mira. Lista completa de las filas:
 * docs/audit/2026-11-03-d4-numeros-y-tablas/medicion-tablas.md.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
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
    t: (k: string) => k,
    /** Lo que contesta cualquier ruta que el caso no nombró: una lista vacía, en las formas que usan los servicios. */
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string) => {
    if (red.caida?.test(url)) throw Object.assign(new Error('caída'), { response: { status: red.estatus, data: {} } })
    const ruta = red.rutas.find(([patron]) => patron.test(url))
    return { data: ruta ? ruta[1] : red.cuerpoVacio }
  }
  const cliente = { get: responder, post: responder, put: responder, patch: responder, delete: responder, interceptors: { request: { use() {} }, response: { use() {} } } }
  return { default: cliente, publicApi: cliente, getConnectionStatus: () => ({ isOnline: true, isServerReachable: true }), subscribeToConnection: () => () => {} }
})
// Sin `importOriginal`: lo que este módulo arrastra se quedaría con el `useAuth` de verdad.
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
  }),
}))
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
  useTierFeatureAccess: () => ({ hasAccess: true, isLoading: false, requiredTier: null }),
  useVenueTier: () => ({ hasFeatureAccess: () => true, isLoading: false }),
}))
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

import CampaignDetail from '@/pages/Superadmin/Marketing/CampaignDetail'
import CustomerDetail from '@/pages/Customers/CustomerDetail'
import InterVenueTransferDetailPage from '@/pages/Inventory/InterVenueTransfers/InterVenueTransferDetailPage'
import InterVenueTransfersPage from '@/pages/Inventory/InterVenueTransfers/InterVenueTransfersPage'
import OrganizationDashboard from '@/pages/Organization/OrganizationDashboard'
import PurchaseOrderDetailPage from '@/pages/Inventory/PurchaseOrders/PurchaseOrderDetailPage'
import BankReconciliation from '@/pages/Reports/BankReconciliation'
import CashBasisVat from '@/pages/Reports/CashBasisVat'
import Nomina from '@/pages/Reports/Nomina'
import ReservationDetail from '@/pages/Reservations/ReservationDetail'
import { GoogleCalendarDeadLetterBanner } from '@/pages/Reservations/components/GoogleCalendarDeadLetterBanner'
import { Operations } from '@/pages/Settings/AreaTickets'
import TenderTypes from '@/pages/Settings/TenderTypes'
import { PrintersTab } from '@/pages/Settings/components/printStations/PrintersTab'
import ShiftId from '@/pages/Shift/ShiftId'
import { TablaDePagosTab } from '@/pages/StaffPay/components/TablaDePagosTab'
import SuperadminActivityLog from '@/pages/Superadmin/ActivityLog'
import Aggregators from '@/pages/Superadmin/Aggregators'
import KYCReview from '@/pages/Superadmin/KYCReview'
import MarketingPage from '@/pages/Superadmin/Marketing/MarketingPage'
import TemplatesPage from '@/pages/Superadmin/Marketing/TemplatesPage'
import ProfitAnalyticsDashboard from '@/pages/Superadmin/ProfitAnalyticsDashboard'
import PushNotifications from '@/pages/Superadmin/PushNotifications'
import TestingPayments from '@/pages/Superadmin/Testing/TestingPayments'
import TpvUpdates from '@/pages/Superadmin/TpvUpdates'
import Webhooks from '@/pages/Superadmin/Webhooks'
import TeamId from '@/pages/Team/TeamId'
import { TerminalOrdersTab } from '@/pages/Tpv/components/TerminalOrdersTab'
import OrgManagersDashboard from '@/pages/organizations/ManagersDashboard/ManagersDashboard'
import SalesDetail from '@/pages/organizations/SalesDetail/SalesDetail'
import SalesExecutive from '@/pages/organizations/SalesExecutive/SalesExecutive'
import TiendasList from '@/pages/organizations/TiendasList/TiendasList'
import CommandCenter from '@/pages/playtelecom/CommandCenter/CommandCenter'
import ManagersDashboard from '@/pages/playtelecom/Managers/ManagersDashboard'
import { OrgCargasTab } from '@/pages/playtelecom/Organization/StockControl/tabs/OrgCargasTab'
import OrgStockControlPage from '@/pages/playtelecom/Organization/OrgStockControlPage'
import ReportePage from '@/pages/playtelecom/Reporte/ReportePage'
import SalesReport from '@/pages/playtelecom/Sales/SalesReport'
import StoresAnalysis from '@/pages/playtelecom/Stores/StoresAnalysis'
import SupervisorDashboard from '@/pages/playtelecom/Supervisor/SupervisorDashboard'
import { AttendanceHeatmap } from '@/pages/playtelecom/Supervisor/components/AttendanceHeatmap'
import { SalesHeatmap } from '@/pages/playtelecom/Supervisor/components/SalesHeatmap'

// Radix los pide y jsdom no los trae.
Element.prototype.hasPointerCapture = () => false

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const AVISO = 'loadFailure.empty'

type Caso = {
  nombre: string
  pantalla: () => ReactElement
  /** La consulta que se cae. */
  caida: RegExp
  /** Lo que miente si la consulta no llegó, y lo que se ve si de verdad está vacía. */
  vacio: string
  rutas?: Ruta[]
  /** Lo que la pantalla ya decía en vez del vacío, si no es el aviso común. */
  aviso?: string
  /** Página de detalle: un 404 es su «no encontrado» de hoy, sin aviso. */
  detalle?: boolean
  params?: Record<string, string>
  /** Para llegar a la tabla. `preparar` va justo antes del último paso. */
  abrir?: (preparar: () => void) => Promise<void>
  /** La consulta corre al montar la pantalla aunque su pestaña esté cerrada: la caída va desde el principio. */
  fallaDesdeElInicio?: boolean
  /** Rutas que cambian al abrir, para el caso de la lista vacía de verdad. */
  rutasAlAbrir?: Ruta[]
  /** Si la vacía de verdad no pinta `vacio`: lo que se espera ver antes de comprobar que no hay aviso. */
  listo?: string
  /**
   * La tabla vive debajo de otra consulta: sin internet desde el principio lo que avisa es la de arriba y esta fuente ni se monta.
   * Se lee todo, y sin red sólo esta queda sin leer (`clave`, en su queryKey). `principal` es lo que debe seguir a la vista.
   */
  secundaria?: { clave: RegExp; listo: string; principal: string }
}

const clic = (nombre: string) => fireEvent.click(screen.getByRole('button', { name: nombre }))
const pestana = async (nombre: string | RegExp) => {
  const tab = await screen.findByRole('tab', { name: nombre })
  fireEvent.mouseDown(tab, { button: 0 })
  fireEvent.click(tab)
}

const ORG = { orgId: 'o1' }
const HEATMAP = { startDate: '2026-10-01', endDate: '2026-10-07' }

const casos: Caso[] = [
  // ─── Inventario ───
  {
    nombre: 'Traslados entre sucursales',
    pantalla: () => <InterVenueTransfersPage />,
    caida: /inter-venue-transfers$/,
    rutas: [[/inter-venue-transfers$/, { data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 } }]],
    vacio: 'interVenueTransfers.empty',
    aviso: 'interVenueTransfers.messages.loadError',
  },
  {
    nombre: 'Inventario consolidado',
    pantalla: () => <InterVenueTransfersPage />,
    caida: /consolidated/,
    rutas: [
      [/inter-venue-transfers$/, { data: { items: [], total: 0, page: 1, pageSize: 100, totalPages: 0 } }],
      [/consolidated/, { data: { venues: [] } }],
    ],
    vacio: 'interVenueTransfers.consolidated.empty',
    aviso: 'interVenueTransfers.messages.loadError',
    abrir: async preparar => {
      await screen.findByRole('tab', { name: 'interVenueTransfers.tabs.consolidated' })
      preparar()
      await pestana('interVenueTransfers.tabs.consolidated')
    },
  },
  {
    nombre: 'Detalle del traslado',
    pantalla: () => <InterVenueTransferDetailPage />,
    params: { transferId: 't1' },
    caida: /inter-venue-transfers\/t1/,
    vacio: 'interVenueTransfers.messages.notFound',
    detalle: true,
  },
  {
    nombre: 'Detalle de la orden de compra',
    pantalla: () => <PurchaseOrderDetailPage />,
    params: { poId: 'p1' },
    caida: /purchase-orders\/p1/,
    vacio: 'common:notFound',
    detalle: true,
  },

  // ─── Organización ───
  {
    nombre: 'Productos más vendidos de la organización',
    pantalla: () => <OrganizationDashboard />,
    params: ORG,
    caida: /analytics\/top-items/,
    rutas: [
      [/analytics\/top-items/, []],
      [/analytics\/enhanced-overview/, { name: 'Mi organización', venueCount: 0, topVenues: [], venues: [], changes: {} }],
      [/analytics\/revenue-trends/, { currentPeriod: { dataPoints: [] }, previousPeriod: { dataPoints: [] } }],
    ],
    vacio: 'dashboard.noItems',
  },
  {
    nombre: 'Tiendas de la organización',
    pantalla: () => <TiendasList />,
    params: ORG,
    caida: /organizations\/o1\/venues/,
    rutas: [[/organizations\/o1\/venues/, []]],
    vacio: 'organization:tiendas.noStores',
  },
  {
    nombre: 'Tiendas asignadas al gerente',
    pantalla: () => <OrgManagersDashboard />,
    params: ORG,
    caida: /managers\/m1/,
    rutas: [
      [/managers\/m1/, { data: { manager: { id: 'm1', name: 'Ana', email: 'ana@x.mx' }, metrics: { totalPromoters: 0, avgStorePerformance: 0 }, stores: [] } }],
      [/organizations\/o1\/managers$/, { data: { managers: [{ id: 'm1', name: 'Ana', storeCount: 0, activeStores: 0, todaySales: 0 }] } }],
    ],
    vacio: 'playtelecom:managers.noStores',
    abrir: async preparar => {
      fireEvent.keyDown(await screen.findByRole('button', { name: /playtelecom:managers.selectManager/ }), { key: 'Enter' })
      const gerente = await screen.findByText('Ana')
      preparar()
      fireEvent.click(gerente)
    },
  },
  {
    nombre: 'Ventas: detalle',
    pantalla: () => <SalesDetail />,
    params: ORG,
    caida: /sale-verifications(\?|$)/,
    rutas: [[/sale-verifications(\?|$)/, { success: true, data: [], pagination: { totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 20 } }]],
    vacio: 'No hay ventas que coincidan con los filtros.',
  },
  {
    nombre: 'Ventas: tablero ejecutivo',
    pantalla: () => <SalesExecutive />,
    params: ORG,
    caida: /sale-verifications\/by-/,
    rutas: [[/by-promoter-daily/, { data: { rows: [], days: [] } }]],
    vacio: 'Sin datos en el rango.',
  },

  // ─── Reportes ───
  {
    nombre: 'Estados de cuenta del banco',
    pantalla: () => <BankReconciliation />,
    caida: /bank-reconciliation\/statements$/,
    rutas: [[/bank-reconciliation\/statements$/, []]],
    vacio: 'bankReconciliation.empty',
  },
  {
    nombre: 'Movimientos de un estado de cuenta',
    pantalla: () => <BankReconciliation />,
    caida: /bank-reconciliation\/statements\/s1/,
    rutas: [
      [/bank-reconciliation\/statements$/, [{ id: 's1', fileName: 'octubre.csv', matchedCount: 0, lineCount: 0 }]],
      [/bank-reconciliation\/statements\/s1/, { id: 's1', lines: [] }],
    ],
    // Sin la lectura no deben salir los encabezados solos.
    vacio: 'bankReconciliation.date',
    abrir: async preparar => {
      const estado = await screen.findByText('octubre.csv')
      preparar()
      fireEvent.click(estado)
    },
  },
  {
    nombre: 'DIOT',
    pantalla: () => <CashBasisVat />,
    caida: /diot/,
    rutas: [
      [/diot/, { rows: [], totals: { proveedores: 0 } }],
      [/iva|flujo|cashflow/, { rfc: 'XAXX010101000', needsFiscalSetup: false }],
    ],
    vacio: 'cashBasisVat.diotEmpty',
    secundaria: { clave: /diot/, listo: 'cashBasisVat.diotEmpty', principal: 'cashBasisVat.preliminarBanner' },
  },
  {
    nombre: 'Vista previa de la nómina',
    pantalla: () => <Nomina />,
    caida: /preview/,
    rutas: [
      [/preview/, { lines: [], totals: { empleados: 0, percepcionesCents: 0, isrCents: 0, imssCents: 0, netoCents: 0 } }],
      [/employees/, { employees: [{ id: 'e1', nombre: 'Ana' }], rfc: 'XAXX010101000', needsFiscalSetup: false }],
    ],
    // Sin la lectura no deben salir los encabezados solos.
    vacio: 'nomina.col.empleado',
    secundaria: { clave: /preview/, listo: 'nomina.col.empleado', principal: 'nomina.run' },
  },

  // ─── Configuración ───
  {
    nombre: 'Vales por entregar',
    pantalla: () => <Operations venueId="v1" counters={{ tickets: {}, checkouts: {}, paymentReconciliationCount: 0 }} />,
    caida: /area-tickets\/operations/,
    rutas: [[/area-tickets\/operations/, { data: { pendingDelivery: [] } }]],
    vacio: 'No hay entregas pendientes.',
  },
  {
    nombre: 'Impresoras',
    pantalla: () => <PrintersTab venueId="v1" />,
    caida: /print-stations\/printers/,
    vacio: 'printers.empty',
  },
  {
    nombre: 'Tipos de pago',
    pantalla: () => <TenderTypes />,
    caida: /tender-types$/,
    rutas: [
      [/tender-types$/, { tenderTypes: [] }],
      [/tender-types\/commissions/, { rows: [], totalGross: 0, totalCommission: 0, totalNet: 0 }],
    ],
    vacio: 'empty',
  },
  {
    // Sin cobros, esta tabla no sale: «una tabla de ceros no informa nada». Sin la lectura, avisa.
    nombre: 'Comisiones de los tipos de pago',
    pantalla: () => <TenderTypes />,
    caida: /tender-types\/commissions/,
    rutas: [
      [/tender-types$/, { tenderTypes: [] }],
      [/tender-types\/commissions/, { rows: [], totalGross: 0, totalCommission: 0, totalNet: 0 }],
    ],
    vacio: 'commissions.title',
    listo: 'sections.primary',
  },
  {
    nombre: 'Equipo en la tabla de pagos',
    pantalla: () => <TablaDePagosTab />,
    caida: /venues\/v1\/team/,
    rutas: [
      [/staff-pay\/levels|staffpay\/levels/, []],
      [/assignments/, []],
      [/\/tables/, []],
      [/venues\/v1\/team/, { data: [], meta: { totalCount: 0 } }],
    ],
    vacio: 'who.empty',
    secundaria: { clave: /"team"/, listo: 'who.empty', principal: 'who.title' },
  },
  {
    nombre: 'Cuadrícula de la tabla de pagos',
    pantalla: () => <TablaDePagosTab />,
    caida: /levels/,
    rutas: [
      [/levels/, []],
      [/assignments/, []],
      [/\/tables/, []],
      [/venues\/v1\/team/, { data: [], meta: { totalCount: 0 } }],
    ],
    vacio: 'grid.empty',
    aviso: 'states.loadError',
  },
  {
    nombre: 'Pedidos de terminales',
    pantalla: () => <TerminalOrdersTab />,
    caida: /tpv-orders/,
    vacio: 'orders.empty',
  },
  {
    nombre: 'Reservas que no llegaron a Google',
    pantalla: () => <GoogleCalendarDeadLetterBanner venueId="v1" />,
    caida: /dead-letter/,
    rutas: [[/dead-letter/, { rows: [{ id: 'r1', source: {}, lastError: 'x' }], nextCursor: null }]],
    rutasAlAbrir: [[/dead-letter/, { rows: [], nextCursor: null }]],
    vacio: 'deadLetter.empty',
    abrir: async preparar => {
      await screen.findByText('deadLetter.viewDetails')
      preparar()
      clic('deadLetter.viewDetails')
    },
  },

  // ─── Detalles que decían «no encontrado» con el servidor caído ───
  {
    nombre: 'Detalle del turno',
    pantalla: () => <ShiftId />,
    params: { shiftId: 's1' },
    caida: /shifts\/s1/,
    vacio: 'detail.notFound',
    detalle: true,
  },
  {
    nombre: 'Detalle de la persona del equipo',
    pantalla: () => <TeamId />,
    params: { memberId: 'm1' },
    caida: /team\/m1/,
    vacio: 'detail.errors.memberNotFoundTitle',
    detalle: true,
  },
  {
    nombre: 'Detalle del cliente',
    pantalla: () => <CustomerDetail />,
    params: { customerId: 'c1' },
    caida: /customers\/c1/,
    vacio: 'common.notFound',
    detalle: true,
  },
  {
    nombre: 'Detalle de la reservación',
    pantalla: () => <ReservationDetail />,
    params: { reservationId: 'r1' },
    caida: /reservations\/r1/,
    vacio: 'emptyState.title',
    detalle: true,
  },

  {
    nombre: 'Revisión de KYC',
    pantalla: () => <KYCReview />,
    params: { venueId: 'v1' },
    caida: /superadmin\/kyc\/v1/,
    vacio: 'review.notFound',
    detalle: true,
  },

  // ─── PlayTelecom ───
  {
    nombre: 'Anomalías del centro de comando',
    pantalla: () => <CommandCenter />,
    caida: /stores-analysis\/anomalies/,
    rutas: [[/stores-analysis\/anomalies/, { data: { anomalies: [] } }]],
    vacio: 'No hay anomalías detectadas',
  },
  {
    // Sin eventos no hay «Ver más»: la tabla del diálogo no se alcanza con la primera lectura caída. Lo que miente es la lista.
    nombre: 'Actividad del centro de comando',
    pantalla: () => <CommandCenter />,
    caida: /stores-analysis\/activity-feed/,
    rutas: [[/stores-analysis\/activity-feed/, { data: { events: [] } }]],
    vacio: 'commandCenter.activity.empty',
  },
  {
    nombre: 'Inventario de la tienda',
    pantalla: () => <StoresAnalysis />,
    caida: /inventory-summary/,
    rutas: [
      [/inventory-summary/, { data: { categories: [], totals: { available: 0, total: 0 } } }],
      [/revenue-vs-target/, { data: { weekTotal: { actual: 0, target: 0 }, days: [] } }],
    ],
    vacio: 'Sin datos de inventario',
  },
  {
    nombre: 'Bitácora de asistencia',
    pantalla: () => <ManagersDashboard />,
    caida: /stores-analysis\/staff-attendance/,
    rutas: [[/stores-analysis\/staff-attendance/, { data: { staff: [] } }]],
    vacio: 'managers.attendance.noEntries',
  },
  {
    nombre: 'Inventario por responsable',
    pantalla: () => <OrgStockControlPage />,
    params: ORG,
    caida: /stock-control\/by-responsible/,
    rutas: [
      [/stock-control\/by-responsible/, { data: { total: {}, cities: [], unassigned: { promoters: [] }, filters: {} } }],
      [/stock-control\/summary/, { data: { summary: { totalSims: 1 }, aggregatesByCategoria: [], aggregatesBySucursal: [] } }],
    ],
    vacio: 'No hay inventario en manos de promotores con estos filtros.',
    secundaria: { clave: /responsible/i, listo: 'No hay inventario en manos de promotores con estos filtros.', principal: 'Control de Stock' },
  },
  {
    nombre: 'Cargas masivas',
    pantalla: () => <OrgCargasTab orgId="o1" params={{}} categories={[]} venues={[]} />,
    caida: /stock-control\/bulk-groups/,
    rutas: [[/stock-control\/bulk-groups/, { data: { groups: [], pagination: { total: 0, totalPages: 0, page: 1 } } }]],
    vacio: 'No hay cargas en el período seleccionado',
  },
  {
    nombre: 'Reporte de cierre',
    pantalla: () => <ReportePage />,
    caida: /closing-report/,
    rutas: [[/closing-report/, { data: { rows: [], totalAmount: 0 } }]],
    vacio: 'playtelecom:reporte.noData',
  },
  {
    nombre: 'Verificaciones de venta',
    pantalla: () => <SalesReport />,
    caida: /sale-verifications/,
    rutas: [[/sale-verifications/, { success: true, data: [], pagination: { totalCount: 0, totalPages: 0, pageNumber: 1, pageSize: 20 } }]],
    vacio: 'playtelecom:sales.noVerifications',
  },
  {
    nombre: 'Actividad del supervisor',
    pantalla: () => <SupervisorDashboard />,
    caida: /stores-analysis\/staff-attendance/,
    rutas: [[/stores-analysis\/staff-attendance/, { data: { staff: [] } }]],
    vacio: 'playtelecom:supervisor.noStoreActivity',
  },
  {
    nombre: 'Mapa de calor de asistencia',
    pantalla: () => <AttendanceHeatmap {...HEATMAP} />,
    caida: /attendance-heatmap/,
    rutas: [[/attendance-heatmap/, { data: { staff: [], summary: { byDay: [] } } }]],
    vacio: 'supervisor.attendanceHeatmap.noData',
  },
  {
    nombre: 'Mapa de calor de ventas',
    pantalla: () => <SalesHeatmap {...HEATMAP} />,
    caida: /sales-heatmap/,
    rutas: [[/sales-heatmap/, { data: { staff: [], summary: { byDay: [] } } }]],
    vacio: 'supervisor.salesHeatmap.noData',
  },

  // ─── Superadmin ───
  {
    nombre: 'Bitácora de actividad',
    pantalla: () => <SuperadminActivityLog />,
    caida: /superadmin\/activity-log\?/,
    rutas: [[/superadmin\/activity-log\?/, { data: { logs: [], pagination: { total: 0, totalPages: 0, page: 1, pageSize: 25 } } }]],
    vacio: 'No hay actividad registrada aún',
  },
  {
    nombre: 'Detalle de la campaña',
    pantalla: () => <CampaignDetail />,
    params: { campaignId: 'c1' },
    caida: /marketing\/campaigns\/c1$/,
    vacio: 'Campaña no encontrada',
    detalle: true,
  },
  {
    nombre: 'Entregas de la campaña',
    pantalla: () => <CampaignDetail />,
    params: { campaignId: 'c1' },
    caida: /campaigns\/c1\/deliveries/,
    rutas: [
      [/campaigns\/c1\/deliveries/, { deliveries: [], total: 0 }],
      [/marketing\/campaigns\/c1$/, { campaign: { id: 'c1', name: 'Navidad', subject: 'Hola', status: 'COMPLETED', bodyHtml: '', bodyText: '', totalRecipients: 0, sentCount: 0, failedCount: 0, openedCount: 0, clickedCount: 0, createdAt: '2026-10-01T00:00:00Z', creator: { firstName: 'Ana', lastName: 'Ruiz' }, targetAllVenues: true, targetVenueIds: [], targetStaffRoles: [] } }],
    ],
    vacio: 'No hay entregas registradas',
    fallaDesdeElInicio: true,
    // Sin internet tampoco llega la campaña: no hay pestañas, sólo su aviso.
    abrir: async () => {
      if (onlineManager.isOnline()) await pestana(/^Entregas/)
    },
  },
  {
    nombre: 'Campañas',
    pantalla: () => <MarketingPage />,
    caida: /marketing\/campaigns/,
    rutas: [[/marketing\/campaigns/, { campaigns: [], total: 0 }]],
    vacio: 'No hay campañas',
  },
  {
    nombre: 'Templates',
    pantalla: () => <TemplatesPage />,
    caida: /marketing\/templates/,
    rutas: [[/marketing\/templates/, { templates: [], total: 0 }]],
    vacio: 'No hay templates',
  },
  {
    nombre: 'Tarjetas de ganancias',
    pantalla: () => <ProfitAnalyticsDashboard />,
    caida: /profit\/metrics/,
    rutas: [[/profit\/metrics/, { data: { totalGrossProfit: 0, averageProfitMargin: 0, totalProviderCosts: 0, totalVenueCharges: 0, topVenues: [], providerBreakdown: [] } }]],
    // Sin la lectura no deben salir en $0.
    vacio: 'profitAnalytics.totalGrossProfit',
  },
  {
    nombre: 'Ganancias por mes',
    pantalla: () => <ProfitAnalyticsDashboard />,
    caida: /profit\/monthly/,
    rutas: [[/profit\/metrics/, { data: { totalGrossProfit: 0, averageProfitMargin: 0, totalProviderCosts: 0, totalVenueCharges: 0, topVenues: [], providerBreakdown: [] } }]],
    // Sin la lectura no deben salir los encabezados solos.
    vacio: 'profitAnalytics.table.period',
    fallaDesdeElInicio: true,
    abrir: () => pestana('profitAnalytics.tabs.monthly'),
  },
  {
    nombre: 'Personal con aparatos',
    pantalla: () => <PushNotifications />,
    caida: /staff-devices/,
    rutas: [[/staff-devices/, { staff: [], venues: [], total: 0 }]],
    vacio: 'No hay staff con dispositivos registrados',
  },
  {
    nombre: 'Pagos de prueba',
    pantalla: () => <TestingPayments />,
    caida: /testing\/payments/,
    vacio: 'noTests',
  },
  {
    nombre: 'Versiones de la TPV',
    pantalla: () => <TpvUpdates />,
    caida: /superadmin\/app-updates$/,
    rutas: [[/app-updates\/latest/, { data: null }]],
    vacio: 'No hay versiones disponibles',
  },
  {
    nombre: 'Eventos de webhooks',
    pantalla: () => <Webhooks />,
    caida: /superadmin\/webhooks$/,
    rutas: [
      [/superadmin\/webhooks$/, { data: { events: [], total: 0 } }],
      [/webhooks\/metrics/, { data: { summary: { successRate: 0, successCount: 0, totalEvents: 0, failedCount: 0, pendingCount: 0, avgProcessingTime: 0 }, byEventType: [] } }],
    ],
    vacio: 'events.noEvents',
  },
  {
    nombre: 'Agregadores',
    pantalla: () => <Aggregators />,
    caida: /aggregators\?/,
    vacio: 'No hay agregadores registrados',
  },
  {
    nombre: 'Comisiones de agregadores',
    pantalla: () => <Aggregators />,
    caida: /venue-commissions\?/,
    vacio: 'No hay comisiones registradas',
  },
]

let client: QueryClient
function pintar(caso: Caso, preparar: () => void) {
  red.params = caso.params ?? {}
  red.rutas = caso.rutas ?? []
  if (!caso.abrir || caso.fallaDesdeElInicio) preparar()
  client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{caso.pantalla()}</MemoryRouter>
    </QueryClientProvider>,
  )
  return caso.abrir?.(preparar)
}

beforeEach(() => {
  onlineManager.setOnline(true)
  red.caida = null
  red.estatus = 500
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(casos)('$nombre', caso => {
  const aviso = caso.aviso ?? AVISO

  it('con la consulta caída: aviso, y no el vacío', async () => {
    await pintar(caso, () => {
      red.caida = caso.caida
    })
    await screen.findAllByText(aviso)
    expect(screen.queryAllByText(caso.vacio)).toHaveLength(0)
  })

  it('sin internet: aviso, y no el vacío', async () => {
    if (caso.secundaria) {
      const { clave, listo, principal } = caso.secundaria
      await pintar(caso, () => {})
      await screen.findAllByText(listo)
      await waitFor(() => expect(client.isFetching()).toBe(0))
      onlineManager.setOnline(false)
      void client.resetQueries({ predicate: q => clave.test(JSON.stringify(q.queryKey)) })
      await screen.findAllByText(aviso)
      expect(screen.queryAllByText(caso.vacio)).toHaveLength(0)
      expect(screen.getAllByText(principal).length).toBeGreaterThan(0)
      return
    }
    await pintar(caso, () => onlineManager.setOnline(false))
    await screen.findAllByText(aviso)
    expect(screen.queryAllByText(caso.vacio)).toHaveLength(0)
  })

  if (caso.detalle) {
    it('un 404 de verdad: su «no encontrado» de hoy, sin aviso', async () => {
      await pintar(caso, () => {
        red.caida = caso.caida
        red.estatus = 404
      })
      await screen.findAllByText(caso.vacio)
      expect(screen.queryAllByText(aviso)).toHaveLength(0)
    })
    return
  }

  it('vacía de verdad: el vacío de hoy, sin aviso', async () => {
    await pintar(caso, () => {
      if (caso.rutasAlAbrir) red.rutas = caso.rutasAlAbrir
    })
    await screen.findAllByText(caso.listo ?? caso.vacio)
    expect(screen.queryAllByText(aviso)).toHaveLength(0)
  })
})

describe('«Reintentar» y la recarga caída con datos previos', () => {
  const impresora = { id: 'p1', name: 'Caja principal', connectionType: 'NETWORK', address: '10.0.0.1', paperWidthMm: 80, active: true }
  const conDatos: Caso = {
    nombre: 'Impresoras',
    pantalla: () => <PrintersTab venueId="v1" />,
    caida: /print-stations\/printers/,
    rutas: [[/print-stations\/printers/, { data: [impresora] }]],
    vacio: 'printers.empty',
  }

  it('«Reintentar» trae la lista cuando el servidor regresa', async () => {
    const caso = casos.find(c => c.nombre === 'Impresoras') as Caso
    await pintar(caso, () => {
      red.caida = caso.caida
    })
    await screen.findByText(AVISO)
    red.caida = null
    clic('retry')
    await screen.findByText('printers.empty')
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('una recarga caída deja las filas a la vista, con aviso', async () => {
    await pintar(conDatos, () => {})
    await screen.findByText('Caja principal')
    red.caida = conDatos.caida
    await act(() => client.refetchQueries().catch(() => undefined))
    await screen.findByText('loadFailure.partial')
    expect(screen.getByText('Caja principal')).toBeInTheDocument()
  })

  it('sin internet también, con datos previos', async () => {
    await pintar(conDatos, () => {})
    await screen.findByText('Caja principal')
    onlineManager.setOnline(false)
    void client.refetchQueries()
    await screen.findByText('loadFailure.partial')
    expect(screen.getByText('Caja principal')).toBeInTheDocument()
  })
})
