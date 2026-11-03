/**
 * D4, Organización y PlayTelecom: tableros con varias fuentes. Cada caso tumba UNA fuente: esa avisa en lugar de su número y lo de las demás
 * sigue a la vista. Corre con TanStack y los servicios de verdad: sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import OrganizationDashboard from '../Organization/OrganizationDashboard'
import OrgManagersDashboard from '../organizations/ManagersDashboard/ManagersDashboard'
import SalesDetail from '../organizations/SalesDetail/SalesDetail'
import SalesExecutive from '../organizations/SalesExecutive/SalesExecutive'
import CommandCenter from '../playtelecom/CommandCenter/CommandCenter'
import ManagersDashboard from '../playtelecom/Managers/ManagersDashboard'
import ReportePage from '../playtelecom/Reporte/ReportePage'
import SalesReport from '../playtelecom/Sales/SalesReport'
import StoresAnalysis from '../playtelecom/Stores/StoresAnalysis'
import SupervisorDashboard from '../playtelecom/Supervisor/SupervisorDashboard'

const m = vi.hoisted(() => ({
  lecturas: [] as [RegExp, unknown][],
  caida: null as RegExp | null,
  colgada: null as RegExp | null,
  movil: false,
  t: (k: string, o?: string | { defaultValue?: string }) => (typeof o === 'string' ? o : (o?.defaultValue ?? k)),
  venue: { venueId: 'v1', venueSlug: 'mi-negocio', fullBasePath: '/venues/mi-negocio', venue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City', currency: 'MXN', organizationId: 'o1' } },
  org: { orgId: 'o1', orgSlug: 'mi-org', basePath: '/organizations/mi-org', isLoading: false, organization: { id: 'o1', name: 'Mi organización' } },
  auth: {
    user: { id: 'u1', role: 'SUPERADMIN', venues: [] as unknown[] },
    staffInfo: { role: 'OWNER' },
    activeVenue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City', currency: 'MXN', organizationId: 'o1', features: [], modules: [] },
    allVenues: [] as unknown[],
    checkFeatureAccess: () => true,
  },
}))

vi.mock('@/api', () => {
  const get = (url: string) => {
    if (m.colgada?.test(url)) return new Promise(() => {})
    if (m.caida?.test(url)) return Promise.reject(new Error('500'))
    const hit = m.lecturas.find(([re]) => re.test(url))
    return hit ? Promise.resolve({ data: hit[1] }) : new Promise(() => {})
  }
  const post = () => Promise.resolve({ data: { data: {} } })
  return { default: { get, post, put: post, patch: post, delete: post } }
})
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => m.venue }))
vi.mock('@/hooks/use-current-organization', () => ({
  useCurrentOrganization: () => m.org,
  useOrgPromoters: () => ({ data: { promoters: [] } }),
  useOrgStockCustody: () => ({ data: undefined }),
}))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, role: 'OWNER', getDataScope: () => 'venue' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => m.movil }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }), useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/components/AddToAIButton', () => ({ AddToAIButton: () => null, default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }), Trans: () => null, initReactI18next: { type: '3rdParty', init: () => undefined } }))
vi.mock('recharts', async importOriginal => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="grafica">{children}</div>,
}))
vi.mock('../Organization/components/OrgRevenueTrendsChart', () => ({ OrgRevenueTrendsChart: ({ isLoading }: { isLoading: boolean }) => (isLoading ? null : <div>grafica de tendencia</div>) }))
vi.mock('../Organization/components/TopVenuesRanking', () => ({ TopVenuesRanking: () => null }))
vi.mock('../Organization/components/TopItemsTable', () => ({ TopItemsTable: ({ isLoading }: { isLoading: boolean }) => (isLoading ? null : <div>tabla de productos</div>) }))

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const enRuta = (ruta: string, patron: string, elemento: ReactElement) => (
  <MemoryRouter initialEntries={[ruta]}>
    <Routes>
      <Route path={patron} element={elemento} />
    </Routes>
  </MemoryRouter>
)
const raiz = (elemento: ReactElement) => enRuta('/', '/', elemento)

const PESOS_EN_CERO = /\$\s?0(\.00)?(?![\d,])/

const OVERVIEW = [
  /analytics\/enhanced-overview/,
  { name: 'Mi organización', totalRevenue: 0, totalOrders: 0, averageTicketSize: 0, totalPayments: 0, venueCount: 0, changes: {}, venues: [], topVenues: [] },
] as [RegExp, unknown]
const ORG: [RegExp, unknown][] = [OVERVIEW, [/analytics\/revenue-trends/, { series: [] }], [/analytics\/top-items/, []]]

const RESUMEN = [/sale-verifications\/summary/, { data: { totalCount: 0, completedCount: 0, pendingCount: 0, failedCount: 0, rejectedCount: 0, totalRevenue: 0, confirmedRevenue: 0 } }] as [RegExp, unknown]
const DETALLE: [RegExp, unknown][] = [RESUMEN, [/sale-verifications(\?|$)/, { success: true, data: [], pagination: { totalPages: 1, totalCount: 0 } }]]
const POR_MES = /sale-verifications\/by-month/
const EJECUTIVO: [RegExp, unknown][] = [RESUMEN, [POR_MES, { data: [] }], [/by-promoter-daily/, { data: { rows: [], days: [] } }], [/sale-verifications\/by-/, { data: [] }]]

const OVERVIEW_TIENDAS = [/stores-analysis\/overview/, { data: { todaySales: 0, activeStores: 0, totalStores: 0, todayCashSales: 0, approvedDeposits: 0 } }] as [RegExp, unknown]
const STOCK = [/stores-analysis\/stock-summary/, { data: { totalPieces: 0, lowStockAlerts: 0, storeBreakdown: [] } }] as [RegExp, unknown]
const ANOMALIAS = [/stores-analysis\/anomalies/, { data: { anomalies: [] } }] as [RegExp, unknown]
const TIENDA = { id: 's1', name: 'Tienda Uno', slug: 'uno', alertLevel: 'OK' }
const TIENDAS = [/stores-analysis\/venues/, { data: { venues: [TIENDA] } }] as [RegExp, unknown]
const COMANDO: [RegExp, unknown][] = [
  OVERVIEW_TIENDAS,
  STOCK,
  ANOMALIAS,
  TIENDAS,
  [/stores-analysis\/staff\/online/, { data: { activeCount: 0, total: 0 } }],
  [/stores-analysis\/activity-feed/, { data: { events: [] } }],
  [/stores-analysis\/charts\//, { data: { days: [], weekTotal: { actual: 0, target: 0 } } }],
  [/stores-analysis\/insights\//, { data: null }],
]
const GERENTES: [RegExp, unknown][] = [
  OVERVIEW_TIENDAS,
  STOCK,
  ANOMALIAS,
  TIENDAS,
  [/stores-analysis\/charts\//, { data: { days: [] } }],
  [/stores-analysis\/store-performance/, { data: { stores: [] } }],
  [/stores-analysis\/staff-attendance/, { data: { staff: [] } }],
]
const SUPERVISOR: [RegExp, unknown][] = [...GERENTES, [/stores-analysis\/activity-feed/, { data: { events: [] } }]]
const VENTAS: [RegExp, unknown][] = [
  [/sale-verifications\/summary/, { data: { totalRevenue: 0, totalCount: 0, conciliatedCount: 0, avgAmount: 0, pendingCount: 0 } }],
  [/sale-verifications\/daily/, { data: [] }],
  [/sale-verifications(\?|$)/, { success: true, data: [], pagination: { totalPages: 1, totalCount: 0 } }],
  TIENDAS,
]
const TIENDA_DETALLE: [RegExp, unknown][] = [
  TIENDAS,
  [/store\/s1\/summary/, { data: { todaySales: 0, weekSales: 0, activePromoters: 0, totalPromoters: 0, categoryBreakdown: [] } }],
  [/store\/s1\/sales-trend/, { data: { trend: [] } }],
  [/store\/s1\/inventory-summary/, { data: { totals: { available: 0, total: 0 }, categories: [] } }],
  [/stores-analysis\/charts\/revenue-vs-target/, { data: { days: [], weekTotal: { actual: 0, target: 0 } } }],
]

type Caso = {
  nombre: string
  pantalla: () => ReactElement
  lecturas: [RegExp, unknown][]
  caida: RegExp
  cero: RegExp
  sigue?: RegExp
}

const CASOS: Caso[] = [
  { nombre: 'organización: resumen', pantalla: () => enRuta('/o/o1', '/o/:orgId', <OrganizationDashboard />), lecturas: ORG, caida: /enhanced-overview/, cero: PESOS_EN_CERO, sigue: /tabla de productos/ },
  { nombre: 'organización: tendencia', pantalla: () => enRuta('/o/o1', '/o/:orgId', <OrganizationDashboard />), lecturas: ORG, caida: /revenue-trends/, cero: /grafica de tendencia/, sigue: /\$0\.00/ },
  { nombre: 'organización: productos', pantalla: () => enRuta('/o/o1', '/o/:orgId', <OrganizationDashboard />), lecturas: ORG, caida: /top-items/, cero: /tabla de productos/, sigue: /\$0\.00/ },
  { nombre: 'detalle de ventas: resumen', pantalla: () => raiz(<SalesDetail />), lecturas: DETALLE, caida: /sale-verifications\/summary/, cero: /Total ventas0/, sigue: /No hay ventas que coincidan/ },
  { nombre: 'detalle de ventas: lista', pantalla: () => raiz(<SalesDetail />), lecturas: DETALLE, caida: /sale-verifications(\?|$)/, cero: /No hay ventas que coincidan/, sigue: /Total ventas/ },
  { nombre: 'ventas ejecutivo: resumen', pantalla: () => raiz(<SalesExecutive />), lecturas: EJECUTIVO, caida: /sale-verifications\/summary/, cero: /Total aprobadas0/, sigue: /Ventas Totales por Mes/ },
  { nombre: 'gerentes de la organización', pantalla: () => raiz(<OrgManagersDashboard />), lecturas: [[/managers$/, { data: { managers: [] } }]], caida: /managers$/, cero: /0\/0/ },
  { nombre: 'centro de comando: ventas', pantalla: () => raiz(<CommandCenter />), lecturas: COMANDO, caida: /stores-analysis\/overview/, cero: /Venta Total Bruta\$0/, sigue: /Stock de SIMs/ },
  { nombre: 'centro de comando: stock', pantalla: () => raiz(<CommandCenter />), lecturas: COMANDO, caida: /stores-analysis\/stock-summary/, cero: /Stock de SIMs0/, sigue: /Venta Total Bruta/ },
  { nombre: 'centro de comando: anomalías', pantalla: () => raiz(<CommandCenter />), lecturas: COMANDO, caida: /stores-analysis\/anomalies/, cero: /Anomalías Operativas0/, sigue: /Venta Total Bruta/ },
  { nombre: 'gerentes PlayTelecom: tiendas', pantalla: () => raiz(<ManagersDashboard />), lecturas: GERENTES, caida: /stores-analysis\/overview/, cero: /Total en Calle\$0/, sigue: /Incidencias/ },
  { nombre: 'gerentes PlayTelecom: asistencia', pantalla: () => raiz(<ManagersDashboard />), lecturas: GERENTES, caida: /stores-analysis\/staff-attendance/, cero: /Incidencias.*OK/, sigue: /Total en Calle/ },
  { nombre: 'reporte de cierre', pantalla: () => raiz(<ReportePage />), lecturas: [[/closing-report/, { data: { rows: [], totalAmount: 0 } }]], caida: /closing-report/, cero: /No hay datos para mostrar/ },
  { nombre: 'reporte de ventas: resumen', pantalla: () => raiz(<SalesReport />), lecturas: VENTAS, caida: /sale-verifications\/summary/, cero: /Ingreso Total \(Periodo\)\$0/, sigue: /No hay verificaciones de venta/ },
  { nombre: 'reporte de ventas: lista', pantalla: () => raiz(<SalesReport />), lecturas: VENTAS, caida: /sale-verifications(\?|$)/, cero: /No hay verificaciones de venta/, sigue: /Ingreso Total/ },
  { nombre: 'análisis de tienda: ventas', pantalla: () => raiz(<StoresAnalysis />), lecturas: TIENDA_DETALLE, caida: /store\/s1\/summary/, cero: /Ventas Hoy/, sigue: /Progreso vs Meta Semanal/ },
  { nombre: 'análisis de tienda: meta', pantalla: () => raiz(<StoresAnalysis />), lecturas: TIENDA_DETALLE, caida: /charts\/revenue-vs-target/, cero: /Progreso vs Meta Semanal\s*\$0/, sigue: /Ventas Hoy/ },
  { nombre: 'supervisor: cobertura y efectivo', pantalla: () => raiz(<SupervisorDashboard />), lecturas: SUPERVISOR, caida: /stores-analysis\/overview/, cero: /Efectivo Total en Calle\$0/, sigue: /Ventas x Tienda/ },
]

let client: QueryClient
function pintar(elemento: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{elemento}</QueryClientProvider>)
}
const seVe = (re: RegExp) => re.test(document.body.textContent ?? '')

beforeEach(() => {
  onlineManager.setOnline(true)
  m.lecturas = []
  m.caida = null
  m.colgada = null
  m.movil = false
  m.auth.user.role = 'SUPERADMIN'
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(CASOS)('$nombre', ({ pantalla, lecturas, caida, cero, sigue }) => {
  it('caída: avisa en lugar del número, y lo que sí llegó sigue', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText('loadFailure.empty')
    expect(seVe(cero)).toBe(false)
    if (sigue) await waitFor(() => expect(seVe(sigue)).toBe(true))
  })

  it('sin internet: lo mismo, y vuelve solo con la red', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(pantalla())
    await waitFor(() => expect(screen.getAllByText('loadFailure.empty').length).toBeGreaterThan(0))
    expect(seVe(cero)).toBe(false)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(seVe(cero)).toBe(true))
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })

  it('al reintentar no destapa el cero mientras espera', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText('loadFailure.empty')
    m.caida = null
    m.colgada = caida
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.queryByText('loadFailure.empty')).toBeNull())
    expect(seVe(cero)).toBe(false)
  })

  it('un negocio de verdad en cero se ve igual que hoy', async () => {
    m.lecturas = lecturas
    pintar(pantalla())
    await waitFor(() => expect(seVe(cero)).toBe(true))
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })
})

describe('casos sueltos', () => {
  it('organización sin permiso: la consulta nunca corre y no hay un $0 eterno ni un esqueleto eterno', async () => {
    m.lecturas = ORG
    m.auth.user.role = 'MANAGER'
    pintar(enRuta('/o/o1', '/o/:orgId', <OrganizationDashboard />))
    await screen.findByText('dashboard.selectPeriod', {}, { timeout: 2000 }).catch(() => undefined)
    expect(seVe(PESOS_EN_CERO)).toBe(false)
    expect(document.querySelector('.animate-pulse')).toBeNull()
  })

  it('detalle de ventas en el celular: la lista caída avisa, no dice «no hay ventas»', async () => {
    m.movil = true
    m.lecturas = DETALLE
    m.caida = /sale-verifications(\?|$)/
    pintar(raiz(<SalesDetail />))
    await screen.findByText('loadFailure.empty')
    expect(seVe(/No hay ventas que coincidan/)).toBe(false)
  })

  it('ventas ejecutivo: una gráfica caída avisa en lugar de «sin datos», y las demás siguen', async () => {
    m.lecturas = EJECUTIVO
    m.caida = POR_MES
    pintar(raiz(<SalesExecutive />))
    await screen.findByText('loadFailure.empty')
    await waitFor(() => expect(screen.getAllByText('Sin datos en el rango.').length).toBeGreaterThan(0))
    expect(document.body.textContent).toMatch(/Total aprobadas/)
  })
})
