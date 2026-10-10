/**
 * C2 · Tarea 10 — mientras la nota espera el XML de la factura original (`ESPERA_XML`; el servidor lo está pidiendo al PAC), el panel
 * vuelve a consultar a los 15 s; con cualquier otro estado, no. Es una consulta que puede tardar (repara el XML): no se reintenta un
 * 504/524 ni se repite al volver a la pestaña.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ getRefundCreditNote: vi.fn(), emitRefundCreditNote: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/cfdi.service', () => ({
  default: { getRefundCreditNote: m.getRefundCreditNote, emitRefundCreditNote: m.emitRefundCreditNote },
}))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: vi.fn() }) }))

import {
  ESPERA_DEL_XML_MS,
  MAX_CONSULTAS_EN_ESPERA,
  intervaloDeLaNota,
  reintentarLaNota,
  useEmitRefundCreditNote,
  useRefundCreditNote,
} from './use-cfdi'

const espera = {
  creditNote: null,
  eligibility: { eligible: false, reason: 'ESPERA_XML', message: 'Lo estamos recuperando.' },
  preview: null,
}
const lista = { creditNote: null, eligibility: { eligible: true, reason: null, message: null }, preview: null }

describe('C2 · T10 · la nota que espera el XML', () => {
  it('🔴 intervaloDeLaNota: 15 s sólo con ESPERA_XML', () => {
    expect(ESPERA_DEL_XML_MS).toBe(15_000)
    expect(intervaloDeLaNota(espera as any)).toBe(15_000)
    expect(intervaloDeLaNota(lista as any)).toBe(false)
    expect(intervaloDeLaNota({ ...lista, eligibility: { eligible: false, reason: 'XML_IRRECUPERABLE', message: 'x' } } as any)).toBe(false)
    expect(intervaloDeLaNota(undefined)).toBe(false)
  })
  it('🔴 reintentarLaNota: nunca 403/404 ni 504/524 (consulta que puede tardar); los demás, una vez', () => {
    for (const status of [403, 404, 504, 524]) expect([status, reintentarLaNota(0, { response: { status } })]).toEqual([status, false])
    expect(reintentarLaNota(0, { response: { status: 500 } })).toBe(true)
    expect(reintentarLaNota(1, { response: { status: 500 } })).toBe(false)
  })

  describe('el hook', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      m.getRefundCreditNote.mockReset()
    })
    afterEach(() => vi.useRealTimers())
    const conCliente = (qc: QueryClient) =>
      function Envoltura({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      }
    it('🔴 con ESPERA_XML vuelve a consultar a los 15 s; cuando el XML llega, deja de consultar', async () => {
      m.getRefundCreditNote.mockResolvedValueOnce(espera).mockResolvedValue(lista)
      const qc = new QueryClient()
      renderHook(() => useRefundCreditNote('r1'), { wrapper: conCliente(qc) })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(14_000)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1_500)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(2)
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(2)
    })
    it('control — sin ESPERA_XML no vuelve a consultar sola', async () => {
      m.getRefundCreditNote.mockResolvedValue(lista)
      const qc = new QueryClient()
      renderHook(() => useRefundCreditNote('r1'), { wrapper: conCliente(qc) })
      await act(async () => {
        await vi.advanceTimersByTimeAsync(60_000)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1)
    })
  })
})

// C2 · T10 ronda 1 (M4): el servidor contesta ESPERA_XML hasta 24 h después del timbre (sin `stampedAt`, para siempre) y cada consulta
// dispara la reparación contra el PAC. Un panel abierto durante una caída del PAC eran ~240 consultas por hora: ahora, ~8 (≈2 min) y
// después un «Volver a consultar» manual.
describe('C2 · T10 ronda 1 (M4) · la espera del XML tiene tope', () => {
  it('🔴 intervaloDeLaNota: 15 s mientras no se agoten las consultas; después, nada', () => {
    expect(MAX_CONSULTAS_EN_ESPERA).toBe(8)
    expect(intervaloDeLaNota(espera as any, 1)).toBe(15_000)
    expect(intervaloDeLaNota(espera as any, MAX_CONSULTAS_EN_ESPERA)).toBe(15_000)
    expect(intervaloDeLaNota(espera as any, MAX_CONSULTAS_EN_ESPERA + 1)).toBe(false)
    expect(intervaloDeLaNota(lista as any, 0)).toBe(false)
  })

  describe('el hook', () => {
    beforeEach(() => {
      vi.useFakeTimers()
      m.getRefundCreditNote.mockReset()
    })
    afterEach(() => vi.useRealTimers())
    const conCliente = (qc: QueryClient) =>
      function Envoltura({ children }: { children: ReactNode }) {
        return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      }
    // De 15 s en 15 s (con React al día entre consultas, como en el navegador): un solo salto de 10 min dispararía el intervalo viejo
    // varias veces sin dejar que React actualice las opciones de la consulta.
    const avanzar = async (ms: number) => {
      for (let falta = ms; falta >= 0; falta -= 5_000)
        await act(async () => {
          await vi.advanceTimersByTimeAsync(Math.min(5_000, falta))
        })
    }
    it('🔴 siempre ESPERA_XML ⇒ 1 + 8 consultas (≈2 min) y se detiene; dice que se agotó y «volver a consultar» reanuda', async () => {
      m.getRefundCreditNote.mockResolvedValue(espera)
      const { result } = renderHook(() => useRefundCreditNote('r1'), { wrapper: conCliente(new QueryClient()) })
      await avanzar(0)
      expect(result.current.esperaDelXmlAgotada).toBe(false)
      await avanzar(10 * 60_000)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1 + MAX_CONSULTAS_EN_ESPERA)
      expect(result.current.esperaDelXmlAgotada).toBe(true)
      await avanzar(10 * 60_000)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(1 + MAX_CONSULTAS_EN_ESPERA) // nada más, solo
      await act(async () => {
        result.current.volverAConsultar()
        await vi.advanceTimersByTimeAsync(0)
      })
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(2 + MAX_CONSULTAS_EN_ESPERA)
      expect(result.current.esperaDelXmlAgotada).toBe(false)
      await avanzar(15_500)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(3 + MAX_CONSULTAS_EN_ESPERA) // vuelve a esperar sola
    })
    it('🔴 si el XML llega a media espera, deja de consultar y no se marca agotada', async () => {
      m.getRefundCreditNote.mockResolvedValueOnce(espera).mockResolvedValueOnce(espera).mockResolvedValue(lista)
      const { result } = renderHook(() => useRefundCreditNote('r1'), { wrapper: conCliente(new QueryClient()) })
      await avanzar(10 * 60_000)
      expect(m.getRefundCreditNote).toHaveBeenCalledTimes(3)
      expect(result.current.esperaDelXmlAgotada).toBe(false)
    })
  })
})

// C2 · T10 ronda 1 (M9): el hook pasa la huella de la vista previa al servicio en la emisión normal.
describe('C2 · T10 ronda 1 (M9) · useEmitRefundCreditNote', () => {
  it('🔴 `{ refundId, huella }` ⇒ el servicio recibe la huella (sin elección); un id suelto, como siempre', async () => {
    m.emitRefundCreditNote.mockResolvedValue({ creditNote: { id: 'n1' } })
    const qc = new QueryClient()
    const { result } = renderHook(() => useEmitRefundCreditNote(), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })
    await act(async () => {
      await result.current.mutateAsync({ refundId: 'r1', huella: 'h'.repeat(64) })
    })
    expect(m.emitRefundCreditNote).toHaveBeenLastCalledWith('v1', 'r1', undefined, 'h'.repeat(64))
    await act(async () => {
      await result.current.mutateAsync('r2')
    })
    expect(m.emitRefundCreditNote).toHaveBeenLastCalledWith('v1', 'r2')
  })
})

// C2 · ronda QA (D2): tras un 502 (la nota pudo quedar EN DUDA) la vista de la nota se recarga: el panel deja de ofrecer «Emitir».
describe('C2 · ronda QA (D2) · useEmitRefundCreditNote recarga la nota también si falla', () => {
  it('🔴 un 502 invalida la vista de ESA nota y la lista de facturas', async () => {
    m.emitRefundCreditNote.mockRejectedValue({ response: { status: 502, data: { timbreEnDuda: true } } })
    const qc = new QueryClient()
    const invalidar = vi.spyOn(qc, 'invalidateQueries')
    const { result } = renderHook(() => useEmitRefundCreditNote(), {
      wrapper: ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>,
    })
    await act(async () => {
      await result.current.mutateAsync('r9').catch(() => {})
    })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['refund-credit-note', 'v1', 'r9'] })
    expect(invalidar).toHaveBeenCalledWith({ queryKey: ['cfdis', 'v1'] })
  })
})
