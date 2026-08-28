import { DateTime } from 'luxon'

/**
 * Cuantas JORNADAS del negocio han pasado desde una fecha.
 *
 * 🔴 Se cuenta por dia CIVIL en la zona del venue, no restando milisegundos: «ayer a las 11pm»
 * y «hoy a la 1am» distan 2 horas pero son dias distintos para el negocio, y el cliente que
 * pregunta «cuando vino?» quiere oir «ayer», no «hoy».
 *
 * 🔴 Y nunca con el reloj del NAVEGADOR (regla dura del repo): un cajero con la laptop en otra
 * zona veria «Hoy» en una visita de ayer.
 *
 * @returns dias completos (0 = hoy), o `null` si la fecha no sirve.
 */
export function diasCivilesDesde(iso: string | null | undefined, timezone: string, ahora?: Date): number | null {
  if (!iso) return null
  const visita = DateTime.fromISO(iso, { zone: 'utc' }).setZone(timezone)
  if (!visita.isValid) return null

  const hoy = (ahora ? DateTime.fromJSDate(ahora) : DateTime.now()).setZone(timezone).startOf('day')
  const dias = hoy.diff(visita.startOf('day'), 'days').days
  // Una visita "en el futuro" (reloj del servidor adelantado) no puede dar negativo.
  return Math.max(0, Math.round(dias))
}
