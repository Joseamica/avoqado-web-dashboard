import type { LlegadasDto } from '@/types/staffPay'

type T = (k: string, o?: Record<string, unknown>) => string

/**
 * Asistencia verificada (16-nov-2026): «6 con celular, 1 con teléfono, 1 a mano por Ana P.». Sólo lo que hubo; null si la
 * clase no trae desglose. Con «Corregir conteo» rotula lo registrado y dice a cuánto se corrigió el pago (como el recibo).
 */
export function textoDeLlegadas(t: T, l: LlegadasDto | null | undefined): string | null {
  if (!l) return null
  const aMano = l.aMano?.length ? t('arrivals.byHandBy', { count: l.staff, names: l.aMano.join(', ') }) : t('arrivals.byHand', { count: l.staff })
  const partes = [
    l.qr ? t('arrivals.qr', { count: l.qr }) : null,
    l.phone ? t('arrivals.phone', { count: l.phone }) : null,
    l.staff ? aMano : null,
    l.list ? t('arrivals.list', { count: l.list }) : null,
    l.pass ? t('arrivals.pass', { count: l.pass }) : null,
    l.sinMetodo ? t('arrivals.noMethod', { count: l.sinMetodo }) : null,
  ].filter(Boolean) as string[]
  if (l.corregidoA !== null && l.corregidoA !== undefined) {
    const registradas = partes.length ? t('arrivals.recorded', { list: partes.join(', ') }) : t('arrivals.noneRecorded')
    return `${registradas} · ${t('arrivals.corrected', { count: l.corregidoA })}`
  }
  return partes.length ? partes.join(', ') : null
}
