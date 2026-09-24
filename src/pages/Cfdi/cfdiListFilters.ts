import { DateTime } from 'luxon'

/**
 * Filtros de la lista de Facturas — lógica pura, sin React, para poder probarla.
 *
 * Testarudo (24-sep-2026) reportó que el filtrado «no sirve»: la pantalla ofrecía estatus que el servidor
 * no conoce («Pendiente», «Error»), sólo aplicaba UNO aunque marcaras dos, y el selector de fecha pintaba un
 * rango que la lista no estaba usando.
 */

/** Lo que ve el usuario. Cada grupo se traduce a estatus REALES del servidor. */
export const STATUS_GROUPS = ['STAMPED', 'CANCELLED', 'IN_PROGRESS', 'FAILED'] as const
export type StatusGroup = (typeof STATUS_GROUPS)[number]

const ESTATUS_POR_GRUPO: Record<StatusGroup, string[]> = {
  STAMPED: ['STAMPED'],
  CANCELLED: ['CANCELLED'],
  IN_PROGRESS: ['DRAFT', 'VALIDATING', 'STAMPING'],
  FAILED: ['VALIDATION_FAILED', 'STAMP_FAILED'],
}

export function estatusDelServidor(grupos: readonly string[]): string[] {
  return grupos.flatMap(g => ESTATUS_POR_GRUPO[g as StatusGroup] ?? [])
}

/** Del día 1 del mes a hoy, en el huso del NEGOCIO (no del navegador). Es el rango por defecto. */
export function mesEnCurso(timezone: string, ahora: DateTime = DateTime.now()): { from: Date; to: Date } {
  const hoy = ahora.setZone(timezone)
  return { from: hoy.startOf('month').toJSDate(), to: hoy.endOf('day').toJSDate() }
}

export type BadgeVariant = 'default' | 'secondary' | 'destructive' | 'outline'

/**
 * La insignia de estatus de una factura. 🔴 Una factura cuya cancelación sigue en trámite NO se puede
 * pintar «Timbrada» a secas: el dueño cree que su cancelación no hizo nada (A-14 de Testarudo).
 * Una cancelación RECHAZADA deja la factura vigente, así que ésa sí vuelve a «Timbrada».
 */
export function insigniaDeEstatus(cfdi: { status: string; cancelStatus?: string | null }): {
  clave: string
  variante: BadgeVariant
} {
  if (cfdi.status === 'CANCELLED') return { clave: 'CANCELLED', variante: 'destructive' }
  if (cfdi.status === 'STAMPED' && cfdi.cancelStatus === 'REQUESTED') return { clave: 'CANCEL_PENDING', variante: 'secondary' }
  if (cfdi.status === 'STAMPED') return { clave: 'STAMPED', variante: 'default' }
  if (cfdi.status === 'VALIDATION_FAILED' || cfdi.status === 'STAMP_FAILED') return { clave: cfdi.status, variante: 'destructive' }
  return { clave: cfdi.status, variante: 'outline' }
}
