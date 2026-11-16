import { DateTime } from 'luxon'

import type { RescheduleNotificationChannel } from '@/types/reservation'

/**
 * El `<input type="datetime-local">` da la hora del reloj del NEGOCIO sin zona ("2026-11-12T15:00").
 * Se manda como instante UTC, igual que «Crear cita»: sin esto el SERVIDOR la leía en UTC y la cita
 * quedaba 6 h antes en México (encargo e781ce).
 */
export function horaDelNegocioAUtc(local: string, venueTimezone: string): string | null {
  if (!local) return null
  const dt = DateTime.fromISO(local, { zone: venueTimezone })
  if (!dt.isValid) return null
  return dt.toUTC().toISO()
}

/** «push» no le llega al cliente (no tiene app con avisos): no se ofrece. */
export const CANALES_DE_AVISO = ['whatsapp', 'email', 'none'] as const satisfies readonly RescheduleNotificationChannel[]

type Contacto = {
  customer: { phone: string | null; email: string | null } | null
  guestPhone: string | null
  guestEmail: string | null
}

/** Lo que viene marcado: el canal por el que de verdad le llega al cliente. */
export function avisoPorOmision(r: Contacto): RescheduleNotificationChannel {
  if (r.customer?.phone || r.guestPhone) return 'whatsapp'
  if (r.customer?.email || r.guestEmail) return 'email'
  return 'none'
}
