import type { ReactNode } from 'react'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesSummaryResponse } from '@/services/reports/salesSummary.service'

// Funciones normales, no vi.fn: `mockReset: true` vaciaría un vi.fn() del factory antes de cada prueba.
const h = vi.hoisted(() => ({
  response: null as unknown,
  access: true,
  merchants: [] as unknown[],
  statementProps: null as Record<string, unknown> | null,
  timezone: 'America/Mexico_City',
  /** Lo que pidió la pantalla en cada lectura (fechas, filtro). */
  pedidos: [] as Array<Record<string, unknown>>,
}))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // «llave(a=1,b=2)»: se lee qué llave se usó y con qué valores.
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object' ? `${k}(${Object.entries(o).map(([a, b]) => `${a}=${String(b)}`).join(',')})` : k,
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: h.timezone } }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: h.access, isLoading: false, isResolved: true }),
}))
vi.mock('@/services/reports/salesSummary.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/reports/salesSummary.service')>()),
  fetchSalesSummary: (f: Record<string, unknown>) => {
    h.pedidos.push(f)
    return h.response instanceof Error ? Promise.reject(h.response) : Promise.resolve(h.response)
  },
}))
vi.mock('@/services/paymentProvider.service', () => ({
  getVenueMerchantAccountsByVenueId: () => Promise.resolve(h.merchants),
  getVenueSettlementInfo: () => Promise.resolve([]),
}))
vi.mock('@/pages/Reports/components/SalesSummaryExportDialog', () => ({ SalesSummaryExportDialog: () => null }))
vi.mock('./components/PeriodBreakdownTable', () => ({ PeriodBreakdownTable: () => null }))
vi.mock('./statement/StatementSection', () => ({
  StatementSection: (props: Record<string, unknown>) => {
    h.statementProps = props
    return <div data-testid="estado-de-cuenta" />
  },
}))
vi.mock('@/components/settlement/SettlementWeekStrip', () => ({ SettlementWeekStrip: () => null }))
// El FeatureGate real pinta sus hijos borrosos y con `aria-hidden`: aquí se marca dónde quedan, para ver qué se lee y qué no.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ children }: { children: ReactNode }) => <div data-testid="feature-gate">{children}</div>,
}))
vi.mock('@/components/date-range-picker', () => ({ DateRangePicker: () => null }))
// El tooltip se pinta en línea para poder leer qué texto le tocó a cada renglón.
vi.mock('@/components/ui/tooltip', () => ({
  TooltipProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
  Tooltip: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: ReactNode }) => <span data-testid="tooltip">{children}</span>,
}))

import SalesSummary from './SalesSummary'

const SUMMARY: SalesSummaryResponse['summary'] = {
  grossSales: 10000, items: 10000, serviceCosts: 0, discounts: 0, netSales: 10000, deferredSales: 0, taxes: 1379.31, refunds: 0,
  tips: 800, platformFees: 300, staffCommissions: 0, commissions: 300, totalCollected: 10500, netProfit: 9700, transactionCount: 20,
  // Carril B (21-nov): lo que manda el servidor con base de caja. El caso del servidor viejo los quita.
  unpaidSales: 0, unpaidOrders: 0, tenderCommissions: 0, refundCount: 0,
}
const CON_TARJETAS = { ...SUMMARY, giftCardLoads: 2000, giftCardLoadsCount: 2, paidWithGiftCardBalance: 330 }
const BUCKETS: NonNullable<SalesSummaryResponse['byPaymentMethodDetailed']> = [
  { bucket: 'CASH', amount: 12500, count: 18, percentage: 100, tips: 800, refunds: 0, platformFees: 0 },
]
const respuesta = (over: Partial<SalesSummaryResponse> = {}): SalesSummaryResponse => ({
  dateRange: { startDate: '2026-10-01T06:00:00.000Z', endDate: '2026-10-08T05:59:59.999Z' },
  reportType: 'summary',
  summary: CON_TARJETAS,
  byPaymentMethodDetailed: BUCKETS,
  filtered: false,
  ...over,
})

/** La respuesta del server real (D7 §4) cuando el único cobro del rango fue con saldo: sin buckets, pero con lo pagado con saldo. */
const SOLO_SALDO = () =>
  respuesta({
    summary: {
      ...SUMMARY, grossSales: 69, items: 69, netSales: 69, taxes: 9.52, tips: 0, platformFees: 0, commissions: 0,
      totalCollected: 69, netProfit: 69, transactionCount: 1, giftCardLoads: 0, giftCardLoadsCount: 0, paidWithGiftCardBalance: 69,
    },
    byPaymentMethod: [],
    byPaymentMethodDetailed: [],
    giftCardBalanceBreakdown: { amount: 69, count: 1, tips: 0, refunds: 0 },
  })

const pintar = () =>
  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false, retryDelay: 0 } } })}>
      <MemoryRouter>
        <SalesSummary />
      </MemoryRouter>
    </QueryClientProvider>,
  )
/** La tarjeta de arriba: «Total de Ventas» y su barra (ahí no entra «Métodos de pago», que es dinero). */
const tarjetaDelTotal = async () => (await screen.findByText('salesSummary.totalSales')).closest('.space-y-5') as HTMLElement
/** El «N%» de la leyenda junto a un método (el tooltip, que aquí se pinta en línea, dice «$X (N.N%)» y no cuenta). */
const porcentajeEnLeyenda = (contenedor: HTMLElement, metodo: string) =>
  within(contenedor)
    .getAllByText(metodo)
    .map(el => el.nextElementSibling?.textContent ?? '')
    .find(texto => /^\d+%$/.test(texto))
/** `a` aparece antes que `b` en la página. */
const antes = (a: HTMLElement, b: HTMLElement) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  h.access = true
  h.merchants = []
  h.response = respuesta()
  h.pedidos = []
  h.timezone = 'America/Mexico_City'
})

describe('SalesSummary · cifras de tarjetas de regalo (D5 r1)', () => {
  it('🔴 I1 · «Tarjetas de regalo cargadas» va DEBAJO de «Total cobrado» y «Ganancia neta» (fuera de su cascada), con su conteo', async () => {
    pintar()
    const cargadas = await screen.findByText('salesSummary.rows.giftCardLoads')
    expect(antes(screen.getByText('salesSummary.rows.totalCollected'), cargadas)).toBe(true)
    expect(antes(screen.getByText('salesSummary.rows.netProfit'), cargadas)).toBe(true)
    expect(antes(cargadas, screen.getByText('salesSummary.rows.tips'))).toBe(false)
    // M6: el conteo de tarjetas cargadas que manda el server.
    expect(screen.getByText('2 salesSummary.giftCardsCountLabel(count=2)')).toBeInTheDocument()
  })

  it('🔴 I1 · con cifras de tarjetas ≠ 0, el tooltip de «Total cobrado» dice qué incluye y qué no', async () => {
    pintar()
    expect(await screen.findByText('salesSummary.tooltips.totalCollectedWithGiftCards')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.tooltips.totalCollected')).not.toBeInTheDocument()
  })

  it('control · sin tarjetas, el tooltip de «Total cobrado» de siempre y ningún renglón de tarjetas', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, giftCardLoads: 0, giftCardLoadsCount: 0, paidWithGiftCardBalance: 0 } })
    pintar()
    expect(await screen.findByText('salesSummary.tooltips.totalCollected')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.tooltips.totalCollectedWithGiftCards')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.rows.giftCardLoads')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.rows.paidWithGiftCardBalance')).not.toBeInTheDocument()
  })

  it('«Pagado con saldo» va justo debajo de «Ventas netas» (carril F: ya no hay «Total de las ventas»), con sangría', async () => {
    pintar()
    const pagado = await screen.findByText('salesSummary.rows.paidWithGiftCardBalance')
    expect(antes(screen.getByText('salesSummary.rows.netSales'), pagado)).toBe(true)
    expect(antes(pagado, screen.getByText('salesSummary.rows.tips'))).toBe(true)
  })

  it('🔴 M3 · con «Ventas netas» apagado en las métricas, «Pagado con saldo» no queda colgado bajo otro renglón', async () => {
    // `localStorage` es un vi.fn() de setup.ts (mockReset lo vacía en cada prueba): las preferencias guardadas se fingen aquí.
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales', 'taxes', 'tips', 'totalCollected'] }))
    pintar()
    await screen.findByText('salesSummary.rows.taxes')
    expect(screen.queryByText('salesSummary.rows.paidWithGiftCardBalance')).not.toBeInTheDocument()
  })

  it('🔴 M1 · con estado de cuenta (Pro), la línea de lo pagado con saldo sale justo después de él', async () => {
    h.response = respuesta({ giftCardBalanceBreakdown: { amount: 330, count: 3, tips: 30, refunds: 0 } })
    pintar()
    const estado = await screen.findByTestId('estado-de-cuenta')
    const linea = screen.getByText(/^salesSummary\.giftBalanceLine\(/)
    expect(antes(estado, linea)).toBe(true)
    expect(linea.textContent).toContain('count=3')
    expect(linea.textContent).toContain('$330.00')
  })

  it('🔴 M2 · si algo regresó al saldo, la línea lo dice (bruto y lo devuelto, sin restar en el panel)', async () => {
    h.response = respuesta({ giftCardBalanceBreakdown: { amount: 330, count: 3, tips: 30, refunds: 50 } })
    pintar()
    const linea = await screen.findByText(/^salesSummary\.giftBalanceLineWithRefunds\(/)
    expect(linea.textContent).toContain('$330.00')
    expect(linea.textContent).toContain('refunds=$50.00')
  })

  it('sin Reportes avanzados (Free), la línea sale en «Métodos de pago»', async () => {
    h.access = false
    h.response = respuesta({ giftCardBalanceBreakdown: { amount: 330, count: 3, tips: 30, refunds: 0 } })
    pintar()
    expect(await screen.findByText(/^salesSummary\.giftBalanceLine\(/)).toBeInTheDocument()
    expect(screen.queryByTestId('estado-de-cuenta')).not.toBeInTheDocument()
  })

  it('🔴 el renglón de cargas lleva su conteo sólo si es > 0: nunca «0 tarjetas» junto a un monto (lote ⭐ 5b)', async () => {
    // Sólo cancelaciones de cargas de otro periodo: neto negativo y 0 tarjetas cargadas en el rango.
    h.response = respuesta({ summary: { ...CON_TARJETAS, giftCardLoads: -500, giftCardLoadsCount: 0 } })
    pintar()
    await screen.findByText('salesSummary.rows.giftCardLoads')
    expect(screen.queryByText(/salesSummary\.giftCardsCountLabel/)).not.toBeInTheDocument()
  })

  it('🔴 sin renglón de cargas en pantalla (cargas = 0), el tooltip de «Total cobrado» no dice «(va en su renglón)» (lote ⭐ 5c)', async () => {
    h.response = respuesta({ summary: { ...CON_TARJETAS, giftCardLoads: 0, giftCardLoadsCount: 0 } })
    pintar()
    expect(await screen.findByText('salesSummary.tooltips.totalCollectedWithGiftCardsNoLoadsRow')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.tooltips.totalCollectedWithGiftCards')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.rows.giftCardLoads')).not.toBeInTheDocument()
  })

  it('🔴 (dinero) el único cobro del rango fue con saldo: sin buckets, la línea del saldo sale igual y «Métodos de pago» no enseña 0 % (lote ⭐ 5d)', async () => {
    h.response = SOLO_SALDO()
    pintar()
    const linea = await screen.findByText(/^salesSummary\.giftBalanceLine\(/)
    expect(linea.textContent).toContain('$69.00')
    expect(linea.textContent).toContain('count=1')
    expect(screen.getByText('salesSummary.paymentMethodsEmpty')).toBeInTheDocument()
    // Nada de «Tarjeta / Efectivo / Otro» en $0.00 y 0 %.
    expect(screen.queryByText('0 trans.')).not.toBeInTheDocument()
  })

  it('🔴 sin nada que repartir (los métodos suman 0, el rango de sólo saldo), la barra de arriba no pinta segmentos de 0 % (lote ⭐ r1)', async () => {
    h.response = SOLO_SALDO()
    pintar()
    await screen.findByText(/^salesSummary\.giftBalanceLine\(/)
    // Ni la barra ni su leyenda «Tarjeta 0 % · Efectivo 0 % · Otro 0 %».
    expect(screen.queryByText('salesSummary.paymentTypes.card')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.paymentTypes.cash')).not.toBeInTheDocument()
  })

  it('🔴 full-testing v2 #1 · la barra de arriba reparte lo VENDIDO: sin el efectivo de las cargas y con el saldo de tarjeta', async () => {
    h.response = respuesta({
      summary: { ...SUMMARY, totalCollected: 150, giftCardLoads: 950, giftCardLoadsCount: 3, paidWithGiftCardBalance: 150 },
      // dinero: $950 de cargas en efectivo · ventas: los $150 se pagaron con saldo.
      byPaymentMethod: [{ method: 'CASH', amount: 950, count: 3, percentage: 100 }],
      salesByPaymentMethod: [{ method: 'GIFT_CARD', amount: 150, count: 1, percentage: 100 }],
    })
    pintar()
    const total = await tarjetaDelTotal()
    // Antes: «Efectivo 100%» (los $950 de cargas bajo un total de $150). Ahora el saldo es el 100 % y el efectivo, 0 %.
    expect(porcentajeEnLeyenda(total, 'salesSummary.paymentTypes.giftCardBalance')).toBe('100%')
    expect(porcentajeEnLeyenda(total, 'salesSummary.paymentTypes.cash')).toBe('0%')
  })

  it('🔴 full-testing v2 #1 (Codex r1 #1) · con un método en negativo (una devolución del día) no se pinta un reparto imposible', async () => {
    h.response = respuesta({
      byPaymentMethod: [{ method: 'CASH', amount: -200, count: 1, percentage: 0 }],
      salesByPaymentMethod: [
        { method: 'CASH', amount: -200, count: 1, percentage: -200 },
        { method: 'GIFT_CARD', amount: 300, count: 1, percentage: 300 },
      ],
    })
    pintar()
    const total = await tarjetaDelTotal()
    expect(within(total).queryByText('salesSummary.paymentTypes.giftCardBalance')).not.toBeInTheDocument()
    expect(within(total).queryByText('salesSummary.paymentTypes.cash')).not.toBeInTheDocument()
  })

  it('control · con cobros reales la barra de arriba sí reparte por método', async () => {
    h.response = respuesta({ byPaymentMethod: [{ method: 'CASH', amount: 12500, count: 18, percentage: 100 }] })
    pintar()
    // La leyenda y el tooltip (que aquí se pinta en línea) dicen el método.
    expect((await screen.findAllByText('salesSummary.paymentTypes.cash')).length).toBeGreaterThan(0)
  })
})

/** El monto que pinta el renglón de `etiqueta` (la llave i18n), en la misma fila. */
const montoDe = (etiqueta: string) =>
  (screen.getByText(etiqueta).closest('.justify-between') as HTMLElement).querySelector('[data-monto]')?.textContent

describe('SalesSummary · cabecera (carril B, 21-nov: D6, D2, D1, D9.1)', () => {
  it('🔴 D6 · «Sin cobrar» lee unpaidSales (no deferredSales) con cuántas cuentas, y sale solo si hay cuentas abiertas', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, deferredSales: 747.5, unpaidSales: 695, unpaidOrders: 3 } })
    pintar()
    const fila = await screen.findByText('salesSummary.rows.deferredSales')
    expect(montoDe('salesSummary.rows.deferredSales')).toBe('$695.00')
    expect(within(fila.closest('.justify-between') as HTMLElement).getByText('3 salesSummary.unpaidOrdersLabel(count=3)')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.tooltips.deferredSales')).toBeInTheDocument()
  })

  it('D6 · sin cuentas abiertas y sin elegirla en Métricas, «Sin cobrar» no sale', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, unpaidSales: 0, unpaidOrders: 0 } })
    pintar()
    await screen.findByText('salesSummary.rows.netSales')
    expect(screen.queryByText('salesSummary.rows.deferredSales')).not.toBeInTheDocument()
  })

  it('D6 · con un servidor viejo (sin unpaidSales) y elegida en Métricas, «Sin cobrar» cae a deferredSales', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ selectedMetrics: ['grossSales', 'netSales', 'deferredSales', 'netProfit'] }),
    )
    const { unpaidSales, unpaidOrders, tenderCommissions, refundCount, ...viejo } = SUMMARY
    h.response = respuesta({ summary: { ...viejo, deferredSales: 80 } })
    pintar()
    await screen.findByText('salesSummary.rows.deferredSales')
    expect(montoDe('salesSummary.rows.deferredSales')).toBe('$80.00')
    // Codex r2 #9: sus cifras traen propina y cuentas abiertas en el bruto: las ayudas no afirman la regla nueva.
    expect(screen.getByText('salesSummary.tooltips.deferredSalesOld')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.tooltips.grossSalesOld')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.tooltips.deferredSales')).not.toBeInTheDocument()
    // Codex r3 #9: tampoco dice que «Neto cobrado» y «Ganancia neta» restan comisiones de terceros.
    expect(screen.getByText('salesSummary.tooltips.netProfitOld')).toBeInTheDocument()
  })

  it('🔴 D1 · «Comisiones de terceros» va bajo «Comisiones de plataforma», en negativo, sólo si no es 0', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, tenderCommissions: 27 } })
    pintar()
    const terceros = await screen.findByText('salesSummary.rows.tenderCommissions')
    expect(antes(screen.getByText('salesSummary.rows.platformFees'), terceros)).toBe(true)
    expect(antes(terceros, screen.getByText('salesSummary.rows.totalCollected'))).toBe(true)
    expect(montoDe('salesSummary.rows.tenderCommissions')).toBe('-$27.00')
    expect(screen.getByText('salesSummary.tooltips.tenderCommissions')).toBeInTheDocument()
  })

  it('D1 · en 0 (o con un servidor viejo) no hay renglón de terceros', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, tenderCommissions: 0 } })
    pintar()
    await screen.findByText('salesSummary.rows.platformFees')
    expect(screen.queryByText('salesSummary.rows.tenderCommissions')).not.toBeInTheDocument()
  })

  it('🔴 D9.1 · con un comercio elegido el servidor manda la vista de movimientos: sin renglones de orden y con el aviso', async () => {
    h.response = respuesta({
      filtered: true,
      summary: {
        ...SUMMARY, grossSales: null, items: null, serviceCosts: null, discounts: null, netSales: null, deferredSales: null,
        taxes: null, unpaidSales: null, unpaidOrders: null, totalCollected: 97, netProfit: 97, transactionCount: 1,
      },
    })
    pintar()
    await screen.findByText('salesSummary.rows.totalCollected')
    for (const k of ['grossSales', 'discounts', 'netSales', 'taxes', 'totalSales', 'deferredSales'])
      expect(screen.queryByText(`salesSummary.rows.${k}`)).not.toBeInTheDocument()
    expect(screen.getByText('salesSummary.controls.filterBy.hiddenMetricsMessage')).toBeInTheDocument()
    // Codex r4 #4: las ayudas dicen que «Neto cobrado» y «Ganancia neta» salen de los pagos del filtro, no de las ventas netas.
    expect(screen.getByText('salesSummary.tooltips.totalCollectedMovements')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.tooltips.netProfitMovements')).toBeInTheDocument()
    // Un cero en un renglón negativo es «$0.00», nunca «−$0.00» (visto en la pasada del navegador).
    expect(montoDe('salesSummary.rows.refunds')).toBe('$0.00')
  })
})

describe('Reporte de Ventas si falla la carga', () => {
  it('avisa con Reintentar en vez de quedarse cargando para siempre', async () => {
    h.response = new Error('500')
    h.access = true
    pintar()
    await screen.findByRole('alert')
    expect(screen.getByText('loadFailure.empty')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'retry' })).toBeInTheDocument()
    expect(screen.queryByLabelText('Cargando resumen')).toBeNull()
  })

  it('🔴 D3 · un cajero sin `reports:read` (403) ve «sin permiso» de inmediato, sin los 3 reintentos (~7 s de esqueleto)', async () => {
    h.response = Object.assign(new Error('403'), { response: { status: 403 } })
    // Con los reintentos POR DEFECTO de la app (`new QueryClient()` en dashboard-main.tsx), no con `retry: false`.
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MemoryRouter>
          <SalesSummary />
        </MemoryRouter>
      </QueryClientProvider>,
    )
    expect(await screen.findByText('loadFailure.forbidden', {}, { timeout: 800 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'retry' })).toBeNull()
  })
})

describe('SalesSummary · estado del periodo (carril C)', () => {
  it('le pasa al estado de cuenta los destinos de cada cobro que manda el SERVIDOR', async () => {
    const destinos = {
      drawer: { collected: 100, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 100, transactionCount: 1 },
      terminal: { collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0 },
      online: { collected: 200, refunds: 0, refundCount: 0, platformFee: 6, netToReceive: 194, transactionCount: 1 },
      other: { collected: 0, refunds: 0, refundCount: 0, platformFee: 0, netToReceive: 0, transactionCount: 0 },
      tenderCommissions: 0,
    }
    h.response = respuesta({ statementDestinations: destinos })
    pintar()
    await screen.findByTestId('estado-de-cuenta')
    expect(h.statementProps?.destinations).toEqual(destinos)
  })
})

// D3 (Resumen de ventas): tres controles que no hacían nada. «Terminales» sólo tenía «Todas»; «Agrupar las métricas por» se elegía,
// se «Aplicaba» y los números no cambiaban (la petición manda `groupBy: 'paymentMethod'` fijo); y el botón de gráfica por métrica
// no tenía ninguna gráfica que lo use. Una pantalla no puede ofrecer lo que no hace.
describe('Resumen de ventas · sólo controles que hacen algo (D3)', () => {
  const abrirPanelDeControles = async () => {
    await tarjetaDelTotal()
    // La píldora «Métricas» abre el panel lateral, que pinta TODOS sus subpaneles (los inactivos fuera de pantalla).
    fireEvent.click(screen.getByRole('button', { name: /salesSummary\.controls\.metrics\.label/ }))
    return screen.findByRole('dialog')
  }

  it('🔴 la fila de píldoras ya no trae «Terminales» ni «Agrupar las métricas por»; las demás siguen', async () => {
    pintar()
    await tarjetaDelTotal()
    expect(screen.queryByText('salesSummary.controls.terminal.label')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.controls.groupBy.label')).not.toBeInTheDocument()
    for (const llave of ['reportType', 'viewType', 'filterBy', 'metrics']) {
      expect(screen.getByText(`salesSummary.controls.${llave}.label`)).toBeInTheDocument()
    }
  })

  it('🔴 el panel de controles no trae renglones ni subpaneles de «Terminales» ni de «Agrupar…»', async () => {
    pintar()
    const panel = await abrirPanelDeControles()
    expect(within(panel).queryByText('salesSummary.controls.terminal.label')).not.toBeInTheDocument()
    expect(within(panel).queryByText('salesSummary.controls.groupBy.label')).not.toBeInTheDocument()
    expect(within(panel).queryByText('salesSummary.controls.terminal.longDescription')).not.toBeInTheDocument()
    expect(within(panel).queryByText('salesSummary.controls.groupBy.longDescription')).not.toBeInTheDocument()
    // Los renglones que sí hacen algo siguen en su lugar.
    expect(within(panel).getByText('salesSummary.controls.reportType.description')).toBeInTheDocument()
    expect(within(panel).getByText('salesSummary.controls.filterBy.description')).toBeInTheDocument()
  })

  it('🔴 «Métricas» ya no ofrece la gráfica por métrica ni explica un icono que no existe', async () => {
    pintar()
    const panel = await abrirPanelDeControles()
    expect(within(panel).queryByText('salesSummary.controls.metrics.chartHint')).not.toBeInTheDocument()
    // Cada métrica es una fila con su casilla y ningún botón (antes, las cuatro «graficables» traían el del icono de barras).
    for (const metrica of ['grossSales', 'netSales', 'totalCollected', 'netProfit']) {
      const fila = within(panel).getByText(`salesSummary.controls.metrics.options.${metrica}`).closest('.cursor-pointer') as HTMLElement
      expect(within(fila).queryByRole('button')).toBeNull()
    }
  })

  it('🔴 una preferencia vieja con terminal, groupBy y chartMetric no rompe la pantalla y se vuelve a guardar sin esas llaves', async () => {
    // `localStorage` es un vi.fn() de setup.ts (mockReset lo vacía en cada prueba): lo guardado antes se finge aquí.
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({
        selectedMetrics: ['grossSales', 'netSales', 'totalCollected'],
        chartMetric: 'netSales',
        viewType: 'pie',
        reportType: 'summary',
        groupBy: 'channel',
        terminal: 'all',
        paymentMethodFilter: null,
        cardTypeFilter: null,
      }),
    )
    pintar()
    await tarjetaDelTotal()
    // Lo que sí cuenta de lo viejo se respeta: tres métricas y la vista «circular».
    expect(screen.getByText('salesSummary.controls.viewType.options.pie')).toBeInTheDocument()
    const guardados = vi.mocked(localStorage.setItem).mock.calls
    const guardado = guardados[guardados.length - 1]
    expect(guardado?.[0]).toBe('avoqado:salesSummary:preferences')
    const prefs = JSON.parse(guardado?.[1] as string)
    expect(prefs.selectedMetrics).toEqual(['grossSales', 'netSales', 'totalCollected'])
    expect(prefs).not.toHaveProperty('groupBy')
    expect(prefs).not.toHaveProperty('chartMetric')
    expect(prefs).not.toHaveProperty('terminal')
  })

  it('🔴 Codex r0 · una selección guardada con métricas repetidas se limpia: la píldora cuenta una, no dos (si no, «Aplicar» dejaría cero)', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales', 'grossSales'] }))
    pintar()
    await tarjetaDelTotal()
    expect(screen.getByRole('button', { name: /salesSummary\.controls\.metrics\.label\s*1$/ })).toBeInTheDocument()
  })

  it('🔴 Codex r1 #1 · cada opción de los subpaneles tiene su propio id: «Todos» de Filtrar por no mueve el borrador de Comercio', async () => {
    h.merchants = [
      { id: 'm1', displayName: 'Comercio Uno', provider: { name: 'Blumon' } },
      { id: 'm2', displayName: 'Comercio Dos', provider: { name: 'AngelPay' } },
    ]
    pintar()
    const panel = await abrirPanelDeControles()
    // Los subpaneles viven todos en el DOM; si dos opciones comparten id, el `htmlFor` de una activa el radio de OTRA.
    const ids = within(panel).getAllByRole('radio', { hidden: true }).map(r => r.id)
    expect(ids.length).toBeGreaterThan(10)
    expect(new Set(ids).size).toBe(ids.length)
    // El caso de Codex: en Filtrar por, elegir Efectivo y volver a «Todos» regresa su borrador a «sin filtro» (Aplicar apagado).
    const filtrarPor = within(panel).getByText('salesSummary.controls.filterBy.longDescription').closest('.absolute') as HTMLElement
    fireEvent.click(within(filtrarPor).getByText('salesSummary.controls.filterBy.paymentMethod.options.cash'))
    expect(within(filtrarPor).getByRole('button', { name: 'salesSummary.controls.apply', hidden: true })).toBeEnabled()
    fireEvent.click(within(filtrarPor).getByText('salesSummary.controls.filterBy.paymentMethod.options.all'))
    expect(within(filtrarPor).getByRole('button', { name: 'salesSummary.controls.apply', hidden: true })).toBeDisabled()
  })

  it('🔴 Codex r1 #2 · una preferencia con `selectedMetrics` que no es lista descarta TODO lo guardado (no deja un filtro corrupto vivo)', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(
      JSON.stringify({ selectedMetrics: 'grossSales', paymentMethodFilter: 'CARD', cardTypeFilter: 42 }),
    )
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pintar()
    await tarjetaDelTotal()
    expect(screen.getByText('salesSummary.controls.viewType.options.gauge')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.controls.filterBy.active')).not.toBeInTheDocument()
  })

  it('control · una preferencia corrupta no tumba la pantalla (arranca con lo de siempre)', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue('{no es json')
    vi.spyOn(console, 'error').mockImplementation(() => {})
    pintar()
    await tarjetaDelTotal()
    expect(screen.getByText('salesSummary.controls.viewType.options.gauge')).toBeInTheDocument()
  })

  it('el aviso del plan Gratis se queda sin controles (Pro) y con sus tres promesas', async () => {
    h.access = false
    pintar()
    for (const promesa of ['history', 'periods', 'breakdowns', 'export']) {
      expect(await screen.findByText(new RegExp(`salesSummary\\.basic\\.upsell\\.${promesa}$`))).toBeInTheDocument()
    }
    expect(screen.queryByText('salesSummary.controls.reportType.label')).not.toBeInTheDocument()
  })
})

describe('SalesSummary · canales y lo cobrado por adelantado (carril G: D4, D5)', () => {
  it('🔴 D5 · «Paquetes vendidos en línea» y «Depósitos de reservas» van debajo de «Ganancia neta», con su conteo y su ayuda', async () => {
    h.response = respuesta({
      summary: { ...CON_TARJETAS, packagesSoldOnline: 2000, packagesSoldOnlineCount: 2, reservationDeposits: 220, reservationDepositsCount: 3, reservationDepositsRefunded: 230 },
    })
    pintar()
    const paquetes = await screen.findByText('salesSummary.rows.packagesSoldOnline')
    const depositos = screen.getByText('salesSummary.rows.reservationDeposits')
    expect(antes(screen.getByText('salesSummary.rows.netProfit'), paquetes)).toBe(true)
    expect(antes(screen.getByText('salesSummary.rows.netProfit'), depositos)).toBe(true)
    expect(screen.getByText('2 salesSummary.packagesCountLabel(count=2)')).toBeInTheDocument()
    expect(screen.getByText(/^3 salesSummary\.depositsCountLabelWithRefunds\(count=3,refunded=/)).toBeInTheDocument()
    expect(screen.getByText('salesSummary.tooltips.packagesSoldOnline')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.tooltips.reservationDeposits')).toBeInTheDocument()
  })

  it('🔴 D5 · un depósito cobrado y devuelto en el mismo periodo ($0 neto) no desaparece: dice su conteo y lo devuelto', async () => {
    h.response = respuesta({
      summary: { ...CON_TARJETAS, packagesSoldOnline: 0, packagesSoldOnlineCount: 0, reservationDeposits: 0, reservationDepositsCount: 1, reservationDepositsRefunded: 300 },
    })
    pintar()
    expect(await screen.findByText('salesSummary.rows.reservationDeposits')).toBeInTheDocument()
    expect(screen.queryByText('salesSummary.rows.packagesSoldOnline')).not.toBeInTheDocument()
    expect(screen.getByText(/^1 salesSummary\.depositsCountLabelWithRefunds\(count=1,refunded=/)).toBeInTheDocument()
  })

  it('🔴 Codex r2 #5 · los paquetes en otra moneda se dicen aparte y no se suman a los pesos', async () => {
    h.response = respuesta({
      summary: { ...CON_TARJETAS, packagesSoldOnline: 0, packagesSoldOnlineCount: 0, packagesSoldOnlineOtherCurrencies: [{ currency: 'USD', amount: 100, count: 1 }] },
    })
    pintar()
    expect(await screen.findByText('salesSummary.rows.packagesSoldOnline')).toBeInTheDocument()
    // Con su código (Codex r3 #5): «USD 100.00», nunca un «$100.00» que se lee como pesos.
    expect(screen.getByTestId('paquetes-otra-moneda')).toHaveTextContent('salesSummary.packagesOtherCurrency(amount=USD 100.00,count=1)')
  })

  it('🔴 Codex r3 #2 · un filtro de pago guardado que la petición no llevó (plan Gratis) no esconde los anticipos ni las tablas', async () => {
    h.access = false
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ paymentMethodFilter: 'CASH' }))
    const fila = { grossSales: 100, discounts: 0, refunds: 0, netSales: 100, tips: 0, platformFees: 0, tenderCommissions: 0, totalCollected: 100, orderCount: 1, transactionCount: 1, refundCount: 0 }
    h.response = respuesta({
      summary: { ...CON_TARJETAS, packagesSoldOnline: 1200, packagesSoldOnlineCount: 1 },
      filtered: false,
      byChannel: [{ key: 'COUNTER', ...fila }],
      byOrderType: [{ key: 'DINE_IN', ...fila }],
    })
    pintar()
    expect(await screen.findByText('salesSummary.rows.packagesSoldOnline')).toBeInTheDocument()
    expect(screen.getByTestId('ventas-por-canal')).toBeInTheDocument()
    expect(screen.queryByTestId('ventas-por-canal-filtro')).toBeNull()
  })

  it('control · sin paquetes ni depósitos (o con un servidor viejo) no hay renglones', async () => {
    pintar()
    await tarjetaDelTotal()
    expect(screen.queryByText('salesSummary.rows.packagesSoldOnline')).not.toBeInTheDocument()
    expect(screen.queryByText('salesSummary.rows.reservationDeposits')).not.toBeInTheDocument()
  })

  it('D4 · la sección «Ventas por canal» sale con lo que manda el servidor', async () => {
    const fila = { grossSales: 100, discounts: 0, refunds: 0, netSales: 100, tips: 0, platformFees: 0, tenderCommissions: 0, totalCollected: 100, orderCount: 1, transactionCount: 1, refundCount: 0 }
    h.response = respuesta({ byChannel: [{ key: 'RAPPI', ...fila }], byOrderType: [{ key: 'DELIVERY', ...fila }] })
    pintar()
    expect(await screen.findByTestId('ventas-por-canal')).toBeInTheDocument()
    expect(screen.getAllByText('salesSummary.channels.names.RAPPI').length).toBeGreaterThan(0)
  })

  it('🔴 D4 · plan Gratis (decisión del founder del 22-nov): ve sus tablas de hoy, sin candado', async () => {
    h.access = false
    const fila = { grossSales: 100, discounts: 0, refunds: 0, netSales: 100, tips: 0, platformFees: 0, tenderCommissions: 0, totalCollected: 100, orderCount: 1, transactionCount: 1, refundCount: 0 }
    h.response = respuesta({ byChannel: [{ key: 'COUNTER', ...fila }], byOrderType: [{ key: 'DINE_IN', ...fila }] })
    pintar()
    expect(await screen.findByTestId('ventas-por-canal')).toBeInTheDocument()
    expect(screen.queryByTestId('ventas-por-canal-candado')).toBeNull()
  })

  it('🔴 D4 · plan Gratis con un servidor que no trae las tablas: no hay candado ni texto de «plan Pro»', async () => {
    h.access = false
    pintar()
    await tarjetaDelTotal()
    expect(screen.queryByTestId('ventas-por-canal-candado')).toBeNull()
    expect(screen.queryByText('salesSummary.channels.lockedByPlan')).toBeNull()
  })
})

describe('SalesSummary · carril F, pantalla (hz:fefa11b6:D7, D14, D15, D16)', () => {
  const CEROS = { ...SUMMARY, discounts: 0, refunds: 0, platformFees: 0, staffCommissions: 0, commissions: 0, tenderCommissions: 0 }

  it('🔴 D7.1 · «Ventas netas» sale una vez: ya no hay «Total de las ventas» con el mismo número', async () => {
    pintar()
    await screen.findByText('salesSummary.rows.netSales')
    expect(screen.queryByText('salesSummary.rows.totalSales')).not.toBeInTheDocument()
  })

  it('🔴 D7.2 · el orden es la cuenta: impuestos dentro de «Ventas netas», empleados entre «Neto cobrado» y «Ganancia neta», «Sin cobrar» aparte', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, unpaidSales: 695, unpaidOrders: 3, staffCommissions: 50 } })
    pintar()
    const fila = (k: string) => screen.getByText(`salesSummary.rows.${k}`)
    await screen.findByText('salesSummary.rows.netSales')
    expect(antes(fila('netSales'), fila('taxes'))).toBe(true)
    expect(antes(fila('taxes'), fila('tips'))).toBe(true)
    expect(antes(fila('totalCollected'), fila('staffCommissions'))).toBe(true)
    expect(antes(fila('staffCommissions'), fila('netProfit'))).toBe(true)
    expect(antes(fila('netProfit'), fila('deferredSales'))).toBe(true)
    expect(screen.getByText('salesSummary.apart')).toBeInTheDocument()
    // Leyenda de los puntos (D16.15).
    for (const k of ['positive', 'negative', 'neutral']) expect(screen.getByText(`salesSummary.legend.${k}`)).toBeInTheDocument()
  })

  it('🔴 D16.1 · lo que resta y vale cero se pinta «$0.00», nunca «−$0.00»', async () => {
    h.response = respuesta({ summary: CEROS })
    pintar()
    await screen.findByText('salesSummary.rows.discounts')
    for (const k of ['refunds', 'discounts', 'platformFees', 'staffCommissions'])
      expect(montoDe(`salesSummary.rows.${k}`)).toBe('$0.00')
  })

  it('🔴 nota de D14 · una comisión de plataforma revertida (negativa) suma: «$3.00», no «−$3.00»', async () => {
    h.response = respuesta({ summary: { ...SUMMARY, platformFees: -3 } })
    pintar()
    await screen.findByText('salesSummary.rows.platformFees')
    expect(montoDe('salesSummary.rows.platformFees')).toBe('$3.00')
  })

  it('🔴 D7.5 · un periodo sin ventas lo dice con palabras', async () => {
    h.response = respuesta({
      summary: { ...CEROS, grossSales: 0, items: 0, netSales: 0, taxes: 0, tips: 0, totalCollected: 0, netProfit: 0, transactionCount: 0,
        giftCardLoads: 0, giftCardLoadsCount: 0, paidWithGiftCardBalance: 0 },
      byPaymentMethodDetailed: [],
    })
    pintar()
    expect(await screen.findByText('salesSummary.empty')).toBeInTheDocument()
  })

  it('control · con ventas no sale el aviso de periodo vacío', async () => {
    pintar()
    await tarjetaDelTotal()
    expect(screen.queryByText('salesSummary.empty')).not.toBeInTheDocument()
  })

  it('🔴 D7.7 / D15.3 / D16.6 · un filtro de pago guardado en el navegador ya no se restaura ni se vuelve a guardar', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales'], paymentMethodFilter: 'QR_LEGACY', cardTypeFilter: null }))
    pintar()
    await tarjetaDelTotal()
    expect(screen.queryByText(/salesSummary\.controls\.filterBy\.active/)).not.toBeInTheDocument()
    expect(h.pedidos.every(p => p.paymentMethod === undefined)).toBe(true)
    const guardados = vi.mocked(localStorage.setItem).mock.calls
    expect(JSON.parse(guardados[guardados.length - 1]?.[1] as string)).not.toHaveProperty('paymentMethodFilter')
  })

  it('🔴 nota de D16 (e) · una vista o un tipo de reporte guardados que no existen caen a lo de siempre', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ viewType: 'radar', reportType: 'quincenas' }))
    pintar()
    await tarjetaDelTotal()
    expect(screen.getByText('salesSummary.controls.viewType.options.gauge')).toBeInTheDocument()
    expect(h.pedidos[0]?.reportType).toBe('summary')
  })

  it('🔴 D15.2 · plan Gratis: los beneficios de Pro se leen, fuera del borroso del candado', async () => {
    h.access = false
    pintar()
    const beneficio = await screen.findByText(/salesSummary\.basic\.upsell\.history$/)
    expect(beneficio.closest('[data-testid="feature-gate"]')).toBeNull()
    expect(screen.getByTestId('feature-gate')).toBeInTheDocument()
  })

  it('🔴 D15 · plan Gratis: ve las métricas de siempre, no las que se guardaron en el navegador con otro negocio, y no las borra', async () => {
    h.access = false
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales', 'netSales'] }))
    pintar()
    expect(await screen.findByText('salesSummary.rows.tips')).toBeInTheDocument()
    expect(screen.getByText('salesSummary.rows.platformFees')).toBeInTheDocument()
    const guardados = vi.mocked(localStorage.setItem).mock.calls
    expect(JSON.parse(guardados[guardados.length - 1]?.[1] as string).selectedMetrics).toEqual(['grossSales', 'netSales'])
  })

  it('🔴 D15.1 · plan Gratis: pasada la medianoche del negocio, «Hoy» pide el día nuevo sin recargar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-23T05:59:00.000Z')) // 23:59 del 22-nov en la Ciudad de México
      h.access = false
      pintar()
      await tarjetaDelTotal()
      expect(h.pedidos[h.pedidos.length - 1]?.startDate).toBe('2026-11-22T06:00:00.000Z')
      vi.setSystemTime(new Date('2026-11-23T06:01:00.000Z')) // 00:01 del 23-nov
      fireEvent.focus(window)
      await waitFor(() => expect(h.pedidos[h.pedidos.length - 1]?.startDate).toBe('2026-11-23T06:00:00.000Z'))
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 D15 (ajeno del carril E) · un negocio con la zona guardada como «GMT-6» abre en el día de la Ciudad de México, sin tronar', async () => {
    vi.useFakeTimers({ toFake: ['Date'] })
    try {
      vi.setSystemTime(new Date('2026-11-23T18:00:00.000Z'))
      h.access = false
      h.timezone = 'GMT-6'
      pintar()
      await tarjetaDelTotal()
      expect(h.pedidos[h.pedidos.length - 1]?.startDate).toBe('2026-11-23T06:00:00.000Z')
    } finally {
      vi.useRealTimers()
    }
  })

  it('🔴 D16.7 / nota (c) · el botón ⋮ tiene nombre y abre los controles con lo que está aplicado', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales', 'tips'] }))
    pintar()
    await tarjetaDelTotal()
    fireEvent.click(screen.getByRole('button', { name: 'salesSummary.controls.title' }))
    const panel = await screen.findByRole('dialog')
    expect(within(panel).getByText('2 salesSummary.controls.metrics.selected')).toBeInTheDocument()
  })

  it('🔴 D16.5 · tocar la casilla de una métrica la cambia (antes sólo servía tocar el texto)', async () => {
    pintar()
    await tarjetaDelTotal()
    fireEvent.click(screen.getByRole('button', { name: /salesSummary\.controls\.metrics\.label/ }))
    const panel = await screen.findByRole('dialog')
    const casilla = within(panel).getByRole('checkbox', { name: 'salesSummary.controls.metrics.options.items', hidden: true })
    expect(casilla).toHaveAttribute('data-state', 'unchecked')
    fireEvent.click(casilla)
    expect(casilla).toHaveAttribute('data-state', 'checked')
  })

  it('🔴 D16.8 · los subpaneles que no se ven quedan fuera del tabulador (inert)', async () => {
    pintar()
    await tarjetaDelTotal()
    fireEvent.click(screen.getByRole('button', { name: /salesSummary\.controls\.metrics\.label/ }))
    const panel = await screen.findByRole('dialog')
    const subpanel = (texto: string) => within(panel).getByText(texto).closest('.absolute') as HTMLElement
    expect(subpanel('salesSummary.controls.metrics.longDescription')).not.toHaveAttribute('inert')
    expect(subpanel('salesSummary.controls.filterBy.longDescription')).toHaveAttribute('inert')
    expect(subpanel('salesSummary.controls.reportType.longDescription')).toHaveAttribute('inert')
  })

  it('🔴 nota de D16 (d) · con sólo «Artículos» elegido, su renglón sale (no depende de «Ventas brutas»)', async () => {
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['items'] }))
    pintar()
    expect(await screen.findByText('salesSummary.rows.items')).toBeInTheDocument()
  })

  it('🔴 D7.9 / D16.7 · las secciones y las ayudas se abren con teclado: son botones', async () => {
    pintar()
    await tarjetaDelTotal()
    const seccion = screen.getByRole('button', { name: /salesSummary\.sections\.summary/ })
    expect(seccion).toHaveAttribute('aria-expanded', 'true')
    expect(screen.getByRole('button', { name: 'salesSummary.rows.tips' })).toBeInTheDocument()
  })

  it('🔴 D16.3 · con el estado de cuenta en pantalla, la ayuda de «Neto cobrado» dice por qué no da lo mismo que «Te queda»', async () => {
    pintar()
    expect(await screen.findByText('salesSummary.tooltips.totalCollectedVsStatement')).toBeInTheDocument()
  })

  it('🔴 D16.2 · con un filtro de pago, «Métodos de pago» ya no repite «Quita el filtro…» en una tarjeta vacía', async () => {
    h.response = respuesta({
      filtered: true,
      summary: { ...SUMMARY, grossSales: null, items: null, serviceCosts: null, discounts: null, netSales: null, deferredSales: null, taxes: null },
    })
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['tips', 'totalCollected'] }))
    pintar()
    await tarjetaDelTotal()
    // Sin filtro aplicado en esta prueba (ya no se restaura): se aplica desde el panel.
    fireEvent.click(screen.getByRole('button', { name: /salesSummary\.controls\.filterBy\.label/ }))
    const panel = await screen.findByRole('dialog')
    const filtrarPor = within(panel).getByText('salesSummary.controls.filterBy.longDescription').closest('.absolute') as HTMLElement
    fireEvent.click(within(filtrarPor).getByText('salesSummary.controls.filterBy.paymentMethod.options.cash'))
    fireEvent.click(within(filtrarPor).getByRole('button', { name: 'salesSummary.controls.apply', hidden: true }))
    await waitFor(() => expect(h.pedidos[h.pedidos.length - 1]?.paymentMethod).toBe('CASH'))
    expect(await screen.findAllByText('salesSummary.controls.filterBy.filteredMessage')).toHaveLength(1)
    expect(screen.queryByText('salesSummary.sections.paymentMethods')).not.toBeInTheDocument()
  })
})
