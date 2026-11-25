import type { TFunction } from 'i18next'
import type { CreditItemBalance, CreditPurchaseStatus, CreditTransaction } from '@/types/creditPack'

/**
 * D679 · Paquete «Ilimitado». Por dentro un Ilimitado es un saldo de 99,999 con la marca `unlimited` (como Mindbody); ninguna
 * pantalla del panel enseña ese número. Esto decide qué se pinta; el texto lo pone cada pantalla con sus llaves.
 */
export type BalanceDisplay =
  { kind: 'unlimited'; used: number | null } | { kind: 'count'; remaining: number; total: number; adjusted: boolean }

/** `used` es `null` en una compra reembolsada: el saldo quedó en 0 y «usó 99,999» sería mentira. */
export function describeBalance(b: CreditItemBalance, purchaseStatus: CreditPurchaseStatus): BalanceDisplay {
  if (b.unlimited) {
    return { kind: 'unlimited', used: purchaseStatus === 'REFUNDED' ? null : Math.max(b.originalQuantity - b.remainingQuantity, 0) }
  }
  // Ajustado por arriba de lo comprado: «6 de 1» confunde; la pantalla dice «6 disponibles».
  return { kind: 'count', remaining: b.remainingQuantity, total: b.originalQuantity, adjusted: b.remainingQuantity > b.originalQuantity }
}

/**
 * Un movimiento de un saldo Ilimitado que mueve más de 1 (la compra, o la anulación al reembolsar o vencer) no enseña su número:
 * `'label'` → «Ilimitado», `'voided'` → «Ilimitado anulado» (llaves `unlimited.*`). Con `null` se pinta el número como hoy.
 */
export function describeMovement(tx: CreditTransaction): 'label' | 'voided' | null {
  if (!tx.creditItemBalance?.unlimited || Math.abs(tx.quantity) <= 1) return null
  if (tx.type === 'PURCHASE') return 'label'
  return tx.quantity < 0 ? 'voided' : null
}

/** «Faltas: 0 sin llegar · 1 cancelación tardía»: cada número con su singular o plural (D687). `t` es el de `creditPacks`. */
export function faltasText(t: TFunction, faltas: { noLlego: number; cancelTarde: number }): string {
  return t('unlimited.faltas', {
    noLlego: t('unlimited.noLlego', { count: faltas.noLlego }),
    cancelTarde: t('unlimited.cancelTarde', { count: faltas.cancelTarde }),
  })
}
