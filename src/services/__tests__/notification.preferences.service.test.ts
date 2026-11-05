/**
 * Unit tests for the bulk notification-preferences service call that backs the
 * master channel toggle. The `api` axios instance is mocked so no network calls
 * are made. Verifies the master toggle persists via ONE atomic request.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  getAnnouncementEmailPreference,
  setAnnouncementEmailPreference,
  updateManyPreferences,
  updatePreferences, NotificationChannel, NotificationType,
} from '@/services/notification.service'

const mockPut = vi.fn()
const mockGet = vi.fn()
vi.mock('@/api', () => ({
  default: {
    put: (...args: unknown[]) => mockPut(...args),
    get: (...args: unknown[]) => mockGet(...args),
  },
}))

const venueId = 'venue-1'

beforeEach(() => {
  mockPut.mockReset()
  mockGet.mockReset()
})

describe('updateManyPreferences()', () => {
  it('PUTs the whole batch to the /bulk endpoint in a single call', async () => {
    const preferences = [
      { type: NotificationType.PAYMENT_FAILED, channels: [NotificationChannel.IN_APP] },
      { type: NotificationType.LOW_INVENTORY, channels: [NotificationChannel.IN_APP] },
    ]
    mockPut.mockResolvedValue({ data: { data: preferences } })

    const result = await updateManyPreferences(preferences, venueId)

    // One request, not one-per-type — this is what removes the partial-failure race.
    expect(mockPut).toHaveBeenCalledTimes(1)
    expect(mockPut).toHaveBeenCalledWith(
      '/api/v1/dashboard/notifications/preferences/bulk',
      { preferences },
      { headers: { 'x-venue-id': venueId } },
    )
    expect(result).toEqual(preferences)
  })

  it('omits the x-venue-id header when no venue is given', async () => {
    mockPut.mockResolvedValue({ data: { data: [] } })

    await updateManyPreferences([{ type: NotificationType.NEW_ORDER, channels: [NotificationChannel.IN_APP] }], null)

    expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/notifications/preferences/bulk', expect.anything(), { headers: {} })
  })

  it('propagates the error so the caller can revert the optimistic update', async () => {
    mockPut.mockRejectedValue(new Error('500 Internal Server Error'))

    await expect(updateManyPreferences([{ type: NotificationType.NEW_ORDER }], venueId)).rejects.toThrow('500')
  })
})

describe('updatePreferences() single-type (regression — unchanged path)', () => {
  it('still PUTs a single preference to the non-bulk endpoint', async () => {
    const pref = { type: NotificationType.NEW_ORDER, enabled: false }
    mockPut.mockResolvedValue({ data: { data: pref } })

    const result = await updatePreferences(pref, venueId)

    expect(mockPut).toHaveBeenCalledWith('/api/v1/dashboard/notifications/preferences', pref, { headers: { 'x-venue-id': venueId } })
    expect(result).toEqual(pref)
  })
})

describe('preferencia de anuncios de Avoqado por correo (de la persona, sin negocio)', () => {
  const url = '/api/v1/dashboard/notifications/preferences/announcement-email'

  it('GET desenvuelve { enabled } y no manda x-venue-id', async () => {
    mockGet.mockResolvedValue({ data: { data: { enabled: false } } })
    expect(await getAnnouncementEmailPreference()).toEqual({ enabled: false })
    expect(mockGet).toHaveBeenCalledWith(url)
  })

  it('PUT manda { enabled } y no manda x-venue-id', async () => {
    mockPut.mockResolvedValue({ data: { data: { enabled: true } } })
    expect(await setAnnouncementEmailPreference(true)).toEqual({ enabled: true })
    expect(mockPut).toHaveBeenCalledWith(url, { enabled: true })
  })
})
