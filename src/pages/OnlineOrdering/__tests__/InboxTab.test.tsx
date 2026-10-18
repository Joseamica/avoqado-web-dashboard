import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
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

const status = (over: Record<string, unknown> = {}) => ({
  hasPlan: true,
  tierLoading: false,
  canManage: true,
  canAnswer: true,
  canCancel: true,
  canPause: true,
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

describe('InboxTab', () => {
  beforeEach(() => {
    for (const f of [getInbox, acceptOrder, rejectOrder, markReady, markDelivered, cancelOrder, pauseOrdering, toast, unlock, play, mockStatus])
      f.mockReset()
    mockStatus.mockReturnValue(status())
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
  it.each(['CANCELLED_BY_CUSTOMER', 'CANCELLED_BY_STAFF', 'REJECTED', 'EXPIRED'])('🔴 %s no dice «Cobrar al recoger»: dice «Sin cobro»', async st => {
    getInbox.mockResolvedValue(inbox([order({ status: st, remaining: 95, total: 95, acceptDeadlineAt: null })]))
    renderTab()
    const card = await screen.findByTestId('order-o1')
    expect(within(card).getByText('inbox.card.noCharge')).toBeInTheDocument()
    expect(within(card).queryByText(/^inbox\.card\.payAtPickup\|/)).toBeNull()
    expect(within(card).queryByText('inbox.card.paid')).toBeNull()
  })

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
