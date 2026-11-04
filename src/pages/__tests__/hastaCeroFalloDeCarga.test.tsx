/**
 * «Hasta cero»: los estados de cada fuente, sin excepciones aceptadas.
 *  - primera lectura en camino, sin datos: esqueleto o «—», nunca un 0, un $0 ni «Sin…»;
 *  - falló o en pausa, sin datos: el aviso en lugar del número o del vacío;
 *  - reintentando, sin datos: esqueleto en esa región, y los filtros siguen;
 *  - falló o en pausa, CON datos previos: los datos siguen, con el aviso de ESA consulta;
 *  - 404 de un registro que no existe: «No existe», sin «Reintentar»;
 *  - un fallo de una fuente nunca esconde lo que sí llegó, ni los filtros.
 *
 * La pantalla y TanStack son de verdad: sólo se finge la red (`@/api`) y quién mira.
 * Hallazgos: docs/audit/2026-11-03-d4-numeros-y-tablas/codex-r6.md.
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
    colgada: null as RegExp | null,
    estatus: 500,
    params: {} as Record<string, string>,
    venue,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  const responder = async (url: string, config?: { params?: Record<string, unknown> }) => {
    const clave = config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>)}` : url
    if (red.colgada?.test(clave)) return new Promise(() => {})
    if (red.caida?.test(clave)) throw Object.assign(new Error('caída'), { response: { status: red.estatus, data: {} } })
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
vi.mock('@/pages/Customers/components/WalletPassCard', () => ({ default: () => null, WalletPassCard: () => null }))
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }), SocketProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/use-image-uploader', () => ({
  useImageUploader: () => ({
    uploading: false,
    imageUrl: null,
    imageForCrop: null,
    crop: { x: 0, y: 0 },
    zoom: 1,
    setImageUrl: () => {},
    initializeWithExistingUrl: () => {},
  }),
}))
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

import { PaymentActivationCard } from '@/components/onboarding/PaymentActivationCard'
import { StandaloneInvoicesSection } from '@/pages/Inventory/PurchaseOrders/components/StandaloneInvoicesSection'
import { IncidentsQueue } from '@/pages/AreaTickets/components/IncidentsQueue'
import { SettlementsQueue } from '@/pages/AreaTickets/components/SettlementsQueue'
import AvailableBalance from '@/pages/AvailableBalance/AvailableBalance'
import BancosReportes from '@/pages/Bancos/BancosReportes'
import CreditPackFormModal from '@/pages/CreditPacks/CreditPackForm'
import { CampaignEditorModal } from '@/pages/Customers/components/CampaignEditorModal'
import CustomerDetail from '@/pages/Customers/CustomerDetail'
import { DeliveryLivePanel } from '@/pages/Delivery/components/DeliveryLivePanel'
import Ecommerce from '@/pages/Ecommerce/Ecommerce'
import { GiftCardReports } from '@/pages/GiftCards/components/GiftCardReports'
import ProductStock from '@/pages/Inventory/ProductStock'
import StockCountDetailPage from '@/pages/Inventory/StockCounts/StockCountDetailPage'
import TransferDetailPage from '@/pages/Inventory/Transfers/TransferDetailPage'
import { ModifierInventoryAnalytics } from '@/pages/Inventory/components/ModifierInventoryAnalytics'
import { RecipeUsageDialog } from '@/pages/Inventory/components/RecipeUsageDialog'
import { ServiceFormDialog } from '@/pages/Menu/Services/ServiceFormDialog'
import CreatePaymentLinkDialog from '@/pages/PaymentLinks/CreatePaymentLinkDialog'
import Upsell from '@/pages/Promotions/Upsell'
import PaymentMethods from '@/pages/Reports/PaymentMethods'
import PromotionSales from '@/pages/Reports/PromotionSales'
import Refunds from '@/pages/Reports/Refunds'
import SalesByCategory from '@/pages/Reports/SalesByCategory'
import SalesByItem from '@/pages/Reports/SalesByItem'
import SalesSummary from '@/pages/Reports/SalesSummary'
import SerializedSalesDemo from '@/pages/SerializedSalesDemo/SerializedSalesDemo'
import AreaTickets from '@/pages/Settings/AreaTickets'
import { RoutingTab } from '@/pages/Settings/components/printStations/RoutingTab'
import OrganizationActivityLog from '@/pages/Organization/OrganizationActivityLog'
import OrganizationTerminals from '@/pages/Organization/OrganizationTerminals'
import OrganizationVenues from '@/pages/Organization/OrganizationVenues'
import ActivityLog from '@/pages/Superadmin/ActivityLog'
import EcommerceMerchantsGlobal from '@/pages/Superadmin/EcommerceMerchantsGlobal'
import MarketingPage from '@/pages/Superadmin/Marketing/MarketingPage'
import PartnerKeys from '@/pages/Superadmin/PartnerKeys'
import PaymentProviders from '@/pages/Superadmin/PaymentProviders'
import ProfitAnalyticsDashboard from '@/pages/Superadmin/ProfitAnalyticsDashboard'
import RevenueDashboard from '@/pages/Superadmin/RevenueDashboard'
import ServerHealth from '@/pages/Superadmin/ServerHealth'
import VenueManagement from '@/pages/Superadmin/VenueManagement'
import VenueRosterPanel from '@/pages/Superadmin/components/merchant-accounts/VenueRosterPanel'
import { CommandHistoryTable } from '@/pages/Tpv/components/CommandHistoryTable'
import { TpvMessagesList } from '@/pages/Tpv/components/TpvMessagesList'
import TpvId from '@/pages/Tpv/TpvId'
import EcommerceMerchants from '@/pages/Venue/EcommerceMerchants'
import Integrations from '@/pages/Venue/Edit/Integrations'
import LiveLocation from '@/pages/organizations/LiveLocation/LiveLocation'
import SalesDetail from '@/pages/organizations/SalesDetail/SalesDetail'
import TiendasList from '@/pages/organizations/TiendasList/TiendasList'
import VisionGlobal from '@/pages/organizations/VisionGlobal/VisionGlobal'
import CommandCenter from '@/pages/playtelecom/CommandCenter/CommandCenter'
import PlaytelecomManagers from '@/pages/playtelecom/Managers/ManagersDashboard'
import OrgStockControlPage from '@/pages/playtelecom/Organization/OrgStockControlPage'
import PromotersAudit from '@/pages/playtelecom/Promoters/PromotersAudit'
import StockControl from '@/pages/playtelecom/Stock/StockControl'
import StoresAnalysis from '@/pages/playtelecom/Stores/StoresAnalysis'
import SupervisorDashboard from '@/pages/playtelecom/Supervisor/SupervisorDashboard'

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
globalThis.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const SIN_DATOS = 'loadFailure.empty'
const CON_DATOS = 'loadFailure.partial'
const NO_EXISTE = 'loadFailure.notFound'
const seVe = (texto: RegExp | string) => (typeof texto === 'string' ? (document.body.textContent ?? '').includes(texto) : texto.test(document.body.textContent ?? ''))
/** Lo que se ve sólo mientras la lectura sigue en camino: `findBy` no aplica porque no llega nada. */
const unaVueltaAlLazo = () => act(() => new Promise<void>(r => setTimeout(r, 30)))
const reintentar = () => screen.findByRole('button', { name: 'retry' })
/** Que «no dice nada» no pase por una pantalla en blanco: la región está esperando. */
const esperando = () => expect(document.querySelector('.animate-pulse, .animate-spin')).not.toBeNull()

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
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
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

const STOCK: Ruta[] = [
  [/stock\/metrics/, { data: { totalPieces: 0, totalValue: 0, availablePieces: 0, soldToday: 0, soldThisWeek: 0 } }],
  [/stock\/categories/, { data: { categories: [] } }],
  [/stock\/movements/, { data: { movements: [], pagination: { hasMore: false, page: 1 } } }],
  [/stock\/responsibles/, { data: { adminHeld: { simsCount: 2 }, supervisors: [], promoters: [] } }],
]
const TIENDA = { id: 's1', name: 'Tienda Norte', slug: 'norte', status: 'ACTIVE', metrics: { revenue: 1234, orderCount: 5, staffCount: 2 } }

// ─── F1: datos o avisos perdidos ───
describe('F1 · Bancos Reportes conserva los importes ya leídos', () => {
  const rutas: Ruta[] = [
    [
      /financial-connections$/,
      {
        data: [
          {
            id: 'c1',
            status: 'CONNECTED',
            institutionName: 'Banco',
            provider: { code: 'x', name: 'Banco' },
            accounts: [{ id: 'a1', label: 'Cuenta real', externalId: 'ext1', currency: 'MXN', balance: 10, availableBalance: 10 }],
          },
        ],
      },
    ],
    [/financial-providers/, { data: [{ id: 'p1', code: 'x', name: 'Banco' }] }],
    [
      /movement-stats|movements\/stats|stats/,
      {
        data: {
          speiIn: { amount: 123, fee: 0, count: 1 },
          speiOut: { amount: 0, fee: 0, count: 0 },
          internalTransfers: { amount: 0, fee: 0, count: 0 },
          dispersions: { amount: 0, fee: 0, count: 0 },
        },
      },
    ],
  ]

  it('sin internet, con la lectura hecha: el importe sigue, con aviso', async () => {
    pintar(<BancosReportes />, { rutas })
    await waitFor(() => expect(seVe('$123.00')).toBe(true))
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    void client.refetchQueries()
    await screen.findAllByText(CON_DATOS)
    expect(seVe('$123.00')).toBe(true)
    expect(seVe('hub.reports.statsError')).toBe(false)
  })

  it('recarga caída, con la lectura hecha: igual', async () => {
    pintar(<BancosReportes />, { rutas })
    await waitFor(() => expect(seVe('$123.00')).toBe(true))
    await recargaCaida(/stats/)
    await screen.findAllByText(CON_DATOS)
    expect(seVe('$123.00')).toBe(true)
    expect(seVe('hub.reports.statsError')).toBe(false)
  })

  it('sin leer: «—», su aviso de siempre y «Reintentar»', async () => {
    red.caida = /stats/
    pintar(<BancosReportes />, { rutas })
    await screen.findAllByText('hub.reports.statsError')
    expect(seVe('$0.00')).toBe(false)
    expect(seVe('—')).toBe(true)
    expect(screen.getAllByRole('button', { name: /retry/ }).length).toBeGreaterThan(0)
  })
})

describe('F1 · Ruteo no pierde el aviso de recarga de las estaciones', () => {
  const ESTACIONES = /print-stations\/$/
  const rutas: Ruta[] = [
    [/section=categories/, { data: { categories: [{ id: 'cat1', name: 'Bebidas', productCount: 0, printStationId: null }], hasDefault: true, unroutedCategories: 0, pagination: { page: 1, total: 1, totalPages: 1 } } }],
    [ESTACIONES, { data: [{ id: 'st1', name: 'Barra', active: true }] }],
  ]

  it('recarga caída: las estaciones siguen, con su aviso', async () => {
    pintar(<RoutingTab venueId="v1" />, { rutas })
    await screen.findByText('Bebidas')
    await recargaCaida(ESTACIONES)
    await screen.findByText('stations.loadError')
    expect(screen.getByText('Bebidas')).toBeInTheDocument()
  })
})

describe('F1 · Control de Stock de la organización avisa también con cero SIMs', () => {
  const RESUMEN = /stock-control\/summary/
  it('recarga caída sobre una lectura en cero: el vacío sigue, con aviso', async () => {
    const vacio = { summary: { totalSims: 0 }, aggregatesByCategoria: [], aggregatesBySucursal: [], meta: {} }
    pintar(<OrgStockControlPage />, { rutas: [[RESUMEN, { data: vacio }]], params: { orgId: 'o1' } })
    await screen.findByText('Aún no hay SIMs cargadas')
    await recargaCaida(RESUMEN)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Aún no hay SIMs cargadas')).toBeInTheDocument()
  })
})

describe('F1 · Control de Stock del negocio: la recarga caída con datos', () => {
  const CATEGORIAS = /stock\/categories/
  const categoria = { id: 'k1', name: 'SIM Telcel', available: 4, sold7d: 1, coverage: 9 }
  it('las categorías siguen, con el aviso de SU consulta', async () => {
    pintar(<StockControl />, { rutas: [[CATEGORIAS, { data: { categories: [categoria] } }], ...STOCK] })
    await screen.findByText('SIM Telcel')
    await recargaCaida(CATEGORIAS)
    await waitFor(() => expect(screen.getAllByText(CON_DATOS).length).toBeGreaterThan(0))
    expect(screen.getByText('SIM Telcel')).toBeInTheDocument()
  })

  it('una lectura anterior vacía: el vacío sigue, con aviso', async () => {
    pintar(<StockControl />, { rutas: STOCK })
    await screen.findByText('No hay categorías de stock configuradas')
    await recargaCaida(CATEGORIAS)
    await waitFor(() => expect(screen.getAllByText(CON_DATOS).length).toBeGreaterThan(0))
    expect(screen.getByText('No hay categorías de stock configuradas')).toBeInTheDocument()
  })
})

// ─── F2: afirmar sin haber leído, mientras la primera lectura va en camino ───
describe('F2 · la primera lectura en camino no afirma nada', () => {
  it('Tiendas: sin 0 tiendas ni $0, y el buscador sigue', async () => {
    red.colgada = /organizations\/o1\/venues/
    pintar(<TiendasList />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(seVe('Total tiendas')).toBe(false)
    expect(seVe('Ventas hoy')).toBe(false)
    expect(seVe(/\$0/)).toBe(false)
    expect(seVe('No hay tiendas')).toBe(false)
    expect(screen.getByPlaceholderText('Buscar tiendas...')).toBeInTheDocument()
  })

  it('Tiendas: las estadísticas colgadas no esconden las tiendas que sí llegaron', async () => {
    red.colgada = /organizations\/o1$|organizations\/o1\/stats/
    pintar(<TiendasList />, { params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, [TIENDA]]] })
    await screen.findByText('Tienda Norte')
    expect(seVe('Total tiendas')).toBe(true)
  })

  it('Visión Global: las estadísticas colgadas no esconden las tiendas que sí llegaron', async () => {
    red.colgada = /organizations\/o1$|organizations\/o1\/stats/
    pintar(<VisionGlobal />, { params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, [TIENDA]]] })
    await screen.findByText('Tienda Norte')
  })

  it('Recetas de un insumo: no dice «no se usa»', async () => {
    red.colgada = /raw-materials\/m1\/recipes/
    pintar(<RecipeUsageDialog open onOpenChange={() => {}} rawMaterial={{ id: 'm1', name: 'Leche' } as never} onRecipeClick={() => {}} />)
    await unaVueltaAlLazo()
    expect(seVe('rawMaterials.usage.notUsed')).toBe(false)
    expect(seVe('rawMaterials.usage.noRecipes')).toBe(false)
    esperando()
  })

  it('Activar cobros: no dice «0 de 4» ni pinta pasos pendientes', async () => {
    red.colgada = /payment-activation|activation/
    pintar(<PaymentActivationCard />)
    await unaVueltaAlLazo()
    expect(seVe('de {{total}}')).toBe(false)
    expect(seVe('Dirección de tu local')).toBe(false)
    expect(seVe('Activa tus cobros')).toBe(true)
  })

  it('Proveedores de pago: sin «0» en las tarjetas', async () => {
    red.colgada = /payment-providers/
    pintar(<PaymentProviders />)
    await unaVueltaAlLazo()
    expect(seVe('Total Proveedores')).toBe(false)
    esperando()
  })

  it('Venues (superadmin): sin $0 ni «0 de 0»', async () => {
    red.colgada = /superadmin\/venues/
    pintar(<VenueManagement />)
    await unaVueltaAlLazo()
    expect(seVe('Ingresos Totales')).toBe(false)
    expect(seVe('0 de 0')).toBe(false)
    esperando()
  })

  it('Cuentas del venue: sin «0 cuentas» ni «Slots (legacy)»', async () => {
    red.colgada = /venue-pricing\/roster/
    pintar(<VenueRosterPanel venueId="v1" />)
    await unaVueltaAlLazo()
    expect(seVe('0 cuentas')).toBe(false)
    expect(seVe('Slots (legacy)')).toBe(false)
    esperando()
  })

  it('Pagos en línea: no pide conectar un procesador', async () => {
    red.colgada = /ecommerce-merchants/
    pintar(<Ecommerce />)
    await unaVueltaAlLazo()
    expect(seVe('paymentWidget.needsProcessor')).toBe(false)
    expect(seVe('paymentWidget.loading')).toBe(true)
  })

  it('Control de Stock: sin «No hay movimientos» ni «En almacén · 0»', async () => {
    red.colgada = /stock\/movements|stock\/responsibles/
    pintar(<StockControl />, { rutas: STOCK })
    await unaVueltaAlLazo()
    expect(seVe('No hay movimientos recientes')).toBe(false)
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })

  it('Supervisor: la asistencia en camino no dice «Sin actividad»', async () => {
    red.colgada = /staff-attendance/
    pintar(<SupervisorDashboard />)
    await unaVueltaAlLazo()
    expect(seVe('Sin actividad registrada para este periodo')).toBe(false)
    esperando()
  })
})

// ─── F3: cargar o reintentar no desmonta los filtros ───
describe.each([
  ['Métodos de pago', () => <PaymentMethods />, /reports\/sales-summary/],
  ['Ventas por artículo', () => <SalesByItem />, /reports\/sales-by-item/],
  ['Ventas por categoría', () => <SalesByCategory />, /reports\/sales-by-item/],
  ['Promociones', () => <PromotionSales />, /reports\/promotions/],
  ['Reembolsos', () => <Refunds />, /reports\/refunds/],
  ['Resumen de ventas', () => <SalesSummary />, /sales-summary/],
] as Array<[string, () => ReactElement, RegExp]>)('F3 · %s: el filtro no se va', (_nombre, pantalla, lectura) => {
  it('mientras llega la primera lectura', async () => {
    red.colgada = lectura
    pintar(pantalla())
    await unaVueltaAlLazo()
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
    expect(seVe(/\$0/)).toBe(false)
  })

  it('al pulsar «Reintentar», sin el aviso y sin un cero', async () => {
    red.caida = lectura
    pintar(pantalla())
    const boton = await reintentar()
    red.caida = null
    red.colgada = lectura
    fireEvent.click(boton)
    await unaVueltaAlLazo()
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
    expect(seVe(/\$0/)).toBe(false)
  })
})

describe.each([
  ['Control de Stock', () => <StockControl />, /stock\/movements/, {}],
  ['Control de Stock (métricas)', () => <StockControl />, /stock\/metrics/, {}],
  ['Control de Stock (categorías)', () => <StockControl />, /stock\/categories/, {}],
  ['Supervisor', () => <SupervisorDashboard />, /stores-analysis\/overview/, {}],
  ['Gerencial', () => <PlaytelecomManagers />, /stores-analysis\/overview/, {}],
  ['Gerencial (asistencia)', () => <PlaytelecomManagers />, /staff-attendance/, {}],
  ['Stock de la organización', () => <OrgStockControlPage />, /stock-control\/summary/, { orgId: 'o1' }],
] as Array<[string, () => ReactElement, RegExp, Record<string, string>]>)('F3 · %s: el filtro no se va mientras carga', (_n, pantalla, lectura, params) => {
  it('primera lectura en camino', async () => {
    red.colgada = lectura
    pintar(pantalla(), { params, rutas: STOCK })
    await unaVueltaAlLazo()
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })
})

describe('F3 · lo demás que se llevaba el filtro', () => {
  it('Stock de la organización: caída sin datos, el filtro sigue', async () => {
    red.caida = /stock-control\/summary/
    pintar(<OrgStockControlPage />, { params: { orgId: 'o1' } })
    await screen.findByText('No se pudo cargar Control de Stock')
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })

  it('Inventario de modificadores: el selector sigue mientras carga', async () => {
    red.colgada = /modifiers\/inventory\/su/
    pintar(<ModifierInventoryAnalytics />)
    await unaVueltaAlLazo()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('Stock de productos: el buscador sigue mientras carga', async () => {
    red.colgada = /products/
    pintar(<ProductStock />)
    await unaVueltaAlLazo()
    expect(screen.getByPlaceholderText('productStock.searchPlaceholder')).toBeInTheDocument()
    expect(seVe('$0.00')).toBe(false)
  })

  it('Bitácora (superadmin): escribir en el buscador no le quita el foco', async () => {
    pintar(<ActivityLog />, { rutas: [[/activity-log\b/, { logs: [], pagination: { total: 0, page: 1, pageSize: 25, totalPages: 1 } }]] })
    const buscador = await screen.findByPlaceholderText(/buscar/i)
    buscador.focus()
    red.colgada = /activity-log/
    fireEvent.change(buscador, { target: { value: 'x' } })
    await act(() => new Promise<void>(r => setTimeout(r, 400)))
    expect(screen.getByPlaceholderText(/buscar/i)).toBe(buscador)
    expect(document.activeElement).toBe(buscador)
  })

  it('Bitácora: lectura en camino, los filtros siguen', async () => {
    red.colgada = /activity-log/
    pintar(<ActivityLog />)
    await unaVueltaAlLazo()
    expect(screen.getByPlaceholderText(/buscar/i)).toBeInTheDocument()
  })

  it.each([
    ['Ganancias', () => <ProfitAnalyticsDashboard />, /profit|monthly/],
    ['Ingresos', () => <RevenueDashboard />, /revenue/],
  ] as Array<[string, () => ReactElement, RegExp]>)('%s: las fechas siguen mientras carga', async (_n, pantalla, lectura) => {
    red.colgada = lectura
    pintar(pantalla())
    await unaVueltaAlLazo()
    expect(document.querySelectorAll('input[type="date"]').length).toBe(2)
  })

  it('Llaves de socios: el buscador sigue mientras carga', async () => {
    red.colgada = /partner/
    pintar(<PartnerKeys />)
    await unaVueltaAlLazo()
    expect(document.querySelector('input')).not.toBeNull()
  })

  it('Promotores: el buscador sigue mientras busca, y sin 0', async () => {
    red.colgada = /promoters/
    pintar(<PromotersAudit />)
    await unaVueltaAlLazo()
    expect(screen.getByPlaceholderText('Buscar promotor...')).toBeInTheDocument()
  })

  it('Análisis de tiendas: el selector sigue mientras carga el resumen', async () => {
    red.colgada = /store\/s1\/summary/
    pintar(<StoresAnalysis />, { rutas: [[/stores-analysis\/venues/, { data: { venues: [{ id: 's1', name: 'Tienda Norte', slug: 'norte', status: 'ACTIVE' }] } }]] })
    await waitFor(() => expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0))
  })

  it('Historial de comandos: el filtro de estado sigue mientras carga', async () => {
    red.colgada = /commands/
    pintar(<CommandHistoryTable venueId="v1" terminalId="t1" />)
    await unaVueltaAlLazo()
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })
})

// ─── F4: un error global esconde fuentes buenas ───
describe('F4 · Inventario serializado: cada fuente por su lado', () => {
  const RESUMEN = /serialized-inventory\/summary/
  const VENTAS = /serialized-inventory\/recent-sales|recent-sales/
  const resumen = {
    totals: { available: 17, sold: 3 },
    categories: [{ id: 'k1', name: 'SIM Telcel', available: 17, sold: 3, suggestedPrice: 100 }],
  }
  const ventas = { sales: [{ id: 'x1', serialNumber: 'ICCID-99', salePrice: 50, soldAt: '2026-11-01T15:00:00Z', category: { name: 'SIM AT&T' } }] }
  const rutas: Ruta[] = [
    [RESUMEN, { data: resumen }],
    [VENTAS, { data: ventas }],
  ]

  it('fallan las ventas: las existencias y el filtro siguen, y no dice «Aún no hay ventas»', async () => {
    red.caida = VENTAS
    pintar(<SerializedSalesDemo />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(screen.getByText('SIM Telcel')).toBeInTheDocument()
    expect(seVe('Stock de SIMs')).toBe(true)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(seVe('Aún no hay ventas')).toBe(false)
    expect(screen.getByPlaceholderText('Buscar por serial, categoría...')).toBeInTheDocument()
  })

  it('falla el resumen: las ventas siguen, sin 0 ni $0', async () => {
    red.caida = RESUMEN
    pintar(<SerializedSalesDemo />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(screen.getByText('SIM AT&T')).toBeInTheDocument()
    expect(seVe('Stock de SIMs')).toBe(false)
    expect(seVe('No hay categorías de productos configuradas')).toBe(false)
    expect(seVe('$0.00')).toBe(false)
  })

  it('las ventas en camino: la región espera, y lo que llegó se ve', async () => {
    red.colgada = VENTAS
    pintar(<SerializedSalesDemo />, { rutas })
    await screen.findByText('SIM Telcel')
    expect(seVe('Aún no hay ventas')).toBe(false)
  })

  it('el resumen en camino: el filtro sigue', async () => {
    red.colgada = RESUMEN
    pintar(<SerializedSalesDemo />, { rutas })
    await screen.findByText('SIM AT&T')
    expect(screen.getByRole('combobox')).toBeInTheDocument()
    expect(seVe('Stock de SIMs')).toBe(false)
  })

  it('las dos leídas y vacías: lo de hoy, sin aviso', async () => {
    pintar(<SerializedSalesDemo />, { rutas: [[RESUMEN, { data: { totals: { available: 0, sold: 0 }, categories: [] } }], [VENTAS, { data: { sales: [] } }]] })
    await screen.findByText('No hay categorías de productos configuradas')
    await sinConsultasEnCamino()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

// ─── F6: lo que antes estaba aceptado ───
describe.each([
  ['Paquete de créditos', () => <CreditPackFormModal open onClose={() => {}} packId="p1" onSuccess={() => {}} />, /credit-packs\/p1/],
  ['Servicio', () => <ServiceFormDialog open onOpenChange={() => {}} mode="edit" productId="svc1" />, /products\/svc1/],
  ['Liga de pago', () => <CreatePaymentLinkDialog open onClose={() => {}} editingLinkId="l1" />, /payment-links\/l1/],
  ['Campaña', () => <CampaignEditorModal venueId="v1" campaignId="c1" open onClose={() => {}} />, /campaigns\/c1/],
] as Array<[string, () => ReactElement, RegExp]>)('F6 · %s: el 404 de un registro que no existe', (_n, pantalla, lectura) => {
  it('dice que no existe, sin «Reintentar»', async () => {
    red.caida = lectura
    red.estatus = 404
    pintar(pantalla(), { rutas: [[/categories/, []]] })
    await screen.findByText(NO_EXISTE)
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })

  it('un 500 sigue siendo un fallo: aviso con «Reintentar»', async () => {
    red.caida = lectura
    pintar(pantalla(), { rutas: [[/categories/, []]] })
    await screen.findByText(SIN_DATOS)
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
  })
})

describe('F6 · los avisos viejos también dejan reintentar', () => {
  const casos: Array<[string, () => ReactElement, RegExp, string, Record<string, string>?]> = [
    ['Conteo de inventario', () => <StockCountDetailPage />, /stock-counts\/c1/, 'No se pudo cargar el conteo', { countId: 'c1' }],
    ['Transferencia', () => <TransferDetailPage />, /transfers\/t1/, 'No se pudo cargar la transferencia', { transferId: 't1' }],
    ['Canales e-commerce (superadmin)', () => <EcommerceMerchantsGlobal />, /ecommerce-merchants/, 'Error al cargar'],
    ['Salud del servidor', () => <ServerHealth />, /server-metrics|metrics/, 'Error al cargar métricas del servidor'],
    ['Tickets por área', () => <AreaTickets />, /area-ticket|overview/, 'No se pudo cargar la configuración'],
    ['Cola de incidencias', () => <IncidentsQueue venueId="v1" areas={[]} />, /external-incidents/, 'areaTickets.externalSettlements.loadError'],
    ['Cola de liquidaciones', () => <SettlementsQueue venueId="v1" areas={[]} />, /external-settlements/, 'areaTickets.externalSettlements.loadError'],
    ['Facturas sueltas', () => <StandaloneInvoicesSection venueId="v1" />, /invoices/, 'invoices.receipt.loadError'],
    ['Estadísticas de entregas', () => <DeliveryLivePanel venueId="v1" channels={[]} />, /delivery|channel-summary|summary/, 'live.statsError'],
    ['Promotores', () => <PromotersAudit />, /promoters/, 'No se pudieron cargar los promotores'],
  ]

  it.each(casos)('%s: su texto, con «Reintentar»', async (_n, pantalla, lectura, texto, params) => {
    red.caida = lectura
    pintar(pantalla(), { params })
    await waitFor(() => expect(seVe(texto)).toBe(true))
    expect(screen.getAllByRole('button', { name: /retry|Reintentar/ }).length).toBeGreaterThan(0)
  })

  it.each(casos)('%s: en un 403, sin botón', async (_n, pantalla, lectura, _texto, params) => {
    red.caida = lectura
    red.estatus = 403
    pintar(pantalla(), { params })
    await sinConsultasEnCamino()
    expect(screen.queryAllByRole('button', { name: /^(common:)?(retry|Reintentar)$/ })).toEqual([])
  })
})

describe('F6 · Integraciones: Pases sin leer', () => {
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
  const CONECTAR = 'edit.integrations.catalog.connect'
  const SIN_LEER = 'edit.integrations.catalog.status.loadError'
  const DISPONIBLE = 'edit.integrations.catalog.status.available'

  it('caídos: no dice «Conectar» ni «Disponible»', async () => {
    red.caida = /pass-integrations/
    pintar(<Integrations />, { rutas: RUTAS })
    await waitFor(() => expect(tarjeta('passes')).toContain(SIN_LEER))
    expect(tarjeta('passes')).not.toContain(CONECTAR)
    expect(tarjeta('passes')).not.toContain(DISPONIBLE)
  })

  it('leídos sin conexión: «Disponible» y «Conectar», como hoy', async () => {
    pintar(<Integrations />, { rutas: RUTAS })
    await waitFor(() => expect(tarjeta('passes')).toContain(DISPONIBLE))
    expect(tarjeta('passes')).toContain(CONECTAR)
  })

  it('Google en camino: ni «Disponible» ni «Conectar»', async () => {
    red.colgada = /integrations\/google\/status/
    pintar(<Integrations />, { rutas: RUTAS })
    await waitFor(() => expect(tarjeta('google')).not.toBe(''))
    expect(tarjeta('google')).not.toContain(DISPONIBLE)
    expect(tarjeta('google')).not.toContain(CONECTAR)
  })

  it('el negocio sin leer: su aviso, con «Reintentar»', async () => {
    red.caida = /venues\/v1$/
    pintar(<Integrations />, { rutas: RUTAS })
    await screen.findByText('edit.integrations.errorLoading')
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
  })
})

describe('F2 · Centro de Mando, gerencial y hermanas: sin leer no hay vacío', () => {
  it('Centro de Mando: anomalías y actividad en camino no dicen que no hay', async () => {
    red.colgada = /stores-analysis\/(anomalies|activity-feed)/
    pintar(<CommandCenter />)
    await unaVueltaAlLazo()
    expect(seVe('No hay actividad reciente')).toBe(false)
    expect(seVe('commandCenter.anomalies.noData')).toBe(false)
    expect(seVe('Sin anomalías')).toBe(false)
    esperando()
  })

  it('Ubicación en vivo: en camino no dice «sin terminales»', async () => {
    red.colgada = /terminals-locations/
    pintar(<LiveLocation />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(seVe('playtelecom:location.empty')).toBe(false)
    esperando()
  })

  it('Campañas (superadmin): en camino no dice «0»', async () => {
    red.colgada = /campaigns/
    pintar(<MarketingPage />)
    await unaVueltaAlLazo()
    expect(seVe('Total Campañas')).toBe(false)
    esperando()
  })

  it.each([
    ['en camino', 'colgada'],
    ['caída', 'caida'],
  ] as Array<[string, 'colgada' | 'caida']>)('Gerencial: con el rendimiento %s no dice «Sin metas»', async (_n, modo) => {
    red[modo] = /store-performance/
    pintar(<PlaytelecomManagers />)
    await unaVueltaAlLazo()
    await sinConsultasEnCamino().catch(() => undefined)
    expect(seVe('Sin metas configuradas')).toBe(false)
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
  })

  it('Gerencial: la asistencia en camino no dice «Sin asistencia»', async () => {
    red.colgada = /staff-attendance/
    pintar(<PlaytelecomManagers />)
    await unaVueltaAlLazo()
    expect(seVe('Sin asistencia registrada para este periodo')).toBe(false)
    esperando()
  })

  it('Gerencial: leído y vacío, lo de hoy', async () => {
    pintar(<PlaytelecomManagers />, { rutas: [[/store-performance/, { data: { stores: [] } }]] })
    await waitFor(() => expect(seVe('Sin metas configuradas')).toBe(true))
  })

  it('Supervisor: sin leer la asistencia, «—» en el ranking y no en blanco', async () => {
    red.caida = /staff-attendance/
    pintar(<SupervisorDashboard />)
    await screen.findByText('Ranking Promotores')
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS).length).toBeGreaterThan(0))
    const tarjeta = screen.getByText('Ranking Promotores').parentElement as HTMLElement
    expect(tarjeta.textContent).toContain('—')
  })

  it('Supervisor: sin leer las transacciones no dice «Sin transacciones»', async () => {
    red.caida = /activity-feed/
    pintar(<SupervisorDashboard />)
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS).length).toBeGreaterThan(0))
    expect(seVe('Sin transacciones en este periodo')).toBe(false)
  })

  it('Ventas de la organización: las estadísticas colgadas no se llevan el filtro', async () => {
    red.colgada = /organizations\/o1$|organizations\/o1\/stats/
    pintar(<SalesDetail />, { params: { orgId: 'o1' } })
    await waitFor(() => expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument())
  })

  it('Sugerencias: las superficies caídas no se quedan en esqueleto para siempre', async () => {
    red.caida = /upsell-surfaces/
    pintar(<Upsell />, { rutas: [[/upsell-rules/, { data: [] }], [/upsell\/performance|upsell-performance/, { data: { hasData: false } }]] })
    await screen.findByText(SIN_DATOS)
  })

  it('Sugerencias: las reglas caídas no dicen «Todavía no hay sugerencias activas»', async () => {
    red.caida = /upsell-rules/
    pintar(<Upsell />, { rutas: [[/upsell-surfaces/, { data: { checkout: true } }], [/upsell\/performance|upsell-performance/, { data: { hasData: false } }]] })
    await screen.findByText(SIN_DATOS)
    expect(seVe('Todavía no hay sugerencias activas')).toBe(false)
  })
})

describe('F4 · Saldo disponible: una fuente secundaria no se lleva el saldo', () => {
  const SALDO: Ruta[] = [
    [/available-balance\/by-card-type/, { data: [{ cardType: 'DEBIT', transactionCount: 7, totalSales: 10, fees: 1, netAmount: 9, settledAmount: 9, pendingAmount: 0, baseSales: 10, tips: 0, settlementDays: 1 }] }],
    [/available-balance\/timeline/, { data: [] }],
    [/available-balance\/settlement-calendar/, { data: [] }],
    [/available-balance\/settlement-week/, { data: { days: [] } }],
    [/available-balance/, { data: { totalSales: 0, totalFees: 0, availableNow: 0, pendingSettlement: 0, estimatedNextSettlement: { date: null, amount: 0 } } }],
    [/cash-closeouts\/expected/, { data: { needsCloseout: false, daysSinceLastCloseout: 0, hasCloseouts: false, expectedAmount: 0 } }],
  ]

  it('cae el desglose: el saldo sigue, con aviso y «Reintentar», sin conteos en 0', async () => {
    red.caida = /available-balance\/by-card-type/
    pintar(<AvailableBalance />, { rutas: SALDO })
    await screen.findByText(CON_DATOS)
    expect(screen.getByRole('button', { name: /tabs\.cards/ })).toBeDisabled()
    expect(screen.getByRole('button', { name: /tabs\.all/ }).textContent).toContain('—')
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
  })

  it('cae el resumen: el aviso de siempre', async () => {
    red.caida = /available-balance(\?|$)/
    pintar(<AvailableBalance />, { rutas: SALDO })
    await screen.findByText(SIN_DATOS)
  })

  it('todo leído: conteos y sin aviso', async () => {
    pintar(<AvailableBalance />, { rutas: SALDO })
    await waitFor(() => expect(screen.getByRole('button', { name: /tabs\.all/ }).textContent).toContain('7'))
    await sinConsultasEnCamino()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

// ─── F5: los casos que fallan por la razón correcta ───
describe('F5 · Tarjetas de regalo: pendientes de contabilizar', () => {
  const rutas: Ruta[] = [
    [/pending-accounting/, { data: { items: [], total: 0, notice: null } }],
    [/\/summary/, { data: { sold: { cards: 0, amount: 0 }, redeemed: { movements: 0, net: 0 }, cancelled: { cards: 0, amount: 0 }, liveBalance: { cards: 0, amount: 0 }, adjustments: { increments: 0, decrements: 0 } } }],
    [/\/aging/, { data: { buckets: [], total: { cards: 0, amount: 0 } } }],
  ]

  it('primera lectura sin internet: su error, y no «sin pendientes»', async () => {
    onlineManager.setOnline(false)
    pintar(<GiftCardReports venueId="v1" />, { rutas })
    await screen.findByText('reports.pending.error')
    expect(seVe('reports.pending.empty')).toBe(false)
  })

  it('leídos y vacíos, la recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<GiftCardReports venueId="v1" />, { rutas })
    await screen.findByText('reports.pending.empty')
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    void client.refetchQueries({ predicate: q => JSON.stringify(q.queryKey).includes('pending') })
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('reports.pending.empty')).toBeInTheDocument()
    expect(seVe('reports.pending.error')).toBe(false)
  })
})

describe('F5 · Canales de e-commerce', () => {
  const CANALES = /ecommerce-merchants/
  const rutas: Ruta[] = [[CANALES, { data: { merchants: [] } }]]

  it('primera lectura sin internet: aviso, y no «sin canales»', async () => {
    onlineManager.setOnline(false)
    pintar(<EcommerceMerchants />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(seVe('noChannels')).toBe(false)
  })

  it('leídos y vacíos, la recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<EcommerceMerchants />, { rutas })
    await screen.findByText('noChannels')
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    void client.refetchQueries({ predicate: q => JSON.stringify(q.queryKey).includes('ecommerce-merchants') })
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('noChannels')).toBeInTheDocument()
  })
})

describe('F1 · una lista leída y vacía no pierde su vacío al caer la recarga', () => {
  it('Sucursales de la organización', async () => {
    const SUCURSALES = /organizations\/o1\/venues/
    pintar(<OrganizationVenues />, { params: { orgId: 'o1' }, rutas: [[SUCURSALES, []]] })
    await screen.findByText('venues.noVenues')
    await recargaCaida(SUCURSALES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('venues.noVenues')).toBeInTheDocument()
  })
})

describe('F3 · hermanas de la organización y de la terminal: el filtro depende de la consulta', () => {
  it('Sucursales: el periodo y el buscador siguen mientras carga, sin «sin sucursales»', async () => {
    red.colgada = /organizations\/o1\/venues/
    pintar(<OrganizationVenues />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(screen.getByPlaceholderText('venues.searchPlaceholder')).toBeInTheDocument()
    expect(seVe('venues.noVenues')).toBe(false)
  })

  it('Bitácora de la organización: el buscador sigue mientras carga', async () => {
    red.colgada = /activity-log/
    pintar(<OrganizationActivityLog />, { params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, []]] })
    await unaVueltaAlLazo()
    expect(document.querySelector('input')).not.toBeNull()
    expect(seVe('activityLog.noResults')).toBe(false)
  })

  it('Terminales de la organización: las pestañas siguen mientras carga, sin 0 ni «sin terminales»', async () => {
    red.colgada = /terminals/
    pintar(<OrganizationTerminals />, { params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, []]] })
    await unaVueltaAlLazo()
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
    expect(seVe('terminals.stats.total')).toBe(false)
  })

  it('Terminales de la organización: caída, las pestañas siguen con su aviso', async () => {
    red.caida = /terminals/
    pintar(<OrganizationTerminals />, { params: { orgId: 'o1' }, rutas: [[/organizations\/o1\/venues/, []]] })
    await screen.findByText(SIN_DATOS)
    expect(screen.getAllByRole('tab').length).toBeGreaterThan(0)
    expect(seVe('terminals.stats.total')).toBe(false)
  })

  it('Mensajes de la terminal: los filtros siguen mientras carga', async () => {
    red.colgada = /messages/
    pintar(<TpvMessagesList venueId="v1" />)
    await unaVueltaAlLazo()
    expect(seVe('Estado')).toBe(true)
    expect(seVe('No hay mensajes')).toBe(false)
  })
})

describe('F6 · Detalle del aparato: la lectura principal', () => {
  const APARATO = /tpv\/t1$/

  it('sin internet: el aviso de siempre con «Reintentar», y no «sin datos del aparato»', async () => {
    onlineManager.setOnline(false)
    pintar(<TpvId />, { params: { tpvId: 't1' } })
    await screen.findByText('detail.errors.loadError')
    expect(seVe('detail.noData')).toBe(false)
    expect(screen.getByRole('button', { name: 'common:tryAgain' })).toBeInTheDocument()
  })

  it('un 404: «no encontrado», sin reintentar', async () => {
    red.caida = APARATO
    red.estatus = 404
    pintar(<TpvId />, { params: { tpvId: 't1' } })
    await screen.findByText('detail.notFound')
    expect(screen.queryByRole('button', { name: 'common:tryAgain' })).toBeNull()
  })
})

describe('F2 · Supervisor: la ubicación de las terminales', () => {
  const UBICACIONES = /terminals-locations|terminal-locations|locations/
  beforeEach(() => {
    window.location.hash = '#ubicacion'
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it('caída: aviso, y no «sin terminales»', async () => {
    red.caida = UBICACIONES
    pintar(<SupervisorDashboard />)
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS).length).toBeGreaterThan(0))
    expect(seVe('playtelecom:location.empty')).toBe(false)
  })

  it('leída y sin terminales: lo de hoy', async () => {
    pintar(<SupervisorDashboard />, { rutas: [[UBICACIONES, { data: { terminals: [], trackingEnabled: true } }]] })
    await waitFor(() => expect(seVe('playtelecom:location.empty')).toBe(true))
  })
})

describe('F1 · Análisis de tiendas: la lista de tiendas también avisa', () => {
  it('caída: su aviso, sin esconder lo demás', async () => {
    red.caida = /stores-analysis\/venues/
    red.colgada = /stores-analysis\/(store|charts)|\/store\/|revenue/
    pintar(<StoresAnalysis />)
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS).length).toBeGreaterThan(0))
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0)
  })
})

describe('F2 · Detalle del cliente: lealtad y créditos por su lado', () => {
  const cliente = { id: 'c1', firstName: 'Ana', lastName: 'Ruiz', email: 'ana@example.com', phone: null, loyaltyPoints: 0, totalSpent: 0, totalVisits: 0, orders: [], tags: [], customerGroup: null, active: true, createdAt: '2026-01-01T00:00:00Z' }
  const pestana = (nombre: string) => screen.getByRole('tab', { name: new RegExp(nombre) })

  it('sin leer la lealtad: «—» en la pestaña, y su aviso en lugar de «sin movimientos»', async () => {
    red.caida = /loyalty\/transactions|customers\/c1\/loyalty|loyalty/
    pintar(<CustomerDetail />, { params: { customerId: 'c1' }, rutas: [[/customers\/c1$/, cliente], [/credit-packs\/purchases/, { purchases: [] }]] })
    await screen.findByRole('tab', { name: /detail\.tabs\.loyalty/ })
    await waitFor(() => expect(pestana('detail\\.tabs\\.loyalty').textContent).toContain('—'))
    fireEvent.mouseDown(pestana('detail\\.tabs\\.loyalty'))
    await screen.findByText(SIN_DATOS)
    expect(seVe('detail.loyalty.emptyState')).toBe(false)
  })

  it('sin leer los créditos: igual', async () => {
    red.caida = /credit-packs\/purchases/
    pintar(<CustomerDetail />, { params: { customerId: 'c1' }, rutas: [[/customers\/c1$/, cliente]] })
    await screen.findByRole('tab', { name: /detail\.tabs\.credits/ })
    await waitFor(() => expect(pestana('detail\\.tabs\\.credits').textContent).toContain('—'))
    fireEvent.mouseDown(pestana('detail\\.tabs\\.credits'))
    await screen.findByText(SIN_DATOS)
    expect(seVe('detail.credits.emptyState')).toBe(false)
  })
})
