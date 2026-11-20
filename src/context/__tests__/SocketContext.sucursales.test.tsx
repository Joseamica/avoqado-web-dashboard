/**
 * D662 v5 (encargo 64fabe; Codex p2v5-r1 #8): el panel pide los avisos de la sucursal que mira (aunque su sesión sea de otra). Varias
 * pantallas piden la misma (sólo la última la suelta), un socket nuevo o reconectado las vuelve a pedir todas, y quien espera se entera
 * cuando el SERVIDOR CONFIRMA (ahí relee: un aviso posterior ya le llega).
 */
import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...args: unknown[]) => void
type Emitido = { evento: string; payload: unknown; ack?: (r: unknown) => void }
const sockets: Array<{ handlers: Record<string, Handler>; emitidos: Emitido[]; connected: boolean }> = []

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const s = {
      handlers: {} as Record<string, Handler>,
      emitidos: [] as Emitido[],
      connected: false,
      active: true,
      on(evento: string, fn: Handler) {
        this.handlers[evento] = fn
      },
      emit(evento: string, payload: unknown, ack?: (r: unknown) => void) {
        this.emitidos.push({ evento, payload, ack })
      },
      disconnect: vi.fn(),
    }
    sockets.push(s)
    return s
  }),
}))
vi.mock('../AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false }) }))

import { SocketProvider, useSocket } from '../SocketContext'

let api!: ReturnType<typeof useSocket>
const Espia = () => {
  api = useSocket()
  return null
}
const conectar = (i: number) =>
  act(() => {
    sockets[i].connected = true
    sockets[i].handlers.connect()
  })
const pedidos = (i: number, evento: string) => sockets[i].emitidos.filter(e => e.evento === evento)

beforeEach(() => {
  sockets.length = 0
})

describe('SocketProvider · avisos de otra sucursal', () => {
  it('con el socket conectado pide la sucursal una sola vez aunque dos pantallas la usen; sólo la última la suelta', () => {
    render(
      <SocketProvider>
        <Espia />
      </SocketProvider>,
    )
    conectar(0)
    act(() => {
      api.joinVenueRoom('venue-b')
      api.joinVenueRoom('venue-b')
    })
    expect(pedidos(0, 'joinVenueRoom')).toHaveLength(1)
    act(() => api.leaveVenueRoom('venue-b'))
    expect(pedidos(0, 'leaveVenueRoom')).toHaveLength(0)
    act(() => api.leaveVenueRoom('venue-b'))
    expect(pedidos(0, 'leaveVenueRoom')).toEqual([{ evento: 'leaveVenueRoom', payload: { venueId: 'venue-b' }, ack: undefined }])
  })

  it('🔴 sin conexión no manda nada (no se encola); al conectar —o reconectar— vuelve a pedir TODAS las que se usan', () => {
    render(
      <SocketProvider>
        <Espia />
      </SocketProvider>,
    )
    act(() => api.joinVenueRoom('venue-b'))
    expect(pedidos(0, 'joinVenueRoom')).toHaveLength(0)
    conectar(0)
    expect(pedidos(0, 'joinVenueRoom').map(e => e.payload)).toEqual([{ venueId: 'venue-b' }])
    // Se cae la red y vuelve: el SERVIDOR ya no recuerda ese socket: se vuelve a pedir.
    act(() => {
      sockets[0].connected = false
      sockets[0].handlers.disconnect('transport close')
    })
    conectar(0)
    expect(pedidos(0, 'joinVenueRoom')).toHaveLength(2)
  })

  it('🔴 quien espera se entera cuando el SERVIDOR CONFIRMA (no al pedir); un rechazo no avisa', () => {
    render(
      <SocketProvider>
        <Espia />
      </SocketProvider>,
    )
    conectar(0)
    const releer = vi.fn()
    let dejar!: () => void
    act(() => {
      dejar = api.alConfirmarSucursal('venue-b', releer)
      api.joinVenueRoom('venue-b')
    })
    expect(releer).not.toHaveBeenCalled()
    act(() => pedidos(0, 'joinVenueRoom')[0].ack?.({ success: false }))
    expect(releer).not.toHaveBeenCalled()
    // Reconecta y esta vez el SERVIDOR confirma.
    conectar(0)
    act(() => pedidos(0, 'joinVenueRoom')[1].ack?.({ success: true }))
    expect(releer).toHaveBeenCalledTimes(1)
    act(() => dejar())
    conectar(0)
    act(() => pedidos(0, 'joinVenueRoom')[2].ack?.({ success: true }))
    expect(releer).toHaveBeenCalledTimes(1)
  })

  it('una confirmación que llega después de soltar la sucursal no avisa', () => {
    render(
      <SocketProvider>
        <Espia />
      </SocketProvider>,
    )
    conectar(0)
    const releer = vi.fn()
    act(() => {
      api.alConfirmarSucursal('venue-b', releer)
      api.joinVenueRoom('venue-b')
      api.leaveVenueRoom('venue-b')
    })
    act(() => pedidos(0, 'joinVenueRoom')[0].ack?.({ success: true }))
    expect(releer).not.toHaveBeenCalled()
  })
})

describe('SocketProvider · reintento (Codex p2v5-r2 #4)', () => {
  it('si el SERVIDOR no pudo verificar el permiso, vuelve a pedir la sucursal con espera; un «sin acceso» no se reintenta', () => {
    vi.useFakeTimers()
    try {
      render(
        <SocketProvider>
          <Espia />
        </SocketProvider>,
      )
      conectar(0)
      act(() => api.joinVenueRoom('venue-b'))
      act(() => pedidos(0, 'joinVenueRoom')[0].ack?.({ success: false, error: 'No se pudo verificar el acceso' }))
      act(() => vi.advanceTimersByTime(2_000))
      expect(pedidos(0, 'joinVenueRoom')).toHaveLength(2)
      act(() => pedidos(0, 'joinVenueRoom')[1].ack?.({ success: false, error: 'Sin acceso a esta sucursal' }))
      act(() => vi.advanceTimersByTime(120_000))
      expect(pedidos(0, 'joinVenueRoom')).toHaveLength(2)
    } finally {
      vi.useRealTimers()
    }
  })
})
