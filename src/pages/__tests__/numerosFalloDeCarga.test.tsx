/**
 * D4, números del dueño: con la consulta caída o sin internet, tarjetas y totales pintaban $0 como si fueran un dato. Corre con TanStack y
 * los servicios de verdad: sólo se finge la red. Cada caso: caída → aviso sin el cero; sin internet → igual; «Reintentar» no destapa el
 * cero mientras espera; respuesta buena en cero → el cero de hoy, sin aviso.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { CashCloseoutDialog } from '@/components/CashCloseout/CashCloseoutDialog'
import { SettlementWeekStrip } from '@/components/settlement/SettlementWeekStrip'
import CommissionsPage from '../Commissions/CommissionsPage'
import ProductStock from '../Inventory/ProductStock'
import Profitability from '../Inventory/Profitability'
import RawMaterials from '../Inventory/RawMaterials'
import { PaymentDrawerContent } from '../Payment/PaymentDrawerContent'
import PaymentId from '../Payment/PaymentId'
import PaymentLinks from '../PaymentLinks/PaymentLinks'
import Expenses from '../Reports/Expenses'
import StockControl from '../playtelecom/Stock/StockControl'

const m = vi.hoisted(() => ({
  lecturas: [] as [RegExp, unknown][],
  caida: null as RegExp | null,
  colgada: null as RegExp | null,
  posts: 0,
  hojaDeReembolso: null as { maxRefundable: number } | null,
  t: (k: string, o?: string | { defaultValue?: string }) => (typeof o === 'string' ? o : (o?.defaultValue ?? k)),
  venue: { venueId: 'v1', venueSlug: 'mi-negocio', fullBasePath: '/venues/mi-negocio', venue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City' } },
  auth: {
    user: { id: 'u1', role: 'OWNER', venues: [] },
    staffInfo: { role: 'OWNER' },
    activeVenue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City', currency: 'MXN', features: [], modules: [] },
    allVenues: [],
    checkFeatureAccess: () => true,
  },
}))

vi.mock('@/api', () => {
  const get = (url: string) => {
    if (m.colgada?.test(url)) return new Promise(() => {})
    if (m.caida?.test(url)) return Promise.reject(new Error('500'))
    const hit = m.lecturas.find(([re]) => re.test(url))
    // Lo que el caso no menciona se queda cargando: no es la fuente que se prueba.
    return hit ? Promise.resolve({ data: hit[1] }) : new Promise(() => {})
  }
  const post = () => {
    m.posts++
    return Promise.resolve({ data: { data: {} } })
  }
  return { default: { get, post, put: post, patch: post, delete: post } }
})
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => m.venue }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, role: 'OWNER' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }), useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => undefined, clearCustomSegment: () => undefined }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('@/components/AddToAIButton', () => ({ AddToAIButton: () => null, default: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }), Trans: () => null, initReactI18next: { type: '3rdParty', init: () => undefined } }))
vi.mock('../Payment/IssueRefundSheet', () => ({
  IssueRefundSheet: (props: { maxRefundable: number }) => {
    m.hojaDeReembolso = props
    return null
  },
}))
vi.mock('../Payment/RefundCreditNotePanel', () => ({ RefundCreditNotePanel: () => null }))
vi.mock('../Payment/CustomerSheets', () => ({ AddCustomerSheet: () => null, CustomerFormSheet: () => null }))
vi.mock('../Commissions/components/TeamCommissionTable', () => ({ default: () => null }))
vi.mock('../Commissions/components/GoalsTab', () => ({ default: () => null }))
vi.mock('../Commissions/components/CommissionConfigList', () => ({ default: () => null }))
vi.mock('../Commissions/components/setup-panel/CommissionSetupPanel', () => ({ default: () => null }))
vi.mock('../playtelecom/Stock/components/StockVsSalesChart', () => ({ StockVsSalesChart: () => null }))
vi.mock('../playtelecom/Stock/components/LowStockAlerts', () => ({ LowStockAlerts: () => null }))
vi.mock('../playtelecom/Stock/components/CategoryManagement', () => ({ default: () => null, CategoryManagement: () => null }))
vi.mock('../playtelecom/Stock/components/VenueSimCustodyPanel', () => ({ default: () => null, VenueSimCustodyPanel: () => null }))

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const PESOS_EN_CERO = /\$\s?0(\.00)?(?![\d,])/

const pagoEnCero = { id: 'p1', amount: '0', tipAmount: '0', method: 'CASH', source: 'POS', status: 'PAID', type: 'REGULAR', createdAt: '2026-10-09T18:00:00Z', order: { id: 'o1', items: [] } }
const pago = { ...pagoEnCero, amount: '116.00', method: 'CREDIT_CARD' }

const enRuta = (ruta: string, patron: string, elemento: ReactElement) => (
  <MemoryRouter initialEntries={[ruta]}>
    <Routes>
      <Route path={patron} element={elemento} />
    </Routes>
  </MemoryRouter>
)

type Caso = {
  nombre: string
  pantalla: () => ReactElement
  /** Sanas y en cero: la forma que devuelve el SERVIDOR. La primera que coincide con la URL gana. */
  lecturas: [RegExp, unknown][]
  /** La fuente que se cae. */
  caida: RegExp
  /** Lo que un negocio en cero ve hoy, y lo que no debe salir sin haber leído. */
  cero: RegExp
  /** Lo de otra fuente que sigue a la vista aunque ésta caiga. */
  sigue?: RegExp
  /** La pantalla ya tenía su propio aviso: se conserva su texto. */
  aviso?: string
  reintentar?: string
}

const CASOS: Caso[] = [
  {
    nombre: 'calendario de depósitos',
    pantalla: () => <SettlementWeekStrip venueId="v1" venueTimezone="America/Mexico_City" />,
    lecturas: [[/settlement-week/, { success: true, data: { weekStart: '2026-11-02', weekEnd: '2026-11-08', days: [], weekTotal: { net: 0, gross: 0, commission: 0 } } }]],
    caida: /settlement-week/,
    cero: PESOS_EN_CERO,
  },
  {
    nombre: 'corte de caja',
    pantalla: () => <CashCloseoutDialog open onOpenChange={() => undefined} venueId="v1" />,
    lecturas: [[/cash-closeouts\/expected/, { data: { expectedAmount: 0, periodStart: '2026-11-01T00:00:00Z' } }]],
    caida: /cash-closeouts\/expected/,
    cero: PESOS_EN_CERO,
  },
  {
    nombre: 'detalle del pago',
    pantalla: () => enRuta('/payments/p1', '/payments/:paymentId', <PaymentId />),
    lecturas: [
      [/payments\/p1$/, pagoEnCero],
      [/payments\/p1\/receipts$/, []],
    ],
    caida: /payments\/p1$/,
    cero: PESOS_EN_CERO,
  },
  {
    nombre: 'gastos',
    pantalla: () => enRuta('/', '/', <Expenses />),
    lecturas: [[/expenses/, { expenses: [], summary: { count: 0, totalCents: 0, ivaCents: 0, deducibleCents: 0 }, needsFiscalSetup: false }]],
    caida: /expenses/,
    cero: PESOS_EN_CERO,
    aviso: 'accountingError.body',
    reintentar: 'accountingError.retry',
  },
  {
    nombre: 'existencias',
    pantalla: () => enRuta('/', '/', <ProductStock />),
    lecturas: [[/\/products/, { data: [] }]],
    caida: /\/products/,
    cero: /\$0\.00/,
  },
  {
    nombre: 'rentabilidad',
    pantalla: () => enRuta('/', '/', <Profitability />),
    lecturas: [[/inventory\/profitability/, { data: [] }]],
    caida: /inventory\/profitability/,
    cero: /Margen típico/,
  },
  {
    nombre: 'ligas de pago',
    pantalla: () => enRuta('/', '/', <PaymentLinks />),
    lecturas: [[/payment-links/, { data: { paymentLinks: [], total: 0, counts: {}, summary: { totalCollected: 0, paidLinks: 0 } } }]],
    caida: /payment-links/,
    cero: PESOS_EN_CERO,
  },
  {
    nombre: 'comisiones: calculado',
    pantalla: () => enRuta('/', '/', <CommissionsPage />),
    lecturas: [
      [/\/stats$/, { totalCalculated: 0, staffWithCommissions: 0, topEarners: [], staffPayActive: true, totalPaid: 0 }],
      [/effective-configs$/, { data: [{ config: { id: 'c1' }, source: 'venue' }] }],
    ],
    caida: /\/stats$/,
    cero: PESOS_EN_CERO,
  },
  {
    nombre: 'control de stock',
    pantalla: () => enRuta('/', '/', <StockControl />),
    lecturas: [
      [/stock\/metrics/, { data: { availablePieces: 0, soldToday: 0, totalPieces: 0 } }],
      [/stock\/categories/, { data: { categories: [] } }],
      [/stock\/responsibles/, { data: { adminHeld: { simsCount: 0 }, supervisors: [], promoters: [] } }],
      [/stock\/movements/, { data: { movements: [], pagination: { hasMore: false, page: 1 } } }],
    ],
    caida: /stock\/metrics/,
    cero: /Total Disponible/,
  },
]

let client: QueryClient
function pintar(elemento: ReactElement) {
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  return render(<QueryClientProvider client={client}>{elemento}</QueryClientProvider>)
}
const seVeElCero = (cero: RegExp) => cero.test(document.body.textContent ?? '')

beforeEach(() => {
  onlineManager.setOnline(true)
  m.lecturas = []
  m.caida = null
  m.colgada = null
  m.posts = 0
  m.hojaDeReembolso = null
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(CASOS)('$nombre', ({ pantalla, lecturas, caida, cero, sigue, aviso = 'loadFailure.empty', reintentar = 'retry' }) => {
  it('caída: avisa en lugar del número, y lo que sí llegó sigue', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText(aviso)
    expect(seVeElCero(cero)).toBe(false)
    if (sigue) expect(document.body.textContent).toMatch(sigue)
  })

  it('sin internet: lo mismo, y vuelve solo con la red', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(pantalla())
    await screen.findAllByText(aviso)
    expect(seVeElCero(cero)).toBe(false)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(seVeElCero(cero)).toBe(true))
    expect(screen.queryByText(aviso)).toBeNull()
  })

  it('al reintentar no destapa el cero mientras espera', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText(aviso)
    m.caida = null
    m.colgada = caida
    fireEvent.click(screen.getByRole('button', { name: reintentar }))
    await waitFor(() => expect(screen.queryByText(aviso)).toBeNull())
    expect(seVeElCero(cero)).toBe(false)
  })

  it('un negocio de verdad en cero se ve igual que hoy', async () => {
    m.lecturas = lecturas
    pintar(pantalla())
    await waitFor(() => expect(seVeElCero(cero)).toBe(true))
    expect(screen.queryByText(aviso)).toBeNull()
  })
})

describe('corte de caja: sin leer lo esperado no se envía', () => {
  const teclear = () => fireEvent.change(document.getElementById('actualAmount')!, { target: { value: '500' } })
  const enviar = () => screen.getByRole('button', { name: 'dialog.submit' })

  it('caída: el botón no deja enviar y no se manda nada', async () => {
    m.lecturas = CASOS[1].lecturas
    m.caida = /cash-closeouts\/expected/
    pintar(CASOS[1].pantalla())
    await screen.findByText('loadFailure.empty')
    teclear()
    expect(enviar()).toBeDisabled()
    fireEvent.submit(enviar().closest('form')!)
    await act(async () => {})
    expect(m.posts).toBe(0)
  })

  it('recarga caída con lo esperado viejo: el dato sigue, avisa y tampoco se envía', async () => {
    m.lecturas = CASOS[1].lecturas
    pintar(CASOS[1].pantalla())
    await waitFor(() => expect(seVeElCero(PESOS_EN_CERO)).toBe(true))
    m.caida = /cash-closeouts\/expected/
    await act(() => client.refetchQueries({ queryKey: ['cash-closeout', 'expected'] }))
    await screen.findByText('loadFailure.partial')
    teclear()
    expect(enviar()).toBeDisabled()
  })

  it('lectura buena en cero: sí deja enviar', async () => {
    m.lecturas = CASOS[1].lecturas
    pintar(CASOS[1].pantalla())
    await waitFor(() => expect(seVeElCero(PESOS_EN_CERO)).toBe(true))
    teclear()
    expect(enviar()).toBeEnabled()
  })
})

describe('detalle del pago: recarga caída', () => {
  it('el pago sigue a la vista, con aviso', async () => {
    m.lecturas = [
      [/payments\/p1$/, pago],
      [/payments\/p1\/receipts$/, []],
    ]
    pintar(enRuta('/payments/p1', '/payments/:paymentId', <PaymentId />))
    await waitFor(() => expect(document.body.textContent).toMatch(/\$116\.00/))
    m.caida = /payments\/p1$/
    await act(() => client.refetchQueries({ queryKey: ['payment', 'p1'] }))
    await screen.findByText('loadFailure.partial')
    expect(document.body.textContent).toMatch(/\$116\.00/)
  })
})

describe('reembolsos en el cajón del pago', () => {
  const lecturas: [RegExp, unknown][] = [
    [/payments\/p1$/, pago],
    [/payments\/p1\/receipts$/, []],
    [/payments\/p1\/refunds$/, { data: [] }],
  ]
  const cajon = () => <PaymentDrawerContent paymentId="p1" onClose={() => undefined} venueTimezone="America/Mexico_City" />
  const opcionReembolsar = async () => {
    fireEvent.keyDown(document.querySelector('button.h-10.w-10')!, { key: 'Enter' })
    return screen.findByRole('menuitem', { name: 'Emitir reembolso' })
  }

  it.each([
    ['caídos', () => (m.caida = /payments\/p1\/refunds$/), 'loadFailure.empty'],
    ['sin internet', () => onlineManager.setOnline(false), 'loadFailure.empty'],
  ])('%s: no ofrece reembolsar el total, y el pago sigue', async (_n, preparar, aviso) => {
    m.lecturas = lecturas
    // El pago ya está en memoria para lo de «sin internet»: sólo los reembolsos quedan sin leer.
    if (_n === 'sin internet') {
      client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 60_000 } } })
      client.setQueryData(['payment', 'p1'], pago)
      client.setQueryData(['receipts', 'p1'], [])
      preparar()
      render(<QueryClientProvider client={client}>{cajon()}</QueryClientProvider>)
    } else {
      preparar()
      pintar(cajon())
    }
    await screen.findByText(aviso)
    expect(document.body.textContent).toMatch(/\$116\.00/)
    expect(await opcionReembolsar()).toHaveAttribute('data-disabled')
  })

  it('leídos y sin reembolsos: sí se ofrece el total', async () => {
    m.lecturas = lecturas
    pintar(cajon())
    await waitFor(() => expect(document.body.textContent).toMatch(/\$116\.00/))
    await waitFor(async () => expect(await opcionReembolsar()).not.toHaveAttribute('data-disabled'))
    expect(m.hojaDeReembolso?.maxRefundable).toBe(116)
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })

  it('el pago caído avisa en vez de girar para siempre', async () => {
    m.lecturas = lecturas
    m.caida = /payments\/p1$/
    pintar(cajon())
    await screen.findByText('loadFailure.empty')
  })
})

describe('comisiones: la configuración', () => {
  const lecturas: [RegExp, unknown][] = [
    [/\/stats$/, { totalCalculated: 500, staffWithCommissions: 2, topEarners: [], staffPayActive: true, totalPaid: 0 }],
    [/effective-configs$/, { data: [] }],
  ]
  it('caída: no pide configurar lo que ya puede estar configurado, y lo calculado sigue', async () => {
    m.lecturas = lecturas
    m.caida = /effective-configs$/
    pintar(enRuta('/', '/', <CommissionsPage />))
    await screen.findByText('loadFailure.empty')
    await waitFor(() => expect(document.body.textContent).toMatch(/\$500/))
    expect(screen.queryByText('overview.noConfigTitle')).toBeNull()
  })
  it('leída y sin configuraciones: sí pide configurar', async () => {
    m.lecturas = lecturas
    pintar(enRuta('/', '/', <CommissionsPage />))
    await screen.findByText('overview.noConfigTitle')
  })
  it('sin leer las estadísticas pero sin configuraciones: la guía sigue', async () => {
    m.lecturas = lecturas
    m.caida = /\/stats$/
    pintar(enRuta('/', '/', <CommissionsPage />))
    await screen.findByText('overview.noConfigTitle')
    await screen.findByText('loadFailure.empty')
  })
})

describe('insumos: el stock confirmado', () => {
  const material = { id: 'rm1', name: 'Harina', sku: 'H1', category: 'GRAINS', unit: 'KILOGRAM', currentStock: 5, minimumStock: 1, reorderPoint: 2, costPerUnit: 10, active: true, perishable: false, recipeCount: 0 }
  const lecturas: [RegExp, unknown][] = [
    [/inventory\/raw-materials/, { data: [material] }],
    [/inventory\/purchase-orders/, { data: [] }],
  ]
  it('caída: la fila sigue y avisa, sin afirmar 0.00 confirmado', async () => {
    m.lecturas = lecturas
    m.caida = /inventory\/purchase-orders/
    pintar(enRuta('/', '/', <RawMaterials />))
    await screen.findByText('Harina')
    await screen.findByText('loadFailure.empty')
    expect(screen.queryByText(/^0\.00/)).toBeNull()
  })
  it('leído y sin compras en camino: 0.00 de hoy, sin aviso', async () => {
    m.lecturas = lecturas
    pintar(enRuta('/', '/', <RawMaterials />))
    await screen.findByText('Harina')
    await screen.findByText(/^0\.00/)
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })
})
