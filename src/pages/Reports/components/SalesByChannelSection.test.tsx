import { fireEvent, render, screen, within } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { SalesBreakdownRow } from '@/services/reports/salesSummary.service'
import { SalesByChannelSection } from './SalesByChannelSection'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (k: string, o?: unknown) =>
      o && typeof o === 'object'
        ? `${k}(${Object.entries(o)
            .map(([a, b]) => `${a}=${String(b)}`)
            .join(',')})`
        : k,
    i18n: { language: 'es' },
  }),
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
  render(<SalesByChannelSection byChannel={CANALES} byOrderType={TIPOS} conFiltro={false} formatCurrency={fmt} {...over} />)

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

  it('el % es de las ventas netas cuando todos los renglones son ≥ 0', () => {
    pintar({ byChannel: CANALES.slice(0, 2) })
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    // 285 / (285 + 225) = 55.9 %
    expect(within(within(tabla).getByTestId('canal-TABLES')).getByText('55.9%')).toBeInTheDocument()
  })

  it('🔴 Codex r3 #6 · en celular cada tarjeta también dice su % (no sólo la barra)', () => {
    pintar({ byChannel: CANALES.slice(0, 2) })
    const lista = screen.getByTestId('ventas-por-canal-lista')
    expect(within(lista).getByText('55.9%')).toBeInTheDocument()
    expect(within(lista).getByText('44.1%')).toBeInTheDocument()
  })

  it('🔴 Codex r2 #10 · con un renglón negativo (sólo una devolución) no se pinta ningún %, ni en escritorio ni en celular', () => {
    pintar()
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    expect(within(tabla).queryByText(/%$/)).not.toBeInTheDocument()
    const lista = screen.getByTestId('ventas-por-canal-lista')
    expect(lista.querySelector('.bg-sky-500')).toBeNull()
  })

  it('🔴 Codex r2 #11 · en celular el Total trae las mismas cifras que en escritorio', () => {
    pintar()
    const total = screen.getByTestId('canal-total-celular')
    expect(within(total).getByText('$480.00')).toBeInTheDocument()
    expect(within(total).getByText('$436.62')).toBeInTheDocument()
    expect(within(total).getByText('$20.00')).toBeInTheDocument()
    expect(within(total).getByText(/salesSummary.channels.transactions/)).toBeInTheDocument()
  })

  it('🔴 todos los planes (decisión del founder del 22-nov): nunca hay candado de plan ni un texto de «plan Pro»', () => {
    const { container } = render(<SalesByChannelSection conFiltro={false} formatCurrency={fmt} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('ventas-por-canal-candado')).toBeNull()
    expect(screen.queryByText('salesSummary.channels.lockedByPlan')).toBeNull()
  })

  it('🔴 Codex r2 #1 · si el SERVIDOR avisa que las tablas se leyeron a destiempo, lo dice arriba de la tabla', () => {
    pintar({ desfasado: true })
    expect(screen.getByTestId('ventas-por-canal-desfasado')).toHaveTextContent('salesSummary.channels.outOfSync')
  })

  it('la columna de comisiones de terceros sale sólo si algún renglón la tiene', () => {
    pintar()
    expect(
      within(screen.getByTestId('ventas-por-canal-tabla')).getByText('salesSummary.channels.cols.tenderCommissions'),
    ).toBeInTheDocument()
    pintar({ byChannel: [CANALES[0]] })
    expect(
      within(screen.getAllByTestId('ventas-por-canal-tabla')[1]).queryByText('salesSummary.channels.cols.tenderCommissions'),
    ).toBeNull()
  })

  it('«Por tipo de pedido» cambia la tabla', () => {
    pintar()
    fireEvent.click(screen.getByText('salesSummary.channels.tabs.orderType'))
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    expect(within(tabla).getByText('salesSummary.channels.orderTypes.QUICK_PAYMENT')).toBeInTheDocument()
    expect(within(tabla).queryByText('salesSummary.channels.names.RAPPI')).toBeNull()
  })

  it('con un filtro de método o comercio explica por qué no hay desglose', () => {
    pintar({ conFiltro: true, byChannel: undefined, byOrderType: undefined })
    expect(screen.getByText('salesSummary.channels.filteredNote')).toBeInTheDocument()
  })

  it('sin ventas en el periodo dice que no hubo; con un servidor viejo (sin las tablas) no pinta nada', () => {
    pintar({ byChannel: [], byOrderType: [] })
    expect(screen.getByText('salesSummary.channels.empty')).toBeInTheDocument()
    const { container } = render(<SalesByChannelSection conFiltro={false} formatCurrency={fmt} />)
    expect(container).toBeEmptyDOMElement()
  })

  it('el QR del sistema anterior no inventa pedidos (no los trae): sólo sus cobros, y el total lo dice', () => {
    pintar({
      byChannel: [
        fila('TABLES', { netSales: 100, totalCollected: 100 }),
        fila('QR_LEGACY', { netSales: 300, totalCollected: 330, tips: 30, orderCount: null, transactionCount: 3 }),
      ],
    })
    const tabla = screen.getByTestId('ventas-por-canal-tabla')
    const qr = within(tabla).getByTestId('canal-QR_LEGACY')
    expect(within(qr).queryByText(/channels.orders/)).toBeNull()
    expect(within(qr).getByText('salesSummary.channels.transactions(count=3)')).toBeInTheDocument()
    // Codex r2 #11: «1 pedido · 4 cobros» sin aclarar parecía completo.
    expect(within(within(tabla).getByTestId('canal-total')).getByText(/ordersWithoutLegacy\(count=1\)/)).toBeInTheDocument()
  })
})
