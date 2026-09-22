import type { GlobalInventoryMovement } from '@/services/inventory.service'

type WithFolio = Pick<GlobalInventoryMovement, 'wasteReportId'>

/** ¿El renglón pertenece a una merma registrada con folio (servidor fase 1)? */
export function isFolioWaste(m: WithFolio): boolean {
  return typeof m.wasteReportId === 'string' && m.wasteReportId.length > 0
}

export type WasteCostDisplay = { kind: 'unvalued' } | { kind: 'amount'; amount: number }

/**
 * Costo de un renglón de merma CON folio: el del lote que se descontó (con signo: negativo = salió
 * valor) o «sin valorar» si no tiene costo conocido. `null` ⇒ el renglón no es merma con folio y
 * decide la lógica de siempre del Historial (spec §8: su valoración queda fuera de este trabajo).
 */
export function wasteCostDisplay(m: WithFolio & Pick<GlobalInventoryMovement, 'totalCost'>): WasteCostDisplay | null {
  if (!isFolioWaste(m)) return null
  return typeof m.totalCost === 'number' && Number.isFinite(m.totalCost) ? { kind: 'amount', amount: m.totalCost } : { kind: 'unvalued' }
}

/** «Sin existencia» del folio. El servidor lo manda SÓLO en el primer movimiento del folio. */
export function wasteUnrecordedOf(m: WithFolio & Pick<GlobalInventoryMovement, 'wasteUnrecorded'>): number | null {
  if (!isFolioWaste(m)) return null
  const n = Number(m.wasteUnrecorded)
  return m.wasteUnrecorded !== null && m.wasteUnrecorded !== undefined && Number.isFinite(n) && n > 0 ? n : null
}
