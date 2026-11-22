import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SalesBreakdownRow } from '@/services/reports/salesSummary.service'
import { SalesByChannelSection } from './SalesByChannelSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object' ? `${k}(${Object.entries(o).map(([a, b]) => `${a}=${String(b)}`).join(',')})` : k,
    i18n: { language: 'es' },
  }),
}))
// El candado de verdad decide con el plan; aquí sólo importa que la sección lo use y que adentro no haya datos del negocio.
vi.mock('@/components/billing/FeatureGate', () => ({
  FeatureGate: ({ feature, children }: { feature: string; children: ReactNode }) => <div data-testid={`candado-${feature}`}>{children}</div>,
}))
// Las pestañas de Radix necesitan eventos de puntero: aquí se cambian con un clic llano.
vi.mock('@/components/ui/tabs', () => ({
  Tabs: ({ children, onValueChange }: { children: ReactNode; onValueChange: (v: string) => void }) => (
    <div onClick={e => (e.target as HTMLElement).dataset.value && onValueChange((e.target as HTMLElement).dataset.value!)}>{children}</div>
  ),
  TabsList: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  TabsTrigger: ({ value, children }: { value: string; children: ReactNode }) => (
    <button type="button" data-value={value}>
      {children}
    </button>
  ),
}))

const fmt = (n: number) => `$${n.toFixed(2)}`
const fila = (key: string, over: Partial<SalesBreakdownRow> = {}): SalesBreakdownRow => ({
  key,
  grossSales: 0,
  discounts: 0,
  refunds: 0,
  netSales: 0,
  tips: 0,
  platformFees: 0,
  tenderCommissions: 0,
  totalCollected: 0,
  orderCount: 1,
  transactionCount: 1,
  refundCount: 0,
  ...over,
})
const CANALES = [
  fila('TABLES', { netSales: 285, tips: 20, platformFees: 7.13, totalCollected: 297.87, orderCount: 2, transactionCount: 2 }),
  fila('RAPPI', { netSales: 225, tenderCommissions: 56.25, totalCollected: 168.75 }),
  fila('COUNTER', { netSales: -30, totalCollected: -30, orderCount: 0, transactionCount: 0, refundCount: 1 }),
]
const TIPOS = [fila('DINE_IN', { netSales: 255, totalCollected: 255 }), fila('QUICK_PAYMENT', { netSales: 225, totalCollected: 225 })]

const pintar = (over: Partial<Parameters<typeof SalesByChannelSection>[0]> = {}) =>
  render(
    <SalesByChannelSection
      byChannel={CANALES}
      byOrderType={TIPOS}
      sinPlan={false}
      bloqueadoPorElServidor={false}
      conFiltro={false}
      formatCurrency={fmt}
      {...over}
    />,
  )

describe('SalesByChannelSection (carril G · D4)', () => {
  it('cada canal con su nombre llano, sus cifras y la fila «Total» que suma los renglones (lo mismo que el resumen)', () => {
    pintar()
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    expect(within(tabla).getByText('salesSummary.channels.names.TABLES')).toBeInTheDocument()
    const mesas = within(tabla).getByTestId('canal-TABLES')
    expect(within(mesas).getByText('$285.00')).toBeInTheDocument()
    expect(within(mesas).getByText('$297.87')).toBeInTheDocument()
    expect(within(mesas).getByText(/salesSummary.channels.orders\(count=2\)/)).toBeInTheDocument()
    // 285 + 225 − 30 = 480; neto cobrado 297.87 + 168.75 − 30 = 436.62.
    const total = within(tabla).getByTestId('canal-total')
    expect(within(total).getByText('$480.00')).toBeInTheDocument()
    expect(within(total).getByText('$436.62')).toBeInTheDocument()
  })

  it('el % es de las ventas netas y no se pinta en un renglón negativo (sólo una devolución)', () => {
    pintar()
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    expect(within(within(tabla).getByTestId('canal-TABLES')).getByText('59.4%')).toBeInTheDocument()
    expect(within(within(tabla).getByTestId('canal-COUNTER')).queryByText(/%$/)).not.toBeInTheDocument()
  })

  it('la columna de comisiones de terceros sale sólo si algún renglón la tiene', () => {
    pintar()
    expect(within(screen.getByTestId('ventas-por-canal-tabla')).getByText('salesSummary.channels.cols.tenderCommissions')).toBeInTheDocument()
    pintar({ byChannel: [CANALES[0]] })
    expect(within(screen.getAllByTestId('ventas-por-canal-tabla')[1]).queryByText('salesSummary.channels.cols.tenderCommissions')).toBeNull()
  })

  it('«Por tipo de pedido» cambia la tabla', () => {
    pintar()
    fireEvent.click(screen.getByText('salesSummary.channels.tabs.orderType'))
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    expect(within(tabla).getByText('salesSummary.channels.orderTypes.QUICK_PAYMENT')).toBeInTheDocument()
    expect(within(tabla).queryByText('salesSummary.channels.names.RAPPI')).toBeNull()
  })

  it('🔴 plan Gratis: la sección se ve con su candado y sin datos del negocio', () => {
    pintar({ sinPlan: true, byChannel: undefined, byOrderType: undefined })
    const seccion = screen.getByTestId('ventas-por-canal-candado')
    expect(within(seccion).getByText('salesSummary.channels.title')).toBeInTheDocument()
    const candado = within(seccion).getByTestId('candado-ADVANCED_REPORTS')
    expect(within(candado).queryByText(/\$\d/)).toBeNull()
  })

  it('🔴 si el servidor lo dejó fuera por el plan (la pantalla no lo sabía), lo dice en vez de desaparecer', () => {
    pintar({ bloqueadoPorElServidor: true, byChannel: undefined, byOrderType: undefined })
    expect(within(screen.getByTestId('ventas-por-canal-candado')).getByText('salesSummary.channels.lockedByPlan')).toBeInTheDocument()
  })

  it('con un filtro de método o comercio explica por qué no hay desglose', () => {
    pintar({ conFiltro: true, byChannel: undefined, byOrderType: undefined })
    expect(screen.getByText('salesSummary.channels.filteredNote')).toBeInTheDocument()
  })

  it('sin ventas en el periodo dice que no hubo; con un servidor viejo (sin las tablas) no pinta nada', () => {
    pintar({ byChannel: [], byOrderType: [] })
    expect(screen.getByText('salesSummary.channels.empty')).toBeInTheDocument()
    const { container } = render(
      <SalesByChannelSection sinPlan={false} bloqueadoPorElServidor={false} conFiltro={false} formatCurrency={fmt} />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it('el QR del sistema anterior no inventa pedidos (no los trae): sólo sus cobros', () => {
    pintar({ byChannel: [fila('QR_LEGACY', { netSales: 300, totalCollected: 330, tips: 30, orderCount: null, transactionCount: 3 })] })
    const qr = within(screen.getByTestId('ventas-por-canal-tabla')).getByTestId('canal-QR_LEGACY')
    expect(within(qr).queryByText(/channels.orders/)).toBeNull()
    expect(within(qr).getByText('salesSummary.channels.transactions(count=3)')).toBeInTheDocument()
  })
})
