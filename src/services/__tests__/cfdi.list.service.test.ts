/**
 * C2-pulido · G7 — la lista de facturas con el valor NUEVO `STAMP_IN_DOUBT` («En proceso»). Un servidor anterior no lo conoce y responde
 * 400 «El estado del CFDI no es válido»: la lista no puede quedarse vacía con un error por eso. Se pide otra vez SIN el valor nuevo
 * (lo mismo que pedía el dashboard antes de G7); cualquier otro error sigue siendo error.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get } }))

import cfdiService from '@/services/cfdi.service'

const RUTA = '/api/v1/dashboard/venues/v1/cfdi'
const EN_PROCESO = ['DRAFT', 'VALIDATING', 'STAMPING', 'STAMP_IN_DOUBT']
const fila = { id: 'c1', status: 'STAMPING' }
const respuesta = { data: { data: { cfdis: [fila], total: 1, page: 1, pageSize: 20 } } }
const fallo = (status: number) => ({ response: { status, data: { error: 'El estado del CFDI no es válido' } }, message: 'x' })
const estatusPedidos = () => m.get.mock.calls.map(c => c[1].params.status)

describe('cfdiService.getCfdis — C2-pulido · G7: `STAMP_IN_DOUBT` con un servidor anterior', () => {
  beforeEach(() => {
    m.get.mockReset()
  })

  it('🔴 servidor anterior (400) ⇒ pide otra vez SIN `STAMP_IN_DOUBT` y la lista sale como antes (no vacía con un error)', async () => {
    m.get.mockRejectedValueOnce(fallo(400)).mockResolvedValueOnce(respuesta)
    await expect(cfdiService.getCfdis('v1', { status: EN_PROCESO, page: 1, pageSize: 20 })).resolves.toEqual({
      cfdis: [fila],
      total: 1,
      page: 1,
      pageSize: 20,
    })
    expect(estatusPedidos()).toEqual(['DRAFT,VALIDATING,STAMPING,STAMP_IN_DOUBT', 'DRAFT,VALIDATING,STAMPING'])
    expect(m.get.mock.calls[1][0]).toBe(RUTA)
    expect(m.get.mock.calls[1][1].params).toMatchObject({ page: 1, pageSize: 20 })
  })

  it('control — servidor nuevo: UNA petición con el valor nuevo', async () => {
    m.get.mockResolvedValueOnce(respuesta)
    await cfdiService.getCfdis('v1', { status: EN_PROCESO })
    expect(estatusPedidos()).toEqual(['DRAFT,VALIDATING,STAMPING,STAMP_IN_DOUBT'])
  })

  it('control — un 400 SIN el valor nuevo en el filtro sigue siendo error (no se reintenta)', async () => {
    m.get.mockRejectedValueOnce(fallo(400))
    await expect(cfdiService.getCfdis('v1', { status: ['STAMPED'] })).rejects.toMatchObject({ response: { status: 400 } })
    expect(m.get).toHaveBeenCalledTimes(1)
  })

  it('control — otro error (500) con el valor nuevo sigue siendo error (no se reintenta)', async () => {
    m.get.mockRejectedValueOnce(fallo(500))
    await expect(cfdiService.getCfdis('v1', { status: EN_PROCESO })).rejects.toMatchObject({ response: { status: 500 } })
    expect(m.get).toHaveBeenCalledTimes(1)
  })
})

describe('cfdiService.getExtraccionesPendientes — C3 (ola final, I-1)', () => {
  beforeEach(() => {
    m.get.mockReset()
  })

  it('pide la ruta del venue y devuelve sólo { total, enProceso } (números, 0 si falta)', async () => {
    m.get.mockResolvedValueOnce({ data: { total: 3, enProceso: 1 } })
    await expect(cfdiService.getExtraccionesPendientes('v1')).resolves.toEqual({ total: 3, enProceso: 1 })
    expect(m.get).toHaveBeenCalledWith(`${RUTA}/extracciones-pendientes`)
    m.get.mockResolvedValueOnce({ data: { data: {} } })
    await expect(cfdiService.getExtraccionesPendientes('v1')).resolves.toEqual({ total: 0, enProceso: 0 })
  })
})
