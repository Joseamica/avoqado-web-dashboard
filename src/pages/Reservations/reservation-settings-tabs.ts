import type { SettingsFormData } from './ReservationSettings'

/**
 * D680 · Configuración de Reservaciones en pestañas (General · Clases · Citas).
 *
 * La dirección (`#general`, `#clases`, `#citas`) es la única verdad de la pestaña: la página la
 * DERIVA de `location.hash` y todo lo que cambia de pestaña (tocarla, el tour, un error al guardar)
 * escribe la dirección. Este módulo sólo traduce; no sabe de React.
 */
export type SettingsTab = 'general' | 'clases' | 'citas'

/** Orden en pantalla, y el orden en que se busca el primer error. */
export const SETTINGS_TABS: readonly SettingsTab[] = ['general', 'clases', 'citas']

export function tabFromHash(hash: string): SettingsTab {
  const value = hash.replace(/^#/, '').toLowerCase()
  return SETTINGS_TABS.find(tab => tab === value) ?? 'general'
}

export function hashForTab(tab: SettingsTab): string {
  return `#${tab}`
}

/**
 * Dónde vive cada campo del formulario. La regla es lo que el SERVIDOR hace con él, no el título de
 * la sección: si aplica a clases y a citas, va en General. Las líneas son de `avoqado-server`
 * (`origin/develop`, 22-nov-2026) y justifican cada campo que NO va a General:
 *
 *   slotIntervalMin           → citas: `reservationAvailability.service.ts:146` genera los horarios
 *                               sueltos (las clases usan su sesión, :590) y `appointmentSlotHold.service.ts:126`.
 *   defaultDurationMin        → citas: `resolveAppointmentWindow.ts:203,250`, `reservation.public.controller.ts:826`
 *                               (suma de servicios de cita) y `reservationAvailability.service.ts:192`.
 *   capacityMode              → citas: `reservationStaffMode.ts:7` y `appointmentStaffAssignment.service.ts:255`
 *                               (sólo `APPOINTMENTS_SERVICE`).
 *   pacingMaxPerSlot          → citas: `reservation.public.controller.ts:896-911` («Classes don't pass through
 *                               here», sólo `APPOINTMENTS_SERVICE`) y `appointmentSlotHold.service.ts:290`.
 *   showStaffPicker           → citas: `reservation.public.controller.ts:798` (`!classSessionId`) y
 *                               `appointmentStaffAssignment.service.ts:255`.
 *   appointmentUpfrontDefault → citas: `reservation.public.controller.ts:109` (`isClass ? class… : appointment…`).
 *   classUpfrontDefault       → clases: la misma línea `:109`.
 *
 * Compartidos que parecían de un tipo y van a General: la anticipación y la confirmación automática
 * (`reservation.public.controller.ts:1946-1980` también para clases), el % de cupo en línea
 * (`reservationAvailability.service.ts:590`, clases), la gracia de no-show (`reservation-auto-no-show.job.ts`
 * sin filtro de tipo), el aviso nocturno (`kioskOutreach.service.ts:50`, paquetes de créditos) y los créditos
 * al cancelar (`reservation.public.controller.ts:1221`, también citas pagadas con créditos).
 *
 * Es un `Record` del formulario entero: un campo nuevo no compila hasta que alguien decide su pestaña.
 */
export const FIELD_TAB: Record<keyof SettingsFormData, SettingsTab> = {
  slotIntervalMin: 'citas',
  defaultDurationMin: 'citas',
  autoConfirm: 'general',
  maxAdvanceDays: 'general',
  minNoticeMin: 'general',
  noShowGraceMin: 'general',
  nightlyOutreachEnabled: 'general',
  capacityMode: 'citas',
  pacingMaxPerSlot: 'citas',
  onlineCapacityPercent: 'general',
  depositMode: 'general',
  depositFixedAmount: 'general',
  depositPercentage: 'general',
  depositPartySizeGte: 'general',
  appointmentUpfrontDefault: 'citas',
  classUpfrontDefault: 'clases',
  publicBookingEnabled: 'general',
  showStaffPicker: 'citas',
  requirePhone: 'general',
  requireEmail: 'general',
  requireAccount: 'general',
  requireCustomerApproval: 'general',
  allowCustomerCancel: 'general',
  minHoursBeforeCancel: 'general',
  forfeitDeposit: 'general',
  noShowFeePercent: 'general',
  creditRefundMode: 'general',
  creditFreeRefundHoursBefore: 'general',
  creditLateRefundPercent: 'general',
  creditNoShowRefund: 'general',
  allowCustomerReschedule: 'general',
  waitlistEnabled: 'general',
  waitlistMaxSize: 'general',
  waitlistPriorityMode: 'general',
  waitlistNotifyWindow: 'general',
  remindersEnabled: 'general',
  reminderChannels: 'general',
  reminderMinBefore: 'general',
  googleCalendarEventDetailLevel: 'general',
}

/** `reminderMinBefore.0` → la pestaña de `reminderMinBefore`; desconocido → General. */
export function tabOfField(path: string): SettingsTab {
  const root = path.split('.')[0]
  return Object.prototype.hasOwnProperty.call(FIELD_TAB, root) ? FIELD_TAB[root as keyof SettingsFormData] : 'general'
}

export function firstTabWithError(paths: string[]): SettingsTab | null {
  const tabs = new Set(paths.map(tabOfField))
  return SETTINGS_TABS.find(tab => tabs.has(tab)) ?? null
}

// RHF reporta `dirtyFields` como `true` o, en listas, como arreglos de booleanos.
const isDirty = (value: unknown): boolean =>
  value === true || (typeof value === 'object' && value !== null && Object.values(value).some(isDirty))

/** Las pestañas con cambios sin guardar del formulario principal (el punto junto a su nombre). */
export function tabsWithChanges(dirtyFields: object): Set<SettingsTab> {
  return new Set(
    Object.entries(dirtyFields)
      .filter(([, value]) => isDirty(value))
      .map(([field]) => tabOfField(field)),
  )
}

/** Cada `data-tour` de sección y la pestaña donde vive (el tour cambia la dirección antes de cada paso). */
export const TOUR_TARGET_TAB: Record<string, SettingsTab> = {
  'reservation-settings-public-booking': 'general',
  'reservation-settings-scheduling': 'general',
  'reservation-settings-deposits': 'general',
  'reservation-settings-cancellation': 'general',
  'reservation-settings-credit-refund': 'general',
  'reservation-settings-waitlist': 'general',
  'reservation-settings-google-calendar': 'general',
  'reservation-settings-reminders': 'general',
  'reservation-settings-payments-classes': 'clases',
  'reservation-settings-appointment-scheduling': 'citas',
  'reservation-settings-staffing': 'citas',
  'reservation-settings-payments-appointments': 'citas',
}
