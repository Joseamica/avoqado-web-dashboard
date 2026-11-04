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
import { act, cleanup, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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
vi.mock('@/pages/Menu/MenuMakerLayout', () => ({ useMenuMakerHeader: () => ({ setHeader: () => {} }) }))
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
import { FeatureCatalogBrowser } from '@/components/billing/FeatureCatalogBrowser'
import { CheckboxFilterContent } from '@/components/filters/CheckboxFilterContent'
import { SingleSelectFilterContent } from '@/components/filters/SingleSelectFilterContent'
import { GlobalComplementariaDialog } from '@/pages/Cfdi/components/GlobalComplementariaDialog'
import { GlobalExcluidasDialog } from '@/pages/Cfdi/components/GlobalExcluidasDialog'
import TeamCommissionTable from '@/pages/Commissions/components/TeamCommissionTable'
import ProductOptions from '@/pages/Menu/ProductOptions/ProductOptions'
import CatalogAuditPage from '@/pages/Organization/MasterCatalog/CatalogAuditPage'
import CatalogItemsPage from '@/pages/Organization/MasterCatalog/CatalogItemsPage'
import { ExchangeDetailContent } from '@/pages/Payment/components/ExchangeLinksCard'
import PayLaterAging from '@/pages/Reports/PayLaterAging'
import { PagoDeClaseCard } from '@/pages/Reservations/components/PagoDeClaseCard'
import { TokenBudgetSection } from '@/pages/Settings/components/TokenBudgetSection'
import { PeriodoCerradoView } from '@/pages/StaffPay/components/PeriodoCerradoView'
import TeamCommissionSection from '@/pages/Team/components/TeamCommissionSection'
import PromotersAuditPage from '@/pages/playtelecom/PromotersAudit/PromotersAuditPage'
import { VenueSimCustodyPanel } from '@/pages/playtelecom/Stock/components/VenueSimCustodyPanel'
import DataTable from '@/components/data-table'
import MenuOverview from '@/pages/Menu/MenuOverview'
import OrganizationTeam from '@/pages/Organization/OrganizationTeam'
import ReviewSummary from '@/pages/Review/Reviews'
import { TablaDePagosTab } from '@/pages/StaffPay/components/TablaDePagosTab'
import OrgUsersPage from '@/pages/playtelecom/Organization/OrgUsersPage'
import UsersManagement from '@/pages/playtelecom/Users/UsersManagement'
import { TargetingSection } from '@/pages/Superadmin/TpvUpdates'
import Subscriptions from '@/pages/Settings/Billing/Subscriptions'
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
import AreaTickets, { Operations } from '@/pages/Settings/AreaTickets'
import AccountsPayable from '@/pages/Reports/AccountsPayable'
import { RoutingTab } from '@/pages/Settings/components/printStations/RoutingTab'
import OrganizationActivityLog from '@/pages/Organization/OrganizationActivityLog'
import OrganizationTerminals from '@/pages/Organization/OrganizationTerminals'
import OrganizationVenues from '@/pages/Organization/OrganizationVenues'
import { OrgTpvConfigSection } from '@/pages/Organization/OrganizationSettings'
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
    [/available-balance\/settlement-week/, { data: { weekStart: '2026-11-02', weekEnd: '2026-11-08', days: [], weekTotal: { gross: 0, fees: 0, net: 0, transactionCount: 0 } } }],
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

// ─── Codex r7: cargar o reintentar no se lleva los filtros, y una fuente caída no esconde a las demás ───
describe('r7 · la tabla compartida: sólo el cuerpo espera', () => {
  it('mientras carga siguen su barra de filtros y sus pestañas', async () => {
    pintar(<DataTable data={[]} columns={[{ accessorKey: 'a', header: 'A' }]} rowCount={0} isLoading query={null} tableTabLeft={<span>mi-filtro</span>} tableTab={<span>mi-pestana</span>} />)
    expect(screen.getByText('mi-filtro')).toBeInTheDocument()
    expect(screen.getByText('mi-pestana')).toBeInTheDocument()
    esperando()
    expect(seVe('no_results')).toBe(false)
  })

  const columnas = [{ accessorKey: 'a', header: 'A' }]
  const consulta = (data: unknown) => ({ data, isError: true, isFetching: false, isPaused: false, error: new Error('caída'), refetch: () => {} })

  it('leída y vacía, y cae la recarga: el vacío sigue, con el aviso de datos viejos', async () => {
    pintar(<DataTable data={[]} columns={columnas} rowCount={0} query={consulta([])} />)
    expect(screen.getByText(CON_DATOS)).toBeInTheDocument()
    expect(seVe('no_results')).toBe(true)
  })

  it('sin leer y caída: el aviso en lugar del vacío', async () => {
    pintar(<DataTable data={[]} columns={columnas} rowCount={0} query={consulta(undefined)} />)
    expect(screen.getByText(SIN_DATOS)).toBeInTheDocument()
    expect(seVe('no_results')).toBe(false)
  })

  it('sin consulta y sin filas: su vacío de siempre', async () => {
    pintar(<DataTable data={[]} columns={columnas} rowCount={0} query={null} />)
    expect(seVe('no_results')).toBe(true)
  })
})

describe.each([
  ['Equipo de la organización', () => <OrganizationTeam />, 'Sucursales'],
  ['Usuarios de la organización', () => <OrgUsersPage />, 'Estado'],
  ['Usuarios de la tienda', () => <UsersManagement />, 'Estado'],
])('r7 · %s', (_nombre, pantalla, filtro) => {
  const rutas: Ruta[] = [[/organizations\/o1\/venues/, []]]

  it('primera lectura en camino: los filtros siguen y la tabla espera', async () => {
    red.colgada = /team/
    pintar(pantalla(), { params: { orgId: 'o1' }, rutas })
    await unaVueltaAlLazo()
    expect(seVe(filtro)).toBe(true)
    esperando()
  })

  it('cae y se reintenta: los filtros siguen en el aviso y mientras reintenta', async () => {
    red.caida = /team/
    pintar(pantalla(), { params: { orgId: 'o1' }, rutas })
    await screen.findByText(SIN_DATOS)
    expect(seVe(filtro)).toBe(true)
    red.caida = null
    red.colgada = /team/
    fireEvent.click(await reintentar())
    await unaVueltaAlLazo()
    expect(seVe(filtro)).toBe(true)
    esperando()
  })
})

describe('r7 · Equipo de la organización: sin leer no hay «0 miembros»', () => {
  it('en camino y caído no dice cuántos son; leído, sí', async () => {
    red.colgada = /team/
    pintar(<OrganizationTeam />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(seVe('organization:team.subtitle')).toBe(false)
    cleanup()
    red.colgada = null
    red.caida = /team/
    pintar(<OrganizationTeam />, { params: { orgId: 'o1' } })
    await screen.findByText(SIN_DATOS)
    expect(seVe('organization:team.subtitle')).toBe(false)
    cleanup()
    red.caida = null
    pintar(<OrganizationTeam />, { params: { orgId: 'o1' }, rutas: [[/team/, []]] })
    await screen.findByText('organization:team.subtitle')
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

describe('r7 · Resumen del menú: cada fuente por su lado', () => {
  const MENUS = /venues\/v1\/menus/
  const rutas: Ruta[] = [[MENUS, [{ id: 'm1', name: 'Carta', active: true, categories: [] }]], [/venues\/v1\/products/, []]]
  const buscador = () => screen.getByPlaceholderText('overview.searchPlaceholder')

  it('menús en camino: el buscador sigue, sin conteo y esperando', async () => {
    red.colgada = MENUS
    pintar(<MenuOverview />, { rutas })
    await unaVueltaAlLazo()
    expect(buscador()).toBeInTheDocument()
    expect(seVe('overview.itemsCount')).toBe(false)
    esperando()
  })

  it('menús caídos: aviso con reintento, el buscador sigue y sin «0 elementos»', async () => {
    red.caida = MENUS
    pintar(<MenuOverview />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(buscador()).toBeInTheDocument()
    expect(seVe('overview.itemsCount')).toBe(false)
    red.caida = null
    red.colgada = MENUS
    fireEvent.click(await reintentar())
    await unaVueltaAlLazo()
    expect(buscador()).toBeInTheDocument()
    esperando()
  })

  it('recarga caída con menús leídos: los menús siguen, con su aviso', async () => {
    pintar(<MenuOverview />, { rutas })
    await screen.findAllByText('Carta')
    await recargaCaida(MENUS)
    await screen.findByText(CON_DATOS)
    expect(screen.getAllByText('Carta').length).toBeGreaterThan(0)
    expect(buscador()).toBeInTheDocument()
  })

  it('productos caídos: los menús que sí llegaron se ven', async () => {
    red.caida = /venues\/v1\/products/
    pintar(<MenuOverview />, { rutas })
    await screen.findAllByText('Carta')
    await sinConsultasEnCamino()
    expect(seVe('overview.errorLoading')).toBe(false)
  })

  it('sano: sin aviso', async () => {
    pintar(<MenuOverview />, { rutas })
    await screen.findAllByText('Carta')
    await sinConsultasEnCamino()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
    expect(screen.queryByText(CON_DATOS)).toBeNull()
  })
})

describe('r7 · Reseñas: los filtros siguen', () => {
  const RESENAS = /venues\/v1\/reviews/
  const RESENA = { id: 'r1', source: 'AVOQADO', overallRating: 5, customerName: 'Ana Cliente', comment: 'Muy bien', createdAt: new Date().toISOString(), responseText: null }
  const filtros = () => {
    expect(screen.getByTestId('filtro-fechas')).toBeInTheDocument()
    expect(screen.getByText('filters.title')).toBeInTheDocument()
  }
  const noAfirmaNada = () => {
    expect(seVe('emptyState.title')).toBe(false)
    expect(seVe('averageDescription')).toBe(false)
  }

  it('en camino: filtros, espera y sin «sin reseñas»', async () => {
    red.colgada = RESENAS
    pintar(<ReviewSummary />)
    await unaVueltaAlLazo()
    filtros()
    noAfirmaNada()
    esperando()
  })

  it('caídas: aviso con reintento, filtros, y sin «sin reseñas»', async () => {
    red.caida = RESENAS
    pintar(<ReviewSummary />)
    await screen.findByText(SIN_DATOS)
    filtros()
    noAfirmaNada()
    red.caida = null
    red.colgada = RESENAS
    fireEvent.click(await reintentar())
    await unaVueltaAlLazo()
    filtros()
    esperando()
  })

  it('recarga caída con reseñas: la reseña sigue, con su aviso y sus filtros', async () => {
    pintar(<ReviewSummary />, { rutas: [[RESENAS, { reviews: [RESENA] }]] })
    await screen.findByText('Ana Cliente')
    await recargaCaida(RESENAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Ana Cliente')).toBeInTheDocument()
    filtros()
  })

  it('leídas y vacías: «sin reseñas» sin aviso; si cae la recarga, sigue con aviso', async () => {
    pintar(<ReviewSummary />, { rutas: [[RESENAS, { reviews: [] }]] })
    await screen.findByText('emptyState.title')
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
    await recargaCaida(RESENAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('emptyState.title')).toBeInTheDocument()
  })
})

describe('r7 · Tabla de pagos: una fuente caída no se lleva a las demás', () => {
  const NIVELES = /\/levels/
  const ASIGNACIONES = /\/assignments/
  const TABLAS = /\/tables/
  const rutas: Ruta[] = [
    [NIVELES, [{ id: 'n1', name: 'Head Coach', archivedAt: null, sortOrder: 0 }]],
    [ASIGNACIONES, []],
    [TABLAS, [{ id: 't1', name: 'Tabla', productIds: [], vigente: { id: 'ver1', maxCount: 2, cells: [], reglas: null } }]],
    [/venues\/v1\/team/, { data: [{ id: 's1', staffId: 's1', firstName: 'Ana', lastName: 'Coach', active: true }], meta: { totalCount: 1 } }],
  ]

  it('sano: niveles, personas y cuadrícula, sin aviso', async () => {
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText('grid.publish')
    await sinConsultasEnCamino()
    expect(screen.getByText(/steps\.levels/)).toBeInTheDocument()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('asignaciones caídas: niveles y cuadrícula siguen; nadie sale «sin nivel»', async () => {
    red.caida = ASIGNACIONES
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText(SIN_DATOS)
    await screen.findByText('grid.publish')
    expect(screen.getAllByText('Head Coach').length).toBeGreaterThan(0)
    expect(seVe('Ana Coach')).toBe(false)
    expect(seVe('who.noLevel')).toBe(false)
  })

  it('tablas caídas: los niveles siguen; sin «crea tu tabla»', async () => {
    red.caida = TABLAS
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText(SIN_DATOS)
    await screen.findByText('Head Coach')
    expect(seVe('grid.empty')).toBe(false)
    expect(seVe('grid.create')).toBe(false)
  })

  it('niveles caídos: nada dice que no hay niveles', async () => {
    red.caida = NIVELES
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText(SIN_DATOS)
    await sinConsultasEnCamino()
    expect(seVe('levels.empty')).toBe(false)
    expect(seVe('who.needLevels')).toBe(false)
    expect(seVe('grid.needLevels')).toBe(false)
    expect(seVe('steps.levels')).toBe(false)
  })

  it('tablas leídas y vacías con niveles caídos: crear la tabla sigue a la mano', async () => {
    red.caida = NIVELES
    pintar(<TablaDePagosTab />, { rutas: [[TABLAS, []], ...rutas.filter(([r]) => r !== TABLAS)] })
    await screen.findByText('grid.empty')
    expect(screen.getByText(SIN_DATOS)).toBeInTheDocument()
  })

  it('tablas en camino: los niveles se ven y la cuadrícula espera', async () => {
    red.colgada = TABLAS
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText('Head Coach')
    esperando()
    expect(seVe('grid.empty')).toBe(false)
  })

  it('las tres caídas: UN solo aviso, y reintentar las trae todas', async () => {
    red.caida = /\/levels|\/assignments|\/tables/
    pintar(<TablaDePagosTab />, { rutas })
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS)).toHaveLength(1))
    await sinConsultasEnCamino()
    expect(screen.getAllByText(SIN_DATOS)).toHaveLength(1)
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('grid.publish')
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('recarga caída con datos: los niveles siguen, con su aviso', async () => {
    pintar(<TablaDePagosTab />, { rutas })
    await screen.findByText('grid.publish')
    await recargaCaida(NIVELES)
    await screen.findByText(CON_DATOS)
    expect(screen.getAllByText('Head Coach').length).toBeGreaterThan(0)
    expect(screen.getByText('grid.publish')).toBeInTheDocument()
  })
})

// ─── Los arreglos de la ronda r7 que quedaron sin prueba propia ───
describe('r7 · Promotores: los depósitos por su lado', () => {
  const DEPOSITOS = /promoters\/p1\/deposits/
  const rutas: Ruta[] = [
    [DEPOSITOS, { data: { deposits: [] } }],
    [/promoters\/p1/, { data: { promoter: { id: 'p1', name: 'Ana Promotora', email: null, phone: null, photo: null }, todayMetrics: { sales: 0, units: 0, commission: 0 }, attendance: { days: [] }, checkIn: null } }],
    [/promoters/, { data: { promoters: [{ id: 'p1', name: 'Ana Promotora', status: 'ACTIVE', todaySales: 0, todayUnits: 0, commission: 0, store: { name: 'Tienda' }, lastActivity: null, photo: null }], summary: { total: 1, active: 1, onBreak: 0, todayTotalSales: 0, todayTotalCommissions: 0 } } }],
  ]

  it('en camino: espera, sin «Sin depósitos»', async () => {
    red.colgada = DEPOSITOS
    pintar(<PromotersAudit />, { rutas })
    await screen.findAllByText('Ana Promotora')
    await unaVueltaAlLazo()
    expect(seVe('Sin depósitos')).toBe(false)
    expect(screen.getByTestId('depositos-esperando')).toBeInTheDocument()
  })

  it('caídos: aviso, sin «Sin depósitos» ni espera eterna', async () => {
    red.caida = DEPOSITOS
    pintar(<PromotersAudit />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(seVe('Sin depósitos')).toBe(false)
    expect(screen.queryByTestId('depositos-esperando')).toBeNull()
  })

  it('leídos y vacíos: «Sin depósitos», sin aviso', async () => {
    pintar(<PromotersAudit />, { rutas })
    await screen.findByText('Sin depósitos')
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

describe('r7 · 404 de conteos y transferencias: dice que no existe', () => {
  it.each([
    ['Conteo', () => <StockCountDetailPage />, /stock-counts\/c1/, 'Este conteo no existe', 'No se pudo cargar el conteo', { countId: 'c1' }],
    ['Transferencia', () => <TransferDetailPage />, /transfers\/t1/, 'Esta transferencia no existe', 'No se pudo cargar la transferencia', { transferId: 't1' }],
  ] as const)('%s', async (_n, pantalla, patron, noExiste, noCargo, params) => {
    red.caida = patron
    red.estatus = 404
    pintar(pantalla(), { params })
    await screen.findByText(new RegExp(noExiste))
    expect(seVe(noCargo)).toBe(false)
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })
})

describe('r7 · Ganancias: la pestaña de costos', () => {
  const abrirCostos = async () => {
    const pestana = await screen.findByRole('tab', { name: /Cost Structures/ })
    fireEvent.mouseDown(pestana)
    await screen.findByText('Current Cost Structures')
  }

  it('en camino: «—», no una región en blanco', async () => {
    red.colgada = /cost-structures\/analysis/
    pintar(<ProfitAnalyticsDashboard />)
    await abrirCostos()
    const region = screen.getByText('Current Cost Structures').closest('.rounded-lg, .rounded-xl, [class*="card"]')?.parentElement as HTMLElement
    expect(within(region).getAllByText('—').length).toBeGreaterThan(0)
  })
})

describe('r7 · Comisiones de e-commerce: el historial de un canal', () => {
  const HISTORIAL = /fee-history/
  const rutas: Ruta[] = [
    [HISTORIAL, { data: [] }],
    [/ecommerce-merchants/, { data: [{ id: 'm1', channelName: 'Tienda web', contactEmail: 'a@b.mx', active: true, provider: { name: 'Stripe' }, paymentCount: 0, totalCollected: 0, venue: { id: 'v1', name: 'Mi negocio' } }] }],
  ]

  it('recarga caída con historial leído: su aviso', async () => {
    pintar(<EcommerceMerchantsGlobal />, { rutas })
    fireEvent.click(await screen.findByTitle('Ver historial de cambios de comisión'))
    await sinConsultasEnCamino()
    await recargaCaida(HISTORIAL)
    await screen.findByText(CON_DATOS)
  })
})

describe('r7 · Versiones de la TPV: el selector de sucursales', () => {
  const SUCURSALES = /superadmin\/venues/
  const rutas: Ruta[] = [[SUCURSALES, { data: [{ id: 'v9', name: 'Sucursal Nueve', slug: 'nueve' }] }]]

  it('recarga caída con sucursales leídas: la lista sigue, con su aviso', async () => {
    pintar(<TargetingSection targetType="VENUES" onTargetTypeChange={() => {}} selectedVenueIds={[]} onToggleVenue={() => {}} />, { rutas })
    await screen.findByText('Sucursal Nueve')
    await recargaCaida(SUCURSALES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Sucursal Nueve')).toBeInTheDocument()
  })

  it('caída sin leer: su aviso, y no «sin sucursales»', async () => {
    red.caida = SUCURSALES
    pintar(<TargetingSection targetType="VENUES" onTargetTypeChange={() => {}} selectedVenueIds={[]} onToggleVenue={() => {}} />, { rutas })
    await screen.findByText(SIN_DATOS)
  })
})

describe('r7 · Planes: reintentar sí vuelve a leer', () => {
  it('el plan caído ofrece reintentar y al reintentar se va el error', async () => {
    red.caida = /\/plan|subscription/
    pintar(<Subscriptions />)
    await screen.findByText('plan.page.planError')
    red.caida = null
    fireEvent.click(await reintentar())
    await sinConsultasEnCamino()
    expect(seVe('plan.page.planError')).toBe(false)
  })
})

describe('r7 · Terminales de la organización: reintentar sí vuelve a leer', () => {
  it('la configuración caída ofrece reintentar y al reintentar se va el error', async () => {
    red.caida = /tpv-defaults|tpv-config|defaults/
    pintar(<OrgTpvConfigSection orgId="o1" />)
    await screen.findByText('settings.tpvLoadError')
    red.caida = null
    fireEvent.click(await reintentar())
    await sinConsultasEnCamino()
    expect(seVe('settings.tpvLoadError')).toBe(false)
  })
})

// ─── Codex r8 ───
describe('r8 · Filtros: lo que dicen de sus opciones depende de su lectura', () => {
  const opciones = [{ value: 'a', label: 'Azul' }]
  const fuente = (estado: object) => ({ isError: false, isFetching: false, isPaused: false, error: null, refetch: vi.fn(), ...estado })
  const caida = () => fuente({ isError: true, error: new Error('caída') })
  const casilla = { title: 'x', selectedValues: [], onApply: () => {} }
  const unaSola = { title: 'x', selectedValue: '', onSelect: () => {} }

  describe.each([
    ['Casillas', (o: object) => <CheckboxFilterContent {...casilla} options={[]} {...o} />],
    ['Una opción', (o: object) => <SingleSelectFilterContent {...unaSola} options={[]} {...o} />],
  ])('%s', (_n, filtro) => {
    it('sin saber de dónde salen: no afirma «Sin resultados»', async () => {
      pintar(filtro({}))
      expect(screen.getByText('loadFailure.noOptions')).toBeInTheDocument()
      expect(seVe('Sin resultados')).toBe(false)
    })

    it('el texto de la pantalla manda en un vacío de verdad', async () => {
      pintar(filtro({ emptyLabel: 'No hay áreas' }))
      expect(screen.getByText('No hay áreas')).toBeInTheDocument()
    })

    it('su lectura en camino: espera, sin decir nada', async () => {
      pintar(filtro({ fuente: fuente({ isFetching: true }) }))
      esperando()
      expect(seVe('loadFailure')).toBe(false)
    })

    it('su lectura apagada (permiso o plan): sin espera eterna', async () => {
      pintar(filtro({ fuente: fuente({}) }))
      expect(document.querySelector('.animate-pulse')).toBeNull()
      expect(screen.getByText('loadFailure.noOptions')).toBeInTheDocument()
    })

    it('su lectura caída: avisa, y reintentar vuelve a pedir', async () => {
      const f = caida()
      pintar(filtro({ fuente: f }))
      expect(screen.getByText(SIN_DATOS)).toBeInTheDocument()
      fireEvent.click(await reintentar())
      expect(f.refetch).toHaveBeenCalledOnce()
    })

    it('caída con opciones anteriores: las opciones siguen, con su aviso', async () => {
      const f = { ...caida(), data: opciones }
      pintar(filtro({ fuente: f, options: opciones }))
      expect(screen.getByText(CON_DATOS)).toBeInTheDocument()
      expect(screen.getByText('Azul')).toBeInTheDocument()
      fireEvent.click(await reintentar())
      expect(f.refetch).toHaveBeenCalledOnce()
    })

    it.each([
      ['caída', { isError: true, error: new Error('caída') }],
      ['en pausa', { isPaused: true }],
    ])('leída y vacía, y su recarga %s: el vacío sigue, con el aviso de datos viejos', async (_e, estado) => {
      pintar(filtro({ fuente: fuente({ data: [], ...estado }), emptyLabel: 'No hay áreas' }))
      expect(screen.getByText(CON_DATOS)).toBeInTheDocument()
      expect(screen.getByText('No hay áreas')).toBeInTheDocument()
      expect(seVe(SIN_DATOS)).toBe(false)
    })

    it('un 403 no ofrece reintentar', async () => {
      pintar(filtro({ fuente: fuente({ isError: true, error: { response: { status: 403 } } }) }))
      expect(screen.getByText('loadFailure.forbidden')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
    })
  })

  it('con opciones, una búsqueda sin coincidencias sigue diciendo «Sin resultados»', async () => {
    pintar(<CheckboxFilterContent {...casilla} searchable options={opciones} />)
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('Sin resultados')).toBeInTheDocument()
  })
})

describe('r8 · Reseñas: el conteo del filtro sólo con lo leído', () => {
  const RESENAS = /venues\/v1\/reviews/
  const RESENA = { id: 'r1', source: 'AVOQADO', overallRating: 5, customerName: 'Ana Cliente', comment: 'Muy bien', createdAt: new Date().toISOString(), responseText: null }
  const buscar = (texto: string) => fireEvent.change(screen.getAllByRole('textbox')[0], { target: { value: texto } })

  it('con un filtro puesto y sin leer: nada de «0 / 0»', async () => {
    red.colgada = RESENAS
    pintar(<ReviewSummary />)
    await unaVueltaAlLazo()
    buscar('muy')
    expect(seVe('0 / 0')).toBe(false)
  })

  it('leídas: el conteo sí sale', async () => {
    pintar(<ReviewSummary />, { rutas: [[RESENAS, { reviews: [RESENA] }]] })
    await screen.findByText('Ana Cliente')
    buscar('muy')
    await screen.findByText('1 / 1')
  })
})

describe('r8 · Facturas del proveedor: el paginador sin leer no dice total', () => {
  it('en camino', async () => {
    red.colgada = /invoices/
    pintar(<StandaloneInvoicesSection venueId="v1" />)
    await unaVueltaAlLazo()
    expect(seVe('invoices.receipt.page')).toBe(false)
  })
})

describe('r8 · Auditoría de promotores: los filtros siguen', () => {
  const LISTA = /staff\/attendance/

  it('en camino y al reintentar', async () => {
    red.colgada = LISTA
    pintar(<PromotersAuditPage />)
    await unaVueltaAlLazo()
    expect(seVe('Tienda')).toBe(true)
    esperando()
    cleanup()
    red.colgada = null
    red.caida = LISTA
    pintar(<PromotersAuditPage />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('Tienda')).toBe(true)
    red.caida = null
    red.colgada = LISTA
    fireEvent.click(await reintentar())
    await unaVueltaAlLazo()
    expect(seVe('Tienda')).toBe(true)
    esperando()
  })
})

describe('r8 · Custodia de SIMs', () => {
  const panel = () => <VenueSimCustodyPanel orgId="o1" venueId="v1" timeZone="America/Mexico_City" />
  const CUSTODIA = /organizations\/o1/

  it('en camino: el buscador sigue', async () => {
    red.colgada = CUSTODIA
    pintar(panel())
    await unaVueltaAlLazo()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    esperando()
  })

  it('caída: el aviso deja reintentar', async () => {
    red.caida = CUSTODIA
    pintar(panel())
    await screen.findByText(/No pudimos cargar tus SIMs/)
    expect(await reintentar()).toBeInTheDocument()
  })
})

describe('r8 · Comisiones: lo que decide es haber leído, no estar en cero', () => {
  const RESUMENES = /\/summaries/

  it('Equipo: leída y vacía, y cae la recarga: el vacío sigue, con aviso', async () => {
    pintar(<TeamCommissionTable />, { rutas: [[RESUMENES, { data: [], meta: { total: 0 } }]] })
    await screen.findByText('summary.noSummaries')
    await recargaCaida(RESUMENES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('summary.noSummaries')).toBeInTheDocument()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })

  it('Una persona: leída y en cero, y cae la recarga: los importes siguen, con aviso', async () => {
    const PERSONA = /staff\/s1\/commissions/
    pintar(<TeamCommissionSection staffId="s1" />, { rutas: [[PERSONA, { data: { calculations: [], summaries: [], stats: {}, tierProgress: null } }]] })
    await screen.findByText('staff.commissions')
    await recargaCaida(PERSONA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('staff.commissions')).toBeInTheDocument()
    expect(screen.queryByText(SIN_DATOS)).toBeNull()
  })
})

describe('r8 · Cuentas por cobrar', () => {
  const CARTERA = /pay-later-aging/
  const VACIA = { data: { summary: { total_count: 0, total_balance: 0 }, orders: { aging_0_30: [], aging_31_60: [], aging_61_90: [], aging_90_plus: [] } } }

  it('sin leer: «—», no $0 ni «sin cuentas», y el buscador sigue', async () => {
    red.caida = CARTERA
    pintar(<PayLaterAging />)
    await screen.findByText(SIN_DATOS)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(seVe('$0')).toBe(false)
    expect(seVe('payLaterAging.empty.title')).toBe(false)
    expect(screen.getByPlaceholderText('payLaterAging.searchPlaceholder')).toBeInTheDocument()
  })

  it('en camino: espera, sin $0 ni «sin cuentas»', async () => {
    red.colgada = CARTERA
    pintar(<PayLaterAging />)
    await unaVueltaAlLazo()
    esperando()
    expect(seVe('$0')).toBe(false)
    expect(seVe('payLaterAging.empty.title')).toBe(false)
  })

  it('leída y en cero, y cae la recarga: el vacío sigue, con aviso', async () => {
    pintar(<PayLaterAging />, { rutas: [[CARTERA, VACIA]] })
    await screen.findByText('payLaterAging.empty.title')
    await recargaCaida(CARTERA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('payLaterAging.empty.title')).toBeInTheDocument()
  })
})

describe('r8 · Biblioteca de opciones', () => {
  const BIBLIOTECA = /option/
  const VACIA = { items: [], total: 0, page: 1, pageSize: 50, totalPages: 0, data: [], meta: { total: 0 } }

  it('sin internet y sin leer: su error, no «sin opciones»', async () => {
    onlineManager.setOnline(false)
    pintar(<ProductOptions />)
    await screen.findByText('biblioteca.error')
    expect(seVe('biblioteca.vacia')).toBe(false)
  })

  it('leída y vacía, y cae la recarga: el vacío sigue, con aviso', async () => {
    pintar(<ProductOptions />, { rutas: [[BIBLIOTECA, { data: VACIA, ...VACIA }]] })
    await screen.findByText('biblioteca.vacia')
    await recargaCaida(BIBLIOTECA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('biblioteca.vacia')).toBeInTheDocument()
  })
})

describe('r8 · Catálogo maestro', () => {
  const ARTICULOS = /items/
  const ESTADO = () => document.querySelector('#catalog-status')
  const VACIO = 'No hay artículos con este estado.'

  it('Artículos en camino: el filtro de estado sigue, sin «no hay artículos»', async () => {
    red.colgada = ARTICULOS
    pintar(<CatalogItemsPage />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(ESTADO()).not.toBeNull()
    expect(seVe(VACIO)).toBe(false)
    esperando()
  })

  it('Artículos caídos: aviso con reintento, y el filtro sigue', async () => {
    red.caida = ARTICULOS
    pintar(<CatalogItemsPage />, { params: { orgId: 'o1' } })
    await screen.findByText('No se pudieron cargar los artículos.')
    expect(ESTADO()).not.toBeNull()
    expect(await reintentar()).toBeInTheDocument()
  })

  it('Artículos sin internet: no se queda en espera eterna', async () => {
    onlineManager.setOnline(false)
    pintar(<CatalogItemsPage />, { params: { orgId: 'o1' } })
    await screen.findByText('No se pudieron cargar los artículos.')
    expect(ESTADO()).not.toBeNull()
  })

  it('Artículos leídos y vacíos, y cae la recarga: el vacío sigue, con aviso', async () => {
    pintar(<CatalogItemsPage />, { params: { orgId: 'o1' }, rutas: [[ARTICULOS, { success: true, data: { items: [], nextCursor: null } }]] })
    await screen.findByText(VACIO)
    await recargaCaida(ARTICULOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText(VACIO)).toBeInTheDocument()
  })

  const BITACORA = /audit(?!\/actions)/
  const SIN_EVENTOS = 'No hay eventos para estos filtros.'

  it('Bitácora en camino: los filtros siguen, sin «sin eventos» ni «página 1 de 1»', async () => {
    red.colgada = BITACORA
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' } })
    await unaVueltaAlLazo()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
    expect(seVe(SIN_EVENTOS)).toBe(false)
    expect(seVe(/Página \d+ de/)).toBe(false)
    esperando()
  })

  it('Bitácora caída: se dice y al reintentar llega', async () => {
    red.caida = BITACORA
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' }, rutas: [[BITACORA, { success: true, data: { logs: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } } }]] })
    await screen.findByText('No se pudo cargar la bitácora.')
    expect(seVe(SIN_EVENTOS)).toBe(false)
    red.caida = null
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await screen.findByText(SIN_EVENTOS)
    expect(screen.queryByText('No se pudo cargar la bitácora.')).toBeNull()
  })
})

describe('r8 · Avisos que ahora dejan reintentar', () => {
  it('Presupuesto de tokens: caído, deja reintentar', async () => {
    const TOKENS = /tokens\/status/
    const PRESUPUESTO = { freeTokensRemaining: 100, extraTokensBalance: 0, totalAvailable: 100, percentageUsed: 0, isInOverage: false, overageTokensUsed: 0, overageCost: 0, autoRechargeEnabled: false, autoRechargeThreshold: 0, autoRechargeAmount: 0, totalTokensPurchased: 0, totalTokensUsed: 0, totalAmountSpent: 0, totalTokensAvailable: 100, freeTokensUsed: 0, monthlyFreeTokens: 100, pricing: { pricePerThousandTokens: 1, freeTokensPerMonth: 100 } }
    red.caida = TOKENS
    pintar(<TokenBudgetSection venueId="v1" />, { rutas: [[TOKENS, { data: PRESUPUESTO, ...PRESUPUESTO }]] })
    await screen.findByText('tokenBudget.loadError')
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('tokenBudget.subtitle')
    expect(seVe('tokenBudget.loadError')).toBe(false)
    await recargaCaida(TOKENS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('tokenBudget.subtitle')).toBeInTheDocument()
  })

  it('Pago de la clase: caído o sin internet, avisa y deja reintentar', async () => {
    const rutas: Ruta[] = [[/staff-pay\/access|staff-pay$/, { enabled: true, activado: true }]]
    red.caida = /class/
    pintar(<PagoDeClaseCard sessionId="c1" />, { rutas })
    await screen.findByText('classCard.loadError')
    red.caida = null
    fireEvent.click(await reintentar())
    await sinConsultasEnCamino()
    expect(seVe('classCard.loadError')).toBe(false)
    // Sin internet la lectura se pausa: sin este aviso, la tarjeta desaparecía sin decir nada.
    onlineManager.setOnline(false)
    void client.resetQueries({ predicate: q => JSON.stringify(q.queryKey).includes('c1') })
    await screen.findByText('classCard.loadError')
  })

  it('Ventas excluidas de la global: sin internet, avisa y deja reintentar; no se queda «cargando»', async () => {
    onlineManager.setOnline(false)
    pintar(<GlobalExcluidasDialog emisorId="e1" principalId="g1" open onOpenChange={() => {}} />)
    await screen.findByText('globalInvoice.excluded.loadError')
    expect(seVe('globalInvoice.excluded.loading')).toBe(false)
    expect(await reintentar()).toBeInTheDocument()
  })

  it('Complementaria: sin internet, avisa y deja reintentar', async () => {
    onlineManager.setOnline(false)
    pintar(<GlobalComplementariaDialog emisorId="e1" principalId="g1" onOpenChange={() => {}} />)
    await screen.findByText('globalInvoice.complementaryDialog.loadError')
    expect(await reintentar()).toBeInTheDocument()
  })
})

describe('r8 · Lo que el error reemplazaba', () => {
  it('Detalle del Cambio: un 404 dice que no existe, sin reintentar', async () => {
    red.caida = /exchanges\/x1/
    red.estatus = 404
    pintar(<ExchangeDetailContent exchangeId="x1" />)
    await screen.findByText(NO_EXISTE)
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })

  it('Detalle del Cambio: sin internet avisa, no se queda «cargando»', async () => {
    onlineManager.setOnline(false)
    pintar(<ExchangeDetailContent exchangeId="x1" />)
    await screen.findByText('exchange.loadError')
    expect(seVe('exchange.loading')).toBe(false)
  })

  it('Catálogo de funciones: sin internet avisa; leído, la recarga caída no lo borra', async () => {
    const abrir = async () => fireEvent.click(await screen.findByRole('button', { name: /catalog\.title/ }))
    onlineManager.setOnline(false)
    pintar(<FeatureCatalogBrowser />)
    await abrir()
    await screen.findByText('catalog.error')
    expect(seVe('catalog.loading')).toBe(false)
    cleanup()
    onlineManager.setOnline(true)
    const CATALOGO = /catalog/
    pintar(<FeatureCatalogBrowser />, { rutas: [[CATALOGO, { data: { items: [], total: 0, page: 1, pageSize: 24, totalPages: 0 } }]] })
    await abrir()
    await screen.findByText('catalog.total')
    await recargaCaida(CATALOGO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('catalog.total')).toBeInTheDocument()
  })

  it('Periodo cerrado: sin internet avisa y deja reintentar, sin espera eterna', async () => {
    onlineManager.setOnline(false)
    pintar(<PeriodoCerradoView periodId="p1" fecha="2026-09-01" etiqueta="septiembre" etiquetaAbierto="octubre" />)
    await screen.findByText('period.error')
    expect(screen.getByRole('button', { name: 'period.retry' })).toBeInTheDocument()
  })
})

describe('r9 · Un 403 no ofrece reintentar', () => {
  beforeEach(() => {
    red.estatus = 403
  })

  it('Bitácora del catálogo', async () => {
    red.caida = /audit/
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' } })
    await screen.findByText('No se pudo cargar la bitácora.')
    expect(screen.queryByRole('button', { name: 'Reintentar' })).toBeNull()
  })

  it('Detalle del Cambio', async () => {
    red.caida = /exchanges\/x1/
    pintar(<ExchangeDetailContent exchangeId="x1" />)
    await screen.findByText('loadFailure.forbidden')
    expect(seVe('exchange.retry')).toBe(false)
  })

  it('Periodo cerrado', async () => {
    red.caida = /report/
    pintar(<PeriodoCerradoView periodId="p1" fecha="2026-09-01" etiqueta="septiembre" etiquetaAbierto="octubre" />)
    await screen.findByRole('alert')
    expect(screen.queryByRole('button', { name: 'period.retry' })).toBeNull()
  })

  it('Biblioteca de opciones', async () => {
    red.caida = /option/
    pintar(<ProductOptions />)
    await screen.findByText('biblioteca.error')
    expect(seVe('biblioteca.reintentar')).toBe(false)
  })

  it('Catálogo de funciones', async () => {
    red.caida = /catalog/
    pintar(<FeatureCatalogBrowser />)
    fireEvent.click(await screen.findByRole('button', { name: /catalog\.title/ }))
    await screen.findByText('catalog.error')
    expect(seVe('catalog.retry')).toBe(false)
  })
})

describe('r10 · Usuarios de la tienda: las tiendas salen de las zonas', () => {
  const ZONAS = /stores-analysis\/zones/
  const abrirTiendas = () => fireEvent.click(screen.getByRole('button', { name: /Tiendas/ }))

  const rutas: Ruta[] = [
    [/stores-analysis\/team/, { data: [], team: [], meta: { scope: 'venue', canViewAllOrgStaff: false } }],
    [ZONAS, { data: [{ id: 'z1', name: 'Norte', venues: [{ id: 'v9', name: 'Tienda Nueve' }] }] }],
  ]

  it('zonas caídas: al reintentar llegan las tiendas, y el aviso se va', async () => {
    red.caida = ZONAS
    pintar(<UsersManagement />, { rutas })
    await sinConsultasEnCamino()
    abrirTiendas()
    await screen.findByText(SIN_DATOS)
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('Tienda Nueve')
    expect(seVe(SIN_DATOS)).toBe(false)
  })

  it('zonas caídas: mientras reintenta sigue mirando las zonas: espera, sin afirmar nada', async () => {
    red.caida = ZONAS
    pintar(<UsersManagement />, { rutas })
    await sinConsultasEnCamino()
    abrirTiendas()
    await screen.findByText(SIN_DATOS)
    red.caida = null
    red.colgada = ZONAS
    fireEvent.click(await reintentar())
    await unaVueltaAlLazo()
    expect(seVe('loadFailure.noOptions')).toBe(false)
    expect(seVe(SIN_DATOS)).toBe(false)
    esperando()
  })
})

describe('r10 · Reintentar no arregla un 403', () => {
  it('Reportes contables: con 403 no se ofrece, con 500 sí', async () => {
    const pagar = /payable/
    red.caida = pagar
    pintar(<AccountsPayable />)
    await screen.findByRole('button', { name: /accountingError\.retry/ })
    cleanup()
    red.estatus = 403
    pintar(<AccountsPayable />)
    await screen.findByText('accountingError.body')
    await sinConsultasEnCamino()
    expect(screen.queryByRole('button', { name: /accountingError\.retry/ })).toBeNull()
  })

  it('Detalle del aparato: con 403 no se ofrece', async () => {
    red.caida = /tpv\/t1$/
    red.estatus = 403
    pintar(<TpvId />, { params: { tpvId: 't1' } })
    await screen.findByText('detail.errors.loadError')
    expect(screen.queryByRole('button', { name: 'common:tryAgain' })).toBeNull()
  })
})

describe('r10 · Bitácora del catálogo: las acciones del filtro', () => {
  const ACCIONES = /audit\/actions/
  const LEIDA = { success: true, data: { logs: [], pagination: { page: 1, pageSize: 25, total: 0, totalPages: 1 } } }
  const rutas: Ruta[] = [[ACCIONES, { success: true, data: ['CATALOG_ITEM_CREATED'] }], [/audit/, LEIDA]]

  it('caídas: lo dice, y al reintentar llegan al filtro', async () => {
    red.caida = ACCIONES
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' }, rutas })
    await screen.findByText('No se pudieron cargar las acciones del filtro.')
    red.caida = null
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await waitFor(() => expect(seVe('item created')).toBe(true))
    expect(seVe('No se pudieron cargar las acciones del filtro.')).toBe(false)
    expect(document.querySelector('.animate-pulse')).toBeNull()
  })

  it('en camino, aunque las filas ya llegaron: el filtro dice que espera', async () => {
    red.colgada = ACCIONES
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' }, rutas })
    await screen.findByText('No hay eventos para estos filtros.')
    esperando()
  })

  it('caídas y reintentando: el filtro dice que espera', async () => {
    red.caida = ACCIONES
    pintar(<CatalogAuditPage />, { params: { orgId: 'o1' }, rutas })
    await screen.findByText('No se pudieron cargar las acciones del filtro.')
    expect(document.querySelector('.animate-pulse')).toBeNull()
    red.caida = null
    red.colgada = ACCIONES
    fireEvent.click(screen.getByRole('button', { name: 'Reintentar' }))
    await unaVueltaAlLazo()
    esperando()
  })
})

describe('r10 · Vales por área', () => {
  it('Configuración: si cae su recarga, los ajustes siguen, con el aviso', async () => {
    const VISTA = /area-tickets?(\/overview)?$/
    pintar(<AreaTickets />, {
      rutas: [
        [
          VISTA,
          {
            data: {
              entitlements: { areaTickets: true, scaleIntegration: true },
              effective: { areaTickets: true, scales: false, variableWeight: false },
              settings: {},
              scaleSettings: {},
              areas: [],
              terminals: [],
              scaleProfiles: [],
              operations: { tickets: {}, checkouts: {}, paymentReconciliationCount: 0 },
            },
          },
        ],
      ],
    })
    await screen.findByText('Vales activos')
    await recargaCaida(VISTA)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Vales activos')).toBeInTheDocument()
  })

  it('Vales por entregar: la primera lectura espera, no deja la tabla en blanco', async () => {
    red.colgada = /operations/
    pintar(<Operations venueId="v1" counters={{ tickets: {}, checkouts: {}, paymentReconciliationCount: 0 } as never} />)
    await unaVueltaAlLazo()
    esperando()
    expect(screen.queryByRole('table')).toBeNull()
  })
})
