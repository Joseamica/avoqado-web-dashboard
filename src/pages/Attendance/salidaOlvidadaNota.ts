import type { TimeEntry } from '@/services/attendance.service'

/**
 * La última nota de una «Salida olvidada» que dejó el celular: la hora real de una salida que llegó después del día del
 * turno y no se usó (hz:f0a89d19:D3). Sirve al gerente para corregirla. null = no hay.
 */
export function notaDeLaSalidaOlvidada(entry: Pick<TimeEntry, 'notes'>): string | null {
  const lineas = (entry.notes ?? '').split('\n').filter(l => l.includes('no se usó'))
  return lineas.length ? lineas[lineas.length - 1] : null
}
