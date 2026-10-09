import type { CommissionCalcType, CommissionConfig, UpdateCommissionConfigInput } from '@/types/commission'

/**
 * «Duplicar con cambios» (ft-graves, B1; founder, opción A): un esquema que ya calculó comisiones no cambia de tasa, tipo ni quién
 * recibe; se REEMPLAZA. El servidor lo hace en UNA transacción (`POST /configs/:id/copy` con `replace: true`): crea el nuevo con
 * estos cambios, copia lo demás del original (niveles si el nuevo es TIERED, excepciones activas y a quién aplica) y desactiva el
 * original. Nunca pagan los dos ni queda nada a medias. Sin `effectiveFrom`: el nuevo rige desde AHORA.
 */

export interface CambioDeTasa {
  name: string
  /** 'FIXED' = monto fijo; cualquier otro = porcentaje (un escalonado sigue escalonado, con sus niveles). */
  calcType: CommissionCalcType
  defaultRate: number
}

/** El tipo del reemplazo: «porcentaje» conserva un escalonado (con sus niveles); «monto fijo» siempre es FIXED. */
export const tipoDelReemplazo = (original: CommissionConfig, quiereFijo: boolean): CommissionCalcType =>
  quiereFijo ? 'FIXED' : original.calcType === 'FIXED' ? 'PERCENTAGE' : original.calcType

/** Lo que se manda: los cambios y lo que en un fijo deja de aplicar. El resto lo copia el servidor del original. */
export function cambiosDelReemplazo(
  original: CommissionConfig,
  cambio: CambioDeTasa,
  ahora = new Date(),
): Omit<UpdateCommissionConfigInput, 'active' | 'aggregationPeriod'> {
  // Un fin ya vencido haría que el nuevo nazca vencido (el servidor lo rechaza): se quita; uno futuro se conserva.
  const fin = original.effectiveTo && new Date(original.effectiveTo) > ahora ? original.effectiveTo : null
  return {
    name: cambio.name,
    calcType: cambio.calcType,
    defaultRate: cambio.defaultRate,
    // En un fijo el servidor paga el monto a todos: las tasas por rol y la meta como nivel no aplican (final-fijo-niveles).
    ...(cambio.calcType === 'FIXED' ? { roleRates: null, useGoalAsTier: false, goalBonusRate: null } : {}),
    effectiveTo: fin,
  }
}
