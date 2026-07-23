import { describe, expect, it } from 'vitest'

import { buildStaffAwareSettingsPatch, readStaffAwareSettings } from '@/pages/Reservations/reservation-staff-settings'

describe('reservation staff-aware settings bridge', () => {
  it('keeps old-server responses on legacy-safe defaults', () => {
    expect(readStaffAwareSettings(undefined)).toEqual({
      capacityMode: 'pacing',
      showStaffPicker: false,
    })
    expect(readStaffAwareSettings({ scheduling: {}, publicBooking: {} })).toEqual({
      capacityMode: 'pacing',
      showStaffPicker: false,
    })
  })

  it('round-trips the two independent opt-ins without inventing another feature flag', () => {
    const values = readStaffAwareSettings({
      scheduling: { capacityMode: 'per_staff' },
      publicBooking: { showStaffPicker: true },
    })

    expect(values).toEqual({ capacityMode: 'per_staff', showStaffPicker: true })
    expect(buildStaffAwareSettingsPatch(values)).toEqual({
      scheduling: { capacityMode: 'per_staff' },
      publicBooking: { showStaffPicker: true },
    })
  })
})
