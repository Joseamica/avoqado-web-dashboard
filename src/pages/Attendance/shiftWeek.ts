/**
 * Semana del cuadrante de turnos: lunes a domingo, en fechas civiles 'YYYY-MM-DD' (sin Date con
 * zona: la fecha del negocio ya viene como texto y así se queda — `formatDate('2026-08-27')`
 * pintaba el 26 en México, lección de la fase 2 del checador).
 */
export interface ShiftWeek {
  from: string
  to: string
  days: string[]
}

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d + n))
  return dt.toISOString().slice(0, 10)
}

/** Lunes de la semana que contiene `iso`. */
export function weekStart(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay() // 0 = domingo
  const back = dow === 0 ? 6 : dow - 1
  return addDays(iso, -back)
}

export function shiftWeek(anchorIso: string): ShiftWeek {
  const from = weekStart(anchorIso)
  const days = Array.from({ length: 7 }, (_, i) => addDays(from, i))
  return { from, to: days[6], days }
}

export function shiftWeekOffset(week: ShiftWeek, weeks: number): ShiftWeek {
  return shiftWeek(addDays(week.from, weeks * 7))
}

/** ¿El turno cruza la medianoche? (Misma regla que el servidor: fin <= inicio.) */
export function crossesMidnight(startTime: string, endTime: string): boolean {
  return endTime <= startTime
}
