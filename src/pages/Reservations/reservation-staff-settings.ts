export interface StaffAwareSettingsValues {
  capacityMode: 'pacing' | 'per_staff'
  showStaffPicker: boolean
}

interface StaffAwareSettingsSource {
  scheduling?: { capacityMode?: 'pacing' | 'per_staff' }
  publicBooking?: { showStaffPicker?: boolean }
}

export function readStaffAwareSettings(settings?: StaffAwareSettingsSource): StaffAwareSettingsValues {
  return {
    capacityMode: settings?.scheduling?.capacityMode === 'per_staff' ? 'per_staff' : 'pacing',
    showStaffPicker: settings?.publicBooking?.showStaffPicker === true,
  }
}

export function buildStaffAwareSettingsPatch(values: StaffAwareSettingsValues): {
  scheduling: { capacityMode: 'pacing' | 'per_staff' }
  publicBooking: { showStaffPicker: boolean }
} {
  return {
    scheduling: { capacityMode: values.capacityMode },
    publicBooking: { showStaffPicker: values.showStaffPicker },
  }
}
