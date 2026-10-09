import { DateTime } from 'luxon'

/**
 * Los periodos del ranking del equipo («esta semana», «esta quincena», «este mes», «este trimestre») cortados en la zona del
 * NEGOCIO, como corta el servidor los resúmenes (ft-graves, hermano de D-D2). Antes se cortaban con la zona del navegador: de noche
 * en México, o con el navegador en otra zona, «este mes» ya era el siguiente.
 */
export type PeriodFilter = 'week' | 'biweek' | 'month' | 'quarter' | 'all'
type Rango = { start: Date; end: Date }

const ZONA_DEFAULT = 'America/Mexico_City'
const rango = (inicio: DateTime, fin: DateTime): Rango => ({ start: inicio.toJSDate(), end: fin.toJSDate() })

export function rangosDelRanking(periodo: PeriodFilter, zona: string, ahora: Date = new Date()): { current: Rango; previous: Rango | null } {
  let hoy = DateTime.fromJSDate(ahora).setZone(zona || ZONA_DEFAULT)
  if (!hoy.isValid) hoy = DateTime.fromJSDate(ahora).setZone(ZONA_DEFAULT)

  switch (periodo) {
    case 'week':
    case 'month':
    case 'quarter': {
      // Luxon empieza la semana en lunes (ISO).
      const unidad = periodo
      const anterior = hoy.minus({ [`${unidad}s`]: 1 })
      return {
        current: rango(hoy.startOf(unidad), hoy.endOf(unidad)),
        previous: rango(anterior.startOf(unidad), anterior.endOf(unidad)),
      }
    }
    case 'biweek': {
      // Quincenas: del 1 al 15 y del 16 al fin de mes.
      const mes = hoy.startOf('month')
      const dia15 = mes.set({ day: 15 }).endOf('day')
      const dia16 = mes.set({ day: 16 })
      if (hoy.day >= 16) return { current: rango(dia16, hoy.endOf('month')), previous: rango(mes, dia15) }
      const mesPasado = mes.minus({ months: 1 })
      return { current: rango(mes, dia15), previous: rango(mesPasado.set({ day: 16 }), mesPasado.endOf('month')) }
    }
    case 'all':
    default:
      return { current: { start: new Date(0), end: ahora }, previous: null }
  }
}
