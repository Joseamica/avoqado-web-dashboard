/**
 * Rango de fechas del historial de asistencia, en fechas del NEGOCIO.
 *
 * Vive fuera del componente por dos razones: el hot-reload de Vite exige que un archivo de
 * componente exporte sólo componentes, y así esta lógica —la única con casos borde reales—
 * se prueba sin montar nada.
 */
export type RangeKey = 'today' | 'week' | 'month'

const DAY_MS = 86_400_000

/**
 * La resta va sobre `Date.UTC`, no sobre `new Date('YYYY-MM-DDT00:00:00')`. Esa segunda
 * forma interpreta la fecha en la zona de QUIEN MIRA, y al volver a ISO se corre un día
 * para cualquiera que no esté en la zona del negocio — el dueño revisando desde otro huso
 * vería una semana que empieza un día antes de la que ve su gerente.
 */
export function rangeToDates(range: RangeKey, todayIso: string): { startDate: string; endDate: string } {
  if (range === 'today') return { startDate: todayIso, endDate: todayIso }

  const [year, month, day] = todayIso.split('-').map(Number)
  const daysBack = range === 'week' ? 6 : 29
  const start = new Date(Date.UTC(year, month - 1, day) - daysBack * DAY_MS).toISOString().slice(0, 10)
  return { startDate: start, endDate: todayIso }
}
