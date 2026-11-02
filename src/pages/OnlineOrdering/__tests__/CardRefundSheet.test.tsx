/**
 * Devolver a la tarjeta (fase 2, bloque D4). El servidor decide el tope y los desenlaces; aquí se prueba lo que el panel promete:
 * la llave idempotente (la misma en el reintento, otra con otro cuerpo), el monto en PESOS como texto, el texto de cada desenlace
 * por `cardRefundStatus`, el botón sólo con permiso y cobro con tarjeta, y «Devolver por otro medio» sólo con REVERSED sin resolver.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
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

/** Abre la hoja desde el botón y espera la lista. */
const abrir = async (o = order()) => {
  const r = wrap(<CardRefundButton venueId="venue-1" order={o} />)
  await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
  await waitFor(() => expect(listCardRefunds).toHaveBeenCalled())
  await screen.findByRole('dialog')
  return r
}
const monto = () => screen.getByLabelText('cardRefund.amount') as HTMLInputElement
// `fireEvent` y no `userEvent.type`: teclear letra por letra tarda segundos con la máquina cargada y no prueba nada más aquí.
const escribirMonto = (v: string) => fireEvent.change(monto(), { target: { value: v } })
const motivo = (r = 'OTHER') => userEvent.click(screen.getByRole('button', { name: `refund.reasons.${r}` }))
const devolver = () => userEvent.click(screen.getByRole('button', { name: 'cardRefund.submit' }))

// `src/test/setup.ts` deja `localStorage` como vi.fn() vacíos (y `mockReset` los limpia): aquí se les da un almacén real.
const storage: Record<string, string> = {}
const STORED = 'avq:card-refund-attempt:venue-1:o1'
const AVISO = /^cardRefund\.(pendingAttempt|mayArrive|notArrived)\|/

describe('Devolver a la tarjeta', () => {
  beforeEach(() => {
    for (const f of [getOnlineOrder, listCardRefunds, createCardRefund, resolveCardRefund, toast]) f.mockReset()
    access.denied = []
    listCardRefunds.mockResolvedValue([])
    for (const k of Object.keys(storage)) delete storage[k]
    vi.mocked(window.localStorage.getItem).mockImplementation((k: string) => storage[k] ?? null)
    vi.mocked(window.localStorage.setItem).mockImplementation((k: string, v: string) => {
      storage[k] = v
    })
    vi.mocked(window.localStorage.removeItem).mockImplementation((k: string) => {
      delete storage[k]
    })
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
  it('la lista (estado, monto, fecha, motivo) y la pista «Puedes devolver hasta» sin contar lo fallido ni lo revertido sin resolver', async () => {
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
    // 200 − (50 + 10 + 15.50) = 124.50
    expect(screen.getByText(`cardRefund.upTo|${Currency(124.5)}`)).toBeInTheDocument()
    expect(monto()).toHaveValue(124.5) // por omisión, lo que queda
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
    expect(body).toEqual({ amount: '120.50', reason: 'CANCELLED_ORDER', note: 'faltó un taco' })
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

  it('🔴 la llave se repite en el reintento (sin respuesta); con el intento todavía en curso, otro cuerpo NO se manda', async () => {
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'PENDING', cardRefundStatus: 'PENDING', cardRefundId: 'r9', refundId: null, replay: true })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    const [k1, k2] = createCardRefund.mock.calls.map(c => c[3])
    expect(k2).toBe(k1)
    // PENDING sigue en curso: otro monto no se manda hasta saber el resultado (Codex panel r2 #1: nunca se reemplaza el intento).
    escribirMonto('10')
    await devolver()
    expect(await screen.findByText(`cardRefund.blocked|${Currency(200)}`)).toBeInTheDocument()
    expect(createCardRefund).toHaveBeenCalledTimes(2)
  })

  it('un 4xx muestra el texto del servidor y el siguiente intento es una operación nueva (otra llave)', async () => {
    createCardRefund.mockRejectedValueOnce(http(400, { code: 'CARD_REFUND_EXCEEDS_REMAINING', message: 'Sólo quedan $124.50 por devolver.' }))
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Sólo quedan $124.50 por devolver.', variant: 'destructive' }))
    expect(storage).toEqual({}) // un 4xx es definitivo: no queda intento guardado
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
    // abrir + releer antes de mandar + releer después del desenlace
    await waitFor(() => expect(listCardRefunds.mock.calls.length).toBeGreaterThanOrEqual(3))
  })

  // ── Codex panel r1 #1: la protección contra devolver dos veces sobrevive a cerrar la hoja y a recargar la página ──
  it('🔴 respuesta perdida → cerrar → reabrir: aviso, formulario precargado y la MISMA llave; tras el desenlace, otra devolución lleva llave nueva', async () => {
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: true })
    await abrir()
    escribirMonto('50')
    await motivo('RETURNED_GOODS')
    fireEvent.change(screen.getByLabelText('cardRefund.note'), { target: { value: 'faltó un taco' } })
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    expect(JSON.parse(storage[STORED])).toEqual(
      expect.objectContaining({ key: createCardRefund.mock.calls[0][3], amount: '50.00', reason: 'RETURNED_GOODS', note: 'faltó un taco' }),
    )

    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    const lecturas = listCardRefunds.mock.calls.length
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    expect(await screen.findByText(`cardRefund.mayArrive|${Currency(50)}`)).toBeInTheDocument()
    await waitFor(() => expect(listCardRefunds.mock.calls.length).toBeGreaterThan(lecturas)) // relee la lista al abrir
    expect(monto()).toHaveValue(50)
    expect(screen.getByRole('button', { name: 'refund.reasons.RETURNED_GOODS' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('cardRefund.note')).toHaveValue('faltó un taco')

    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][2]).toEqual(createCardRefund.mock.calls[0][2])
    expect(createCardRefund.mock.calls[1][3]).toBe(createCardRefund.mock.calls[0][3])
    // Desenlace definitivo (el replay dice RECORDED) ⇒ se borra el intento y el aviso.
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    expect(storage).toEqual({})

    escribirMonto('50')
    await motivo('RETURNED_GOODS')
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(3))
    expect(createCardRefund.mock.calls[2][3]).not.toBe(createCardRefund.mock.calls[0][3])
  })

  it('🔴 una instancia nueva (recarga de la página) recupera el intento en duda y reusa SU llave', async () => {
    createCardRefund.mockResolvedValue({ status: 'UNKNOWN', cardRefundStatus: 'REQUESTED', cardRefundId: 'r9', refundId: null, replay: false })
    const primera = await abrir()
    escribirMonto('80')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.outcome.unknown' })))
    primera.unmount()

    await abrir()
    expect(await screen.findByText(`cardRefund.mayArrive|${Currency(80)}`)).toBeInTheDocument()
    expect(monto()).toHaveValue(80)
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).toBe(createCardRefund.mock.calls[0][3])
  })

  // ── Codex panel r2: UN intento pendiente por cuenta, leído AL ENVIAR (también el de otra pestaña) y conciliado con la lista ──
  const otraPestanaGuardo = (over: Record<string, unknown> = {}) => {
    storage[STORED] = JSON.stringify({ key: 'llave-de-la-otra-pestana', amount: '50.00', reason: 'OTHER', note: '', savedAt: Date.now(), ...over })
  }

  it('🔴 dos pestañas: la que abrió ANTES de que la otra guardara su intento manda el mismo cuerpo con la llave de la otra', async () => {
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: true })
    await abrir() // esta pestaña no vio nada al abrir
    otraPestanaGuardo()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    expect(createCardRefund.mock.calls[0][3]).toBe('llave-de-la-otra-pestana')
  })

  it('🔴 dos pestañas: con el intento de la otra vivo, un cuerpo distinto NO se manda y lo dice', async () => {
    await abrir()
    otraPestanaGuardo()
    escribirMonto('80')
    await motivo('OTHER')
    await devolver()
    expect(await screen.findByText(`cardRefund.blocked|${Currency(50)}`)).toBeInTheDocument()
    expect(createCardRefund).not.toHaveBeenCalled()
    expect(JSON.parse(storage[STORED]).key).toBe('llave-de-la-otra-pestana') // nunca se reemplaza
  })

  it('🔴 $50 sin respuesta → $500 bloqueado → $50 ⇒ la MISMA llave del primero', async () => {
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: true })
    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    escribirMonto('500')
    await devolver()
    expect(await screen.findByText(`cardRefund.blocked|${Currency(50)}`)).toBeInTheDocument()
    expect(createCardRefund).toHaveBeenCalledTimes(1)
    escribirMonto('50')
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).toBe(createCardRefund.mock.calls[0][3])
  })

  it('🔴 UNKNOWN y luego la lista trae SU llave en RECORDED ⇒ el aviso desaparece y el intento se borra', async () => {
    let servidor: ReturnType<typeof refund>[] = []
    listCardRefunds.mockImplementation(async () => servidor)
    createCardRefund.mockImplementation(async (_v: string, _o: string, _b: unknown, key: string) => {
      servidor = [refund({ id: 'r9', key, amount: '80.00', status: 'REQUESTED', createdAt: new Date().toISOString() })]
      return { status: 'UNKNOWN', cardRefundStatus: 'REQUESTED', cardRefundId: 'r9', refundId: null, replay: false }
    })
    await abrir()
    escribirMonto('80')
    await motivo('OTHER')
    await devolver()
    // Sigue en curso en la lista: el aviso se queda.
    expect(await screen.findByText(`cardRefund.pendingAttempt|${Currency(80)}`)).toBeInTheDocument()
    expect(storage[STORED]).toBeDefined()

    servidor = [{ ...servidor[0], status: 'RECORDED' }]
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await screen.findByTestId('card-refund-r9')
    await waitFor(() => expect(screen.getByTestId('card-refund-r9')).toHaveTextContent('cardRefund.outcome.done'))
    await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
    expect(storage).toEqual({})
  })

  it('🔴 sin intento pendiente, si la lista trae una devolución del MISMO monto de hace 2 min, pide confirmar OTRA', async () => {
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
    expect(createCardRefund.mock.calls[0][2]).toEqual({ amount: '50.00', reason: 'OTHER' })
  })

  it.each([
    ['FAILED (no se devolvió)', { status: 'FAILED', createdAt: new Date(Date.now() - 2 * 60_000).toISOString() }],
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

  it('🔴 con el almacenamiento roto, otra hoja que reintenta los mismos $50 tiene que confirmar (la lista ya los trae)', async () => {
    vi.mocked(window.localStorage.getItem).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new Error('SecurityError')
    })
    let servidor: ReturnType<typeof refund>[] = []
    listCardRefunds.mockImplementation(async () => servidor)
    createCardRefund.mockImplementationOnce(async () => {
      servidor = [refund({ id: 'r9', amount: '50.00', status: 'RECORDED', createdAt: new Date().toISOString() })]
      throw networkError() // el servidor la hizo, pero la respuesta se perdió
    })
    const primera = await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    primera.unmount()

    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    expect(await screen.findByText(`cardRefund.confirmAnother|${Currency(50)},0`)).toBeInTheDocument()
    expect(createCardRefund).toHaveBeenCalledTimes(1)
  })

  // ── Codex panel r3: la conciliación es EXACTA por la llave que la lista trae de cada devolución (S9); nunca por monto ni fecha ──
  const DOS_MIN = 2 * 60_000

  it('🔴 un FAILED viejo de $50 no se confunde con el $50 nuevo sin respuesta: al reabrir el pendiente sigue y conserva su llave', async () => {
    listCardRefunds.mockResolvedValue([
      refund({ id: 'r1', key: 'llave-vieja-que-fallo', amount: '50.00', status: 'FAILED', createdAt: new Date(Date.now() - 30_000).toISOString() }),
    ])
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.noResponse' })))
    const k1 = createCardRefund.mock.calls[0][3]
    await userEvent.keyboard('{Escape}')
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
    await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
    await screen.findByTestId('card-refund-r1')
    expect(await screen.findByText(AVISO)).toBeInTheDocument()
    expect(JSON.parse(storage[STORED]).key).toBe(k1)
    await devolver()
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
    expect(createCardRefund.mock.calls[1][3]).toBe(k1)
  })

  it('🔴 un pendiente que nunca llegó (la lista no trae su llave): antes de 2 min bloquea; después «no llegó» y «Descartar» deja hacer $40', async () => {
    createCardRefund
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    escribirMonto('50')
    await motivo('OTHER')
    await devolver()
    expect(await screen.findByText(`cardRefund.mayArrive|${Currency(50)}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'cardRefund.discard' })).toBeNull()
    escribirMonto('40')
    await devolver()
    expect(await screen.findByText(`cardRefund.blocked|${Currency(50)}`)).toBeInTheDocument()
    expect(createCardRefund).toHaveBeenCalledTimes(1)
    const k1 = createCardRefund.mock.calls[0][3]

    // Pasan los 2 min y la lista (releída al abrir) sigue sin su llave.
    const ahora = Date.now()
    const reloj = vi.spyOn(Date, 'now').mockReturnValue(ahora + DOS_MIN + 1000)
    try {
      await userEvent.keyboard('{Escape}')
      await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull())
      await userEvent.click(screen.getByRole('button', { name: 'cardRefund.open' }))
      expect(await screen.findByText(`cardRefund.notArrived|${Currency(50)}`)).toBeInTheDocument()
      await userEvent.click(screen.getByRole('button', { name: 'cardRefund.discard' }))
      await waitFor(() => expect(screen.queryByText(AVISO)).toBeNull())
      expect(storage).toEqual({})
      escribirMonto('40')
      await motivo('OTHER')
      await devolver()
      await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(2))
      expect(createCardRefund.mock.calls[1][2]).toEqual({ amount: '40.00', reason: 'OTHER' })
      expect(createCardRefund.mock.calls[1][3]).not.toBe(k1)
    } finally {
      reloj.mockRestore()
    }
  })

  it('el mismo cuerpo del pendiente siempre se puede reenviar con su llave, aunque ya pasaron los 2 min', async () => {
    storage[STORED] = JSON.stringify({ key: 'llave-del-pendiente', amount: '50.00', reason: 'OTHER', note: '', savedAt: Date.now() - DOS_MIN - 5000 })
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await abrir()
    expect(await screen.findByText(`cardRefund.notArrived|${Currency(50)}`)).toBeInTheDocument()
    await devolver() // el formulario viene precargado con el pendiente
    await waitFor(() => expect(createCardRefund).toHaveBeenCalledTimes(1))
    expect(createCardRefund.mock.calls[0][3]).toBe('llave-del-pendiente')
  })

  it('🔴 lista de un servidor sin `key`: nunca se concilia por monto; el pendiente sigue y «Descartar» sale sólo pasados 2 min', async () => {
    const enLista = refund({ id: 'r1', amount: '80.00', status: 'RECORDED', createdAt: new Date().toISOString() }) // sin `key`
    listCardRefunds.mockResolvedValue([enLista])
    storage[STORED] = JSON.stringify({ key: 'llave-k', amount: '80.00', reason: 'OTHER', note: '', savedAt: Date.now() - 10_000 })
    const r = await abrir()
    await screen.findByTestId('card-refund-r1')
    expect(await screen.findByText(`cardRefund.pendingAttempt|${Currency(80)}`)).toBeInTheDocument()
    expect(JSON.parse(storage[STORED]).key).toBe('llave-k')
    expect(screen.queryByRole('button', { name: 'cardRefund.discard' })).toBeNull()
    r.unmount()

    storage[STORED] = JSON.stringify({ key: 'llave-k', amount: '80.00', reason: 'OTHER', note: '', savedAt: Date.now() - DOS_MIN - 5000 })
    await abrir()
    await screen.findByTestId('card-refund-r1')
    expect(await screen.findByRole('button', { name: 'cardRefund.discard' })).toBeInTheDocument()
    expect(screen.queryByText(/^cardRefund\.notArrived/)).toBeNull() // sin llaves no se sabe si llegó
    expect(JSON.parse(storage[STORED]).key).toBe('llave-k')
  })

  it('con la llave del pendiente en la lista y todavía en curso, el aviso «en proceso» se queda y otro cuerpo no se manda', async () => {
    listCardRefunds.mockResolvedValue([refund({ id: 'r1', key: 'llave-k', amount: '80.00', status: 'PENDING', createdAt: new Date().toISOString() })])
    storage[STORED] = JSON.stringify({ key: 'llave-k', amount: '80.00', reason: 'OTHER', note: '', savedAt: Date.now() - DOS_MIN - 5000 })
    await abrir()
    expect(await screen.findByText(`cardRefund.pendingAttempt|${Currency(80)}`)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'cardRefund.discard' })).toBeNull() // sí llegó: no hay nada que descartar
    escribirMonto('30')
    await devolver()
    expect(await screen.findByText(`cardRefund.blocked|${Currency(80)}`)).toBeInTheDocument()
    expect(createCardRefund).not.toHaveBeenCalled()
  })

  it('si la lista no se puede releer antes de una devolución nueva, no se manda', async () => {
    listCardRefunds.mockResolvedValueOnce([]).mockRejectedValue(networkError())
    await abrir()
    await motivo('OTHER')
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'cardRefund.loadFailed', variant: 'destructive' }))
    expect(createCardRefund).not.toHaveBeenCalled()
  })

  it('el intento guardado es de ESA cuenta: otra cuenta del negocio no lo ve', async () => {
    storage[STORED] = JSON.stringify({ key: 'llave-vieja-123', amount: '50.00', reason: 'OTHER', note: '' })
    await abrir(order({ orderId: 'o2' }))
    expect(screen.queryByText(AVISO)).toBeNull()
  })

  it('un intento guardado roto (o sin almacenamiento) no tumba la hoja', async () => {
    storage[STORED] = '{no es json'
    await abrir()
    expect(screen.queryByText(AVISO)).toBeNull()
    vi.mocked(window.localStorage.setItem).mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    createCardRefund.mockResolvedValue({ status: 'RECORDED', cardRefundStatus: 'RECORDED', cardRefundId: 'r9', refundId: 'p9', replay: false })
    await motivo()
    await devolver()
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'cardRefund.outcome.done' })))
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
