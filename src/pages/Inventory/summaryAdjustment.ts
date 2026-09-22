import { SUMMARY_LOSS_ACTION_REASON, newWasteKey } from '@/lib/inventoryWaste'
import type { AdjustInventoryStockDto } from '@/services/inventory.service'

/** Acciones del editor rápido de existencias de un producto en «Resumen de existencias». */
export type SummaryStockAction = 'RECEIVE' | 'COUNT' | 'LOSS' | 'DAMAGE' | 'THEFT' | 'RETURN'

// Textos que el kardex ya guardaba para estas acciones: se conservan para no cambiar lo que no es merma.
const REASON_TEXT = { RECEIVE: 'Stock Received', RETURN: 'Customer Return', COUNT: 'Physical Count' } as const

/** Daño, Robo y Pérdida son merma. Las demás acciones siguen el camino de siempre. */
export function isSummaryLossAction(action: SummaryStockAction): action is 'LOSS' | 'DAMAGE' | 'THEFT' {
  return action === 'LOSS' || action === 'DAMAGE' || action === 'THEFT'
}

/**
 * ¿La cantidad tecleada deja guardar? Misma regla que el editor ya aplicaba (un recuento acepta 0,
 * lo demás exige cantidad), ahora también dentro de `handleSave`: una merma de 0 no es merma —
 * `-Math.abs(0)` viaja como 0, el servidor no la manda al libro de merma (exige cantidad NEGATIVA)
 * sino al ajuste viejo, que escribe un movimiento de 0 sin folio y cada reintento suma otra fila.
 */
export function isSummaryAmountValid(action: SummaryStockAction, amount: string): boolean {
  if (amount === '') return false
  const n = parseFloat(amount) || 0
  return action === 'COUNT' ? n >= 0 : n > 0
}

/**
 * Cuerpo de adjust-stock para una acción del «Resumen de existencias».
 *
 * 🔴 Daño, Robo y Pérdida son MERMA: cantidad NEGATIVA, código de motivo y folio. «Pérdida» mandaba
 * la cantidad POSITIVA y el servidor la SUMABA a la existencia (`increment`), defecto medido el
 * 22-sep-2026. El folio viaja en el cuerpo: si `src/api.ts` reintenta solo ante un error de red, el
 * servidor reconoce el reintento y no descuenta dos veces.
 */
export function buildSummaryAdjustment(
  action: SummaryStockAction,
  quantity: number,
  extras: { unitCost?: number; supplier?: string } = {},
  makeKey: () => string = newWasteKey,
): AdjustInventoryStockDto {
  if (isSummaryLossAction(action)) {
    return { type: 'LOSS', quantity: -Math.abs(quantity), reasonCode: SUMMARY_LOSS_ACTION_REASON[action], idempotencyKey: makeKey() }
  }
  if (action === 'RECEIVE' || action === 'RETURN') {
    return { type: 'PURCHASE', quantity: Math.abs(quantity), reason: REASON_TEXT[action], unitCost: extras.unitCost, supplier: extras.supplier }
  }
  // COUNT: el popover ya calculó la diferencia contra la existencia actual.
  return { type: 'COUNT', quantity, reason: REASON_TEXT.COUNT, unitCost: extras.unitCost, supplier: extras.supplier }
}
