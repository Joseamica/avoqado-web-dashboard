import { beforeEach, describe, expect, it, vi } from 'vitest'
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

// `src/test/setup.ts` deja `localStorage` como vi.fn() vacíos (y `mockReset` los limpia): aquí se les da un almacén real.
const storage: Record<string, string> = {}
const SOUND = 'avq:online-orders:sound'

const http = (status: number, data: object) => Object.assign(new Error('http'), { isAxiosError: true, response: { status, data } })
const networkError = () => Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' })
const deferred = <T,>() => {
  let resolve!: (v: T) => void
  const promise = new Promise<T>(r => (resolve = r))
  return { promise, resolve }
}

// `mutate()` llama al servicio ya dentro de una microtarea y avisa `isPending` en otra: se deja pasar un turno completo.
const settleMutations = () => act(async () => void (await new Promise(r => setTimeout(r, 20))))

describe('InboxTab', () => {
  beforeEach(() => {
    for (const f of [
      getInbox,
      getToPay,
      getSettings,
      acceptOrder,
      rejectOrder,
      markReady,
      markDelivered,
      cancelOrder,
      pauseOrdering,
      toast,
      unlock,
      play,
      mockStatus,
    ])
      f.mockReset()
    mockStatus.mockReturnValue(status())
    getToPay.mockResolvedValue(toPayRes())
    getSettings.mockResolvedValue({ requiresAcceptance: false })
    unlock.mockResolvedValue(true)
    chime.state = 'running'
    for (const k of Object.keys(storage)) delete storage[k]
    vi.mocked(window.localStorage.getItem).mockImplementation((k: string) => storage[k] ?? null)
    vi.mocked(window.localStorage.setItem).mockImplementation((k: string, v: string) => {
      storage[k] = v
    })
  })

  it('aceptar con 15 min', async () => {
    getInbox.mockResolvedValue(inbox([order()]))
    acceptOrder.mockResolvedValue({ status: 'ACCEPTED' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.accept' }))
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.accept.minutes|15' }))
    await waitFor(() => expect(acceptOrder).toHaveBeenCalledWith('venue-1', 'o1', 15))
    // success ⇒ refresca la bandeja
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  it('la tarjeta muestra folio, cliente, renglones con opciones y nota, total y «Cobrar al recoger»; «Mostrando X de N» si recorta', async () => {
    getInbox.mockResolvedValue(inbox([order()], { counts: { pending: 3, accepted: 0, ready: 0, active: 0, done: 0 } }))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByText(/101/)).toBeInTheDocument()
    expect(within(card).getByText('Ana')).toBeInTheDocument()
    expect(within(card).getByText('+525512345678')).toBeInTheDocument()
    expect(within(card).getByText('T(2026-10-17T17:55:00.000Z)')).toBeInTheDocument()
    expect(within(card).getByText(/Taco/)).toBeInTheDocument()
    expect(within(card).getByText(/Salsa verde/)).toBeInTheDocument()
    expect(within(card).getByText(/sin cebolla/)).toBeInTheDocument()
    expect(within(card).getByText(/^inbox\.card\.payAtPickup\|/)).toBeInTheDocument()
    expect(screen.getByText('inbox.sections.showing|1,3')).toBeInTheDocument()
  })

  it('«Entregado» deshabilitado con remaining > 0: «Falta cobrarlo»', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'READY', remaining: 80 }), order({ orderId: 'o2', status: 'READY', remaining: 0 })]))
    renderTab()
    const owed = await screen.findByTestId('order-o1')
    expect(within(owed).getByRole('button', { name: 'inbox.actions.delivered' })).toBeDisabled()
    expect(within(owed).getByText('inbox.card.collectFirst')).toBeInTheDocument()
    const paid = screen.getByTestId('order-o2')
    expect(within(paid).getByText('inbox.card.paid')).toBeInTheDocument()
    expect(within(paid).getByRole('button', { name: 'inbox.actions.delivered' })).toBeEnabled()
  })

  it('sin orders:update (ni cancelar) no hay botones de pedido', async () => {
    mockStatus.mockReturnValue(status({ canAnswer: false, canCancel: false, keepsStoreOpen: false }))
    getInbox.mockResolvedValue(
      inbox([order(), order({ orderId: 'o2', status: 'ACCEPTED' }), order({ orderId: 'o3', status: 'READY', remaining: 0 })]),
    )
    renderTab()
    await screen.findByTestId('order-o3')
    for (const name of ['accept', 'reject', 'ready', 'delivered', 'cancel'])
      expect(screen.queryByRole('button', { name: `inbox.actions.${name}` })).toBeNull()
  })

  it('rechazar con motivo y nota', async () => {
    getInbox.mockResolvedValue(inbox([order()]))
    rejectOrder.mockResolvedValue({ status: 'REJECTED' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.reject' }))
    const confirm = await screen.findByRole('button', { name: 'inbox.reject.confirm' })
    expect(confirm).toBeDisabled() // sin motivo no se rechaza
    await userEvent.click(screen.getByRole('button', { name: 'inbox.reject.reasons.TOO_BUSY' }))
    await userEvent.type(screen.getByRole('textbox'), 'Mucho trabajo')
    await userEvent.click(confirm)
    await waitFor(() => expect(rejectOrder).toHaveBeenCalledWith('venue-1', 'o1', 'TOO_BUSY', 'Mucho trabajo'))
  })

  it('409 a otro estado ⇒ «Ese pedido ya no está disponible» y refresca', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'ACCEPTED' })]))
    markReady.mockRejectedValue(http(409, { success: false, code: 'ORDER_STATE_CHANGED', status: 'CANCELLED_BY_CUSTOMER', error: 'x' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'inbox.outcome.gone' })))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  it('cancelar pide confirmación; con un cobro ⇒ «cancélalo desde el POS»', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'ACCEPTED' })]))
    cancelOrder.mockRejectedValue(http(409, { success: false, code: 'ORDER_HAS_PAYMENTS', error: 'x' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.cancel' }))
    expect(cancelOrder).not.toHaveBeenCalled()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.cancel.confirm' }))
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('venue-1', 'o1'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'inbox.outcome.hasPayments' })))
  })

  it('preferencia de sonido activa y contexto suspended ⇒ banner «Toca para activar el sonido» que llama unlock()', async () => {
    storage[SOUND] = '1'
    chime.state = 'suspended'
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.sound.unlock' }))
    expect(unlock).toHaveBeenCalled()
  })

  it('con pendientes: suena en cada sondeo si el sonido corre; con el sonido apagado lo pide', async () => {
    getInbox.mockResolvedValue(inbox([order()]))
    const { unmount } = renderTab()
    expect(await screen.findByText('inbox.sound.nag')).toBeInTheDocument()
    expect(play).not.toHaveBeenCalled()
    unmount()

    storage[SOUND] = '1'
    renderTab()
    await waitFor(() => expect(play).toHaveBeenCalled())
    expect(screen.queryByText('inbox.sound.nag')).toBeNull()
  })

  it('si el navegador no termina de arrancar el audio, el interruptor no se traba', async () => {
    unlock.mockReturnValue(new Promise(() => {})) // resume() que nunca resuelve (Safari)
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    const sw = await screen.findByRole('switch', { name: 'inbox.sound.toggle' })
    await userEvent.click(sw)
    expect(unlock).toHaveBeenCalled()
    expect(storage[SOUND]).toBe('1')
    expect(sw).toHaveAttribute('aria-checked', 'true')
  })

  it('navegador sin WebAudio ⇒ ni interruptor, ni banner, ni «Activa el sonido»: lo explica', async () => {
    chime.state = 'unsupported'
    storage[SOUND] = '1'
    getInbox.mockResolvedValue(inbox([order()]))
    renderTab()
    expect(await screen.findByText('inbox.sound.unsupported')).toBeInTheDocument()
    expect(screen.queryByRole('switch', { name: 'inbox.sound.toggle' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'inbox.sound.unlock' })).toBeNull()
    expect(screen.queryByText('inbox.sound.nag')).toBeNull()
  })

  it('el interruptor «Activar sonido» desbloquea con el clic y guarda la preferencia', async () => {
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    await userEvent.click(await screen.findByRole('switch', { name: 'inbox.sound.toggle' }))
    expect(unlock).toHaveBeenCalled()
    expect(storage[SOUND]).toBe('1')
  })

  it('pausa 30 min ⇒ pauseOrdering(…, 30)', async () => {
    getInbox.mockResolvedValue(inbox([]))
    pauseOrdering.mockResolvedValue({ pausedUntil: '2026-10-17T18:30:00.000Z', manualPause: false })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.pause.minutes|30' }))
    await waitFor(() => expect(pauseOrdering).toHaveBeenCalledWith('venue-1', 30))
  })

  it('pausa con hora ⇒ «Pausada hasta» y «Reanudar» quita la pausa', async () => {
    getInbox.mockResolvedValue(
      inbox([], { store: { status: 'PAUSED', reason: 'MANUAL_PAUSE', pausedUntil: '2026-10-17T18:30:00.000Z', manualPause: false } }),
    )
    pauseOrdering.mockResolvedValue({ pausedUntil: null, manualPause: false })
    renderTab()
    expect(await screen.findByText('settings.status.pausedUntil|T(2026-10-17T18:30:00.000Z)')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'inbox.pause.resume' }))
    await waitFor(() => expect(pauseOrdering).toHaveBeenCalledWith('venue-1', null))
  })

  it('con manualPause no hay «Reanudar»', async () => {
    getInbox.mockResolvedValue(inbox([], { store: { status: 'PAUSED', reason: 'MANUAL_PAUSE', pausedUntil: null, manualPause: true } }))
    renderTab()
    expect(await screen.findByText('settings.status.pausedManual')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'inbox.pause.resume' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'inbox.pause.minutes|30' })).toBeNull()
  })

  it('pausada por muchos pedidos (TOO_BUSY) ⇒ lo dice y deja pausar', async () => {
    getInbox.mockResolvedValue(inbox([], { store: { status: 'PAUSED', reason: 'TOO_BUSY', pausedUntil: null, manualPause: false } }))
    renderTab()
    expect(await screen.findByText('settings.status.pausedBusy')).toBeInTheDocument()
    expect(screen.queryByText('settings.status.pausedManual')).toBeNull()
    expect(screen.getByRole('button', { name: 'inbox.pause.minutes|30' })).toBeInTheDocument()
  })

  it('tienda apagada o sin estado ⇒ sin botones de pausa', async () => {
    getInbox.mockResolvedValue(inbox([], { store: { status: 'DISABLED', reason: 'NOT_ENABLED', pausedUntil: null, manualPause: false } }))
    const { unmount } = renderTab()
    await screen.findByTestId('online-inbox')
    expect(screen.queryByRole('button', { name: 'inbox.pause.minutes|30' })).toBeNull()
    unmount()

    getInbox.mockResolvedValue(inbox([], { store: null }))
    renderTab()
    await screen.findByTestId('online-inbox')
    expect(screen.queryByRole('button', { name: 'inbox.pause.minutes|30' })).toBeNull()
  })

  it('doble clic en «Listo» ⇒ una sola llamada', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'ACCEPTED' })]))
    const ready = deferred<unknown>()
    markReady.mockReturnValue(ready.promise)
    renderTab()
    await userEvent.dblClick(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    expect(markReady).toHaveBeenCalledTimes(1)
    ready.resolve({ status: 'READY' })
  })

  // ── Revisión final (full-testingv2): dos clics a 7 ms. `userEvent.dblClick` espera entre clics y deja que React Query
  // avise `isPending`; un doble clic real de la máquina no: el botón sigue habilitado y salían 2 POST (200 y 409). ──
  it('🔴 dos clics seguidos en «Listo», antes de que React Query avise ⇒ una sola llamada; al terminar vuelve a dejar contestar', async () => {
    getInbox.mockResolvedValueOnce(inbox([order({ status: 'ACCEPTED' })]))
    getInbox.mockResolvedValue(inbox([order({ status: 'READY', remaining: 0 })]))
    const ready = deferred<unknown>()
    markReady.mockReturnValue(ready.promise)
    markDelivered.mockResolvedValue({ status: 'COMPLETED' })
    renderTab()
    const button = await screen.findByRole('button', { name: 'inbox.actions.ready' })
    fireEvent.click(button)
    fireEvent.click(button)
    await settleMutations()
    expect(markReady).toHaveBeenCalledTimes(1)
    await act(async () => ready.resolve({ status: 'READY' }))
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.delivered' }))
    expect(markDelivered).toHaveBeenCalledTimes(1)
  })

  it('🔴 dos clics seguidos en «Entregado» ⇒ una sola llamada', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'READY', remaining: 0 })]))
    const delivered = deferred<unknown>()
    markDelivered.mockReturnValue(delivered.promise)
    renderTab()
    const button = await screen.findByRole('button', { name: 'inbox.actions.delivered' })
    fireEvent.click(button)
    fireEvent.click(button)
    await settleMutations()
    expect(markDelivered).toHaveBeenCalledTimes(1)
    delivered.resolve({ status: 'COMPLETED' })
  })

  it('si la acción falla por red, el candado se suelta y se puede reintentar', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'ACCEPTED' })]))
    markReady.mockRejectedValueOnce(networkError()).mockResolvedValue({ status: 'READY' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(screen.getByRole('button', { name: 'inbox.actions.ready' })).toBeEnabled())
    await userEvent.click(screen.getByRole('button', { name: 'inbox.actions.ready' }))
    expect(markReady).toHaveBeenCalledTimes(2)
  })

  it('doble clic en el tiempo de «Aceptar» ⇒ una sola llamada', async () => {
    getInbox.mockResolvedValue(inbox([order()]))
    const accepted = deferred<unknown>()
    acceptOrder.mockReturnValue(accepted.promise)
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.accept' }))
    await userEvent.dblClick(await screen.findByRole('button', { name: 'inbox.accept.minutes|15' }))
    expect(acceptOrder).toHaveBeenCalledTimes(1)
    accepted.resolve({ status: 'ACCEPTED' })
  })

  it('una acción que falla por red ⇒ «Reintenta cuando vuelva la conexión» y no refresca', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'ACCEPTED' })]))
    markReady.mockRejectedValue(networkError())
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'inbox.outcome.network' })))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    expect(getInbox).toHaveBeenCalledTimes(1)
  })

  it('los botones no se reactivan con la tarjeta vieja: esperan al refresco', async () => {
    getInbox.mockResolvedValueOnce(inbox([order({ status: 'ACCEPTED' })]))
    const refetch = deferred<unknown>()
    getInbox.mockReturnValueOnce(refetch.promise)
    markReady.mockResolvedValue({ status: 'READY' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
    await new Promise(r => setTimeout(r, 30))
    expect(screen.getByRole('button', { name: 'inbox.actions.ready' })).toBeDisabled()
    await act(async () => refetch.resolve(inbox([order({ status: 'READY', remaining: 0 })])))
    expect(await screen.findByRole('button', { name: 'inbox.actions.delivered' })).toBeEnabled()
  })

  it('sin plan la bandeja consulta y contesta', async () => {
    mockStatus.mockReturnValue(status({ hasPlan: false }))
    getInbox.mockResolvedValue(inbox([order()]))
    acceptOrder.mockResolvedValue({ status: 'ACCEPTED' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.accept' }))
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.accept.minutes|10' }))
    await waitFor(() => expect(acceptOrder).toHaveBeenCalledWith('venue-1', 'o1', 10))
  })

  it('🔴 keepsStoreOpen === false ⇒ getInbox con tray:false y la cabecera lo explica', async () => {
    mockStatus.mockReturnValue(status({ keepsStoreOpen: false }))
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    expect(await screen.findByText('inbox.viewOnly')).toBeInTheDocument()
    expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: false })
    expect(getInbox).not.toHaveBeenCalledWith('venue-1', { tray: true })
  })

  it('keepsStoreOpen ⇒ tray:true y el aviso de los 2 minutos', async () => {
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    expect(await screen.findByText('inbox.keepsOpen')).toBeInTheDocument()
    expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: true })
  })

  // ── Ronda final · D2: textos honestos del estado de la tienda ──
  it('🔴 sin plan el estado de la tienda dice «Sin plan», no «Abierta»', async () => {
    mockStatus.mockReturnValue(status({ hasPlan: false }))
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    expect(await screen.findByText('inbox.status.noPlan')).toBeInTheDocument()
    expect(screen.queryByText('settings.status.OPEN|OPEN')).toBeNull()
  })

  it('🔴 quien no puede mantener abierta la tienda y la ve OFFLINE: «Nadie con permiso de contestar tiene la Bandeja abierta»', async () => {
    mockStatus.mockReturnValue(status({ keepsStoreOpen: false }))
    getInbox.mockResolvedValue(inbox([], { store: { status: 'OFFLINE', reason: 'NO_DEVICE', pausedUntil: null, manualPause: false } }))
    renderTab()
    expect(await screen.findByText('inbox.status.offlineNobody')).toBeInTheDocument()
    expect(screen.queryByText('settings.status.OFFLINE|OFFLINE')).toBeNull()
  })

  it('quien SÍ mantiene abierta la tienda y la ve OFFLINE conserva el texto de «deja la Bandeja abierta»', async () => {
    getInbox.mockResolvedValue(inbox([], { store: { status: 'OFFLINE', reason: 'NO_DEVICE', pausedUntil: null, manualPause: false } }))
    renderTab()
    expect(await screen.findByText('settings.status.OFFLINE|OFFLINE')).toBeInTheDocument()
    expect(screen.queryByText('inbox.status.offlineNobody')).toBeNull()
  })

  // ── Ronda final · D4: un pedido cerrado sin cobro no dice «Cobrar al recoger» ──
  it.each(['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_STAFF', 'REJECTED', 'EXPIRED'])(
    '🔴 %s no dice «Cobrar al recoger»: dice «Sin cobro»',
    async st => {
      getInbox.mockResolvedValue(inbox([order({ status: st, remaining: 95, total: 95, acceptDeadlineAt: null })]))
      renderTab()
      const card = await screen.findByTestId('order-o1')
      expect(within(card).getByText('inbox.card.noCharge')).toBeInTheDocument()
      expect(within(card).queryByText(/^inbox\.card\.payAtPickup\|/)).toBeNull()
      expect(within(card).queryByText('inbox.card.paid')).toBeNull()
    },
  )

  it('un pedido entregado y pagado sigue diciendo «Pagado»', async () => {
    getInbox.mockResolvedValue(inbox([order({ status: 'COMPLETED', remaining: 0, acceptDeadlineAt: null })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByText('inbox.card.paid')).toBeInTheDocument()
    expect(within(card).queryByText('inbox.card.noCharge')).toBeNull()
  })

  // ── Ronda final · D5: la cuenta regresiva no se encima con «Para recoger» ──
  it('🔴 «Para recoger» no se parte y la cuenta regresiva va en su propio renglón, no junto a la hora', async () => {
    getInbox.mockResolvedValue(inbox([order()]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByText('inbox.card.pickup').className).toContain('whitespace-nowrap')
    const time = within(card).getByText('T(2026-10-17T17:55:00.000Z)')
    const deadline = within(card).getByText(/^inbox\.card\.deadline\|/)
    expect(time.parentElement).not.toContainElement(deadline)
  })

  // ── Revisión final (full-testingv2): una nota del comensal con una palabra larga (una liga) no rompe las tarjetas ──
  it('🔴 las notas cortan palabras largas y la cuadrícula tiene una columna acotada (a 375 px no ensancha)', async () => {
    const link = `https://ejemplo.mx/${'n'.repeat(200)}`
    getInbox.mockResolvedValue(inbox([order({ note: link, items: [{ name: 'Taco', quantity: 1, note: link, modifiers: [] }] })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getAllByText(link)).toHaveLength(2)
    for (const note of within(card).getAllByText(link)) expect(note.className).toContain('break-words')
    expect(card.parentElement?.className).toContain('grid-cols-1')
  })

  // ── Ronda final · D6: el aviso de plan vencido se va solo al reactivar el plan ──
  const renderWithPlanProbe = (planFetch: () => Promise<unknown>) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const PlanProbe = () => {
      useQuery({ queryKey: planTierQueryKey('venue-1'), queryFn: planFetch, staleTime: 5 * 60 * 1000 })
      return null
    }
    return render(
      <QueryClientProvider client={qc}>
        <PlanProbe />
        <InboxTab />
      </QueryClientProvider>,
    )
  }

  it('🔴 con el plan vencido cada sondeo de la bandeja vuelve a pedir el plan', async () => {
    const planFetch = vi.fn().mockResolvedValue({})
    mockStatus.mockReturnValue(status({ hasPlan: false }))
    getInbox.mockResolvedValue(inbox([]))
    renderWithPlanProbe(planFetch)
    await screen.findByTestId('online-inbox')
    await waitFor(() => expect(planFetch).toHaveBeenCalledTimes(2)) // al montar + tras el primer sondeo
    act(() => handlers.order_updated({ orderId: 'o1', onlineStatus: 'ACCEPTED' })) // otro sondeo
    await waitFor(() => expect(planFetch).toHaveBeenCalledTimes(3))
  })

  it('con el plan vigente el sondeo no molesta a la consulta del plan', async () => {
    const planFetch = vi.fn().mockResolvedValue({})
    getInbox.mockResolvedValue(inbox([]))
    renderWithPlanProbe(planFetch)
    await screen.findByTestId('online-inbox')
    act(() => handlers.order_updated({ orderId: 'o1', onlineStatus: 'ACCEPTED' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
    await new Promise(r => setTimeout(r, 30))
    expect(planFetch).toHaveBeenCalledTimes(1)
  })

  // ── Fase 2: pedidos pagados con tarjeta en línea ──
  const cardOrder = (over: Record<string, unknown> = {}) =>
    order({
      paymentMode: 'CARD_ONLINE',
      cardStatus: 'AUTHORIZED',
      card: { status: 'AUTHORIZED', amount: 80, capturedAmount: null, authorizedAt: '2026-10-17T17:55:00.000Z', capturedAt: null },
      ...over,
    })
  const captured = {
    status: 'CAPTURED',
    amount: 80,
    capturedAmount: 80,
    authorizedAt: '2026-10-17T17:55:00.000Z',
    capturedAt: '2026-10-17T18:00:00.000Z',
  }
  const closedCard = (status: string, charge: string) =>
    cardOrder({ status, cardStatus: null, card: { ...captured, status: charge, capturedAmount: null }, acceptDeadlineAt: null })
  const moneyLine = (card: HTMLElement) => within(card).getByText(/^inbox\.card\.(card|payAtPickup|paid|noCharge)/)

  it.each([
    ['por aceptar (tarjeta apartada)', cardOrder(), 'inbox.card.cardAuthorized'],
    [
      'cobrándose',
      cardOrder({ cardStatus: 'CONFIRMING', card: { ...captured, status: 'CAPTURING', capturedAmount: null } }),
      'inbox.card.cardConfirming',
    ],
    [
      'aceptado y cobrado',
      cardOrder({ status: 'ACCEPTED', cardStatus: null, card: captured, paymentStatus: 'PAID', remaining: 0 }),
      'inbox.card.cardPaid',
    ],
    [
      'entregado (remaining 0)',
      cardOrder({
        status: 'COMPLETED',
        cardStatus: null,
        card: captured,
        paymentStatus: 'COMPLETED',
        remaining: 0,
        acceptDeadlineAt: null,
      }),
      'inbox.card.cardPaid',
    ],
    // Codex iOS r1 #4: la cuenta se pagó por otro camino y la tarjeta se soltó: «Pagado», sin atribuírselo a la tarjeta.
    [
      'pagado por otro camino, tarjeta liberada',
      cardOrder({
        status: 'ACCEPTED',
        cardStatus: null,
        card: { ...captured, status: 'RELEASED', capturedAmount: null },
        paymentStatus: 'PAID',
        remaining: 0,
      }),
      'inbox.card.paid',
    ],
    [
      'pagado sin cargo conocido',
      cardOrder({ status: 'ACCEPTED', cardStatus: null, card: null, paymentStatus: 'PAID', remaining: 0 }),
      'inbox.card.paid',
    ],
    [
      'rechazado con la tarjeta COBRADA',
      cardOrder({ status: 'REJECTED', cardStatus: null, card: captured, acceptDeadlineAt: null }),
      'inbox.card.cardCapturedRefund',
    ],
    ['vencido con la tarjeta liberada', closedCard('EXPIRED', 'RELEASED'), 'inbox.card.cardNotCharged'],
    ['rechazado con el cargo abandonado', closedCard('REJECTED', 'ABANDONED'), 'inbox.card.cardNotCharged'],
    ['rechazado porque no se pudo cobrar', closedCard('REJECTED', 'CAPTURE_FAILED'), 'inbox.card.cardNotCharged'],
    // Codex ANDROID r1 #1: con el desenlace en duda nunca «No se cobró»: «Liberando la tarjeta…».
    ['cancelado con la tarjeta liberándose', closedCard('CANCELLED_BY_CUSTOMER', 'RELEASING'), 'inbox.card.cardReleasing'],
    ['vencido con la tarjeta todavía apartada', closedCard('EXPIRED', 'AUTHORIZED'), 'inbox.card.cardReleasing'],
    ['cancelado con el cobro en curso', closedCard('CANCELLED_BY_STAFF', 'CAPTURING'), 'inbox.card.cardReleasing'],
    [
      'cerrado sin cargo conocido',
      cardOrder({ status: 'EXPIRED', cardStatus: null, card: null, acceptDeadlineAt: null }),
      'inbox.card.cardReleasing',
    ],
  ])('🔴 tarjeta en línea %s ⇒ su texto de dinero, nunca «Cobrar al recoger»', async (_name, o, text) => {
    getInbox.mockResolvedValue(inbox([o]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(moneyLine(card)).toHaveTextContent(text)
    expect(within(card).queryByText(/^inbox\.card\.payAtPickup\|/)).toBeNull()
    expect(within(card).queryByText('inbox.card.collectFirst')).toBeNull()
  })

  it('🔴 «Aceptar» apagado mientras se confirma el pago (CONFIRMING); «Rechazar» no', async () => {
    getInbox.mockResolvedValue(inbox([cardOrder({ cardStatus: 'CONFIRMING' })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByRole('button', { name: 'inbox.actions.accept' })).toBeDisabled()
    expect(within(card).getByRole('button', { name: 'inbox.actions.reject' })).toBeEnabled()
  })

  it('con la tarjeta apartada «Aceptar» sí se puede', async () => {
    getInbox.mockResolvedValue(inbox([cardOrder()]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByRole('button', { name: 'inbox.actions.accept' })).toBeEnabled()
  })

  it('un pedido de tarjeta listo y con saldo (anomalía) no pide «Falta cobrarlo»: el panel nunca cobra tarjeta', async () => {
    getInbox.mockResolvedValue(inbox([cardOrder({ status: 'READY', cardStatus: null, card: captured, remaining: 80 })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).queryByText('inbox.card.collectFirst')).toBeNull()
  })

  it.each(['PAYMENT_FAILED', 'TOO_BUSY'])('el motivo del rechazo recibido (%s) se ve en la tarjeta', async reason => {
    getInbox.mockResolvedValue(inbox([cardOrder({ status: 'REJECTED', cardStatus: null, rejectReason: reason, acceptDeadlineAt: null })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByText(`inbox.reject.reasons.${reason}`)).toBeInTheDocument()
  })

  it('🔴 409 ONLINE_ORDER_CONFIRMING_PAYMENT al aceptar ⇒ aviso NEUTRO con el texto del servidor y refresca la bandeja', async () => {
    getInbox.mockResolvedValue(inbox([cardOrder()]))
    acceptOrder.mockRejectedValue(
      http(409, { message: 'Estamos confirmando el pago con la tarjeta', code: 'ONLINE_ORDER_CONFIRMING_PAYMENT' }),
    )
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.accept' }))
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.accept.minutes|15' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Estamos confirmando el pago con la tarjeta' }))
    expect(toast).not.toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  const aceptar = async () => {
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.accept' }))
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.accept.minutes|15' }))
  }
  const confirmingError = () =>
    http(409, { message: 'Estamos confirmando el pago con la tarjeta', code: 'ONLINE_ORDER_CONFIRMING_PAYMENT' })

  it('🔴 tras el 409 CONFIRMING, si la relectura FALLA, «Aceptar» sigue apagado aunque la tarjeta vieja diga «apartada»', async () => {
    getInbox.mockResolvedValueOnce(inbox([cardOrder()]))
    getInbox.mockRejectedValue(networkError())
    acceptOrder.mockRejectedValue(confirmingError())
    renderTab()
    await aceptar()
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Estamos confirmando el pago con la tarjeta' }))
    expect(await screen.findByText('inbox.offline', {}, { timeout: 4000 })).toBeInTheDocument()
    const card = screen.getByTestId('order-o1')
    // Codex panel r1 #2: el servidor ya dijo que está cobrando; aunque los datos viejos digan «apartada», el dinero dice «Confirmando».
    expect(within(card).getByText('inbox.card.cardConfirming')).toBeInTheDocument()
    expect(within(card).queryByText('inbox.card.cardAuthorized')).toBeNull()
    expect(within(card).getByRole('button', { name: 'inbox.actions.accept' })).toBeDisabled()
  })

  it('🔴 tras el 409 CONFIRMING, «Aceptar» se vuelve a prender sólo con una lectura EXITOSA que ya no diga CONFIRMING', async () => {
    getInbox
      .mockResolvedValueOnce(inbox([cardOrder()]))
      .mockResolvedValueOnce(inbox([cardOrder({ cardStatus: 'CONFIRMING' })]))
      .mockResolvedValue(inbox([cardOrder()]))
    acceptOrder.mockRejectedValue(confirmingError())
    renderTab()
    await aceptar()
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
    const card = await screen.findByTestId('order-o1')
    await waitFor(() => expect(within(card).getByText('inbox.card.cardConfirming')).toBeInTheDocument())
    expect(within(card).getByRole('button', { name: 'inbox.actions.accept' })).toBeDisabled()
    act(() => handlers.order_updated({ orderId: 'o1', onlineStatus: 'PENDING_ACCEPTANCE' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(3))
    await waitFor(() => expect(within(screen.getByTestId('order-o1')).getByRole('button', { name: 'inbox.actions.accept' })).toBeEnabled())
  })

  it('🔴 «Devolver a la tarjeta» en la tarjeta de un pedido COBRADO (también rechazado con la tarjeta cobrada), sólo con permiso', async () => {
    getInbox.mockResolvedValue(
      inbox([
        cardOrder({ status: 'COMPLETED', cardStatus: null, card: captured, remaining: 0, acceptDeadlineAt: null }),
        cardOrder({ orderId: 'o2', status: 'REJECTED', cardStatus: null, card: captured, acceptDeadlineAt: null }),
        cardOrder({ orderId: 'o3' }),
        order({ orderId: 'o4', status: 'COMPLETED', remaining: 0, acceptDeadlineAt: null }),
      ]),
    )
    const { unmount } = renderTab()
    expect(within(await screen.findByTestId('order-o1')).getByRole('button', { name: 'cardRefund.open' })).toBeInTheDocument()
    expect(within(screen.getByTestId('order-o2')).getByRole('button', { name: 'cardRefund.open' })).toBeInTheDocument()
    expect(within(screen.getByTestId('order-o3')).queryByRole('button', { name: 'cardRefund.open' })).toBeNull() // sólo apartada
    expect(within(screen.getByTestId('order-o4')).queryByRole('button', { name: 'cardRefund.open' })).toBeNull() // al recoger
    unmount()

    mockStatus.mockReturnValue(status({ canRefund: false }))
    renderTab()
    await screen.findByTestId('order-o1')
    expect(screen.queryByRole('button', { name: 'cardRefund.open' })).toBeNull()
  })

  it('409 ONLINE_ORDER_PAID_BY_CARD ⇒ aviso con el texto del servidor, no un error rojo', async () => {
    getInbox.mockResolvedValue(inbox([cardOrder({ status: 'READY', cardStatus: null, card: captured, remaining: 0 })]))
    markDelivered.mockRejectedValue(http(409, { message: 'Este pedido ya se pagó con tarjeta', code: 'ONLINE_ORDER_PAID_BY_CARD' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.delivered' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'Este pedido ya se pagó con tarjeta' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  it('consulta en error con datos viejos ⇒ «Sin conexión: no llegan pedidos nuevos»', async () => {
    getInbox.mockResolvedValueOnce(inbox([order()]))
    getInbox.mockRejectedValue(Object.assign(new Error('Network Error'), { isAxiosError: true }))
    renderTab()
    await screen.findByTestId('order-o1')
    act(() => handlers.order_updated({ orderId: 'o1', onlineStatus: 'ACCEPTED' }))
    // El sondeo reintenta una vez (retry: 1, ~1 s) antes de darse por caído.
    expect(await screen.findByText('inbox.offline', {}, { timeout: 4000 })).toBeInTheDocument()
    expect(screen.getByTestId('order-o1')).toBeInTheDocument()
  })
})

describe('InboxTab · folios de «Nadie» (Por pagar / Por entregar)', () => {
  beforeEach(() => {
    for (const f of [getInbox, getToPay, markReady, markDelivered, cancelOrder, toast, mockStatus]) f.mockReset()
    mockStatus.mockReturnValue(status())
    getInbox.mockResolvedValue(inbox([]))
    getToPay.mockResolvedValue(toPayRes())
    getSettings.mockResolvedValue({ requiresAcceptance: false })
  })

  it('«Por pagar» lista el folio con «Vence en N min» y «Falta $X», sin Aceptar ni Cobrar', async () => {
    getToPay.mockResolvedValue(toPayRes([folio()]))
    renderTab()
    const card = await screen.findByTestId('folio-f1')
    expect(within(card).getByText('W7KQ2')).toBeInTheDocument()
    expect(within(card).getByText('Ana')).toBeInTheDocument()
    expect(within(card).getByText('folio.expiresIn|22')).toBeInTheDocument()
    expect(within(card).getByRole('button', { name: 'folio.cancel' })).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'inbox.actions.accept' })).toBeNull()
    expect(within(card).queryByRole('button', { name: /collect|cobrar/i })).toBeNull()
    expect(screen.getByText('folio.note')).toBeInTheDocument()
  })

  it('con abono: «Falta $X de $Y», «Ya pagó $Z», «Se cobra en caja» y sin «Cancelar folio»', async () => {
    getToPay.mockResolvedValue(toPayRes([folio({ total: 185, remaining: 85, paymentStatus: 'PARTIAL' })]))
    renderTab()
    const card = await screen.findByTestId('folio-f1')
    expect(within(card).getByText(/^folio\.missing\|/)).toBeInTheDocument()
    expect(within(card).getByText(/^folio\.alreadyPaid\|/)).toBeInTheDocument()
    expect(within(card).getByText('folio.collectAtRegister')).toBeInTheDocument()
    expect(within(card).queryByRole('button', { name: 'folio.cancel' })).toBeNull()
  })

  it('con 5 min o menos el tiempo va en ámbar, nunca rojo', async () => {
    getToPay.mockResolvedValue(toPayRes([folio({ acceptDeadlineAt: '2026-10-17T18:03:00.000Z' })]))
    renderTab()
    const el = await screen.findByText('folio.expiresIn|3')
    expect(el.className).toMatch(/amber/)
    expect(el.className).not.toMatch(/destructive|red/)
  })

  it('«Cancelar folio» pide confirmación y manda cancelOrder; el folio sale de la lista', async () => {
    getToPay.mockResolvedValueOnce(toPayRes([folio()])).mockResolvedValue(toPayRes())
    cancelOrder.mockResolvedValue({ status: 'CANCELLED_BY_STAFF' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.cancel' }))
    expect(cancelOrder).not.toHaveBeenCalled()
    expect(await screen.findByText('folio.cancelDialog.title|W 7 K Q 2')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'folio.cancelDialog.confirm' }))
    await waitFor(() => expect(cancelOrder).toHaveBeenCalledWith('venue-1', 'f1'))
    await waitFor(() => expect(screen.queryByTestId('folio-f1')).toBeNull())
  })

  it('«Cancelar folio» no aparece sin orders:cancel-unpaid', async () => {
    mockStatus.mockReturnValue(status({ canCancel: false }))
    getToPay.mockResolvedValue(toPayRes([folio()]))
    renderTab()
    await screen.findByTestId('folio-f1')
    expect(screen.queryByRole('button', { name: 'folio.cancel' })).toBeNull()
  })

  it('con dinero, el servidor contesta ORDER_HAS_PAYMENTS y sale el texto de hasPayments', async () => {
    getToPay.mockResolvedValue(toPayRes([folio()]))
    cancelOrder.mockRejectedValue(http(409, { code: 'ORDER_HAS_PAYMENTS' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.cancel' }))
    await userEvent.click(await screen.findByRole('button', { name: 'folio.cancelDialog.confirm' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'inbox.outcome.hasPayments' }))
  })

  it('«Por entregar» lista folios pagados con «Listo» y «Entregado»; «Entregado» avisa y el folio sale', async () => {
    getToPay
      .mockResolvedValueOnce(toPayRes([], [folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })]))
      .mockResolvedValue(toPayRes())
    markDelivered.mockResolvedValue({ status: 'COMPLETED' })
    renderTab()
    const card = await screen.findByTestId('folio-f1')
    expect(within(card).getByRole('button', { name: 'inbox.actions.ready' })).toBeInTheDocument()
    await userEvent.click(within(card).getByRole('button', { name: 'inbox.actions.delivered' }))
    await waitFor(() => expect(markDelivered).toHaveBeenCalledWith('venue-1', 'f1'))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'folio.delivered|W 7 K Q 2,Ana' }))
    await waitFor(() => expect(screen.queryByTestId('folio-f1')).toBeNull())
  })

  it('«Listo» manda markReady', async () => {
    getToPay.mockResolvedValue(toPayRes([], [folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })]))
    markReady.mockResolvedValue({ status: 'READY' })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(markReady).toHaveBeenCalledWith('venue-1', 'f1'))
  })

  it('«Listo» y «Entregado» no existen sin orders:update', async () => {
    mockStatus.mockReturnValue(status({ canAnswer: false }))
    getToPay.mockResolvedValue(toPayRes([], [folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })]))
    renderTab()
    await screen.findByTestId('folio-f1')
    expect(screen.queryByRole('button', { name: 'inbox.actions.ready' })).toBeNull()
    expect(screen.queryByRole('button', { name: 'inbox.actions.delivered' })).toBeNull()
  })

  it('un folio no sale repetido en «En preparación»: la Bandeja filtra requiresAcceptance=false y cuenta acceptedTeam', async () => {
    const paid = folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })
    const team = order({ orderId: 'o9', orderNumber: '109', status: 'ACCEPTED', requiresAcceptance: true })
    getInbox.mockResolvedValue(inbox([paid, team], { counts: { pending: 0, accepted: 2, acceptedTeam: 1, ready: 0, active: 2, done: 0 } }))
    getToPay.mockResolvedValue(toPayRes([], [paid]))
    renderTab()
    await screen.findByTestId('order-o9')
    expect(await screen.findByTestId('folio-f1')).toBeInTheDocument()
    expect(screen.queryByTestId('order-f1')).toBeNull()
    expect(screen.getByRole('heading', { name: /inbox\.sections\.accepted/ })).toHaveTextContent('(1)')
  })

  it('con 101 por entregar, «Cargar más» pide nextCursors.toDeliver con section=toDeliver y deja marcar el 101', async () => {
    const first = Array.from({ length: 100 }, (_, i) =>
      folio({ orderId: `d${i}`, onlineOrderId: `do${i}`, orderNumber: `W${i}`, status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 }),
    )
    const last = folio({
      orderId: 'd100',
      onlineOrderId: 'do100',
      orderNumber: 'W100',
      customerName: 'Zoe',
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      remaining: 0,
    })
    getToPay
      .mockResolvedValueOnce(toPayRes([], first, { counts: { toPay: 0, toDeliver: 101 }, nextCursors: { toPay: null, toDeliver: 'CUR1' } }))
      .mockResolvedValueOnce(toPayRes([], [last], { counts: { toPay: 0, toDeliver: 101 }, nextCursors: { toPay: null, toDeliver: null } }))
      .mockResolvedValue(toPayRes([], first, { counts: { toPay: 0, toDeliver: 100 } }))
    markDelivered.mockResolvedValue({ status: 'COMPLETED' })
    renderTab()
    await screen.findByTestId('folio-d99')
    expect(screen.queryByTestId('folio-d100')).toBeNull()
    await userEvent.click(screen.getByRole('button', { name: 'folio.loadMore' }))
    expect(getToPay).toHaveBeenCalledWith('venue-1', { section: 'toDeliver', cursor: 'CUR1' })
    const card = await screen.findByTestId('folio-d100')
    await userEvent.click(within(card).getByRole('button', { name: 'inbox.actions.delivered' }))
    await waitFor(() => expect(markDelivered).toHaveBeenCalledTimes(1))
    expect(markDelivered).toHaveBeenCalledWith('venue-1', 'd100')
    await waitFor(() => expect(screen.queryByTestId('folio-d100')).toBeNull())
    expect(screen.getByTestId('folio-d0')).toBeInTheDocument()
  })

  it('«Cargar más» de «Por pagar» pide section=toPay', async () => {
    getToPay
      .mockResolvedValueOnce(toPayRes([folio()], [], { nextCursors: { toPay: 'CP', toDeliver: null }, counts: { toPay: 2, toDeliver: 0 } }))
      .mockResolvedValueOnce(toPayRes([folio({ orderId: 'f2', orderNumber: 'W2' })], [], { counts: { toPay: 2, toDeliver: 0 } }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    expect(getToPay).toHaveBeenCalledWith('venue-1', { section: 'toPay', cursor: 'CP' })
    expect(await screen.findByTestId('folio-f2')).toBeInTheDocument()
  })

  it('estado vacío con su porqué', async () => {
    getToPay.mockResolvedValue(toPayRes([], [], { showTile: true, requiresAcceptance: false }))
    renderTab()
    expect(await screen.findByText('folio.emptyToPay')).toBeInTheDocument()
    expect(screen.getByText('folio.emptyToDeliver')).toBeInTheDocument()
  })

  it('cargando: esqueleto; error: «Reintentar» vuelve a pedir', async () => {
    getToPay
      .mockRejectedValueOnce(http(500, {}))
      .mockRejectedValueOnce(http(500, {}))
      .mockResolvedValue(toPayRes([folio()]))
    renderTab()
    expect(await screen.findByText('folio.loadFailed', {}, { timeout: 4000 })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'folio.retry' }))
    expect(await screen.findByTestId('folio-f1')).toBeInTheDocument()
  })

  it('un folio que cambió mientras estaba abierto: aviso «ya no está disponible» y se relee', async () => {
    getToPay.mockResolvedValue(toPayRes([], [folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })]))
    markReady.mockRejectedValue(http(409, { code: 'ORDER_STATE_CHANGED', status: 'COMPLETED' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(toast).toHaveBeenCalledWith({ title: 'inbox.outcome.gone' }))
    await waitFor(() => expect(getToPay.mock.calls.length).toBeGreaterThan(1))
  })

  it('«Mi equipo» con el endpoint fallando: no se ve esqueleto ni error de folios', async () => {
    getSettings.mockResolvedValue({ requiresAcceptance: true })
    getToPay.mockRejectedValue(http(403, {}))
    renderTab()
    await screen.findByTestId('online-inbox')
    await new Promise(r => setTimeout(r, 1500))
    expect(screen.queryByTestId('folio-error')).toBeNull()
    expect(screen.queryByTestId('folio-loading')).toBeNull()
    expect(screen.queryByText('folio.loadFailed')).toBeNull()
  })

  it('lo traído con «Cargar más» que cambió: ORDER_STATE_CHANGED lo quita y no repite el aviso', async () => {
    const mk = (i: number) =>
      folio({ orderId: `d${i}`, onlineOrderId: `do${i}`, orderNumber: `W${i}`, status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })
    getToPay
      .mockResolvedValueOnce(toPayRes([], [mk(0)], { counts: { toPay: 0, toDeliver: 2 }, nextCursors: { toPay: null, toDeliver: 'C' } }))
      .mockResolvedValueOnce(toPayRes([], [mk(1)], { counts: { toPay: 0, toDeliver: 2 } }))
      .mockResolvedValue(toPayRes([], [mk(0)], { counts: { toPay: 0, toDeliver: 2 }, nextCursors: { toPay: null, toDeliver: 'C' } }))
    markReady.mockRejectedValue(http(409, { code: 'ORDER_STATE_CHANGED', status: 'COMPLETED' }))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    const card = await screen.findByTestId('folio-d1')
    await userEvent.click(within(card).getByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(screen.queryByTestId('folio-d1')).toBeNull())
    expect(toast).toHaveBeenCalledTimes(1)
  })

  it('un folio presente en las dos secciones sólo sale en «Por entregar»', async () => {
    const f = folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })
    getToPay.mockResolvedValue(toPayRes([folio()], [f], { counts: { toPay: 1, toDeliver: 1 } }))
    renderTab()
    await screen.findByTestId('folio-f1')
    expect(screen.getAllByTestId('folio-f1')).toHaveLength(1)
    expect(screen.getByRole('button', { name: 'inbox.actions.delivered' })).toBeInTheDocument()
  })

  it('«Por entregar» con paidAt dice «Pagado a las HH:MM»; sin paidAt, «Pidió»', async () => {
    const base = { status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 }
    getToPay.mockResolvedValue(
      toPayRes([], [folio({ ...base, paidAt: '2026-10-17T18:05:00.000Z' }), folio({ ...base, orderId: 'f2', orderNumber: 'W2' })]),
    )
    renderTab()
    expect(await screen.findByText(/^folio\.paidAt\|T\(2026-10-17T18:05:00.000Z\)/)).toBeInTheDocument()
    expect(within(screen.getByTestId('folio-f2')).getByText(/^folio\.orderedAt\|/)).toBeInTheDocument()
  })

  const mkD = (i: number, over: Record<string, unknown> = {}) =>
    folio({
      orderId: `d${i}`,
      onlineOrderId: `do${i}`,
      orderNumber: `W${i}`,
      status: 'ACCEPTED',
      paymentStatus: 'PAID',
      remaining: 0,
      ...over,
    })
  const page1 = (over: Record<string, unknown> = {}, items = [mkD(0), mkD(5)]) =>
    toPayRes([], items, { counts: { toPay: 0, toDeliver: 3 }, nextCursors: { toPay: null, toDeliver: 'C' }, ...over })

  it('en cada sondeo se RELEEN las páginas extra ya cargadas: una lectura igual las conserva', async () => {
    getToPay
      .mockResolvedValueOnce(page1())
      .mockResolvedValueOnce(toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 } }))
      .mockImplementation(async (_v: string, p?: { cursor?: string }) =>
        p?.cursor ? toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 } }) : page1(),
      )
    markReady.mockRejectedValue(http(500, {}))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d1')
    await userEvent.click(within(screen.getByTestId('folio-d0')).getByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(getToPay.mock.calls.filter(c => c[1]?.cursor === 'C').length).toBe(2))
    expect(screen.getByTestId('folio-d1')).toBeInTheDocument()
  })

  it('un folio de «Cargar más» que cambió en otro aparato con movimientos que se compensan (mismos conteos, misma página 1) se actualiza en el sondeo', async () => {
    getToPay
      .mockResolvedValueOnce(page1())
      .mockResolvedValueOnce(toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 } }))
      // d1 se entregó y entró d2: los conteos y la página 1 son idénticos; sólo cambia lo que hay tras el cursor.
      .mockImplementation(async (_v: string, p?: { cursor?: string }) =>
        p?.cursor ? toPayRes([], [mkD(2)], { counts: { toPay: 0, toDeliver: 3 } }) : page1(),
      )
    markReady.mockRejectedValue(http(500, {}))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d1')
    await userEvent.click(within(screen.getByTestId('folio-d0')).getByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(screen.queryByTestId('folio-d1')).toBeNull())
    expect(await screen.findByTestId('folio-d2')).toBeInTheDocument()
  })

  it('con más de 100 activos, «Cargar más» de «Listos» pide status=active con el nextCursor y deja marcar el 101', async () => {
    const ready = (i: number) =>
      order({ orderId: `r${i}`, orderNumber: `${200 + i}`, status: 'READY', remaining: 0, paymentStatus: 'PAID' })
    getInbox
      .mockResolvedValueOnce(inbox([ready(0)], { nextCursor: 'AC1', counts: { pending: 0, accepted: 0, ready: 2, active: 2, done: 0 } }))
      .mockResolvedValueOnce(inbox([ready(100)], { nextCursor: null, counts: { pending: 0, accepted: 0, ready: 2, active: 2, done: 0 } }))
      .mockImplementation(async (_v: string, o?: { cursor?: string }) =>
        o?.cursor
          ? inbox([ready(100)], { nextCursor: null, counts: { pending: 0, accepted: 0, ready: 2, active: 2, done: 0 } })
          : inbox([ready(0)], { nextCursor: 'AC1', counts: { pending: 0, accepted: 0, ready: 2, active: 2, done: 0 } }),
      )
    markDelivered.mockResolvedValue({ status: 'COMPLETED' })
    renderTab()
    await screen.findByTestId('order-r0')
    expect(screen.queryByTestId('order-r100')).toBeNull()
    await userEvent.click(screen.getAllByRole('button', { name: 'inbox.sections.loadMore' })[0])
    expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: false, status: 'active', cursor: 'AC1' })
    const card = await screen.findByTestId('order-r100')
    await userEvent.click(within(card).getByRole('button', { name: 'inbox.actions.delivered' }))
    await waitFor(() => expect(markDelivered).toHaveBeenCalledWith('venue-1', 'r100'))
  })

  it('«Mi equipo»: un evento de la Bandeja relee el inbox pero no vuelve a pedir to-pay', async () => {
    getSettings.mockResolvedValue({ requiresAcceptance: true })
    getInbox.mockResolvedValue(inbox([]))
    renderTab()
    await screen.findByTestId('online-inbox')
    await waitFor(() => expect(getToPay).toHaveBeenCalledTimes(1))
    const inboxCalls = getInbox.mock.calls.length
    await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
    await waitFor(() => expect(getInbox.mock.calls.length).toBeGreaterThan(inboxCalls))
    await settleMutations()
    expect(getToPay).toHaveBeenCalledTimes(1)
  })

  it('«Mi equipo» que se vuelve «Nadie» desde otra computadora: un folio en la Bandeja enciende to-pay y sale en «Por entregar»', async () => {
    getSettings.mockResolvedValue({ requiresAcceptance: true })
    const paid = folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })
    getInbox
      .mockResolvedValueOnce(inbox([]))
      .mockResolvedValue(inbox([paid], { counts: { pending: 0, accepted: 1, acceptedTeam: 0, ready: 0, active: 1, done: 0 } }))
    getToPay.mockResolvedValueOnce(toPayRes()).mockResolvedValue(toPayRes([], [paid]))
    renderTab()
    await screen.findByTestId('online-inbox')
    await waitFor(() => expect(getToPay).toHaveBeenCalledTimes(1))
    await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
    expect(await screen.findByTestId('folio-f1')).toBeInTheDocument()
    expect(getToPay).toHaveBeenCalledTimes(2)
  })

  it('relecturas lentas: no se encadenan ni se descartan; la página se aplica al llegar y corre una más al terminar', async () => {
    let cursorCalls = 0
    const slow = deferred<ReturnType<typeof toPayRes>>()
    const slow2 = deferred<ReturnType<typeof toPayRes>>()
    getToPay.mockImplementation(async (_v: string, p?: { cursor?: string }) => {
      if (!p?.cursor) return page1()
      cursorCalls++
      if (cursorCalls === 1) return toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 } })
      if (cursorCalls === 2) return slow.promise
      return slow2.promise
    })
    markReady.mockRejectedValue(http(500, {}))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d1')
    await userEvent.click(within(screen.getByTestId('folio-d0')).getByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(cursorCalls).toBe(2))
    // Otro sondeo con la relectura en vuelo: no se lanza otra (sigue en 2 llamadas).
    await userEvent.click(within(screen.getByTestId('folio-d5')).getByRole('button', { name: 'inbox.actions.ready' }))
    await settleMutations()
    expect(cursorCalls).toBe(2)
    await act(async () => slow.resolve(toPayRes([], [mkD(2)], { counts: { toPay: 0, toDeliver: 3 } })))
    expect(await screen.findByTestId('folio-d2')).toBeInTheDocument()
    // Y al terminar corre la que quedó anotada.
    await waitFor(() => expect(cursorCalls).toBe(3))
    await act(async () => slow2.resolve(toPayRes([], [mkD(3)], { counts: { toPay: 0, toDeliver: 3 } })))
    expect(await screen.findByTestId('folio-d3')).toBeInTheDocument()
    expect(screen.queryByTestId('folio-d2')).toBeNull()
    expect(cursorCalls).toBe(3)
  })

  it('la página 2 ya no existe (otra caja entregó y todo cabe en la página 1): los extras se limpian y el conteo es el del servidor', async () => {
    getToPay
      .mockResolvedValueOnce(page1())
      .mockResolvedValueOnce(toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 } }))
      // Otra caja entregó d1 y d5: queda sólo d0, sin cursor.
      .mockImplementation(async () =>
        toPayRes([], [mkD(0)], { counts: { toPay: 0, toDeliver: 1 }, nextCursors: { toPay: null, toDeliver: null } }),
      )
    markReady.mockRejectedValue(http(500, {}))
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d1')
    await userEvent.click(within(screen.getByTestId('folio-d0')).getByRole('button', { name: 'inbox.actions.ready' }))
    await waitFor(() => expect(screen.queryByTestId('folio-d1')).toBeNull())
    expect(screen.getByRole('heading', { name: /folio\.sections\.toDeliver/ })).toHaveTextContent('(1)')
    expect(screen.queryByRole('button', { name: 'folio.loadMore' })).toBeNull()
  })

  it('un folio que cambió de página entre lecturas no sale dos veces', async () => {
    getToPay.mockImplementation(async (_v: string, p?: { cursor?: string }) => {
      if (!p?.cursor) return page1()
      if (p.cursor === 'C')
        return toPayRes([], [mkD(1)], { counts: { toPay: 0, toDeliver: 3 }, nextCursors: { toPay: null, toDeliver: 'C2' } })
      return toPayRes([], [mkD(1), mkD(2)], { counts: { toPay: 0, toDeliver: 3 } })
    })
    renderTab()
    await userEvent.click(await screen.findByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d1')
    await userEvent.click(screen.getByRole('button', { name: 'folio.loadMore' }))
    await screen.findByTestId('folio-d2')
    expect(screen.getAllByTestId('folio-d1')).toHaveLength(1)
  })

  it('con abono no hay «Vence en» ni «Está por vencer»: sólo «Se cobra en caja»', async () => {
    getToPay.mockResolvedValue(toPayRes([folio({ total: 185, remaining: 85, paymentStatus: 'PARTIAL' })]))
    renderTab()
    const card = await screen.findByTestId('folio-f1')
    expect(within(card).getByText('folio.collectAtRegister')).toBeInTheDocument()
    expect(within(card).queryByText(/folio\.expiresIn|folio\.expiring|folio\.expiresAt/)).toBeNull()
  })

  it('«Vence en» urgente usa un ámbar con contraste (amber-700 en claro, amber-400 en oscuro)', async () => {
    getToPay.mockResolvedValue(toPayRes([folio({ acceptDeadlineAt: '2026-10-17T18:03:00.000Z' })]))
    renderTab()
    const el = await screen.findByText('folio.expiresIn|3')
    expect(el.className).toContain('text-amber-700')
    expect(el.className).toContain('dark:text-amber-400')
    expect(el.className).not.toContain('text-amber-600')
  })

  it('un folio quitado de «Por pagar» por estar en «Por entregar» no descuadra el número', async () => {
    const f = folio({ status: 'ACCEPTED', paymentStatus: 'PAID', remaining: 0 })
    getToPay.mockResolvedValue(toPayRes([folio()], [f], { counts: { toPay: 1, toDeliver: 1 } }))
    renderTab()
    await screen.findByTestId('folio-f1')
    expect(screen.getByRole('heading', { name: /folio\.sections\.toPay/ })).toHaveTextContent('(0)')
    expect(screen.getByText('folio.emptyToPay')).toBeInTheDocument()
  })

  it('R87 «Mi equipo» sin nada: no relee to-pay con eventos de la Bandeja ni a los 10 s, pero sí a los 120 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      getSettings.mockResolvedValue({ requiresAcceptance: true })
      renderTab()
      await screen.findByTestId('online-inbox')
      await act(async () => handlers['order_updated']?.({ onlineStatus: 'ACCEPTED', venueId: 'venue-1' }))
      await act(async () => void (await vi.advanceTimersByTimeAsync(11_000)))
      expect(getToPay).toHaveBeenCalledTimes(1)
      await act(async () => void (await vi.advanceTimersByTimeAsync(115_000)))
      expect(getToPay).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('R87 caso de Codex: un folio en toPay con counts 0 y showTile false se ve y la consulta sigue viva', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      getSettings.mockResolvedValue({ requiresAcceptance: true })
      getToPay.mockResolvedValue(toPayRes([folio()], [], { counts: { toPay: 0, toDeliver: 0 }, showTile: false }))
      renderTab()
      expect(await screen.findByTestId('folio-f1')).toBeInTheDocument()
      await act(async () => void (await vi.advanceTimersByTimeAsync(11_000)))
      expect(getToPay).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('control: con «Nadie» sí se vuelve a leer to-pay a los 10 s', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    try {
      getSettings.mockResolvedValue({ requiresAcceptance: false })
      getToPay.mockResolvedValue(toPayRes([], [], { showTile: true }))
      renderTab()
      await screen.findByTestId('online-inbox')
      await act(async () => void (await vi.advanceTimersByTimeAsync(11_000)))
      expect(getToPay).toHaveBeenCalledTimes(2)
    } finally {
      vi.useRealTimers()
    }
  })

  it('la nota de «Nadie» sale sólo con folios de «Nadie»', async () => {
    getToPay.mockResolvedValue(toPayRes([folio()]))
    renderTab()
    await screen.findByTestId('folio-f1')
    expect(screen.getByText('folio.note')).toBeInTheDocument()
  })
})
