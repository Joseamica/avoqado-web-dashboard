/**
 * C2 · Tarea 2 — la cancelación dice en qué quedó. El servidor manda `estado`: si el SAT no contestó claro, queda EN DUDA y la persona
 * no debe pedirla otra vez (pulsar «Cancelar» de nuevo sólo consulta). Sin `estado` (servidor anterior), el aviso es el de siempre.
 */
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { act, renderHook } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi, beforeEach } from 'vitest'

const m = vi.hoisted(() => ({ cancelCfdi: vi.fn(), replaceCfdi: vi.fn(), toast: vi.fn() }))
vi.mock('@/hooks/use-current-venue', () => ({ useCurrentVenue: () => ({ venueId: 'v1' }) }))
vi.mock('@/services/cfdi.service', () => ({ default: { cancelCfdi: m.cancelCfdi, replaceCfdi: m.replaceCfdi } }))
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k, i18n: { language: 'es' } }) }))
vi.mock('@/hooks/use-toast', () => ({ useToast: () => ({ toast: m.toast }) }))

import { useCancelCfdi, useConsultarCancelacion, useReplaceCfdi } from './use-cfdi'
import { conDudaConocida, olvidarCancelacionesEnDuda, recordarCancelacionEnDuda } from '@/pages/Cfdi/cfdiListFilters'

const conCliente = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

async function cancelarCon(respuesta: Record<string, unknown>) {
  m.cancelCfdi.mockResolvedValue(respuesta)
  const { result } = renderHook(() => useCancelCfdi(), { wrapper: conCliente })
  await act(async () => {
    await result.current.mutateAsync({ cfdiId: 'c1', data: { motivo: '02' } as any })
  })
  const llamadas = m.toast.mock.calls
  return llamadas[llamadas.length - 1]?.[0]
}

describe('C2 · useCancelCfdi dice en qué quedó la cancelación', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 EN DUDA ⇒ el aviso dice «Cancelación en duda…» (no la pidas otra vez)', async () => {
    expect(await cancelarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado: 'CANCELACION_EN_DUDA' })).toEqual({
      title: 'toast.cancelRequested',
      description: 'cancelacion.enDuda',
    })
  })

  it('en trámite ⇒ el aviso dice que sigue vigente mientras el SAT la resuelve', async () => {
    expect(await cancelarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado: 'EN_TRAMITE' })).toEqual({
      title: 'toast.cancelRequested',
      description: 'cancelacion.enTramite',
    })
  })

  // C2 ronda 1 (I1): `ENVIANDO` no afirma que el SAT la tiene; y si el servidor dice `enDuda`, manda el texto «en duda».
  it('🔴 ronda 1 (I1): ENVIANDO ⇒ un texto neutro («enviada; esperando respuesta»), nunca «en trámite ante el SAT»', async () => {
    expect(await cancelarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado: 'ENVIANDO' })).toEqual({
      title: 'toast.cancelRequested',
      description: 'cancelacion.enviando',
    })
  })

  it('🔴 ronda 1 (I1): `enDuda` del servidor gana sobre el estado derivado', async () => {
    expect(await cancelarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado: 'ENVIANDO', enDuda: true })).toEqual({
      title: 'toast.cancelRequested',
      description: 'cancelacion.enDuda',
    })
  })

  it('control — sin `estado` (servidor anterior) o ya cancelada: el aviso de siempre', async () => {
    expect(await cancelarCon({ cancelStatus: 'ACCEPTED', cfdiId: 'c1' })).toEqual({ title: 'toast.cancelRequested' })
    expect(await cancelarCon({ cancelStatus: 'CANCELLED', cfdiId: 'c1', estado: 'CANCELADA' })).toEqual({ title: 'toast.cancelRequested' })
  })
})

// C2 · T10 (M9 de la T2): un rechazo concluyente contestaba 200 `REJECTED` y el aviso decía «Cancelación solicitada.» sin más. Ahora
// dice que NO quedó, por qué (el texto del servidor) y que la factura sigue vigente.
describe('C2 · T10 · useCancelCfdi tras un rechazo (M9)', () => {
  beforeEach(() => vi.clearAllMocks())

  it('🔴 RECHAZADA ⇒ aviso destructivo «No quedó cancelada» con el porqué del servidor', async () => {
    expect(
      await cancelarCon({
        cancelStatus: 'REJECTED',
        cfdiId: 'c1',
        estado: 'RECHAZADA',
        motivoRechazoCancelacion: 'Esta factura ya tiene notas de crédito; cancélalas primero.',
      }),
    ).toEqual({
      title: 'toast.cancelRejected',
      description: 'Esta factura ya tiene notas de crédito; cancélalas primero.',
      variant: 'destructive',
    })
  })

  it('🔴 RECHAZADA sin porqué (servidor anterior) ⇒ dice que la factura sigue vigente', async () => {
    expect(await cancelarCon({ cancelStatus: 'REJECTED', cfdiId: 'c1' })).toEqual({
      title: 'toast.cancelRejected',
      description: 'toast.cancelRejectedDetail',
      variant: 'destructive',
    })
  })
})

// C2 · T10 ronda 1 (I-1): «Consultar estado» manda `{ soloConsultar: true }` (el servidor nunca anota ni envía un intento) y su aviso es el
// de una CONSULTA: «Consultamos al SAT: …» según el estado, nunca «Cancelación solicitada.» ni «No se pudo cancelar».
describe('C2 · T10 ronda 1 (I-1) · useConsultarCancelacion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    olvidarCancelacionesEnDuda() // ronda QA (D4): la memoria de la duda es del módulo; cada prueba parte sin ella
  })
  async function consultarCon(respuesta: Record<string, unknown> | Error) {
    if (respuesta instanceof Error) m.cancelCfdi.mockRejectedValue(respuesta)
    else m.cancelCfdi.mockResolvedValue(respuesta)
    const { result } = renderHook(() => useConsultarCancelacion(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'c1' }).catch(() => {})
    })
    const llamadas = m.toast.mock.calls
    return llamadas[llamadas.length - 1]?.[0]
  }

  it('🔴 manda `{ soloConsultar: true }` (sin motivo) al endpoint de la cancelación', async () => {
    await consultarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado: 'EN_TRAMITE' })
    expect(m.cancelCfdi).toHaveBeenCalledWith('v1', 'c1', { soloConsultar: true })
  })
  it.each([
    ['EN_TRAMITE', 'cancelacion.consulta.enTramite'],
    ['CANCELACION_EN_DUDA', 'cancelacion.consulta.enDuda'],
    ['ENVIANDO', 'cancelacion.consulta.enviando'],
    ['ANOTADA', 'cancelacion.consulta.enviando'],
    ['CANCELADA', 'cancelacion.consulta.cancelada'],
    [null, 'cancelacion.consulta.sinCancelacion'],
  ])('🔴 %s ⇒ «Consultamos al SAT» con su texto; nunca «Cancelación solicitada.»', async (estado, descripcion) => {
    expect(await consultarCon({ cancelStatus: 'REQUESTED', cfdiId: 'c1', estado })).toEqual({
      title: 'cancelacion.consulta.titulo',
      description: descripcion,
    })
  })
  it('🔴 RECHAZADA (la lista no se había refrescado) ⇒ aviso destructivo de consulta con el porqué del servidor', async () => {
    expect(
      await consultarCon({
        cancelStatus: 'REJECTED',
        cfdiId: 'c1',
        estado: 'RECHAZADA',
        motivoRechazoCancelacion: 'El receptor rechazó la cancelación ante el SAT: la factura sigue vigente.',
      }),
    ).toEqual({
      title: 'cancelacion.consulta.rechazadaTitulo',
      description: 'El receptor rechazó la cancelación ante el SAT: la factura sigue vigente.',
      variant: 'destructive',
    })
    expect(await consultarCon({ cancelStatus: 'REJECTED', cfdiId: 'c1', estado: 'RECHAZADA' })).toMatchObject({
      title: 'cancelacion.consulta.rechazadaTitulo',
      description: 'toast.cancelRejectedDetail',
    })
  })
  it('🔴 si la consulta falla, el título es de consulta («No se pudo consultar el estado»), no «No se pudo cancelar»', async () => {
    expect(
      await consultarCon(Object.assign(new Error('x'), { response: { status: 500, data: { error: 'Error interno' } } })),
    ).toMatchObject({
      title: 'cancelacion.consulta.error',
      variant: 'destructive',
    })
  })
})

// C2 · ronda QA (D4): después de decir «en duda», ni la fila ni «Consultar estado» dicen «enviando» de esa factura.
describe('C2 · ronda QA (D4) · la duda que ya se dijo', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    olvidarCancelacionesEnDuda()
  })
  const fila = (id: string) => ({ id, estadoCancelacion: 'ENVIANDO' as const })
  it('🔴 cancelar con `enDuda` la recuerda (la fila ENVIANDO se lee en duda); sin `enDuda`, no', async () => {
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'd1', estado: 'CANCELACION_EN_DUDA', enDuda: true })
    const { result } = renderHook(() => useCancelCfdi(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'd1', data: { motivo: '02' } as any })
    })
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'e1', estado: 'ENVIANDO' })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'e1', data: { motivo: '02' } as any })
    })
    expect(conDudaConocida(fila('d1')).estadoCancelacion).toBe('CANCELACION_EN_DUDA')
    expect(conDudaConocida(fila('e1')).estadoCancelacion).toBe('ENVIANDO')
  })
  it('🔴 «Terminar la sustitución» con `enDuda` recuerda la ORIGINAL', async () => {
    m.replaceCfdi.mockResolvedValue({
      status: 'REPLACED',
      sustituta: null,
      original: { id: 'orig', uuid: 'U' },
      cancelStatus: 'REQUESTED',
      cancelPendiente: true,
      enDuda: true,
      cancelIntentoNuevo: true,
    })
    const { result } = renderHook(() => useReplaceCfdi(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'orig' })
    })
    expect(conDudaConocida(fila('orig')).estadoCancelacion).toBe('CANCELACION_EN_DUDA')
  })
  it('🔴 «Consultar estado» de una factura ya dicha en duda: ENVIANDO ⇒ el texto «en duda», no «todavía se está enviando»', async () => {
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'd2', estado: 'CANCELACION_EN_DUDA', enDuda: true })
    const cancelar = renderHook(() => useCancelCfdi(), { wrapper: conCliente })
    await act(async () => {
      await cancelar.result.current.mutateAsync({ cfdiId: 'd2', data: { motivo: '02' } as any })
    })
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'd2', estado: 'ENVIANDO' })
    const consultar = renderHook(() => useConsultarCancelacion(), { wrapper: conCliente })
    await act(async () => {
      await consultar.result.current.mutateAsync({ cfdiId: 'd2' })
    })
    const llamadas = m.toast.mock.calls
    expect(llamadas[llamadas.length - 1]?.[0]).toEqual({ title: 'cancelacion.consulta.titulo', description: 'cancelacion.consulta.enDuda' })
  })
})

// Micro-ronda final (nit D4): la duda recordada se borra cuando un intento NUEVO de esa misma factura contesta sin `enDuda` (p. ej. se
// volvió a pedir tras un rechazo): ya no es la duda de antes.
describe('micro-ronda final · la duda recordada se olvida con otra respuesta sin `enDuda`', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    olvidarCancelacionesEnDuda()
  })
  const fila = (id: string) => ({ id, estadoCancelacion: 'ENVIANDO' as const })
  it('🔴 cancelar otra vez (respuesta sin `enDuda`) la olvida', async () => {
    recordarCancelacionEnDuda('d3')
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'd3', estado: 'ENVIANDO' })
    const { result } = renderHook(() => useCancelCfdi(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'd3', data: { motivo: '02' } as any })
    })
    expect(conDudaConocida(fila('d3')).estadoCancelacion).toBe('ENVIANDO')
  })
  it('🔴 «Terminar la sustitución» sin `enDuda` olvida la de la ORIGINAL', async () => {
    recordarCancelacionEnDuda('orig2')
    m.replaceCfdi.mockResolvedValue({
      status: 'REPLACED',
      sustituta: null,
      original: { id: 'orig2', uuid: 'U' },
      cancelStatus: 'REQUESTED',
      cancelPendiente: true,
      cancelIntentoNuevo: true,
    })
    const { result } = renderHook(() => useReplaceCfdi(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'orig2' })
    })
    expect(conDudaConocida(fila('orig2')).estadoCancelacion).toBe('ENVIANDO')
  })
  it('control — «Consultar estado» (sólo consulta) NO la olvida: su respuesta nunca trae `enDuda`', async () => {
    recordarCancelacionEnDuda('d4')
    m.cancelCfdi.mockResolvedValue({ cancelStatus: 'REQUESTED', cfdiId: 'd4', estado: 'ENVIANDO' })
    const { result } = renderHook(() => useConsultarCancelacion(), { wrapper: conCliente })
    await act(async () => {
      await result.current.mutateAsync({ cfdiId: 'd4' })
    })
    expect(conDudaConocida(fila('d4')).estadoCancelacion).toBe('CANCELACION_EN_DUDA')
  })
})
