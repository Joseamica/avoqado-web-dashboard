import { describe, it, expect, vi, beforeEach } from 'vitest'

const get = vi.fn()
const post = vi.fn()
const put = vi.fn()
vi.mock('@/api', () => ({ default: { get: (...a: unknown[]) => get(...a), post: (...a: unknown[]) => post(...a), put: (...a: unknown[]) => put(...a) } }))

import {
  getSettings,
  updateSettings,
  getMenuCategories,
  getMenuProducts,
  setMenuAvailability,
  getInbox,
  acceptOrder,
  rejectOrder,
  markReady,
  markDelivered,
  cancelOrder,
  pauseOrdering,
  serverMessage,
  onlineOrderingKeys,
} from '../onlineOrdering.service'

const base = '/api/v1/dashboard/venues/v1/online-ordering'

describe('onlineOrdering.service', () => {
  beforeEach(() => {
    get.mockReset()
    post.mockReset()
    put.mockReset()
  })

  it('getSettings / updateSettings desenvuelven data.data', async () => {
    get.mockResolvedValue({ data: { data: { enabled: true } } })
    put.mockResolvedValue({ data: { data: { enabled: false } } })
    expect(await getSettings('v1')).toEqual({ enabled: true })
    expect(get).toHaveBeenCalledWith(`${base}/settings`)
    expect(await updateSettings('v1', { enabled: false })).toEqual({ enabled: false })
    expect(put).toHaveBeenCalledWith(`${base}/settings`, { enabled: false })
  })

  it('menú: categorías, productos acotados y disponibilidad', async () => {
    get.mockResolvedValue({ data: { data: { items: [], nextCursor: null, total: 0 } } })
    await getMenuCategories('v1')
    expect(get).toHaveBeenLastCalledWith(`${base}/menu/categories`)
    await getMenuProducts('v1', { categoryId: 'c1', search: 'taco', cursor: 'x', limit: 20 })
    expect(get).toHaveBeenLastCalledWith(`${base}/menu/products`, { params: { categoryId: 'c1', search: 'taco', cursor: 'x', limit: 20 } })
    put.mockResolvedValue({ data: { data: { updated: 3 } } })
    expect(await setMenuAvailability('v1', { availableOnline: true, allProducts: true })).toEqual({ updated: 3 })
    expect(put).toHaveBeenCalledWith(`${base}/menu/availability`, { availableOnline: true, allProducts: true })
  })

  it('getInbox: tray=true manda la cabecera; tray=false no', async () => {
    get.mockResolvedValue({ data: { data: { orders: [] } } })
    await getInbox('v1', { tray: true })
    expect(get).toHaveBeenLastCalledWith(`${base}/orders`, { params: { status: 'all' }, headers: { 'x-online-orders-tray': '1' } })
    await getInbox('v1', { tray: false })
    const cfg = get.mock.calls[1][1]
    expect(cfg.params).toEqual({ status: 'all' })
    expect(cfg.headers).toBeUndefined()
  })

  it('acciones sobre el pedido', async () => {
    post.mockResolvedValue({ data: { data: { status: 'ACCEPTED' } } })
    await acceptOrder('v1', 'o1', 20)
    expect(post).toHaveBeenLastCalledWith(`${base}/orders/o1/accept`, { estimatedMinutes: 20 })
    await rejectOrder('v1', 'o1', 'CLOSED', 'nota')
    expect(post).toHaveBeenLastCalledWith(`${base}/orders/o1/reject`, { reason: 'CLOSED', note: 'nota' })
    await markReady('v1', 'o1')
    expect(post).toHaveBeenLastCalledWith(`${base}/orders/o1/ready`, {})
    await markDelivered('v1', 'o1')
    expect(post).toHaveBeenLastCalledWith(`${base}/orders/o1/delivered`, {})
    await cancelOrder('v1', 'o1')
    expect(post).toHaveBeenLastCalledWith(`${base}/orders/o1/cancel`, {})
  })

  it('pauseOrdering', async () => {
    post.mockResolvedValue({ data: { data: { pausedUntil: null, manualPause: false } } })
    expect(await pauseOrdering('v1', null)).toEqual({ pausedUntil: null, manualPause: false })
    expect(post).toHaveBeenCalledWith(`${base}/pause`, { minutes: null })
  })

  it('serverMessage lee las dos formas de error', () => {
    expect(serverMessage({ response: { data: { success: false, code: 'X', error: 'Desde transición' } } })).toBe('Desde transición')
    expect(serverMessage({ response: { data: { message: 'Desde global' } } })).toBe('Desde global')
    expect(serverMessage(new Error('boom'))).toBeTruthy()
    expect(serverMessage(undefined)).toBeTruthy()
  })

  it('llaves de caché', () => {
    expect(onlineOrderingKeys.settings('v')).toEqual(['online-ordering', 'v', 'settings'])
    expect(onlineOrderingKeys.categories('v')).toEqual(['online-ordering', 'v', 'menu', 'categories'])
    expect(onlineOrderingKeys.products('v', { search: 'a' })).toEqual(['online-ordering', 'v', 'menu', 'products', { search: 'a' }])
    expect(onlineOrderingKeys.inbox('v')).toEqual(['online-ordering', 'v', 'inbox'])
  })
})
