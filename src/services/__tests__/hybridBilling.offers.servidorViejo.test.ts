// Plan Básico: el DASHBOARD pide las ofertas con `includeBasic=true`. Un SERVIDOR anterior al Básico valida la lista en
// modo estricto y contesta 400 («Filtro no admitido»). Si el DASHBOARD saliera antes que el SERVIDOR, la lista de
// funciones sueltas daría error a todos: se vuelve a pedir sin el filtro y el orden de publicación deja de importar.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ default: { get: vi.fn(), post: vi.fn() }, publicApi: { get } }))

import { hybridBilling } from '../hybridBilling.service'

const pagina = { data: { data: { items: [], page: 1, pageSize: 25, total: 0 } } }
const rechazo = (status: number) => Object.assign(new Error(String(status)), { response: { status } })

beforeEach(() => get.mockReset())

describe('ofertas con un SERVIDOR anterior al Plan Básico', () => {
  it('🔴 400 por el filtro nuevo → vuelve a pedir sin includeBasic y enseña la lista', async () => {
    get.mockRejectedValueOnce(rechazo(400)).mockResolvedValueOnce(pagina)
    await expect(hybridBilling.offers({ page: 1, pageSize: 25 })).resolves.toMatchObject({ items: [], total: 0 })
    expect(get).toHaveBeenCalledTimes(2)
    expect(get.mock.calls[0][1].params).toEqual({ page: 1, pageSize: 25, includeBasic: 'true' })
    expect(get.mock.calls[1][1].params).toEqual({ page: 1, pageSize: 25 })
  })

  it('un SERVIDOR con el Básico contesta a la primera: una sola petición', async () => {
    get.mockResolvedValueOnce(pagina)
    await hybridBilling.offers({ page: 1, pageSize: 25 })
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('otro error (500) no se reintenta: sale tal cual', async () => {
    get.mockRejectedValueOnce(rechazo(500))
    await expect(hybridBilling.offers({ page: 1, pageSize: 25 })).rejects.toThrow('500')
    expect(get).toHaveBeenCalledTimes(1)
  })
})
