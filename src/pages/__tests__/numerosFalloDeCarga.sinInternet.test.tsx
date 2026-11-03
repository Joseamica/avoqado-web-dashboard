/**
 * D4, avisos que ya existían: preguntaban sólo por `isError`, y sin internet la consulta se pausa sin error. Se pintaba $0, «no hay caja
 * abierta» o el reporte vacío. Cada aviso conserva su texto y ahora también cubre la pausa. Sólo se finge la red.
 */
import { onlineManager, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, cleanup, configure, fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactElement, ReactNode } from 'react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import Attendance from '../Attendance/Attendance'
import BancosReportes from '../Bancos/BancosReportes'
import InterVenueTransfersPage from '../Inventory/InterVenueTransfers/InterVenueTransfersPage'
import { ModifierInventoryAnalytics } from '../Inventory/components/ModifierInventoryAnalytics'
import Orders from '../Order/Orders'
import Payments from '../Payment/Payments'
import AccountingReports from '../Reports/AccountingReports'
import AccountMapping from '../Reports/AccountMapping'
import AccountsPayable from '../Reports/AccountsPayable'
import BankAndCash from '../Reports/BankAndCash'
import BusinessSummary from '../Reports/BusinessSummary'
import CashBasisVat from '../Reports/CashBasisVat'
import ChartOfAccounts from '../Reports/ChartOfAccounts'
import FiscalReadiness from '../Reports/FiscalReadiness'
import FixedAssets from '../Reports/FixedAssets'
import IncomeStatement from '../Reports/IncomeStatement'
import Isr from '../Reports/Isr'
import Journal from '../Reports/Journal'
import Nomina from '../Reports/Nomina'
import PaymentMethods from '../Reports/PaymentMethods'
import PromotionSales from '../Reports/PromotionSales'
import Refunds from '../Reports/Refunds'
import SalesByCategory from '../Reports/SalesByCategory'
import SalesByItem from '../Reports/SalesByItem'
import TrialBalance from '../Reports/TrialBalance'
import { CashDrawerSection } from '../Shift/components/CashDrawerSection'
import { StandaloneInvoicesSection } from '../Inventory/PurchaseOrders/components/StandaloneInvoicesSection'
import { OrgTpvConfigSection } from '../Organization/OrganizationSettings'
import GoogleIntegration from '../Settings/GoogleIntegration'
import EcommerceMerchantsGlobal from '../Superadmin/EcommerceMerchantsGlobal'
import ServerHealth from '../Superadmin/ServerHealth'
import { DeleteConfirmDialog } from '../Superadmin/components/merchant-accounts/DeleteConfirmDialog'
import SettlementCard from '../Superadmin/components/merchant-accounts/merchant-setup-panel/cards/SettlementCard'
import VenuePaymentConfig from '../Venue/VenuePaymentConfig'

const m = vi.hoisted(() => ({
  lecturas: [] as [RegExp, unknown][],
  caida: null as RegExp | null,
  colgada: null as RegExp | null,
  t: (k: string, o?: string | { defaultValue?: string }) => (typeof o === 'string' ? o : (o?.defaultValue ?? k)),
  venue: { venueId: 'v1', venueSlug: 'mi-negocio', fullBasePath: '/venues/mi-negocio', venue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City', currency: 'MXN', organizationId: 'o1' } },
  auth: {
    user: { id: 'u1', role: 'OWNER', venues: [] as unknown[] },
    staffInfo: { role: 'OWNER' },
    activeVenue: { id: 'v1', name: 'Mi negocio', timezone: 'America/Mexico_City', currency: 'MXN', organizationId: 'o1', features: [], modules: [] },
    allVenues: [] as unknown[],
    checkFeatureAccess: () => true,
    getVenueBySlug: () => ({ id: 'v1', name: 'Mi negocio', slug: 'mi-negocio' }),
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
vi.mock('@/context/AuthContext', () => ({ useAuth: () => m.auth }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true, role: 'OWNER', getDataScope: () => 'venue' }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => undefined }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({ useTierFeatureAccess: () => ({ hasAccess: true }), useVenueTier: () => ({ hasFeatureAccess: () => true }) }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PageTitleWithInfo', () => ({ PageTitleWithInfo: () => null }))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/components/AddToAIButton', () => ({ AddToAIButton: () => null, default: () => null }))
vi.mock('@/components/accounting/PeriodLockCard', () => ({ PeriodLockCard: () => null, default: () => null }))
vi.mock('../Reports/components/ExchangesToReviewSection', () => ({ ExchangesToReviewSection: () => null }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: m.t, i18n: { language: 'es' } }), Trans: () => null, initReactI18next: { type: '3rdParty', init: () => undefined } }))
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: () => null,
}))
vi.mock('recharts', async importOriginal => ({
  ...(await importOriginal<typeof import('recharts')>()),
  ResponsiveContainer: ({ children }: { children: ReactNode }) => <div data-testid="grafica">{children}</div>,
}))

Element.prototype.hasPointerCapture = () => false
Element.prototype.setPointerCapture = () => {}
Element.prototype.releasePointerCapture = () => {}
Element.prototype.scrollIntoView = () => {}

vi.setConfig({ testTimeout: 30_000 })
configure({ asyncUtilTimeout: 10_000 })

const raiz = (elemento: ReactElement) => (
  <MemoryRouter>
    <Routes>
      <Route path="/" element={elemento} />
    </Routes>
  </MemoryRouter>
)
const PESOS_EN_CERO = /\$\s?0(\.00)?(?![\d,])/
const ERROR_CONTABLE = 'accountingError.body'
const REINTENTO_CONTABLE = 'accountingError.retry'
const SIN_FISCAL = { needsFiscalSetup: false }

type Caso = {
  nombre: string
  pantalla: () => ReactElement
  lecturas: [RegExp, unknown][]
  caida: RegExp
  /** Lo que se ve con la lectura buena en cero; sin haber leído no debe salir. */
  cero: RegExp
  /** El aviso de la pantalla, tal como ya existía. */
  aviso: string
  /** Si con el servidor caído dice otra cosa (el mensaje del error). */
  avisoCaida?: string
  /** Sin botón de reintentar, no aplica ese recorrido. */
  reintentar?: string
}

const contable = (nombre: string, pantalla: () => ReactElement, url: RegExp, respuesta: unknown, cero: RegExp): Caso => ({
  nombre,
  pantalla,
  lecturas: [[url, respuesta]],
  caida: url,
  cero,
  aviso: ERROR_CONTABLE,
  reintentar: REINTENTO_CONTABLE,
})

const CASOS: Caso[] = [
  contable('bancos y caja', () => raiz(<BankAndCash />), /accounting\/banks/, { ...SIN_FISCAL, accounts: [], totals: { cashInflowCents: 0, electronicInflowCents: 0, feesCents: 0, netToBankCents: 0 }, reconciliation: { salesTotalCents: 0, tipsTotalCents: 0, balanced: true } }, PESOS_EN_CERO),
  contable('resumen del negocio', () => raiz(<BusinessSummary />), /accounting\/business-summary/, { metrics: { salesCount: 0, refundCount: 0 } }, /businessSummary\.zeroTitle/),
  contable('estado de resultados', () => raiz(<IncomeStatement />), /accounting\/income-statement/, { metrics: { salesCount: 0, refundCount: 0 } }, /incomeStatement\.zeroTitle/),
  contable('cuentas por pagar', () => raiz(<AccountsPayable />), /accounting\/accounts-payable/, { ...SIN_FISCAL, totals: { pendienteCents: 0, proveedores: 0, corrienteCents: 0, d31_60Cents: 0, d61_90Cents: 0, mas90Cents: 0 }, suppliers: [] }, PESOS_EN_CERO),
  contable('IVA de caja', () => raiz(<CashBasisVat />), /accounting\/vat-flow/, { ...SIN_FISCAL, ivaTrasladadoCobradoCents: 0, baseGravableCents: 0, acreditablePagadoCents: 0, ivaAPagarCents: 0, ivaAFavorCents: 0 }, PESOS_EN_CERO),
  contable('ISR', () => raiz(<Isr />), /accounting\/isr/, { ...SIN_FISCAL, isrAPagarCents: 0, ingresosCobradosCents: 0, tasaAplicada: 0 }, /isr\.isrAPagar/),
  contable('preparación fiscal', () => raiz(<FiscalReadiness />), /accounting\/readiness/, { ...SIN_FISCAL, resumen: { ok: 0, warn: 0, missing: 0 }, capabilities: {}, checks: [] }, /fiscalReadiness\.summary\.ok/),
  contable('reportes contables', () => raiz(<AccountingReports />), /accounting\/reports/, { ...SIN_FISCAL, hasData: false }, /accountingReports\.emptyTitle/),
  contable('balanza', () => raiz(<TrialBalance />), /accounting\/trial-balance/, { ...SIN_FISCAL, rows: [], balanced: { movements: true, balances: true } }, /trialBalance\.emptyTitle/),
  contable('diario', () => raiz(<Journal />), /accounting\/journal/, { ...SIN_FISCAL, entries: [] }, /journal\.emptyTitle/),
  contable('activos fijos', () => raiz(<FixedAssets />), /accounting\/fixed-assets/, { ...SIN_FISCAL, assets: [] }, /fixedAssets\.emptyTitle/),
  contable('nómina', () => raiz(<Nomina />), /payroll\/employees/, { ...SIN_FISCAL, employees: [] }, /nomina\.emptyTitle/),
  contable('catálogo de cuentas', () => raiz(<ChartOfAccounts />), /accounting\/chart-of-accounts/, { ...SIN_FISCAL, seeded: false, accounts: [] }, /chartOfAccounts\.emptyTitle/),
  contable('mapeo de cuentas', () => raiz(<AccountMapping />), /accounting\/account-mapping/, { ...SIN_FISCAL, catalogSeeded: false, mappings: [], movementTypes: [], accounts: [] }, /accountMapping\.needsCatalogTitle/),
  {
    nombre: 'caja de turnos',
    pantalla: () => raiz(<CashDrawerSection />),
    lecturas: [
      [/cash-drawer\/status/, { open: null, anomalies: [] }],
      [/cash-drawer\/sessions/, { sessions: [], pagination: { totalPages: 1 } }],
    ],
    caida: /cash-drawer\/status/,
    cero: /drawer\.noneOpen/,
    aviso: 'drawer.error',
    reintentar: 'drawer.retry',
  },
  {
    nombre: 'ventas: tarjetas',
    pantalla: () => raiz(<Orders />),
    lecturas: [[/orders\/summary/, { data: { groups: [], filteredGroups: [] } }]],
    caida: /orders\/summary/,
    cero: PESOS_EN_CERO,
    aviso: 'summaryUnavailable',
    reintentar: 'retry',
  },
  {
    nombre: 'pagos: tarjetas',
    pantalla: () => raiz(<Payments />),
    lecturas: [[/payments\/summary/, { data: { groups: [], filteredGroups: [] } }]],
    caida: /payments\/summary/,
    cero: PESOS_EN_CERO,
    aviso: 'summaryUnavailable',
    reintentar: 'retry',
  },
  {
    nombre: 'ventas por método de pago',
    pantalla: () => raiz(<PaymentMethods />),
    lecturas: [[/reports\/sales-summary/, { success: true, data: { byPaymentMethodDetailed: [], summary: { totalCollected: 0, transactionCount: 0, tips: 0, refunds: 0, platformFees: 0 } } }]],
    caida: /reports\/sales-summary/,
    cero: PESOS_EN_CERO,
    aviso: 'Error loading payment methods data',
    avisoCaida: '500',
  },
  {
    nombre: 'ventas de promociones',
    pantalla: () => raiz(<PromotionSales />),
    lecturas: [[/reports\/promotions/, { success: true, data: { promotions: [], totals: { timesSold: 0, grossSales: 0, discounts: 0, netSales: 0 } } }]],
    caida: /reports\/promotions/,
    cero: PESOS_EN_CERO,
    aviso: 'No se pudo cargar el reporte',
    avisoCaida: '500',
  },
  {
    nombre: 'reembolsos',
    pantalla: () => raiz(<Refunds />),
    lecturas: [[/reports\/refunds/, { success: true, data: { refunds: [], byReason: [], totals: { totalSale: 0, totalTips: 0, totalRefunded: 0, count: 0 } } }]],
    caida: /reports\/refunds/,
    cero: PESOS_EN_CERO,
    aviso: 'Error loading refunds data',
    avisoCaida: '500',
  },
  {
    nombre: 'ventas por categoría',
    pantalla: () => raiz(<SalesByCategory />),
    lecturas: [[/reports\/sales-by-item/, { success: true, data: { items: [], totals: { grossSales: 0 } } }]],
    caida: /reports\/sales-by-item/,
    cero: /salesByCategory\./,
    aviso: 'Error loading sales by category data',
    avisoCaida: '500',
  },
  {
    nombre: 'ventas por artículo',
    pantalla: () => raiz(<SalesByItem />),
    lecturas: [[/reports\/sales-by-item/, { success: true, data: { items: [], totals: { grossSales: 0 } } }]],
    caida: /reports\/sales-by-item/,
    cero: /salesByItem\./,
    aviso: 'Error loading sales by item data',
    avisoCaida: '500',
  },
  {
    nombre: 'modificadores',
    pantalla: () => raiz(<ModifierInventoryAnalytics />),
    lecturas: [[/modifiers\/inventory\/su/, { data: { totalModifiersWithInventory: 0, totalModifiersLowStock: 0, totalCostImpactPeriod: 0, lowStockModifiers: [], topCostModifiers: [] } }]],
    caida: /modifiers\/inventory\/su/,
    cero: PESOS_EN_CERO,
    aviso: 'An error occurred while loading modifier analytics.',
    avisoCaida: '500',
  },
  {
    nombre: 'asistencia: quién está dentro',
    pantalla: () => raiz(<Attendance />),
    lecturas: [
      [/time-entries\/active/, { data: [] }],
      [/time-entries/, { timeEntries: [], total: 0 }],
    ],
    caida: /time-entries\/active/,
    cero: /onShift\.empty/,
    aviso: 'loadError.title',
    reintentar: 'loadError.retry',
  },
  {
    nombre: 'traspasos entre sucursales',
    pantalla: () => raiz(<InterVenueTransfersPage />),
    lecturas: [[/inventory\/inter-venue-transfers/, { success: true, data: { items: [], total: 0, page: 1, pageSize: 20, venues: [] } }]],
    caida: /inventory\/inter-venue-transfers/,
    cero: /interVenueTransfers\.columns\.date/,
    aviso: 'interVenueTransfers.messages.loadError',
  },
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
})
afterEach(() => {
  cleanup()
  client?.clear()
  onlineManager.setOnline(true)
})

describe.each(CASOS)('$nombre', ({ pantalla, lecturas, caida, cero, aviso, avisoCaida, reintentar }) => {
  it('caída: sigue su aviso, sin el cero', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText(avisoCaida ?? aviso)
    if (!avisoCaida) expect(seVe(cero)).toBe(false)
  })

  it('sin internet: el mismo aviso, y vuelve solo con la red', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(pantalla())
    await waitFor(() => expect(screen.getAllByText(aviso).length).toBeGreaterThan(0))
    expect(seVe(PESOS_EN_CERO)).toBe(false)
    act(() => onlineManager.setOnline(true))
    await waitFor(() => expect(screen.queryByText(aviso)).toBeNull())
  })

  it.runIf(reintentar)('al reintentar no destapa el cero mientras espera', async () => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(pantalla())
    await screen.findByText(aviso)
    m.caida = null
    m.colgada = caida
    fireEvent.click(screen.getByRole('button', { name: reintentar! }))
    await waitFor(() => expect(screen.queryByText(aviso)).toBeNull())
    expect(seVe(cero)).toBe(false)
  })

  it('un negocio de verdad en cero se ve igual que hoy', async () => {
    m.lecturas = lecturas
    pintar(pantalla())
    await waitFor(() => expect(seVe(cero)).toBe(true))
    expect(screen.queryByText(aviso)).toBeNull()
  })
})

describe('recarga caída con datos: el número sigue, con aviso', () => {
  const banks = CASOS[0]
  it('bancos y caja', async () => {
    m.lecturas = banks.lecturas
    pintar(banks.pantalla())
    await waitFor(() => expect(seVe(PESOS_EN_CERO)).toBe(true))
    m.caida = banks.caida
    await act(() => client.refetchQueries())
    await screen.findByText('loadFailure.partial')
    expect(seVe(PESOS_EN_CERO)).toBe(true)
    expect(screen.queryByText(ERROR_CONTABLE)).toBeNull()
  })
})

describe('borrar una cuenta de comercio: sin leer las dependencias no se ofrece', () => {
  const account = { id: 'ma1', displayName: 'Cuenta Uno' } as never
  const dialogo = () => <DeleteConfirmDialog open onOpenChange={() => undefined} account={account} onConfirmDelete={async () => undefined} onDeleteCostStructure={async () => undefined} onDeleteVenueConfig={async () => undefined} />
  const lecturas: [RegExp, unknown][] = [
    [/provider-cost-structures/, { data: [] }],
    [/configs-by-merchant/, { data: [] }],
    [/merchant-accounts\/ma1\/terminals/, { data: [] }],
  ]
  it.each(lecturas.map(([re]) => [String(re), re] as const))('cae %s', async (_n, caida) => {
    m.lecturas = lecturas
    m.caida = caida
    pintar(dialogo())
    await screen.findByText('loadFailure.empty')
    expect(seVe(/Eliminar cuenta/)).toBe(false)
    expect(screen.getByRole('button', { name: 'Dependencias sin verificar' })).toBeDisabled()
  })
  it('sin internet', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(dialogo())
    await waitFor(() => expect(screen.getAllByText('loadFailure.empty').length).toBeGreaterThan(0))
    expect(screen.getByRole('button', { name: 'Dependencias sin verificar' })).toBeDisabled()
  })
  it('leídas y sin dependencias: sí se ofrece', async () => {
    m.lecturas = lecturas
    pintar(dialogo())
    await screen.findByText('Eliminar cuenta')
    expect(screen.getByRole('button', { name: 'Eliminar Cuenta' })).toBeEnabled()
  })
})

describe('liquidación de una cuenta: no dice «actualizada» sin haber guardado', () => {
  const state = { settlement: { skipped: false, daysDebit: 1, daysCredit: 3, daysAmex: 3, daysInternational: 3, dayType: 'BUSINESS_DAYS', cutoffTime: '23:00', cutoffTimezone: 'America/Mexico_City' } } as never
  const fila = (cardType: string) => ({ id: `s-${cardType}`, cardType, effectiveTo: null })
  const URL_CONFIG = /settlement-configurations/
  const abrir = () => {
    pintar(<SettlementCard state={state} dispatch={() => undefined} mode="edit" merchantAccountId="ma1" />)
    fireEvent.click(screen.getByRole('button', { name: /Liquidación/ }))
  }
  it('lectura caída: avisa y no deja guardar', async () => {
    m.caida = URL_CONFIG
    abrir()
    await screen.findByText('loadFailure.empty')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })
  it('sin internet: igual', async () => {
    onlineManager.setOnline(false)
    abrir()
    await screen.findByText('loadFailure.empty')
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeDisabled()
  })
  it('leída: sí deja guardar', async () => {
    m.lecturas = [[URL_CONFIG, { data: ['DEBIT', 'CREDIT', 'AMEX', 'INTERNATIONAL'].map(fila) }]]
    abrir()
    await waitFor(() => expect(screen.getByRole('button', { name: 'Guardar cambios' })).toBeEnabled())
  })
})

describe('configuración de pagos del negocio', () => {
  const pantalla = () => (
    <MemoryRouter initialEntries={['/mi-negocio']}>
      <Routes>
        <Route path="/:slug" element={<VenuePaymentConfig />} />
      </Routes>
    </MemoryRouter>
  )
  it('caída: no invita a conectar lo que ya puede estar conectado', async () => {
    m.caida = /payment-config/
    pintar(pantalla())
    await screen.findByText('loadFailure.empty')
    expect(seVe(/Conecta los Pagos/)).toBe(false)
  })
  it('sin internet: igual', async () => {
    onlineManager.setOnline(false)
    pintar(pantalla())
    await screen.findByText('loadFailure.empty')
    expect(seVe(/Conecta los Pagos/)).toBe(false)
  })
  it('leída y sin configuración: sí invita a conectar', async () => {
    m.lecturas = [[/payment-config/, { data: null }]]
    pintar(pantalla())
    await screen.findByText('Conecta los Pagos')
    expect(screen.queryByText('loadFailure.empty')).toBeNull()
  })
})

describe('Google: el estado de la conexión', () => {
  const lecturas: [RegExp, unknown][] = [[/integrations\/google\/status/, { connected: false }]]
  it('caído: no dice «no conectado»', async () => {
    m.lecturas = lecturas
    m.caida = /integrations\/google\/status/
    pintar(raiz(<GoogleIntegration />))
    await screen.findByText('loadFailure.empty')
    expect(seVe(/status\.notConnected/)).toBe(false)
  })
  it('sin internet: igual', async () => {
    onlineManager.setOnline(false)
    pintar(raiz(<GoogleIntegration />))
    await waitFor(() => expect(screen.getAllByText('loadFailure.empty').length).toBeGreaterThan(0))
    expect(seVe(/status\.notConnected/)).toBe(false)
  })
  it('leído y sin conectar: sí lo dice', async () => {
    m.lecturas = lecturas
    pintar(raiz(<GoogleIntegration />))
    await screen.findByText('status.notConnected')
  })
})

describe('ajustes de terminal de la organización', () => {
  const lecturas: [RegExp, unknown][] = [[/org-tpv-defaults|tpv-defaults/, { data: {} }], [/org-tpv-stats|tpv-stats/, { data: { totalTerminals: 0, venues: [] } }]]
  it('sin internet: avisa en vez de enseñar los valores de fábrica', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(raiz(<OrgTpvConfigSection orgId="o1" />))
    await screen.findByText('settings.tpvLoadError')
  })
})

describe('Superadmin', () => {
  it('salud del servidor sin internet: su aviso, no un 0 %', async () => {
    onlineManager.setOnline(false)
    pintar(raiz(<ServerHealth />))
    await screen.findByText('Error al cargar métricas del servidor')
  })
  it('e-commerce sin internet: sin GMV $0', async () => {
    onlineManager.setOnline(false)
    pintar(raiz(<EcommerceMerchantsGlobal />))
    await screen.findAllByText(/Error al cargar/)
    expect(seVe(/GMV procesado/)).toBe(false)
  })
  it('e-commerce leído en cero: GMV de hoy', async () => {
    m.lecturas = [[/superadmin\/ecommerce-merchants/, { data: [] }]]
    pintar(raiz(<EcommerceMerchantsGlobal />))
    await screen.findByText('GMV procesado')
    expect(seVe(PESOS_EN_CERO)).toBe(true)
  })
})

describe('facturas sueltas del proveedor', () => {
  it('sin internet: avisa, no dice «sin facturas»', async () => {
    onlineManager.setOnline(false)
    pintar(raiz(<StandaloneInvoicesSection venueId="v1" />))
    await screen.findByText('invoices.receipt.loadError')
    expect(seVe(/invoices\.standalone\.empty/)).toBe(false)
  })
})

describe('Bancos: reportes', () => {
  const conexion = { id: 'c1', status: 'CONNECTED', accounts: [{ id: 'a1', name: 'Cuenta' }] }
  const lecturas: [RegExp, unknown][] = [
    [/financial-connections\/providers|financial-providers|providers/, { data: [{ id: 'p1' }] }],
    [/financial-connections$/, { data: [conexion] }],
    [/movement-stats|movements\/stats|stats/, { data: { speiIn: { amount: 0, count: 0 }, speiOut: { amount: 0, count: 0 }, internalTransfers: { amount: 0, count: 0 }, dispersions: { amount: 0, count: 0 } } }],
  ]
  it('sin internet y sin leer las conexiones: no dice que no hay cuenta', async () => {
    m.lecturas = lecturas
    onlineManager.setOnline(false)
    pintar(raiz(<BancosReportes />))
    await screen.findByRole('button', { name: 'hub.error.retry' })
    expect(seVe(PESOS_EN_CERO)).toBe(false)
  })
  it('sin internet con las conexiones ya leídas: los totales no dicen $0', async () => {
    m.lecturas = lecturas
    client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 60_000 } } })
    client.setQueryData(['financial-connections', 'v1'], [conexion])
    client.setQueryData(['financial-providers'], [{ id: 'p1' }])
    onlineManager.setOnline(false)
    render(<QueryClientProvider client={client}>{raiz(<BancosReportes />)}</QueryClientProvider>)
    await screen.findAllByText('hub.reports.statsError')
    expect(seVe(PESOS_EN_CERO)).toBe(false)
  })
})
