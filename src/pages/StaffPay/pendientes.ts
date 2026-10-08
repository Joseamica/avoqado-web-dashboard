import type { DestinoDto, DevolucionesPendientesDto } from '@/types/staffPay'
import { monto } from './conSigno'
import { periodicidadDe } from './useNombrePeriodo'

type T = (k: string, o?: Record<string, unknown>) => string
type NombrePeriodo = (p: { start: string; end: string }, periodicidad: 'MONTHLY' | 'SEMIMONTHLY') => string
export type PendientePorDestino = DevolucionesPendientesDto['porDestino'][number]

/**
 * Cuándo se descontará una devolución pendiente (B12, r6.2): «al cerrar el periodo de octubre de 2026» si su periodo sigue
 * abierto, o «al cerrar un periodo posterior al de septiembre de 2026 (ése ya se cerró)». La periodicidad sale de las fechas.
 */
export function cuandoSeDescuenta(t: T, d: DestinoDto, nombre: NombrePeriodo): string {
  const p = d.tipo === 'AL_CERRAR' ? d.periodo : d.origen
  return t(d.tipo === 'AL_CERRAR' ? 'period.pendingAtClose' : 'period.pendingAfter', { periodo: nombre(p, periodicidadDe(p)) })
}

/** Un renglón por destino, con su total EXACTO (lo suma la base, nunca los `items`, que vienen con tope de 50). */
export const lineaDePendiente = (t: T, d: PendientePorDestino, nombre: NombrePeriodo): string =>
  t('period.pendingLine', { monto: monto(d.total), cuando: cuandoSeDescuenta(t, d.seDescuenta, nombre) })

/**
 * Hay algo que avisar: al menos un destino y un total negativo (el server tampoco arma la frase con otro signo, B13 R6). Sirve
 * para el recibo y el ajuste (con `items`) y para la vista previa del cierre (sólo `n`, `total` y `porDestino`).
 */
export const hayPendientes = <P extends Pick<DevolucionesPendientesDto, 'total' | 'porDestino'>>(p?: P | null): p is P =>
  !!p && p.porDestino.length > 0 && Number(p.total) < 0
