/**
 * Devolver a la tarjeta (fase 2, bloque D4). El servidor decide el tope y los desenlaces; aquí se prueba lo que el panel promete:
 * la llave y lo que vio el operador (los mismos en el reintento, nuevos en una decisión nueva), el monto en PESOS como texto, el texto de cada desenlace
 * por `cardRefundStatus`, el botón sólo con permiso y cobro con tarjeta, y «Devolver por otro medio» sólo con REVERSED sin resolver.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/t' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatDateTime: (d: string) => `DT(${d})` }) }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))
const access = { denied: [] as string[] }
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: (p: string) => !access.denied.includes(p) }) }))

const getOnlineOrder = vi.fn()
const listCardRefunds = vi.fn()
const createCardRefund = vi.fn()
const resolveCardRefund = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return {
    ...actual,
    getOnlineOrder: (...a: unknown[]) => getOnlineOrder(...a),
    listCardRefunds: (...a: unknown[]) => listCardRefunds(...a),
    createCardRefund: (...a: unknown[]) => createCardRefund(...a),
    resolveCardRefund: (...a: unknown[]) => resolveCardRefund(...a),
  }
})

import { Currency } from '@/utils/currency'
import { CardRefundButton, OrderCardRefund } from '../components/CardRefundSheet'

const captured = { status: 'CAPTURED', amount: 200, capturedAmount: 200, authorizedAt: '2026-11-02T17:00:00.000Z', capturedAt: '2026-11-02T17:05:00.000Z' }
const order = (over: Record<string, unknown> = {}) =>
  ({
    orderId: 'o1',
    onlineOrderId: 'oo1',
    orderNumber: '101',
    status: 'COMPLETED',
    paymentMode: 'CARD_ONLINE',
    customerName: 'Ana',
    customerPhone: null,
    note: null,
    createdAt: '2026-11-02T17:00:00.000Z',
    acceptDeadlineAt: null,
    estimatedReadyAt: null,
    total: 200,
    remaining: 0,
    paymentStatus: 'PAID',
    needsPrint: false,
    items: [],
    cardStatus: null,
    card: captured,
    rejectReason: null,
    ...over,
  }) as never

const refund = (over: Record<string, unknown> = {}) => ({
  id: 'r1',
  status: 'RECORDED',
  amount: '50.00',
  reason: 'RETURNED_GOODS',
  note: null,
  stripeRefundId: 're_1',
  refundPaymentId: 'p-r1',
  feeRefunded: null,
  createdAt: '2026-11-02T18:00:00.000Z',
  reversal: null,
  ...over,
})
const reversal = (resolvedAt: string | null) => ({
  failureReason: 'expired_or_canceled_card',
  detectedAt: '2026-11-02T19:00:00.000Z',
  resolvedMethod: resolvedAt ? 'CASH' : null,
  resolvedAt,
  resolvedNote: null,
})

const http = (status: number, data: object) => Object.assign(new Error('http'), { isAxiosError: true, response: { status, data } })
const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })

const wrap = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const listaLeida = async () => {
  await screen.findByRole('dialog')
  await waitFor(() => expect(document.querySelector('[role="dialog"] .animate-pulse')).toBeNull())
}

/** Abre la hoja desde el botón y espera la lista. */
const abrir = async (o = order()) => {
  const r = wrap(<CardRefundButton venueId="venue-1" order={o} />)
  await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
  await waitFor(() => expect(listCardRefunds).toHaveBeenCalled())
  await listaLeida()
  return r
}
const monto = () => screen.getByLabelText('cardRefund.amount') as HTMLInputElement
// `fireEvent` y no `userEvent.type`: teclear letra por letra tarda segundos con la máquina cargada y no prueba nada más aquí.
const escribirMonto = (v: string) => fireEvent.change(monto(), { target: { value: v } })
const motivo = (r = 'OTHER') => userEvent.click(screen.getByRole('button', { name: `refund.reasons.${r}` }))
const devolver = () => userEvent.click(screen.getByRole('button', { name: 'cardRefund.submit' }))

describe('Devolver a la tarjeta', () => {
  beforeEach(() => {
    for (const f of [getOnlineOrder, listCardRefunds, createCardRefund, resolveCardRefund, toast]) f.mockReset()
    access.denied = []
    listCardRefunds.mockResolvedValue([])
  })

  // ── Dónde sale el botón ──
  it('en la bandeja: sólo con la tarjeta COBRADA', () => {
    const { unmount } = wrap(<CardRefundButton venueId="venue-1" order={order()} />)
    expect(screen.getByRole('button', { name: 'cardRefund.open' })).toBeInTheDocument()
    unmount()
    wrap(<CardRefundButton venueId="venue-1" order={order({ card: { ...captured, status: 'AUTHORIZED', capturedAmount: null } })} />)
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  it('pagar al recoger nunca tiene «Devolver a la tarjeta»', () => {
    wrap(<CardRefundButton venueId="venue-1" order={order({ paymentMode: 'PAY_AT_PICKUP', card: null })} />)
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  it('🔴 en el detalle de la cuenta: lee el pedido por la ruta de S3 y muestra el botón (la bandeja sólo guarda 24 h)', async () => {
    getOnlineOrder.mockResolvedValue(order())
    wrap(<OrderCardRefund venueId="venue-1" orderId="o1" source="WEB" />)
    expect(await screen.findByRole('button', { name: 'cardRefund.open' })).toBeInTheDocument()
    expect(getOnlineOrder).toHaveBeenCalledWith('venue-1', 'o1')
  })

  it('en el detalle de la cuenta: un 404 de S3 (no es pedido en línea) ⇒ sin botón', async () => {
    getOnlineOrder.mockResolvedValue(null)
    wrap(<OrderCardRefund venueId="venue-1" orderId="o1" source="WEB" />)
    await waitFor(() => expect(getOnlineOrder).toHaveBeenCalled())
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  it('en el detalle de la cuenta: una cuenta que no es de origen en línea ni se consulta', async () => {
    wrap(<OrderCardRefund venueId="venue-1" orderId="o1" source="TPV" />)
    await new Promise(r => setTimeout(r, 20))
    expect(getOnlineOrder).not.toHaveBeenCalled()
  })

  it('sin payments:refund no hay botón (ni se consulta)', async () => {
    access.denied = ['payments:refund']
    getOnlineOrder.mockResolvedValue(order())
    wrap(<OrderCardRefund venueId="venue-1" orderId="o1" source="WEB" />)
    await new Promise(r => setTimeout(r, 20))
    expect(getOnlineOrder).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  // ── La hoja ──
  it('la lista (estado, monto, fecha, motivo) y la pista «Puedes devolver hasta» sin contar lo fallido', async () => {
    listCardRefunds.mockResolvedValue([
      refund({ id: 'r1', status: 'RECORDED', amount: '50.00' }),
      refund({ id: 'r2', status: 'FAILED', amount: '30.00' }),
      refund({ id: 'r3', status: 'REVERSED', amount: '20.00', reversal: reversal(null) }),
      refund({ id: 'r4', status: 'RESOLVED', amount: '10.00', reversal: reversal('2026-11-02T20:00:00.000Z') }),
      refund({ id: 'r5', status: 'PENDING', amount: '15.50', reason: 'OTHER' }),
    ])
    await abrir()
    const r1 = await screen.findByTestId('card-refund-r1')
    expect(r1).toHaveTextContent(Currency(50))
    expect(r1).toHaveTextContent('cardRefund.outcome.done')
    expect(r1).toHaveTextContent('DT(2026-11-02T18:00:00.000Z)')
    expect(r1).toHaveTextContent('refund.reasons.RETURNED_GOODS')
    expect(screen.getByTestId('card-refund-r2')).toHaveTextContent('cardRefund.outcome.failed')
    expect(screen.getByTestId('card-refund-r5')).toHaveTextContent('cardRefund.outcome.processing')
    // 200 − (50 + 20 + 10 + 15.50) = 104.50
    expect(screen.getByText(`cardRefund.upTo|${Currency(104.5)}`)).toBeInTheDocument()
    expect(monto()).toHaveValue(104.5) // por omisión, lo que queda
  })

  it('🔴 la pista dice lo mismo que el servidor: una revertida sigue contando en el libro; lo que falta se devuelve por otro medio', async () => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', status: 'REVERSED', amount: '30.00', reversal: reversal(null) })])
    await abrir()
    expect(screen.getByText(`cardRefund.upTo|${Currency(170)}`)).toBeInTheDocument()
  })

  it('🔴 el monto viaja en PESOS como texto con 2 decimales, con la llave en el encabezado', async () => {
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('120.5')
    await motivo('CANCELLED_ORDER')
    fireEvent.change(screen.getByLabelText('cardRefund.note'), { target: { value: 'faltó un taco' } })
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    const [venueId, orderId, body, key] = createCardRefund.mock.calls[0]
    expect([venueId, orderId]).toEqual(['venue-1', 'o1'])
    expect(body).toEqual({ amount: '120.50', reason: 'CANCELLED_ORDER', note: 'faltó un taco', expectedLatestRefundId: null })
    expect(key).toMatch(/^[A-Za-z0-9_-]{8,64}$/)
  })

  it('sin motivo o con un monto inválido no se puede devolver', async () => {
    await abrir()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled() // falta el motivo
    await motivo()
    escribirMonto('0')
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
    expect(screen.getByText('cardRefund.amountInvalid')).toBeInTheDocument()
  })

  it('🔴 dos clics pegados mandan UNA sola petición, no dependen del replay del servidor', async () => {
    let termina: (v: unknown) => void = () => {}
    createCardRefund.mockImplementation(() => new Promise(r => (termina = r)))
    await abrir()
    await motivo()
    const boton = screen.getByRole('button', { name: 'cardRefund.submit' })
    act(() => {
      boton.click()
      boton.click()
    })
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByRole('button', { name: 'cardRefund.sending' })).toBeDisabled())
    expect(createCardRefund).toHaveBeenCalledTimes(1)
    await act(async () => termina({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false }))
  })

  it('🔴 sin respuesta, tocar otra vez lo mismo lleva la MISMA llave y lo mismo que vio', async () => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', status: 'FAILED' })])
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: true })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    const [p1, p2] = createCardRefund.mock.calls
    expect(p2[3]).toBe(p1[3])
    expect(p2[2].expectedLatestRefundId).toBe('r1')
    expect(p1[2].expectedLatestRefundId).toBe('r1')
  })

  it('🔴 un 408 también es duda: conserva la llave', async () => {
    createCardRefund.mockRejectedValueOnce(http(408, {}))
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: true })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).toBe(createCardRefund.mock.calls[0][3])
  })

  it('un 4xx muestra el texto del servidor y el siguiente intento es una operación nueva (otra llave)', async () => {
    createCardRefund.mockRejectedValueOnce(http(400, { code: 'CARD_REFUND_EXCEEDS_REMAINING', message: 'Sólo quedan $124.50 por devolver.' }))
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Sólo quedan $124.50 por devolver.', variant: 'destructive' }))
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).not.toBe(createCardRefund.mock.calls[0][3])
  })

  it.each([
    [{ status: 'RECORDED', cardRefundStatus: 'RECORDED', replay: false }, 'cardRefund.outcome.done'],
    [{ status: 'PENDING', cardRefundStatus: 'PENDING', replay: false }, 'cardRefund.outcome.processing'],
    [{ status: 'FAILED', cardRefundStatus: 'FAILED', replay: false }, 'cardRefund.outcome.failed'],
    [{ status: 'FAILED', cardRefundStatus: 'CANCELED', replay: false }, 'cardRefund.outcome.failed'],
    // Codex plan r1 #8: en una repetición `status` dice RECORDED también para REVERSED y RESOLVED: manda `cardRefundStatus`.
    [{ status: 'RECORDED', cardRefundStatus: 'REVERSED', replay: true }, 'cardRefund.outcome.reversed'],
    [{ status: 'RECORDED', cardRefundStatus: 'RESOLVED', replay: true }, 'cardRefund.outcome.resolved'],
    [{ status: 'UNKNOWN', cardRefundStatus: 'REQUESTED', replay: false }, 'cardRefund.outcome.unknown'],
    [{ status: 'UNKNOWN', cardRefundStatus: 'SUCCEEDED', replay: false }, 'cardRefund.outcome.unknown'],
    [{ status: 'RECORDED', cardRefundStatus: 'ALGO_NUEVO', replay: false }, 'cardRefund.outcome.unknown'],
  ])('desenlace %j ⇒ %s, y vuelve a leer la lista', async (res, text) => {
    createCardRefund.mockResolvedValue({ cardRefundId: 'r9', refundId: null, ...res })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: text })))
    // abrir + releer después del desenlace
    await waitFor(() => expect(listCardRefunds.mock.calls.length).toBeGreaterThanOrEqual(2))
  })

  // ── Codex panel r4 y diseño r1: el SERVIDOR decide con lo que el operador vio; el navegador no recuerda nada ──
  it('🔴 manda lo que el operador vio y NO relee la lista al enviar: una relectura nunca renueva su decisión', async () => {
    let lecturasAlEnviar = -1
    createCardRefund.mockImplementation(async () => {
      lecturasAlEnviar = listCardRefunds.mock.calls.length
      return { status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false }
    })
    await abrir()
    await motivo()
    const lecturas = listCardRefunds.mock.calls.length
    listCardRefunds.mockResolvedValue([refund({ id: 'r-de-otro' })])
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    expect(createCardRefund.mock.calls[0][2].expectedLatestRefundId).toBeNull()
    expect(lecturasAlEnviar).toBe(lecturas)
  })

  it('🔴 409 CARD_REFUND_STALE_VIEW: avisa, limpia, relee; lo siguiente es una decisión nueva con otra llave y lo nuevo que vio', async () => {
    createCardRefund.mockRejectedValueOnce(http(409, { code: 'CARD_REFUND_STALE_VIEW', message: 'Hubo otra devolución.' }))
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo()
    listCardRefunds.mockResolvedValue([refund({ id: 'r-de-otro', amount: '10.00' })])
    await devolver()
    expect(await screen.findByText('cardRefund.changed')).toBeInTheDocument()
    expect(await screen.findByTestId('card-refund-r-de-otro')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled() // el motivo se limpió
    expect(toast).not.toHaveBeenCalled()
    escribirMonto('50')
    await motivo()
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    const [p1, p2] = createCardRefund.mock.calls
    expect(p2[3]).not.toBe(p1[3])
    expect(p2[2].expectedLatestRefundId).toBe('r-de-otro')
    await waitFor(() => expect(screen.queryByText('cardRefund.changed')).toBeNull())
  })

  it('🔴 si la lista cambia con la hoja abierta: avisa, limpia y olvida el intento en duda', async () => {
    createCardRefund.mockRejectedValueOnce(networkError())
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <CardRefundButton venueId="venue-1" order={order()} />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await listaLeida()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', amount: '10.00' })])
    await qc.invalidateQueries()
    expect(await screen.findByText('cardRefund.changed')).toBeInTheDocument()
    await motivo()
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    const [p1, p2] = createCardRefund.mock.calls
    expect(p2[3]).not.toBe(p1[3])
    expect(p2[2].expectedLatestRefundId).toBe('r1')
  })

  it('🔴 sin leer la lista no se manda: «Devolver» apagado y dice por qué', async () => {
    listCardRefunds.mockRejectedValue(networkError())
    await abrir()
    await motivo()
    expect(await screen.findByText('cardRefund.loadFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
    listCardRefunds.mockResolvedValue([])
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.reload' }))
    await waitFor(() => expect(screen.queryByText('cardRefund.loadFailed')).toBeNull())
    await motivo() // lo llenado sin ver la lista no cuenta: se limpió
    await waitFor(() => expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeEnabled())
  })

  it('🔴 lo llenado antes de ver la lista no cuenta: al llegar la lectura se limpia, y hay que decidir ya con ella a la vista', async () => {
    let llega: (v: unknown) => void = () => {}
    listCardRefunds.mockImplementation(() => new Promise(r => (llega = r)))
    wrap(<CardRefundButton venueId="venue-1" order={order()} />)
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await screen.findByRole('dialog')
    escribirMonto('50')
    await motivo()
    fireEvent.change(screen.getByLabelText('cardRefund.note'), { target: { value: 'hola' } })
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
    llega([refund({ id: 'r-otra', amount: '50.00', createdAt: new Date(Date.now() - 11 * 60_000).toISOString() })])
    expect(await screen.findByTestId('card-refund-r-otra')).toBeInTheDocument()
    await waitFor(() => expect((screen.getByLabelText('cardRefund.note') as HTMLTextAreaElement).value).toBe(''))
    expect(Number(monto().value)).toBe(150)
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled() // falta el motivo
  })

  it('🔴 con una lista vieja en caché tampoco se manda: hasta que la lectura de esta apertura termine', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 }, mutations: { retry: false } } })
    qc.setQueryData(['online-ordering', 'venue-1', 'order', 'o1', 'card-refunds'], [refund({ id: 'vieja', amount: '10.00' })])
    listCardRefunds.mockRejectedValue(networkError())
    render(
      <QueryClientProvider client={qc}>
        <CardRefundButton venueId="venue-1" order={order()} />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await waitFor(() => expect(listCardRefunds).toHaveBeenCalled())
    await motivo()
    expect(await screen.findByText('cardRefund.loadFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
  })

  it('🔴 respuesta perdida, cerrar y reabrir: el formulario nace vacío y lo nuevo que vio viaja con otra llave', async () => {
    createCardRefund.mockRejectedValueOnce(networkError())
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo()
    fireEvent.change(screen.getByLabelText('cardRefund.note'), { target: { value: 'hola' } })
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', status: 'RECORDED', amount: '50.00', createdAt: new Date(Date.now() - 11 * 60_000).toISOString() })])
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    expect(await screen.findByTestId('card-refund-r1')).toBeInTheDocument()
    await listaLeida()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
    expect((screen.getByLabelText('cardRefund.note') as HTMLTextAreaElement).value).toBe('')
    expect(Number(monto().value)).toBe(150) // la pista de lo que queda, no los $50 de antes
    await motivo()
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).not.toBe(createCardRefund.mock.calls[0][3])
    expect(createCardRefund.mock.calls[1][2].expectedLatestRefundId).toBe('r1')
  })

  it('una devolución propia que se anotó limpia todo sin aviso, y la siguiente sale de lo nuevo que vio', async () => {
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo()
    listCardRefunds.mockResolvedValue([refund({ id: 'r9', amount: '50.00', createdAt: new Date(Date.now() - 11 * 60_000).toISOString() })])
    await devolver()
    expect(await screen.findByTestId('card-refund-r9')).toBeInTheDocument()
    await waitFor(() => expect(Number(monto().value)).toBe(150))
    expect(screen.queryByText('cardRefund.changed')).toBeNull()
    await motivo()
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][2].expectedLatestRefundId).toBe('r9')
    expect(createCardRefund.mock.calls[1][3]).not.toBe(createCardRefund.mock.calls[0][3])
  })

  it('🔴 FAILED tardío con otra devolución ya hecha: limpia el formulario; lo siguiente es una decisión nueva sobre lo nuevo que vio', async () => {
    createCardRefund.mockResolvedValueOnce({ status: 'FAILED', cardRefundStatus: 'FAILED', cardRefundId: 'rf', refundId: null, replay: false })
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo()
    fireEvent.change(screen.getByLabelText('cardRefund.note'), { target: { value: 'hola' } })
    const hace11 = new Date(Date.now() - 11 * 60_000).toISOString()
    listCardRefunds.mockResolvedValue([
      refund({ id: 'r-de-otro', status: 'RECORDED', amount: '50.00', createdAt: hace11 }),
      refund({ id: 'rf', status: 'FAILED', amount: '50.00', createdAt: hace11 }),
    ])
    await devolver()
    expect(await screen.findByTestId('card-refund-r-de-otro')).toBeInTheDocument()
    await waitFor(() => expect(Number(monto().value)).toBe(150))
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled() // el motivo se limpió
    expect((screen.getByLabelText('cardRefund.note') as HTMLTextAreaElement).value).toBe('')
    await motivo()
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).not.toBe(createCardRefund.mock.calls[0][3])
    expect(createCardRefund.mock.calls[1][2].expectedLatestRefundId).toBe('r-de-otro')
  })

  it('🔴 si falla una relectura el historial se oculta: no se manda, y «Volver a cargar» lo recupera', async () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
    render(
      <QueryClientProvider client={qc}>
        <CardRefundButton venueId="venue-1" order={order()} />
      </QueryClientProvider>,
    )
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await listaLeida()
    await motivo()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeEnabled()
    listCardRefunds.mockRejectedValue(networkError())
    await qc.invalidateQueries()
    expect(await screen.findByText('cardRefund.loadFailed')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeDisabled()
    listCardRefunds.mockResolvedValue([])
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.reload' }))
    await waitFor(() => expect(screen.queryByText('cardRefund.loadFailed')).toBeNull())
    expect(screen.getByRole('button', { name: 'cardRefund.submit' })).toBeEnabled()
  })

  it.each([
    ['REQUESTED', 'cardRefund.outcome.sending'],
    ['SENDING', 'cardRefund.outcome.sending'],
    ['PENDING', 'cardRefund.outcome.processing'],
  ])('en la lista, %s dice %s: sólo PENDING afirma que Stripe ya la tiene', async (status, text) => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', status })])
    await abrir()
    expect(await within(await screen.findByTestId('card-refund-r1')).findByText(text)).toBeInTheDocument()
  })

  it('🔴 si la lista trae una devolución del MISMO monto de hace 2 min, pide confirmar OTRA', async () => {
    const hace2 = new Date(Date.now() - 2 * 60_000).toISOString()
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', amount: '50.00', status: 'RECORDED', createdAt: hace2 })])
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    expect(await screen.findByText(`cardRefund.confirmAnother|${Currency(50)},2`)).toBeInTheDocument()
    expect(createCardRefund).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.confirmYes' }))
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    expect(createCardRefund.mock.calls[0][2]).toEqual({ amount: '50.00', reason: 'OTHER', expectedLatestRefundId: 'r1' })
  })

  it.each([
    ['FAILED (no se devolvió)', { status: 'FAILED', createdAt: new Date(Date.now() - 2 * 60_000).toISOString() }],
    ['REVERSED (el banco la regresó)', { status: 'REVERSED', reversal: reversal(null), createdAt: new Date(Date.now() - 2 * 60_000).toISOString() }],
    ['de hace más de 10 min', { status: 'RECORDED', createdAt: new Date(Date.now() - 11 * 60_000).toISOString() }],
    ['de otro monto', { status: 'RECORDED', amount: '40.00', createdAt: new Date(Date.now() - 2 * 60_000).toISOString() }],
  ])('una devolución %s no pide confirmar', async (_n, over) => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', amount: '50.00', ...over })])
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/^cardRefund\.confirmAnother/)).toBeNull()
  })

  // ── Devolver por otro medio ──
  it('«Devolver por otro medio» sólo en una REVERSED sin resolver: efectivo de la caja y transferencia', async () => {
    listCardRefunds.mockResolvedValue([
      refund({ id: 'r1', status: 'RECORDED' }),
      refund({ id: 'r2', status: 'REVERSED', reversal: reversal(null) }),
      refund({ id: 'r3', status: 'RESOLVED', reversal: reversal('2026-11-02T20:00:00.000Z') }),
    ])
    resolveCardRefund.mockResolvedValue({ status: 'RESOLVED', replay: false })
    await abrir()
    const r2 = await screen.findByTestId('card-refund-r2')
    expect(r2).toHaveTextContent('cardRefund.outcome.reversed')
    for (const id of ['card-refund-r1', 'card-refund-r3'])
      expect(within(screen.getByTestId(id)).queryByRole('button', { name: 'cardRefund.other.cash' })).toBeNull()
    await userEvent.click(within(r2).getByRole('button', { name: 'cardRefund.other.cash' }))
    await waitFor(() => expect(resolveCardRefund).toHaveBeenCalledWith('venue-1', 'o1', 'r2', { method: 'CASH' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.outcome.resolved' })))
    await waitFor(() => expect(listCardRefunds).toHaveBeenCalledTimes(2))
    await userEvent.click(within(r2).getByRole('button', { name: 'cardRefund.other.transfer' }))
    await waitFor(() => expect(resolveCardRefund).toHaveBeenLastCalledWith('venue-1', 'o1', 'r2', { method: 'BANK_TRANSFER' }))
  })

  it('sin payments:refund-to-cash no hay «Efectivo de la caja», sí «Transferencia»', async () => {
    access.denied = ['payments:refund-to-cash']
    listCardRefunds.mockResolvedValue([refund({ id: 'r2', status: 'REVERSED', reversal: reversal(null) })])
    await abrir()
    const r2 = await screen.findByTestId('card-refund-r2')
    expect(within(r2).queryByRole('button', { name: 'cardRefund.other.cash' })).toBeNull()
    expect(within(r2).getByRole('button', { name: 'cardRefund.other.transfer' })).toBeInTheDocument()
  })

  it('una REVERSED ya resuelta no ofrece «Devolver por otro medio»', async () => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r2', status: 'REVERSED', reversal: reversal('2026-11-02T20:00:00.000Z') })])
    await abrir()
    const r2 = await screen.findByTestId('card-refund-r2')
    expect(within(r2).queryByRole('button', { name: 'cardRefund.other.transfer' })).toBeNull()
  })

  it('409 CASH_DRAWER_NOT_OPEN muestra el texto del servidor', async () => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r2', status: 'REVERSED', reversal: reversal(null) })])
    resolveCardRefund.mockRejectedValue(http(409, { code: 'CASH_DRAWER_NOT_OPEN', message: 'Abre la caja para devolver en efectivo.' }))
    await abrir()
    await userEvent.click(within(await screen.findByTestId('card-refund-r2')).getByRole('button', { name: 'cardRefund.other.cash' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Abre la caja para devolver en efectivo.', variant: 'destructive' }))
  })
})
