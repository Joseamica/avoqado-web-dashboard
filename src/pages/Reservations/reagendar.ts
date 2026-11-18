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
  // naa485b3: una hora que no existe (cambio de horario) Luxon la corre en silencio; nunca se manda otra hora.
  if (horaQueNoExiste(local, venueTimezone)) return null
  return dt.toUTC().toISO()
}

/**
 * `true` si la hora del reloj del negocio no existe porque el reloj se la salta (Tijuana, 14-mar-2027: de 02:00 brinca a
 * 03:00). Se compara la hora de vuelta en la zona con la escrita (hasta el minuto). La que pasa dos veces (otoño) sí existe.
 */
export function horaQueNoExiste(local: string, venueTimezone: string): boolean {
  if (!local) return false
  const dt = DateTime.fromISO(local, { zone: venueTimezone })
  if (!dt.isValid) return false
  return dt.toFormat("yyyy-MM-dd'T'HH:mm") !== local.slice(0, 16)
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
