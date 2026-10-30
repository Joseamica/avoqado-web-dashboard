import { DateTime } from 'luxon'

/**
 * El selector de fechas habla dos idiomas. El calendario y las casillas trabajan con DÍAS: una fecha a la medianoche
 * del NAVEGADOR (así los pintan react-day-picker y DateInput). Las pantallas le pasan y esperan INSTANTES del día del
 * NEGOCIO (`getLast7Days(tz)`, `mesEnCurso(tz)`…) y los mandan al servidor con `toISOString()`.
 * Mezclarlos corría el rango un día con la computadora en otra zona (D1, 28-oct): en Madrid, elegir «1–8 oct» para un
 * negocio en México mandaba hasta el 7-oct 23:59 y el 8 se perdía; y el botón pintaba el día de Madrid.
 */

/** El día del negocio de un instante, como medianoche del navegador (lo que pintan el calendario y el botón). */
export function diaDelNegocio(instante: Date, zona: string): Date {
  const dt = DateTime.fromJSDate(instante).setZone(zona)
  return new Date(dt.year, dt.month - 1, dt.day)
}

const delDia = (dia: Date, zona: string) =>
  DateTime.fromObject({ year: dia.getFullYear(), month: dia.getMonth() + 1, day: dia.getDate() }, { zone: zona })

/** Del primer instante del primer día al último del último, en la zona del negocio. Un solo día elegido es ese día entero. */
export function instantesDelNegocio(rango: { from: Date; to?: Date }, zona: string): { from: Date; to: Date } {
  return {
    from: delDia(rango.from, zona).startOf('day').toJSDate(),
    to: delDia(rango.to ?? rango.from, zona)
      .endOf('day')
      .toJSDate(),
  }
}

/** Mismo rango de días, extremo por extremo: «1–7 oct» y «sólo el 1» NO son el mismo (antes «Aplicar» ignoraba el segundo). */
export function mismoRango(a: { from: Date; to?: Date } | undefined, b: { from: Date; to?: Date } | undefined): boolean {
  if (!a || !b) return a === b
  return mismoDia(a.from, b.from) && mismoDia(a.to, b.to)
}

/** El mismo día del calendario (año, mes y día del navegador). */
export function mismoDia(a: Date | undefined, b: Date | undefined): boolean {
  if (!a || !b) return a === b
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

/** El día entero anterior al del instante, en la zona del negocio («vs día anterior»). */
export function diaAnteriorDelNegocio(instante: Date, zona: string): { start: string; end: string } {
  const prev = DateTime.fromJSDate(instante).setZone(zona).minus({ days: 1 })
  return { start: prev.startOf('day').toJSDate().toISOString(), end: prev.endOf('day').toJSDate().toISOString() }
}
