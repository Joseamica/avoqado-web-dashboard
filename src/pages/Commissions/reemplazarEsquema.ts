import { commissionService } from '@/services/commission.service'
import type { CommissionCalcType, CommissionConfig, CreateCommissionConfigInput } from '@/types/commission'
import type { Paso } from './envioUnico'
import { servidorRestringePorPersona } from './aQuienAplica'
import { excepcionesAGuardar, ofreceNiveles, tasasPorRolAGuardar } from './tasaDelEsquema'

/**
 * «Duplicar con cambios» (ft-graves, B1; founder, opción A): un esquema que ya calculó comisiones no cambia de tasa, tipo ni quién
 * recibe; se REEMPLAZA. El nuevo copia todo lo demás del original (categorías, a quién aplica, base, límites, niveles y excepciones
 * por persona) con la tasa nueva, y el original se desactiva. Nunca deben pagar los dos: el original se desactiva sólo cuando el
 * nuevo quedó completo, y si crear el nuevo falla, el original sigue igual.
 */

export interface CambioDeTasa {
  name: string
  /** 'FIXED' = monto fijo; cualquier otro = porcentaje (un escalonado sigue escalonado). */
  calcType: CommissionCalcType
  defaultRate: number
}

const aFuturo = (fin: string | null | undefined, ahora: Date) => (fin && new Date(fin) > ahora ? fin : null)

/** El tipo del reemplazo: «porcentaje» conserva un escalonado (con sus niveles); «monto fijo» siempre es FIXED. */
export const tipoDelReemplazo = (original: CommissionConfig, quiereFijo: boolean): CommissionCalcType =>
  quiereFijo ? 'FIXED' : original.calcType === 'FIXED' ? 'PERCENTAGE' : original.calcType

export function cuerpoDelReemplazo(original: CommissionConfig, cambio: CambioDeTasa, ahora = new Date()): CreateCommissionConfigInput {
  const conNiveles = ofreceNiveles(cambio.calcType)
  const tieneTasasPorRol = !!original.roleRates && Object.keys(original.roleRates).length > 0
  return {
    name: cambio.name,
    recipient: original.recipient,
    calcType: cambio.calcType,
    defaultRate: cambio.defaultRate,
    minAmount: original.minAmount,
    maxAmount: original.maxAmount,
    includeTips: original.includeTips,
    includeDiscount: original.includeDiscount,
    includeTax: original.includeTax,
    roleRates: tasasPorRolAGuardar(cambio.calcType, tieneTasasPorRol, original.roleRates),
    filterByCategories: original.filterByCategories,
    categoryIds: original.filterByCategories ? original.categoryIds : [],
    ...(servidorRestringePorPersona(original) ? { filterByStaff: original.filterByStaff, staffIds: original.staffIds ?? [] } : {}),
    useGoalAsTier: conNiveles && original.useGoalAsTier,
    goalBonusRate: conNiveles && original.useGoalAsTier ? original.goalBonusRate : null,
    attendanceLinked: original.attendanceLinked,
    attendanceLatePenaltyRate: original.attendanceLinked ? original.attendanceLatePenaltyRate : null,
    priority: original.priority,
    aggregationPeriod: original.aggregationPeriod,
    // Vigente desde AHORA (el servidor pone la hora): lo ya cobrado no se toca.
    effectiveTo: aFuturo(original.effectiveTo, ahora),
  }
}

/** Crea el reemplazo completo (esquema, niveles y excepciones), cada paso con su `Idempotency-Key`. No toca el original. */
export async function crearReemplazo(venueId: string, original: CommissionConfig, cambio: CambioDeTasa, paso: Paso): Promise<CommissionConfig> {
  const ahora = new Date()
  const cuerpo = cuerpoDelReemplazo(original, cambio, ahora)
  const nuevo = await paso('esquema', clave => commissionService.createConfig(venueId, cuerpo, clave))

  const niveles = ofreceNiveles(cambio.calcType) && cambio.calcType === 'TIERED' ? (original.tiers ?? []) : []
  if (niveles.length > 0) {
    const copia = niveles.map(n => ({
      tierLevel: n.tierLevel,
      name: n.tierName,
      tierType: n.tierType,
      minThreshold: n.minThreshold,
      maxThreshold: n.maxThreshold,
      minThresholdType: n.minThresholdType,
      maxThresholdType: n.maxThresholdType,
      rate: n.rate,
      period: n.tierPeriod,
    }))
    await paso('niveles', clave => commissionService.createTiersBatch(venueId, nuevo.id, copia, clave))
  }

  // Las excepciones por persona (excluir o tasa propia) también: sin ellas, alguien excluido empezaría a cobrar.
  const vivas = (original.overrides ?? []).filter(o => o.active !== false)
  const excepciones = excepcionesAGuardar(
    cambio.calcType,
    vivas.map(o => ({ staffId: o.staffId, customRate: o.customRate, excluir: o.excludeFromCommissions })),
  )
  for (const excepcion of excepciones) {
    const fin = aFuturo(vivas.find(o => o.staffId === excepcion.staffId)?.effectiveTo, ahora)
    await paso(`excepcion:${excepcion.staffId}`, clave =>
      commissionService.createOverride(venueId, nuevo.id, { ...excepcion, ...(fin ? { effectiveTo: fin } : {}) }, clave),
    )
  }
  return nuevo
}
