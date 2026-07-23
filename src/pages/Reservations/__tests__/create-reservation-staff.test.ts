import { describe, expect, it } from 'vitest'

import {
  buildAppointmentCreateContract,
  buildStaffSelectionOptions,
  getReservationConflictCode,
  isStaffAwareSettings,
} from '@/pages/Reservations/create-reservation-staff'

const members = [
  { id: 'sv-1', staffId: 'staff-1', firstName: 'Ana', lastName: 'López', active: true },
  { id: 'sv-2', staffId: 'staff-2', firstName: 'Beto', lastName: 'Ruiz', active: true },
  { id: 'sv-3', staffId: 'staff-3', firstName: 'Caro', lastName: 'Díaz', active: false },
]

describe('staff-aware create helpers', () => {
  it('treats either opt-in setting as staff-aware while preserving legacy defaults', () => {
    expect(isStaffAwareSettings({ capacityMode: 'pacing', showStaffPicker: false })).toBe(false)
    expect(isStaffAwareSettings({ capacityMode: 'per_staff', showStaffPicker: false })).toBe(true)
    expect(isStaffAwareSettings({ capacityMode: 'pacing', showStaffPicker: true })).toBe(true)
    expect(isStaffAwareSettings({})).toBe(false)
  })

  it('keeps every active member visible but explains product ineligibility and slot conflicts separately', () => {
    const options = buildStaffSelectionOptions({
      members,
      mapping: {
        productId: 'service-1',
        staffVenueIds: ['sv-1', 'sv-2'],
        staff: [
          { staffVenueId: 'sv-1', staffId: 'staff-1' },
          { staffVenueId: 'sv-2', staffId: 'staff-2' },
        ],
        explicit: true,
      },
      availableStaffIds: new Set(['staff-1']),
    })

    expect(options).toEqual([
      expect.objectContaining({ staffId: 'staff-1', staffVenueId: 'sv-1', disabled: false }),
      expect.objectContaining({ staffId: 'staff-2', staffVenueId: 'sv-2', disabled: true, reason: 'UNAVAILABLE' }),
    ])
  })

  it('marks an active member outside the explicit ProductStaff mapping as ineligible', () => {
    const options = buildStaffSelectionOptions({
      members,
      mapping: {
        productId: 'service-1',
        staffVenueIds: ['sv-1'],
        staff: [{ staffVenueId: 'sv-1', staffId: 'staff-1' }],
        explicit: true,
      },
    })

    expect(options.find(option => option.staffId === 'staff-2')).toMatchObject({
      disabled: true,
      reason: 'NOT_ELIGIBLE',
    })
    expect(options.some(option => option.staffId === 'staff-3')).toBe(false)
  })

  it('treats an empty loaded mapping as zero eligible staff in the opt-in create flow', () => {
    const options = buildStaffSelectionOptions({
      members,
      mapping: {
        productId: 'service-1',
        staffVenueIds: [],
        staff: [],
        explicit: false,
      },
    })

    expect(options.map(option => ({ id: option.staffId, disabled: option.disabled }))).toEqual([
      { id: 'staff-1', disabled: true },
      { id: 'staff-2', disabled: true },
    ])
    expect(options.every(option => option.reason === 'NOT_ELIGIBLE')).toBe(true)
  })

  it('extracts only the structured backend conflict code', () => {
    expect(getReservationConflictCode({ response: { data: { code: 'OVER_CAPACITY_CONFIRMATION_REQUIRED' } } })).toBe(
      'OVER_CAPACITY_CONFIRMATION_REQUIRED',
    )
    expect(getReservationConflictCode({ response: { data: { error: { code: 'APPOINTMENT_WINDOW_CHANGED' } } } })).toBe(
      'APPOINTMENT_WINDOW_CHANGED',
    )
    expect(getReservationConflictCode(new Error('OVER_CAPACITY_CONFIRMATION_REQUIRED'))).toBeUndefined()
  })

  it('adds the v5 appointment contract only for an active staff-aware appointment', () => {
    expect(
      buildAppointmentCreateContract({
        staffAware: true,
        appointmentProductId: 'service-1',
        allowOverCapacity: true,
      }),
    ).toEqual({
      productIds: ['service-1'],
      windowSemantics: 'base',
      allowOverCapacity: true,
    })

    expect(
      buildAppointmentCreateContract({
        staffAware: false,
        appointmentProductId: 'service-1',
        allowOverCapacity: true,
      }),
    ).toEqual({})
    expect(buildAppointmentCreateContract({ staffAware: true, appointmentProductId: undefined })).toEqual({})
  })
})
