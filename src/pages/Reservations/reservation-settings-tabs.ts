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
 * la sección: si aplica a más de un tipo (o ante la duda), va en General y su ayuda dice a qué aplica.
 * Las líneas son de `avoqado-server` (`origin/develop`, 22-nov-2026) y justifican cada campo que NO va a General:
 *
 *   capacityMode              → citas: `reservationStaffMode.ts:7` y `appointmentStaffAssignment.service.ts:255`
 *                               (personal elegible de un `APPOINTMENTS_SERVICE`).
 *   showStaffPicker           → citas: `reservation.public.controller.ts:798` (`!classSessionId`) y
 *                               `appointmentStaffAssignment.service.ts:255`.
 *   appointmentUpfrontDefault → citas: `reservation.public.controller.ts:109` (`isClass ? class… : appointment…`).
 *   classUpfrontDefault       → clases: la misma línea `:109`.
 *
 * Compartidos que parecían de un tipo y van a General (r1 de Codex sobre el código):
 *   - intervalo, duración por defecto y máximo por horario: el motor general de horarios
 *     (`reservationAvailability.service.ts:146,192,226,384`) los aplica a TODO producto sin sesión —mesas, eventos y
 *     la reserva manual de una clase en el DASHBOARD (`CreateReservation.tsx:179`)—, no sólo a citas;
 *   - el % de cupo en línea aplica a clases y a productos con cupo, NO a citas (`reservationAvailability.service.ts:291`
 *     excluye `APPOINTMENTS_SERVICE`; `:590` sesiones de clase): su ayuda lo dice;
 *   - anticipación y confirmación automática (`reservation.public.controller.ts:1946-1980`, también clases), gracia de
 *     no-show (`reservation-auto-no-show.job.ts`, sin filtro de tipo), aviso nocturno (`kioskOutreach.service.ts:50`,
 *     paquetes de créditos) y créditos al cancelar (`reservation.public.controller.ts:1221`, también citas).
 *
 * Es un `Record` del formulario entero: un campo nuevo no compila hasta que alguien decide su pestaña.
 */
export const FIELD_TAB: Record<keyof SettingsFormData, SettingsTab> = {
  slotIntervalMin: 'general',
  defaultDurationMin: 'general',
  autoConfirm: 'general',
  maxAdvanceDays: 'general',
  minNoticeMin: 'general',
  noShowGraceMin: 'general',
  nightlyOutreachEnabled: 'general',
  capacityMode: 'citas',
  pacingMaxPerSlot: 'general',
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
