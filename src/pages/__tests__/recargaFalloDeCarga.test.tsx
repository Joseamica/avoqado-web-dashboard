/**
 * Los tres estados de cada fuente, siempre:
 *  - falló o en pausa SIN datos: el aviso en lugar del vacío o del número;
 *  - falló la recarga CON datos previos, aunque sean `[]` o un cero: lo que había sigue, con el aviso de ESA consulta;
 *  - respuesta buena vacía o en cero: lo de hoy, sin aviso.
 * Y mientras se reintenta sin datos: esqueleto, no el vacío. Los filtros no se van con el fallo: sin red son la salida a un periodo ya leído.
 *
 * La pantalla y TanStack son de verdad: sólo se finge la red (`@/api`) y quién mira. Hallazgos: docs/audit/2026-11-03-d4-numeros-y-tablas/codex-r5.md.
 */
import { onlineManager, QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
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
    colgada: null as RegExp | null,
    estatus: 500,
    params: {} as Record<string, string>,
    venue,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string) => {
    if (red.colgada?.test(url)) return new Promise(() => {})
    if (red.caida?.test(url)) throw Object.assign(new Error('caída'), { response: { status: red.estatus, data: {} } })
    const ruta = red.rutas.find(([patron]) => patron.test(url))
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
// El filtro se finge sólo para encontrarlo: lo que se prueba es que la pantalla lo conserve.
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/pages/Reports/components/ExchangesToReviewSection', () => ({ ExchangesToReviewSection: () => null }))
vi.mock('react-router-dom', async original => ({
  ...(await original<typeof import('react-router-dom')>()),
  useParams: () => red.params,
}))
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))
vi.mock('recharts', async original => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="grafica">{children}</div>,
}))

import api from '@/api'
import Attendance from '@/pages/Attendance/Attendance'
import BancosDispersiones from '@/pages/Bancos/BancosDispersiones'
import BancosMovimientos from '@/pages/Bancos/BancosMovimientos'
import BancosReportes from '@/pages/Bancos/BancosReportes'
import BancosSpei from '@/pages/Bancos/BancosSpei'
import BancosTransferencias from '@/pages/Bancos/BancosTransferencias'
import { ModifierInventoryAnalytics } from '@/pages/Inventory/components/ModifierInventoryAnalytics'
import OrganizationDashboard from '@/pages/Organization/OrganizationDashboard'
import { PaymentDrawerContent } from '@/pages/Payment/PaymentDrawerContent'
import PaymentId from '@/pages/Payment/PaymentId'
import BancosBeneficiarios from '@/pages/Bancos/BancosBeneficiarios'
import TeamCommissionRanking from '@/pages/Commissions/components/TeamCommissionRanking'
import ReferralsSettings from '@/pages/Referrals/ReferralsSettings'
import CashBasisVat from '@/pages/Reports/CashBasisVat'
import Nomina from '@/pages/Reports/Nomina'
import PaymentMethods from '@/pages/Reports/PaymentMethods'
import PromotionSales from '@/pages/Reports/PromotionSales'
import Refunds from '@/pages/Reports/Refunds'
import SalesByCategory from '@/pages/Reports/SalesByCategory'
import SalesByItem from '@/pages/Reports/SalesByItem'
import SalesSummary from '@/pages/Reports/SalesSummary'
import { GoogleCalendarDeadLetterBanner } from '@/pages/Reservations/components/GoogleCalendarDeadLetterBanner'
import CampaignEditor from '@/pages/Superadmin/Marketing/CampaignEditor'
import StaffManagement from '@/pages/Superadmin/StaffManagement'
import TemplatesPage from '@/pages/Superadmin/Marketing/TemplatesPage'
import TpvUpdates from '@/pages/Superadmin/TpvUpdates'
import VenuePaymentConfig from '@/pages/Venue/VenuePaymentConfig'
import OrgManagersDashboard from '@/pages/organizations/ManagersDashboard/ManagersDashboard'
import VisionGlobal from '@/pages/organizations/VisionGlobal/VisionGlobal'
import CommandCenter from '@/pages/playtelecom/CommandCenter/CommandCenter'
import { InventoryByResponsibleTable } from '@/pages/playtelecom/Organization/StockControl/components/InventoryByResponsibleTable'
import { OrgDetalleSimsTab } from '@/pages/playtelecom/Organization/StockControl/tabs/OrgDetalleSimsTab'
import SupervisorDashboard from '@/pages/playtelecom/Supervisor/SupervisorDashboard'
import { AttendanceHeatmap } from '@/pages/playtelecom/Supervisor/components/AttendanceHeatmap'
import { SalesHeatmap } from '@/pages/playtelecom/Supervisor/components/SalesHeatmap'

// Radix los pide y jsdom no los trae.
Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}
globalThis.IntersectionObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return []
  }
} as unknown as typeof IntersectionObserver

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const SIN_DATOS = 'loadFailure.empty'
const CON_DATOS = 'loadFailure.partial'
const seVe = (texto: RegExp | string) => (typeof texto === 'string' ? (document.body.textContent ?? '').includes(texto) : texto.test(document.body.textContent ?? ''))

let client: QueryClient
function pintar(pantalla: ReactElement, opciones: { rutas?: Ruta[]; params?: Record<string, string> } = {}) {
  red.rutas = opciones.rutas ?? []
  red.params = opciones.params ?? {}
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{pantalla}</MemoryRouter>
    </QueryClientProvider>,
  )
}
/** La lectura buena, ya en pantalla. */
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
/** Una recarga que falla: TanStack conserva `data` y marca el error. */
async function recargaCaida(patron: RegExp) {
  await sinConsultasEnCamino()
  red.caida = patron
  await act(() => client.refetchQueries().catch(() => undefined))
}

beforeEach(() => {
  onlineManager.setOnline(true)
  red.caida = null
  red.colgada = null
  red.estatus = 500
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

// ─── P1: el aviso que se perdía al recargar ───
describe('Bancos: la recarga caída de las conexiones avisa en las cinco páginas', () => {
  const CONEXIONES = /financial-connections$/
  const conexion = {
    id: 'c1',
    status: 'CONNECTED',
    institutionName: 'Banco',
    provider: { code: 'x', name: 'Banco' },
    accounts: [{ id: 'a1', label: 'Cuenta real', externalId: 'ext1', currency: 'MXN', balance: 10, availableBalance: 10 }],
  }
  const rutas: Ruta[] = [
    [CONEXIONES, { data: [conexion] }],
    [/financial-providers/, { data: [{ id: 'p1', code: 'x', name: 'Banco' }] }],
    [/movements/, { data: { movements: [], nextCursor: null } }],
  ]

  it.each([
    ['Movimientos', () => <BancosMovimientos />],
    ['Transferencias', () => <BancosTransferencias />],
    ['Dispersiones', () => <BancosDispersiones />],
    ['Reportes', () => <BancosReportes />],
    ['SPEI', () => <BancosSpei />],
  ] as Array<[string, () => ReactElement]>)('%s', async (_nombre, pantalla) => {
    pintar(pantalla(), { rutas })
    await sinConsultasEnCamino()
    await recargaCaida(CONEXIONES)
    await screen.findByText(CON_DATOS)
    // Lo que había sigue: ni el error de página completa ni «conecta tu banco».
    expect(seVe('hub.error')).toBe(false)
    expect(seVe('hub.empty')).toBe(false)
  })

  it('una lista de conexiones vacía también sigue, con su aviso', async () => {
    pintar(<BancosMovimientos />, { rutas: [[CONEXIONES, { data: [] }], rutas[1]] })
    await waitFor(() => expect(seVe('hub.empty.description')).toBe(true))
    await recargaCaida(CONEXIONES)
    await screen.findByText(CON_DATOS)
    expect(seVe('hub.empty.description')).toBe(true)
  })

  it('sin conexiones y con los proveedores caídos: no afirma «no hay bancos»', async () => {
    red.caida = /financial-providers/
    pintar(<BancosMovimientos />, { rutas: [[CONEXIONES, { data: [] }], rutas[1]] })
    await screen.findByText('hub.error.title')
    expect(seVe('hub.empty.noProviders')).toBe(false)
  })

  it('sin leer: sólo el error de siempre, sin el aviso parcial', async () => {
    red.caida = CONEXIONES
    pintar(<BancosMovimientos />, { rutas })
    await sinConsultasEnCamino()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

describe('Asistencia: el historial avisa de SU recarga caída', () => {
  const HISTORIAL = /time-entries\?/
  const rutas: Ruta[] = [
    [/time-entries\/active/, { data: [] }],
    [HISTORIAL, { timeEntries: [], total: 0 }],
  ]

  it('lectura anterior vacía: el vacío sigue, con aviso', async () => {
    pintar(<Attendance />, { rutas })
    await screen.findByText('empty.title')
    await recargaCaida(HISTORIAL)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('empty.title')).toBeInTheDocument()
  })

  it('con filas: las filas siguen, con aviso', async () => {
    const entrada = { id: 'e1', clockInTime: '2026-11-01T15:00:00Z', staff: { firstName: 'Ana', lastName: 'Ruiz' } }
    pintar(<Attendance />, { rutas: [rutas[0], [HISTORIAL, { timeEntries: [entrada], total: 1 }]] })
    await screen.findByText('Ana Ruiz')
    await recargaCaida(HISTORIAL)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Ana Ruiz')).toBeInTheDocument()
  })

  it('sin internet, con la lectura ya hecha', async () => {
    pintar(<Attendance />, { rutas })
    await screen.findByText('empty.title')
    onlineManager.setOnline(false)
    void client.refetchQueries()
    await screen.findAllByText(CON_DATOS)
    expect(screen.getByText('empty.title')).toBeInTheDocument()
  })

  it('una lectura vacía de verdad: sin aviso', async () => {
    pintar(<Attendance />, { rutas })
    await screen.findByText('empty.title')
    await sinConsultasEnCamino()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

describe('Nómina: la lectura de empleados', () => {
  const EMPLEADOS = /employees/

  it('sin empleados: el vacío sigue, con aviso', async () => {
    pintar(<Nomina />, { rutas: [[EMPLEADOS, { employees: [], rfc: 'XAXX010101000', needsFiscalSetup: false }]] })
    await screen.findByText('nomina.emptyTitle')
    await recargaCaida(EMPLEADOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('nomina.emptyTitle')).toBeInTheDocument()
  })

  it('sin alta fiscal: también', async () => {
    pintar(<Nomina />, { rutas: [[EMPLEADOS, { employees: [], needsFiscalSetup: true }]] })
    await screen.findByText('chartOfAccounts.needsFiscalSetupTitle')
    await recargaCaida(EMPLEADOS)
    await screen.findByText(CON_DATOS)
  })

  it('sin empleados de verdad: sin aviso', async () => {
    pintar(<Nomina />, { rutas: [[EMPLEADOS, { employees: [], rfc: 'XAXX010101000', needsFiscalSetup: false }]] })
    await screen.findByText('nomina.emptyTitle')
    await sinConsultasEnCamino()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

// ─── P2: los filtros no se van con el fallo ───
describe.each([
  ['Métodos de pago', () => <PaymentMethods />, /reports\/sales-summary/],
  ['Ventas por artículo', () => <SalesByItem />, /reports\/sales-by-item/],
  ['Ventas por categoría', () => <SalesByCategory />, /reports\/sales-by-item/],
  ['Promociones', () => <PromotionSales />, /reports\/promotions/],
  ['Reembolsos', () => <Refunds />, /reports\/refunds/],
  ['Resumen de ventas', () => <SalesSummary />, /sales-summary/],
] as Array<[string, () => ReactElement, RegExp]>)('%s conserva su filtro', (_nombre, pantalla, lectura) => {
  it('caída: aviso con «Reintentar», y el filtro sigue', async () => {
    red.caida = lectura
    pintar(pantalla())
    await screen.findByText(SIN_DATOS)
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
    // Y el aviso va debajo del filtro.
    const filtro = screen.getByTestId('filtro-fechas')
    const aviso = screen.getByText(SIN_DATOS)
    expect(filtro.compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin internet: el filtro sigue, para volver a un periodo ya leído', async () => {
    onlineManager.setOnline(false)
    pintar(pantalla())
    await screen.findByText(SIN_DATOS)
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })
})

describe('Inventario de modificadores conserva su filtro', () => {
  it('caída: aviso con «Reintentar», y el selector sigue', async () => {
    red.caida = /modifiers\/inventory\/su/
    pintar(<ModifierInventoryAnalytics />)
    await screen.findByText(SIN_DATOS)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
  })
})

describe('Organización: un resumen que no llega no esconde lo que sí llegó', () => {
  const rutas: Ruta[] = [
    [/revenue-trends/, { currentPeriod: { dataPoints: [] }, previousPeriod: { dataPoints: [] }, comparison: { revenueChange: 0, ordersChange: 0 } }],
    [/top-items/, [{ productId: 'p1', productName: 'Café de olla', categoryName: 'Bebidas', quantitySold: 3, totalRevenue: 90, orderCount: 3, averagePrice: 30, rank: 1 }]],
  ]

  it('el selector de periodo y los productos siguen mientras espera', async () => {
    red.colgada = /enhanced-overview/
    pintar(<OrganizationDashboard />, { rutas, params: { orgId: 'o1' } })
    await screen.findByText('Café de olla')
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    // El resumen sigue sin leerse: sus tarjetas no salen en cero.
    expect(seVe('dashboard.averageTicketSize')).toBe(false)
  })
})

// ─── P3: el vacío retornaba antes que el aviso ───
describe('Una lectura anterior vacía y la recarga caída', () => {
  const HEATMAP = { startDate: '2026-11-01', endDate: '2026-11-07' }

  it.each([
    ['Mapa de ventas', () => <SalesHeatmap {...HEATMAP} />, /sales-heatmap/, 'supervisor.salesHeatmap.noData'],
    ['Mapa de asistencia', () => <AttendanceHeatmap {...HEATMAP} />, /attendance-heatmap/, 'supervisor.attendanceHeatmap.noData'],
  ] as Array<[string, () => ReactElement, RegExp, string]>)('%s: el vacío sigue, con aviso', async (_nombre, pantalla, lectura, vacio) => {
    pintar(pantalla(), { rutas: [[lectura, { data: { staff: [], summary: { byDay: [] } } }]] })
    await screen.findByText(vacio)
    await recargaCaida(lectura)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText(vacio)).toBeInTheDocument()
  })

  it.each([
    ['Mapa de ventas', () => <SalesHeatmap {...HEATMAP} />, /sales-heatmap/, 'supervisor.salesHeatmap.noData'],
    ['Mapa de asistencia', () => <AttendanceHeatmap {...HEATMAP} />, /attendance-heatmap/, 'supervisor.attendanceHeatmap.noData'],
  ] as Array<[string, () => ReactElement, RegExp, string]>)('%s vacío de verdad: sin aviso', async (_nombre, pantalla, lectura, vacio) => {
    pintar(pantalla(), { rutas: [[lectura, { data: { staff: [], summary: { byDay: [] } } }]] })
    await screen.findByText(vacio)
    await sinConsultasEnCamino()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })

  it('Inventario por responsable: el vacío sigue, con aviso', async () => {
    const vacio = 'No hay inventario en manos de promotores con estos filtros.'
    function Tabla() {
      const q = useQuery({ queryKey: ['inventario-por-responsable'], queryFn: async () => (await api.get('/inventario-por-responsable')).data })
      return <InventoryByResponsibleTable data={q.data} isLoading={q.isLoading} query={q} />
    }
    pintar(<Tabla />, { rutas: [[/inventario-por-responsable/, { cities: [], unassigned: { promoters: [] } }]] })
    await screen.findByText(vacio)
    await recargaCaida(/inventario-por-responsable/)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText(vacio)).toBeInTheDocument()
  })

  it('DIOT: el vacío sigue, con aviso', async () => {
    pintar(<CashBasisVat />, {
      rutas: [
        [/diot/, { rows: [], totals: { proveedores: 0 } }],
        [/iva|flujo|cashflow/, { rfc: 'XAXX010101000', needsFiscalSetup: false }],
      ],
    })
    await screen.findByText('cashBasisVat.diotEmpty')
    await recargaCaida(/diot/)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('cashBasisVat.diotEmpty')).toBeInTheDocument()
  })
})

// ─── P4: el reintento destapaba el vacío ───
describe('Reintentar sin datos no destapa el vacío', () => {
  it('Tiendas del gerente: «No hay tiendas asignadas» no sale mientras espera', async () => {
    const DETALLE = /managers\/m1/
    pintar(<OrgManagersDashboard />, {
      params: { orgId: 'o1' },
      rutas: [
        [DETALLE, { data: { manager: { id: 'm1', name: 'Ana', email: 'ana@x.mx' }, metrics: { totalPromoters: 0, avgStorePerformance: 0 }, stores: [] } }],
        [/organizations\/o1\/managers$/, { data: { managers: [{ id: 'm1', name: 'Ana', storeCount: 0, activeStores: 0, todaySales: 0 }] } }],
      ],
    })
    fireEvent.keyDown(await screen.findByRole('button', { name: /playtelecom:managers.selectManager|Seleccionar/ }), { key: 'Enter' })
    const gerente = await screen.findByText('Ana')
    red.caida = DETALLE
    fireEvent.click(gerente)
    await screen.findByText(SIN_DATOS)
    expect(seVe('No hay tiendas asignadas')).toBe(false)

    red.caida = null
    red.colgada = DETALLE
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.queryByText(SIN_DATOS)).toBeNull())
    expect(seVe('No hay tiendas asignadas')).toBe(false)
  })

  it('Detalle de SIMs: «No hay SIMs» no sale mientras espera', async () => {
    const ITEMS = /stock-control\/items/
    red.caida = ITEMS
    pintar(<OrgDetalleSimsTab orgId="o1" params={{}} categories={[]} venues={[]} />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('No hay SIMs en el período')).toBe(false)

    red.caida = null
    red.colgada = ITEMS
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await waitFor(() => expect(screen.queryByText(SIN_DATOS)).toBeNull())
    expect(seVe('No hay SIMs en el período')).toBe(false)
  })
})

// ─── P5: fuentes independientes ───
describe('Centro de Mando: cada insight por su fuente', () => {
  const TOP = /insights\/top-promoter/
  const PEOR = /insights\/worst-attendance/
  const rutas: Ruta[] = [
    [/stores-analysis\/venues/, { data: { venues: [{ id: 's1', name: 'Tienda Norte', todaySales: 100 }, { id: 's2', name: 'Tienda Sur', todaySales: 50 }] } }],
    [TOP, { data: { promoter: { name: 'Ana', salesCount: 7 } } }],
    [PEOR, { data: { venue: { name: 'Tienda Sur', attendanceRate: 0.5 } } }],
  ]

  it('Top Promotor caído: aviso, sin «Sin datos · 0 SIMs activadas»', async () => {
    red.caida = TOP
    pintar(<CommandCenter />, { rutas })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('SIMs activadas')).toBe(false)
    expect(seVe('faltas hoy')).toBe(true)
  })

  it('Peor Asistencia caída: aviso, sin «0 faltas hoy»', async () => {
    red.caida = PEOR
    pintar(<CommandCenter />, { rutas })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('faltas hoy')).toBe(false)
    expect(seVe('7 SIMs activadas')).toBe(true)
  })

  it('las tiendas caídas no borran al promotor que sí llegó', async () => {
    red.caida = /stores-analysis\/venues/
    pintar(<CommandCenter />, { rutas })
    await screen.findAllByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('7 SIMs activadas')).toBe(true)
    expect(seVe('Tienda Líder')).toBe(false)
  })

  it('leídas y sin nadie: lo de hoy, sin aviso', async () => {
    pintar(<CommandCenter />, {
      rutas: [rutas[0], [TOP, { data: { promoter: null } }], [PEOR, { data: { venue: null } }]],
    })
    await waitFor(() => expect(seVe('0 SIMs activadas')).toBe(true))
    await sinConsultasEnCamino()
    expect(seVe('0 faltas hoy')).toBe(true)
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('una recarga caída deja el dato, con su aviso', async () => {
    pintar(<CommandCenter />, { rutas })
    await waitFor(() => expect(seVe('7 SIMs activadas')).toBe(true))
    await recargaCaida(TOP)
    await screen.findByText(CON_DATOS)
    expect(seVe('7 SIMs activadas')).toBe(true)
  })
})

describe('Supervisor: sin leer el rendimiento no hay «sin ventas» ni «sin metas»', () => {
  const RENDIMIENTO = /store-performance/
  const rutas: Ruta[] = [[RENDIMIENTO, { data: { stores: [] } }]]
  const noVentas = 'playtelecom:supervisor.noSalesData'

  it('caído: el aviso sustituye a los dos vacíos', async () => {
    red.caida = RENDIMIENTO
    pintar(<SupervisorDashboard />, { rutas })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('Sin ventas registradas')).toBe(false)
    expect(seVe('Sin metas configuradas')).toBe(false)
    expect(seVe(noVentas)).toBe(false)
  })

  it('leído y vacío: los dos vacíos de hoy, sin aviso', async () => {
    pintar(<SupervisorDashboard />, { rutas })
    await waitFor(() => expect(seVe('Sin ventas registradas')).toBe(true))
    await sinConsultasEnCamino()
    expect(seVe('Sin metas configuradas')).toBe(true)
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })

  it('recarga caída con la lectura vacía: siguen, con aviso', async () => {
    pintar(<SupervisorDashboard />, { rutas })
    await waitFor(() => expect(seVe('Sin ventas registradas')).toBe(true))
    await recargaCaida(RENDIMIENTO)
    await screen.findByText(CON_DATOS)
    expect(seVe('Sin ventas registradas')).toBe(true)
  })
})

describe('Errores de Google Calendar: la sonda inicial', () => {
  const SONDA = /dead-letter/

  it('caída: avisa, no desaparece', async () => {
    red.caida = SONDA
    pintar(<GoogleCalendarDeadLetterBanner venueId="v1" />)
    await screen.findByText(SIN_DATOS)
  })

  it('sin internet: igual', async () => {
    onlineManager.setOnline(false)
    pintar(<GoogleCalendarDeadLetterBanner venueId="v1" />)
    await screen.findByText(SIN_DATOS)
  })

  it('un 403 es un rol sin permiso: no da falsa alarma', async () => {
    red.caida = SONDA
    red.estatus = 403
    pintar(<GoogleCalendarDeadLetterBanner venueId="v1" />)
    await sinConsultasEnCamino()
    expect(document.body.textContent).toBe('')
  })

  it('leída y sin errores: no se ve nada', async () => {
    pintar(<GoogleCalendarDeadLetterBanner venueId="v1" />, { rutas: [[SONDA, { rows: [], nextCursor: null }]] })
    await sinConsultasEnCamino()
    expect(document.body.textContent).toBe('')
  })

  it('recarga caída con errores ya leídos: el aviso rojo sigue, con el de carga', async () => {
    pintar(<GoogleCalendarDeadLetterBanner venueId="v1" />, { rutas: [[SONDA, { rows: [{ id: 'r1', source: {}, lastError: 'x' }], nextCursor: null }]] })
    await screen.findByText('deadLetter.viewDetails')
    await recargaCaida(SONDA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('deadLetter.viewDetails')).toBeInTheDocument()
  })
})

describe('Visión Global: sin leer las tiendas no hay cifras', () => {
  const TIENDAS = /organizations\/o1\/venues/
  const tienda = { id: 's1', name: 'Tienda Norte', slug: 'norte', status: 'ACTIVE', metrics: { revenue: 1234, orderCount: 5, staffCount: 2 } }

  it('caída: aviso, sin $0 ni «No hay tiendas»', async () => {
    red.caida = TIENDAS
    pintar(<VisionGlobal />, { params: { orgId: 'o1' } })
    await screen.findByText(SIN_DATOS)
    expect(seVe(/\$0/)).toBe(false)
    expect(seVe('0/0')).toBe(false)
    expect(seVe('Ventas Totales')).toBe(false)
    expect(seVe('No hay tiendas registradas')).toBe(false)
  })

  it('recarga caída: las cifras siguen, con aviso', async () => {
    pintar(<VisionGlobal />, { params: { orgId: 'o1' }, rutas: [[TIENDAS, [tienda]]] })
    await screen.findAllByText(/1,234/)
    await recargaCaida(TIENDAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getAllByText(/1,234/).length).toBeGreaterThan(0)
  })

  it('una organización sin tiendas de verdad: lo de hoy, sin aviso', async () => {
    pintar(<VisionGlobal />, { params: { orgId: 'o1' }, rutas: [[TIENDAS, []]] })
    await screen.findByText('No hay tiendas registradas')
    await sinConsultasEnCamino()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

describe('Configuración de cobros: el margen y la tarifa', () => {
  const CONFIG = { primaryAccount: { id: 'm1', displayName: 'Principal', provider: { name: 'Blumon' } }, secondaryAccount: null, tertiaryAccount: null }
  const COSTOS = /cost-structures/
  const PRECIOS = /pricing-structures/
  const costo = { accountType: 'PRIMARY', debitRate: 0.01, creditRate: 0.01, amexRate: 0.01, internationalRate: 0.01 }
  const precio = { accountType: 'PRIMARY', active: true, debitRate: 0.02, creditRate: 0.02, amexRate: 0.02, internationalRate: 0.02, fixedFeePerTransaction: 3 }
  const rutas: Ruta[] = [
    [COSTOS, { data: [costo] }],
    [PRECIOS, { data: [precio] }],
    [/payment-config$/, { data: CONFIG }],
  ]

  it('costos caídos: sin margen 0.00 %, y la tarifa fija que sí se leyó sigue', async () => {
    red.caida = COSTOS
    pintar(<VenuePaymentConfig />, { rutas, params: { slug: 'mi-negocio' } })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('0.00%')).toBe(false)
    expect(seVe('$3.00')).toBe(true)
  })

  it('precios caídos: sin margen ni tarifa en cero', async () => {
    red.caida = PRECIOS
    pintar(<VenuePaymentConfig />, { rutas, params: { slug: 'mi-negocio' } })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('0.00%')).toBe(false)
    expect(seVe('$0.00')).toBe(false)
  })

  it('leídas: los números de hoy, sin aviso', async () => {
    pintar(<VenuePaymentConfig />, { rutas, params: { slug: 'mi-negocio' } })
    await waitFor(() => expect(seVe('$3.00')).toBe(true))
    await sinConsultasEnCamino()
    expect(seVe('1.00%')).toBe(true)
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

describe('Plantillas de marketing: el total', () => {
  it('caída: sin «Total: 0»', async () => {
    red.caida = /email-templates|templates/
    pintar(<TemplatesPage />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('Total: 0')).toBe(false)
  })

  it('leída y vacía: «Total: 0», sin aviso', async () => {
    pintar(<TemplatesPage />, { rutas: [[/templates/, { templates: [], total: 0 }]] })
    await waitFor(() => expect(seVe('Total: 0')).toBe(true))
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

// ─── P6: un 404 real no es un fallo de carga ───
describe('Detalle del pago', () => {
  const PAGO = /payments\/p1$/

  it('un 404 de verdad: «no encontrado», sin «Reintentar»', async () => {
    red.caida = PAGO
    red.estatus = 404
    pintar(<PaymentId />, { params: { paymentId: 'p1' } })
    await screen.findByText('detail.notFound')
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('un 500 sigue siendo un fallo: aviso con «Reintentar»', async () => {
    red.caida = PAGO
    pintar(<PaymentId />, { params: { paymentId: 'p1' } })
    await screen.findByText(SIN_DATOS)
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
    expect(screen.queryByText('detail.notFound')).toBeNull()
  })

  it('el cajón: un 404 tampoco se reintenta', async () => {
    red.caida = PAGO
    red.estatus = 404
    pintar(<PaymentDrawerContent paymentId="p1" onClose={() => {}} venueTimezone="America/Mexico_City" />)
    await screen.findByText('detail.notFound')
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })
})

// ─── Lo que encontró la pasada, fuera de los casos citados ───
describe('Otras fuentes sueltas', () => {
  it('Beneficiarios: sin internet, sin «no hay beneficiarios»', async () => {
    onlineManager.setOnline(false)
    pintar(<BancosBeneficiarios />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('hub.beneficiaries.empty')).toBe(false)
    expect(seVe('no_results')).toBe(false)
  })

  it('Ranking de comisiones: caído, sin «sin comisiones»', async () => {
    red.caida = /\/summaries/
    pintar(<TeamCommissionRanking />, { rutas: [[/\/stats/, {}]] })
    await screen.findByText(SIN_DATOS)
    expect(seVe('ranking.empty')).toBe(false)
  })

  it('Personal (superadmin): sin leer los conteos no hay un 0', async () => {
    red.caida = /superadmin\/staff/
    pintar(<StaffManagement />)
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(4)
  })

  it('Versiones de la TPV: la última sin leer no dice «Sin versiones»', async () => {
    red.caida = /app-updates\/latest/
    pintar(<TpvUpdates />)
    await screen.findAllByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('Sin versiones disponibles')).toBe(false)
  })

  it('Versiones de la TPV: leída y nula, «Sin versiones», sin aviso', async () => {
    pintar(<TpvUpdates />, { rutas: [[/app-updates\/latest/, { data: null }]] })
    await screen.findAllByText('Sin versiones disponibles')
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('Referidos: el resumen caído no dice «0 referidos»', async () => {
    red.caida = /referrals\/summary/
    pintar(<ReferralsSettings />, { rutas: [[/referrals/, { data: { active: true, tierRewards: [] }, active: true, tierRewards: [] }]] })
    await screen.findByText(SIN_DATOS)
    expect(seVe('active.metrics.referralsThisMonth')).toBe(false)
  })

  it('Editor de campaña: un 404 no se reintenta', async () => {
    red.caida = /campaigns\/c1/
    red.estatus = 404
    pintar(<CampaignEditor />, { params: { campaignId: 'c1' } })
    await screen.findByText('Campaña no encontrada')
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })
})
