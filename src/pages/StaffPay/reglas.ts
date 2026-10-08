import { MONTO_VALIDO } from './rangos'

/**
 * Las dos reglas de clase de la tabla (spec §6.6, §7.3), apagadas de fábrica. Viven en la versión de la tabla: cambiarlas
 * es publicar otra versión, y el ancla de una clase cerrada conserva las suyas. La validación es la del server: horas
 * enteras de 1 a 168; monto > 0 y ≤ $100,000 con hasta dos decimales; si hay horas de suplencia hay monto, y viceversa
 * (con el interruptor prendido se piden los dos; apagado viajan los dos en null). Los campos son texto: vaciables.
 */
export const HORAS_MAX = 168
export const BONO_MAX = 100_000

export interface ReglasForm {
  suplencia: boolean
  coverBonusHours: string
  coverBonusAmount: string
  cancelacion: boolean
  lateCancelHours: string
}
/** Lo que viaja al publicar una versión. El dashboard manda SIEMPRE los tres: `null` = apagada (nunca «hereda»). */
export interface ReglasPayload {
  coverBonusHours: number | null
  coverBonusAmount: number | null
  lateCancelHours: number | null
}
export type ErrorRegla = 'coverHours' | 'coverAmount' | 'lateHours'

const horasValidas = (s: string) => /^\d+$/.test(s) && Number(s) >= 1 && Number(s) <= HORAS_MAX
const montoValido = (s: string) => MONTO_VALIDO.test(s) && Number(s) > 0 && Number(s) <= BONO_MAX

/** Las reglas de la versión vigente (`vigente.reglas`, D4). Sin versión, o un server previo sin el campo: apagadas. */
export function reglasDesdeVersion(v?: Partial<ReglasPayload> | null): ReglasForm {
  return {
    suplencia: v?.coverBonusHours != null,
    coverBonusHours: v?.coverBonusHours != null ? String(v.coverBonusHours) : '',
    coverBonusAmount: v?.coverBonusAmount != null ? String(v.coverBonusAmount) : '',
    cancelacion: v?.lateCancelHours != null,
    lateCancelHours: v?.lateCancelHours != null ? String(v.lateCancelHours) : '',
  }
}

export function erroresDeReglas(r: ReglasForm): ErrorRegla[] {
  const e: ErrorRegla[] = []
  if (r.suplencia && !horasValidas(r.coverBonusHours)) e.push('coverHours')
  if (r.suplencia && !montoValido(r.coverBonusAmount)) e.push('coverAmount')
  if (r.cancelacion && !horasValidas(r.lateCancelHours)) e.push('lateHours')
  return e
}

export function reglasPayload(r: ReglasForm): ReglasPayload {
  return {
    coverBonusHours: r.suplencia ? Number(r.coverBonusHours) : null,
    coverBonusAmount: r.suplencia ? Number(r.coverBonusAmount) : null,
    lateCancelHours: r.cancelacion ? Number(r.lateCancelHours) : null,
  }
}
