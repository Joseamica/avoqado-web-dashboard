/**
 * ¿Esta persona sale en Turnos y en Asistencia? Regla de dos pasos (founder, 20-oct-2026, Asana 1219720211947237): con puesto
 * vigente manda «Checa entrada y salida»; sin puesto, «Solo ver» (inversionistas, socios) no checa y los demás sí.
 * 🔴 Espejo por nombre del servidor: `avoqado-server/src/services/dashboard/rh/checaAsistencia.ts`. Cambiar uno sin el otro
 * hace que Turnos y Puntualidad muestren personas distintas.
 */
export function checaAsistencia(role: string, puestosVigentes: ReadonlyArray<{ tracksAttendance: boolean }>): boolean {
  if (puestosVigentes.length > 0) return puestosVigentes.some(p => p.tracksAttendance)
  return checaPorDefault(role)
}

/** Con qué valor nace «Checa entrada y salida» en un puesto nuevo y para quien no tiene puesto. */
export function checaPorDefault(role: string): boolean {
  return role !== 'VIEWER'
}
