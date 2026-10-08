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
