import { DateTime } from 'luxon'
import type { EstadoDeCancelacion } from '@/services/cfdi.service'

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
export function insigniaDeEstatus(cfdi: {
  status: string
  cancelStatus?: string | null
  estadoCancelacion?: EstadoDeCancelacion
  timbreEnDuda?: boolean
}): {
  clave: string
  variante: BadgeVariant
} {
  if (cfdi.status === 'CANCELLED') return { clave: 'CANCELLED', variante: 'destructive' }
  if (cfdi.status === 'STAMPED' && cfdi.cancelStatus === 'REQUESTED') {
    // C2 · T10 ronda 1 (M6): con el estado fino del servidor, la insignia dice lo mismo que el texto de abajo (enviándose ≠ en trámite).
    if (cfdi.estadoCancelacion === 'ENVIANDO' || cfdi.estadoCancelacion === 'ANOTADA')
      return { clave: 'CANCEL_SENDING', variante: 'secondary' }
    if (cfdi.estadoCancelacion === 'CANCELACION_EN_DUDA') return { clave: 'CANCEL_IN_DOUBT', variante: 'secondary' }
    return { clave: 'CANCEL_PENDING', variante: 'secondary' }
  }
  if (cfdi.status === 'STAMPED') return { clave: 'STAMPED', variante: 'default' }
  // C2 · ronda QA (D6): el PAC no contestó claro (se confirma solo): no es «Rechazada por el SAT».
  if (cfdi.status === 'STAMP_FAILED' && cfdi.timbreEnDuda) return { clave: 'STAMP_IN_DOUBT', variante: 'secondary' }
  if (cfdi.status === 'VALIDATION_FAILED' || cfdi.status === 'STAMP_FAILED') return { clave: cfdi.status, variante: 'destructive' }
  return { clave: cfdi.status, variante: 'outline' }
}

/**
 * «Reenviar por correo» sólo en una factura vigente: timbrada y sin cancelación, o con la cancelación RECHAZADA (el receptor
 * no la aceptó y la factura sigue valiendo). Con la cancelación en trámite, no (H24, auditoría 2026-09-30).
 */
export function sePuedeReenviar(cfdi: { status: string; cancelStatus?: string | null }): boolean {
  return cfdi.status === 'STAMPED' && (!cfdi.cancelStatus || cfdi.cancelStatus === 'REJECTED')
}

/** C2 · T10: lo que la fila necesita de la cancelación (lo deriva el servidor en cada consulta: `estadoCancelacion`). */
type CancelacionDeLaFila = {
  status: string
  cancelStatus?: string | null
  estadoCancelacion?: EstadoDeCancelacion
  motivoRechazoCancelacion?: string
}

/**
 * C2 · T10 (Codex C2-31, M9 y M2/I3 de la T2/T3): el texto bajo la insignia. Una clave de `cfdi.json` o, con el rechazo, el porqué que dio
 * el servidor tal cual. Enviándose (o recién anotada) NO dice «en trámite ante el SAT»: el SAT todavía no la tiene. `null` = nada que decir.
 */
export function textoDeLaCancelacion(cfdi: CancelacionDeLaFila): { clave: string; literal?: string } | null {
  if (cfdi.status !== 'STAMPED') return null
  switch (cfdi.estadoCancelacion) {
    case 'CANCELACION_EN_DUDA':
      return { clave: 'cancelacion.lista.enDuda' }
    case 'EN_TRAMITE':
      return { clave: 'cancelacion.lista.enTramite' }
    case 'ENVIANDO':
    case 'ANOTADA':
      return { clave: 'cancelacion.lista.enviando' }
    case 'RECHAZADA':
      return { clave: 'cancelacion.lista.rechazada', literal: cfdi.motivoRechazoCancelacion || undefined }
    default:
      return null
  }
}

/**
 * C2 · T10 (I3 de la T2) y ronda 1 (I-1): «Consultar estado» con la cancelación PEDIDA, en cualquier estado fino. La consulta manda
 * `soloConsultar`: el servidor nunca anota ni envía un intento, así que también se ofrece enviándose o recién anotada (es lo que promete el
 * aviso «en duda» de justo después de cancelar, cuando la fila todavía deriva `ENVIANDO`).
 */
export function sePuedeConsultarLaCancelacion(cfdi: CancelacionDeLaFila): boolean {
  return cfdi.status === 'STAMPED' && cfdi.cancelStatus === 'REQUESTED'
}

/**
 * C2 · T10 ronda 1 (I-2): «Terminar la sustitución» en la fila de la ORIGINAL. La sustituta ya está TIMBRADA, pero la cancelación de la
 * original no salió (`cancelAviso`: queda REJECTED) o no se pudo pedir (`cancelConflicto`: sin cancelación): hay dos facturas vigentes por la
 * misma venta. Volver a pedir la sustitución sólo reanuda la cancelación (el servidor nunca timbra otra con una sustituta timbrada).
 */
export function sePuedeTerminarLaSustitucion(cfdi: {
  status: string
  cancelStatus?: string | null
  replacedBy?: Array<{ status?: string | null }> | null
}): boolean {
  const sinCancelacionViva = !cfdi.cancelStatus || cfdi.cancelStatus === 'REJECTED'
  return cfdi.status === 'STAMPED' && sinCancelacionViva && !!cfdi.replacedBy?.some(r => r.status === 'STAMPED')
}

/**
 * C2 · ronda QA (D4): el servidor deriva «en duda» por RELOJ (`ENVIO_TERMINADO_MS`, ~90 s tras el envío), porque desde fuera no sabe si el
 * POST ya terminó: mientras tanto la fila dice `ENVIANDO`. Quien PIDIÓ la cancelación sí lo sabe (su respuesta trae `enDuda`): esta pestaña lo
 * recuerda y, durante la ventana, lee `ENVIANDO`/`ANOTADA` de ESA factura como `CANCELACION_EN_DUDA`. Lo demás (acuse, rechazo,
 * cancelada) lo sigue diciendo el servidor.
 * ponytail: memoria de la pestaña (al recargar, u otra persona, ve «enviando» hasta los 90 s); una columna en el servidor si importa.
 */
const cancelacionesEnDudaConocidas = new Map<string, number>()
export const VIGENCIA_DE_LA_DUDA_CONOCIDA_MS = 3 * 60_000

export function recordarCancelacionEnDuda(cfdiId: string | null | undefined, ahora: number = Date.now()): void {
  if (cfdiId) cancelacionesEnDudaConocidas.set(cfdiId, ahora)
}

export function conDudaConocida<T extends { id: string; estadoCancelacion?: EstadoDeCancelacion }>(cfdi: T, ahora: number = Date.now()): T {
  const desde = cancelacionesEnDudaConocidas.get(cfdi.id)
  if (desde === undefined) return cfdi
  if (ahora - desde > VIGENCIA_DE_LA_DUDA_CONOCIDA_MS) {
    cancelacionesEnDudaConocidas.delete(cfdi.id)
    return cfdi
  }
  return cfdi.estadoCancelacion === 'ENVIANDO' || cfdi.estadoCancelacion === 'ANOTADA'
    ? { ...cfdi, estadoCancelacion: 'CANCELACION_EN_DUDA' }
    : cfdi
}

/** Para pruebas: olvida lo recordado (la memoria es del módulo). */
export function olvidarCancelacionesEnDuda(): void {
  cancelacionesEnDudaConocidas.clear()
}

/** Micro-ronda final (nit D4): otra respuesta de un intento NUEVO de esa factura (cancelar, «Terminar») sin `enDuda` borra lo recordado. */
export function olvidarCancelacionEnDuda(cfdiId: string | null | undefined): void {
  if (cfdiId) cancelacionesEnDudaConocidas.delete(cfdiId)
}
