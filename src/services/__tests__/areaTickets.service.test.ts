import { describe, expect, it } from 'vitest'

import {
  toUpdateAreaTicketSettingsInput,
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
