import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}))

import api from '@/api'
import { getChannels, getActivationRequest, createActivationRequest, getDeliverySummary, pauseChannel } from '@/services/delivery.service'

const mocked = api as unknown as { get: ReturnType<typeof vi.fn>; post: ReturnType<typeof vi.fn> }

beforeEach(() => {
  vi.clearAllMocks()
})

describe('delivery.service', () => {
  it('getChannels: GET a /channels y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({
      data: {
        success: true,
        data: [
          {
            id: 'link-1',
            venueId: 'v1',
            provider: 'UBER_EATS',
            status: 'ACTIVE',
            orderAcceptanceMode: 'AUTO',
            autoSyncMenu: true,
            lastMenuSyncAt: null,
            externalLocationId: 'ext-1',
          },
        ],
      },
    })

    const result = await getChannels('v1')

    expect(mocked.get).toHaveBeenCalledWith('/api/v1/delivery-channels/venues/v1/channels')
    expect(result).toHaveLength(1)
    expect(result[0].provider).toBe('UBER_EATS')
  })

  it('getActivationRequest: GET a /activation-request y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'req-1',
          venueId: 'v1',
          status: 'PENDING',
          requestedChannels: ['UBER_EATS'],
          note: null,
          createdAt: '2026-07-18T00:00:00.000Z',
        },
      },
    })

    const result = await getActivationRequest('v1')

    expect(mocked.get).toHaveBeenCalledWith('/api/v1/delivery-channels/venues/v1/activation-request')
    expect(result?.status).toBe('PENDING')
  })

  it('getActivationRequest: sin solicitud viva, el backend devuelve null', async () => {
    mocked.get.mockResolvedValue({ data: { success: true, data: null } })

    const result = await getActivationRequest('v1')

    expect(result).toBeNull()
  })

  it('createActivationRequest: POST el body exacto y desenvuelve data', async () => {
    mocked.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'req-1',
          venueId: 'v1',
          status: 'PENDING',
          requestedChannels: ['UBER_EATS', 'RAPPI'],
          note: 'Ya tengo cuentas activas en ambas plataformas',
          createdAt: '2026-07-18T00:00:00.000Z',
        },
      },
    })

    const result = await createActivationRequest('v1', {
      requestedChannels: ['UBER_EATS', 'RAPPI'],
      note: 'Ya tengo cuentas activas en ambas plataformas',
    })

    expect(mocked.post).toHaveBeenCalledWith('/api/v1/delivery-channels/venues/v1/activation-request', {
      requestedChannels: ['UBER_EATS', 'RAPPI'],
      note: 'Ya tengo cuentas activas en ambas plataformas',
    })
    expect(result.id).toBe('req-1')
  })

  it('getDeliverySummary: GET a /delivery/summary y desenvuelve data', async () => {
    mocked.get.mockResolvedValue({
      data: {
        success: true,
        data: { channels: [{ channel: 'UBER_EATS', orders: 3, totalPesos: 450.5 }], generatedAt: '2026-07-18T12:00:00.000Z' },
      },
    })

    const result = await getDeliverySummary('v1')

    expect(mocked.get).toHaveBeenCalledWith('/api/v1/delivery-channels/venues/v1/delivery/summary')
    expect(result.channels[0].totalPesos).toBe(450.5)
  })

  it('pauseChannel: POST { paused } al link correcto y desenvuelve data', async () => {
    mocked.post.mockResolvedValue({
      data: {
        success: true,
        data: {
          id: 'link-1',
          venueId: 'v1',
          provider: 'UBER_EATS',
          status: 'PAUSED',
          orderAcceptanceMode: 'AUTO',
          autoSyncMenu: true,
          lastMenuSyncAt: null,
          externalLocationId: 'ext-1',
        },
      },
    })

    const result = await pauseChannel('v1', 'link-1', true)

    expect(mocked.post).toHaveBeenCalledWith('/api/v1/delivery-channels/venues/v1/channels/link-1/pause', { paused: true })
    expect(result.status).toBe('PAUSED')
  })
})
