import { act, renderHook } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { createElement, type ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { GiftCardOperation } from '@/types/giftCard'

const svc = vi.hoisted(() => ({
  getGiftCardSettings: vi.fn(),
  updateGiftCardSettings: vi.fn(),
  listGiftCards: vi.fn(),
  getGiftCardDetail: vi.fn(),
  operateGiftCard: vi.fn(),
  startGiftCardSaleCancel: vi.fn(),
  releaseGiftCardSaleCancel: vi.fn(),
  getGiftCardSummary: vi.fn(),
  getGiftCardAging: vi.fn(),
  listGiftCardPendingAccounting: vi.fn(),
  downloadGiftCardBalancesCsv: vi.fn(),
}))
vi.mock('@/services/giftCard.service', () => svc)
vi.mock('@/hooks/use-access', () => ({ useAccess: () => ({ can: () => true }) }))

import { olvidarPendientes } from '@/pages/Commissions/envioUnico'
import { giftCardKeys, useGiftCardOperation, useGiftCardSaleCancel } from './use-gift-cards'

let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => createElement(QueryClientProvider, { client }, children)
/** Sin `response`: la red se cayó (o api.ts ya reintentó una vez y tampoco). El server pudo haberlo guardado. */
const sinRespuesta = () => Object.assign(new Error('Network Error'), { code: 'ERR_NETWORK' })
/** Una respuesta definitiva del server: no se guardó nada. */
const definitivo = (status: number) => Object.assign(new Error(String(status)), { response: { status, data: { message: 'No' } } })
const llaveDe = (fn: ReturnType<typeof vi.fn>, i: number, pos: number) => {
  const arg = fn.mock.calls[i][pos] as { operationKey?: string } | string
  return typeof arg === 'string' ? arg : arg.operationKey!
}
const AJUSTE: GiftCardOperation = {
  tipo: 'AJUSTE',
  direccion: 'INCREMENT',
  amount: 100,
  reason: 'CASHIER_ERROR',
  note: 'Se cobró de menos',
}

beforeEach(() => {
  vi.clearAllMocks()
  olvidarPendientes()
  client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } })
})

describe('useGiftCardOperation — una operación, una llave (R12, Review Focus 4)', () => {
  it('🔴 si quedó en duda (sin respuesta), «Intentar otra vez» manda la MISMA llave', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await expect(result.current.operar(AJUSTE)).rejects.toThrow('Network Error')
    })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    expect(svc.operateGiftCard).toHaveBeenCalledTimes(2)
    const llave = llaveDe(svc.operateGiftCard, 0, 2)
    expect(llaveDe(svc.operateGiftCard, 1, 2)).toBe(llave)
    expect(llave.length).toBeGreaterThanOrEqual(8)
    expect(llave.length).toBeLessThanOrEqual(128)
    expect(svc.operateGiftCard.mock.calls[0]).toEqual(['v1', 'g1', { ...AJUSTE, operationKey: llave }])
  })

  it('también con un 5xx (un proxy pudo cortar después de guardar): misma llave', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(definitivo(502)).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await expect(result.current.operar(AJUSTE)).rejects.toThrow('502')
    })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    expect(llaveDe(svc.operateGiftCard, 1, 2)).toBe(llaveDe(svc.operateGiftCard, 0, 2))
  })

  it('tras un 4xx (respuesta definitiva) el siguiente intento lleva llave NUEVA', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(definitivo(422)).mockResolvedValueOnce({ activityIds: ['a1'] })
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await expect(result.current.operar(AJUSTE)).rejects.toThrow('422')
    })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    expect(llaveDe(svc.operateGiftCard, 1, 2)).not.toBe(llaveDe(svc.operateGiftCard, 0, 2))
  })

  it('tras un éxito, la misma operación otra vez es OTRA operación (un segundo ajuste a propósito no se confunde)', async () => {
    svc.operateGiftCard.mockResolvedValue({ activityIds: ['a1'] })
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    expect(llaveDe(svc.operateGiftCard, 1, 2)).not.toBe(llaveDe(svc.operateGiftCard, 0, 2))
  })

  it('un ajuste invalida la lista, el detalle de ESA tarjeta y los reportes (no los de las demás)', async () => {
    svc.operateGiftCard.mockResolvedValue({ activityIds: ['a1'] })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    const claves = spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
    expect(claves).toEqual(
      expect.arrayContaining([giftCardKeys.listAll('v1'), giftCardKeys.detail('v1', 'g1'), giftCardKeys.reportsAll('v1')]),
    )
    expect(claves).not.toContainEqual(giftCardKeys.detailAll('v1'))
  })

  it('🔴 bloquear o desbloquear invalida TODOS los detalles: las hermanas de la venta cambian su `cancel` (r1, M4)', async () => {
    svc.operateGiftCard.mockResolvedValue({ activityIds: ['a1'] })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    for (const tipo of ['BLOQUEAR', 'DESBLOQUEAR'] as const) {
      spy.mockClear()
      await act(async () => {
        await result.current.operar({ tipo, reason: 'SUSPICIOUS_ACTIVITY' })
      })
      const claves = spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
      expect(claves).toEqual(
        expect.arrayContaining([giftCardKeys.listAll('v1'), giftCardKeys.detailAll('v1'), giftCardKeys.reportsAll('v1')]),
      )
    }
  })

  it('🔴 cerrar el diálogo (`olvidarIntento`) abandona el intento en duda: el ajuste idéntico de después lleva llave NUEVA (r1, M3c)', async () => {
    svc.operateGiftCard.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ activityIds: ['a2'] })
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await expect(result.current.operar(AJUSTE)).rejects.toThrow('Network Error')
    })
    act(() => result.current.olvidarIntento())
    await act(async () => {
      await result.current.operar(AJUSTE)
    })
    expect(llaveDe(svc.operateGiftCard, 1, 2)).not.toBe(llaveDe(svc.operateGiftCard, 0, 2))
  })

  it('aunque quede en duda, la pantalla vuelve a leer (si sí se aplicó, se ve)', async () => {
    svc.operateGiftCard.mockRejectedValue(sinRespuesta())
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useGiftCardOperation('v1', 'g1'), { wrapper })
    await act(async () => {
      await expect(result.current.operar(AJUSTE)).rejects.toThrow()
    })
    expect(spy).toHaveBeenCalledWith({ queryKey: giftCardKeys.listAll('v1') })
  })
})

describe('useGiftCardSaleCancel', () => {
  it('iniciar manda su llave a cancel-sale de ESA venta e invalida lista, todos los detalles y reportes', async () => {
    svc.startGiftCardSaleCancel.mockResolvedValue({ giftCardIds: ['g1', 'g2'] })
    const spy = vi.spyOn(client, 'invalidateQueries')
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await result.current.iniciar()
    })
    expect(svc.startGiftCardSaleCancel).toHaveBeenCalledWith('v1', 'o1', expect.any(String))
    const claves = spy.mock.calls.map(c => (c[0] as { queryKey: unknown[] }).queryKey)
    expect(claves).toEqual(
      expect.arrayContaining([giftCardKeys.listAll('v1'), giftCardKeys.detailAll('v1'), giftCardKeys.reportsAll('v1')]),
    )
  })

  it('liberar es otra operación: su propia llave, a release-cancel, con la confirmación de que la devolución NO se hizo (F6)', async () => {
    svc.startGiftCardSaleCancel.mockResolvedValue({ giftCardIds: ['g1'] })
    svc.releaseGiftCardSaleCancel.mockResolvedValue({ released: true })
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await result.current.iniciar()
    })
    await act(async () => {
      await result.current.liberar({ confirmacionNoDevuelto: true })
    })
    expect(llaveDe(svc.releaseGiftCardSaleCancel, 0, 2)).not.toBe(llaveDe(svc.startGiftCardSaleCancel, 0, 2))
    expect(svc.releaseGiftCardSaleCancel).toHaveBeenCalledWith('v1', 'o1', expect.any(String), { confirmacionNoDevuelto: true })
  })

  it('si iniciar quedó en duda, el reintento reusa la llave', async () => {
    svc.startGiftCardSaleCancel.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ giftCardIds: ['g1'] })
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await expect(result.current.iniciar()).rejects.toThrow()
    })
    await act(async () => {
      await result.current.iniciar()
    })
    expect(llaveDe(svc.startGiftCardSaleCancel, 1, 2)).toBe(llaveDe(svc.startGiftCardSaleCancel, 0, 2))
  })

  it('🔴 iniciar en duda (sí se aplicó) → liberar sale bien → cancelar OTRA vez lleva llave NUEVA (r1, M3a)', async () => {
    svc.startGiftCardSaleCancel.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ giftCardIds: ['g1'] })
    svc.releaseGiftCardSaleCancel.mockResolvedValue({ released: true })
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await expect(result.current.iniciar()).rejects.toThrow()
    })
    await act(async () => {
      await result.current.liberar({ confirmacionNoDevuelto: true })
    })
    await act(async () => {
      await result.current.iniciar()
    })
    expect(llaveDe(svc.startGiftCardSaleCancel, 1, 2)).not.toBe(llaveDe(svc.startGiftCardSaleCancel, 0, 2))
  })

  it('🔴 liberar en duda (sí se aplicó) → nueva cancelación sale bien → liberar OTRA vez lleva llave NUEVA (r1, M3b)', async () => {
    svc.startGiftCardSaleCancel.mockResolvedValue({ giftCardIds: ['g1'] })
    svc.releaseGiftCardSaleCancel.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ released: true })
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await result.current.iniciar()
    })
    await act(async () => {
      await expect(result.current.liberar({ confirmacionNoDevuelto: true })).rejects.toThrow()
    })
    await act(async () => {
      await result.current.iniciar()
    })
    await act(async () => {
      await result.current.liberar({ confirmacionNoDevuelto: true })
    })
    expect(llaveDe(svc.releaseGiftCardSaleCancel, 1, 2)).not.toBe(llaveDe(svc.releaseGiftCardSaleCancel, 0, 2))
  })

  it('cerrar el diálogo (`olvidarIntento`) tras quedar en duda: el siguiente intento lleva llave NUEVA (r1, M3)', async () => {
    svc.startGiftCardSaleCancel.mockRejectedValueOnce(sinRespuesta()).mockResolvedValueOnce({ giftCardIds: ['g1'] })
    const { result } = renderHook(() => useGiftCardSaleCancel('v1', 'o1'), { wrapper })
    await act(async () => {
      await expect(result.current.iniciar()).rejects.toThrow()
    })
    act(() => result.current.olvidarIntento())
    await act(async () => {
      await result.current.iniciar()
    })
    expect(llaveDe(svc.startGiftCardSaleCancel, 1, 2)).not.toBe(llaveDe(svc.startGiftCardSaleCancel, 0, 2))
  })
})
