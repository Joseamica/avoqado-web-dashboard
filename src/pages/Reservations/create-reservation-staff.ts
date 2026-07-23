import type { ProductStaffResult } from '@/types/reservation'

interface StaffMemberInput {
  id: string
  staffId: string
  firstName?: string | null
  lastName?: string | null
  active: boolean
}

export interface StaffSelectionOption {
  staffVenueId: string
  staffId: string
  firstName?: string | null
  lastName?: string | null
  disabled: boolean
  reason?: 'NOT_ELIGIBLE' | 'UNAVAILABLE'
}

export function isStaffAwareSettings(settings: { capacityMode?: 'pacing' | 'per_staff'; showStaffPicker?: boolean }): boolean {
  return settings.capacityMode === 'per_staff' || settings.showStaffPicker === true
}

export function buildStaffSelectionOptions(input: {
  members: StaffMemberInput[]
  mapping?: ProductStaffResult
  availableStaffIds?: ReadonlySet<string>
}): StaffSelectionOption[] {
  // This helper receives a mapping only in the staff-aware create flow. Once
  // loaded, its rows are authoritative: an empty set means zero eligible staff.
  const eligibleStaffIds = input.mapping ? new Set(input.mapping.staff.map(member => member.staffId)) : undefined

  return input.members
    .filter(member => member.active)
    .map(member => {
      const eligible = eligibleStaffIds?.has(member.staffId) ?? true
      const available = input.availableStaffIds?.has(member.staffId) ?? true
      const reason = !eligible ? 'NOT_ELIGIBLE' : !available ? 'UNAVAILABLE' : undefined

      return {
        staffVenueId: member.id,
        staffId: member.staffId,
        firstName: member.firstName,
        lastName: member.lastName,
        disabled: reason !== undefined,
        ...(reason !== undefined && { reason }),
      }
    })
}

export function getReservationConflictCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined

  const response = (error as { response?: unknown }).response
  if (!response || typeof response !== 'object') return undefined
  const data = (response as { data?: unknown }).data
  if (!data || typeof data !== 'object') return undefined

  const payload = data as { code?: unknown; errorCode?: unknown; error?: { code?: unknown } }
  const code = payload.code ?? payload.errorCode ?? payload.error?.code
  return typeof code === 'string' ? code : undefined
}

export function buildAppointmentCreateContract(input: {
  staffAware: boolean
  appointmentProductId?: string
  allowOverCapacity?: boolean
}): {
  productIds?: string[]
  windowSemantics?: 'base'
  allowOverCapacity?: boolean
} {
  if (!input.staffAware || !input.appointmentProductId) return {}

  return {
    productIds: [input.appointmentProductId],
    windowSemantics: 'base',
    ...(input.allowOverCapacity === true ? { allowOverCapacity: true } : {}),
  }
}
