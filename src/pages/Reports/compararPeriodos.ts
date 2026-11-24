/**
 * Resumen de ventas · comparar con otro periodo (carril F2, hz:fefa11b6:D7). El SERVIDOR calcula el rango, las cifras y el cambio; aquí
 * sólo se decide cómo se dice: la ventana exacta de cada lado y el color del cambio según el sentido del renglón.
 */
import { DateTime } from 'luxon'

/** Qué es mejor para el dueño cuando la cifra sube. */
export type Sentido = 'subeBien' | 'subeMal' | 'neutro'
export type Tono = 'mejora' | 'empeora' | 'neutro' | 'igual'

export function tonoDelCambio(sentido: Sentido, difference: number): Tono {
  if (difference === 0) return 'igual'
  if (sentido === 'neutro') return 'neutro'
  return difference > 0 === (sentido === 'subeBien') ? 'mejora' : 'empeora'
}

export interface Rango {
  startDate: string
  endDate: string
}

export function sonDiasCompletos(r: Rango, zona: string): boolean {
  const a = DateTime.fromISO(r.startDate, { zone: zona })
  const b = DateTime.fromISO(r.endDate, { zone: zona })
  return +a === +a.startOf('day') && +b === +b.endOf('day')
}

/** Un día con cambio de horario: la misma hora puede existir dos veces, y se escribe con su desfase (UTC−8). */
const conDesfase = (d: DateTime) =>
  d.offset !== d.minus({ hours: 24 }).offset || d.offset !== d.plus({ hours: 24 }).offset ? ` (UTC${d.toFormat('Z').replace('-', '−')})` : ''

/**
 * La ventana exacta de un lado. Con `conHoras` (alguno de los dos lados no es de días completos): fecha y hora de inicio y de fin. Si no,
 * sólo las fechas. El año sólo si no es el de `hoy`.
 */
export function ventanaDelPeriodo(r: Rango, zona: string, conHoras: boolean, locale: string, hoy: Date = new Date()): string {
  const a = DateTime.fromISO(r.startDate, { zone: zona }).setLocale(locale)
  const b = DateTime.fromISO(r.endDate, { zone: zona }).setLocale(locale)
  const anioDeHoy = DateTime.fromJSDate(hoy).setZone(zona).year
  const conAnio = a.year !== anioDeHoy || b.year !== anioDeHoy
  const fecha = (d: DateTime) => d.toFormat(conAnio ? 'ccc d LLL yyyy' : 'ccc d LLL')
  const hora = (d: DateTime) => d.toLocaleString(DateTime.TIME_SIMPLE) + conDesfase(d)
  if (conHoras) {
    return a.hasSame(b, 'day') ? `${fecha(a)}, ${hora(a)} – ${hora(b)}` : `${fecha(a)}, ${hora(a)} – ${fecha(b)}, ${hora(b)}`
  }
  if (a.hasSame(b, 'day')) return fecha(a)
  return `${fecha(a)} – ${fecha(b)}`
}
