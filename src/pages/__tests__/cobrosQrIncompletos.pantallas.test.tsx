/**
 * D15 (16-nov-2026): cada pantalla que recibe `legacyUnavailable` lo dice.
 *
 * El servidor marca así una respuesta cuando no pudo leer todos los cobros del sistema anterior de QR (el puente legacy de
 * Mindform). El panel no leía la marca en ningún lado: el total salía como si estuviera completo. El aviso no bloquea: las
 * cifras que sí llegaron siguen a la vista, y «Reintentar» vuelve a pedirlas.
 *
 * Mismo arnés que recargaFalloDeCarga.test.tsx: la pantalla y TanStack son de verdad; sólo se finge la red (`@/api`) y quién mira.
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
    venue,
    t: (k: string, o?: unknown) => (typeof o === 'string' ? o : ((o as { defaultValue?: string } | undefined)?.defaultValue ?? k)),
    cuerpoVacio: { success: true, data: [], items: [], rows: [], events: [], staff: [], venues: [], stores: [], total: 0, meta: {} } as unknown,
  }
})

vi.mock('@/api', () => {
  // La clave lleva los parámetros: el periodo actual y el de comparación de Inicio piden la MISMA ruta con otras fechas.
  const responder = async (url: string, config?: { params?: Record<string, unknown> }) => {
    const clave = config?.params ? `${url}?${new URLSearchParams(config.params as Record<string, string>)}` : url
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
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: null, isConnected: false }), SocketProvider: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/hooks/use-socket-events', () => ({ useSocketEvents: () => undefined }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/PermissionGate', () => ({ PermissionGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/pages/Reports/components/ExchangesToReviewSection', () => ({ ExchangesToReviewSection: () => null }))
vi.mock('@/components/KYCStatusBanner', () => ({ KYCStatusBanner: () => null }))
// Inicio (gráficas): se finge sólo lo que no es de este aviso — el encabezado, las tarjetas y el dibujo de cada gráfica.
vi.mock('@/components/home/sections/DashboardHeader', () => ({ DashboardHeader: () => <div data-testid="filtro-fechas" /> }))
vi.mock('@/components/home/sections/DashboardMetrics', () => ({ DashboardMetrics: () => <div data-testid="tarjetas" /> }))
vi.mock('@/components/home/charts', () => {
  const nombres = [
    'BestSellingProductsChart',
    'PeakHoursChart',
    'TipsOverTimeChart',
    'RevenueTrendsChart',
    'AOVTrendsChart',
    'OrderFrequencyChart',
    'CustomerSatisfactionChart',
    'KitchenPerformanceChart',
    'SalesByWeekdayChart',
    'CategoryMixChart',
    'ChannelMixChart',
    'SalesHeatmapChart',
    'DiscountAnalysisChart',
    'ReservationOverviewChart',
    'StaffRankingTable',
  ]
  return Object.fromEntries(nombres.map(nombre => [nombre, () => <div data-testid={nombre} />]))
})
vi.mock('@/hooks/use-intersection-observer', async original => ({
  ...(await original<typeof import('@/hooks/use-intersection-observer')>()),
  useProgressiveLoader: () => [{ current: null }, true],
}))
vi.mock('@/hooks/use-dashboard-pack', () => ({
  useDashboardPack: () => ({
    resolvedDashboard: {
      heroKpis: [],
      rows: [
        {
          id: 'fila-propinas',
          layout: 'full',
          items: [
            {
              id: 'tips_over_time',
              titleKey: 'sections.tipsOverTime',
              requiredDataModules: [],
              dataSource: { type: 'chart', endpoint: 'tips-over-time' },
              componentId: 'TipsOverTimeChart',
              skeletonType: 'chart',
            },
          ],
        },
      ],
    },
  }),
}))
vi.mock('@/utils/datetime', async original => {
  // El periodo actual cae en 2026 y el de comparación en 2020: así la red fingida sabe cuál le piden.
  const rango = (anio: number) => ({ from: new Date(Date.UTC(anio, 9, 1)), to: new Date(Date.UTC(anio, 9, 8)) })
  return {
    ...(await original<typeof import('@/utils/datetime')>()),
    getToday: () => rango(2026),
    getLast7Days: () => rango(2026),
    getLast30Days: () => rango(2026),
    getYesterday: () => rango(2020),
    getPreviousPeriod: () => rango(2020),
  }
})
vi.mock('react-i18next', async original => ({
  ...(await original<typeof import('react-i18next')>()),
  useTranslation: () => ({ t: red.t, i18n: { language: 'es', changeLanguage: () => {} } }),
  Trans: () => null,
}))

import Payments from '@/pages/Payment/Payments'
import HomeDashboardCharts from '@/pages/Reports/HomeDashboardCharts'
import PaymentMethods from '@/pages/Reports/PaymentMethods'
import SalesSummary from '@/pages/Reports/SalesSummary'

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
// jsdom no trae las ligas de descarga: el CSV se arma en el navegador y se entrega con un `blob:`.
URL.createObjectURL = () => 'blob:x'
URL.revokeObjectURL = () => {}

vi.setConfig({ testTimeout: 60_000 })
configure({ asyncUtilTimeout: 8_000 })

const AVISO = 'loadFailure.legacyQr'
const MARCA = { legacyUnavailable: true }

let client: QueryClient
function pintar(pantalla: ReactElement, rutas: Ruta[]) {
  red.rutas = rutas
  client = new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 1, gcTime: 0 } } })
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>{pantalla}</MemoryRouter>
    </QueryClientProvider>,
  )
}
const sinConsultasEnCamino = () => waitFor(() => expect(client.isFetching()).toBe(0))
const avisos = () => screen.queryAllByText(AVISO)

beforeEach(() => onlineManager.setOnline(true))
afterEach(() => {
  cleanup()
  client?.clear()
})

// ─── Resumen de ventas ───
describe('Resumen de ventas', () => {
  const RESUMEN = /reports\/sales-summary/
  const reporte = (extra: object = {}) => ({
    data: {
      dateRange: {},
      reportType: 'summary',
      summary: { totalCollected: 1500, netSales: 1500, grossSales: 1500, transactionCount: 3 },
      byPaymentMethod: [],
      byMerchantAccount: [],
      filtered: false,
      ...extra,
    },
  })

  it('🔴 con la marca: avisa debajo del filtro, y el total que sí llegó sigue a la vista', async () => {
    pintar(<SalesSummary />, [[RESUMEN, reporte(MARCA)]])
    const aviso = await screen.findByText(AVISO)
    expect(aviso.closest('[role="alert"]')).toBeInTheDocument()
    expect(document.body.textContent).toMatch(/1,500/)
    expect(screen.getAllByTestId('filtro-fechas')[0].compareDocumentPosition(aviso) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('sin la marca no hay aviso', async () => {
    pintar(<SalesSummary />, [[RESUMEN, reporte()]])
    await waitFor(() => expect(document.body.textContent).toMatch(/1,500/))
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(0)
  })

  it('«Reintentar» vuelve a pedir el reporte y, si ya llega completo, el aviso se va', async () => {
    pintar(<SalesSummary />, [[RESUMEN, reporte(MARCA)]])
    const aviso = await screen.findByText(AVISO)
    red.rutas = [[RESUMEN, reporte()]]
    fireEvent.click(aviso.closest('[role="alert"]')!.querySelector('button')!)
    await waitFor(() => expect(avisos()).toHaveLength(0))
  })
})

// ─── Métodos de pago (Codex r1 #2) ───
describe('Reporte «Métodos de pago»', () => {
  const RESUMEN = /reports\/sales-summary/
  const reporte = (extra: object = {}) => ({
    data: {
      dateRange: {},
      summary: { refunds: 0, tips: 0, platformFees: 0, totalCollected: 1500, transactionCount: 3 },
      byPaymentMethodDetailed: [{ bucket: 'CASH', amount: 1500, count: 3, percentage: 100, tips: 0, refunds: 0, platformFees: 0 }],
      ...extra,
    },
  })

  /** Lo que la pantalla le entrega al navegador al pulsar «descargar». */
  async function descargarCsv(): Promise<string> {
    let contenido = ''
    class BlobFalso {
      constructor(partes: string[]) {
        contenido = partes.join('')
      }
    }
    vi.stubGlobal('Blob', BlobFalso)
    const descargar = screen.getAllByRole('button').find(boton => boton.querySelector('.lucide-download'))!
    fireEvent.click(descargar)
    vi.unstubAllGlobals()
    return contenido
  }

  it('🔴 con la marca: la pantalla avisa y su CSV empieza con la advertencia', async () => {
    pintar(<PaymentMethods />, [[RESUMEN, reporte(MARCA)]])
    await screen.findByText(AVISO)
    expect(document.body.textContent).toMatch(/1,500/)

    const csv = await descargarCsv()
    expect(csv.split('\n')[0]).toContain(`common:${AVISO}`)
    expect(csv).toContain('1500.00')
  })

  it('sin la marca: ni la pantalla ni el CSV dicen nada', async () => {
    pintar(<PaymentMethods />, [[RESUMEN, reporte()]])
    await waitFor(() => expect(document.body.textContent).toMatch(/1,500/))
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(0)
    expect(await descargarCsv()).not.toContain(AVISO)
  })
})

// ─── Pagos: el resumen (pestañas y tarjetas) y la lista ───
describe('Pagos', () => {
  const RESUMEN = /payments\/summary/
  const LISTA = /\/payments\?/
  const resumen = (extra: object = {}) => ({
    success: true,
    data: { groups: [], filteredGroups: [], total: 0, filteredTotal: 0, ...extra },
  })
  const lista = (extra: object = {}) => ({ data: [], meta: { total: 0, page: 1, pageSize: 50, pageCount: 0, ...extra } })

  it('🔴 el resumen viene marcado: avisa', async () => {
    pintar(<Payments />, [
      [RESUMEN, resumen(MARCA)],
      [LISTA, lista()],
    ])
    await screen.findByText(AVISO)
  })

  it('🔴 la lista viene marcada (el servidor ya lo mandaba y nadie lo leía): avisa', async () => {
    pintar(<Payments />, [
      [RESUMEN, resumen()],
      [LISTA, lista(MARCA)],
    ])
    await screen.findByText(AVISO)
  })

  it('las dos marcadas: un solo aviso, no dos', async () => {
    pintar(<Payments />, [
      [RESUMEN, resumen(MARCA)],
      [LISTA, lista(MARCA)],
    ])
    await screen.findByText(AVISO)
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(1)
  })

  it('sin marcas no hay aviso', async () => {
    pintar(<Payments />, [
      [RESUMEN, resumen()],
      [LISTA, lista()],
    ])
    await sinConsultasEnCamino()
    await waitFor(() => expect(document.body.textContent).toContain('filters.of'))
    expect(avisos()).toHaveLength(0)
  })
})

// ─── Inicio (gráficas): tarjetas, periodo de comparación y cada gráfica ───
describe('Inicio › gráficas', () => {
  const ACTUAL = /basic-metrics\?fromDate=2026/
  const COMPARA = /basic-metrics\?fromDate=2020/
  const PROPINAS = /charts\/tips-over-time/
  const tarjetas = (extra: object = {}) => ({
    payments: [],
    reviews: [],
    paymentMethodsData: [],
    summary: { totalAmount: 1000, totalTransactions: 3, totalTips: 0, avgTipPercentage: 0 },
    ...extra,
  })
  const propinas = (extra: object = {}) => ({ payments: [{ createdAt: '2026-10-02T18:00:00.000Z', tips: [{ amount: 10 }] }], ...extra })

  it('🔴 las tarjetas del periodo actual vienen marcadas: avisa', async () => {
    pintar(<HomeDashboardCharts />, [
      [ACTUAL, tarjetas(MARCA)],
      [COMPARA, tarjetas()],
      [PROPINAS, propinas()],
    ])
    await screen.findByText(AVISO)
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(1)
    expect(screen.getByTestId('tarjetas')).toBeInTheDocument()
  })

  it('🔴 Codex r1 #5 — sólo el periodo de COMPARACIÓN viene marcado: también avisa', async () => {
    pintar(<HomeDashboardCharts />, [
      [ACTUAL, tarjetas()],
      [COMPARA, tarjetas(MARCA)],
      [PROPINAS, propinas()],
    ])
    await screen.findByText(AVISO)
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(1)
  })

  it('🔴 Codex r1 #1 — las tarjetas llegaron sanas y la gráfica de propinas viene marcada: avisa junto a la gráfica', async () => {
    pintar(<HomeDashboardCharts />, [
      [ACTUAL, tarjetas()],
      [COMPARA, tarjetas()],
      [PROPINAS, propinas(MARCA)],
    ])
    const aviso = await screen.findByText(AVISO)
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(1)
    // El aviso es de ESA gráfica: va antes de su dibujo, y la gráfica se sigue viendo.
    const grafica = screen.getByTestId('TipsOverTimeChart')
    expect(aviso.compareDocumentPosition(grafica) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('todo sano: sin aviso, y la gráfica se dibuja', async () => {
    pintar(<HomeDashboardCharts />, [
      [ACTUAL, tarjetas()],
      [COMPARA, tarjetas()],
      [PROPINAS, propinas()],
    ])
    await screen.findByTestId('TipsOverTimeChart')
    await sinConsultasEnCamino()
    expect(avisos()).toHaveLength(0)
  })
})
