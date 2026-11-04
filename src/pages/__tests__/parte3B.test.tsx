/**
 * Parte 3B: pantallas que afirmaban cosas sin haber leído sus datos.
 *  - primera lectura en camino, sin datos: esqueleto o «—», nunca 0 ni «Sin…»;
 *  - falló o en pausa, sin datos: el aviso en lugar del número o del vacío, con reintento (salvo 403 y 404);
 *  - reintentando, sin datos: esqueleto en esa región;
 *  - falló o en pausa, CON datos previos (aunque sean [] o 0): los datos siguen, con el aviso de ESA consulta;
 *  - `enabled:false` por permiso: no afirma nada y sin esqueleto eterno.
 *
 * La pantalla y TanStack son de verdad: sólo se finge la red (`@/api`) y quién mira. Arnés copiado de hastaCeroFalloDeCarga.test.tsx.
 */
import { onlineManager, QueryClient, QueryClientProvider, useInfiniteQuery } from '@tanstack/react-query'
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
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
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

import { HybridBillingPanel } from '@/components/billing/HybridBillingPanel'
import { HybridCheckout } from '@/components/billing/HybridCheckout'
import { OvertimeApprovalDialog } from '@/pages/Attendance/OvertimeApprovalDialog'
import AvailableBalance from '@/pages/AvailableBalance/AvailableBalance'
import { SettlementReportDialog } from '@/pages/AvailableBalance/SettlementReportDialog'
import CfdiConfiguracion from '@/pages/Cfdi/CfdiConfiguracion'
import { PickOrderToInvoiceDialog } from '@/pages/Cfdi/components/PickOrderToInvoiceDialog'
import GoogleCalendarPicker from '@/pages/GoogleCalendar/Picker'
import { InvoiceLineEditor } from '@/pages/Inventory/PurchaseOrders/components/InvoiceLineEditor'
import { GroupParentForm } from '@/pages/Menu/Products/components/GroupParentForm'
import { CardRefundButton } from '@/pages/OnlineOrdering/components/CardRefundSheet'
import { MenuTab } from '@/pages/OnlineOrdering/components/MenuTab'
import { SettingsTab } from '@/pages/OnlineOrdering/components/SettingsTab'
import ReceiptViewer from '@/pages/Payment/ReceiptViewer'
import { PaymentLinkCustomerSection } from '@/pages/PaymentLinks/PaymentLinkCustomerSection'
import { PaymentLinkDetailSheet } from '@/pages/PaymentLinks/PaymentLinkDetailSheet'
import { PaymentLinkDiscountSection } from '@/pages/PaymentLinks/PaymentLinkDiscountSection'
import { StationsTab } from '@/pages/Settings/components/printStations/StationsTab'
import { ShopifyIssueList } from '@/pages/Settings/components/shopify/ShopifyIssueList'
import { ListaPaginada } from '@/pages/Settings/components/shopify/ShopifyListStates'
import VenueActivityLog from '@/pages/Venue/VenueActivityLog'
import { TpvConfiguration } from '@/pages/playtelecom/TpvConfig/TpvConfiguration'

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
const sinReintentar = () => expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
/** Que «no dice nada» no pase por una pantalla en blanco: la región está esperando. */
const esperando = () => expect(document.querySelector('.animate-pulse, .animate-spin')).not.toBeNull()

let client: QueryClient
function pintar(pantalla: ReactElement, opciones: { rutas?: Ruta[]; params?: Record<string, string>; entrada?: string } = {}) {
  red.rutas = opciones.rutas ?? []
  red.params = opciones.params ?? {}
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[opciones.entrada ?? '/']}>{pantalla}</MemoryRouter>
    </QueryClientProvider>,
  )
}
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
async function recargaCaida(patron: RegExp) {
  await sinConsultasEnCamino()
  red.caida = patron
  await act(() => client.refetchQueries().catch(() => undefined))
}
async function recargaEnPausa() {
  await sinConsultasEnCamino()
  onlineManager.setOnline(false)
  void client.refetchQueries()
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

// ─── ALTA ───
describe('Devolver a la tarjeta (pedidos en línea)', () => {
  const ORDEN = { orderId: 'o1', orderNumber: '7', paymentMode: 'CARD_ONLINE', card: { status: 'CAPTURED', capturedAmount: 100 } }
  const abrir = () => {
    pintar(<CardRefundButton venueId="v1" order={ORDEN as never} />)
    fireEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
  }

  it('sin internet y sin leer: no dice «sin devoluciones»', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('cardRefund.loadFailed')
    expect(seVe('cardRefund.empty')).toBe(false)
    expect(screen.getByRole('button', { name: 'cardRefund.reload' })).toBeInTheDocument()
  })

  it('historial leído y la relectura en pausa: lo leído sigue, con su aviso, y no se manda', async () => {
    abrir()
    await screen.findByText('cardRefund.empty')
    fireEvent.click(screen.getByRole('button', { name: 'refund.reasons.OTHER' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeEnabled())
    await recargaEnPausa()
    await screen.findByText('cardRefund.loadFailed')
    expect(seVe('cardRefund.empty')).toBe(true)
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
  })
})

describe('Detalle de una liga de pago', () => {
  const LIGA = { id: 'l1', title: 'Liga', currency: 'MXN', status: 'ACTIVE', amountType: 'FIXED', amount: 100, totalCollected: 10, paymentCount: 1, lastPaidAt: null, shortCode: 'abc' }
  const CON_PAGO: Ruta[] = [[/payment-links\/l1/, { success: true, data: { completedPayments: [{ id: 'p1', amount: 10, paymentId: 'pay1', completedAt: '2026-10-05T18:00:00.000Z' }], completedPaymentsTotal: 1 } }]]
  const hoja = () => <PaymentLinkDetailSheet link={LIGA as never} open onOpenChange={() => {}} onEdit={() => {}} onCopy={() => {}} />

  it('sin internet y sin leer: no dice «sin pagos» y deja reintentar', async () => {
    onlineManager.setOnline(false)
    pintar(hoja(), { rutas: CON_PAGO })
    await screen.findByText('detail.loadError')
    expect(seVe('detail.noPayments')).toBe(false)
    await reintentar()
  })

  it('recarga caída con pagos leídos: los pagos siguen, con aviso', async () => {
    pintar(hoja(), { rutas: CON_PAGO })
    await screen.findByText('detail.viewReceipt')
    await recargaCaida(/payment-links\/l1/)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('detail.viewReceipt')).toBeInTheDocument()
    expect(seVe('detail.loadError')).toBe(false)
  })

  it('una liga que ya no existe: «no existe», sin reintentar', async () => {
    red.caida = /payment-links\/l1/
    red.estatus = 404
    pintar(hoja())
    await screen.findByText(NO_EXISTE)
    sinReintentar()
  })
})

describe('Menú en línea', () => {
  const CATEGORIAS = /menu\/categories/
  const PRODUCTOS = /menu\/products/
  const rutas: Ruta[] = [
    [CATEGORIAS, { data: { totals: { online: 1, total: 2, onlineWithoutPhoto: 0 }, categories: [{ id: 'c1', name: 'Tacos', online: 1, total: 2, active: true }], truncated: false } }],
    [PRODUCTOS, { data: { items: [{ id: 'p1', name: 'Pastor', price: 30, active: true, availableOnline: true, imageUrl: null }], total: 1, nextCursor: null } }],
  ]
  const abrirTacos = async () => fireEvent.click(await screen.findByText('Tacos'))

  it('categorías sin internet: aviso con reintento, no en blanco', async () => {
    onlineManager.setOnline(false)
    pintar(<MenuTab />, { rutas })
    await screen.findByText('menu.loadFailed')
    await reintentar()
  })

  it('categorías caídas: ofrece reintentar, y reintentando espera', async () => {
    red.caida = CATEGORIAS
    pintar(<MenuTab />, { rutas })
    await screen.findByText('menu.loadFailed')
    red.colgada = CATEGORIAS
    fireEvent.click(await reintentar())
    await waitFor(() => expect(seVe('menu.loadFailed')).toBe(false))
    esperando()
  })

  it('productos en camino: no dice «0 productos»', async () => {
    red.colgada = PRODUCTOS
    pintar(<MenuTab />, { rutas })
    await abrirTacos()
    await unaVueltaAlLazo()
    expect(seVe('menu.product.total')).toBe(false)
    expect(seVe('—')).toBe(true)
    esperando()
  })

  it('productos caídos: su aviso con reintento y sin «0 productos»', async () => {
    red.caida = PRODUCTOS
    pintar(<MenuTab />, { rutas })
    await abrirTacos()
    await screen.findByText('menu.loadFailed')
    await reintentar()
    expect(seVe('menu.product.total')).toBe(false)
  })

  it('productos sin internet: aviso y sin «categoría vacía»', async () => {
    pintar(<MenuTab />, { rutas })
    await screen.findByText('Tacos')
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    await abrirTacos()
    await screen.findByText('menu.loadFailed')
    await reintentar()
    expect(seVe('menu.product.total')).toBe(false)
    expect(seVe('menu.product.empty')).toBe(false)
  })

  it('productos leídos y vacíos, recarga caída: el vacío sigue, con aviso', async () => {
    pintar(<MenuTab />, { rutas: [rutas[0], [PRODUCTOS, { data: { items: [], total: 0, nextCursor: null } }]] })
    await abrirTacos()
    await screen.findByText('menu.product.empty')
    await recargaCaida(PRODUCTOS)
    await screen.findByText('menu.loadFailed')
    expect(screen.getByText('menu.product.empty')).toBeInTheDocument()
  })
})

describe('Autorizar horas extra', () => {
  const OvertimeDialogPantalla = () => (
    <OvertimeApprovalDialog venueId="v1" startDate="2026-08-24" endDate="2026-08-30" persona={{ staffVenueId: 'sv1', name: 'Ana' } as never} onClose={() => {}} />
  )
  const FILA = { staffVenueId: 'sv1', date: '2026-08-25', overtimeMinutes: 60, overtimeApprovedMinutes: null, overtimeApprovedUpdatedAt: null, overtimeFingerprint: 'h' }
  const REPORTE = /attendance\/report/

  it('sin internet y sin caché: no dice «sin horas extra»', async () => {
    onlineManager.setOnline(false)
    pintar(<OvertimeDialogPantalla />, { rutas: [[REPORTE, { rows: [FILA] }]] })
    await screen.findByText('loadError.title')
    expect(seVe('payroll.overtime.approve.empty')).toBe(false)
    await reintentar()
  })

  it('recarga caída con filas leídas: las filas siguen, con aviso', async () => {
    pintar(<OvertimeDialogPantalla />, { rutas: [[REPORTE, { rows: [FILA] }]] })
    await screen.findByText('payroll.overtime.approve.measured')
    await recargaCaida(REPORTE)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('payroll.overtime.approve.measured')).toBeInTheDocument()
    expect(seVe('loadError.title')).toBe(false)
  })

  it('leído y vacío, recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<OvertimeDialogPantalla />, { rutas: [[REPORTE, { rows: [] }]] })
    await screen.findByText('payroll.overtime.approve.empty')
    await recargaEnPausa()
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('payroll.overtime.approve.empty')).toBeInTheDocument()
  })
})

describe('Listas de Shopify (ListaPaginada)', () => {
  const PROBLEMAS = /shopify\/issues/
  const FILA = { id: 'i1', title: 'Playera', sku: 'S1', reason: 'SIN_INVENTARIO', productId: null }

  it('sin internet y sin leer: su error, y no «sin problemas»', async () => {
    onlineManager.setOnline(false)
    pintar(<ShopifyIssueList venueId="v1" />, { rutas: [[PROBLEMAS, { data: { items: [], total: 0, nextOffset: null } }]] })
    await screen.findByText('issues.loadError')
    expect(seVe('issues.empty')).toBe(false)
    expect(screen.getByRole('button', { name: 'common:retry' })).toBeEnabled()
  })

  it('leídas y vacías, y la recarga en pausa: el vacío sigue, con el aviso de que puede no estar al día', async () => {
    pintar(<ShopifyIssueList venueId="v1" />, { rutas: [[PROBLEMAS, { data: { items: [], total: 0, nextOffset: null } }]] })
    await screen.findByText('issues.empty')
    await recargaEnPausa()
    await screen.findByText('list.staleError')
    expect(screen.getByText('issues.empty')).toBeInTheDocument()
  })

  it('leídas y la recarga en pausa: las filas siguen, con su aviso', async () => {
    pintar(<ShopifyIssueList venueId="v1" />, { rutas: [[PROBLEMAS, { data: { items: [FILA], total: 1, nextOffset: null } }]] })
    await screen.findByText('Playera')
    await recargaEnPausa()
    await screen.findByText('list.staleError')
    expect(screen.getByText('Playera')).toBeInTheDocument()
  })

  it('primera lectura con 403: su error, sin reintentar', async () => {
    red.caida = PROBLEMAS
    red.estatus = 403
    pintar(<ShopifyIssueList venueId="v1" />)
    await screen.findByText('issues.loadError')
    expect(screen.queryByRole('button', { name: 'common:retry' })).toBeNull()
  })

  it('apagada por permiso: no afirma «vacío» y no se queda cargando', async () => {
    function Apagada() {
      const q = useInfiniteQuery({ queryKey: ['apagada'], queryFn: async () => ({}), initialPageParam: 0, getNextPageParam: () => undefined, enabled: false })
      return (
        <ListaPaginada q={q} cuantos={0} total={0} vacio="lista-vacia" textoError="lista-error">
          {null}
        </ListaPaginada>
      )
    }
    pintar(<Apagada />)
    await unaVueltaAlLazo()
    expect(seVe('lista-vacia')).toBe(false)
    expect(seVe('lista-error')).toBe(false)
    expect(document.querySelector('.animate-spin')).toBeNull()
  })
})

describe('Estaciones de impresión', () => {
  const ESTACIONES = /print-stations\/$/
  const BARRA = { id: 's2', venueId: 'v1', name: 'Barra', printerId: null, printer: null, copies: 1, isDefault: true, isPacking: false, hasKitchenDisplay: false, active: true, displayOrder: 0 }

  it('sin internet y sin leer: no dice «no hay estaciones»', async () => {
    onlineManager.setOnline(false)
    pintar(<StationsTab venueId="v1" />, { rutas: [[ESTACIONES, { data: [BARRA] }]] })
    await screen.findByText('stations.loadError')
    expect(seVe('stations.empty')).toBe(false)
    await reintentar()
  })

  it('recarga caída con estaciones leídas: siguen, con aviso', async () => {
    pintar(<StationsTab venueId="v1" />, { rutas: [[ESTACIONES, { data: [BARRA] }]] })
    await screen.findByText('Barra')
    await recargaCaida(ESTACIONES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Barra')).toBeInTheDocument()
    expect(seVe('stations.loadError')).toBe(false)
  })

  it('reintentando sin datos: espera', async () => {
    red.caida = ESTACIONES
    pintar(<StationsTab venueId="v1" />)
    await screen.findByText('stations.loadError')
    red.colgada = ESTACIONES
    fireEvent.click(await reintentar())
    await waitFor(() => expect(seVe('stations.loadError')).toBe(false))
    esperando()
  })
})

describe('Reporte de liquidaciones', () => {
  const rutas: Ruta[] = [
    [/settlement-reports\/count/, { data: { candidateCount: 12, caps: { xlsx: 5000, csv: 10000 } } }],
    [/settlement-reports\/terminal-options/, { data: { items: [{ id: 't1', name: 'Caja 1', serialNumber: null }], nextCursor: null } }],
  ]
  const dialogo = <SettlementReportDialog open onClose={() => {}} venueId="v1" venueTimezone="America/Mexico_City" />
  const descargar = () => screen.getByTestId('settlement-report-submit')

  it('sin internet y sin leer: avisa del conteo, Descargar apagado y no dice «sin terminales»', async () => {
    onlineManager.setOnline(false)
    pintar(dialogo, { rutas })
    await screen.findByText(/settlementReport\.block\.errorConteo/)
    expect(descargar()).toBeDisabled()
    await screen.findByText(/settlementReport\.filters\.terminalsError/)
    expect(screen.queryByText('settlementReport.filters.noTerminals')).toBeNull()
    expect(screen.getAllByRole('button', { name: 'retry' }).length).toBe(2)
  })

  it('conteo leído y parámetros nuevos sin internet: no «Contando…» eterno ni Descargar activo', async () => {
    pintar(dialogo, { rutas })
    await screen.findByText('settlementReport.estimated')
    await sinConsultasEnCamino()
    onlineManager.setOnline(false)
    fireEvent.change(screen.getByTestId('date-start'), { target: { value: '2026-08-05' } })
    await screen.findByText(/settlementReport\.block\.errorConteo/)
    expect(seVe('settlementReport.block.contando')).toBe(false)
    expect(descargar()).toBeDisabled()
  })

  it('terminales leídas y la recarga en pausa: siguen, con su aviso', async () => {
    pintar(dialogo, { rutas })
    await screen.findByText('Caja 1')
    await recargaEnPausa()
    await screen.findByText(/settlementReport\.filters\.terminalsError/)
    expect(screen.getByText('Caja 1')).toBeInTheDocument()
  })
})

describe('Identificar un renglón de factura', () => {
  const CATALOGO = /supplier-invoices\/catalog/
  const LINEA = { id: 'l1', descripcion: 'Harina', cantidad: 1, claveUnidad: 'KGM' }
  const editor = <InvoiceLineEditor venueId="v1" invoiceId="f1" line={LINEA as never} onClose={() => {}} />
  const conFila: Ruta[] = [[CATALOGO, { rows: [{ id: 'r1', name: 'Harina fina', unit: 'KILOGRAM' }], total: 1, totalPages: 1 }]]

  it('en camino: sin «0 artículos» ni «sin artículos»', async () => {
    red.colgada = CATALOGO
    pintar(editor)
    await unaVueltaAlLazo()
    expect(seVe('invoices.receipt.totalArticles')).toBe(false)
    expect(seVe('invoices.receipt.noArticles')).toBe(false)
    esperando()
  })

  it('sin internet y sin leer: aviso, sin «sin artículos» ni «0 artículos»', async () => {
    onlineManager.setOnline(false)
    pintar(editor)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('invoices.receipt.noArticles')).toBe(false)
    expect(seVe('invoices.receipt.totalArticles')).toBe(false)
  })

  it('presentaciones de un insumo: caídas o sin internet avisan y dejan reintentar', async () => {
    red.caida = /presentations/
    pintar(editor, { rutas: conFila })
    fireEvent.click(await screen.findByText(/Harina fina/))
    await screen.findByText('invoices.receipt.loadError')
    expect(await reintentar()).toBeInTheDocument()
    cleanup()
    red.caida = null
    pintar(editor, { rutas: conFila })
    const fila = await screen.findByText(/Harina fina/)
    onlineManager.setOnline(false)
    fireEvent.click(fila)
    await screen.findByText('invoices.receipt.loadError')
  })

  it('caído: aviso con reintento y sin «0 artículos»', async () => {
    red.caida = CATALOGO
    pintar(editor)
    await screen.findByText(SIN_DATOS)
    await reintentar()
    expect(seVe('invoices.receipt.totalArticles')).toBe(false)
  })

  it('recarga caída con filas leídas: siguen, con aviso', async () => {
    pintar(editor, { rutas: conFila })
    await screen.findByText(/Harina fina/)
    await recargaCaida(CATALOGO)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText(/Harina fina/)).toBeInTheDocument()
  })
})

describe('Formulario de la familia de variantes', () => {
  const CATEGORIAS = /menucategories/
  const EXTRAS = /modifier-groups/
  const FAMILIA = {
    id: 'g1',
    name: 'Playera',
    description: null,
    imageUrl: null,
    categoryId: 'cat1',
    type: 'REGULAR',
    ivaTratamiento: 'IVA_16',
    satProductKey: null,
    satUnitKey: null,
    printStationId: null,
    source: 'MANUAL',
    modifierGroupIds: [],
    options: [],
    variants: [],
    archivedCount: 0,
    archived: false,
    archivedAt: null,
  }
  const form = <GroupParentForm venueId="v1" familia={FAMILIA as never} disabled={false} />

  it('sin internet y sin leer: sus errores con reintento, y no «sin extras»', async () => {
    onlineManager.setOnline(false)
    pintar(form)
    await screen.findByText('padre.errorExtras')
    await screen.findByText('padre.errorCategorias')
    expect(seVe('padre.sinExtras')).toBe(false)
    expect(screen.getAllByRole('button', { name: 'familia.reintentar' }).length).toBe(2)
  })

  it('leídos y vacíos, recarga caída: el vacío sigue, con aviso', async () => {
    pintar(form, { rutas: [[CATEGORIAS, []], [EXTRAS, []]] })
    await screen.findByText('padre.sinExtras')
    await recargaCaida(EXTRAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('padre.sinExtras')).toBeInTheDocument()
  })
})

describe('Configuración de facturación', () => {
  const FISCAL = /fiscal\/config/
  const VACIA: Ruta[] = [[FISCAL, { data: { emisores: [], merchantConfigs: [] } }]]

  it('sin internet: el aviso con reintento, sin «sin emisores» ni «sin comercios»', async () => {
    onlineManager.setOnline(false)
    pintar(<CfdiConfiguracion />, { rutas: VACIA })
    await screen.findByText('config.loadError')
    await reintentar()
    expect(seVe('emisores.empty')).toBe(false)
    expect(seVe('merchants.empty')).toBe(false)
    expect(seVe('globalInvoice.empty')).toBe(false)
  })

  it('caída: igual, y reintentar lo intenta otra vez', async () => {
    red.caida = FISCAL
    pintar(<CfdiConfiguracion />, { rutas: VACIA })
    await screen.findByText('config.loadError')
    expect(seVe('emisores.empty')).toBe(false)
    expect(seVe('merchants.empty')).toBe(false)
    red.caida = null
    fireEvent.click(await reintentar())
    await screen.findByText('emisores.empty')
    expect(seVe('config.loadError')).toBe(false)
  })

  it('leída y vacía, recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<CfdiConfiguracion />, { rutas: VACIA })
    await screen.findByText('emisores.empty')
    await recargaEnPausa()
    await screen.findByText('config.loadError')
    expect(screen.getByText('emisores.empty')).toBeInTheDocument()
  })
})

describe('Elegir la venta a facturar', () => {
  const venta = (n: number) => ({ id: `o${n}`, orderNumber: `ORD-${n}`, total: 10, createdAt: '2026-10-05T18:00:00.000Z', completedAt: '2026-10-05T18:00:00.000Z' })
  const VEINTE = Array.from({ length: 20 }, (_, i) => venta(i))
  const dialogo = <PickOrderToInvoiceDialog open onOpenChange={() => {}} onSelect={() => {}} />

  it('sin internet y sin leer: su error, y no «no hay ventas»', async () => {
    onlineManager.setOnline(false)
    pintar(dialogo, { rutas: [[/\/orders/, { data: [], meta: { total: 0 } }]] })
    await screen.findByText('pickOrder.error')
    expect(seVe('pickOrder.empty')).toBe(false)
    await reintentar()
  })

  it('«Cargar más» caído: la lista sigue, con aviso y reintento', async () => {
    pintar(dialogo, { rutas: [[/\/orders/, { data: VEINTE, meta: { total: 40 } }]] })
    await screen.findByText('ORD-3')
    red.caida = /page=2/
    fireEvent.click(screen.getByRole('button', { name: 'pickOrder.loadMore' }))
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('ORD-3')).toBeInTheDocument()
    expect(seVe('pickOrder.error')).toBe(false)
    await reintentar()
  })

  it('recarga en pausa con ventas leídas: siguen, con aviso', async () => {
    pintar(dialogo, { rutas: [[/\/orders/, { data: [venta(1)], meta: { total: 1 } }]] })
    await screen.findByText('ORD-1')
    await recargaEnPausa()
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('ORD-1')).toBeInTheDocument()
  })
})

describe('Bitácora del negocio', () => {
  const BITACORA = /activity-log\?/
  const entrada = { id: 'a1', action: 'PRODUCT_CREATED', entity: 'Product', entityId: 'p1', data: null, ipAddress: null, createdAt: '2026-10-05T18:00:00.000Z', staff: { id: 's1', firstName: 'Ana', lastName: 'Ruiz' }, venueName: 'Mi negocio' }
  const respuesta = (logs: unknown[]) => ({ data: { logs, pagination: { page: 1, pageSize: 25, total: logs.length, totalPages: 1 } } })

  it('sin internet y sin leer: no dice «sin actividad»; los filtros siguen', async () => {
    onlineManager.setOnline(false)
    pintar(<VenueActivityLog />, { rutas: [[BITACORA, respuesta([])]] })
    await screen.findByText('activityLog.error.title')
    expect(seVe('activityLog.empty')).toBe(false)
    expect(screen.getByPlaceholderText('activityLog.searchPlaceholder')).toBeInTheDocument()
    await reintentar()
  })

  it('recarga caída con actividad leída: sigue, con aviso arriba', async () => {
    pintar(<VenueActivityLog />, { rutas: [[BITACORA, respuesta([entrada])]] })
    await screen.findAllByText(/Ana/)
    await recargaCaida(BITACORA)
    await screen.findByText(CON_DATOS)
    expect(screen.getAllByText(/Ana/).length).toBeGreaterThan(0)
    expect(seVe('activityLog.error.title')).toBe(false)
  })

  it('leída y vacía, recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<VenueActivityLog />, { rutas: [[BITACORA, respuesta([])]] })
    await screen.findByText('activityLog.empty')
    await recargaEnPausa()
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('activityLog.empty')).toBeInTheDocument()
  })
})

describe('Elegir calendario de Google', () => {
  const CALENDARIOS = /oauth\/calendars/
  const lista = (calendars: unknown[]): Ruta[] => [[CALENDARIOS, { calendars, intent: 'venue_master', venueSlug: 'mi-negocio' }]]
  const AGENDA = { id: 'c1', summary: 'Agenda', accessRole: 'owner', timeZone: 'America/Mexico_City', primary: true }
  const entrada = '/x?session=tok'

  it('sin internet: no dice «no hay calendarios» ni «sesión inválida»', async () => {
    onlineManager.setOnline(false)
    pintar(<GoogleCalendarPicker />, { rutas: lista([AGENDA]), entrada })
    await screen.findByText(SIN_DATOS)
    expect(seVe('picker.noWritable')).toBe(false)
    expect(seVe('picker.invalidSession')).toBe(false)
    await reintentar()
  })

  it('un 5xx sin mensaje no es «sesión inválida» y deja reintentar; un 4xx sí lo es y no', async () => {
    red.caida = CALENDARIOS
    pintar(<GoogleCalendarPicker />, { entrada })
    await screen.findByText(SIN_DATOS)
    expect(seVe('picker.invalidSession')).toBe(false)
    await reintentar()

    cleanup()
    red.estatus = 400
    pintar(<GoogleCalendarPicker />, { entrada })
    await screen.findByText('picker.invalidSession')
    sinReintentar()
  })

  it('recarga caída con la lista leída: sigue, con aviso', async () => {
    pintar(<GoogleCalendarPicker />, { rutas: lista([AGENDA]), entrada })
    await screen.findByText('Agenda')
    await recargaCaida(CALENDARIOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Agenda')).toBeInTheDocument()
  })

  it('leída y vacía, recarga en pausa: el vacío sigue, con aviso', async () => {
    pintar(<GoogleCalendarPicker />, { rutas: lista([]), entrada })
    await screen.findByText('picker.noWritable')
    await recargaEnPausa()
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('picker.noWritable')).toBeInTheDocument()
  })
})

describe('Configuración de TPV (metas por tienda)', () => {
  const TIENDAS = /stores-analysis\/store-performance/
  const NINGUNA = 'No hay tiendas registradas'
  const TIENDA = { id: 's1', name: 'Tienda Norte', goalAmount: null, goalType: null, goalPeriod: null, goalId: null, goalSource: null }

  it('metas en camino: no dice «no hay tiendas»', async () => {
    red.colgada = TIENDAS
    pintar(<TpvConfiguration />, { entrada: '/x#metas' })
    await unaVueltaAlLazo()
    expect(seVe(NINGUNA)).toBe(false)
    esperando()
  })

  it('metas sin internet: aviso con reintento y no «no hay tiendas»', async () => {
    onlineManager.setOnline(false)
    pintar(<TpvConfiguration />, { entrada: '/x#metas' })
    await screen.findAllByText(SIN_DATOS)
    expect(seVe(NINGUNA)).toBe(false)
    expect(screen.getAllByRole('button', { name: 'retry' }).length).toBeGreaterThan(0)
  })

  it('metas caídas: aviso y no «no hay tiendas»', async () => {
    red.caida = TIENDAS
    pintar(<TpvConfiguration />, { entrada: '/x#metas' })
    await screen.findByText(SIN_DATOS)
    expect(seVe(NINGUNA)).toBe(false)
  })

  it('metas leídas y la recarga caída: la tienda sigue, con aviso', async () => {
    pintar(<TpvConfiguration />, { entrada: '/x#metas', rutas: [[TIENDAS, { data: { stores: [TIENDA] } }]] })
    await screen.findByText('Tienda Norte')
    await recargaCaida(TIENDAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Tienda Norte')).toBeInTheDocument()
  })

  it('resumen general: categorías y mensajes sin leer dicen «—», no «0 total» ni «0 enviados», y avisan', async () => {
    red.caida = /item-categories|messages/
    pintar(<TpvConfiguration />)
    await waitFor(() => expect(screen.getAllByText(SIN_DATOS).length).toBeGreaterThan(0))
    expect(seVe('0 total')).toBe(false)
    expect(seVe('0 enviados')).toBe(false)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('resumen general en camino o caído: sin «0 de 0 tiendas»', async () => {
    red.colgada = TIENDAS
    pintar(<TpvConfiguration />)
    await unaVueltaAlLazo()
    expect(seVe('de 0 tiendas')).toBe(false)

    cleanup()
    red.colgada = null
    red.caida = TIENDAS
    pintar(<TpvConfiguration />)
    await screen.findByText(SIN_DATOS)
    expect(seVe('de 0 tiendas')).toBe(false)
  })
})

// ─── MEDIA ───
describe('Saldo disponible: «Reintentar» que falla en el resumen', () => {
  const RESUMEN = /available-balance(\?|$)/
  const SALDO: Ruta[] = [
    [/available-balance\/by-card-type/, { data: [{ cardType: 'DEBIT', transactionCount: 7, totalSales: 10, fees: 1, netAmount: 9, settledAmount: 9, pendingAmount: 0, baseSales: 10, tips: 0, settlementDays: 1 }] }],
    [/available-balance\/timeline/, { data: [] }],
    [/available-balance\/settlement-calendar/, { data: [] }],
    [/available-balance\/settlement-week/, { data: { weekStart: '2026-11-02', weekEnd: '2026-11-08', days: [], weekTotal: { gross: 0, fees: 0, net: 0, transactionCount: 0 } } }],
    [RESUMEN, { data: { totalSales: 0, totalFees: 0, availableNow: 0, pendingSettlement: 0, estimatedNextSettlement: { date: null, amount: 0 } } }],
    [/cash-closeouts\/expected/, { data: { needsCloseout: false, daysSinceLastCloseout: 0, hasCloseouts: false, expectedAmount: 0 } }],
  ]

  it('el saldo en pantalla sigue, con aviso y reintento', async () => {
    red.caida = /available-balance\/by-card-type/
    pintar(<AvailableBalance />, { rutas: SALDO })
    await screen.findByText(CON_DATOS)
    red.caida = RESUMEN
    fireEvent.click(screen.getByRole('button', { name: 'retry' }))
    await unaVueltaAlLazo()
    await screen.findByText(CON_DATOS)
    expect(seVe(SIN_DATOS)).toBe(false)
    expect(screen.getByRole('button', { name: /tabs\.all/ })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
  })
})

describe('Recibo', () => {
  const RECIBO = /receipts\/r1/
  const rutas: Ruta[] = [
    [
      RECIBO,
      {
        success: true,
        data: {
          id: 'r1',
          accessKey: 'abc',
          status: 'SENT',
          dataSnapshot: {
            payment: { id: 'p1', amount: 116, tipAmount: 0, method: 'CASH', status: 'COMPLETED', createdAt: '2026-10-05T18:00:00.000Z' },
            venue: { id: 'v1', name: 'Testarudo Cafe', currency: 'MXN' },
            order: { id: 'o1', orderNumber: '42', subtotal: 100, taxAmount: 16, total: 116, items: [] },
          },
        },
      },
    ],
  ]
  const params = { receiptId: 'r1' }

  it('recarga caída: el recibo sigue, con aviso y reintento', async () => {
    pintar(<ReceiptViewer />, { rutas, params })
    await screen.findAllByText(/Testarudo Cafe/)
    await recargaCaida(RECIBO)
    await screen.findByText(CON_DATOS)
    expect(seVe('Testarudo Cafe')).toBe(true)
    await reintentar()
  })

  it('primera lectura caída: el aviso ofrece reintentar; con un 404, no', async () => {
    red.caida = RECIBO
    pintar(<ReceiptViewer />, { params })
    await reintentar()

    cleanup()
    red.estatus = 404
    pintar(<ReceiptViewer />, { params })
    await screen.findByRole('alert')
    await sinConsultasEnCamino()
    sinReintentar()
  })

  it('sin internet: el aviso ofrece reintentar', async () => {
    onlineManager.setOnline(false)
    pintar(<ReceiptViewer />, { rutas, params })
    await screen.findByText('receipt.errors.load')
    await reintentar()
  })
})

describe('Contratos de funciones (panel de facturación)', () => {
  const CONTRATOS = /hybrid-billing\/contracts/
  const CONTRATO = {
    id: 'c',
    purchaseId: 'p',
    name: 'Flexible',
    revision: 7,
    kind: 'FEATURES',
    paymentIssue: null,
    definition: {
      schemaVersion: 1,
      kind: 'FEATURES',
      featureCodes: ['CFDI'],
      terms: { currency: 'MXN', interval: 'MONTHLY', price: 469.9, taxIncluded: true, promotionCycles: null, renewal: { kind: 'SAME_PRICE' } },
    },
    featureCodes: ['CFDI'],
    startsAt: null,
    paidThrough: '2030-01-10T00:00:00.000Z',
    cancelAt: null,
    endedAt: null,
    pendingFeatureCodes: null,
    pendingEffectiveAt: null,
  }
  const panel = <HybridBillingPanel venueId="v1" canRead canManage timezone="America/Mexico_City" />

  it('sin internet: aviso con reintento, no «Cargando» eterno', async () => {
    onlineManager.setOnline(false)
    pintar(panel)
    await screen.findByText('hybrid.error')
    expect(seVe('catalog.loading')).toBe(false)
    await reintentar()
  })

  it('recarga caída con contratos leídos: siguen, con aviso', async () => {
    pintar(panel, { rutas: [[CONTRATOS, { data: { items: [CONTRATO], total: 1, page: 1, pageSize: 10 } }]] })
    await screen.findByText('Flexible')
    await recargaCaida(CONTRATOS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Flexible')).toBeInTheDocument()
    expect(seVe('hybrid.error')).toBe(false)
  })
})

describe('Comprar funciones (ofertas)', () => {
  const OFERTAS = /hybrid-offers(\?|$)/
  const OFERTA = {
    id: 'of1',
    slug: 'promo',
    name: 'Facturación',
    definition: {
      schemaVersion: 1,
      kind: 'FEATURES',
      featureCodes: ['CFDI'],
      terms: { currency: 'MXN', interval: 'MONTHLY', price: 379.5, taxIncluded: true, promotionCycles: null, renewal: { kind: 'SAME_PRICE' } },
    },
    includedFeatureCodes: ['CFDI'],
    purchaseAvailable: true,
    placesRemaining: 5,
    endsAt: '2030-01-01T00:00:00.000Z',
  }
  const rutas: Ruta[] = [
    [/hybrid-offers\/promo/, { data: OFERTA }],
    [OFERTAS, { data: { items: [OFERTA], total: 1, page: 1, pageSize: 6 } }],
    [/purchases\/current/, { data: null }],
    [/replacement-options/, { data: { items: [], total: 0, standaloneFeatureCodes: ['CHATBOT'] } }],
  ]

  it('recarga caída con ofertas leídas: siguen, con aviso', async () => {
    pintar(<HybridCheckout venueId="v1" />, { rutas })
    await screen.findByText('Facturación')
    await recargaCaida(OFERTAS)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Facturación')).toBeInTheDocument()
    expect(seVe('hybrid.error')).toBe(false)
  })

  it('oferta ligada con un 5xx: no dice «no disponible» y deja reintentar; un 404 sí lo dice', async () => {
    red.caida = /hybrid-offers\/promo/
    pintar(<HybridCheckout venueId="v1" initialSlug="promo" />, { rutas })
    await screen.findByText(SIN_DATOS)
    expect(seVe('hybrid.unavailable')).toBe(false)
    await reintentar()

    cleanup()
    red.estatus = 404
    pintar(<HybridCheckout venueId="v1" initialSlug="promo" />, { rutas })
    await screen.findByText('hybrid.unavailable')
    expect(seVe(SIN_DATOS)).toBe(false)
  })
})

describe('Cliente de la liga de pago', () => {
  const CLIENTES = /\/customers/
  const ANA = { id: 'c1', firstName: 'Ana', lastName: null, email: null, phone: null, active: true }
  const seccion = <PaymentLinkCustomerSection venueId="v1" selected={null} onChange={() => {}} reusable={false} onBusyChange={() => {}} />
  const rutas: Ruta[] = [[CLIENTES, { data: [ANA], meta: { totalCount: 1, totalPages: 1, hasNextPage: false } }]]

  it('sin internet: aviso con reintento, no «Cargando» eterno', async () => {
    onlineManager.setOnline(false)
    pintar(seccion, { rutas })
    await screen.findByText('customer.loadFailed')
    expect(seVe('customer.loading')).toBe(false)
    await reintentar()
  })

  it('recarga caída con clientes leídos: siguen, con aviso', async () => {
    pintar(seccion, { rutas })
    await screen.findByText('Ana')
    await recargaCaida(CLIENTES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByText('Ana')).toBeInTheDocument()
    expect(seVe('customer.loadFailed')).toBe(false)
  })
})

describe('Descuento de la liga de pago', () => {
  const seccion = <PaymentLinkDiscountSection value={{ mode: 'CATALOG', discountId: '' } as never} onChange={() => {}} base={100} amountType="FIXED" canApply canRead onSetExpiry={() => {}} />

  it('sin internet: su error con reintento, no en blanco', async () => {
    onlineManager.setOnline(false)
    pintar(seccion)
    await screen.findByText('discount.loadError')
    await reintentar()
  })

  it('caído: ofrece reintentar', async () => {
    red.caida = /\/discounts/
    pintar(seccion)
    await screen.findByText('discount.loadError')
    await reintentar()
  })
})

describe('Ajustes de pedidos en línea', () => {
  const AJUSTES = /online-ordering\/settings/
  const BASE = {
    enabled: false,
    minOrderAmount: 50,
    defaultPrepMinutes: 20,
    acceptsPayAtPickup: true,
    acceptsCardOnline: false,
    card: { enabled: false, merchantStatus: 'NOT_CONNECTED' },
    manualPause: false,
    pausedUntil: null,
    hours: null,
    lastInboxPollAt: null,
    store: { status: 'DISABLED', reason: 'NOT_ENABLED', pausedUntil: null, manualPause: false },
    requirements: { address: true, phone: true, privacyNotice: true },
  }

  it('sin internet: su aviso ofrece reintentar', async () => {
    onlineManager.setOnline(false)
    pintar(<SettingsTab />)
    await screen.findByText('settings.loadFailed')
    await reintentar()
  })

  it('caídos: ofrece reintentar, y reintentando espera', async () => {
    red.caida = AJUSTES
    pintar(<SettingsTab />)
    await screen.findByText('settings.loadFailed')
    red.colgada = AJUSTES
    fireEvent.click(await reintentar())
    await waitFor(() => expect(seVe('settings.loadFailed')).toBe(false))
    esperando()
  })

  it('recarga caída con ajustes leídos: la pestaña sigue, con aviso', async () => {
    pintar(<SettingsTab />, { rutas: [[AJUSTES, { data: BASE }]] })
    await screen.findByRole('button', { name: 'settings.save' })
    await recargaCaida(AJUSTES)
    await screen.findByText(CON_DATOS)
    expect(screen.getByRole('button', { name: 'settings.save' })).toBeInTheDocument()
  })
})
