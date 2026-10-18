import type { ReactNode } from 'react'
import { render, screen, within } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SalesSummaryResponse } from '@/services/reports/salesSummary.service'

// Funciones normales, no vi.fn: `mockReset: true` vaciaría un vi.fn() del factory antes de cada prueba.
const h = vi.hoisted(() => ({ response: null as unknown, access: true }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    // «llave(a=1,b=2)»: se lee qué llave se usó y con qué valores.
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object' ? `${k}(${Object.entries(o).map(([a, b]) => `${a}=${String(b)}`).join(',')})` : k,
    i18n: { language: 'es' },
  }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1', fullBasePath: '/venues/x' }) }))
vi.mock('@/context/AuthContext', () => ({ useAuth: () => ({ activeVenue: { timezone: 'America/Mexico_City' } }) }))
vi.mock('@/hooks/use-tier-feature-access', () => ({
  useTierFeatureAccess: () => ({ hasAccess: h.access, isLoading: false, isResolved: true }),
}))
vi.mock('@/services/reports/salesSummary.service', async importOriginal => ({
  ...(await importOriginal<typeof import('@/services/reports/salesSummary.service')>()),
  fetchSalesSummary: () => Promise.resolve(h.response),
}))
vi.mock('@/services/paymentProvider.service', () => ({
  getVenueMerchantAccountsByVenueId: () => Promise.resolve([]),
  getVenueSettlementInfo: () => Promise.resolve([]),
}))
vi.mock('@/pages/Reports/components/SalesSummaryExportDialog', () => ({ SalesSummaryExportDialog: () => null }))
vi.mock('./components/PeriodBreakdownTable', () => ({ PeriodBreakdownTable: () => null }))
vi.mock('./statement/StatementSection', () => ({ StatementSection: () => <div data-testid="estado-de-cuenta" /> }))
vi.mock('@/components/settlement/SettlementWeekStrip', () => ({ SettlementWeekStrip: () => null }))
vi.mock('@/components/billing/FeatureGate', () => ({ FeatureGate: ({ children }: { children: ReactNode }) => <>{children}</> }))
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
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
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
  h.response = respuesta()
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

  it('«Pagado con saldo» va justo debajo de «Total de las ventas», con sangría', async () => {
    pintar()
    const pagado = await screen.findByText('salesSummary.rows.paidWithGiftCardBalance')
    expect(antes(screen.getByText('salesSummary.rows.totalSales'), pagado)).toBe(true)
    expect(antes(pagado, screen.getByText('salesSummary.rows.tips'))).toBe(true)
  })

  it('🔴 M3 · con «Total cobrado» apagado en las métricas, «Pagado con saldo» no queda colgado bajo otro renglón', async () => {
    // `localStorage` es un vi.fn() de setup.ts (mockReset lo vacía en cada prueba): las preferencias guardadas se fingen aquí.
    vi.mocked(localStorage.getItem).mockReturnValue(JSON.stringify({ selectedMetrics: ['grossSales', 'netSales', 'taxes', 'tips'] }))
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
