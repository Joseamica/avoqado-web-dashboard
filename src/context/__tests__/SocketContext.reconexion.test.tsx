/**
 * Codex ronda 3, G2 (24-sep): cambiar la propia contraseña cierra en el servidor las sesiones —la actual
 * incluida— y con ellas sus sockets. Una desconexión hecha POR EL SERVIDOR apaga la reconexión automática
 * de socket.io, así que el panel se quedaba sin tiempo real aunque ya tenía cookies nuevas.
 * Ahora esa desconexión recrea el socket (las pantallas vuelven a unirse a sus salas), con tope anti-bucle.
 */
import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Handler = (...args: unknown[]) => void
const sockets: Array<{ handlers: Record<string, Handler>; disconnect: ReturnType<typeof vi.fn> }> = []

vi.mock('socket.io-client', () => ({
  io: vi.fn(() => {
    const s = {
      handlers: {} as Record<string, Handler>,
      on(evento: string, fn: Handler) {
        this.handlers[evento] = fn
      },
      emit: vi.fn(),
      disconnect: vi.fn(),
    }
    sockets.push(s)
    return s
  }),
}))

vi.mock('../AuthContext', () => ({ useAuth: () => ({ isAuthenticated: true, isLoading: false }) }))

import { SocketProvider } from '../SocketContext'

beforeEach(() => {
  sockets.length = 0
  vi.useFakeTimers()
})
afterEach(() => vi.useRealTimers())

describe('SocketProvider · desconexión hecha por el servidor', () => {
  it('🔴 recrea el socket cuando el servidor lo desconecta (p. ej. tras cambiar la contraseña)', () => {
    render(<SocketProvider>{null}</SocketProvider>)
    expect(sockets).toHaveLength(1)

    act(() => sockets[0].handlers.disconnect('io server disconnect'))
    act(() => vi.advanceTimersByTime(1500))

    expect(sockets).toHaveLength(2)
    expect(sockets[0].disconnect).toHaveBeenCalled()
  })

  it('una caída de RED no recrea nada: de eso ya se encarga la reconexión de socket.io (regresión)', () => {
    render(<SocketProvider>{null}</SocketProvider>)
    act(() => sockets[0].handlers.disconnect('transport close'))
    act(() => vi.advanceTimersByTime(1500))
    expect(sockets).toHaveLength(1)
  })

  // Codex ronda 4: la primera versión (1 s fijo + 10 s de bloqueo) dejaba el socket muerto en dos casos.
  it('🔴 una segunda desconexión del servidor DESPUÉS de reconectar también se recupera', () => {
    render(<SocketProvider>{null}</SocketProvider>)
    act(() => sockets[0].handlers.disconnect('io server disconnect'))
    act(() => vi.advanceTimersByTime(1000))
    act(() => sockets[1].handlers.connect())
    act(() => sockets[1].handlers.disconnect('io server disconnect'))
    act(() => vi.advanceTimersByTime(1000))
    expect(sockets).toHaveLength(3)
  })

  it('🔴 si las cookies nuevas aún no llegaban (el servidor rechaza la conexión), reintenta más tarde', () => {
    render(<SocketProvider>{null}</SocketProvider>)
    act(() => sockets[0].handlers.disconnect('io server disconnect'))
    act(() => vi.advanceTimersByTime(1000))
    expect(sockets).toHaveLength(2)
    act(() => sockets[1].handlers.connect_error(new Error('no autorizado')))
    act(() => vi.advanceTimersByTime(3000))
    expect(sockets).toHaveLength(3)
  })

  it('tope anti-bucle: si la sesión de verdad ya no sirve, deja de intentar tras 4 intentos', () => {
    render(<SocketProvider>{null}</SocketProvider>)
    act(() => sockets[0].handlers.disconnect('io server disconnect'))
    for (let i = 0; i < 10; i++) {
      act(() => vi.advanceTimersByTime(30_000))
      act(() => sockets[sockets.length - 1].handlers.connect_error?.(new Error('no autorizado')))
    }
    act(() => vi.advanceTimersByTime(120_000))
    expect(sockets).toHaveLength(5) // el original + 4 intentos
  })
})
