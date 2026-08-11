import { describe, expect, it, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the `api` axios instance — only the new settlement-route test below
// touches it; the pure-function tests never call `api` at all.
// ---------------------------------------------------------------------------
const mockPatch = vi.fn()
vi.mock('@/api', () => ({
  default: { patch: (...args: unknown[]) => mockPatch(...args) },
}))

import {
  toUpdateAreaTicketSettingsInput,
  toUpdateScaleSettingsInput,
  updateAreaSettlementRoute,
  type AreaTicketSettings,
} from '@/services/areaTickets.service'

describe('toUpdateAreaTicketSettingsInput()', () => {
  it('sends only fields accepted by the settings update endpoint', () => {
    const settings = {
      venueId: 'venue-read-only',
      enabled: true,
      allowMixedCart: true,
      claimTtlSeconds: 300,
      checkoutSessionMaxAgeMinutes: 30,
      ticketExpiryPolicy: 'BUSINESS_DAY_CLOSE',
      ticketExpiryMinutes: null,
      deliveryVerificationMode: 'PAPER_OR_SCAN',
      codeSymbology: 'CODE128',
      requireManagerForCancel: true,
      recordWasteOnCancel: false,
      inventoryReservationMode: 'NONE',
    } as AreaTicketSettings & { venueId: string }

    expect(toUpdateAreaTicketSettingsInput(settings)).toEqual({
      enabled: true,
      allowMixedCart: true,
      claimTtlSeconds: 300,
      checkoutSessionMaxAgeMinutes: 30,
      ticketExpiryPolicy: 'BUSINESS_DAY_CLOSE',
      ticketExpiryMinutes: null,
      deliveryVerificationMode: 'PAPER_OR_SCAN',
      requireManagerForCancel: true,
      recordWasteOnCancel: false,
      inventoryReservationMode: 'NONE',
    })
  })
})

describe('toUpdateScaleSettingsInput()', () => {
  it('keeps serial and printed-label workflows independent', () => {
    expect(
      toUpdateScaleSettingsInput({
        enabled: false,
        variableBarcodeEnabled: true,
        variableBarcodePrefix: '21',
      }),
    ).toEqual({
      enabled: false,
      variableBarcodeEnabled: true,
      variableBarcodePrefix: '21',
    })
  })
})

describe('areaTickets.service — ruta de cobro', () => {
  it('updateAreaSettlementRoute manda las cuatro políticas juntas', async () => {
    mockPatch.mockResolvedValueOnce({ data: { data: {} } })
    const venueId = 'venue-1'
    const areaId = 'area-1'

    await updateAreaSettlementRoute(venueId, areaId, {
      settlementRoute: 'EXTERNAL',
      externalConfirmationMode: 'MANUAL',
      externalOfflinePolicy: 'BLOCK',
      externalDeliveryTracking: 'TRACKED',
    })

    // Nota: el brief trae la URL sin el prefijo /api/v1 — este repo lo exige en TODA
    // llamada (VITE_API_URL no lo incluye; ver critical-warnings.md), así que el valor
    // real de esta aserción incluye el prefijo.
    expect(mockPatch).toHaveBeenCalledWith(
      `/api/v1/dashboard/venues/${venueId}/fulfillment-areas/${areaId}/settlement-route`,
      expect.objectContaining({
        settlementRoute: 'EXTERNAL',
        externalConfirmationMode: 'MANUAL',
        externalOfflinePolicy: 'BLOCK',
        externalDeliveryTracking: 'TRACKED',
      }),
    )
  })
})
