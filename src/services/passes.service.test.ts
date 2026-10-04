import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/api', () => ({ default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() } }))

import api from '@/api'
import {
  confirmPassVisit,
  connectTotalPass,
  deletePassCapRule,
  disconnectPassProvider,
  getPassCapacity,
  getPassIntegrationsOverview,
  getPassVisitsSummary,
  listPassVisits,
  rejectPassVisit,
  setDefaultPassCap,
  setPassConfirmMode,
  setPassProductLinks,
  setSessionPassCap,
  upsertWeeklyPassCap,
} from '@/services/passes.service'

type Spy = ReturnType<typeof vi.fn>
const mocked = api as unknown as { get: Spy; post: Spy; put: Spy; delete: Spy }
const ok = (data: unknown) => ({ data: { success: true, data } })
const BASE = '/api/v1/dashboard/venues/v1/pass-integrations'

beforeEach(() => vi.clearAllMocks())

describe('passes.service', () => {
  // nuevo
  it('getPassIntegrationsOverview: GET a la raíz y desenvuelve data (con planActive, R62)', async () => {
    mocked.get.mockResolvedValue(ok({ planActive: false, connections: [], classProducts: { items: [], total: 0 } }))
    const r = await getPassIntegrationsOverview('v1')
    expect(mocked.get).toHaveBeenCalledWith(BASE)
    expect(r.classProducts.total).toBe(0)
    expect(r.planActive).toBe(false)
  })
  // nuevo — Review Focus 1: la llave viaja recortada
  it('connectTotalPass: recorta la llave antes de mandarla', async () => {
    mocked.post.mockResolvedValue(ok({ provider: 'TOTALPASS', status: 'ACTIVE' }))
    const r = await connectTotalPass('v1', '  11111111-2222-4333-8444-555555555555 \n')
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/totalpass/connect`, { placeApiKey: '11111111-2222-4333-8444-555555555555' })
    expect(r.status).toBe('ACTIVE')
  })
  // nuevo — el proveedor va en minúsculas en la URL y en mayúsculas en el cuerpo
  it('setPassConfirmMode / setPassProductLinks / disconnect: proveedor en minúsculas en la ruta', async () => {
    mocked.put.mockResolvedValue(ok({ provider: 'TOTALPASS' }))
    mocked.post.mockResolvedValue(ok({ disconnected: true }))
    await setPassConfirmMode('v1', 'TOTALPASS', 'ON_VENUE_CHECKIN')
    expect(mocked.put).toHaveBeenCalledWith(`${BASE}/totalpass/confirm-mode`, { confirmMode: 'ON_VENUE_CHECKIN' })
    await setPassProductLinks('v1', 'WELLHUB', [{ productId: 'p1', externalPlanId: '305' }])
    expect(mocked.put).toHaveBeenCalledWith(`${BASE}/wellhub/products`, { links: [{ productId: 'p1', externalPlanId: '305' }] })
    await disconnectPassProvider('v1', 'TOTALPASS')
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/totalpass/disconnect`)
  })
  // nuevo — Review Focus 5: null viaja como null
  it('capacity: default null, weekly, delete y session', async () => {
    mocked.get.mockResolvedValue(ok({ defaultMaxSpots: null, weekly: [], suggestions: [] }))
    mocked.put.mockResolvedValue(ok({ saved: true }))
    mocked.post.mockResolvedValue(ok({ id: 'r1', weekday: 6, startMinute: 540, maxSpots: 1 }))
    mocked.delete.mockResolvedValue(ok({ deleted: true }))
    expect((await getPassCapacity('v1')).defaultMaxSpots).toBeNull()
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/capacity`)
    expect(await setDefaultPassCap('v1', null)).toEqual({ saved: true }) // P3-16: la API devuelve { saved: true }, no la capacidad
    expect(mocked.put).toHaveBeenCalledWith(`${BASE}/capacity/default`, { maxSpots: null })
    await upsertWeeklyPassCap('v1', { weekday: 6, startMinute: 540, maxSpots: 1 })
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/capacity/weekly`, { weekday: 6, startMinute: 540, maxSpots: 1 })
    await deletePassCapRule('v1', 'r1')
    expect(mocked.delete).toHaveBeenCalledWith(`${BASE}/capacity/rules/r1`)
    await setSessionPassCap('v1', 's9', 0)
    expect(mocked.put).toHaveBeenCalledWith(`${BASE}/capacity/sessions/s9`, { maxSpots: 0 })
  })
  // nuevo — la lista va por query params (el server los parsea con zod): fechas como AAAA-MM-DD, `to` inclusivo (P2-7); nunca pide más de 100
  it('listPassVisits: filtros como params (días AAAA-MM-DD tal cual); summary con month; confirm y reject por POST', async () => {
    mocked.get.mockResolvedValue(ok({ items: [], total: 0, hasMore: false, nextOffset: null }))
    mocked.post.mockResolvedValue(ok({ id: 'vis1', status: 'CONFIRMED' }))
    await listPassVisits('v1', { status: 'PENDING', provider: 'TOTALPASS', from: '2030-01-01', to: '2030-01-05', limit: 50, offset: 50 })
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/visits`, {
      params: { status: 'PENDING', provider: 'TOTALPASS', from: '2030-01-01', to: '2030-01-05', limit: 50, offset: 50 },
    })
    await getPassVisitsSummary('v1', '2030-01')
    expect(mocked.get).toHaveBeenCalledWith(`${BASE}/visits/summary`, { params: { month: '2030-01' } })
    expect((await confirmPassVisit('v1', 'vis1')).status).toBe('CONFIRMED')
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/visits/vis1/confirm`)
    await rejectPassVisit('v1', 'vis1')
    expect(mocked.post).toHaveBeenCalledWith(`${BASE}/visits/vis1/reject`)
  })
})
