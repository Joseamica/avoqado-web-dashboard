import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'

// Socket falso: guarda los manejadores para disparar eventos a mano. Objeto estable (no vi.fn: mockReset).
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

const getInbox = vi.fn()
vi.mock('@/services/onlineOrdering.service', async importOriginal => {
  const actual = await importOriginal<typeof import('@/services/onlineOrdering.service')>()
  return { ...actual, getInbox: (...a: unknown[]) => getInbox(...a) }
})

import { useOnlineOrdersInbox } from '../hooks/useOnlineOrdersInbox'

const inbox = {
  serverTime: '2026-10-17T18:00:00.000Z',
  counts: { pending: 0, accepted: 0, ready: 0, active: 0, done: 0 },
  orders: [],
  truncated: false,
  nextCursor: null,
  store: null,
}

const setVisibility = (v: DocumentVisibilityState) =>
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => v })

const renderInbox = (trayActive: () => boolean) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  return renderHook(() => useOnlineOrdersInbox('venue-1', { trayActive }), { wrapper })
}

describe('useOnlineOrdersInbox', () => {
  beforeEach(() => {
    getInbox.mockReset()
    getInbox.mockResolvedValue(inbox)
    setVisibility('visible')
  })
  afterEach(() => setVisibility('visible'))

  it('pestaña visible y Bandeja activa ⇒ la petición lleva la cabecera de latido', async () => {
    renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: true }))
  })

  it('Bandeja que no mantiene abierta la tienda ⇒ sin cabecera', async () => {
    renderInbox(() => false)
    await waitFor(() => expect(getInbox).toHaveBeenCalledWith('venue-1', { tray: false }))
  })

  it('🔴 pestaña oculta + evento de socket ⇒ la petición que dispara NO lleva la cabecera', async () => {
    renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1))
    expect(getInbox).toHaveBeenLastCalledWith('venue-1', { tray: true })

    setVisibility('hidden')
    act(() => handlers.order_created({ orderId: 'o9', source: 'WEB' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
    expect(getInbox).toHaveBeenLastCalledWith('venue-1', { tray: false })
  })

  it('order_updated sin onlineStatus no refresca; con onlineStatus sí', async () => {
    renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1))

    act(() => handlers.order_updated({ orderId: 'o1', status: 'COMPLETED' }))
    await new Promise(r => setTimeout(r, 30))
    expect(getInbox).toHaveBeenCalledTimes(1)

    act(() => handlers.order_updated({ orderId: 'o1', onlineStatus: 'READY' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  it('eventos de OTRO negocio no refrescan', async () => {
    renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1))

    act(() => handlers.order_created({ orderId: 'x1', source: 'WEB', venueId: 'venue-2' }))
    act(() => handlers.order_updated({ orderId: 'x1', onlineStatus: 'READY', venueId: 'venue-2' }))
    await new Promise(r => setTimeout(r, 30))
    expect(getInbox).toHaveBeenCalledTimes(1)

    act(() => handlers.order_created({ orderId: 'o3', source: 'WEB', venueId: 'venue-1' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
  })

  it('order_created que no es de la tienda en línea no refresca', async () => {
    renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1))

    act(() => handlers.order_created({ orderId: 'o2', source: 'TPV' }))
    await new Promise(r => setTimeout(r, 30))
    expect(getInbox).toHaveBeenCalledTimes(1)
  })
})

describe('D662 v5 (Codex p2v4-r5 #3): un aviso con la primera lectura todavía en camino', () => {
  beforeEach(() => {
    getInbox.mockReset()
    setVisibility('visible')
  })

  it('🔴 lanza una lectura NUEVA (no reusa la que salió antes del aviso) y gana la nueva aunque la vieja llegue después', async () => {
    let soltarVieja!: (v: unknown) => void
    getInbox
      .mockImplementationOnce(() => new Promise(r => (soltarVieja = r)))
      .mockResolvedValueOnce({ ...inbox, store: { status: 'OPEN', reason: null } })
    const { result } = renderInbox(() => true)
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(1))
    // Otra caja tocó «Reanudar»: llega el aviso mientras la primera lectura (que vio «Pausada») sigue en camino sin datos.
    act(() => handlers['online_ordering_store_changed']({ venueId: 'venue-1' }))
    await waitFor(() => expect(getInbox).toHaveBeenCalledTimes(2))
    await waitFor(() => expect(result.current.data?.store?.status).toBe('OPEN'))
    await act(async () => soltarVieja({ ...inbox, store: { status: 'PAUSED', reason: 'MANUAL_PAUSE' } }))
    expect(result.current.data?.store?.status).toBe('OPEN')
  })
})

