import type { CommissionConfig, UpdateCommissionConfigInput } from '@/types/commission'
import { diaEnLaSede, finDelDiaEnLaSede, inicioDelDiaEnLaSede } from './fechasDeVigencia'

/**
 * «Editar configuración» manda SÓLO lo que cambió (ft-graves, B1). Antes mandaba siempre tasa, tipo y quién recibe, y el servidor
 * rechaza que lleguen en un esquema con comisiones calculadas: tras la primera venta no se podía cambiar ni el nombre.
 */

/** Lo que propone el editor: los campos como se guardan, salvo la vigencia, que va como días (YYYY-MM-DD) del negocio. */
export type PropuestaDelEditor = Omit<UpdateCommissionConfigInput, 'effectiveFrom' | 'effectiveTo' | 'active'> & {
  desde: string | null
  hasta: string | null
}

/** Lo que el servidor no deja cambiar en un esquema con comisiones calculadas (la tasa, el tipo y quién recibe). */
export const CAMPOS_BLOQUEADOS = ['defaultRate', 'calcType', 'recipient'] as const
export type CampoBloqueado = (typeof CAMPOS_BLOQUEADOS)[number]

// La base guarda tasas y montos con 4 decimales (Decimal(12,4)): 0.1 que regresa del campo como 0.10000000000000002 no es un cambio.
const a4 = (v: number | null | undefined) => (v === null || v === undefined ? null : Math.round(Number(v) * 1e4) / 1e4)
const mismoNumero = (a: number | null | undefined, b: number | null | undefined) => a4(a) === a4(b)
const mismoConjunto = (a: readonly string[] = [], b: readonly string[] = []) => [...a].sort().join('\u0000') === [...b].sort().join('\u0000')
const tasasPorRol = (r: Record<string, number> | null | undefined) =>
  !r || Object.keys(r).length === 0
    ? null
    : JSON.stringify(Object.fromEntries(Object.entries(r).sort(([x], [y]) => x.localeCompare(y)).map(([k, v]) => [k, a4(v)])))

export function cambiosAGuardar(original: CommissionConfig, propuesta: PropuestaDelEditor, zona: string): UpdateCommissionConfigInput {
  const cambios: UpdateCommissionConfigInput = {}
  const p = propuesta

  if (p.name !== undefined && p.name !== original.name) cambios.name = p.name
  if (p.recipient !== undefined && p.recipient !== original.recipient) cambios.recipient = p.recipient
  if (p.calcType !== undefined && p.calcType !== original.calcType) cambios.calcType = p.calcType
  if (p.defaultRate !== undefined && !mismoNumero(p.defaultRate, original.defaultRate)) cambios.defaultRate = p.defaultRate
  if (p.minAmount !== undefined && !mismoNumero(p.minAmount, original.minAmount)) cambios.minAmount = p.minAmount
  if (p.maxAmount !== undefined && !mismoNumero(p.maxAmount, original.maxAmount)) cambios.maxAmount = p.maxAmount
  if (p.goalBonusRate !== undefined && !mismoNumero(p.goalBonusRate, original.goalBonusRate)) cambios.goalBonusRate = p.goalBonusRate
  if (p.attendanceLatePenaltyRate !== undefined && !mismoNumero(p.attendanceLatePenaltyRate, original.attendanceLatePenaltyRate))
    cambios.attendanceLatePenaltyRate = p.attendanceLatePenaltyRate

  for (const campo of ['includeTips', 'includeDiscount', 'includeTax', 'filterByCategories', 'useGoalAsTier', 'attendanceLinked'] as const) {
    if (p[campo] !== undefined && p[campo] !== (original[campo] ?? false)) cambios[campo] = p[campo]
  }
  if (p.categoryIds !== undefined && !mismoConjunto(p.categoryIds, original.categoryIds)) cambios.categoryIds = p.categoryIds
  if (p.roleRates !== undefined && tasasPorRol(p.roleRates) !== tasasPorRol(original.roleRates)) cambios.roleRates = p.roleRates
  if (p.aggregationPeriod !== undefined && p.aggregationPeriod !== original.aggregationPeriod) cambios.aggregationPeriod = p.aggregationPeriod
  if (p.priority !== undefined && p.priority !== original.priority) cambios.priority = p.priority

  // A quién aplica: si cambia algo, viajan juntos (el servidor valida la lista contra la bandera).
  if (
    p.filterByStaff !== undefined &&
    (p.filterByStaff !== (original.filterByStaff ?? false) || !mismoConjunto(p.staffIds ?? [], original.staffIds ?? []))
  ) {
    cambios.filterByStaff = p.filterByStaff
    cambios.staffIds = p.staffIds ?? []
  }

  // Vigencia por DÍA del negocio: el mismo día no se manda y el instante guardado no se mueve (D-D2).
  if (p.desde && p.desde !== diaEnLaSede(original.effectiveFrom, zona)) cambios.effectiveFrom = inicioDelDiaEnLaSede(p.desde, zona)
  if ((p.hasta ?? null) !== diaEnLaSede(original.effectiveTo, zona)) cambios.effectiveTo = p.hasta ? finDelDiaEnLaSede(p.hasta, zona) : null

  return cambios
}

/** Los campos bloqueados (con comisiones calculadas) que estos cambios tocarían, en el orden de `CAMPOS_BLOQUEADOS`. */
export const camposBloqueadosQueCambian = (cambios: UpdateCommissionConfigInput): CampoBloqueado[] =>
  CAMPOS_BLOQUEADOS.filter(campo => cambios[campo] !== undefined)
