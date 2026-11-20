import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const handlers: Record<string, (p?: unknown) => void> = {}
const fakeSocket = {
  on: (event: string, h: (p?: unknown) => void) => {
    handlers[event] = h
  },
  off: (event: string) => {
    delete handlers[event]
  },
}
vi.mock('@/context/SocketContext', () => ({ useSocket: () => ({ socket: fakeSocket }) }))

import { esperaHastaLaHoraLimite, laMasNueva, MARGEN_TRAS_LA_HORA_LIMITE_MS, useRelecturaDeLaTienda } from '../hooks/useRelecturaDeLaTienda'

/** D662 v4 (hueco 5): Configuración y la bandeja vuelven a leer el estado de la tienda en cuanto puede cambiar. */
describe('relectura del estado de la tienda', () => {
  it('programa la relectura justo después de la próxima hora límite, contando desde que SALIÓ la petición (no del reloj del navegador)', () => {
    const enviadoEn = 1_000_000
    // El SERVIDOR leyó a las 12:00:00 y el próximo pedido vence a las 12:00:10; la respuesta llegó 2 s después de salir.
    const espera = esperaHastaLaHoraLimite(
      { storeReadAt: '2026-11-20T18:00:00.000Z', storeNextDeadlineAt: '2026-11-20T18:00:10.000Z', enviadoEn },
      enviadoEn + 2_000,
    )
    expect(espera).toBe(10_000 - 2_000 + MARGEN_TRAS_LA_HORA_LIMITE_MS)
  })

  it('sin hora límite o sin las marcas no programa nada; una hora límite ya pasada relee casi de inmediato', () => {
    expect(esperaHastaLaHoraLimite({ storeReadAt: '2026-11-20T18:00:00.000Z', storeNextDeadlineAt: null, enviadoEn: 1 })).toBeNull()
    expect(esperaHastaLaHoraLimite({ storeNextDeadlineAt: '2026-11-20T18:00:10.000Z', enviadoEn: 1 })).toBeNull()
    expect(
      esperaHastaLaHoraLimite(
        { storeReadAt: '2026-11-20T18:00:00.000Z', storeNextDeadlineAt: '2026-11-20T18:00:01.000Z', enviadoEn: 0 },
        60_000,
      ),
    ).toBe(250)
  })

  it('de dos lecturas gana la que el SERVIDOR hizo más tarde, aunque haya llegado antes (Codex p2-r8 #4, p2v4-r1 #11)', () => {
    const vieja = { storeReadAt: '2026-11-20T18:00:00.000Z', id: 'pausada' }
    const nueva = { storeReadAt: '2026-11-20T18:00:05.000Z', id: 'reanudada' }
    expect(laMasNueva(nueva, vieja)?.id).toBe('reanudada')
    expect(laMasNueva(vieja, nueva)?.id).toBe('reanudada')
    expect(laMasNueva(undefined, vieja)?.id).toBe('pausada')
    // Un SERVIDOR viejo (sin la marca): gana la que llegó al último.
    expect(laMasNueva({ id: 'a' }, { id: 'b' })?.id).toBe('b')
  })

  describe('el gancho', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('relee con el aviso del SERVIDOR de ESTE negocio, al reconectarse el socket y al volver a la pestaña', () => {
      const releer = vi.fn()
      renderHook(() => useRelecturaDeLaTienda('venue-1', undefined, releer))
      act(() => handlers['online_ordering_store_changed']?.({ venueId: 'otro' }))
      expect(releer).not.toHaveBeenCalled()
      act(() => handlers['online_ordering_store_changed']?.({ venueId: 'venue-1' }))
      expect(releer).toHaveBeenCalledTimes(1)
      act(() => handlers['connect']?.())
      expect(releer).toHaveBeenCalledTimes(2)
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
      act(() => {
        document.dispatchEvent(new Event('visibilitychange'))
      })
      expect(releer).toHaveBeenCalledTimes(3)
    })

    it('relee sola justo después de la próxima hora límite', () => {
      const releer = vi.fn()
      const enviadoEn = Date.now()
      renderHook(() =>
        useRelecturaDeLaTienda(
          'venue-1',
          { storeReadAt: '2026-11-20T18:00:00.000Z', storeNextDeadlineAt: '2026-11-20T18:00:05.000Z', enviadoEn },
          releer,
        ),
      )
      act(() => vi.advanceTimersByTime(5_000))
      expect(releer).not.toHaveBeenCalled()
      act(() => vi.advanceTimersByTime(MARGEN_TRAS_LA_HORA_LIMITE_MS + 50))
      expect(releer).toHaveBeenCalledTimes(1)
    })
  })
})
