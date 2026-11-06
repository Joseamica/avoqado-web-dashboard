import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, o?: Record<string, unknown>) => (o ? `${key}|${Object.values(o).join(',')}` : key) }),
}))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'venue-1', fullBasePath: '/venues/t' }) }))
vi.mock('@/utils/datetime', () => ({ useVenueDateTime: () => ({ formatTime: (d: string) => `T(${d})` }) }))
const mockStatus = vi.fn()
vi.mock('@/hooks/use-online-ordering-status', () => ({ useOnlineOrderingStatus: () => mockStatus() }))
const toast = vi.fn()
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast }) }))

const handlers: Record<string, (p: unknown) => void> = {}
const fakeSocket = {
  on: (event: string, h: (p: unknown) => void) => {
    handlers[event] = h
  },
  off: (event: string) => {
    delete handlers[event]
  },
}
const noop = () => {}
vi.mock('@/context/SocketContext', () => ({
  useSocket: () => ({ socket: fakeSocket, isConnected: true, joinVenueRoom: noop, leaveVenueRoom: noop }),
}))

// El sonido: un objeto que delega en el estado de la prueba (mockReset borra las implementaciones de vi.fn).
const chime = { state: 'running' as AudioContextState | 'unsupported' }
const unlock = vi.fn()
const play = vi.fn()
vi.mock('../lib/chime', () => ({
  createChime: () => ({ unlock: () => unlock(), play: () => play(), state: () => chime.state }),
}))

const getInbox = vi.fn()
const getToPay = vi.fn()
const getSettings = vi.fn()
const acceptOrder = vi.fn()
const rejectOrder = vi.fn()
const markReady = vi.fn()
const markDelivered = vi.fn()
const cancelOrder = vi.fn()
const pauseOrdering = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return {
    ...actual,
    getInbox: (...a: unknown[]) => getInbox(...a),
    getToPay: (...a: unknown[]) => getToPay(...a),
    getSettings: (...a: unknown[]) => getSettings(...a),
    acceptOrder: (...a: unknown[]) => acceptOrder(...a),
    rejectOrder: (...a: unknown[]) => rejectOrder(...a),
    markReady: (...a: unknown[]) => markReady(...a),
    markDelivered: (...a: unknown[]) => markDelivered(...a),
    cancelOrder: (...a: unknown[]) => cancelOrder(...a),
    pauseOrdering: (...a: unknown[]) => pauseOrdering(...a),
  }
})

import { planTierQueryKey } from '@/hooks/use-tier-feature-access'
import { InboxTab } from '../components/InboxTab'

const order = (over: Record<string, unknown> = {}) => ({
  orderId: 'o1',
  onlineOrderId: 'oo1',
  orderNumber: '101',
  status: 'PENDING_ACCEPTANCE',
  paymentMode: 'PAY_AT_PICKUP',
  customerName: 'Ana',
  customerPhone: '+525512345678',
  note: null,
  createdAt: '2026-10-17T17:55:00.000Z',
  acceptDeadlineAt: '2026-10-17T18:05:00.000Z',
  estimatedReadyAt: null,
  total: 80,
  remaining: 80,
  paymentStatus: 'PENDING',
  needsPrint: false,
  items: [{ name: 'Taco', quantity: 2, note: 'sin cebolla', modifiers: [{ name: 'Salsa verde', quantity: 1 }] }],
  ...over,
})

const OPEN = { status: 'OPEN', reason: 'OPEN', pausedUntil: null, manualPause: false }
const inbox = (orders: ReturnType<typeof order>[], over: Record<string, unknown> = {}) => ({
  serverTime: '2026-10-17T18:00:00.000Z',
  counts: {
    pending: orders.filter(o => o.status === 'PENDING_ACCEPTANCE').length,
    accepted: orders.filter(o => o.status === 'ACCEPTED').length,
    ready: orders.filter(o => o.status === 'READY').length,
    active: 0,
    done: 0,
  },
  orders,
  truncated: false,
  nextCursor: null,
  store: OPEN,
  ...over,
})

const folio = (over: Record<string, unknown> = {}) =>
  order({
    orderId: 'f1',
    onlineOrderId: 'fo1',
    orderNumber: 'W7KQ2',
    customerName: 'Ana',
    customerPhone: null,
    requiresAcceptance: false,
    channel: 'QR',
    total: 134,
    remaining: 134,
    acceptDeadlineAt: '2026-10-17T18:22:00.000Z',
    items: [{ name: 'Flautas', quantity: 2, note: null, modifiers: [] }],
    ...over,
  })
const toPayRes = (
  toPay: ReturnType<typeof folio>[] = [],
  toDeliver: ReturnType<typeof folio>[] = [],
  over: Record<string, unknown> = {},
) => ({
  serverTime: '2026-10-17T18:00:00.000Z',
  enabled: true,
  requiresAcceptance: toPay.length + toDeliver.length === 0 ? true : false,
  showTile: toPay.length + toDeliver.length > 0,
  pollSeconds: 30,
  counts: { toPay: toPay.length, toDeliver: toDeliver.length },
  toPay,
  toDeliver,
  nextCursors: { toPay: null, toDeliver: null },
  store: OPEN,
  ...over,
})

const status = (over: Record<string, unknown> = {}) => ({
  hasPlan: true,
  tierLoading: false,
  canManage: true,
  canAnswer: true,
  canCancel: true,
  canPause: true,
  canRefund: true,
  keepsStoreOpen: true,
  ...over,
})

const renderTab = () => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <InboxTab />
    </QueryClientProvider>,
  )
}

const http = (st: number, data: object) => Object.assign(new Error('http'), { isAxiosError: true, response: { status: st, data } })
const nadieFolio = (over: Record<string, unknown> = {}) => folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0, ...over })
const empty = (over: Record<string, unknown> = {}) => toPayRes([], [], { showTile: false, ...over })
const advance = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)))

/**
 * R88 · tabla de verdad del panel: el MODO de `to-pay` (VIVO 10 s / LENTO 120 s) sale SÓLO de la última respuesta buena de to-pay;
 * ni los ajustes guardados ni la historia de la Bandeja lo deciden. La Bandeja sólo da un empujón único.
 */
describe('to-pay · modo y visibilidad (R88)', () => {
  beforeEach(() => {
    for (const f of [getInbox, getToPay, getSettings, toast, mockStatus]) f.mockReset()
    mockStatus.mockReturnValue(status())
    getInbox.mockResolvedValue(inbox([]))
    getSettings.mockResolvedValue({ requiresAcceptance: true })
    vi.useFakeTimers({ shouldAdvanceTime: true })
  })
  afterEach(() => vi.useRealTimers())

  type Row = {
    name: string
    inbox: 'ok' | 'error'
    toPay: () => unknown
    settingsNadie: boolean
    inboxOrders?: ReturnType<typeof order>[]
    visible: boolean | 'error'
    callsAt11s: number
  }
  const rows: Row[] = [
    {
      name: 'Inbox ok · to-pay con folios · Nadie ⇒ visible y VIVO',
      inbox: 'ok',
      toPay: () => toPayRes([nadieFolio()]),
      settingsNadie: true,
      visible: true,
      callsAt11s: 2,
    },
    {
      name: 'Inbox ok · to-pay vacío · Mi equipo ⇒ nada y LENTO',
      inbox: 'ok',
      toPay: () => empty(),
      settingsNadie: false,
      visible: false,
      callsAt11s: 1,
    },
    {
      name: 'Inbox ok · to-pay vacío con showTile (Nadie encendido) ⇒ vacíos con su porqué y VIVO',
      inbox: 'ok',
      toPay: () => empty({ showTile: true }),
      settingsNadie: true,
      visible: true,
      callsAt11s: 2,
    },
    {
      name: 'r5 #1 · Inbox ERROR · to-pay con folios ⇒ los folios se ven y VIVO',
      inbox: 'error',
      toPay: () => toPayRes([nadieFolio()]),
      settingsNadie: true,
      visible: true,
      callsAt11s: 2,
    },
    {
      name: 'Inbox ERROR · to-pay ERROR · Nadie ⇒ aviso propio y LENTO (sólo el reintento)',
      inbox: 'error',
      toPay: () => Promise.reject(http(500, {})),
      settingsNadie: true,
      visible: 'error',
      callsAt11s: 2,
    },
    {
      name: 'Inbox ok · to-pay ERROR · Mi equipo ⇒ nada nuevo y LENTO',
      inbox: 'ok',
      toPay: () => Promise.reject(http(403, {})),
      settingsNadie: false,
      visible: false,
      callsAt11s: 2,
    },
    {
      name: 'r5 #2 · otra computadora pasó a Mi equipo (ajustes viejos dicen Nadie) ⇒ LENTO',
      inbox: 'ok',
      toPay: () => empty(),
      settingsNadie: true,
      visible: false,
      callsAt11s: 1,
    },
    {
      name: 'r5 #2 · historia de la Bandeja con folios de Nadie ENTREGADOS ⇒ LENTO',
      inbox: 'ok',
      toPay: () => empty(),
      settingsNadie: false,
      inboxOrders: [nadieFolio({ status: 'COMPLETED' }), nadieFolio({ orderId: 'f2', status: 'CANCELLED_BY_STAFF' })],
      visible: false,
      callsAt11s: 1,
    },
    {
      name: 'r4 #1 · folio en toPay con counts 0 y showTile false ⇒ visible y VIVO',
      inbox: 'ok',
      toPay: () =>
        toPayRes([nadieFolio({ status: 'PENDING_ACCEPTANCE', paymentStatus: 'PENDING', remaining: 134 })], [], {
          counts: { toPay: 0, toDeliver: 0 },
          showTile: false,
        }),
      settingsNadie: false,
      visible: true,
      callsAt11s: 2,
    },
  ]

  it.each(rows)('$name', async row => {
    getSettings.mockResolvedValue({ requiresAcceptance: !row.settingsNadie })
    if (row.inbox === 'error') getInbox.mockRejectedValue(http(500, {}))
    else if (row.inboxOrders) getInbox.mockResolvedValue(inbox(row.inboxOrders))
    getToPay.mockImplementation(async () => row.toPay())
    renderTab()
    await advance(row.visible === 'error' ? 1_500 : 300)
    if (row.visible === true) expect(await screen.findByTestId('folio-sections')).toBeInTheDocument()
    else if (row.visible === 'error') expect(await screen.findByTestId('folio-error')).toBeInTheDocument()
    else {
      expect(screen.queryByTestId('folio-sections')).toBeNull()
      expect(screen.queryByTestId('folio-error')).toBeNull()
      expect(screen.queryByTestId('folio-loading')).toBeNull()
    }
    await advance(11_000)
    expect(getToPay).toHaveBeenCalledTimes(row.callsAt11s)
  })

  it('«Mi equipo» con nada: LENTO, y a los 120 s sí relee', async () => {
    getToPay.mockImplementation(async () => empty())
    renderTab()
    await advance(11_000)
    expect(getToPay).toHaveBeenCalledTimes(1)
    await advance(115_000)
    expect(getToPay).toHaveBeenCalledTimes(2)
  })

  it('«Mi equipo» con nada: un evento de la Bandeja no relee to-pay', async () => {
    getToPay.mockImplementation(async () => empty())
    renderTab()
    await advance(300)
    await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
    await advance(1_000)
    expect(getToPay).toHaveBeenCalledTimes(1)
  })

  it('empujón único: la Bandeja trae un folio de Nadie activo que to-pay no tiene ⇒ una relectura; si sigue vacío, no hay sondeo vivo', async () => {
    getInbox.mockResolvedValue(inbox([nadieFolio()]))
    getToPay.mockImplementation(async () => empty())
    renderTab()
    await advance(300)
    expect(getToPay).toHaveBeenCalledTimes(2)
    await advance(11_000)
    expect(getToPay).toHaveBeenCalledTimes(2)
  })

  it('r2 #3 · empujón único con folio real: to-pay lo trae, se ve y pasa a VIVO', async () => {
    const f = nadieFolio()
    getInbox.mockResolvedValueOnce(inbox([])).mockResolvedValue(inbox([f]))
    getToPay.mockResolvedValueOnce(empty()).mockResolvedValue(toPayRes([], [f]))
    renderTab()
    await advance(300)
    expect(screen.queryByTestId('folio-f1')).toBeNull()
    await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
    await advance(500)
    expect(await screen.findByTestId('folio-f1')).toBeInTheDocument()
    const n = getToPay.mock.calls.length
    await advance(10_500)
    expect(getToPay.mock.calls.length).toBe(n + 1)
  })

  it('una vez vivo con folios, un evento de la Bandeja sí relee to-pay', async () => {
    getToPay.mockImplementation(async () => toPayRes([], [nadieFolio()]))
    renderTab()
    await advance(300)
    expect(getToPay).toHaveBeenCalledTimes(1)
    await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
    await advance(500)
    expect(getToPay).toHaveBeenCalledTimes(2)
  })
})
