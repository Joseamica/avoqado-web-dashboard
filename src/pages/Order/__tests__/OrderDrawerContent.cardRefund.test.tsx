/**
 * Codex panel r1 #3: el detalle REAL de la cuenta lleva «Devolver a la tarjeta» (la bandeja sólo guarda 24 h). Con una cuenta de
 * origen en línea cobrada con tarjeta lee el pedido por la ruta de S3 y muestra el botón; con una cuenta que no es en línea no
 * consulta S3 ni muestra nada. Se monta el cajón de verdad con el servicio y la hoja reales; sólo se apagan las secciones ajenas.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), order: {} as Record<string, unknown>, permissions: [] as string[] }))
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => m.get(...a) } }))
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => m.permissions.includes(p) }) }))
vi.mock('@/hooks/use-current-venue', () => ({
  useCurrentVenue: () => ({ venueId: 'v1', venue: { name: 'Taquería' }, fullBasePath: '/venues/t' }),
}))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => d }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: () => {} }) }))
vi.mock('@/context/BreadcrumbContext', () => ({ useBreadcrumb: () => ({ setCustomSegment: () => {}, clearCustomSegment: () => {} }) }))
vi.mock('@/services/order.service', () => ({ getOrder: async () => m.order }))
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/pages/Order/components/OrderActionsSheet', () => ({ OrderActionsSheet: () => null }))
vi.mock('@/pages/Order/components/sections/DetailsSection', () => ({ DetailsSection: () => null }))
vi.mock('@/pages/Order/components/sections/ItemsSection', () => ({ ItemsSection: () => null }))
vi.mock('@/pages/Order/components/StampRewardsSection', () => ({ StampRewardsSection: () => null }))
// La sección de pagos REAL (el Ruling 89 lee lo que dice), dentro de la caja que buscan las pruebas de posición.
vi.mock('@/pages/Order/components/sections/PaymentsSection', async importOriginal => {
  const real = await importOriginal<typeof import('@/pages/Order/components/sections/PaymentsSection')>()
  return {
    PaymentsSection: (p: Parameters<typeof real.PaymentsSection>[0]) => (
      <div data-testid="payments-section">
        <real.PaymentsSection {...p} />
      </div>
    ),
  }
})
vi.mock('@/pages/Order/components/sections/ActivitySection', () => ({ ActivitySection: () => null }))
vi.mock('@/pages/Payment/components/ExchangeLinksCard', () => ({ ExchangeLinksCard: () => null }))

import { OrderDrawerContent } from '../OrderDrawerContent'

const S3 = '/api/v1/dashboard/venues/v1/online-ordering/orders/o1'
const onlineOrder = {
  orderId: 'o1',
  onlineOrderId: 'oo1',
  orderNumber: '101',
  status: 'COMPLETED',
  paymentMode: 'CARD_ONLINE',
  customerName: 'Ana',
  customerPhone: null,
  note: null,
  createdAt: '2026-10-30T17:00:00.000Z',
  acceptDeadlineAt: '2026-10-30T17:10:00.000Z',
  estimatedReadyAt: null,
  total: 200,
  remaining: 0,
  paymentStatus: 'PAID',
  needsPrint: false,
  items: [],
  cardStatus: null,
  card: {
    status: 'CAPTURED',
    amount: 200,
    capturedAmount: 200,
    authorizedAt: '2026-10-30T17:00:00.000Z',
    capturedAt: '2026-10-30T17:05:00.000Z',
  },
  rejectReason: null,
}

const mount = () =>
  render(
    <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
        <OrderDrawerContent orderId="o1" onClose={() => {}} />
      </QueryClientProvider>
    </MemoryRouter>,
  )

describe('detalle de la cuenta: «Devolver a la tarjeta» de un pedido en línea', () => {
  beforeEach(() => {
    m.get.mockReset()
    m.permissions = ['orders:read', 'payments:read', 'payments:refund']
    m.order = { id: 'o1', orderNumber: '101', status: 'COMPLETED', paymentStatus: 'PAID', source: 'WEB', total: 200 }
    m.get.mockImplementation(async (url: string) => {
      if (url === S3) return { data: { success: true, data: onlineOrder } }
      throw new Error(`GET inesperado: ${url}`)
    })
  })

  it('🔴 cuenta de origen en línea cobrada con tarjeta ⇒ lee S3 y muestra «Devolver a la tarjeta» después de los pagos', async () => {
    mount()
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(S3))
    const button = await screen.findByRole('button', { name: 'cardRefund.open' }, { timeout: 5000 })
    expect(screen.getByTestId('payments-section').compareDocumentPosition(button) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
  })

  it('🔴 una cuenta que no es en línea ⇒ ninguna llamada a S3 y sin botón', async () => {
    m.order = { ...m.order, source: 'TPV' }
    mount()
    await screen.findByTestId('payments-section')
    await new Promise(r => setTimeout(r, 30))
    expect(m.get).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  // D661: un pedido de «Nadie» pagado con tarjeta dice en el detalle en qué quedó, junto al botón para devolver.
  it.each([
    ['refundRequestedAt → «Devolviendo…»', { status: 'READY', refundRequestedAt: '2026-10-30T18:00:00.000Z' }, 'inbox.card.mark.refunding'],
    [
      'refundedAt → «Devuelto» (manda sobre la reserva)',
      { refundRequestedAt: '2026-10-30T18:00:00.000Z', refundedAt: '2026-10-30T18:00:02.000Z' },
      'inbox.card.mark.refunded',
    ],
    ['notPickedUpAt → «No lo recogió»', { notPickedUpAt: '2026-10-31T10:00:05.000Z' }, 'inbox.card.mark.notPickedUp'],
    // Ruling 60: tras una reversa el SERVIDOR conserva `refundedAt`; manda el estado real del dinero.
    [
      'refund REVERSED → «se le debe» aunque tenga refundedAt',
      { refundedAt: '2026-10-30T18:00:02.000Z', refund: { status: 'REVERSED', medio: 'TARJETA' } },
      'inbox.card.mark.reversed',
    ],
  ])('«Nadie» con %s, en el detalle', async (_n, marks, text) => {
    m.get.mockImplementation(async (url: string) => {
      if (url === S3) return { data: { success: true, data: { ...onlineOrder, requiresAcceptance: false, ...marks } } }
      throw new Error(`GET inesperado: ${url}`)
    })
    mount()
    expect(await screen.findByText(text, {}, { timeout: 3000 })).toBeInTheDocument()
  })

  // Ruling 89: tras una reversa del banco el SERVIDOR conserva el asiento del reembolso (la cuenta sigue con `refundState: FULL` y
  // cerrada), pero el dinero no le llegó a la clienta: la cabecera y los pagos dicen lo mismo que la marca.
  const cuentaDevuelta = () => ({
    ...m.order,
    refundState: 'FULL',
    refundedAmount: 200,
    remainingBalance: 0,
    payments: [
      {
        id: 'p1',
        type: 'REGULAR',
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        amount: 200,
        tipAmount: 0,
        createdAt: onlineOrder.createdAt,
      },
      {
        id: 'p2',
        type: 'REFUND',
        method: 'CREDIT_CARD',
        status: 'COMPLETED',
        amount: -200,
        tipAmount: 0,
        createdAt: onlineOrder.createdAt,
      },
    ],
  })
  const conDevolucion = (refund: object) =>
    m.get.mockImplementation(async (url: string) => {
      if (url === S3) {
        const pedido = { ...onlineOrder, requiresAcceptance: false, refundedAt: '2026-10-30T18:00:02.000Z', refund }
        return { data: { success: true, data: pedido } }
      }
      throw new Error(`GET inesperado: ${url}`)
    })

  it('🔴 Ruling 89: tras una reversa, ni la cabecera ni los pagos dicen «Reembolsado»: los dos dicen que se le debe a la clienta', async () => {
    m.order = cuentaDevuelta()
    conDevolucion({ status: 'REVERSED', medio: 'TARJETA' })
    mount()
    const cabecera = (await screen.findByRole('heading', { level: 1 })).parentElement as HTMLElement
    await waitFor(() => expect(within(cabecera).getByText('inbox.card.mark.reversed')).toBeInTheDocument(), { timeout: 3000 })
    const pagos = screen.getByTestId('payments-section')
    const loQueSeDebe = within(pagos).getByText('inbox.card.mark.reversed').parentElement as HTMLElement
    expect(loQueSeDebe).toHaveTextContent('$200.00')
    expect(loQueSeDebe).not.toHaveTextContent('-$')
    expect(screen.queryByText(/^drawer\.refund\./)).toBeNull()
    // El asiento del reembolso se queda a la vista, como historia.
    expect(within(pagos).getByText('drawer.payments.refund')).toBeInTheDocument()
    // La cuenta sigue cerrada: no se le cobra a la clienta.
    expect(within(cabecera).getByText(/^detail\.statuses\.COMPLETED/)).toBeInTheDocument()
    expect(screen.queryByText(/^payLater\.badge/)).toBeNull()
    expect(screen.queryByText(/^drawer\.payments\.pendingBalance/)).toBeNull()
  })

  it('una devolución hecha (DONE) sigue diciendo «Reembolsado» en la cabecera y en los pagos', async () => {
    m.order = cuentaDevuelta()
    conDevolucion({ status: 'DONE', medio: 'TARJETA' })
    mount()
    await screen.findByText('inbox.card.mark.refunded', {}, { timeout: 3000 })
    const cabecera = screen.getByRole('heading', { level: 1 }).parentElement as HTMLElement
    expect(within(cabecera).getByText(/^drawer\.refund\.full/)).toBeInTheDocument()
    const pagos = screen.getByTestId('payments-section')
    expect(within(pagos).getByText(/^drawer\.refund\.full/).parentElement).toHaveTextContent('-$200.00')
    expect(screen.queryByText('inbox.card.mark.reversed')).toBeNull()
  })

  // Ronda 5 («la pantalla no puede mentir»): de una cuenta en línea con reembolso, la etiqueta espera a la lectura del pedido (tras una
  // reversa el asiento sigue diciendo «reembolsado»); si esa lectura falla, dice que no se pudo revisar.
  it('🔴 cuenta en línea con reembolso: mientras llega la lectura del pedido dice «Revisando la devolución…», nunca «Reembolsado»', async () => {
    m.order = cuentaDevuelta()
    let responder: (v: unknown) => void = () => {}
    m.get.mockImplementation((url: string) => {
      if (url === S3) return new Promise(r => (responder = r))
      throw new Error(`GET inesperado: ${url}`)
    })
    mount()
    const cabecera = (await screen.findByRole('heading', { level: 1 })).parentElement as HTMLElement
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(S3))
    const pagos = screen.getByTestId('payments-section')
    expect(within(cabecera).getByText('drawer.refund.checking')).toBeInTheDocument()
    expect(within(pagos).getByText('drawer.refund.checking')).toBeInTheDocument()
    expect(screen.queryByText(/^drawer\.refund\.(full|partial)/)).toBeNull()
    const revertido = { ...onlineOrder, requiresAcceptance: false, refundedAt: '2026-10-30T18:00:02.000Z' }
    await act(async () => responder({ data: { success: true, data: { ...revertido, refund: { status: 'REVERSED', medio: 'TARJETA' } } } }))
    expect(await within(cabecera).findByText('inbox.card.mark.reversed')).toBeInTheDocument()
    expect(within(pagos).getByText('inbox.card.mark.reversed')).toBeInTheDocument()
    expect(screen.queryByText('drawer.refund.checking')).toBeNull()
  })

  it('cuenta en línea con reembolso y la lectura del pedido falla: dice que no se pudo revisar, nunca «Reembolsado»', async () => {
    m.order = cuentaDevuelta()
    m.get.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500, data: { message: 'falló' } } }))
    mount()
    const cabecera = (await screen.findByRole('heading', { level: 1 })).parentElement as HTMLElement
    expect(await within(cabecera).findByText('drawer.refund.unchecked', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(within(screen.getByTestId('payments-section')).getByText('drawer.refund.unchecked')).toBeInTheDocument()
    expect(screen.queryByText(/^drawer\.refund\.(full|partial)/)).toBeNull()
  })

  // Ruling 102: la etiqueta del reembolso sólo sale de una lectura que terminó DESPUÉS de abrir este detalle; la de la caché (de otra
  // apertura) no cuenta: tras una reversa diría «Reembolsado» aunque se le deba a la clienta.
  it.each([
    ['falla', 'drawer.refund.unchecked'],
    ['trae la reversa', 'inbox.card.mark.reversed'],
  ])('🔴 con «Devuelto» en la caché, al reabrir el detalle dice «Revisando…» hasta la lectura nueva, que %s', async (desenlace, texto) => {
    m.order = cuentaDevuelta()
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const abrir = () =>
      render(
        <MemoryRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
          <QueryClientProvider client={qc}>
            <OrderDrawerContent orderId="o1" onClose={() => {}} />
          </QueryClientProvider>
        </MemoryRouter>,
      )
    conDevolucion({ status: 'DONE', medio: 'TARJETA' })
    const primera = abrir()
    await screen.findByText('inbox.card.mark.refunded', {}, { timeout: 3000 })
    primera.unmount()
    // Después el banco regresa la devolución; al reabrir, la lectura nueva tarda.
    let responder: (v: unknown) => void = () => {}
    let fallar: (e: unknown) => void = () => {}
    m.get.mockImplementation((url: string) => {
      if (url !== S3) throw new Error(`GET inesperado: ${url}`)
      return new Promise((ok, falla) => {
        responder = ok
        fallar = falla
      })
    })
    abrir()
    const cabecera = (await screen.findByRole('heading', { level: 1 })).parentElement as HTMLElement
    const pagos = screen.getByTestId('payments-section')
    await waitFor(() => expect(within(cabecera).getByText('drawer.refund.checking')).toBeInTheDocument())
    expect(within(pagos).getByText('drawer.refund.checking')).toBeInTheDocument()
    expect(screen.queryByText(/^drawer\.refund\.(full|partial)/)).toBeNull()
    expect(screen.queryByText('inbox.card.mark.refunded')).toBeNull()
    const revertido = { ...onlineOrder, requiresAcceptance: false, refundedAt: '2026-10-30T18:00:02.000Z' }
    await act(async () =>
      desenlace === 'falla'
        ? fallar(Object.assign(new Error('500'), { response: { status: 500, data: { message: 'falló' } } }))
        : responder({ data: { success: true, data: { ...revertido, refund: { status: 'REVERSED', medio: 'TARJETA' } } } }),
    )
    expect(await within(cabecera).findByText(texto)).toBeInTheDocument()
    expect(within(pagos).getByText(texto)).toBeInTheDocument()
    expect(screen.queryByText(/^drawer\.refund\.(full|partial)/)).toBeNull()
  })

  it('una cuenta que no es en línea con reembolso dice «Reembolsado» de una vez, sin leer el pedido en línea', async () => {
    m.order = { ...cuentaDevuelta(), source: 'TPV' }
    mount()
    const cabecera = (await screen.findByRole('heading', { level: 1 })).parentElement as HTMLElement
    expect(within(cabecera).getByText(/^drawer\.refund\.full/)).toBeInTheDocument()
    expect(m.get).not.toHaveBeenCalled()
  })

  // D661: en qué quedó el pedido lo ve quien ve la cuenta; el botón, sólo quien puede devolver (`payments:refund`).
  it('un gerente sin payments:refund ve «Devolviendo…» en el detalle, sin el botón', async () => {
    m.permissions = ['orders:read', 'payments:read']
    m.get.mockImplementation(async (url: string) => {
      if (url === S3) {
        const marcado = { ...onlineOrder, requiresAcceptance: false, status: 'READY', refundRequestedAt: '2026-10-30T18:00:00.000Z' }
        return { data: { success: true, data: marcado } }
      }
      throw new Error(`GET inesperado: ${url}`)
    })
    mount()
    expect(await screen.findByText('inbox.card.mark.refunding', {}, { timeout: 3000 })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^cardRefund\./ })).toBeNull()
  })

  it('S3 responde 404 (no es pedido en línea) ⇒ sin botón', async () => {
    m.get.mockRejectedValue(
      Object.assign(new Error('404'), { response: { status: 404, data: { message: 'Esta cuenta no es un pedido en línea.' } } }),
    )
    mount()
    await waitFor(() => expect(m.get).toHaveBeenCalledWith(S3))
    // Dentro de `act`: la respuesta (null) repinta el detalle y el botón (sin avisos de «not wrapped in act»).
    await act(async () => {
      await new Promise(r => setTimeout(r, 30))
    })
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })
})
