/**
 * C1 · Tarea 13 — las llamadas de la factura global al servidor: rutas, cuerpo y parámetros. Es el lado del dashboard del contrato
 * de las Tareas 8, 11 y 12; si el servidor cambia una ruta, aquí se ve antes que en la pantalla.
 */
import { describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get, post: m.post } }))

import cfdiService from '@/services/cfdi.service'

const BASE = '/api/v1/dashboard/venues/v1/fiscal/emisores/e1/global'

describe('cfdiService · factura global (C1)', () => {
  it('control — el disparo de siempre va SIN cuerpo (el servidor lo valida `.strict()`)', async () => {
    m.post.mockResolvedValue({ data: { status: 'NOTHING_TO_INVOICE', message: 'x' } })
    await cfdiService.triggerGlobalCfdi('v1', 'e1')
    expect(m.post).toHaveBeenCalledWith(BASE)
    expect(m.post.mock.calls[0]).toHaveLength(1)
  })

  it('control — con `desde` lo manda tal cual en el cuerpo (Tarea 8)', async () => {
    m.post.mockResolvedValue({ data: { status: 'NOTHING_TO_INVOICE', message: 'x' } })
    await cfdiService.triggerGlobalCfdi('v1', 'e1', '2026-10-04T06:00:00.000Z')
    expect(m.post).toHaveBeenCalledWith(BASE, { desde: '2026-10-04T06:00:00.000Z' })
  })

  it('🔴 ronda 2 (T10 real): los periodos traen `periodos` Y `otrasPeriodicidades` (nunca mezclados)', async () => {
    const otras = { globales: [{ cfdiId: 'b1', periodicidad: 'BIMESTRAL', estado: 'APARTADA' }], completo: false }
    m.get.mockResolvedValue({ data: { periodos: [{ desde: 'd1' }], otrasPeriodicidades: otras } })
    expect(await cfdiService.getGlobalPeriodos('v1', 'e1')).toEqual({ periodos: [{ desde: 'd1' }], otrasPeriodicidades: otras })
    expect(m.get).toHaveBeenCalledWith(`${BASE}/periodos`)
  })

  it('🔴 ronda 2: un servidor anterior a la T10 (sin `otrasPeriodicidades`) da la sección vacía, no `undefined`', async () => {
    m.get.mockResolvedValue({ data: { periodos: [] } })
    expect(await cfdiService.getGlobalPeriodos('v1', 'e1')).toEqual({ periodos: [], otrasPeriodicidades: { globales: [], completo: true } })
  })

  it('🔴 6 (ola final): deja pasar `globalApagada` tal cual (true o false); de un servidor que no lo manda no se inventa', async () => {
    m.get.mockResolvedValue({ data: { periodos: [], globalApagada: true } })
    expect((await cfdiService.getGlobalPeriodos('v1', 'e1')).globalApagada).toBe(true)
    m.get.mockResolvedValue({ data: { periodos: [], globalApagada: false } })
    expect((await cfdiService.getGlobalPeriodos('v1', 'e1')).globalApagada).toBe(false)
    m.get.mockResolvedValue({ data: { periodos: [] } })
    expect(await cfdiService.getGlobalPeriodos('v1', 'e1')).not.toHaveProperty('globalApagada')
    // Algo que no es booleano no se toma por «apagada».
    m.get.mockResolvedValue({ data: { periodos: [], globalApagada: 'true' } })
    expect(await cfdiService.getGlobalPeriodos('v1', 'e1')).not.toHaveProperty('globalApagada')
  })

  it('control — las excluidas: sólo viajan los parámetros que se dan', async () => {
    m.get.mockResolvedValue({ data: { excluidas: [] } })
    await cfdiService.getGlobalExcluidas('v1', 'e1', { desde: 'd1', cursor: 'o1' })
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/excluidas`, { params: { desde: 'd1', cursor: 'o1' } })
    await cfdiService.getGlobalExcluidas('v1', 'e1', { principalId: 'g1' })
    expect(m.get).toHaveBeenLastCalledWith(`${BASE}/excluidas`, { params: { principalId: 'g1' } })
  })

  it('control — la complementaria va por el id de la principal (vista previa GET y emisión POST sin cuerpo)', async () => {
    m.get.mockResolvedValue({ data: { motivo: null } })
    m.post.mockResolvedValue({ data: { complementariaDe: 'g1', cfdi: { id: 'g1c2' } } })
    await cfdiService.getGlobalComplementariaPreview('v1', 'e1', 'g1')
    expect(m.get).toHaveBeenCalledWith(`${BASE}/g1/complementaria`)
    expect(await cfdiService.emitGlobalComplementaria('v1', 'e1', 'g1')).toMatchObject({ complementariaDe: 'g1' })
    expect(m.post).toHaveBeenCalledWith(`${BASE}/g1/complementaria`)
  })
})
