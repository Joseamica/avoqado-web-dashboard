import type { ReglaDeClase } from '@/types/staffPay'
import { conSigno } from './conSigno'

type T = (k: string, o?: Record<string, unknown>) => string

/**
 * Por qué cambió el pago de una clase (spec §6.6): decide SÓLO `regla.tipo`; el bono sale de `regla.bono`. Con 0 h de aviso
 * (cambio o cancelación después del inicio) se dice «menos de 1 h», nunca «0 h antes». El mismo texto en la tarjeta de la
 * clase y en el desglose abierto (E6a-fix F14), como lo dicen el recibo cerrado, el PDF y el Excel.
 */
export function textoDeRegla(t: T, r: ReglaDeClase): string {
  if (r.tipo === 'SUPLENCIA')
    return r.horas < 1
      ? t('classCard.coverBonusUnderHour', { monto: conSigno(r.bono) })
      : t('classCard.coverBonus', { horas: r.horas, monto: conSigno(r.bono) })
  return r.horas < 1 ? t('classCard.lateCancelUnderHour') : t('classCard.lateCancel', { horas: r.horas })
}

/** El desglose por fecha (el cursor del servidor va por sede e id): la más vieja primero; empate, por id (estable). */
export const porFecha = <C extends { startsAt: string; classSessionId: string }>(a: C, b: C) =>
  Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.classSessionId.localeCompare(b.classSessionId)
