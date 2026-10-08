// E6a-fix3 (tope de la tabla): el servidor topa «Resumen de Comisiones» a 500 renglones y manda `total` (los que había antes del
// tope). El servicio lo conserva para que la pantalla nunca recorte en silencio; `getSummaries` sigue devolviendo la lista sola.
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { commissionService } from '../commission.service'

const m = vi.hoisted(() => ({ get: vi.fn() }))
vi.mock('@/api', () => ({ default: { get: m.get } }))

const fila = (id: string) => ({ id })
beforeEach(() => vi.clearAllMocks())

describe('commissionService resúmenes', () => {
  it('🔴 getSummariesPage devuelve los renglones y el total del servidor', async () => {
    m.get.mockResolvedValue({ data: { data: [fila('a'), fila('b')], total: 730 } })
    expect(await commissionService.getSummariesPage('v1')).toEqual({ items: [fila('a'), fila('b')], total: 730 })
  })
  it('🔴 sin `total` (servidor previo) o con un total que no es número: undefined, nunca inventado', async () => {
    m.get.mockResolvedValue({ data: { data: [fila('a')] } })
    expect((await commissionService.getSummariesPage('v1')).total).toBeUndefined()
    m.get.mockResolvedValue({ data: { data: [fila('a')], total: 'mucho' } })
    expect((await commissionService.getSummariesPage('v1')).total).toBeUndefined()
    m.get.mockResolvedValue({ data: [fila('a')] })
    expect(await commissionService.getSummariesPage('v1')).toEqual({ items: [fila('a')], total: undefined })
  })
  it('getSummaries sigue devolviendo sólo la lista (el contrato de quien ya lo usa)', async () => {
    m.get.mockResolvedValue({ data: { data: [fila('a')], total: 3 } })
    expect(await commissionService.getSummaries('v1')).toEqual([fila('a')])
  })
})

// E6a-fix4: el historial de la persona en Equipo (`GET …/staff/:staffId/commissions`) trae 12 periodos y, desde el servidor de
// E6a-fix4, `summariesTotal` (cuántos tiene la persona). Mismo criterio que `getSummariesPage`: sólo un número, nunca inventado.
describe('commissionService historial de una persona', () => {
  const resumenes = Array.from({ length: 12 }, (_, i) => fila(`s${i}`))
  it('conserva los 12 renglones y el total del servidor (13)', async () => {
    m.get.mockResolvedValue({ data: { data: { summaries: resumenes, summariesTotal: 13, calculations: [], stats: {}, tierProgress: null } } })
    const r = await commissionService.getStaffCommissions('v1', 'st1')
    expect(r.summaries).toHaveLength(12)
    expect(r.summariesTotal).toBe(13)
  })
  it('🔴 sin `summariesTotal` (servidor previo) o con uno que no es número: undefined, nunca un recorte inventado', async () => {
    m.get.mockResolvedValue({ data: { data: { summaries: resumenes, calculations: [], stats: {}, tierProgress: null } } })
    expect((await commissionService.getStaffCommissions('v1', 'st1')).summariesTotal).toBeUndefined()
    m.get.mockResolvedValue({ data: { data: { summaries: resumenes, summariesTotal: '13', calculations: [], stats: {}, tierProgress: null } } })
    expect((await commissionService.getStaffCommissions('v1', 'st1')).summariesTotal).toBeUndefined()
    m.get.mockResolvedValue({ data: { data: { summaries: resumenes, summariesTotal: null, calculations: [], stats: {}, tierProgress: null } } })
    expect((await commissionService.getStaffCommissions('v1', 'st1')).summariesTotal).toBeUndefined()
  })
})
